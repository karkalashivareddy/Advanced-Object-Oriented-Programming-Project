package com.lifelink.donor;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.lifelink.audit.AuditService;
import com.lifelink.common.BloodGroup;
import com.lifelink.common.exception.UnauthorizedOperationException;
import com.lifelink.common.exception.ValidationException;
import com.lifelink.identity.AuthenticatedUser;
import com.lifelink.identity.Role;
import com.lifelink.identity.TenantAccessService;
import com.lifelink.organization.Organization;
import com.lifelink.organization.OrganizationRepository;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;
import static org.mockito.ArgumentMatchers.argThat;

class DonorDiscoveryServiceTest {
    private final DonorProfileRepository donors = mock(DonorProfileRepository.class);
    private final OrganizationRepository organizations = mock(OrganizationRepository.class);
    private final TenantAccessService access = new TenantAccessService();
    private final AuditService audit = mock(AuditService.class);
    private final DonorSearchRateLimiter limiter = new DonorSearchRateLimiter();
    private final DonorDiscoveryService service = new DonorDiscoveryService(donors, organizations, access, audit, limiter);

    @AfterEach
    void clearRequestAndSecurity() {
        RequestContextHolder.resetRequestAttributes();
        SecurityContextHolder.clearContext();
    }

    @Test
    void requiresExplicitOrganizationEvenForPlatformAdministrator() {
        authenticate(new AuthenticatedUser(1L, "admin@test", "Admin", Set.of(Role.PLATFORM_ADMIN),
                Set.of(), Set.of(), Set.of()));

        assertThrows(UnauthorizedOperationException.class,
                () -> service.search(BloodGroup.O_POSITIVE, 17.385, 78.4867, 10));
        verify(donors, never()).findNearbyOptedIn(any(), any(double.class), any(double.class),
                any(double.class), any(double.class), any(double.class), any(double.class),
                any(double.class), any(), any());
    }

    @Test
    void requiresDiscoveryPermissionForSelectedOrganizationAndBoundsRadius() {
        authenticate(new AuthenticatedUser(2L, "staff@test", "Staff", Set.of(Role.INVENTORY_MANAGER),
                Set.of(), Set.of(20L), Set.of(new AuthenticatedUser.OrganizationRole(20L, "Demo Hospital", Role.INVENTORY_MANAGER))));
        requestWithOrganization(20L);
        Organization organization = mock(Organization.class);
        when(organizations.findById(20L)).thenReturn(Optional.of(organization));
        when(organization.isActive()).thenReturn(true);
        when(organization.isVerified()).thenReturn(true);

        assertThrows(UnauthorizedOperationException.class,
                () -> service.search(BloodGroup.O_POSITIVE, 17.385, 78.4867, 10));
        assertThrows(ValidationException.class,
                () -> service.search(BloodGroup.O_POSITIVE, 17.385, 78.4867, 50.01));
        assertThrows(ValidationException.class,
                () -> service.search(BloodGroup.O_POSITIVE, 91.0, 78.4867, 10));
        verify(donors, never()).findNearbyOptedIn(any(), any(double.class), any(double.class),
                any(double.class), any(double.class), any(double.class), any(double.class),
                any(double.class), any(), any());
    }

    @Test
    void authorizedSearchUsesSelectedScopeAndAuditsOnlyCoarseOrigin() {
        authenticate(new AuthenticatedUser(3L, "hospital@test", "Hospital Staff", Set.of(),
                Set.of(), Set.of(20L), Set.of(new AuthenticatedUser.OrganizationRole(20L, "Demo Hospital", Role.HOSPITAL_ADMIN))));
        requestWithOrganization(20L);
        Organization organization = mock(Organization.class);
        when(organizations.findById(20L)).thenReturn(Optional.of(organization));
        when(organization.isActive()).thenReturn(true);
        when(organization.isVerified()).thenReturn(true);
        when(donors.findNearbyOptedIn(eq("O_POSITIVE"), eq(17.385), eq(78.4867), any(double.class),
                any(double.class), any(double.class), any(double.class), eq(10.0), any(), any()))
                .thenReturn(List.of());

        var result = service.search(BloodGroup.O_POSITIVE, 17.385, 78.4867, 10);

        assertEquals(0, result.returnedCount());
        assertEquals("STRAIGHT_LINE_APPROXIMATE", result.distanceMeaning());
        verify(audit).record(eq("DONOR_PROXIMITY_SEARCH"), eq("DONOR_SEARCH"), eq("DONOR_SEARCH"),
                eq(20L), eq("SUCCESS"), argThat(metadata -> metadata != null
                        && metadata.containsKey("originCell")
                        && !metadata.containsValue("17.385") && !metadata.containsValue("78.4867")));
    }

    private void authenticate(AuthenticatedUser user) {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(user, null, user.getAuthorities()));
    }

    private void requestWithOrganization(Long organizationId) {
        HttpServletRequest request = new MockHttpServletRequest();
        request.setAttribute(TenantAccessService.class.getName() + ".selectedOrganization", null);
        ((MockHttpServletRequest) request).addHeader(TenantAccessService.ORGANIZATION_HEADER, organizationId.toString());
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request));
    }
}
