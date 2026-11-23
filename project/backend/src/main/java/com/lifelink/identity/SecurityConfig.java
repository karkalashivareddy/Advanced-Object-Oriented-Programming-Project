package com.lifelink.identity;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lifelink.common.CorrelationContext;
import com.lifelink.common.CorrelationIdFilter;
import com.lifelink.common.ErrorResponse;
import com.lifelink.common.exception.ErrorCode;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ReadListener;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletInputStream;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import jakarta.servlet.http.HttpServletResponse;
import java.io.BufferedReader;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.OncePerRequestFilter;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

    private static final Set<String> RATE_LIMITED_PATHS = Set.of(
            "/api/v1/auth/login", "/api/v1/auth/register", "/api/v1/auth/refresh");

    private final JwtAuthenticationFilter jwtFilter;
    private final ObjectMapper objectMapper;
    private final List<String> allowedOrigins;
    private final boolean development;

    public SecurityConfig(JwtAuthenticationFilter jwtFilter, ObjectMapper objectMapper,
                          Environment environment,
                          @Value("${security.cors.allowed-origins}") List<String> allowedOrigins) {
        this.jwtFilter = jwtFilter;
        this.objectMapper = objectMapper;
        this.allowedOrigins = allowedOrigins;
        this.development = Arrays.stream(environment.getActiveProfiles()).anyMatch("dev"::equals);
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http, AuthRateLimitFilter authRateLimitFilter)
            throws Exception {
        http
                .csrf(csrf -> csrf.disable())
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> {
                    auth.requestMatchers(HttpMethod.OPTIONS, "/**").permitAll();
                    auth.requestMatchers("/api/v1/auth/login", "/api/v1/auth/register", "/api/v1/auth/refresh").permitAll();
                    auth.requestMatchers("/actuator/health/**").permitAll();
                    // SockJS clients fetch /ws/info and open the transport before a STOMP
                    // frame exists. Access is enforced by StompAuthenticationInterceptor
                    // on CONNECT/SUBSCRIBE/SEND, not by the servlet filter chain.
                    auth.requestMatchers("/ws/**", "/sockjs/**").permitAll();
                    if (development) {
                        auth.requestMatchers("/actuator/info", "/v3/api-docs/**",
                                "/swagger-ui/**", "/swagger-ui.html").permitAll();
                    }
                    auth.anyRequest().authenticated();
                })
                .exceptionHandling(ex -> ex
                        .authenticationEntryPoint((request, response, authException) -> write(
                                response, 401, "AUTHENTICATION_REQUIRED", "Authentication is required"))
                        .accessDeniedHandler((request, response, accessDeniedException) -> write(
                                response, 403, "UNAUTHORIZED_OPERATION", "Operation is not permitted")))
                .headers(headers -> headers
                        .frameOptions(frame -> frame.deny())
                        .contentSecurityPolicy(csp -> csp.policyDirectives(
                                "default-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"))
                        .referrerPolicy(referrer -> referrer.policy(
                                org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter.ReferrerPolicy.NO_REFERRER))
                        .httpStrictTransportSecurity(hsts -> hsts.includeSubDomains(true).maxAgeInSeconds(31536000)))
                // Both filters are registered against a built-in ordered filter so Spring Security
                // never has to derive an order from a custom filter class.
                .addFilterBefore(authRateLimitFilter, UsernamePasswordAuthenticationFilter.class)
                .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }

    @Bean
    public AuthRateLimitFilter authRateLimitFilter(
            @Value("${lifelink.rate-limit.auth-max-attempts}") int maxAttempts,
            @Value("${lifelink.rate-limit.auth-window-seconds}") long windowSeconds) {
        return new AuthRateLimitFilter(maxAttempts, windowSeconds, objectMapper);
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(allowedOrigins);
        configuration.setAllowedMethods(List.of("GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(List.of("Authorization", "Content-Type", "X-Correlation-Id",
                "Idempotency-Key", "X-Organization-Id"));
        configuration.setExposedHeaders(List.of("X-Correlation-Id"));
        configuration.setAllowCredentials(false);
        configuration.setMaxAge(3600L);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }

    private void write(HttpServletResponse response, int status, String code, String message)
            throws IOException {
        String correlationId = CorrelationContext.id();
        if ("bootstrap".equals(correlationId)) {
            correlationId = UUID.randomUUID().toString();
            response.setHeader(CorrelationIdFilter.HEADER, correlationId);
        }
        response.setStatus(status);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        objectMapper.writeValue(response.getWriter(), ErrorResponse.of(
                code, message, Map.of(), correlationId));
    }

    /** In-memory, fixed-window failure counter for unauthenticated auth endpoints. */
    public static final class AuthRateLimitFilter extends OncePerRequestFilter {
        private final int maxAttempts;
        private final long windowMillis;
        private final ObjectMapper objectMapper;
        private final ConcurrentHashMap<String, FailureWindow> failures = new ConcurrentHashMap<>();

        public AuthRateLimitFilter(int maxAttempts, long windowSeconds, ObjectMapper objectMapper) {
            this.maxAttempts = Math.max(1, maxAttempts);
            this.windowMillis = Math.max(1, windowSeconds) * 1000L;
            this.objectMapper = objectMapper;
        }

        @Override
        protected boolean shouldNotFilter(HttpServletRequest request) {
            return "OPTIONS".equalsIgnoreCase(request.getMethod())
                    || !RATE_LIMITED_PATHS.contains(request.getRequestURI());
        }

        @Override
        protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
                throws ServletException, IOException {
            CachedBodyRequestWrapper wrapped = new CachedBodyRequestWrapper(request);
            String key = request.getRemoteAddr() + "|" + request.getRequestURI() + "|" + accountKey(wrapped);
            long now = System.currentTimeMillis();
            FailureWindow window = failures.compute(key, (ignored, current) ->
                    current == null || current.expiresAt <= now ? new FailureWindow(now + windowMillis) : current);
            if (window.count.get() >= maxAttempts) {
                response.setStatus(429);
                response.setContentType(MediaType.APPLICATION_JSON_VALUE);
                objectMapper.writeValue(response.getWriter(), ErrorResponse.of(
                        ErrorCode.RATE_LIMITED.code(), "Too many authentication attempts; try again later",
                        Map.of(), CorrelationContext.id()));
                return;
            }
            chain.doFilter(wrapped, response);
            if (response.getStatus() == HttpServletResponse.SC_UNAUTHORIZED) {
                window.count.incrementAndGet();
            }
            if (failures.size() > 1000) {
                failures.entrySet().removeIf(entry -> entry.getValue().expiresAt <= now);
            }
        }

        private String accountKey(CachedBodyRequestWrapper request) {
            byte[] body = request.body();
            if (body.length == 0) {
                return "anonymous";
            }
            try {
                JsonNode node = objectMapper.readTree(body);
                String email = node.path("email").asText(null);
                if (email != null && !email.isBlank()) {
                    return email.trim().toLowerCase();
                }
                String refreshToken = node.path("refreshToken").asText(null);
                if (refreshToken != null && !refreshToken.isBlank()) {
                    return "refresh-" + Integer.toHexString(refreshToken.hashCode());
                }
            } catch (IOException ex) {
                return "unparsed";
            }
            return "anonymous";
        }

        private static final class FailureWindow {
            private final AtomicInteger count = new AtomicInteger();
            private final long expiresAt;

            private FailureWindow(long expiresAt) {
                this.expiresAt = expiresAt;
            }
        }

        private static final class CachedBodyRequestWrapper extends HttpServletRequestWrapper {
            private final byte[] body;

            private CachedBodyRequestWrapper(HttpServletRequest request) throws IOException {
                super(request);
                body = request.getInputStream().readAllBytes();
            }

            private byte[] body() {
                return body;
            }

            @Override
            public ServletInputStream getInputStream() {
                ByteArrayInputStream source = new ByteArrayInputStream(body);
                return new ServletInputStream() {
                    @Override
                    public boolean isFinished() {
                        return source.available() == 0;
                    }

                    @Override
                    public boolean isReady() {
                        return true;
                    }

                    @Override
                    public void setReadListener(ReadListener readListener) {
                        throw new UnsupportedOperationException("Async reads are not supported for auth requests");
                    }

                    @Override
                    public int read() {
                        return source.read();
                    }
                };
            }

            @Override
            public BufferedReader getReader() {
                return new BufferedReader(new InputStreamReader(new ByteArrayInputStream(body), StandardCharsets.UTF_8));
            }
        }
    }
}
