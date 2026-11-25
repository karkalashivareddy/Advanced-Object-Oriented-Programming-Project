package com.lifelink.organization;

import com.lifelink.common.BaseEntity;
import com.lifelink.common.GeoPoint;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "organizations")
public class Organization extends BaseEntity {

    public enum Type { BLOOD_BANK, HOSPITAL }

    @Column(nullable = false, length = 160)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 24)
    private Type type;

    @Column(nullable = false, unique = true, length = 40)
    private String registrationCode;

    @Column(length = 100)
    private String city;

    @Column(length = 100)
    private String state;

    @Column(nullable = false, length = 160)
    private String contactEmail;

    @Column(length = 32)
    private String phone;

    @Column(nullable = false)
    private boolean verified;

    @Column(nullable = false)
    private boolean active = true;

    @Column(length = 200)
    private String serviceArea;

    // Provider geography is stored for demo seeding and future area analytics only;
    // OrganizationDtos never projects these columns.
    @Column
    private Double latitude;

    @Column
    private Double longitude;

    @Column(name = "location_updated_at")
    private Instant locationUpdatedAt;

    protected Organization() {
    }

    public Organization(String name, Type type, String registrationCode, String city, String state,
                        String contactEmail, String phone, String serviceArea) {
        setName(name);
        this.type = type;
        setRegistrationCode(registrationCode);
        this.city = city;
        this.state = state;
        setContactEmail(contactEmail);
        this.phone = phone;
        this.serviceArea = serviceArea;
        this.active = true;
    }

    public void verify() {
        if (verified) {
            return;
        }
        verified = true;
    }

    public void deactivate() {
        active = false;
    }

    public void activate() {
        active = true;
    }

    public void update(String name, String city, String state, String contactEmail, String phone, String serviceArea) {
        setName(name);
        this.city = city;
        this.state = state;
        setContactEmail(contactEmail);
        this.phone = phone;
        this.serviceArea = serviceArea;
    }

    /** Sets provider geography atomically; all coordinates are validated by {@link GeoPoint}. */
    public void updateLocation(GeoPoint point, Instant updatedAt) {
        if (point == null || updatedAt == null) {
            throw new IllegalArgumentException("Location and timestamp are required");
        }
        this.latitude = point.latitude();
        this.longitude = point.longitude();
        this.locationUpdatedAt = updatedAt;
    }

    public void clearLocation() {
        this.latitude = null;
        this.longitude = null;
        this.locationUpdatedAt = null;
    }

    public GeoPoint location() {
        return latitude == null || longitude == null ? null : new GeoPoint(latitude, longitude);
    }

    public Instant getLocationUpdatedAt() { return locationUpdatedAt; }

    private void setName(String value) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("Organization name is required");
        }
        this.name = value.trim();
    }

    private void setRegistrationCode(String value) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("Registration code is required");
        }
        this.registrationCode = value.trim().toUpperCase();
    }

    private void setContactEmail(String value) {
        if (value == null || !value.contains("@")) {
            throw new IllegalArgumentException("A valid contact email is required");
        }
        this.contactEmail = value.trim().toLowerCase();
    }

    public String getName() { return name; }
    public Type getType() { return type; }
    public String getRegistrationCode() { return registrationCode; }
    public String getCity() { return city; }
    public String getState() { return state; }
    public String getContactEmail() { return contactEmail; }
    public String getPhone() { return phone; }
    public boolean isVerified() { return verified; }
    public boolean isActive() { return active; }
    public String getServiceArea() { return serviceArea; }
}
