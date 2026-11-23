package com.lifelink.emergency;

import com.lifelink.common.BaseEntity;
import com.lifelink.common.BloodGroup;
import com.lifelink.common.ComponentType;
import com.lifelink.common.exception.BusinessRuleViolationException;
import com.lifelink.common.exception.InvalidStateTransitionException;
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
@Table(name = "emergency_requests")
public class EmergencyRequest extends BaseEntity {

    public enum Status {
        DRAFT, PENDING_VERIFICATION, VERIFIED, APPROVED, ALLOCATING, RESERVED,
        IN_TRANSIT, FULFILLED, REJECTED, CANCELLED, EXPIRED
    }
    public enum Priority { ROUTINE, URGENT, CRITICAL }

    @Column(name = "request_number", nullable = false, unique = true, length = 40)
    private String requestNumber;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "requesting_org_id", nullable = false)
    private Organization requestingOrganization;

    @Column(name = "patient_ref", length = 80)
    private String patientRef;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private BloodGroup bloodGroup;

    @Enumerated(EnumType.STRING)
    @Column(name = "component_type", nullable = false, length = 32)
    private ComponentType componentType;

    @Column(nullable = false)
    private int quantity;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private Priority priority = Priority.ROUTINE;

    @Column(name = "required_by", nullable = false)
    private Instant requiredBy;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private Status status = Status.PENDING_VERIFICATION;

    @Column(length = 1000)
    private String reason;

    @Column(name = "created_by", nullable = false)
    private Long createdBy;

    @Column(name = "verified_by")
    private Long verifiedBy;

    @Column(name = "approved_by")
    private Long approvedBy;

    protected EmergencyRequest() {
    }

    public EmergencyRequest(String requestNumber, Organization requestingOrganization, String patientRef,
                            BloodGroup bloodGroup, ComponentType componentType, int quantity,
                            Priority priority, Instant requiredBy, String reason, Long createdBy) {
        if (requestNumber == null || requestNumber.isBlank()) {
            throw new IllegalArgumentException("Request number is required");
        }
        if (quantity < 1 || quantity > 99) {
            throw new IllegalArgumentException("Quantity must be between 1 and 99");
        }
        if (requiredBy == null || !requiredBy.isAfter(Instant.now())) {
            throw new IllegalArgumentException("Required-by time must be in the future");
        }
        this.requestNumber = requestNumber;
        this.requestingOrganization = requestingOrganization;
        this.patientRef = patientRef;
        this.bloodGroup = bloodGroup;
        this.componentType = componentType;
        this.quantity = quantity;
        this.priority = priority == null ? Priority.ROUTINE : priority;
        this.requiredBy = requiredBy;
        this.reason = reason;
        this.createdBy = createdBy;
        this.status = Status.PENDING_VERIFICATION;
    }

    public void verify(Long verifierId) {
        requireStatus(Status.PENDING_VERIFICATION);
        this.verifiedBy = verifierId;
        this.status = Status.VERIFIED;
    }

    public void approve(Long approverId) {
        requireStatus(Status.VERIFIED);
        this.approvedBy = approverId;
        this.status = Status.APPROVED;
    }

    public void reject() {
        requireStatus(Status.PENDING_VERIFICATION, Status.VERIFIED, Status.APPROVED);
        this.status = Status.REJECTED;
    }

    public void cancel() {
        requireStatus(Status.PENDING_VERIFICATION, Status.VERIFIED, Status.APPROVED,
                Status.ALLOCATING, Status.RESERVED);
        this.status = Status.CANCELLED;
    }

    public void markAllocating() { requireStatus(Status.APPROVED); this.status = Status.ALLOCATING; }
    public void markReserved() { requireStatus(Status.ALLOCATING, Status.RESERVED); this.status = Status.RESERVED; }
    public void markInTransit() { requireStatus(Status.RESERVED); this.status = Status.IN_TRANSIT; }
    public void fulfil() { requireStatus(Status.IN_TRANSIT, Status.RESERVED); this.status = Status.FULFILLED; }

    public void changePriority(Priority priority, boolean authorized) {
        if (!authorized) {
            throw new BusinessRuleViolationException("Priority changes require authorization");
        }
        if (status == Status.FULFILLED || status == Status.CANCELLED || status == Status.REJECTED) {
            throw new InvalidStateTransitionException(status.name(), "PRIORITY_CHANGE");
        }
        this.priority = priority;
    }

    private void requireStatus(Status... allowed) {
        for (Status candidate : allowed) {
            if (status == candidate) {
                return;
            }
        }
        throw new InvalidStateTransitionException(status.name(), "operation");
    }

    public String getRequestNumber() { return requestNumber; }
    public Organization getRequestingOrganization() { return requestingOrganization; }
    public String getPatientRef() { return patientRef; }
    public BloodGroup getBloodGroup() { return bloodGroup; }
    public ComponentType getComponentType() { return componentType; }
    public int getQuantity() { return quantity; }
    public Priority getPriority() { return priority; }
    public Instant getRequiredBy() { return requiredBy; }
    public Status getStatus() { return status; }
    public String getReason() { return reason; }
    public Long getCreatedBy() { return createdBy; }
    public Long getVerifiedBy() { return verifiedBy; }
    public Long getApprovedBy() { return approvedBy; }
}
