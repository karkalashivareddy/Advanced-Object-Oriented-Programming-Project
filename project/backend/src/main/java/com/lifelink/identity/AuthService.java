package com.lifelink.identity;

import com.lifelink.audit.AuditService;
import com.lifelink.common.exception.AuthenticationFailedException;
import com.lifelink.common.exception.BusinessRuleViolationException;
import com.lifelink.common.exception.ResourceNotFoundException;
import com.lifelink.identity.dto.AuthDtos.AuthResponse;
import com.lifelink.identity.dto.AuthDtos.ChangePasswordRequest;
import com.lifelink.identity.dto.AuthDtos.LoginRequest;
import com.lifelink.identity.dto.AuthDtos.OrganizationMembershipView;
import com.lifelink.identity.dto.AuthDtos.RefreshRequest;
import com.lifelink.identity.dto.AuthDtos.RegisterRequest;
import com.lifelink.identity.dto.AuthDtos.UserView;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.EnumSet;
import java.util.HexFormat;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final int LOCK_THRESHOLD = 5;
    private static final Duration LOCK_DURATION = Duration.ofMinutes(15);

    private final UserRepository userRepository;
    private final OrganizationMembershipRepository membershipRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final LoginAttemptRepository loginAttemptRepository;
    private final LoginAttemptRecorder loginAttemptRecorder;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final AuditService auditService;
    private final long refreshTokenDays;
    private final ConcurrentHashMap<String, Instant> revokedAccessTokens = new ConcurrentHashMap<>();

    public AuthService(UserRepository userRepository,
                       OrganizationMembershipRepository membershipRepository,
                       RefreshTokenRepository refreshTokenRepository,
                       LoginAttemptRepository loginAttemptRepository,
                       PasswordEncoder passwordEncoder,
                       JwtService jwtService,
                       AuditService auditService,
                       @Value("${security.jwt.refresh-token-days}") long refreshTokenDays) {
        this(userRepository, membershipRepository, refreshTokenRepository, loginAttemptRepository,
                new LoginAttemptRecorder(loginAttemptRepository), passwordEncoder, jwtService,
                auditService, refreshTokenDays);
    }

    @Autowired
    public AuthService(UserRepository userRepository,
                       OrganizationMembershipRepository membershipRepository,
                       RefreshTokenRepository refreshTokenRepository,
                       LoginAttemptRepository loginAttemptRepository,
                       LoginAttemptRecorder loginAttemptRecorder,
                       PasswordEncoder passwordEncoder,
                       JwtService jwtService,
                       AuditService auditService,
                       @Value("${security.jwt.refresh-token-days}") long refreshTokenDays) {
        this.userRepository = userRepository;
        this.membershipRepository = membershipRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.loginAttemptRepository = loginAttemptRepository;
        this.loginAttemptRecorder = loginAttemptRecorder;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.auditService = auditService;
        this.refreshTokenDays = refreshTokenDays;
    }

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        String email = request.email().trim().toLowerCase();
        if (userRepository.existsByEmail(email)) {
            throw new BusinessRuleViolationException("An account with this email already exists");
        }
        User user = new User(email, passwordEncoder.encode(request.password()), request.fullName(),
                request.phone(), User.Status.ACTIVE, Set.of(Role.DONOR));
        userRepository.save(user);
        auditService.record("REGISTER", "USER", user.getPublicId(), null, "SUCCESS", Map.of());
        return issueTokens(user);
    }

    @Transactional
    public AuthResponse login(LoginRequest request) {
        String email = request.email().trim().toLowerCase();
        Instant now = Instant.now();
        if (loginAttemptRecorder.isLocked(email, now)) {
            auditService.record("LOGIN", "USER", email, null, "FAILURE", Map.of("reason", "LOCKED"));
            throw new AuthenticationFailedException("Account temporarily locked due to failed login attempts");
        }
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> {
                    loginAttemptRecorder.recordFailure(email, now, LOCK_THRESHOLD, LOCK_DURATION);
                    auditService.record("LOGIN", "USER", email, null, "FAILURE", Map.of("reason", "UNKNOWN_USER"));
                    return new AuthenticationFailedException("Invalid email or password");
                });
        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            loginAttemptRecorder.recordFailure(email, now, LOCK_THRESHOLD, LOCK_DURATION);
            auditService.record("LOGIN", "USER", user.getPublicId(), null, "FAILURE", Map.of("reason", "BAD_PASSWORD"));
            throw new AuthenticationFailedException("Invalid email or password");
        }
        if (user.getStatus() != User.Status.ACTIVE) {
            auditService.record("LOGIN", "USER", user.getPublicId(), null, "FAILURE", Map.of("reason", user.getStatus().name()));
            throw new AuthenticationFailedException("Account is not active");
        }
        loginAttemptRecorder.clear(email);
        auditService.record("LOGIN", "USER", user.getPublicId(), null, "SUCCESS", Map.of());
        return issueTokens(user);
    }

    @Transactional(noRollbackFor = AuthenticationFailedException.class)
    public AuthResponse refresh(RefreshRequest request) {
        String hash = hash(request.refreshToken());
        RefreshToken stored = refreshTokenRepository.findByTokenHashForUpdate(hash)
                .orElseThrow(() -> new AuthenticationFailedException("Invalid refresh token"));
        Instant now = Instant.now();
        if (stored.getRevokedAt() != null) {
            revokeAll(stored.getUser(), now);
            auditService.record("REFRESH_REUSE", "USER", stored.getUser().getPublicId(), null, "FAILURE", Map.of());
            throw new AuthenticationFailedException("Refresh token reuse detected; all sessions revoked");
        }
        if (!stored.isActive(now)) {
            throw new AuthenticationFailedException("Refresh token has expired");
        }
        if (stored.getUser().getStatus() != User.Status.ACTIVE) {
            throw new AuthenticationFailedException("Account is not active");
        }
        stored.revoke(now);
        auditService.record("REFRESH", "USER", stored.getUser().getPublicId(), null, "SUCCESS", Map.of());
        return issueTokens(stored.getUser());
    }

    @Transactional
    public void logout(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) {
            return;
        }
        String target = refreshTokenRepository.findByTokenHash(hash(rawToken))
                .map(token -> {
                    token.revoke(Instant.now());
                    return token.getUser().getPublicId();
                })
                .orElse("unknown");
        auditService.record("LOGOUT", "USER", target, null, "SUCCESS", Map.of());
    }

    /**
     * Denylists one access-token jti until it would have expired. This is process-local, so
     * multi-instance deployments should pair it with shared session revocation or a short TTL.
     */
    public void revokeAccessToken(String jti, Instant expiresAt) {
        if (jti == null || jti.isBlank() || expiresAt == null) {
            return;
        }
        Instant now = Instant.now();
        revokedAccessTokens.entrySet().removeIf(entry -> !entry.getValue().isAfter(now));
        revokedAccessTokens.put(jti, expiresAt);
    }

    public boolean isAccessTokenRevoked(String jti) {
        if (jti == null || jti.isBlank()) {
            return true;
        }
        Instant expiresAt = revokedAccessTokens.get(jti);
        if (expiresAt == null) {
            return false;
        }
        if (!expiresAt.isAfter(Instant.now())) {
            revokedAccessTokens.remove(jti, expiresAt);
            return false;
        }
        return true;
    }

    @Transactional
    public void changePassword(Long userId, ChangePasswordRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", userId));
        if (!passwordEncoder.matches(request.currentPassword(), user.getPasswordHash())) {
            throw new AuthenticationFailedException("Current password is incorrect");
        }
        if (request.currentPassword().equals(request.newPassword())) {
            throw new BusinessRuleViolationException("New password must differ from the current password");
        }
        user.changePassword(passwordEncoder.encode(request.newPassword()));
        revokeAll(user, Instant.now());
        auditService.record("PASSWORD_CHANGE", "USER", user.getPublicId(), null, "SUCCESS", Map.of());
    }

    @Transactional(readOnly = true)
    public UserView me(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", userId));
        return toView(user);
    }

    public UserView toView(User user) {
        Set<OrganizationMembershipView> memberships = membershipViews(user);
        return UserView.of(user, effectivePermissions(user, memberships), memberships);
    }

    @Transactional(readOnly = true)
    public AuthenticatedUser principal(Long userId) {
        return principal(userId, null);
    }

    /**
     * Reloads the principal on every request. When a token version is supplied it must match the
     * user's current persistent version, so credential and status changes revoke access tokens
     * immediately and irreversibly without a shared denylist.
     */
    @Transactional(readOnly = true)
    public AuthenticatedUser principal(Long userId, String tokenVersion) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", userId));
        if (user.getStatus() != User.Status.ACTIVE) {
            throw new AuthenticationFailedException("Account is not active");
        }
        if (tokenVersion != null && !MessageDigest.isEqual(
                tokenVersion.getBytes(StandardCharsets.UTF_8),
                tokenVersion(user).getBytes(StandardCharsets.UTF_8))) {
            throw new AuthenticationFailedException("Access token has been revoked");
        }
        Set<OrganizationMembershipView> memberships = membershipViews(user);
        return new AuthenticatedUser(user.getId(), user.getEmail(), user.getFullName(), user.getRoles(),
                effectivePermissions(user, memberships),
                memberships.stream().map(OrganizationMembershipView::organizationId).collect(Collectors.toSet()),
                memberships.stream()
                        .map(m -> new AuthenticatedUser.OrganizationRole(m.organizationId(), m.organizationName(), m.role()))
                        .collect(Collectors.toSet()));
    }

    /** Opaque, user-level revocation marker persisted in the database. */
    String tokenVersion(User user) {
        return Long.toString(user.getTokenVersion());
    }

    /** Public so account-status changes can revoke every active refresh session. */
    @Transactional
    public void revokeAllForUser(User user) {
        revokeAll(user, Instant.now());
    }

    private Set<OrganizationMembershipView> membershipViews(User user) {
        return membershipRepository.findByUserId(user.getId()).stream()
                .map(m -> new OrganizationMembershipView(m.getOrganization().getId(),
                        m.getOrganization().getName(), m.getRole()))
                .collect(Collectors.toCollection(LinkedHashSet::new));
    }

    private Set<Permission> effectivePermissions(User user, Set<OrganizationMembershipView> memberships) {
        Set<Permission> permissions = EnumSet.noneOf(Permission.class);
        permissions.addAll(user.effectivePermissions());
        memberships.forEach(membership -> permissions.addAll(membership.role().permissions()));
        return Set.copyOf(permissions);
    }

    private AuthResponse issueTokens(User user) {
        AuthenticatedUser principal = principal(user.getId());
        String access = jwtService.generateAccessToken(principal, tokenVersion(user));
        String rawRefresh = Base64.getUrlEncoder().withoutPadding()
                .encodeToString(randomBytes(32));
        RefreshToken token = new RefreshToken(user, hash(rawRefresh),
                Instant.now().plus(Duration.ofDays(refreshTokenDays)));
        refreshTokenRepository.save(token);
        return new AuthResponse(access, rawRefresh, jwtService.accessTokenSeconds(), toView(user));
    }

    private void revokeAll(User user, Instant now) {
        refreshTokenRepository.findByUserId(user.getId()).forEach(t -> t.revoke(now));
    }

    private byte[] randomBytes(int length) {
        byte[] bytes = new byte[length];
        RANDOM.nextBytes(bytes);
        return bytes;
    }

    private String hash(String raw) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(raw.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (Exception ex) {
            throw new IllegalStateException("Unable to hash token", ex);
        }
    }
}

