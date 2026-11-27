<div align="center">

# LifeLink — Advanced Object-Oriented Programming Project

### Java Spring Boot backend · React/TypeScript web interface

[![Course](https://img.shields.io/badge/Course-Advanced%20Object--Oriented%20Programming-1F6FEB?style=for-the-badge)](#)
[![Student](https://img.shields.io/badge/Student-Karkala%20Shiva%20Reddy-2EA043?style=for-the-badge)](#)
[![Student ID](https://img.shields.io/badge/ID-2520030105-8957E5?style=for-the-badge)](#)
[![Status](https://img.shields.io/badge/Status-Implemented%20local%20demo-16865B?style=for-the-badge)](#)

*A structured, version-controlled academic project demonstrating advanced object-oriented design in a Java backend with a polished React/TypeScript web interface.*

</div>

---

## Student Information

| Field | Details |
| :--- | :--- |
| **Student Name** | Karkala Shiva Reddy |
| **Student ID** | 2520030105 |
| **Subject** | Advanced Object-Oriented Programming |
| **Repository** | [Advanced-Object-Oriented-Programming-Project](https://github.com/karkalashivareddy/Advanced-Object-Oriented-Programming-Project) |
| **Project Title** | LifeLink — Blood Bank Coordination Platform |
| **Implementation status** | Implemented and verified locally; not a production deployment |
| **Last Updated** | 27 November 2026 |

> The abstract submission form also lists additional team members and administrative fields. Those fields are preserved in the corrected abstract source; any roster or faculty-detail discrepancy requires human confirmation and is not silently changed here.

---

## Project Overview

LifeLink coordinates the path from donor to delivery: donor profiles and consent records, donation screening, blood-unit inventory, hospital emergency requests, allocation suggestions, time-bound reservations, dispatch and delivery, notifications, audit records, and scoped analytics. The current interface presents this as **THE LIFELINK — VASCULAR INTELLIGENCE**, a continuous donor-to-delivery story with a dark cinematic public surface and a bright, high-density workspace.

The application is a **modular Java monolith with a separate static web client**:

- **Java 21 / Spring Boot 3.5.16** owns every business rule, entity invariant, validation, transaction, authorization decision, repository query, and analytics calculation.
- **React 19 / TypeScript 5.9 / Vite 7** provides the presentation layer: responsive pages, forms, tables, charts, role-aware navigation, loading/error/empty states, and reduced-motion support.
- **PostgreSQL 16** is the development/demo database, managed by Flyway migrations `V1`–`V6`.
- **REST `/api/v1`** is the client/server contract. Authenticated **SockJS/STOMP over `/ws`** supplies notification-cache invalidation; the REST inbox remains the authoritative notification path.

Java is the primary implementation language for the AOOP assessment. React/TypeScript is retained by explicit project decision for the web interface; the application is **not** described as Java-only or Vaadin-based. No C/C++ or Python module is part of the application.

---

## Current Technology Stack

| Area | Actual selection |
| :--- | :--- |
| Backend language | Java 21 |
| Backend framework | Spring Boot 3.5.16: Web MVC, Security, Data JPA/Hibernate, Validation, WebSocket/STOMP, Actuator, springdoc OpenAPI |
| Frontend | React 19, TypeScript 5.9, Vite 7.3, React Router 7, TanStack Query 5, Recharts 3, SockJS + STOMP.js, lucide-react, self-hosted Fraunces/Inter variable fonts, layered CSS design tokens |
| Database | PostgreSQL 16 (Docker Compose); H2 PostgreSQL mode and Testcontainers PostgreSQL in tests |
| Migrations | Flyway `V1`–`V6` with Hibernate `ddl-auto=validate` |
| Build | Maven Wrapper 3.9.11 (`project/backend`), npm (`project/frontend`) |
| Tests | JUnit 5, Mockito, Spring Boot Test, Testcontainers, Vitest, Playwright |
| Local runtime | Docker Compose with PostgreSQL, Spring Boot backend, and nginx-served SPA |
| Development host | Windows in this workspace; Linux-based container images are runtime packaging only |

---

## Repository Structure

```text
Advanced-Object-Oriented-Programming-Project/
├── README.md                         # This project overview
├── LAB-WORK/                         # Course lab PDFs and related work (preserved)
└── project/
    ├── backend/                      # Java 21 / Spring Boot Maven application
    │   └── src/main/java/com/lifelink/
    ├── frontend/                     # React/TypeScript Vite SPA
    │   ├── src/
    │   └── e2e/
    ├── docker/                       # Local Compose stack
    └── docs/                         # Architecture, academic mapping, evidence, reviews
```

The authoritative current-state record is
[`project/docs/reviews/CURRENT_STATE_ENGINEERING_AND_DESIGN_AUDIT.md`](project/docs/reviews/CURRENT_STATE_ENGINEERING_AND_DESIGN_AUDIT.md).

---

## Learning Outcomes Demonstrated in Java

- **Encapsulation:** `BloodUnit`, `EmergencyRequest`, `Reservation`, and `Dispatch` expose guarded transition methods instead of public state mutators.
- **Inheritance:** JPA aggregates extend `BaseEntity`; `LifeLinkException` is the base of the typed exception hierarchy.
- **Polymorphism:** `AllocationStrategy` and `CompatibilitySpecification` have interchangeable Java implementations.
- **Abstraction and interfaces:** repositories, strategies, notification channels, and DTO records separate contracts from implementations.
- **Exception handling:** `GlobalExceptionHandler` maps typed Java exceptions to stable API error codes.
- **Collections and generics:** `List<BloodUnit>`, `Set<Long>`, `Page<T>`, `Specification<T>`, and typed API envelopes are used throughout.
- **Design patterns:** Repository, Strategy, Specification, DTO, Transactional Outbox, and Idempotency Key.
- **Separation of concerns:** controllers, services, domain entities, repositories, security/configuration, and DTOs have distinct responsibilities.

See [`project/docs/academic/AOOP_CONCEPT_MAPPING.md`](project/docs/academic/AOOP_CONCEPT_MAPPING.md) for class-by-class evidence.

---

## Getting Started

### Prerequisites

- JDK 21 (the Maven Wrapper downloads Maven 3.9.11)
- Node.js 24 and npm 11
- Docker Desktop / Docker Compose (for the PostgreSQL-backed local stack)
- PowerShell on Windows, or an equivalent shell

### Run the complete local stack

```powershell
$env:JWT_SECRET = '<generate-a-long-random-development-secret>'
docker compose -f project/docker/docker-compose.yml up -d --build
```

Default loopback ports:

| Service | URL |
| :--- | :--- |
| SPA | `http://127.0.0.1:15173` |
| Backend health | `http://127.0.0.1:18080/actuator/health` |
| PostgreSQL | `127.0.0.1:15432` |

Demo seed accounts are development fixtures only; see
[`project/docs/user-guide/USER_GUIDE.md`](project/docs/user-guide/USER_GUIDE.md). Never use them in a real deployment.

### Backend tests

```powershell
cd project/backend
.\mvnw.cmd test
```

### Frontend checks

```powershell
cd project/frontend
npm ci
npm run typecheck
npm test -- --run
npm run build
npm audit --audit-level=high
```

### Browser tests

With the Compose backend available:

```powershell
cd project/frontend
$env:VITE_API_PROXY_TARGET = 'http://127.0.0.1:18080'
npm run test:e2e
```

---

## Verification evidence

The values below distinguish the previously verified baseline from the current local engineering increment. They are not a production-readiness claim.

| Gate | Recorded result |
| :--- | :--- |
| Backend current suite | `.\mvnw.cmd -B -ntp test` — **135 tests run, 0 failures, 0 errors, 8 skipped**. The skips are the Docker-dependent PostgreSQL Testcontainers classes because the Docker daemon was unavailable; earlier Docker-backed evidence is historical. |
| Frontend current increment | **54 tests in 11 files passed**; TypeScript typecheck and Vite production build passed (2,297 modules transformed); `npm audit --audit-level=high` found 0 vulnerabilities. |
| Playwright E2E | **46 executions passed** (23 specs × Chrome and Edge); includes authenticated dashboard/filtering, bounded donor search, paged donor-profile and donation-option consumption, mobile dialog focus/Escape, overflow checks, STOMP + REST polling, landing story, keyboard/breakpoints, forced colors, reduced motion, dev kit, axe public pages, and failed-resource diagnostics. |
| Accessibility | Axe WCAG A/AA scans reported **zero violations** on landing, login and registration in both browsers; this is route-level evidence, not full WCAG conformance. |
| Browser STOMP | Authenticated `CONNECT` with Bearer token, own-queue `SUBSCRIBE`, and `CONNECTED` frame observed; REST polling remains active |
| Local verification stack | Isolated H2 dev server applied Flyway `V1`–`V6` and loaded development demo seed; health returned HTTP 200 `UP`. |
| Corrected abstract | 4-page PDF in the original black-and-white submission form layout, with all 9 form sections, a 187-word abstract, and no replacement characters; original submission files preserved |

Full commands, evidence links, and limitations are in
[`project/docs/quality/TEST_RESULTS.md`](project/docs/quality/TEST_RESULTS.md).

---

## Documentation and Deliverables

- [Corrected abstract PDF](project/docs/abstract/LifeLink_Project_Abstract.pdf)
- [Editable abstract source](project/docs/abstract/LifeLink_Project_Abstract.docx)
- [Abstract PDF validation evidence](project/docs/evidence/ABSTRACT_PDF_VALIDATION.json)
- [Project proposal](project/docs/proposal/PROJECT_PROPOSAL.md)
- [System architecture](project/docs/architecture/SYSTEM_ARCHITECTURE.md)
- [API contracts](project/docs/architecture/API_CONTRACTS.md)
- [Domain model](project/docs/architecture/DOMAIN_MODEL.md)
- [UML and workflows](project/docs/architecture/UML.md)
- [AOOP concept mapping](project/docs/academic/AOOP_CONCEPT_MAPPING.md)
- [User guide](project/docs/user-guide/USER_GUIDE.md)
- [Deployment guide](project/docs/deployment/DEPLOYMENT_GUIDE.md)
- [Test results](project/docs/quality/TEST_RESULTS.md)
- [Known limitations](project/docs/quality/KNOWN_LIMITATIONS.md)
- [Product and engineering research](project/docs/reviews/LIFELINK_PRODUCT_AND_ENGINEERING_RESEARCH.md)
- [Full repository audit](project/docs/reviews/LIFELINK_FULL_REPOSITORY_AUDIT.md)
- [AOOP implementation map](project/docs/reviews/AOOP_IMPLEMENTATION_MAP.md)
- [Next-level implementation report](project/docs/reviews/LIFELINK_NEXT_LEVEL_IMPLEMENTATION_REPORT.md)
- [Browser evidence](project/docs/evidence/)

---

## Academic Integrity

This repository contains original academic work prepared for the Advanced Object-Oriented Programming course. The `LAB-WORK/` PDFs are course reference material and are preserved unchanged. External libraries and frameworks are used under their published licences. Demo credentials are local development fixtures and are explicitly forbidden in production.

---

## Author

**Karkala Shiva Reddy**  
Student ID: **2520030105**  
GitHub: [@karkalashivareddy](https://github.com/karkalashivareddy)

---

<div align="center">

*Java remains the central AOOP language; React/TypeScript provides the web interface.*

</div>
