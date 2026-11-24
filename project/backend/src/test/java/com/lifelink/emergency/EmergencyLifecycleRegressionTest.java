package com.lifelink.emergency;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.lifelink.common.BloodGroup;
import com.lifelink.common.ComponentType;
import com.lifelink.common.exception.BusinessRuleViolationException;
import com.lifelink.emergency.EmergencyRequest.Priority;
import com.lifelink.emergency.EmergencyRequest.Status;
import com.lifelink.emergency.dto.RequestDtos.ReasonRequest;
import com.lifelink.identity.AuthenticatedUser;
import com.lifelink.identity.Permission;
import com.lifelink.identity.Role;
import com.lifelink.identity.User;
import com.lifelink.identity.UserRepository;
import com.lifelink.inventory.BloodUnit;
import com.lifelink.inventory.BloodUnitRepository;
import com.lifelink.inventory.InventoryMovementRepository;
import com.lifelink.organization.Organization;
import com.lifelink.organization.OrganizationRepository;
import com.lifelink.reservation.Reservation;
import com.lifelink.reservation.ReservationRepository;
import com.lifelink.reservation.ReservationService;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.EnumSet;
import java.util.List;
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
        "spring.datasource.url=jdbc:h2:mem:lifelink-emergency-lifecycle;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1;DEFAULT_NULL_ORDERING=HIGH"})
@ActiveProfiles("test")
class EmergencyLifecycleRegressionTest {
    @Autowired
    private EmergencyRequestService requestService;
    @Autowired
    private ReservationService reservationService;
    @Autowired
    private EmergencyRequestRepository requests;
    @Autowired
    private RequestEventRepository events;
    @Autowired
    private ReservationRepository reservations;
    @Autowired
    private BloodUnitRepository units;
    @Autowired
    private InventoryMovementRepository movements;
    @Autowired
    private OrganizationRepository organizations;
    @Autowired
    private UserRepository users;
    @Autowired
    private PlatformTransactionManager transactionManager;

    private User actor;
    private Organization organization;

