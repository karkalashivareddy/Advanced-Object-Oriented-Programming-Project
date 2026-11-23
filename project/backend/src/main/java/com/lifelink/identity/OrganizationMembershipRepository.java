package com.lifelink.identity;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OrganizationMembershipRepository extends JpaRepository<OrganizationMembership, Long> {
    List<OrganizationMembership> findByUserId(Long userId);
    List<OrganizationMembership> findByOrganizationId(Long organizationId);
    boolean existsByUserIdAndOrganizationId(Long userId, Long organizationId);
}
