package com.lifelink.domain;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.lifelink.common.BloodGroup;
import com.lifelink.common.ComponentType;
import com.lifelink.common.exception.BusinessRuleViolationException;
import com.lifelink.common.exception.InvalidStateTransitionException;
import com.lifelink.emergency.EmergencyRequest;
import com.lifelink.organization.Organization;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import org.junit.jupiter.api.Test;

class EmergencyRequestTest {

    private EmergencyRequest request() {
        Organization hospital = new Organization("Hospital", Organization.Type.HOSPITAL,
                "HOS-1", "City", "State", "hospital@example.org", null, "Area");
        return new EmergencyRequest("LL-ER-1", hospital, "PATIENT-1", BloodGroup.O_POSITIVE,
                ComponentType.WHOLE_BLOOD, 1, EmergencyRequest.Priority.URGENT,
                Instant.now().plus(6, ChronoUnit.HOURS), "Test", 1L);
    }

    @Test
    void requestRequiresVerificationBeforeApproval() {
        EmergencyRequest request = request();
        assertEquals(EmergencyRequest.Status.PENDING_VERIFICATION, request.getStatus());
        assertThrows(InvalidStateTransitionException.class, () -> request.approve(2L));
        request.verify(2L);
        request.approve(3L);
        assertEquals(EmergencyRequest.Status.APPROVED, request.getStatus());
    }

    @Test
    void ordinaryPriorityChangeIsRejected() {
        EmergencyRequest request = request();
        assertThrows(BusinessRuleViolationException.class,
                () -> request.changePriority(EmergencyRequest.Priority.CRITICAL, false));
        assertEquals(EmergencyRequest.Priority.URGENT, request.getPriority());
    }

    @Test
    void fulfilledRequestCannotBeCancelled() {
        EmergencyRequest request = request();
        request.verify(2L);
        request.approve(3L);
        request.markAllocating();
        request.markReserved();
        request.markInTransit();
        request.fulfil();
        assertThrows(InvalidStateTransitionException.class, request::cancel);
    }
}
