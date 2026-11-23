package com.lifelink.reservation;

import com.lifelink.common.BaseEntity;
import com.lifelink.common.exception.InvalidStateTransitionException;
import com.lifelink.emergency.EmergencyRequest;
import com.lifelink.inventory.BloodUnit;
import com.lifelink.organization.Organization;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "reservations")
public class Reservation extends BaseEntity {

    public enum Status { ACTIVE, CONFIRMED, CANCELLED, EXPIRED }

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "blood_unit_id", nullable = false)
    private BloodUnit bloodUnit;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "request_id", nullable = false)
    private EmergencyRequest request;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "organization_id", nullable = false)
    private Organization organization;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private Status status = Status.ACTIVE;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(name = "confirmed_at")
    private Instant confirmedAt;

    @Column(name = "idempotency_key", nullable = false, unique = true, length = 120)
    private String idempotencyKey;

    protected Reservation() {
    }

    public Reservation(BloodUnit bloodUnit, EmergencyRequest request, Organization organization,
                       Instant expiresAt, String idempotencyKey) {
        if (expiresAt == null || !expiresAt.isAfter(Instant.now())) {
            throw new IllegalArgumentException("Reservation expiry must be in the future");
        }
        if (idempotencyKey == null || idempotencyKey.isBlank()) {
            throw new IllegalArgumentException("Idempotency key is required");
        }
        this.bloodUnit = bloodUnit;
        this.request = request;
        this.organization = organization;
        this.expiresAt = expiresAt;
        this.idempotencyKey = idempotencyKey;
    }

    public void confirm(Instant now) {
        if (status != Status.ACTIVE) {
            throw new InvalidStateTransitionException(status.name(), Status.CONFIRMED.name());
        }
        if (!expiresAt.isAfter(now)) {
            throw new InvalidStateTransitionException("EXPIRED", Status.CONFIRMED.name());
        }
        this.status = Status.CONFIRMED;
        this.confirmedAt = now;
    }

    public void cancel() {
        if (status != Status.ACTIVE && status != Status.CONFIRMED) {
            throw new InvalidStateTransitionException(status.name(), Status.CANCELLED.name());
        }
        this.status = Status.CANCELLED;
    }

    public void expire() {
        if (status != Status.ACTIVE) {
            throw new InvalidStateTransitionException(status.name(), Status.EXPIRED.name());
        }
        this.status = Status.EXPIRED;
    }

    public BloodUnit getBloodUnit() { return bloodUnit; }
    public EmergencyRequest getRequest() { return request; }
    public Organization getOrganization() { return organization; }
    public Status getStatus() { return status; }
    public Instant getExpiresAt() { return expiresAt; }
    public Instant getConfirmedAt() { return confirmedAt; }
    public String getIdempotencyKey() { return idempotencyKey; }
}
