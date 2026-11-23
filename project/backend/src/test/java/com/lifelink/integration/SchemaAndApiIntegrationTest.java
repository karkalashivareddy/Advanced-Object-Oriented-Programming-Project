package com.lifelink.integration;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.MethodOrderer.OrderAnnotation;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = {"lifelink.seed.enabled=true"})
@ActiveProfiles({"test", "dev"})
@TestMethodOrder(OrderAnnotation.class)
class SchemaAndApiIntegrationTest {

    @Autowired
    private TestRestTemplate rest;

    @Test
    @Order(1)
    void contextLoadsAndPublicHealthIsAvailable() {
        ResponseEntity<JsonNode> response = rest.getForEntity("/actuator/health", JsonNode.class);
        assertEquals(200, response.getStatusCode().value());
        assertEquals("UP", response.getBody().get("status").asText());
    }

    @Test
    @Order(2)
    void protectedEndpointsRequireAuthentication() {
        ResponseEntity<JsonNode> response = rest.getForEntity("/api/v1/analytics/overview", JsonNode.class);
        assertEquals(401, response.getStatusCode().value());
        assertEquals("AUTHENTICATION_REQUIRED", response.getBody().get("error").get("code").asText());
        assertNotNull(response.getBody().get("error").get("correlationId"));
    }

    @Test
    @Order(3)
    void loginSucceedsAndBadCredentialsAreRejected() {
        JsonNode success = login("admin@lifelink.local", "Admin@123!");
        assertTrue(success.get("success").asBoolean());
        assertEquals("admin@lifelink.local", success.get("data").get("user").get("email").asText());
        assertFalse(success.get("data").get("accessToken").asText().isBlank());

        HttpHeaders headers = jsonHeaders();
        ResponseEntity<JsonNode> failure = rest.exchange(
                "/api/v1/auth/login", HttpMethod.POST,
                new HttpEntity<>(Map.of("email", "admin@lifelink.local", "password", "wrong-password"), headers),
                JsonNode.class);
        assertEquals(401, failure.getStatusCode().value());
        assertEquals("AUTHENTICATION_FAILED", failure.getBody().get("error").get("code").asText());
    }

    @Test
    @Order(4)
    void refreshTokenRotatesAndReuseRevokesSessions() {
        JsonNode first = login("inventory@lifelink.local", "Inventory@123!");
        String oldRefresh = first.get("data").get("refreshToken").asText();

        JsonNode rotated = exchange("/api/v1/auth/refresh", Map.of("refreshToken", oldRefresh), jsonHeaders())
                .getBody();
        assertNotNull(rotated);
        assertTrue(rotated.get("success").asBoolean());
        String newRefresh = rotated.get("data").get("refreshToken").asText();
        assertFalse(oldRefresh.equals(newRefresh));

        ResponseEntity<JsonNode> reuse = exchange("/api/v1/auth/refresh",
                Map.of("refreshToken", oldRefresh), jsonHeaders());
        assertEquals(401, reuse.getStatusCode().value());
        assertEquals("AUTHENTICATION_FAILED", reuse.getBody().get("error").get("code").asText());

        ResponseEntity<JsonNode> afterRevoke = exchange("/api/v1/auth/refresh",
                Map.of("refreshToken", newRefresh), jsonHeaders());
        assertEquals(401, afterRevoke.getStatusCode().value());
    }

    @Test
    @Order(5)
    void roleAndTenantChecksAreEnforced() {
        String donorToken = login("donor@lifelink.local", "Donor@123!")
                .get("data").get("accessToken").asText();
        ResponseEntity<JsonNode> donorAnalytics = rest.exchange(
                "/api/v1/analytics/overview", HttpMethod.GET,
                new HttpEntity<>(authHeaders(donorToken)), JsonNode.class);
        assertEquals(403, donorAnalytics.getStatusCode().value());
        assertEquals("UNAUTHORIZED_OPERATION", donorAnalytics.getBody().get("error").get("code").asText());

        String adminToken = adminToken();
        JsonNode organizations = rest.exchange(
                "/api/v1/organizations?page=0&size=20", HttpMethod.GET,
                new HttpEntity<>(authHeaders(adminToken)), JsonNode.class).getBody();
        long bloodBankId = -1;
        for (JsonNode org : organizations.get("data").get("content")) {
            if ("BLOOD_BANK".equals(org.get("type").asText())) {
                bloodBankId = org.get("id").asLong();
            }
        }
        assertTrue(bloodBankId > 0);

        String hospitalToken = login("hospital@lifelink.local", "Hospital@123!")
                .get("data").get("accessToken").asText();
        ResponseEntity<JsonNode> crossTenant = rest.exchange(
                "/api/v1/organizations/" + bloodBankId, HttpMethod.GET,
                new HttpEntity<>(authHeaders(hospitalToken)), JsonNode.class);
        assertEquals(403, crossTenant.getStatusCode().value());
        assertEquals("TENANT_ACCESS_DENIED", crossTenant.getBody().get("error").get("code").asText());
    }

