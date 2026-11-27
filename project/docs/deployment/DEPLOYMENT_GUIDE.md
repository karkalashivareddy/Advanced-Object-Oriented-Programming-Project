# LifeLink Deployment & Local Development Guide

Date: 24 November 2026
Status: describes the implemented local/demo stack and current verification. Docker image builds for `lifelink/backend:dev` and `lifelink/frontend:dev` succeeded previously. The Compose stack was verified healthy on override ports `18080/15173/15432` (backend `/actuator/health` 200 with liveness/readiness, frontend `/healthz` 200 `ok`, SPA root 200, login through nginx proxy 200, Flyway V1–V5 success, seed organizations=2/users=6/blood_units=9). Both a standalone SockJS/STOMP smoke and an authenticated browser bridge are recorded. Current gates are 119 backend tests, 39 frontend tests, and 18 Playwright passes. No production deployment or CI run is claimed.

## 1. Prerequisites

| Tool | Version used here | Notes |
| --- | --- | --- |
| Docker Engine + Compose plugin | Docker 29.x / Compose v2 | `docker compose version` |
| JDK (host) | any | Only needed for IDE/host runs; containers pin **Java 21**. Host Java 25 works. |
| Node.js | 24 | Matches the frontend Dockerfile builder. |
| Bash or PowerShell | any recent | For the helper scripts and exact commands below. |

Maven is **not** required globally: `project/backend/mvnw` pins Maven `3.9.11` and is used by the Dockerfile and tests.

## 2. Local development with Compose

From the repository root, either use the helpers or run the exact commands below.

Helper scripts:

```bash
# Bash / Git Bash
./project/scripts/dev.sh

# PowerShell
.\project\scripts\dev.ps1
```

Exact manual startup (from `project/docker`). `JWT_SECRET` is required by Compose
for the `postgres` profile and must be supplied **externally in the shell**; there
is no committed fallback. Do not write it into `.env`, commit it, or print it.
`.env.example` now carries the verified dev ports (`15432/18080/15173`), derives
CORS from `FRONTEND_PORT`, and contains only a non-secret placeholder for
`JWT_SECRET`. `SEED_DEMO_DATA=true` creates the documented accounts in Compose;
standalone PostgreSQL defaults to no seed.

**Bash / Git Bash:**

```bash
cd project/docker
export JWT_SECRET="$(openssl rand -base64 48)"   # shell only; do not echo
export SEED_DEMO_DATA=true
docker compose up -d --build
docker compose ps
docker compose logs -f backend frontend
curl http://localhost:18080/actuator/health
curl http://localhost:15173/healthz
```

**PowerShell:**

```powershell
Set-Location project\docker
$env:JWT_SECRET = [Convert]::ToBase64String((1..48 | ForEach-Object { Get-Random -Max 256 }) -as [byte[]])
$env:SEED_DEMO_DATA = "true"
docker compose up -d --build
docker compose ps
docker compose logs -f backend frontend
curl.exe http://localhost:18080/actuator/health
curl.exe http://localhost:15173/healthz
```

A local `.env` copied from `.env.example` may override non-secret settings, but
shell environment values take precedence; keep the `JWT_SECRET` placeholder in
`.env` and set the real value only in the shell. The helper scripts create `.env`
from the example on first run, so export `JWT_SECRET` before invoking them.

The helper stack starts PostgreSQL 16, the Spring Boot backend (`SPRING_PROFILES_ACTIVE=postgres`), and the nginx-served SPA. No Redis is required: inventory concurrency uses pessimistic database locks, allocation idempotency is persisted in PostgreSQL, rate limiting is in-memory, and `outbox_events` stores notification intents.

### Default local endpoints and loopback binding

