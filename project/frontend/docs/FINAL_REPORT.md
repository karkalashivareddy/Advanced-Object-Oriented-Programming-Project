# LifeLink — final design, motion, loading and quality report

Date: 2026-11-27  
Status: complete for the owner-rejected first-pass rebuild, including final verification.  
Live frontend: <http://127.0.0.1:5173/>  
Login: <http://127.0.0.1:5173/login>  
Production preview: <http://127.0.0.1:4173/>  
Backend health: <http://127.0.0.1:18080/actuator/health> → `200 UP`  
Admin account used for verification: `admin@lifelink.local` / `Admin@123!`

No commit, push, force-push, merge, reset, clean, or history rewrite was performed. The working tree remains dirty and all pre-existing uncommitted work was preserved.

---

## 1. Scope and preservation

The pass was visual/interaction work only. Untouched behaviour:

- `src/lib/api.ts`, all endpoint contracts and organization scoping.
- Authentication, `ProtectedRoute`, service-layer `TenantAccessService` authorization and permissions.
- React Query domains, realtime hooks, routes and route guards.
- Existing tests were retained; stale copy/selector assertions were updated to the owner-approved copy and the new accessible orb controls. No assertion was deleted to hide a failure.

The authoritative pre-change ledger is `docs/design-motion-diagnosis.md`; it was written before any redesign edit and records the file/selector root cause for A1–A11.

---

## 2. A1–A11 root causes and fixes

| ID | Root cause recorded in M0 | Fix shipped |
| --- | --- | --- |
| **A1** Hero too low / visual clipped on short screens | Unbounded hero padding, `--text-6xl`, 50px CTAs, two proof rows and a `min-height: 360px` vessel card competed with late duplicate `.hero*` rules; no `100svh` budget. | Rebuilt hero in `LandingPage.tsx` + `landing.css` with a viewport-height budget, compact short-screen rules, vector/canvas-only visual and one final-layer hero contract. Audit passes at 1366×657 and 1440×700. |
| **A2** Hero copy/CTA drift | JSX contained `Every drop has a journey.` and `Create donor account` / `Sign in to workspace`. | Exact copy restored: **“Every Drop Has a Destination.”**, the supplied supporting sentence, `Find Blood` → `/login`, `Become a Donor` → `/register`. E2E asserts the exact copy and hrefs. |
| **A3** Muddy journey background; faint chapter label | Legacy `vessel-50 → plasma → #fff` gradient plus low-alpha white label and a legacy horizontal rail. | Dark cinematic journey surface, solid token-backed copy panels, high-contrast chapter rail, scroll-bound stage selection and pausing when offscreen. |
| **A4** Dull blood table, `Ab Positive`, wrong wording | No explorer existed; generic `humanize()` mangled AB; table used `Shown`/`Not shown`. | `formatBloodGroup()` fixes AB casing; 8 accessible blood orbs expose all 64 pure-matrix pairs, with selected-pair explanation, `Compatible` / `Not compatible` labels, a text-table fallback, and the exact clinical note verbatim. |
| **A5** Password field narrower; eye icon on left | `.search-input-wrap svg { left: 11px }` hit the eye icon; flex icon shrank the input; no right padding slot. | Shared `Field` / `Input` / `PasswordField`, reserved left/right slots, 44px controls, right-side toggle with `aria-label` and `aria-pressed`. Login and Register use one composition. |
| **A6** Auth art overlapped headline; sparse register panel | Three competing auth systems and absolute decorative layers without a protected content zone. | One `auth-shell` composition in `auth.css`, `auth-visual__safe` typographic zone, shared `CellField`/`LifelinePath`/`Wordmark` art, balanced login/register panels. Both public forms pass axe. |
| **A7** App card padding, chips, overflow | `.surface`/`.card` supplied borders but no padding; eyebrow pills straddled borders; 1440px shell and fixed 3/2-column grids. | New `Surface`, `SectionCard`, `PageHeader`, `StatCard`, `Grid`, `DataTable`, 1280px page shell, `overflow: clip`, token padding and `auto-fit` grids. All 16 app pages migrate. |
| **A8** Donors nested card/icon/table padding | Static toolbar used `.surface-interactive` lift; duplicate absolute SVG rules; helper text joined the auto-fit grid; no first/last cell padding contract. | Unified filter `Surface`, explicit icon slot, helper inside its field, removed nested borders, refined table cell and last-column padding, accessible sort buttons at 44px. |
| **A9** Nearby control heights differed | Bare `<select>`/`<input>` bypassed `.input`/`.select`; 44px rule applied only on coarse pointers. | `FormField` wires labels/ARIA through native controls; all nearby controls use shared `Input`/`Select`; one 44px contract. |
| **A10** Sidebar scrollbar/cutoff | Fixed `100dvh` flex column, raw overflow area, always-visible native scrollbar, 40px links plus stacked group gaps. | Thin auto-hiding scrollbar, compact density at short heights, 40px nav links, 44px collapse control, footer protected from clipping; intentional scroll containers documented in the audit. |
| **A11** Orphan stat card | Fixed `repeat(3)` and `repeat(2)` overrides for three-item metric sets. | `Grid` uses `repeat(auto-fit, minmax(min(100%, 260px), 1fr))` with `min-width: 0`; no orphan card at tested breakpoints. |

