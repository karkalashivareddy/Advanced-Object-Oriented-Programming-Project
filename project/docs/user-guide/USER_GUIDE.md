# LifeLink User Guide

Date: 24 November 2026
Status: describes the implemented local-development application and its documented API. It is not a claim of a production deployment. All REST paths below are relative to `/api/v1` and follow [`../architecture/API_CONTRACTS.md`](../architecture/API_CONTRACTS.md); state names follow [`../architecture/DOMAIN_MODEL.md`](../architecture/DOMAIN_MODEL.md).

> **WARNING: The credentials below are local-only seeded development fixtures.** They are enabled by `lifelink.seed.enabled=true` / `SEED_DEMO_DATA=true` in `dev`, `default`, or `postgres` profiles. They must never be enabled in a production or publicly reachable environment. Production credentials come from environment configuration and are not documented here.

Run the local stack with the commands in [`../deployment/DEPLOYMENT_GUIDE.md`](../deployment/DEPLOYMENT_GUIDE.md). The frontend dev server is `http://localhost:5173`; in the verified Compose stack the SPA is `http://localhost:15173` and the backend base URL is `http://localhost:18080/api/v1` (`8080` is occupied locally). `JWT_SECRET` is supplied in the shell at startup, never stored in the docs.

---

## 1. Seeded accounts

| Account | Password | Global role | Seeded organization membership |
| :--- | :--- | :--- | :--- |
| `admin@lifelink.local` | `Admin@123!` | `PLATFORM_ADMIN` | Cross-organization read; organization verification |
| `bank@lifelink.local` | `Bank@123!` | `BLOOD_BANK_ADMIN` | Central Blood Bank |
| `inventory@lifelink.local` | `Inventory@123!` | `INVENTORY_MANAGER` | Central Blood Bank |
| `hospital@lifelink.local` | `Hospital@123!` | `HOSPITAL_ADMIN` | LifeCare General Hospital |
| `medical@lifelink.local` | `Medical@123!` | `MEDICAL_STAFF` | LifeCare General Hospital |
| `donor@lifelink.local` | `Donor@123!` | `DONOR` | LifeCare General Hospital (donor profile) |

Seeded organizations: **Central Blood Bank** (`BLOOD_BANK`) and **LifeCare General Hospital** (`HOSPITAL`). All seeded users have `Status.ACTIVE`; no seeded account is `PENDING_VERIFICATION`.

These credentials are used by the integration suite. The current development seeder source defines synthetic nearby-discovery profiles and 17 donors across 22 users, alongside nine blood units. The linked Compose evidence is the earlier V1–V5 run; a fresh Compose verification for V6 and the expanded seed remains pending. The seeder runs under `postgres` only when `SEED_DEMO_DATA=true`; standalone PostgreSQL defaults to no demo seed.

---

## 2. Signing in and switching organization

1. Open the frontend and sign in with one of the accounts above. The client calls `POST /auth/login` with `{ "email", "password" }` and stores the returned access/refresh token pair.
2. The identity menu shows the current organization. Use **Switch organization** to select another membership; the frontend sends `X-Organization-Id: <id>` on subsequent API requests and clears cached query results so no data from the previous organization remains visible. Login restores only a previously valid explicit selection; no first membership is auto-selected, and an unscoped request lets the backend apply its documented single-membership default.
3. A malformed `X-Organization-Id` is rejected with `400 VALIDATION_ERROR`; an id outside the caller's memberships returns `403 TENANT_ACCESS_DENIED`. Permissions are never expanded by the header: a user with only `DONOR` still sees only their own data.
4. `PLATFORM_ADMIN` may select any organization for reads but must still obey the domain state machines. The frontend's disabled controls are not an authorization mechanism; server method security is.

Token details: access tokens carry a unique `jti` and `token_version`. Password change and any status change (lock, disable, re-enable) increment the persistent `users.token_version` (Flyway `V5`), so older access tokens stay revoked permanently. `POST /auth/logout` revokes the presented refresh token and denies only the presented bearer `jti` **in the process that handled the request** (`F-04`); this denylist is process-local and a multi-instance deployment needs a shared store. Refresh tokens rotate, and reuse of an old token revokes the token family. Failed logins lock the account after 5 failures for 15 minutes. Login/register/refresh 401 responses also count toward a single-node in-memory limit of 10 attempts per 60 seconds per IP + account + path; the next attempt returns `429 RATE_LIMITED`.

---

## 3. Role journeys that work end to end

