package com.lifelink.allocation;

import com.lifelink.inventory.BloodUnit;
import com.lifelink.inventory.dto.InventoryDtos.View;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import org.springframework.stereotype.Component;

/** First-Expiry-First-Out advisory ordering with explicit rejection reasons. */
@Component
public class FeefoStrategy implements AllocationStrategy {
    private final CompatibilitySpecification specification;

    public FeefoStrategy(CompatibilitySpecification specification) {
        this.specification = specification;
    }

    @Override
    public List<AllocationCandidate> evaluate(AllocationContext context, List<BloodUnit> candidates) {
        Instant now = Instant.now();
        List<Scored> scored = candidates.stream()
                .map(unit -> new Scored(unit, reasons(context, unit, now)))
                .sorted(Comparator
                        .comparingInt((Scored scored1) -> scored1.reasons().size())
                        .thenComparing(scored1 -> scored1.unit().getExpiresAt())
                        .thenComparing(scored1 -> scored1.unit().getId(),
                                Comparator.nullsLast(Comparator.naturalOrder())))
                .toList();
        List<AllocationCandidate> result = new ArrayList<>();
        int rank = 1;
        for (Scored item : scored) {
            result.add(new AllocationCandidate(View.of(item.unit()), item.reasons().isEmpty(),
                    List.copyOf(item.reasons()), rank++));
        }
        return result;
    }

    private List<String> reasons(AllocationContext context, BloodUnit unit, Instant now) {
        List<String> reasons = new ArrayList<>();
        if (!specification.isSatisfiedBy(context.bloodGroup(), unit.getBloodGroup())) {
            reasons.add("Configured compatibility rule does not match requested group");
        }
        if (unit.getComponentType() != context.componentType()) {
            reasons.add("Component type mismatch");
        }
        if (!unit.isReleased()) {
            reasons.add("Unit has not been released by authorized staff");
        }
        if (unit.getStatus() != BloodUnit.Status.AVAILABLE) {
            reasons.add("Unit is not in AVAILABLE state");
        }
        if (unit.isExpired(now)) {
            reasons.add("Unit is expired");
        }
        if (unit.getActiveReservationId() != null) {
            reasons.add("Unit already has an active reservation");
        }
        return reasons;
    }

    private record Scored(BloodUnit unit, List<String> reasons) {
    }
}
