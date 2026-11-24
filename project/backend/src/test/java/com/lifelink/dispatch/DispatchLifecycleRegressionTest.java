package com.lifelink.dispatch;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.lifelink.common.BloodGroup;
import com.lifelink.common.ComponentType;
import com.lifelink.common.exception.BusinessRuleViolationException;
import com.lifelink.common.exception.ErrorCode;
import com.lifelink.dispatch.dto.DispatchDtos.CreateRequest;
import com.lifelink.dispatch.dto.DispatchDtos.View;
import com.lifelink.emergency.EmergencyRequest;
import com.lifelink.emergency.EmergencyRequestRepository;
import com.lifelink.emergency.EmergencyRequest.Priority;
import com.lifelink.identity.AuthenticatedUser;
import com.lifelink.identity.Permission;
import com.lifelink.identity.Role;
import com.lifelink.identity.User;
import com.lifelink.identity.UserRepository;
import com.lifelink.inventory.BloodUnit;
import com.lifelink.inventory.BloodUnitRepository;
import com.lifelink.inventory.InventoryService.LifecycleBatches;
import com.lifelink.organization.Organization;
import com.lifelink.organization.OrganizationRepository;
import com.lifelink.reservation.Reservation;
import com.lifelink.reservation.ReservationRepository;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.EnumSet;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

@SpringBootTest(properties = {"lifelink.seed.enabled=false",
        "spring.datasource.url=jdbc:h2:mem:lifelink-dispatch-lifecycle;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1;DEFAULT_NULL_ORDERING=HIGH"})
@ActiveProfiles("test")
class DispatchLifecycleRegressionTest {
    @Autowired
    private DispatchService dispatchService;
    @Autowired
    private LifecycleBatches lifecycleBatches;
    @Autowired
    private DispatchRepository dispatches;
    @Autowired
    private ReservationRepository reservations;
    @Autowired
    private EmergencyRequestRepository requests;
    @Autowired
    private BloodUnitRepository units;
    @Autowired
    private OrganizationRepository organizations;
    @Autowired
    private UserRepository users;
    @Autowired
    private PlatformTransactionManager transactionManager;

    private User actor;
    private Organization hospital;
    private Organization bloodBank;

    @BeforeEach
    void setUp() {
        String suffix = UUID.randomUUID().toString().substring(0, 10);
        actor = users.save(new User("dispatch-test-" + suffix + "@example.test", "hash", "Dispatch Tester",
                null, User.Status.ACTIVE, EnumSet.of(Role.PLATFORM_ADMIN)));
        hospital = saveOrganization("Hospital " + suffix, Organization.Type.HOSPITAL, "DHOS-" + suffix);
        bloodBank = saveOrganization("Bank " + suffix, Organization.Type.BLOOD_BANK, "DBNK-" + suffix);
        AuthenticatedUser admin = new AuthenticatedUser(actor.getId(), actor.getEmail(), "Admin",
                EnumSet.of(Role.PLATFORM_ADMIN), EnumSet.allOf(Permission.class), Set.of(), Set.of());
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(admin, null, admin.getAuthorities()));
    }

    @AfterEach
    void clearAuthentication() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void replayAfterReservationExpiryReturnsStoredResponse() {
        Reservation reservation = createConfirmedReservation();
        CreateRequest command = new CreateRequest(reservation.getId(), "Nurse A");
        String key = "dispatch-replay-" + UUID.randomUUID();
        long before = dispatches.count();

        View first = dispatchService.create(command, key);
        expireReservation(reservation.getId());

        View replay = dispatchService.create(command, key);
        assertEquals(first.id(), replay.id());
        assertEquals(first.publicId(), replay.publicId());
        assertEquals(first.reservationId(), replay.reservationId());
        assertEquals(first.status(), replay.status());
        assertEquals(before + 1, dispatches.count());
    }

    @Test
    void newCommandOnExpiredReservationIsRejected() {
        Reservation reservation = createConfirmedReservation();
        long before = dispatches.count();
        expireReservation(reservation.getId());

        BusinessRuleViolationException failure = assertThrows(BusinessRuleViolationException.class,
                () -> dispatchService.create(new CreateRequest(reservation.getId(), "Nurse B"),
                        "dispatch-new-" + UUID.randomUUID()));
        assertEquals(ErrorCode.BUSINESS_RULE_VIOLATION, failure.errorCode());
        assertTrue(failure.getMessage().contains("expired"));
        assertEquals(before, dispatches.count());
    }

    @Test
    void lifecycleExpiryDoesNotExpireReservationThatAlreadyHasDispatch() {
        Reservation reservation = createConfirmedReservation();
        dispatchService.create(new CreateRequest(reservation.getId(), "Nurse C"),
                "dispatch-lifecycle-" + UUID.randomUUID());
        expireReservation(reservation.getId());

        assertFalse(lifecycleBatches.expireReservation(reservation.getId()));

        assertEquals(Reservation.Status.CONFIRMED,
                reservations.findById(reservation.getId()).orElseThrow().getStatus());
        BloodUnit reloadedUnit = units.findById(reservation.getBloodUnit().getId()).orElseThrow();
        assertEquals(BloodUnit.Status.DISPATCHED, reloadedUnit.getStatus());
        assertNull(reloadedUnit.getActiveReservationId());
    }

    private Reservation createConfirmedReservation() {
        String suffix = UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        EmergencyRequest request = new EmergencyRequest("LL-DISPATCH-" + suffix, hospital, "PAT-" + suffix,
                BloodGroup.O_POSITIVE, ComponentType.WHOLE_BLOOD, 1, Priority.URGENT,
                Instant.now().plus(2, ChronoUnit.HOURS), "dispatch regression", actor.getId());
        request.verify(actor.getId());
        request.approve(actor.getId());
        request.markAllocating();
        request.markReserved();
        requests.save(request);

        BloodUnit unit = new BloodUnit("LL-DISPATCH-U-" + suffix, BloodGroup.O_POSITIVE,
                ComponentType.WHOLE_BLOOD, Instant.now().minus(1, ChronoUnit.DAYS),
                Instant.now().plus(30, ChronoUnit.DAYS), "COLD-ROOM", bloodBank, null);
        unit.release(Instant.now());

        Reservation reservation = new Reservation(unit, request, hospital,
                Instant.now().plus(30, ChronoUnit.MINUTES), "reservation-" + suffix);
        new TransactionTemplate(transactionManager).executeWithoutResult(transaction -> {
            requests.saveAndFlush(request);
            units.saveAndFlush(unit);
            reservations.saveAndFlush(reservation);
            reservations.markActiveUnit(reservation.getId());
            unit.reserve(reservation.getId(), Instant.now());
            units.save(unit);
            // CONFIRMED clears the sparse ACTIVE slot but keeps the unit reserved
            // until dispatch takes ownership.
            reservations.clearActiveUnit(reservation.getId());
            reservation.confirm(Instant.now());
            reservations.save(reservation);
        });
        return reservation;
    }

    private void expireReservation(Long reservationId) {
        Reservation reservation = reservations.findById(reservationId).orElseThrow();
        ReflectionTestUtils.setField(reservation, "expiresAt", Instant.now().minusSeconds(1));
        reservations.save(reservation);
    }

    private Organization saveOrganization(String name, Organization.Type type, String code) {
        String suffix = UUID.randomUUID().toString().substring(0, 6).toLowerCase();
        return organizations.save(new Organization(name, type, code + suffix, "City", "State",
                suffix + "@example.test", null, "Area"));
    }
}
