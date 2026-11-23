# ADR-002: Authentication and Tenancy

**Status:** Accepted (design decision; implementation planned, not yet present).  
**Date:** 2026-11-23  
**Related:** [`../SYSTEM_ARCHITECTURE.md`](../SYSTEM_ARCHITECTURE.md), [`../DOMAIN_MODEL.md`](../DOMAIN_MODEL.md), [`API_CONTRACTS.md`](../API_CONTRACTS.md)

## Context

The contract exposes `/auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/change-password`, `/auth/me`, and protected endpoints gated by permissions such as `INVENTORY_RELEASE`, `REQUEST_APPROVE`, `ALLOCATION_CONFIRM`, `AUDIT_READ`, and `ANALYTICS_READ`. Users belong to one or more organizations with a role per membership. Blood units owned by a bank may be reserved for a hospital request, so tenancy has one deliberate cross-organization path. The UI must not be the enforcement point.

## Decision

- Use **stateless JWT access tokens** plus a **rotating refresh token** stored hashed in the database. Login issues the pair; refresh rotates it; logout revokes it. Passwords are BCrypt hashes.
- Model authorization as **roles (coarse) + permissions (fine-grained)**. Permission names match the API contract exactly. Method security in application services enforces them; controllers never decide access.
- Resolve the active organization from the validated token into `TenantContext` for each request. Every repository query for tenant-owned data adds `organizationId = TenantContext.organizationId()`; service methods compare a resource's owner before mutating it.
- Allow explicit cross-organization behaviour only for the audited allocation workflow: a hospital request may reserve a verified bank's units, and the reservation stores both `requestingOrganizationId` and `supplyingOrganizationId`. `PLATFORM_ADMIN` may read across organizations and verify them but does not bypass state machines.
- Seed five **local-profile-only** demo accounts (see `../user-guide/USER_GUIDE.md`). They are development fixtures and must never exist in a production profile.

## Consequences

**Positive**

- No server-side session store; the monolith can scale horizontally without session affinity.
- Permission names in code, contract, and UI are identical, making reviews and tests straightforward.
- Tenant isolation is enforced in one place (`TenantContext` + repository predicates), reducing the chance of a forgotten filter.
- The cross-tenant exception is explicit, typed, and auditable rather than an accidental wildcard.

**Negative**

- JWT revocation is not immediate for access tokens; short expiry is required.
- Multi-membership users need an explicit active-organization selection in the UI and API.
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
