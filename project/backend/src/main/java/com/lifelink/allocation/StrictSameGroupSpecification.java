package com.lifelink.allocation;

import com.lifelink.common.BloodGroup;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/** Conservative default rule: only an identical ABO/Rh group is suggested. */
@Component
@ConditionalOnProperty(name = "lifelink.allocation.compatibility-mode",
        havingValue = "STRICT_SAME_GROUP", matchIfMissing = true)
public class StrictSameGroupSpecification implements CompatibilitySpecification {
    @Override
    public boolean isSatisfiedBy(BloodGroup requested, BloodGroup candidate) {
        return requested == candidate;
    }
}
