# LifeLink Test Strategy

## Scope

This strategy covers both deliverables under `project/`: the Spring Boot backend
and the React/TypeScript frontend. Results are recorded in
[`TEST_RESULTS.md`](TEST_RESULTS.md).

The backend test pyramid has four levels:

1. **Domain unit tests** — pure Java tests for entity invariants and state
   transitions. No Spring context, no database, no network.
2. **Messaging interceptor unit tests** — STOMP CONNECT authentication and
   SUBSCRIBE destination authorization are tested in isolation with mocked JWT
   and principal services.
3. **Spring context / Flyway validation** — the full application context is
   started against H2 in PostgreSQL compatibility mode. Flyway migrations and
   Hibernate `ddl-auto=validate` must agree with every JPA mapping.
4. **HTTP integration tests** — `TestRestTemplate` exercises the real embedded
   Tomcat, Spring Security filter chain, JWT authentication, method permissions,
   organization-scoped authorization, transactional workflows, dispatch
   idempotency, and the transactional outbox. The development seed data is
   enabled explicitly for the integration class.

## Concurrency strategy

Inventory mutations use pessimistic database locks. The integration suite
submits two simultaneous allocation-confirmation requests with the same
idempotency key and asserts that both return the same persisted reservation.
The emergency-request row is locked before idempotency is evaluated, the
blood-unit row is locked again inside reservation creation, and the idempotency
key is re-checked after acquiring the lock. Refresh-token rotation uses a
pessimistic row lock; the frontend uses a single-flight refresh promise so
concurrent 401s cannot replay one refresh token.

## Negative and tenant-isolation tests

The integration suite explicitly checks that:

- cross-tenant allocation confirmation is denied even with the right permission
  in the caller's own organization;
- donor profiles, consents, appointments, and donation lists are not exposed to
  an unrelated organization;
- disabled users cannot use an existing access token or refresh token;
- malformed JWTs return `TOKEN_INVALID`;
- organization membership grants scoped permissions without changing global
  roles;
- allocation rejects incompatible components and the wrong number of units;
- dispatch creation requires an `Idempotency-Key` and replays return the
  original dispatch.

## Test data and isolation

- Unit tests build their own entity graphs or mocks.
- Integration tests run with `@ActiveProfiles({"test", "dev"})` and an in-memory
  H2 database (`jdbc:h2:mem:lifelink-test`).
- Flyway runs from an empty schema on every JVM start; migrations are validated
  before Hibernate builds the `EntityManagerFactory`.
- Tests are ordered so workflow mutations do not invalidate later setup. Tests
  that need fresh inventory create their own blood units.
- Redis is intentionally absent. In-app notifications use the local WebSocket
  broker; the outbox stores durable notification intents in the database.

## Backend commands

From `project/backend`:

```bash
.\mvnw.cmd test   # Windows
./mvnw test       # POSIX
```

The Maven wrapper is pinned in `.mvn/wrapper/maven-wrapper.properties`. No
global Maven installation is required.

## Frontend strategy

The frontend is verified with Vitest + Testing Library and TypeScript project
references:

- **API client tests** — envelope unwrapping, `ApiError` mapping from the
  server's nested `error` object, `Idempotency-Key` generation, one-shot 401
  refresh-and-retry, and one refresh shared across concurrent 401s.
- **Route guard tests** — unauthenticated redirects and permission-based route
  access.
- **Component tests** — shared UI states such as loading, empty, and error.
- **Build check** — `npm run build` runs `tsc -b` before Vite, so type errors in
  any page or shared module fail the build. `npm run typecheck` is available for
  a fast check without bundling.
- **Dependency audit** — `npm audit` is run after a clean `npm ci`.

The client uses the real `/api/v1` endpoints only. No fixture data or mocked
backend is present in production source; mocks exist solely inside `*.test.*`
files.

## What is deliberately not covered

- A live STOMP client handshake against the running broker. Interceptor behavior
  is unit-tested, and the HTTP integration suite verifies the app context.
- PostgreSQL-specific DDL execution: local tests use H2 in PostgreSQL mode. The
  `postgres` profile exists for Compose but was not executed here.
- Docker image builds and Compose orchestration: the Docker daemon was
  unavailable.
- External email/SMS delivery: no provider is configured. The
  `UnconfiguredProviderChannel` explicitly reports failure rather than faking
  delivery.
- Browser-level/E2E frontend behavior: Vitest uses jsdom, and no Playwright or
  Cypress suite was added.
- Load/soak testing and multi-database concurrency beyond the single relational
  database design.
