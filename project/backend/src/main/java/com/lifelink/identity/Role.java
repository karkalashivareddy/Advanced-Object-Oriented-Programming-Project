package com.lifelink.identity;

import java.util.EnumSet;
import java.util.Set;

public enum Role {
    PLATFORM_ADMIN(EnumSet.allOf(Permission.class)),
    BLOOD_BANK_ADMIN(EnumSet.of(
            Permission.USER_READ, Permission.ORGANIZATION_READ, Permission.ORGANIZATION_MANAGE,
            Permission.DONOR_READ, Permission.DONOR_MANAGE, Permission.DONOR_DISCOVERY_READ,
            Permission.APPOINTMENT_MANAGE,
            Permission.DONATION_READ, Permission.DONATION_RECORD, Permission.SCREENING_REVIEW,
            Permission.DONATION_APPROVE, Permission.INVENTORY_READ, Permission.INVENTORY_WRITE,
            Permission.INVENTORY_RELEASE, Permission.REQUEST_READ, Permission.REQUEST_APPROVE,
            Permission.ALLOCATION_REVIEW, Permission.ALLOCATION_CONFIRM,
            Permission.RESERVATION_READ, Permission.RESERVATION_CREATE, Permission.RESERVATION_CONFIRM,
            Permission.DISPATCH_READ, Permission.DISPATCH_CREATE, Permission.DISPATCH_MANAGE,
            Permission.NOTIFICATION_READ, Permission.AUDIT_READ, Permission.ANALYTICS_READ)),
    INVENTORY_MANAGER(EnumSet.of(
            Permission.DONOR_READ, Permission.DONATION_READ,
            Permission.INVENTORY_READ, Permission.INVENTORY_WRITE, Permission.INVENTORY_RELEASE,
            Permission.REQUEST_READ, Permission.ALLOCATION_REVIEW,
            Permission.RESERVATION_READ, Permission.RESERVATION_CREATE, Permission.RESERVATION_CONFIRM,
            Permission.DISPATCH_READ, Permission.DISPATCH_CREATE, Permission.DISPATCH_MANAGE,
            Permission.NOTIFICATION_READ, Permission.ANALYTICS_READ)),
    HOSPITAL_ADMIN(EnumSet.of(
            Permission.ORGANIZATION_READ, Permission.DONOR_READ, Permission.DONOR_DISCOVERY_READ,
            Permission.REQUEST_READ, Permission.REQUEST_CREATE, Permission.REQUEST_APPROVE,
            Permission.ALLOCATION_REVIEW, Permission.RESERVATION_READ, Permission.RESERVATION_CONFIRM,
            Permission.DISPATCH_READ, Permission.NOTIFICATION_READ, Permission.ANALYTICS_READ)),
    MEDICAL_STAFF(EnumSet.of(
            Permission.ORGANIZATION_READ, Permission.DONOR_READ, Permission.DONOR_DISCOVERY_READ,
            Permission.REQUEST_READ,
            Permission.REQUEST_CREATE, Permission.ALLOCATION_REVIEW, Permission.RESERVATION_READ,
            Permission.DISPATCH_READ, Permission.NOTIFICATION_READ, Permission.ANALYTICS_READ)),
    DONOR(EnumSet.of(Permission.NOTIFICATION_READ, Permission.DONOR_READ));

    private final Set<Permission> permissions;

    Role(Set<Permission> permissions) {
        this.permissions = EnumSet.copyOf(permissions);
    }

    public Set<Permission> permissions() {
        return Set.copyOf(permissions);
    }
}
