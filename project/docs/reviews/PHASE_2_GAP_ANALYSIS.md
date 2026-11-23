# Phase 2 Gap Analysis — Preliminary Record

> **Dated supersession note (2026-11-23):** This document is a **historical baseline**,
> created before Phase 2 implementation. The findings, counts, dispositions, and
> "pending" statements below are preserved exactly as recorded at that time and are
> **not** the current status. The current authoritative status is
> [`PHASE_2_FINAL_REVIEW.md`](PHASE_2_FINAL_REVIEW.md) (all Phase F findings F-01…F-06
> resolved), [`../quality/TEST_RESULTS.md`](../quality/TEST_RESULTS.md), and the durable
> evidence under [`../evidence/`](../evidence/). Live STOMP and full-stack login are
> now **verified**, not pending. This is not a production-readiness claim.

Date: 2026-11-23  
Repository: `Advanced-Object-Oriented-Programming-Project`  
Branch: `feature/lifelink-enterprise-platform`  
HEAD verified at start: `195e88a81b105baea69018e44f4b57f3f806937a`  
Working tree verified at start: clean (no tracked, staged, or untracked changes)

This document is created **before implementation changes** so that Phase 2 work has a
recorded baseline. Source-level findings from the parallel audits are appended as
they complete. Nothing in this record is a production-readiness claim.

## 1. Verified baseline

### Git

- Branch and HEAD match the supplied report.
- Commit history is intact; no reset, rebase, force-push, or push was performed.
- Remote `origin` exists, but no remote operation was executed.

### Automated checks executed from this baseline

| Area | Command | Result |
| --- | --- | --- |
| Backend | `.\mvnw.cmd test -q` | 26 tests, 0 failures, 0 errors |
| Backend detail | Surefire reports | `BloodUnitTest` 6, `EmergencyRequestTest` 3, `SchemaAndApiIntegrationTest` 13, `StompAuthenticationInterceptorTest` 4 |
| Frontend | `npm test -- --run` | 18 tests in 3 files passed |
| Frontend | `npm run build` | TypeScript and Vite build passed |
| Frontend | `npm audit --audit-level=low` | 0 vulnerabilities |
| Compose syntax | `docker compose -f project/docker/docker-compose.yml config` | Valid; services `db`, `backend`, `frontend` |

### Environment capability probe

| Dependency | Observed state |
| --- | --- |
| Java | Java 25 host; project targets Java 21 |
| Node / npm | v24.19.0 / 11.17.0 |
| Docker CLI | 29.7.2 with Compose v5.4.0 |
| Docker daemon | Initially unavailable at `npipe:////./pipe/dockerDesktopLinuxEngine`; started via `docker desktop start`; `docker info` then reported server 29.7.2 / overlayfs |
| Standalone `psql` | Not installed on PATH |
| `make` | Not installed on PATH |
| Browser binaries | Chrome and Edge are installed |
| Playwright | Not installed in `project/frontend`; no E2E suite present |
| GitHub CLI | 2.97.0 available; GitHub Actions execution still requires a remote runner and is not a local command |

Because the Docker daemon could be started, Docker image builds, Compose startup,
and a PostgreSQL-backed run are no longer assumed blocked. They must still be
executed and recorded.

## 2. High-level gaps inherited from Phase 1

1. **Premium frontend finish.** The existing SPA is functional and builds cleanly,
   but the prior review only established functionality, not premium visual quality,
   responsive polish, accessibility, motion, skeleton states, or screen-by-screen
   browser inspection.
2. **Browser E2E absence.** No Playwright suite exists. Browser binaries do, so a
   real-browser E2E harness is feasible.
3. **PostgreSQL runtime absence.** Backend tests used H2 in PostgreSQL mode. The
   Compose PostgreSQL profile had not been executed.
4. **Concurrency evidence gap.** A two-request H2 idempotency test exists, but no
   PostgreSQL-backed contention test, lock-order analysis, deadlock review, or
   isolation-level evidence exists.
