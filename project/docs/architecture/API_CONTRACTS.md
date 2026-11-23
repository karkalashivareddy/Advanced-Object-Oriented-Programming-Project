# LifeLink API Contracts (v1)

Base path: `/api/v1`. JSON only. All timestamps are ISO-8601 UTC. All list endpoints return a paginated envelope.

## Envelopes

```ts
type ApiResponse<T> = {
  success: boolean;
  data: T;
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

type ApiError = {
  success: false;
  error: { code: string; message: string; details?: Record<string, string>; correlationId: string };
  timestamp: string;
};
```

## Authentication and identity

| Method | Path | Auth | Request | Response data |
| :--- | :--- | :--- | :--- | :--- |
| POST | `/auth/register` | public | `{email,password,fullName,phone?,organizationId?}` | `AuthResponse` |
| POST | `/auth/login` | public | `{email,password}` | `AuthResponse` |
| POST | `/auth/refresh` | public | `{refreshToken}` | `AuthResponse` (rotated) |
| POST | `/auth/logout` | bearer | `{refreshToken}` | `null` |
| POST | `/auth/change-password` | bearer | `{currentPassword,newPassword}` | `null` |
| GET | `/auth/me` | bearer | — | `UserView` |
| GET | `/users` | `USER_READ` | page/size/search | `PageResponse<UserView>` |
| PATCH | `/users/{id}/status` | `USER_MANAGE` | `{status}` | `UserView` |

```ts
type Role = 'PLATFORM_ADMIN'|'BLOOD_BANK_ADMIN'|'INVENTORY_MANAGER'|'HOSPITAL_ADMIN'|'MEDICAL_STAFF'|'DONOR';
type AuthResponse = {
  accessToken: string; refreshToken: string; expiresIn: number; user: UserView;
};
type UserView = {
  id: number; publicId: string; email: string; fullName: string; status: 'ACTIVE'|'PENDING_VERIFICATION'|'LOCKED'|'DISABLED';
  roles: Role[]; permissions: string[];
  memberships: Array<{organizationId:number; organizationName:string; role:Role}>;
};
```

## Organizations

`GET/POST /organizations`, `GET/PATCH /organizations/{id}`, `POST /organizations/{id}/verify`, `GET /organizations/{id}/members`, `POST /organizations/{id}/members`.

```ts
type OrganizationView = { id:number; publicId:string; name:string; type:'BLOOD_BANK'|'HOSPITAL'; registrationCode:string; city:string; state:string; contactEmail:string; phone:string; verified:boolean; active:boolean; serviceArea?:string };
```

## Donors and donations

| Method | Path | Auth | Purpose |
| :--- | :--- | :--- | :--- |
| GET/POST | `/donors` | `DONOR_READ` / donor self | List/create donor profiles |
| GET/PATCH | `/donors/{id}` | owner or `DONOR_READ` | Profile |
| GET/POST | `/donors/{id}/consents` | owner/staff | Consent records |
| GET/POST | `/donors/{id}/appointments` | owner/staff | Appointment requests |
| PATCH | `/donors/appointments/{id}` | staff | Confirm/reject/complete/cancel |
| GET/POST | `/donations` | staff / donor read | Donation records |
| POST | `/donations/{id}/screen` | `SCREENING_REVIEW` | `{passed:boolean,notes:string}` |
| POST | `/donations/{id}/approve` | `DONATION_APPROVE` | Approve after screening; creates blood units |
| POST | `/donations/{id}/reject` | `DONATION_APPROVE` | `{reason}` |
| GET | `/donations/{id}/units` | staff | Traceability |

## Inventory

| Method | Path | Auth | Purpose |
| :--- | :--- | :--- | :--- |
| GET | `/inventory` | `INVENTORY_READ` | Filters `bloodGroup,componentType,status,expiringWithinDays,organizationId,page,size,sort` |
| POST | `/inventory` | `INVENTORY_WRITE` | Manual unit creation (staff only) |
| GET | `/inventory/{id}` | `INVENTORY_READ` | Unit detail |
| POST | `/inventory/{id}/release` | `INVENTORY_RELEASE` | Screening/release after authorized approval |
| POST | `/inventory/{id}/expire` | `INVENTORY_WRITE` | Mark expired |
| POST | `/inventory/adjustments` | `INVENTORY_WRITE` | `{unitId,delta?,reason,location?}` |
| GET | `/inventory/{id}/movements` | `INVENTORY_READ` | Movement history |
| GET | `/inventory/alerts` | `INVENTORY_READ` | Low-stock and expiring summaries |

