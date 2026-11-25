# LifeLink Lecturer Demonstration Guide

LifeLink coordinates donors, screened donations, inventory, emergency requests, reservations, dispatch and audit. It is a local academic demo, not a live blood-availability service or a clinically validated system.

## Five-minute product walkthrough

1. Sign in as `hospital@lifelink.local` / `Hospital@123!` and confirm the selected organization is LifeCare General Hospital.
2. Show the dashboard queues and the runtime **DEMO DATA — NOT LIVE BLOOD AVAILABILITY** banner.
3. Open **Nearby donor finder**. Search `O Positive`, radius `10 km`, using demo origin `17.3850, 78.4867` (synthetic area centre, not a real facility location).
4. Explain that results require current location consent, an available donor state and a location no older than 30 days. The response gives an approximate straight-line distance band and does not disclose names, phone numbers or coordinates.
5. Open **Emergency requests** and **Allocations**. Explain that suggestions are advisory, the selected group is never silently substituted, and final clinical compatibility remains with authorized staff.
6. Open **Inventory** and show status/expiry labels, then **Audit** to discuss who performed an operation and when.

## Ten-minute engineering walkthrough

1. Show `GeoPoint` and its boundary/non-finite validation and explain why coordinate order is latitude/longitude inside the Java value object.
2. Show Flyway `V6`: nullable coordinates, all-or-none checks and B-tree prefilter indexes. Migration is additive; no existing database volume is deleted.
3. Show `DonorService.updateLocationPreference`: donor-only consent, atomic coordinate write/revocation and clearing coordinates on withdrawal.
4. Show `DonorDiscoveryService.search`: explicit organization selection, `DONOR_DISCOVERY_READ`, active/verified organization check, bounded radius and audit entry.
5. Show `DonorProfileRepository.findNearbyOptedIn`: SQL filters consent and availability, applies a freshness cutoff and Haversine distance before returning at most 51 rows to Java.
6. Show `NearbyDonorView`: no exact or approximate coordinates, email, name or phone. Explain why the UI uses a result list and radius illustration instead of donor map markers.
7. Show `DonorLocationPreferenceTest`, `NearbyDonorRepositoryTest` and `DonorDiscoveryServiceTest`; then show reservation/idempotency and PostgreSQL concurrency tests.
8. Map the examples to [`AOOP_SYLLABUS_IMPLEMENTATION_MATRIX.md`](AOOP_SYLLABUS_IMPLEMENTATION_MATRIX.md).

## Demonstration accounts

| Account | Password | Scope |
| :--- | :--- | :--- |
| `hospital@lifelink.local` | `Hospital@123!` | Hospital requests and nearby donor discovery |
| `bank@lifelink.local` | `Bank@123!` | Blood-bank operations and donor discovery |
| `donor@lifelink.local` | `Donor@123!` | Own donor profile and optional location consent |
| `admin@lifelink.local` | `Admin@123!` | Platform administration; donor search still needs an explicit selected organization |

These credentials exist only in local/demo seed mode. Never use them on a public deployment.

## Privacy and safety script

- Donor sharing is optional; granting it is an explicit action and can be revoked.
- Search returns coarse distance bands and last location update only.
- Coordinates are synthetic demo values; no public geocoder receives them.
- Donor proximity, self-reported availability and blood group do not establish donor fitness or clinical compatibility.
- No automatic outreach or clinical substitution is performed.

## Known limitations

- Road routes/travel time and provider-backed maps are not configured.
- The search throttle is per application process; public or multi-instance deployments need a shared API-gateway limit.
- The synthetic dataset demonstrates selected workflows but is not a prediction of real supply.
- Production PostgreSQL query, full browser workflow and accessibility evidence must be current before claiming deployment readiness.
