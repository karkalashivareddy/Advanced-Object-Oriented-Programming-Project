# AOOP Implementation Map — LifeLink Current Tree

**Date:** 27 November 2026  
**Branch:** `feature/lifelink-bloodstream-experience`  
**Working-tree HEAD:** `566e14071675716c9b507e8df37751a92fd139cf`  
**Status:** current evidence map for the uncommitted redesign increment. This document maps **code that exists**, not a planned architecture. Earlier dated mappings are preserved in [`../academic/AOOP_CONCEPT_MAPPING.md`](../academic/AOOP_CONCEPT_MAPPING.md) and [`../academic/AOOP_SYLLABUS_IMPLEMENTATION_MATRIX.md`](../academic/AOOP_SYLLABUS_IMPLEMENTATION_MATRIX.md).

> **Nearby donor discovery is an operational assistance feature. Final donor eligibility, blood compatibility and clinical decisions require authorized clinical verification.**

> **Red blood cell compatibility. Plasma and platelet compatibility follow different rules (e.g., AB plasma is the universal plasma donor type), and final matching always requires crossmatching by clinical staff.**

## 1. Scope and authority boundary

Java 21 / Spring Boot 3.5 remains the assessment language and the only layer allowed to make business, authorization, compatibility, transaction, and persistence decisions. React 19 / TypeScript is a presentation client: it calls `REST /api/v1`, renders guarded states, and never decides eligibility, permission, or inventory correctness. Client permission checks hide controls only; the backend is authoritative.

The frontend `src/lib/bloodCompatibility.ts` is an **illustrative red-cell-only teaching matrix** used by the public atlas and design kit. It is not the allocation engine, not a clinical decision table, and not evidence of FHIR conformance. It explicitly excludes plasma, platelets, and crossmatching.

Current executed gate results are recorded in [`../quality/TEST_RESULTS.md`](../quality/TEST_RESULTS.md); browser evidence is in [`../evidence/PLAYWRIGHT_RESULTS.json`](../evidence/PLAYWRIGHT_RESULTS.json). The current backend rerun completed with 135 tests run, 0 failures, 0 errors, and 8 skipped; the skips are the Docker-dependent PostgreSQL Testcontainers classes because the Docker daemon was unavailable. Earlier Docker-backed PostgreSQL evidence remains historical and is not relabelled as current.

## 2. Core AOOP concepts

| Concept | Implemented code | Why it matters | Test evidence |
| --- | --- | --- | --- |
| Encapsulation and invariants | `inventory/BloodUnit.java` guarded `release`, `reserve`, `clearReservation`, `dispatch`, `deliver`, `markExpired`, `discard`; `emergency/EmergencyRequest.java` guarded transitions | Private state cannot be mutated into an illegal workflow state | `domain/BloodUnitTest.java`, `domain/EmergencyRequestTest.java` |
| Immutable value object | `common/GeoPoint.java` validates bounds and exposes distance/bounding-box behaviour without setters | Geographic input is converted once into a validated value before any search | `common/GeoPointTest.java`, `donor/DonorDiscoveryServiceTest.java` |
| Records and DTOs | `common/ApiResponse.java`, `PageResponse.java`, `ErrorResponse.java`; `allocation/AllocationContext.java`, `AllocationCandidate.java`; module `dto/*Dtos.java`; `donor/dto/NearbyDonorView.java` | Compact immutable carriers with boundary validation and value equality | `identity/ControllerValidationTest.java`, API integration assertions |
| Inheritance | `common/BaseEntity.java` → persisted aggregates; `common/exception/LifeLinkException.java` → typed exception hierarchy | Shares `publicId`, timestamps, optimistic version, and error metadata without duplication | `integration/SchemaAndApiIntegrationTest.java`, `concurrency/ConcurrencyExceptionMappingTest.java` |
| Abstraction | Spring Data repositories; `AllocationStrategy`, `CompatibilitySpecification`, `NotificationChannel` | Services depend on contracts rather than concrete persistence or policy classes | Mockito-based service/security tests and `allocation/CompatibilitySpecificationSelectionTest.java` |
| Polymorphism | `FeefoStrategy`; `StrictSameGroupSpecification`, `ConfiguredCompatibilitySpecification`; `InAppNotificationChannel`, `UnconfiguredProviderChannel` | Same call site, selectable behaviour | `CompatibilitySpecificationSelectionTest.java`, integration workflow tests |
| Generics and collections | `ApiResponse<T>`, `PageResponse<T>`, `PageResponse.from(Page<E>, Function<E,T>)`; immutable `Set.copyOf(...)` and `List.copyOf(...)` snapshots | Type-safe envelopes and defensive copies | API tests and `identity/JwtServiceTest.java` |
| Enums and finite state | `BloodGroup`, `ComponentType`, nested unit/request/reservation/dispatch/donation statuses, `Role`, `Permission` | Exact contract literals and legal-state modelling | Domain, validation, and integration tests |
| Lambdas and streams | `FeefoStrategy.evaluate`, deterministic sorted unit locks in allocation confirmation, `PageResponse.from` | Declarative ranking/mapping; deterministic lock order avoids deadlock | `PostgresIdempotencyConcurrencyTest.java`, `SchemaAndApiIntegrationTest.java` |
| `Optional` | Repository lookups force explicit absence decisions | Missing records become documented 404/no-op outcomes | Integration tests |
| Exceptions | `ErrorCode`, typed hierarchy, `GlobalExceptionHandler`, `ErrorResponse` | Stable 400/401/403/404/409/429/500 bodies without leaking SQL or stack traces | `ConcurrencyExceptionMappingTest.java`, `ControllerValidationTest.java` |

