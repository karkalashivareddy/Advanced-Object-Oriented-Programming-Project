package com.lifelink.reservation;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lifelink.allocation.CompatibilitySpecification;
import com.lifelink.audit.AuditService;
import com.lifelink.common.exception.BusinessRuleViolationException;
import com.lifelink.common.exception.ConcurrencyConflictException;
import com.lifelink.common.exception.ResourceNotFoundException;
import com.lifelink.common.exception.TenantAccessDeniedException;
import com.lifelink.dispatch.DispatchRepository;
import com.lifelink.emergency.EmergencyRequest;
import com.lifelink.emergency.EmergencyRequestRepository;
import com.lifelink.identity.AuthenticatedUser;
import com.lifelink.identity.Permission;
import com.lifelink.identity.TenantAccessService;
import com.lifelink.inventory.BloodUnit;
import com.lifelink.inventory.BloodUnitRepository;
import com.lifelink.inventory.InventoryMovement;
import com.lifelink.inventory.InventoryMovementRepository;
import com.lifelink.inventory.InventoryService.LifecycleBatches;
import com.lifelink.organization.Organization;
import com.lifelink.organization.OrganizationRepository;
import com.lifelink.reservation.dto.ReservationDtos.CreateRequest;
import com.lifelink.reservation.dto.ReservationDtos.View;
import jakarta.persistence.EntityManager;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Savepoint;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.function.Supplier;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;
import org.hibernate.Session;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ReservationService {
    private static final Duration RESERVATION_TTL = Duration.ofMinutes(30);
    private static final Logger log = LoggerFactory.getLogger(ReservationService.class);

    private final ReservationRepository repository;
    private final BloodUnitRepository unitRepository;
    private final EmergencyRequestRepository requestRepository;
    private final OrganizationRepository organizationRepository;
    private final InventoryMovementRepository movementRepository;
    private final DispatchRepository dispatchRepository;
    private final TenantAccessService tenantAccess;
    private final AuditService auditService;
    private final CompatibilitySpecification specification;
    private final LifecycleBatches lifecycleBatches;
    private final Idempotency idempotency;

    public ReservationService(ReservationRepository repository, BloodUnitRepository unitRepository,
                              EmergencyRequestRepository requestRepository,
                              OrganizationRepository organizationRepository,
                              InventoryMovementRepository movementRepository,
                              DispatchRepository dispatchRepository,
                              TenantAccessService tenantAccess,
                              AuditService auditService,
                              CompatibilitySpecification specification,
                              LifecycleBatches lifecycleBatches,
                              Idempotency idempotency) {
        this.repository = repository;
        this.unitRepository = unitRepository;
        this.requestRepository = requestRepository;
        this.organizationRepository = organizationRepository;
        this.movementRepository = movementRepository;
        this.dispatchRepository = dispatchRepository;
        this.tenantAccess = tenantAccess;
        this.auditService = auditService;
        this.specification = specification;
        this.lifecycleBatches = lifecycleBatches;
        this.idempotency = idempotency;
    }

    @Transactional(readOnly = true)
    public List<View> list() {
        var user = tenantAccess.currentUser();
        return repository.findAll().stream()
                .filter(r -> user.isPlatformAdmin()
                        || (user.belongsTo(r.getOrganization().getId())
                        && user.hasPermissionForOrganization(Permission.RESERVATION_READ, r.getOrganization().getId())))
                .map(View::of).toList();
    }

    @Transactional(readOnly = true)
    public View get(Long id) {
        Reservation reservation = find(id);
        tenantAccess.requireOrganizationAndPermission(reservation.getOrganization().getId(),
                Permission.RESERVATION_READ);
        return View.of(reservation);
    }

    @Transactional
    public View create(CreateRequest request) {
        BloodUnit unit = unitRepository.findByIdForUpdate(request.unitId())
                .orElseThrow(() -> new ResourceNotFoundException("BloodUnit", request.unitId()));
        Long unitOrgId = unit.getOrganization().getId();
        tenantAccess.requireOrganizationAndPermission(unitOrgId, Permission.RESERVATION_CREATE);
        String hash = Idempotency.fingerprint(String.valueOf(request.unitId()), String.valueOf(request.requestId()));
        return idempotency.execute(Idempotency.RESERVATION_CREATE, request.idempotencyKey(), hash, View.class, () -> {
            EmergencyRequest emergencyRequest = requestRepository.findById(request.requestId())
                    .orElseThrow(() -> new ResourceNotFoundException("EmergencyRequest", request.requestId()));
            if (emergencyRequest.getStatus() != EmergencyRequest.Status.APPROVED
                    && emergencyRequest.getStatus() != EmergencyRequest.Status.ALLOCATING) {
                throw new BusinessRuleViolationException("Request is not approved for reservation");
            }
            if (unit.getComponentType() != emergencyRequest.getComponentType()
                    || !specification.isSatisfiedBy(emergencyRequest.getBloodGroup(), unit.getBloodGroup())) {
                throw new BusinessRuleViolationException("Selected unit is not compatible with this request");
            }
            Organization organization = emergencyRequest.getRequestingOrganization();
            AuthenticatedUser user = tenantAccess.currentUser();
            if (!user.isPlatformAdmin() && !user.belongsTo(organization.getId()) && !user.belongsTo(unitOrgId)) {
                throw new TenantAccessDeniedException(organization.getId());
            }
            Reservation reservation = new Reservation(unit, emergencyRequest, organization,
                    Instant.now().plus(RESERVATION_TTL), request.idempotencyKey());
            repository.saveAndFlush(reservation);
            repository.markActiveUnit(reservation.getId());
            String before = unit.getStatus().name();
            unit.reserve(reservation.getId(), Instant.now());
            movementRepository.save(new InventoryMovement(unit, before, unit.getStatus().name(),
                    "Reserved for " + emergencyRequest.getRequestNumber(), null));
            auditService.record("RESERVATION_CREATE", "RESERVATION", reservation.getPublicId(),
                    organization.getId(), "SUCCESS", Map.of("unit", unit.getUnitNumber()));
            return View.of(reservation);
        });
    }

    @Transactional
    public View confirm(Long id) {
        Reservation reservation = find(id);
        tenantAccess.requireOrganizationAndPermission(reservation.getOrganization().getId(),
                Permission.RESERVATION_CONFIRM);
        // Clear the sparse slot first: the native UPDATE triggers an auto-flush, and the
        // V4 CHECK requires the slot to be empty before the status leaves ACTIVE.
        repository.clearActiveUnit(id);
        reservation.confirm(Instant.now());
        auditService.record("RESERVATION_CONFIRM", "RESERVATION", reservation.getPublicId(),
                reservation.getOrganization().getId(), "SUCCESS", Map.of());
        return View.of(reservation);
    }

    @Transactional
    public View cancel(Long id) {
        Reservation reservation = find(id);
        tenantAccess.requireOrganizationAndPermission(reservation.getOrganization().getId(),
                Permission.RESERVATION_CREATE);
        release(reservation, "RESERVATION_CANCEL", false);
        return View.of(reservation);
    }

    /** Called by the request service after it has authorized the request cancellation. */
    @Transactional
    public int cancelForRequest(Long requestId) {
        return releaseForRequest(requestId, "RESERVATION_CANCEL", false);
    }

    @Transactional
    public int expireForRequest(Long requestId) {
        return releaseForRequest(requestId, "RESERVATION_EXPIRE", true);
    }

    /**
     * Lifecycle work is driven by the scheduler, with no ambient request or transaction.
     * Each item is processed in its own REQUIRES_NEW transaction by LifecycleBatches so
     * one locked or already-expired row cannot abort the remaining batch.
     */
    public int expireReservations() {
        List<Long> expiredIds = repository.findExpired(Instant.now()).stream()
                // A confirmed reservation with a dispatch is in flight; its TTL no longer applies.
                .filter(reservation -> reservation.getStatus() != Reservation.Status.CONFIRMED
                        || !dispatchRepository.existsByReservationId(reservation.getId()))
                .map(Reservation::getId)
                .toList();
        int processed = 0;
        for (Long id : expiredIds) {
            try {
                if (lifecycleBatches.expireReservation(id)) {
                    processed++;
                }
            } catch (RuntimeException ex) {
                log.warn("Lifecycle reservation expiry failed for id={}: {}", id, ex.getMessage());
            }
        }
        return processed;
    }

    private int releaseForRequest(Long requestId, String auditAction, boolean expired) {
        int released = 0;
        for (Reservation reservation : repository.findByRequestId(requestId)) {
            if (reservation.getStatus() == Reservation.Status.ACTIVE
                    || reservation.getStatus() == Reservation.Status.CONFIRMED) {
                release(reservation, auditAction, expired);
                released++;
            }
        }
        return released;
    }

    private void release(Reservation reservation, String auditAction, boolean expired) {
        BloodUnit unit = unitRepository.findByIdForUpdate(reservation.getBloodUnit().getId())
                .orElseThrow(() -> new ResourceNotFoundException("BloodUnit", reservation.getBloodUnit().getId()));
        repository.clearActiveUnit(reservation.getId());
        if (expired) {
            reservation.expire();
        } else {
            reservation.cancel();
        }
        unit.clearReservation();
        movementRepository.save(new InventoryMovement(unit, BloodUnit.Status.RESERVED.name(),
                unit.getStatus().name(), expired ? "Reservation expired" : "Reservation cancelled", null));
        auditService.record(auditAction, "RESERVATION", reservation.getPublicId(),
                reservation.getOrganization().getId(), "SUCCESS", Map.of());
    }

    private Reservation find(Long id) {
        return repository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Reservation", id));
    }

    /**
     * Canonical, persisted idempotency for mutating endpoints. The claim row is written
     * in the caller's transaction: a business rollback also removes the claim, so a
     * COMPLETED row always describes work that really committed. Concurrent callers
     * serialize on the unique (scope, key) row and replay the stored response only
     * when the SHA-256 request fingerprint matches.
     *
     * Nested here (rather than in a new top-level component) to keep the change inside
     * the backend files owned by this workstream.
     */
    @Service
    public static class Idempotency {
        public static final String ALLOCATION_CONFIRM = "ALLOCATION_CONFIRM";
        public static final String RESERVATION_CREATE = "RESERVATION_CREATE";
        public static final String DISPATCH_CREATE = "DISPATCH_CREATE";

        private static final int LOCK_TIMEOUT_SECONDS = 10;

        private final EntityManager entityManager;
        private final ObjectMapper objectMapper;

        public Idempotency(EntityManager entityManager, ObjectMapper objectMapper) {
            this.entityManager = entityManager;
            this.objectMapper = objectMapper;
        }

        public <T> T execute(String scope, String key, String hash, Class<T> responseType, Supplier<T> work) {
            if (scope == null || scope.isBlank() || key == null || key.isBlank()) {
                throw new BusinessRuleViolationException("Idempotency key is required");
            }
            String canonicalKey = key.trim();
            Existing existing = find(scope, canonicalKey);
            if (existing != null) {
                return replay(existing, hash, responseType, scope);
            }
            if (!tryClaim(scope, canonicalKey, hash)) {
                // Another transaction claimed this key. Locking waits for its outcome;
                // if it rolled back the claim disappears and the caller may retry.
                existing = lockExisting(scope, canonicalKey);
                if (existing == null) {
                    throw new ConcurrencyConflictException("Idempotency claim changed concurrently; retry the request");
                }
                return replay(existing, hash, responseType, scope);
            }
            T response = work.get();
            complete(scope, canonicalKey, response);
            return response;
        }

        /** Stable fingerprint over explicitly ordered, value-bearing parts. */
        public static String fingerprint(String... parts) {
            try {
                MessageDigest digest = MessageDigest.getInstance("SHA-256");
                for (String part : parts) {
                    digest.update(String.valueOf(part).getBytes(StandardCharsets.UTF_8));
                    digest.update((byte) 0x1F);
                }
                StringBuilder result = new StringBuilder(64);
                for (byte value : digest.digest()) {
                    result.append(String.format(Locale.ROOT, "%02x", value & 0xFF));
                }
                return result.toString();
            } catch (NoSuchAlgorithmException ex) {
                throw new IllegalStateException("SHA-256 is unavailable", ex);
            }
        }

        private <T> T replay(Existing existing, String hash, Class<T> responseType, String scope) {
            if (!hash.equals(existing.hash())) {
                throw new BusinessRuleViolationException("Idempotency key was used for a different " + scope);
            }
            if (!"COMPLETED".equals(existing.status()) || existing.responseJson() == null) {
                throw new ConcurrencyConflictException("A request with this idempotency key is still in progress; retry");
            }
            try {
                return objectMapper.readValue(existing.responseJson(), responseType);
            } catch (JsonProcessingException ex) {
                throw new IllegalStateException("Stored idempotency response could not be read", ex);
            }
        }

        private Existing find(String scope, String key) {
            AtomicReference<Existing> found = new AtomicReference<>();
            session().doWork(connection -> {
                try (PreparedStatement statement = connection.prepareStatement(
                        "SELECT request_hash, status, response_json FROM idempotency_records "
                                + "WHERE scope = ? AND \"key\" = ?")) {
                    statement.setString(1, scope);
                    statement.setString(2, key);
                    try (ResultSet rows = statement.executeQuery()) {
                        if (rows.next()) {
                            found.set(new Existing(rows.getString(1), rows.getString(2), rows.getString(3)));
                        }
                    }
                }
            });
            return found.get();
        }

        private boolean tryClaim(String scope, String key, String hash) {
            AtomicBoolean claimed = new AtomicBoolean(false);
            session().doWork(connection -> {
                Savepoint savepoint = connection.setSavepoint("idempotency_claim");
                try (PreparedStatement statement = connection.prepareStatement(
                        "INSERT INTO idempotency_records(scope, \"key\", request_hash, status, created_at) "
                                + "VALUES (?, ?, ?, 'ACTIVE', ?)")) {
                    statement.setString(1, scope);
                    statement.setString(2, key);
                    statement.setString(3, hash);
                    statement.setTimestamp(4, java.sql.Timestamp.from(Instant.now()));
                    statement.executeUpdate();
                    connection.releaseSavepoint(savepoint);
                    claimed.set(true);
                } catch (SQLException ex) {
                    // A duplicate key is expected under contention. Roll back to the
                    // savepoint so PostgreSQL does not abort the surrounding transaction.
                    connection.rollback(savepoint);
                    if (!isIntegrityViolation(ex)) {
                        throw new IllegalStateException("Could not claim idempotency key", ex);
                    }
                }
            });
            return claimed.get();
        }

        private Existing lockExisting(String scope, String key) {
            AtomicReference<Existing> found = new AtomicReference<>();
            try {
                session().doWork(connection -> {
                    try (PreparedStatement statement = connection.prepareStatement(
                            "SELECT request_hash, status, response_json FROM idempotency_records "
                                    + "WHERE scope = ? AND \"key\" = ? FOR UPDATE")) {
                        statement.setString(1, scope);
                        statement.setString(2, key);
                        statement.setQueryTimeout(LOCK_TIMEOUT_SECONDS);
                        try (ResultSet rows = statement.executeQuery()) {
                            if (rows.next()) {
                                found.set(new Existing(rows.getString(1), rows.getString(2), rows.getString(3)));
                            }
                        }
                    }
                });
            } catch (RuntimeException ex) {
                if (isLockFailure(ex)) {
                    throw new ConcurrencyConflictException("Idempotency key is locked; retry the request");
                }
                throw ex;
            }
            return found.get();
        }

        private <T> void complete(String scope, String key, T response) {
            try {
                String json = objectMapper.writeValueAsString(response);
                entityManager.createNativeQuery("UPDATE idempotency_records SET status = 'COMPLETED', "
                                + "response_json = ?1, completed_at = ?2 WHERE scope = ?3 AND \"key\" = ?4")
                        .setParameter(1, json)
                        .setParameter(2, java.sql.Timestamp.from(Instant.now()))
                        .setParameter(3, scope)
                        .setParameter(4, key)
                        .executeUpdate();
            } catch (JsonProcessingException ex) {
                throw new IllegalStateException("Idempotency response could not be serialized", ex);
            }
        }

        private Session session() {
            return entityManager.unwrap(Session.class);
        }

        private static boolean isIntegrityViolation(SQLException ex) {
            String state = ex.getSQLState();
            return state != null && state.startsWith("23");
        }

        private static boolean isLockFailure(Throwable ex) {
            for (Throwable current = ex; current != null; current = current.getCause()) {
                String state = current instanceof SQLException sql ? sql.getSQLState() : null;
                if (state != null && (state.startsWith("55") || state.startsWith("40")
                        || state.startsWith("50") || state.startsWith("HYT"))) {
                    return true;
                }
                String message = current.getMessage();
                if (message != null && (message.toLowerCase(Locale.ROOT).contains("timeout")
                        || message.toLowerCase(Locale.ROOT).contains("lock"))) {
                    return true;
                }
            }
            return false;
        }

        private record Existing(String hash, String status, String responseJson) {
        }
    }
}
