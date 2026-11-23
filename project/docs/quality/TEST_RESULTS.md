# LifeLink Verified Test Results

Date: 2026-11-23 (final review-fix verification)

Repository area: `project/` only. Root `README.md`, `LAB-WORK/`, and original
history were not modified. No push was performed.

## Summary

| Workstream | Command | Result |
| --- | --- | --- |
| Backend | `.\mvnw.cmd test -q` | **26 tests, 0 failures, 0 errors** |
| Frontend | `npm ci` | **198 packages installed, 0 vulnerabilities** |
| Frontend | `npm test` | **18 tests in 3 files passed** |
| Frontend | `npm run build` | **TypeScript + Vite production build succeeded** |
| Frontend | `npm audit` | **0 vulnerabilities** |

## Environment

| Component | Version observed |
| --- | --- |
| Host JDK | Java 25 |
| Bytecode / container target | Java 21 |
| Spring Boot | 3.5.16 |
| Maven Wrapper | 3.9.11 |
| Hibernate ORM | 6.6.53.Final |
| H2 (test/dev) | 2.3.232 in PostgreSQL compatibility mode |
| Node.js | v24.19.0 |
| npm | 11.17.0 |
| Vite | 7.3.8 |
| Vitest | 5.1.1 |

## Backend detail

Final Surefire breakdown:

| Class | Tests | Result |
| --- | --- | --- |
| `com.lifelink.domain.BloodUnitTest` | 6 | passed |
| `com.lifelink.domain.EmergencyRequestTest` | 3 | passed |
| `com.lifelink.integration.SchemaAndApiIntegrationTest` | 13 | passed |
| `com.lifelink.notification.StompAuthenticationInterceptorTest` | 4 | passed |

The Spring integration run applied Flyway migrations `V1`, `V2`, and the new
`V3__dispatch_idempotency.sql`, then passed Hibernate `ddl-auto=validate`.

### Verified by the integration suite

- Full Spring context starts with `test` + `dev` profiles and embedded Tomcat.
- `/actuator/health` returns `200 UP`; unauthenticated protected requests return
  `401 AUTHENTICATION_REQUIRED`; malformed bearer tokens return
  `401 TOKEN_INVALID` with a correlation ID.
- Seed login succeeds; bad credentials return `401 AUTHENTICATION_FAILED`.
- Refresh tokens rotate, replay revokes the whole token family, and disabled
  accounts cannot use existing access or refresh tokens.
- Authorization failures return `UNAUTHORIZED_OPERATION` or
  `TENANT_ACCESS_DENIED`; a donor is denied analytics, and a hospital user is
  denied access to a blood-bank organization.
- Cross-tenant allocation confirmation is denied even when the caller has the
  required permission in their own organization; allocation suggestions do not
  expose blood-bank units to a hospital-only caller.
- Donor profile, consent, appointment, and donation-list lookups do not expose
  another organization's donor PII; the donor can read their own profile.
- Global roles are not mutated by organization membership, while the
  organization-scoped permission is still granted.
- The allocation → reservation → dispatch → depart → deliver workflow reaches
  `FULFILLED` and `DELIVERED`; allocation and dispatch idempotency replays return
  the original resources; a missing dispatch `Idempotency-Key` is rejected.
- Two simultaneous confirmations with the same key create one reservation.
- Allocation confirmation rejects incompatible component types and a unit count
  that differs from the requested quantity.
- The STOMP interceptor unit tests cover missing JWT, valid JWT principal
  resolution, rejection of another user's queue, and acceptance of the caller's
  generic queue.

### Independent review findings resolved in this batch

| Severity | Finding | Verification |
| --- | --- | --- |
| High | Cross-tenant allocation and supplier scoping | Negative integration test |
| High | Unit count and component/blood-group compatibility | Negative integration test |
| High | Disabled-user access/refresh tokens accepted | Negative integration test |
| High | Refresh-token race under concurrent rotation | Row lock + frontend single-flight test |
| High | STOMP CONNECT/SUBSCRIBE unauthenticated | 4 interceptor unit tests |
| High | Donor PII/IDOR and donation-list leakage | Negative integration test |
| High | Organization membership mutated global roles | Negative integration test |
| Medium | Dispatch creation was not idempotent | `V3` migration + replay/missing-header tests |
| Medium | JWT issuer/audience and dev-secret fail-fast | Context startup + invalid-token test |
| Medium | Stale `PROCESSING` outbox events were never retried | Repository query includes `PROCESSING` |
| Medium | Frontend role fallback diverged from backend `Role.java` | Aligned with backend enum; typecheck/build |
| Medium | API contract drift | Contract rewritten against controllers/DTOs |
| Low | Makefile `dev`/`lint` targets were broken | `dev` now starts Vite; `lint` replaced by `typecheck` |

No independent re-review was performed after these fixes. The verdict in
[`../reviews/FINAL_INDEPENDENT_REVIEW.md`](../reviews/FINAL_INDEPENDENT_REVIEW.md)
describes what is and is not claimed.

## Frontend detail

- `npm ci` was run from the committed `package-lock.json`. npm emitted an
  `allow-scripts` warning for esbuild's optional postinstall binary but all
  commands succeeded and `npm audit` reported zero vulnerabilities.
- Test files: `src/lib/api.test.ts` (including the new concurrent-401
  single-flight regression), `src/lib/routeGuard.test.ts`, and
  `src/components/ui/components.test.tsx`.
- `npm run build` produced `dist/` with a 366.37 kB main chunk (112.90 kB gzip)
  and a 476.63 kB analytics chunk (135.38 kB gzip).

## Previously fixed defects (original implementation batch)

1. `outbox_events` lacked the `public_id` column required by `BaseEntity`.
2. `SecurityConfig` defined `PasswordEncoder` while constructor-injecting the
   JWT filter, creating a circular dependency.
3. An unused Spring Data Redis dependency produced a failing health indicator.
4. `AuthService.principal()` dereferenced a lazy `Organization` proxy outside a
   transaction.
5. Refresh-token reuse revocation was rolled back with the thrown exception.
6. Concurrent allocation confirmations could race past the idempotency check.
7. A repeated allocation after the request left `APPROVED` incorrectly failed.

## Not verified in this environment

- Docker image builds or `docker compose up`: the Docker daemon was unavailable
  (`npipe:////./pipe/dockerDesktopLinuxEngine`).
- The PostgreSQL `postgres` profile: local runs used H2 in PostgreSQL mode.
- GitHub Actions execution: the workflow remains in `project/deployment/` and
  must be copied to repository-root `.github/workflows/` before GitHub runs it.
- Real-browser/E2E interaction and a live STOMP handshake: frontend tests use
  jsdom/mocked messaging, and the WebSocket coverage is interceptor-level.
- External email/SMS delivery: no provider is configured; the adapter reports
  failure rather than fabricating delivery.
- Load/soak testing, backup/restore, and production secret management.

These limitations are tracked in [`KNOWN_LIMITATIONS.md`](KNOWN_LIMITATIONS.md).
