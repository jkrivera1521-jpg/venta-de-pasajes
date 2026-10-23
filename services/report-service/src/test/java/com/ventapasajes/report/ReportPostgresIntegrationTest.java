package com.ventapasajes.report;

import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Tag("integration")
@Disabled("Ejecutar en CI con Docker y un perfil de integracion habilitado.")
@Testcontainers
class ReportPostgresIntegrationTest {
    @Container
    static final PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @Test
    void postgresContainerIsAvailableForFlywayAndPanacheTests() {
        org.junit.jupiter.api.Assertions.assertTrue(postgres.isRunning());
    }
}
