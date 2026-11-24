# LifeLink API Contracts (v1)

**Implementation status (24 November 2026):** this contract describes the running
Spring Boot 3.5.16 backend on `feature/lifelink-bloodstream-experience`, based on HEAD
`59401d45e511183ede59e7d55073f07e2cf5eacd`. Current changes are uncommitted; nothing was
pushed. Historical Phase 2 records from `feature/lifelink-enterprise-platform` and baseline
HEAD `195e88a` are preserved elsewhere and are not current. Paths, DTO fields, enum values,
headers, and error codes below are taken from controllers, DTOs, entities, migrations
`V1`–`V5`, and security configuration in `project/backend/`. Where older documents disagree,
this file is authoritative for external behaviour, with the current reconciliation in
[`../reviews/CURRENT_STATE_ENGINEERING_AND_DESIGN_AUDIT.md`](../reviews/CURRENT_STATE_ENGINEERING_AND_DESIGN_AUDIT.md).
`V5` adds `users.token_version`; the persistent monotonic version makes lock, disable, and
re-enable permanently revoke older access tokens. This is a local development / supervised
demo contract, not a production-readiness claim.

Base path: `/api/v1`. JSON request/response bodies. Timestamps are ISO-8601 UTC.

## Envelopes and list shapes

```ts
type ApiResponse<T> = {
  success: boolean;
  data: T;              // null for void endpoints
  message?: string;
  correlationId: string;
  timestamp: string;
};

type PageResponse<T> = {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
};

type ApiErrorBody = {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, string>;
    correlationId: string;
  };
  timestamp: string;
};
```

Most list endpoints return `PageResponse<T>`. The following return plain arrays
inside `ApiResponse`: `GET /donors`, `/donors/{id}/consents`,
`/donors/{id}/appointments`, `/donations`, `/donations/{id}/units`,
`/emergency-requests`, `/organizations/{id}/members`, `/inventory/{id}/movements`,
`/reservations`, and `/dispatches`.

## Cross-cutting rules

### Authentication and token revocation

- Send `Authorization: Bearer <accessToken>` on every protected endpoint.
- Access tokens are HS256 JWTs with `iss=lifelink`, `aud=lifelink-api`,
  `sub=<email>`, `uid=<numeric user id>`, `roles=[...]`, a unique `jti`, and
  `token_version`. They expire after `JWT_ACCESS_MINUTES` (15 by default).
- The current `token_version` and user status are reloaded on each request.
  Password change and any status transition (lock, disable, re-enable) increment
  the persistent `users.token_version` (`V5`), so older access tokens stay
  revoked even after an account is re-enabled. Invalid, expired,
  wrong-issuer/audience, stale-version, or disabled principal tokens return
  `401 TOKEN_INVALID`.
- `POST /auth/logout` revokes the supplied refresh token and denies the
  **presented bearer `jti` in the process that handled the request only**
  (`F-04`). This denylist is process-local and in memory; a multi-instance
  deployment needs a shared revocation store (or a very short access-token TTL
  plus coordinated logout). It is not a durable, cluster-wide logout.
- `JWT_SECRET` is required in every non-test profile; there is no committed
  fallback signing key. Startup fails fast on a missing secret, a key shorter
  than 32 bytes, or the test-only key outside the `test` profile.
  Login/register/refresh **401 responses** are counted by an in-memory limiter
  per IP + account + path (10 attempts / 60 seconds by default); the next
  attempt returns `429 RATE_LIMITED`. This limiter is single-node only. Failed
  logins also persist account lockout (5 failures, 15 minutes) in
  `login_attempts`.

### Organization selection (`X-Organization-Id`)

- `X-Organization-Id` is **optional**, must be a positive numeric organization
  id, and is only a *selection*. `TenantAccessService` validates it against the
  authenticated user's memberships (platform admins may select any id), caches
  the result in request attributes, and never bypasses permission checks.
