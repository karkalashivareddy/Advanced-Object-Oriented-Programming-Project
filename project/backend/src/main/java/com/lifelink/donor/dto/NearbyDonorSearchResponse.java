package com.lifelink.donor.dto;

import java.util.List;

/** Bounded proximity-search result; results may be truncated at the server cap. */
public record NearbyDonorSearchResponse(
        List<NearbyDonorView> donors,
        double radiusKm,
        int returnedCount,
        boolean moreMatchesAvailable,
        String distanceMeaning) {

    public NearbyDonorSearchResponse {
        donors = List.copyOf(donors);
    }
}
