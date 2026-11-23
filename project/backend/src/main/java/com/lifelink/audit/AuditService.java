package com.lifelink.audit;

import com.lifelink.common.CorrelationContext;
import com.lifelink.identity.AuthenticatedUser;
import com.lifelink.identity.TenantAccessService;
import java.time.Instant;
import java.util.Map;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuditService {
    private final AuditEventRepository repository;

    public AuditService(AuditEventRepository repository) {
        this.repository = repository;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void record(String action, String targetType, String targetId, Long organizationId,
                       String outcome, Map<String, String> metadata) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        Long actorId = authentication != null && authentication.getPrincipal() instanceof AuthenticatedUser user
                ? user.userId() : null;
        String safeMetadata = metadata == null || metadata.isEmpty() ? null : sanitize(metadata.toString());
        repository.save(new AuditEvent(actorId, organizationId, action, targetType,
                targetId, CorrelationContext.id(), safeMetadata, outcome));
    }

    @Transactional(readOnly = true)
    public org.springframework.data.domain.Page<AuditEvent> search(Long organizationId, Long actorId,
                                                                   String action, Instant from, Instant to,
                                                                   org.springframework.data.domain.Pageable pageable) {
        return repository.search(organizationId, actorId, action, from, to, pageable);
    }

    private String sanitize(String value) {
        return value.replaceAll("(?i)(password|token|secret)=[^,&\\s]+", "$1=[REDACTED]");
    }
}
