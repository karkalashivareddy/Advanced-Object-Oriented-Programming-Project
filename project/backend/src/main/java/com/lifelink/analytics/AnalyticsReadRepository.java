package com.lifelink.analytics;

import com.lifelink.common.BloodGroup;
import com.lifelink.emergency.EmergencyRequest;
import com.lifelink.inventory.BloodUnit;
import jakarta.persistence.EntityManager;
import java.time.Instant;
import java.util.List;
import org.springframework.stereotype.Repository;

/** Database-side aggregate queries used by analytics; never materializes whole operational tables. */
@Repository
public class AnalyticsReadRepository {
    private static final List<BloodUnit.Status> EXPIRING_STATUSES =
            List.of(BloodUnit.Status.AVAILABLE, BloodUnit.Status.RESERVED);

    private final EntityManager entityManager;

    public AnalyticsReadRepository(EntityManager entityManager) {
        this.entityManager = entityManager;
    }

    public long countExpiring(Long organizationId, Instant cutoff) {
        return entityManager.createQuery("""
                        select count(u) from BloodUnit u
                        where (:organizationId is null or u.organization.id = :organizationId)
                          and u.expiresAt < :cutoff
                          and u.status in :statuses
                        """, Long.class)
                .setParameter("organizationId", organizationId)
                .setParameter("cutoff", cutoff)
                .setParameter("statuses", EXPIRING_STATUSES)
                .getSingleResult();
    }

    public List<Object[]> inventoryByBloodGroup(Long organizationId) {
        return entityManager.createQuery("""
                        select u.bloodGroup, count(u) from BloodUnit u
                        where (:organizationId is null or u.organization.id = :organizationId)
                          and u.status = :status
                        group by u.bloodGroup
                        """, Object[].class)
                .setParameter("organizationId", organizationId)
                .setParameter("status", BloodUnit.Status.AVAILABLE)
                .getResultList();
    }

    public List<Object[]> requestsByStatus(Long organizationId) {
        return entityManager.createQuery("""
                        select r.status, count(r) from EmergencyRequest r
                        where (:organizationId is null or r.requestingOrganization.id = :organizationId)
                        group by r.status
                        """, Object[].class)
                .setParameter("organizationId", organizationId)
                .getResultList();
    }
}
