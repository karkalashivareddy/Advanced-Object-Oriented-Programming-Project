# LifeLink design + motion pass — M0 diagnosis

Date: 2026-11-27  
Stage: M0, read-only diagnosis. This document was written before any redesign component/CSS/layout edit.

## Working-tree note

`git status` was checked first. `HEAD` is `566e140 Record LifeLink publication status`; the tree already contained the owner-rejected first-pass work plus untracked evidence/brand files.

Immediately before this detailed brief arrived, `npm uninstall @fontsource-variable/inter` had been run while starting the earlier M1. Relative to `HEAD`, the current manifest diff still shows only the first-pass additions (`@fontsource-variable/fraunces`, `@axe-core/playwright`); Inter is no longer present in `package.json` or `package-lock.json`. No source component, stylesheet, route, API, auth, test, or motion file has been changed for this pass. Nothing will be reset or reverted; the Inter removal satisfies the new requirement and is preserved.

## Files read

- All styles: `index.css`, `tokens.css`, `base.css`, `components.css`, `layout.css`, `pages.css`, `premium.css`, `bloodstream.css`, `lifeline.css`.
- Routes/shell: `src/App.tsx`; `components/layout/AppShell.tsx`, `Sidebar.tsx`, `Topbar.tsx`, `ProtectedRoute.tsx`, `NotificationCenter.tsx`, `OrganizationSwitcher.tsx`, `layout-keyboard.test.tsx`.
- UI primitives: every file in `components/ui/` including `DataTable.tsx`, `FormField.tsx`, `Skeleton.tsx`, `PageHeader.tsx`, `Modal.tsx`, `StatusBadge.tsx`, `Toast.tsx`, `EmptyState.tsx`, `FreshnessIndicator.tsx`, `Charts.tsx`, `AnalyticsBarChart.tsx`, `DeferredBarChartView.tsx`, and tests.
- Brand primitives: every file in `components/brand/` including `BloodDrop.tsx`, `BloodstreamVisual.tsx`, `CellField.tsx`, `Counter.tsx`, `JourneyVessel.tsx`, `LifelinePath.tsx`, `Magnetic.tsx`, `PageTransition.tsx`, `Reveal.tsx`, `ScrollProgress.tsx`, `Wordmark.tsx`, `index.ts`, and tests.
- Pages requested: `LandingPage.tsx`, `LoginPage.tsx`, `RegisterPage.tsx`, `DashboardPage.tsx`, `ProfilePage.tsx`, `DonorsPage.tsx`, `NearbyDonorsPage.tsx`.
- Supporting evidence read: `src/lib/motion.ts`, `src/lib/utils.ts`, `src/lib/constants.ts`, `src/lib/bloodCompatibility.ts` / test, `src/main.tsx`, `index.html`, `vite.config.ts`.

---

# A1–A11 root causes

## A1 — Hero starts too low; visual cut off on a short viewport

**Root cause:** hero height is composed from unbounded vertical padding plus a tall two-column grid, with no viewport-height budget or short-screen mode.

- `src/styles/lifeline.css:334-340` — `.bloodstream-hero .marketing-container { padding-block: clamp(3.25rem, 8vw, 7rem) }`. At 1366px this is already ~109px per side, before nav.
- `src/styles/lifeline.css:371-381` — `.hero-title` uses `--text-6xl` (`clamp(3.25rem, 8vw, 6.75rem)`, `tokens.css:121`) and `line-height: 0.92`.
- `src/styles/lifeline.css:388-394`, `:396-408`, `:440-449` — lede, actions (50px buttons), and a two-row `.hero-proof` add further vertical cost.
- `src/styles/lifeline.css:470-480` — `.hero-vessel-card` has `min-height: 360px` and `aspect-ratio: 760 / 480`, so the right column cannot shrink with the viewport.
- `src/styles/premium.css:582-591` — a second `.hero/.marketing-hero` padding rule (`var(--space-20) 0 var(--space-16)`) competes with the Lifeline rule; cascade order decides the result.
- `src/styles/index.css:1-10` — all layers are loaded, with `lifeline.css` last as `utilities`, so the late override wins instead of one intentional hero contract.

There is no `100svh − navHeight` centering rule anywhere. The owner’s ~1456×655 viewport therefore sees dead space above the eyebrow and a clipped vessel card.

