# Current-State Engineering and Design Audit — LifeLink

**Date:** 24 November 2026
**Branch:** `feature/lifelink-bloodstream-experience`
**Base HEAD:** `59401d45e511183ede59e7d55073f07e2cf5eacd`
**Audit scope:** `project/` plus the root `README.md`; `LAB-WORK/` preserved and untouched
**Git state after commit:** local commits on this branch; **nothing was pushed or merged**

> This is the authoritative current-state record. Earlier review files under
> [`./`](./) and the baseline audit in [`../audit/INITIAL_REPOSITORY_AUDIT.md`](../audit/INITIAL_REPOSITORY_AUDIT.md)
> are historical records. They describe earlier branches, commits, test counts,
> and decisions, and are not rewritten here.

## 1. Purpose and method

This audit reconciles the actual working tree with the project documentation,
the corrected academic abstract, and the approved architecture. Findings are
based on:

- direct source inspection of Java controllers, services, entities, DTOs,
  migrations, configuration, and tests;
- direct inspection of the React/TypeScript client, package declarations,
  browser scripts, and computed DOM evidence;
- executed backend, frontend, browser, and live-stack gates recorded in
  [`../quality/TEST_RESULTS.md`](../quality/TEST_RESULTS.md);
- `git status`, `git branch --show-current`, and `git rev-parse HEAD`;
- read-only independent audits of documentation drift, authoritative source
  facts, and abstract document tooling.

No claim below is inferred from an older README or historical review alone.
Command output is reported only where an execution or durable probe exists.

## 2. Original condition and historical context

The repository began as a documentation-only academic workspace on `main` at
HEAD `5d52463`: a stale course-planning README and three lab PDFs under
`LAB-WORK/`, with no application source, build descriptor, tests, SQL, or
configuration. That baseline is faithfully preserved in
[`../audit/INITIAL_REPOSITORY_AUDIT.md`](../audit/INITIAL_REPOSITORY_AUDIT.md).

A later Phase 2 implementation branch,
`feature/lifelink-enterprise-platform` with baseline HEAD `195e88a`, produced
the Spring Boot + React system and its first verification record. Those records
are dated history. The present work continues from
`59401d45e511183ede59e7d55073f07e2cf5eacd` on
`feature/lifelink-bloodstream-experience`, fixes residual correctness and
security defects, redesigns the public landing experience, and corrects the
documentation to match the shipped architecture.

## 3. Architecture decision and inaccurate documentation

The approved architecture is deliberately preserved:

- **Java 21 / Spring Boot 3.5.16** is the primary implementation language and
  owns domain rules, validation, authentication, authorization, persistence,
  transactions, controllers/services, and dashboard aggregation.
- **React 19 / TypeScript 5.9 / Vite 7** is the separately built web
  interface. It presents forms, tables, charts, responsive navigation, loading
  and error states, keyboard behaviour, and reduced-motion handling.
- **PostgreSQL 16** is the demo/local database, accessed only by the backend;
  Flyway migrations `V1`–`V5` manage the schema. H2 and Testcontainers are
  test-only databases.
- **REST `/api/v1`** is the client/server contract. Authenticated SockJS/STOMP
  over `/ws` invalidates notification caches; the REST inbox remains the
  authoritative notification path.

The user decision was **Preserve React, document deviation**. No migration to
Vaadin, JavaFX, Swing, or another UI framework was performed. The application
is not Java-only, and no C/C++ or Python application module exists.

Earlier documentation and the original abstract contained these material
inaccuracies:

| Area | Inaccurate or stale claim | Corrected current statement |
| --- | --- | --- |
| Root README | “Project Title: To Be Finalized”; stack and testing framework pending | The README now identifies LifeLink, the Java/React/PostgreSQL stack, real commands, and measured results |
| Original abstract | SPA “shares one PostgreSQL database” | The SPA calls the backend over REST/STOMP; only the Spring Boot service owns the database |
| Original abstract | Linux/Ubuntu as the implementation platform, “file-backed persistence” | The development host is Windows; Linux containers are packaging. Persistence is PostgreSQL |
| Original abstract | Generic transactional outbox | `outbox_events` stores notification intents only; audit events are append-only in practice |
| Original abstract | 93 backend / 33 frontend / six E2E passes | Current verified gates: 119 backend / 39 frontend / 18 E2E |
| Historical docs | SPA has no live STOMP client | The SPA mounts `useRealtimeNotifications`, opens SockJS through `/ws`, authenticates CONNECT, and subscribes to `/user/queue/notifications` |
| `SYSTEM_ARCHITECTURE.md` | `audit_logs` table and standalone-only STOMP | Table is `audit_events`; browser STOMP is now implemented and evidenced |
| `DOMAIN_MODEL.md` | `activeReservationId` shown as part of the inventory DTO | It is an entity/repository field that enforces one active reservation; it is not exposed in `InventoryDtos.View` |
| `API_CONTRACTS.md` | Missing reservation/dispatch detail endpoints and stale STOMP paragraph | Source inspection confirms `GET /reservations/{id}` and `GET /dispatches/{id}`; browser STOMP is documented separately |
| Dispatch docs | Incident transition implied to prevent final delivery | `INCIDENT` records a recoverable in-transit problem; `Dispatch.deliver()` explicitly permits recovery delivery from `INCIDENT`, while other non-transit states are rejected |
| AOOP mapping | Old class counts, test counts, and no-browser-STOMP claim | Mapping now cites only classes that exist, the current 119/39/18 evidence, and the authenticated browser STOMP bridge |

