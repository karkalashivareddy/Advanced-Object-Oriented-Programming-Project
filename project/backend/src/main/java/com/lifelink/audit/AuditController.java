package com.lifelink.audit;

import com.lifelink.common.ApiResponse;
import com.lifelink.common.PageResponse;
import com.lifelink.common.exception.BusinessRuleViolationException;
import com.lifelink.identity.Permission;
import com.lifelink.identity.TenantAccessService;
import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/audit-logs")
public class AuditController {
    private static final int MAX_PAGE_SIZE = 200;

    private final AuditService service;
    private final TenantAccessService tenantAccess;

    public AuditController(AuditService service, TenantAccessService tenantAccess) {
        this.service = service;
        this.tenantAccess = tenantAccess;
    }

    @GetMapping
    public ApiResponse<PageResponse<AuditEvent>> list(
            @RequestParam(required = false) Long organizationId,
            @RequestParam(required = false) Long actorId,
            @RequestParam(required = false) String action,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            Pageable pageable) {
        tenantAccess.requirePermission(Permission.AUDIT_READ);
        var user = tenantAccess.currentUser();
        Long org;
        if (user.isPlatformAdmin()) {
            org = organizationId;
        } else {
            if (organizationId == null && user.organizationIds().size() != 1) {
                throw new BusinessRuleViolationException(
                        "organizationId is required for users with multiple organization memberships");
            }
            org = organizationId == null ? user.organizationIds().iterator().next() : organizationId;
            // A membership in another organization must not grant audit access here.
            tenantAccess.requireOrganizationAndPermission(org, Permission.AUDIT_READ);
        }
        Instant fromInstant = parseInstant(from, "from");
        Instant toInstant = parseInstant(to, "to");
        Pageable bounded = PageRequest.of(pageable.getPageNumber(),
                Math.min(pageable.getPageSize(), MAX_PAGE_SIZE), pageable.getSort());
        Page<AuditEvent> page = service.search(org, actorId, action, fromInstant, toInstant, bounded);
        return ApiResponse.ok(PageResponse.from(page, event -> event));
    }

    private Instant parseInstant(String value, String field) {
        try {
            return Optional.ofNullable(value).map(Instant::parse).orElse(null);
        } catch (DateTimeParseException ex) {
            throw new BusinessRuleViolationException(field + " must be an ISO-8601 instant");
        }
    }
}
