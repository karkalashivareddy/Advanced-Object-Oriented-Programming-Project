# LifeLink User Guide (planned UI journeys)

**Status:** Design-stage guide. It describes the intended React/TypeScript screens and the exact API calls they will make. It does not claim the application is running. All paths below are relative to `/api/v1` and follow [`../architecture/API_CONTRACTS.md`](../architecture/API_CONTRACTS.md).

---

## 1. Demo accounts — development only

> **WARNING: These are local-only seeded development credentials. They must never be used, copied, or seeded in any production or publicly reachable environment. Change passwords immediately if a local database is exposed. Production credentials are supplied by environment configuration and are not documented here.**

| Account | Password | Role(s) | Active membership (seeded) |
| :--- | :--- | :--- | :--- |
| `admin@lifelink.local` | `Admin@123!` | `PLATFORM_ADMIN` | Platform (cross-organization read, organization verification) |
| `bank@lifelink.local` | `Bank@123!` | `BLOOD_BANK_ADMIN` | Central Blood Bank |
| `inventory@lifelink.local` | `Inventory@123!` | `INVENTORY_MANAGER` | Central Blood Bank |
| `hospital@lifelink.local` | `Hospital@123!` | `HOSPITAL_ADMIN` | City General Hospital |
| `donor@lifelink.local` | `Donor@123!` | `DONOR` | Donor self-service (own records only) |

`MEDICAL_STAFF` is part of the permission model but has **no** seeded demo account in this local set; it is exercised through test fixtures.

### 1.1 Planned local startup

Once the implementation and Maven Wrapper are present, the intended loop is:

1. Start the local PostgreSQL container (optional Docker Compose service) or rely on the H2 profile for tests.
2. Run backend migrations and start the Spring Boot app under the `local` profile; demo accounts are seeded only in this profile.
3. Start the Vite dev server; it proxies `/api/v1` to the backend.
4. Open the SPA, choose an account from the local-only demo list, and sign in.

No production endpoint, credential, or token is included in this guide.

---

## 2. Conventions shown in every screen

- **Authentication:** after `POST /auth/login`, the SPA stores the access token for the session and uses `Authorization: Bearer <accessToken>` on protected calls. Refresh uses `POST /auth/refresh` with the refresh token; rotation means the old refresh token cannot be reused.
- **Responses:** single results arrive in `ApiResponse<T>` (`success`, `data`, optional `message`, `correlationId`, `timestamp`); lists arrive in `PageResponse<T>` (`content`, `page`, `size`, `totalElements`, `totalPages`).
- **Errors:** `ApiError` shows `error.code`, `error.message`, and `error.correlationId`. Quote the correlation id when reporting a problem.
- **Idempotency:** reservation creation, allocation confirmation, and dispatch creation require an `Idempotency-Key` header. The SPA generates one per user action and reuses it on retry, so a double click cannot create two reservations or dispatches.
- **Status codes:** 400 bad input, 401 sign in again, 403 not permitted for this role/organization, 404 not found or out of scope, 409 illegal state/conflict, 429 too many attempts, 500 unexpected error.
- **Permissions are server-side:** the SPA hides buttons the role cannot use, but the API rechecks every permission and organization scope. A hidden button is not a security control.
- **Timestamps:** displayed in the user's local time; sent and stored as ISO-8601 UTC.

---

## 3. Donor — `donor@lifelink.local`

### 3.1 Register or sign in

1. **Register:** `POST /auth/register` with `{email, password, fullName, phone?, organizationId?}` → `AuthResponse`.
2. **Sign in:** `POST /auth/login` with `{email, password}` → `AuthResponse` containing `user.roles` and `user.permissions`.
3. **View profile:** `GET /auth/me` → `UserView`.

### 3.2 Manage profile, consent, appointments

1. **Open “My profile”** → `GET /donors/{id}`; the SPA only shows records owned by this user.
2. **Edit allowed fields** → `PATCH /donors/{id}`.
3. **Give consent** → `POST /donors/{id}/consents`; **view** → `GET /donors/{id}/consents`.
4. **Request an appointment** → `POST /donors/{id}/appointments` with the preferred date and bank. Status starts `REQUESTED`.
5. **Track it** → `GET /donors/{id}/appointments`. Staff actions (`PATCH /donors/appointments/{id}`) can set `CONFIRMED`, `REJECTED`, `COMPLETED`, or `CANCELLED`.
6. **Notifications** → `GET /notifications/unread-count`, `GET /notifications`, then `POST /notifications/{id}/read`.

Expected conflict: changing an appointment that staff already completed returns 409; the screen refreshes and shows the current status.