- A non-platform user with exactly one membership gets that organization by
  default; multi-membership and platform-admin callers have no implicit default
  for organization-scoped reads and must select explicitly where required.
- Invalid or non-member ids produce `400 VALIDATION_ERROR` (malformed) or
  `403 TENANT_ACCESS_DENIED` (not a membership).
- The SPA sends the header on every API call when an organization is selected
  and clears React Query caches on organization switch. On login it restores
  only a previously valid explicit selection; otherwise it sends no header and
  lets the backend apply its single-membership default. It never silently
  selects a first membership.

**Analytics scoping (`F-02`):** all three `/api/v1/analytics/*` endpoints resolve
scope through `TenantAccessService`, never through an unverified client value.
A platform admin may omit the header for a global view or send it to scope all
metrics to one organization; a non-admin with one membership is implicitly
scoped to it; a non-admin with multiple memberships must select one; and a
header outside the caller's memberships yields `403 TENANT_ACCESS_DENIED`.
`AnalyticsPage` adds an **Organization scope** select for platform admins and
passes a per-request `organizationId` override; query keys include the scope so
cached results cannot leak across selections.

### Idempotency

`Idempotency-Key` participates in allocation confirmation, reservation
creation, and dispatch creation. Canonical state lives in the V4
`idempotency_records` table: `(scope, key)` is unique, with a SHA-256 request
fingerprint and the stored serialized response. Replaying the same key and
fingerprint returns the original response without new side effects. Reusing a
key with a different fingerprint is a `409 BUSINESS_RULE_VIOLATION`; a claim
still in progress or lost under contention is `409 CONCURRENCY_CONFLICT`.
Header/body divergence is rejected up front with `400 VALIDATION_ERROR`.
Every client-supplied key is limited to **120 characters** (`F-05`): reservation
body `idempotencyKey` uses `@Size(max = 120)`, and allocation/dispatch
`Idempotency-Key` headers are validated in the controller before any
transactional work. An overlong header or body key returns `400 VALIDATION_ERROR`
immediately. A missing/blank dispatch header or allocation key is rejected by
the service as `409 BUSINESS_RULE_VIOLATION`; a blank reservation body key fails
`@NotBlank` with `400 VALIDATION_ERROR`.

| Operation | Key source | Fingerprint inputs |
| :--- | :--- | :--- |
| `POST /allocations/confirm` | `Idempotency-Key` header or body `idempotencyKey` (both are capped at 120; if both are present they must match) | `requestId` + sorted distinct `unitIds` |
| `POST /reservations` | body `idempotencyKey` (required, 1–120 characters) | `unitId` + `requestId` |
| `POST /dispatches` | `Idempotency-Key` header (required, max 120; missing/blank is `409 BUSINESS_RULE_VIOLATION`, overlong is `400 VALIDATION_ERROR`) | `reservationId` + `assignedStaff` |

### Errors and transport

- Error codes: `VALIDATION_ERROR` (400), `AUTHENTICATION_REQUIRED`,
  `AUTHENTICATION_FAILED`, `TOKEN_INVALID` (401), `UNAUTHORIZED_OPERATION`,
  `TENANT_ACCESS_DENIED` (403), `RESOURCE_NOT_FOUND` (404),
  `BUSINESS_RULE_VIOLATION`, `INVALID_STATE_TRANSITION`,
  `INSUFFICIENT_INVENTORY`, `CONCURRENCY_CONFLICT` (409), `RATE_LIMITED` (429),
  `INTERNAL_ERROR` (500).
- `DataIntegrityViolationException`, optimistic-locking failures, lock
  acquisition failures, and query timeouts are mapped centrally to
  `409 CONCURRENCY_CONFLICT`; malformed bodies and invalid DTO/query values map
  to `400 VALIDATION_ERROR`. Error responses never include stack traces, SQL,
  tokens, or credentials.
