package com.ventapasajes.audit;

import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

import org.junit.jupiter.api.Test;

class RuntimeProfileConfigurationTest {

    @Test
    void applicationPropertiesDeclareGcpAndOnPremiseProfiles() throws IOException {
        String properties = readApplicationProperties();

        assertContains(properties, "app.secrets.provider=${APP_SECRETS_PROVIDER:env}");
        assertContains(properties, "%gcp.app.secrets.provider=google-secret-manager");
        assertContains(properties, "%gcp.quarkus.datasource.username=${APP_DB_USERNAME:audit-service-run@project-fbb34cd7-0b82-43e1-867.iam}");
        assertContains(properties, "%onprem.app.runtime.target=onprem");
        assertContains(properties, "%onprem.app.secrets.provider=${APP_SECRETS_PROVIDER:env}");
        assertContains(properties, "%onprem.quarkus.datasource.jdbc.url=${APP_DB_JDBC_URL:jdbc:postgresql://localhost:5432/audit_db}");
    }

    private static String readApplicationProperties() throws IOException {
        try (InputStream stream = RuntimeProfileConfigurationTest.class.getResourceAsStream("/application.properties")) {
            if (stream == null) {
                throw new IOException("application.properties resource was not found.");
            }
            return new String(stream.readAllBytes(), StandardCharsets.UTF_8);
        }
    }

    private static void assertContains(String properties, String expected) {
        assertTrue(properties.contains(expected), () -> "Missing expected runtime profile setting: " + expected);
    }
}
