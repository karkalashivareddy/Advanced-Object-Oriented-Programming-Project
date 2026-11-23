package com.lifelink.identity;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.lifelink.audit.AuditService;
import com.lifelink.common.BaseEntity;
import com.lifelink.common.exception.AuthenticationFailedException;
import com.lifelink.identity.dto.AuthDtos.ChangePasswordRequest;
import com.lifelink.identity.dto.AuthDtos.LoginRequest;
import java.lang.reflect.Field;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;

class AuthServiceSecurityTest {
    private static final String EMAIL = "user@example.test";

    private final UserRepository userRepository = mock(UserRepository.class);
    private final OrganizationMembershipRepository membershipRepository = mock(OrganizationMembershipRepository.class);
    private final RefreshTokenRepository refreshTokenRepository = mock(RefreshTokenRepository.class);
    private final LoginAttemptRepository attemptRepository = mock(LoginAttemptRepository.class);
    private final PasswordEncoder passwordEncoder = mock(PasswordEncoder.class);
    private final JwtService jwtService = mock(JwtService.class);
    private final AuditService auditService = mock(AuditService.class);
    private final Map<String, LoginAttempt> attempts = new HashMap<>();

    private AuthService authService;
    private User user;

    @BeforeEach
    void setUp() throws Exception {
        when(attemptRepository.findByEmail(anyString()))
                .thenAnswer(call -> Optional.ofNullable(attempts.get(call.getArgument(0, String.class))));
        when(attemptRepository.findByEmailForUpdate(anyString()))
                .thenAnswer(call -> Optional.ofNullable(attempts.get(call.getArgument(0, String.class))));
        when(attemptRepository.saveAndFlush(any(LoginAttempt.class))).thenAnswer(call -> {
            LoginAttempt attempt = call.getArgument(0, LoginAttempt.class);
            attempts.put(attempt.getEmail(), attempt);
            return attempt;
        });
        when(attemptRepository.save(any(LoginAttempt.class))).thenAnswer(call -> {
            LoginAttempt attempt = call.getArgument(0, LoginAttempt.class);
            attempts.put(attempt.getEmail(), attempt);
            return attempt;
        });
        when(membershipRepository.findByUserId(anyLong())).thenReturn(List.of());
        when(jwtService.generateAccessToken(any(AuthenticatedUser.class), anyString())).thenReturn("signed-access-token");
        when(jwtService.accessTokenSeconds()).thenReturn(900L);

        user = new User(EMAIL, "stored-hash", "Test User", null, User.Status.ACTIVE, Set.of(Role.DONOR));
        Field idField = BaseEntity.class.getDeclaredField("id");
        idField.setAccessible(true);
        idField.set(user, 1L);
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(user));
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("correct-password", "stored-hash")).thenReturn(true);
        when(passwordEncoder.matches("current-password", "stored-hash")).thenReturn(true);

        authService = new AuthService(userRepository, membershipRepository, refreshTokenRepository,
                attemptRepository, new LoginAttemptRecorder(attemptRepository), passwordEncoder,
                jwtService, auditService, 7L);
    }

    @Test
    void fiveBadPasswordsLockTheAccountAndRejectTheCorrectPassword() {
        for (int attempt = 0; attempt < 5; attempt++) {
            AuthenticationFailedException failure = assertThrows(AuthenticationFailedException.class,
                    () -> authService.login(new LoginRequest(EMAIL, "wrong-password")));
            assertEquals("Invalid email or password", failure.getMessage());
        }

        LoginAttempt stored = attempts.get(EMAIL);
        assertTrue(stored.isLocked(Instant.now()));

        AuthenticationFailedException locked = assertThrows(AuthenticationFailedException.class,
                () -> authService.login(new LoginRequest(EMAIL, "correct-password")));
        assertTrue(locked.getMessage().contains("locked"));
        verify(passwordEncoder, never()).matches("correct-password", "stored-hash");
    }

    @Test
    void successfulLoginClearsFailureAccounting() {
        for (int attempt = 0; attempt < 2; attempt++) {
            assertThrows(AuthenticationFailedException.class,
                    () -> authService.login(new LoginRequest(EMAIL, "wrong-password")));
        }
        assertEquals(2, attempts.get(EMAIL).getFailedCount());

        authService.login(new LoginRequest(EMAIL, "correct-password"));

        assertEquals(0, attempts.get(EMAIL).getFailedCount());
        assertNull(attempts.get(EMAIL).getLockedUntil());
    }

    @Test
    void passwordChangeRevokesExistingAccessTokenVersion() {
        String versionAtIssue = authService.tokenVersion(user);
        AuthenticatedUser before = authService.principal(1L, versionAtIssue);
        assertEquals(EMAIL, before.email());

        when(passwordEncoder.encode("new-password")).thenReturn("new-hash");
        authService.changePassword(1L, new ChangePasswordRequest("current-password", "new-password"));

        assertNotEquals(versionAtIssue, authService.tokenVersion(user));
        assertThrows(AuthenticationFailedException.class, () -> authService.principal(1L, versionAtIssue));
        assertEquals(EMAIL, authService.principal(1L, authService.tokenVersion(user)).email());
    }

    @Test
    void accessTokenJtiCanBeRevokedIndependentlyOfPasswordChanges() {
        String jti = "access-token-jti";
        assertFalse(authService.isAccessTokenRevoked(jti));

        authService.revokeAccessToken(jti, Instant.now().plusSeconds(900));

        assertTrue(authService.isAccessTokenRevoked(jti));
        authService.revokeAccessToken("expired-jti", Instant.now().minusSeconds(1));
        assertFalse(authService.isAccessTokenRevoked("expired-jti"));
    }

    @Test
    void statusChangesPermanentlyRevokePreviouslyIssuedAccessTokens() {
        String versionAtIssue = authService.tokenVersion(user);
        assertEquals("0", versionAtIssue);
        assertEquals(EMAIL, authService.principal(1L, versionAtIssue).email());

        user.lock();
        assertThrows(AuthenticationFailedException.class, () -> authService.principal(1L, versionAtIssue));
        user.activate();
        assertThrows(AuthenticationFailedException.class, () -> authService.principal(1L, versionAtIssue));
        assertNotEquals(versionAtIssue, authService.tokenVersion(user));

        user.disable();
        assertThrows(AuthenticationFailedException.class, () -> authService.principal(1L, versionAtIssue));
        user.activate();
        assertThrows(AuthenticationFailedException.class, () -> authService.principal(1L, versionAtIssue));
        assertNotEquals(versionAtIssue, authService.tokenVersion(user));
        assertEquals(EMAIL, authService.principal(1L, authService.tokenVersion(user)).email());
    }

    @Test
    void disabledUserIsRejectedEvenWithACurrentTokenVersion() {
        String versionAtIssue = authService.tokenVersion(user);
        user.disable();

        AuthenticationFailedException rejected = assertThrows(AuthenticationFailedException.class,
                () -> authService.principal(1L, versionAtIssue));
        assertEquals("Account is not active", rejected.getMessage());
    }
}
