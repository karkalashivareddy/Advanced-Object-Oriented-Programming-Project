package com.lifelink.inventory;

import com.lifelink.common.BaseEntity;
import com.lifelink.organization.Organization;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

@Entity
@Table(name = "storage_locations", uniqueConstraints =
        @UniqueConstraint(name = "uk_storage_code", columnNames = {"organization_id", "code"}))
public class StorageLocation extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "organization_id", nullable = false)
    private Organization organization;

    @Column(nullable = false, length = 40)
    private String code;

    @Column(nullable = false, length = 120)
    private String name;

    @Column(nullable = false)
    private boolean active = true;

    protected StorageLocation() {
    }

    public StorageLocation(Organization organization, String code, String name) {
        if (code == null || code.isBlank() || name == null || name.isBlank()) {
            throw new IllegalArgumentException("Storage code and name are required");
        }
        this.organization = organization;
        this.code = code.trim().toUpperCase();
        this.name = name.trim();
    }

    public void deactivate() { active = false; }
    public Organization getOrganization() { return organization; }
    public String getCode() { return code; }
    public String getName() { return name; }
    public boolean isActive() { return active; }
}
