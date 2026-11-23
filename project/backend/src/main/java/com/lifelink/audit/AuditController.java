package com.lifelink.audit;

import com.lifelink.common.ApiResponse;
import com.lifelink.common.PageResponse;
import com.lifelink.identity.Permission;
import com.lifelink.identity.TenantAccessService;
import java.time.Instant;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/audit-logs")
public class AuditController {
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
        Long org = user.isPlatformAdmin() ? organizationId : user.organizationIds().iterator().next();
        if (org != null) {
            tenantAccess.requireOrganization(org);
        }
        Instant fromInstant = Optional.ofNullable(from).map(Instant::parse).orElse(null);
        Instant toInstant = Optional.ofNullable(to).map(Instant::parse).orElse(null);
        Page<AuditEvent> page = service.search(org, actorId, action, fromInstant, toInstant, pageable);
        return ApiResponse.ok(PageResponse.from(page, event -> event));
    }
}