5. **Security assurance gap.** Prior fixes addressed known findings, but no fresh
   independent security audit has been recorded against the current tree.
6. **Documentation drift.** Existing quality docs still describe Docker as
   unavailable and do not cover Phase 2 verification, concurrency analysis, or a
   final independent review.
7. **Production verification gap.** Docker images and Compose were not yet built or
   started in this phase; live STOMP and GitHub Actions remain unexecuted.

## 3. Source-level audit status

Parallel read-only audits were launched before any implementation change:

- Backend architecture, transactions, concurrency, and security — **complete**.
- Frontend UX, design system, responsiveness, accessibility, and screen coverage — **complete**.
- Documentation, tests, and DevOps assets — in progress.
- Independent security audit — in progress.

File ownership for implementation will be separated across agents and the
primary session to avoid conflicting edits.

### 3.1 Backend gap analysis (static review)

Highest-priority findings:

| Severity | Finding | Evidence |
| --- | --- | --- |
| Critical | Failed-login counters are rolled back when `AuthenticationFailedException` is thrown from a `@Transactional` login method, making the five-attempt lockout ineffective. | `identity/AuthService.java` login method and `common/exception/LifeLinkException.java` |
| Critical | Allocation replay matches only `key:index`; it does not bind the key to `requestId` or the unit-ID set, so a reused key can return the wrong reservations. | `allocation/AllocationService.java` confirmation loop |
| Critical/High | Dispatch authorization is evaluated against the requesting organization, while seeded blood-bank staff hold `DISPATCH_CREATE` in the supplying organization. Platform-admin tests hide this. | `dispatch/DispatchService.java`, `identity/Role.java`, `common/DevelopmentDataSeeder.java`, workflow test |
| High | Unique-constraint races on reservation/dispatch keys produce unmapped 500 responses; `DataIntegrityViolationException` and lock exceptions are not translated to 409. | `common/GlobalExceptionHandler.java`, dispatch and reservation repositories |
| High | No PostgreSQL/Testcontainers concurrency infrastructure; existing two-request test uses H2 and only one key. | `src/test/resources/application-test.yml`, `pom.xml`, integration test |
| High/Medium | Reservation replay is not bound to the requested unit/request and can return a foreign reservation if a key is known. | `reservation/ReservationService.java` |
| Medium/High | `AuditService.record` uses `REQUIRES_NEW`, so an audit row can commit although the business transaction later rolls back. | `audit/AuditService.java` |
| Medium | `InventoryService.findForUpdate` is declared `readOnly` while executing `SELECT ... FOR UPDATE`. | `inventory/InventoryService.java`, `BloodUnitRepository.java` |
| Medium | V2 already had a unique active-reservation pointer on `blood_units`; Phase 2 adds a second sparse slot on reservations and unit-status CHECK constraints, plus a persisted fingerprint/response idempotency table in V4. | `db/migration/V2__operational_schema.sql`, `V4__integrity_and_idempotency.sql` |
| Medium | Allocation DTOs, member requests, and status requests lack validation; header/body idempotency-key divergence is accepted; page size is unbounded. | `allocation`, `organization`, `identity` controllers |
| Medium | Access-tokens needed `jti`/version so password changes and disable revoke existing access tokens; Phase 2 adds both and checks the user's current token version on each request. | `identity/JwtService.java`, `AuthService.java` |
| Medium | Multi-org users see only one arbitrary organization’s audit logs. | `audit/AuditController.java` |
| Low/Medium | Lifecycle batches are fragile, lock timeouts are unset, and candidate locks are taken in caller order rather than sorted order. | `inventory`, `reservation`, `allocation` services |

Positive findings preserved: feature packaging, aggregate state methods,
specification/strategy use, refresh-token hashing and rotation, DB principal
reload on every request, conservative same-group compatibility, DB unique
constraints for reservation/dispatch keys, and existing STOMP interceptor tests.

### 3.2 Frontend gap analysis (static review)

