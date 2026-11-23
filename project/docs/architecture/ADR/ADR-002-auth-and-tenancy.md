# ADR-002: Authentication and Tenancy

**Status:** Accepted; implemented in Phase 2 (2026-11-23) with the final audit-fix status and deviations noted below. No production-readiness claim.
**Date:** 2026-11-23 (implementation and final audit-fix reconciliation)
**Related:** [`../SYSTEM_ARCHITECTURE.md`](../SYSTEM_ARCHITECTURE.md), [`../DOMAIN_MODEL.md`](../DOMAIN_MODEL.md), [`API_CONTRACTS.md`](../API_CONTRACTS.md)

## Context

The contract exposes `/auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/change-password`, `/auth/me`, and protected endpoints gated by permissions such as `INVENTORY_RELEASE`, `REQUEST_APPROVE`, `ALLOCATION_CONFIRM`, `AUDIT_READ`, and `ANALYTICS_READ`. Users belong to one or more organizations with a role per membership. Blood units owned by a bank may be reserved for a hospital request, so tenancy has one deliberate cross-organization path. The UI must not be the enforcement point.

## Decision

- Use **stateless JWT access tokens** plus a **rotating refresh token** stored hashed in the database. Login issues the pair; refresh rotates it; logout revokes it. Passwords are BCrypt hashes.
- Model authorization as **roles (coarse) + permissions (fine-grained)**. Permission names match the API contract exactly. Method security in application services enforces them; controllers never decide access.
- Resolve the selected organization from the validated `X-Organization-Id` header with `TenantAccessService`, cached in request attributes. Service methods compare the caller's memberships and resource owner before returning or mutating data; there is no global `TenantContext` class.
- Allow explicit cross-organization behaviour only for the audited allocation workflow: a hospital request may reserve a verified bank's units. `Reservation` links the request and the supplying organization; dispatch creation is authorized in the supplying bank. `PLATFORM_ADMIN` may select any organization and read globally but does not bypass state machines.
- Seed six **local/demo-profile** accounts (see `../user-guide/USER_GUIDE.md`). They are development fixtures controlled by `lifelink.seed.enabled` / `SEED_DEMO_DATA`: the Compose demo sets `SEED_DEMO_DATA=true`, while standalone PostgreSQL defaults to no demo seed. They must never be enabled in a production profile.

## Implementation status (2026-11-23)

- Implemented: JWT access tokens with unique `jti` and `token_version`. `V5` stores a persistent monotonic `users.token_version`; password change and every status transition increment it, so lock/disable/re-enable permanently revoke older access tokens. Refresh tokens rotate with replay detection; passwords are BCrypt hashes; role/permission enums and method security are in place.
- Implemented (`F-04`, process-local): `POST /auth/logout` revokes the presented refresh token and adds the presented bearer `jti` to an **in-memory, process-local denylist** until its natural expiry. A logout handled by one backend instance is not visible to other instances; multi-instance deployments require a shared revocation store. Persistent `token_version` revocation is database-backed and is not process-local.
- Implemented: failed-login lockout persisted in `login_attempts` (5 failures / 15 minutes) and in-memory counting of auth-path 401 responses (10 attempts / 60 s per IP + account + path), after which the next attempt returns `429 RATE_LIMITED`. Single-node only.
- Implemented (`F-02`): all `/api/v1/analytics/*` endpoints resolve organization scope through `TenantAccessService`. Platform admins may omit `X-Organization-Id` for a global view or send it to scope one organization; non-admins with one membership are implicitly scoped, multiple memberships require explicit selection, and a header outside memberships yields `403 TENANT_ACCESS_DENIED`. The SPA's `AnalyticsPage` provides a platform-admin Organization scope select with a per-request override and scoped query keys.
- Implemented: fail-fast `JWT_SECRET` validation in non-test profiles (missing, <32 bytes, or test-only key prevents startup); CORS allowlist from `CORS_ALLOWED_ORIGINS` with validated headers `Authorization`, `Content-Type`, `X-Correlation-Id`, `Idempotency-Key`, `X-Organization-Id` and `allowCredentials=false`.
- Deviated from the original design: no server-side `TenantContext`, organization selection is an optional header rather than a token claim, and both the auth rate limiter and the logout `jti` denylist are process-local (no shared store).
- Verified 2026-11-23: Compose services healthy, backend health HTTP 200 with liveness/readiness, frontend health HTTP 200, login through nginx proxy HTTP 200, Flyway V1–V5 success, and seed counts organizations=2/users=6/blood_units=9. Live SockJS/STOMP smoke passed through the nginx proxy using a standalone Node client (`CONNECTED`, `MESSAGE`); there is no SPA STOMP client.
- Not implemented: MFA, breach-password checks, TLS in the local Compose stack, or production secrets management. CI is documented as a deployment step only and has not run.

## Consequences

**Positive**

- No server-side HTTP session; persistent token-version revocation and database-backed refresh tokens do not require session affinity. The process-local logout `jti` denylist and rate limiter are the exceptions.
- Permission names in code, contract, and UI are identical, making reviews and tests straightforward.
- Tenant isolation is enforced through `TenantAccessService` plus service/repository predicates, reducing the chance of a forgotten filter. There is no global `TenantContext` class.
- The cross-tenant exception is explicit, typed, and auditable rather than an accidental wildcard.

**Negative**

- Logout revocation of an individual `jti` is immediate only in the handling process; short access-token expiry and a shared store are needed for multi-instance logout. Credential/status revocation, by contrast, is immediate and durable via `token_version`.
- Multi-membership users need an explicit active-organization selection in the UI and API, including the analytics scope select for platform admins.
- Every new endpoint must consciously add permission and tenant checks; architecture tests and API slice tests must enforce this discipline.
- Refresh-token rotation adds replay-detection logic and a database lookup on refresh.

## Alternatives

| Alternative | Why not chosen |
| :--- | :--- |
| Server-side sessions with cookies | Simpler revocation but requires shared session state and CSRF handling; conflicts with the stateless deployment goal. |
| External OAuth2/OIDC identity provider | Realistic in production but adds infrastructure and credentials outside the course scope; would obscure the local demo walkthrough. |
| Database row-level security only | Good defence in depth, but not portable to the H2 test profile and insufficient for command-level permission checks. |
| Role checks only, no permissions | Cannot express the fine-grained contract gates such as `INVENTORY_RELEASE` without adding new roles for every action. |
| Trust the frontend role checks | Explicitly unsafe; the contract states UI permission checks are cosmetic. |
