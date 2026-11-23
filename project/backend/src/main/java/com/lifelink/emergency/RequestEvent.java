package com.lifelink.emergency;

import com.lifelink.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "request_events")
public class RequestEvent extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "request_id", nullable = false)
    private EmergencyRequest request;

    @Column(nullable = false, length = 80)
    private String action;

    @Column(length = 500)
    private String notes;

    @Column(name = "actor_id")
    private Long actorId;

    @Column(name = "occurred_at", nullable = false)
    private Instant occurredAt;

    protected RequestEvent() {
    }

    public RequestEvent(EmergencyRequest request, String action, String notes, Long actorId) {
        this.request = request;
        this.action = action;
        this.notes = notes;
        this.actorId = actorId;
        this.occurredAt = Instant.now();
    }

    public EmergencyRequest getRequest() { return request; }
    public String getAction() { return action; }
    public String getNotes() { return notes; }
    public Long getActorId() { return actorId; }
    public Instant getOccurredAt() { return occurredAt; }
}
