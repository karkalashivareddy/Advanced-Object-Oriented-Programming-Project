package com.lifelink.audit;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "audit_events")
public class AuditEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "actor_id")
    private Long actorId;

    @Column(name = "organization_id")
    private Long organizationId;

    @Column(nullable = false, length = 100)
    private String action;

    @Column(name = "target_type", nullable = false, length = 80)
    private String targetType;

    @Column(name = "target_id", length = 80)
    private String targetId;

    @Column(name = "correlation_id", nullable = false, length = 64)
    private String correlationId;

    @Column(length = 4000)
    private String metadata;

    @Column(nullable = false, length = 20)
    private String outcome;

    @Column(name = "occurred_at", nullable = false)
    private Instant occurredAt;

    protected AuditEvent() {
    }

    public AuditEvent(Long actorId, Long organizationId, String action, String targetType,
                      String targetId, String correlationId, String metadata, String outcome) {
        this.actorId = actorId;
        this.organizationId = organizationId;
        this.action = action;
        this.targetType = targetType;
        this.targetId = targetId;
        this.correlationId = correlationId;
        this.metadata = metadata;
        this.outcome = outcome;
        this.occurredAt = Instant.now();
    }

    public Long getId() { return id; }
    public Long getActorId() { return actorId; }
    public Long getOrganizationId() { return organizationId; }
    public String getAction() { return action; }
    public String getTargetType() { return targetType; }
    public String getTargetId() { return targetId; }
    public String getCorrelationId() { return correlationId; }
    public String getMetadata() { return metadata; }
    public String getOutcome() { return outcome; }
    public Instant getOccurredAt() { return occurredAt; }
}