Administrative fields that cannot be established from the repository—section,
team number, complete student roster, course code, term, faculty name—are
preserved from the submitted form and explicitly flagged for human
confirmation. They are not silently invented or changed.

## 4. Corrected abstract

The original editable source and original verification PDF remain preserved:

- `project/docs/abstract/Project Abstract Submission Form.docx`
- `project/docs/abstract/Project Abstract Submission Form - verification.pdf`

The corrected, maintainable deliverables are:

- `project/docs/abstract/LifeLink_Project_Abstract.docx` — editable source
- `project/docs/abstract/LifeLink_Project_Abstract.pdf` — validated PDF edited from the supplied verification PDF

The corrected abstract keeps the original 9-section black-and-white submission
form layout, including its fonts, tables, line art, and page geometry. Only
content and line alignment were changed: the course title typo, outdated
Linux-hosting claims, stale test counts, and instructional prompt text were
corrected or removed, while accurate Java/React/TypeScript/PostgreSQL technology
and real AOOP examples were retained. The PDF was validated as 4 pages with a
187-word abstract, monochrome text spans, original drawing counts, no
replacement/null characters, no instructional prompts, and accurate current
stack/test phrases. Evidence is in
[`../evidence/ABSTRACT_PDF_VALIDATION.json`](../evidence/ABSTRACT_PDF_VALIDATION.json)
and [`../quality/TEST_RESULTS.md`](../quality/TEST_RESULTS.md). The Word COM
export attempt hung and was terminated, so PyMuPDF edited the supplied form PDF;
it is not a byte-for-byte Word export. Manual visual inspection and human
confirmation of administrative fields remain outstanding.

## 5. Website and visual redesign

The public landing page was transformed from the prior generic shell into an
illustrative donor-to-delivery story with trust, FAQ, and call-to-action
sections. It uses a bloodstream visual system built from design tokens,
`BloodstreamVisual`, `JourneyVessel`, and `bloodstream.css`.

Accessibility and responsive behaviour were measured rather than assumed:

- skip link and keyboard navigation are present;
- mobile menu closes on Escape;
- `prefers-reduced-motion` removes CSS flow animation and SMIL `animateMotion`
  elements (count `0`);
- desktop and mobile landing pages report `documentScrollWidth` equal to the
  viewport (`1440` and `390`), so no horizontal overflow was observed;
- Analytics desktop and mobile pages also report no horizontal overflow and
  wrap all four chart tables with `overflow-x: auto`.

Evidence:
[`../evidence/AFTER_BROWSER_AUDIT.json`](../evidence/AFTER_BROWSER_AUDIT.json),
[`../evidence/BASELINE_BROWSER_AUDIT.json`](../evidence/BASELINE_BROWSER_AUDIT.json),
and screenshots under [`../evidence/screenshots/`](../evidence/screenshots/).
The illustrations are explicitly labelled as illustrative; no real donor or
production statistic is fabricated.

## 6. Backend, database, and correctness work

The backend retains the twelve business packages under
`com.lifelink.<module>`. Critical fixes in this branch include:

- correct HTTP/status mapping for audit-log search;
- strict same-group compatibility decision and guarded low-stock filtering;
- expiry handling for reservations, dispatches, emergency requests, and stale
  windows;
- cancellation release and safe replay/correlation behaviour;
- DTO validation for blank reasons, null priorities, and adjustment deltas;
- outbox retry termination after a bounded number of attempts;
- deterministic organization pagination;
- request→unit lock ordering and post-lock rechecks;
- idempotent replay evaluated before time-to-live rejection.

The schema remains Flyway `V1`–`V5` with Hibernate `ddl-auto=validate`. The
audit table is `audit_events`, while the public endpoint is `/audit-logs`.
Security-relevant tables include `refresh_tokens`, `login_attempts`,
`idempotency_records`, and `outbox_events`.

## 7. Security posture

Implemented controls include BCrypt password hashing, JWT access tokens with
`jti`, issuer/audience, persistent `token_version`, rotating SHA-256-hashed
refresh tokens with replay detection, permission- and role-based checks in
Java code, organization-scoped queries, validated `X-Organization-Id`, bean
validation, central exception mapping, in-memory login rate limiting, STOMP
CONNECT authentication, own-queue subscription restrictions, and rejection of
all client SEND destinations.

