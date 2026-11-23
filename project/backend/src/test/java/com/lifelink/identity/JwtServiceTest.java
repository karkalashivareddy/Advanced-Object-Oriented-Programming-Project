package com.lifelink.identity;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import io.jsonwebtoken.Claims;
import java.time.Duration;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.core.env.Environment;

class JwtServiceTest {
    private static final String TEST_SECRET = "test-only-secret-not-for-production-0123456789";

    private final Environment environment = mock(Environment.class);
    private JwtService jwtService;

    @BeforeEach
    void setUp() {
        when(environment.getActiveProfiles()).thenReturn(new String[] {"test"});
        jwtService = new JwtService(TEST_SECRET, 15, "lifelink", "lifelink-api", environment);
    }

    @Test
    void accessTokenCarriesJtiVersionAndExistingLifecycleClaims() {
        AuthenticatedUser user = new AuthenticatedUser(7L, "user@example.test", "Test User",
                Set.of(Role.DONOR), Set.of(Permission.NOTIFICATION_READ), Set.of(), Set.of());

        String token = jwtService.generateAccessToken(user, "version-marker");
        Claims claims = jwtService.parse(token);

        assertNotNull(claims.getId());
        assertFalse(claims.getId().isBlank());
        assertEquals("version-marker", claims.get(JwtService.TOKEN_VERSION_CLAIM, String.class));
        assertEquals("lifelink", claims.getIssuer());
        assertTrue(claims.getAudience().contains("lifelink-api"));
        assertEquals(7L, claims.get("uid", Long.class));
        assertEquals(900, Duration.between(
                claims.getIssuedAt().toInstant(), claims.getExpiration().toInstant()).getSeconds());
        assertEquals(900L, jwtService.accessTokenSeconds());
    }

    @Test
    void testOnlySecretIsRejectedOutsideTheTestProfile() {
        when(environment.getActiveProfiles()).thenReturn(new String[] {"prod"});

        assertThrows(IllegalStateException.class, () -> new JwtService(
                "test-only-jwt-secret-not-for-production-0123456789", 15, "lifelink", "lifelink-api", environment));
    }
}