- CORS origins come from `CORS_ALLOWED_ORIGINS` (backend default
  `http://localhost:5173`; Compose derives both loopback origins from
  `FRONTEND_PORT`, by default `15173`). Validated request header names are `Authorization`,
  `Content-Type`, `X-Correlation-Id`, `Idempotency-Key`, and
  `X-Organization-Id`; `X-Correlation-Id` is exposed, credentials are not
  allowed, and preflight is cached for one hour.
- Authorization is enforced server-side, including organization scope; UI
  checks only hide controls. Page sizes are capped (users/organizations 100,
  audit 200).

## Authentication and identity

| Method | Path | Auth | Request | Response data |
| :--- | :--- | :--- | :--- | :--- |
| POST | `/auth/register` | public | `{email,password,fullName,phone?}` | `AuthResponse` (new `DONOR` account) |
| POST | `/auth/login` | public | `{email,password}` | `AuthResponse` |
| POST | `/auth/refresh` | public | `{refreshToken}` | `AuthResponse` (rotated) |
| POST | `/auth/logout` | bearer | `{refreshToken?}` | `null` |
| POST | `/auth/change-password` | bearer | `{currentPassword,newPassword}` | `null` |
| GET | `/auth/me` | bearer | — | `UserView` |
| GET | `/users` | scoped `USER_READ` | `page,size,sort,search` | `PageResponse<UserView>` |
| PATCH | `/users/{id}/status` | scoped `USER_MANAGE` | `{status}` | `UserView` |

```ts
type Role = 'PLATFORM_ADMIN'|'BLOOD_BANK_ADMIN'|'INVENTORY_MANAGER'|'HOSPITAL_ADMIN'|'MEDICAL_STAFF'|'DONOR';
type AuthResponse = {
  accessToken: string; refreshToken: string; expiresIn: number; user: UserView;
};
type UserView = {
  id: number; publicId: string; email: string; fullName: string;
  status: 'ACTIVE'|'PENDING_VERIFICATION'|'LOCKED'|'DISABLED';
  roles: Role[]; permissions: string[];
  memberships: Array<{organizationId:number; organizationName:string; role:Role}>;
};
```

Registration always creates a `DONOR` account; organization membership is added
by an administrator via `POST /organizations/{id}/members`. Membership grants
organization-scoped permissions without changing global roles. Passwords must
be 10–72 characters. Refresh tokens rotate on every use and replay revokes the
whole token family. `GET /users` and `PATCH /users/{id}/status` are global for
platform admins; non-platform admins see and change only users in organizations
where they hold `USER_READ`/`USER_MANAGE`, and cannot manage global accounts.
Any status transition (lock, disable, or re-enable) increments the persistent
token version and revokes older tokens.

## Organizations

| Method | Path | Auth | Response data |
| :--- | :--- | :--- | :--- |
| GET | `/organizations` | `ORGANIZATION_READ` | `PageResponse<OrganizationView>` |
| POST | `/organizations` | `ORGANIZATION_MANAGE` | `OrganizationView` |
| GET | `/organizations/{id}` | `ORGANIZATION_READ` + member/admin | `OrganizationView` |
| PATCH | `/organizations/{id}` | `ORGANIZATION_MANAGE` | `OrganizationView` |
| POST | `/organizations/{id}/verify` | `ORGANIZATION_MANAGE` | `OrganizationView` |
| GET | `/organizations/{id}/members` | `ORGANIZATION_READ` + member/admin | `UserView[]` |
| POST | `/organizations/{id}/members` | `ORGANIZATION_MANAGE` | `null`; body `{userId,role}` |

```ts
type OrganizationView = {
  id:number; publicId:string; name:string; type:'BLOOD_BANK'|'HOSPITAL';
  registrationCode:string; city:string; state:string; contactEmail:string;
  phone:string; verified:boolean; active:boolean; serviceArea?:string;
};
```

## Donors and donations

