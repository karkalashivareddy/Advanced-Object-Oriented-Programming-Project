# LifeLink Full Repository Audit — 27 November 2026 Increment

**Date:** 27 November 2026  
**Branch:** `feature/lifelink-bloodstream-experience`  
**Working-tree HEAD:** `566e14071675716c9b507e8df37751a92fd139cf`  
**Audit state:** read-only inspection plus executed gates; all redesign work remains uncommitted. Earlier audits are preserved in [`CURRENT_STATE_ENGINEERING_AND_DESIGN_AUDIT.md`](CURRENT_STATE_ENGINEERING_AND_DESIGN_AUDIT.md), [`LIFELINK_FINAL_ENGINEERING_AUDIT.md`](LIFELINK_FINAL_ENGINEERING_AUDIT.md), and dated review files in this directory.

> **Nearby donor discovery is an operational assistance feature. Final donor eligibility, blood compatibility and clinical decisions require authorized clinical verification.**

## 1. Method and evidence boundary

This audit reconciles the whole repository with the current uncommitted working tree. It uses:

- source inspection of every application area and all new brand/test files;
- executed frontend typecheck, unit tests, production build, dependency audit, and full Playwright suite;
- an executed backend Maven full suite;
- direct browser probes for responsive containment, keyboard behaviour, reduced motion, forced colors, and axe-core WCAG A/AA rules;
- official-source research recorded in [`LIFELINK_PRODUCT_AND_ENGINEERING_RESEARCH.md`](LIFELINK_PRODUCT_AND_ENGINEERING_RESEARCH.md).

It does not assert Lighthouse scores, full WCAG conformance, FHIR compliance, clinical validation, production deployment, penetration testing, load testing, or backup/restore verification.

## 2. Git and preservation state

- Current branch: `feature/lifelink-bloodstream-experience`.
- Current HEAD: `566e14071675716c9b507e8df37751a92fd139cf` (`Record LifeLink publication status`).
- No commit, push, force-push, merge, reset, clean, or history rewrite was performed during this increment.
- Pre-existing modified abstract/PDF/evidence files were preserved.
- All untracked `LAB-WORK/PRACTICAL-4/` files were preserved and untouched.
- New and modified LifeLink files remain in the working tree.
- `git diff --check` reports only normal LF/CRLF line-ending warnings and no whitespace errors.

## 3. Repository inventory

| Area | Current content |
| --- | --- |
| Backend | Java 21 / Spring Boot 3.5.16 Maven application under `project/backend`; 20 JPA repository interfaces; 21 package directories; 15 controllers, 16 services, 20 entities, DTOs, repositories, security/configuration, and common cross-cutting code. |
| Frontend | React 19 / TypeScript 5.9 / Vite 7 SPA under `project/frontend`; strict TS config; TanStack Query 5; React Router 7; Recharts 3; SockJS/STOMP; lucide-react; self-hosted Fraunces and Inter variable fonts. |
| Database | Flyway `V1`–`V6`; H2 in dev/test; PostgreSQL 16 in Compose and Testcontainers when Docker is available. |
| Tests | Backend JUnit 5/Mockito/Spring/Testcontainers; frontend Vitest 11 files / 54 tests; Playwright 22 spec declarations expanded to 23 specs by parameterization, across Chrome and Edge. |
| Docs | Architecture, ADRs, academic mappings, user/deployment guides, quality records, evidence, and the four current named review documents. |
| Evidence | JSON results, screenshots at six target breakpoints, resource diagnostics, abstract validation, and browser captures. |

## 4. Backend audit

### 4.1 Architecture retained

The backend keeps the approved layered package structure: `identity`, `donor`, `inventory`, `emergency`, `allocation`, `reservation`, `dispatch`, `notification`, `audit`, `analytics`, `organization`, and `common`. Java owns all authorization, validation, workflow transitions, compatibility decisions, transactions, repository queries, and analytics aggregation. The SPA is not a business-rule peer.

### 4.2 Domain and OO evidence

- `BloodUnit` and `EmergencyRequest` expose guarded transitions rather than public setters.
- `GeoPoint` is an immutable validated value object with Haversine and conservative bounding-box behaviour.
- `ApiResponse<T>`, `PageResponse<T>`, DTO records, and `NearbyDonorView` keep representations explicit and privacy-limited.
- Strategy (`AllocationStrategy`/`FeefoStrategy`), Specification (`CompatibilitySpecification` implementations), Repository, DTO, Idempotency Key, and a narrow transactional-outbox observer are implemented.
- No `BloodUnitFactory`, generic event bus, ArchUnit suite, Spring Modulith verification, typed IDs, or framework-free domain layer is present; earlier planned documents were already corrected.

