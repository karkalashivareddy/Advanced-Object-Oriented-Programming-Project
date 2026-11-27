# LifeLink Product and Engineering Research — THE LIFELINK

**Date:** 27 November 2026  
**Branch:** `feature/lifelink-bloodstream-experience`  
**Working-tree HEAD:** `566e14071675716c9b507e8df37751a92fd139cf`  
**Status:** current research and decision record for the uncommitted cinematic redesign increment. Earlier dated research remains in [`LIFELINK_DESIGN_AND_ENGINEERING_RESEARCH.md`](LIFELINK_DESIGN_AND_ENGINEERING_RESEARCH.md).

> **Nearby donor discovery is an operational assistance feature. Final donor eligibility, blood compatibility and clinical decisions require authorized clinical verification.**

> **Red blood cell compatibility. Plasma and platelet compatibility follow different rules (e.g., AB plasma is the universal plasma donor type), and final matching always requires crossmatching by clinical staff.**

## 1. Purpose and evidence boundary

This document connects product research, official standards, and the engineering choices actually present in the current tree. It is not a clinical validation report, a FHIR conformance statement, a Lighthouse result, or a production-readiness certificate.

Evidence was gathered from:

- direct inspection of Java, React, TypeScript, SQL, CSS, tests, and configuration in this repository;
- executed gates recorded in [`../quality/TEST_RESULTS.md`](../quality/TEST_RESULTS.md) and [`../evidence/PLAYWRIGHT_RESULTS.json`](../evidence/PLAYWRIGHT_RESULTS.json);
- direct retrieval of official MoHFW/e-RaktKosh, C-DAC, WHO, PostGIS, OpenStreetMap, Nominatim, W3C WCAG 2.2, OWASP, Spring Modulith, and HL7 FHIR pages.

Where an official source does not support a claim, the claim is explicitly withheld. The e-RaktKosh portal's content-hashed JavaScript bundle was inspected for descriptive text and contacts, but the stable portal URL is cited instead of the hash-dependent asset path.

## 2. Product research: the network, not a spreadsheet

### 2.1 Public-sector reference points

The official MoHFW e-RaktKosh portal describes e-Raktkosh as a **“Centralized Blood Center Management System”**. Its own site content describes national rollout, modular/configurable rule-based architecture, and compliance concerns under the Drug & Cosmetic Act and National Blood Policy. The same official bundle publishes an `eraktkosh@cdac.in` contact, a C-DAC/Noida contact, a C-DAC logo link, and an Android application identifier under `in.cdac.mhealth.m_raktkosh`. C-DAC's official site confirms the organisation and a health-informatics portfolio. This supports C-DAC involvement/contact; it does **not** prove sole ownership or development, and this document does not make that claim.

WHO's blood safety and availability fact sheet recommends nationally coordinated collection, testing, processing, storage and distribution; national policy and legislation; voluntary unpaid donation; mandatory screening for HIV, hepatitis B, hepatitis C and syphilis; quality systems; rational clinical use; and haemovigilance. LifeLink therefore models a **coordination network** with controlled workflow states, not a replacement for clinical testing, eligibility decisions, or national policy.

### 2.2 Product decision

LifeLink is presented as **“THE LIFELINK — VASCULAR INTELLIGENCE”**: one continuous chain from donor to delivery. The public story uses six stages — Donate, Screen, Store, Request, Reserve, Deliver — and clearly labels its vessel artwork as illustrative, not live supply data. The authenticated application remains a high-density operational workspace; the cinematic treatment is concentrated on public and entry experiences, with global tokens carrying the identity into the app shell.

This avoids two failure modes:

1. inventing fake live metrics or donor records on the marketing page;
2. turning a clinical coordination tool into a decorative product with no real API backing.

Every operational figure in the SPA comes from the backend `REST /api/v1` contract. If data is unavailable, the UI shows an honest empty, unavailable, or demo-labelled state.

## 3. Geospatial engineering research

### 3.1 Implemented approach

The current implementation uses:

