package com.lifelink.inventory;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.lifelink.audit.AuditEventRepository;
import com.lifelink.common.BloodGroup;
import com.lifelink.common.ComponentType;
import com.lifelink.common.GlobalExceptionHandler;
import com.lifelink.common.exception.ErrorCode;
import com.lifelink.common.exception.ValidationException;
import com.lifelink.identity.AuthenticatedUser;
import com.lifelink.identity.Permission;
import com.lifelink.identity.Role;
import com.lifelink.identity.User;
import com.lifelink.identity.UserRepository;
import com.lifelink.inventory.dto.InventoryDtos.AdjustmentRequest;
import com.lifelink.inventory.dto.InventoryDtos.Alerts;
import com.lifelink.organization.Organization;
import com.lifelink.organization.OrganizationRepository;
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
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.validation.beanvalidation.LocalValidatorFactoryBean;

@SpringBootTest(properties = {"lifelink.seed.enabled=false", "lifelink.inventory.low-stock-threshold=1",
        "spring.datasource.url=jdbc:h2:mem:lifelink-inventory-regression;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1;DEFAULT_NULL_ORDERING=HIGH"})
@ActiveProfiles("test")
class InventoryRegressionTest {
    private static final List<BloodUnit.Status> ACTIVE_STATUSES = List.of(
            BloodUnit.Status.AVAILABLE, BloodUnit.Status.RESERVED, BloodUnit.Status.QUARANTINED);

    @Autowired
    private InventoryService service;
    @Autowired
    private BloodUnitRepository units;
    @Autowired
    private InventoryMovementRepository movements;
    @Autowired
    private OrganizationRepository organizations;
    @Autowired
    private AuditEventRepository audits;
    @Autowired
    private UserRepository users;

    @BeforeEach
    void authenticateAdmin() {
        User actor = users.save(new User("inventory-test-" + UUID.randomUUID() + "@example.test",
                "hash", "Inventory Tester", null, User.Status.ACTIVE, EnumSet.of(Role.PLATFORM_ADMIN)));
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
    void expiringSoonDoesNotIncludeAlreadyExpiredUnits() {
        Alerts before = service.alerts();
        Organization org = saveOrganization();
        BloodUnit expired = saveUnit(org, Instant.now().minus(1, ChronoUnit.HOURS));
        BloodUnit expiring = saveUnit(org, Instant.now().plus(2, ChronoUnit.DAYS));
        saveUnit(org, Instant.now().plus(30, ChronoUnit.DAYS));

        Instant now = Instant.now();
        List<Long> expiringIds = units.findExpiringBetween(now, now.plus(7, ChronoUnit.DAYS), ACTIVE_STATUSES)
                .stream().map(BloodUnit::getId).toList();
        List<Long> expiredIds = units.findExpiring(now, ACTIVE_STATUSES)
                .stream().map(BloodUnit::getId).toList();
        assertTrue(expiringIds.contains(expiring.getId()));
        assertTrue(expiredIds.contains(expired.getId()));
        assertFalse(expiringIds.contains(expired.getId()));
        assertFalse(expiredIds.contains(expiring.getId()));

        Alerts after = service.alerts();
        assertEquals(before.expiringSoon() + 1, after.expiringSoon());
        assertEquals(before.expired() + 1, after.expired());
    }

    @Test
    void lowStockUsesConfiguredThresholdAndTenantScope() {
        long baseline = service.alerts().lowStockOrganizations();
        Organization org = saveOrganization();
        saveUnit(org, Instant.now().plus(30, ChronoUnit.DAYS)); // quarantined, not available
        Organization stocked = saveOrganization();
        BloodUnit available = saveUnit(stocked, Instant.now().plus(30, ChronoUnit.DAYS));
        available.release(Instant.now());
        units.save(available);

        assertEquals(baseline + 1, service.alerts().lowStockOrganizations());

        AuthenticatedUser scoped = new AuthenticatedUser(2L, "bank@test", "Bank", EnumSet.of(Role.BLOOD_BANK_ADMIN),
                EnumSet.allOf(Permission.class), Set.of(org.getId(), stocked.getId()), Set.of());
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(scoped, null, scoped.getAuthorities()));
        assertEquals(1, service.alerts().lowStockOrganizations());
    }