P0 functional defects:

| Finding | Evidence |
| --- | --- |
| Dashboard overview query is unconditional although donors lack `ANALYTICS_READ`, so donor landing can render a full-page 403. | `DashboardPage.tsx`, `permissions.ts` |
| Organization switcher is cosmetic: selection changes React Query keys but almost no request carries organization scope. | `Topbar.tsx`, `api.ts`, `auth.tsx`, page query keys |
| Emergency-request status filter is captured inside `queryFn` while the key is static, so changing the filter does not refetch. | `RequestsPage.tsx` |
| Donations and Requests open action modals while detail drawers remain mounted, creating nested `aria-modal` dialogs and competing focus traps. | `DonationsPage.tsx`, `RequestsPage.tsx`, `Modal.tsx` |
| DataTable row keyboard handler originally activated on descendants; Phase 2 guards `event.target === event.currentTarget` and adds page-level keyboard tests. | `DataTable.tsx` |

P1/P2 gaps: no role-specific task queues, no real-time/live freshness indicators,
raw numeric ID inputs, no record-donation form, missing status gating, insufficient
pagination and server filters, weak notification navigation, no chart data table,
no dark/theme system, limited glass styling, low-contrast subtle text, mobile
organization switcher hidden, mobile sidebar lacks dialog semantics, and almost no
page-level/E2E/accessibility tests.

Strengths preserved: typed API client with envelope/error handling, real API data
on every authenticated screen, permission-aware navigation, focus-trapped modal
and drawer primitives, skeleton/empty/error components, reduced-motion support,
reusable DataTable/StatusBadge/FormField, and no production mock API data.

## 4. Initial success criteria for Phase 2

- Every known Phase 1 finding remains fixed and verified.
- Premium frontend design is implemented with real API data and no placeholder
  interactions.
- Docker images build and Compose stack starts against PostgreSQL if the daemon
  remains available.
- PostgreSQL-backed concurrent transaction tests are added or the exact blocker
  is documented.
- Security audit findings are fixed with regression tests or explicitly accepted
  with rationale.
- Independent final review is produced at
  `project/docs/reviews/PHASE_2_FINAL_REVIEW.md`.
- Documentation accurately separates verified, implemented-but-unverified, and
  blocked items.
- Multiple focused commits are made; nothing is pushed.

## 5. Independent security audit (static, read-only)

A separate read-only audit reported 1 critical, 3 high, 6 medium, and 4 low
findings. Confirmed items and their Phase 2 disposition:

| ID | Severity | Finding | Phase 2 disposition |
| --- | --- | --- | --- |
| F-01 | Critical | Committed JWT fallback secret was accepted under the default `dev` profile, enabling token forgery if deployed unchanged. | Fixed: `application.yml` now requires `JWT_SECRET` with no fallback; test profile uses an isolated test-only value; Compose requires the variable. |
| F-02 | High | Organization-scoped admins could list/modify all users globally. | Fixed in user administration by restricting lists/status changes to manageable memberships and protecting platform/global accounts. |
| F-03 | High | A donation could link an arbitrary cross-tenant donor and appointment. | Fixed by validating donor-organization linkage and appointment donor/organization consistency before save; regression tests added. |
| F-04 | High | Documented auth rate limiting was not implemented. | Fixed with an in-memory IP/account/path limiter for login, register, and refresh; returns documented 429 `RATE_LIMITED`. Single-node limitation remains documented. |
| F-05 | Medium | Weak password policy and attacker-triggered per-email lockout. | Partially addressed: stronger validation where compatible with the seeded demo. Cross-IP/device backoff, breach checks, and MFA remain documented limitations. |
| F-06 | Medium | Multi-tab refresh rotation may revoke all sessions. | Residual risk: browser/tab-copy behavior needs runtime verification; frontend token storage is unchanged. |
| F-07 | Medium | Access tokens not revocable after logout/password change. | Fixed: access tokens carry `jti`/`token_version`; per-request principal checks the current version; logout/password change revokes. |
| F-08 | Medium | Audit query used an arbitrary first organization for multi-org users. | Fixed: explicit organization is required when ambiguous, and `AUDIT_READ` is checked for that organization; invalid instants and unbounded page sizes are rejected/capped. |
| F-09 | Medium | Validation gaps caused 500s for malformed status/member/audit inputs. | Fixed via validation annotations, explicit checks, and 400 mapping. |
| F-10 | Medium | Compose/deployment defaults were dev-grade and broadly bound. | Partially fixed: Compose services bind to loopback, require `JWT_SECRET`, expose configurable ports, and publish dev-only secret warnings. Production secrets/TLS/image pinning remain deployment responsibilities. |
| F-11 | Low | Swagger/actuator info publicly permitted. | Fixed for non-development profiles in security configuration. |
| F-12 | Low | No audit retention or tamper evidence. | Not implemented; retained as a documented compliance limitation. |
| F-13 | Low | STOMP context handling/error detail and missing Compose WebSocket proxy. | Bearer-only CONNECT, subscription/SEND authorization, generic errors, and nginx `/ws` + `/sockjs/` proxying were added; live handshake verification is recorded separately. |
| F-14 | Low | CI/supply-chain controls are templates only. | Not installed in root `.github/` (outside the permitted `project/` edit scope); documented as a deployment step and residual limitation. |

