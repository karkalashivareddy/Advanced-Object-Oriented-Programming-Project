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
@Table(name = "appointments")
public class Appointment extends BaseEntity {

    public enum Status { REQUESTED, CONFIRMED, COMPLETED, CANCELLED, REJECTED }

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "donor_id", nullable = false)
    private DonorProfile donor;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "organization_id", nullable = false)
    private Organization organization;

    @Column(name = "scheduled_at", nullable = false)
    private Instant scheduledAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private Status status = Status.REQUESTED;

    @Column(length = 500)
    private String notes;

    protected Appointment() {
    }

    public Appointment(DonorProfile donor, Organization organization, Instant scheduledAt, String notes) {
        if (scheduledAt == null || !scheduledAt.isAfter(Instant.now())) {
            throw new IllegalArgumentException("Appointment must be in the future");
        }
        this.donor = donor;
        this.organization = organization;
        this.scheduledAt = scheduledAt;
        this.notes = notes;
    }

    public void confirm() { transition(Status.CONFIRMED, Status.REQUESTED); }
    public void complete() { transition(Status.COMPLETED, Status.CONFIRMED); }
    public void cancel() { transition(Status.CANCELLED, Status.REQUESTED, Status.CONFIRMED); }
    public void reject() { transition(Status.REJECTED, Status.REQUESTED); }

    private void transition(Status target, Status... allowed) {
        boolean permitted = false;
        for (Status status1 : allowed) {
            permitted |= this.status == status1;
        }
        if (!permitted) {
            throw new InvalidStateTransitionException(this.status.name(), target.name());
        }
        this.status = target;
    }

    public DonorProfile getDonor() { return donor; }
    public Organization getOrganization() { return organization; }
    public Instant getScheduledAt() { return scheduledAt; }
    public Status getStatus() { return status; }
    public String getNotes() { return notes; }
}
