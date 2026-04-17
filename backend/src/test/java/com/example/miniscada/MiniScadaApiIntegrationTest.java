package com.example.miniscada;

import com.example.miniscada.api.auth.dto.LoginRequest;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.reactive.AutoConfigureWebTestClient;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.reactive.server.WebTestClient;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureWebTestClient
@Testcontainers(disabledWithoutDocker = true)
@ActiveProfiles("test")
class MiniScadaApiIntegrationTest {

    /** Same family as docker-compose `timescaledb` — migrations use `create_hypertable`. */
    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>(
            DockerImageName.parse("timescale/timescaledb:2.14.2-pg15").asCompatibleSubstituteFor("postgres"))
            .withDatabaseName("mini_scada")
            .withUsername("scada")
            .withPassword("scada_secret");

    @DynamicPropertySource
    static void datasourceProps(DynamicPropertyRegistry r) {
        r.add("spring.datasource.url", postgres::getJdbcUrl);
        r.add("spring.datasource.username", postgres::getUsername);
        r.add("spring.datasource.password", postgres::getPassword);
    }

    @Autowired
    private WebTestClient webClient;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Test
    void loginThenMeAndHealthAndDashboard() throws Exception {
        assertThat(jdbcTemplate.queryForObject("select count(*) from users where username = ?", Integer.class, "admin"))
                .isEqualTo(1);
        String storedHash = jdbcTemplate.queryForObject(
                "select password_hash from users where username = ?",
                String.class,
                "admin"
        );
        assertThat(passwordEncoder.matches("admin1234!!", storedHash))
                .as("admin password must match V7 seed (literal: admin1234!!)")
                .isTrue();

        String loginJson = webClient.post()
                .uri("/api/v1/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(new LoginRequest("admin", "admin1234!!"))
                .exchange()
                .expectStatus().isOk()
                .expectBody(String.class)
                .returnResult()
                .getResponseBody();
        assertThat(loginJson).isNotNull();
        JsonNode root = objectMapper.readTree(loginJson);
        assertThat(root.path("success").asBoolean()).isTrue();
        String token = root.path("data").path("accessToken").asText();
        assertThat(token).isNotBlank();

        webClient.get()
                .uri("/api/v1/users/me")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.data.name").isEqualTo("Administrator")
                .jsonPath("$.data.role").isEqualTo("ADMIN");

        webClient.get()
                .uri("/api/v1/system/health/summary")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.data.api").isEqualTo("UP")
                .jsonPath("$.data.tsdb").isEqualTo("UP");

        webClient.get()
                .uri("/api/v1/dashboard/overview?includeActiveAlarms=false")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.success").isEqualTo(true);
    }
}
