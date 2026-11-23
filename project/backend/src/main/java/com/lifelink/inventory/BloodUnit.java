package com.lifelink.inventory;

import com.lifelink.common.BaseEntity;
import com.lifelink.common.BloodGroup;
import com.lifelink.common.ComponentType;
import com.lifelink.common.exception.BusinessRuleViolationException;
import com.lifelink.common.exception.InvalidStateTransitionException;
import com.lifelink.donor.Donation;
import com.lifelink.organization.Organization;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Duration;
import java.time.Instant;
import java.util.Objects;

@Entity
@Table(name = "blood_units")
public class BloodUnit extends BaseEntity {

    public enum Status {
        COLLECTED, SCREENING, QUARANTINED, AVAILABLE, RESERVED,
        DISPATCHED, DELIVERED, EXPIRED, DISCARDED
    }

    @Column(name = "unit_number", nullable = false, unique = true, length = 60)
    private String unitNumber;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private BloodGroup bloodGroup;

    @Enumerated(EnumType.STRING)
    @Column(name = "component_type", nullable = false, length = 32)
    private ComponentType componentType;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private Status status = Status.COLLECTED;

    @Column(nullable = false)
    private boolean released;

    @Column(name = "collected_at", nullable = false)
    private Instant collectedAt;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(name = "storage_location", nullable = false, length = 120)
    private String storageLocation;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "organization_id", nullable = false)
    private Organization organization;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "donation_id")
    private Donation donation;

    @Column(name = "active_reservation_id")
    private Long activeReservationId;

    protected BloodUnit() {
    }

    public BloodUnit(String unitNumber, BloodGroup bloodGroup, ComponentType componentType,
                     Instant collectedAt, Instant expiresAt, String storageLocation,
                     Organization organization, Donation donation) {
        if (unitNumber == null || unitNumber.isBlank()) {
            throw new IllegalArgumentException("Unit number is required");
        }
        if (bloodGroup == null || componentType == null || organization == null) {
            throw new IllegalArgumentException("Blood group, component and organization are required");
        }
        if (collectedAt == null || expiresAt == null || !expiresAt.isAfter(collectedAt)) {
            throw new IllegalArgumentException("Expiry must be after collection");
        }
        if (storageLocation == null || storageLocation.isBlank()) {
            throw new IllegalArgumentException("Storage location is required");
        }
        this.unitNumber = unitNumber.trim().toUpperCase();
        this.bloodGroup = bloodGroup;
        this.componentType = componentType;
        this.collectedAt = collectedAt;
        this.expiresAt = expiresAt;
        this.storageLocation = storageLocation.trim();
        this.organization = organization;
        this.donation = donation;
        this.status = Status.QUARANTINED;
        this.released = false;
    }

    public static Instant defaultExpiry(ComponentType component, Instant collectedAt) {
        return collectedAt.plus(component.defaultShelfLife());
    }

    public void release(Instant now) {
        ensureNotExpired(now);
        if (released) {
            return;
        }
        if (status != Status.QUARANTINED && status != Status.SCREENING && status != Status.COLLECTED) {
            throw new InvalidStateTransitionException(status.name(), Status.AVAILABLE.name());
        }
        this.released = true;
        this.status = Status.AVAILABLE;
    }

    public void holdForScreening() {
        requireStatus(Status.QUARANTINED, Status.COLLECTED);
        this.status = Status.SCREENING;
    }

    public void quarantine() {
        requireStatus(Status.AVAILABLE, Status.SCREENING, Status.COLLECTED);
        this.status = Status.QUARANTINED;
        this.released = false;
    }

    public void reserve(Long reservationId, Instant now) {
        ensureNotExpired(now);
        if (!released || status != Status.AVAILABLE) {
            throw new BusinessRuleViolationException("Unit is not available for reservation");
        }
        if (activeReservationId != null) {
            throw new BusinessRuleViolationException("Unit already has an active reservation");
        }
        this.activeReservationId = reservationId;
        this.status = Status.RESERVED;
    }

    public void clearReservation() {
        if (status == Status.RESERVED) {
            if (released && !isExpired(Instant.now())) {
                this.status = Status.AVAILABLE;
            } else {
                this.status = Status.QUARANTINED;
            }
        }
        this.activeReservationId = null;
    }

    public void dispatch() {
        requireStatus(Status.RESERVED);
        this.status = Status.DISPATCHED;
    }

    public void deliver() {
        requireStatus(Status.DISPATCHED);
        this.status = Status.DELIVERED;
        this.activeReservationId = null;
    }

    public void markExpired() {
        if (status == Status.DELIVERED || status == Status.DISCARDED || status == Status.EXPIRED) {
            throw new InvalidStateTransitionException(status.name(), Status.EXPIRED.name());
        }
        this.status = Status.EXPIRED;
        this.released = false;
        this.activeReservationId = null;
    }

    public void discard(String reason) {
        if (reason == null || reason.isBlank()) {
            throw new IllegalArgumentException("Discard reason is required");
        }
        if (status == Status.DISPATCHED || status == Status.DELIVERED) {
            throw new InvalidStateTransitionException(status.name(), Status.DISCARDED.name());
        }
        this.status = Status.DISCARDED;
        this.released = false;
        this.activeReservationId = null;
    }

    public void changeLocation(String location) {
        if (location == null || location.isBlank()) {
            throw new IllegalArgumentException("Storage location is required");
        }
        this.storageLocation = location.trim();
    }

    public boolean isExpired(Instant now) {
        return !expiresAt.isAfter(now);
    }

    private void ensureNotExpired(Instant now) {
        if (isExpired(now)) {
            throw new BusinessRuleViolationException("Blood unit has expired");
        }
    }

    private void requireStatus(Status... allowed) {
        for (Status candidate : allowed) {
            if (status == candidate) {
                return;
            }
        }
        throw new InvalidStateTransitionException(status.name(), "operation");
    }

    public String getUnitNumber() { return unitNumber; }
    public BloodGroup getBloodGroup() { return bloodGroup; }
    public ComponentType getComponentType() { return componentType; }
    public Status getStatus() { return status; }
    public boolean isReleased() { return released; }
    public Instant getCollectedAt() { return collectedAt; }
    public Instant getExpiresAt() { return expiresAt; }
    public String getStorageLocation() { return storageLocation; }
    public Organization getOrganization() { return organization; }
    public Donation getDonation() { return donation; }
    public Long getActiveReservationId() { return activeReservationId; }

    @Override
    public boolean equals(Object other) {
        return other instanceof BloodUnit unit && Objects.equals(getPublicId(), unit.getPublicId());
    }

    @Override
    public int hashCode() {
        return Objects.hashCode(getPublicId());
    }
}
