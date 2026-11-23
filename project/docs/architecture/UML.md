# LifeLink UML Views

**Status:** Planned design diagrams. They mirror [`DOMAIN_MODEL.md`](DOMAIN_MODEL.md) and [`API_CONTRACTS.md`](API_CONTRACTS.md). Mermaid has no native use-case/activity diagram type, so those views use labelled flowcharts. Enum literals are the exact contract/internal names from the domain model.

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

    subgraph UC["Use cases — /api/v1"]
        UC1["UC-01 Donor profile, consent, appointment<br/>GET/POST /donors*, PATCH /donors/appointments/{id}"]
        UC2["UC-02 Donation to stock<br/>POST /donations*, POST /inventory/{id}/release"]
        UC3["UC-03 Emergency request<br/>GET/POST /emergency-requests*, approve/reject/cancel"]
        UC4["UC-04 Advisory allocation<br/>POST /allocations/suggestions"]
        UC5["UC-05 Confirm allocation<br/>POST /allocations/confirm (Idempotency-Key)"]
        UC6["UC-06 Confirm/cancel reservation<br/>POST /reservations/{id}/confirm | /cancel"]
        UC7["UC-07 Dispatch and deliver<br/>POST /dispatches*, /depart, /deliver, /incident"]
        UC8["UC-08 Alerts and analytics<br/>GET /inventory/alerts, GET /analytics/*"]
        UC9["UC-09 Notification inbox<br/>GET /notifications*, POST /notifications/{id}/read"]
        UC10["UC-10 Users, organizations, audit<br/>/users*, /organizations*, /audit-logs"]
    end

    DONOR --> UC1
    DONOR --> UC9
    BANK --> UC1
    BANK --> UC2
    BANK --> UC10
    INV --> UC2
    INV --> UC8
    HOSP --> UC3
    HOSP --> UC4
    HOSP --> UC5
    HOSP --> UC9
    MED --> UC5
    MED --> UC6
    MED --> UC7
    ADM --> UC10
    ADM --> UC8
