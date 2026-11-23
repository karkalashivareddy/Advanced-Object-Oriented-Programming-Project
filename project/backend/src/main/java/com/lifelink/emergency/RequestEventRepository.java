package com.lifelink.emergency;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RequestEventRepository extends JpaRepository<RequestEvent, Long> {
    List<RequestEvent> findByRequestIdOrderByOccurredAtDesc(Long requestId);
}
