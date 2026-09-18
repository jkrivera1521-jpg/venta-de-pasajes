package com.ventapasajes.identity.service;

import org.eclipse.microprofile.config.Config;

import io.quarkus.runtime.StartupEvent;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import jakarta.inject.Inject;

@ApplicationScoped
public class IdentityBootstrapService {

    @Inject
    Config config;

    @Inject
    IdentityApplicationService identityApplicationService;

    void onStart(@Observes StartupEvent event) {
        boolean enabled = config.getOptionalValue("app.bootstrap.admin.enabled", Boolean.class).orElse(false);
        if (!enabled) {
            return;
        }
        String login = config.getOptionalValue("app.bootstrap.admin.login", String.class).orElse("");
        String password = config.getOptionalValue("app.bootstrap.admin.password", String.class).orElse("");
        if (login.isBlank() || password.isBlank()) {
            return;
        }
        String email = config.getOptionalValue("app.bootstrap.admin.email", String.class).orElse(null);
        String displayName = config.getOptionalValue("app.bootstrap.admin.display-name", String.class).orElse("Administrador");
        identityApplicationService.ensureBootstrapAdmin(login, email, displayName, password);
    }
}
