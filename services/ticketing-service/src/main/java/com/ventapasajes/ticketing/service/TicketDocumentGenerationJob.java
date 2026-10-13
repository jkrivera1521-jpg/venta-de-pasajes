package com.ventapasajes.ticketing.service;

import org.eclipse.microprofile.config.inject.ConfigProperty;

import io.quarkus.scheduler.Scheduled;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

@ApplicationScoped
public class TicketDocumentGenerationJob {

    @ConfigProperty(name = "app.documents.worker.enabled", defaultValue = "true")
    boolean enabled;

    @ConfigProperty(name = "app.documents.worker.batch-size", defaultValue = "10")
    int batchSize;

    @Inject
    TicketDocumentIntegrationService integrationService;

    @Scheduled(every = "{app.documents.worker.interval}")
    void processTicketDocuments() {
        if (enabled) {
            integrationService.processPending(batchSize);
        }
    }
}
