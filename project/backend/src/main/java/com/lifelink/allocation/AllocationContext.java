package com.lifelink.allocation;

import com.lifelink.common.BloodGroup;
import com.lifelink.common.ComponentType;
import java.time.Instant;

public record AllocationContext(BloodGroup bloodGroup, ComponentType componentType,
                                int quantity, Instant requiredBy) {
}
