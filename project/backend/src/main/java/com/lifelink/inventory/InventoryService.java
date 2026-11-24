package com.lifelink.inventory;

import com.lifelink.audit.AuditService;
import com.lifelink.common.BloodGroup;
import com.lifelink.common.ComponentType;
import com.lifelink.common.PageResponse;
import com.lifelink.common.exception.ResourceNotFoundException;
import com.lifelink.common.exception.ValidationException;
import com.lifelink.dispatch.DispatchRepository;
import com.lifelink.donor.Donation;
import com.lifelink.identity.AuthenticatedUser;
import com.lifelink.identity.Permission;
import com.lifelink.identity.TenantAccessService;
import com.lifelink.identity.User;
import com.lifelink.identity.UserRepository;
import com.lifelink.organization.Organization;
import com.lifelink.organization.OrganizationRepository;
import com.lifelink.reservation.Reservation;
import com.lifelink.reservation.ReservationRepository;
import com.lifelink.inventory.dto.InventoryDtos.Alerts;
import com.lifelink.inventory.dto.InventoryDtos.CreateRequest;
import com.lifelink.inventory.dto.InventoryDtos.MovementView;
import com.lifelink.inventory.dto.InventoryDtos.View;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
public class InventoryService {
    private static final List<BloodUnit.Status> ACTIVE_STATUSES = List.of(
            BloodUnit.Status.AVAILABLE, BloodUnit.Status.RESERVED, BloodUnit.Status.QUARANTINED);
    private static final Logger log = LoggerFactory.getLogger(InventoryService.class);

    private final BloodUnitRepository unitRepository;
    private final InventoryMovementRepository movementRepository;
    private final OrganizationRepository organizationRepository;
    private final UserRepository userRepository;
    private final TenantAccessService tenantAccess;
    private final AuditService auditService;
    private final LifecycleBatches lifecycleBatches;
    private final int lowStockThreshold;

    public InventoryService(BloodUnitRepository unitRepository,
                            InventoryMovementRepository movementRepository,
                            OrganizationRepository organizationRepository,
                            UserRepository userRepository,
                            TenantAccessService tenantAccess,
                            AuditService auditService,
                            LifecycleBatches lifecycleBatches,
                            @Value("${lifelink.inventory.low-stock-threshold:10}") int lowStockThreshold) {
        this.unitRepository = unitRepository;
        this.movementRepository = movementRepository;
        this.organizationRepository = organizationRepository;
        this.userRepository = userRepository;
        this.tenantAccess = tenantAccess;
        this.auditService = auditService;
        this.lifecycleBatches = lifecycleBatches;
        this.lowStockThreshold = lowStockThreshold;
    }

    @Transactional(readOnly = true)
    public PageResponse<View> search(Long organizationId, BloodGroup bloodGroup, ComponentType componentType,
                                     BloodUnit.Status status, Integer expiringWithinDays, Pageable pageable) {
        AuthenticatedUser user = tenantAccess.currentUser();
        Long resolvedOrg = user.isPlatformAdmin()
                ? organizationId
                : tenantAccess.requireActiveOrganization(organizationId);
        if (!user.isPlatformAdmin()) {
            tenantAccess.requireOrganizationAndPermission(resolvedOrg, Permission.INVENTORY_READ);
        }
        Instant cutoff = expiringWithinDays == null ? null : Instant.now().plus(expiringWithinDays, ChronoUnit.DAYS);
        Page<View> page = unitRepository.search(resolvedOrg, bloodGroup, componentType, status,
                expiringWithinDays, cutoff, pageable).map(View::of);
        return PageResponse.from(page, value -> value);
    }

    @Transactional(readOnly = true)
    public View get(Long id) {
        BloodUnit unit = find(id);
        tenantAccess.requireOrganizationAndPermission(unit.getOrganization().getId(), Permission.INVENTORY_READ);
        return View.of(unit);
    }

