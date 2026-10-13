package com.ventapasajes.reporting.api;

import org.eclipse.microprofile.openapi.annotations.OpenAPIDefinition;
import org.eclipse.microprofile.openapi.annotations.info.Contact;
import org.eclipse.microprofile.openapi.annotations.info.Info;
import org.eclipse.microprofile.openapi.annotations.servers.Server;

@OpenAPIDefinition(
        info = @Info(
                title = "reporting-service API",
                version = "0.1.0",
                description = "Read-model reporting service for Venta de Pasajes.",
                contact = @Contact(name = "Venta de Pasajes")),
        servers = @Server(url = "/", description = "Current host"))
public class ReportingOpenApiConfiguration {
}
