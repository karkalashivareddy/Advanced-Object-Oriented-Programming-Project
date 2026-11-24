package com.lifelink.emergency;

import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.lifelink.audit.AuditService;
import com.lifelink.common.BloodGroup;
import com.lifelink.common.ComponentType;
import com.lifelink.emergency.EmergencyRequest.Priority;
import com.lifelink.emergency.dto.RequestDtos.ReasonRequest;
import com.lifelink.identity.AuthenticatedUser;
import com.lifelink.identity.Role;
import com.lifelink.identity.TenantAccessService;
import com.lifelink.notification.NotificationService;
import com.lifelink.organization.Organization;
import com.lifelink.organization.OrganizationRepository;
import com.lifelink.reservation.ReservationService;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.InOrder;
import org.springframework.test.util.ReflectionTestUtils;

/** Guards the request -> unit lock order when cancellation releases reservations. */
class EmergencyCancelLockOrderTest {

    @Test
    void cancelLocksRequestBeforeReleasingReservations() {
        EmergencyRequestRepository requests = mock(EmergencyRequestRepository.class);
        RequestEventRepository events = mock(RequestEventRepository.class);
        OrganizationRepository organizations = mock(OrganizationRepository.class);
        TenantAccessService tenantAccess = mock(TenantAccessService.class);
        AuditService auditService = mock(AuditService.class);
        NotificationService notifications = mock(NotificationService.class);
        ReservationService reservationService = mock(ReservationService.class);
        EmergencyRequestService.LifecycleBatches lifecycleBatches = mock(EmergencyRequestService.LifecycleBatches.class);

        String suffix = UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        Organization hospital = new Organization("Hospital " + suffix, Organization.Type.HOSPITAL,
                "CANCEL-" + suffix, "City", "State", suffix.toLowerCase() + "@example.test", null, "Area");
        ReflectionTestUtils.setField(hospital, "id", 1L);
        EmergencyRequest request = new EmergencyRequest("LL-CANCEL-" + suffix, hospital, "PAT-" + suffix,
                BloodGroup.O_POSITIVE, ComponentType.WHOLE_BLOOD, 1, Priority.ROUTINE,
                Instant.now().plus(2, ChronoUnit.HOURS), "lock order test", 1L);
        ReflectionTestUtils.setField(request, "id", 10L);
        request.verify(1L);
        request.approve(1L);

        AuthenticatedUser hospitalAdmin = new AuthenticatedUser(1L, "hospital@test", "Hospital Admin",
                Set.of(Role.HOSPITAL_ADMIN), Role.HOSPITAL_ADMIN.permissions(), Set.of(1L),
                Set.of(new AuthenticatedUser.OrganizationRole(1L, hospital.getName(), Role.HOSPITAL_ADMIN)));
        when(tenantAccess.currentUser()).thenReturn(hospitalAdmin);
        when(requests.findByIdForUpdate(10L)).thenReturn(Optional.of(request));
        when(reservationService.cancelForRequest(10L)).thenReturn(1);

        EmergencyRequestService service = new EmergencyRequestService(requests, events, organizations,
                tenantAccess, auditService, notifications, reservationService, lifecycleBatches);

        service.cancel(10L, new ReasonRequest("Patient discharged"));

        InOrder lockOrder = inOrder(requests, reservationService);
        lockOrder.verify(requests).findByIdForUpdate(10L);
        lockOrder.verify(reservationService).cancelForRequest(10L);
    }
}
