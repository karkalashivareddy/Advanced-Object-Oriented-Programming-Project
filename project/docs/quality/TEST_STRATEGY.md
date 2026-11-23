# LifeLink Test Strategy

## Scope

This strategy covers both deliverables under `project/`: the Spring Boot backend
and the React/TypeScript frontend. Results are recorded in
[`TEST_RESULTS.md`](TEST_RESULTS.md).

The backend test pyramid has three levels:

1. **Domain unit tests** — pure Java tests for entity invariants and state
   transitions. No Spring context, no database, no network. These execute in
   milliseconds and are the first feedback loop.
2. **Spring context / Flyway validation** — the full application context is
   started against H2 in PostgreSQL compatibility mode. Flyway migrations and
   Hibernate `ddl-auto=validate` must agree with every JPA mapping. This layer
   catches schema drift that unit tests cannot see.
3. **HTTP integration tests** — `TestRestTemplate` exercises the real embedded
   Tomcat, Spring Security filter chain, JWT authentication, method permissions,
   organization-scoped authorization, transactional workflows, and the
   transactional outbox. Tests use the development seed data enabled explicitly
   through test properties.

## Concurrency strategy

Inventory mutations use pessimistic database locks. The integration suite
submits two simultaneous allocation-confirmation requests with the same
idempotency key and asserts that both return the same persisted reservation.
The emergency-request row is locked before idempotency is evaluated, and the
blood-unit row is locked again inside reservation creation, with an idempotency
re-check after the lock is acquired. This prevents both duplicate reservations
and duplicate-key failures under a concurrent retry.

## Test data and isolation

- Unit tests build their own entity graphs.
- Integration tests run with `@ActiveProfiles({"test", "dev"})` and an in-memory
  H2 database (`jdbc:h2:mem:lifelink-test`).
- Flyway runs from an empty schema on every JVM start; migrations are validated
  before Hibernate builds the `EntityManagerFactory`.
- Seed data is enabled only for the integration class. Tests are ordered so
  workflow mutations do not invalidate later setup, and the concurrency test
  creates its own emergency request.
- No external network services are required. Redis is not used by the
  application; in-app notifications use the local WebSocket broker and the
  outbox stores durable notification intents in the database.

## Commands

From `project/backend`:

```bash
./mvnw.cmd test          # Windows
./mvnw test              # POSIX
```

The Maven wrapper is pinned in `.mvn/wrapper/maven-wrapper.properties`. No
global Maven installation is required.

## Frontend strategy

The frontend is verified with Vitest + Testing Library and TypeScript project
references:

- **API client tests** — envelope unwrapping, `ApiError` mapping from the
  server's nested `error` object, `Idempotency-Key` generation, and one-shot
  401 refresh-and-retry behavior.
- **Route guard tests** — unauthenticated redirects and permission-based route
  access.
- **Component tests** — shared UI states such as loading, empty, and error.
- **Build check** — `npm run build` runs `tsc -b` before Vite, so type errors in
  any page or shared module fail the build.
- **Dependency audit** — `npm audit` is run after a clean `npm ci`.

The client uses the real `/api/v1` endpoints only. No fixture data or mocked
backend is present in the production source; mocks exist solely inside `*.test.*`
files.

## What is deliberately not covered

- PostgreSQL-specific DDL execution: local tests use H2 in PostgreSQL mode. The
  `postgres` profile exists for Compose but was not executed in the authoring
  environment.
- Docker image builds and Compose orchestration: the Docker daemon was
  unavailable.
- External email/SMS delivery: no provider is configured. The
  `UnconfiguredProviderChannel` explicitly reports failure rather than faking
  delivery.
- Browser-level/E2E frontend behavior: Vitest uses jsdom, and no Playwright or
  Cypress suite was added. End-to-end API flows are covered by the backend HTTP
  integration tests instead.