```ts
type BloodGroup = 'A_POSITIVE'|'A_NEGATIVE'|'B_POSITIVE'|'B_NEGATIVE'|'AB_POSITIVE'|'AB_NEGATIVE'|'O_POSITIVE'|'O_NEGATIVE';
type ComponentType = 'WHOLE_BLOOD'|'RED_CELLS'|'PLASMA'|'PLATELETS'|'CRYOPRECIPITATE';
type UnitStatus = 'COLLECTED'|'SCREENING'|'QUARANTINED'|'AVAILABLE'|'RESERVED'|'DISPATCHED'|'DELIVERED'|'EXPIRED'|'DISCARDED';
type BloodUnitView = { id:number; publicId:string; unitNumber:string; bloodGroup:BloodGroup; componentType:ComponentType; status:UnitStatus;
  released:boolean; collectedAt:string; expiresAt:string; storageLocation:string; organizationId:number; donationId?:number; version:number; };
```

## Emergency requests, allocation, reservations, dispatch

| Method | Path | Auth | Purpose |
| :--- | :--- | :--- | :--- |
| GET/POST | `/emergency-requests` | `REQUEST_READ` / `REQUEST_CREATE` | List/create requests |
| GET | `/emergency-requests/{id}` | `REQUEST_READ` | Detail with items and events |
| POST | `/emergency-requests/{id}/approve` | `REQUEST_APPROVE` | Authorized approval |
| POST | `/emergency-requests/{id}/reject` | `REQUEST_APPROVE` | `{reason}` |
| POST | `/emergency-requests/{id}/cancel` | owner/staff | Cancellation |
| POST | `/allocations/suggestions` | `ALLOCATION_REVIEW` | `{requestId}` → candidate evaluations; advisory only |
| POST | `/allocations/confirm` | `ALLOCATION_CONFIRM` | `{requestId,unitIds[],idempotencyKey}` → reservations |
| GET/POST | `/reservations` | `RESERVATION_READ` / `RESERVATION_CREATE` | List/create (idempotency required) |
| POST | `/reservations/{id}/confirm` | `RESERVATION_CONFIRM` | Confirm |
| POST | `/reservations/{id}/cancel` | owner/staff | Cancel and release unit |
| GET/POST | `/dispatches` | `DISPATCH_READ` / `DISPATCH_CREATE` | List/create from confirmed reservation |
| POST | `/dispatches/{id}/depart` | `DISPATCH_MANAGE` | Mark in transit |
| POST | `/dispatches/{id}/deliver` | `DISPATCH_MANAGE` | `{recipientName}` |
| POST | `/dispatches/{id}/incident` | `DISPATCH_MANAGE` | `{description}` |

## Notifications, audit, analytics

| Method | Path | Auth | Purpose |
| :--- | :--- | :--- | :--- |
| GET | `/notifications` | bearer | Page of current user's notifications |
| GET | `/notifications/unread-count` | bearer | Count |
| POST | `/notifications/{id}/read` | bearer | Mark read (owner only) |
| GET | `/audit-logs` | `AUDIT_READ` | Filters actor, action, from, to, outcome |
| GET | `/analytics/overview` | `ANALYTICS_READ` | Role/organization scoped counts |
| GET | `/analytics/inventory` | `ANALYTICS_READ` | Grouped inventory metrics |
| GET | `/analytics/requests` | `ANALYTICS_READ` | Fulfilment metrics |

## Cross-cutting rules

- Bearer `Authorization: <PASSWORD>` header on every protected endpoint.
- `Idempotency-Key` header is required on reservation, allocation confirmation, and dispatch creation.
- Server-side authorization and organization scoping are mandatory; UI permission checks are cosmetic only.
- 400 validation, 401 unauthenticated, 403 unauthorized, 404 not found, 409 business/state conflict, 429 rate limited, 500 internal.
- No endpoint returns stack traces, SQL, credentials, or tokens other than the intended token responses.
