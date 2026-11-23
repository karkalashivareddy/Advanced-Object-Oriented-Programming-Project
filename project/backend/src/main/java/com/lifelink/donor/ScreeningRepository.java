package com.lifelink.donor;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ScreeningRepository extends JpaRepository<ScreeningRecord, Long> {
    List<ScreeningRecord> findByDonationId(Long donationId);
    List<ScreeningRecord> findByDonationIdOrderByCreatedAtDesc(Long donationId);
}
