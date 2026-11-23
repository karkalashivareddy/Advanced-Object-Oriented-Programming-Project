# ADR-003: Inventory Concurrency

**Status:** Accepted (design decision; implementation planned, not yet present).  
**Date:** 2026-11-23  
**Related:** [`../DOMAIN_MODEL.md`](../DOMAIN_MODEL.md), [`../SYSTEM_ARCHITECTURE.md`](../SYSTEM_ARCHITECTURE.md)

## Context

A blood unit is a single physical object. Two staff members may try to reserve or release the same unit at the same time, and allocation confirmation may select several units in one operation. A naive check-then-act produces a double reservation — the same invariant failure studied in the hotel-room case study in `LAB-WORK/PRACTICAL-2`. The contract requires a `version` field on `BloodUnitView` and an idempotency key on allocation confirmation and reservation creation.

## Decision

Use a **database-centred, pessimistic-first strategy** on `BloodUnit`:

1. `BloodUnitRepository.lockByIdForUpdate(UnitId)` obtains `SELECT ... FOR UPDATE` before any status check in release, reserve, cancel, and dispatch transitions.
2. `BloodUnit.version` is an optimistic backstop (`@Version`). A stale update fails fast; the application retries once for transient version/lock failures and otherwise returns 409.
3. Database constraints provide the final guard: a partial unique index allows only one `PENDING`/`CONFIRMED` reservation per unit, and a unique index allows only one dispatch per reservation. Check constraints reject impossible statuses and dates.
4. Allocation confirmation locks all selected rows **in ascending unit id order** to avoid deadlocks, then creates all reservations in one transaction.
5. `POST /allocations/suggestions` is read-only and takes no locks; it never promises stock.
6. Every idempotency-protected endpoint records `(scope, key)` with a unique constraint and replays the stored response.

## Consequences

**Positive**

- The double-reservation race is prevented at three levels: domain guard, row lock, and unique index.
- Locking is limited to a single row per unit, so unrelated inventory work is not blocked.
- Deterministic lock order limits deadlocks to genuinely rare cases.
- The design maps directly to the lab lessons on guarded methods, version fields, and database safeguards.

**Negative**

- A reserved row blocks other writers for the duration of a short transaction; long transactions would hurt throughput.
- Pessimistic locking is PostgreSQL- and H2-specific SQL; the repository method must be tested in the PostgreSQL-mode H2 profile.
- One retry is a policy choice; unpredictable contention may still surface as 409 to the user.
- The unique indexes require careful migration design so historical rows do not block Flyway upgrades.

## Alternatives

| Alternative | Why not chosen |
| :--- | :--- |
| Pure optimistic locking | Simpler, but repeated user-visible failures under contention and weaker protection for a physical, non-duplicable asset. |
| Redis/distributed lock | Adds an extra failure mode and is unnecessary with one database and one deployable. |
| `SERIALIZABLE` for all transactions | Strong, but excessive abort rate and performance cost for read-heavy inventory filters. |
| Serialize all writes through a single queue | Removes concurrency rather than managing it; complicates synchronous REST responses and idempotent error reporting. |
| Application-level `synchronized` blocks | Only works within one JVM instance and would break under horizontal scaling. |
