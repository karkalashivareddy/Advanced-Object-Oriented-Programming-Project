# LifeLink API Contracts (v1)

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

Most list endpoints return `PageResponse<T>`; the following return a plain
`T[]` inside `ApiResponse`: `GET /donors`, `/donors/{id}/consents`,
`/donors/{id}/appointments`, `/donations`, `/donations/{id}/units`,
`/emergency-requests`, `/organizations/{id}/members`, `/inventory/{id}/movements`,
`/reservations`, and `/dispatches`.

## Cross-cutting rules

- Send `Authorization: Bearer <accessToken>` on every protected endpoint.
- Access tokens are JWTs signed with `HS256`, include `iss=lifelink`,
  `aud=lifelink-api`, `sub=<email>`, and `uid=<numeric user id>`, and expire
  after `JWT_ACCESS_MINUTES` (15 by default). Invalid, expired, or
  wrong-issuer/audience tokens return `401 TOKEN_INVALID`.
- `Idempotency-Key` is required on allocation confirmation, reservation
  creation, and dispatch creation. Reusing a key for a different payload is a
  conflict; replaying the same payload returns the original resource.
- Authorization is enforced server-side, including organization scope. UI
  permission checks only hide controls.
- Error codes: `VALIDATION_ERROR` (400), `AUTHENTICATION_REQUIRED`,
  `AUTHENTICATION_FAILED`, `TOKEN_INVALID` (401), `UNAUTHORIZED_OPERATION`,
  `TENANT_ACCESS_DENIED` (403), `RESOURCE_NOT_FOUND` (404),
  `BUSINESS_RULE_VIOLATION`, `INVALID_STATE_TRANSITION`,
  `INSUFFICIENT_INVENTORY`, `CONCURRENCY_CONFLICT` (409), `RATE_LIMITED` (429),
  `INTERNAL_ERROR` (500).

## Authentication and identity

| Method | Path | Auth | Request | Response data |
| :--- | :--- | :--- | :--- | :--- |
| POST | `/auth/register` | public | `{email,password,fullName,phone?}` | `AuthResponse` |
| POST | `/auth/login` | public | `{email,password}` | `AuthResponse` |
| POST | `/auth/refresh` | public | `{refreshToken}` | `AuthResponse` (rotated) |
| POST | `/auth/logout` | bearer | `{refreshToken?}` | `null` |
| POST | `/auth/change-password` | bearer | `{currentPassword,newPassword}` | `null` |
| GET | `/auth/me` | bearer | — | `UserView` |
| GET | `/users` | `USER_READ` | `page,size,sort,search` | `PageResponse<UserView>` |
| PATCH | `/users/{id}/status` | `USER_MANAGE` | `{status}` | `UserView` |

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

Registration always creates a `DONOR` account. Organization membership is
added separately by an administrator through `POST /organizations/{id}/members`;
membership grants organization-scoped permissions without changing global roles.
Passwords must be 10–72 characters. Refresh tokens rotate on every use; replay
revokes the whole token family. Disabled accounts are rejected on both access
and refresh requests.

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
| GET/PATCH | `/donors/{id}` | owner or scoped `DONOR_READ` | profile / `{address?,city?,state?,preferredContact?,availability?}` |
| GET/POST | `/donors/{id}/consents` | owner or scoped staff | `ConsentView[]` / `{type,granted}` |
| PATCH | `/donors/{id}/consents/{consentId}` | owner or scoped staff | withdraw |
| GET/POST | `/donors/{id}/appointments` | owner or scoped staff | `AppointmentView[]` / `{organizationId,scheduledAt,notes?}` |
| PATCH | `/donors/appointments/{id}` | scoped staff | `{action,notes?}` |
| GET | `/donations` | scoped `DONATION_READ` | `?donorId=&organizationId=` → `DonationView[]` |
| POST | `/donations` | scoped `DONATION_RECORD` | `{donorId,organizationId,appointmentId?,donatedAt?,notes?}` |
| GET | `/donations/{id}` | scoped `DONATION_READ` | `DonationView` |
| POST | `/donations/{id}/screen` | scoped `SCREENING_REVIEW` | `{passed,notes?}` |
| POST | `/donations/{id}/approve` | scoped `DONATION_APPROVE` | `{components:ComponentType[]}`; creates units |
| POST | `/donations/{id}/reject` | scoped `DONATION_APPROVE` | `{reason}` |
| GET | `/donations/{id}/units` | scoped `DONATION_READ` | `BloodUnitView[]` |