| Service | URL (verified defaults) | Notes |
| --- | --- | --- |
| Frontend SPA | <http://localhost:15173> | nginx container port 8080 → host `FRONTEND_PORT` |
| Backend API | <http://localhost:18080> | Spring profile `postgres` |
| Backend health | <http://localhost:18080/actuator/health> | Actuator endpoint is enabled |
| Frontend health | <http://localhost:15173/healthz> | nginx static health file |
| PostgreSQL | `127.0.0.1:15432` | Published on loopback only |

All three ports are bound to `127.0.0.1` and are overridable with `POSTGRES_PORT`, `BACKEND_PORT`, and `FRONTEND_PORT`. The Compose file and `.env.example` now default to `15432`, `18080`, and `15173` because port `8080` is occupied on the verification host; the older `5432`/`8080`/`5173` values are only generic development defaults echoed by the helper scripts. Inside the Compose network services use `db:5432` and `backend:8080`. The SPA uses same-origin `/api/*` and `/ws/*`, proxied by nginx to the backend. Compose derives `CORS_ALLOWED_ORIGINS` for both `localhost` and `127.0.0.1` on `FRONTEND_PORT` so direct Vite access and the SockJS origin check work without extra setup.

Useful commands:

```bash
cd project/docker
docker compose ps
docker compose logs -f backend frontend
docker compose exec db pg_isready -U lifelink -d lifelink
docker compose down              # keep named volumes
docker compose down -v           # DESTROYS local database data
```

### Vite dev server (optional)

Run `npm run dev` in `project/frontend`. Vite serves on `http://localhost:5173` and proxies `/api` to `http://localhost:8080` by default; for the verified Compose stack set `VITE_API_PROXY_TARGET=http://127.0.0.1:18080`. Vite proxies both `/api` and `/ws` (SockJS HTTP + WebSocket upgrade, with `Origin` stripped), and the SPA mounts an authenticated STOMP bridge. The client sends `X-Organization-Id` on every request when an organization is selected and clears React Query caches on switch; `AnalyticsPage` also has a platform-admin scope override that omits the header for all organizations. You can run only backing services with `docker compose up -d db backend` from `project/docker`. For host-run backend with the `postgres` profile, supply the same datasource variables and `JWT_SECRET`; the `dev`/`default` profiles use H2 by default and the seeder is enabled through `SEED_DEMO_DATA=true`.

## 3. Environment variable reference

Defaults shown are the **development-only, verified** values from `docker/.env.example`; `JWT_SECRET` has no real committed value (the example holds only a placeholder) and is supplied in the shell.

| Variable | Default | Used by | Purpose |
| --- | --- | --- | --- |
| `POSTGRES_DB` | `lifelink` | db, backend | Database name |
| `POSTGRES_USER` | `lifelink` | db, backend | Database user |
| `POSTGRES_PASSWORD` | `lifelink_dev_only` | db, backend | Dev password — replace in any real environment |
| `POSTGRES_PORT` | `15432` | db | Host port, bound to `127.0.0.1` only |
| `BACKEND_PORT` | `18080` | backend | Host port for the API |
| `FRONTEND_PORT` | `15173` | frontend | Host port for the SPA |
| `JWT_SECRET` | **required, shell-supplied, no default** | backend | HS256 signing key; Compose refuses to start without it. Generate in memory with `openssl rand -base64 48`; never persist or print it. |
| `SEED_DEMO_DATA` | `true` in Compose / `application.yml`; `false` in `application-postgres.yml` when unset | backend seeder | Enables the six demo accounts/organizations in Compose; standalone PostgreSQL defaults to no seed |
| `AUTH_RATE_LIMIT_MAX_ATTEMPTS` | `10` | backend | Per IP+account+path auth attempts |
| `AUTH_RATE_LIMIT_WINDOW_SECONDS` | `60` | backend | Rate-limit window |
| `JAVA_OPTS` | `-Xms128m -Xmx512m -XX:MaxRAMPercentage=65.0` | backend | JVM tuning; container has a 768 MB limit |
| `VITE_API_BASE_URL` | `/api` | frontend build arg | Base path baked into the SPA |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:${FRONTEND_PORT:-15173},http://127.0.0.1:${FRONTEND_PORT:-15173}` | backend | Browser origins accepted by CORS and the SockJS handshake; derived from `FRONTEND_PORT` |

