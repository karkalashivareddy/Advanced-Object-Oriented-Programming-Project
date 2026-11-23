package com.lifelink.emergency;

import com.lifelink.audit.AuditService;
import com.lifelink.common.exception.ResourceNotFoundException;
import com.lifelink.emergency.dto.RequestDtos.CreateRequest;
import com.lifelink.emergency.dto.RequestDtos.Detail;
import com.lifelink.emergency.dto.RequestDtos.EventView;
import com.lifelink.emergency.dto.RequestDtos.PriorityRequest;
import com.lifelink.emergency.dto.RequestDtos.ReasonRequest;
import com.lifelink.emergency.dto.RequestDtos.View;
import com.lifelink.identity.AuthenticatedUser;
import com.lifelink.identity.Permission;
import com.lifelink.identity.TenantAccessService;
import com.lifelink.notification.NotificationService;
import com.lifelink.organization.Organization;
import com.lifelink.organization.OrganizationRepository;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class EmergencyRequestService {
    private final EmergencyRequestRepository repository;
    private final RequestEventRepository eventRepository;
    private final OrganizationRepository organizationRepository;
    private final TenantAccessService tenantAccess;
    private final AuditService auditService;
    private final NotificationService notificationService;

    public EmergencyRequestService(EmergencyRequestRepository repository,
                                   RequestEventRepository eventRepository,
                                   OrganizationRepository organizationRepository,
                                   TenantAccessService tenantAccess,
                                   AuditService auditService,
                                   NotificationService notificationService) {
        this.repository = repository;
        this.eventRepository = eventRepository;
        this.organizationRepository = organizationRepository;
        this.tenantAccess = tenantAccess;
        this.auditService = auditService;
        this.notificationService = notificationService;
    }

    @Transactional(readOnly = true)
    public List<View> list(EmergencyRequest.Status status) {
        tenantAccess.requirePermission(Permission.REQUEST_READ);
        AuthenticatedUser user = tenantAccess.currentUser();
        return repository.findAll().stream()
                .filter(request -> user.isPlatformAdmin()
                        || user.organizationIds().contains(request.getRequestingOrganization().getId()))
                .filter(request -> status == null || request.getStatus() == status)
                .map(View::of)
                .toList();
    }

    @Transactional(readOnly = true)
    public Detail detail(Long id) {
        tenantAccess.requirePermission(Permission.REQUEST_READ);
        EmergencyRequest request = find(id);
        tenantAccess.requireOrganization(request.getRequestingOrganization().getId());
        List<EventView> events = eventRepository.findByRequestIdOrderByOccurredAtDesc(id).stream()
                .map(EventView::of).toList();
        return new Detail(View.of(request), events);
    }

    @Transactional
    public View create(CreateRequest request) {
        tenantAccess.requireOrganizationAndPermission(request.organizationId(), Permission.REQUEST_CREATE);
        Organization organization = organizationRepository.findById(request.organizationId())
                .orElseThrow(() -> new ResourceNotFoundException("Organization", request.organizationId()));
        String number = "LL-ER-" + Instant.now().getEpochSecond() + "-"
                + UUID.randomUUID().toString().substring(0, 4).toUpperCase();
        EmergencyRequest entity = new EmergencyRequest(number, organization, request.patientRef(),
                request.bloodGroup(), request.componentType(), request.quantity(), request.priority(),
                request.requiredBy(), request.reason(), tenantAccess.currentUser().userId());
        repository.save(entity);
        recordEvent(entity, "CREATED", "Emergency request created");
        auditService.record("REQUEST_CREATE", "EMERGENCY_REQUEST", entity.getPublicId(),
                organization.getId(), "SUCCESS", Map.of());
        notificationService.notifyOrganizationAdmins(organization.getId(), "New emergency request",
                entity.getRequestNumber() + " requires verification", "REQUEST_CREATED");
        return View.of(entity);
    }

    @Transactional
    public View verify(Long id) {
        tenantAccess.requirePermission(Permission.REQUEST_APPROVE);
        EmergencyRequest request = find(id);
        tenantAccess.requireOrganization(request.getRequestingOrganization().getId());
        Long actor = tenantAccess.currentUser().userId();
        request.verify(actor);
        recordEvent(request, "VERIFIED", "Request verified by authorized staff");
        auditService.record("REQUEST_VERIFY", "EMERGENCY_REQUEST", request.getPublicId(),
                request.getRequestingOrganization().getId(), "SUCCESS", Map.of());
        return View.of(request);
    }

    @Transactional
    public View approve(Long id) {
        tenantAccess.requirePermission(Permission.REQUEST_APPROVE);
        EmergencyRequest request = find(id);
        tenantAccess.requireOrganization(request.getRequestingOrganization().getId());
        request.approve(tenantAccess.currentUser().userId());
        recordEvent(request, "APPROVED", "Request approved for allocation review");
        auditService.record("REQUEST_APPROVE", "EMERGENCY_REQUEST", request.getPublicId(),
                request.getRequestingOrganization().getId(), "SUCCESS", Map.of());
        return View.of(request);
    }

    @Transactional
    public View reject(Long id, ReasonRequest request) {
        tenantAccess.requirePermission(Permission.REQUEST_APPROVE);
        EmergencyRequest entity = find(id);
        tenantAccess.requireOrganization(entity.getRequestingOrganization().getId());
        entity.reject();
        recordEvent(entity, "REJECTED", request.reason());
        auditService.record("REQUEST_REJECT", "EMERGENCY_REQUEST", entity.getPublicId(),
                entity.getRequestingOrganization().getId(), "SUCCESS", Map.of("reason", request.reason()));
        return View.of(entity);
    }

    @Transactional
    public View cancel(Long id, ReasonRequest request) {
        EmergencyRequest entity = find(id);
        tenantAccess.requireOrganization(entity.getRequestingOrganization().getId());
        entity.cancel();
        recordEvent(entity, "CANCELLED", request.reason());
        auditService.record("REQUEST_CANCEL", "EMERGENCY_REQUEST", entity.getPublicId(),
                entity.getRequestingOrganization().getId(), "SUCCESS", Map.of());
        return View.of(entity);
    }

    @Transactional
    public View changePriority(Long id, PriorityRequest request) {
        tenantAccess.requirePermission(Permission.REQUEST_APPROVE);
        EmergencyRequest entity = find(id);
        tenantAccess.requireOrganization(entity.getRequestingOrganization().getId());
        entity.changePriority(request.priority(), true);
        recordEvent(entity, "PRIORITY_CHANGE", "Priority set to " + request.priority());
        auditService.record("REQUEST_PRIORITY", "EMERGENCY_REQUEST", entity.getPublicId(),
                entity.getRequestingOrganization().getId(), "SUCCESS", Map.of("priority", request.priority().name()));
        return View.of(entity);
    }

    @Transactional
    public void markState(Long id, EmergencyRequest.Status status, String event) {
        EmergencyRequest request = find(id);
        switch (status) {
            case ALLOCATING -> request.markAllocating();
            case RESERVED -> request.markReserved();
            case IN_TRANSIT -> request.markInTransit();
            case FULFILLED -> request.fulfil();
            default -> throw new IllegalArgumentException("Unsupported request state: " + status);
        }
        recordEvent(request, event, "Automatic workflow transition");
    }

    public EmergencyRequest findEntity(Long id) {
        return find(id);
    }

    private void recordEvent(EmergencyRequest request, String action, String notes) {
        eventRepository.save(new RequestEvent(request, action, notes, tenantAccess.currentUser().userId()));
    }

    private EmergencyRequest find(Long id) {
        return repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("EmergencyRequest", id));
    }
}
