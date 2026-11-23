# ADR-004: Transactional Outbox for Notifications

**Status:** Accepted (design decision; implementation planned, not yet present).  
**Date:** 2026-11-23  
**Related:** [`../SYSTEM_ARCHITECTURE.md`](../SYSTEM_ARCHITECTURE.md), [`../DOMAIN_MODEL.md`](../DOMAIN_MODEL.md)

## Context

State changes such as `DonationApproved`, `BloodUnitReleased`, `ReservationConfirmed`, `DispatchDeparted`, and `DispatchDelivered` should produce notifications and audit entries. Sending a notification directly inside a request would create two failure modes: a commit that succeeds after a failed send, or a send that succeeds after a rollback. The contract exposes a per-user notification inbox but no external delivery endpoint.

## Decision

Implement a **transactional outbox** inside the same PostgreSQL database:

- Domain methods append events; the application service drains them and inserts `outbox_event(eventId, aggregateId, type, payload, correlationId, organizationId, publishedAt, attempts)` in the same transaction as the state change and audit row.
- A poller claims a batch with `SELECT ... FOR UPDATE SKIP LOCKED`, dispatches each event to the notification worker, and marks it published.
- The worker upserts a `Notification` row with a unique `(userId, eventId)` constraint, making consumption idempotent.
- Delivery is at-least-once; ordering is guaranteed per aggregate id only. Retry count and oldest unpublished age are exported as metrics.
- No HTTP call, template rendering, or email/SMS work occurs inside the transaction; external channels are out of scope and would be adapters behind the worker.

## Consequences

**Positive**

- A committed state change cannot lose its notification or audit consequence.
- Replays are harmless because consumers deduplicate on `eventId`.
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
