package com.lifelink.donor;

import com.lifelink.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "consents")
public class ConsentRecord extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "donor_id", nullable = false)
    private DonorProfile donor;

    @Column(nullable = false, length = 60)
    private String type;

    @Column(nullable = false)
    private boolean granted;

    @Column(name = "granted_at", nullable = false)
    private Instant grantedAt;

    @Column(name = "withdrawn_at")
    private Instant withdrawnAt;

    protected ConsentRecord() {
    }

    public ConsentRecord(DonorProfile donor, String type, boolean granted) {
        if (type == null || type.isBlank()) {
            throw new IllegalArgumentException("Consent type is required");
        }
        this.donor = donor;
        this.type = type.trim();
        this.granted = granted;
        this.grantedAt = Instant.now();
    }

    public void withdraw(Instant now) {
        if (!granted) {
            return;
        }
        this.granted = false;
        this.withdrawnAt = now;
    }

    public DonorProfile getDonor() { return donor; }
    public String getType() { return type; }
    public boolean isGranted() { return granted; }
    public Instant getGrantedAt() { return grantedAt; }
    public Instant getWithdrawnAt() { return withdrawnAt; }
}
