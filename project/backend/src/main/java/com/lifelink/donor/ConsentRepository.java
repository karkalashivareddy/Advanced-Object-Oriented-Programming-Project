package com.lifelink.donor;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ConsentRepository extends JpaRepository<ConsentRecord, Long> {
    List<ConsentRecord> findByDonorId(Long donorId);
}
