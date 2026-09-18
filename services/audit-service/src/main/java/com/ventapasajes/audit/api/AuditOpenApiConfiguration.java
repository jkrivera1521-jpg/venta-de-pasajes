package com.ventapasajes.audit.api;

import org.eclipse.microprofile.openapi.annotations.OpenAPIDefinition;
import org.eclipse.microprofile.openapi.annotations.info.Contact;
import org.eclipse.microprofile.openapi.annotations.info.Info;
import org.eclipse.microprofile.openapi.annotations.servers.Server;

@OpenAPIDefinition(
        info = @Info(
                title = "audit-service API",
                version = "0.1.0",
                description = "Functional audit API for immutable system events.",
                contact = @Contact(name = "Venta de Pasajes")),
        servers = @Server(url = "/", description = "Current host"))
public class AuditOpenApiConfiguration {
}