    @Transactional
    public View create(CreateRequest request) {
        tenantAccess.requireOrganizationAndPermission(request.organizationId(), Permission.INVENTORY_WRITE);
        Organization organization = organizationRepository.findById(request.organizationId())
                .orElseThrow(() -> new ResourceNotFoundException("Organization", request.organizationId()));
        Instant expiresAt = request.expiresAt() == null
                ? BloodUnit.defaultExpiry(request.componentType(), request.collectedAt())
                : request.expiresAt();
        BloodUnit unit = new BloodUnit(request.unitNumber(), request.bloodGroup(), request.componentType(),
                request.collectedAt(), expiresAt, request.storageLocation(), organization, null);
        unitRepository.save(unit);
        recordMovement(unit, null, unit.getStatus().name(), "Manual unit creation");
        auditService.record("INVENTORY_UNIT_CREATE", "BLOOD_UNIT", unit.getPublicId(),
                organization.getId(), "SUCCESS", Map.of("unitNumber", unit.getUnitNumber()));
        return View.of(unit);
    }

    @Transactional
    public List<View> createFromDonation(Donation donation, List<ComponentType> components) {
        List<ComponentType> selected = components == null || components.isEmpty()
                ? List.of(ComponentType.WHOLE_BLOOD) : components;
        return selected.stream().map(component -> {
            Instant collectedAt = donation.getDonatedAt();
            String unitNumber = "LL-" + component.name().substring(0, 3) + "-"
                    + UUID.randomUUID().toString().substring(0, 10).toUpperCase();
            BloodUnit unit = new BloodUnit(unitNumber, donation.getDonor().getBloodGroup(), component,
                    collectedAt, BloodUnit.defaultExpiry(component, collectedAt), "QUARANTINE",
                    donation.getOrganization(), donation);
            unitRepository.save(unit);
            recordMovement(unit, null, unit.getStatus().name(), "Created from approved donation");
            auditService.record("INVENTORY_UNIT_CREATE", "BLOOD_UNIT", unit.getPublicId(),
                    donation.getOrganization().getId(), "SUCCESS", Map.of("unitNumber", unit.getUnitNumber()));
            return View.of(unit);
        }).toList();
    }

    @Transactional
    public View release(Long id) {
        BloodUnit unit = lockedUnit(id);
        tenantAccess.requireOrganizationAndPermission(unit.getOrganization().getId(), Permission.INVENTORY_RELEASE);
        String before = unit.getStatus().name();
        unit.release(Instant.now());
        recordMovement(unit, before, unit.getStatus().name(), "Authorized release");
        auditService.record("INVENTORY_UNIT_RELEASE", "BLOOD_UNIT", unit.getPublicId(),
                unit.getOrganization().getId(), "SUCCESS", Map.of());
        return View.of(unit);
    }

    @Transactional
    public View expire(Long id) {
        BloodUnit unit = lockedUnit(id);
        tenantAccess.requireOrganizationAndPermission(unit.getOrganization().getId(), Permission.INVENTORY_WRITE);
        String before = unit.getStatus().name();
        unit.markExpired();
        recordMovement(unit, before, unit.getStatus().name(), "Marked expired");
        auditService.record("INVENTORY_UNIT_EXPIRE", "BLOOD_UNIT", unit.getPublicId(),
                unit.getOrganization().getId(), "SUCCESS", Map.of());
        return View.of(unit);
    }

    @Transactional
    public View adjust(com.lifelink.inventory.dto.InventoryDtos.AdjustmentRequest request) {
        if (request == null || (request.delta() != null && request.delta() >= 0)) {
            throw new ValidationException("Delta must be negative to discard a unit",
                    Map.of("delta", "must be negative or omitted"));
        }
        if (request.reason() == null || request.reason().isBlank()) {
            throw new ValidationException("Reason is required", Map.of("reason", "must not be blank"));
        }
        BloodUnit unit = lockedUnit(request.unitId());
        tenantAccess.requireOrganizationAndPermission(unit.getOrganization().getId(), Permission.INVENTORY_WRITE);
        String before = unit.getStatus().name();
        boolean beforeReleased = unit.isReleased();
        String beforeLocation = unit.getStorageLocation();
        if (request.location() != null && !request.location().isBlank()) {
            unit.changeLocation(request.location());
        }
        if (request.delta() != null) {
            unit.discard(request.reason());
        }
        boolean mutated = !before.equals(unit.getStatus().name()) || beforeReleased != unit.isReleased()
                || !Objects.equals(beforeLocation, unit.getStorageLocation());
        if (mutated) {
            recordMovement(unit, before, unit.getStatus().name(), request.reason());
            auditService.record("INVENTORY_ADJUST", "BLOOD_UNIT", unit.getPublicId(),
                    unit.getOrganization().getId(), "SUCCESS", Map.of("reason", request.reason()));
        }
        return View.of(unit);
    }

