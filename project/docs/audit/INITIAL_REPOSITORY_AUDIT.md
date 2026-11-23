# Initial Repository Audit — LifeLink

**Date:** 2026-11-23
**Repository:** `https://github.com/karkalashivareddy/Advanced-Object-Oriented-Programming-Project`
**Branch at audit time:** `main` (4 commits; HEAD `5d52463`)
**Auditor:** Engineering Lead (OpenCode)

> **Superseded note (2026-11-23):** This is a faithful record of the `main`-branch baseline (HEAD `5d52463`) and must not be read as the current state. Phase 2 work now lives on `feature/lifelink-enterprise-platform` (baseline Phase 1 HEAD `195e88a81b105baea69018e44f4b57f3f806937a`) with an uncommitted implementation: Spring Boot 3.5.16 backend, React frontend, Flyway `V1`–`V4`, tests, Docker Compose, and documentation. The "no implementation" statements below are historically accurate but obsolete. Current facts: [`../architecture/SYSTEM_ARCHITECTURE.md`](../architecture/SYSTEM_ARCHITECTURE.md), [`../architecture/API_CONTRACTS.md`](../architecture/API_CONTRACTS.md), [`../quality/TEST_RESULTS.md`](../quality/TEST_RESULTS.md), [`../../CHANGELOG.md`](../../CHANGELOG.md), and [`../quality/KNOWN_LIMITATIONS.md`](../quality/KNOWN_LIMITATIONS.md). CI is still not installed and no production deployment is claimed.

## 1. Method

The audit used direct filesystem inspection, `git status`, `git branch -a`, `git log --oneline`, a recursive file listing, a full read of `README.md`, and text extraction from all three PDFs in `LAB-WORK/`. No claim below is inferred from the README alone.

## 2. Verified repository contents

| Path | Type | Size / notes |
| :--- | :--- | :--- |
| `README.md` | Markdown | 8,647 bytes. Course metadata, planned architecture, roadmap. Project title is explicitly "To Be Finalized". |
| `LAB-WORK/PRACTICAL-1/Practical-1.pdf` | PDF | 604,367 bytes. Java classes/objects/constructors exercises (Student, Employee, etc.). |
| `LAB-WORK/PRACTICAL-2/Practical-2.pdf` | PDF | 536,460 bytes. Case study on hotel reservation invariants, value objects, typed identifiers. |
| `LAB-WORK/PRACTICAL-3/Practical-3.pdf` | PDF | 244,794 bytes. "The Five Invariant Doorways": public setters, escaping references, mutable collections, dishonest equality, constructor leaks. |

There were **no** Java sources, Maven/Gradle files, `package.json`, SQL, tests, CI workflows, Docker files, environment samples, or application configuration in the repository at the time of audit.

## 3. Implemented functionality at baseline

None. The repository is a documentation-only academic workspace. The README roadmap marks title selection, proposal, requirements, UML, implementation, tests, review, and submission as incomplete.

The lab PDFs are relevant academic context: they establish the student's existing grounding in constructor validation, private fields, intention-revealing domain methods, immutable value objects, and invariant protection. These themes are carried directly into the LifeLink domain model.

## 4. Git safety baseline

- `git status`: clean working tree; no uncommitted user changes to preserve.
- Branches: only `main` locally and `origin/main` remotely.
- No destructive Git operation is required.
- Implementation branch created before code changes: `feature/lifelink-enterprise-platform`.
- The original four commits and all existing files are preserved unchanged.

## 5. Toolchain verified on the execution machine

| Tool | Observed version | Assessment |
| :--- | :--- | :--- |
| Java | `25+37-LTS` | Available. Build targets Java 21 bytecode for framework compatibility. |
| Apache Maven | Not installed | A pinned Maven 3.9.11 distribution and Maven Wrapper will be added to the repository. |
| Node.js | `v24.19.0` | Available. |
| npm | `11.17.0` | Available. |
| Docker | `29.7.2` | Available; used for optional PostgreSQL/Redis runtime, not assumed for unit tests. |
| Python | 3.13 | Used only for PDF text extraction during the audit. |
| Network | Maven Central and npm registry reachable | Dependencies can be resolved. |

## 6. Build and test baseline

There was no build descriptor and no test suite, so no existing build or test command could be executed. This is a factual baseline, not a skipped step. The first verifiable build is recorded in `docs/quality/TEST_RESULTS.md` after the engineering foundation is created.

## 7. Missing functionality

The entire product is missing at baseline: identity and access management, organizations and tenant isolation, donor and donation workflows, blood inventory and expiry, emergency requests, allocation, reservations, dispatch, notifications, audit, analytics, REST API, web frontend, real-time delivery, deployment configuration, and automated tests.

## 8. Defects and risks observed at baseline

1. No executable application exists; the README's planned `src/` and `tests/` layout does not exist.
2. The README states an unconfirmed title and pending technology stack.
3. No `.gitignore` exists, so build artifacts would be committed accidentally.
4. No dependency pinning, CI, secrets handling, or documented runtime environment.
5. No tests or quality gates exist.

## 9. Recommended architecture

A **modular monolith** with explicit package boundaries and a single PostgreSQL database:

- Spring Boot REST API with layers: API → application/use-case → domain → infrastructure.
- Domain entities own state transitions and invariants; controllers never mutate domain state directly.
- Flyway-managed relational schema; PostgreSQL for deployed/local Compose use, H2 in PostgreSQL mode for fast local tests.
- BCrypt passwords, JWT access tokens, rotating refresh tokens, role + fine-grained permission checks, and organization-scoped repository queries.
- Pessimistic database locking plus optimistic versioning for inventory-critical operations.
- Transactional outbox for notifications/events with idempotent consumers.
- React + TypeScript SPA with a light, accessible design system and real API calls only.
- Automated tests at domain, service, web/API, and frontend component levels.

## 10. Implementation priorities

1. Domain invariants, schema, and transaction boundaries.
2. Authentication, authorization, permissions, and tenant isolation.
3. Inventory lifecycle and concurrency-safe reservation/allocation.
4. Complete request-to-delivery workflow.
5. Functional, accessible frontend with real API integration.
6. Tests, security review, documentation, and deployment verification.

## 11. Existing work that must be preserved

- `README.md` course/student metadata and academic integrity statement (it will be updated, not discarded).
- All three lab PDFs under `LAB-WORK/`.
- Git history and branch `main`.

## 12. Baseline conclusion

The baseline is a clean, documentation-only repository with no code to refactor or remove. All application work is greenfield, which removes migration risk but makes disciplined phasing and verification essential. Phase 0 is complete on the evidence above.
