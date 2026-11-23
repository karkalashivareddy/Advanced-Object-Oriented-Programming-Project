# LifeLink Verified Test Results

Date: 2026-11-23 — final Phase 2 verification and audit-fix reconciliation.

Branch: `feature/lifelink-enterprise-platform`. Baseline HEAD:
`195e88a81b105baea69018e44f4b57f3f806937a` (Phase 1). Phase 2 work was
**uncommitted** at verification time; **nothing was pushed**. Scope: `project/`
only — root `README.md`, `LAB-WORK/`, and Git history were not modified.

**Status legend:** **V** Verified (command executed / probe recorded) ·
**I** Implemented but not runtime-verified · **N** Not implemented ·
**B** Blocked by environment or edit scope. These are local/demo results;
**no production-readiness claim** is made.

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

A second independent review returned **`PASS WITH RESIDUALS`** with no new
critical, high, or medium finding; all six Phase F findings are resolved. It
approves this tree only as a local-development / supervised-demo release, not
as production-ready. See
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
Makefile targets) remain fixed and are exercised by the current 93-test run.

## 7. Not claimed in this record

| Status | Items |
| --- | --- |
| I | Cross-tab refresh coordination; multi-instance session revocation; production-scale runtime behaviour |
| N | MFA, breach-password screening, audit retention/tamper evidence, shared rate-limit and jti denylist store, external email/SMS delivery, load/soak/penetration/backup-restore testing, production secrets/TLS/image pinning |
| B | GitHub Actions execution (root `.github/workflows` outside edit scope) |

Historical review records preserve their original counts and verdicts with
dated supersession notes. For current status, treat this file,
[`../reviews/PHASE_2_FINAL_REVIEW.md`](../reviews/PHASE_2_FINAL_REVIEW.md),
and the linked JSON evidence as authoritative.
