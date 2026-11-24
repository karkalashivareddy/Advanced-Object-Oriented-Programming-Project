package com.lifelink.emergency;

import com.lifelink.audit.AuditService;
import com.lifelink.common.exception.ResourceNotFoundException;
import com.lifelink.common.exception.ValidationException;
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
import com.lifelink.reservation.ReservationService;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
public class EmergencyRequestService {
    private static final Logger log = LoggerFactory.getLogger(EmergencyRequestService.class);
    private static final List<EmergencyRequest.Status> EXPIRABLE_STATUSES = List.of(
            EmergencyRequest.Status.DRAFT, EmergencyRequest.Status.PENDING_VERIFICATION,
            EmergencyRequest.Status.VERIFIED, EmergencyRequest.Status.APPROVED,
            EmergencyRequest.Status.ALLOCATING, EmergencyRequest.Status.RESERVED);

    private final EmergencyRequestRepository repository;
    private final RequestEventRepository eventRepository;
    private final OrganizationRepository organizationRepository;
    private final TenantAccessService tenantAccess;
    private final AuditService auditService;
    private final NotificationService notificationService;
    private final ReservationService reservationService;
    private final LifecycleBatches lifecycleBatches;

    public EmergencyRequestService(EmergencyRequestRepository repository,
                                   RequestEventRepository eventRepository,
                                   OrganizationRepository organizationRepository,
                                   TenantAccessService tenantAccess,
                                   AuditService auditService,
                                   NotificationService notificationService,
                                   ReservationService reservationService,
                                   LifecycleBatches lifecycleBatches) {
        this.repository = repository;
        this.eventRepository = eventRepository;
        this.organizationRepository = organizationRepository;
        this.tenantAccess = tenantAccess;
        this.auditService = auditService;
        this.notificationService = notificationService;
        this.reservationService = reservationService;
        this.lifecycleBatches = lifecycleBatches;
    }

    @Transactional(readOnly = true)
    public List<View> list(EmergencyRequest.Status status) {
        tenantAccess.requirePermission(Permission.REQUEST_READ);
        AuthenticatedUser user = tenantAccess.currentUser();
        return repository.findAll().stream()
                .filter(request -> user.isPlatformAdmin()
                        || (user.belongsTo(request.getRequestingOrganization().getId())
                        && user.hasPermissionForOrganization(Permission.REQUEST_READ,
                                request.getRequestingOrganization().getId())))
                .filter(request -> status == null || request.getStatus() == status)
                .map(View::of)
                .toList();
    }

    @Transactional(readOnly = true)
    public Detail detail(Long id) {
        EmergencyRequest request = find(id);
        tenantAccess.requireOrganizationAndPermission(request.getRequestingOrganization().getId(),
                Permission.REQUEST_READ);
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
        EmergencyRequest request = find(id);
        tenantAccess.requireOrganizationAndPermission(request.getRequestingOrganization().getId(),
                Permission.REQUEST_APPROVE);
        Long actor = tenantAccess.currentUser().userId();
        request.verify(actor);
        recordEvent(request, "VERIFIED", "Request verified by authorized staff");
        auditService.record("REQUEST_VERIFY", "EMERGENCY_REQUEST", request.getPublicId(),
                request.getRequestingOrganization().getId(), "SUCCESS", Map.of());
        return View.of(request);
    }

    @Transactional
    public View approve(Long id) {
        EmergencyRequest request = find(id);
        tenantAccess.requireOrganizationAndPermission(request.getRequestingOrganization().getId(),
                Permission.REQUEST_APPROVE);
        request.approve(tenantAccess.currentUser().userId());
        recordEvent(request, "APPROVED", "Request approved for allocation review");
        auditService.record("REQUEST_APPROVE", "EMERGENCY_REQUEST", request.getPublicId(),
                request.getRequestingOrganization().getId(), "SUCCESS", Map.of());
        return View.of(request);
    }

    @Transactional
    public View reject(Long id, ReasonRequest request) {
        requireReason(request);
        EmergencyRequest entity = find(id);
        tenantAccess.requireOrganizationAndPermission(entity.getRequestingOrganization().getId(),
                Permission.REQUEST_APPROVE);
        entity.reject();
        recordEvent(entity, "REJECTED", request.reason());
        auditService.record("REQUEST_REJECT", "EMERGENCY_REQUEST", entity.getPublicId(),
                entity.getRequestingOrganization().getId(), "SUCCESS", Map.of("reason", request.reason()));
        return View.of(entity);
    }