## 3. Design patterns actually present

| Pattern | Classes | Demonstrated behaviour |
| --- | --- | --- |
| Strategy | `AllocationStrategy` / `FeefoStrategy` | Advisory ranking selects compatible units by rejection count, expiry, then id. |
| Specification | `CompatibilitySpecification` / strict and configured implementations | A named predicate encapsulates blood-group compatibility; the configured implementation is selected by property. |
| Repository | Spring Data interfaces; pessimistic-lock finders such as `BloodUnitRepository.findByIdForUpdate` | SQL and row-locking intent stay behind collection-like contracts. |
| DTO / assembler boundary | `PageResponse.from(...)`, DTO records, privacy-limited `NearbyDonorView` | Entities do not leak directly; nearby search deliberately omits identity, contact, and coordinates. |
| Transactional Outbox / narrow Observer | `NotificationService` writes `Notification` + `OutboxEvent`; `LifecycleScheduler` drains; `InAppNotificationChannel` delivers | Commit and notification intent are atomic; delivery is retried separately. This is **not** a generic event bus. |
| Idempotency Key | `IdempotencyKeys`, idempotency records, reservation/dispatch confirm endpoints | Replays return the original result; divergent payloads are rejected. |
| State/transition guard | Entity methods plus service precondition checks | A caller cannot bypass lifecycle rules by assigning fields. |

Not present and not claimed: `BloodUnitFactory`, `AbstractAllocationStrategy`, `ExactMatchStrategy`, `ExpirySoonestStrategy`, `SiteProximityStrategy`, `AllocationFacade`, Template Method hierarchy, generic domain-event bus, ArchUnit suite, reflection-based “no public setters” tests, typed ID wrappers, or a framework-free domain layer.

## 4. SOLID evidence

| Principle | Evidence | Honest boundary |
| --- | --- | --- |
| Single Responsibility | Donation screening, inventory state, audit persistence, authorization, and analytics aggregation live in separate services and entities. | Some application services still coordinate several steps by design. |
| Open/Closed | New ranking or compatibility behaviour can be added behind existing interfaces; configured specification is property-driven. | No automated “add a new strategy” test exists; evidence is source + selection test. |
| Liskov Substitution | Exception subclasses preserve `ErrorCode` mapping; notification channels preserve one send contract. | Substitution is exercised by mocks/configuration, not a dedicated substitution suite. |
| Interface Segregation | One-method strategy/specification/channel contracts; narrow repository interfaces. | Spring Data repositories remain framework-coupled. |
| Dependency Inversion | Constructor injection into services and strategies. | Framework coupling to Spring annotations remains explicit. |

## 5. Syllabus-oriented module map

