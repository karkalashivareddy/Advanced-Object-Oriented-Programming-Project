# LifeLink Verified Test Results

**Current verification: 24 November 2026.** Branch:
`feature/lifelink-bloodstream-experience`, base HEAD
`59401d45e511183ede59e7d55073f07e2cf5eacd`. Changes are **uncommitted**;
**nothing was pushed or merged**. Current scope is `project/` plus the root
`README.md`; `LAB-WORK/` and Git history are preserved. The older Phase 2
figures below are explicitly historical.

**Status legend:** **V** Verified (command executed / probe recorded) ·
**I** Implemented but not runtime-verified · **N** Not implemented ·
**B** Blocked by environment or edit scope. These are local/demo results;
**no production-readiness claim** is made.

## Current verification (2026-11-24)

| Area | Exact command / source | Status | Recorded result |
| --- | --- | --- | --- |
| Backend full suite (from `project/backend`) | `.\mvnw.cmd test` | V | **119 tests, 0 failures, 0 errors, 0 skipped** across **28 Surefire XML reports**. Includes Testcontainers PostgreSQL 16 concurrency, the new lifecycle/validation regressions, and Flyway `V1`–`V5` with Hibernate `ddl-auto=validate`. |
| Frontend typecheck | `npm run typecheck` | V | Passed; no TypeScript errors. |
| Frontend unit tests | `npm test -- --run` | V | **39 tests in 7 files**, all pass. |
| Tenancy scope regression | `organization.test.ts` → `resolveOrganizationScope` | V | A valid stored scope is restored; invalid/null stored scopes resolve to `null` with no first-membership fallback. |
| Frontend production build | `npm run build` | V | Vite production build passed. |
| Dependency audit | `npm audit --audit-level=high` | V | **0** high/critical vulnerabilities. |
| Browser E2E | `VITE_API_PROXY_TARGET=http://127.0.0.1:18080 npm run test:e2e` with `workers: 2` | V | **18 passed** on Chrome and Edge (9 specs × 2 projects), 0 failures, 0 flaky, 0 skipped. [PLAYWRIGHT_RESULTS.json](../evidence/PLAYWRIGHT_RESULTS.json) |
| Browser STOMP | Authenticated browser capture against the live stack | V | CONNECT frame with bearer token, SUBSCRIBE to `/user/queue/notifications`, and CONNECTED frame observed. [BROWSER_STOMP_RESULT.json](../evidence/BROWSER_STOMP_RESULT.json) |
| DOM / responsive evidence | Playwright browser probes | V | Landing and Analytics desktop/mobile `documentScrollWidth` equals viewport; reduced-motion SMIL `animateMotion` count is `0`; Analytics chart-table wrappers use `overflow-x: auto`. [AFTER_BROWSER_AUDIT.json](../evidence/AFTER_BROWSER_AUDIT.json) |
| Health probes | Direct HTTP probes to the already-running Compose stack | V | Backend `/actuator/health` HTTP 200 `{"status":"UP","groups":["liveness","readiness"]}`; frontend `/healthz` HTTP 200 `ok`. |
| Flyway status | Direct database query | V | `V1`–`V5` all `success = t`. |
| Corrected abstract PDF | `project/docs/abstract/LifeLink_Project_Abstract.pdf`, validated by [ABSTRACT_PDF_VALIDATION.json](../evidence/ABSTRACT_PDF_VALIDATION.json) and [ABSTRACT_PDF_TEXT.txt](../evidence/ABSTRACT_PDF_TEXT.txt) | V | **4 pages**, 14 numbered sections, **187-word** abstract (limit 250), no replacement/null characters, no instructional parenthetical notes, accurate Java/Spring Boot/React/TypeScript/PostgreSQL phrases, current 119/39/18 evidence, and preserved original form/verification PDF. All automated checks passed. |

The focused browser STOMP capture reports `notificationRestPollRequests: 0`.
The Playwright suite separately asserts REST polling requests exist; do not
infer continuous polling from the standalone capture alone. A Maven full run
may emit a late Testcontainers shutdown scheduler connection error after the
tests pass; successful runs still ended with `BUILD SUCCESS`.

The Word COM export of the corrected DOCX hung and was terminated before
producing a PDF, so the final PDF was rendered from the same corrected
14-section content with PyMuPDF. It is not a byte-for-byte Word export of the
DOCX. Manual visual inspection was unavailable; the PDF checks use text
extraction, page count, metadata, and section enumeration. Administrative
fields reproduced from the submitted form still require human confirmation.

