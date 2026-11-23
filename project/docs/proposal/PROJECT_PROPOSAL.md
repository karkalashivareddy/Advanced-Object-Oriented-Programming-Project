# LifeLink — Project Proposal

**Course:** Advanced Object-Oriented Programming  
**Student:** Karkala Shiva Reddy (2520030105)  
**Document status:** Proposed design scope. This document specifies what will be built; it is **not** a claim that the system is implemented.  
**Authority:** API shapes, paths, status codes, and permissions come from [`../architecture/API_CONTRACTS.md`](../architecture/API_CONTRACTS.md). Where this proposal and the contract appear to disagree, the contract wins.

---

## 1. Abstract

LifeLink is a blood bank coordination platform that connects donor registration, donation screening, blood unit inventory, hospital emergency requests, allocation, reservation, dispatch, notification, audit, and analytics in one system. It is designed as a modular-monolith Spring Boot service with a React/TypeScript single-page application. The backend is organised into twelve business modules that share one relational database but expose explicit application interfaces and domain-owned state transitions.

The academic goal is to demonstrate advanced object-oriented design on a problem with real invariants: a blood unit must not be reserved twice, a donation must not be approved without a passed screening, an emergency request must not be fulfilled by units that were never dispatched, and every tenant must see only its own data. These rules are enforced in domain objects, constrained in the database, and checked again at the API boundary.

## 2. Problem statement

Blood distribution involves several independent actors — donors, blood banks, inventory staff, hospitals, and medical staff — whose actions must stay consistent. In a paper- or spreadsheet-driven process:

- a unit can be promised to two hospitals because availability is checked before it is locked;
- a donation can be approved without a recorded screening result;
- an expired or quarantined unit can be issued;
- a request can be marked fulfilled without a traceable reservation and dispatch;
- a user of one organization can see another organization's stock or donor data;
- there is no durable audit trail explaining who changed a unit's state and why.

These are consistency, traceability, and authorization problems as much as workflow problems. A solution must make illegal state transitions impossible in the object model, serialize the few genuinely contended writes, and keep an append-only record of decisions.

## 3. Objectives

| ID | Objective |
| :--- | :--- |
| O1 | Model the blood supply chain as explicit aggregates whose invariants are enforced by guarded domain methods, not by UI checks. |
| O2 | Provide the REST contract in `API_CONTRACTS.md` through a layered Spring Boot application (API → application → domain → infrastructure). |
| O3 | Enforce role- and organization-scoped authorization on every protected endpoint. |
| O4 | Prevent double reservation and double dispatch with database constraints, row locking, and optimistic versioning. |
| O5 | Preserve end-to-end traceability: donor → donation → blood unit → reservation → dispatch. |
| O6 | Publish notifications and audit records through a transactional outbox so a state change is never recorded without its consequences. |
| O7 | Build a React/TypeScript SPA whose journeys follow the same contract and whose permission checks are cosmetic only. |
| O8 | Demonstrate the course learning outcomes (encapsulation, abstraction, inheritance, polymorphism, SOLID, patterns, generics, exceptions, concurrency, persistence, testing) in code that can be mapped and examined. |
| O9 | Supply automated tests at domain, application, web, persistence, and frontend component levels, plus documented local run steps. |

**Non-objectives:** maximal throughput, multi-region deployment, clinical decision support, and regulatory certification. This is an academic system with realistic domain rules, not a medical device.

## 4. Scope

### 4.1 In scope

| Module | Planned capability |
| :--- | :--- |
| identity | Registration, login, access/refresh token rotation, password change, user listing and status management. |
| organization | Blood bank and hospital profiles, verification, membership management. |
| donor | Donor profiles, consent records, appointment requests and staff decisions. |
| donation | Donation records, screening review, approval that creates units, rejection with reason. |
| inventory | Unit creation, release, expiry, adjustments, movement history, low-stock and expiring alerts. |
| emergency | Emergency request creation, approval, rejection, cancellation, detail with items and events. |
| allocation | Advisory candidate evaluation and idempotent confirmation that produces reservations. |
| reservation | Idempotent creation, confirmation, cancellation with unit release. |
| dispatch | Dispatch from a confirmed reservation, depart, deliver, incident recording. |
| notification | Per-user notification inbox, unread count, mark-as-read. |
| audit | Append-only audit log queryable by actor, action, time range, and outcome. |
| analytics | Role- and organization-scoped overview, inventory, and request metrics. |