/**
 * Failure accounting runs in its own transaction so the counter and lock survive the
 * AuthenticationFailedException that rolls back the login transaction. The row is locked for
 * update to serialize concurrent attempts for the same email.
 */
@Component
class LoginAttemptRecorder {
    private final LoginAttemptRepository repository;

    LoginAttemptRecorder(LoginAttemptRepository repository) {
        this.repository = repository;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW, readOnly = true)
    boolean isLocked(String email, Instant now) {
        return repository.findByEmail(email).map(attempt -> attempt.isLocked(now)).orElse(false);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    void recordFailure(String email, Instant now, int threshold, Duration lockDuration) {
        LoginAttempt attempt = repository.findByEmailForUpdate(email)
                .orElseGet(() -> new LoginAttempt(email));
        attempt.registerFailure(now, threshold, lockDuration);
        try {
            repository.saveAndFlush(attempt);
        } catch (DataIntegrityViolationException ex) {
            // A concurrent first attempt inserted the row; retry under its lock.
            LoginAttempt existing = repository.findByEmailForUpdate(email).orElseThrow(() -> ex);
            existing.registerFailure(now, threshold, lockDuration);
            repository.saveAndFlush(existing);
        }
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    void clear(String email) {
        repository.findByEmailForUpdate(email).ifPresent(attempt -> {
            attempt.clear();
            repository.save(attempt);
        });
    }
}
