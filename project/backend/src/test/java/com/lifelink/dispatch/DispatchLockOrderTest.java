package com.lifelink.dispatch;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.lifelink.audit.AuditService;
import com.lifelink.common.BloodGroup;
import com.lifelink.common.ComponentType;
import com.lifelink.dispatch.dto.DispatchDtos.CreateRequest;
import com.lifelink.dispatch.dto.DispatchDtos.View;
import com.lifelink.emergency.EmergencyRequest;
import com.lifelink.emergency.EmergencyRequestRepository;
import com.lifelink.emergency.EmergencyRequest.Priority;
import com.lifelink.emergency.EmergencyRequestService;
import com.lifelink.identity.AuthenticatedUser;
import com.lifelink.identity.Permission;
import com.lifelink.identity.Role;
import com.lifelink.identity.TenantAccessService;
import com.lifelink.inventory.BloodUnit;
import com.lifelink.inventory.BloodUnitRepository;
import com.lifelink.inventory.InventoryMovementRepository;
import com.lifelink.notification.NotificationService;
import com.lifelink.organization.Organization;
import com.lifelink.reservation.Reservation;
import com.lifelink.reservation.ReservationRepository;
import com.lifelink.reservation.ReservationService.Idempotency;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.EnumSet;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Supplier;
import org.junit.jupiter.api.Test;
import org.mockito.InOrder;
import org.springframework.test.util.ReflectionTestUtils;

/** Guards the request -> unit lock order shared by dispatch and request expiry. */
class DispatchLockOrderTest {

    @SuppressWarnings("unchecked")
    @Test
    void createLocksRequestBeforeUnit() {
        DispatchRepository dispatches = mock(DispatchRepository.class);
        ReservationRepository reservations = mock(ReservationRepository.class);
        EmergencyRequestRepository requests = mock(EmergencyRequestRepository.class);
        BloodUnitRepository units = mock(BloodUnitRepository.class);
        InventoryMovementRepository movements = mock(InventoryMovementRepository.class);
        EmergencyRequestService requestService = mock(EmergencyRequestService.class);
        NotificationService notifications = mock(NotificationService.class);
        TenantAccessService tenantAccess = mock(TenantAccessService.class);
        AuditService auditService = mock(AuditService.class);
        Idempotency idempotency = mock(Idempotency.class);

        doAnswer(invocation -> ((Supplier<View>) invocation.getArgument(4)).get())
                .when(idempotency).execute(anyString(), anyString(), anyString(), eq(View.class), any());

        String suffix = UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        Organization hospital = organization(1L, "Hospital " + suffix, Organization.Type.HOSPITAL, "DH-" + suffix);
        Organization bank = organization(2L, "Bank " + suffix, Organization.Type.BLOOD_BANK, "DB-" + suffix);
        EmergencyRequest request = new EmergencyRequest("LL-LOCK-" + suffix, hospital, "PAT-" + suffix,
                BloodGroup.O_POSITIVE, ComponentType.WHOLE_BLOOD, 1, Priority.URGENT,
                Instant.now().plus(2, ChronoUnit.HOURS), "lock order test", 1L);
        ReflectionTestUtils.setField(request, "id", 10L);

        BloodUnit unit = new BloodUnit("LL-LOCK-U-" + suffix, BloodGroup.O_POSITIVE,
                ComponentType.WHOLE_BLOOD, Instant.now().minus(1, ChronoUnit.DAYS),
                Instant.now().plus(30, ChronoUnit.DAYS), "COLD-ROOM", bank, null);
        ReflectionTestUtils.setField(unit, "id", 20L);
        unit.release(Instant.now());
        unit.reserve(100L, Instant.now());

        Reservation reservation = new Reservation(unit, request, hospital,
                Instant.now().plus(30, ChronoUnit.MINUTES), "res-lock-" + suffix);
        ReflectionTestUtils.setField(reservation, "id", 100L);
        reservation.confirm(Instant.now());

        AuthenticatedUser admin = new AuthenticatedUser(1L, "admin@test", "Admin",
                EnumSet.of(Role.PLATFORM_ADMIN), EnumSet.allOf(Permission.class), Set.of(), Set.of());
        when(tenantAccess.currentUser()).thenReturn(admin);
        when(reservations.findById(100L)).thenReturn(Optional.of(reservation));
        when(requests.findByIdForUpdate(10L)).thenReturn(Optional.of(request));
        when(units.findByIdForUpdate(20L)).thenReturn(Optional.of(unit));
        when(dispatches.existsByReservationId(100L)).thenReturn(false);

        DispatchService service = new DispatchService(dispatches, reservations, requests, units, movements,
                requestService, notifications, tenantAccess, auditService, idempotency);

        View created = service.create(new CreateRequest(100L, "Nurse Lock"), "lock-key-" + suffix);

        assertEquals(100L, created.reservationId());
        InOrder lockOrder = inOrder(requests, units);
        lockOrder.verify(requests).findByIdForUpdate(10L);
        lockOrder.verify(units).findByIdForUpdate(20L);
    }

    private Organization organization(Long id, String name, Organization.Type type, String code) {
        Organization organization = new Organization(name, type, code, "City", "State",
                code.toLowerCase() + "@example.test", null, "Area");
        ReflectionTestUtils.setField(organization, "id", id);
        return organization;
    }
}
