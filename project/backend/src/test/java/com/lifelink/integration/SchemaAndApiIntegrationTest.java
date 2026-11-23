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

        ResponseEntity<JsonNode> invalidToken = rest.exchange("/api/v1/auth/me", HttpMethod.GET,
                new HttpEntity<>(authHeaders("not-a-jwt")), JsonNode.class);
        assertEquals(401, invalidToken.getStatusCode().value());
        assertEquals("TOKEN_INVALID", invalidToken.getBody().get("error").get("code").asText());
    }

    @Test
    @Order(99)
    void sockJsInfoIsPublicWhileStompFramesRemainAuthenticated() {
        ResponseEntity<String> info = rest.getForEntity("/ws/info", String.class);
        assertEquals(200, info.getStatusCode().value());
        assertNotNull(info.getBody());
        assertTrue(info.getBody().contains("websocket"));

        // The HTTP handshake is public by design; the STOMP interceptor tests cover
        // rejection of CONNECT frames without a bearer token.
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
        long secondUnitId = units.get("data").get("content").get(1).get("id").asLong();

        JsonNode suggestion = exchange("/api/v1/allocations/suggestions",
                Map.of("requestId", requestId), headers).getBody();
        assertNotNull(suggestion);
        assertTrue(suggestion.get("data").get("humanApprovalRequired").asBoolean());

        String idempotencyKey = "integration-" + UUID.randomUUID();
        HttpHeaders withKey = authHeaders(token);
        withKey.set("Idempotency-Key", idempotencyKey);
        Map<String, Object> confirmBody = Map.of(
                "requestId", requestId,
                "unitIds", List.of(unitId, secondUnitId),
                "idempotencyKey", idempotencyKey);

        JsonNode firstConfirmation = exchange("/api/v1/allocations/confirm", confirmBody, withKey).getBody();
        assertNotNull(firstConfirmation);
        assertEquals(2, firstConfirmation.get("data").get("reservations").size());
        long reservationId = firstConfirmation.get("data").get("reservations").get(0).get("id").asLong();

        JsonNode repeatedConfirmation = exchange("/api/v1/allocations/confirm", confirmBody, withKey).getBody();
        assertNotNull(repeatedConfirmation);
        assertEquals(reservationId,
                repeatedConfirmation.get("data").get("reservations").get(0).get("id").asLong());

        JsonNode confirmedReservation = exchange("/api/v1/reservations/" + reservationId + "/confirm",
                Map.of(), headers).getBody();
        assertNotNull(confirmedReservation);
        assertEquals("CONFIRMED", confirmedReservation.get("data").get("status").asText());

        ResponseEntity<JsonNode> missingDispatchKey = exchange("/api/v1/dispatches",
                Map.of("reservationId", reservationId, "assignedStaff", "Integration Tester"),
                authHeaders(token));
        assertEquals(409, missingDispatchKey.getStatusCode().value());
        assertEquals("BUSINESS_RULE_VIOLATION",
                missingDispatchKey.getBody().get("error").get("code").asText());

        HttpHeaders dispatchHeaders = authHeaders(token);
        dispatchHeaders.set("Idempotency-Key", "dispatch-" + UUID.randomUUID());
        Map<String, Object> dispatchBody = Map.of(
                "reservationId", reservationId, "assignedStaff", "Integration Tester");
        JsonNode dispatch = exchange("/api/v1/dispatches", dispatchBody, dispatchHeaders).getBody();
        assertNotNull(dispatch);
        long dispatchId = dispatch.get("data").get("id").asLong();
        JsonNode repeatedDispatch = exchange("/api/v1/dispatches", dispatchBody, dispatchHeaders).getBody();
        assertNotNull(repeatedDispatch);
        assertEquals(dispatchId, repeatedDispatch.get("data").get("id").asLong());

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

    @Test
    @Order(9)
    void hospitalStaffCannotAllocateUnitsFromAnotherOrganization() {
        String admin = adminToken();
        HttpHeaders adminHeaders = authHeaders(admin);
        JsonNode organizations = get("/api/v1/organizations?page=0&size=20", adminHeaders);
        long bankId = organizationId(organizations, "BLOOD_BANK");
        long hospitalId = organizationId(organizations, "HOSPITAL");

        JsonNode units = get(
                "/api/v1/inventory?bloodGroup=O_POSITIVE&componentType=WHOLE_BLOOD&status=AVAILABLE&size=20",
                adminHeaders);
        long bankUnitId = units.get("data").get("content").get(0).get("id").asLong();

        String hospitalToken = login("hospital@lifelink.local", "Hospital@123!")
                .get("data").get("accessToken").asText();
        HttpHeaders hospitalHeaders = authHeaders(hospitalToken);

        String allocationUserEmail = "cross-tenant-" + UUID.randomUUID() + "@example.test";
        JsonNode registered = exchange("/api/v1/auth/register", Map.of(
                "email", allocationUserEmail,
                "password", "Test@12345!",
                "fullName", "Cross Tenant Tester"), jsonHeaders()).getBody();
        long allocationUserId = registered.get("data").get("user").get("id").asLong();
        // BLOOD_BANK_ADMIN supplies ALLOCATION_CONFIRM; the organization membership remains hospital-only.
        exchange("/api/v1/organizations/" + hospitalId + "/members",
                Map.of("userId", allocationUserId, "role", "BLOOD_BANK_ADMIN"), adminHeaders);
        HttpHeaders allocationHeaders = authHeaders(login(allocationUserEmail, "Test@12345!")
                .get("data").get("accessToken").asText());

        JsonNode created = exchange("/api/v1/emergency-requests", Map.of(
                "organizationId", hospitalId,
                "patientRef", "CROSS-TENANT-TEST",
                "bloodGroup", "O_POSITIVE",
                "componentType", "WHOLE_BLOOD",
                "quantity", 1,
                "priority", "URGENT",
                "requiredBy", Instant.now().plus(Duration.ofHours(2)).toString(),
                "reason", "Cross-tenant allocation regression"), hospitalHeaders).getBody();
        long requestId = created.get("data").get("id").asLong();
        exchange("/api/v1/emergency-requests/" + requestId + "/verify", Map.of(), hospitalHeaders);
        exchange("/api/v1/emergency-requests/" + requestId + "/approve", Map.of(), hospitalHeaders);

        JsonNode suggestion = exchange("/api/v1/allocations/suggestions",
                Map.of("requestId", requestId), allocationHeaders).getBody();
        assertNotNull(suggestion);
        assertEquals(0, suggestion.get("data").get("candidates").size());

        HttpHeaders confirmHeaders = authHeaders(login(allocationUserEmail, "Test@12345!")
                .get("data").get("accessToken").asText());
        String allocationKey = "cross-tenant-" + UUID.randomUUID();
        confirmHeaders.set("Idempotency-Key", allocationKey);
        ResponseEntity<JsonNode> crossTenant = exchange("/api/v1/allocations/confirm", Map.of(
                "requestId", requestId,
                "unitIds", List.of(bankUnitId),
                "idempotencyKey", allocationKey), confirmHeaders);
        assertEquals(403, crossTenant.getStatusCode().value());
        assertEquals("TENANT_ACCESS_DENIED", crossTenant.getBody().get("error").get("code").asText());
        assertTrue(bankId > 0);
    }

    @Test
    @Order(10)
    void donorProfileIsNotExposedToAnUnrelatedOrganization() {
        String admin = adminToken();
        JsonNode donors = get("/api/v1/donors", authHeaders(admin));
        long donorId = -1;
        for (JsonNode donor : donors.get("data")) {
            if ("donor@lifelink.local".equals(donor.get("email").asText())) {
                donorId = donor.get("id").asLong();
            }
        }
        assertTrue(donorId > 0);

        String hospitalToken = login("hospital@lifelink.local", "Hospital@123!")
                .get("data").get("accessToken").asText();
        assertEquals(200, rest.exchange("/api/v1/auth/me", HttpMethod.GET,
                new HttpEntity<>(authHeaders(hospitalToken)), JsonNode.class).getStatusCode().value());
        JsonNode hospitalDonations = get("/api/v1/donations?donorId=" + donorId, authHeaders(hospitalToken));
        assertEquals(0, hospitalDonations.get("data").size());
        for (String path : List.of("/api/v1/donors/" + donorId, "/api/v1/donors/" + donorId + "/consents",
                "/api/v1/donors/" + donorId + "/appointments")) {
            ResponseEntity<JsonNode> response = rest.exchange(path, HttpMethod.GET,
                    new HttpEntity<>(authHeaders(hospitalToken)), JsonNode.class);
            assertEquals(403, response.getStatusCode().value(), path + " => " + response.getBody());
            assertEquals("TENANT_ACCESS_DENIED", response.getBody().get("error").get("code").asText());
        }

        String donorToken = login("donor@lifelink.local", "Donor@123!")
                .get("data").get("accessToken").asText();
        ResponseEntity<JsonNode> own = rest.exchange("/api/v1/donors/" + donorId, HttpMethod.GET,
                new HttpEntity<>(authHeaders(donorToken)), JsonNode.class);
        assertEquals(200, own.getStatusCode().value());
    }

    @Test
    @Order(11)
    void disabledUserCannotUseAnExistingAccessTokenOrRefreshToken() {
        JsonNode login = login("hospital@lifelink.local", "Hospital@123!");
        String accessToken = login.get("data").get("accessToken").asText();
        String refreshToken = login.get("data").get("refreshToken").asText();
        long userId = get("/api/v1/auth/me", authHeaders(accessToken)).get("data").get("id").asLong();

        String admin = adminToken();
        assertEquals(200, patch("/api/v1/users/" + userId + "/status",
                Map.of("status", "DISABLED"), authHeaders(admin)).getStatusCode().value());

        ResponseEntity<JsonNode> protectedCall = rest.exchange("/api/v1/auth/me", HttpMethod.GET,
                new HttpEntity<>(authHeaders(accessToken)), JsonNode.class);
        assertEquals(401, protectedCall.getStatusCode().value());
        assertEquals("TOKEN_INVALID", protectedCall.getBody().get("error").get("code").asText());

        ResponseEntity<JsonNode> refresh = exchange("/api/v1/auth/refresh",
                Map.of("refreshToken", refreshToken), jsonHeaders());
        assertEquals(401, refresh.getStatusCode().value());

        assertEquals(200, patch("/api/v1/users/" + userId + "/status",
                Map.of("status", "ACTIVE"), authHeaders(admin)).getStatusCode().value());
    }

    @Test
    @Order(12)
    void organizationMembershipDoesNotMutateGlobalRoles() {
        String admin = adminToken();
        HttpHeaders adminHeaders = authHeaders(admin);
        JsonNode organizations = get("/api/v1/organizations?page=0&size=20", adminHeaders);
        long bankId = organizationId(organizations, "BLOOD_BANK");
        long hospitalId = organizationId(organizations, "HOSPITAL");

        JsonNode users = get("/api/v1/users?search=donor@lifelink.local&size=20", adminHeaders);
        long donorUserId = -1;
        for (JsonNode user : users.get("data").get("content")) {
            if ("donor@lifelink.local".equals(user.get("email").asText())) {
                donorUserId = user.get("id").asLong();
            }
        }
        assertTrue(donorUserId > 0);

        ResponseEntity<JsonNode> addMember = exchange("/api/v1/organizations/" + bankId + "/members",
                Map.of("userId", donorUserId, "role", "BLOOD_BANK_ADMIN"), adminHeaders);
        assertEquals(200, addMember.getStatusCode().value());

        JsonNode me = get("/api/v1/auth/me", authHeaders(login("donor@lifelink.local", "Donor@123!")
                .get("data").get("accessToken").asText()));
        JsonNode roles = me.get("data").get("roles");
        assertEquals(1, roles.size());
        assertEquals("DONOR", roles.get(0).asText());
        assertTrue(me.get("data").get("permissions").toString().contains("INVENTORY_READ"));
        assertEquals(bankId, me.get("data").get("memberships").get(0).get("organizationId").asLong());

        String donorToken = login("donor@lifelink.local", "Donor@123!")
                .get("data").get("accessToken").asText();
        ResponseEntity<JsonNode> crossTenant = rest.exchange("/api/v1/organizations/" + hospitalId,
                HttpMethod.GET, new HttpEntity<>(authHeaders(donorToken)), JsonNode.class);
        assertEquals(403, crossTenant.getStatusCode().value());
        assertEquals("TENANT_ACCESS_DENIED", crossTenant.getBody().get("error").get("code").asText());
    }

    @Test
    @Order(13)
    void allocationRejectsIncompatibleUnitsAndWrongUnitCounts() {
        String admin = adminToken();
        HttpHeaders adminHeaders = authHeaders(admin);
        JsonNode organizations = get("/api/v1/organizations?page=0&size=20", adminHeaders);
        long hospitalId = organizationId(organizations, "HOSPITAL");
        long bankId = organizationId(organizations, "BLOOD_BANK");
        long firstCompatibleId = createAvailableWholeBloodUnit(admin, bankId);
        long secondCompatibleId = createAvailableWholeBloodUnit(admin, bankId);

        JsonNode created = exchange("/api/v1/emergency-requests", Map.of(
                "organizationId", hospitalId,
                "patientRef", "COMPATIBILITY-TEST",
                "bloodGroup", "O_POSITIVE",
                "componentType", "WHOLE_BLOOD",
                "quantity", 1,
                "priority", "URGENT",
                "requiredBy", Instant.now().plus(Duration.ofHours(2)).toString(),
                "reason", "Compatibility regression"), adminHeaders).getBody();
        long requestId = created.get("data").get("id").asLong();
        exchange("/api/v1/emergency-requests/" + requestId + "/verify", Map.of(), adminHeaders);
        exchange("/api/v1/emergency-requests/" + requestId + "/approve", Map.of(), adminHeaders);

        long incompatibleUnitId = get("/api/v1/inventory?componentType=RED_CELLS&status=AVAILABLE&size=20",
                adminHeaders).get("data").get("content").get(0).get("id").asLong();

        ResponseEntity<JsonNode> incompatible = confirmAllocation(admin,
                requestId, List.of(incompatibleUnitId));
        assertEquals(409, incompatible.getStatusCode().value());
        assertEquals("BUSINESS_RULE_VIOLATION", incompatible.getBody().get("error").get("code").asText());

        ResponseEntity<JsonNode> wrongCount = confirmAllocation(admin,
                requestId, List.of(firstCompatibleId, secondCompatibleId));
        assertEquals(409, wrongCount.getStatusCode().value());
        assertEquals("BUSINESS_RULE_VIOLATION", wrongCount.getBody().get("error").get("code").asText());
    }

    @Test
    @Order(14)
    void allocationKeyReuseWithDifferentUnitSetIsRejected() {
        String admin = adminToken();
        HttpHeaders adminHeaders = authHeaders(admin);
        JsonNode organizations = get("/api/v1/organizations?page=0&size=20", adminHeaders);
        long bankId = organizationId(organizations, "BLOOD_BANK");
        long hospitalId = organizationId(organizations, "HOSPITAL");
        long firstUnit = createAvailableWholeBloodUnit(admin, bankId);
        long secondUnit = createAvailableWholeBloodUnit(admin, bankId);
        long requestId = createApprovedRequest(admin, hospitalId, "FP-MISMATCH");

        String key = "fingerprint-" + UUID.randomUUID();
        HttpHeaders firstHeaders = authHeaders(admin);
        firstHeaders.set("Idempotency-Key", key);
        ResponseEntity<JsonNode> first = exchange("/api/v1/allocations/confirm", Map.of(
                "requestId", requestId, "unitIds", List.of(firstUnit), "idempotencyKey", key), firstHeaders);
        assertEquals(200, first.getStatusCode().value());

        HttpHeaders replayHeaders = authHeaders(admin);
        replayHeaders.set("Idempotency-Key", key);
        ResponseEntity<JsonNode> replay = exchange("/api/v1/allocations/confirm", Map.of(
                "requestId", requestId, "unitIds", List.of(secondUnit), "idempotencyKey", key), replayHeaders);
        assertEquals(409, replay.getStatusCode().value());
        assertEquals("BUSINESS_RULE_VIOLATION", replay.getBody().get("error").get("code").asText());
    }

    @Test
    @Order(15)
    void bankStaffCanDispatchHospitalRequestButHospitalStaffCannot() {
        String admin = adminToken();
        HttpHeaders adminHeaders = authHeaders(admin);
        JsonNode organizations = get("/api/v1/organizations?page=0&size=20", adminHeaders);
        long bankId = organizationId(organizations, "BLOOD_BANK");
        long hospitalId = organizationId(organizations, "HOSPITAL");

        String bankToken = login("bank@lifelink.local", "Bank@123!").get("data").get("accessToken").asText();
        String hospitalToken = login("hospital@lifelink.local", "Hospital@123!")
                .get("data").get("accessToken").asText();

        long unitId = createAvailableWholeBloodUnit(admin, bankId);
        long requestId = createApprovedRequest(admin, hospitalId, "BANK-DISPATCH");
        long reservationId = confirmAsBank(bankToken, requestId, unitId);
        exchange("/api/v1/reservations/" + reservationId + "/confirm", Map.of(), authHeaders(hospitalToken));

        HttpHeaders bankDispatchHeaders = authHeaders(bankToken);
        bankDispatchHeaders.set("Idempotency-Key", "bank-dispatch-" + UUID.randomUUID());
        ResponseEntity<JsonNode> bankDispatch = exchange("/api/v1/dispatches",
                Map.of("reservationId", reservationId, "assignedStaff", "Bank Dispatcher"), bankDispatchHeaders);
        assertEquals(200, bankDispatch.getStatusCode().value(), bankDispatch.getBody().toString());
        assertEquals(bankId, bankDispatch.getBody().get("data").get("organizationId").asLong());

        long secondUnit = createAvailableWholeBloodUnit(admin, bankId);
        long secondRequest = createApprovedRequest(admin, hospitalId, "HOSPITAL-DISPATCH-DENIED");
        long secondReservation = confirmAsBank(bankToken, secondRequest, secondUnit);
        exchange("/api/v1/reservations/" + secondReservation + "/confirm", Map.of(), authHeaders(hospitalToken));

        HttpHeaders hospitalDispatchHeaders = authHeaders(hospitalToken);
        hospitalDispatchHeaders.set("Idempotency-Key", "hospital-dispatch-" + UUID.randomUUID());
        ResponseEntity<JsonNode> hospitalDispatch = exchange("/api/v1/dispatches",
                Map.of("reservationId", secondReservation, "assignedStaff", "Hospital Staff"), hospitalDispatchHeaders);
        assertEquals(403, hospitalDispatch.getStatusCode().value());
        assertEquals("UNAUTHORIZED_OPERATION", hospitalDispatch.getBody().get("error").get("code").asText());

        String outsiderEmail = "outsider-" + UUID.randomUUID() + "@example.test";
        exchange("/api/v1/auth/register", Map.of(
                "email", outsiderEmail, "password", "Test@12345!", "fullName", "Outside Tester"), jsonHeaders());
        String outsiderToken = login(outsiderEmail, "Test@12345!").get("data").get("accessToken").asText();
        HttpHeaders outsiderHeaders = authHeaders(outsiderToken);
        outsiderHeaders.set("Idempotency-Key", "outsider-dispatch-" + UUID.randomUUID());
        ResponseEntity<JsonNode> outsiderDispatch = exchange("/api/v1/dispatches",
                Map.of("reservationId", secondReservation, "assignedStaff", "Outside User"), outsiderHeaders);
        assertEquals(403, outsiderDispatch.getStatusCode().value());
        assertEquals("TENANT_ACCESS_DENIED", outsiderDispatch.getBody().get("error").get("code").asText());
    }

    @Test
    @Order(16)
    void deliveryAfterIncidentIsAllowedAndKeepsIncidentHistory() {
        String admin = adminToken();
        HttpHeaders adminHeaders = authHeaders(admin);
        JsonNode organizations = get("/api/v1/organizations?page=0&size=20", adminHeaders);
        long bankId = organizationId(organizations, "BLOOD_BANK");
        long hospitalId = organizationId(organizations, "HOSPITAL");
        String bankToken = login("bank@lifelink.local", "Bank@123!").get("data").get("accessToken").asText();
        String hospitalToken = login("hospital@lifelink.local", "Hospital@123!")
                .get("data").get("accessToken").asText();

        long unitId = createAvailableWholeBloodUnit(admin, bankId);
        long requestId = createApprovedRequest(admin, hospitalId, "INCIDENT-DELIVERY");
        long reservationId = confirmAsBank(bankToken, requestId, unitId);
        exchange("/api/v1/reservations/" + reservationId + "/confirm", Map.of(), authHeaders(hospitalToken));

        String key = "incident-dispatch-" + UUID.randomUUID();
        HttpHeaders dispatchHeaders = authHeaders(bankToken);
        dispatchHeaders.set("Idempotency-Key", key);
        ResponseEntity<JsonNode> created = exchange("/api/v1/dispatches",
                Map.of("reservationId", reservationId, "assignedStaff", "Incident Responder"), dispatchHeaders);
        assertEquals(200, created.getStatusCode().value(), created.getBody().toString());
        long dispatchId = created.getBody().get("data").get("id").asLong();

        assertEquals(200, exchange("/api/v1/dispatches/" + dispatchId + "/depart", Map.of(),
                authHeaders(bankToken)).getStatusCode().value());
        JsonNode incident = exchange("/api/v1/dispatches/" + dispatchId + "/incident",
                Map.of("description", "Vehicle breakdown"), authHeaders(bankToken)).getBody();
        assertEquals("INCIDENT", incident.get("data").get("status").asText());

        ResponseEntity<JsonNode> delivered = exchange("/api/v1/dispatches/" + dispatchId + "/deliver",
                Map.of("recipientName", "Emergency Ward"), authHeaders(bankToken));
        assertEquals(200, delivered.getStatusCode().value(), delivered.getBody().toString());
        assertEquals("DELIVERED", delivered.getBody().get("data").get("status").asText());
        assertEquals("Vehicle breakdown", delivered.getBody().get("data").get("incidentDescription").asText());
    }

    @Test
    @Order(17)
    void dispatchKeyReuseWithDifferentAssignedStaffIsRejected() {
        String admin = adminToken();
        HttpHeaders adminHeaders = authHeaders(admin);
        JsonNode organizations = get("/api/v1/organizations?page=0&size=20", adminHeaders);
        long bankId = organizationId(organizations, "BLOOD_BANK");
        long hospitalId = organizationId(organizations, "HOSPITAL");
        String bankToken = login("bank@lifelink.local", "Bank@123!").get("data").get("accessToken").asText();
        String hospitalToken = login("hospital@lifelink.local", "Hospital@123!")
                .get("data").get("accessToken").asText();

        long firstUnit = createAvailableWholeBloodUnit(admin, bankId);
        long firstRequest = createApprovedRequest(admin, hospitalId, "STAFF-FP-1");
        long firstReservation = confirmAsBank(bankToken, firstRequest, firstUnit);
        exchange("/api/v1/reservations/" + firstReservation + "/confirm", Map.of(), authHeaders(hospitalToken));

        String key = "dispatch-staff-fp-" + UUID.randomUUID();
        HttpHeaders firstHeaders = authHeaders(bankToken);
        firstHeaders.set("Idempotency-Key", key);
        ResponseEntity<JsonNode> first = exchange("/api/v1/dispatches",
                Map.of("reservationId", firstReservation, "assignedStaff", "Staff A"), firstHeaders);
        assertEquals(200, first.getStatusCode().value());

        long secondUnit = createAvailableWholeBloodUnit(admin, bankId);
        long secondRequest = createApprovedRequest(admin, hospitalId, "STAFF-FP-2");
        long secondReservation = confirmAsBank(bankToken, secondRequest, secondUnit);
        exchange("/api/v1/reservations/" + secondReservation + "/confirm", Map.of(), authHeaders(hospitalToken));

        HttpHeaders replayHeaders = authHeaders(bankToken);
        replayHeaders.set("Idempotency-Key", key);
        ResponseEntity<JsonNode> mismatch = exchange("/api/v1/dispatches",
                Map.of("reservationId", secondReservation, "assignedStaff", "Staff B"), replayHeaders);
        assertEquals(409, mismatch.getStatusCode().value());
        assertEquals("BUSINESS_RULE_VIOLATION", mismatch.getBody().get("error").get("code").asText());
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
                "reason", "Backend regression verification"), authHeaders(admin)).getBody();
        assertTrue(created.get("success").asBoolean());
        long requestId = created.get("data").get("id").asLong();
        exchange("/api/v1/emergency-requests/" + requestId + "/verify", Map.of(), authHeaders(admin));
        exchange("/api/v1/emergency-requests/" + requestId + "/approve", Map.of(), authHeaders(admin));
        return requestId;
    }

    private long confirmAsBank(String bankToken, long requestId, long unitId) {
        String key = "alloc-" + UUID.randomUUID();
        HttpHeaders headers = authHeaders(bankToken);
        headers.set("Idempotency-Key", key);
        JsonNode confirmation = exchange("/api/v1/allocations/confirm", Map.of(
                "requestId", requestId, "unitIds", List.of(unitId), "idempotencyKey", key), headers).getBody();
        assertNotNull(confirmation);
        assertEquals(1, confirmation.get("data").get("reservations").size());
        return confirmation.get("data").get("reservations").get(0).get("id").asLong();
    }

    private long createAvailableWholeBloodUnit(String token, long organizationId) {
        String unitNumber = "LL-TEST-WB-" + UUID.randomUUID().toString().substring(0, 10).toUpperCase();
        JsonNode created = exchange("/api/v1/inventory", Map.of(
                "organizationId", organizationId,
                "unitNumber", unitNumber,
                "bloodGroup", "O_POSITIVE",
                "componentType", "WHOLE_BLOOD",
                "collectedAt", Instant.now().minus(Duration.ofHours(6)).toString(),
                "expiresAt", Instant.now().plus(Duration.ofDays(35)).toString(),
                "storageLocation", "TEST-COLD-ROOM"), authHeaders(token)).getBody();
        long unitId = created.get("data").get("id").asLong();
        exchange("/api/v1/inventory/" + unitId + "/release", Map.of(), authHeaders(token));
        return unitId;
    }

    private ResponseEntity<JsonNode> confirmAllocation(String token, long requestId, List<Long> unitIds) {
        HttpHeaders headers = authHeaders(token);
        String key = "compat-" + UUID.randomUUID();
        headers.set("Idempotency-Key", key);
        return exchange("/api/v1/allocations/confirm", Map.of(
                "requestId", requestId,
                "unitIds", unitIds,
                "idempotencyKey", key), headers);
    }

    private long organizationId(JsonNode organizations, String type) {
        for (JsonNode organization : organizations.get("data").get("content")) {
            if (type.equals(organization.get("type").asText())) {
                return organization.get("id").asLong();
            }
        }
        throw new AssertionError("No organization of type " + type);
    }

    private JsonNode get(String path, HttpHeaders headers) {
        ResponseEntity<JsonNode> response = rest.exchange(path, HttpMethod.GET,
                new HttpEntity<>(headers), JsonNode.class);
        assertEquals(200, response.getStatusCode().value(), path);
        return response.getBody();
    }

    private ResponseEntity<JsonNode> patch(String path, Object body, HttpHeaders headers) {
        HttpHeaders copy = new HttpHeaders();
        copy.putAll(headers);
        copy.setContentType(MediaType.APPLICATION_JSON);
        return rest.exchange(path, HttpMethod.PATCH, new HttpEntity<>(body, copy), JsonNode.class);
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
