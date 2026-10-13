package com.ventapasajes.template.health;

import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.eclipse.microprofile.health.HealthCheck;
import org.eclipse.microprofile.health.HealthCheckResponse;
import org.eclipse.microprofile.health.Liveness;

import jakarta.enterprise.context.ApplicationScoped;

@Liveness
@ApplicationScoped
public class TemplateLivenessCheck implements HealthCheck {

    @ConfigProperty(name = "quarkus.application.name")
    String serviceName;

    @Override
    public HealthCheckResponse call() {
        return HealthCheckResponse.named(serviceName + "-liveness")
                .up()
                .withData("service", serviceName)
                .build();
    }
}
