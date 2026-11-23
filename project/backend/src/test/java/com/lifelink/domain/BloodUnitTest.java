package com.lifelink.domain;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.lifelink.common.BloodGroup;
import com.lifelink.common.ComponentType;
import com.lifelink.common.exception.BusinessRuleViolationException;
import com.lifelink.common.exception.InvalidStateTransitionException;
import com.lifelink.inventory.BloodUnit;
import com.lifelink.organization.Organization;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import org.junit.jupiter.api.Test;

class BloodUnitTest {

    private BloodUnit unit(Instant collectedAt) {
        Organization organization = new Organization("Bank", Organization.Type.BLOOD_BANK,
                "BB-1", "City", "State", "bank@example.org", null, "Area");
        return new BloodUnit("UNIT-1", BloodGroup.O_POSITIVE, ComponentType.WHOLE_BLOOD,
                collectedAt, collectedAt.plus(35, ChronoUnit.DAYS), "COLD-A", organization, null);
    }

    @Test
    void unitStartsQuarantinedAndUnreleased() {
        BloodUnit unit = unit(Instant.now());
        assertEquals(BloodUnit.Status.QUARANTINED, unit.getStatus());
        assertFalse(unit.isReleased());
    }

    @Test
    void authorizedReleaseMakesUnitAvailable() {
        BloodUnit unit = unit(Instant.now());
        unit.release(Instant.now());
        assertEquals(BloodUnit.Status.AVAILABLE, unit.getStatus());
        assertTrue(unit.isReleased());
    }

    @Test
    void reserveRequiresReleasedAvailableUnit() {
        BloodUnit unit = unit(Instant.now());
        assertThrows(BusinessRuleViolationException.class, () -> unit.reserve(1L, Instant.now()));
        unit.release(Instant.now());
        unit.reserve(1L, Instant.now());
        assertEquals(BloodUnit.Status.RESERVED, unit.getStatus());
        assertThrows(BusinessRuleViolationException.class, () -> unit.reserve(2L, Instant.now()));
    }

    @Test
    void expiredUnitCannotBeReleasedOrReserved() {
        Instant old = Instant.now().minus(40, ChronoUnit.DAYS);
        BloodUnit unit = unit(old);
        assertThrows(BusinessRuleViolationException.class, () -> unit.release(Instant.now()));
        assertThrows(BusinessRuleViolationException.class, () -> unit.reserve(1L, Instant.now()));
    }

    @Test
    void illegalTransitionsAreRejected() {
        BloodUnit unit = unit(Instant.now());
        assertThrows(InvalidStateTransitionException.class, unit::dispatch);
        unit.release(Instant.now());
        unit.reserve(1L, Instant.now());
        unit.dispatch();
        assertThrows(InvalidStateTransitionException.class, unit::dispatch);
        unit.deliver();
        assertEquals(BloodUnit.Status.DELIVERED, unit.getStatus());
        assertThrows(InvalidStateTransitionException.class, unit::markExpired);
    }

    @Test
    void clearingReservationRestoresAvailability() {
        BloodUnit unit = unit(Instant.now());
        unit.release(Instant.now());
        unit.reserve(1L, Instant.now());
        unit.clearReservation();
        assertEquals(BloodUnit.Status.AVAILABLE, unit.getStatus());
    }
}
