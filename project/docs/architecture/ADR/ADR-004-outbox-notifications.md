# ADR-004: Transactional Outbox for Notifications

**Status:** Accepted; implemented in Phase 2 (2026-11-23) in narrowed form, as recorded below.
**Date:** 2026-11-23
**Related:** [`../SYSTEM_ARCHITECTURE.md`](../SYSTEM_ARCHITECTURE.md), [`../DOMAIN_MODEL.md`](../DOMAIN_MODEL.md)

## Context

State changes such as `DonationApproved`, `BloodUnitReleased`, `ReservationConfirmed`, `DispatchDeparted`, and `DispatchDelivered` should produce notifications and audit entries. Sending a notification directly inside a request would create two failure modes: a commit that succeeds after a failed send, or a send that succeeds after a rollback. The contract exposes a per-user notification inbox but no external delivery endpoint.

## Decision

Implement a **transactional outbox** inside the same PostgreSQL database:

- `NotificationService.notifyUser` writes a `Notification` row and an `outbox_events` row (`eventId`, `topic`, `payload`, `status`, `attempts`, `nextAttemptAt`, `lastError`) in the same transaction as the triggering state change and audit row.
- `LifecycleScheduler` calls `NotificationService.processOutbox()` every five minutes; due events are dispatched to a `NotificationChannel` and marked `PROCESSED`, or retried with backoff and `FAILED` after five attempts.
- `InAppNotificationChannel` is the configured channel; `UnconfiguredProviderChannel` represents channels without a provider. External email/SMS delivery is not configured.
- Processing is fault-isolated per event: a bad payload cannot stop the batch. `lastError` is truncated before storage.

The original design also proposed domain-appended events for every aggregate, `SKIP LOCKED` polling, a unique `(userId, eventId)` deduplication key, per-aggregate ordering, and published lag metrics. Those were not implemented; see below.

## Implementation status (2026-11-23)

- Implemented: transactional `notification.created` outbox rows, scheduled processing, per-item fault isolation, retry/backoff, and in-app channel delivery.
- Implemented: STOMP CONNECT authentication and own-queue subscription restrictions in `StompAuthenticationInterceptor`, with unit tests recorded in [`../../quality/TEST_RESULTS.md`](../../quality/TEST_RESULTS.md).
- Deviated from the original design: the outbox is notification-specific, there is no `SKIP LOCKED` claim, no generic domain-event bus, no `(userId, eventId)` deduplication constraint, no aggregate ordering guarantee, and no lag/retry metrics export.
- Verified: a live SockJS/STOMP smoke through the Compose nginx proxy recorded authenticated `CONNECTED`, accepted personal-queue `SUBSCRIBE`, and delivered `MESSAGE` in [`../../evidence/STOMP_SMOKE_RESULT.json`](../../evidence/STOMP_SMOKE_RESULT.json). This is a standalone Node client, not a browser/SPA STOMP client. No production notification provider is claimed.

## Consequences

**Positive**

- A committed state change cannot lose its notification or audit consequence.
- Each outbox row has a unique `eventId`, but there is no `(userId, eventId)` consumer deduplication constraint; replay protection is not guaranteed by the current schema.
- The poller needs no extra infrastructure beyond the existing database.
- Correlation ids travel with the event, satisfying the observability requirement.

**Negative**

- Notification delivery is eventually consistent; the UI must tolerate a short delay.
- The outbox table grows and needs a retention/archival policy before long-running use.
- Polling adds database load and latency compared with a push bus.
- Payload shape must be versioned carefully because events are stored and replayed.

## Alternatives

| Alternative | Why not chosen |
| :--- | :--- |
| Synchronous notification call in the request | Partial failures: either a notification without a committed change or a change without a notification. |
| Spring `@EventListener` after commit with no durable store | Events are lost on process crash between commit and listener execution. |
| Kafka/RabbitMQ as the event backbone | Operationally heavy for a local academic project; the outbox gives the same atomicity with one database. |
| CDC/Debezium publishing | Powerful but adds a connector stack and complicates local reproducibility. |
| Storing notifications directly in the aggregate transaction | Couples the inventory/reservation domain to notification storage and breaks module boundaries. |
