# Changelog

All notable changes to the LifeLink project are documented here. Dates use ISO 8601.

Status labels used below: **V** verified by an executed command/recorded probe ·
**I** implemented but not runtime-verified · **N** not implemented ·
**B** blocked by environment or edit scope. No production-readiness claim.

## 2026-11-24 — Bloodstream experience, audit fixes, abstract correction, and final reconciliation (current)

Branch: `feature/lifelink-bloodstream-experience`; base HEAD
`59401d45e511183ede59e7d55073f07e2cf5eacd`. Work remains **uncommitted**;
nothing was pushed or merged. Scope is `project/` plus root `README.md`;
`LAB-WORK/PRACTICAL-4/` remains untouched and excluded.

- Preserved the approved Java 21/Spring Boot backend and React 19/TypeScript SPA; did not replace the UI framework or move business rules into the client.
- Closed backend correctness/security defects: audit search, strict same-group compatibility, expiry/cancellation/lifecycle regressions, DTO validation, outbox retry termination, low-stock threshold `10`, deterministic organization pagination, request→unit lock ordering, and idempotent replay before TTL checks.
- Added the Bloodstream landing identity with reduced-motion and mobile checks, explicit organization scope handling, authenticated browser STOMP cache invalidation with REST fallback, and Analytics responsive table wrappers.
- Current gates: backend **119 tests / 28 Surefire reports**; frontend **39 tests in 7 files**, typecheck and build pass; Playwright **18 passes** on Chrome and Edge; `npm audit --audit-level=high` reports 0 high/critical vulnerabilities.
- Added a corrected 14-section abstract DOCX and a validated 4-page PDF. The Word COM export attempt hung; the PDF was rendered from the same corrected content with PyMuPDF and disclosed in [`docs/evidence/ABSTRACT_PDF_VALIDATION.json`](docs/evidence/ABSTRACT_PDF_VALIDATION.json).
- Reconciled current-facing architecture, academic, quality, deployment, user, frontend, and root documentation; historical Phase 2 records remain dated baselines.
- Independent final review found no critical/high defects. Its medium findings (first-membership fallback, documentation drift/whitespace, and an unsupported blanket pagination claim) were closed before commit preparation.

See [`docs/reviews/CURRENT_STATE_ENGINEERING_AND_DESIGN_AUDIT.md`](docs/reviews/CURRENT_STATE_ENGINEERING_AND_DESIGN_AUDIT.md)
and [`docs/quality/TEST_RESULTS.md`](docs/quality/TEST_RESULTS.md).

## 2026-11-23 — Phase 2 final verification and audit-fix reconciliation (historical)

Branch: `feature/lifelink-enterprise-platform`. Baseline HEAD:
`195e88a81b105baea69018e44f4b57f3f806937a` (Phase 1). Phase 2 work was
**uncommitted** at verification time; **nothing was pushed**. Changes were
confined to `project/`; root `README.md`, `LAB-WORK/`, and Git history were not
modified. This section supersedes the stale Phase 1 evidence in the historical
section below.

### Verification recorded

