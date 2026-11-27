# UI audit

`scripts/ui-audit.mjs` is a repeatable, automated visual/quality audit for the
LifeLink frontend. It drives the locally installed Google Chrome through
Playwright's `chrome` channel (no browser download and no new dependencies),
visits every public and authenticated route at five viewports, records machine
checks, and writes screenshot evidence before and after the run.

## Prerequisites

- Frontend dev server reachable at `http://127.0.0.1:5173` (or set
  `UI_AUDIT_BASE_URL` to another running instance).
- Local Google Chrome available for Playwright's `channel: 'chrome'`.
- Seeded backend reachable through the dev server's `/api` proxy so that login
  succeeds. If login fails, the script reports the failure and still audits the
  public routes; authenticated routes are recorded as `skip`, not fabricated.

## Run

From `project/frontend`:

```bash
node scripts/ui-audit.mjs
```

Environment variables (all optional):

| Variable | Default | Purpose |
| --- | --- | --- |
| `UI_AUDIT_BASE_URL` | `http://127.0.0.1:5173` | Frontend origin to audit. |
| `UI_AUDIT_EMAIL` | `admin@lifelink.local` | UI login email. |
| `UI_AUDIT_PASSWORD` | `Admin@123!` | UI login password. |

Example against a different port and user:

```bash
UI_AUDIT_BASE_URL=http://127.0.0.1:4173 \
UI_AUDIT_EMAIL=admin@lifelink.local \
UI_AUDIT_PASSWORD='Admin@123!' \
node scripts/ui-audit.mjs
```

Exit code is `0` when no errors were found and `1` when any error-level check
failed. Warnings are reported but do not by themselves fail the run. The run is
defensive: each route/check is wrapped so one failure does not abort the rest,
and `report.json` is always written before exit.

## Generated evidence

Everything is written to `frontend/ui-audit/` (intentionally untracked, and
safe to delete between runs):

- `report.json` — full machine-readable report: run metadata, login result,
  per-run checks, route transition, reduced-motion checks, and summary counts.
- `<route>-<viewport>-viewport.png` — first viewport only.
- `<route>-<viewport>-full.png` — full page.

Route slugs replace `/` with `-`; `/` becomes `root`. Example:
`app-dashboard-1366x657-viewport.png` and `app-dashboard-1366x657-full.png`.

Viewports audited exactly: `1366x657`, `1440x700`, `1920x950`, `768x1024`,
`390x844`.

Routes audited:

- Public: `/`, `/login`, `/register`.
- Authenticated: `/app/dashboard`, `/app/inventory`, `/app/donors`,
  `/app/donors/nearby`, `/app/requests`, `/app/analytics`.

Login happens once through the real sign-in form; the authenticated context and
page are reused for all subsequent authenticated runs. `report.json` records
the captured Playwright storage state summary. The same page/context is reused
rather than cloned because the refresh token is kept in `sessionStorage`, which
is not included in Playwright's exported storage state.

## Check semantics

Each run stores an array of named checks with `pass`, `warning`, `error`, or
`skip` status and supporting details.

1. **horizontalOverflow** — error if
   `document.documentElement.scrollWidth > window.innerWidth + 1`.
2. **childOverflow** — reports visible elements with negative computed
   width/height (error) or extending more than 2 px beyond the nearest
   overflow-hidden/scrollable ancestor (warning). The exclusion walk starts at
   the element and checks every ancestor: any SVG node (`SVGElement`, SVG
   namespace, `<svg>`, or `closest('svg')`) is skipped because viewBox clipping
   is intentional art, as are `aria-hidden="true"`, `role="presentation"`, and
   fixed-overlay subtrees. Real HTML layout clipping is still reported; the
   `aria-hidden="true"`, `role="presentation"`, and fixed-overlay subtrees. A
  genuinely scrollable ancestor with overflowing content terminates the ancestor
  walk as an intentional affordance (the compact sidebar rail and wide data
  matrices), rather than being reported as a clipped child. The child-overflow
  part is a heuristic, not a proof of visual clipping.
3. **surfacePadding** — warning for visible `.surface`, `.section-card`, or
   `.stat-card` elements with visible text/children whose computed padding is
   zero on all four sides. Explicitly flat wrappers (`surface--flat`,
   `pad-none`, `surface--pad-none`, or `data-flat="true"`), hidden elements, and
   elements with no visible content are ignored and counted separately.
