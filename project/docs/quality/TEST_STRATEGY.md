# LifeLink Test Strategy

Date: 2026-11-23. This document describes the suites that exist in the final
Phase 2 tree and how to run them. Recorded results are in
[`TEST_RESULTS.md`](TEST_RESULTS.md): 93 backend tests, 33 frontend tests,
6 Playwright passes, live STOMP smoke, and Compose probes.

Status labels: **V** verified · **I** implemented but not runtime-verified ·
**N** not implemented · **B** blocked by environment/scope. The final-tree
frontend build and dependency audit passed; no CI run and
**no production-readiness claim** is made. See
[`../deployment/CI.md`](../deployment/CI.md) and
[`KNOWN_LIMITATIONS.md`](KNOWN_LIMITATIONS.md).

## 1. Scope and test pyramid

Backend: 17 test classes / 93 recorded tests in five levels.

1. **Domain unit tests** — pure Java entity guards and state transitions
   (`domain/BloodUnitTest`, `domain/EmergencyRequestTest`). No Spring, DB, or network.
2. **Service/security unit tests with mocks** — authorization, tenant access,
   JWT/filter handling, controller validation and idempotency-key limits,
   rate limiting, logout revocation, analytics scoping, concurrency exception
   mapping, and the STOMP interceptor (`identity/`, `security/`, `analytics/`,
   `concurrency/`, `notification/` packages).
3. **Spring context / Flyway validation** — full context starts against H2 in
   PostgreSQL compatibility mode; Flyway `V1`–`V5` and Hibernate
   `ddl-auto=validate` must agree with every JPA mapping
   (`integration/SchemaAndApiIntegrationTest`).
4. **HTTP integration tests** — the same class has 18 ordered cases covering
   health, auth, refresh rotation/replay, role and tenant checks, seed data,
   allocation→reservation→dispatch→delivery, concurrent confirmation, cross-
   organization denial, donor isolation, disabled-user tokens, membership/
   global-role separation, incompatible inputs, idempotency mismatches,
   dispatch authorization, and incident history.
5. **PostgreSQL concurrency test** — `concurrency/PostgresIdempotencyConcurrencyTest`
   (4 tests) exercises concurrent idempotency claims against a real Testcontainers
   PostgreSQL 16 instance. It is part of the full backend suite (V) and skips
   itself only when Docker is unavailable
   (`@Testcontainers(disabledWithoutDocker = true)`).

Frontend: 6 Vitest files / 33 tests, plus a real-browser Playwright suite and a
live STOMP smoke script against the Compose stack.

## 2. Concurrency strategy

Inventory mutations use pessimistic database locks. The integration suite
submits two simultaneous confirmations with one key and asserts a single
reservation; the PostgreSQL test adds real-database contention (V). The
emergency-request row is locked before idempotency is evaluated, the blood-unit
row is locked again during reservation creation, and the key is re-checked after
lock acquisition. Allocation confirmation locks selected units in ascending id
order. Refresh rotation uses a pessimistic row lock; the frontend uses a
tab-local single-flight refresh promise. Active reservation slots are ordered
deterministically, V4 adds idempotency/integrity constraints, and V5 persists
the token version. Stale writes and integrity races map centrally to
`409 CONCURRENCY_CONFLICT`; clients must retry with a fresh key if the first
attempt did not commit.

## 3. Negative and tenant-isolation tests

The suite explicitly checks that:

- cross-tenant allocation and dispatch are denied even with the local permission;
- donor profiles, consents, appointments, and donation lists are not exposed to
  unrelated organizations;
- disabled users cannot use existing access or refresh tokens, and re-enabling
  does not revive pre-lock tokens (persistent `token_version`);
- malformed JWTs return `TOKEN_INVALID` and protected routes return
  `401 AUTHENTICATION_REQUIRED`;
- organization membership grants scoped permissions without changing global roles;
- allocation rejects incompatible components, blood groups, and wrong unit counts;
- idempotency-key reuse with a changed payload returns `409`, identical replay
  returns the original resource, and over-long/missing keys are rejected;
- analytics respects the validated organization header, with the global view
  restricted to platform admins.