The audit also confirmed no XSS sinks, no SQL injection, parameterized JPQL,
explicit DTOs (no entity mass assignment), no SSRF client, and CORS allowlisting.

## 6. Documentation/test/devops gap audit

A separate read-only audit found that most architecture, ADR, academic, user, and
proposal documents still used pre-implementation language and that several
enumerations/state machines in `DOMAIN_MODEL.md` and `UML.md` no longer matched
the Java source. It also identified the following release-relevant gaps:

- `TEST_RESULTS.md` and review records still reported only 26 backend/18 frontend
  tests and V1–V3 migrations; they must be rewritten after the final Phase 2 run.
- `API_CONTRACTS.md` needs `X-Organization-Id`, token version claims, rate-limit
  behavior, idempotency fingerprint conflicts, and CORS/WebSocket caveats.
- `DEPLOYMENT_GUIDE.md` and `CI.md` need `JWT_SECRET`, loopback/override ports,
  `SEED_DEMO_DATA`, V4, and the explicit statement that no root GitHub Actions
  workflow was installed or executed.
- `SYSTEM_ARCHITECTURE.md`, ADR-002, ADR-003, ADR-004, ADR-005, and
  `AOOP_CONCEPT_MAPPING.md` need evidence-based implementation status sections.
- `USER_GUIDE.md` and `frontend/README.md` need implemented (not planned)
  journeys, current demo accounts, filters, organization switching, and the new
  E2E commands.
- A `project/CHANGELOG.md` is absent; versions are divergent (`1.0.0`, `0.1.0`,
  image tag `dev`) and should be documented rather than silently aligned.
- `PHASE_2_FINAL_REVIEW.md` is the required but still missing final deliverable.

## 7. Runtime probe during implementation

Docker Desktop was started successfully after an initial daemon failure.
`docker compose config` validated the stack; both `lifelink/backend:dev` and
`lifelink/frontend:dev` images built successfully. A full `docker compose up`
initially failed because an unrelated container on the host already owned port
8080. The Compose file was changed to publish all ports on `127.0.0.1` and to
honor `BACKEND_PORT`, `FRONTEND_PORT`, and `POSTGRES_PORT`; the stack was then
started on 18080/15173/15432 and both HTTP health endpoints returned 200.

A first login attempt against the Compose backend failed because the demo seeder
was restricted to `dev`/`default`, while Compose uses the `postgres` profile.
The seeder now also runs under `postgres` when `SEED_DEMO_DATA=true`, while
standalone PostgreSQL deployments default to no demo seed. The rebuilt stack
must be re-probed before any live WebSocket claim is recorded.
