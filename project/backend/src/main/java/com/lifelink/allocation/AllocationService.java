package com.lifelink.allocation;

import com.lifelink.audit.AuditService;
import com.lifelink.common.exception.BusinessRuleViolationException;
import com.lifelink.common.exception.ResourceNotFoundException;
import com.lifelink.common.exception.TenantAccessDeniedException;
import com.lifelink.common.exception.UnauthorizedOperationException;
import com.lifelink.emergency.EmergencyRequest;
import com.lifelink.emergency.EmergencyRequestRepository;
import com.lifelink.emergency.EmergencyRequestService;
import com.lifelink.identity.AuthenticatedUser;
import com.lifelink.identity.Permission;
import com.lifelink.identity.TenantAccessService;
import com.lifelink.inventory.BloodUnit;
import com.lifelink.inventory.BloodUnitRepository;
import com.lifelink.reservation.Reservation;
import com.lifelink.reservation.ReservationRepository;
import com.lifelink.reservation.ReservationService;
import com.lifelink.reservation.dto.ReservationDtos.CreateRequest;
import com.lifelink.reservation.dto.ReservationDtos.View;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AllocationService {
    private final EmergencyRequestRepository requestRepository;
    private final EmergencyRequestService requestService;
    private final BloodUnitRepository unitRepository;
    private final ReservationService reservationService;
    private final ReservationRepository reservationRepository;
    private final AllocationStrategy strategy;
    private final CompatibilitySpecification specification;
    private final TenantAccessService tenantAccess;
    private final AuditService auditService;
    private final String ruleVersion;

    public AllocationService(EmergencyRequestRepository requestRepository,
                             EmergencyRequestService requestService,
                             BloodUnitRepository unitRepository,
                             ReservationService reservationService,
                             ReservationRepository reservationRepository,
                             AllocationStrategy strategy,
                             CompatibilitySpecification specification,
                             TenantAccessService tenantAccess,
                             AuditService auditService,
                             @Value("${lifelink.allocation.rule-version}") String ruleVersion) {
        this.requestRepository = requestRepository;
        this.requestService = requestService;
        this.unitRepository = unitRepository;
        this.reservationService = reservationService;
        this.reservationRepository = reservationRepository;
        this.strategy = strategy;
        this.specification = specification;
        this.tenantAccess = tenantAccess;
        this.auditService = auditService;
        this.ruleVersion = ruleVersion;
    }

    @Transactional(readOnly = true)
    public Suggestion suggest(Long requestId) {
        EmergencyRequest request = findRequest(requestId);
        Set<Long> supplierOrgIds = authorizedSupplierOrganizations();
        requireRequestAccess(request, supplierOrgIds);
        requireAllocationPermission(supplierOrgIds, Permission.ALLOCATION_REVIEW);
        if (request.getStatus() != EmergencyRequest.Status.APPROVED
                && request.getStatus() != EmergencyRequest.Status.ALLOCATING) {
            throw new BusinessRuleViolationException("Request must be approved before allocation review");
        }
        List<BloodUnit> candidates = candidateUnits(supplierOrgIds, request);
        List<AllocationCandidate> evaluated = strategy.evaluate(new AllocationContext(
                request.getBloodGroup(), request.getComponentType(), request.getQuantity(), request.getRequiredBy()),
                candidates);
        long eligible = evaluated.stream().filter(AllocationCandidate::eligible).count();
        String feasibility = eligible >= request.getQuantity() ? "SUFFICIENT_CANDIDATES" : "INSUFFICIENT_CANDIDATES";
        auditService.record("ALLOCATION_SUGGESTION", "EMERGENCY_REQUEST", request.getPublicId(),
                request.getRequestingOrganization().getId(), "SUCCESS",
                Map.of("eligible", String.valueOf(eligible), "ruleVersion", ruleVersion));
        return new Suggestion(requestId, ruleVersion, specification.name(), true,
                feasibility, evaluated);
    }

    @Transactional
    public Confirmation confirm(Long requestId, List<Long> unitIds, String idempotencyKey) {
        EmergencyRequest request = findRequestForUpdate(requestId);
        Set<Long> supplierOrgIds = authorizedSupplierOrganizations();
        requireRequestAccess(request, supplierOrgIds);
        requireAllocationPermission(supplierOrgIds, Permission.ALLOCATION_CONFIRM);
        if (unitIds == null || unitIds.isEmpty() || unitIds.size() != request.getQuantity()
                || Set.copyOf(unitIds).size() != unitIds.size()) {
            throw new BusinessRuleViolationException("The number of distinct units must match the requested quantity");
        }
        if (idempotencyKey == null || idempotencyKey.isBlank()) {
            throw new BusinessRuleViolationException("Idempotency key is required");
        }
        List<View> prior = new ArrayList<>();
        for (int index = 0; index < unitIds.size(); index++) {
            String key = idempotencyKey + ":" + index;
            var existing = reservationRepository.findByIdempotencyKey(key);
            if (existing.isPresent()) {
                prior.add(View.of(existing.get()));
            }
        }
        if (!prior.isEmpty()) {
            if (prior.size() == unitIds.size()) {
                return new Confirmation(requestId, prior);
            }
            throw new BusinessRuleViolationException("Idempotency key was used for a different allocation");
        }
        if (request.getStatus() != EmergencyRequest.Status.APPROVED
                && request.getStatus() != EmergencyRequest.Status.ALLOCATING) {
            throw new BusinessRuleViolationException("Request is not approved for allocation");
        }
        requestService.markState(requestId, EmergencyRequest.Status.ALLOCATING, "ALLOCATION_STARTED");
        List<View> reservations = new ArrayList<>();
        for (int index = 0; index < unitIds.size(); index++) {
            long unitId = unitIds.get(index);
            BloodUnit unit = unitRepository.findByIdForUpdate(unitId)
                    .orElseThrow(() -> new ResourceNotFoundException("BloodUnit", unitId));
            requireUnitAccess(unit, supplierOrgIds);
            if (unit.getComponentType() != request.getComponentType()
                    || !specification.isSatisfiedBy(request.getBloodGroup(), unit.getBloodGroup())) {
                throw new BusinessRuleViolationException("Selected unit is not compatible with this request");
            }
            reservations.add(reservationService.create(
                    new CreateRequest(unit.getId(), requestId, idempotencyKey + ":" + index)));
        }
        requestService.markState(requestId, EmergencyRequest.Status.RESERVED, "RESERVATIONS_CREATED");
        auditService.record("ALLOCATION_CONFIRM", "EMERGENCY_REQUEST", request.getPublicId(),
                request.getRequestingOrganization().getId(), "SUCCESS",
                Map.of("unitCount", String.valueOf(unitIds.size())));
        return new Confirmation(requestId, reservations);
    }

    private List<BloodUnit> candidateUnits(Set<Long> supplierOrgIds, EmergencyRequest request) {
        Instant now = Instant.now();
        if (tenantAccess.currentUser().isPlatformAdmin()) {
            return unitRepository.findAvailableCandidates(null, request.getBloodGroup(),
                    request.getComponentType(), now);
        }
        if (supplierOrgIds.isEmpty()) {
            return List.of();
        }
        return unitRepository.findAvailableCandidatesForOrganizations(supplierOrgIds, request.getBloodGroup(),
                request.getComponentType(), now);
    }

    /** An empty set means platform admin, which is allowed to see all supplier organizations. */
    private Set<Long> authorizedSupplierOrganizations() {
        return tenantAccess.currentUser().isPlatformAdmin() ? Set.of() : tenantAccess.currentUser().organizationIds();
    }

    private void requireRequestAccess(EmergencyRequest request, Set<Long> supplierOrgIds) {
        AuthenticatedUser user = tenantAccess.currentUser();
        if (user.isPlatformAdmin()) {
            return;
        }
        Long requestOrgId = request.getRequestingOrganization().getId();
        if (user.belongsTo(requestOrgId) || supplierOrgIds.stream().anyMatch(user::belongsTo)) {
            return;
        }
        throw new TenantAccessDeniedException(requestOrgId);
    }

    private void requireAllocationPermission(Set<Long> supplierOrgIds, Permission permission) {
        AuthenticatedUser user = tenantAccess.currentUser();
        if (user.isPlatformAdmin()) {
            tenantAccess.requirePermission(permission);
            return;
        }
        boolean allowed = supplierOrgIds.stream()
                .anyMatch(orgId -> user.belongsTo(orgId) && user.hasPermissionForOrganization(permission, orgId));
        if (!allowed) {
            throw new UnauthorizedOperationException("Missing permission: " + permission);
        }
    }

    private void requireUnitAccess(BloodUnit unit, Set<Long> supplierOrgIds) {
        AuthenticatedUser user = tenantAccess.currentUser();
        if (user.isPlatformAdmin()) {
            return;
        }
        Long unitOrgId = unit.getOrganization().getId();
        if (!supplierOrgIds.contains(unitOrgId) || !user.belongsTo(unitOrgId)) {
            throw new TenantAccessDeniedException(unitOrgId);
        }
    }

    private EmergencyRequest findRequest(Long id) {
        return requestRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("EmergencyRequest", id));
    }

    private EmergencyRequest findRequestForUpdate(Long id) {
        return requestRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new ResourceNotFoundException("EmergencyRequest", id));
    }

    public record Suggestion(Long requestId, String ruleVersion, String compatibilityRule,
                             boolean humanApprovalRequired, String feasibility,
                             List<AllocationCandidate> candidates) {
    }

    public record Confirmation(Long requestId, List<View> reservations) {
    }
}