| Module | Implemented evidence | Test/demo path |
| --- | --- | --- |
| M1 Modelling | Validated `GeoPoint`; guarded `BloodUnit` and `EmergencyRequest` transitions; enum-modelled lifecycles | `GeoPointTest`, `BloodUnitTest`, `EmergencyRequestTest` |
| M2 Contracts | Documented nearby-discovery preconditions; idempotent reservation/dispatch commands; typed API envelopes and error codes | `DonorDiscoveryServiceTest`, `SchemaAndApiIntegrationTest`, `ControllerValidationTest` |
| M3 SOLID/patterns | Strategy, Specification, Repository, DTO, narrow outbox/observer | `CompatibilitySpecificationSelectionTest`, service/controller tests |
| M4 Failure handling | Validation → `400`, typed domain failures → documented status, `409` on lock/integrity races, bounded outbox retry, process-local rate guards | `ConcurrencyExceptionMappingTest`, `OutboxRetryTerminationTest`, `AuthRateLimitFilterTest` |
| M5 Runtime/persistence | Flyway `V1`–`V6`, Hibernate `ddl-auto=validate`, pessimistic locks, optimistic version, deterministic lock ordering, additive geo columns/indexes | `SchemaAndApiIntegrationTest`, PostgreSQL Testcontainers concurrency and repository tests |
| M6 Architecture/delivery | Package-separated modular monolith, REST `/api/v1`, authenticated STOMP invalidation, Actuator, OpenAPI, React presentation boundary | `TEST_RESULTS.md`, browser suite, `SYSTEM_ARCHITECTURE.md`, `API_CONTRACTS.md` |

Spring Modulith's official documentation defines provided APIs, implementation internals, required interfaces, and `ApplicationModules.verify()`. That toolkit is **not installed** here; module boundaries are package conventions, so formal module verification is not claimed.

## 6. Current geospatial and privacy additions

- Flyway `V6` adds donor/organization location columns, freshness, bounds checks, and indexes.
- `GeoPoint` rejects invalid latitude/longitude and provides Haversine distance plus conservative bounding-box logic.
- Consent grant writes coordinates; revocation clears coordinates and freshness in the same transaction.
- `GET /api/v1/donors/nearby` checks selected-organization permission, consent, availability, freshness, bbox, exact distance, ordering, and a 50-result cap.
- Client displays coarse distance bands and `0.02°` cells; no exact donor coordinates, names, or contact data are returned.
- The nearby note above is rendered in the landing page and the authenticated nearby page; the RBC note above is rendered in the compatibility atlas, allocations page, design kit, and asserted by tests.

The SQL is portable bbox + Haversine rather than PostGIS. PostgreSQL-specific geodetic options remain a documented future choice, not an implemented capability.

## 7. Frontend evidence boundary

Frontend tests cover the API envelope/error contract, single-flight refresh, organization scope with no first-membership fallback, route guards, cache invalidation roots, form rules, the 64-pair illustrative RBC matrix with the exact note, brand/layout keyboard behaviour, registration validation, and UI states. Browser evidence covers live dashboard data, bounded donor queries, donation options, request filtering, mobile navigation, overflow, STOMP plus REST polling, keyboard flow, reduced motion, forced colors, and axe A/AA scans on public pages.

No frontend test establishes business authorization. UI permission checks are advisory and server-side checks remain authoritative.

## 8. Demonstration sequence for a lecturer

1. Construct an invalid `GeoPoint`; show constructor validation and the unit test.
2. Sign in as a donor and grant `LOCATION_DISCOVERY`; revoke it and show coordinate clearing in one transaction.
3. Search from an explicitly selected organization; show the opaque nearby result, distance band, freshness, and exact clinical note.
4. Inspect `DonorProfileRepository.findNearbyOptedIn`; point out consent, freshness, bbox, radius, ordering, and cap all happen in the database.
5. Compare allocation suggestion (advisory strategy/specification) with allocation confirmation (authenticated, transactional, idempotent service).
6. Show the public RBC atlas; state the exact RBC note and explain why plasma/platelets and crossmatching are excluded.

## 9. Non-claims

- No clinical eligibility determination, crossmatching, or production blood-service integration.
- No FHIR compliance; no core FHIR `BloodService` resource exists and no tested mapping/CapabilityStatement is present.
- No Lighthouse, load, soak, penetration, backup/restore, or formal WCAG conformance certification.
- No Vaadin/JavaFX/Swing migration; no duplication of critical business rules in React.
- No Spring Modulith/ArchUnit structural verification and no claim that every planned AOOP pattern from earlier lab documents was adopted.
