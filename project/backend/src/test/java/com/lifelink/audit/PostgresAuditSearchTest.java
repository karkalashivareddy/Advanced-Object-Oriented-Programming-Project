package com.lifelink.audit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
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

/** PostgreSQL regression for audit search with optional date filters. */
@Testcontainers(disabledWithoutDocker = true)
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles({"test", "postgres-it"})
class PostgresAuditSearchTest {

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
    void auditSearchWithoutOptionalFiltersSucceedsOnPostgres() {
        ResponseEntity<JsonNode> response = get("/api/v1/audit-logs?page=0&size=20");

        assertEquals(200, response.getStatusCode().value(), response.toString());
        assertNotNull(response.getBody());
        assertTrue(response.getBody().get("success").asBoolean());
        assertTrue(response.getBody().get("data").has("content"));
    }

    @Test
    void auditSearchWithActionFilterSucceedsOnPostgres() {
        ResponseEntity<JsonNode> response = get("/api/v1/audit-logs?page=0&size=20&action=AUTH");

        assertEquals(200, response.getStatusCode().value(), response.toString());
        assertNotNull(response.getBody());
        assertTrue(response.getBody().get("success").asBoolean());
    }

    private ResponseEntity<JsonNode> get(String path) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(adminToken());
        return rest.exchange(path, HttpMethod.GET, new HttpEntity<>(headers), JsonNode.class);
    }

    private String adminToken() {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        ResponseEntity<JsonNode> login = rest.exchange("/api/v1/auth/login", HttpMethod.POST,
                new HttpEntity<>(java.util.Map.of("email", "admin@lifelink.local",
                        "password", "Admin@123!"), headers), JsonNode.class);
        assertEquals(200, login.getStatusCode().value(), login.toString());
        assertNotNull(login.getBody());
        return login.getBody().get("data").get("accessToken").asText();
    }
}
