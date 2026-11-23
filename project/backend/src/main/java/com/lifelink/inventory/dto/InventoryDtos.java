package com.lifelink.inventory.dto;

import com.lifelink.common.BloodGroup;
import com.lifelink.common.ComponentType;
import com.lifelink.inventory.BloodUnit;
import com.lifelink.inventory.InventoryMovement;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import java.util.List;

public final class InventoryDtos {
    private InventoryDtos() {
    }

    public record CreateRequest(@NotNull Long organizationId, @NotBlank String unitNumber,
                                @NotNull BloodGroup bloodGroup, @NotNull ComponentType componentType,
                                @NotNull Instant collectedAt, Instant expiresAt,
                                @NotBlank String storageLocation) {
    }

    public record AdjustmentRequest(@NotNull Long unitId, Integer delta, @NotBlank String reason,
                                    String location) {
    }

    public record View(Long id, String publicId, String unitNumber, BloodGroup bloodGroup,
                       ComponentType componentType, BloodUnit.Status status, boolean released,
                       Instant collectedAt, Instant expiresAt, String storageLocation, Long organizationId,
                       Long donationId, long version) {
        public static View of(BloodUnit unit) {
            return new View(unit.getId(), unit.getPublicId(), unit.getUnitNumber(), unit.getBloodGroup(),
                    unit.getComponentType(), unit.getStatus(), unit.isReleased(), unit.getCollectedAt(),
                    unit.getExpiresAt(), unit.getStorageLocation(), unit.getOrganization().getId(),
                    unit.getDonation() == null ? null : unit.getDonation().getId(), unit.getVersion());
        }
    }

    public record MovementView(Long id, String fromStatus, String toStatus, String reason,
                               Instant occurredAt) {
        public static MovementView of(InventoryMovement movement) {
            return new MovementView(movement.getId(), movement.getFromStatus(), movement.getToStatus(),
                    movement.getReason(), movement.getOccurredAt());
        }
    }

    public record Alerts(long expiringSoon, long expired, long lowStockOrganizations) {
    }

    public record UnitIds(List<Long> unitIds) {
    }
}
