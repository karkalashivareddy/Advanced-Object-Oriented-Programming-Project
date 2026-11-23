# LifeLink UML Views

Date: 2026-11-23
Status: implementation-aligned working document

## Purpose

These diagrams describe the object model and call flows actually present in
`project/backend`. They are engineering reference material, not a production-readiness
claim. Enum literals and transitions match the source classes; Mermaid has no native
use-case/activity diagram type, so those views use labelled flowcharts. Where an
end-to-end behaviour has no recorded evidence, the caveat is explicit.

Verified evidence: entities and services under `project/backend/src/main/java/com/lifelink`,
Flyway migrations `V1`–`V5` (including persistent `users.token_version`),
`DevelopmentDataSeeder`, `SecurityConfig`, `StompAuthenticationInterceptor`, the recorded
checks in [`../quality/TEST_RESULTS.md`](../quality/TEST_RESULTS.md), and the durable
evidence under [`../evidence/`](../evidence/). Current release status is authoritative
in [`../reviews/PHASE_2_FINAL_REVIEW.md`](../reviews/PHASE_2_FINAL_REVIEW.md). External
HTTP behaviour is authoritative in [`API_CONTRACTS.md`](API_CONTRACTS.md).

---

## 1. Use-case view

```mermaid
flowchart LR
    DONOR([Donor])
    BANK([Blood Bank Admin])
    INV([Inventory Manager])
    HOSP([Hospital Admin])
    MED([Medical Staff])
    ADM([Platform Admin])

    subgraph UC["Implemented use cases — /api/v1"]
        UC1["UC-01 Donor profile, consent, appointment<br/>GET/POST /donors*, PATCH /donors/appointments/{id}"]
        UC2["UC-02 Donation to stock<br/>POST /donations*, POST /inventory/{id}/release"]
        UC3["UC-03 Emergency request<br/>GET/POST /emergency-requests*, verify/approve/reject/cancel/priority"]
        UC4["UC-04 Advisory allocation<br/>POST /allocations/suggestions"]
        UC5["UC-05 Confirm allocation<br/>POST /allocations/confirm (Idempotency-Key)"]
        UC6["UC-06 Confirm/cancel reservation<br/>POST /reservations/{id}/confirm | /cancel"]
        UC7["UC-07 Dispatch and deliver<br/>POST /dispatches*, /depart, /deliver, /incident"]
        UC8["UC-08 Alerts and analytics<br/>GET /inventory/alerts, GET /analytics/*"]
        UC9["UC-09 Notification inbox<br/>GET /notifications*, POST /notifications/{id}/read, STOMP /user/queue/notifications"]
        UC10["UC-10 Users, organizations, audit<br/>/users*, /organizations*, /audit-logs"]
    end

    DONOR --> UC1
    DONOR --> UC9
    BANK --> UC1
    BANK --> UC2
    BANK --> UC7
    BANK --> UC10
    INV --> UC2
    INV --> UC7
    INV --> UC8
    HOSP --> UC3
    HOSP --> UC4
    HOSP --> UC5
    HOSP --> UC6
    HOSP --> UC9
    MED --> UC5
    MED --> UC6
    MED --> UC7
    ADM --> UC10
    ADM --> UC8
```

Role permissions are enforced server-side. Dispatch creation is a blood-bank action in
the supplying organization; hospital membership alone never grants it.

---

## 2. Class diagram — key domain types

