package com.lifelink.donor;

import com.lifelink.audit.AuditService;
import com.lifelink.common.BloodGroup;
import com.lifelink.common.GeoPoint;
import com.lifelink.common.exception.BusinessRuleViolationException;
import com.lifelink.common.exception.ResourceNotFoundException;
import com.lifelink.common.exception.ValidationException;
import com.lifelink.donor.dto.NearbyDonorSearchResponse;
import com.lifelink.donor.dto.NearbyDonorView;
import com.lifelink.identity.AuthenticatedUser;
import com.lifelink.identity.Permission;
import com.lifelink.identity.TenantAccessService;
import com.lifelink.organization.Organization;
import com.lifelink.organization.OrganizationRepository;
import java.time.Instant;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class DonorDiscoveryService {
    private static final int RESULT_LIMIT = 50;
    private static final int FETCH_LIMIT = RESULT_LIMIT + 1;
    private static final double MAX_RADIUS_KM = 50.0;
    private static final Duration MAX_LOCATION_AGE = Duration.ofDays(30);

    private final DonorProfileRepository donors;
    private final OrganizationRepository organizations;
    private final TenantAccessService access;
    private final AuditService audit;
    private final DonorSearchRateLimiter rateLimiter;

    public DonorDiscoveryService(DonorProfileRepository donors, OrganizationRepository organizations,
                                 TenantAccessService access, AuditService audit,
                                 DonorSearchRateLimiter rateLimiter) {
        this.donors = donors;
        this.organizations = organizations;
        this.access = access;
        this.audit = audit;
        this.rateLimiter = rateLimiter;
    }

    /**
     * Contract: requires an explicit active organization and DONOR_DISCOVERY_READ there;
     * only currently available donors with active LOCATION_DISCOVERY consent are returned.
     * The database performs bounded nearest-first search; at most 50 opaque results are
     * exposed. No clinical eligibility or blood compatibility is inferred.
     */
    @Transactional
    public NearbyDonorSearchResponse search(BloodGroup bloodGroup, double latitude,
                                             double longitude, double radiusKm) {
        if (bloodGroup == null) throw new ValidationException("Blood group is required");
        if (!Double.isFinite(radiusKm) || radiusKm <= 0 || radiusKm > MAX_RADIUS_KM) {
            throw new ValidationException("Search radius must be greater than 0 and at most 50 km");
        }
        GeoPoint origin;
        try {
            origin = new GeoPoint(latitude, longitude);
        } catch (IllegalArgumentException invalidPoint) {
            throw new ValidationException(invalidPoint.getMessage());
        }
        Long organizationId = access.requireExplicitCurrentOrganization();
        access.requireOrganizationAndPermission(organizationId, Permission.DONOR_DISCOVERY_READ);
        Organization organization = organizations.findById(organizationId)
                .orElseThrow(() -> new ResourceNotFoundException("Organization", organizationId));
        if (!organization.isActive() || !organization.isVerified()) {
            throw new BusinessRuleViolationException("Donor discovery requires an active, verified organization");
        }

        AuthenticatedUser actor = access.currentUser();
        rateLimiter.check(actor.userId(), Instant.now());
        GeoPoint.BoundingBox box = origin.boundingBox(radiusKm);
        List<DonorProfile> matches = donors.findNearbyOptedIn(bloodGroup.name(), latitude, longitude,
                box.minLatitude(), box.maxLatitude(), box.minLongitude(), box.maxLongitude(), radiusKm,
                Instant.now().minus(MAX_LOCATION_AGE), PageRequest.of(0, FETCH_LIMIT));
        boolean more = matches.size() > RESULT_LIMIT;
        List<NearbyDonorView> result = matches.stream().limit(RESULT_LIMIT)
                .map(donor -> NearbyDonorView.of(donor, origin.distanceKmTo(donor.location())))
                .toList();

        audit.record("DONOR_PROXIMITY_SEARCH", "DONOR_SEARCH", "DONOR_SEARCH", organizationId,
                "SUCCESS", Map.of("bloodGroup", bloodGroup.name(), "radiusKm", Double.toString(radiusKm),
                        "originCell", origin.coarseCell().format(), "returned", Integer.toString(result.size()),
                        "truncated", Boolean.toString(more)));
        return new NearbyDonorSearchResponse(result, radiusKm, result.size(), more,
                NearbyDonorView.DISTANCE_MEANING);
    }
}
