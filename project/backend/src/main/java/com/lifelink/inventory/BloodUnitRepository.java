package com.lifelink.inventory;

import com.lifelink.common.BloodGroup;
import com.lifelink.common.ComponentType;
import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface BloodUnitRepository extends JpaRepository<BloodUnit, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select u from BloodUnit u where u.id = :id")
    Optional<BloodUnit> findByIdForUpdate(@Param("id") Long id);

    @Query("""
            select u from BloodUnit u
            where u.organization.id in :organizationIds
              and u.status = com.lifelink.inventory.BloodUnit$Status.AVAILABLE
              and u.released = true
              and u.expiresAt > :now
              and u.activeReservationId is null
              and (:bloodGroup is null or u.bloodGroup = :bloodGroup)
              and (:componentType is null or u.componentType = :componentType)
            order by u.expiresAt asc, u.id asc
            """)
    List<BloodUnit> findAvailableCandidatesForOrganizations(
            @Param("organizationIds") java.util.Collection<Long> organizationIds,
            @Param("bloodGroup") BloodGroup bloodGroup,
            @Param("componentType") ComponentType componentType,
            @Param("now") Instant now);

    @Query("""
            select u from BloodUnit u
            where (:organizationId is null or u.organization.id = :organizationId)
              and u.status = com.lifelink.inventory.BloodUnit$Status.AVAILABLE
              and u.released = true
              and u.expiresAt > :now
              and u.activeReservationId is null
              and (:bloodGroup is null or u.bloodGroup = :bloodGroup)
              and (:componentType is null or u.componentType = :componentType)
            order by u.expiresAt asc, u.id asc
            """)
    List<BloodUnit> findAvailableCandidates(
            @Param("organizationId") Long organizationId,
            @Param("bloodGroup") BloodGroup bloodGroup,
            @Param("componentType") ComponentType componentType,
            @Param("now") Instant now);

    @Query("""
            select u from BloodUnit u
            where (:organizationId is null or u.organization.id = :organizationId)
              and (:bloodGroup is null or u.bloodGroup = :bloodGroup)
              and (:componentType is null or u.componentType = :componentType)
              and (:status is null or u.status = :status)
              and (:expiringWithinDays is null or u.expiresAt < :cutoff)
            """)
    Page<BloodUnit> search(@Param("organizationId") Long organizationId,
                           @Param("bloodGroup") BloodGroup bloodGroup,
                           @Param("componentType") ComponentType componentType,
                           @Param("status") BloodUnit.Status status,
                           @Param("expiringWithinDays") Integer expiringWithinDays,
                           @Param("cutoff") Instant cutoff,
                           Pageable pageable);

    long countByOrganizationIdAndStatus(Long organizationId, BloodUnit.Status status);
    long countByStatus(BloodUnit.Status status);

    java.util.List<BloodUnit> findByDonationId(Long donationId);

    @Query("select u from BloodUnit u where u.expiresAt < :cutoff and u.status in :statuses order by u.expiresAt")
    List<BloodUnit> findExpiring(@Param("cutoff") Instant cutoff,
                                 @Param("statuses") List<BloodUnit.Status> statuses);

    /** Upper-bound-only query is for expiry processing; alerts need an explicit lower bound. */
    @Query("""
            select u from BloodUnit u
            where u.expiresAt >= :from and u.expiresAt < :cutoff and u.status in :statuses
            order by u.expiresAt
            """)
    List<BloodUnit> findExpiringBetween(@Param("from") Instant from, @Param("cutoff") Instant cutoff,
                                        @Param("statuses") List<BloodUnit.Status> statuses);
}