    @Transactional(readOnly = true)
    public List<MovementView> movements(Long unitId) {
        BloodUnit unit = find(unitId);
        tenantAccess.requireOrganizationAndPermission(unit.getOrganization().getId(), Permission.INVENTORY_READ);
        return movementRepository.findByUnitIdOrderByOccurredAtDesc(unitId).stream()
                .map(MovementView::of).toList();
    }

    @Transactional(readOnly = true)
    public Alerts alerts() {
        AuthenticatedUser user = tenantAccess.currentUser();
        Instant now = Instant.now();
        long expiring = unitRepository.findExpiringBetween(now, now.plus(7, ChronoUnit.DAYS), ACTIVE_STATUSES)
                .stream().filter(u -> isVisibleForRead(user, u)).count();
        long expired = unitRepository.findExpiring(now, ACTIVE_STATUSES).stream()
                .filter(u -> isVisibleForRead(user, u))
                .count();
        // Low-stock is an inventory read: membership alone must not reveal an
        // organization's stock level when the caller has no effective INVENTORY_READ.
        List<Long> readableOrganizationIds = user.isPlatformAdmin() ? null
                : user.organizationIds().stream()
                        .filter(orgId -> user.hasPermissionForOrganization(Permission.INVENTORY_READ, orgId))
                        .toList();
        long lowStock = readableOrganizationIds == null
                ? organizationRepository.findAllLowStockIds(lowStockThreshold).size()
                : organizationRepository.findLowStockIds(readableOrganizationIds, lowStockThreshold).size();
        return new Alerts(expiring, expired, lowStock);
    }

    @Transactional(readOnly = true)
    public List<View> unitsForDonation(Long donationId) {
        AuthenticatedUser user = tenantAccess.currentUser();
        return unitRepository.findByDonationId(donationId).stream()
                .filter(unit -> user.isPlatformAdmin()
                        || (user.belongsTo(unit.getOrganization().getId())
                        && user.hasPermissionForOrganization(Permission.DONATION_READ,
                                unit.getOrganization().getId())))
                .map(View::of).toList();
    }

    private boolean isVisibleForRead(AuthenticatedUser user, BloodUnit unit) {
        if (user.isPlatformAdmin()) {
            return true;
        }
        Long organizationId = unit.getOrganization().getId();
        return user.belongsTo(organizationId)
                && user.hasPermissionForOrganization(Permission.INVENTORY_READ, organizationId);
    }

    /** Each item runs in its own transaction; one bad row cannot abort the whole batch. */
    public int processExpiry() {
        List<Long> expiringIds = unitRepository.findExpiring(Instant.now(), ACTIVE_STATUSES).stream()
                .map(BloodUnit::getId).toList();
        int processed = 0;
        for (Long id : expiringIds) {
            try {
                if (lifecycleBatches.expireUnit(id)) {
                    processed++;
                }
            } catch (RuntimeException ex) {
                log.warn("Lifecycle unit expiry failed for id={}: {}", id, ex.getMessage());
            }
        }
        return processed;
    }

    /**
     * FOR UPDATE is a write lock; a read-only transaction is unsafe here because
     * the driver/Hibernate may open a read-only snapshot or skip write intent.
     */
    @Transactional
    public BloodUnit findForUpdate(Long id) {
        return lockedUnit(id);
    }

    private void recordMovement(BloodUnit unit, String from, String to, String reason) {
        Long actorId = LifecycleBatches.currentActorId();
        User actor = actorId == null ? null : userRepository.findById(actorId).orElse(null);
        movementRepository.save(new InventoryMovement(unit, from, to, reason, actor));
    }