    @Test
    void lowStockDoesNotLeakOrganizationsWithoutInventoryRead() {
        Organization lowStockOrg = saveOrganization();

        AuthenticatedUser hospitalAdmin = new AuthenticatedUser(3L, "hospital-admin@test", "Hospital Admin",
                EnumSet.of(Role.HOSPITAL_ADMIN), Role.HOSPITAL_ADMIN.permissions(),
                Set.of(lowStockOrg.getId()),
                Set.of(new AuthenticatedUser.OrganizationRole(lowStockOrg.getId(), lowStockOrg.getName(),
                        Role.HOSPITAL_ADMIN)));
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(hospitalAdmin, null, hospitalAdmin.getAuthorities()));

        // Membership alone must not reveal the organization's low-stock status.
        assertEquals(0, service.alerts().lowStockOrganizations());
    }

    @Test
    void positiveAdjustmentIsRejectedBeforeMutationOrAudit() {
        BloodUnit unit = saveUnit(saveOrganization(), Instant.now().plus(30, ChronoUnit.DAYS));
        long movementCount = movements.count();
        long auditCount = audits.count();

        ValidationException failure = assertThrows(ValidationException.class,
                () -> service.adjust(new AdjustmentRequest(unit.getId(), 1, "restock", null)));
        assertEquals(ErrorCode.VALIDATION_ERROR, failure.errorCode());
        assertEquals(movementCount, movements.count());
        assertEquals(auditCount, audits.count());
        assertEquals(BloodUnit.Status.QUARANTINED, units.findById(unit.getId()).orElseThrow().getStatus());
    }

    @Test
    void negativeAdjustmentDiscardsAndRecordsOneMovementAndAudit() {
        BloodUnit unit = saveUnit(saveOrganization(), Instant.now().plus(30, ChronoUnit.DAYS));
        long movementCount = movements.count();
        long auditCount = audits.count();

        assertEquals(BloodUnit.Status.DISCARDED, service.adjust(
                new AdjustmentRequest(unit.getId(), -1, "damaged in transit", null)).status());
        assertEquals(movementCount + 1, movements.count());
        assertEquals(auditCount + 1, audits.count());
    }

    @Test
    void noOpLocationAdjustmentDoesNotAuditOrMove() {
        BloodUnit unit = saveUnit(saveOrganization(), Instant.now().plus(30, ChronoUnit.DAYS));
        long movementCount = movements.count();
        long auditCount = audits.count();

        service.adjust(new AdjustmentRequest(unit.getId(), null, "inspection", unit.getStorageLocation()));

        assertEquals(movementCount, movements.count());
        assertEquals(auditCount, audits.count());
    }

    @Test
    void controllerRejectsPositiveDeltaWithValidationError() throws Exception {
        LocalValidatorFactoryBean validator = new LocalValidatorFactoryBean();
        validator.afterPropertiesSet();
        InventoryService mockService = mock(InventoryService.class);
        MockMvc mvc = MockMvcBuilders.standaloneSetup(new InventoryController(mockService))
                .setControllerAdvice(new GlobalExceptionHandler())
                .setValidator(validator)
                .build();

        mvc.perform(post("/api/v1/inventory/adjustments")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"unitId\":1,\"delta\":1,\"reason\":\"restock\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"));
        verifyNoInteractions(mockService);
    }

    private Organization saveOrganization() {
        String suffix = UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        return organizations.save(new Organization("Org " + suffix, Organization.Type.BLOOD_BANK,
                "ORG-" + suffix, "City", "State", suffix.toLowerCase() + "@example.test", null, "Area"));
    }

    private BloodUnit saveUnit(Organization organization, Instant expiresAt) {
        String suffix = UUID.randomUUID().toString().substring(0, 10).toUpperCase();
        return units.save(new BloodUnit("LL-" + suffix, BloodGroup.O_POSITIVE, ComponentType.WHOLE_BLOOD,
                Instant.now().minus(1, ChronoUnit.DAYS), expiresAt, "COLD-ROOM", organization, null));
    }
}
