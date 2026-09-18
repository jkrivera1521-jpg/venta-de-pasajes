package com.ventapasajes.document.service;

import java.util.List;

import org.eclipse.microprofile.config.inject.ConfigProperty;

import com.ventapasajes.document.api.dto.DocumentOverviewResponse;
import com.ventapasajes.document.api.dto.DocumentResourceResponse;

import jakarta.enterprise.context.ApplicationScoped;

@ApplicationScoped
public class DocumentCatalogService {

    @ConfigProperty(name = "app.documents.storage.provider")
    String storageProvider;

    public DocumentOverviewResponse overview() {
        return new DocumentOverviewResponse(
                "document-service",
                "/api/v1/document",
                storageProvider,
                "DEFAULT_TICKET",
                "ready");
    }

    public List<DocumentResourceResponse> resources() {
        return List.of(
                new DocumentResourceResponse("documents", "Metadata de comprobantes generados", "document-service",
                        "/api/v1/document/documents/{documentId}"),
                new DocumentResourceResponse("ticket-pdfs", "Generacion y descarga de boletos PDF",
                        "document-service", "/api/v1/document/documents/tickets/{ticketId}"),
                new DocumentResourceResponse("outbox_events", "Eventos DocumentGenerated pendientes de publicar",
                        "document-service", "documents_db.outbox_events"));
    }
}
