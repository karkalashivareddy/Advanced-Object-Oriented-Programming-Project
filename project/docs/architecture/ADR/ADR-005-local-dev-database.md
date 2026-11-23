# ADR-005: Local Development and Test Database

**Status:** Accepted (design decision; implementation planned, not yet present).  
**Date:** 2026-11-23  
**Related:** [`../SYSTEM_ARCHITECTURE.md`](../SYSTEM_ARCHITECTURE.md), [`ADR-001-modular-monolith.md`](ADR-001-modular-monolith.md), [`ADR-003-inventory-concurrency.md`](ADR-003-inventory-concurrency.md)

## Context

The audit recorded Java 25 available on the machine with a plan to target Java 21 bytecode, Node 24/npm 11 available, Maven not yet installed (Maven Wrapper planned), and Docker 29 available. Fast unit tests must not require Docker, while locking and constraint behaviour should be exercised against PostgreSQL-compatible SQL. The schema must be identical across environments.

## Decision

- Use **Flyway migrations** as the single schema definition for every profile.
- Unit and slice tests use **H2 in PostgreSQL compatibility mode**, in-memory, no Docker required. Only portable SQL is allowed in migrations; PostgreSQL-only syntax is isolated to explicitly documented migrations and covered by integration tests.
- Local development and deployment use **PostgreSQL 16** (Docker Compose locally, managed or containerised in deployed profiles).
- Seed data, including the five development-only demo accounts, is applied only under the `local` profile via versioned seed migrations or a profile-scoped data loader. Test profiles seed their own fixtures.
- Maven Wrapper pins the Maven version; environment variables supply datasource URL, credentials, JWT key, and allowed CORS origins. No secrets are committed.

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
