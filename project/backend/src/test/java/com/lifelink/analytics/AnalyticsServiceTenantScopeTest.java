package com.lifelink.analytics;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.lifelink.common.exception.TenantAccessDeniedException;
import com.lifelink.common.exception.UnauthorizedOperationException;
import com.lifelink.dispatch.Dispatch;
import com.lifelink.dispatch.DispatchRepository;
import com.lifelink.emergency.EmergencyRequest;
import com.lifelink.emergency.EmergencyRequestRepository;
import com.lifelink.identity.AuthenticatedUser;
import com.lifelink.identity.Permission;
import com.lifelink.identity.Role;
import com.lifelink.identity.TenantAccessService;
import com.lifelink.inventory.BloodUnit;
import com.lifelink.inventory.BloodUnitRepository;
import com.lifelink.organization.OrganizationRepository;
import com.lifelink.reservation.Reservation;
import com.lifelink.reservation.ReservationRepository;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

/** Regression tests for organization selection in the analytics API. */
class AnalyticsServiceTenantScopeTest {
    private final BloodUnitRepository units = mock(BloodUnitRepository.class);
    private final AnalyticsReadRepository analyticsReadRepository = mock(AnalyticsReadRepository.class);
    private final EmergencyRequestRepository requests = mock(EmergencyRequestRepository.class);
    private final ReservationRepository reservations = mock(ReservationRepository.class);
    private final DispatchRepository dispatches = mock(DispatchRepository.class);
    private final OrganizationRepository organizations = mock(OrganizationRepository.class);
    private final TenantAccessService tenantAccess = new TenantAccessService();
    private AnalyticsService service;

    @BeforeEach
    void setUp() {
        service = new AnalyticsService(units, analyticsReadRepository, requests,
                reservations, dispatches, organizations, tenantAccess);
        when(analyticsReadRepository.countExpiring(any(), any())).thenReturn(0L);
        when(analyticsReadRepository.inventoryByBloodGroup(any())).thenReturn(List.of());
        when(analyticsReadRepository.requestsByStatus(any())).thenReturn(List.of());
    }

    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
        RequestContextHolder.resetRequestAttributes();
    }

    @Test
    void platformAdminWithOrganizationHeaderReceivesScopedOverview() {
        authenticate(true, Set.of());
        requestWithHeader("20");

        service.overview();

        verify(units).countByOrganizationIdAndStatus(20L, BloodUnit.Status.AVAILABLE);
        verify(analyticsReadRepository).countExpiring(org.mockito.ArgumentMatchers.eq(20L), any());
        verify(requests).countByRequestingOrganizationIdAndStatus(
                20L, EmergencyRequest.Status.PENDING_VERIFICATION);
        verify(reservations).countByOrganizationIdAndStatus(20L, Reservation.Status.ACTIVE);
        verify(dispatches).countByOrganizationIdAndStatus(20L, Dispatch.Status.IN_TRANSIT);
        verify(units, never()).countByStatus(any());
    }

    @Test
    void platformAdminWithoutHeaderRetainsGlobalOverview() {
        authenticate(true, Set.of());
        requestWithHeader(null);

        service.overview();

        verify(units).countByStatus(BloodUnit.Status.AVAILABLE);
        verify(requests).countByStatus(EmergencyRequest.Status.PENDING_VERIFICATION);
        verify(reservations).countByStatus(Reservation.Status.ACTIVE);
        verify(dispatches).countByStatus(Dispatch.Status.IN_TRANSIT);
        verify(units, never()).countByOrganizationIdAndStatus(any(), any());
    }

    @Test
    void multipleMembershipsRequireAnExplicitOrganizationSelection() {
        authenticate(false, Set.of(10L, 20L));
        requestWithHeader(null);

        assertThrows(UnauthorizedOperationException.class, () -> service.overview());
        assertThrows(UnauthorizedOperationException.class, () -> service.inventoryByGroup());
        assertThrows(UnauthorizedOperationException.class, () -> service.requestsByStatus());
    }

    @Test
    void selectedMembershipScopesAllAnalyticsCharts() {
        authenticate(false, Set.of(10L, 20L));
        requestWithHeader("20");

        service.inventoryByGroup();
        service.requestsByStatus();

        verify(analyticsReadRepository).inventoryByBloodGroup(20L);
        verify(analyticsReadRepository).requestsByStatus(20L);
        verify(units, never()).findAll();
        verify(requests, never()).findAll();
    }

    @Test
    void headerForAnOrganizationOutsideTheUserMembershipIsRejected() {
        authenticate(false, Set.of(10L));
        requestWithHeader("999");

        assertThrows(TenantAccessDeniedException.class, () -> service.overview());
        assertThrows(TenantAccessDeniedException.class, () -> service.inventoryByGroup());
        assertThrows(TenantAccessDeniedException.class, () -> service.requestsByStatus());
    }

    private void authenticate(boolean platformAdmin, Set<Long> organizationIds) {
        AuthenticatedUser user = new AuthenticatedUser(1L, "analytics@example.test", "Analytics User",
                platformAdmin ? Set.of(Role.PLATFORM_ADMIN) : Set.of(Role.BLOOD_BANK_ADMIN),
                Set.of(Permission.ANALYTICS_READ), organizationIds, Set.of());
        SecurityContextHolder.getContext().setAuthentication(
                new org.springframework.security.authentication.UsernamePasswordAuthenticationToken(
                        user, null, user.getAuthorities()));
    }

    private void requestWithHeader(String organizationId) {
        MockHttpServletRequest request = new MockHttpServletRequest();
        if (organizationId != null) {
            request.addHeader(TenantAccessService.ORGANIZATION_HEADER, organizationId);
        }
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request));
    }
}
