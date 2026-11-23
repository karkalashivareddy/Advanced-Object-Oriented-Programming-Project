package com.lifelink.concurrency;

import static org.junit.jupiter.api.Assertions.assertEquals;
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
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/** PostgreSQL 16 contention checks for the canonical idempotency records. */
@Testcontainers(disabledWithoutDocker = true)
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles({"test", "postgres-it"})
class PostgresIdempotencyConcurrencyTest {

    @Container
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");

    @DynamicPropertySource
    static void datasource(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
        registry.add("spring.datasource.driver-class-name", () -> "org.postgresql.Driver");
        registry.add("lifelink.seed.enabled", () -> "true");
    }

    @Autowired
    private TestRestTemplate rest;

    @Test
    void sameKeyReservationReplayUnderContentionReturnsOneReservation() throws Exception {
        String admin = adminToken();
        long hospitalId = organizationId(admin, "HOSPITAL");
        long requestId = createApprovedRequest(admin, hospitalId, "PG-RES-REPLAY");
        long unitId = createUnit(admin, organizationId(admin, "BLOOD_BANK"));
        String key = "pg-res-replay-" + UUID.randomUUID();
        Map<String, Object> body = Map.of("unitId", unitId, "requestId", requestId, "idempotencyKey", key);

        List<ResponseEntity<JsonNode>> results = concurrent(
                () -> exchange("/api/v1/reservations", body, withKey(admin, key)),
                () -> exchange("/api/v1/reservations", body, withKey(admin, key)));

        assertEquals(200, results.get(0).getStatusCode().value(), results.get(0).getBody().toString());
        assertEquals(200, results.get(1).getStatusCode().value(), results.get(1).getBody().toString());
        assertEquals(results.get(0).getBody().get("data").get("id").asLong(),
                results.get(1).getBody().get("data").get("id").asLong());
    }

    @Test
    void differentKeysForSameUnitCreateOnlyOneReservation() throws Exception {
        String admin = adminToken();
        long hospitalId = organizationId(admin, "HOSPITAL");
        long requestId = createApprovedRequest(admin, hospitalId, "PG-RES-CONFLICT");
        long unitId = createUnit(admin, organizationId(admin, "BLOOD_BANK"));
        String firstKey = "pg-res-a-" + UUID.randomUUID();
        String secondKey = "pg-res-b-" + UUID.randomUUID();
        Map<String, Object> firstBody = Map.of("unitId", unitId, "requestId", requestId,
                "idempotencyKey", firstKey);
        Map<String, Object> secondBody = Map.of("unitId", unitId, "requestId", requestId,
                "idempotencyKey", secondKey);

        List<ResponseEntity<JsonNode>> results = concurrent(
                () -> exchange("/api/v1/reservations", firstBody, withKey(admin, firstKey)),
                () -> exchange("/api/v1/reservations", secondBody, withKey(admin, secondKey)));

        long successes = results.stream().filter(result -> result.getStatusCode().value() == 200).count();
        long conflicts = results.stream().filter(result -> result.getStatusCode().value() == 409).count();
        assertEquals(1, successes, results.toString());
        assertEquals(1, conflicts, results.toString());
    }

    @Test
    void reservationKeyReplayWithDifferentUnitIsRejected() {
        String admin = adminToken();
        long hospitalId = organizationId(admin, "HOSPITAL");
        long bankId = organizationId(admin, "BLOOD_BANK");
        long firstRequest = createApprovedRequest(admin, hospitalId, "PG-RES-FP-1");
        long secondRequest = createApprovedRequest(admin, hospitalId, "PG-RES-FP-2");
        long firstUnit = createUnit(admin, bankId);
        long secondUnit = createUnit(admin, bankId);
        String key = "pg-res-fp-" + UUID.randomUUID();

        assertEquals(200, exchange("/api/v1/reservations",
                Map.of("unitId", firstUnit, "requestId", firstRequest, "idempotencyKey", key),
                withKey(admin, key)).getStatusCode().value());
        ResponseEntity<JsonNode> mismatch = exchange("/api/v1/reservations",
                Map.of("unitId", secondUnit, "requestId", secondRequest, "idempotencyKey", key),
                withKey(admin, key));
        assertEquals(409, mismatch.getStatusCode().value());
        assertEquals("BUSINESS_RULE_VIOLATION", mismatch.getBody().get("error").get("code").asText());
    }

    @Test
    void dispatchReplayAndDuplicateReservationConflictUnderContention() throws Exception {
        String admin = adminToken();
        long hospitalId = organizationId(admin, "HOSPITAL");
        long bankId = organizationId(admin, "BLOOD_BANK");
        long requestId = createApprovedRequest(admin, hospitalId, "PG-DISPATCH-REPLAY");
        long unitId = createUnit(admin, bankId);
        long reservationId = confirmedReservation(admin, requestId, unitId);
        String key = "pg-dispatch-" + UUID.randomUUID();
        Map<String, Object> body = Map.of("reservationId", reservationId, "assignedStaff", "PG Tester");

        List<ResponseEntity<JsonNode>> replayed = concurrent(
                () -> exchange("/api/v1/dispatches", body, withKey(admin, key)),
                () -> exchange("/api/v1/dispatches", body, withKey(admin, key)));
        assertEquals(200, replayed.get(0).getStatusCode().value(), replayed.get(0).getBody().toString());
        assertEquals(200, replayed.get(1).getStatusCode().value(), replayed.get(1).getBody().toString());
        assertEquals(replayed.get(0).getBody().get("data").get("id").asLong(),
                replayed.get(1).getBody().get("data").get("id").asLong());

        long secondRequest = createApprovedRequest(admin, hospitalId, "PG-DISPATCH-CONFLICT");
        long secondUnit = createUnit(admin, bankId);
        long secondReservation = confirmedReservation(admin, secondRequest, secondUnit);
        String firstKey = "pg-dispatch-a-" + UUID.randomUUID();
        String otherKey = "pg-dispatch-b-" + UUID.randomUUID();
        List<ResponseEntity<JsonNode>> competing = concurrent(
                () -> exchange("/api/v1/dispatches",
                        Map.of("reservationId", secondReservation, "assignedStaff", "PG Tester"),
                        withKey(admin, firstKey)),
                () -> exchange("/api/v1/dispatches",
                        Map.of("reservationId", secondReservation, "assignedStaff", "PG Tester"),
                        withKey(admin, otherKey)));
        assertEquals(1, competing.stream().filter(result -> result.getStatusCode().value() == 200).count(),
                competing.toString());
        assertEquals(1, competing.stream().filter(result -> result.getStatusCode().value() == 409).count(),
                competing.toString());
    }