The following sequences are implemented. The current local run recorded backend 119 tests with 0 failures/errors/skips, frontend 39 unit tests, and Playwright 18 passed on Chrome and Edge with retries 0
([`../evidence/PLAYWRIGHT_RESULTS.json`](../evidence/PLAYWRIGHT_RESULTS.json)); detailed per-class results are maintained in the quality workstream's test documents. Steps marked *advisory* produce suggestions, not guaranteed stock.

### 3.1 Donor

1. Sign in as `donor@lifelink.local`. The dashboard shows **My donations**, **My appointments**, **My consents**, and **Notifications** from real API data.
2. `GET /donors` returns the donor profiles visible to the caller (a donor sees their own profile); use the returned numeric id as `{id}`. The SPA then reads `GET /donors/{id}`, `GET /donors/{id}/appointments`, `GET /donors/{id}/consents`, and `GET /donations?donorId={id}`. There is no `/donors/me` or `/donors/me/...` route.
3. Request an appointment with `POST /donors/{id}/appointments` (`scheduledAt`, `organizationId`, optional notes). Default status is `REQUESTED`; staff can move it to `CONFIRMED`, `COMPLETED`, `REJECTED`, or `CANCELLED` via `PATCH /donors/appointments/{appointmentId}`.
4. Record consent with `POST /donors/{id}/consents` and withdraw via `PATCH /donors/{id}/consents/{consentId}`.
5. Read notifications with `GET /notifications` (the unread count is `{ "count": ... }`, not a bare number) and mark them read with `POST /notifications/{id}/read`. The REST inbox is authoritative and polling is the fallback. The SPA also mounts an authenticated SockJS/STOMP bridge through `/ws`: CONNECT carries a `Bearer` JWT, SUBSCRIBE is limited to `/user/queue/notifications`, and broker events invalidate notification caches without bypassing REST ownership checks. Evidence: [`../evidence/BROWSER_STOMP_RESULT.json`](../evidence/BROWSER_STOMP_RESULT.json).

### 3.2 Inventory manager

1. Sign in as `inventory@lifelink.local` (Central Blood Bank).
2. Create or view units under `/inventory`. A new or approved-donation unit starts `QUARANTINED` with `released=false`; use `POST /inventory/{id}/release` to make it `AVAILABLE`. The UI shows `publicId`, `unitNumber`, blood group, component, status, expiry, location, and `version`.
3. Use `POST /inventory/adjustments` with `{unitId,delta?,reason,location?}` for stock corrections, `POST /inventory/{id}/expire` for expired stock, and `GET /inventory/{id}/movements` for that unit's audit trail. Each mutation appends an `InventoryMovement`.
4. Storage location is a string field on the unit and on adjustments; no separate storage-location management endpoint is exposed.
5. Expiry processing also runs in `LifecycleScheduler` every five minutes.

### 3.3 Hospital admin / medical staff — request and receive blood

1. Sign in as `hospital@lifelink.local` or `medical@lifelink.local` (LifeCare General Hospital).
2. Create a request with `POST /emergency-requests` (blood group, component, quantity, priority, `requiredBy`, patient reference). It starts `PENDING_VERIFICATION`.
3. An authorized approver (bank admin, hospital admin, or platform admin with `REQUEST_APPROVE`) calls `POST /emergency-requests/{id}/verify` → `VERIFIED`, then `POST /emergency-requests/{id}/approve` → `APPROVED`. Rejection uses `/reject`; cancellation uses `/cancel`.
4. Review suggestions with `POST /allocations/suggestions` (`ALLOCATION_REVIEW`). This returns ranked, rejection-labelled candidates; it never reserves stock.
5. Bank staff confirm allocation with `POST /allocations/confirm` (`ALLOCATION_CONFIRM`, `requestId`, `unitIds`) and a fresh `Idempotency-Key`. The request moves `APPROVED → ALLOCATING → RESERVED`. The seeded bank admin can do this; `hospital@lifelink.local` has no allocation permission and will receive `403`.
6. Hospital staff confirm the reservation with `POST /reservations/{id}/confirm`. This requires an `ACTIVE`, unexpired reservation.
7. **Only the supplying bank** creates the dispatch with `POST /dispatches` (`reservationId`, `assignedStaff`) and a fresh `Idempotency-Key`. The seeded `bank@lifelink.local` succeeds; `hospital@lifelink.local` receives `403 UNAUTHORIZED_OPERATION`; an unaffiliated user receives `403 TENANT_ACCESS_DENIED`. This cross-organization split is covered by `bankStaffCanDispatchHospitalRequestButHospitalStaffCannot`.
8. Bank staff move the dispatch `PREPARING → IN_TRANSIT` with `/depart`, may record `/incident`, and complete `/deliver` with a recipient name. Delivery marks the unit `DELIVERED`, releases the hold, and can fulfil the request (`FULFILLED`). A delivery after an incident is allowed and preserves the incident description.
9. Reusing an idempotency key with the same request fingerprint replays the original response; reusing it with changed `unitIds`/`assignedStaff` returns `409 BUSINESS_RULE_VIOLATION`. Keys are limited to 120 characters: an overlong reservation body key or allocation/dispatch header returns `400 VALIDATION_ERROR` before transactional work; a missing dispatch `Idempotency-Key` returns `409 BUSINESS_RULE_VIOLATION`. A header key that differs from the body key is rejected `400`. Lock or integrity races return `409 CONCURRENCY_CONFLICT`; retry with a fresh key if the operation did not commit.

