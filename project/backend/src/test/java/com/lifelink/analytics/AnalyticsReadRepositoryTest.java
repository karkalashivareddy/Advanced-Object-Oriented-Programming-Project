package com.lifelink.analytics;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.lifelink.common.BloodGroup;
import com.lifelink.common.ComponentType;
import com.lifelink.dispatch.DispatchRepository;
import com.lifelink.emergency.EmergencyRequest;
import com.lifelink.emergency.EmergencyRequestRepository;
import com.lifelink.identity.Role;
import com.lifelink.identity.User;
import com.lifelink.identity.UserRepository;
import com.lifelink.inventory.BloodUnit;
import com.lifelink.inventory.BloodUnitRepository;
import com.lifelink.organization.Organization;
import com.lifelink.organization.OrganizationRepository;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest(properties = {
        "lifelink.seed.enabled=false",
        "spring.datasource.url=jdbc:h2:mem:lifelink-analytics-read;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1;DEFAULT_NULL_ORDERING=HIGH"
})
@ActiveProfiles("test")
@Transactional
class AnalyticsReadRepositoryTest {
    @Autowired AnalyticsReadRepository analytics;
    @Autowired OrganizationRepository organizations;
    @Autowired BloodUnitRepository units;
    @Autowired EmergencyRequestRepository requests;
    @Autowired UserRepository users;

    @Test
    void aggregateQueriesCountInDatabaseAndRespectSelectedOrganization() {
        Organization selected = saveOrganization("selected");
        Organization other = saveOrganization("other");
        Long actorId = users.save(new User("analytics-" + UUID.randomUUID() + "@example.test", "hash",
                "Analytics test actor", null, User.Status.ACTIVE, java.util.Set.of(Role.PLATFORM_ADMIN))).getId();
        Instant now = Instant.now();

        saveUnit(selected, BloodGroup.O_POSITIVE, now.plus(2, ChronoUnit.DAYS), true);
        saveUnit(selected, BloodGroup.O_POSITIVE, now.plus(4, ChronoUnit.DAYS), true);
        saveUnit(selected, BloodGroup.A_NEGATIVE, now.plus(12, ChronoUnit.DAYS), true);
        saveUnit(selected, BloodGroup.AB_POSITIVE, now.plus(2, ChronoUnit.DAYS), false);
        saveUnit(other, BloodGroup.O_POSITIVE, now.plus(1, ChronoUnit.DAYS), true);

        saveRequest(selected, "PENDING", actorId);
        EmergencyRequest approved = saveRequest(selected, "APPROVED", actorId);
        approved.verify(actorId);
        approved.approve(actorId);
        requests.save(approved);
        saveRequest(other, "OTHER", actorId);

        Map<BloodGroup, Long> inventory = analytics.inventoryByBloodGroup(selected.getId()).stream()
                .collect(Collectors.toMap(row -> (BloodGroup) row[0], row -> ((Number) row[1]).longValue()));
        Map<EmergencyRequest.Status, Long> requestStatus = analytics.requestsByStatus(selected.getId()).stream()
                .collect(Collectors.toMap(row -> (EmergencyRequest.Status) row[0], row -> ((Number) row[1]).longValue()));

        assertEquals(2L, inventory.get(BloodGroup.O_POSITIVE));
        assertEquals(1L, inventory.get(BloodGroup.A_NEGATIVE));
        assertEquals(3L, inventory.values().stream().mapToLong(Long::longValue).sum());
        assertEquals(1L, requestStatus.get(EmergencyRequest.Status.PENDING_VERIFICATION));
        assertEquals(1L, requestStatus.get(EmergencyRequest.Status.APPROVED));
        assertEquals(2L, analytics.countExpiring(selected.getId(), now.plus(7, ChronoUnit.DAYS)));
        assertEquals(4L, analytics.inventoryByBloodGroup(null).stream()
                .mapToLong(row -> ((Number) row[1]).longValue()).sum());
        assertEquals(2L, analytics.requestsByStatus(null).stream()
                .filter(row -> row[0] == EmergencyRequest.Status.PENDING_VERIFICATION)
                .mapToLong(row -> ((Number) row[1]).longValue()).sum());
    }

    private Organization saveOrganization(String suffix) {
        Organization organization = new Organization("Analytics " + suffix, Organization.Type.BLOOD_BANK,
                "AN-" + suffix + "-" + UUID.randomUUID().toString().substring(0, 8), "Hyderabad", "Telangana",
                suffix + "@example.test", null, null);
        organization.verify();
        return organizations.save(organization);
    }

    private void saveUnit(Organization organization, BloodGroup group, Instant expiry, boolean released) {
        Instant collected = Instant.now().minus(1, ChronoUnit.DAYS);
        BloodUnit unit = units.save(new BloodUnit("AN-UNIT-" + UUID.randomUUID(), group,
                ComponentType.WHOLE_BLOOD, collected, expiry, "Fridge 1", organization, null));
        if (released) {
            unit.release(Instant.now());
            units.save(unit);
        }
    }

    private EmergencyRequest saveRequest(Organization organization, String suffix, Long actorId) {
        EmergencyRequest request = new EmergencyRequest("AN-REQ-" + suffix + UUID.randomUUID().toString().substring(0, 8), organization,
                null, BloodGroup.O_POSITIVE, ComponentType.WHOLE_BLOOD, 1,
                EmergencyRequest.Priority.ROUTINE, Instant.now().plus(1, ChronoUnit.DAYS), "test", actorId);
        requests.save(request);
        return request;
    }
}
