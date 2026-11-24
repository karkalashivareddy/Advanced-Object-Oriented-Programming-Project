package com.lifelink.inventory;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.lifelink.common.BloodGroup;
import com.lifelink.common.ComponentType;
import com.lifelink.identity.AuthenticatedUser;
import com.lifelink.identity.Permission;
import com.lifelink.identity.Role;
import com.lifelink.identity.User;
import com.lifelink.identity.UserRepository;
import com.lifelink.organization.Organization;
import com.lifelink.organization.OrganizationRepository;
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

@SpringBootTest(properties = {"lifelink.seed.enabled=false",
        "spring.datasource.url=jdbc:h2:mem:lifelink-inventory-default-low-stock;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1;DEFAULT_NULL_ORDERING=HIGH"})
@ActiveProfiles("test")
class InventoryDefaultLowStockTest {
    @Autowired
    private InventoryService service;
    @Autowired
    private BloodUnitRepository units;
    @Autowired
    private OrganizationRepository organizations;
    @Autowired
    private UserRepository users;

    @BeforeEach
    void authenticateAdmin() {
        User actor = users.save(new User("low-stock-test-" + UUID.randomUUID() + "@example.test",
                "hash", "Low Stock Tester", null, User.Status.ACTIVE, EnumSet.of(Role.PLATFORM_ADMIN)));
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
    void defaultThresholdFlagsOnlyOrganizationsBelowTenAvailableUnits() {
        long baseline = service.alerts().lowStockOrganizations();

        Organization nineUnits = saveOrganization("Nine");
        Organization tenUnits = saveOrganization("Ten");
        for (int i = 0; i < 9; i++) {
            saveAvailableUnit(nineUnits, "N" + i);
        }
        for (int i = 0; i < 10; i++) {
            saveAvailableUnit(tenUnits, "T" + i);
        }

        assertEquals(baseline + 1, service.alerts().lowStockOrganizations());
    }

    private Organization saveOrganization(String label) {
        String suffix = UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        return organizations.save(new Organization("Default " + label + " " + suffix, Organization.Type.BLOOD_BANK,
                "DFT-" + label + "-" + suffix, "City", "State", suffix.toLowerCase() + "@example.test",
                null, "Area"));
    }

    private void saveAvailableUnit(Organization organization, String label) {
        String suffix = UUID.randomUUID().toString().substring(0, 10).toUpperCase();
        BloodUnit unit = new BloodUnit("DFT-" + label + "-" + suffix, BloodGroup.O_POSITIVE,
                ComponentType.WHOLE_BLOOD, Instant.now().minus(1, ChronoUnit.DAYS),
                Instant.now().plus(30, ChronoUnit.DAYS), "COLD-ROOM", organization, null);
        unit.release(Instant.now());
        units.save(unit);
    }
}
