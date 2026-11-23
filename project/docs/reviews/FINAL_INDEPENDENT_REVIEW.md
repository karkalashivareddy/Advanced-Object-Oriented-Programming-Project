# Final Independent Review Record

Date: 2026-11-23

## Review protocol and provenance

Two independent reviewers were launched only after the original backend and
frontend implementations built and their first test suites passed. Both were
instructed to inspect code and report findings without modifying files or Git
state; neither changed the working tree.

- **Backend review verdict:** `NOT_READY`
- **Frontend/docs review verdict:** `NOT_READY`

Their detailed outputs were consumed directly during the fix batch; they were
not saved as separate files before this consolidated record was written. The
tables below preserve the findings, severity, resolutions, and the automated
evidence available in the final tree. **No third reviewer re-audited the final
tree after these fixes**, so this document does not claim a new independent
`READY` verdict.

## Backend findings

| Severity | Finding | Resolution | Evidence in final tree |
| --- | --- | --- | --- |
| High | Allocation confirmation could select units outside the caller's authorized organizations and did not verify exact quantity or compatibility. | `AllocationService` now derives supplier organizations from membership, locks request and units, requires exactly `quantity` distinct units, and checks component type plus blood-group specification. | `hospitalStaffCannotAllocateUnitsFromAnotherOrganization`; `allocationRejectsIncompatibleUnitsAndWrongUnitCounts`; 2-unit happy path in `allocationReservationAndDeliveryWorkflowIsIdempotent`. |
| High | STOMP `CONNECT`/`SUBSCRIBE` frames were unauthenticated and could target another user's queue. | New `StompAuthenticationInterceptor` parses the bearer JWT, loads the principal, rejects unauthenticated frames, and restricts subscriptions to the caller's own `/user/...` destination. | `StompAuthenticationInterceptorTest` (4 tests). Live SockJS handshake is not verified. |
| High | Donor profile, consent, appointment, and donation data were exposed to unrelated organizations (IDOR), and donation lists used only a global permission. | `DonorService` and `DonationService` now enforce ownership or organization membership and scoped permissions; appointment/screening queries are ordered deterministically. | `donorProfileIsNotExposedToAnUnrelatedOrganization`, including empty donation list and own-profile access. |
| High | Adding an organization membership mutated a user's global roles, and disabled users could still use previously issued tokens. | Membership roles are now kept in `AuthenticatedUser.organizationRoles()` only; `AuthService.principal()` and refresh reject disabled accounts; access-token filter maps that rejection to `TOKEN_INVALID`. | `organizationMembershipDoesNotMutateGlobalRoles`; `disabledUserCannotUseAnExistingAccessTokenOrRefreshToken`. |
| High | Concurrent refresh-token rotation could replay one token. | `RefreshTokenRepository.findByTokenHashForUpdate()` locks the token row; reuse revokes the family in a committed transaction. Frontend added a tab-local single-flight promise. | Existing reuse test logs `REFRESH_REUSE`; frontend `shares one refresh across concurrent 401s`. |
| Medium | Dispatch creation had no server-side idempotency, although UI/docs implied it. | Added persisted `idempotencyKey`, repository lookup, `V3__dispatch_idempotency.sql`, and required `Idempotency-Key` header. | Missing-key returns `409`; replay returns the same dispatch ID in the workflow test. |
| Medium | Reservation creation did not verify that the unit and request belonged to compatible organizations. | `ReservationService` now checks unit/request organization and compatibility before reserving. | Exercised through allocation happy path and negative allocation tests. |
| Medium | JWT validation did not require issuer/audience, and the development secret could be used outside development. | `JwtService` sets/validates `iss=lifelink`, `aud=lifelink-api`, and fails fast when the default secret is used with non-dev/test profiles. | Full context starts under `test`/`dev`; malformed-token test expects `TOKEN_INVALID`. |
| Medium | `PROCESSING` outbox events stranded after a crash were never retried. | Due `PROCESSING`, `PENDING`, and `FAILED` rows are all reclaimed by the retry query. | Context startup and outbox-backed workflow pass; no distributed lease (documented limitation). |
| Medium | Some inventory, dispatch, emergency-request, and audit reads lacked organization-scoped permission checks. | Reads now filter or assert `belongsTo(...)` and `hasPermissionForOrganization(...)`; non-admin paths cannot enumerate another tenant's data. | Tenant regression tests and scoped workflow assertions. |
| Low | Tests used weak assertions (for example, only checking response presence). | Added exact status codes, error codes, IDs, counts, and state transitions across the integration suite. | 13 integration tests, 0 failures. |

## Frontend and documentation findings

| Severity | Finding | Resolution | Evidence in final tree |
| --- | --- | --- | --- |
| High | Concurrent 401 responses could each invoke `tokenStore.refresh()`, replaying the same refresh token and revoking the session. | `refresh()` now returns one in-flight promise shared by all callers until the rotation settles. | New Vitest regression with two overlapping 401s, one refresh call, and two retried requests. 18 frontend tests pass. |
| High | The UI and docs described dispatch idempotency that did not exist on the server. | Server-side dispatch idempotency was implemented and the API contract updated; the UI keeps sending generated `Idempotency-Key` headers. | `V3` migration, dispatch replay test, `API_CONTRACTS.md`. |
| Medium | `API_CONTRACTS.md` drifted from actual list shapes, register/approval bodies, verify/priority endpoints, bearer format, and dispatch behavior. | Contract rewritten from controllers and DTOs, including plain-array vs `PageResponse` endpoints and WebSocket auth. | `docs/architecture/API_CONTRACTS.md`. |
| Medium | Frontend role-permission fallback diverged from backend `Role.java`. | `permissions.ts` fallback now mirrors the backend role enum exactly. | `npm run build` / `npm run typecheck` pass. |
| Medium | Documentation referenced broken Makefile targets and CI as if active. | `make dev` now starts Vite, `make lint` was replaced by `make typecheck`; CI remains explicitly documented as an installation step, not an executed check. | `project/Makefile`, `KNOWN_LIMITATIONS.md`. |
| Medium | Frontend tests were shallow around auth refresh behavior. | Added concurrent-refresh single-flight coverage; existing tests cover typed errors, idempotency headers, route guards, and UI states. | 3 test files, 18 tests. |
| Low | Quality docs overstated security and verification. | `TEST_STRATEGY.md`, `TEST_RESULTS.md`, and `KNOWN_LIMITATIONS.md` were rewritten with exact results and explicit unverified areas. | See `docs/quality/`. |

## Final status

All findings from both independent reviews have a code, test, or documentation
resolution in the final tree, and the final automated suites pass:

- Backend: **26 tests, 0 failures, 0 errors** (`.\mvnw.cmd test -q`).
- Frontend: **18 tests, 0 failures**; production build and `npm audit` pass.

**Honest verdict:** the project is ready for local development and supervised
demo use. It is **not certified production-ready** because Docker/Compose, the
PostgreSQL runtime profile, GitHub Actions execution, a live STOMP handshake,
real-browser E2E, external integrations, load testing, and a post-fix
independent audit remain unverified. Those constraints are not hidden: they are
listed in `docs/quality/KNOWN_LIMITATIONS.md` and `docs/quality/TEST_RESULTS.md`.

No commit was pushed, no history was rewritten, and changes were confined to
`project/`.