```mermaid
classDiagram
    direction LR

    class BaseEntity {
        <<abstract>>
        -Long id
        -String publicId
        -Instant createdAt
        -Instant updatedAt
        -long version
    }
    class Organization {
        -String name
        -Type type
        -String registrationCode
        -boolean verified
        -boolean active
    }
    class User {
        -String email
        -String passwordHash
        -String fullName
        -UserStatus status
        -Set~Role~ roles
        +effectivePermissions() Set~Permission~
    }
    class UserOrganization {
        -Role role
    }
    class DonorProfile {
        -String donorNumber
        -BloodGroup bloodGroup
        -Instant dateOfBirth
    }
    class Donation {
        -DonationStatus status
        -Instant donatedAt
        -String screeningNotes
        +screen(boolean passed) void
        +approve() void
        +reject() void
    }
    class Appointment {
        -Instant scheduledAt
        -String status
        -String notes
    }
    class BloodUnit {
        -String unitNumber
        -BloodGroup bloodGroup
        -ComponentType componentType
        -UnitStatus status
        -boolean released
        -Instant collectedAt
        -Instant expiresAt
        -String storageLocation
        +release(Instant now) void
        +holdForScreening() void
        +quarantine() void
        +reserve(Long reservationId, Instant now) void
        +clearReservation() void
        +dispatch() void
        +deliver() void
        +markExpired() void
        +discard(String reason) void
        +changeLocation(String location) void
    }
    class EmergencyRequest {
        -String requestNumber
        -RequestStatus status
        -Priority priority
        -BloodGroup bloodGroup
        -ComponentType componentType
        -int quantity
        -Instant requiredBy
        +verify(Long verifierId) void
        +approve(Long approverId) void
        +reject() void
        +cancel() void
        +markAllocating() void
        +markReserved() void
        +markInTransit() void
        +fulfil() void
        +changePriority(Priority p, boolean authorized) void
    }
    class Reservation {
        -ReservationStatus status
        -Instant expiresAt
        +confirm(Instant now) void
        +cancel() void
        +expire() void
    }
    class Dispatch {
        -String trackingNumber
        -DispatchStatus status
        -String assignedStaff
        -Instant dispatchedAt
        -Instant deliveredAt
        +depart() void
        +deliver(String recipientName) void
        +reportIncident(String description) void
    }
    class Notification {
        -User recipient
        -String title
        -String body
        -boolean read
        +markRead() void
    }
    class AuditLog {
        -User actor
        -String action
        -String entityType
        -String entityId
        -Outcome outcome
        -String correlationId
    }
    class IdempotencyRecord {
        <<V4 table>>
        -String scope
        -String idempotencyKey
        -String requestFingerprint
        -String responseJson
    }
    class AllocationStrategy {
        <<interface>>
        +evaluate(AllocationContext, List~BloodUnit~) List~AllocationCandidate~
    }
    class FeefoStrategy {
        -CompatibilitySpecification specification
    }
    class CompatibilitySpecification {
        <<interface>>
        +isSatisfiedBy(BloodGroup, BloodGroup) boolean
    }
    class StrictSameGroupSpecification
    class ConfiguredCompatibilitySpecification
    class AllocationContext

    BaseEntity <|-- Organization
    BaseEntity <|-- User
    BaseEntity <|-- UserOrganization
    BaseEntity <|-- DonorProfile
    BaseEntity <|-- Donation
    BaseEntity <|-- Appointment
    BaseEntity <|-- BloodUnit
    BaseEntity <|-- EmergencyRequest
    BaseEntity <|-- Reservation
    BaseEntity <|-- Dispatch
    BaseEntity <|-- Notification
    BaseEntity <|-- AuditLog
    BaseEntity <|-- IdempotencyRecord

    User "1" -- "*" UserOrganization
    Organization "1" -- "*" UserOrganization
    Organization "1" -- "*" DonorProfile
    DonorProfile "1" -- "*" Donation
    Donation "1" -- "0..1" Appointment
    Donation "1" -- "*" BloodUnit : approved units
    EmergencyRequest "1" -- "*" Reservation
    BloodUnit "1" -- "0..1" Reservation : sparse active hold (V4)
    Reservation "1" -- "0..1" Dispatch
    User "1" -- "*" Notification
    User "1" -- "*" AuditLog : actor

    AllocationStrategy <|.. FeefoStrategy
    CompatibilitySpecification <|.. StrictSameGroupSpecification
    CompatibilitySpecification <|.. ConfiguredCompatibilitySpecification
    FeefoStrategy --> CompatibilitySpecification : uses
    FeefoStrategy ..> AllocationContext : evaluates
```

`IdempotencyRecord` is the `V4__integrity_and_idempotency.sql` table used by
`ReservationService.Idempotency`. Uniqueness is `(scope, idempotency_key)`; the request
fingerprint and original serialized response are stored with the claim.

Allocation uses the real Strategy/Specification classes shown below; there is no
`BloodUnitFactory`/`DonationUnitFactory` — approved-unit creation lives in
`DonationService`. `FeefoStrategy` orders candidates first-expiry-first-out and uses a
`CompatibilitySpecification` for blood-group matching. The default implementation is
`StrictSameGroupSpecification`; `ConfiguredCompatibilitySpecification` is an optional
rule set enabled by `lifelink.allocation.compatibility-mode=CONFIGURED`. All advisory
scoring is non-clinical and makes no state changes.

---

## 3. Sequence — request to dispatch

