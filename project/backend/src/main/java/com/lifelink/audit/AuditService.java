package com.lifelink.audit;

import com.lifelink.common.CorrelationContext;
import com.lifelink.identity.AuthenticatedUser;
import com.lifelink.identity.TenantAccessService;
import jakarta.persistence.criteria.Predicate;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuditService {
    private final AuditEventRepository repository;

    public AuditService(AuditEventRepository repository) {
        this.repository = repository;
    }

    /**
     * Participates in the caller's transaction. A SUCCESS audit row for a business
     * event must not outlive a rollback of that event; REQUIRES_NEW previously
     * committed the audit independently and could leave a false success trail.
     * An after-commit hook was rejected: it adds async delivery/ordering concerns
     * without improving the consistency of SUCCESS records. If no caller
     * transaction exists, Spring still starts one for this method.
     */
    @Transactional
    public void record(String action, String targetType, String targetId, Long organizationId,
                       String outcome, Map<String, String> metadata) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        Long actorId = authentication != null && authentication.getPrincipal() instanceof AuthenticatedUser user
                ? user.userId() : null;
        String safeMetadata = metadata == null || metadata.isEmpty() ? null : sanitize(metadata.toString());
        repository.save(new AuditEvent(actorId, organizationId, action, targetType,
                targetId, CorrelationContext.id(), safeMetadata, outcome));
    }

    /**
     * Builds predicates only for supplied filters. PostgreSQL cannot infer the type
     * of a null parameter in a JPQL `(:param is null or ...)` expression, so the
     * previous static query failed with SQLState 42804 whenever from/to were absent.
     */
    @Transactional(readOnly = true)
    public Page<AuditEvent> search(Long organizationId, Long actorId,
                                   String action, Instant from, Instant to,
                                   Pageable pageable) {
        Specification<AuditEvent> specification = (root, query, builder) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (organizationId != null) {
                predicates.add(builder.equal(root.get("organizationId"), organizationId));
            }
            if (actorId != null) {
                predicates.add(builder.equal(root.get("actorId"), actorId));
            }
            if (action != null && !action.isBlank()) {
                predicates.add(builder.like(
                        builder.lower(root.get("action")),
                        "%" + action.toLowerCase(Locale.ROOT) + "%"));
            }
            if (from != null) {
                predicates.add(builder.greaterThanOrEqualTo(root.get("occurredAt"), from));
            }
            if (to != null) {
                predicates.add(builder.lessThanOrEqualTo(root.get("occurredAt"), to));
            }
            return builder.and(predicates.toArray(Predicate[]::new));
        };
        return repository.findAll(specification, pageable);
    }

    private String sanitize(String value) {
        return value.replaceAll("(?i)(password|token|secret)=[^,&\\s]+", "$1=[REDACTED]");
    }
}
