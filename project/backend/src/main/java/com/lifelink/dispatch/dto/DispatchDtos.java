package com.lifelink.dispatch.dto;

import com.lifelink.dispatch.Dispatch;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;

public final class DispatchDtos {
    private DispatchDtos() {
    }

    public record CreateRequest(@NotNull Long reservationId, @NotBlank String assignedStaff) {
    }

    public record DeliveryRequest(@NotBlank String recipientName) {
    }

    public record IncidentRequest(@NotBlank String description) {
    }

    public record View(Long id, String publicId, Long reservationId, Long requestId, Long organizationId,
                       String assignedStaff, Dispatch.Status status, Instant dispatchedAt,
                       Instant deliveredAt, String recipientName, String incidentDescription) {
        public static View of(Dispatch dispatch) {
            return new View(dispatch.getId(), dispatch.getPublicId(), dispatch.getReservation().getId(),
                    dispatch.getRequest().getId(), dispatch.getOrganization().getId(),
                    dispatch.getAssignedStaff(), dispatch.getStatus(), dispatch.getDispatchedAt(),
                    dispatch.getDeliveredAt(), dispatch.getRecipientName(), dispatch.getIncidentDescription());
        }
    }
}