- an immutable, validated `GeoPoint` value type with latitude/longitude bounds, Haversine distance, and conservative bounding-box behaviour;
- Flyway `V6` additive donor/organization coordinate columns, freshness fields, bounds constraints, and indexes;
- owner-controlled `LOCATION_DISCOVERY` consent; granting writes validated coordinates, revocation clears coordinates and freshness in one transaction;
- `GET /api/v1/donors/nearby` with selected-organization permission checks, consent/availability/freshness predicates, a SQL bounding-box prefilter, exact distance filtering, nearest-first ordering, and a 50-result cap;
- coarse `0.02°` grid cells and distance bands in the client so exact coordinates never appear in responses or UI;
- a 30-day location freshness window and a process-local 20 requests/minute guard.

The exact clinical note above is attached to the discovery experience, and the exact RBC note is attached to the compatibility atlas. Neither note is hidden behind a tooltip.

### 3.2 Why not PostGIS, map tiles, or public geocoding in this phase

Official PostGIS documentation states that `ST_DWithin` includes a bounding-box comparison that can use indexes; geometry distance is in SRID units, while geography distance is in metres on a spheroid/sphere. Those are credible future options for a PostgreSQL-only deployment with a verified geodetic model. The present tree deliberately uses portable SQL plus Java validation because the demo must also run on H2 compatibility mode and be explainable without an extension dependency. This is a scope decision, not a rejection of PostGIS.

OpenStreetMap data is ODbL-licensed and requires visible attribution; derivative data carries share-alike obligations. Nominatim's official manual defines forward geocoding as name/address-to-location search and reverse geocoding as an approximate nearest-object address lookup. Adding map tiles or autocomplete would introduce licensing, attribution, availability, and privacy considerations that are not warranted while no map service is configured. The UI therefore does not fabricate markers, road distance, travel time, or exact addresses.

### 3.3 Privacy boundary

Nearby discovery is assistance, not outreach. Responses omit donor names, contact details, and exact coordinates. The backend remains authoritative: the React page cannot grant consent, bypass organization scope, or widen the radius cap. The client-side compatibility atlas is educational visualisation only; allocation and compatibility decisions stay in Java services.

## 4. Visual and interaction research

### 4.1 Identity system

The redesign uses:

- **THE LIFELINE**, one continuous crimson SVG path reused across hero, section flow, app status line, loading/progress, and dividers;
- a dark cinematic public surface and a bright, calm, high-density authenticated surface;
- crimson `#C8102E`, blood `#8B0018`, emergency `#F04452`, success `#16A36A`, ink `#10070C`/`#180D13`, paper `#FAF8F9`, and muted rose-tinted neutrals;
- self-hosted `@fontsource-variable/fraunces` for display serif and `@fontsource-variable/inter` for the variable sans, with a system tabular stack for numeric data;
- a layered CSS architecture: `@layer tokens, base, components, layout, pages, utilities;`;
- CSS/SVG/rAF motion only. The allowed `motion` package was not installed, and no Tailwind, shadcn, Three.js/R3F, GSAP, or Google Fonts CDN was introduced.

### 4.2 Accessibility standard and measurement

W3C WCAG 2.2 supports the following cited requirements:

- **1.4.3 Contrast (Minimum), AA:** 4.5:1 for normal text, 3:1 for large text.
- **1.4.11 Non-text Contrast, AA:** 3:1 for meaningful UI boundaries and graphical objects.
- **2.1.1 Keyboard, A:** functionality must be keyboard-operable.
- **2.4.7 Focus Visible, AA:** a visible keyboard focus mode must exist.
- **2.4.11 Focus Not Obscured (Minimum), AA:** a focused component must not be entirely hidden.

`prefers-reduced-motion` handling is included as an extra robustness measure. In WCAG 2.2, **2.3.3 Animation from Interactions is AAA**, while **2.2.2 Pause, Stop, Hide is A**; reduced motion is therefore not described here as an AA requirement.

Measured browser evidence includes:

- skip-link and keyboard operation checks;
- keyboard-operable journey stages and compatibility atlas;
- forced-colors visibility of the primary call to action;
- zero `animateMotion` elements and `animation-name: none` for the decorative flow under reduced motion;
- no horizontal overflow at 360, 390, 768, 1024, 1280, 1440, and 1536 px;
- axe-core WCAG A/AA scans with zero violations on landing, login, and registration pages in both Chrome and Edge.

