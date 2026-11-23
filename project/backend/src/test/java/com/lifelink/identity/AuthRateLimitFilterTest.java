package com.lifelink.identity;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

class AuthRateLimitFilterTest {
    private final ObjectMapper objectMapper = new ObjectMapper().findAndRegisterModules();

    @Test
    void repeatedFailedLoginsForTheSameAccountAreThrottled() throws Exception {
        SecurityConfig.AuthRateLimitFilter filter =
                new SecurityConfig.AuthRateLimitFilter(2, 60, objectMapper);

        for (int attempt = 0; attempt < 2; attempt++) {
            MockHttpServletResponse response = new MockHttpServletResponse();
            AtomicBoolean reachedChain = new AtomicBoolean(false);
            filter.doFilter(loginRequest("member@example.test"), response,
                    failingChain(reachedChain));

            assertTrue(reachedChain.get());
            assertEquals(401, response.getStatus());
        }

        MockHttpServletResponse throttled = new MockHttpServletResponse();
        AtomicBoolean reachedChain = new AtomicBoolean(false);
        filter.doFilter(loginRequest("member@example.test"), throttled, failingChain(reachedChain));

        assertFalse(reachedChain.get());
        assertEquals(429, throttled.getStatus());
        assertEquals("RATE_LIMITED", objectMapper.readTree(throttled.getContentAsString())
                .at("/error/code").asText());
    }

    @Test
    void failuresForDifferentAccountsAreCountedSeparately() throws Exception {
        SecurityConfig.AuthRateLimitFilter filter =
                new SecurityConfig.AuthRateLimitFilter(1, 60, objectMapper);

        filter.doFilter(loginRequest("first@example.test"), new MockHttpServletResponse(),
                failingChain(new AtomicBoolean()));

        MockHttpServletResponse secondResponse = new MockHttpServletResponse();
        AtomicBoolean secondReachedChain = new AtomicBoolean(false);
        filter.doFilter(loginRequest("second@example.test"), secondResponse,
                failingChain(secondReachedChain));

        assertTrue(secondReachedChain.get());
        assertEquals(401, secondResponse.getStatus());
    }

    private MockHttpServletRequest loginRequest(String email) {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/v1/auth/login");
        request.setRemoteAddr("192.0.2.10");
        request.setContentType("application/json");
        request.setContent(("{\"email\":\"" + email + "\",\"password\":\"wrong-password\"}")
                .getBytes(StandardCharsets.UTF_8));
        return request;
    }

    private FilterChain failingChain(AtomicBoolean reachedChain) {
        return (request, response) -> {
            reachedChain.set(true);
            ((org.springframework.mock.web.MockHttpServletResponse) response).setStatus(401);
        };
    }
}
