# ADR-005: Local Development and Test Database

**Status:** Accepted; implemented in Phase 2 (2026-11-23) with the deviations noted below.
**Date:** 2026-11-23
**Related:** [`../SYSTEM_ARCHITECTURE.md`](../SYSTEM_ARCHITECTURE.md), [`ADR-001-modular-monolith.md`](ADR-001-modular-monolith.md), [`ADR-003-inventory-concurrency.md`](ADR-003-inventory-concurrency.md)

## Context

The audit recorded Java 25 available on the machine with a plan to target Java 21 bytecode, Node 24/npm 11 available, Maven not yet installed (Maven Wrapper planned), and Docker 29 available. Fast unit tests must not require Docker, while locking and constraint behaviour should be exercised against PostgreSQL-compatible SQL. The schema must be identical across environments.

## Decision

- Use **Flyway migrations** as the single schema definition for every profile.
- Unit and slice tests use **H2 in PostgreSQL compatibility mode**, in-memory, no Docker required. Only portable SQL is allowed in migrations; PostgreSQL-only syntax is isolated to explicitly documented migrations and covered by integration tests.
- Local development and deployment use **PostgreSQL 16** (Docker Compose locally, managed or containerised in deployed profiles).
- Seed data, including the six development/demo accounts, is applied by `DevelopmentDataSeeder` under `@Profile({"dev", "default", "postgres"})`, gated by `lifelink.seed.enabled` / `SEED_DEMO_DATA`. Test profiles seed their own fixtures.
- Maven Wrapper pins Maven `3.9.11`; environment variables supply datasource URL, credentials, JWT key, and allowed CORS origins. No signing secret is committed. `JWT_SECRET` is required in every non-test profile.

## Implementation status (updated 24 November 2026)

- Implemented: Flyway `V1`–`V5` as the single schema set (V5 adds persistent monotonic `users.token_version`); H2 in PostgreSQL compatibility mode for tests; PostgreSQL 16 in Docker Compose with Testcontainers for concurrency tests; Maven Wrapper; environment-driven configuration; profile-gated seeder.
- Implemented: Compose binds db/backend/frontend to `127.0.0.1` with overridable `POSTGRES_PORT`, `BACKEND_PORT`, and `FRONTEND_PORT`; images `lifelink/backend:dev` and `lifelink/frontend:dev` built successfully.
- Deviated from the original design: there is no `local` profile name (the active defaults are `default`/`dev`/`postgres`), seeding is a Java loader rather than versioned seed migrations, and `application.yml` defaults `SEED_DEMO_DATA` to `true` while `application-postgres.yml` defaults it to `false`.
- Verified: health probes on override ports `18080/15173/15432` returned HTTP 200 for backend and frontend; the full-stack login through the frontend nginx proxy after the seeder fix returned HTTP 200. Flyway `V1`–`V5` all reported `success = t` and seed data was confirmed (`organizations=2`, `users=6`, `blood_units=9`). See [`../../evidence/COMPOSE_VERIFICATION.json`](../../evidence/COMPOSE_VERIFICATION.json), [`../../quality/TEST_RESULTS.md`](../../quality/TEST_RESULTS.md), and [`../../reviews/PHASE_2_FINAL_REVIEW.md`](../../reviews/PHASE_2_FINAL_REVIEW.md). Live STOMP through the same proxy is also verified ([`../../evidence/STOMP_SMOKE_RESULT.json`](../../evidence/STOMP_SMOKE_RESULT.json)); the SPA now has an authenticated browser bridge as well ([`../../evidence/BROWSER_STOMP_RESULT.json`](../../evidence/BROWSER_STOMP_RESULT.json)). GitHub Actions was not installed or run.

## Consequences

**Positive**

- `./mvnw test` works on a clean machine without external services.
- Developers can run the full API against the same PostgreSQL engine used in deployment when needed.
- One migration set prevents schema drift between H2 tests and PostgreSQL runtime.
- Demo data cannot leak into production because it is profile-scoped.

**Negative**

- H2 compatibility mode is not PostgreSQL: differences in locking, partial indexes, and JSON types require separate integration coverage.
- PostgreSQL-only constraints (for example a `gist` exclusion constraint) cannot be verified in H2 and must be isolated and documented.
- Docker Compose is required for the full local stack, which may be unavailable in restricted environments.
- Seed data must be kept deterministic so tests and user-guide screenshots do not drift.

## Alternatives

| Alternative | Why not chosen |
| :--- | :--- |
| H2 only, everywhere | Would hide PostgreSQL locking/constraint behaviour that is central to the inventory decision. |
| Testcontainers only for tests | Excellent fidelity but requires Docker for every unit-test run, slowing the course workflow. |
| Shared remote PostgreSQL for developers | Requires credentials, network access, and creates cross-developer state contamination. |
| Schema generated from JPA `ddl-auto` | Schema drift and no explicit, reviewable migration history. |
| Separate hand-written H2 and PostgreSQL schemas | Guaranteed drift between environments. |