## A2 — Headline/support/CTA copy drifted

**Root cause:** the first-pass identity rewrite replaced approved product copy in JSX.

- `src/pages/public/LandingPage.tsx:264-270` renders `Every drop has a <em>journey.</em>` and a three-sentence workspace description.
- `src/pages/public/LandingPage.tsx:272-281` renders CTAs `Create donor account` → `/register` and `Sign in to workspace` → `/login`.

Required exact copy is “Every Drop Has a Destination.”, the supplied supporting sentence, `Find Blood` (primary) and `Become a Donor` (secondary → `/register`). This is a content regression, not a CSS problem.

## A3 — Journey background muddy; “01 / THE CONTINUUM” nearly invisible

**Root cause:** two gradient systems overlap, and the chapter label is low-alpha white over a mid-tone gradient.

- `src/styles/bloodstream.css:300-304` — `.journey-section` uses `linear-gradient(180deg, var(--color-vessel-50), var(--color-plasma) 45%, #fff)`.
- `src/styles/lifeline.css:657-659` — `.journey-section` then adds only a top border; it does not remove the earlier light-to-dark-to-light gradient.
- `src/styles/lifeline.css:621-635` — `.marketing.bloodstream-page .eyebrow` uses `color: rgb(255 255 255 / 78%)` and `background: rgb(255 255 255 / 4%)`.
- `src/styles/lifeline.css:637-647` — `.chapter-rail` uses `color: rgb(255 255 255 / 54%)`, which is the exact “01 / The continuum” label at `LandingPage.tsx:335`.
- `src/styles/bloodstream.css:324-330` and `:337-340` — `.journey-vessel-wrap` scrolls horizontally and `.journey-vessel-track { min-width: 920px }`, so the section also inherits a legacy horizontal-rail treatment.

The mixed `vessel-50 → plasma → #fff` ramp produces the muddy pink-grey; the 54% white micro-label fails AA over both the dark and mid-tone portions.

## A4 — Blood-group section is a dull table, wrong casing and wrong wording

**Root cause:** the explorer was never implemented; the first-pass table remains, and generic `humanize()` mangles the AB group.

- `src/pages/public/LandingPage.tsx:363-412` — `.compat-shell > .compat-toolbar + .compat-matrix-wrap > table.compat-table` renders recipient select, 8 donor rows, and a two-column “Shown in matrix” table.
- `src/pages/public/LandingPage.tsx:392`, `:406`, `:415-417` — visible wording is `Shown in matrix`, `Shown`, `Not shown`, and legend text. Required wording is `Compatible` / `Not compatible`.
- `src/styles/lifeline.css:802-842` — `.compat-table`, `.compat-table th`, `.compat-table td` style the dense grid.
- `src/lib/utils.ts:1-9` — `humanize()` lowercases before title-casing, so `AB_POSITIVE` (`src/lib/constants.ts:16`) becomes `Ab Positive`. The same call appears at `LandingPage.tsx:373`, `:379`, and `:398`.
- `src/lib/bloodCompatibility.ts` already exports the pure RBC matrix and exact note; `src/lib/bloodCompatibility.test.ts` covers all 64 pairs. The logic can be preserved while the UI is replaced with an accessible orb explorer plus a real text-table fallback.

The exact RBC note is currently rendered at `LandingPage.tsx:419-421`; it must remain verbatim and be visually promoted in the explorer.

## A5 — Password field narrower; eye icon on the left

**Root cause:** the password visibility button is placed inside a flex search wrapper whose global SVG rule pins all icons to the left, and whose flex button shrinks the input.

- `src/pages/public/LoginPage.tsx:177-197` and `src/pages/public/RegisterPage.tsx:248-307` — password inputs are wrapped in `.search-input-wrap`; the `Eye`/`EyeOff` control is a `button.btn.btn-ghost.btn-icon`.
- `src/styles/components.css:377-382` — `.search-input-wrap { display: flex; align-items: center }`.
- `src/styles/components.css:384-389` — `.search-input-wrap svg { position: absolute; left: 11px }`: this targets the eye icon too, placing it left even though the button is last in DOM.
- `src/styles/components.css:391-393` — only `padding-left: 36px` is reserved; no right padding is reserved for the toggle.
- `src/styles/components.css:82-87` — `.btn-icon { width: 36px; min-height: 36px; padding: 0 }` is a flex item, so the `width: 100%` input (`components.css:319-333`) shrinks by ~36px; the email field has no such sibling and remains full width.
- `src/styles/components.css:319-333` — controls are 40px high; `src/styles/premium.css:901-916` only raises them to 44px on coarse pointers.

