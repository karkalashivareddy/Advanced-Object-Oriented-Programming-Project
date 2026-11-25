/*
 * Nearby Donor Finder API evidence collector.
 *
 * Runs against a live backend and records only redacted request/response metadata.
 * It never writes tokens, passwords, exact donor coordinates, names, or contact data.
 *
 * Usage:
 *   API_URL=http://127.0.0.1:18080 node project/docs/evidence/geospatial_api_evidence.cjs
 * Optional:
 *   NEARBY_LAT=... NEARBY_LON=... NEARBY_BLOOD_GROUP=O_POSITIVE
 *   LIFELINK_DEMO_EMAIL=... LIFELINK_DEMO_PASSWORD=...
 */
const fs = require('node:fs');
const path = require('node:path');

const API = (process.env.API_URL || 'http://127.0.0.1:18080').replace(/\/$/, '');
const EMAIL = process.env.LIFELINK_DEMO_EMAIL || 'bank@lifelink.local';
const PASSWORD = process.env.LIFELINK_DEMO_PASSWORD || 'Bank@123!';
const FORBIDDEN_FIELDS = [
  'id', 'userId', 'fullName', 'name', 'email', 'phone', 'contact', 'dateOfBirth', 'dob',
  'address', 'city', 'state', 'latitude', 'longitude', 'exactLatitude', 'exactLongitude',
  'preferredContact', 'publicName',
];

function findByKey(value, key) {
  if (!value || typeof value !== 'object') return undefined;
  if (Object.prototype.hasOwnProperty.call(value, key)) return value[key];
  for (const nested of Object.values(value)) {
    const found = findByKey(nested, key);
    if (found !== undefined) return found;
  }
  return undefined;
}

async function request(label, url, options = {}) {
  const started = Date.now();
  const response = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(20000),
    headers: { Accept: 'application/json', ...(options.headers || {}) },
  });
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = { nonJson: text.slice(0, 300) }; }
  return {
    label,
    method: options.method || 'GET',
    path: url.replace(API, ''),
    status: response.status,
    durationMs: Date.now() - started,
    contentType: response.headers.get('content-type'),
    cacheControl: response.headers.get('cache-control'),
    body,
  };
}

function summary(record) {
  return {
    label: record.label,
    method: record.method,
    path: record.path,
    status: record.status,
    durationMs: record.durationMs,
    contentType: record.contentType,
    cacheControl: record.cacheControl,
    success: record.body?.success ?? null,
    errorCode: record.body?.error?.code || record.body?.code || null,
    message: record.body?.message || null,
    correlationId: record.body?.correlationId || null,
  };
}

(async () => {
  const records = [];
  const health = await request('health', `${API}/actuator/health`);
  records.push(health);

  const login = await request('login', `${API}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  records.push(login);

  const token = findByKey(login.body, 'accessToken');
  const user = findByKey(login.body, 'user');
  const memberships = user?.memberships || findByKey(login.body, 'memberships') || [];
  const organizationId = process.env.NEARBY_ORG_ID
    ? Number(process.env.NEARBY_ORG_ID)
    : memberships.find((m) => m.organizationId)?.organizationId;
  const latitude = process.env.NEARBY_LAT ? Number(process.env.NEARBY_LAT) : undefined;
  const longitude = process.env.NEARBY_LON ? Number(process.env.NEARBY_LON) : undefined;
  const bloodGroup = process.env.NEARBY_BLOOD_GROUP || 'O_POSITIVE';

  if (!token) throw new Error('Login response did not contain accessToken');
  if (!organizationId) throw new Error('No organizationId available from login response');
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new Error('Set NEARBY_LAT and NEARBY_LON to the documented synthetic demo centre coordinates');
  }

  const authHeaders = {
    Authorization: `Bearer ${token}`,
    'X-Organization-Id': String(organizationId),
  };

  const validParams = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    radiusKm: '10',
    bloodGroup,
    limit: '20',
  });
  const nearby = await request('nearby_valid', `${API}/api/v1/donors/nearby?${validParams}`, { headers: authHeaders });
  records.push(nearby);

  const noOrg = await request('nearby_missing_org', `${API}/api/v1/donors/nearby?${validParams}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  records.push(noOrg);

  const invalidRadius = new URLSearchParams(validParams);
  invalidRadius.set('radiusKm', '51');
  const badRadius = await request('nearby_invalid_radius', `${API}/api/v1/donors/nearby?${invalidRadius}`, { headers: authHeaders });
  records.push(badRadius);

  const invalidLat = new URLSearchParams(validParams);
  invalidLat.set('latitude', '91');
  const badLat = await request('nearby_invalid_latitude', `${API}/api/v1/donors/nearby?${invalidLat}`, { headers: authHeaders });
  records.push(badLat);

  const data = nearby.body?.data;
  const results = Array.isArray(data) ? data : [];
  const leakedFields = results.flatMap((item) => Object.keys(item).filter((key) => FORBIDDEN_FIELDS.includes(key)));
  const allowedFields = ['publicId', 'bloodGroup', 'availability', 'distanceBand', 'approximateLatitude', 'approximateLongitude', 'locationPrecision'];
  const unexpectedFields = results.flatMap((item) => Object.keys(item).filter((key) => !allowedFields.includes(key)));
  const safetyNote = 'Nearby donor discovery is an operational assistance feature. Final donor eligibility, blood compatibility and clinical decisions require authorized clinical verification.';

  const output = {
    generatedAt: new Date().toISOString(),
    apiBase: API,
    method: 'Live HTTP evidence against a running backend; credentials and tokens are redacted.',
    demoCentre: { latitude, longitude, bloodGroup, radiusKm: 10, organizationId },
    checks: {
      healthUp: health.status === 200 && health.body?.status === 'UP',
      loginSucceeded: login.status === 200 && Boolean(token),
      nearbySucceeded: nearby.status === 200 && nearby.body?.success === true,
      noExactCoordinatesOrPii: leakedFields.length === 0,
      noUnexpectedResponseFields: unexpectedFields.length === 0,
      missingOrgRejected: noOrg.status >= 400,
      invalidRadiusRejected: badRadius.status === 400,
      invalidLatitudeRejected: badLat.status === 400,
      noStoreCacheHeader: /no-store/i.test(nearby.cacheControl || ''),
    },
    privacy: {
      forbiddenFieldsChecked: FORBIDDEN_FIELDS,
      leakedFields: [...new Set(leakedFields)],
      unexpectedFields: [...new Set(unexpectedFields)],
      allowedFields,
      resultCount: results.length,
      sampleResultShape: results[0] ? Object.fromEntries(Object.keys(results[0]).map((key) => [key, typeof results[0][key]])) : null,
    },
    safetyNote,
    requests: records.map(summary),
    limitations: [
      'This evidence verifies the HTTP contract and response shape only; backend unit/integration tests verify consent, tenant, and proximity rules.',
      'Coordinates are demonstration centre inputs, not disclosed donor locations.',
      'Rate limiting is covered by backend tests/config, not by repeated live requests in this collector.',
    ],
  };
  const outPath = path.join(__dirname, 'GEOSPATIAL_EVIDENCE.json');
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(JSON.stringify({ checks: output.checks, resultCount: results.length, output: path.basename(outPath) }, null, 2));
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
