# Known Limitations

Date: 2026-11-23. Status: current for the implemented Phase 2 local/demo system.
This is the authoritative limitation list. Supporting runs are in
[`TEST_RESULTS.md`](TEST_RESULTS.md) and raw probe results in
[`../evidence/`](../evidence/). **No production-readiness claim is made.**

Status labels: **V** verified by an executed probe · **I** implemented but not
runtime-verified · **N** not implemented · **B** blocked by environment/scope.
Items describe residual limitations even where the related feature is Verified.

## Runtime and security

1. **No MFA.** (N) Login accepts email + password only; no second factor.
2. **No breach-password check.** (N) Basic password validation only; no screening
   against known-compromised password lists.
3. **Logout revocation is process-local.** (I/N) `AuthService.revokeAccessToken`
   stores each logout `jti` in an in-memory map: it is lost on restart and is not
   shared across replicas. The persistent `token_version` in V5 covers password
   changes, lock/disable and re-enable irreversibly, but does **not** make
   per-token logout revocation cluster-wide. Multi-instance deployments need a
   shared denylist or very short access-token TTL.
4. **Rate limiting is single-node.** (I) Auth paths are limited in memory to
   10 attempts / 60 s per IP + account + path (login, register, refresh),
   returning `429 RATE_LIMITED`. No shared store exists, so a multi-instance
   deployment would not share counters.
5. **Lockout is database-local.** (I) Failed-login lockout persists in
   `login_attempts`, but there is no cross-service coordination or
   admin-configurable policy endpoint.
6. **No TLS in the local stack.** (N) Compose binds HTTP ports to `127.0.0.1`;
   production TLS termination, certificates, and secret management are not
   configured.
7. **No production secrets management.** (N) `JWT_SECRET` must be supplied
   externally and fails fast when absent in non-test profiles; no vault/KMS
   integration, rotation schedule, or committed fallback exists.
8. **No image pinning.** (N) Compose builds `:dev` images from source rather than
   pinning immutable digests; no SBOM or supply-chain signing is present.
9. **UI enforcement is cosmetic.** (I) React permission checks hide controls;
   the backend is authoritative. This is intentional, not client-side security.

## Tenancy and audit

10. **Organization header is per-request.** (I) `X-Organization-Id` is validated
    against memberships by `TenantAccessService`; it is not a token claim.
    Analytics now uses that validated header (platform admins may omit it for a
    global view), but callers must still send it when switching scope.
11. **No audit retention or tamper evidence.** (N) `audit_events` is append-only
    in practice (save/query only): no archival, deletion schedule, hashing, or
    tamper-evidence chain.
12. **Correlation ids are request-scoped.** (I) They link responses, errors,
    logs, audit rows, and outbox events but are not distributed trace ids.

## Notifications and WebSocket

13. **Live broker path is verified, SPA integration is not.** (V + I) The
    authenticated SockJS/websocket handshake, own-queue `SUBSCRIBE`, and delivered
    notification are recorded in
    [STOMP_SMOKE_RESULT.json](../evidence/STOMP_SMOKE_RESULT.json). The SPA itself
    uses REST polling and has no live STOMP client, so browser-side integration
    is not verified.
14. **No client→server STOMP messaging.** (N) `SEND` frames are rejected because
    there are no `@MessageMapping` handlers; notifications are one-way
    (server→client) and the REST inbox remains the reliable fallback.
15. **Outbox is narrow.** (I/N) `outbox_events` carries `notification.created`
    intents only — no generic domain-event bus, no `SKIP LOCKED` claim, no
    `(userId,eventId)` deduplication constraint, no per-aggregate ordering, and
    no exported lag metrics. There is no distributed lease for stranded
    `PROCESSING` rows.
16. **Cross-tab refresh coordination not runtime-verified.** (I) The frontend
    uses a single-flight refresh promise in one tab; multiple tabs sharing
    `sessionStorage` are not covered by a recorded test.

## Data, concurrency, and operations

17. **H2 is the fast-test database.** (V + I) Flyway `V1`–`V5` are validated by
    Hibernate in the H2 integration run, Testcontainers PostgreSQL 16 covers
    contention, and the Compose `postgres` profile was probed live
    ([COMPOSE_VERIFICATION.json](../evidence/COMPOSE_VERIFICATION.json)). None of
    this is a substitute for production-scale PostgreSQL tuning.
18. **No automatic optimistic-retry loop.** (I) Stale writes and lock races
    surface as `409 CONCURRENCY_CONFLICT`; clients must retry, and callers that
    ignore 409 will lose the operation.
19. **Idempotency records are not garbage-collected.** (N) `idempotency_records`
    and completed outbox rows grow without a retention job. Keys are capped at
    120 characters, but there is no expiry policy.
20. **Storage location on a unit is free text.** (I) `BloodUnit.storageLocation`
    is a string; `storage_locations` is reference data, not a foreign key.
21. **No load, soak, penetration, or backup/restore tests.** (N) Performance,
    failure-recovery, and security-resilience characteristics are unknown.
22. **No CI execution.** (B) Root `.github/workflows` is outside the permitted
    edit scope; `project/deployment/github-actions.yml` is a template and has not
    run. GitHub CLI 2.97.0 is installed but no Actions workflow was executed.
23. **E2E coverage is narrow.** (V + I) 3 scenarios passed on Chrome and Edge
    ([PLAYWRIGHT_RESULTS.json](../evidence/PLAYWRIGHT_RESULTS.json)); there are no
    visual snapshot baselines, full-workflow browser journeys, or a wider
    browser/device matrix.
24. **Historical review records are intentionally dated.** (I)
    [`FINAL_INDEPENDENT_REVIEW.md`](../reviews/FINAL_INDEPENDENT_REVIEW.md) and
    [`PHASE_2_GAP_ANALYSIS.md`](../reviews/PHASE_2_GAP_ANALYSIS.md) preserve
    pre-fix counts and verdicts with dated supersession notes. They are not
    current status; this file, [`TEST_RESULTS.md`](TEST_RESULTS.md),
    [`PHASE_2_FINAL_REVIEW.md`](../reviews/PHASE_2_FINAL_REVIEW.md), and the
    linked JSON evidence are authoritative.

## Design deviations from the original academic plan

25. **Flat packages.** (I) Modules are flat `com.lifelink.<module>` packages, not
    `api`/`application`/`domain`/`infrastructure` sub-packages.
26. **No typed identifiers.** (I) Entity ids are `Long` with a separate public
    `publicId` string; no typed-id wrapper classes exist.
27. **Framework-coupled domain.** (I) Entities carry JPA annotations; there is no
    framework-free domain layer, ArchUnit suite, or reflection test asserting
    `final` classes / no setters.
28. **Narrow design patterns.** (I) Real `AllocationStrategy`, `FeefoStrategy`,
    and specification classes exist, but there is no `BloodUnitFactory`, no
    Template Method hierarchy, and no generic observer bus beyond the outbox.
29. **Historical docs superseded.** (I) The proposal and initial audit are
    preserved as dated baselines; their "planned/no implementation" statements
    are not current. See
    [`../proposal/PROJECT_PROPOSAL.md`](../proposal/PROJECT_PROPOSAL.md) and
    [`../audit/INITIAL_REPOSITORY_AUDIT.md`](../audit/INITIAL_REPOSITORY_AUDIT.md).
