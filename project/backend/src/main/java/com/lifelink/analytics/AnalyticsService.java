package com.lifelink.analytics;

import com.lifelink.common.BloodGroup;
import com.lifelink.dispatch.DispatchRepository;
import com.lifelink.dispatch.Dispatch;
import com.lifelink.emergency.EmergencyRequest;
import com.lifelink.emergency.EmergencyRequestRepository;
import com.lifelink.identity.AuthenticatedUser;
import com.lifelink.identity.Permission;
import com.lifelink.identity.TenantAccessService;
import com.lifelink.inventory.BloodUnit;
import com.lifelink.inventory.BloodUnitRepository;
import com.lifelink.organization.OrganizationRepository;
import com.lifelink.reservation.Reservation;
import com.lifelink.reservation.ReservationRepository;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AnalyticsService {
    private final BloodUnitRepository unitRepository;
    private final AnalyticsReadRepository analyticsReadRepository;
    private final EmergencyRequestRepository requestRepository;
    private final ReservationRepository reservationRepository;
    private final DispatchRepository dispatchRepository;
    private final OrganizationRepository organizationRepository;
    private final TenantAccessService tenantAccess;

    public AnalyticsService(BloodUnitRepository unitRepository,
                            AnalyticsReadRepository analyticsReadRepository,
                            EmergencyRequestRepository requestRepository,
                            ReservationRepository reservationRepository,
                            DispatchRepository dispatchRepository,
                            OrganizationRepository organizationRepository,
                            TenantAccessService tenantAccess) {
        this.unitRepository = unitRepository;
        this.analyticsReadRepository = analyticsReadRepository;
        this.requestRepository = requestRepository;
        this.reservationRepository = reservationRepository;
        this.dispatchRepository = dispatchRepository;
        this.organizationRepository = organizationRepository;
        this.tenantAccess = tenantAccess;
    }

    @Transactional(readOnly = true)
    public Overview overview() {
        tenantAccess.requirePermission(Permission.ANALYTICS_READ);
        Long organizationId = selectedOrganizationId();
        long available = countUnits(organizationId, BloodUnit.Status.AVAILABLE);
        long reserved = countUnits(organizationId, BloodUnit.Status.RESERVED);
        long quarantined = countUnits(organizationId, BloodUnit.Status.QUARANTINED);
        long expiring = analyticsReadRepository.countExpiring(
                organizationId, Instant.now().plus(7, ChronoUnit.DAYS));
        long pendingRequests = organizationId == null
                ? requestRepository.countByStatus(EmergencyRequest.Status.PENDING_VERIFICATION)
                : requestRepository.countByRequestingOrganizationIdAndStatus(
                        organizationId, EmergencyRequest.Status.PENDING_VERIFICATION);
        long activeReservations = organizationId == null
                ? reservationRepository.countByStatus(Reservation.Status.ACTIVE)
                : reservationRepository.countByOrganizationIdAndStatus(organizationId, Reservation.Status.ACTIVE);
        long inTransit = organizationId == null
                ? dispatchRepository.countByStatus(Dispatch.Status.IN_TRANSIT)
                : dispatchRepository.countByOrganizationIdAndStatus(organizationId, Dispatch.Status.IN_TRANSIT);
        long organizations = organizationId == null ? organizationRepository.count() : 1L;
        return new Overview(available, reserved, quarantined, expiring, pendingRequests,
                activeReservations, inTransit, organizations);
    }

    @Transactional(readOnly = true)
    public Map<String, Long> inventoryByGroup() {
        tenantAccess.requirePermission(Permission.ANALYTICS_READ);
        Long organizationId = selectedOrganizationId();
        Map<String, Long> result = new LinkedHashMap<>();
        for (BloodGroup group : BloodGroup.values()) {
            result.put(group.name(), 0L);
        }
        for (Object[] row : analyticsReadRepository.inventoryByBloodGroup(organizationId)) {
            BloodGroup group = (BloodGroup) row[0];
            long count = ((Number) row[1]).longValue();
            result.put(group.name(), count);
        }
        return result;
    }

    @Transactional(readOnly = true)
    public Map<String, Long> requestsByStatus() {
        tenantAccess.requirePermission(Permission.ANALYTICS_READ);
        Long organizationId = selectedOrganizationId();
        Map<String, Long> result = new LinkedHashMap<>();
        for (Object[] row : analyticsReadRepository.requestsByStatus(organizationId)) {
            EmergencyRequest.Status status = (EmergencyRequest.Status) row[0];
            long count = ((Number) row[1]).longValue();
            result.put(status.name(), count);
        }
        return result;
    }

    private long countUnits(Long organizationId, BloodUnit.Status status) {
        return organizationId == null
                ? unitRepository.countByStatus(status)
                : unitRepository.countByOrganizationIdAndStatus(organizationId, status);
    }

    /**
     * Uses the same validated request scope as every other tenant-aware endpoint.
     * Platform admins may omit the header for an explicit global view; all other users
     * must have one membership or select one with X-Organization-Id.
     */
    private Long selectedOrganizationId() {
        AuthenticatedUser user = tenantAccess.currentUser();
        return user.isPlatformAdmin() ? tenantAccess.currentOrganizationId() : tenantAccess.requireCurrentOrganization();
    }

    public record Overview(long availableUnits, long reservedUnits, long quarantinedUnits,
                           long expiringWithin7Days, long pendingRequests,
                           long activeReservations, long dispatchesInTransit, long organizations) {
    }
}