---

## 4. Blood Bank Administrator — `bank@lifelink.local`

The bank admin works inside the verified Central Blood Bank organization. Cross-organization reads are not available to this role.

### 4.1 Record and approve a donation

1. **Donor list / search** → `GET /donors` (`DONOR_READ`).
2. **Create donation record** → `POST /donations` with `donorId` and collection details. Status becomes `RECORDED`.
3. **Screening review** → `POST /donations/{id}/screen` with `{passed: true|false, notes}`. Passing moves to `SCREENING_PASSED`; failing moves to `SCREENING_FAILED`.
4. **Approve** → `POST /donations/{id}/approve` (`DONATION_APPROVE`). Legal only after a passed screening. The bank's new units appear with status `COLLECTED`, `released: false`.
5. **Reject instead** → `POST /donations/{id}/reject` with `{reason}`; reason is mandatory.
6. **Trace units** → `GET /donations/{id}/units`; each row shows `unitNumber`, `status`, and `version`.

Expected conflict: approving a `SCREENING_FAILED` or already `APPROVED` donation returns 409. The UI disables the button, but the API is the real guard.

### 4.2 Release stock and monitor alerts

1. **Inventory list** → `GET /inventory?organizationId=<bank>&page=0&size=20&sort=expiresAt,asc`.
2. **Open a unit** → `GET /inventory/{id}`; verify `donationId`, `expiresAt`, `storageLocation`.
3. **Release** → `POST /inventory/{id}/release` (`INVENTORY_RELEASE`). Requires a verified, active bank and a cleared screening; the unit becomes `AVAILABLE`, `released: true`, and a movement is appended.
4. **Expire** → `POST /inventory/{id}/expire` if the unit has passed its expiry; status becomes `EXPIRED`.
5. **Adjust** → `POST /inventory/adjustments` with `{unitId, delta?, reason, location?}`; a location change produces `GET /inventory/{id}/movements` history.
6. **Alerts** → `GET /inventory/alerts` for low stock and expiring summaries.

---

## 5. Inventory Manager — `inventory@lifelink.local`

1. **Daily stock board** → `GET /inventory` with filters `bloodGroup`, `componentType`, `status`, `expiringWithinDays`, `organizationId`. Results are paginated; the table shows `publicId`, `unitNumber`, `status`, `released`, `expiresAt`, `storageLocation`, `version`.
2. **Expiry triage** → `GET /inventory?expiringWithinDays=7&status=AVAILABLE`, then `GET /inventory/alerts`. Prioritise units by `expiresAt`.
3. **Manual unit entry** (staff only) → `POST /inventory` with blood group, component, collection/expiry times, and initial status. Manual units start unreleased.
4. **Release after approval** → `POST /inventory/{id}/release`. A 409 means the state or approval guard failed; open the unit detail to see why.
5. **Movement audit** → `GET /inventory/{id}/movements`. History is append-only; the UI never offers delete.
6. **Analytics** → `GET /analytics/inventory` for grouped stock metrics scoped to the bank.

If another user reserves the unit at the same time, the second release/reserve action returns 409 and the table refreshes with the new `version`.

---

## 6. Hospital Administrator — `hospital@lifelink.local`

The hospital owns its emergency requests but not the bank's units. Suggestions are advisory; only confirmation creates holds.

### 6.1 Raise and approve an emergency request

1. **New request** → `POST /emergency-requests` with items (`bloodGroup`, `componentType`, required quantity, needed-by). Status starts `PENDING_APPROVAL`.
2. **Review detail** → `GET /emergency-requests/{id}` shows items and request events.
3. **Approve** → `POST /emergency-requests/{id}/approve` (`REQUEST_APPROVE`).
4. **Alternative outcomes** → `POST /emergency-requests/{id}/reject` with `{reason}`, or `POST /emergency-requests/{id}/cancel` (owner/staff). Cancellation is blocked once an active dispatch exists (409).
5. **List** → `GET /emergency-requests`.

### 6.2 Review suggestions and confirm allocation

1. **Ask for suggestions** → `POST /allocations/suggestions` with `{requestId}` (`ALLOCATION_REVIEW`). The screen shows candidate units and scores. Nothing is locked or changed.
2. **Select units and confirm** → `POST /allocations/confirm` with `{requestId, unitIds[], idempotencyKey}` (`ALLOCATION_CONFIRM`), plus the same `Idempotency-Key` header. Reservations are created in `PENDING`.
3. **Retry safely** → if the network fails, press Retry with the same key. The original response is replayed; no duplicate reservations appear.
4. **Follow progress** → `GET /emergency-requests/{id}` and `GET /reservations` (`RESERVATION_READ`).

