package com.lifelink.dispatch;

import com.lifelink.audit.AuditService;
import com.lifelink.common.exception.BusinessRuleViolationException;
import com.lifelink.common.exception.ResourceNotFoundException;
import com.lifelink.dispatch.dto.DispatchDtos.CreateRequest;
import com.lifelink.dispatch.dto.DispatchDtos.DeliveryRequest;
import com.lifelink.dispatch.dto.DispatchDtos.IncidentRequest;
import com.lifelink.dispatch.dto.DispatchDtos.View;
import com.lifelink.emergency.EmergencyRequest;
import com.lifelink.emergency.EmergencyRequestService;
import com.lifelink.identity.AuthenticatedUser;
import com.lifelink.identity.Permission;
import com.lifelink.identity.TenantAccessService;
import com.lifelink.inventory.BloodUnit;
import com.lifelink.inventory.BloodUnitRepository;
import com.lifelink.inventory.InventoryMovement;
import com.lifelink.inventory.InventoryMovementRepository;
import com.lifelink.notification.NotificationService;
import com.lifelink.organization.Organization;
import com.lifelink.reservation.Reservation;
import com.lifelink.reservation.ReservationRepository;
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

    public DispatchService(DispatchRepository repository, ReservationRepository reservationRepository,
                           BloodUnitRepository unitRepository, InventoryMovementRepository movementRepository,
                           EmergencyRequestService requestService, NotificationService notificationService,
                           TenantAccessService tenantAccess, AuditService auditService) {
        this.repository = repository;
        this.reservationRepository = reservationRepository;
        this.unitRepository = unitRepository;
        this.movementRepository = movementRepository;
        this.requestService = requestService;
        this.notificationService = notificationService;
        this.tenantAccess = tenantAccess;
        this.auditService = auditService;
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
        var replay = repository.findByIdempotencyKey(key);
        if (replay.isPresent()) {
            Dispatch existing = replay.get();
            tenantAccess.requireOrganizationAndPermission(existing.getOrganization().getId(),
                    Permission.DISPATCH_CREATE);
            if (!existing.getReservation().getId().equals(request.reservationId())) {
                throw new BusinessRuleViolationException("Idempotency key was used for a different dispatch");
            }
            return View.of(existing);
        }
        Reservation reservation = reservationRepository.findById(request.reservationId())
                .orElseThrow(() -> new ResourceNotFoundException("Reservation", request.reservationId()));
        if (reservation.getStatus() != Reservation.Status.CONFIRMED) {
            throw new BusinessRuleViolationException("Only confirmed reservations can be dispatched");
        }
        Organization organization = reservation.getOrganization();
        tenantAccess.requireOrganizationAndPermission(organization.getId(), Permission.DISPATCH_CREATE);
        if (repository.findAll().stream().anyMatch(d -> d.getReservation().getId().equals(reservation.getId()))) {
            throw new BusinessRuleViolationException("A dispatch already exists for this reservation");
        }
        EmergencyRequest emergencyRequest = reservation.getRequest();
        BloodUnit unit = unitRepository.findByIdForUpdate(reservation.getBloodUnit().getId())
                .orElseThrow(() -> new ResourceNotFoundException("BloodUnit", reservation.getBloodUnit().getId()));
        Dispatch dispatch = new Dispatch(reservation, emergencyRequest, organization,
                request.assignedStaff(), key);
        repository.saveAndFlush(dispatch);
        unit.dispatch();
        movementRepository.save(new InventoryMovement(unit, BloodUnit.Status.RESERVED.name(),
                BloodUnit.Status.DISPATCHED.name(), "Dispatch created", null));
        requestService.markState(emergencyRequest.getId(), EmergencyRequest.Status.IN_TRANSIT, "DISPATCH_CREATED");
        auditService.record("DISPATCH_CREATE", "DISPATCH", dispatch.getPublicId(),
                organization.getId(), "SUCCESS", Map.of("unit", unit.getUnitNumber()));
        return View.of(dispatch);
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
        if (dispatch.getStatus() != Dispatch.Status.IN_TRANSIT) {
            throw new BusinessRuleViolationException("Dispatch must be in transit before delivery");
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