Required: one 44px control height, identical widths, explicit left-icon/right-action slots with reserved padding, and right-side `aria-label` + `aria-pressed` toggle.

## A6 — Auth left-panel headline overlaps art; register panel sparse

**Root cause:** absolute decorative layers are painted behind text with no protected content zone, and auth has three competing layout systems.

- `src/styles/pages.css:433-495` — `.auth-layout/.auth-panel/.auth-form/.auth-aside`.
- `src/styles/premium.css:603-641` — redefines `.auth-shell/.auth-layout/.auth-panel/.auth-visual/.auth-aside`.
- `src/styles/lifeline.css:1125-1252` — third override: `.auth-shell { min-height: 100dvh }`, `.auth-visual { padding: clamp(1.5rem, 4vw, 3.5rem) }`, `.auth-visual__path { position: absolute; right: -8%; bottom: 12%; height: 210px }`, `.auth-visual__statement { max-width: 15ch; font-size: clamp(2.4rem, 4vw, 4rem) }`.
- `src/styles/lifeline.css:1155-1158` — content is merely `position: relative; z-index: 1`; there is no reserved safe zone above the vein/cell field.
- `src/pages/public/LoginPage.tsx:120-135` and `RegisterPage.tsx:174-184` — `CellField`, `LifelinePath`, `Wordmark`, and footer copy all share the same panel.
- `RegisterPage.tsx:215-307` — five fields plus a strength meter/checklist are taller than login’s two fields, but the left panel uses the same short statement, leaving it mostly empty and forcing right-side scroll.

One shared auth composition with a typographic safe zone is needed; not another override layer.

## A7 — App cards have no inner padding; chips straddle borders; overflow

**Root cause:** `.surface` has no padding, `.card` is a separate class with no padding, and multiple card systems are mixed on the same elements.

- `src/styles/components.css:94-103` — `.card` supplies border/radius/shadow but **no padding**; padding lives only in `.card-pad`, `.card-header`, `.card-body`, `.card-footer`.
- `src/styles/premium.css:92-103` — `.surface`, `.surface-raised`, `.surface-interactive`, `.surface-glass`, `.card` get another full surface definition with `min-width: 0` but still no padding.
- `src/styles/lifeline.css:1350-1362` — another override for `.card/.surface/.surface-raised/.premium-card/.metric-card` and `.card-pad`.
- `src/styles/premium.css:27-41` — `.eyebrow` is a pill with border/background/padding; when it is the first child of a zero-padding `.surface`, it visually sits on the card border. `components.css:160-170` has a second `.eyebrow` definition without the pill.
- `DashboardPage.tsx:350-412` — `surface surface-glass` wraps a nested plain `surface` and `metric-card` children with no section padding.
- `DashboardPage.tsx:480-529` — `surface surface-glass` contains `.metric-grid.operational-metrics` with more `metric-card`s.
- `ProfilePage.tsx:137-153` — `surface surface-glass` contains `.section-heading` with `.eyebrow` and a 44px inline avatar, but no card padding; `:194-215` repeats this with `surface surface-raised`.
- `ProfilePage.tsx:278-285` — `.danger-zone` is the correct reference: `premium.css:562-569` gives it `padding: var(--space-5)`.
- Miscellaneous inline styles (`ProfilePage.tsx:148`, `:336`, `:359`, `:375`; `DonorsPage.tsx:570`, `:674`, `:779`, `:950`) bypass any spacing token system.
- `src/styles/tokens.css:191` — `--content-max: 1440px`; `src/styles/layout.css:384-388` lets `.app-content-inner` reach that width. The brief requires a 1280px shell.
- `src/styles/premium.css:148-154` — `.operational-metrics/.analytics-overview-metrics { grid-template-columns: repeat(3, ...) }` can force a third card/avatar beyond the available width when the sidebar is visible.