| Method | Path | Auth | Request / purpose |
| :--- | :--- | :--- | :--- |
| GET | `/donors` | donor self or scoped `DONOR_READ` | `ProfileView[]` |
| POST | `/donors` | bearer | `{userId,bloodGroup,dateOfBirth,address?,city?,state?,preferredContact?}` |
| GET/PATCH | `/donors/{id}` | owner or scoped `DONOR_READ` | profile / allowed profile edits |
| GET/POST | `/donors/{id}/consents` | owner or scoped staff | `ConsentView[]` / `{type,granted}` |
| PATCH | `/donors/{id}/consents/{consentId}` | owner or scoped staff | withdraw |
| GET/POST | `/donors/{id}/appointments` | owner or scoped staff | `AppointmentView[]` / `{organizationId,scheduledAt,notes?}` |
| PATCH | `/donors/appointments/{id}` | scoped staff | `{action,notes?}` |
| GET | `/donations` | scoped `DONATION_READ` | `?donorId=&organizationId=` → `DonationView[]` |
| POST | `/donations` | scoped `DONATION_RECORD` | `{donorId,organizationId,appointmentId?,donatedAt?,notes?}` |
| GET | `/donations/{id}` | scoped `DONATION_READ` | `DonationView` |
| POST | `/donations/{id}/screen` | scoped `SCREENING_REVIEW` | `{passed,notes?}` |
| POST | `/donations/{id}/approve` | scoped `DONATION_APPROVE` | `{components:ComponentType[]}`; creates quarantined units |
| POST | `/donations/{id}/reject` | scoped `DONATION_APPROVE` | `{reason}` |
| GET | `/donations/{id}/units` | scoped `DONATION_READ` | `BloodUnitView[]` |

Donor PII and donation lists are filtered by ownership or organization
membership. Donation creation validates that the donor belongs to the recording
organization and that an optional appointment belongs to the same donor and
organization; a cancelled/rejected appointment cannot be donated against.

Donation status values are `RECORDED`, `SCREENED`, `APPROVED`, `REJECTED`.
A passing screening moves `RECORDED → SCREENED`; a failing screening moves
`RECORDED → REJECTED`. Approval requires a stored passing screening.

## Inventory

| Method | Path | Auth | Purpose |
| :--- | :--- | :--- | :--- |
| GET | `/inventory` | `INVENTORY_READ` | `PageResponse<BloodUnitView>`; filters `bloodGroup,componentType,status,expiringWithinDays,organizationId,page,size,sort` |
| POST | `/inventory` | `INVENTORY_WRITE` | `{organizationId,unitNumber,bloodGroup,componentType,collectedAt,expiresAt?,storageLocation}` |
| GET | `/inventory/{id}` | `INVENTORY_READ` | `BloodUnitView` |
| POST | `/inventory/{id}/release` | `INVENTORY_RELEASE` | Release a quarantined/screening/collected unit to `AVAILABLE` |
| POST | `/inventory/{id}/expire` | `INVENTORY_WRITE` | Mark expired |
| POST | `/inventory/adjustments` | `INVENTORY_WRITE` | `{unitId,delta?,reason,location?}` |
| GET | `/inventory/{id}/movements` | `INVENTORY_READ` | `InventoryMovement[]` |
| GET | `/inventory/alerts` | `INVENTORY_READ` | Low-stock and expiring summaries |

```ts
type BloodGroup = 'A_POSITIVE'|'A_NEGATIVE'|'B_POSITIVE'|'B_NEGATIVE'|'AB_POSITIVE'|'AB_NEGATIVE'|'O_POSITIVE'|'O_NEGATIVE';
type ComponentType = 'WHOLE_BLOOD'|'RED_CELLS'|'PLASMA'|'PLATELETS'|'CRYOPRECIPITATE';
type UnitStatus = 'COLLECTED'|'SCREENING'|'QUARANTINED'|'AVAILABLE'|'RESERVED'|'DISPATCHED'|'DELIVERED'|'EXPIRED'|'DISCARDED';
type BloodUnitView = {
  id:number; publicId:string; unitNumber:string; bloodGroup:BloodGroup;
  componentType:ComponentType; status:UnitStatus; released:boolean;
  collectedAt:string; expiresAt:string; storageLocation:string;
  organizationId:number; donationId?:number; version:number;
};
// activeReservationId is an internal BloodUnit field used by repository locks
// and the one-active-reservation constraint; it is not exposed in InventoryDtos.View.
```

