package com.lifelink.emergency.dto;

import com.lifelink.common.BloodGroup;
import com.lifelink.common.ComponentType;
import com.lifelink.emergency.EmergencyRequest;
import com.lifelink.emergency.RequestEvent;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import java.util.List;

public final class RequestDtos {
    private RequestDtos() {
    }

    public record CreateRequest(@NotNull Long organizationId, String patientRef,
                                @NotNull BloodGroup bloodGroup, @NotNull ComponentType componentType,
                                @Min(1) @Max(99) int quantity, EmergencyRequest.Priority priority,
                                @NotNull Instant requiredBy, String reason) {
    }

    public record PriorityRequest(@NotNull EmergencyRequest.Priority priority) {
    }

    public record ReasonRequest(@NotBlank String reason) {
    }

    public record View(Long id, String publicId, String requestNumber, Long organizationId,
                       String organizationName, String patientRef, BloodGroup bloodGroup,
                       ComponentType componentType, int quantity, EmergencyRequest.Priority priority,
                       Instant requiredBy, EmergencyRequest.Status status, String reason) {
        public static View of(EmergencyRequest request) {
            return new View(request.getId(), request.getPublicId(), request.getRequestNumber(),
                    request.getRequestingOrganization().getId(), request.getRequestingOrganization().getName(),
                    request.getPatientRef(), request.getBloodGroup(), request.getComponentType(),
                    request.getQuantity(), request.getPriority(), request.getRequiredBy(),
                    request.getStatus(), request.getReason());
        }
    }

    public record EventView(Long id, String action, String notes, Long actorId, Instant occurredAt) {
        public static EventView of(RequestEvent event) {
            return new EventView(event.getId(), event.getAction(), event.getNotes(),
                    event.getActorId(), event.getOccurredAt());
        }
    }

    public record Detail(View request, List<EventView> events) {
    }
}
