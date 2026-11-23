package com.lifelink.dispatch;

import com.lifelink.audit.AuditService;
import com.lifelink.common.exception.BusinessRuleViolationException;
import com.lifelink.common.exception.ResourceNotFoundException;
import com.lifelink.common.exception.UnauthorizedOperationException;
import com.lifelink.dispatch.dto.DispatchDtos.CreateRequest;
import com.lifelink.dispatch.dto.DispatchDtos.DeliveryRequest;
import com.lifelink.dispatch.dto.DispatchDtos.IncidentRequest;
import com.lifelink.dispatch.dto.DispatchDtos.View;
import com.lifelink.emergency.EmergencyRequest;
import com.lifelink.emergency.EmergencyRequestService;
import com.lifelink.identity.AuthenticatedUser;
import com.lifelink.identity.Permission;
import com.lifelink.identity.Role;
import com.lifelink.identity.TenantAccessService;
import com.lifelink.inventory.BloodUnit;
import com.lifelink.inventory.BloodUnitRepository;
import com.lifelink.inventory.InventoryMovement;
import com.lifelink.inventory.InventoryMovementRepository;
import com.lifelink.notification.NotificationService;
import com.lifelink.organization.Organization;
import com.lifelink.reservation.Reservation;
import com.lifelink.reservation.ReservationRepository;
import com.lifelink.reservation.ReservationService.Idempotency;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class DispatchService {
    private final DispatchRepository repository;
    private final ReservationRepository reservationRepository;
    private final BloodUnitRepository unitRepository;
    private final InventoryMovementRepository movementRepository;
    private final EmergencyRequestService requestService;
    private final NotificationService notificationService;
    private final TenantAccessService tenantAccess;
    private final AuditService auditService;
    private final Idempotency idempotency;

    public DispatchService(DispatchRepository repository, ReservationRepository reservationRepository,
                           BloodUnitRepository unitRepository, InventoryMovementRepository movementRepository,
                           EmergencyRequestService requestService, NotificationService notificationService,
                           TenantAccessService tenantAccess, AuditService auditService,
                           Idempotency idempotency) {
        this.repository = repository;
        this.reservationRepository = reservationRepository;
        this.unitRepository = unitRepository;
        this.movementRepository = movementRepository;
        this.requestService = requestService;
        this.notificationService = notificationService;
        this.tenantAccess = tenantAccess;
        this.auditService = auditService;
        this.idempotency = idempotency;
    }

    @Transactional(readOnly = true)
    public List<View> list() {
        AuthenticatedUser user = tenantAccess.currentUser();
        return repository.findAll().stream()
                .filter(dispatch -> user.isPlatformAdmin()
                        || (user.belongsTo(dispatch.getOrganization().getId())
                        && user.hasPermissionForOrganization(Permission.DISPATCH_READ,
                                dispatch.getOrganization().getId())))
                .map(View::of).toList();
    }

    @Transactional(readOnly = true)
    public View get(Long id) {
        Dispatch dispatch = find(id);
        tenantAccess.requireOrganizationAndPermission(dispatch.getOrganization().getId(),
                Permission.DISPATCH_READ);
        return View.of(dispatch);
    }

    @Transactional
    public View create(CreateRequest request, String idempotencyKey) {
        if (idempotencyKey == null || idempotencyKey.isBlank()) {
            throw new BusinessRuleViolationException("Idempotency-Key header is required");
        }
        String key = idempotencyKey.trim();
        Reservation reservation = reservationRepository.findById(request.reservationId())
                .orElseThrow(() -> new ResourceNotFoundException("Reservation", request.reservationId()));
        if (reservation.getStatus() != Reservation.Status.CONFIRMED) {
            throw new BusinessRuleViolationException("Only confirmed reservations can be dispatched");
        }
        // Lock the supplied unit before the idempotency claim so same-key replays and
        // competing reservations for the same unit serialize on a single row.
        BloodUnit unit = unitRepository.findByIdForUpdate(reservation.getBloodUnit().getId())
                .orElseThrow(() -> new ResourceNotFoundException("BloodUnit", reservation.getBloodUnit().getId()));
        Organization requestingOrganization = reservation.getOrganization();
        Organization supplyingOrganization = unit.getOrganization();
        requireDispatchCreatePermission(requestingOrganization, supplyingOrganization);
        // The replayed View contains assignedStaff, so it is part of the request
        // identity: the same key with different staff must be a fingerprint conflict.
        String hash = Idempotency.fingerprint(String.valueOf(request.reservationId()),
                request.assignedStaff().trim());
        return idempotency.execute(Idempotency.DISPATCH_CREATE, key, hash, View.class, () -> {
            if (repository.existsByReservationId(reservation.getId())) {
                throw new BusinessRuleViolationException("A dispatch already exists for this reservation");
            }
            EmergencyRequest emergencyRequest = reservation.getRequest();
            Dispatch dispatch = new Dispatch(reservation, emergencyRequest, supplyingOrganization,
                    request.assignedStaff(), key);
            repository.saveAndFlush(dispatch);
            unit.dispatch();
            // The unit is no longer reserved once dispatch owns it; keep the
            // status/pointer invariant enforced by V4 before the transaction commits.
            unit.clearReservation();
            movementRepository.save(new InventoryMovement(unit, BloodUnit.Status.RESERVED.name(),
                    BloodUnit.Status.DISPATCHED.name(), "Dispatch created", null));
            requestService.markState(emergencyRequest.getId(), EmergencyRequest.Status.IN_TRANSIT, "DISPATCH_CREATED");
            auditService.record("DISPATCH_CREATE", "DISPATCH", dispatch.getPublicId(),
                    supplyingOrganization.getId(), "SUCCESS", Map.of("unit", unit.getUnitNumber()));
            return View.of(dispatch);
        });
    }

    /**
     * Dispatch is a blood-bank action: authorization must be checked against the
     * organization that supplied the unit, not the hospital that requested it.
     * Hospital membership never grants DISPATCH_CREATE. Users outside both tenants
     * still receive the original tenant-denial response.
     */
    private void requireDispatchCreatePermission(Organization requestingOrganization,
                                                 Organization supplyingOrganization) {
        AuthenticatedUser user = tenantAccess.currentUser();
        if (user.isPlatformAdmin()) {
            tenantAccess.requirePermission(Permission.DISPATCH_CREATE);
            return;
        }
        Long supplierOrgId = supplyingOrganization.getId();
        boolean bankStaffAtSupplier = supplyingOrganization.getType() == Organization.Type.BLOOD_BANK
                && user.belongsTo(supplierOrgId)
                && user.hasPermissionForOrganization(Permission.DISPATCH_CREATE, supplierOrgId)
                && user.memberships().stream()
                        .anyMatch(member -> supplierOrgId.equals(member.organizationId())
                                && (member.role() == Role.BLOOD_BANK_ADMIN
                                || member.role() == Role.INVENTORY_MANAGER));
        if (bankStaffAtSupplier) {
            return;
        }
        tenantAccess.requireOrganizationAndPermission(requestingOrganization.getId(), Permission.DISPATCH_CREATE);
        throw new UnauthorizedOperationException(
                "Dispatch creation requires blood-bank staff access to the supplying organization");
    }

    @Transactional
    public View depart(Long id) {
        Dispatch dispatch = find(id);
        tenantAccess.requireOrganizationAndPermission(dispatch.getOrganization().getId(),
                Permission.DISPATCH_MANAGE);
        dispatch.depart();
        auditService.record("DISPATCH_DEPART", "DISPATCH", dispatch.getPublicId(),
                dispatch.getOrganization().getId(), "SUCCESS", Map.of());
        return View.of(dispatch);
    }

    @Transactional
    public View deliver(Long id, DeliveryRequest request) {
        Dispatch dispatch = find(id);
        tenantAccess.requireOrganizationAndPermission(dispatch.getOrganization().getId(),
                Permission.DISPATCH_MANAGE);
        // Match Dispatch.deliver(), which explicitly allows recovery and delivery
        // after an INCIDENT has been reported. Only truly terminal/early states are
        // rejected here; the aggregate remains the single transition authority.
        if (dispatch.getStatus() != Dispatch.Status.IN_TRANSIT
                && dispatch.getStatus() != Dispatch.Status.INCIDENT) {
            throw new BusinessRuleViolationException("Dispatch must be in transit or have an open incident before delivery");
        }
        dispatch.deliver(request.recipientName());
        BloodUnit unit = unitRepository.findByIdForUpdate(dispatch.getReservation().getBloodUnit().getId())
                .orElseThrow(() -> new ResourceNotFoundException("BloodUnit", dispatch.getReservation().getBloodUnit().getId()));
        unit.deliver();
        movementRepository.save(new InventoryMovement(unit, BloodUnit.Status.DISPATCHED.name(),
                BloodUnit.Status.DELIVERED.name(), "Delivery confirmed", null));
        requestService.markState(dispatch.getRequest().getId(), EmergencyRequest.Status.FULFILLED, "DELIVERY_CONFIRMED");
        notificationService.notifyOrganizationAdmins(dispatch.getOrganization().getId(), "Delivery confirmed",
                dispatch.getRequest().getRequestNumber() + " was delivered", "DELIVERY_CONFIRMED");
        auditService.record("DISPATCH_DELIVER", "DISPATCH", dispatch.getPublicId(),
                dispatch.getOrganization().getId(), "SUCCESS", Map.of());
        return View.of(dispatch);
    }

    @Transactional
    public View incident(Long id, IncidentRequest request) {
        Dispatch dispatch = find(id);
        tenantAccess.requireOrganizationAndPermission(dispatch.getOrganization().getId(),
                Permission.DISPATCH_MANAGE);
        dispatch.reportIncident(request.description());
        auditService.record("DISPATCH_INCIDENT", "DISPATCH", dispatch.getPublicId(),
                dispatch.getOrganization().getId(), "FAILURE", Map.of("reason", request.description()));
        return View.of(dispatch);
    }

    private Dispatch find(Long id) {
        return repository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Dispatch", id));
    }
}
