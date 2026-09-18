package com.ventapasajes.identity.health;

import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.eclipse.microprofile.health.HealthCheck;
import org.eclipse.microprofile.health.HealthCheckResponse;
import org.eclipse.microprofile.health.Readiness;

import jakarta.enterprise.context.ApplicationScoped;

@Readiness
@ApplicationScoped
public class IdentityReadinessCheck implements HealthCheck {

    @ConfigProperty(name = "quarkus.application.name")
    String serviceName;

    @Override
    public HealthCheckResponse call() {
        return HealthCheckResponse.named(serviceName + "-readiness")
                .up()
                .withData("service", serviceName)
                .withData("database", "configured-by-service")
                .withData("migration_tool", "flyway")
                .build();
    }
}