    @Test
    @Order(6)
    void seededDataAndInventoryFiltersAreAvailable() {
        String token = adminToken();
        HttpHeaders headers = authHeaders(token);
        JsonNode overview = rest.exchange("/api/v1/analytics/overview", HttpMethod.GET,
                new HttpEntity<>(headers), JsonNode.class).getBody();
        assertTrue(overview.get("data").get("availableUnits").asLong() >= 4);
        assertTrue(overview.get("data").get("pendingRequests").asLong() >= 0);

        JsonNode inventory = rest.exchange(
                "/api/v1/inventory?bloodGroup=O_POSITIVE&componentType=WHOLE_BLOOD&status=AVAILABLE&size=20",
                HttpMethod.GET, new HttpEntity<>(headers), JsonNode.class).getBody();
        assertTrue(inventory.get("data").get("totalElements").asLong() >= 1);
        assertEquals("AVAILABLE", inventory.get("data").get("content").get(0).get("status").asText());
        assertNotNull(inventory.get("data").get("content").get(0).get("version"));
    }

    @Test
    @Order(7)
    void allocationReservationAndDeliveryWorkflowIsIdempotent() {
        String token = adminToken();
        HttpHeaders headers = authHeaders(token);

        JsonNode requests = rest.exchange(
                "/api/v1/emergency-requests?status=APPROVED", HttpMethod.GET,
                new HttpEntity<>(headers), JsonNode.class).getBody();
        assertTrue(requests.get("data").size() > 0);
        long requestId = requests.get("data").get(0).get("id").asLong();

        JsonNode units = rest.exchange(
                "/api/v1/inventory?bloodGroup=O_POSITIVE&componentType=WHOLE_BLOOD&status=AVAILABLE&size=20",
                HttpMethod.GET, new HttpEntity<>(headers), JsonNode.class).getBody();
        long unitId = units.get("data").get("content").get(0).get("id").asLong();

        JsonNode suggestion = exchange("/api/v1/allocations/suggestions",
                Map.of("requestId", requestId), headers).getBody();
        assertNotNull(suggestion);
        assertTrue(suggestion.get("data").get("humanApprovalRequired").asBoolean());

        String idempotencyKey = "integration-" + UUID.randomUUID();
        HttpHeaders withKey = authHeaders(token);
        withKey.set("Idempotency-Key", idempotencyKey);
        Map<String, Object> confirmBody = Map.of(
                "requestId", requestId,
                "unitIds", List.of(unitId),
                "idempotencyKey", idempotencyKey);

        JsonNode firstConfirmation = exchange("/api/v1/allocations/confirm", confirmBody, withKey).getBody();
        assertNotNull(firstConfirmation);
        assertEquals(1, firstConfirmation.get("data").get("reservations").size());
        long reservationId = firstConfirmation.get("data").get("reservations").get(0).get("id").asLong();

        JsonNode repeatedConfirmation = exchange("/api/v1/allocations/confirm", confirmBody, withKey).getBody();
        assertNotNull(repeatedConfirmation);
        assertEquals(reservationId,
                repeatedConfirmation.get("data").get("reservations").get(0).get("id").asLong());

        JsonNode confirmedReservation = exchange("/api/v1/reservations/" + reservationId + "/confirm",
                Map.of(), headers).getBody();
        assertNotNull(confirmedReservation);
        assertEquals("CONFIRMED", confirmedReservation.get("data").get("status").asText());

        JsonNode dispatch = exchange("/api/v1/dispatches",
                Map.of("reservationId", reservationId, "assignedStaff", "Integration Tester"), headers).getBody();
        assertNotNull(dispatch);
        long dispatchId = dispatch.get("data").get("id").asLong();

        JsonNode departed = exchange("/api/v1/dispatches/" + dispatchId + "/depart", Map.of(), headers).getBody();
        assertEquals("IN_TRANSIT", departed.get("data").get("status").asText());

        JsonNode delivered = exchange("/api/v1/dispatches/" + dispatchId + "/deliver",
                Map.of("recipientName", "Authorized Receiver"), headers).getBody();
        assertEquals("DELIVERED", delivered.get("data").get("status").asText());

        JsonNode unit = rest.exchange("/api/v1/inventory/" + unitId, HttpMethod.GET,
                new HttpEntity<>(headers), JsonNode.class).getBody();
        assertEquals("DELIVERED", unit.get("data").get("status").asText());

        JsonNode requestDetail = rest.exchange("/api/v1/emergency-requests/" + requestId, HttpMethod.GET,
                new HttpEntity<>(headers), JsonNode.class).getBody();
        assertEquals("FULFILLED", requestDetail.get("data").get("request").get("status").asText());
    }