```

---

## 2. Class diagram — key domain types

```mermaid
classDiagram
    direction LR

    class Organization {
        -OrganizationId id
        -String publicId
        -String name
        -OrganizationType type
        -boolean verified
        -boolean active
        +verify() void
        +canSupplyStock() boolean
    }
    class User {
        -UserId id
        -String email
        -UserStatus status
        -List~Role~ roles
        -List~Permission~ permissions
        -List~Membership~ memberships
        +hasPermission(Permission p) boolean
        +organizationId() OrganizationId
    }
    class Donor {
        -DonorId id
        -BloodGroup bloodGroup
        -OrganizationId organizationId
        +addConsent(Consent c) void
        +requestAppointment(Appointment a) void
    }
    class Donation {
        -DonationId id
        -DonorId donorId
        -OrganizationId organizationId
        -DonationStatus status
        -ScreeningResult screening
        -List~UnitId~ unitIds
        +screen(boolean passed, String notes) void
        +approve(UnitFactory f) List~BloodUnit~
        +reject(RejectionReason reason) void
    }
    class BloodUnit {
        -UnitId id
        -String publicId
        -String unitNumber
        -BloodGroup bloodGroup
        -ComponentType componentType
        -UnitStatus status
        -boolean released
        -Instant collectedAt
        -Instant expiresAt
        -StorageLocation storageLocation
        -OrganizationId organizationId
        -DonationId donationId
        -long version
        +release() void
        +reserve(ReservationId r) void
        +releaseReservation(ReservationId r) void
        +markDispatched(DispatchId d) void
        +markDelivered() void
        +expire() void
        +moveTo(StorageLocation l) void
    }
    class EmergencyRequest {
        -RequestId id
        -OrganizationId requestingOrganizationId
        -EmergencyRequestStatus status
        -Priority priority
        -List~RequestItem~ items
        +approve() void
        +reject(RejectionReason reason) void
        +cancel() void
        +markFulfilledIfComplete() void
    }
    class RequestItem {
        -BloodRequirement requirement
        -int requiredQuantity
        -int fulfilledQuantity
    }
    class Reservation {
        -ReservationId id
        -UnitId unitId
        -RequestId requestId
        -OrganizationId requestingOrganizationId
        -OrganizationId supplyingOrganizationId
        -ReservationStatus status
        -Instant expiresAt
        +confirm() void
        +cancel() void
        +expire() void
        +markFulfilled() void
    }
    class Dispatch {
        -DispatchId id
        -ReservationId reservationId
        -UnitId unitId
        -DispatchStatus status
        -RecipientName recipientName
        +depart() void
        +deliver(RecipientName n) void
        +recordIncident(String description) void
    }
    class Notification {
        -NotificationId id
        -UserId userId
        -String eventId
        -boolean read
        +markRead(UserId owner) void
    }
    class AuditLog {
        -AuditLogId id
        -UserId actorId
        -String action
        -AuditOutcome outcome
        -String correlationId
    }

    class BloodUnitFactory {
        <<interface>>
        +createFrom(Donation d, BloodRequirement r) BloodUnit
    }
    class AllocationStrategy {
        <<interface>>
        +evaluate(BloodUnit u, BloodRequirement r) AllocationScore
    }
    class AbstractAllocationStrategy {
        <<abstract>>
        #normalize(int raw) AllocationScore
    }
    class ExactMatchStrategy
    class ExpirySoonestStrategy
    class DonationUnitFactory

    class UnitStatus {
        <<enumeration>>
        COLLECTED
        SCREENING
        QUARANTINED
        AVAILABLE
        RESERVED
        DISPATCHED
        DELIVERED
        EXPIRED
        DISCARDED
    }
    class DonationStatus {
        <<enumeration>>
        RECORDED
        SCREENING_PASSED
        SCREENING_FAILED
        APPROVED
        REJECTED
    }
    class ReservationStatus {
        <<enumeration>>
        PENDING
        CONFIRMED
        CANCELLED
        EXPIRED
        FULFILLED
    }
    class DispatchStatus {
        <<enumeration>>
        PREPARING
        IN_TRANSIT
        DELIVERED
        INCIDENT
    }
    class EmergencyRequestStatus {
        <<enumeration>>
        PENDING_APPROVAL
        APPROVED
        REJECTED
        CANCELLED
        FULFILLED
    }

    Organization "1" --> "0..*" User : memberships
    Organization "1" --> "0..*" Donor : owns
    Organization "1" --> "0..*" BloodUnit : owns
    Donor "1" --> "0..*" Donation : donates
    Donation "1" --> "0..*" BloodUnit : approve creates UnitId refs
    BloodUnit --> UnitStatus : status
    Donation --> DonationStatus : status
    EmergencyRequest "1" *-- "1..*" RequestItem : contains
    EmergencyRequest --> EmergencyRequestStatus : status
    EmergencyRequest "1" --> "0..*" Reservation : requested via
    Reservation "1" --> "1" BloodUnit : holds
    Reservation --> ReservationStatus : status
    Reservation "1" --> "0..1" Dispatch : confirmed only
    Dispatch --> DispatchStatus : status
    User "1" --> "0..*" Notification : inbox
    User "1" --> "0..*" AuditLog : actor

    BloodUnitFactory <|.. DonationUnitFactory
    AllocationStrategy <|.. AbstractAllocationStrategy
    AbstractAllocationStrategy <|-- ExactMatchStrategy
    AbstractAllocationStrategy <|-- ExpirySoonestStrategy
