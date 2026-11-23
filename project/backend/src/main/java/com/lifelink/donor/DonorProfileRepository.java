package com.lifelink.donor;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DonorProfileRepository extends JpaRepository<DonorProfile, Long> {
    Optional<DonorProfile> findByUserId(Long userId);
}
