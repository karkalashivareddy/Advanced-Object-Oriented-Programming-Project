package com.lifelink.donor;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.lifelink.audit.AuditService;
import com.lifelink.common.BloodGroup;
import com.lifelink.identity.AuthenticatedUser;
import com.lifelink.identity.Permission;
import com.lifelink.identity.Role;
import com.lifelink.identity.TenantAccessService;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

class DonorDirectoryServiceTest {
    private final DonorProfileRepository donors = mock(DonorProfileRepository.class);
    private final ConsentRepository consents = mock(ConsentRepository.class);
    private final AppointmentRepository appointments = mock(AppointmentRepository.class);
    private final DonationRepository donations = mock(DonationRepository.class);
    private final com.lifelink.identity.UserRepository users = mock(com.lifelink.identity.UserRepository.class);
    private final com.lifelink.organization.OrganizationRepository organizations =
            mock(com.lifelink.organization.OrganizationRepository.class);
    private final com.lifelink.identity.OrganizationMembershipRepository memberships =
            mock(com.lifelink.identity.OrganizationMembershipRepository.class);
    private final TenantAccessService tenantAccess = new TenantAccessService();
    private final DonorService service = new DonorService(donors, consents, appointments, donations,
            users, organizations, memberships, tenantAccess, mock(AuditService.class));

    @AfterEach
    void clearSecurity() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void donorSearchIsPagedFilteredAndRestrictedToOrganizationsWithPermission() {
        var actor = new AuthenticatedUser(7L, "staff@example.invalid", "Staff", Set.of(),
                Set.of(Permission.DONOR_READ), Set.of(10L, 20L), Set.of(
                new AuthenticatedUser.OrganizationRole(10L, "Allowed", Role.BLOOD_BANK_ADMIN),
                new AuthenticatedUser.OrganizationRole(20L, "No donor permission", Role.INVENTORY_MANAGER)));
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(actor, null, actor.getAuthorities()));
        var pageable = PageRequest.of(2, 25, Sort.by(Sort.Direction.ASC, "id"));
        when(donors.findVisibleToUser(anyLong(), anyCollection(), any(), any(), any(), any(), any(), any()))
                .thenReturn(new PageImpl<>(List.of(), pageable, 0));

        var response = service.list(" donor- ", BloodGroup.O_POSITIVE, DonorProfile.Availability.AVAILABLE,
                " Hyderabad ", " Telangana ", pageable);

        assertEquals(2, response.page());
        assertEquals(25, response.size());
        verify(donors).findVisibleToUser(7L, Set.of(10L, 20L), BloodGroup.O_POSITIVE,
                DonorProfile.Availability.AVAILABLE,
                "Hyderabad", "Telangana", "donor-", pageable);
    }

    @Test
    void donorSelfCanReadOwnPageWithoutLeakingAcrossOrganizations() {
        var actor = new AuthenticatedUser(9L, "donor@example.invalid", "Donor", Set.of(),
                Set.of(Permission.DONOR_READ), Set.of(), Set.of());
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(actor, null, actor.getAuthorities()));
        var pageable = PageRequest.of(0, 20, Sort.by(Sort.Direction.ASC, "id"));
        when(donors.searchOwned(anyLong(), any(), any(), any(), any(), any(), any()))
                .thenReturn(new PageImpl<>(List.of(), pageable, 0));

        service.list(null, null, null, null, null, pageable);

        verify(donors).searchOwned(9L, null, null, null, null, null, pageable);
    }
}