| Area | Command | Status | Result |
| --- | --- | --- | --- |
| Backend full suite (from `project/backend`) | `.\mvnw.cmd test -q` | V | **93 tests, 0 failures, 0 errors, 0 skipped**, 17 Surefire XML reports; Testcontainers PostgreSQL 16 concurrency tests; Flyway `V1`–`V5` + Hibernate `ddl-auto=validate` |
| Focused regressions | Focused Maven runs (`-Dtest=<Class>`) of `AuthServiceSecurityTest`, `UserServiceScopingTest`, `AnalyticsServiceTenantScopeTest`, `ControllerValidationTest` | V | All four classes pass |
| Frontend typecheck / unit tests (from `project/frontend`) | `npm run typecheck` / `npm test -- --run` | V | Pass / **33 tests in 6 files** |
| Frontend build / audit | `npm run build` / `npm audit --audit-level=low` | V | Vite 7.3.8 production build succeeded; 0 vulnerabilities |
| Playwright E2E | `VITE_API_PROXY_TARGET=http://127.0.0.1:18080 npm run test:e2e` | V | **6 passed in 14.4 s**, Chrome + Edge, retries 0 — [`docs/evidence/PLAYWRIGHT_RESULTS.json`](docs/evidence/PLAYWRIGHT_RESULTS.json) |
| Live STOMP smoke | `npm run test:stomp` via Compose frontend proxy | V | Login ok, SockJS info ok, websocket ok, authenticated `CONNECTED`, own-queue `SUBSCRIBE` accepted, notification `MESSAGE` delivered — [`docs/evidence/STOMP_SMOKE_RESULT.json`](docs/evidence/STOMP_SMOKE_RESULT.json) |
| Compose stack | `docker compose -f project/docker/docker-compose.yml up -d --build` | V | Services healthy; backend `/actuator/health` 200 `{"status":"UP","groups":["liveness","readiness"]}`, frontend `/healthz` 200, SPA root 200, login through nginx proxy 200; Flyway `V1`–`V5` all `success=t`; seed counts organizations=2, users=6, blood_units=9 — [`docs/evidence/COMPOSE_VERIFICATION.json`](docs/evidence/COMPOSE_VERIFICATION.json) |
| GitHub Actions | — | B | Root `.github/workflows` outside permitted scope; template only, not installed/run |

### Phase F audit-fix closure

| ID | Severity | Finding | Fix / evidence | Status |
| --- | --- | --- | --- | --- |
| F-01 | High | Token revocation reversible after lock/disable/re-enable | V5 persistent monotonic `token_version`, checked per request; `AuthServiceSecurityTest` + full suite | V |
| F-02 | Medium | Analytics tenant scope ignored validated header | Validated `X-Organization-Id`; platform admins may omit for global view; `AnalyticsServiceTenantScopeTest` | V |
| F-03 | Medium | Stale docs/evidence | Quality, architecture, deployment, user, changelog, and review docs reconciled to current evidence | V (docs) |
| F-04 | Medium | Process-local logout revocation undocumented | `AuthService` jti denylist documented in source and `KNOWN_LIMITATIONS.md` | V (docs) |
| F-05 | Low | Unbounded idempotency-key length | `@Size(max = 120)` / `IdempotencyKeys.MAX_LENGTH`; `ControllerValidationTest` | V |
| F-06 | Medium | E2E/STOMP evidence gaps | Persisted JSON reports linked above | V |

A second independent review returned **`PASS WITH RESIDUALS`**: no new
critical, high, or medium defect; all six Phase F findings resolved; approved
for commit/push as a local-development / supervised-demo release only. See
[`docs/reviews/PHASE_2_SECOND_REVIEW.md`](docs/reviews/PHASE_2_SECOND_REVIEW.md)
and [`docs/reviews/PHASE_2_FINAL_REVIEW.md`](docs/reviews/PHASE_2_FINAL_REVIEW.md).
The historical baselines remain in
[`docs/reviews/FINAL_INDEPENDENT_REVIEW.md`](docs/reviews/FINAL_INDEPENDENT_REVIEW.md)
and [`docs/reviews/PHASE_2_GAP_ANALYSIS.md`](docs/reviews/PHASE_2_GAP_ANALYSIS.md).

### Files updated in this batch

- [`docs/quality/TEST_RESULTS.md`](docs/quality/TEST_RESULTS.md) — replaced the
  26-test/18-test Phase 1 breakdown with the current 93/33/6/STOMP/Compose
  evidence, a status legend, and explicit non-claims.
- [`docs/quality/TEST_STRATEGY.md`](docs/quality/TEST_STRATEGY.md) — updated suite
  inventory to V1–V5, PostgreSQL 16 in the full suite, 18 ordered integration
  cases, six frontend test files, and exact commands with recorded status.
- [`docs/quality/KNOWN_LIMITATIONS.md`](docs/quality/KNOWN_LIMITATIONS.md) —
  removed stale "pending live STOMP / E2E / full-stack login" items, recorded
  process-local logout revocation and shared-store gaps, and kept the
  authoritative no-production-readiness position.
- `CHANGELOG.md` — this section.

### Still pending / not claimed