Backend configuration notes:

- `JWT_SECRET` is required in **every non-test profile**; no fallback is committed. Missing, short (<32 byte), or test-only keys fail fast.
- `lifelink.seed.enabled` / `SEED_DEMO_DATA` activates `DevelopmentDataSeeder` under `@Profile({"dev", "default", "postgres"})`. Compose sets `SEED_DEMO_DATA=true`; standalone PostgreSQL defaults to `false`. Set it explicitly to `false` when importing your own data.
- Seeded accounts (dev/demo only): `admin@lifelink.local`/`Admin@123!`, `bank@lifelink.local`/`Bank@123!`, `inventory@lifelink.local`/`Inventory@123!`, `hospital@lifelink.local`/`Hospital@123!`, `medical@lifelink.local`/`Medical@123!`, `donor@lifelink.local`/`Donor@123!`. Organizations: Central Blood Bank and LifeCare General Hospital.
- CORS origins default to the backend application's `http://localhost:5173`, and Compose derives both loopback spellings from `FRONTEND_PORT` (verified default `http://localhost:15173,http://127.0.0.1:15173`). Override `CORS_ALLOWED_ORIGINS` explicitly for any other serving origin. Allowed methods: `GET, POST, PATCH, PUT, DELETE, OPTIONS`; allowed headers: `Authorization, Content-Type, X-Correlation-Id, Idempotency-Key, X-Organization-Id`; exposed header: `X-Correlation-Id`; `allowCredentials=false`.
- Flyway migrations `V1`–`V5` define the schema in every profile: V1 core, V2 operational, V3 dispatch idempotency, V4 integrity/idempotency (`idempotency_records`, sparse one-active-reservation slot, status CHECK constraints), and V5 `users.token_version` for persistent monotonic access-token revocation. All five succeeded in the final Compose run.
- Version stack: Spring Boot `3.5.16`, Java `21` target, Maven Wrapper `3.9.11`, PostgreSQL 16.

## 4. Recorded runtime evidence

| Area | Result | Evidence |
| --- | --- | --- |
| Compose stack | Services healthy; backend `/actuator/health` 200 (`liveness`,`readiness`), frontend `/healthz` 200 `ok`, SPA root 200, login through nginx proxy 200; Flyway V1–V5 success; seed organizations=2 users=6 blood_units=9 | [`../evidence/COMPOSE_VERIFICATION.json`](../evidence/COMPOSE_VERIFICATION.json) |
| STOMP (standalone) | Authenticated CONNECT, personal-queue subscribe, notification delivered; frame sequence `CONNECTED`, `MESSAGE` through nginx proxy | [`../evidence/STOMP_SMOKE_RESULT.json`](../evidence/STOMP_SMOKE_RESULT.json) |
| STOMP (browser) | Bearer CONNECT, `/user/queue/notifications` SUBSCRIBE, CONNECTED frame captured from the SPA bridge | [`../evidence/BROWSER_STOMP_RESULT.json`](../evidence/BROWSER_STOMP_RESULT.json) |
| Browser E2E | Playwright 18 passed on Chrome and Edge, retries 0, flaky 0 | [`../evidence/PLAYWRIGHT_RESULTS.json`](../evidence/PLAYWRIGHT_RESULTS.json) |
| Unit/integration | Backend 119 tests, 0 failures/errors/skips; frontend 39 unit tests | [`../quality/TEST_RESULTS.md`](../quality/TEST_RESULTS.md) |

The 18 E2E and 119/39 test figures in this table are historical results from the
recorded Compose verification run. The current 27 November gates are backend
**135 tests run, 0 failures, 0 errors, 8 skipped** (Docker-dependent PostgreSQL
Testcontainers), frontend **54 tests in 11 files**, and **46 Playwright
executions** against a seeded H2 dev backend; see
[`../quality/TEST_RESULTS.md`](../quality/TEST_RESULTS.md). These are
local-development / supervised-demo results. They do not imply a production
deployment, a CI run, or a shared-store multi-instance deployment.