Fix requires one `Surface` primitive with padding token and `overflow: clip`, plus `SectionCard`, `StatCard`, `Grid`, and a 1280px page shell.

## A8 — Donors page double border, missing icon gap, helper misalignment, Actions flush

**Root cause:** toolbar and search styles from two systems stack; nested surfaces add a second border; table cells have no first/last padding contract.

- `DonorsPage.tsx:483-505` — `.surface-interactive` wraps `.filter-grid`; `premium.css:124-138` gives that wrapper hover lift/focus outline, making a static toolbar look like a card.
- `DonorsPage.tsx:488-501` — `.search-input-wrap` with `<Search>`; `components.css:384-393` positions the icon at `left: 11px` and reserves 36px left padding.
- `premium.css:245-262` — `.toolbar-search .input { padding-left: 38px }` and `.toolbar-search > svg { left: 12px }` add a second icon/padding rule on the same input. When the icon is not rendered or a different wrapper is used, the reserved space appears as an empty gap.
- `DonorsPage.tsx:503-505` — helper text is a sibling of `.filter-field` inside `.filter-grid`, so it joins the auto-fit grid and misaligns the row (`premium.css:264-269`).
- `DonorsPage.tsx:570`, `:634`, `:674`, `:779` — nested `.surface`/`.surface surface-raised` blocks create double borders.
- `components.css:446-480` — `.data-table th/td { padding: var(--space-3) var(--space-4) }` (12/16px), with no special padding for first/last cells; `DonorsPage.tsx:392` renders `.table-actions` in the last cell, so Actions sits close to the edge. `components.css:409-417` gives `.table-toolbar` 16/20px padding, but nested wrappers override the rhythm.
- `components.css:432-437` — `.table-scroll` is the only horizontal containment; no sticky header rule exists.

## A9 — Nearby finder control heights differ

**Root cause:** bare native controls bypass `.input`/`.select`; only pointer-coarse devices get a height rule.

- `NearbyDonorsPage.tsx:97-112` — `<select>` and `<input>` elements inside `FormField` have no `className`.
- `src/components/ui/FormField.tsx:29-72` — `wireControl()` only adds ids/ARIA attributes; it never applies `.input`/`.select`.
- `src/styles/base.css:81-87` — bare controls receive only `font: inherit; color: inherit`.
- `src/styles/components.css:319-333` — `.input/.select/.textarea { min-height: 40px; padding: 9px 11px; border: ... }` is never applied to the nearby fields.
- `src/styles/premium.css:901-916` — 44px minimum applies only under `@media (pointer: coarse)`, so mouse/keyboard users see native ~26–28px controls beside 44px buttons.
- `DonorsPage.tsx:645-655` uses `.donor-location-controls` (`premium.css:954-955`) with a different grid, so the two nearby-related forms do not share a control contract.

## A10 — Sidebar scrollbar always visible; items cut off on short viewports

**Root cause:** the nav is a raw overflow container in a fixed `100dvh` flex column, with no scrollbar styling or compact density breakpoint.

- `src/styles/layout.css:17-27` — `.sidebar { height: 100dvh; display: flex; flex-direction: column }`.
- `src/styles/layout.css:66-70` — `.sidebar-nav { flex: 1; overflow-y: auto; padding: var(--space-4) var(--space-3) }`; no `scrollbar-width: thin`, `scrollbar-color`, or overlay-hidden styling.
- `src/styles/layout.css:86-101` — `.nav-link { min-height: 40px }` plus 2px stacked gaps; `src/styles/layout.css:76-84` adds 10px group labels and margins.
- `src/styles/layout.css:123-138` — `.sidebar-footer` and collapse control are always present under the scroll area.
- `Sidebar.tsx:96-136` — all accessible nav groups are rendered; no density mode.
- `layout.css:436-439` — collapsed rail hides labels but only uses native `title` tooltips from `Sidebar.tsx:108`, not a designed tooltip.

At viewport heights below ~760px the combined brand + nav + footer exceeds the shell, producing the persistent scrollbar and clipped items.

## A11 — Orphan stat card in a two-column grid

**Root cause:** fixed 3-column metric rules and a 2-column breakpoint create an empty slot for three-item sets.

