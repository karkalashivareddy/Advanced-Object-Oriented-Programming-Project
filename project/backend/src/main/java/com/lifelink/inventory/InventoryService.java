package com.lifelink.inventory;

import com.lifelink.audit.AuditService;
import com.lifelink.common.BloodGroup;
import com.lifelink.common.ComponentType;
import com.lifelink.common.PageResponse;
import com.lifelink.common.exception.BusinessRuleViolationException;
import com.lifelink.common.exception.ResourceNotFoundException;
import com.lifelink.donor.Donation;
import com.lifelink.identity.AuthenticatedUser;
import com.lifelink.identity.Permission;
import com.lifelink.identity.TenantAccessService;
import com.lifelink.identity.User;
import com.lifelink.identity.UserRepository;
import com.lifelink.organization.Organization;
import com.lifelink.organization.OrganizationRepository;
import com.lifelink.inventory.dto.InventoryDtos.Alerts;
import com.lifelink.inventory.dto.InventoryDtos.CreateRequest;
import com.lifelink.inventory.dto.InventoryDtos.MovementView;
import com.lifelink.inventory.dto.InventoryDtos.View;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class InventoryService {
    private static final List<BloodUnit.Status> ACTIVE_STATUSES = List.of(
            BloodUnit.Status.AVAILABLE, BloodUnit.Status.RESERVED, BloodUnit.Status.QUARANTINED);

    private final BloodUnitRepository unitRepository;
    private final InventoryMovementRepository movementRepository;
    private final OrganizationRepository organizationRepository;
    private final UserRepository userRepository;
    private final TenantAccessService tenantAccess;
    private final AuditService auditService;

    public InventoryService(BloodUnitRepository unitRepository,
                            InventoryMovementRepository movementRepository,
                            OrganizationRepository organizationRepository,
                            UserRepository userRepository,
                            TenantAccessService tenantAccess,
                            AuditService auditService) {
        this.unitRepository = unitRepository;
        this.movementRepository = movementRepository;
        this.organizationRepository = organizationRepository;
        this.userRepository = userRepository;
        this.tenantAccess = tenantAccess;
        this.auditService = auditService;
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
        BloodUnit unit = lockedUnit(request.unitId());
        tenantAccess.requireOrganizationAndPermission(unit.getOrganization().getId(), Permission.INVENTORY_WRITE);
        String before = unit.getStatus().name();
        if (request.location() != null && !request.location().isBlank()) {
            unit.changeLocation(request.location());
        }
        if (request.delta() != null && request.delta() < 0) {
            unit.discard(request.reason());
        }
        recordMovement(unit, before, unit.getStatus().name(), request.reason());
        auditService.record("INVENTORY_ADJUST", "BLOOD_UNIT", unit.getPublicId(),
                unit.getOrganization().getId(), "SUCCESS", Map.of("reason", request.reason()));
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
        Instant soon = Instant.now().plus(7, ChronoUnit.DAYS);
        long expiring = unitRepository.findExpiring(soon, ACTIVE_STATUSES).stream()
                .filter(u -> isVisibleForRead(user, u))
                .count();
        long expired = unitRepository.findExpiring(Instant.now(), ACTIVE_STATUSES).stream()
                .filter(u -> isVisibleForRead(user, u))
                .count();
        return new Alerts(expiring, expired, 0);
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

    @Transactional
    public int processExpiry() {
        List<BloodUnit> expiring = unitRepository.findExpiring(Instant.now(),
                List.of(BloodUnit.Status.AVAILABLE, BloodUnit.Status.RESERVED, BloodUnit.Status.QUARANTINED));
        expiring.forEach(unit -> {
            String before = unit.getStatus().name();
            unit.markExpired();
            recordMovement(unit, before, unit.getStatus().name(), "Automatic expiry");
            auditService.record("INVENTORY_UNIT_EXPIRED", "BLOOD_UNIT", unit.getPublicId(),
                    unit.getOrganization().getId(), "SUCCESS", Map.of());
        });
        return expiring.size();
    }

    @Transactional(readOnly = true)
    public BloodUnit findForUpdate(Long id) {
        return lockedUnit(id);
    }

    private void recordMovement(BloodUnit unit, String from, String to, String reason) {
        User actor = userRepository.findById(tenantAccess.currentUser().userId()).orElse(null);
        movementRepository.save(new InventoryMovement(unit, from, to, reason, actor));
    }

    private BloodUnit lockedUnit(Long id) {
        return unitRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new ResourceNotFoundException("BloodUnit", id));
    }

    private BloodUnit find(Long id) {
        return unitRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("BloodUnit", id));
    }
}