This is measured support for those routes and rules, not a claim of full WCAG 2.2 conformance across every authenticated screen or a substitute for screen-reader testing.

## 5. Security and authorization research

OWASP Top 10:2025 A01 (Broken Access Control) and A07 (Authentication Failures), together with the current OWASP Authentication, Session Management, and Authorization cheat sheets, support the following design priorities: least privilege, deny by default, permission validation on every request, non-guessable identifiers, protection of static resources, safe failure, audit logging, strong password handling, secure token/session handling, renewal after privilege change, throttling, and non-revealing errors. The deprecated OWASP Access Control Cheat Sheet is not used as current guidance.

Implemented controls include BCrypt hashing, JWT access tokens with issuer/audience/`jti`, persistent `token_version`, rotating hashed refresh tokens with replay detection, server-side permission and role checks, validated organization scope, Bean Validation, central typed error mapping, login rate limiting, STOMP CONNECT authentication with own-queue restrictions, and rejection of client `SEND` frames. UI permission checks only hide controls; Java remains authoritative.

Residuals are recorded in [`../quality/KNOWN_LIMITATIONS.md`](../quality/KNOWN_LIMITATIONS.md): no MFA or breach-password screening, process-local logout revocation and rate limits, no production TLS/secrets management, no penetration or load test, and no cluster-wide deployment proof.

## 6. Architecture research

### 6.1 Modular monolith and Spring Modulith

Official Spring Modulith documentation defines an application module through a provided API, internal implementation, and required interfaces, and `ApplicationModules.verify()` checks cycles and access through API packages. This project preserves a **package-structured modular monolith** with controllers, services, domain entities, repositories, DTOs, and security/configuration separated by business package. It does **not** install Spring Modulith or run `ApplicationModules.verify()`, and it does not claim formal module-boundary enforcement.

### 6.2 FHIR boundary

HL7 FHIR R4 and R5 resource lists do not contain a core `BloodService` resource. `Observation` and `BiologicallyDerivedProduct` are potentially relevant generic resources; the latter covers blood products but is Trial Use in R5. A FHIR `CapabilityStatement` documents version-specific behaviours and supported profiles. LifeLink has no tested FHIR mapping, no profile, and no CapabilityStatement, so **no FHIR compliance claim is made**. Similar concepts and DTO names are not conformance evidence.

## 7. Official source index

