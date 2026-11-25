package com.lifelink.donor;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.lifelink.common.BloodGroup;
import com.lifelink.common.GeoPoint;
import com.lifelink.identity.Role;
import com.lifelink.identity.User;
import com.lifelink.identity.UserRepository;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.PageRequest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest(properties = {"lifelink.seed.enabled=false",
        "spring.datasource.url=jdbc:h2:mem:lifelink-nearby-query;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1;DEFAULT_NULL_ORDERING=HIGH"})
@ActiveProfiles("test")
class NearbyDonorRepositoryTest {
    @Autowired private DonorProfileRepository donors;
    @Autowired private UserRepository users;
    @Autowired private ConsentRepository consents;

    @Test
    @Transactional
    void queryReturnsOnlyFreshConsentingAvailableMatchingDonorsInsideExactRadius() {
        Instant now = Instant.now();
        DonorProfile near = donor("near", BloodGroup.O_POSITIVE, DonorProfile.Availability.AVAILABLE,
                new GeoPoint(12.9716, 77.5946), now);
        donor("wrong-group", BloodGroup.A_POSITIVE, DonorProfile.Availability.AVAILABLE,
                new GeoPoint(12.9716, 77.5946), now);
        donor("unavailable", BloodGroup.O_POSITIVE, DonorProfile.Availability.UNAVAILABLE,
                new GeoPoint(12.9716, 77.5946), now);
        donor("stale", BloodGroup.O_POSITIVE, DonorProfile.Availability.AVAILABLE,
                new GeoPoint(12.9716, 77.5946), now.minusSeconds(31L * 24 * 3600));
        donor("outside", BloodGroup.O_POSITIVE, DonorProfile.Availability.AVAILABLE,
                new GeoPoint(13.2, 77.5946), now);
        donor("no-consent", BloodGroup.O_POSITIVE, DonorProfile.Availability.AVAILABLE,
                new GeoPoint(12.9716, 77.5946), now, false);

        GeoPoint origin = new GeoPoint(12.9716, 77.5946);
        GeoPoint.BoundingBox box = origin.boundingBox(5.0);
        var results = donors.findNearbyOptedIn(BloodGroup.O_POSITIVE.name(), origin.latitude(), origin.longitude(),
                box.minLatitude(), box.maxLatitude(), box.minLongitude(), box.maxLongitude(), 5.0,
                now.minusSeconds(30L * 24 * 3600), PageRequest.of(0, 20));

        assertEquals(1, results.size());
        assertEquals(near.getPublicId(), results.getFirst().getPublicId());
        assertTrue(results.getFirst().location() != null);
    }

    private DonorProfile donor(String suffix, BloodGroup group, DonorProfile.Availability availability,
                               GeoPoint point, Instant updatedAt) {
        return donor(suffix, group, availability, point, updatedAt, true);
    }

    private DonorProfile donor(String suffix, BloodGroup group, DonorProfile.Availability availability,
                               GeoPoint point, Instant updatedAt, boolean consent) {
        String unique = suffix + "-" + java.util.UUID.randomUUID();
        User user = users.save(new User(unique + "@example.test", "not-a-real-password-hash",
                "Synthetic " + suffix, null, User.Status.ACTIVE, Set.of(Role.DONOR)));
        DonorProfile profile = new DonorProfile(user, group, LocalDate.of(1990, 1, 1), null,
                "Demo City", "Demo State", "IN_APP");
        profile.setAvailability(availability);
        profile.updateLocation(point, updatedAt);
        profile = donors.save(profile);
        if (consent) consents.save(new ConsentRecord(profile, "LOCATION_DISCOVERY", true));
        return profile;
    }
}