## Emergency requests, allocation, reservations, dispatch

| Method | Path | Auth | Request / purpose |
| :--- | :--- | :--- | :--- |
| GET | `/emergency-requests` | `REQUEST_READ` | `?status=` → `RequestView[]` |
| POST | `/emergency-requests` | `REQUEST_CREATE` | `{organizationId,patientRef?,bloodGroup,componentType,quantity,priority?,requiredBy,reason?}` |
| GET | `/emergency-requests/{id}` | `REQUEST_READ` | `{request,events[]}` |
| POST | `/emergency-requests/{id}/verify` | `REQUEST_APPROVE` | no body |
| POST | `/emergency-requests/{id}/approve` | `REQUEST_APPROVE` | no body |
| POST | `/emergency-requests/{id}/reject` | `REQUEST_APPROVE` | `{reason}` |
| POST | `/emergency-requests/{id}/cancel` | `REQUEST_CREATE` or `REQUEST_APPROVE` in the request organization | `{reason}` |
| PATCH | `/emergency-requests/{id}/priority` | `REQUEST_APPROVE` | `{priority}` |
| POST | `/allocations/suggestions` | `ALLOCATION_REVIEW` | `{requestId}` → advisory candidates |
| POST | `/allocations/confirm` | `ALLOCATION_CONFIRM` | `Idempotency-Key` header or body key + `{requestId,unitIds[],idempotencyKey}` → reservations |
| GET | `/reservations` | scoped `RESERVATION_READ` | `ReservationView[]` |
| GET | `/reservations/{id}` | scoped `RESERVATION_READ` | `ReservationView` |
| POST | `/reservations` | scoped `RESERVATION_CREATE` | `{unitId,requestId,idempotencyKey}` |
| POST | `/reservations/{id}/confirm` | scoped `RESERVATION_CONFIRM` | no body |
| POST | `/reservations/{id}/cancel` | scoped `RESERVATION_CREATE` | release unit |
| GET | `/dispatches` | scoped `DISPATCH_READ` | `DispatchView[]` |
| GET | `/dispatches/{id}` | scoped `DISPATCH_READ` | `DispatchView` |
| POST | `/dispatches` | blood-bank `DISPATCH_CREATE` in the **supplying** organization | `Idempotency-Key` header + `{reservationId,assignedStaff}` |
| POST | `/dispatches/{id}/depart` | scoped `DISPATCH_MANAGE` | no body |
| POST | `/dispatches/{id}/deliver` | scoped `DISPATCH_MANAGE` | `{recipientName}` |
| POST | `/dispatches/{id}/incident` | scoped `DISPATCH_MANAGE` | `{description}` |

```ts
type RequestStatus = 'DRAFT'|'PENDING_VERIFICATION'|'VERIFIED'|'APPROVED'|'ALLOCATING'|'RESERVED'|'IN_TRANSIT'|'FULFILLED'|'REJECTED'|'CANCELLED'|'EXPIRED';
type ReservationStatus = 'ACTIVE'|'CONFIRMED'|'CANCELLED'|'EXPIRED';
type DispatchStatus = 'PREPARING'|'IN_TRANSIT'|'DELIVERED'|'INCIDENT';
type Priority = 'ROUTINE'|'URGENT'|'CRITICAL';
```

New requests start at `PENDING_VERIFICATION`; verification precedes approval.
Allocation confirmation accepts `APPROVED` or `ALLOCATING` requests, requires
exactly `quantity` distinct units, and locks units in ascending id order.
Reservations start `ACTIVE` and are confirmed by hospital or bank staff.
Dispatch creation is deliberately a **blood-bank** action authorised against
the supplying organization (`BLOOD_BANK_ADMIN` or `INVENTORY_MANAGER`); hospital
membership alone never grants it. Depart/deliver/incident require
`DISPATCH_MANAGE` for the dispatch organization. An incident can still be
recovery-delivered.

