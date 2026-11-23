package com.lifelink.identity;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.lifelink.identity.dto.AuthDtos.LogoutRequest;
import io.jsonwebtoken.Claims;
import java.time.Instant;
import java.util.Date;
import org.junit.jupiter.api.Test;

class AuthControllerLogoutTest {

    @Test
    void logoutDeniesTheBearerJtiAndRevokesTheRefreshToken() {
        AuthService authService = mock(AuthService.class);
        TenantAccessService tenantAccessService = mock(TenantAccessService.class);
        JwtService jwtService = mock(JwtService.class);
        Claims claims = mock(Claims.class);
        when(jwtService.parse("access-jwt")).thenReturn(claims);
        when(claims.getId()).thenReturn("jti-1");
        when(claims.getExpiration()).thenReturn(Date.from(Instant.now().plusSeconds(900)));

        AuthController controller = new AuthController(authService, tenantAccessService, jwtService);

        controller.logout(new LogoutRequest("refresh-token"), "Bearer access-jwt");

        verify(authService).revokeAccessToken(eq("jti-1"), any(Instant.class));
        verify(authService).logout("refresh-token");
    }

    @Test
    void logoutStillRevokesRefreshTokenWhenAuthorizationHeaderIsInvalid() {
        AuthService authService = mock(AuthService.class);
        TenantAccessService tenantAccessService = mock(TenantAccessService.class);
        JwtService jwtService = mock(JwtService.class);
        when(jwtService.parse("broken")).thenThrow(new IllegalStateException("invalid token"));

        AuthController controller = new AuthController(authService, tenantAccessService, jwtService);

        assertDoesNotThrow(() -> controller.logout(new LogoutRequest("refresh-token"), "Bearer broken"));
        verify(authService).logout("refresh-token");
    }
}
