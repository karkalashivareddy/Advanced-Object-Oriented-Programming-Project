package com.lifelink.dispatch;

import com.lifelink.common.BaseEntity;
import com.lifelink.common.exception.InvalidStateTransitionException;
import com.lifelink.emergency.EmergencyRequest;
import com.lifelink.organization.Organization;
import com.lifelink.reservation.Reservation;
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
@Table(name = "dispatches")
public class Dispatch extends BaseEntity {

    public enum Status { PREPARING, IN_TRANSIT, DELIVERED, INCIDENT }

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "reservation_id", nullable = false, unique = true)
    private Reservation reservation;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "request_id", nullable = false)
    private EmergencyRequest request;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "organization_id", nullable = false)
    private Organization organization;

    @Column(name = "assigned_staff", nullable = false, length = 160)
    private String assignedStaff;

    @Column(name = "idempotency_key", length = 120, unique = true)
    private String idempotencyKey;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private Status status = Status.PREPARING;

    @Column(name = "dispatched_at")
    private Instant dispatchedAt;

    @Column(name = "delivered_at")
    private Instant deliveredAt;

    @Column(name = "recipient_name", length = 160)
    private String recipientName;

    @Column(name = "incident_description", length = 500)
    private String incidentDescription;

    protected Dispatch() {
    }

    public Dispatch(Reservation reservation, EmergencyRequest request, Organization organization,
                    String assignedStaff, String idempotencyKey) {
        if (assignedStaff == null || assignedStaff.isBlank()) {
            throw new IllegalArgumentException("Assigned staff is required");
        }
        if (idempotencyKey == null || idempotencyKey.isBlank()) {
            throw new IllegalArgumentException("Idempotency key is required");
        }
        this.reservation = reservation;
        this.request = request;
        this.organization = organization;
        this.assignedStaff = assignedStaff.trim();
        this.idempotencyKey = idempotencyKey.trim();
    }

    public void depart() {
        requireStatus(Status.PREPARING);
        this.status = Status.IN_TRANSIT;
        this.dispatchedAt = Instant.now();
    }

    public void deliver(String recipientName) {
        requireStatus(Status.IN_TRANSIT, Status.INCIDENT);
        if (recipientName == null || recipientName.isBlank()) {
            throw new IllegalArgumentException("Delivery recipient is required");
        }
        this.status = Status.DELIVERED;
        this.recipientName = recipientName.trim();
        this.deliveredAt = Instant.now();
    }

    public void reportIncident(String description) {
        if (description == null || description.isBlank()) {
            throw new IllegalArgumentException("Incident description is required");
        }
        if (status == Status.DELIVERED) {
            throw new InvalidStateTransitionException(status.name(), Status.INCIDENT.name());
        }
        this.status = Status.INCIDENT;
        this.incidentDescription = description.trim();
    }

    private void requireStatus(Status... allowed) {
        for (Status candidate : allowed) {
            if (status == candidate) {
                return;
            }
        }
        throw new InvalidStateTransitionException(status.name(), "operation");
    }

    public Reservation getReservation() { return reservation; }
    public EmergencyRequest getRequest() { return request; }
    public Organization getOrganization() { return organization; }
    public String getAssignedStaff() { return assignedStaff; }
    public String getIdempotencyKey() { return idempotencyKey; }
    public Status getStatus() { return status; }
    public Instant getDispatchedAt() { return dispatchedAt; }
    public Instant getDeliveredAt() { return deliveredAt; }
    public String getRecipientName() { return recipientName; }
    public String getIncidentDescription() { return incidentDescription; }
}
