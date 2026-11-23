package com.lifelink.donor;

import org.springframework.data.jpa.repository.JpaRepository;

public interface DonationRepository extends JpaRepository<Donation, Long> {
    java.util.List<Donation> findByOrganizationIdOrderByDonatedAtDesc(Long organizationId);
    java.util.List<Donation> findByDonorIdOrderByDonatedAtDesc(Long donorId);
    boolean existsByDonorIdAndOrganizationId(Long donorId, Long organizationId);
}
