# LifeLink Frontend

React 19 + TypeScript + Vite single-page application for the LifeLink blood supply platform. It talks to the documented `/api/v1` REST API and contains no production mock data. The REST inbox is authoritative, and the SPA also mounts an authenticated SockJS/STOMP bridge through `/ws` that invalidates notification caches. Both a standalone authenticated smoke and a browser `CONNECT`/`SUBSCRIBE`/`CONNECTED` capture are recorded ([`../docs/evidence/STOMP_SMOKE_RESULT.json`](../docs/evidence/STOMP_SMOKE_RESULT.json), [`../docs/evidence/BROWSER_STOMP_RESULT.json`](../docs/evidence/BROWSER_STOMP_RESULT.json)). See [`../docs/user-guide/USER_GUIDE.md`](../docs/user-guide/USER_GUIDE.md) for the implemented role journeys.

## Requirements

- Node.js 24+
- npm 11+
- The LifeLink backend on `http://localhost:8080` for live data (`http://localhost:18080` in the verified Compose stack)

## Setup

```bash
cd project/frontend
npm install
cp .env.example .env   # optional; defaults are correct for local development
npm run dev
```

The dev server listens on `http://localhost:5173` and proxies both `/api` and `/ws` (SockJS HTTP and WebSocket upgrade) to `http://localhost:8080` by default. For the verified Compose stack set `VITE_API_PROXY_TARGET=http://127.0.0.1:18080`; the backend must be running with a shell-supplied `JWT_SECRET` and, for demo data under the `postgres` profile, `SEED_DEMO_DATA=true`. See [`../docs/deployment/DEPLOYMENT_GUIDE.md`](../docs/deployment/DEPLOYMENT_GUIDE.md).

## Environment variables

| Variable | Default | Purpose |
| :--- | :--- | :--- |
| `VITE_API_BASE_URL` | `/api` | Base URL for API requests. The client appends `/v1`. Set a full origin only when CORS is configured correctly. |

## Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Start Vite on port 5173 with the `/api` proxy. |
| `npm run build` | Type-check with TypeScript project references and build to `dist/`. |
| `npm run preview` | Serve the production build locally. |
| `npm test` | Run the Vitest unit suite once (39 tests in the current run). |
| `npm run test:watch` | Run Vitest in watch mode. |
| `npm run test:e2e` | Run Playwright specs under `e2e/` (18 passes on Chrome and Edge with retries 0 in the current run; see [`../docs/evidence/PLAYWRIGHT_RESULTS.json`](../docs/evidence/PLAYWRIGHT_RESULTS.json)). |
| `npm run test:e2e:ui` | Open the Playwright UI runner. |
| `npm run test:stomp` | Standalone Node SockJS/STOMP smoke through the configured nginx/backend target; the SPA bridge evidence is captured separately. |
| `npm run typecheck` | Type-check without emitting files. |

## Structure

```text
src/
├── components/
│   ├── layout/     App shell, sidebar, topbar, notifications, route guard
│   └── ui/         DataTable, Modal/Drawer, Toast, FormField, charts, states
├── hooks/          Debounce helper
├── lib/            API client, auth context, permissions, navigation, analytics helpers
├── pages/
│   ├── public/     Landing, login, registration, 403, 404
│   └── app/        Dashboard and operational/admin pages
├── styles/         Design tokens, base rules, components, layout, pages
├── test/           Vitest setup
└── types/          API envelope and domain types
```

API contracts are mirrored from [`../docs/architecture/API_CONTRACTS.md`](../docs/architecture/API_CONTRACTS.md). The typed client in `src/lib/api.ts` unwraps `ApiResponse<T>`, throws `ApiError` with the server's code and correlation ID, sends `Authorization: Bearer …` and the selected `X-Organization-Id`, adds `Idempotency-Key` where requested, and performs one refresh-and-retry cycle on a 401. Switching organizations clears cached queries so results from the previous organization are not shown. `AnalyticsPage` additionally offers a platform-admin **Organization scope** select and passes a per-request `organizationId` override; analytics query keys include the scope. Generated idempotency keys are UUIDs (or short fallback strings), well under the server's 120-character limit, and the unread-notification response is read as `{count}`.

## Authentication and security limitations

- The access token is kept **in memory only**. A page reload requires the refresh token to obtain a new access token.
- The refresh token is stored in **`sessionStorage`**, so it survives reloads in the current browser tab but not a new tab or a browser restart. This intentionally reduces persistence at the cost of convenience.
- UI permission and role checks only hide navigation and controls. **The server is authoritative**: every protected endpoint enforces authorization and organization scoping regardless of what this SPA displays. Analytics uses the same validated scope; platform admins may omit the header for a global view or scope to one organization.
- Login restores only a previously valid explicit organization selection. The SPA never auto-selects the first membership; an unscoped request lets the backend apply its documented single-membership default.
- Server-side logout denies only the presented bearer `jti` in the process that handled it; that denylist and the auth rate limiter are in-memory, while password/status revocation uses a persistent token version. A multi-instance deployment needs shared stores.
- `Idempotency-Key` is generated with `crypto.randomUUID()` (or a short fallback when unavailable) for reservations, allocation confirmations, and dispatch creation.
- No tokens, passwords, or secrets are written to `localStorage`. The sidebar preference is the only value persisted outside the auth store, and it contains no sensitive data.
- For production deployments, pair this app with HTTPS, strict CSP, secure cookie/session configuration on the API, and a review of third-party scripts. None of that is installed in the local Compose stack.
- The standalone STOMP smoke verifies the server path; the SPA bridge is recorded in [`../docs/evidence/BROWSER_STOMP_RESULT.json`](../docs/evidence/BROWSER_STOMP_RESULT.json). REST inbox polling remains the authoritative fallback, STOMP only invalidates caches, and no client-to-server SEND workflow is supported.

## Accounts

**Demo accounts are seeded by the backend, not by this frontend.** The seeder runs under `dev`/`default`/`postgres` when `SEED_DEMO_DATA=true` (Compose sets it; standalone PostgreSQL defaults to no seed) and provides `admin@lifelink.local` / `Admin@123!`, `bank@lifelink.local` / `Bank@123!`, `inventory@lifelink.local` / `Inventory@123!`, `hospital@lifelink.local` / `Hospital@123!`, `medical@lifelink.local` / `Medical@123!`, and `donor@lifelink.local` / `Donor@123!` — never enable these outside a local/demo profile. See the [user guide](../docs/user-guide/USER_GUIDE.md). The registration form creates accounts through `POST /api/v1/auth/register`; approval, roles, and organization membership are controlled server-side.

## Design system

A deliberate light theme is defined in `src/styles/tokens.css`, extended by the Bloodstream identity (`BloodstreamVisual`, `JourneyVessel`, `bloodstream-flow`, SMIL cells) on the public landing page. It uses white and soft-neutral surfaces, crimson/burgundy accents, deep slate text, and green/amber/blue/red status colours. Components use semantic HTML, visible focus rings, labelled inputs, responsive breakpoints, and `prefers-reduced-motion` support. No Tailwind or component-framework CSS is used.

## Known constraints

- Analytics payloads are normalised defensively because grouped metric shapes can evolve; unrecognised shapes render an empty state instead of fabricated numbers. The three real endpoints are `/analytics/overview`, `/analytics/inventory`, and `/analytics/requests`; there is no donations/activities analytics endpoint.
- The landing page's product preview is an illustrative layout with dashes, not simulated live metrics, testimonials, counts, or certifications.
- Some workflows require records created by another role first (for example, a dispatch requires a confirmed reservation).
