package com.lifelink.identity;

import com.lifelink.common.exception.ErrorCode;
import com.lifelink.common.exception.LifeLinkException;
import com.lifelink.common.exception.TenantAccessDeniedException;
import com.lifelink.common.exception.UnauthorizedOperationException;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Map;
import java.util.Objects;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

@Service
public class TenantAccessService {

    public static final String ORGANIZATION_HEADER = "X-Organization-Id";
    private static final String ORGANIZATION_CACHE =
            TenantAccessService.class.getName() + ".selectedOrganization";

    public AuthenticatedUser currentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof AuthenticatedUser user)) {
            throw new UnauthorizedOperationException("Authentication is required");
        }
        return user;
    }

    public void requirePermission(Permission permission) {
        if (!currentUser().hasPermission(permission)) {
            throw new UnauthorizedOperationException("Missing permission: " + permission);
        }
    }

    public void requireOrganization(Long organizationId) {
        AuthenticatedUser user = currentUser();
        if (!user.belongsTo(organizationId)) {
            throw new TenantAccessDeniedException(organizationId);
        }
    }

    public void requireOrganizationAndPermission(Long organizationId, Permission permission) {
        AuthenticatedUser user = currentUser();
        if (!user.belongsTo(organizationId)) {
            throw new TenantAccessDeniedException(organizationId);
        }
        if (!user.hasPermissionForOrganization(permission, organizationId)) {
            throw new UnauthorizedOperationException("Missing permission: " + permission);
        }
    }

    /** Coarse global check for platform-level actions that are not organization scoped. */
    public void requirePermissionForOrganization(Long organizationId, Permission permission) {
        requireOrganizationAndPermission(organizationId, permission);
    }

    /**
     * Returns the request-selected organization. The X-Organization-Id header is only a selection:
     * it is validated against the authenticated user's memberships (or platform-admin status) and
     * cached in the request attributes. It never replaces the organization checks below.
     */
    public Long currentOrganizationId() {
        AuthenticatedUser user = currentUser();
        HttpServletRequest request = currentRequest();
        if (request == null) {
            return defaultOrganizationId(user);
        }
        Object cached = request.getAttribute(ORGANIZATION_CACHE);
        if (cached instanceof CachedOrganization entry
                && Objects.equals(entry.userId(), user.userId())) {
            return entry.organizationId();
        }
        String raw = request.getHeader(ORGANIZATION_HEADER);
        Long organizationId;
        if (raw == null || raw.isBlank()) {
            organizationId = defaultOrganizationId(user);
        } else {
            Long parsed = parseOrganizationId(raw);
            if (!user.belongsTo(parsed)) {
                throw new TenantAccessDeniedException(parsed);
            }
            organizationId = parsed;
        }
        request.setAttribute(ORGANIZATION_CACHE, new CachedOrganization(user.userId(), organizationId));
        return organizationId;
    }

    /** Requires an explicit selection (header or a single membership). */
    public Long requireCurrentOrganization() {
        Long organizationId = currentOrganizationId();
        if (organizationId == null) {
            throw new UnauthorizedOperationException("An organization must be selected");
        }
        return organizationId;
    }

    /**
     * Stricter selection for privacy-sensitive reads: the header must be present even for
     * platform administrators and single-membership users. The value is still validated
     * by {@link #currentOrganizationId()} (membership/platform-admin check and numeric
     * format) before it is returned.
     */
    public Long requireExplicitCurrentOrganization() {
        HttpServletRequest request = currentRequest();
        String header = request == null ? null : request.getHeader(ORGANIZATION_HEADER);
        if (header == null || header.isBlank()) {
            throw new UnauthorizedOperationException("X-Organization-Id header is required");
        }
        return requireCurrentOrganization();
    }

    public Long requireActiveOrganization(Long requestedOrganizationId) {
        AuthenticatedUser user = currentUser();
        Long organizationId = requestedOrganizationId != null ? requestedOrganizationId : currentOrganizationId();
        if (organizationId == null) {
            throw new UnauthorizedOperationException("An organization must be selected");
        }
        requireOrganization(organizationId);
        return organizationId;
    }

    private Long defaultOrganizationId(AuthenticatedUser user) {
        if (user.isPlatformAdmin() || user.organizationIds().size() != 1) {
            return null;
        }
        return user.organizationIds().iterator().next();
    }

    private Long parseOrganizationId(String raw) {
        try {
            long value = Long.parseLong(raw.trim());
            if (value <= 0) {
                throw new InvalidOrganizationHeaderException();
            }
            return value;
        } catch (NumberFormatException ex) {
            throw new InvalidOrganizationHeaderException();
        }
    }

    private HttpServletRequest currentRequest() {
        var attributes = RequestContextHolder.getRequestAttributes();
        return attributes instanceof ServletRequestAttributes servletAttributes
                ? servletAttributes.getRequest() : null;
    }

    private record CachedOrganization(Long userId, Long organizationId) {
    }

    private static final class InvalidOrganizationHeaderException extends LifeLinkException {
        InvalidOrganizationHeaderException() {
            super(ErrorCode.VALIDATION_ERROR, "X-Organization-Id must be a positive numeric identifier",
                    Map.of(ORGANIZATION_HEADER, "must be a positive numeric identifier"));
        }
    }
}
