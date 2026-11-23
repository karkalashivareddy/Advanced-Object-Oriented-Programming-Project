package com.lifelink.identity;

import com.lifelink.common.exception.TenantAccessDeniedException;
import com.lifelink.common.exception.UnauthorizedOperationException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

@Service
public class TenantAccessService {

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

    public Long requireActiveOrganization(Long requestedOrganizationId) {
        AuthenticatedUser user = currentUser();
        Long organizationId = requestedOrganizationId;
        if (organizationId == null) {
            if (user.organizationIds().size() != 1) {
                throw new UnauthorizedOperationException("An organization must be selected");
            }
            organizationId = user.organizationIds().iterator().next();
        }
        requireOrganization(organizationId);
        return organizationId;
    }
}
