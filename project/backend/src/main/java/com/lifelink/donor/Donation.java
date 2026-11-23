package com.lifelink.donor;

import com.lifelink.common.BaseEntity;
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
@Table(name = "donations")
public class Donation extends BaseEntity {

    public enum Status { RECORDED, SCREENED, APPROVED, REJECTED }

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "donor_id", nullable = false)
    private DonorProfile donor;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "organization_id", nullable = false)
    private Organization organization;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "appointment_id")
    private Appointment appointment;

    @Column(name = "donated_at", nullable = false)
    private Instant donatedAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private Status status = Status.RECORDED;

    @Column(length = 500)
    private String notes;

    protected Donation() {
    }

    public Donation(DonorProfile donor, Organization organization, Appointment appointment, Instant donatedAt, String notes) {
        if (donatedAt == null || donatedAt.isAfter(Instant.now().plusSeconds(60))) {
            throw new IllegalArgumentException("Donation time must not be in the future");
        }
        this.donor = donor;
        this.organization = organization;
        this.appointment = appointment;
        this.donatedAt = donatedAt;
        this.notes = notes;
    }

    public void screen(boolean passed) {
        if (status != Status.RECORDED) {
            throw new InvalidStateTransitionException(status.name(), "SCREENED");
        }
        this.status = passed ? Status.SCREENED : Status.REJECTED;
    }

    public void approve() {
        if (status != Status.SCREENED) {
            throw new InvalidStateTransitionException(status.name(), "APPROVED");
        }
        this.status = Status.APPROVED;
    }

    public void reject() {
        if (status == Status.APPROVED || status == Status.REJECTED) {
            throw new InvalidStateTransitionException(status.name(), "REJECTED");
        }
        this.status = Status.REJECTED;
    }

    public DonorProfile getDonor() { return donor; }
    public Organization getOrganization() { return organization; }
    public Appointment getAppointment() { return appointment; }
    public Instant getDonatedAt() { return donatedAt; }
    public Status getStatus() { return status; }
    public String getNotes() { return notes; }
}
