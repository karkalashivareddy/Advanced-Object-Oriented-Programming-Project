package com.lifelink.allocation;

import com.lifelink.common.BloodGroup;
import org.springframework.stereotype.Component;

/** Conservative default rule: only an identical ABO/Rh group is suggested. */
@Component
public class StrictSameGroupSpecification implements CompatibilitySpecification {
    @Override
    public boolean isSatisfiedBy(BloodGroup requested, BloodGroup candidate) {
        return requested == candidate;
    }
}