4. **controlHeight** — checks visible `button`, `input`, `select`, and
   `textarea` controls, plus anchors that are clearly standalone controls:
   class contains `btn` or `button`, `role="button"`, or
   `data-audit-control="true"`. Navigation-rail links and branding links are
   excluded because axe target-size governs their minimum; inline prose links
   inside `p`, `li`, `summary`, `.footer-bottom`, or `.marketing-footer-grid`
   are excluded too. Native checkbox/radio controls and explicit compact/icon
   controls remain exceptions. Remaining controls below 40 px are errors; 40–43
   px are warnings (44 px is the target).
5. **copyContract** — applies only to `/` and is scoped to `.marketing-hero`.
   The `h1` must equal `Every Drop Has a Destination.`, `.hero-lede` must equal
   `Connecting donors, hospitals and blood banks through one intelligent
   lifeline. Because when every second matters, every connection counts.`, and
   the hero must contain exactly one accessible **Find Blood** control and one
   accessible **Become a Donor** control. Text comparison is
   whitespace-normalized exact matching; CTA names are exact accessible-name
   matches. Missing or duplicated required copy is an error. Non-root routes
   are skipped.
6. **landmarks** — public routes must have exactly one `<main>` and at least
   one `<header>`. Authenticated routes must have exactly one `<main>` and a
   navigation landmark named `Sections`. Missing or duplicated required
   landmarks are errors.
7. **heroFit** — for `/` at `1366x657` and `1440x700`, checks that the `h1`,
   `.hero-lede`, and primary CTA all have positive bounding rects fully inside
   the first viewport. All rects are recorded in `report.json`. Skipped for
   other route/viewport combinations.
8. **axe** — runs `new AxeBuilder({ page }).withTags([...])` with WCAG 2 A/AA,
   2.1 A/AA, and 2.2 AA tags on every route. Every violation, impact, and
   sample node is included; any violation is an error.
9. **consoleNetwork** — error if any console `error`/`warning`, uncaught page
   error, HTTP response with status `>= 400`, or `requestfailed` event was
   observed during that run. All messages are stored; there is no tolerance
   threshold.
10. **reducedMotion** — separate check for `/` and `/app/dashboard` at
    `390x844`, with `reducedMotion: 'reduce'` emulated. It errors if the media
    query is not active or if any visible running CSS animation has infinite
    iterations.
11. **routeTransition** — clicks the sidebar **Inventory** link from the
    dashboard. It errors on a full document reload (sentinel/time-origin check)
    or console errors, and records whether `.route-transition` /
    `has-view-transitions` was observed.
12. **cls** — installs a `PerformanceObserver` for `layout-shift` before each
    navigation and sums shifts without `hadRecentInput`; `>= 0.05` is an error.
13. **images** — checks each `<img>` for a loadable `currentSrc`/`src`,
    `srcset` candidates, and missing `alt`; checks `<picture><source>`
    `srcset` candidates with `HEAD` requests. Decorative SVG/CSS art and
    `aria-hidden`/`role="presentation"` images are acceptable and exempt from
    the alt requirement.
14. **motionProperties** — scans every accessible stylesheet through CSSOM.
    It checks `transition`/`transition-property` declarations (including the
    transition shorthand, top-level comma splitting, timing functions, and
    vendor-prefixed property names) and `@keyframes` bodies. Any declaration
    animating `width`, `height`, `top`, `left`, `right`, `bottom`, `gap`,
    `row-gap`, `column-gap`, `margin*`, `padding*`, `flex*`, or `grid-*` is an
    error. `transform`, `opacity`, `filter`, `box-shadow`, `border-color`,
    `background-color`, `color`, `stroke`, `fill`, `clip-path`, custom
    properties, static layout declarations, `all`, and unresolvable
    `var()`/`calc()` values are not flagged. Findings record the stylesheet
    href, selector, offending property, and declaration value; inaccessible
    cross-origin stylesheets are listed rather than guessed at.

## Manual review is still required

Automated checks cannot judge visual hierarchy, spacing rhythm, readability,
brand expression, or whether a full-page screenshot actually looks correct.
Open the generated `-viewport.png` and `-full.png` files and compare the five
viewports yourself, especially the landing hero at `1366x657` and `1440x700`,
mobile navigation/drawers, dense tables, and charts. Treat `report.json` as
evidence of measurable quality, not as a substitute for inspection.
