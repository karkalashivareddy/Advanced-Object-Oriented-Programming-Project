package com.lifelink.allocation;

import com.lifelink.common.BloodGroup;

@FunctionalInterface
public interface CompatibilitySpecification {
    boolean isSatisfiedBy(BloodGroup requested, BloodGroup candidate);

    default String name() {
        return getClass().getSimpleName();
    }
}
