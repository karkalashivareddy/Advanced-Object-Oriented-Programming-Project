# ADR-003: Inventory Concurrency

**Status:** Accepted; implemented in Phase 2 (2026-11-23) with the deviations noted below.
**Date:** 2026-11-23
**Related:** [`../DOMAIN_MODEL.md`](../DOMAIN_MODEL.md), [`../SYSTEM_ARCHITECTURE.md`](../SYSTEM_ARCHITECTURE.md)

## Context

A blood unit is a single physical object. Two staff members may try to reserve or release the same unit at the same time, and allocation confirmation may select several units in one operation. A naive check-then-act produces a double reservation — the same invariant failure studied in the hotel-room case study in `LAB-WORK/PRACTICAL-2`. The contract requires a `version` field on `BloodUnitView` and an idempotency key on allocation confirmation and reservation creation.

## Decision

Use a **database-centred, pessimistic-first strategy** on `BloodUnit`:

1. `BloodUnitRepository.findByIdForUpdate(Long)` (`@Lock(PESSIMISTIC_WRITE)`) obtains a row lock before status checks in release, reserve, cancel, and dispatch transitions.
2. `BaseEntity.version` is an optimistic backstop (`@Version`). Stale writes fail fast; lock/version conflicts map centrally to `409 CONCURRENCY_CONFLICT`. There is no automatic application-level retry loop — clients are told to retry the request.
3. Database constraints provide the final guard: V4 adds a sparse unique index on `reservations.active_unit_id` plus CHECK constraints (portable to H2) so only `ACTIVE` reservations occupy a unit slot; `dispatches.reservation_id` is unique.
4. Allocation confirmation locks all selected rows **in ascending unit id order** to reduce deadlocks, then creates all reservations in one transaction.
5. `POST /allocations/suggestions` is read-only and takes no locks; it never promises stock.
6. `POST /allocations/confirm`, `POST /reservations`, and `POST /dispatches` record `(scope, key)` in `idempotency_records` with a SHA-256 request fingerprint and replay the stored response.

## Implementation status (updated 24 November 2026)

- Implemented: pessimistic unit/request locks, sorted allocation locks, V4 idempotency records and sparse one-active-reservation constraint, status CHECK constraints, and central `409 CONCURRENCY_CONFLICT` mapping.
- Implemented: dispatch creation locks the emergency request before the unit (matching expiry/allocation order), then locks the unit before claiming idempotency so replay and competing reservation paths serialize on the same row. Idempotent replay is resolved before TTL validation, and the confirmed/expired checks are re-evaluated inside the locked work.
- Deviated from the original design: the repository method is named `findByIdForUpdate`, the lock is on `BaseEntity.version`, the active-reservation constraint is a nullable-column + CHECK rather than a PostgreSQL partial index, and there is no automatic retry.
- Backend coverage includes PostgreSQL concurrency and lifecycle regression tests. The current full run passed: **119 tests, 0 failures/errors/skips across 28 Surefire reports**, including Testcontainers PostgreSQL 16 concurrency and Flyway `V1`–`V5` with Hibernate `ddl-auto=validate`. See [`../../quality/TEST_RESULTS.md`](../../quality/TEST_RESULTS.md), [`../../reviews/CURRENT_STATE_ENGINEERING_AND_DESIGN_AUDIT.md`](../../reviews/CURRENT_STATE_ENGINEERING_AND_DESIGN_AUDIT.md), and durable evidence under [`../../evidence/`](../../evidence/). No load or penetration test was performed; no production-readiness claim is made.

## Consequences

**Positive**

- The double-reservation race is prevented at three levels: domain guard, row lock, and unique index.
- Locking is limited to a single row per unit, so unrelated inventory work is not blocked.
- Deterministic lock order limits deadlocks to genuinely rare cases.
- The design maps directly to the lab lessons on guarded methods, version fields, and database safeguards.

**Negative**

- A reserved row blocks other writers for the duration of a short transaction; long transactions would hurt throughput.
- Pessimistic locking is PostgreSQL- and H2-specific SQL; row locks are exercised in the PostgreSQL-mode H2 profile and under Testcontainers PostgreSQL 16.
- No automatic retry is a policy choice; unpredictable contention surfaces as `409 CONCURRENCY_CONFLICT` and the client must retry.
- The unique indexes require careful migration design so historical rows do not block Flyway upgrades.

## Alternatives

| Alternative | Why not chosen |
| :--- | :--- |
| Pure optimistic locking | Simpler, but repeated user-visible failures under contention and weaker protection for a physical, non-duplicable asset. |
| Redis/distributed lock | Adds an extra failure mode and is unnecessary with one database and one deployable. |
| `SERIALIZABLE` for all transactions | Strong, but excessive abort rate and performance cost for read-heavy inventory filters. |
| Serialize all writes through a single queue | Removes concurrency rather than managing it; complicates synchronous REST responses and idempotent error reporting. |
| Application-level `synchronized` blocks | Only works within one JVM instance and would break under horizontal scaling. |