- `src/styles/premium.css:141-154` — `.metric-grid { repeat(auto-fit, minmax(190px, 1fr)) }`, but `.operational-metrics` and `.analytics-overview-metrics` override it to `repeat(3, minmax(0, 1fr))`.
- `src/styles/premium.css:890-899` — between 641–1100px those same grids become `repeat(2, minmax(0, 1fr))`.
- `ProfilePage.tsx:202-215` renders exactly three `metric-card`s; at two columns the third card is orphaned.
- `DashboardPage.tsx:389-405` also renders three donor metric cards; `:492` and `:508` use `.operational-metrics`.
- `src/styles/premium.css:286-295` — `.task-grid` uses `repeat(auto-fit, minmax(240px, 1fr))`, but `.task-queue-grid` is fixed at three columns, so grids do not share one responsive rule.

Required contract is `repeat(auto-fit, minmax(min(100%, 260px), 1fr))` with `min-width: 0` on children, which fills the row without hard-coded 2/3 overrides.

---

# Foundation-level causes (why the defects repeat)

1. **Competing class systems were never deleted.** `tokens.css` → `base.css` → `components.css` → `layout.css` → `pages.css` → `premium.css` → `bloodstream.css` → `lifeline.css` (`index.css:1-10`) all define or override `.card`, `.surface*`, `.metric-card`, `.kpi-card`, `.task-card`, `.chart-card`, `.eyebrow`, `.auth-*`, `.hero*`, `.filter-*`, `.data-table`, and `.btn`. Late `utilities` rules mask earlier definitions rather than replacing them.
2. **Padding is not part of the surface primitive.** `.card`/`.surface` carry borders and shadows only; `.card-pad`, `.danger-zone`, `.metric-card`, `.task-card`, and `.auth-card` each invent their own padding. This is the direct source of A7/A8.
3. **Minimum widths are inconsistent.** Many grids use `min-width: 0`, but fixed 3-column overrides (`premium.css:148-154`, `:293-295`) and a 1440px content max (`tokens.css:191`) defeat containment.
4. **No shared control primitive.** 40px base, 44px coarse-pointer only, bare native controls in nearby search, and a flex search wrapper that shrinks inputs produce A5/A9.
5. **Icon slots are not explicit.** `components.css:384-393` and `premium.css:257-262` absolutely position all SVGs on the left and reserve left padding whether or not an icon exists, causing A5/A8.
6. **Page shell is too wide.** `tokens.css:191` and `layout.css:384-388` allow 1440px; the brief requires 1280px with `clamp(16px, 3vw, 32px)` gutters.
7. **CSS layers are declared but not used to eliminate duplicates.** `@layer tokens, base, layout, components, pages, utilities` is declared at `index.css:1`, yet `premium.css`, `bloodstream.css`, and `lifeline.css` are all imported into `pages`/`utilities` as overlapping systems.

---

# Motion, loading, and color/type diagnosis

## Motion and transitions

- `src/components/brand/PageTransition.tsx:10-12` is only a `<div className="page-transition">`; it does not use Motion, `AnimatePresence`, route keys, or enter/exit choreography.
- `App.tsx:1-42` uses a single plain `RouteFallback` (grey skeleton lines in `card card-pad`); `ProtectedRoute.tsx:21-27` uses a different `PageSkeleton`; query pages add ad-hoc skeletons. No `TopProgress`, blood wipe, View Transition API, scroll restoration, prefetch, or branded ECG loader exists.
- `AppShell.tsx:56-58` includes a static `.lifeline-rail` with `LifelinePath variant="status"`, but there is no connection-state logic; the motif is not shared with loading or TopProgress.
- `src/lib/motion.ts:1-44` has only a reduced-motion check and an rAF counter; it does not export the required `ease`, `dur`, `rise`, or `stagger` contracts, and no `motion` package is installed.
- `src/components/motion/` does not exist; required reusable primitives (`Reveal`, `Stagger`, `Counter`, `Magnetic`, `Tilt`, `SplitText`, `ScrollProgress`, `ParallaxLayer`, `PressScale`) are either absent or live in `components/brand/` without the requested API.
- Loop pause: `bloodstream.css:223` (`animateMotion`-style flow via CSS), `lifeline.css:149` (`cell-drift ... infinite`), `premium.css:406` (`live-pulse ... infinite`), `components.css:690` (`shimmer 1.5s infinite`), `:813` (`spin 1s linear infinite`), and `BloodstreamVisual.tsx:131-151` (`<animateMotion repeatCount="indefinite">`) run without a `document.hidden` or offscreen pause. `base.css:258-269` stubs them under reduced motion but does not pause them for hidden tabs.
- `Counter.tsx:13-38` counts on mount, not once on view; reduced motion jumps correctly.