The browser bridge sets
`(globalThis as { global?: typeof globalThis }).global ??= globalThis` before
dynamically importing the SockJS UMD bundle. Vite strips `Origin` from both
HTTP and WebSocket proxy requests for `/ws`. REST fallback polling remains
available when a socket cannot connect.

Deferred security work is documented in
[`../quality/KNOWN_LIMITATIONS.md`](../quality/KNOWN_LIMITATIONS.md):
multi-instance token revocation and rate limiting, MFA, breach-password
screening, production secret management, TLS, backup/restore, load and
penetration testing were not attempted or are not verified.

## 8. Verification summary

| Gate | Exact command or source | Recorded result |
| --- | --- | --- |
| Backend full suite (from `project/backend`) | `.\mvnw.cmd test` | **119 tests, 0 failures, 0 errors, 0 skipped** across 28 Surefire reports |
| Frontend typecheck | `npm run typecheck` | Passed |
| Frontend unit tests | `npm test -- --run` | **7 files, 39 tests**, passed, including the no-first-membership scope regression |
| Frontend build | `npm run build` | Passed |
| Dependency audit | `npm audit --audit-level=high` | **0** high/critical vulnerabilities |
| Browser E2E | `VITE_API_PROXY_TARGET=http://127.0.0.1:18080 npm run test:e2e` with `workers: 2` | **18 passed** on Chrome and Edge, 0 failures, 0 flaky, 0 skipped |
| Browser STOMP | Captured browser frames | CONNECT with Bearer token, SUBSCRIBE to `/user/queue/notifications`, CONNECTED frame received |
| Health probes | Direct HTTP probes to live Compose stack | Backend `/actuator/health` 200 `UP`; frontend `/healthz` 200 `ok` |
| Flyway status | Direct database query | `V1`–`V5` all `success = t` |

The standalone browser STOMP capture reports
`notificationRestPollRequests: 0` for that focused observation. The Playwright
E2E suite separately asserts REST polling requests exist; continuous polling
must not be inferred from the standalone capture alone.

A Maven full run may emit a late Testcontainers shutdown scheduler error
(`Connection to localhost:<port> refused`) after the tests complete; earlier
successful runs still ended `BUILD SUCCESS`. This is disclosed rather than
presented as a clean shutdown guarantee.

## 9. Files and Git safety

Work is confined to the root `README.md` and `project/`. Untracked files under
`LAB-WORK/PRACTICAL-4/` were left untouched, uncommitted, and unpushed. No
`git reset --hard`, `git clean -fd`, `git checkout -- .`, force push, history
rewrite, auto push, or auto merge was used. Containers and the database volume
were not destroyed; the already-running Compose stack was reused for probes.

The final review found six trailing-whitespace errors in current-facing
documentation date lines; those were corrected. A rerun of `git diff --check`
now reports only normal LF/CRLF line-ending warnings and no whitespace errors.
No credential values are introduced in documentation; demo credentials remain
explicitly development-only fixtures.

The final review inspected the diff, line endings, untracked-file scope, and
credential exposure. Its medium findings were closed before commit selection:
the frontend no longer falls back to a first membership, current-facing docs
were reconciled, and the abstract’s blanket pagination claim was corrected.
Any commit created from this tree should separate source, tests, design,
evidence, and documentation into meaningful local commits.

## 10. Limitations

- This is a local/demo verification, not a production-readiness certification.
- Manual visual inspection of PNG screenshots and PDF page renders was not
  available; visual evidence relies on DOM measurements, computed styles,
  extracted PDF text, and render artifacts.
- Docker Compose CLI status commands require `JWT_SECRET`; `docker ps`, direct
  health probes, and direct Flyway queries were used instead.
- `TENANT-01/02/03` and `AUTH-01/04` were deferred because they require broader
  authorization and contract changes beyond this batch.
- Donor discovery is client-side filtering over `GET /donors`, not a dedicated
  geo/radius discovery endpoint.
- There are no `/analytics/donations` or `/analytics/activities` endpoints;
  only `/analytics/overview`, `/inventory`, and `/requests` exist.
- The outbox is notification-only, email/SMS adapters are unconfigured, and a
  generic domain-event bus is not claimed.
- Academic administrative fields require human confirmation before final
  submission.

## 11. Conclusion

The current tree preserves the approved Java Spring Boot backend and
React/TypeScript SPA, fixes confirmed correctness and security defects, and
provides a coherent bloodstream visual identity with measured responsive and
reduced-motion behaviour. Documentation distinguishes historical records from
the current implementation and describes the stack, AOOP examples, APIs,
database, security controls, tests, and limitations. Remaining stale Phase 2
claims were reconciled in this branch. The final independent review and its
closure check found no blocking issue after the medium findings were fixed;
local commit preparation is the remaining closing step. All work remains local
on `feature/lifelink-bloodstream-experience`; no push or merge has been performed.
