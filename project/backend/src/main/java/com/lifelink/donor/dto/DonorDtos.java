package com.lifelink.donor.dto;

import com.lifelink.common.BloodGroup;
import com.lifelink.donor.Appointment;
import com.lifelink.donor.ConsentRecord;
import com.lifelink.donor.DonorProfile;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.AssertTrue;
import java.time.Instant;
import java.time.LocalDate;

public final class DonorDtos {
    private DonorDtos() {
    }

    public record CreateProfileRequest(Long userId, @NotNull BloodGroup bloodGroup, LocalDate dateOfBirth,
                                       String address, String city, String state, String preferredContact) {
    }

    public record UpdateProfileRequest(String address, String city, String state, String preferredContact,
                                       DonorProfile.Availability availability) {
    }

    /** Coordinates are required only when location discovery is enabled. */
    public record LocationPreferenceRequest(@NotNull Boolean enabled, Double latitude, Double longitude) {
        @AssertTrue(message = "Both valid coordinates are required when enabled; omit them when disabled")
        public boolean isCoordinateConsentConsistent() {
            if (Boolean.TRUE.equals(enabled)) return latitude != null && longitude != null;
            return latitude == null && longitude == null;
        }
    }

    public record LocationPreferenceView(boolean consentGranted, Instant locationUpdatedAt) {
    }

    public record ProfileView(Long id, String publicId, Long userId, String fullName, String email,
                              BloodGroup bloodGroup, LocalDate dateOfBirth, String address, String city,
                              String state, String preferredContact, DonorProfile.Availability availability) {
        public static ProfileView of(DonorProfile profile) {
            return new ProfileView(profile.getId(), profile.getPublicId(), profile.getUser().getId(),
                    profile.getUser().getFullName(), profile.getUser().getEmail(), profile.getBloodGroup(),
                    profile.getDateOfBirth(), profile.getAddress(), profile.getCity(), profile.getState(),
                    profile.getPreferredContact(), profile.getAvailability());
        }
    }

    public record ConsentRequest(String type, boolean granted) {
    }

    public record ConsentView(Long id, String type, boolean granted, Instant grantedAt, Instant withdrawnAt) {
        public static ConsentView of(ConsentRecord record) {
            return new ConsentView(record.getId(), record.getType(), record.isGranted(),
                    record.getGrantedAt(), record.getWithdrawnAt());
        }
    }

    public record AppointmentRequest(Long organizationId, @NotNull Instant scheduledAt, String notes) {
    }

    public record AppointmentActionRequest(String action, String notes) {
    }

    public record AppointmentView(Long id, String publicId, Long donorId, Long organizationId,
                                  String organizationName, Instant scheduledAt, Appointment.Status status,
                                  String notes) {
        public static AppointmentView of(Appointment appointment) {
            return new AppointmentView(appointment.getId(), appointment.getPublicId(),
                    appointment.getDonor().getId(), appointment.getOrganization().getId(),
                    appointment.getOrganization().getName(), appointment.getScheduledAt(),
                    appointment.getStatus(), appointment.getNotes());
        }
    }
}
