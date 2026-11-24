package com.lifelink.donor.dto;

import com.lifelink.common.ComponentType;
import com.lifelink.donor.Donation;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import java.util.List;

public final class DonationDtos {
    private DonationDtos() {
    }

    public record CreateRequest(@NotNull Long donorId, @NotNull Long organizationId, Long appointmentId,
                                Instant donatedAt, String notes) {
    }

    public record ScreeningRequest(boolean passed, String notes) {
    }

    public record ApprovalRequest(List<ComponentType> components) {
    }

    public record RejectRequest(@NotBlank String reason) {
    }

    public record View(Long id, String publicId, Long donorId, String donorName, Long organizationId,
                       Long appointmentId, Instant donatedAt, Donation.Status status, String notes) {
        public static View of(Donation donation) {
            return new View(donation.getId(), donation.getPublicId(), donation.getDonor().getId(),
                    donation.getDonor().getUser().getFullName(), donation.getOrganization().getId(),
                    donation.getAppointment() == null ? null : donation.getAppointment().getId(),
                    donation.getDonatedAt(), donation.getStatus(), donation.getNotes());
        }
    }
}