    @BeforeEach
    void setUp() {
        String suffix = UUID.randomUUID().toString().substring(0, 10);
        actor = users.save(new User("lifecycle-" + suffix + "@example.test", "hash", "Lifecycle Tester",
                null, User.Status.ACTIVE, EnumSet.of(Role.PLATFORM_ADMIN)));
        organization = saveOrganization(suffix);
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
    void confirmedReservationPastTtlExpiresAndReleasesItsUnit() {
        EmergencyRequest request = saveRequest(Status.RESERVED, Instant.now().plus(1, ChronoUnit.HOURS));
        BloodUnit unit = saveReleasedUnit();
        Reservation reservation = saveReservation(unit, request, com.lifelink.reservation.Reservation.Status.CONFIRMED);
        ReflectionTestUtils.setField(reservation, "expiresAt", Instant.now().minusSeconds(1));
        reservations.save(reservation);

        assertTrue(reservationService.expireReservations() >= 1);

        assertEquals(com.lifelink.reservation.Reservation.Status.EXPIRED, reservations.findById(reservation.getId()).orElseThrow().getStatus());
        BloodUnit reloaded = units.findById(unit.getId()).orElseThrow();
        assertEquals(BloodUnit.Status.AVAILABLE, reloaded.getStatus());
        assertNull(reloaded.getActiveReservationId());
    }

    @Test
    void cancellingRequestCancelsItsReservationsAndReleasesStock() {
        EmergencyRequest request = saveRequest(Status.RESERVED, Instant.now().plus(1, ChronoUnit.HOURS));
        BloodUnit unit = saveReleasedUnit();
        Reservation reservation = saveReservation(unit, request, com.lifelink.reservation.Reservation.Status.ACTIVE);
        long movementCount = movements.count();

        requestService.cancel(request.getId(), new ReasonRequest("Patient discharged"));

        assertEquals(Status.CANCELLED, requests.findById(request.getId()).orElseThrow().getStatus());
        assertEquals(com.lifelink.reservation.Reservation.Status.CANCELLED,
                reservations.findById(reservation.getId()).orElseThrow().getStatus());
        BloodUnit reloaded = units.findById(unit.getId()).orElseThrow();
        assertEquals(BloodUnit.Status.AVAILABLE, reloaded.getStatus());
        assertNull(reloaded.getActiveReservationId());
        assertEquals(movementCount + 1, movements.count());
        assertTrue(events.findByRequestIdOrderByOccurredAtDesc(request.getId()).stream()
                .anyMatch(event -> event.getAction().equals("CANCELLED")));
    }

    @Test
    void dueRequestExpiresAndReleasesItsReservations() {
        EmergencyRequest request = saveRequest(Status.RESERVED, Instant.now().plus(1, ChronoUnit.HOURS));
        ReflectionTestUtils.setField(request, "requiredBy", Instant.now().minusSeconds(1));
        requests.save(request);
        BloodUnit unit = saveReleasedUnit();
        Reservation reservation = saveReservation(unit, request, com.lifelink.reservation.Reservation.Status.ACTIVE);

        assertTrue(requestService.expireRequests() >= 1);

        assertEquals(Status.EXPIRED, requests.findById(request.getId()).orElseThrow().getStatus());
        assertEquals(com.lifelink.reservation.Reservation.Status.EXPIRED,
                reservations.findById(reservation.getId()).orElseThrow().getStatus());
        BloodUnit reloaded = units.findById(unit.getId()).orElseThrow();
        assertEquals(BloodUnit.Status.AVAILABLE, reloaded.getStatus());
        assertNull(reloaded.getActiveReservationId());
    }

    @Test
    void dueRequestExpiresTerminalAndInTransitRequestsRemainInFlight() {
        EmergencyRequest due = saveRequest(Status.VERIFIED, Instant.now().plus(1, ChronoUnit.HOURS));
        ReflectionTestUtils.setField(due, "requiredBy", Instant.now().minusSeconds(1));
        requests.save(due);
        EmergencyRequest inTransit = saveRequest(Status.IN_TRANSIT, Instant.now().plus(1, ChronoUnit.HOURS));
        ReflectionTestUtils.setField(inTransit, "requiredBy", Instant.now().minusSeconds(1));
        requests.save(inTransit);

        assertTrue(requestService.expireRequests() >= 1);

        assertEquals(Status.EXPIRED, requests.findById(due.getId()).orElseThrow().getStatus());
        assertEquals(Status.IN_TRANSIT, requests.findById(inTransit.getId()).orElseThrow().getStatus());
        assertTrue(events.findByRequestIdOrderByOccurredAtDesc(due.getId()).stream()
                .anyMatch(event -> event.getAction().equals("EXPIRED")));
        assertThrows(BusinessRuleViolationException.class, () -> due.expire(Instant.now().minus(1, ChronoUnit.DAYS)));
    }

    private Organization saveOrganization(String suffix) {
        return organizations.save(new Organization("Lifecycle Org " + suffix, Organization.Type.HOSPITAL,
                "LIFE-" + suffix, "City", "State", suffix.toLowerCase() + "@example.test", null, "Area"));
    }

    private EmergencyRequest saveRequest(Status status, Instant requiredBy) {
        String suffix = UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        EmergencyRequest request = new EmergencyRequest("LL-LIFE-" + suffix, organization, "PAT-" + suffix,
                BloodGroup.O_POSITIVE, ComponentType.WHOLE_BLOOD, 1, Priority.ROUTINE,
                requiredBy, "Lifecycle regression", actor.getId());
        switch (status) {
            case VERIFIED -> request.verify(actor.getId());
            case APPROVED -> {
                request.verify(actor.getId());
                request.approve(actor.getId());
            }
            case RESERVED -> {
                request.verify(actor.getId());
                request.approve(actor.getId());
                request.markAllocating();
                request.markReserved();
            }
            case IN_TRANSIT -> {
                request.verify(actor.getId());
                request.approve(actor.getId());
                request.markAllocating();
                request.markReserved();
                request.markInTransit();
            }
            default -> throw new IllegalArgumentException("Unsupported fixture status: " + status);
        }
        return requests.save(request);
    }

    private BloodUnit saveReleasedUnit() {
        String suffix = UUID.randomUUID().toString().substring(0, 10).toUpperCase();
        BloodUnit unit = new BloodUnit("LL-LIFE-" + suffix, BloodGroup.O_POSITIVE, ComponentType.WHOLE_BLOOD,
                Instant.now().minus(1, ChronoUnit.DAYS), Instant.now().plus(30, ChronoUnit.DAYS),
                "COLD-ROOM", organization, null);
        unit.release(Instant.now());
        return units.save(unit);
    }

    private Reservation saveReservation(BloodUnit unit, EmergencyRequest request,
                                        com.lifelink.reservation.Reservation.Status status) {
        Reservation reservation = new Reservation(unit, request, organization,
                Instant.now().plus(30, ChronoUnit.MINUTES), "lifecycle-" + UUID.randomUUID());
        new TransactionTemplate(transactionManager).executeWithoutResult(transaction -> {
            reservations.saveAndFlush(reservation);
            reservations.markActiveUnit(reservation.getId());
            unit.reserve(reservation.getId(), Instant.now());
            units.save(unit);
            if (status == com.lifelink.reservation.Reservation.Status.CONFIRMED) {
                reservations.clearActiveUnit(reservation.getId());
                reservation.confirm(Instant.now());
                reservations.save(reservation);
            }
        });
        return reservation;
    }
}
