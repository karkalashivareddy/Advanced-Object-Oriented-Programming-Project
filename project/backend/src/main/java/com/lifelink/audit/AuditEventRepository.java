package com.lifelink.audit;

import java.time.Instant;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AuditEventRepository extends JpaRepository<AuditEvent, Long> {
    @Query("""
            select a from AuditEvent a
            where (:organizationId is null or a.organizationId = :organizationId)
              and (:actorId is null or a.actorId = :actorId)
              and (:action is null or a.action like %:action%)
              and (:from is null or a.occurredAt >= :from)
              and (:to is null or a.occurredAt <= :to)
            """)
    Page<AuditEvent> search(@Param("organizationId") Long organizationId,
                            @Param("actorId") Long actorId,
                            @Param("action") String action,
                            @Param("from") Instant from,
                            @Param("to") Instant to,
                            Pageable pageable);
}
