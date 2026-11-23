package com.lifelink.dispatch;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DispatchRepository extends JpaRepository<Dispatch, Long> {
    List<Dispatch> findByRequestId(Long requestId);
    long countByStatus(Dispatch.Status status);
    long countByOrganizationIdAndStatus(Long organizationId, Dispatch.Status status);
}