## 5. Production hardening checklist

The Compose stack is a **development/demo** stack. Before any real deployment, all of the following must be addressed:

- [ ] **TLS everywhere** — terminate TLS at a reverse proxy / load balancer, redirect HTTP → HTTPS, use HSTS. Never expose plain HTTP to users.
- [ ] **Secrets management** — replace `.env` with injected secrets (Docker/Kubernetes secrets or a vault). Rotate the dev password and JWT key; never commit `.env`.
- [ ] **Network segmentation** — remove the localhost `ports` block for `db`; put it on an internal network. Only the reverse proxy and backend should be reachable.
- [ ] **Non-root enforcement** — both application images drop to unprivileged users (`app` UID 10001 for backend, `nginx` for frontend). Verify the orchestrator does not override this; add read-only root filesystems and dropped capabilities.
- [ ] **Security headers** — add CSP, `X-Content-Type-Options: nosniff`, `X-Frame-Options`, and `Referrer-Policy` at the proxy; the dev nginx config is deliberately minimal.
- [ ] **Backups and restore drills** — scheduled PostgreSQL backups with tested restores and a documented retention/HA policy.
- [ ] **Observability** — structured logs, centralized shipping, metrics and alerting. The Compose healthcheck is only a liveness probe.
- [ ] **Image supply chain** — pin image digests, scan images, sign them, and rebuild on base-image patches.
- [ ] **Resource limits and scaling** — the `mem_limit`/`cpus` values are dev guards; set production requests/limits and graceful shutdown timeouts. The rate limiter and logout `jti` denylist are single-node only.
- [ ] **Authentication / authorization** — the application enforces `/api/**`; nginx does not. Keep server-side method security and org scoping authoritative.
- [ ] **Compliance / data protection** — review retention, encryption at rest, and audit logging with the security owner. Audit has no retention/tamper-evidence today.

## 6. Known limitations

1. **No deployment configuration is installed.** There is no Kubernetes, Terraform, or cloud provider configuration in this repository.
2. **CI is not installed.** Root `.github/workflows` is intentionally absent; `project/deployment/github-actions.yml` is a template and has **not** run. See [CI.md](CI.md). Do not claim a GitHub Actions result.
3. **Dev credentials are intentionally weak** and all ports are published on `127.0.0.1`. This is acceptable only on a trusted machine.
4. **Backend Compose healthcheck is a TCP liveness check**, not an HTTP readiness check. `/actuator/health` is implemented and returned HTTP 200 with liveness/readiness groups in the final Compose run, but the container check itself remains TCP-based.
5. **Logout revocation is process-local (`F-04`).** The bearer `jti` denylist and the auth rate limiter are in-memory; a multi-instance deployment needs shared stores. Persistent `token_version` revocation of password/status changes is database-backed.
6. **Standalone STOMP smoke is retained as server-path evidence.** A SockJS/STOMP script passed through nginx with `CONNECTED`/`MESSAGE`; the SPA also has an authenticated browser bridge, while the REST inbox remains authoritative and polling is the fallback. See [`../evidence/BROWSER_STOMP_RESULT.json`](../evidence/BROWSER_STOMP_RESULT.json).
7. **nginx config is embedded in the frontend Dockerfile** because `project/frontend/` is owned by another workstream. Custom config would need a Dockerfile change.
8. **`.dockerignore` files are provided** in `project/backend/` and `project/frontend/` (both tracked) to keep `target/` and `node_modules/` out of build contexts.
9. **Vite output path is assumed to be `dist`**, the default.
10. **Windows Make** requires a POSIX implementation (Git Bash or Chocolatey `make`); use `dev.ps1` on native PowerShell.
