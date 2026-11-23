package com.lifelink.notification;

import com.lifelink.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "outbox_events")
public class OutboxEvent extends BaseEntity {

    public enum Status { PENDING, PROCESSING, PROCESSED, FAILED }

    @Column(name = "event_id", nullable = false, unique = true, length = 36)
    private String eventId;

    @Column(name = "topic", nullable = false, length = 100)
    private String topic;

    @Column(name = "payload", nullable = false, length = 4000)
    private String payload;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 24)
    private Status status = Status.PENDING;

    @Column(name = "attempts", nullable = false)
    private int attempts;

    @Column(name = "next_attempt_at", nullable = false)
    private Instant nextAttemptAt;

    @Column(name = "last_error", length = 500)
    private String lastError;

    protected OutboxEvent() {
    }

    public OutboxEvent(String topic, String payload) {
        this.eventId = java.util.UUID.randomUUID().toString();
        this.topic = topic;
        this.payload = payload;
        this.nextAttemptAt = Instant.now();
    }

    public void markProcessing() {
        this.status = Status.PROCESSING;
    }

    public void markProcessed() {
        this.status = Status.PROCESSED;
        this.attempts++;
    }

    public void markFailed(String error, Instant retryAt) {
        this.attempts++;
        this.lastError = error == null ? "unknown" : error.substring(0, Math.min(400, error.length()));
        this.status = this.attempts >= 5 ? Status.FAILED : Status.PENDING;
        this.nextAttemptAt = retryAt;
    }

    public String getEventId() { return eventId; }
    public String getTopic() { return topic; }
    public String getPayload() { return payload; }
    public Status getStatus() { return status; }
    public int getAttempts() { return attempts; }
    public Instant getNextAttemptAt() { return nextAttemptAt; }
    public String getLastError() { return lastError; }
}
