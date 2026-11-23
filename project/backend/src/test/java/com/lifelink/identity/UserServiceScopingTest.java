package com.lifelink.identity;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.lifelink.audit.AuditService;
import com.lifelink.common.BaseEntity;
import com.lifelink.common.PageResponse;
import com.lifelink.common.exception.UnauthorizedOperationException;
import com.lifelink.identity.dto.AuthDtos.UserView;
import com.lifelink.organization.Organization;
import java.lang.reflect.Field;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

class UserServiceScopingTest {
    private final UserRepository userRepository = mock(UserRepository.class);
    private final OrganizationMembershipRepository membershipRepository = mock(OrganizationMembershipRepository.class);
    private final TenantAccessService tenantAccess = mock(TenantAccessService.class);
    private final AuthService authService = mock(AuthService.class);
    private final AuditService auditService = mock(AuditService.class);
    private final UserService service = new UserService(
            userRepository, membershipRepository, tenantAccess, authService, auditService);

    @BeforeEach
    void setUp() {
        when(authService.toView(any(User.class))).thenReturn(mock(UserView.class));
    }

    @Test
    void organizationAdminOnlyListsUsersFromOrganizationsWithUserManage() throws Exception {
        AuthenticatedUser actor = new AuthenticatedUser(1L, "admin@example.test", "Org Admin",
                Set.of(Role.BLOOD_BANK_ADMIN), Set.of(Permission.USER_READ),
                Set.of(10L, 20L), Set.of(orgRole(10L), orgRole(20L)));
        when(tenantAccess.currentUser()).thenReturn(actor);
        User inScope = user(2L, Role.DONOR);
        User outOfScope = user(3L, Role.DONOR);
        OrganizationMembership inScopeMembership = membership(inScope, 10L, Role.MEDICAL_STAFF);
        when(userRepository.findAll(any(Pageable.class))).thenReturn(new PageImpl<>(List.of(inScope, outOfScope)));
        when(membershipRepository.findByOrganizationId(10L)).thenReturn(List.of(inScopeMembership));
        when(authService.toView(inScope)).thenReturn(mock(UserView.class));

        PageResponse<UserView> result = service.list(null, PageRequest.of(0, 20));

        assertEquals(1, result.content().size());
        assertEquals(1, result.totalElements());
        verify(tenantAccess).requirePermission(Permission.USER_READ);
    }

    @Test
    void organizationAdminCannotModifyPlatformAdminOrGlobalAccounts() throws Exception {
        AuthenticatedUser actor = new AuthenticatedUser(1L, "admin@example.test", "Org Admin",
                Set.of(Role.BLOOD_BANK_ADMIN), Set.of(Permission.USER_READ),
                Set.of(10L), Set.of(orgRole(10L)));
        when(tenantAccess.currentUser()).thenReturn(actor);

        User platformAdmin = user(2L, Role.PLATFORM_ADMIN);
        OrganizationMembership platformAdminMembership = membership(platformAdmin, 10L, Role.BLOOD_BANK_ADMIN);
        when(userRepository.findById(2L)).thenReturn(Optional.of(platformAdmin));
        when(membershipRepository.findByUserId(2L)).thenReturn(List.of(platformAdminMembership));
        assertThrows(UnauthorizedOperationException.class,
                () -> service.changeStatus(2L, User.Status.DISABLED));

        User globalAccount = user(4L, Role.DONOR);
        when(userRepository.findById(4L)).thenReturn(Optional.of(globalAccount));
        when(membershipRepository.findByUserId(4L)).thenReturn(List.of());
        assertThrows(UnauthorizedOperationException.class,
                () -> service.changeStatus(4L, User.Status.DISABLED));

        verify(authService, never()).revokeAllForUser(any(User.class));
    }

    @Test
    void organizationAdminCanChangeStatusOfUserInManageableOrganization() throws Exception {
        AuthenticatedUser actor = new AuthenticatedUser(1L, "admin@example.test", "Org Admin",
                Set.of(Role.BLOOD_BANK_ADMIN), Set.of(Permission.USER_READ),
                Set.of(10L), Set.of(orgRole(10L)));
        when(tenantAccess.currentUser()).thenReturn(actor);

        User member = user(5L, Role.MEDICAL_STAFF);
        OrganizationMembership memberMembership = membership(member, 10L, Role.MEDICAL_STAFF);
        when(userRepository.findById(5L)).thenReturn(Optional.of(member));
        when(membershipRepository.findByUserId(5L)).thenReturn(List.of(memberMembership));

        service.changeStatus(5L, User.Status.DISABLED);

        verify(authService).revokeAllForUser(member);
    }

    @Test
    void statusTransitionsAdvancePersistentTokenVersionIncludingReactivation() throws Exception {
        AuthenticatedUser actor = new AuthenticatedUser(1L, "platform@example.test", "Platform Admin",
                Set.of(Role.PLATFORM_ADMIN), Set.of(Permission.USER_READ, Permission.USER_MANAGE),
                Set.of(), Set.of());
        when(tenantAccess.currentUser()).thenReturn(actor);
        User member = user(6L, Role.DONOR);
        when(userRepository.findById(6L)).thenReturn(Optional.of(member));

        long initialVersion = member.getTokenVersion();
        service.changeStatus(6L, User.Status.DISABLED);
        service.changeStatus(6L, User.Status.ACTIVE);

        assertEquals(initialVersion + 2, member.getTokenVersion());
        // Refresh sessions were revoked on disable; reactivation must not resurrect them.
        verify(authService, times(1)).revokeAllForUser(member);
    }

    @Test
    void platformAdminKeepsUnscopedListing() throws Exception {
        AuthenticatedUser actor = new AuthenticatedUser(1L, "platform@example.test", "Platform Admin",
                Set.of(Role.PLATFORM_ADMIN), Set.of(Permission.USER_READ), Set.of(), Set.of());
        when(tenantAccess.currentUser()).thenReturn(actor);
        when(userRepository.findAll(any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(user(2L, Role.DONOR), user(3L, Role.DONOR))));

        PageResponse<UserView> result = service.list(null, PageRequest.of(0, 20));

        assertEquals(2, result.content().size());
        verify(tenantAccess).requirePermission(Permission.USER_READ);
    }

    private User user(long id, Role role) throws Exception {
        User user = new User("member" + id + "@example.test", "stored-hash", "Test Member", null,
                User.Status.ACTIVE, Set.of(role));
        Field field = BaseEntity.class.getDeclaredField("id");
        field.setAccessible(true);
        field.set(user, id);
        return user;
    }

    private AuthenticatedUser.OrganizationRole orgRole(long organizationId) {
        return new AuthenticatedUser.OrganizationRole(organizationId, "Org " + organizationId,
                Role.BLOOD_BANK_ADMIN);
    }

    private OrganizationMembership membership(User user, long organizationId, Role role) {
        Organization organization = mock(Organization.class);
        when(organization.getId()).thenReturn(organizationId);
        return new OrganizationMembership(user, organization, role);
    }
}
