package com.lifelink.analytics;

import com.lifelink.common.BloodGroup;
import com.lifelink.common.exception.UnauthorizedOperationException;
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
    private final EmergencyRequestRepository requestRepository;
    private final ReservationRepository reservationRepository;
    private final DispatchRepository dispatchRepository;
    private final OrganizationRepository organizationRepository;
    private final TenantAccessService tenantAccess;

    public AnalyticsService(BloodUnitRepository unitRepository,
                            EmergencyRequestRepository requestRepository,
                            ReservationRepository reservationRepository,
                            DispatchRepository dispatchRepository,
                            OrganizationRepository organizationRepository,
                            TenantAccessService tenantAccess) {
        this.unitRepository = unitRepository;
        this.requestRepository = requestRepository;
        this.reservationRepository = reservationRepository;
        this.dispatchRepository = dispatchRepository;
        this.organizationRepository = organizationRepository;
        this.tenantAccess = tenantAccess;
    }

    @Transactional(readOnly = true)
    public Overview overview() {
        tenantAccess.requirePermission(Permission.ANALYTICS_READ);
        AuthenticatedUser user = tenantAccess.currentUser();
        Long organizationId = user.isPlatformAdmin() ? null : singleOrganization(user);
        long available = countUnits(organizationId, BloodUnit.Status.AVAILABLE);
        long reserved = countUnits(organizationId, BloodUnit.Status.RESERVED);
        long quarantined = countUnits(organizationId, BloodUnit.Status.QUARANTINED);
        long expiring = unitRepository.findExpiring(Instant.now().plus(7, ChronoUnit.DAYS),
                        List.of(BloodUnit.Status.AVAILABLE, BloodUnit.Status.RESERVED)).stream()
                .filter(unit -> organizationId == null || unit.getOrganization().getId().equals(organizationId))
                .count();
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
        AuthenticatedUser user = tenantAccess.currentUser();
        Long organizationId = user.isPlatformAdmin() ? null : singleOrganization(user);
        Map<String, Long> result = new LinkedHashMap<>();
        for (BloodGroup group : BloodGroup.values()) {
            result.put(group.name(), 0L);
        }
        unitRepository.findAll().stream()
                .filter(unit -> organizationId == null || unit.getOrganization().getId().equals(organizationId))
                .filter(unit -> unit.getStatus() == BloodUnit.Status.AVAILABLE)
                .forEach(unit -> result.merge(unit.getBloodGroup().name(), 1L, Long::sum));
        return result;
    }

    @Transactional(readOnly = true)
    public Map<String, Long> requestsByStatus() {
        tenantAccess.requirePermission(Permission.ANALYTICS_READ);
        AuthenticatedUser user = tenantAccess.currentUser();
        Long organizationId = user.isPlatformAdmin() ? null : singleOrganization(user);
        Map<String, Long> result = new LinkedHashMap<>();
        requestRepository.findAll().stream()
                .filter(r -> organizationId == null || r.getRequestingOrganization().getId().equals(organizationId))
                .forEach(r -> result.merge(r.getStatus().name(), 1L, Long::sum));
        return result;
    }

    private long countUnits(Long organizationId, BloodUnit.Status status) {
        return organizationId == null
                ? unitRepository.countByStatus(status)
                : unitRepository.countByOrganizationIdAndStatus(organizationId, status);
    }

    private Long singleOrganization(AuthenticatedUser user) {
        if (user.organizationIds().size() != 1) {
            throw new UnauthorizedOperationException("Select an organization to view analytics");
        }
        return user.organizationIds().iterator().next();
    }

    public record Overview(long availableUnits, long reservedUnits, long quarantinedUnits,
                           long expiringWithin7Days, long pendingRequests,
                           long activeReservations, long dispatchesInTransit, long organizations) {
    }
}
