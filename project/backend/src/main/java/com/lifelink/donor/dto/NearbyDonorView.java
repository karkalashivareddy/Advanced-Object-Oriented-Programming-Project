package com.lifelink.donor.dto;

import com.lifelink.common.BloodGroup;
import com.lifelink.donor.DonorProfile;
import java.time.Instant;

/**
 * The only view permitted for nearby donor discovery.
 *
 * <p>Contract: contains an opaque public id, blood group, availability, a coarse distance
 * band and a location freshness timestamp. It never contains internal ids, user ids,
 * names, contact details, exact or approximate coordinates, or consent details. Precondition for
 * {@link #of(DonorProfile, double)}: the profile has a valid stored location and a
 * non-negative distance; failure to satisfy it is a programmer error, not a user-facing
 * validation outcome.</p>
 */
public record NearbyDonorView(
        String publicId,
        BloodGroup bloodGroup,
        DonorProfile.Availability availability,
        String distanceBand,
        Instant locationUpdatedAt,
        String distanceMeaning) {

    public static final String DISTANCE_MEANING = "STRAIGHT_LINE_APPROXIMATE";

    public static NearbyDonorView of(DonorProfile donor, double distanceKm) {
        if (donor.location() == null || distanceKm < 0.0 || !Double.isFinite(distanceKm)) {
            throw new IllegalArgumentException("A valid donor location and distance are required");
        }
        return new NearbyDonorView(donor.getPublicId(), donor.getBloodGroup(), donor.getAvailability(),
                distanceBand(distanceKm), donor.getLocationUpdatedAt(), DISTANCE_MEANING);
    }

    /** Maps a distance to one of the four documented bands; the finder caps results at 50 km. */
    public static String distanceBand(double distanceKm) {
        if (!Double.isFinite(distanceKm) || distanceKm < 0.0) {
            throw new IllegalArgumentException("Distance must be finite and non-negative");
        }
        if (distanceKm < 5.0) {
            return "<5 km";
        }
        if (distanceKm < 10.0) {
            return "5-10 km";
        }
        if (distanceKm < 25.0) {
            return "10-25 km";
        }
        return "25-50 km";
    }
}
