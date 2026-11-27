# LifeLink frontend second-pass redesign — M0 diagnosis

Date: 2026-11-27  
Stage: M0 only. No redesign code was changed before this document was written.

## Scope and baseline

The owner rejected the first-pass cinematic redesign on visual grounds. This second pass keeps the business contract intact and changes only presentation and interaction: layout, typography, motion, loading language, and the public/auth/app surfaces.

Read-only baseline captured before diagnosis:

- `git status --short`: 42 modified tracked files plus pre-existing untracked evidence, brand, and test files.
- `git diff --stat`: 1,808 insertions and 507 deletions across the tracked working tree, including the first-pass redesign.
- `HEAD`: `566e140 Record LifeLink publication status`.
- No commit, push, merge, reset, clean, force-push, or history rewrite was performed.

Files read during M0:

- Styles: `src/styles/index.css`, `tokens.css`, `base.css`, `components.css`, `layout.css`, `pages.css`, `premium.css`, `bloodstream.css`, `lifeline.css`.
- Shell/routes: `src/App.tsx`, `src/components/layout/AppShell.tsx`, `Sidebar.tsx`, `Topbar.tsx`, `ProtectedRoute.tsx`.
- UI primitives: `PageHeader.tsx`, `FormField.tsx`, `DataTable.tsx`, `Skeleton.tsx`, plus the remaining files in `src/components/ui/`.
- Requested pages: `DashboardPage.tsx`, `ProfilePage.tsx`, `DonorsPage.tsx`, `NearbyDonorsPage.tsx`, `LoginPage.tsx`, `RegisterPage.tsx`, `LandingPage.tsx`.

## Root causes

### D1 — Landing hero is too tall and clips on short viewports

`src/styles/lifeline.css:334-340` gives `.bloodstream-hero .marketing-container` `padding-block: clamp(3.25rem, 8vw, 7rem)`, while `.hero-title` uses `--text-6xl` (`clamp(3.25rem, 8vw, 6.75rem)`) at `lifeline.css:371-381`, `.hero-lede` adds another `var(--space-6)` margin at `:388-394`, actions add `var(--space-8)` at `:396-408`, and `.hero-proof` adds another two-row block at `:440-449`. Those vertical costs are not balanced against viewport height. On 768px-wide and short desktop viewports the visual and proof rail push primary content below the fold instead of resolving into a compact first screen.

`src/styles/premium.css:582-591` also applies a separate `.hero/.marketing-hero` padding rule (`var(--space-20) 0 var(--space-16)`), so the effective hero geometry depends on cascade order rather than one intentional system.

### D2 — Hero copy was replaced and no longer states the owner-approved promise

`src/pages/public/LandingPage.tsx:264-270` renders `Every drop has a <em>journey.</em>` with follow-up copy about “one operation and the same accountable team.” The owner requires the exact headline “Every Drop Has a Destination.” with the supplied supporting sentence and the two specified CTAs. The first-pass identity changed the message, not just its styling.

### D3 — Blood compatibility is presented as a dense matrix table, not an explorer

`src/pages/public/LandingPage.tsx:349-415` renders a `.compat-table` with eight recipient rows and eight donor columns inside a horizontal scroll wrapper. `src/styles/lifeline.css:744-770` styles only a toolbar select; the matrix itself remains a small-status grid of yes/no cells. This is difficult to scan, gives equal visual weight to 64 cells, and does not invite exploration. The pure logic already exists in `src/lib/bloodCompatibility.ts` and its 64-pair test coverage can stay untouched while the UI becomes an accessible orb explorer.

The two legally/safety-significant notes are present in the source but need stronger visual hierarchy in the new explorer: the nearby-discovery note at `LandingPage.tsx:46-47`, and `RBC_COMPATIBILITY_NOTE` from `bloodCompatibility.ts`. Their exact text must not be paraphrased.

### D4 — Journey section has a muddy, over-layered vessel treatment

`src/pages/public/LandingPage.tsx:332-345` wraps `JourneyVessel` in `.journey-section`; `src/styles/bloodstream.css:369-422` layers selected states, node rings, and an active-detail panel over the same journey rail. The surrounding section gradient in `bloodstream.css` is dark and low-contrast, so the interactive stage rail reads as decoration rather than a clear five-step sequence. The brand primitives already provide keyboard-accessible stage buttons (`src/components/brand/JourneyVessel.tsx:19-45`), so the defect is presentation and hierarchy, not behavior.

