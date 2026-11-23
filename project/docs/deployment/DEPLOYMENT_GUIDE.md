# LifeLink Deployment & Local Development Guide

> Status: **implementation present; no deployment performed**. The backend,
> frontend, database migrations and tests exist in `project/`. Backend build,
> Spring context startup and 17 automated tests were verified locally. Docker
> image builds and the full Compose stack were **not** executed in the authoring
> environment. All commands below are for local development unless explicitly
> described as a production checklist item.

## 1. Prerequisites

| Tool | Version used here | Notes |
| --- | --- | --- |
| Docker Engine + Compose plugin | Docker 29.x / Compose v2 | `docker compose version` |
| JDK (host) | any | Only needed for IDE work; containers pin **Java 21**. Host Java 25 is fine. |
| Node.js | 24 | Matches CI and the frontend Dockerfile builder. |
| Bash or PowerShell | any recent | For the helper scripts. |

Maven is **not** required globally: the backend engineer commits a Maven
wrapper (`project/backend/mvnw`), which is what the Dockerfile and CI use.

## 2. Local development with Compose

From the repository root:

```bash
# Bash / Git Bash
./project/scripts/dev.sh

# PowerShell
.\project\scripts\dev.ps1
```

Or manually:

```bash
cd project/docker
cp .env.example .env          # PowerShell: Copy-Item .env.example .env
docker compose up -d --build
docker compose ps
docker compose logs -f backend
```

The helper scripts start PostgreSQL 16, the Spring Boot backend and the
nginx-served SPA, then print the URLs and useful health commands. No Redis
service is required: inventory concurrency is enforced with pessimistic
database locks and allocation idempotency is persisted in PostgreSQL.

### Default local endpoints

| Service | URL | Notes |
| --- | --- | --- |
| Frontend SPA | <http://localhost:5173> | nginx on container port 8080 |
| Backend API | <http://localhost:8080> | Spring profile `postgres` |
| Backend health | <http://localhost:8080/actuator/health> | Only if Spring Boot Actuator is enabled |
| Frontend health | <http://localhost:5173/healthz> | Always available (nginx) |
| PostgreSQL | `127.0.0.1:5432` | Localhost-only publish; remove `ports` block to close |

Inside the Compose network the services address each other by name: `db:5432`
and `backend:8080`. The SPA calls same-origin `/api/...`, which nginx
proxies to `http://backend:8080/api/...`; this avoids CORS in local dev.

Useful commands:

```bash
cd project/docker
docker compose ps
docker compose logs -f backend frontend
docker compose exec db pg_isready -U lifelink -d lifelink
docker compose exec backend nc -z 127.0.0.1 8080 && echo backend-up
curl http://localhost:8080/actuator/health
docker compose down              # keep named volumes
docker compose down -v           # DESTROYS local database data
```

### Vite dev server (optional, no containers for frontend)

Run `npm run dev` in `project/frontend`; Vite serves on 5173 and proxies `/api`
to `http://localhost:8080`. You can still run only the backing services with
`docker compose up -d db backend` from `project/docker`.

## 3. Environment variable reference

Defaults shown are the **development-only** values from `docker/.env.example`.

| Variable | Default | Used by | Purpose |
| --- | --- | --- | --- |
| `POSTGRES_DB` | `lifelink` | db, backend | Database name |
| `POSTGRES_USER` | `lifelink` | db, backend | Database user |
| `POSTGRES_PASSWORD` | `lifelink_dev_only` | db, backend | Dev password — replace in any real environment |
| `POSTGRES_PORT` | `5432` | db | Host port, bound to `127.0.0.1` only |
| `BACKEND_PORT` | `8080` | backend | Host port for the API |
| `FRONTEND_PORT` | `5173` | frontend | Host port for the SPA |
| `JAVA_OPTS` | `-Xms128m -Xmx512m -XX:MaxRAMPercentage=65.0` | backend | JVM tuning; container has a 768 MB limit |
| `VITE_API_BASE_URL` | `/api` | frontend build arg | Base path baked into the SPA at build time |