    @Test
    @Order(8)
    void concurrentConfirmationsWithSameKeyCreateOneReservation() throws Exception {
        String token = adminToken();
        HttpHeaders headers = authHeaders(token);

        JsonNode organizations = rest.exchange(
                "/api/v1/organizations?page=0&size=20", HttpMethod.GET,
                new HttpEntity<>(headers), JsonNode.class).getBody();
        long hospitalId = -1;
        for (JsonNode org : organizations.get("data").get("content")) {
            if ("HOSPITAL".equals(org.get("type").asText())) {
                hospitalId = org.get("id").asLong();
            }
        }
        assertTrue(hospitalId > 0);

        JsonNode created = exchange("/api/v1/emergency-requests", Map.of(
                "organizationId", hospitalId,
                "patientRef", "CONCURRENCY-TEST",
                "bloodGroup", "O_POSITIVE",
                "componentType", "WHOLE_BLOOD",
                "quantity", 1,
                "priority", "URGENT",
                "requiredBy", Instant.now().plus(Duration.ofHours(2)).toString(),
                "reason", "Concurrent idempotency verification"), headers).getBody();
        long requestId = created.get("data").get("id").asLong();
        exchange("/api/v1/emergency-requests/" + requestId + "/verify", Map.of(), headers);
        exchange("/api/v1/emergency-requests/" + requestId + "/approve", Map.of(), headers);

        JsonNode units = rest.exchange(
                "/api/v1/inventory?bloodGroup=O_POSITIVE&componentType=WHOLE_BLOOD&status=AVAILABLE&size=1",
                HttpMethod.GET, new HttpEntity<>(headers), JsonNode.class).getBody();
        long unitId = units.get("data").get("content").get(0).get("id").asLong();

        String key = "concurrent-" + UUID.randomUUID();
        Map<String, Object> body = Map.of(
                "requestId", requestId,
                "unitIds", List.of(unitId),
                "idempotencyKey", key);
        Callable<ResponseEntity<JsonNode>> task = () -> {
            HttpHeaders callHeaders = authHeaders(token);
            callHeaders.set("Idempotency-Key", key);
            return exchange("/api/v1/allocations/confirm", body, callHeaders);
        };

        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            Future<ResponseEntity<JsonNode>> first = pool.submit(task);
            Future<ResponseEntity<JsonNode>> second = pool.submit(task);
            ResponseEntity<JsonNode> firstResult = first.get(30, TimeUnit.SECONDS);
            ResponseEntity<JsonNode> secondResult = second.get(30, TimeUnit.SECONDS);

            assertEquals(200, firstResult.getStatusCode().value());
            assertEquals(200, secondResult.getStatusCode().value());
            long firstReservation = firstResult.getBody().get("data").get("reservations").get(0).get("id").asLong();
            long secondReservation = secondResult.getBody().get("data").get("reservations").get(0).get("id").asLong();
            assertEquals(firstReservation, secondReservation);

            JsonNode unit = rest.exchange("/api/v1/inventory/" + unitId, HttpMethod.GET,
                    new HttpEntity<>(headers), JsonNode.class).getBody();
            assertEquals("RESERVED", unit.get("data").get("status").asText());

            JsonNode detail = rest.exchange("/api/v1/emergency-requests/" + requestId, HttpMethod.GET,
                    new HttpEntity<>(headers), JsonNode.class).getBody();
            assertEquals("RESERVED", detail.get("data").get("request").get("status").asText());
        } finally {
            pool.shutdownNow();
        }
    }

    private String adminToken() {
        return login("admin@lifelink.local", "Admin@123!").get("data").get("accessToken").asText();
    }

    private JsonNode login(String email, String password) {
        ResponseEntity<JsonNode> response = exchange("/api/v1/auth/login",
                Map.of("email", email, "password", password), jsonHeaders());
        assertEquals(200, response.getStatusCode().value());
        return response.getBody();
    }

    private ResponseEntity<JsonNode> exchange(String path, Object body, HttpHeaders headers) {
        HttpHeaders copy = new HttpHeaders();
        copy.putAll(headers);
        copy.setContentType(MediaType.APPLICATION_JSON);
        return rest.exchange(path, HttpMethod.POST, new HttpEntity<>(body, copy), JsonNode.class);
    }

    private HttpHeaders jsonHeaders() {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        return headers;
    }

    private HttpHeaders authHeaders(String token) {
        HttpHeaders headers = jsonHeaders();
        headers.setBearerAuth(token);
        return headers;
    }
}
