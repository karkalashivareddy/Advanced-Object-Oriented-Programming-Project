package com.lifelink.organization;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OrganizationRepository extends JpaRepository<Organization, Long> {
    Optional<Organization> findByRegistrationCode(String registrationCode);
    List<Organization> findByActiveTrue();
}