---

## 3. Foundations and new files

Reusable primitives now live under `src/components/ui/`:

- `Surface` (`flat|raised|glass|tint`), `SectionCard`, `PageHeader`, `StatCard`, `Grid`.
- `Field`, `Input`, `Select`, `PasswordField`, accessible `FormField` wiring.
- `DataTable`, `EmptyState`, `StatusBadge`, `Skeleton`, `Picture`, `DeferredBarChartView`, `AnalyticsBarChart`.

Motion primitives live under `src/components/motion/`:

- `Reveal`, `Stagger`, `Counter`, `Magnetic`, `Tilt`, `SplitText`, `ScrollProgress`, `ParallaxLayer`, `PressScale`.
- `RouteTransition`, `BloodWipe`, `TopProgress`, `RouteFallback`, `LoadingButton`, `CursorHalo`, `useScrollRestoration`, `useMotionVisibility`.

Supporting files include:

- `src/lib/motion.ts`, `src/styles/motion.css`, `src/styles/transitions.css`, `src/styles/primitives.css`.
- `src/styles/landing.css`, `src/styles/auth.css`, `src/styles/app-motion.css`, `src/styles/fonts.css`, `src/styles/pictures.css`.
- `src/lib/bloodCompatibility.ts` + 64-pair test, `src/data/imageManifest.json`.
- `scripts/ui-audit.mjs`, `scripts/build-images.mjs`, `docs/UI_AUDIT.md`, `docs/color-contrast.md`, `docs/IMAGE_ASSETS.md`.

---

## 4. Color and typography

- `src/styles/tokens.css` is the single source of truth for the exact Part B palette. Raw brand hex values occur only there and in gradients.
- Red (`--crimson-600`, `--crimson-700`) is reserved for primary actions, urgency, active state and identity. Status colors are semantic only.
- The loud yellow DEMO DATA pill is replaced by a refined amber chip with an info icon.
- Display: self-hosted **Fraunces Variable** with `"opsz" 144`, `"SOFT" 50`, `"WONK" 0`; italic accent uses `WONK 1`.
- UI: self-hosted **Geist Variable**. Labels, IDs and numerals: self-hosted **Geist Mono Variable**.
- Five woff2 files are preloaded in `index.html`; size-adjusted fallbacks are defined in `fonts.css`. Inter, Google Fonts CDN, Tailwind, shadcn, GSAP and Three.js are absent.
- Full ratio ledger is in `docs/color-contrast.md`; axe color-contrast checks pass at every audit viewport.

---

## 5. Motion and loading

- Page-load intro, `RouteTransition`, View Transition class fallback, blood wipe curtain, `TopProgress`, branded `RouteFallback`, skeletons, `LoadingButton`, scroll restoration and idle route prefetching are wired in `App.tsx` / `AppShell.tsx`.
- Animated properties are limited to `transform`, `opacity` and sparing `filter`. No `width`, `height`, `top`, `left` or grid-template transitions remain.
- Loops pause on hidden tab / offscreen. `prefers-reduced-motion` removes decorative motion without hiding content.
- During final verification, two real interaction defects were found and fixed:
  1. `LoginPage` had a status-driven redirect effect that fired a second `replace` navigation after submit, remounting the destination and discarding text typed immediately after navigation. It is now a mount-only redirect for already-authenticated visitors; fresh sign-in navigation is owned by the submit handler.
  2. `RouteTransition` used `AnimatePresence mode="wait"`, which re-entered the same route after async shell state settled. It is now a keyed opacity-only `motion.div`; the route transition check still passes and CLS is unaffected.
- Inventory alert and analytics chart slots reserve stable loading height, removing the last measured CLS source.

---

## 6. Imagery and licensing

