# LifeLink Next-Level Implementation Report

**Date:** 25 November 2026  
**Branch:** `feature/lifelink-bloodstream-experience`  
**Baseline HEAD:** `5cf42191683adeebc9ca493c81b5d26254fcb3b3`  
**Delivery status:** verified local increment; this is not a claim that the full requested product transformation is complete.

**Prior commits:** `47b462d` (`Add privacy-aware nearby donor discovery`), `48d8bf2` (`Document LifeLink verification and remaining risks`). Follow-up code, tests and evidence are included in the commit containing this report; publication status is recorded in the final delivery summary.

## Summary

This increment adds privacy-aware nearby donor discovery, synthetic demo-data labelling, responsive interaction fixes, research and AOOP documentation, and verification evidence. The existing Java/Spring modular monolith, React/TypeScript SPA, REST contract, authentication, tenant scope, PostgreSQL/Flyway and STOMP notification approach remain in place.

## Implemented and verified

- Added Flyway V6 donor/organization location columns, freshness fields, bounds/all-or-none constraints and indexes.
- Added immutable `GeoPoint` validation, distance and bounding-box behaviour. Fixed a dateline edge defect found by its tests.
- Added owner-controlled location-discovery consent. Granting consent writes validated coordinates; revocation clears coordinates and freshness in the same transaction.
- Added `GET /api/v1/donors/nearby` with explicit selected-organization permission checks, consent/availability/freshness predicates, SQL bounding-box and exact distance filtering, nearest-first capped results and privacy-limited DTOs. Responses do not contain donor names, contact data or coordinates.
- Added a process-local rate guard and audit metadata. This guard is not a cross-instance rate limiter.
- Added a nearby-donor search page with explicit location input/geolocation permission, blood-group/radius controls, approximate distance bands and clinical-verification guidance. It does not fabricate donor map markers or road distance.
- Added synthetic donor-location fixtures and a runtime mode endpoint. The authenticated UI labels seeded records `DEMO DATA — NOT LIVE BLOOD AVAILABILITY`; the mobile header has a compact visible label with the full warning as its accessible name.
- Fixed digit spacing in dashboard labels and a mobile topbar overflow (401px document width at a 390px viewport).
- Changed the donor directory to bounded server-side search, filtering and pagination (page size capped at 100), with query-level tenant scope and stable ordering.
- Replaced full-table analytics reads/client truncation with database aggregates for available inventory by blood group, emergency requests by status and expiry count. Removed duplicated chart/table presentations.
- Made the donor-to-delivery stages selectable with a live accessible explanation; balanced dashboard and analytics overview metrics at desktop/tablet/mobile widths.
- Added research, architecture/API/domain updates, AOOP syllabus matrix, lecturer demo guide, limitations and this report.

## Java AOOP evidence

| Topic | Implemented code and evidence |
| --- | --- |
| Invariants/value types | `GeoPoint`; constructor validation, coordinate bounds, distance and bounding-box unit tests. |
| Contracts | `DonorDiscoveryService` and consent update preconditions documented in API/domain notes; tests exercise invalid inputs and owner-only writes. |
| SOLID/patterns | Repository/service/controller separation; repository query is the bounded search adapter; existing allocation strategy, compatibility specification and repository contracts are retained. |
| Failure handling | Invalid origin validation maps to client validation response; rate limiting is an explicit bounded failure; existing transaction/idempotency/outbox features remain. |
| Persistence/concurrency | Additive Flyway V6; PostgreSQL 16 integration tests; existing concurrent idempotency/reservation tests run in full suite. |
| Architecture | Modular monolith remains; current architecture, API contract, domain model and UML notes updated. |

Detailed class/test mapping: [`../academic/AOOP_SYLLABUS_IMPLEMENTATION_MATRIX.md`](../academic/AOOP_SYLLABUS_IMPLEMENTATION_MATRIX.md). Demo walkthrough: [`../academic/LECTURER_DEMO_GUIDE.md`](../academic/LECTURER_DEMO_GUIDE.md).

## Verification