I: cross-tab refresh runtime and multi-instance session revocation. N: MFA,
breach-password checks, audit retention/tamper evidence, shared rate-limit/jti
store, production secrets/TLS/image pinning, load/soak/penetration/backup-restore.
B: CI execution. The second independent review is complete (`PASS WITH RESIDUALS`).

## 2026-11-23 — Phase 2: implemented platform and evidence-based documentation (historical)

> **Superseded record.** The implementation inventory below is kept for
> provenance. Its verification figures (26 backend / 18 frontend tests, V1–V3)
> and "deliberately pending" probes were superseded by the current section
> above; do not read them as current status.

### Added (implementation, present in this worktree)

- Spring Boot `3.5.16` / Java `21` backend with twelve flat `com.lifelink.<module>` packages, JPA entities, role/permission security, tenant scoping, and Flyway migrations `V1`–`V4` (`V5` added in the final audit-fix batch).
- V4 schema additions: `idempotency_records` with `(scope, key)` uniqueness and request fingerprints, a sparse one-active-reservation-per-unit slot, and portable status/date CHECK constraints; V5 adds persistent `token_version`.
- Implemented allocation strategy and specification classes (`AllocationStrategy`, `FeefoStrategy`, `CompatibilitySpecification`, `StrictSameGroupSpecification`, `ConfiguredCompatibilitySpecification`) plus DTO records and API envelopes.
- Auth hardening: JWT `jti` + `token_version` revocation, rotating refresh tokens with replay detection, BCrypt hashes, persisted failed-login lockout, in-memory auth rate limiting returning `429 RATE_LIMITED`, and fail-fast `JWT_SECRET` in every non-test profile.
- Organization scoping via validated `X-Organization-Id` (`TenantAccessService`), including org-scoped user and audit endpoints; frontend organization switcher invalidates cached queries.
- Idempotency for allocation confirmation, reservation creation, and dispatch creation: identical replay returns the original response, divergent payload returns `409`, header/body key mismatch returns `400`, and lock/integrity races map to `409 CONCURRENCY_CONFLICT`.
- Cross-organization dispatch scoping: supplying bank staff create and manage dispatches; hospital staff confirm reservations.
- Notification outbox (`outbox_events`) with `notification.created` events, scheduled processing, per-item fault isolation, and authenticated STOMP CONNECT / own-queue SUBSCRIBE restrictions.
- React/TypeScript SPA with premium light-mode design system, real API data, role-aware dashboards and task queues, filters, confirmation modals, pickers, freshness indicators, responsive dialogs, reduced-motion support, and accessible chart alternatives.
- Docker Compose local stack (PostgreSQL 16, backend, nginx-served SPA) bound to `127.0.0.1` with overridable `POSTGRES_PORT`/`BACKEND_PORT`/`FRONTEND_PORT`; `lifelink/backend:dev` and `lifelink/frontend:dev` images built successfully.
- Frontend Playwright harness and E2E specs, backend PostgreSQL idempotency-concurrency test, and new security/tenant/identity test classes.

### Changed (documentation in this worktree)

- `docs/architecture/API_CONTRACTS.md`, `UML.md`, `SYSTEM_ARCHITECTURE.md`, `DOMAIN_MODEL.md`, ADR-001–005, `docs/academic/AOOP_CONCEPT_MAPPING.md`, `docs/user-guide/USER_GUIDE.md`, `docs/deployment/DEPLOYMENT_GUIDE.md`, `docs/deployment/CI.md`, `docs/proposal/PROJECT_PROPOSAL.md`, `docs/audit/INITIAL_REPOSITORY_AUDIT.md`, and `frontend/README.md` were aligned with the implementation. Any earlier pending-probe wording in those documents was reconciled in the current section above.

### Historical verification and pending items

The earlier record reported 26 backend tests / 18 frontend tests, a successful
production build, `npm audit` 0 vulnerabilities, Docker image builds, and an
HTTP 200 health probe on override ports 18080/15173/15432. It listed live STOMP,
Playwright results, and the full-stack login re-probe as pending; all three are
now verified with the evidence linked in the current section. GitHub Actions
remains not installed and not executed. That documentation-only batch ran no
tests; link/path checks and `git diff --check` were used for validation.
