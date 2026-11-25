# LifeLink Deep Engineering Audit

**Date:** 24 November 2026  
**Branch:** `feature/lifelink-bloodstream-experience`  
**Baseline HEAD:** `5cf42191683adeebc9ca493c81b5d26254fcb3b3`  
**Audit status:** implementation is in progress in a dirty working tree; no changes pushed or merged. This is an evidence-led current audit, not a completion claim.

## 1. Git and preservation baseline

- Branch verified as `feature/lifelink-bloodstream-experience`; HEAD `5cf4219` matches `origin/main` at the start of this turn (`0 ahead / 0 behind`). Existing commits `2b77ca7`, `4f68323`, `1819a9f`, `3159adc`, `5a07ae9`, and `d532f25` are present. HEAD also includes the later `5cf4219` abstract restoration commit.
- The tree already contained user modifications in Java, React, abstract documents and evidence, plus user-created geo/form tests and files. Those changes were preserved and extended in scope.
- `LAB-WORK/PRACTICAL-4/` was left untouched. No reset, clean, history rewrite, push, merge or database-volume deletion was used.
- The repository already contained many ignored build outputs and dependencies. They were not removed.

## 2. Current product and architecture

The application remains a Java 21/Spring Boot 3.5.16 modular monolith with PostgreSQL/Flyway, a React 19/TypeScript/Vite SPA, REST `/api/v1`, and authenticated STOMP notification invalidation. Java owns the new donor-location consent, validation, search query, permissions, rate guard and audit. React owns the filters, explicit location interaction, result list and feedback.

Research and rationale are in [`LIFELINK_DESIGN_AND_ENGINEERING_RESEARCH.md`](LIFELINK_DESIGN_AND_ENGINEERING_RESEARCH.md). The sources include e-RaktKosh availability search, WHO cold-chain guidance, HL7 FHIR R5 biologically-derived product, MapLibre/OSM/Nominatim policies, WCAG 2.2, Chrome motion guidance and OWASP API Security.

## 3. Findings and disposition

| Severity | Finding / reproduction | Root cause and evidence | Disposition | Regression evidence |
| :--- | :--- | :--- | :--- | :--- |
| Medium | Dashboard labels such as `expiringWithin7Days` render as `Expiring Within7 Days`. | `humanize` split camelCase letters but not letter/digit boundaries. | **Fixed** by separating letter-number and number-letter transitions. | `project/frontend/src/lib/utils.test.ts`; 47 frontend tests passed. |
| Medium | Analytics local edits failed TypeScript: `useEffect` missing and an unused motion import present. | Incomplete in-progress edit in `AnalyticsPage.tsx`. | **Fixed**; latest frontend build passed after the consent and runtime-banner edits. | `npm.cmd test`; `npm.cmd run build`. |
| High (evidence) | Dashboard, Inventory and Analytics desktop baseline screenshot files are byte-identical. | SHA-256 for all three files is `F6F4BBB8CE69D5DDD7B2A6D45CEF9D4B6FC4BD04E40A7F4CB81F5FC9562695CB`; these captures show the unauthenticated sign-in view and do not evidence the protected pages. | **Open:** recapture authenticated routes, asserting URL, heading and API success before saving. | New captures must use `final_browser_audit.cjs` after a local app is running. |
| High | Donor list fetches all visible `GET /donors` records and filters/paginates client-side; donor view includes full name and email. | `DonorService.list()` uses `findAll()`/all donation history; `DonorsPage.tsx` filters and paginates in the browser. | **Open:** add server-side filtering and bounded pagination; review whether list responses need name/email and enforce field-level scope. | Add page size, authorization and large-data tests; static source inspection only so far. |
| High | Analytics obtains at most 200 inventory rows and all emergency requests for client-side aggregation. | Current chart metrics can be incomplete beyond those client retrieval bounds. | **Open:** use correctly scoped aggregate endpoints or label the page scope and ensure server filters. | Add >200 fixture test, date/filter tests and aggregation reconciliation. |
| Medium | No real geospatial donor workflow existed at the 5cf4219 baseline. | No coordinates, opt-in field, radius endpoint or geographic repository query were present. | **Implemented in working tree:** additive V6, `GeoPoint`, donor-owned location consent, bounded database-side Haversine search, explicit organization permission, audit, process-local throttle, opaque response and React results UI. | Targeted 9 tests passed on H2/unit for radius, consent, query and authorization. PostgreSQL API tests and complete suite are pending final run. |
| Medium | First Haversine bounding-box test found a dateline-edge bug. | Longitude delta divided a degree conversion by Earth radius a second time, creating an undersized box. | **Fixed** with angular distance in radians used directly in `sin`. | `GeoPointTest` passes targeted after correction. |
| Medium | Nearby search must not disclose donor location or contact details. | A prepared DTO initially exposed a coarse grid cell, which still reveals a residential area. | **Fixed in working tree:** result DTO returns no donor coordinates, names, emails, phone numbers or consent fields; location is owner-opt-in, withdrawal clears coordinates, SQL rechecks consent and availability. | DTO/query tests pass; API-level leak/tenant tests added for PostgreSQL Testcontainers and await full execution. |
| Medium | Demo data can be mistaken for live blood availability. | Existing seed set was very small and had no visible runtime label. | **Implemented in source:** deterministic synthetic donor candidates, fake `.local` accounts/demo coordinates and `/runtime/mode` banner: `DEMO DATA · NOT LIVE BLOOD AVAILABILITY`. | Full seed-enabled Postgres API tests and Compose refresh still pending. |
| Low | Map visual providers and routing are not configured. | No map library/style/geocoder was installed; public OSM/Nominatim have usage limits. | **Intentionally not represented as live:** list/radius visual is used; no fabricated donor markers, road distance, travel time or public geocoder. | Research decision documented; future provider needs explicit contract and attribution. |
| Medium | Landing journey remains less interactive than requested and authentication/dashboard/operational routes need fresh visual review. | Old browser evidence predates current working changes. | **Open:** retain existing SVG path-following bloodstream visual; inspect interaction, keyboard, reduced-motion and all breakpoints with current server. | Current page screenshots and accessibility run are not yet recorded. |