| Topic | Source | Official URL | What it supports |
| --- | --- | --- | --- |
| National blood-portal context | MoHFW e-RaktKosh portal | https://eraktkosh.mohfw.gov.in/eraktkoshPortal/ | “Centralized Blood Center Management System”; official portal identity. |
| C-DAC involvement | Official portal content/bundle and C-DAC site | https://eraktkosh.mohfw.gov.in/eraktkoshPortal/ ; https://www.cdac.in/ ; https://www.cdac.in/index.aspx?id=tap&tapcat=Health_Informatics | Contact and health-informatics evidence; not sole ownership. |
| Blood safety | WHO fact sheet | https://www.who.int/news-room/fact-sheets/detail/blood-safety-and-availability | Coordination, testing, quality systems, voluntary unpaid donation, rational use, haemovigilance. |
| Proximity SQL | PostGIS `ST_DWithin` | https://postgis.net/docs/ST_DWithin.html | Index-friendly bounding-box prefilter; geometry units vs geography metres. |
| Distance model | PostGIS `ST_Distance` / DB management | https://postgis.net/docs/ST_Distance.html ; https://postgis.net/docs/using_postgis_dbmanagement.html | Cartesian projected units vs geodesic metres; SRID matters. |
| Map data licence | OpenStreetMap copyright | https://www.openstreetmap.org/copyright | ODbL, attribution, share-alike obligations. |
| Geocoding terms | Nominatim manual | https://nominatim.org/release-docs/latest/ ; https://nominatim.org/release-docs/latest/api/Search/ ; https://nominatim.org/release-docs/latest/api/Reverse/ | Forward/reverse geocoding definitions and approximation caveat. |
| Contrast | W3C WCAG 2.2 SC 1.4.3 / 1.4.11 | https://www.w3.org/TR/WCAG22/#contrast-minimum ; https://www.w3.org/TR/WCAG22/#non-text-contrast | AA contrast thresholds. |
| Keyboard/focus | W3C WCAG 2.2 SC 2.1.1 / 2.4.7 / 2.4.11 | https://www.w3.org/TR/WCAG22/#keyboard ; https://www.w3.org/TR/WCAG22/#focus-visible ; https://www.w3.org/TR/WCAG22/#focus-not-obscured-minimum | Keyboard operation and visible, unobscured focus. |
| Motion | W3C WCAG 2.2 SC 2.2.2 / 2.3.3 | https://www.w3.org/TR/WCAG22/#pause-stop-hide ; https://www.w3.org/TR/WCAG22/#animation-from-interactions | Pause/Stop/Hide is A; animation-from-interactions is AAA. |
| Access control/auth | OWASP Top 10:2025 | https://owasp.org/Top10/2025/A01_2025-Broken_Access_Control/ ; https://owasp.org/Top10/2025/A07_2025-Authentication_Failures/ | Broken access control and authentication failure categories. |
| Secure design guidance | OWASP cheat sheets | https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html ; https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html ; https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html | Current implementation guidance; the separate Access Control Cheat Sheet is marked deprecated. |
| Modular architecture | Spring Modulith reference | https://docs.spring.io/spring-modulith/reference/ ; https://docs.spring.io/spring-modulith/reference/fundamentals.html ; https://docs.spring.io/spring-modulith/reference/verification.html | Module API/internal/required interfaces and `verify()` semantics; not installed here. |
| Interoperability | HL7 FHIR resource list and CapabilityStatement | https://hl7.org/fhir/resourcelist.html ; https://hl7.org/fhir/R4/resourcelist.html ; https://hl7.org/fhir/observation.html ; https://hl7.org/fhir/biologicallyderivedproduct.html ; https://hl7.org/fhir/capabilitystatement.html | No core `BloodService`; generic resources and formal conformance mechanism. |

## 8. Decisions retained and options rejected

| Decision | Rationale | Rejected alternative and reason |
| --- | --- | --- |
| Java-owned domain and authorization | AOOP evidence, transactional integrity, server-authoritative security | Duplicate critical rules in React; rejected. |
| Portable bbox + Haversine in Java/SQL | Explainable, H2-compatible, privacy-limited demo | PostGIS now; deferred until a PostgreSQL-only deployment and geodetic model are verified. |
| Distance bands and coarse cells | Avoids exposing exact coordinates | Exact donor coordinates or road time; rejected as unsafe or unimplemented. |
| Self-hosted variable fonts | Deterministic offline-capable design, no third-party CDN | Google Fonts CDN; disallowed and privacy-relevant. |
| CSS/SVG/rAF motion | Small, auditable, reduced-motion friendly | GSAP/Three.js/R3F; disallowed and unnecessary. |
| Package-structured modular monolith | Preserves the existing Java architecture | Adding Spring Modulith dependency solely for a label; rejected for this increment. |
| Honest illustrative story | No fabricated live metrics or donor data | Invented statistics/testimonials; rejected. |

## 9. Current verification anchor

The redesign increment currently records: TypeScript typecheck passed; **54 Vitest tests in 11 files** passed; Vite production build passed with **2,297 modules transformed**; `npm audit --audit-level=high` found **0 vulnerabilities**; full Playwright suite passed **46 executions (23 specs × Chrome and Edge)** against a local seeded H2 backend with health `UP`; axe A/AA scans found zero violations on the three public pages in both browsers. Backend and final diff results are reported in [`TEST_RESULTS.md`](../quality/TEST_RESULTS.md) rather than duplicated here.

No result in this document should be read as clinical validation, production deployment, formal WCAG certification, Lighthouse scoring, FHIR conformance, or load/penetration-test evidence.