The backend container always sets `SPRING_PROFILES_ACTIVE=postgres` and derives
`SPRING_DATASOURCE_*` from the variables above. Do not hard-code secrets in
`docker-compose.yml` or the Dockerfiles.

## 4. Production hardening checklist

The Compose stack is a **development** stack. Before any real deployment, all of
the following must be addressed:

- [ ] **TLS everywhere** — terminate TLS at a reverse proxy / load balancer
      (e.g. Caddy, nginx, cloud LB), redirect HTTP → HTTPS, use HSTS. Never
      expose plain HTTP to users.
- [ ] **Secrets management** — replace `.env` with injected secrets (Docker
      secrets, Kubernetes Secrets, or a vault). Rotate the dev password; use
      strong, unique credentials. Never commit `.env` (see `project/.gitignore`).
- [ ] **Network segmentation** — remove the localhost `ports` block for `db`;
      put it on an internal-only network. Only the reverse proxy and backend
      should be reachable.
- [ ] **Non-root enforcement** — both application images already drop to
      unprivileged users (`app` UID 10001 for backend, `nginx` for frontend).
      Verify the orchestrator does not override this and apply read-only root
      filesystems plus dropped Linux capabilities where possible.
- [ ] **Security headers** — add `Content-Security-Policy`, `X-Content-Type-Options:
      nosniff`, `X-Frame-Options`, `Referrer-Policy` at the proxy (the dev nginx
      config deliberately stays minimal).
- [ ] **Backups and restore drills** — scheduled PostgreSQL logical/physical
      backups with tested restores and a documented retention/HA policy.
- [ ] **Observability** — enable Spring Boot Actuator health/metrics, structured
      logs, centralized log shipping, metrics and alerting (e.g. Prometheus +
      Grafana). The current Docker `HEALTHCHECK` is only a liveness probe.
- [ ] **Image supply chain** — pin image digests, run Trivy in CI (see
      [CI.md](CI.md)), sign images, and rebuild on base-image patch releases.
- [ ] **Resource limits and scaling** — the `mem_limit`/`cpus` values are dev
      guards; set production requests/limits, replica counts and graceful
      shutdown timeouts.
- [ ] **Authentication / authorization** — enforce real auth on `/api/**` at
      the application layer; the nginx proxy does not authenticate.
- [ ] **Compliance / data protection** — review data retention, encryption at
      rest, and audit logging with the project's security owner.

## 5. Known limitations

1. **No deployment is configured or performed.** There is no Kubernetes,
   Terraform, or cloud provider configuration in this repository yet.
2. **CI workflow must be installed** into root `.github/workflows/` before GitHub
   will run it — see [CI.md](CI.md). The root directory is intentionally not
   created by the project subtree.
3. **Dev credentials are intentionally weak** and the database port is published
   on `127.0.0.1`. This is acceptable only on a trusted machine.
4. **Backend Compose healthcheck is a TCP liveness check**, not an application
   readiness check. Actuator is present and `/actuator/health` was verified by
   the backend integration suite, but the Compose check has not been switched
   to an HTTP probe because Docker was unavailable in the authoring environment.
5. **Docker image builds and Compose startup were not executed locally.** The
   Docker daemon was unavailable (`npipe:////./pipe/dockerDesktopLinuxEngine`),
   so container behavior is structurally documented but not runtime-verified.
6. **nginx config is embedded in the frontend Dockerfile** because the frontend
   source directory is owned by another workstream. If you need a custom
   `nginx.conf`, move it into `project/frontend/` and switch to `COPY`.
7. **No `.dockerignore` files** are provided in the frontend/backend directories.
   Build contexts may include local `node_modules`/`target`, so builds can be
   slower even though `npm ci` and the Maven build still produce correct images.
8. **Vite output path is assumed to be `dist`**, the default. If the frontend
   changes it, update the `COPY --from=build` line in `project/frontend/Dockerfile`.
9. **Windows Make** requires a POSIX make implementation (e.g. Git Bash or
   Chocolatey `make`); use `dev.ps1` on native PowerShell instead.
