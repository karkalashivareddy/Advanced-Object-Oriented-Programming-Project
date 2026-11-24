package com.lifelink.emergency;

import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
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

    @Query("select e.id from EmergencyRequest e where e.requiredBy <= :now and e.status in :statuses")
    List<Long> findExpirableIds(@Param("now") Instant now,
                                @Param("statuses") Collection<EmergencyRequest.Status> statuses);
}