`security/TenantBoundaryRegressionTest`, `identity/TenantAccessServiceTest`,
`identity/UserServiceScopingTest`, `identity/AuthServiceSecurityTest`,
`analytics/AnalyticsServiceTenantScopeTest`, and
`identity/ControllerValidationTest` provide focused regression coverage.

## 4. Test data and isolation

- Unit tests build their own entity graphs or mocks.
- Most integration tests use `@ActiveProfiles({"test", "dev"})` and in-memory H2
  (`jdbc:h2:mem:lifelink-test`); Flyway migrates an empty schema on every JVM
  start before Hibernate validates mappings.
- The concurrency test uses Testcontainers PostgreSQL 16; live Compose probes
  use the `postgres` profile with `SEED_DEMO_DATA=true` and query via
  `docker compose exec` (standalone `psql` is absent).
- Tests are ordered so workflow mutations do not invalidate later setup;
  workflow cases create fresh units and requests with unique references.
- Redis is intentionally absent. Notifications use the local WebSocket broker;
  `outbox_events` stores durable notification intents in the database.

## 5. Commands

From `project/backend` (Maven Wrapper pins 3.9.11; `.\`/`./` as appropriate):

```bash
.\mvnw.cmd test -q
.\mvnw.cmd -Dtest=AuthServiceSecurityTest test        # repeat per focused class
```

From `project/frontend`:

```bash
npm ci
npm test -- --run
npm run test:watch
npm run typecheck
npm run build
npm audit --audit-level=low
VITE_API_PROXY_TARGET=http://127.0.0.1:18080 npm run test:e2e
npm run test:stomp
```

From the repository root (live stack used by the E2E/STOMP probes):

```bash
docker compose -f project/docker/docker-compose.yml up -d --build
```

Recorded status: backend suite, focused regressions, typecheck, unit tests,
production build, dependency audit, E2E, STOMP smoke, and Compose probes are
**V**; GitHub Actions is **B** (no installed workflow). Full counts and links are in
[`TEST_RESULTS.md`](TEST_RESULTS.md).

## 6. Frontend strategy details

- **API client** (`src/lib/api.test.ts`) — envelope unwrapping, nested `error`
  mapping, `Idempotency-Key` generation, one-shot 401 refresh-and-retry, and a
  single refresh shared across concurrent 401s.
- **Route guards** (`src/lib/routeGuard.test.ts`) — unauthenticated redirects and
  permission-based access.
- **Organization/cache** (`src/lib/organization.test.ts`,
  `src/lib/queryCache.test.ts`) — switching scope and invalidating cached queries.
- **Components** (`src/components/ui/components.test.tsx`,
  `src/components/layout/layout-keyboard.test.tsx`) — loading/empty/error states
  and keyboard accessibility.
- **E2E** (`e2e/app.spec.ts`) — 3 scenarios executed on Chrome and Edge via a
  Vite dev server proxying `/api` to `http://127.0.0.1:18080`; 6 passes, retries 0
  ([PLAYWRIGHT_RESULTS.json](../evidence/PLAYWRIGHT_RESULTS.json)).
- **Live STOMP** (`scripts/stomp-smoke.mjs`) — login, SockJS info, websocket
  transport, authenticated `CONNECTED`, own-queue `SUBSCRIBE`, and delivered
  notification through the Compose nginx proxy
  ([STOMP_SMOKE_RESULT.json](../evidence/STOMP_SMOKE_RESULT.json)).

Production source uses real `/api/v1` endpoints; mocks exist only in
`*.test.*` files.

## 7. Deliberately not covered / not claimed

- **I** — cross-tab refresh coordination at runtime (tab-local single-flight
  only); multi-instance STOMP/logout revocation; browser-side live STOMP
  integration in the SPA (the smoke probe is a script).
- **N** — MFA, breach-password screening, audit retention/tamper evidence,
  external email/SMS delivery, shared rate-limit/jti denylist store, load/soak,
  penetration, backup/restore, or production-scale capacity testing.
- **B** — GitHub Actions execution: root `.github/workflows` is outside the
  permitted edit scope; `project/deployment/github-actions.yml` is a template.
- Historical baseline runs (26 backend / 18 frontend tests, V1–V3) are
  superseded by the results recorded in [`TEST_RESULTS.md`](TEST_RESULTS.md).