### 3.4 Blood bank admin — donor screening and organizations

1. Sign in as `bank@lifelink.local`. Use `/donors` (staff scope) and `/donations` to record a donation (`POST /donations`), record screening (`POST /donations/{id}/screen` with `{ "passed": true }`), then approve (`POST /donations/{id}/approve`). Approval requires a stored passing screening record and creates `QUARANTINED` units.
2. Reject a donation with `POST /donations/{id}/reject`. `SCREENED → APPROVED` and `SCREENED → REJECTED` are the only exits from `SCREENED`.
3. Manage organizations with `/organizations`; creating a pending organization requires verification by `PLATFORM_ADMIN`. Only verified, active organizations can supply stock.
4. Use `/users` for user management and `/audit-logs` for the correlated audit trail (`AUDIT_READ`).

### 3.5 Platform admin

1. Sign in as `admin@lifelink.local`. Verify organizations (`POST /organizations/{id}/verify`), read users across organizations (`GET /users`), and filter audit logs globally (`GET /audit-logs`).
2. Read the only three analytics endpoints: `/analytics/overview`, `/analytics/inventory`, and `/analytics/requests`. The Analytics page includes an **Organization scope** select for platform admins; sending `X-Organization-Id` scopes metrics to one organization, while omitting it gives a cross-organization view. Non-platform users with one membership are scoped implicitly; multiple memberships require an explicit selection. A header outside the caller's memberships yields `403 TENANT_ACCESS_DENIED`.
3. Platform admin can select any organization with `X-Organization-Id` but cannot skip verification, approval, reservation, or dispatch transitions.

---

## 4. UI and interaction notes

- The interface is a React/TypeScript SPA with the Bloodstream visual identity (`Every drop has a journey.`, `BloodstreamVisual`, `JourneyVessel`, `bloodstream-flow`, and SMIL cells), a role-aware dashboard, task queues, filters, confirmation modals, pickers, freshness indicators, skeleton/empty/error states, responsive dialogs, reduced-motion support, and text alternatives for charts. Dashboard values come from real API responses; there is no hardcoded data. Evidence: [`../evidence/AFTER_BROWSER_AUDIT.json`](../evidence/AFTER_BROWSER_AUDIT.json).
- Filter selections are kept in React Query keys, so different filter combinations cache independently. Analytics query keys also include the selected organization scope, so switching scope cannot reuse another organization's cached figures. Confirmation modals protect destructive actions such as cancellation, expiry, and status changes.
- A visible "last updated" indicator reflects the API fetch time; it is not a live socket guarantee.
- Audit and error responses include a correlation id (`X-Correlation-Id`). Quote it when reporting a problem.

---

## 5. Known limits

- WebSocket delivery is implemented behind authenticated STOMP. A standalone SockJS/STOMP smoke recorded `CONNECTED` and `MESSAGE` through the Compose nginx proxy, and the SPA now has an authenticated browser bridge recorded in [`../evidence/BROWSER_STOMP_RESULT.json`](../evidence/BROWSER_STOMP_RESULT.json). The REST inbox remains the authoritative fallback; no client-to-server SEND workflow is supported.
- Rate limiting and the logout `jti` denylist are in-memory (`F-04`); a multi-instance deployment would need shared stores. Persistent `token_version` revocation is database-backed.
- No MFA, no breach-password check, no audit retention/tamper-evidence, and no production TLS/secrets configuration are provided in this local stack. CI is documented as a deployment step only and has not run.
- Playwright E2E specs under `project/frontend/e2e` passed 18 tests on Chrome and Edge with retries 0 (`app.spec.ts` 5 cases and `landing.spec.ts` 4 cases per browser)
  ([`../evidence/PLAYWRIGHT_RESULTS.json`](../evidence/PLAYWRIGHT_RESULTS.json)). See [`../quality/KNOWN_LIMITATIONS.md`](../quality/KNOWN_LIMITATIONS.md) for the full limitation list.