### D5 — Auth password fields misuse the search-input wrapper

`src/pages/public/LoginPage.tsx:177-197` and `RegisterPage.tsx:248-307` put `Eye`/`EyeOff` buttons inside `.search-input-wrap`. `src/styles/components.css:377-393` absolutely positions **every** descendant `svg` at `left: 11px` and adds `padding-left: 36px` to the input. The visibility toggle is therefore pinned over the left side of the password text instead of sitting at the right edge, with no right padding reserved for it. This is a concrete field-level defect, separate from the overall auth layout.

The same pages use repeated `btn btn-ghost btn-icon` visibility controls whose 40px base control height (`components.css:319-333`) is only raised to 44px on coarse pointers (`premium.css:901-916`); keyboard and mouse users get smaller targets than the new control standard requires.

### D6 — Auth shell is duplicated, sparse, and vertically unbalanced

Two auth systems coexist. `src/styles/pages.css:433-495` defines `.auth-layout/.auth-panel/.auth-form/.auth-aside`; `src/styles/premium.css:603-641` overrides `.auth-shell/.auth-layout` and the same `.auth-panel/.auth-visual/.auth-aside`; `src/styles/lifeline.css:1125-1252` then overrides them again with a third grid, dark visual panel, and `.auth-card`. `src/styles/index.css:7-10` loads all three in the same `pages` layer context with `lifeline.css` last as `utilities`.

`RegisterPage.tsx:174-195` has the same short left-panel statement as login but five fields plus a strength meter and checklist on the right. With `.auth-shell { min-height: 100dvh }`, `.auth-visual { padding: clamp(1.5rem, 4vw, 3.5rem) }`, and `.auth-card { gap: var(--space-5); padding: clamp(1.25rem, 3vw, 2.25rem) }` (`lifeline.css:1125-1208`), the left side becomes a large empty gradient while the right side scrolls. The fix needs one auth system and a balanced two-column composition, not another override.

### D7 — App cards and statistics use competing surface vocabularies

There are at least nine overlapping container classes: `.surface`, `.surface-raised`, `.surface-interactive`, `.surface-glass`, `.card`, `.premium-card`, `.metric-card`, `.kpi-card`, `.task-card`, and `.chart-card`. `src/styles/components.css:94-103` gives `.card` a border/radius/shadow but **no padding**; padding lives in `.card-pad`, `.card-header`, `.card-body`, and `.card-footer`. `src/styles/premium.css:92-103` gives `.surface` and `.card` another full surface definition; `premium.css:156-185` gives `.metric-card/.kpi-card` a third border, shadow, top accent, and hover transform; `lifeline.css:1350-1421` overrides several of those values again.

This produces inconsistent nested surfaces in the requested pages:

- `DashboardPage.tsx:107-138`: `task-card surface surface-interactive`.
- `DashboardPage.tsx:350-412`: `surface surface-glass` containing a nested plain `surface`, then `metric-card` children.
- `DashboardPage.tsx:480-529`: `surface surface-glass` with `.metric-grid.operational-metrics` and more `metric-card` children.
- `ProfilePage.tsx:137-263`: multiple `surface-glass`/`surface-raised` sections, a three-card `metric-grid`, and nested `task-grid` cards.
- `DonorsPage.tsx:417-433`: `metric-card surface` (two surface systems on one element).

`premium.css:148-154` forces `.operational-metrics` and `.analytics-overview-metrics` to exactly three columns, with only a 641–1100px two-column exception at `:890-899`; this orphans cards when permissions expose one or two metrics and contributes to the dense stat-grid defect.

### D8 — Donors page has nested chrome, a search-icon regression, and weak table rhythm

`DonorsPage.tsx:483-505` wraps the filter toolbar in `surface-interactive`, which adds hover lift and focus outline (`premium.css:124-138`) around a static toolbar. The search input then uses `search-input-wrap` with a `Search` icon (`DonorsPage.tsx:488-501`); because `components.css:384-389` positions that icon absolutely at the left, it overlaps the placeholder/text unless the wrapper is the search-specific variant. Native `select` controls in the same toolbar rely on `.select` (`.components.css:319-333`) while the wrapper itself introduces another visual layer.

