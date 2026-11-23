package com.lifelink.donor;

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
@Table(name = "screening_records")
public class ScreeningRecord extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "donation_id", nullable = false)
    private Donation donation;

    @Column(nullable = false)
    private boolean passed;

    @Column(length = 500)
    private String notes;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "screened_by", nullable = false)
    private User screenedBy;

    @Column(name = "screened_at", nullable = false)
    private Instant screenedAt;

    protected ScreeningRecord() {
    }

    public ScreeningRecord(Donation donation, boolean passed, String notes, User screenedBy) {
        this.donation = donation;
        this.passed = passed;
        this.notes = notes;
        this.screenedBy = screenedBy;
        this.screenedAt = Instant.now();
    }

    public Donation getDonation() { return donation; }
    public boolean isPassed() { return passed; }
    public String getNotes() { return notes; }
    public User getScreenedBy() { return screenedBy; }
    public Instant getScreenedAt() { return screenedAt; }
}