```

`DonationUnitFactory` realizes `BloodUnitFactory`; `ExactMatchStrategy` and `ExpirySoonestStrategy` inherit common scoring from `AbstractAllocationStrategy`, which realizes `AllocationStrategy`.

---

## 3. Sequence — reservation flow (allocation confirm → confirm → dispatch)

```mermaid
sequenceDiagram
    actor H as Hospital Admin / Medical Staff
    participant AC as AllocationController
    participant AS as AllocationService
    participant SR as BloodUnitSearchRepository
    participant ID as IdempotencyPort
    participant RS as ReservationService
    participant BR as BloodUnitRepository
    participant BU as BloodUnit
    participant OB as OutboxPort
    participant RC as ReservationController
    participant DS as DispatchController
    participant D as DispatchService

    H->>AC: POST /api/v1/allocations/suggestions {requestId}
    AC->>AS: suggest(RequestId)
    AS->>SR: find AVAILABLE units matching request items (snapshot, no lock)
    SR-->>AS: candidate units + scores
    AS-->>AC: candidate evaluations (advisory)
    AC-->>H: 200 ApiResponse (no state change)

    H->>AC: POST /api/v1/allocations/confirm {requestId, unitIds[], idempotencyKey}
    Note over AC,ID: Idempotency-Key header required
    AC->>ID: claim(scope, key)
    alt key already used
        ID-->>AC: stored response
        AC-->>H: original response (no new reservations)
    else new key
        ID-->>AC: claimed
        AC->>AS: confirm(...) @Transactional
        AS->>BR: lockByIdForUpdate(unitIds sorted ascending)
        loop each selected unit
            AS->>BU: reserve(ReservationId)
            BU->>BU: guard AVAILABLE, increment version
            AS->>OB: append ReservationCreated (same transaction)
        end
        AS-->>AC: reservations PENDING
        AC-->>H: 200 ApiResponse
    end

    H->>RC: POST /api/v1/reservations/{id}/confirm
    RC->>RS: confirm(ReservationId)
    RS->>BU: verify hold + not expired
    BU->>BU: PENDING → CONFIRMED
    RS-->>RC: ReservationView
    RC-->>H: 200 ApiResponse

    H->>DS: POST /api/v1/dispatches {reservationId} with Idempotency-Key
    DS->>D: create(...) @Transactional
    D->>D: unique dispatch per CONFIRMED reservation
    D-->>H: 200 ApiResponse (dispatch PREPARING)

    H->>DS: POST /api/v1/dispatches/{id}/depart
    DS->>D: depart()
    D->>BU: markDispatched(DispatchId): RESERVED → DISPATCHED
    H->>DS: POST /api/v1/dispatches/{id}/deliver {recipientName}
    DS->>D: deliver()
    D->>BU: markDelivered(): DISPATCHED → DELIVERED
    D->>RS: markFulfilled(): CONFIRMED → FULFILLED
    D-->>H: 200 ApiResponse
```

---

## 4. Sequence — donation to inventory

```mermaid
sequenceDiagram
    actor B as Bank Staff
    participant DC as DonationController
    participant DS as DonationService
    participant UF as DonationUnitFactory
    participant BR as BloodUnitRepository
    participant IC as InventoryController
    participant IS as InventoryService
    participant OB as OutboxPort / AuditPort

    B->>DC: POST /api/v1/donations {donorId, ...}
    DC->>DS: record(...)
    DS-->>B: Donation RECORDED

    B->>DC: POST /api/v1/donations/{id}/screen {passed, notes}
    DC->>DS: screen(...)
    DS-->>B: SCREENING_PASSED or SCREENING_FAILED

    B->>DC: POST /api/v1/donations/{id}/approve
    DC->>DS: approve(...) @Transactional
    DS->>DS: guard status == SCREENING_PASSED
    DS->>UF: createFrom(donation, requirements)
    UF-->>DS: BloodUnit(s) COLLECTED, released=false, donationId set
    DS->>BR: saveAll(units)
    DS->>OB: DonationApproved + audit (same transaction)
    DS-->>B: units created

    B->>IC: POST /api/v1/inventory/{id}/release
    IC->>IS: release(unitId) @Transactional
    IS->>BR: lockByIdForUpdate(unitId)
    IS->>IS: guard bank verified/active, screening cleared, not expired
    IS->>IS: COLLECTED → AVAILABLE, released=true, append Movement
    IS->>OB: BloodUnitReleased + audit (same transaction)
    IS-->>B: BloodUnitView status AVAILABLE

    B->>IC: GET /api/v1/inventory?bloodGroup=...&expiringWithinDays=7
    IC-->>B: PageResponse~BloodUnitView~