```mermaid
sequenceDiagram
    actor H as Hospital Admin / Medical Staff
    participant API as Spring MVC controller
    participant SVC as Domain service
    participant TAS as TenantAccessService
    participant DB as PostgreSQL/H2
    participant IDEM as Idempotency (V4)
    participant WS as STOMP notifications

    H->>API: POST /api/v1/emergency-requests (+ X-Organization-Id)
    API->>TAS: validate selected organization against memberships
    API->>SVC: create(request) → PENDING_VERIFICATION
    SVC->>DB: persist request
    H->>API: POST /{id}/verify, /{id}/approve
    API->>SVC: verify(id), approve(id) with REQUEST_APPROVE
    SVC->>DB: VERIFIED → APPROVED

    H->>API: POST /api/v1/allocations/suggestions {requestId}
    API->>SVC: suggest(requestId)
    SVC->>DB: read organization-scoped AVAILABLE units
    SVC->>SVC: FeefoStrategy + CompatibilitySpecification score/rank
    SVC-->>H: advisory candidates with rejection reasons (no writes, no locks)

    H->>API: POST /api/v1/allocations/confirm (+ Idempotency-Key)
    API->>SVC: confirm(requestId, unitIds, key)
    SVC->>IDEM: claim(scope, key, fingerprint)
    alt replay with same fingerprint
        IDEM-->>H: stored original response (no new reservations)
    else new or conflicting key
        IDEM-->>SVC: claimed / 409 on fingerprint mismatch
        SVC->>DB: lock units in ascending id order
        SVC->>DB: create RESERVATION (ACTIVE), request → ALLOCATING/RESERVED
        SVC-->>H: 200 confirmation
    end

    H->>API: POST /api/v1/reservations/{id}/confirm (or bank staff)
    API->>SVC: confirm(reservationId)
    SVC->>DB: ACTIVE → CONFIRMED, guard not expired

    participant B as Bank Staff
    B->>API: POST /api/v1/dispatches (+ Idempotency-Key, X-Organization-Id)
    API->>TAS: authorize supplying organization (BLOOD_BANK_ADMIN / INVENTORY_MANAGER)
    API->>SVC: create(request, key)
    SVC->>DB: lock blood unit, create DISPATCH (PREPARING)
    SVC->>WS: publish status event
    WS-->>H: /user/queue/notifications

    B->>API: POST /{id}/depart, /{id}/deliver {recipientName}
    API->>SVC: depart() → IN_TRANSIT, deliver() → DELIVERED
    SVC->>DB: blood unit DISPATCHED → DELIVERED, request → IN_TRANSIT → FULFILLED
```

Implemented behaviour reflected here:

- `X-Organization-Id` is validated against memberships by `TenantAccessService`; it
  narrows data access and never bypasses role permissions.
- Allocation confirmation, reservation creation, and dispatch creation bind the
  `Idempotency-Key` to a canonical request fingerprint. Replays return the stored
  response; same key with a different payload is `409`. Header/body divergence at
  allocation confirmation is `400 VALIDATION_ERROR`.
- Lock acquisition/integrity conflicts map to `409 CONCURRENCY_CONFLICT`; allocation
  locks are sorted by unit id.
- STOMP CONNECT requires a `Bearer` JWT in the native `Authorization` header; SUBSCRIBE
  is restricted to the caller's own queue with `NOTIFICATION_READ`; `/app` SEND frames
  are denied because no `@MessageMapping` handler exists. No raw passcode is accepted.
  Live STOMP delivery through the Compose nginx proxy is **verified**: a standalone Node
  smoke script obtained authenticated `CONNECTED` and a notification `MESSAGE`
  ([`../evidence/STOMP_SMOKE_RESULT.json`](../evidence/STOMP_SMOKE_RESULT.json)). The SPA
  itself still has no live STOMP client; notifications are shown via the REST inbox.

---

## 4. Sequence — donation to inventory

