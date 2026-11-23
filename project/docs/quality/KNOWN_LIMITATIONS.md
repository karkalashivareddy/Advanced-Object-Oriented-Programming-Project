# LifeLink Known Limitations

This document records constraints that are true at the time of verification. It
intentionally avoids claiming behavior that was not exercised.

## Runtime and deployment

1. **No deployment was performed.** There is no Kubernetes, Terraform, or cloud
   provider configuration in `project/`.
2. **Docker was not runtime-verified.** The authoring environment could not reach
   the Docker daemon (`npipe:////./pipe/dockerDesktopLinuxEngine`), so image
   builds and the Compose stack were not executed. Compose files, Dockerfiles,
   and scripts were reviewed structurally only.
3. **PostgreSQL was not executed locally.** Backend tests and local startup use
   H2 2.3 in PostgreSQL compatibility mode. The `postgres` profile and Flyway
   PostgreSQL DDL are present but not runtime-verified here.
4. **The CI workflow is not active.** `project/deployment/github-actions.yml`
   must be copied to the repository-root `.github/workflows/` directory before
   GitHub will run it. The workflow itself was not executed.
5. **Windows Make is unavailable** in this environment. The Makefile was checked
   structurally: `dev` starts the Vite frontend (the backend must be started
   separately), `typecheck` runs TypeScript, and `build`/`test` require POSIX
   shells. `scripts/dev.sh` additionally requires Docker and bash.
6. **TLS, reverse-proxy hardening, and secret management are not configured.**
   The JWT secret and database credentials use development defaults. Outside
   `dev`/`test` profiles the JWT service fails fast unless `JWT_SECRET` is set,
   but no production secret store is included.
7. **No independent re-review after the final fix batch.** Two independent
   reviews marked the earlier state `NOT_READY`. Their findings were fixed and
   verified by automated tests, but no third reviewer re-audited the final
   tree; see `docs/reviews/FINAL_INDEPENDENT_REVIEW.md`.

## Security and data

8. **Development seed accounts use well-known weak passwords.** They are
   enabled by default for local use and must be disabled or replaced outside a
   throwaway environment.
9. **No external email/SMS provider is configured.** `UnconfiguredProviderChannel`
   returns failure; the outbox records notification intents in the database and
   the in-app channel uses the local WebSocket broker. No delivery is
   fabricated.
10. **Frontend permission checks are UX-only.** Navigation and controls are
    hidden by role/permission, but the backend remains the authorization
    authority and enforces every endpoint and organization scope.
11. **Refresh tokens are stored in `sessionStorage`; access tokens are in memory
    only.** Concurrent 401s within one tab share a single rotation, but the
    single-flight promise is tab-local: separate tabs can still rotate the same
    refresh token independently. No token is written to `localStorage`.
12. **Concurrency guarantees assume one relational database.** Pessimistic
    locks and persisted idempotency keys are correct for the current
    single-database design. A multi-primary or sharded deployment needs a fresh
    concurrency review.
13. **Outbox recovery is single-node.** `PROCESSING` events whose next attempt
    is due are reclaimed by retries, but there is no distributed lease or leader
    election; multiple application instances need a coordinated dispatcher or a
    fresh design review.
14. **WebSocket coverage is interceptor-level.** STOMP CONNECT authentication
    and subscription restrictions are unit-tested; a live browser/SockJS
    handshake against a deployed broker was not exercised.

## Test coverage

15. **No real-browser E2E suite.** Frontend tests use Vitest + jsdom; API flows
    are covered by backend HTTP integration tests instead.
16. **No load or soak testing.** The concurrency test verifies idempotency under
    two simultaneous requests, not throughput or long-running stability.
17. **No backup/restore drill.** PostgreSQL backups and retention are listed in
    the deployment checklist but were not implemented or tested.
18. **No external security audit or penetration test** was performed. The
    negative integration tests cover the review findings, not the full attack
    surface.

## Tooling notes

19. **npm prints an `allow-scripts` warning for esbuild's postinstall hook.**
    The platform-specific esbuild binary is installed as an optional dependency;
    `npm ci`, `npm test`, `npm run typecheck`, and `npm run build` all succeed,
    and `npm audit` reports zero vulnerabilities.
20. **Redis is intentionally absent.** Earlier deployment documentation included
    it, but no application code used it. Inventory consistency is enforced with
    database locks, allocation idempotency is persisted, and dispatch
    idempotency is persisted via `V3__dispatch_idempotency.sql`.
