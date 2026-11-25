# LifeLink Design and Engineering Research — Vascular Intelligence

**Date:** 24 November 2026
**Branch:** `feature/lifelink-bloodstream-experience`
**Current audit HEAD:** `5cf4219` (baseline; see the exact git-state note below)
**Status:** baseline research plus the dated implementation addendum below. The original audit observations are frozen at `5cf4219`; the implementation status is the current local working tree and remains uncommitted until gates pass.

> At baseline the deep-engineering branch tip was 5cf4219, origin/main resolved to the same commit (0 ahead/0 behind), 7 commits since base 59401d4; the pushed abstract commit is included. Subsequent deep-engineering work remains local-only and unpushed unless explicitly stated.

> **Nearby donor discovery is an operational assistance feature. Final donor eligibility, blood compatibility and clinical decisions require authorized clinical verification.**

## 1. Purpose and evidence boundary

This document records the design research behind the current LifeLink interface and the engineering options considered for the next increment. It separates three states that are easy to confuse:

| Label | Meaning |
| :--- | :--- |
| **Baseline verified** | Recorded at audit HEAD `5cf4219` or in the dated baseline evidence; not re-executed in this deep audit. |
| **In progress** | Present as an uncommitted source edit at baseline; no fresh gate result is claimed. |
| **Proposed / absent** | Design recommendation only; no source implementation is claimed. |

"Vascular Intelligence" is the product-design theme for making the donor-to-delivery thread legible: inventory ageing, expiry exposure, request urgency, reservation state and dispatch traceability. It is **operational visibility**, not an AI diagnostic, a compatibility authority, or a clinical decision system. The current SPA already presents API-backed counts, queues, filters and status badges; it does not perform predictive analytics or proximity search.

Sources used for this rationale are the official references supplied by the completed research report and listed in §2. No external service is called by the current application for mapping or geocoding.

## 2. Official source register

