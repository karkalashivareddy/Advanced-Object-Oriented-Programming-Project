package com.lifelink.organization;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface OrganizationRepository extends JpaRepository<Organization, Long> {
    Optional<Organization> findByRegistrationCode(String registrationCode);
    List<Organization> findByActiveTrue();

    /** Explicit id order makes non-admin pages stable even when no sort is supplied. */
    @Query("select o from Organization o where o.id in :organizationIds order by o.id asc")
    Page<Organization> findByIdInForPage(@Param("organizationIds") Collection<Long> organizationIds,
                                         Pageable pageable);

    /**
     * Counts organizations whose available stock is below the configured threshold.
     * Organizations with no units are included by the correlated count.
     */
    @Query("""
            select o.id from Organization o
            where o.id in :organizationIds
              and (select count(u) from BloodUnit u
                   where u.organization = o
                     and u.status = com.lifelink.inventory.BloodUnit$Status.AVAILABLE) < :threshold
            """)
    List<Long> findLowStockIds(@Param("organizationIds") Collection<Long> organizationIds,
                               @Param("threshold") int threshold);

    @Query("""
            select o.id from Organization o
            where (select count(u) from BloodUnit u
                   where u.organization = o
                     and u.status = com.lifelink.inventory.BloodUnit$Status.AVAILABLE) < :threshold
            """)
    List<Long> findAllLowStockIds(@Param("threshold") int threshold);
}
