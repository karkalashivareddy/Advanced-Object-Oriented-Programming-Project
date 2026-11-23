package com.lifelink.allocation;

import java.util.List;

public interface AllocationStrategy {
    List<AllocationCandidate> evaluate(AllocationContext context, List<com.lifelink.inventory.BloodUnit> candidates);
}