The detail drawer adds another nested surface at `DonorsPage.tsx:633-650` (`surface surface-raised` inside the drawer), and several sections use inline `style={{ marginTop: 16 }}` (`DonorsPage.tsx:570`, `:674`, `:779`, `:950`) instead of the spacing system. The table view needs one clear container, consistent padding, and no overlapping icon.

### D9 — Nearby donor controls are native, inconsistent, and undersized

`NearbyDonorsPage.tsx:96-113` uses bare `<select>` and `<input>` elements inside `FormField`. `FormField.tsx:29-72` only wires ids/ARIA attributes; it does **not** apply the `.input`/`.select` classes. `base.css:81-87` only sets `font: inherit; color: inherit`, so these controls do not receive the 40px min-height, border, padding, focus ring, or invalid state defined in `components.css:319-357`. The only height protection is `@media (pointer: coarse)` in `premium.css:901-916`, which does not apply to mouse/keyboard users.

The page also mixes two control systems: nearby-filter fields are bare, while the location-consent fields in `DonorsPage.tsx:645-655` use `.form-grid`/`FormField` in a `.donor-location-controls` grid (`premium.css:954-955`) with different column rules. The exact clinical note is present at `NearbyDonorsPage.tsx:138-141` and must remain verbatim.

### D10 — App-shell navigation and topbar density were never normalized

`src/styles/layout.css:66-97` gives `.sidebar-nav` `overflow-y: auto` and `.nav-link` `min-height: 40px`, with 10px uppercase group labels. There is no dedicated scrollbar treatment, no compact/expanded rhythm beyond the existing collapse control, and no consistent 44px minimum for fine-pointer input. `Topbar.tsx:149-151` adds a `DEMO DATA · NOT LIVE BLOOD AVAILABILITY` flag, while `premium.css:956-959` lets it wrap on small screens; the surrounding topbar has no explicit responsive stacking contract in `layout.css`. The result is a dense, visually noisy shell that makes every app page feel like a legacy dashboard regardless of page-level work.

### D11 — Loading and transition language is fragmented

`src/App.tsx:30-42` has one generic `RouteFallback` made of plain grey skeletons in a `card card-pad`; `ProtectedRoute.tsx:21-27` has a different `PageSkeleton` with its own inline width/margin; each query page adds ad-hoc `Skeleton` lines (`DashboardPage.tsx:116-117`, `:374`, `:419`, `:449`, `:495-496`; `DonorsPage.tsx:581-585`, `:679`, `:784`, `:974`; `NearbyDonorsPage.tsx:153`). There is no shared route transition, no progress indication, no consistent public↔auth↔app motion, no scroll restoration, and no single reduced-motion policy. Existing brand motion primitives (`PageTransition`, `Reveal`, `ScrollProgress`) are unused by the route shell. Loading therefore reads as unrelated shimmers rather than one “Lifeline loading language.”

## Design constraints for M1–M8

- Preserve all business logic, API/auth/role/permission/realtime behavior, routes, and existing tests. Change presentation only.
- Keep privacy boundaries: exact-distance masking, phone masking, consent rules, server-authoritative authorization, and no sensitive donor data in the UI.
- Use self-hosted `Fraunces Variable` for display, `Geist Variable` for UI, and `Geist Mono Variable` for labels/IDs/numbers. Remove Inter and all CDN font loading.
- Replace the layered CSS overrides with one coherent token/primitive system rather than adding another late override layer.
- Keep the two exact clinical/operational notes unchanged. Any illustrative values must be visibly labelled as illustrative.
- WCAG AA contrast, semantic landmarks, visible focus, keyboard operation, reduced motion, and responsive behavior at 360, 390, 768, 1024, 1280, and 1536 widths are required.
- Local H2 backend is the verification stack. Docker/PostgreSQL cannot be rerun in this environment because the Docker daemon is unavailable.
- Keep the working tree dirty; do not commit, push, merge, reset, clean, or rewrite history.

## Exit evidence required

M8 must produce `scripts/ui-audit.mjs`, screenshots at `ui-audit/<route>-<viewport>.png` for the five required viewports, and `ui-audit/REPORT.md` with overflow, padding, control-height, hero, contrast, console, reduced-motion, and transition checks. Every screenshot must be visually inspected. Tests, typecheck, build, bundle diff, and final `git status` must also be reported.