## Color and typography

- `src/styles/tokens.css:5-109` uses a different palette/naming scheme than the required Part B tokens (no `--crimson-50…900`, `--paper-0…300`, `--text-strong/body/on-dark*`, `--grad-*`, `--shadow-1/2/3`, `--ring`, `--hairline`).
- `tokens.css:105-106` still sets `--font-sans: 'Inter Variable', …`; `src/main.tsx:3` imports `@fontsource-variable/inter/index.css`. Both must go.
- `tokens.css:107-109` sets Fraunces display and a system monospace stack; `Geist Variable` and `Geist Mono Variable` are neither imported nor tokenized.
- `components.css:319-333`, `:160-170`, `premium.css:27-41`, and `lifeline.css:1125-1252` contain ad-hoc font sizes (`0.62rem`, `0.66rem`, `0.6875rem`, clamped values) instead of one fluid scale.
- `Progress`/numeric elements are inconsistent: `tokenStore` IDs use `.mono` in some pages, table headers are forced mono in `lifeline.css:1402-1409`, nearby IDs are plain text. No global tabular/mono contract for labels, IDs, and numerals exists.
- `Topbar.tsx:148-152` renders the loud yellow DEMO DATA pill; `premium.css:956-962` styles it with `#fff6d8`, `#ebc875`, 10px/800 text and no info icon. This is honest but visually inconsistent with the refined amber chip requirement.

## Imagery/graphics

- Hero and marketing visuals are vector/canvas (`BloodstreamVisual.tsx`, `CellField.tsx`, `LifelinePath.tsx`, `BloodDrop.tsx`), which is good for DPR, but there is no `scripts/build-images.mjs`, no `assets-src/`, no `Picture` component, no AVIF/WebP/JPEG pipeline, no blurred placeholders, no favicon set, no webmanifest, no OG image, and no image credits file.
- No photography is currently downloaded, so there are no license risks; the site must remain complete using the illustration set if no verified assets are added.
- `index.html:1-19` has basic title/description/theme-color but no OG/meta image, manifest, or icon set beyond `favicon.svg`.

---

# Acceptance plan derived from the diagnosis

- M1: replace tokens with the Part B palette, self-host Geist/Geist Mono/Fraunces, add `motion`/`lenis`/`sharp` (dev), create `docs/color-contrast.md`, and delete legacy font/layer conflicts.
- M2: implement `Surface`, `SectionCard`, `PageHeader`, `StatCard`, `Grid`, `DataTable`, `Field/Input/Select/PasswordField`, 1280px shell, thin auto-hiding sidebar, and migrate every app page (A7–A11).
- M3: rebuild auth on one composition with reserved icon/action slots and protected art safe zone (A5, A6).
- M4: create `src/lib/motion.ts`, `src/styles/motion.css`, `src/components/motion/*`, `RouteTransition`, `TopProgress`, branded fallbacks, blood wipes, ECG button loading, prefetch, scroll restoration, visibility/offscreen loop pausing.
- M5: compact `100svh − navHeight` hero, exact copy/CTAs, SplitText, restrained ambient system, Lenis landing-only, cursor halo, fixed scroll progress (A1, A2).
- M6: dark high-contrast journey, scroll-bound stages, orb compatibility explorer with text fallback and exact notes (A3, A4).
- M7: image pipeline/illustrations/favicons/manifest/OG with no invented or unlicensed content.
- M8: app polish (active indicator, realtime badge, charts, skeletons, empty states).
- M9: `scripts/ui-audit.mjs`, screenshots for all five viewports, axe contrast, console/failed-request checks, reduced-motion and transition runs, visual inspection, `REPORT.md`, tests/typecheck/build, bundle diff, and final `git status`.

No commits, pushes, merges, resets, cleans, or history rewrites will be performed.
