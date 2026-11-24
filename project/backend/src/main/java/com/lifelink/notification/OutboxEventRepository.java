package com.lifelink.notification;

import java.time.Instant;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface OutboxEventRepository extends JpaRepository<OutboxEvent, Long> {
    /** FAILED is terminal after five attempts; PROCESSING is retried for crash recovery. */
    @Query("""
            select e from OutboxEvent e
            where e.status in (com.lifelink.notification.OutboxEvent$Status.PENDING,
                               com.lifelink.notification.OutboxEvent$Status.PROCESSING)
              and e.nextAttemptAt <= :now
            order by e.nextAttemptAt asc
            """)
    List<OutboxEvent> findDue(@Param("now") Instant now);
}
