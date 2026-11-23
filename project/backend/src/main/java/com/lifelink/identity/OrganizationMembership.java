package com.lifelink.identity;

import com.lifelink.common.BaseEntity;
import com.lifelink.organization.Organization;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

@Entity
@Table(name = "organization_memberships", uniqueConstraints =
        @UniqueConstraint(name = "uk_membership_user_org", columnNames = {"user_id", "organization_id"}))
public class OrganizationMembership extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "organization_id", nullable = false)
    private Organization organization;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private Role role;

    protected OrganizationMembership() {
    }

    public OrganizationMembership(User user, Organization organization, Role role) {
        this.user = user;
        this.organization = organization;
        setRole(role);
    }

    public void changeRole(Role role) {
        setRole(role);
    }

    private void setRole(Role role) {
        if (role == null || role == Role.PLATFORM_ADMIN || role == Role.DONOR) {
            throw new IllegalArgumentException("Invalid organization role");
        }
        this.role = role;
    }

    public User getUser() { return user; }
    public Organization getOrganization() { return organization; }
    public Role getRole() { return role; }
}
