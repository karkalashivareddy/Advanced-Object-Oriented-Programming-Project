package com.lifelink.reservation.dto;

import com.lifelink.reservation.Reservation;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;

public final class ReservationDtos {
    private ReservationDtos() {
    }

    public record CreateRequest(@NotNull Long unitId, @NotNull Long requestId,
                                @NotBlank String idempotencyKey) {
    }

    public record View(Long id, String publicId, Long unitId, String unitNumber, Long requestId,
                       Long organizationId, Reservation.Status status, Instant expiresAt,
                       Instant confirmedAt) {
        public static View of(Reservation reservation) {
            return new View(reservation.getId(), reservation.getPublicId(),
                    reservation.getBloodUnit().getId(), reservation.getBloodUnit().getUnitNumber(),
                    reservation.getRequest().getId(), reservation.getOrganization().getId(),
                    reservation.getStatus(), reservation.getExpiresAt(), reservation.getConfirmedAt());
        }
    }
}
