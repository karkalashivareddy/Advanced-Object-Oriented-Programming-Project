package com.lifelink.donor;

import com.lifelink.common.BaseEntity;
import com.lifelink.common.BloodGroup;
import com.lifelink.identity.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import java.time.LocalDate;

@Entity
@Table(name = "donor_profiles")
public class DonorProfile extends BaseEntity {

    public enum Availability { AVAILABLE, TEMPORARILY_UNAVAILABLE, UNAVAILABLE }

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private BloodGroup bloodGroup;

    @Column(name = "date_of_birth")
    private LocalDate dateOfBirth;

    @Column(length = 240)
    private String address;

    @Column(length = 100)
    private String city;

    @Column(length = 100)
    private String state;

    @Column(nullable = false, length = 24)
    private String preferredContact = "IN_APP";

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 24)
    private Availability availability = Availability.AVAILABLE;

    protected DonorProfile() {
    }

    public DonorProfile(User user, BloodGroup bloodGroup, LocalDate dateOfBirth, String address,
                        String city, String state, String preferredContact) {
        this.user = user;
        if (bloodGroup == null) {
            throw new IllegalArgumentException("Blood group is required");
        }
        this.bloodGroup = bloodGroup;
        this.dateOfBirth = dateOfBirth;
        this.address = address;
        this.city = city;
        this.state = state;
        this.preferredContact = preferredContact == null ? "IN_APP" : preferredContact;
    }

    public void updateContact(String address, String city, String state, String preferredContact) {
        this.address = address;
        this.city = city;
        this.state = state;
        this.preferredContact = preferredContact == null ? "IN_APP" : preferredContact;
    }

    public void setAvailability(Availability availability) {
        if (availability == null) {
            throw new IllegalArgumentException("Availability is required");
        }
        this.availability = availability;
    }

    public User getUser() { return user; }
    public BloodGroup getBloodGroup() { return bloodGroup; }
    public LocalDate getDateOfBirth() { return dateOfBirth; }
    public String getAddress() { return address; }
    public String getCity() { return city; }
    public String getState() { return state; }
    public String getPreferredContact() { return preferredContact; }
    public Availability getAvailability() { return availability; }
}
