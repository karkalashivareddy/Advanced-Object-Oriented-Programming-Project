# ADR-001: Modular Monolith

**Status:** Accepted; implemented in Phase 2 (2026-11-23) with the deviations noted below.
**Date:** 2026-11-23
**Related:** [`../SYSTEM_ARCHITECTURE.md`](../SYSTEM_ARCHITECTURE.md), [`../DOMAIN_MODEL.md`](../DOMAIN_MODEL.md)

## Context

LifeLink is a greenfield academic project with one developer, a course timeline, and a strong requirement to demonstrate object-oriented boundaries. The domain has twelve cohesive capabilities (identity, organization, donor, donation, inventory, emergency, allocation, reservation, dispatch, notification, audit, analytics) that must share transactional consistency: approving a donation creates units; confirming an allocation reserves units; delivering a dispatch closes a reservation and possibly a request. The initial audit confirmed there is no existing code or infrastructure to migrate.

## Decision

Build **one Spring Boot deployable** containing twelve business packages under `com.lifelink.<module>`, sharing one PostgreSQL database and one Flyway migration set. Modules call each other through Spring service beans, never over HTTP. The React/TypeScript SPA is a separately built static client using only `/api/v1` (plus STOMP over `/ws`).

The original design text proposed `api`/`application`/`domain`/`infrastructure` sub-packages, typed identifiers, and domain events for every module. The shipped code uses flat packages with JPA entities, `Long` identifiers, and a narrower notification-only outbox; see Implementation status.

## Implementation status (2026-11-23)

- Implemented: one Spring Boot 3.5.16 backend, one PostgreSQL database with Flyway `V1`–`V4`, and a separately built nginx-served SPA. Modules exchanged state through service beans and shared entities.
- Deviated from the original design: no `api`/`application`/`domain`/`infrastructure` sub-packages, no typed id wrappers, no published per-module application interfaces, and no domain event bus for all aggregates.
- Architecture tests (for example ArchUnit) were not added; boundary conformance is reviewed from source and covered indirectly by service/security tests.
- Local Docker Compose and Maven Wrapper builds were exercised; a GitHub Actions workflow is not installed (the file in `deployment/` is a template). No production deployment is claimed.

## Consequences

**Positive**

- State changes spanning donation approval, reservation, and dispatch can be committed in one local transaction without distributed coordination.
- Package boundaries make SOLID and pattern usage inspectable in a single repository, which suits the course assessment.
- One build, one set of health probes, one deployment unit, and simple local startup.
- Refactoring a module boundary is a code change, not a network protocol migration.

**Negative**

- All modules scale together; a hot analytics query competes with reservation writes unless read paths are optimised.
- A careless import can bypass a boundary; architecture tests are required to keep it honest.
- A future high-scale deployment would need deliberate extraction of modules, especially inventory and notification.

## Alternatives

| Alternative | Why not chosen |
| :--- | :--- |
| Microservices per module | Distributed transactions and eventual consistency would obscure the domain invariants that are central to the assignment; too much operational cost for one developer. |
| Layered single package with no module boundaries | Would hide cohesion and make the OOP mapping and architectural review weak. |
| Serverless functions with a managed database | Cold starts, fragmented transaction boundaries, and limited local reproducibility. |
| External workflow engine / BPM tool | Would move state machines out of domain classes, weakening the object-oriented demonstration. |
