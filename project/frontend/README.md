# LifeLink Frontend

React 19 + TypeScript + Vite single-page application for the LifeLink blood supply platform. It talks only to the documented `/api/v1` REST API; the UI contains no production mock data.

## Requirements

- Node.js 24+
- npm 11+
- The LifeLink backend on `http://localhost:8080` for live data

## Setup

```bash
cd project/frontend
npm install
cp .env.example .env   # optional; defaults are correct for local development
npm run dev
```

The dev server listens on `http://localhost:5173` and proxies `/api` to `http://localhost:8080`.

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
| `npm test` | Run the Vitest suite once. |
| `npm run test:watch` | Run Vitest in watch mode. |
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

API contracts are mirrored from `project/docs/architecture/API_CONTRACTS.md`. The typed client in `src/lib/api.ts` unwraps `ApiResponse<T>`, throws `ApiError` with the server's code and correlation ID, sends `Authorization: Bearer …`, adds `Idempotency-Key` where requested, and performs one refresh-and-retry cycle on a 401.

## Authentication and security limitations

- The access token is kept **in memory only**. A page reload requires the refresh token to obtain a new access token.
- The refresh token is stored in **`sessionStorage`**, so it survives reloads in the current browser tab but not a new tab or a browser restart. This intentionally reduces persistence at the cost of convenience.
- UI permission and role checks only hide navigation and controls. **The server is authoritative**: every protected endpoint enforces authorization and organization scoping regardless of what this SPA displays.
- `Idempotency-Key` is generated with `crypto.randomUUID()` for reservations, allocation confirmations, and dispatch creation.
- No tokens, passwords, or secrets are written to `localStorage`. The sidebar preference is the only value persisted outside the auth store, and it contains no sensitive data.
- For production deployments, pair this app with HTTPS, strict CSP, secure cookie/session configuration on the API, and a review of third-party scripts.

## Accounts

**Demo accounts are seeded by the backend, not by this frontend.** Use the credentials provisioned by your administrator or the backend seed. The registration form creates accounts through `POST /api/v1/auth/register`; approval, roles, and organization membership are controlled server-side.

## Design system

A deliberate light theme is defined in `src/styles/tokens.css`: white and soft-neutral surfaces, a healthcare red accent (`#b42332`), deep slate text, and green/amber/blue/red status colours. Components use semantic HTML, visible focus rings, labelled inputs, responsive breakpoints, and `prefers-reduced-motion` support. No Tailwind or component-framework CSS is used.

## Known constraints

- Analytics payloads are normalised defensively because grouped metric shapes can evolve; unrecognised shapes render an empty state instead of fabricated numbers.
- The landing page's product preview is an illustrative layout with dashes, not simulated live metrics, testimonials, counts, or certifications.
- Some workflows require records created by another role first (for example, a dispatch requires a confirmed reservation).
