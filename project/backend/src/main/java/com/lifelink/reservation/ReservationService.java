package com.lifelink.reservation;

import com.lifelink.audit.AuditService;
import com.lifelink.common.exception.BusinessRuleViolationException;
import com.lifelink.common.exception.ResourceNotFoundException;
import com.lifelink.emergency.EmergencyRequest;
import com.lifelink.emergency.EmergencyRequestRepository;
import com.lifelink.identity.Permission;
import com.lifelink.identity.TenantAccessService;
import com.lifelink.inventory.BloodUnit;
import com.lifelink.inventory.BloodUnitRepository;
import com.lifelink.inventory.InventoryMovement;
import com.lifelink.inventory.InventoryMovementRepository;
import com.lifelink.organization.Organization;
import com.lifelink.organization.OrganizationRepository;
import com.lifelink.reservation.dto.ReservationDtos.CreateRequest;
import com.lifelink.reservation.dto.ReservationDtos.View;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ReservationService {
    private static final Duration RESERVATION_TTL = Duration.ofMinutes(30);

    private final ReservationRepository repository;
    private final BloodUnitRepository unitRepository;
    private final EmergencyRequestRepository requestRepository;
    private final OrganizationRepository organizationRepository;
    private final InventoryMovementRepository movementRepository;
    private final TenantAccessService tenantAccess;
    private final AuditService auditService;

    public ReservationService(ReservationRepository repository, BloodUnitRepository unitRepository,
                              EmergencyRequestRepository requestRepository,
                              OrganizationRepository organizationRepository,
                              InventoryMovementRepository movementRepository,
                              TenantAccessService tenantAccess,
                              AuditService auditService) {
        this.repository = repository;
        this.unitRepository = unitRepository;
        this.requestRepository = requestRepository;
        this.organizationRepository = organizationRepository;
        this.movementRepository = movementRepository;
        this.tenantAccess = tenantAccess;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public List<View> list() {
        tenantAccess.requirePermission(Permission.RESERVATION_READ);
        var user = tenantAccess.currentUser();
        return repository.findAll().stream()
                .filter(r -> user.isPlatformAdmin() || user.organizationIds().contains(r.getOrganization().getId()))
                .map(View::of).toList();
    }

    @Transactional(readOnly = true)
    public View get(Long id) {
        tenantAccess.requirePermission(Permission.RESERVATION_READ);
        Reservation reservation = find(id);
        tenantAccess.requireOrganization(reservation.getOrganization().getId());
        return View.of(reservation);
    }

    @Transactional
    public View create(CreateRequest request) {
        tenantAccess.requirePermission(Permission.RESERVATION_CREATE);
        var existing = repository.findByIdempotencyKey(request.idempotencyKey());
        if (existing.isPresent()) {
            return View.of(existing.get());
        }
        BloodUnit unit = unitRepository.findByIdForUpdate(request.unitId())
                .orElseThrow(() -> new ResourceNotFoundException("BloodUnit", request.unitId()));
        var raced = repository.findByIdempotencyKey(request.idempotencyKey());
        if (raced.isPresent()) {
            return View.of(raced.get());
        }
        EmergencyRequest emergencyRequest = requestRepository.findById(request.requestId())
                .orElseThrow(() -> new ResourceNotFoundException("EmergencyRequest", request.requestId()));
        if (emergencyRequest.getStatus() != EmergencyRequest.Status.APPROVED
                && emergencyRequest.getStatus() != EmergencyRequest.Status.ALLOCATING) {
            throw new BusinessRuleViolationException("Request is not approved for reservation");
        }
        Organization organization = emergencyRequest.getRequestingOrganization();
        tenantAccess.requireOrganization(organization.getId());
        Reservation reservation = new Reservation(unit, emergencyRequest, organization,
                Instant.now().plus(RESERVATION_TTL), request.idempotencyKey());
        repository.saveAndFlush(reservation);
        String before = unit.getStatus().name();
        unit.reserve(reservation.getId(), Instant.now());
        movementRepository.save(new InventoryMovement(unit, before, unit.getStatus().name(),
                "Reserved for " + emergencyRequest.getRequestNumber(), null));
        auditService.record("RESERVATION_CREATE", "RESERVATION", reservation.getPublicId(),
                organization.getId(), "SUCCESS", Map.of("unit", unit.getUnitNumber()));
        return View.of(reservation);
    }

    @Transactional
    public View confirm(Long id) {
        tenantAccess.requirePermission(Permission.RESERVATION_CONFIRM);
        Reservation reservation = find(id);
        tenantAccess.requireOrganization(reservation.getOrganization().getId());
        reservation.confirm(Instant.now());
        auditService.record("RESERVATION_CONFIRM", "RESERVATION", reservation.getPublicId(),
                reservation.getOrganization().getId(), "SUCCESS", Map.of());
        return View.of(reservation);
    }

    @Transactional
    public View cancel(Long id) {
        Reservation reservation = find(id);
        tenantAccess.requireOrganization(reservation.getOrganization().getId());
        BloodUnit unit = unitRepository.findByIdForUpdate(reservation.getBloodUnit().getId())
                .orElseThrow(() -> new ResourceNotFoundException("BloodUnit", reservation.getBloodUnit().getId()));
        reservation.cancel();
        unit.clearReservation();
        movementRepository.save(new InventoryMovement(unit, BloodUnit.Status.RESERVED.name(),
                unit.getStatus().name(), "Reservation cancelled", null));
        auditService.record("RESERVATION_CANCEL", "RESERVATION", reservation.getPublicId(),
                reservation.getOrganization().getId(), "SUCCESS", Map.of());
        return View.of(reservation);
    }

    @Transactional
    public int expireReservations() {
        List<Reservation> expired = repository.findExpired(Instant.now());
        for (Reservation reservation : expired) {
            BloodUnit unit = unitRepository.findByIdForUpdate(reservation.getBloodUnit().getId()).orElse(null);
            reservation.expire();
            if (unit != null) {
                unit.clearReservation();
                movementRepository.save(new InventoryMovement(unit, BloodUnit.Status.RESERVED.name(),
                        unit.getStatus().name(), "Reservation expired", null));
            }
            auditService.record("RESERVATION_EXPIRE", "RESERVATION", reservation.getPublicId(),
                    reservation.getOrganization().getId(), "SUCCESS", Map.of());
        }
        return expired.size();
    }

    private Reservation find(Long id) {
        return repository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Reservation", id));
    }
}