```mermaid
sequenceDiagram
    actor B as Bank Staff
    participant DC as DonationController
    participant DS as DonationService
    participant BR as BloodUnitRepository
    participant IC as InventoryController
    participant IS as InventoryService
    participant AU as AuditService

    B->>DC: POST /api/v1/donations {donorId, organizationId, ...}
    DC->>DS: record(...) → RECORDED
    DS->>AU: write SUCCESS audit (same transaction)

    B->>DC: POST /api/v1/donations/{id}/screen {passed, notes?}
    DC->>DS: screen(...)
    DS-->>B: SCREENED (pass) or REJECTED (fail)

    B->>DC: POST /api/v1/donations/{id}/approve {components[]}
    DC->>DS: approve(...) @Transactional
    DS->>DS: require status SCREENED and stored passing screening
    DS->>BR: save BloodUnits (QUARANTINED, released=false)
    DS->>AU: DonationApproved + audit (same transaction)

    B->>IC: POST /api/v1/inventory/{id}/release
    IC->>IS: release(id) @Transactional
    IS->>BR: findByIdForUpdate(id) (pessimistic write lock)
    IS->>IS: guard organization, screening, and expiry
    IS->>BR: status → AVAILABLE, released=true, append movement
    IS->>AU: BloodUnitReleased + audit (same transaction)
    IS-->>B: BloodUnitView AVAILABLE

    B->>IC: GET /api/v1/inventory?bloodGroup=...&expiringWithinDays=7
    IC-->>B: PageResponse~BloodUnitView~
```

Audit `SUCCESS` rows participate in the business transaction, so they cannot survive a
rollback. Lifecycle notification processing is fault-isolated per item.

---

## 5. Activity — allocation advisory flow

```mermaid
flowchart TD
    A[Request created PENDING_VERIFICATION] --> B[verify then approve]
    B --> C{Status APPROVED or ALLOCATING?}
    C -- no --> Z[409 INVALID_STATE_TRANSITION]
    C -- yes --> E[POST /allocations/suggestions requestId]
    E --> F[Query AVAILABLE units matching group, component, scope]
    F --> G[FeefoStrategy ranks by expiry; CompatibilitySpecification checks groups]
    G --> H[Return advisory candidates — no writes, no locks]
    H --> I{Staff accepts candidates?}
    I -- no --> J[Request remains APPROVED]
    I -- yes --> K[POST /allocations/confirm with Idempotency-Key]
    K --> L{Key replay?}
    L -- yes --> M[Return stored response, no new side effects]
    L -- no --> N[Lock distinct units in ascending id order]
    N --> O{All units AVAILABLE, in scope, count equals quantity?}
    O -- no --> P[Rollback, 409 conflict]
    O -- yes --> Q[Create ACTIVE reservations + audit]
    Q --> R[Confirm reservation, then bank creates dispatch]
    R --> S[Deliver: unit DELIVERED, request FULFILLED when obligations complete]
```

---

## 6. State — BloodUnit

```mermaid
stateDiagram-v2
    [*] --> COLLECTED : donation approve / manual create
    [*] --> SCREENING : manual create
    [*] --> QUARANTINED : manual create
    COLLECTED --> AVAILABLE : release(now)
    SCREENING --> AVAILABLE : release(now)
    QUARANTINED --> AVAILABLE : release(now)
    COLLECTED --> SCREENING : holdForScreening()
    QUARANTINED --> SCREENING : holdForScreening()
    AVAILABLE --> QUARANTINED : quarantine()
    SCREENING --> QUARANTINED : quarantine()
    COLLECTED --> QUARANTINED : quarantine()
    SCREENING --> DISCARDED : discard(reason)
    QUARANTINED --> DISCARDED : discard(reason)
    AVAILABLE --> DISCARDED : discard(reason)
    AVAILABLE --> RESERVED : reserve(reservationId, now)
    RESERVED --> AVAILABLE : clearReservation() (released)
    RESERVED --> QUARANTINED : clearReservation() (not released)
    RESERVED --> DISPATCHED : dispatch()
    DISPATCHED --> DELIVERED : deliver()
    COLLECTED --> EXPIRED : markExpired()
    SCREENING --> EXPIRED : markExpired()
    QUARANTINED --> EXPIRED : markExpired()
    AVAILABLE --> EXPIRED : markExpired()
    RESERVED --> EXPIRED : markExpired()
    DELIVERED --> [*]
    EXPIRED --> [*]
    DISCARDED --> [*]
```

Actual literals in `BloodUnit.Status`: `COLLECTED`, `SCREENING`, `QUARANTINED`,
`AVAILABLE`, `RESERVED`, `DISPATCHED`, `DELIVERED`, `EXPIRED`, `DISCARDED`. V4 adds a
sparse unique index so at most one active reservation exists per unit.

---

## 7. State — EmergencyRequest

