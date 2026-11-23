package com.lifelink.identity;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.lifelink.common.exception.UnauthorizedOperationException;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.MalformedJwtException;
import jakarta.servlet.FilterChain;
import java.util.Set;
import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;

class JwtAuthenticationFilterTest {
    private final JwtService jwtService = mock(JwtService.class);
    private final AuthService authService = mock(AuthService.class);
    private final ObjectMapper objectMapper = new ObjectMapper().findAndRegisterModules();
    private final JwtAuthenticationFilter filter =
            new JwtAuthenticationFilter(jwtService, authService, objectMapper);
    private final Claims claims = mock(Claims.class);

    private MockHttpServletRequest request;
    private MockHttpServletResponse response;
    private AtomicBoolean chainInvoked;

    @BeforeEach
    void setUp() {
        SecurityContextHolder.clearContext();
        request = new MockHttpServletRequest();
        request.addHeader("Authorization", "Bearer signed-token");
        response = new MockHttpServletResponse();
        chainInvoked = new AtomicBoolean(false);
        when(jwtService.parse("signed-token")).thenReturn(claims);
        when(claims.getId()).thenReturn("jti-1");
        when(claims.get("uid", Long.class)).thenReturn(9L);
        when(claims.get(JwtService.TOKEN_VERSION_CLAIM, String.class)).thenReturn("version-1");
    }

    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void validTokenAuthenticatesAndContinuesChain() throws Exception {
        AuthenticatedUser user = new AuthenticatedUser(9L, "user@example.test", "Test User",
                Set.of(Role.DONOR), Set.of(Permission.NOTIFICATION_READ), Set.of(), Set.of());
        when(authService.principal(9L, "version-1")).thenReturn(user);

        filter.doFilter(request, response, recordingChain());

        assertTrue(chainInvoked.get());
        assertInstanceOf(AuthenticatedUser.class,
                SecurityContextHolder.getContext().getAuthentication().getPrincipal());
        verify(authService).principal(9L, "version-1");
    }

    @Test
    void unexpectedPrincipalFailureIsUnauthorizedWithoutDetails() throws Exception {
        when(authService.principal(9L, "version-1")).thenThrow(new IllegalStateException("database details"));

        filter.doFilter(request, response, recordingChain());

        assertEquals(401, response.getStatus());
        assertEquals("TOKEN_INVALID", errorCode());
        assertFalse(response.getContentAsString().contains("database details"));
        assertFalse(chainInvoked.get());
        assertEquals(null, SecurityContextHolder.getContext().getAuthentication());
    }

    @Test
    void forbiddenDomainFailureIsForbiddenAndClearsContext() throws Exception {
        when(authService.principal(9L, "version-1"))
                .thenThrow(new UnauthorizedOperationException("Missing permission"));

        filter.doFilter(request, response, recordingChain());

        assertEquals(403, response.getStatus());
        assertEquals("UNAUTHORIZED_OPERATION", errorCode());
        assertFalse(chainInvoked.get());
        assertEquals(null, SecurityContextHolder.getContext().getAuthentication());
    }

    @Test
    void revokedTokenIsUnauthorized() throws Exception {
        when(authService.isAccessTokenRevoked("jti-1")).thenReturn(true);

        filter.doFilter(request, response, recordingChain());

        assertEquals(401, response.getStatus());
        assertEquals("TOKEN_INVALID", errorCode());
        assertFalse(chainInvoked.get());
        verify(authService, never()).principal(9L, "version-1");
    }

    @Test
    void malformedTokenIsUnauthorized() throws Exception {
        when(jwtService.parse("signed-token")).thenThrow(new MalformedJwtException("malformed"));

        filter.doFilter(request, response, recordingChain());

        assertEquals(401, response.getStatus());
        assertEquals("TOKEN_INVALID", errorCode());
        assertFalse(chainInvoked.get());
    }

    private FilterChain recordingChain() {
        return (servletRequest, servletResponse) -> chainInvoked.set(true);
    }

    private String errorCode() throws Exception {
        return objectMapper.readTree(response.getContentAsString()).at("/error/code").asText();
    }
}