Donor PII and donation lists are filtered by ownership or organization
membership; an unrelated organization receives an empty list or `403` on direct
profile access.

## Inventory

| Method | Path | Auth | Purpose |
| :--- | :--- | :--- | :--- |
| GET | `/inventory` | `INVENTORY_READ` | `PageResponse<BloodUnitView>`; filters `bloodGroup,componentType,status,expiringWithinDays,organizationId,page,size,sort` |
| POST | `/inventory` | `INVENTORY_WRITE` | `{organizationId,unitNumber,bloodGroup,componentType,collectedAt,expiresAt?,storageLocation}` |
| GET | `/inventory/{id}` | `INVENTORY_READ` | `BloodUnitView` |
| POST | `/inventory/{id}/release` | `INVENTORY_RELEASE` | Release a screened unit to `AVAILABLE` |
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
| POST | `/allocations/confirm` | `ALLOCATION_CONFIRM` | `Idempotency-Key` header + `{requestId,unitIds[],idempotencyKey}` → reservations |
| GET | `/reservations` | `RESERVATION_READ` | `ReservationView[]` |
| POST | `/reservations` | `RESERVATION_CREATE` | `Idempotency-Key` header + `{unitId,requestId,idempotencyKey}` |
| POST | `/reservations/{id}/confirm` | `RESERVATION_CONFIRM` | no body |
| POST | `/reservations/{id}/cancel` | owner/staff | release unit |
| GET | `/dispatches` | `DISPATCH_READ` | `DispatchView[]` |
| POST | `/dispatches` | `DISPATCH_CREATE` | `Idempotency-Key` header + `{reservationId,assignedStaff}` |
| POST | `/dispatches/{id}/depart` | `DISPATCH_MANAGE` | no body |
| POST | `/dispatches/{id}/deliver` | `DISPATCH_MANAGE` | `{recipientName}` |
| POST | `/dispatches/{id}/incident` | `DISPATCH_MANAGE` | `{description}` |

Allocation confirmation requires exactly `quantity` distinct units; every
selected unit must belong to an organization the caller is authorized for and
match the request's blood group and component type. Dispatch creation requires
the `Idempotency-Key` HTTP header; omitting it is a `409 BUSINESS_RULE_VIOLATION`.

## Notifications, audit, analytics

| Method | Path | Auth | Response data |
| :--- | :--- | :--- | :--- |
| GET | `/notifications` | bearer | `PageResponse<NotificationView>` for current user |
| GET | `/notifications/unread-count` | bearer | `{unread:number}` |
| POST | `/notifications/{id}/read` | bearer, owner only | `null` |
| GET | `/audit-logs` | `AUDIT_READ` | `PageResponse<AuditEvent>` with actor/action/from/to/outcome filters |
| GET | `/analytics/overview` | `ANALYTICS_READ` | scoped counts |
| GET | `/analytics/inventory` | `ANALYTICS_READ` | grouped inventory counts |
| GET | `/analytics/requests` | `ANALYTICS_READ` | fulfilment counts |

## WebSocket notifications

Connect to `/ws` (SockJS/STOMP). Every STOMP `CONNECT` frame must carry
`Authorization: Bearer <accessToken>` as a native STOMP header (the JWT may also
be supplied as the STOMP passcode/login). Unauthenticated frames are rejected;
disabled users and invalid/expired tokens are rejected. Subscriptions are
restricted to `/user/queue/notifications` or the caller's own
`/user/<email>/queue/...` destination. In-app notifications are published with
`convertAndSendToUser(<email>, "/queue/notifications", event)`.