Current backend test classes (28 Surefire reports): `audit/PostgresAuditSearchTest`;
`allocation/CompatibilitySpecificationSelectionTest`;
`analytics/AnalyticsServiceTenantScopeTest`;
`concurrency/ConcurrencyExceptionMappingTest` and
`concurrency/PostgresIdempotencyConcurrencyTest`;
`dispatch/DispatchLockOrderTest` and `dispatch/DispatchLifecycleRegressionTest`;
`domain/BloodUnitTest` and `domain/EmergencyRequestTest`;
`emergency/EmergencyCancelLockOrderTest` and
`emergency/EmergencyLifecycleRegressionTest`;
`identity/AuthControllerLogoutTest`, `identity/AuthRateLimitFilterTest`,
`identity/AuthServiceSecurityTest`, `identity/ControllerValidationTest`,
`identity/JwtAuthenticationFilterTest`, `identity/JwtServiceTest`,
`identity/PasswordValidationTest`, `identity/TenantAccessServiceTest`, and
`identity/UserServiceScopingTest`;
`integration/SchemaAndApiIntegrationTest`;
`inventory/InventoryDefaultLowStockTest` and `inventory/InventoryRegressionTest`;
`notification/OutboxRetryTerminationTest` and
`notification/StompAuthenticationInterceptorTest`;
`organization/OrganizationPaginationTest`;
`security/TenantBoundaryRegressionTest`; and
`validation/NullReasonAndPriorityValidationTest`.

Current frontend test files are `src/lib/api.test.ts`,
`src/lib/organization.test.ts`, `src/lib/queryCache.test.ts`,
`src/lib/routeGuard.test.ts`, `src/components/brand/brand.test.tsx`,
`src/components/layout/layout-keyboard.test.tsx`, and
`src/components/ui/components.test.tsx`.

---

## Historical Phase 2 record (2026-11-23; superseded)

Everything from this point through the end of this file preserves the earlier
Phase 2 evidence and counts. Do not read those figures as current status.

## 1. Results at a glance

| Area | Exact command / source | Status | Recorded result |
| --- | --- | --- | --- |
| Backend full suite (from `project/backend`) | `.\mvnw.cmd test -q` | V | **93 tests, 0 failures, 0 errors, 0 skipped** across **17 Surefire XML reports** (one per test class). Includes Testcontainers PostgreSQL 16 concurrency tests and Flyway `V1`–`V5` with Hibernate `ddl-auto=validate`. |
| Focused backend regressions | Focused Maven runs of `AuthServiceSecurityTest`, `UserServiceScopingTest`, `AnalyticsServiceTenantScopeTest`, `ControllerValidationTest` (`-Dtest=<Class>`) | V | All four classes pass. |
| Frontend typecheck (from `project/frontend`) | `npm run typecheck` | V | Passed; no TypeScript errors. |
| Frontend unit tests | `npm test -- --run` | V | **33 tests in 6 files**, all pass. |
| Frontend production build | `npm run build` | V | Vite 7.3.8 production build succeeded from the final tree. |
| Dependency audit | `npm audit --audit-level=low` | V | **0 vulnerabilities**. |
| Browser E2E | `VITE_API_PROXY_TARGET=http://127.0.0.1:18080 npm run test:e2e` | V | **6 passed in 14.4 s**, Chrome and Edge (3 specs × 2 projects), retries 0, flaky 0. [PLAYWRIGHT_RESULTS.json](../evidence/PLAYWRIGHT_RESULTS.json) |
| Live STOMP smoke | `npm run test:stomp` against the Compose frontend proxy (`http://127.0.0.1:15173`) | V | Login ok, SockJS info ok, websocket transport ok, authenticated `CONNECTED`, personal queue `SUBSCRIBE` accepted, notification `MESSAGE` delivered. [STOMP_SMOKE_RESULT.json](../evidence/STOMP_SMOKE_RESULT.json) |
| Docker Compose stack | `docker compose -f project/docker/docker-compose.yml up -d --build` | V | Services healthy; probes in §2. [COMPOSE_VERIFICATION.json](../evidence/COMPOSE_VERIFICATION.json) |
| GitHub Actions execution | — | B | Root `.github/workflows` is outside the permitted edit scope; `project/deployment/github-actions.yml` is a template, not installed or run. |

## 2. Compose / live-stack detail (V)