    @SafeVarargs
    private final List<ResponseEntity<JsonNode>> concurrent(Callable<ResponseEntity<JsonNode>>... tasks)
            throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(tasks.length);
        try {
            List<Future<ResponseEntity<JsonNode>>> futures = java.util.Arrays.stream(tasks)
                    .map(pool::submit).toList();
            List<ResponseEntity<JsonNode>> results = new java.util.ArrayList<>();
            for (Future<ResponseEntity<JsonNode>> future : futures) {
                results.add(future.get(60, TimeUnit.SECONDS));
            }
            return results;
        } finally {
            pool.shutdownNow();
        }
    }

    private long confirmedReservation(String admin, long requestId, long unitId) {
        String key = "pg-alloc-" + UUID.randomUUID();
        JsonNode confirmation = exchange("/api/v1/allocations/confirm", Map.of(
                "requestId", requestId, "unitIds", List.of(unitId), "idempotencyKey", key),
                withKey(admin, key)).getBody();
        assertNotNull(confirmation);
        long reservationId = confirmation.get("data").get("reservations").get(0).get("id").asLong();
        assertEquals(200, exchange("/api/v1/reservations/" + reservationId + "/confirm", Map.of(),
                authHeaders(admin)).getStatusCode().value());
        return reservationId;
    }

    private long createUnit(String admin, long bankId) {
        String unitNumber = "PG-" + UUID.randomUUID().toString().substring(0, 10).toUpperCase();
        JsonNode created = exchange("/api/v1/inventory", Map.of(
                "organizationId", bankId,
                "unitNumber", unitNumber,
                "bloodGroup", "O_POSITIVE",
                "componentType", "WHOLE_BLOOD",
                "collectedAt", Instant.now().minus(Duration.ofHours(6)).toString(),
                "expiresAt", Instant.now().plus(Duration.ofDays(35)).toString(),
                "storageLocation", "PG-COLD-ROOM"), authHeaders(admin)).getBody();
        assertNotNull(created);
        long unitId = created.get("data").get("id").asLong();
        assertEquals(200, exchange("/api/v1/inventory/" + unitId + "/release", Map.of(),
                authHeaders(admin)).getStatusCode().value());
        return unitId;
    }

    private long createApprovedRequest(String admin, long hospitalId, String reference) {
        JsonNode created = exchange("/api/v1/emergency-requests", Map.of(
                "organizationId", hospitalId,
                "patientRef", reference,
                "bloodGroup", "O_POSITIVE",
                "componentType", "WHOLE_BLOOD",
                "quantity", 1,
                "priority", "URGENT",
                "requiredBy", Instant.now().plus(Duration.ofHours(2)).toString(),
                "reason", "PostgreSQL concurrency verification"), authHeaders(admin)).getBody();
        assertNotNull(created);
        assertTrue(created.get("success").asBoolean());
        long requestId = created.get("data").get("id").asLong();
        exchange("/api/v1/emergency-requests/" + requestId + "/verify", Map.of(), authHeaders(admin));
        exchange("/api/v1/emergency-requests/" + requestId + "/approve", Map.of(), authHeaders(admin));
        return requestId;
    }

    private long organizationId(String admin, String type) {
        JsonNode organizations = rest.exchange("/api/v1/organizations?page=0&size=20", HttpMethod.GET,
                new HttpEntity<>(authHeaders(admin)), JsonNode.class).getBody();
        assertNotNull(organizations);
        for (JsonNode organization : organizations.get("data").get("content")) {
            if (type.equals(organization.get("type").asText())) {
                return organization.get("id").asLong();
            }
        }
        throw new AssertionError("No organization of type " + type);
    }

    private String adminToken() {
        JsonNode login = exchange("/api/v1/auth/login",
                Map.of("email", "admin@lifelink.local", "password", "Admin@123!"), jsonHeaders()).getBody();
        assertNotNull(login);
        return login.get("data").get("accessToken").asText();
    }

    private HttpHeaders withKey(String token, String key) {
        HttpHeaders headers = authHeaders(token);
        headers.set("Idempotency-Key", key);
        return headers;
    }

    private ResponseEntity<JsonNode> exchange(String path, Object body, HttpHeaders headers) {
        HttpHeaders copy = new HttpHeaders();
        copy.putAll(headers);
        copy.setContentType(MediaType.APPLICATION_JSON);
        return rest.exchange(path, HttpMethod.POST, new HttpEntity<>(body, copy), JsonNode.class);
    }

    private HttpHeaders authHeaders(String token) {
        HttpHeaders headers = jsonHeaders();
        headers.setBearerAuth(token);
        return headers;
    }

    private HttpHeaders jsonHeaders() {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        return headers;
    }
}