## 4. New donor discovery contract

- `PATCH /api/v1/donors/{id}/location-preference` is owner-only. Grant requires validated coordinates and writes consent + location together. Revoke withdraws active consent and clears all coordinate/freshness fields in the same transaction.
- `GET /api/v1/donors/nearby` requires a valid explicit `X-Organization-Id`, an active/verified organization, `DONOR_DISCOVERY_READ`, blood group, finite origin and radius `0 < r <= 50 km`.
- SQL filters current `LOCATION_DISCOVERY` consent, `AVAILABLE`, 30-day location freshness, a bounding box and the Haversine radius; results are nearest-first and capped at 50. The 51st result signals truncation.
- Results expose opaque ID, blood group, self-reported availability, distance band and location-update time only. The user interface calls them potential matches and explains that donor eligibility, compatibility and clinical screening require authorized verification.
- Search throttle is 20/minute per user in this process only. A production/multi-instance deployment needs a shared gateway limiter. There is no donor outreach workflow, route provider, map tile provider or road-time estimate.

## 5. AOOP evidence

See [`../academic/AOOP_SYLLABUS_IMPLEMENTATION_MATRIX.md`](../academic/AOOP_SYLLABUS_IMPLEMENTATION_MATRIX.md) and [`../academic/LECTURER_DEMO_GUIDE.md`](../academic/LECTURER_DEMO_GUIDE.md). Concrete additions include immutable `GeoPoint`, explicit service contracts, owner-only consent transitions, repository-side specifications in SQL, API authorization checks, audit metadata and a bounded search failure path. Existing reservation idempotency, locking, outbox and lifecycle patterns remain in Java.

## 6. Verification status at this audit snapshot

- **Baseline backend:** full suite passed 119/119 before the new discovery tests.
- **Latest backend attempt:** 125 tests, 1 failure: the new dateline bounding-box assertion exposed the formula defect above. Targeted rerun after the fix passed 9/9; latest PostgreSQL Testcontainers API tests were added after that and have not yet run.
- **Frontend:** 47 tests across 9 files passed. Latest production build passed; bundle report showed the Analytics page is still the largest split chunk at about 491 kB raw / 139 kB gzip (not an accessibility/performance benchmark).
- **Browser/e2e:** existing 18 Playwright executions are historical evidence; no final authenticated route screenshots or latest E2E run are claimed here.
- **Database:** V6 and the native query were applied/tested on the H2 PostgreSQL compatibility mode. V6 also ran under Testcontainers migrations in the prior full run. The query itself still needs a direct PostgreSQL API test run.
- **Security/performance:** no penetration test, load test, Lighthouse report, SLO or external provider test has been executed.
- **Git:** changes remain uncommitted pending final verification; no push or merge occurred.

## 7. Remaining work before sign-off

1. Run the complete backend suite after the corrected bounding-box formula, expanded seed and PostgreSQL API tests; fix any failures.
2. Run frontend typecheck, tests, build and E2E against the backend; recapture correct authenticated screenshots at desktop/tablet/mobile widths.
3. Fix the unbounded donor/audit retrieval and analytics aggregation limitations or document them clearly in the final implementation report.
4. Review login/register, landing journey interaction, all operational pages, accessibility, reduced-motion, browser console and current responsive behaviour.
5. Refresh `TEST_RESULTS.md`, evidence, README and route-level audit; commit only the verified scoped work locally, leaving `LAB-WORK/` untouched.

## 8. Final verification delta (24 November 2026)

The items above describe the audit snapshot before the final verification run.
Since then:

- The full backend suite passed **130/130** (0 failures, errors or skips). This includes the new PostgreSQL 16 donor-search API and isolation checks, V6 migration, and existing reservation/idempotency concurrency tests.
- Frontend unit tests passed **47/47** across 9 files; TypeScript and Vite production build passed (2,280 modules; Analytics chunk 491.05 kB raw / 139.09 kB gzip).
- Playwright passed **18/18** across Chrome and Edge. A failed mobile analytics overflow test identified the demo banner forcing the top bar to 401px at a 390px viewport. The mobile banner now uses a compact visible label with the full warning available to assistive technology; the repeated mobile test passed in both browsers.
- Fifty authenticated route screenshots were captured at desktop/tablet/mobile sizes with the synthetic platform-admin account after the documented bank demo credentials failed against the isolated seed server. The broad screenshot process was interrupted before its JSON summary was written. Do not treat the older identical login screenshots as page evidence or call this a complete DOM/accessibility audit.
- Remaining findings: no production map/routing provider or mediated donor outreach; donor directory retrieval and analytics client-side aggregation remain bounded/limited as described above; this pass did not perform a full UI redesign of every operational page, penetration test, Lighthouse run or formal WCAG audit.
- `git diff --check` passed. Work is still local; no push or merge occurred.
