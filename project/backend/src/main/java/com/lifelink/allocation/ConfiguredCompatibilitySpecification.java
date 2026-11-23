package com.lifelink.allocation;

import com.lifelink.common.BloodGroup;
import java.util.EnumMap;
import java.util.EnumSet;
import java.util.Map;
import java.util.Set;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Optional rule set for deployments whose qualified medical reviewers approve a
 * documented compatibility matrix. It is advisory software, never clinical authorization.
 */
@Component
@ConditionalOnProperty(name = "lifelink.allocation.compatibility-mode", havingValue = "CONFIGURED")
@ConfigurationProperties(prefix = "lifelink.allocation")
public class ConfiguredCompatibilitySpecification implements CompatibilitySpecification {
    private Map<BloodGroup, Set<BloodGroup>> allowedGroups = new EnumMap<>(BloodGroup.class);

    public void setAllowedGroups(Map<BloodGroup, Set<BloodGroup>> allowedGroups) {
        EnumMap<BloodGroup, Set<BloodGroup>> copy = new EnumMap<>(BloodGroup.class);
        allowedGroups.forEach((key, value) -> copy.put(key, EnumSet.copyOf(value)));
        this.allowedGroups = copy;
    }

    @Override
    public boolean isSatisfiedBy(BloodGroup requested, BloodGroup candidate) {
        return allowedGroups.getOrDefault(requested, Set.of()).contains(candidate);
    }

    @Override
    public String name() {
        return "ConfiguredCompatibilitySpecification";
    }
}