## Notifications, audit, analytics

| Method | Path | Auth | Response data |
| :--- | :--- | :--- | :--- |
| GET | `/notifications` | bearer | `PageResponse<NotificationView>` for current user |
| GET | `/notifications/unread-count` | bearer | `{count:number}` — the key is `count`, not `unread` |
| POST | `/notifications/{id}/read` | bearer, owner only | `null` |
| GET | `/audit-logs` | scoped `AUDIT_READ` | `PageResponse<AuditEvent>` with `organizationId,actorId,action,from,to,outcome,page,size` filters |
| GET | `/analytics/overview` | `ANALYTICS_READ` + validated scope | scoped `Overview` counts |
| GET | `/analytics/inventory` | `ANALYTICS_READ` + validated scope | `Map<string, number>` by blood-group enum name (zero-filled) |
| GET | `/analytics/requests` | `ANALYTICS_READ` + validated scope | `Map<string, number>` by request-status enum name |

`Overview` has exactly these fields: `availableUnits`, `reservedUnits`,
`quarantinedUnits`, `expiringWithin7Days`, `pendingRequests`,
`activeReservations`, `dispatchesInTransit`, `organizations`. These are the only
three analytics endpoints; there is no `/analytics/donations` or
`/analytics/activities`. All three use the `X-Organization-Id` rules described
above (`F-02`).

Audit queries require an explicit `organizationId` query parameter for non-platform users with
multiple memberships and check `AUDIT_READ` **for that organization**;
`from`/`to` must be valid ISO-8601 instants. `AUDIT_READ` in an unrelated
membership does not grant access. Platform admins may omit `organizationId` for
a cross-organization query. `SUCCESS` audit rows are written inside the
business transaction, so they cannot survive its rollback.

## WebSocket notifications

Connect to `/ws` (SockJS/STOMP); the nginx image also proxies `/ws/` and
`/sockjs/`. Every STOMP `CONNECT` must carry a JWT prefixed with `Bearer ` in
the native `Authorization` header (preferred) or, as a fallback, in a STOMP
header / `passcode` / `login` field. A raw token or raw passcode without the
`Bearer ` prefix is rejected. Disabled users and invalid, expired, revoked, or
stale-version tokens are rejected.

- `SUBSCRIBE` is limited to `/user/queue/notifications` or the caller's own
  `/user/<email>/queue/...` destination and requires `NOTIFICATION_READ`.
- `SEND` frames are rejected for every destination: the allowed application
  destination set is empty because no `@MessageMapping` handlers are registered.
  Broker failures use generic STOMP error messages; internal reasons are not
  exposed to clients.
- In-app notifications are published with
  `convertAndSendToUser(<email>, "/queue/notifications", event)`.

**Verified evidence:** interceptor behaviour is covered by unit tests. A standalone
SockJS/STOMP smoke test passed through the Compose frontend nginx proxy at
`http://127.0.0.1:15173` with an authenticated `CONNECT`, a personal-queue
`SUBSCRIBE`, and a delivered `MESSAGE` ([`../evidence/STOMP_SMOKE_RESULT.json`](../evidence/STOMP_SMOKE_RESULT.json)).
The SPA now also opens an authenticated SockJS bridge through `/ws` and subscribes to
`/user/queue/notifications`; browser capture recorded a CONNECT frame carrying the bearer
token and a CONNECTED frame ([`../evidence/BROWSER_STOMP_RESULT.json`](../evidence/BROWSER_STOMP_RESULT.json)).
STOMP events invalidate React Query caches only. The REST inbox is authoritative and
polling remains the fallback when no socket connects; the standalone capture recorded zero
REST polls in its focused window, while the Playwright suite separately verifies polling.
