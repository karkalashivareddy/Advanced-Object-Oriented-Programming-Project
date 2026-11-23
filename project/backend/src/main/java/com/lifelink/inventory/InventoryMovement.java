package com.lifelink.inventory;

import com.lifelink.common.BaseEntity;
import com.lifelink.identity.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "inventory_movements")
public class InventoryMovement extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "unit_id", nullable = false)
    private BloodUnit unit;

    @Column(name = "from_status", length = 32)
    private String fromStatus;

    @Column(name = "to_status", nullable = false, length = 32)
    private String toStatus;

    @Column(nullable = false, length = 240)
    private String reason;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "actor_id")
    private User actor;

    @Column(name = "occurred_at", nullable = false)
    private Instant occurredAt;

    protected InventoryMovement() {
    }

    public InventoryMovement(BloodUnit unit, String fromStatus, String toStatus, String reason, User actor) {
        this.unit = unit;
        this.fromStatus = fromStatus;
        this.toStatus = toStatus;
        this.reason = reason;
        this.actor = actor;
        this.occurredAt = Instant.now();
    }

    public BloodUnit getUnit() { return unit; }
    public String getFromStatus() { return fromStatus; }
    public String getToStatus() { return toStatus; }
    public String getReason() { return reason; }
    public User getActor() { return actor; }
    public Instant getOccurredAt() { return occurredAt; }
}