| Topic | Official source | What it informs |
| :--- | :--- | :--- |
| Indian blood availability workflow | [e-RaktKosh portal](https://www.eraktkosh.mohfw.gov.in/eraktkoshPortal/), [official stock availability](https://www.eraktkosh.mohfw.gov.in/BLDAHIMS/bloodbank/stockAvailability.cnt), [official FAQ](https://www.eraktkosh.mohfw.gov.in/BLDAHIMS/bloodbank/eraktkoshfaq.cnt) | Availability search is based on group, component and location; the official service exposes a last-updated signal. LifeLink should preserve freshness labels and distinguish a search lead from a confirmed issue. |
| Blood cold chain | [WHO: The Blood Cold Chain](https://iris.who.int/bitstream/handle/10665/330065/WHO-EHT-11.04-eng.pdf?isAllowed=y&sequence=1), [WHO safe transfusion practice](https://cdn.who.int/media/docs/default-source/blood-transfusion-safety/guidelines-and-principles-for-safe-blood-transfudion-practice.pdf) | Temperature-controlled storage and transport are part of blood product handling; any future excursion feature needs a quarantine/investigation workflow and an authorized disposition decision. No real sensor integration exists in the current product. |
| Healthcare product traceability | [HL7 FHIR R5 BiologicallyDerivedProduct](https://hl7.org/fhir/R5/biologicallyderivedproduct.html) | The resource models an individual biologically derived product with identifiers, product status and source-event traceability. Current LifeLink records use related operational concepts but are not FHIR-mapped or FHIR-compliant. |
| Map rendering | [MapLibre GL JS documentation](https://maplibre.org/maplibre-gl-js/docs/), [coordinate and attribution options](https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapOptions/) | MapLibre is a TypeScript/WebGL option; it requires a configured style/tile source, coordinate order is longitude/latitude, and attribution is a provider responsibility. It is not currently installed, so no map is represented as live. |
| Map data usage | [OpenStreetMap tile usage policy](https://operations.osmfoundation.org/policies/tiles/), [Nominatim usage policy](https://operations.osmfoundation.org/policies/nominatim/) | Public OSM endpoints have limits and attribution requirements; interactive address autocomplete is not an acceptable hidden dependency. |
| Motion and accessibility | [Chrome animation guide](https://web.dev/articles/animations-guide), [WCAG 2.2](https://www.w3.org/TR/WCAG22/), [WCAG reduced-motion technique C39](https://www.w3.org/WAI/WCAG22/Techniques/css/C39.html) | Prefer composited transform/opacity, respect reduced motion, and preserve keyboard, focus, contrast and non-motion equivalents. |
| API security | [OWASP API Security Top 10](https://owasp.org/API-Security/), [Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html) | Enforce object and function permissions on the server, minimize sensitive fields and bound search result/resource consumption. |
| Mapping library | [Leaflet](https://leafletjs.com/) | Lightweight raster-map baseline and plugin ecosystem. |
| OSM raster tiles | [OSM Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/) | Attribution, caching, request-rate and bulk-use constraints. |
| Geocoding | [Nominatim Usage Policy](https://operations.osmfoundation.org/policies/nominatim/) | Why interactive address autocomplete is rejected. |
| Database distance | [PostGIS `ST_DWithin`](https://postgis.net/docs/ST_DWithin.html) | Index-assisted geographic radius alternative. |
| Spring transactions | [Spring Framework 6.2 declarative transactions](https://docs.spring.io/spring-framework/reference/6.2/data-access/transaction/declarative/annotations.html) | `@Transactional` boundaries and `REQUIRES_NEW` lifecycle batches. |
| Accessibility | [WCAG 2.2 Quick Reference](https://www.w3.org/WAI/WCAG22/quickref/) | Keyboard, focus, contrast, target size and status-message criteria. |
| Motion | [MDN `prefers-reduced-motion`](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion) | Honouring the user's operating-system motion preference. |
| Scroll effects | [Chrome: scroll-driven animations](https://developer.chrome.com/docs/css-ui/scroll-driven-animations) | Optional progressive enhancement only. |
| Page transitions | [Chrome: View Transitions](https://developer.chrome.com/docs/web-platform/view-transitions) | Optional progressive enhancement only. |
| Application security | [OWASP ASVS](https://owasp.org/ASVS/) | Verification categories for access control, data protection and API behaviour. |
| API security | [OWASP API1: Broken Object Level Authorization](https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/), [API3: Broken Object Property Level Authorization](https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/), [API4: Unrestricted Resource Consumption](https://owasp.org/API-Security/editions/2023/en/0xa4-unrestricted-resource-consumption/), [API6: Unrestricted Access to Sensitive Business Flows](https://owasp.org/API-Security/editions/2023/en/0xa6-unrestricted-access-to-sensitive-business-flows/) | Object scope, field exposure, pagination/rate limits and workflow abuse. |
| Architecture guards | [ArchUnit user guide](https://www.archunit.org/userguide/html/000_Index.html), [Spring Modulith reference](https://docs.spring.io/spring-modulith/reference/) | Recommended future enforcement only; **neither dependency nor suite is implemented**. |

## 3. Product and visual design rationale

### 3.1 Bloodstream identity

The landing page uses a single continuous visual thread — donor, screened, reserved, delivered — with `BloodstreamVisual`, `JourneyVessel` and `bloodstream.css` tokens. The intent is to explain a chain of custody, not to decorate a form. Illustrations are labelled *illustrative*; no real donor story or production statistic is implied.

Design rules adopted:

1. Every number in the workspace comes from an API response; no hardcoded demo statistics.
2. Status and state changes are written in text as well as colour, so meaning survives greyscale printing and colour-vision differences (WCAG 2.2 use of colour).
3. Alerts and advisory scoring are explicitly labelled non-clinical.
4. The donor-to-delivery story is progressive disclosure: public value proposition first, authenticated operational queues second.

### 3.2 Responsive layout

The source uses a fluid app shell, responsive tables/cards and a mobile navigation pattern. The baseline browser audit recorded `documentScrollWidth == innerWidth` for landing (1920/1440/1366/390) and app pages (1440/390), and Analytics chart tables wrapped with `overflow-x: auto`. These are **baseline observations** in [`BASELINE_CURRENT_BROWSER_AUDIT.json`](../evidence/BASELINE_CURRENT_BROWSER_AUDIT.json), not proof of the current in-progress tree. Final QA still needs to repeat them at the planned dev-server port `127.0.0.1:15174`.

Layout choices:

- navigation collapses by breakpoint rather than shrinking text below legible sizes;
- wide tables remain horizontally scrollable inside their own container, never the whole document;
- touch controls keep adequate target spacing (WCAG 2.2 Target Size) while retaining visible focus for keyboard users;
- toasts and freshness indicators use `aria-live` so asynchronous completion is announced without stealing focus.

### 3.3 Accessibility — WCAG 2.2 AA target

The [WCAG 2.2 Quick Reference](https://www.w3.org/WAI/WCAG22/quickref/) is the acceptance checklist. Current design commitments:

| Criterion family | Design response | Verification state |
| :--- | :--- | :--- |
| Keyboard / no keyboard trap | Skip link, focusable controls, mobile menu closes on Escape | Baseline probe recorded; current tree pending final QA |
| Focus visible and focus order | Visible focus styles and DOM order matching visual order | Source design; current tree pending final QA |
| Contrast and non-colour cues | Text labels plus status badges; monochrome-safe meaning | Source design; contrast ratios not measured in this deep audit |
| Target size and reflow | Responsive controls, no page-level horizontal overflow at 390/1440 | Baseline only; current tree pending final QA |
| Status messages / name-role-value | `role="status"`, labels on inputs, `aria-live` freshness text | Source design; automated axe-style report not yet produced |
| Timing / moving content | Reservation countdown is text; motion can be disabled | Baseline reduced-motion probe; current tree pending final QA |

**Evidence gap:** no `ACCESSIBILITY_EVIDENCE.json` has been produced in this deep audit. That report is required before final sign-off; it must contain machine-readable checks (focus order, contrast, labels, target sizes, reduced motion) rather than a narrative assertion.

### 3.4 Motion, reduced motion and progressive enhancement

[MDN's `prefers-reduced-motion` guidance](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion) drives the current rule: animated CSS flow and SMIL `animateMotion` cells are removed when the user requests reduced motion. The baseline probe recorded `animateMotion` count `0` under that preference. Motion is decorative; the journey steps remain readable as static text and illustration.

[Scroll-driven animations](https://developer.chrome.com/docs/css-ui/scroll-driven-animations) and [View Transitions](https://developer.chrome.com/docs/web-platform/view-transitions) were researched as optional enhancements for the landing narrative and route changes. They are **not relied upon** for comprehension or navigation: the baseline DOM exposes the full story and headings without scrolling triggers, and React Router remains the navigation authority. Any future adoption must degrade to a static, fully readable page on browsers without support and must respect the same reduced-motion preference. No View Transition or scroll-timeline implementation is claimed in the audited source.

### 3.5 Performance posture

No bundle-size, Lighthouse, or latency report exists for the current deep-engineering tree. The design direction is:

- route-level `React.lazy`/`Suspense` code splitting in `frontend/src/App.tsx` (implemented at baseline);
- TanStack Query caching with explicit invalidation instead of refetch storms (implemented at baseline);
- pagination and filters pushed to the API for list endpoints where the contract supports them (implemented at baseline);
- map tiles, if ever added, lazy-loaded only on the page that needs them (proposed);
- no third-party analytics, font CDN or tracking pixel in the local stack (source-review observation at baseline).

**Evidence gap:** no `PERFORMANCE_EVIDENCE.json` has been produced in this deep audit. Bundle-size deltas, first-contentful paint, interaction latency and API p95 latency remain unmeasured; they are required before final sign-off.

## 4. Mapping decision: Leaflet 1.9.4 vs MapLibre

| Option | Strengths | Costs / risks | Decision |
| :--- | :--- | :--- | :--- |
| Leaflet 1.9.4 | Small, mature raster-map library; simple markers, circles and tile layers; straightforward keyboard-friendly DOM markers; broad plugin support | Raster tiles only by default; no native vector styling or 3D; attribution must be configured correctly | **Recommended if a map is introduced**, subject to bundle and accessibility checks |
| MapLibre GL | Vector tiles, smooth zoom/styling, 3D and GL effects | Larger JS/WASM payload, tile-source/style hosting obligations, more complex fallback story, GPU dependence | Not selected for this academic local-demo scope |

The decision is conditional: **no map library is currently a dependency of the SPA**, and donor discovery remains a client-side filter over `GET /donors`. Leaflet fits a hypothetical "show the hospital and screened-donor area" view because the required geometry is a point plus a radius, not a tiled vector narrative. If the project later adds vector basemaps, offline tiles or advanced geospatial styling, revisit MapLibre with a documented bundle budget.

Leaflet must not be presented as a source of medical truth: pins would mark operational context only, and any proximity result remains advisory under the safety note at the top of this document.

## 5. OSM tile policy and Nominatim decision

### 5.1 Tiles

The [OSM Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/) applies to public OSM tile servers. A future map must:

- display the required attribution visibly;
- set an identifying `User-Agent`/referrer where the client stack permits;
- avoid bulk downloading, offline bulk caching, or scraping of tiles;
- avoid hammering the tilers with continuous redraw loops or unbounded pan/zoom animation;
- prefer a paid/self-hosted tile provider if usage becomes sustained.

Because this is a local demo, the default path remains **no external tile requests**. A map would be an explicit, documented enhancement, not an implicit page-load cost.

### 5.2 No Nominatim autocomplete

The [Nominatim Usage Policy](https://operations.osmfoundation.org/policies/nominatim/) prohibits heavy, autocomplete-style query streams on the public service and requires identification and attribution. Therefore:

- **No client-side Nominatim address autocomplete is proposed or implemented.**
- Use seeded coordinates for the two demo organizations, a fixed hospital location, or an administrator-entered address that is geocoded rarely and server-side with an appropriate provider.
- Any future geocoder must be self-hosted or contracted with a provider whose terms allow the expected query pattern.

This avoids both a policy violation and a privacy leak: typing a partial address in an autosuggest box would disclose donor/hospital intent to a third party on every keystroke.

## 6. Geospatial search: bbox + Haversine vs PostGIS

Current source fact: donor discovery in the SPA is **client-side filtering over `GET /donors`**; there is no `/donors/near` endpoint, no latitude/longitude columns in the documented donor location model, and no PostGIS extension in Flyway `V1`–`V5`. The current UI must be described as "matching filters", not "nearby" in a geographic sense.

### 6.1 Proposed incremental option — bbox prefilter + Haversine

1. Add optional `latitude`/`longitude` columns to the organization or approved donor-location projection (migration required; not implemented).
2. Apply a cheap SQL bounding box using validated numeric query parameters. This keeps the indexed scan small and bounds result cardinality (OWASP API4: Unrestricted Resource Consumption).
3. Compute the great-circle distance with Haversine in Java for the short candidate list, then sort and page.
4. Return an explicit `distanceMeters` field and never expose exact home addresses to other roles.

Advantages: portable SQL (H2 tests and PostgreSQL runtime), no extension, easy unit tests. Limits: approximate index behaviour, manual math, and no replacement for clinical eligibility.

### 6.2 Proposed scale option — PostGIS `ST_DWithin`

[PostGIS `ST_DWithin`](https://postgis.net/docs/ST_DWithin.html) supports indexed radius predicates on `geography`, with correct metre semantics and a GiST index. It is the better choice when result sets grow, when multiple radius/quality constraints are combined, or when distance is used inside SQL ordering. Cost: a PostgreSQL extension and migration strategy that H2 cannot reproduce, plus a separate test profile. That cost is not justified by the current nine-unit, two-organization demo dataset.

Decision: **bbox + Haversine first if proximity is genuinely required; PostGIS only when measured data volume or query complexity warrants it.** Until then, keep the honest "local filter" label.

## 7. Transaction, audit and privacy choices

Transactions use Spring's declarative model ([Spring 6.2 reference](https://docs.spring.io/spring-framework/reference/6.2/data-access/transaction/declarative/annotations.html)):

- service methods are `@Transactional`; reads use `readOnly = true`;
- inventory and request lifecycle work uses `PESSIMISTIC_WRITE` row locks and deterministic lock order, with `BaseEntity.@Version` as a backstop;
- per-item lifecycle and auth helpers use `REQUIRES_NEW` so one failed row or login attempt does not poison a batch;
- the idempotency claim is written in the caller's transaction, so a business rollback also removes the claim;
- audit `SUCCESS` rows accompany the business mutation; the outbox stores notification intents only.

Privacy and API-security choices follow [OWASP ASVS](https://owasp.org/ASVS/) and the API Top 10 links in §2:

| Risk | Control in the audited design | Residual / proposed |
| :--- | :--- | :--- |
| API1 broken object-level authorization | `X-Organization-Id` validated by `TenantAccessService`; service-level ownership checks; own-queue STOMP subscription | Re-test current tree; no automated browser-level IDOR sweep in this deep audit |
| API3 broken property-level authorization | DTO `View` projections instead of serializing entities | No formal field-level policy DSL; continue explicit DTO review |
| API4 unrestricted resource consumption | Pagination, key length cap, login rate limit, bounded outbox attempts | Rate limit is in-memory/single-node; production needs a shared store |
| API6 sensitive business flows | State machines, idempotency, role-gated transitions, non-clinical advisory wording | Workflow-abuse testing and clinical governance remain external prerequisites |
| Donor PII on a map | No map implemented; proposed feature would expose coarse, role-gated aggregates only | Define retention, consent and minimum-radius policy before implementation |

## 8. Decision table

| # | Decision | Selected | Rejected alternative | Reason | Status |
| :-- | :--- | :--- | :--- | :--- | :--- |
| 1 | UI framework | Preserve React/TypeScript SPA | Vaadin / Java-only rewrite | Approved user decision; Java remains the AOOP language | Baseline verified |
| 2 | Map library | Leaflet 1.9.4 *if* a map is added | MapLibre GL | Simpler point+radius use case, smaller operational surface | Proposed; no map implemented |
| 3 | Basemap | No external tiles now; policy-compliant tiles only if added | Default high-volume OSM tile use | Tile policy and local-demo cost | Proposed |
| 4 | Address entry | Seeded/entered coordinates, rare server-side geocoding | Nominatim autocomplete | Nominatim policy and keystroke privacy | Proposed; autocomplete absent |
| 5 | Radius search | bbox + Haversine first | PostGIS `ST_DWithin` now | Portable tests, no extension for demo data | Proposed; no geo endpoint exists |
| 6 | Accessibility | WCAG 2.2 AA target with static fallback | Motion-dependent storytelling | Inclusive, testable baseline | Baseline design; evidence pending |
| 7 | Motion | Respect `prefers-reduced-motion`; no essential animation | Scroll-driven / View Transition dependencies | Progressive enhancement only | Baseline verified for SMIL; current tree pending |
| 8 | Concurrency | Row locks + version + DB constraints | Distributed lock / application-only checks | One database, deterministic correctness | Baseline verified |
| 9 | Idempotency | Persisted `(scope, "key")` with request hash | In-memory key map | Survives process restart and serializes concurrent replay | Baseline verified |
| 10 | Notifications | Transactional outbox + REST-authoritative inbox | Generic domain-event bus | Atomic intent, narrow scope, no broker dependency | Baseline verified |
| 11 | Architecture guards | Module boundaries by package and review | ArchUnit / Spring Modulith now | No dependency added; recommended as next step | Absent (recommended only) |
| 12 | Clinical interpretation | Human verification | Algorithmic eligibility decision | Safety and governance | Design constraint |

## 9. Route-by-route design audit summary (D01–D12, S01–S04)

The IDs are carried forward from the completed frontend audit. The observations below use only the dated baseline browser JSON and read-only source inspection; **no new browser session was run for this documentation task**. "In progress" means an uncommitted edit existed at baseline.

| ID | Route / surface | Baseline observation | Status | Remediation / verification |
| :--- | :--- | :--- | :--- | :--- |
| D01 | `/` landing | 4 viewport captures, no overflow; one historical 404 with URL not captured | Baseline verified; current pending final QA | Re-open `127.0.0.1:15174/`, capture console/network, identify the missing resource if it recurs |
| D02 | `/app/dashboard` | Heading rendered as "Good to see you, Blood"; camelCase API labels not humanized | **In progress** | `DashboardPage.tsx` now uses full name/email fallback; `utils.ts` splits camelCase; `utils.test.ts` added. Re-run typecheck/unit tests and re-capture heading |
| D03 | `/app/inventory` | No page-level overflow at 1440/390; 9 units in view | Baseline verified; current pending final QA | Confirm wide table wrapper and release/expire actions after in-progress edits |
| D04 | `/app/donors` | Explicit "Filtered locally / Matching filters" copy from `GET /donors` | Baseline verified | Keep honest non-geo wording; do not label as "nearby" until a geo contract exists |
| D05 | `/app/donations` | API-backed counts and approval/screening actions visible | Baseline verified; current pending final QA | Re-check empty/error states and role gating in final QA |
| D06 | `/app/requests` | Zero requests in the baseline capture; urgent-request path not exercised | Pending final QA | Run the urgent-request demo scenario in the lecturer guide and verify `PENDING_VERIFICATION` |
| D07 | `/app/allocations` | "Non-clinical decision support" warning present; advisory candidates only | Baseline verified | Preserve advisory copy and rejection reasons; verify no state change from suggestions |
| D08 | `/app/reservations` | Zero active holds in baseline; TTL countdown UI present | Pending final QA | Verify reservation creation, `ACTIVE → CONFIRMED`, and expiry release |
| D09 | `/app/dispatch` | Zero in-progress dispatches in baseline | Pending final QA | Verify supplying-bank-only creation, depart/incident/deliver lifecycle |
| D10 | `/app/notifications` | "Live updates off" in baseline; REST inbox authoritative; historical STOMP capture exists | Baseline verified; current pending final QA | Re-capture authenticated CONNECT/SUBSCRIBE and REST poll fallback |
| D11 | `/app/audit` | Mobile `/api/v1/audit-logs` 500 traced to a stale deployed backend image, not current source | Historical only | Re-probe against `127.0.0.1:18080`; do not treat the old 500 as a current defect |
| D12 | `/app/analytics` | No overflow at 1440/390; four chart tables use `overflow-x: auto` | Baseline verified; current pending final QA | Re-measure after current edits; verify scope switch cache invalidation |
| S01 | `/login`, `/register`, protected redirect | Deep-link to admin/profile landed on sign-in with the seeded-account hint | Baseline verified | Confirm post-login return to the requested route in final QA |
| S02 | App shell / mobile navigation | Skip link present; Escape closes mobile menu; no page-level overflow | Baseline verified; current pending final QA | Repeat keyboard walkthrough and 390px measurement |
| S03 | Loading / empty / error states | Skeletons, empty states and error panels present in source; dashboard shows partial-data state | Source verified; current pending final QA | Capture forced-error and empty states in final QA |
| S04 | Unknown route / 404 handling | `NotFoundPage` is wired for public and app wildcards; one historical landing 404 URL was not captured | Source verified; historical anomaly open | Reproduce with network logging before closing |

## 10. Defect register

| ID | Severity | Evidence | Fix / disposition | Verification |
| :--- | :--- | :--- | :--- | :--- |
| D02-a | Medium | Baseline heading "Good to see you, Blood" | Use full name, then email local-part, then "there" | **In progress**, local edit only; unit test added but not re-run here |
| D02-b | Low | Baseline camelCase metric labels such as `expiringWithin7Days` | Split camelCase before title-casing in `humanize` | **In progress**, local edit only; `utils.test.ts` added but not re-run here |
| D01-a | Low | Historical landing 404; URL not captured | Re-probe with URL/network capture before classifying | **Pending final QA after implementation** |
| D11-a | Medium | Historical mobile audit-logs 500 | Traced to stale deployed backend image; re-probe current backend | Historical defect, source not implicated; **pending final QA** |
| GEO-01 | Medium | Donor discovery described as local filtering; no geo API or coordinates | Keep honest labels; only add bbox+Haversine with explicit contract | **Absent by design**; proposal only |
| A11Y-01 | High if unresolved | No accessibility evidence report for this deep audit | Produce `ACCESSIBILITY_EVIDENCE.json` | **Required before sign-off**; not fabricated |
| PERF-01 | High if unresolved | No bundle/latency report for this deep audit | Produce `PERFORMANCE_EVIDENCE.json` | **Required before sign-off**; not fabricated |
| ARCH-01 | Low | Flat package modularity is convention, not enforced | Recommended: ArchUnit or Spring Modulith guardrails | **Absent; recommendation only** |

## 11. Consequence for final sign-off

The design direction is coherent and the baseline gates are recorded, but this document does **not** close the current deep audit. The in-progress frontend edits, new accessibility/performance reports, route re-probes and data-scenario walkthroughs must be verified first. See [`LIFELINK_FINAL_ENGINEERING_AUDIT.md`](LIFELINK_FINAL_ENGINEERING_AUDIT.md) for the living checklist and [`../quality/TEST_RESULTS.md`](../quality/TEST_RESULTS.md) for the dated baseline commands.

## 12. Implementation decisions and evidence (working tree update)

The following decisions apply to the current local implementation. They supersede the baseline-only recommendation where explicitly stated; the original baseline remains useful historical evidence.

| Problem and evidence | Source | Existing implementation at baseline | Proposed/current solution | Alternatives and trade-offs | Security implications | Verification required |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Blood availability depends on component, location and freshness; e-RaktKosh exposes blood-group/component/location search and last-updated information. | [e-RaktKosh portal](https://www.eraktkosh.mohfw.gov.in/eraktkoshPortal/), [official stock availability](https://www.eraktkosh.mohfw.gov.in/BLDAHIMS/bloodbank/stockAvailability.cnt) | LifeLink had donor city/state and inventory status but no coordinate search. | Add explicit donor location opt-in, freshness timestamp, radius search, result explanation and demo marker. This is an operational lead, not a reservation or clinical decision. | No PostGIS dependency for the current small demonstration; database-side bounding box + Haversine avoids loading all donors in Java. PostGIS remains the scale option. | Test fresh/consenting/available filtering, radius boundary, invalid coordinates, query bounds and PostgreSQL execution. |
| Donor home coordinates are sensitive and public geocoding has strict policy limits. | [Nominatim usage policy](https://operations.osmfoundation.org/policies/nominatim/), [OWASP API Security](https://owasp.org/API-Security/) | No location consent or API existed. | `LOCATION_DISCOVERY` is donor-owned; withdrawal clears coordinates. Search checks consent in the same SQL query, uses explicit organization scope, audits a coarse origin cell and returns no donor coordinates or contacts. | A donor marker map was rejected: coarse grid points still reveal residential areas, while omitting coordinates means a list/radius view is the honest presentation. | Search is capped at 50 and currently throttled to 20 requests/minute per process. A multi-instance gateway limiter remains a deployment requirement. | Authorization, consent withdrawal, tenant isolation, H2/PostgreSQL query behaviour and log/DTO inspection. |
| Public map tiles and geocoding cannot be assumed free or production-grade. | [MapLibre GL JS](https://maplibre.org/maplibre-gl-js/docs/), [OSM tile policy](https://operations.osmfoundation.org/policies/tiles/), [Nominatim policy](https://operations.osmfoundation.org/policies/nominatim/) | No map provider was installed. | No external map or geocoder is required for the list search. The origin may be entered manually or supplied by browser location only after an explicit user action. | MapLibre is technically suitable but still needs a configured style/tile provider and attribution; installing it now adds weight and an unverified external dependency. | Browser location is not stored in browser storage; the API receives only the requested origin. Donor origin is never transmitted to a third party. | Test permission denial, manual origin, reduced motion and no unexpected network requests. |
| Blood units need product identifiers and source-event traceability. | [HL7 FHIR R5 BiologicallyDerivedProduct](https://hl7.org/fhir/R5/biologicallyderivedproduct.html) | Existing LifeLink units relate to product and lifecycle concepts, but no interoperability mapping exists. | Keep internal Java domain model and make no FHIR claim. An adapter requires a tested mapping and version decision before implementation. | Mapping now would create superficial interoperability and a larger unsupported contract. | No external patient/product data is transferred. | Only create an adapter after mapping and conformance tests are specified. |
| Synthetic data makes UI workflows demonstrable but can be mistaken for real supply. | Local seed configuration and existing seed records; source-backed behavior in `DevelopmentDataSeeder` | Seed data was limited to one donor, nine units and one request. | Expand to synthetic donor discovery candidates and expose the backend seed-mode flag so the authenticated shell shows `DEMO DATA — NOT LIVE BLOOD AVAILABILITY`. | Deterministic local fixtures improve repeatability; production-shaped PostgreSQL remains seed-off by default. | Fake `.local` accounts and demo coordinates only; seed flag must remain false in production. | Re-run migration/seeding from a fresh test database and confirm the banner reflects runtime configuration. |

### Current implementation state

- `GeoPoint`, V6 donor/organization coordinate columns, owner-only location consent, repository-side nearby search, discovery permission, audit metadata, bounded result DTO, UI search form and runtime demo-data banner are present in the working tree.
- Unit and H2 repository tests were executed in the latest run; one `GeoPoint` test exposed an incorrect longitude bounding-box formula, which has been fixed. The final full suite must be rerun after the fix and latest seed/API edits.
- No MapLibre provider, road-routing provider, Nominatim integration, donor contact mediation, FHIR adapter, cold-chain telemetry or production deployment is present.
