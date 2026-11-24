package com.lifelink.organization;

import com.lifelink.audit.AuditService;
import com.lifelink.common.exception.BusinessRuleViolationException;
import com.lifelink.common.exception.ResourceNotFoundException;
import com.lifelink.identity.AuthService;
import com.lifelink.identity.OrganizationMembership;
import com.lifelink.identity.OrganizationMembershipRepository;
import com.lifelink.identity.Permission;
import com.lifelink.identity.Role;
import com.lifelink.identity.TenantAccessService;
import com.lifelink.identity.User;
import com.lifelink.identity.UserRepository;
import com.lifelink.organization.dto.OrganizationDtos.CreateRequest;
import com.lifelink.organization.dto.OrganizationDtos.UpdateRequest;
import com.lifelink.organization.dto.OrganizationDtos.View;
import java.util.Map;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class OrganizationService {
    private final OrganizationRepository repository;
    private final OrganizationMembershipRepository membershipRepository;
    private final UserRepository userRepository;
    private final TenantAccessService tenantAccess;
    private final AuditService auditService;
    private final AuthService authService;

    public OrganizationService(OrganizationRepository repository,
                               OrganizationMembershipRepository membershipRepository,
                               UserRepository userRepository,
                               TenantAccessService tenantAccess,
                               AuditService auditService,
                               AuthService authService) {
        this.repository = repository;
        this.membershipRepository = membershipRepository;
        this.userRepository = userRepository;
        this.tenantAccess = tenantAccess;
        this.auditService = auditService;
        this.authService = authService;
    }

    @Transactional(readOnly = true)
    public Page<View> list(Pageable pageable) {
        tenantAccess.requirePermission(Permission.ORGANIZATION_READ);
        if (tenantAccess.currentUser().isPlatformAdmin()) {
            return repository.findAll(pageable).map(View::of);
        }
        var organizationIds = tenantAccess.currentUser().organizationIds();
        if (organizationIds.isEmpty()) {
            return Page.empty(pageable);
        }
        return repository.findByIdInForPage(organizationIds, pageable).map(View::of);
    }

    @Transactional(readOnly = true)
    public View get(Long id) {
        tenantAccess.requirePermission(Permission.ORGANIZATION_READ);
        tenantAccess.requireOrganization(id);
        return View.of(find(id));
    }

    @Transactional
    public View create(CreateRequest request) {
        tenantAccess.requirePermission(Permission.PLATFORM_ADMIN);
        if (repository.findByRegistrationCode(request.registrationCode()).isPresent()) {
            throw new BusinessRuleViolationException("Registration code already exists");
        }
        Organization organization = new Organization(request.name(), request.type(), request.registrationCode(),
                request.city(), request.state(), request.contactEmail(), request.phone(), request.serviceArea());
        repository.save(organization);
        auditService.record("ORGANIZATION_CREATE", "ORGANIZATION", organization.getPublicId(),
                organization.getId(), "SUCCESS", Map.of());
        return View.of(organization);
    }

    @Transactional
    public View update(Long id, UpdateRequest request) {
        tenantAccess.requireOrganizationAndPermission(id, Permission.ORGANIZATION_MANAGE);
        Organization organization = find(id);
        organization.update(request.name(), request.city(), request.state(),
                request.contactEmail(), request.phone(), request.serviceArea());
        auditService.record("ORGANIZATION_UPDATE", "ORGANIZATION", organization.getPublicId(), id, "SUCCESS", Map.of());
        return View.of(organization);
    }

    @Transactional
    public View verify(Long id) {
        tenantAccess.requirePermission(Permission.PLATFORM_ADMIN);
        Organization organization = find(id);
        organization.verify();
        auditService.record("ORGANIZATION_VERIFY", "ORGANIZATION", organization.getPublicId(), id, "SUCCESS", Map.of());
        return View.of(organization);
    }

    @Transactional
    public void addMember(Long organizationId, Long userId, Role role) {
        tenantAccess.requireOrganizationAndPermission(organizationId, Permission.ORGANIZATION_MANAGE);
        Organization organization = find(organizationId);
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", userId));
        if (membershipRepository.existsByUserIdAndOrganizationId(userId, organizationId)) {
            throw new BusinessRuleViolationException("User already belongs to this organization");
        }
        // Roles are organization-scoped. Do not mutate the user's global role set here;
        // permissions are derived per organization from membership roles.
        membershipRepository.save(new OrganizationMembership(user, organization, role));
        auditService.record("MEMBER_ADD", "USER", user.getPublicId(), organizationId, "SUCCESS",
                Map.of("role", role.name()));
    }

    @Transactional(readOnly = true)
    public java.util.List<com.lifelink.identity.dto.AuthDtos.UserView> members(Long organizationId) {
        tenantAccess.requireOrganizationAndPermission(organizationId, Permission.USER_READ);
        return membershipRepository.findByOrganizationId(organizationId).stream()
                .map(membership -> authService.toView(membership.getUser()))
                .toList();
    }

    private Organization find(Long id) {
        return repository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Organization", id));
    }
}
