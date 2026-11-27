import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LocateFixed, MapPin, Radio, ShieldCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { BLOOD_GROUPS } from '@/lib/constants';
import { PERMISSIONS } from '@/lib/permissions';
import { formatDateTime, humanize } from '@/lib/utils';
import {
  EmptyState,
  ErrorState,
  FormField,
  Grid,
  Input,
  PageHeader,
  Select,
  Skeleton,
  StatusBadge,
  Surface,
} from '@/components/ui';
import type { BloodGroup, DonorAvailability } from '@/types/domain';

interface NearbyDonor {
  publicId: string;
  bloodGroup: BloodGroup;
  availability: DonorAvailability;
  distanceBand: string;
  locationUpdatedAt: string;
  distanceMeaning: 'STRAIGHT_LINE_APPROXIMATE';
}

interface NearbyDonorResponse {
  donors: NearbyDonor[];
  radiusKm: number;
  returnedCount: number;
  moreMatchesAvailable: boolean;
  distanceMeaning: string;
}

export function NearbyDonorsPage() {
  const auth = useAuth();
  const canSearch = auth.hasPermission(PERMISSIONS.DONOR_DISCOVERY_READ);
  const [bloodGroup, setBloodGroup] = useState<BloodGroup>('O_POSITIVE');
  const [radiusKm, setRadiusKm] = useState(10);
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [locationError, setLocationError] = useState('');

  const lat = Number(latitude);
  const lon = Number(longitude);
  const validOrigin = latitude.trim() !== '' && longitude.trim() !== ''
    && Number.isFinite(lat) && lat >= -90 && lat <= 90
    && Number.isFinite(lon) && lon >= -180 && lon <= 180;

  const results = useQuery({
    queryKey: ['donors', 'nearby', bloodGroup, radiusKm, lat, lon, auth.organizationId],
    queryFn: () => api.get<NearbyDonorResponse>('/donors/nearby', {
      query: { bloodGroup, radiusKm, latitude: lat, longitude: lon },
    }),
    enabled: submitted && canSearch && validOrigin,
    retry: false,
  });

  const useDeviceLocation = () => {
    setLocationError('');
    if (!navigator.geolocation) {
      setLocationError('This browser does not provide location access. Enter coordinates manually.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLatitude(coords.latitude.toFixed(5));
        setLongitude(coords.longitude.toFixed(5));
        setSubmitted(false);
      },
      () => setLocationError('Location was not shared. Enter a hospital location manually to continue.'),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  };

  if (!canSearch) {
    return <EmptyState title="Donor discovery is restricted" description="Your selected organization does not have permission to search for consenting donors." />;
  }

  return (
    <div className="page-stack nearby-donors-page">
      <PageHeader
        eyebrow="Privacy-aware search"
        title="Nearby donor finder"
        description="Find available donors who have opted in to approximate location discovery. Results are operational leads only."
      />

      <section className="nearby-search-layout" aria-label="Donor discovery search">
        <Surface as="section" variant="flat" padding="md" className="nearby-search-panel">
          <div className="nearby-panel-heading">
            <span className="nearby-icon"><Radio size={18} aria-hidden="true" /></span>
            <div>
              <h2>Search the network</h2>
              <p>Matches require current consent, available status and a location updated in the last 30 days.</p>
            </div>
          </div>
          <Grid columns="auto" gap="md" className="nearby-filter-grid">
            <FormField label="Requested blood group" required>
              <Select value={bloodGroup} onChange={(event) => { setBloodGroup(event.target.value as BloodGroup); setSubmitted(false); }}>
                {BLOOD_GROUPS.map((group) => <option value={group} key={group}>{humanize(group)}</option>)}
              </Select>
            </FormField>
            <FormField label="Search radius" required hint="Maximum supported radius is 50 km.">
              <Select value={radiusKm} onChange={(event) => { setRadiusKm(Number(event.target.value)); setSubmitted(false); }}>
                {[5, 10, 25, 50].map((distance) => <option value={distance} key={distance}>{distance} km</option>)}
              </Select>
            </FormField>
            <FormField label="Origin latitude" required hint="Use a hospital location. Coordinates stay in this form and are sent only to the LifeLink API.">
              <Input inputMode="decimal" value={latitude} onChange={(event) => { setLatitude(event.target.value); setSubmitted(false); }} placeholder="12.9716" />
            </FormField>
            <FormField label="Origin longitude" required>
              <Input inputMode="decimal" value={longitude} onChange={(event) => { setLongitude(event.target.value); setSubmitted(false); }} placeholder="77.5946" />
            </FormField>
          </Grid>
          {locationError && <p className="field-error" role="alert">{locationError}</p>}
          <div className="nearby-actions">
            <button type="button" className="btn btn-secondary" onClick={useDeviceLocation}>
              <LocateFixed size={16} aria-hidden="true" /> Use this device location
            </button>
            <button type="button" className="btn btn-primary" disabled={!validOrigin || results.isFetching}
              onClick={() => setSubmitted(true)}>
              <MapPin size={16} aria-hidden="true" /> Search nearby donors
            </button>
          </div>
        </Surface>

        <Surface as="aside" variant="tint" padding="md" className="nearby-privacy-panel" aria-label="Search method and privacy">
          <div className="nearby-radius-visual" aria-hidden="true">
            <span className="radius-ring radius-ring-outer" />
            <span className="radius-ring radius-ring-inner" />
            <span className="radius-origin"><MapPin size={18} /></span>
          </div>
          <h2>How matching works</h2>
          <ol>
            <li>Search is scoped to your selected, active organization.</li>
            <li>The server filters by blood group, consent, availability and radius.</li>
            <li>Exact donor coordinates and contact details are not returned.</li>
          </ol>
          <div className="nearby-safety-note">
            <ShieldCheck size={17} aria-hidden="true" />
            <p>Nearby donor discovery is an operational assistance feature. Final donor eligibility, blood compatibility and clinical decisions require authorized clinical verification.</p>
          </div>
        </Surface>
      </section>

      <Surface as="section" variant="flat" padding="md" className="nearby-results" aria-labelledby="nearby-results-heading" aria-live="polite">
        <div className="nearby-results-header">
          <div>
            <span className="eyebrow">Response</span>
            <h2 id="nearby-results-heading">Potential matches</h2>
          </div>
          {results.data && <span className="nearby-result-count">{results.data.returnedCount} returned · within {results.data.radiusKm} km</span>}
        </div>
        {results.isFetching && <div className="nearby-result-skeleton" aria-label="Searching for potential donors"><Skeleton /><Skeleton /><Skeleton /></div>}
        {results.isError && <ErrorState error={results.error} title="Donor search failed" onRetry={() => void results.refetch()} />}
        {!submitted && !results.isFetching && !results.isError && (
          <EmptyState title="Ready when you are" description="Set a blood group, radius and hospital origin to run a privacy-aware search." />
        )}
        {submitted && results.data?.donors.length === 0 && !results.isFetching && (
          <EmptyState title="No current matches in this radius" description="You can expand the radius, confirm the origin, or use the blood-centre inventory workflow. The system does not change the requested blood group." />
        )}
        {results.data?.donors.length ? (
          <>
            <div className="nearby-match-list">
              {results.data.donors.map((donor, index) => (
                <article className="nearby-match-row" key={donor.publicId}>
                  <span className="nearby-match-index">{String(index + 1).padStart(2, '0')}</span>
                  <div className="nearby-match-group"><strong>{humanize(donor.bloodGroup)}</strong><span>{donor.distanceBand} · straight-line estimate</span></div>
                  <StatusBadge status={donor.availability} />
                  <span className="nearby-match-freshness">Location updated {formatDateTime(donor.locationUpdatedAt)}</span>
                </article>
              ))}
            </div>
            {results.data.moreMatchesAvailable && <p className="field-hint">Showing the nearest 50 matches. Narrow the radius to refine results.</p>}
          </>
        ) : null}
        <p className="nearby-disclaimer">A matching blood group is not a clinical compatibility decision. Donor availability is self-reported; screening and eligibility must be confirmed by authorized personnel.</p>
      </Surface>
    </div>
  );
}