    @Transactional
    public View cancel(Long id, ReasonRequest request) {
        requireReason(request);
        // Lock the request before releasing its reservations so cancellation follows
        // the same request -> unit order as lifecycle expiry and allocation.
        EmergencyRequest entity = findForUpdate(id);
        Long organizationId = entity.getRequestingOrganization().getId();
        tenantAccess.requireOrganization(organizationId);
        AuthenticatedUser user = tenantAccess.currentUser();
        if (!user.isPlatformAdmin()
                && !user.hasPermissionForOrganization(Permission.REQUEST_CREATE, organizationId)
                && !user.hasPermissionForOrganization(Permission.REQUEST_APPROVE, organizationId)) {
            throw new com.lifelink.common.exception.UnauthorizedOperationException(
                    "Missing permission to cancel this request");
        }
        entity.cancel();
        reservationService.cancelForRequest(entity.getId());
        recordEvent(entity, "CANCELLED", request.reason());
        auditService.record("REQUEST_CANCEL", "EMERGENCY_REQUEST", entity.getPublicId(),
                entity.getRequestingOrganization().getId(), "SUCCESS", Map.of());
        return View.of(entity);
    }

    @Transactional
    public View changePriority(Long id, PriorityRequest request) {
        if (request == null || request.priority() == null) {
            throw new ValidationException("Priority is required", Map.of("priority", "must not be null"));
        }
        EmergencyRequest entity = find(id);
        tenantAccess.requireOrganizationAndPermission(entity.getRequestingOrganization().getId(),
                Permission.REQUEST_APPROVE);
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

    /** Scheduler entry point: expires due requests and releases any unshipped reservations. */
    public int expireRequests() {
        Instant now = Instant.now();
        List<Long> dueIds = repository.findExpirableIds(now, EXPIRABLE_STATUSES);
        int processed = 0;
        for (Long id : dueIds) {
            try {
                if (lifecycleBatches.expireRequest(id, now)) {
                    processed++;
                }
            } catch (RuntimeException ex) {
                log.warn("Lifecycle request expiry failed for id={}: {}", id, ex.getMessage());
            }
        }
        return processed;
    }

    public EmergencyRequest findEntity(Long id) {
        return find(id);
    }

    private void requireReason(ReasonRequest request) {
        if (request == null || request.reason() == null || request.reason().isBlank()) {
            throw new ValidationException("Reason is required", Map.of("reason", "must not be blank"));
        }
    }

    private void recordEvent(EmergencyRequest request, String action, String notes) {
        eventRepository.save(new RequestEvent(request, action, notes, tenantAccess.currentUser().userId()));
    }

    private EmergencyRequest find(Long id) {
        return repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("EmergencyRequest", id));
    }

    private EmergencyRequest findForUpdate(Long id) {
        return repository.findByIdForUpdate(id)
                .orElseThrow(() -> new ResourceNotFoundException("EmergencyRequest", id));
    }

    /** Per-item transaction so scheduler work has no ambient authentication and one bad row is isolated. */
    @Service
    public static class LifecycleBatches {
        private final EmergencyRequestRepository repository;
        private final RequestEventRepository eventRepository;
        private final ReservationService reservationService;
        private final AuditService auditService;

        public LifecycleBatches(EmergencyRequestRepository repository,
                                RequestEventRepository eventRepository,
                                ReservationService reservationService,
                                AuditService auditService) {
            this.repository = repository;
            this.eventRepository = eventRepository;
            this.reservationService = reservationService;
            this.auditService = auditService;
        }

        @Transactional(propagation = Propagation.REQUIRES_NEW)
        public boolean expireRequest(Long requestId, Instant now) {
            EmergencyRequest request = repository.findByIdForUpdate(requestId).orElse(null);
            if (request == null || !EXPIRABLE_STATUSES.contains(request.getStatus())
                    || request.getRequiredBy().isAfter(now)) {
                return false;
            }
            request.expire(now);
            reservationService.expireForRequest(requestId);
            eventRepository.save(new RequestEvent(request, "EXPIRED", "Required-by time elapsed", null));
            auditService.record("REQUEST_EXPIRE", "EMERGENCY_REQUEST", request.getPublicId(),
                    request.getRequestingOrganization().getId(), "SUCCESS",
                    Map.of("requiredBy", request.getRequiredBy().toString()));
            return true;
        }
    }
}