### 4.2 Out of scope

- External SMS/email gateways, push providers, or real delivery integrations; notifications are persisted in-app.
- Payment, insurance, billing, or donation incentive schemes.
- Machine-learning demand forecasting or automatic clinical matching; allocation suggestions are advisory and rule-based.
- Mobile native applications, public dashboards without login, and anonymous browsing of stock.
- Multi-service/microservice deployment, service mesh, event streaming platform, or SaaS tenancy billing.
- Production-grade backup automation, disaster recovery, penetration testing, and regulatory approval.
- Editing historical audit entries; audit is append-only by design.
- Any production use of the seeded demo accounts described in the user guide.

## 5. Functional requirements

| ID | Requirement | Primary module | Contract anchor |
| :--- | :--- | :--- | :--- |
| FR-01 | A user can register, log in, refresh tokens, log out, change a password, and read their own profile. | identity | `/auth/*`, `/auth/me` |
| FR-02 | Authorized staff can list users and change a user's status. | identity | `/users`, `/users/{id}/status` |
| FR-03 | Organizations can be created, read, updated, verified, and have members added/listed. | organization | `/organizations*` |
| FR-04 | Donor profiles and consent records can be created and read by the owner or authorized staff. | donor | `/donors*`, `/donors/{id}/consents` |
| FR-05 | Appointment requests can be requested, confirmed, rejected, completed, or cancelled. | donor | `/donors/{id}/appointments`, `/donors/appointments/{id}` |
| FR-06 | Donations can be recorded, screened (`passed` + notes), approved (creating blood units), rejected with a reason, and traced to their units. | donation | `/donations*` |
| FR-07 | Inventory can be filtered, created manually, released, expired, adjusted, and inspected for movements and alerts. | inventory | `/inventory*` |
| FR-08 | Emergency requests can be created with items, approved, rejected, cancelled, and viewed with events. | emergency | `/emergency-requests*` |
| FR-09 | The system can suggest candidate units for an approved request; suggestions are advisory and never mutate inventory. | allocation | `/allocations/suggestions` |
| FR-10 | An authorized user can confirm an allocation with `idempotencyKey`, producing reservations for the chosen units. | allocation, reservation | `/allocations/confirm`, `/reservations` |
| FR-11 | Reservations can be confirmed or cancelled; cancellation releases the unit. | reservation | `/reservations/{id}/confirm`, `/reservations/{id}/cancel` |
| FR-12 | A dispatch can be created from a confirmed reservation, marked in transit, delivered with a recipient name, or flagged with an incident. | dispatch | `/dispatches*` |
| FR-13 | A user can read their own notifications, see an unread count, and mark a notification read. | notification | `/notifications*` |
| FR-14 | Authorized users can query immutable audit logs and scoped analytics. | audit, analytics | `/audit-logs`, `/analytics/*` |

## 6. Non-functional requirements

| ID | Requirement | Planned verification |
| :--- | :--- | :--- |
| NFR-01 | Every protected endpoint validates a bearer token; unauthenticated requests receive 401, unauthorized requests 403. | Web/API slice tests with and without credentials. |
| NFR-02 | All queries and writes are scoped by organization; only `PLATFORM_ADMIN` may cross organizations where explicitly permitted. | Repository integration tests with two seeded tenants. |
| NFR-03 | No endpoint returns stack traces, SQL, credentials, or tokens other than the intended auth responses. | Error-handler tests and response assertions. |
| NFR-04 | Reservation creation, allocation confirmation, and dispatch creation are idempotent via `Idempotency-Key`. | Concurrency tests replaying the same key. |
| NFR-05 | A unit cannot be reserved twice; concurrent attempts yield at most one winner and one 409/optimistic-retry response. | Pessimistic-lock/version integration test. |
| NFR-06 | State-changing operations return 409 for illegal transitions rather than silently succeeding. | Domain transition tests for all aggregates. |
| NFR-07 | All timestamps are ISO-8601 UTC; list endpoints use the paginated envelope. | Contract tests for envelope shape. |
| NFR-08 | Correlation IDs propagate from request to log line, error response, audit entry, and outbox event. | Logging/observability test. |
| NFR-09 | The SPA targets WCAG 2.2 AA: keyboard navigation, labelled controls, visible focus, and text contrast. | Component tests plus manual keyboard walkthrough. |
| NFR-10 | Plaintext passwords and secrets never enter logs or the repository; demo credentials are local-profile only. | Configuration review and log assertions. |
| NFR-11 | Fast unit tests require no Docker; integration tests use H2 in PostgreSQL mode or optional Compose PostgreSQL. | Separately runnable test tasks. |
| NFR-12 | No UI permission check is treated as security; the server rechecks every permission and tenant scope. | API tests bypassing the UI. |

