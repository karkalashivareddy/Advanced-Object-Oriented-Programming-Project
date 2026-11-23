package com.lifelink.emergency;

import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface EmergencyRequestRepository extends JpaRepository<EmergencyRequest, Long> {
    long countByStatus(EmergencyRequest.Status status);
    long countByRequestingOrganizationIdAndStatus(Long organizationId, EmergencyRequest.Status status);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select e from EmergencyRequest e where e.id = :id")
    Optional<EmergencyRequest> findByIdForUpdate(@Param("id") Long id);
}