Full class-by-class evidence is in [`AOOP_IMPLEMENTATION_MAP.md`](AOOP_IMPLEMENTATION_MAP.md).

### 4.3 Persistence and privacy

- Flyway `V6` adds donor/organization location columns, freshness, bounds constraints, and indexes.
- Consent grant/revocation is atomic; revocation clears coordinates and freshness.
- Nearby discovery applies selected-organization permission, consent, availability, freshness, bbox, exact radius, ordering, and cap in the backend query.
- Responses omit donor names, contact data, and exact coordinates; the client sees coarse bands and `0.02°` cells.
- The process-local 20/minute guard and process-local logout revocation remain explicitly documented limitations.

### 4.4 Executed backend gate

Command from `project/backend`: `.\mvnw.cmd -B -ntp test`.

Result: **BUILD SUCCESS**; **135 tests run, 0 failures, 0 errors, 8 skipped**. The 8 skipped tests are the four `PostgresAuditSearchTest` cases and four `PostgresIdempotencyConcurrencyTest` cases, both annotated `@Testcontainers(disabledWithoutDocker = true)`. Docker Desktop's daemon was unavailable in this session, so the current rerun did not exercise PostgreSQL Testcontainers. Earlier Docker-backed full-run evidence remains historical; it is not relabelled as a current result.

## 5. Frontend audit

### 5.1 Entry, routing, and session handling

- `main.tsx` imports both self-hosted font packages and layered styles, then mounts `App` in `StrictMode`.
- `App.tsx` nests `QueryClientProvider` → `ToastProvider` → `AuthProvider` → `BrowserRouter` → `Suspense`; routes are lazy-loaded with an accessible skeleton.
- `ProtectedRoute` uses `evaluateRouteAccess` with loading/status/role/permission rules; public routes are `/`, `/login`, `/register`; `/__kit` is DEV-only; all 15 workspace routes are under `/app`.
- Access tokens are memory-only; refresh and organization scope use `sessionStorage`. Refresh is single-flight. Organization scope restores only a previously explicit valid value; there is no first-membership fallback.
- `api.ts` unwraps the `ApiResponse<T>` envelope, adds Bearer and organization headers, handles idempotency keys, performs one refresh/replay on 401, and creates typed `ApiError` values with correlation IDs.
- `useRealtimeNotifications` dynamically loads SockJS/STOMP only for authenticated users with `NOTIFICATION_READ`, authenticates CONNECT, subscribes to `/user/queue/notifications`, and invalidates query caches. REST remains authoritative.

### 5.2 Pages and presentation

- Public landing is the cinematic donor-to-delivery story with a continuous lifeline, six keyboard-selectable stages, an illustrative 64-pair RBC atlas, privacy/emergency/trust/FAQ/CTA sections, and exact clinical boundaries.
- Login and registration were redesigned while preserving auth rules, labels, hints, and validation.
- App shell and sidebar carry the identity via `LifelinePath` status line, `Wordmark`, `PageTransition`, and permission-filtered navigation.
- Most authenticated operational pages retain the existing high-density layout plus global brand CSS; a complete individual redesign of every operational route was not performed.
- All operational data comes from real endpoints. The landing vessel story is labelled illustrative and is not live supply data.

### 5.3 Brand system

`src/components/brand/` contains `BloodDrop`, `BloodstreamVisual`, `CellField`, `Counter`, `JourneyVessel`, `LifelinePath`, `Magnetic`, `PageTransition`, `Reveal`, `ScrollProgress`, and `Wordmark`. Motion uses CSS, SVG, and rAF helpers only. The `motion` dependency is not installed; Tailwind, shadcn, Three.js/R3F, GSAP, and Google Fonts CDN are absent.

CSS is layered as `@layer tokens, base, components, layout, pages, utilities;`, with legacy token names retained as aliases. Forced-colors and reduced-motion rules are present.

### 5.4 Accessibility verification

Measured in Chrome and Edge:

- landing axe WCAG A/AA: zero violations;
- login and registration axe WCAG A/AA: zero violations;
- skip link, keyboard atlas, keyboard journey stages, and focusable mobile dialog behaviour pass;
- forced-colors primary CTA remains visible and focusable;
- reduced motion yields zero `animateMotion` elements and `animation-name: none` for the decorative flow;
- no horizontal overflow at 360, 390, 768, 1024, 1280, 1440, and 1536 px.