| Probe | Observed result |
| --- | --- |
| Backend health | `GET /actuator/health` → HTTP 200 `{"status":"UP","groups":["liveness","readiness"]}` |
| Frontend health | `GET /healthz` → HTTP 200 |
| SPA root | HTTP 200 |
| Login through nginx proxy | HTTP 200 |
| Flyway (queried with `docker compose exec`) | V1 core schema, V2 operational schema, V3 dispatch idempotency, V4 integrity and idempotency, V5 persistent token version — all `success=t` |
| Seed counts | `organizations=2`, `users=6`, `blood_units=9` |

Standalone `psql` and `make` are absent on the host; PostgreSQL was queried via
`docker compose exec`. Raw observations:
[COMPOSE_VERIFICATION.json](../evidence/COMPOSE_VERIFICATION.json).

## 3. Backend detail (V)

17 test classes produced 17 Surefire XML reports:

| Package | Test classes |
| --- | --- |
| `domain` | `BloodUnitTest`, `EmergencyRequestTest` |
| `identity` | `AuthControllerLogoutTest`, `AuthRateLimitFilterTest`, `AuthServiceSecurityTest`, `ControllerValidationTest`, `JwtAuthenticationFilterTest`, `JwtServiceTest`, `PasswordValidationTest`, `TenantAccessServiceTest`, `UserServiceScopingTest` |
| `concurrency` | `ConcurrencyExceptionMappingTest`, `PostgresIdempotencyConcurrencyTest` (Testcontainers PostgreSQL 16, 4 tests) |
| `analytics` | `AnalyticsServiceTenantScopeTest` |
| `notification` | `StompAuthenticationInterceptorTest` |
| `security` | `TenantBoundaryRegressionTest` |
| `integration` | `SchemaAndApiIntegrationTest` (18 ordered cases) |

What the full run verifies:

- Full Spring context starts; `/actuator/health` is `UP`; unauthenticated
  protected requests return `401 AUTHENTICATION_REQUIRED`; malformed bearer
  tokens return `401 TOKEN_INVALID` with a correlation ID.
- Seed login succeeds; bad credentials return `401 AUTHENTICATION_FAILED`.
- Refresh tokens rotate; replay revokes the token family; disabled accounts
  cannot use existing access or refresh tokens.
- Authorization failures map to `UNAUTHORIZED_OPERATION` /
  `TENANT_ACCESS_DENIED`; donor PII, consents, appointments, and donation lists
  are not exposed across organizations; global roles are not mutated by
  membership changes.
- Allocation confirms exactly `quantity` compatible units from authorized
  supplier organizations; cross-tenant allocation and mismatched component /
  blood-group / unit-count inputs are rejected.
- Workflow reaches `FULFILLED` / `DELIVERED`; allocation, reservation, and
  dispatch idempotency replays return the original resources, while divergent
  payloads and missing keys are rejected; dispatch is assigned to the supplying
  organization; active reservation slots are ordered deterministically.
- Two simultaneous confirmations with one key create one reservation; PostgreSQL
  16 contention is exercised by Testcontainers; lock/integrity races map to
  `409 CONCURRENCY_CONFLICT`.
- Tenant headers are validated; idempotency keys are capped at 120 characters;
  JWT `iss`/`aud` are checked and `JWT_SECRET` fails fast outside test profiles.
- Analytics reads use the validated `X-Organization-Id`; platform admins may omit
  it for the global view.
- STOMP bearer authentication, own-queue `SUBSCRIBE` restriction, and rejection
  of `SEND` frames (no `@MessageMapping` handlers) are covered at interceptor
  level; the live broker path is covered by the STOMP smoke probe in §1.

### Phase F audit-fix closure

| ID | Severity | Finding | Fix / evidence | Status |
| --- | --- | --- | --- | --- |
| F-01 | High | Token revocation reversible after lock/disable then re-enable | V5 adds persistent monotonic `users.token_version`; per-request principal rejects stale versions; status/credential transitions bump it permanently. `AuthServiceSecurityTest`, V5 migration, full suite | V |
| F-02 | Medium | Analytics ignored tenant scope | `AnalyticsService` uses validated `TenantAccessService` organization; platform admins may omit header for global view. `AnalyticsServiceTenantScopeTest` | V |
| F-03 | Medium | Stale docs / evidence | These four owned files reconciled to the final Phase 2 evidence | V (docs) |
| F-04 | Medium | Process-local logout revocation undocumented | `AuthService.revokeAccessToken` documents its in-memory scope; caveat recorded in [`KNOWN_LIMITATIONS.md`](KNOWN_LIMITATIONS.md) | V (docs) |
| F-05 | Low | Unbounded idempotency-key length | `@Size(max = 120)` on controllers/DTOs plus `IdempotencyKeys.MAX_LENGTH`; `ControllerValidationTest` | V |
| F-06 | Medium | E2E / STOMP evidence gaps | Persisted JSON reports linked in §1 | V |

