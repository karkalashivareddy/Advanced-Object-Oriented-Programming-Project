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
   structurally; use `project/scripts/dev.ps1` on native PowerShell.
6. **TLS, reverse-proxy hardening, and secret management are not configured.**
   The JWT secret and database credentials use development defaults. See
   `docs/deployment/DEPLOYMENT_GUIDE.md` for the production checklist.

## Security and data

7. **Development seed accounts use well-known weak passwords.** They are
   enabled by default for local use and must be disabled or replaced outside a
   throwaway environment.
8. **No external email/SMS provider is configured.** `UnconfiguredProviderChannel`
   explicitly returns failure; the outbox records notification intents in the
   database and the in-app channel uses the local WebSocket broker. No delivery
   is fabricated.
9. **Frontend permission checks are UX-only.** Navigation and controls are
   hidden by role/permission, but the backend remains the authorization
   authority and enforces every endpoint and organization scope.
10. **Refresh tokens are stored in `sessionStorage`; access tokens are in memory
    only.** This limits persistence but means a new tab or browser restart
    requires a refresh/bootstrap cycle. No token is written to `localStorage`.
11. **Concurrency guarantees assume one relational database.** Pessimistic locks
    and persisted idempotency keys are correct for the current single-database
    design. A multi-primary or sharded deployment needs a fresh concurrency
    review.

## Test coverage

12. **No real-browser E2E suite.** Frontend tests use Vitest + jsdom; API flows
    are covered by backend HTTP integration tests instead.
13. **No load or soak testing.** The concurrency test verifies idempotency under
    two simultaneous requests, not throughput or long-running stability.
14. **No backup/restore drill.** PostgreSQL backups and retention are listed in
    the deployment checklist but were not implemented or tested.

## Tooling notes

15. **npm prints an `allow-scripts` warning for esbuild's postinstall hook.**
    The platform-specific esbuild binary is installed as an optional dependency;
    `npm ci`, `npm test`, and `npm run build` all succeed, and `npm audit`
    reports zero vulnerabilities.
16. **Redis is intentionally absent.** Earlier deployment documentation included
    it, but no application code used it. Inventory consistency is enforced with
    database locks and allocation idempotency is stored in PostgreSQL.