Earlier axe findings were fixed at the token/component level: light sections no longer inherit dark-theme text tokens, accessible names now contain visible text, and the no-compatibility cell and metric deltas meet measured contrast. This is route-level evidence, not full WCAG conformance or screen-reader certification.

## 6. Executed frontend gates

| Gate | Command | Result |
| --- | --- | --- |
| Typecheck | `npm run typecheck` | Passed. |
| Unit tests | `npm test` | **54 tests in 11 files**, all passed. |
| Production build | `npm run build` | Passed; **2,297 modules transformed**. |
| Dependency audit | `npm audit --audit-level=high` | **0 vulnerabilities**. |
| Full browser suite | `$env:VITE_API_PROXY_TARGET='http://127.0.0.1:18080'; npx playwright test` | **46 passed**, 0 failed, 0 flaky, 0 skipped; 23 specs × Chrome/Edge. |
| Diff hygiene | `git diff --check` | No whitespace errors; LF/CRLF warnings only. |

The E2E run used a local H2 dev server on port `18080` with seeded demo data because Docker was unavailable. Flyway `V1`–`V6` applied successfully and `/actuator/health` returned HTTP 200 `UP`. The suite covered authenticated dashboard data and filtering, bounded donor search, donation options, mobile dialog focus/Escape, overflow checks, authenticated STOMP plus REST polling, landing story, reduced motion, skip link, breakpoints, keyboard atlas/journey, forced colors, axe public pages, dev kit, and failed-resource diagnostics.

## 7. Documentation audit

| Document | State |
| --- | --- |
| `LIFELINK_PRODUCT_AND_ENGINEERING_RESEARCH.md` | Created this increment; official sources, design decisions, explicit non-claims. |
| `LIFELINK_FULL_REPOSITORY_AUDIT.md` | This document. |
| `AOOP_IMPLEMENTATION_MAP.md` | Created this increment; current code/test evidence and explicit non-claims. |
| `LIFELINK_NEXT_LEVEL_IMPLEMENTATION_REPORT.md` | Updated with redesign scope and current gates. |
| `TEST_RESULTS.md` | Updated with the 27 November executed results; older results retained as dated history. |
| `KNOWN_LIMITATIONS.md` | Updated with redesign addendum and current coverage boundary. |
| `README.md` | Updated current counts, stack notes, and document links. |
| Older review files | Preserved unchanged as historical records with supersession notes. |

No source is rewritten to claim a capability that was not tested. FHIR compliance, Lighthouse, full WCAG conformance, clinical validation, and production readiness remain non-claims.

## 8. Findings and disposition

| Severity | Finding | Disposition |
| --- | --- | --- |
| None critical | No broken gate in the executed current set. | Typecheck, unit tests, build, audit, E2E, and backend Maven suite all completed successfully. |
| Medium | Current backend rerun skipped 8 PostgreSQL Testcontainers tests because Docker was unavailable. | Recorded explicitly; earlier Docker-backed run is historical. Do not claim current PostgreSQL concurrency verification. |
| Medium | Most authenticated pages were not individually redesigned. | Stated as a scope limitation; global shell/tokens carry the identity. |
| Medium | Public axe checks are route-level, not a full application audit. | Stated explicitly; no full WCAG conformance claim. |
| Low | Screenshots were captured but not manually viewed by the auditing model. | DOM/computed-style/containment evidence and artifacts are recorded; manual review remains outstanding. |
| Low | Frontend lockfile resolves newer versions than declared minimum ranges. | Lockfile is committed source of truth; gates were executed against it. |
| Low | LF/CRLF warnings remain in `git diff --check`. | No whitespace errors; line endings are preserved rather than rewritten. |

## 9. Environment and blockers

- Docker CLI exists, but the daemon endpoint was unavailable (`npipe:////./pipe/dockerDesktopLinuxEngine`); full Compose stack was not rerun.
- H2 dev mode substituted for browser E2E and health/migration probes.
- Node/npm and Maven Wrapper gates ran locally with no network installation required after dependencies were present.
- No GitHub Actions workflow was executed; `.github/workflows` remains outside the edit scope.

## 10. Safety conclusion

The current tree preserves the Java/Spring business authority, React presentation stack, REST/STOMP contract, authentication and tenant rules, query caching, form validation, and all pre-existing user work. The redesign adds a coherent identity and measured accessibility work without inventing live data or duplicating critical rules in the client. The remaining work is honest scope disclosure rather than hidden incompleteness: no commits were created, no unrelated files were touched, and no unverified certification is claimed.