    private BloodUnit lockedUnit(Long id) {
        return unitRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new ResourceNotFoundException("BloodUnit", id));
    }

    private BloodUnit find(Long id) {
        return unitRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("BloodUnit", id));
    }

    /**
     * Per-item lifecycle transactions. Kept as a nested component to stay inside the
     * backend files owned by this workstream; both InventoryService and
     * ReservationService delegate scheduler work here.
     */
    @Service
    public static class LifecycleBatches {
        private final BloodUnitRepository unitRepository;
        private final InventoryMovementRepository movementRepository;
        private final ReservationRepository reservationRepository;
        private final DispatchRepository dispatchRepository;
        private final AuditService auditService;

        public LifecycleBatches(BloodUnitRepository unitRepository,
                                InventoryMovementRepository movementRepository,
                                ReservationRepository reservationRepository,
                                DispatchRepository dispatchRepository,
                                AuditService auditService) {
            this.unitRepository = unitRepository;
            this.movementRepository = movementRepository;
            this.reservationRepository = reservationRepository;
            this.dispatchRepository = dispatchRepository;
            this.auditService = auditService;
        }

        @Transactional(propagation = Propagation.REQUIRES_NEW)
        public boolean expireUnit(Long unitId) {
            BloodUnit unit = unitRepository.findByIdForUpdate(unitId).orElse(null);
            if (unit == null || List.of(BloodUnit.Status.DELIVERED, BloodUnit.Status.EXPIRED,
                    BloodUnit.Status.DISCARDED).contains(unit.getStatus())) {
                return false;
            }
            // A reserved unit carries both a unit pointer and a sparse reservation
            // slot. Expire the ACTIVE reservation first so neither V4 invariant is
            // left pointing at a terminal unit.
            if (unit.getStatus() == BloodUnit.Status.RESERVED && unit.getActiveReservationId() != null) {
                Reservation reservation = reservationRepository.findById(unit.getActiveReservationId()).orElse(null);
                if (reservation != null && reservation.getStatus() == Reservation.Status.ACTIVE) {
                    reservationRepository.clearActiveUnit(reservation.getId());
                    reservation.expire();
                    auditService.record("RESERVATION_EXPIRE", "RESERVATION", reservation.getPublicId(),
                            reservation.getOrganization().getId(), "SUCCESS", Map.of());
                }
            }
            String before = unit.getStatus().name();
            unit.markExpired();
            movementRepository.save(new InventoryMovement(unit, before, unit.getStatus().name(),
                    "Automatic expiry", null));
            auditService.record("INVENTORY_UNIT_EXPIRED", "BLOOD_UNIT", unit.getPublicId(),
                    unit.getOrganization().getId(), "SUCCESS", Map.of());
            return true;
        }

        @Transactional(propagation = Propagation.REQUIRES_NEW)
        public boolean expireReservation(Long reservationId) {
            Reservation reservation = reservationRepository.findById(reservationId).orElse(null);
            if (reservation == null || (reservation.getStatus() != Reservation.Status.ACTIVE
                    && reservation.getStatus() != Reservation.Status.CONFIRMED)) {
                return false;
            }
            BloodUnit unit = unitRepository.findByIdForUpdate(reservation.getBloodUnit().getId()).orElse(null);
            // Final guard under the unit lock: dispatch creates that reservation row
            // while holding that same lock, so this check cannot race with dispatch.
            // The scheduler's pre-filter is only an optimization.
            if (dispatchRepository.existsByReservationId(reservationId)) {
                return false;
            }
            reservationRepository.clearActiveUnit(reservationId);
            reservation.expire();
            if (unit != null) {
                unit.clearReservation();
                movementRepository.save(new InventoryMovement(unit, BloodUnit.Status.RESERVED.name(),
                        unit.getStatus().name(), "Reservation expired", null));
            }
            auditService.record("RESERVATION_EXPIRE", "RESERVATION", reservation.getPublicId(),
                    reservation.getOrganization().getId(), "SUCCESS", Map.of());
            return true;
        }

        /** Scheduler invocations have no authentication; movements then have no actor. */
        static Long currentActorId() {
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            return authentication != null && authentication.getPrincipal() instanceof AuthenticatedUser user
                    ? user.userId() : null;
        }
    }
}
