package com.lifelink.identity;

import com.lifelink.audit.AuditService;
import com.lifelink.common.PageResponse;
import com.lifelink.common.exception.ResourceNotFoundException;
import com.lifelink.common.exception.UnauthorizedOperationException;
import com.lifelink.identity.dto.AuthDtos.UserView;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class UserService {
    private final UserRepository userRepository;
    private final OrganizationMembershipRepository membershipRepository;
    private final TenantAccessService tenantAccess;
    private final AuthService authService;
    private final AuditService auditService;

    public UserService(UserRepository userRepository, TenantAccessService tenantAccess,
                       AuthService authService, AuditService auditService) {
        this(userRepository, null, tenantAccess, authService, auditService);
    }

    @Autowired
    public UserService(UserRepository userRepository,
                       OrganizationMembershipRepository membershipRepository,
                       TenantAccessService tenantAccess,
                       AuthService authService,
                       AuditService auditService) {
        this.userRepository = userRepository;
        this.membershipRepository = membershipRepository;
        this.tenantAccess = tenantAccess;
        this.authService = authService;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public PageResponse<UserView> list(String search, Pageable pageable) {
        AuthenticatedUser actor = tenantAccess.currentUser();
        tenantAccess.requirePermission(Permission.USER_READ);
        if (actor.isPlatformAdmin()) {
            Page<User> page = search == null || search.isBlank()
                    ? userRepository.findAll(pageable)
                    : userRepository.findByEmailContainingIgnoreCaseOrFullNameContainingIgnoreCase(search, search, pageable);
            return PageResponse.from(page, authService::toView);
        }

        Set<Long> manageableOrganizations = manageableOrganizationIds(actor);
        if (manageableOrganizations.isEmpty()) {
            return new PageResponse<>(List.of(), pageable.getPageNumber(), pageable.getPageSize(), 0, 0);
        }
        Set<Long> visibleUserIds = manageableOrganizations.stream()
                .flatMap(organizationId -> membershipRepository.findByOrganizationId(organizationId).stream())
                .map(membership -> membership.getUser().getId())
                .collect(Collectors.toSet());
        List<User> candidates = search == null || search.isBlank()
                ? userRepository.findAll(Pageable.unpaged()).getContent()
                : userRepository.findByEmailContainingIgnoreCaseOrFullNameContainingIgnoreCase(
                        search, search, Pageable.unpaged()).getContent();
        List<User> visible = candidates.stream()
                .filter(user -> visibleUserIds.contains(user.getId()))
                .toList();
        int from = (int) Math.min(pageable.getOffset(), visible.size());
        int to = Math.min(from + pageable.getPageSize(), visible.size());
        Page<User> page = new PageImpl<>(visible.subList(from, to), pageable, visible.size());
        return PageResponse.from(page, authService::toView);
    }

    @Transactional
    public UserView changeStatus(Long id, User.Status status) {
        AuthenticatedUser actor = tenantAccess.currentUser();
        if (actor.isPlatformAdmin()) {
            tenantAccess.requirePermission(Permission.USER_MANAGE);
        } else {
            tenantAccess.requirePermission(Permission.USER_READ);
        }
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User", id));

        if (!actor.isPlatformAdmin()) {
            List<OrganizationMembership> memberships = membershipRepository.findByUserId(user.getId());
            Set<Long> manageableOrganizations = manageableOrganizationIds(actor);
            boolean inManageableOrganization = memberships.stream()
                    .anyMatch(membership -> manageableOrganizations.contains(membership.getOrganization().getId()));
            if (!inManageableOrganization) {
                throw new UnauthorizedOperationException("User is outside your manageable organizations");
            }
            if (memberships.isEmpty() || user.getRoles().contains(Role.PLATFORM_ADMIN)) {
                throw new UnauthorizedOperationException("Global accounts cannot be managed by organization administrators");
            }
        }

        switch (status) {
            case ACTIVE -> user.activate();
            case LOCKED -> user.lock();
            case DISABLED -> user.disable();
            case PENDING_VERIFICATION -> user.markPendingVerification();
        }
        if (status != User.Status.ACTIVE) {
            authService.revokeAllForUser(user);
        }
        auditService.record("USER_STATUS", "USER", user.getPublicId(), null, "SUCCESS",
                Map.of("status", status.name()));
        return authService.toView(user);
    }

    private Set<Long> manageableOrganizationIds(AuthenticatedUser actor) {
        return actor.organizationIds().stream()
                .filter(organizationId -> hasUserManageAtOrganization(actor, organizationId))
                .collect(Collectors.toSet());
    }

    /**
     * USER_MANAGE is currently only granted to platform-wide roles. An explicit
     * BLOOD_BANK_ADMIN membership is the organization-scoped equivalent used here.
     */
    private boolean hasUserManageAtOrganization(AuthenticatedUser actor, Long organizationId) {
        return actor.isPlatformAdmin()
                || actor.hasPermissionForOrganization(Permission.USER_MANAGE, organizationId)
                || actor.hasOrganizationRole(organizationId, Role.BLOOD_BANK_ADMIN);
    }
}
