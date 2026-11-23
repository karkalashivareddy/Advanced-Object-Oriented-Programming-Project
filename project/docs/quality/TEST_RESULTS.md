# LifeLink Verified Test Results

Date: 2026-11-23

Repository area: `project/` only. Root `README.md`, `LAB-WORK/`, and original
history were not modified.

## Summary

| Workstream | Command | Result |
| --- | --- | --- |
| Backend | `./mvnw.cmd test` | **17 tests, 0 failures, 0 errors** |
| Frontend | `npm ci` | **198 packages installed, 0 vulnerabilities** |
| Frontend | `npm test` | **17 tests in 3 files passed** |
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

Test breakdown from `target/surefire-reports`:

| Class | Tests | Result |
| --- | --- | --- |
| `com.lifelink.domain.BloodUnitTest` | 6 | passed |
| `com.lifelink.domain.EmergencyRequestTest` | 3 | passed |
| `com.lifelink.integration.SchemaAndApiIntegrationTest` | 8 | passed |

### Verified by the integration suite

- Full Spring context starts with `test` + `dev` profiles.
- Flyway validates and applies `V1__core_schema.sql` and
  `V2__operational_schema.sql` to an empty schema.
- Hibernate `ddl-auto=validate` accepts every JPA mapping.
- `GET /actuator/health` returns `200` with status `UP`.
- Unauthenticated protected requests return `401` with
  `AUTHENTICATION_REQUIRED` and a correlation ID.
- Seed login succeeds; bad credentials return `401` with
  `AUTHENTICATION_FAILED`.
- Refresh tokens rotate; replaying an old token returns `401` and revokes the
  whole token family, so the replacement token is also rejected.
- A donor role is denied analytics access with `403`, and a hospital user is
  denied access to a blood-bank organization with `TENANT_ACCESS_DENIED`.
- Seeded organizations, users, inventory and requests are queryable.
- The allocation suggestion → confirm → reservation confirm → dispatch →
  depart → deliver workflow reaches `FULFILLED`, marks the unit `DELIVERED`, and
  remains idempotent when the same confirmation is repeated.
- Two simultaneous confirmations with the same idempotency key return the same
  reservation; the unit and request both finish in `RESERVED`.

### Defects found and fixed during verification

1. `outbox_events` lacked the `public_id` column required by `BaseEntity`, which
   broke Hibernate schema validation at startup.
2. `SecurityConfig` defined `PasswordEncoder` while constructor-injecting the
   JWT filter, creating a circular dependency. The encoder moved to its own
   configuration class.
3. An unused Spring Data Redis dependency produced a failing health indicator
   and `503` on `/actuator/health`. It was removed from code, Compose, and docs.
4. `AuthService.principal()` dereferenced a lazy `Organization` proxy outside a
   transaction, breaking JWT authentication for some users. It now opens a
   read-only transaction.
5. Refresh-token reuse revocation was rolled back with the thrown exception.
   `refresh()` now commits the revocation and audit record.
6. Concurrent allocation confirmations could race past the idempotency check.
   Confirmation now locks the emergency-request row, and reservation creation
   re-checks the idempotency key after acquiring the blood-unit lock.
7. A repeated allocation after the request left `APPROVED` incorrectly failed;
   the persisted idempotency result is now checked before the state guard.

## Frontend detail

- `npm ci` was run from the committed `package-lock.json`, matching CI.
- Vitest 3.2.7 was initially resolved and reported three advisories, all in
  dev-only test tooling (`vitest`, `@vitest/mocker`, `tinypool`). The project was
  upgraded to Vitest 5.1.1; `npm audit` now reports zero vulnerabilities and the
  production dependency tree alone also reports zero.
- Test files: `src/lib/api.test.ts`, `src/lib/routeGuard.test.ts`, and
  `src/components/ui/components.test.tsx`.
- `npm run build` produced `dist/` with a 366.25 kB main chunk (112.89 kB gzip)
  and a 476.63 kB analytics chunk (135.38 kB gzip).

## Not verified in this environment

- Docker image builds or `docker compose up`: the Docker daemon was unavailable.
- The PostgreSQL `postgres` profile: local runs used H2 in PostgreSQL mode.
- GitHub Actions execution: the workflow must be copied to root
  `.github/workflows/` first.
- Real browser/E2E interaction with the SPA: coverage is jsdom-based.
- External email/SMS delivery: no provider is configured and the adapter
  deliberately reports failure rather than claiming delivery.

These limitations are tracked in [`KNOWN_LIMITATIONS.md`](KNOWN_LIMITATIONS.md).