| Check | Exact result |
| --- | --- |
| Backend full suite | Cached Maven 3.9.11 direct invocation, from `project/backend`: `mvn -B -ntp -Dmaven.repo.local=C:\Users\karka\.m2\repository test` — **135 passed, 0 failures, 0 errors, 0 skipped**. PostgreSQL 16 Testcontainers covered V1–V6, donor-search privacy/tenant checks, pagination/aggregates, and concurrency/idempotency. |
| Frontend unit tests | `npm.cmd test` from `project/frontend` — **48 passed across 9 files**. |
| TypeScript and production bundle | `npm.cmd run build` — passed; 2,280 modules transformed. Analytics route chunk was 491.05 kB raw / 139.09 kB gzip. |
| Browser E2E | `$env:VITE_API_PROXY_TARGET='http://127.0.0.1:18182'; npm.cmd run test:e2e` — **24/24 passed** across Chrome and Edge (12 specs × 2 browsers). |
| E2E coverage | Seeded admin login/dashboard, 3-column dashboard metric layout, bounded donor search/filter queries, donations with paged donor options, request status refetch, mobile navigation, mobile analytics and desktop nearby/request no-overflow, authenticated STOMP + REST polling, landing journey, reduced motion and keyboard skip link. |
| Diff hygiene | `git diff --check` — passed. |

Browser E2E results: [`../evidence/PLAYWRIGHT_RESULTS.json`](../evidence/PLAYWRIGHT_RESULTS.json). The completed capture inspected 61 route/viewport states; it found zero horizontal-overflow cases, zero missing expected headings, zero failed HTTP responses, and no optional route omissions. The browser console did report a 404 resource warning and repeated Chromium unload-policy messages; the audit does not suppress or claim those are application failures. Authenticated screenshots are under [`../evidence/screenshots`](../evidence/screenshots), with the `final_*` prefix. Custom DOM/accessibility and timing evidence are not formal accessibility or performance certification.

## Research and design decisions

The research record covers e-RaktKosh, WHO cold-chain guidance, HL7 FHIR R5, PostGIS/PostgreSQL options, OSM/Nominatim policy, MapLibre, WCAG 2.2, browser motion and OWASP API security. See [`LIFELINK_DESIGN_AND_ENGINEERING_RESEARCH.md`](LIFELINK_DESIGN_AND_ENGINEERING_RESEARCH.md).

Coordinates are optional and donor-controlled. Donor distance is straight-line Haversine distance, returned as an approximate band; no road distance, travel time, public geocoder or external map tiles are claimed. The API search is capped at 50 results and location freshness is limited to 30 days. No continuous location history is stored.

## Findings and limitations remaining

- The donor directory now uses server-side bounded search and pagination; a mediated contact workflow remains unimplemented.
- Current analytics aggregates cover available blood groups, request statuses and expiry count. Historical time-series/date-range analysis and additional component-level aggregate endpoints remain limited.
- Donor discovery has no mediated outreach/contact workflow, production map provider, geocoding, routing or road-time estimates.
- Nearby search's 20/minute guard is process-local. A multi-instance deployment needs a shared gateway/data-store rate limiter.
- This increment did not fully redesign every operational route, implement cold-chain/device telemetry, request-stage search/expand workflows, or expand every seeded workflow record described in the request.
- No penetration test, load test, Lighthouse run, formal axe/screen-reader audit, clinical validation or production deployment was performed.
- The visible donor search is location-aware but is a list/radius workspace rather than a synchronized map; privacy and lack of configured map services were prioritised over fabricated geographic markers.

See [`LIFELINK_FINAL_ENGINEERING_AUDIT.md`](LIFELINK_FINAL_ENGINEERING_AUDIT.md) and [`../quality/KNOWN_LIMITATIONS.md`](../quality/KNOWN_LIMITATIONS.md) for the full disposition.

## Git and preservation

The original tree was already dirty before implementation, including user changes to the abstract documents/evidence and untracked `LAB-WORK/PRACTICAL-4/` files. Those files were preserved and excluded from the LifeLink commit. No reset, clean, history rewrite, push, merge or database-volume deletion was performed. The remaining uncommitted files are the preserved abstract/evidence edits, `LAB-WORK/` files and unselected screenshot captures.
