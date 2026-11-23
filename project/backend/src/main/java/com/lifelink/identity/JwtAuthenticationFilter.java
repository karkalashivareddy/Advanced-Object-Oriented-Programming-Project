package com.lifelink.identity;

import com.lifelink.common.CorrelationContext;
import com.lifelink.common.ErrorResponse;
import com.lifelink.common.exception.ErrorCode;
import com.lifelink.common.exception.LifeLinkException;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.jsonwebtoken.JwtException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {
    private static final Logger log = LoggerFactory.getLogger(JwtAuthenticationFilter.class);

    private final JwtService jwtService;
    private final AuthService authService;
    private final ObjectMapper objectMapper;

    public JwtAuthenticationFilter(JwtService jwtService, AuthService authService, ObjectMapper objectMapper) {
        this.jwtService = jwtService;
        this.authService = authService;
        this.objectMapper = objectMapper;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String header = request.getHeader("Authorization");
        if (header == null || !header.startsWith("Bearer ")) {
            chain.doFilter(request, response);
            return;
        }
        try {
            var claims = jwtService.parse(header.substring(7));
            String jti = claims.getId();
            if (jti == null || jti.isBlank() || authService.isAccessTokenRevoked(jti)) {
                reject(response, "TOKEN_INVALID", "Access token is invalid or expired");
                return;
            }
            Long userId = claims.get("uid", Long.class);
            if (userId == null) {
                reject(response, "TOKEN_INVALID", "Access token is invalid or expired");
                return;
            }
            if (SecurityContextHolder.getContext().getAuthentication() == null) {
                AuthenticatedUser principal = authService.principal(
                        userId, claims.get(JwtService.TOKEN_VERSION_CLAIM, String.class));
                var authentication = new UsernamePasswordAuthenticationToken(
                        principal, null, principal.getAuthorities());
                authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                SecurityContextHolder.getContext().setAuthentication(authentication);
            }
        } catch (JwtException | IllegalArgumentException ex) {
            reject(response, "TOKEN_INVALID", "Access token is invalid or expired");
            return;
        } catch (LifeLinkException ex) {
            if (ex.errorCode().status() == HttpStatus.FORBIDDEN) {
                reject(response, ErrorCode.UNAUTHORIZED_OPERATION.code(), "Access is denied");
            } else {
                reject(response, "TOKEN_INVALID", "Access token is invalid or expired");
            }
            return;
        } catch (RuntimeException ex) {
            // Unexpected principal-loading failures must not become a 500 or leak details.
            log.warn("Principal loading failed ({})", ex.getClass().getSimpleName());
            reject(response, "TOKEN_INVALID", "Access token is invalid or expired");
            return;
        }
        chain.doFilter(request, response);
    }

    private void reject(HttpServletResponse response, String code, String message) throws IOException {
        SecurityContextHolder.clearContext();
        response.setStatus(code.equals(ErrorCode.UNAUTHORIZED_OPERATION.code())
                ? HttpServletResponse.SC_FORBIDDEN : HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        objectMapper.writeValue(response.getWriter(), ErrorResponse.of(
                code, message, Map.of(), CorrelationContext.id()));
    }
}