```

---

## 5. Activity — allocation advisory flow

```mermaid
flowchart TD
    A[Emergency request created] --> B{Status PENDING_APPROVAL?}
    B -- no --> Z[409 conflict]
    B -- yes --> C[Authorized approver approves request]
    C --> D[Status APPROVED]
    D --> E[POST /allocations/suggestions requestId]
    E --> F[Query AVAILABLE units matching bloodGroup and componentType]
    F --> G[Score: exact match, expiry soonest, site proximity]
    G --> H[Return advisory candidates — no writes, no locks]
    H --> I{Staff accepts candidates?}
    I -- no --> J[Record decision, request remains APPROVED]
    I -- yes --> K[POST /allocations/confirm with idempotencyKey]
    K --> L{Key replay?}
    L -- yes --> M[Return stored response, no new side effects]
    L -- no --> N[Lock selected units in id order]
    N --> O{All units AVAILABLE and in scope?}
    O -- no --> P[Rollback, 409 conflict]
    O -- yes --> Q[Create reservations PENDING + outbox + audit]
    Q --> R[Confirm reservation, then create dispatch]
    R --> S[Deliver: unit DELIVERED, reservation FULFILLED, request FULFILLED when all items met]
```

---

## 6. State — BloodUnit

```mermaid
stateDiagram-v2
    [*] --> COLLECTED : donation approve / manual create
    [*] --> SCREENING : manual create
    [*] --> QUARANTINED : manual create
    COLLECTED --> AVAILABLE : release()
    SCREENING --> AVAILABLE : release()
    QUARANTINED --> AVAILABLE : release()
    SCREENING --> DISCARDED : discard() internal
    QUARANTINED --> DISCARDED : discard() internal
    AVAILABLE --> RESERVED : reserve(reservationId)
    RESERVED --> AVAILABLE : releaseReservation / cancel / expire
    RESERVED --> DISPATCHED : markDispatched(dispatchId)
    DISPATCHED --> DELIVERED : markDelivered()
    COLLECTED --> EXPIRED : expire()
    SCREENING --> EXPIRED : expire()
    QUARANTINED --> EXPIRED : expire()
    AVAILABLE --> EXPIRED : expire()
    RESERVED --> EXPIRED : expire()
    DISPATCHED --> EXPIRED : expire()
    DELIVERED --> [*]
    EXPIRED --> [*]
    DISCARDED --> [*]
```

---

## 7. State — EmergencyRequest

```mermaid
stateDiagram-v2
    [*] --> PENDING_APPROVAL : POST /emergency-requests
    PENDING_APPROVAL --> APPROVED : approve() REQUEST_APPROVE
    PENDING_APPROVAL --> REJECTED : reject(reason)
    PENDING_APPROVAL --> CANCELLED : cancel() owner/staff
    APPROVED --> CANCELLED : cancel() with no active dispatch
    APPROVED --> FULFILLED : all request items delivered
    REJECTED --> [*]
    CANCELLED --> [*]
    FULFILLED --> [*]
```

---

## 8. State — Reservation

```mermaid
stateDiagram-v2
    [*] --> PENDING : POST /reservations or /allocations/confirm (idempotent)
    PENDING --> CONFIRMED : confirm()
    PENDING --> CANCELLED : cancel()
    PENDING --> EXPIRED : TTL elapsed, unit released
    CONFIRMED --> CANCELLED : cancel() before dispatch
    CONFIRMED --> FULFILLED : dispatch delivered
    CANCELLED --> [*]
    EXPIRED --> [*]
    FULFILLED --> [*]
```