Expected conflict: if a candidate was released or expired between suggestion and confirmation, confirmation returns 409 and the screen re-runs suggestions.

---

## 7. Medical Staff — test-fixture role (no seeded demo account)

1. **Confirm a hold** → `POST /reservations/{id}/confirm` (`RESERVATION_CONFIRM`); reservation `PENDING → CONFIRMED`.
2. **Cancel a hold** → `POST /reservations/{id}/cancel`; the unit returns to `AVAILABLE` unless a dispatch already exists (then 409).
3. **Create dispatch** → `POST /dispatches` with `{reservationId}` and `Idempotency-Key`; only a `CONFIRMED` reservation is accepted. Dispatch starts `PREPARING`.
4. **Mark in transit** → `POST /dispatches/{id}/depart`; unit `RESERVED → DISPATCHED`, dispatch `IN_TRANSIT`.
5. **Deliver** → `POST /dispatches/{id}/deliver` with `{recipientName}`; unit `DISPATCHED → DELIVERED`, reservation `FULFILLED`; the request becomes `FULFILLED` when all items are covered.
6. **Record an incident** → `POST /dispatches/{id}/incident` with `{description}`. The dispatch becomes `INCIDENT` and the event is audited; v1 has no automatic resume.
7. **Track** → `GET /dispatches` (`DISPATCH_READ`).

---

## 8. Platform Administrator — `admin@lifelink.local`

1. **Organization queue** → `GET /organizations`; open a bank or hospital with `GET /organizations/{id}`.
2. **Verify organization** → `POST /organizations/{id}/verify`. Unverified banks cannot release stock, so this unlocks the inventory workflow.
3. **Manage members** → `GET /organizations/{id}/members`, `POST /organizations/{id}/members` with `{userId, role}`.
4. **User administration** → `GET /users?page=0&size=20&search=<text>` (`USER_READ`); `PATCH /users/{id}/status` with `{status}` where status is `ACTIVE`, `PENDING_VERIFICATION`, `LOCKED`, or `DISABLED` (`USER_MANAGE`).
5. **Audit trail** → `GET /audit-logs?actor=<id>&action=<name>&from=<utc>&to=<utc>&outcome=<value>` (`AUDIT_READ`). Entries are append-only; the UI has no edit action.
6. **Analytics** → `GET /analytics/overview`, `GET /analytics/inventory`, `GET /analytics/requests` (`ANALYTICS_READ`). Platform view spans organizations; other roles see only their own.
7. **Organisation management** → `POST /organizations`, `PATCH /organizations/{id}` for profile and service-area changes.

---

## 9. Notifications for every role

1. **Badge** → `GET /notifications/unread-count`.
2. **Inbox** → `GET /notifications` (paginated). Entries come from durable outbox events such as `ReservationCreated`, `DispatchDelivered`, or `BloodUnitReleased`.
3. **Mark read** → `POST /notifications/{id}/read`; only the owner can do this. A 403 means the entry belongs to another user.

Delivery is eventually consistent, so a freshly completed action may take a moment to appear.

---

## 10. Troubleshooting

| Symptom | Likely cause | What to do |
| :--- | :--- | :--- |
| 401 after a while | Access token expired | Use refresh (`POST /auth/refresh`) or sign in again. |
| 403 on an action | Role lacks the permission or the record belongs to another organization | Switch active organization or ask an administrator; hiding the button was not security. |
| 404 on a unit you can see in another tenant | Tenant-scoped query | Confirm the correct organization membership. |
| 409 on approve/release/confirm/deliver | Illegal state transition or stale `version` | Refresh the screen, read the current status, and retry with a fresh idempotency key only for non-idempotent actions. |
| Duplicate-looking reservation after retry | Same idempotency key replay | Expected: the API returns the original response; check `GET /reservations` before retrying again. |
| 429 on login | Rate limit | Wait and retry; do not script repeated logins. |
| 500 with a correlation id | Unexpected server error | Report the `correlationId` from the error dialog; no stack trace is shown by design. |

## 11. Accessibility expectations

- Every form control has a visible label and an accessible error message tied to the field.
- Keyboard-only navigation reaches all actions; focus is visible and moved to the first error after a failed submit.
- Status colours are paired with text (`AVAILABLE`, `EXPIRED`, etc.), never communicated by colour alone.
- Tables expose column headers and pagination state; refresh actions announce updates politely.

These are acceptance criteria for the planned UI, implemented with real API calls only.