## 7. Personas

| Persona | Role(s) | Needs |
| :--- | :--- | :--- |
| Platform Administrator | `PLATFORM_ADMIN` | Verify organizations, manage users, inspect audit and cross-organization analytics. |
| Blood Bank Administrator | `BLOOD_BANK_ADMIN` | Manage bank staff, donors, donations, screening approval, and stock release. |
| Inventory Manager | `INVENTORY_MANAGER` | Search stock, release and adjust units, review expiring/low-stock alerts, inspect movements. |
| Hospital Administrator | `HOSPITAL_ADMIN` | Raise emergency requests, review allocation suggestions, confirm allocations, track dispatch. |
| Medical Staff | `MEDICAL_STAFF` | Confirm reservations, mark dispatch depart/delivery, record incidents, read request status. |
| Donor | `DONOR` | Maintain own profile, give/revoke consent, request and track appointments. |

Roles are claims on the token; fine-grained permissions (for example `INVENTORY_RELEASE`, `ALLOCATION_CONFIRM`) are server-side gates. A person may hold several memberships, each with a role in one organization.

## 8. Key use cases

| ID | Use case | Primary actor | Main flow (contract paths) |
| :--- | :--- | :--- | :--- |
| UC-01 | Donor books an appointment | Donor | `POST /donors/{id}/appointments` → staff `PATCH /donors/appointments/{id}` |
| UC-02 | Donation becomes available stock | Bank staff | `POST /donations` → `POST /donations/{id}/screen` → `POST /donations/{id}/approve` → `POST /inventory/{id}/release` |
| UC-03 | Hospital raises an emergency request | Hospital Admin | `POST /emergency-requests` → `POST /emergency-requests/{id}/approve` |
| UC-04 | Advisory allocation | Hospital/Bank staff | `POST /allocations/suggestions` → review candidates; no state change |
| UC-05 | Confirm allocation and reserve units | Authorized staff | `POST /allocations/confirm` with `idempotencyKey` → reservations `PENDING` |
| UC-06 | Confirm reservation | Medical staff | `POST /reservations/{id}/confirm`; unit becomes `RESERVED` |
| UC-07 | Dispatch and deliver | Medical staff | `POST /dispatches` → `POST /dispatches/{id}/depart` → `POST /dispatches/{id}/deliver` |
| UC-08 | Cancel and release | Owner/staff | `POST /reservations/{id}/cancel` → unit returns to `AVAILABLE` |
| UC-09 | Monitor alerts and metrics | Inventory Manager / Admin | `GET /inventory/alerts`, `GET /analytics/overview` |
| UC-10 | Receive a notification | Any authenticated user | `GET /notifications/unread-count` → `GET /notifications` → `POST /notifications/{id}/read` |

## 9. Academic integrity note

This is original academic work prepared for the Advanced Object-Oriented Programming course (Karkala Shiva Reddy, 2520030105). The three `LAB-WORK/` PDFs are course-provided reference material on classes/objects, invariants/value objects, and the five invariant doorways; they are read and cited as grounding, never modified or copied into the deliverable as code. The design documents describe an intended implementation; they do not assert that code, tests, or a running deployment already exist. External libraries and frameworks will be cited in the final report and used under their published licences. Demo accounts are development-only fixtures and are explicitly forbidden in production.

## 10. Definition of done (planned)

1. Proposal, architecture, domain model, ADRs, UML, concept mapping, and user guide are mutually consistent with the API contract.
2. Domain invariants and state transitions are implemented and covered by unit tests.
3. All contract endpoints are implemented with server-side authorization and tenant scoping, covered by web/API tests.
4. Concurrency and idempotency scenarios are covered by integration tests.
5. Frontend journeys follow the contract, use real API calls, and pass component tests.
6. Local build, test, and run instructions are verified and recorded.