The historical Phase 2 second review returned **`PASS WITH RESIDUALS`** with no
new critical, high, or medium finding; all six Phase F findings were resolved at
that time. It approved that tree only as a local-development / supervised-demo
release, not as production-ready. Current reconciliation is in
[`../reviews/CURRENT_STATE_ENGINEERING_AND_DESIGN_AUDIT.md`](../reviews/CURRENT_STATE_ENGINEERING_AND_DESIGN_AUDIT.md). See
[`../reviews/PHASE_2_SECOND_REVIEW.md`](../reviews/PHASE_2_SECOND_REVIEW.md).
The earlier review record is
[`../reviews/FINAL_INDEPENDENT_REVIEW.md`](../reviews/FINAL_INDEPENDENT_REVIEW.md)
and the Phase 2 baseline is
[`../reviews/PHASE_2_GAP_ANALYSIS.md`](../reviews/PHASE_2_GAP_ANALYSIS.md).

## 4. Frontend detail (V)

Six Vitest files (33 tests): `src/lib/api.test.ts`,
`src/lib/routeGuard.test.ts`, `src/lib/organization.test.ts`,
`src/lib/queryCache.test.ts`, `src/components/ui/components.test.tsx`, and
`src/components/layout/layout-keyboard.test.tsx`. Coverage includes typed API
errors, idempotency headers, refreshed-401 single-flight, route guards,
organization switching, query-cache invalidation, UI states, and keyboard
accessibility. Playwright specs in `e2e/app.spec.ts` cover unauthenticated
redirect, live dashboard data with status-filter refetch, and mobile dialog
focus/Escape behaviour on both browsers.

## 5. Environment

| Component | Version observed |
| --- | --- |
| Host JDK | Java 25 |
| Bytecode / container target | Java 21 |
| Spring Boot | 3.5.16 |
| Maven Wrapper | 3.9.11 |
| Node.js | v24.19.0 |
| npm | 11.17.0 |
| Docker CLI / Compose | 29.7.2 / v5.4.0 |
| Browsers | Chrome and Edge installed (Playwright 1.65.1) |
| GitHub CLI | 2.97.0 present (no Actions run) |
| Host gaps | standalone `psql` and `make` absent |

## 6. Historical context (superseded, kept for provenance)

The Phase 1 baseline recorded 26 backend tests in 4 classes, 18 frontend tests
in 3 files, V1–V3 migrations, a successful production build, and `npm audit`
with 0 vulnerabilities. Those figures predate V4/V5 and the current suite; they
are superseded by §1 and are **not** the current status. Earlier defect batches
(JPA `public_id`, `PasswordEncoder` circular dependency, Redis health indicator,
lazy proxy dereference, non-committing replay revocation, idempotency race,
`APPROVED` replay) and the Phase 1 independent-review fixes (cross-tenant
scoping, compatibility checks, disabled-token handling, STOMP interception,
donor IDOR, membership/global-role separation, dispatch idempotency, JWT
issuer/audience, stale `PROCESSING` outbox retry, role fallback, API contract,
Makefile targets) remain fixed and are exercised by the current 119-test run.

## 7. Not claimed in this record

| Status | Items |
| --- | --- |
| I | Cross-tab refresh coordination; multi-instance session revocation; production-scale runtime behaviour |
| N | MFA, breach-password screening, audit retention/tamper evidence, shared rate-limit and jti denylist store, external email/SMS delivery, load/soak/penetration/backup-restore testing, production secrets/TLS/image pinning |
| B | GitHub Actions execution (root `.github/workflows` outside edit scope) |

Historical review records preserve their original counts and verdicts with
dated supersession notes. For current status, treat the **Current verification**
section above,
[`../reviews/CURRENT_STATE_ENGINEERING_AND_DESIGN_AUDIT.md`](../reviews/CURRENT_STATE_ENGINEERING_AND_DESIGN_AUDIT.md),
and the linked JSON evidence as authoritative.