- `npm run build:images` deterministically generates **60 responsive AVIF/WebP/JPEG files** from five original SVGs at 480/960/1440/2400, plus six favicons, two OG images and two manifests.
- `Picture` renders AVIF → WebP → JPEG with intrinsic dimensions, `sizes`, lazy loading and the generated 24px blur placeholder.
- All artwork is original project work from `public/images/source/*.svg`; no stock photography, no external license, no invented people, stats, testimonials or contact details. Details in `docs/IMAGE_ASSETS.md`.
- Hero and journey visuals remain vector/canvas-only. Only two secondary landing slots use generated raster artwork, both decorative and labelled appropriately.

---

## 7. Verification evidence

### Automated checks

| Check | Final result |
| --- | --- |
| `npm run typecheck` | pass, strict TypeScript |
| `npm test` | **11 files / 55 tests passed** |
| `npm run build` | pass, 2750 modules transformed, built in 6.93s |
| `npm run test:e2e` | **46 passed, 0 failed, 0 flaky, 0 skipped** (Chrome + Edge) |
| `node scripts/ui-audit.mjs` | **45 runs, 45 passed, 0 errors, 0 warnings, 0 skips** |
| Axe WCAG A/AA | pass across landing, auth and audited app routes at all five viewports |
| Console errors/warnings | 0 in audit runs |
| Failed requests / request failures | 0 in audit runs |
| CLS | below 0.05 on every audited run after stable slots / opacity-only transition |
| Reduced motion | passes on landing and dashboard at 390×844 |
| Route transition | pass |
| `npm audit` | 0 vulnerabilities (verified earlier in this pass) |
| `git diff --check` | clean; CRLF replacement notices only |

Audit viewports: 1366×657, 1440×700, 1920×950, 768×1024, 390×844.  
Evidence: `ui-audit/report.json`, `ui-audit/<route>-<viewport>-full.png`, `ui-audit/<route>-<viewport>-viewport.png` (**91 screenshots**), `../docs/evidence/PLAYWRIGHT_RESULTS.json`.

### Bundle size, before → after

Baseline from `../docs/evidence/PERFORMANCE_EVIDENCE.json`; final from `dist/` after the last build.

| Asset | Before | After | Delta |
| --- | ---: | ---: | ---: |
| Main JS | 390,321 B | 602,792 B | +212,471 B |
| CSS | 71,652 B | 146,077 B | +74,425 B |
| Chart chunk | 435,622 B | 426,191 B | −9,431 B |
| Total JS + CSS | 1,216,795 B | 1,499,279 B | +282,484 B (+23.2%) |

Gzip after: main JS 190,977 B, CSS 25,852 B, chart chunk 122,820 B. Vite still reports one chunk over 500 kB; the chart remains lazily loaded. The growth is the cost of the new motion/type/primitive layer while legacy CSS and API code were preserved rather than deleted.

### Explicit limitations

- **Direct screenshot inspection:** this model cannot read PNG image input; all 91 screenshots were generated and checked programmatically, but a human/multimodal visual review is still recommended. The browser runtime checks (overflow, padding, heights, contrast, console, failed requests, reduced motion, CLS) are clean.
- **Lighthouse:** unmeasured. No global Lighthouse binary; `npx --no-install lighthouse` failed because the package is absent, and installing it would violate the allowed-dependency list. Performance ≥90 / Accessibility ≥95 / Best Practices ≥95 / CLS <0.05 are therefore not independently confirmed by Lighthouse.
- **Docker/PostgreSQL:** Docker daemon unavailable (`npipe:////./pipe/dockerDesktopLinuxEngine`); Compose/PostgreSQL and PostgreSQL Testcontainers could not be rerun. Verification used the live in-memory H2 backend, which is `200 UP`.
- **Backend tests:** backend source was not changed; prior baseline was 135 tests, 0 failures, 0 errors, 8 skipped.

---

## 8. Live stack

```text
Frontend (dev/live source)  http://127.0.0.1:5173/
Production preview (dist)   http://127.0.0.1:4173/
Backend health              http://127.0.0.1:18080/actuator/health  → 200 UP
Seed admin                  admin@lifelink.local / Admin@123!
```

`vite preview` serves `dist`, not live source; every source fix was followed by `npm run build` before rerunning the UI audit.

---

## 9. Final Git state

`HEAD` remains `566e140 Record LifeLink publication status`. Final `git status --short` contains **66 modified tracked files and 79 untracked entries (145 total)**, including the redesign, verification evidence, generated image files and pre-existing user work. `git diff --check` is clean. Nothing was committed, pushed, merged, reset, cleaned or rewritten.