```mermaid
stateDiagram-v2
    [*] --> PENDING_VERIFICATION : POST /emergency-requests
    PENDING_VERIFICATION --> VERIFIED : verify() REQUEST_APPROVE
    PENDING_VERIFICATION --> REJECTED : reject() REQUEST_APPROVE
    VERIFIED --> APPROVED : approve() REQUEST_APPROVE
    VERIFIED --> REJECTED : reject() REQUEST_APPROVE
    APPROVED --> REJECTED : reject() REQUEST_APPROVE
    APPROVED --> ALLOCATING : markAllocating()
    ALLOCATING --> RESERVED : markReserved()
    RESERVED --> RESERVED : markReserved() (idempotent re-entry)
    RESERVED --> IN_TRANSIT : markInTransit()
    RESERVED --> FULFILLED : fulfil()
    IN_TRANSIT --> FULFILLED : fulfil()
    PENDING_VERIFICATION --> CANCELLED : cancel()
    VERIFIED --> CANCELLED : cancel()
    APPROVED --> CANCELLED : cancel()
    ALLOCATING --> CANCELLED : cancel()
    RESERVED --> CANCELLED : cancel()
    REJECTED --> [*]
    CANCELLED --> [*]
    FULFILLED --> [*]
```

Actual literals in `EmergencyRequest.Status`: `DRAFT`, `PENDING_VERIFICATION`,
`VERIFIED`, `APPROVED`, `ALLOCATING`, `RESERVED`, `IN_TRANSIT`, `FULFILLED`, `REJECTED`,
`CANCELLED`, `EXPIRED`. `DRAFT` and `EXPIRED` are persisted literals; new requests start
at `PENDING_VERIFICATION`. Dispatch incidents are tracked by `Dispatch.Status.INCIDENT`,
not by a request status.

---

## 8. State — Reservation

```mermaid
stateDiagram-v2
    [*] --> ACTIVE : POST /reservations or /allocations/confirm (idempotent)
    ACTIVE --> CONFIRMED : confirm(now)
    ACTIVE --> CANCELLED : cancel()
    ACTIVE --> EXPIRED : TTL elapsed, unit released
    CONFIRMED --> CANCELLED : cancel() before dispatch
    CANCELLED --> [*]
    EXPIRED --> [*]
```

Actual literals in `Reservation.Status`: `ACTIVE`, `CONFIRMED`, `CANCELLED`, `EXPIRED`.
There is no `PENDING` or `FULFILLED` reservation status.

---

## 9. State — Dispatch, Donation, and User

```mermaid
stateDiagram-v2
    state Dispatch {
        [*] --> PREPARING : POST /dispatches (idempotent)
        PREPARING --> IN_TRANSIT : depart()
        IN_TRANSIT --> DELIVERED : deliver(recipientName)
        PREPARING --> INCIDENT : reportIncident(description)
        IN_TRANSIT --> INCIDENT : reportIncident(description)
        INCIDENT --> DELIVERED : recovery delivery
    }

    state Donation {
        [*] --> RECORDED : POST /donations
        RECORDED --> SCREENED : screen(passed)
        RECORDED --> REJECTED : screen(failed)
        SCREENED --> APPROVED : approve()
        SCREENED --> REJECTED : reject()
    }

    state User {
        [*] --> ACTIVE
        ACTIVE --> PENDING_VERIFICATION : markPendingVerification()
        ACTIVE --> LOCKED : failed-login lockout / lock()
        LOCKED --> ACTIVE : activate()
        ACTIVE --> DISABLED : disable()
    }
```

Actual literals: `Dispatch.Status` = `PREPARING`, `IN_TRANSIT`, `DELIVERED`, `INCIDENT`;
`Donation.Status` = `RECORDED`, `SCREENED`, `APPROVED`, `REJECTED`;
`User.Status` = `ACTIVE`, `PENDING_VERIFICATION`, `LOCKED`, `DISABLED`.

---

## 10. Deployment view

Local Compose deployment is implemented: backend and frontend images
`lifelink/backend:dev` and `lifelink/frontend:dev` were built successfully. Compose binds
PostgreSQL, backend, and frontend to `127.0.0.1` with overridable
`POSTGRES_PORT`/`BACKEND_PORT`/`FRONTEND_PORT`. Startup requires `JWT_SECRET`, and the
local demo stack sets `SEED_DEMO_DATA=true`. See
[`../deployment/DEPLOYMENT_GUIDE.md`](../deployment/DEPLOYMENT_GUIDE.md) for exact
commands. Public/production TLS, secrets management, and image pinning are not claimed.
