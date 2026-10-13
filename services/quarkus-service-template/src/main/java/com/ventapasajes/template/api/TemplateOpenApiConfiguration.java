package com.ventapasajes.template.api;

import org.eclipse.microprofile.openapi.annotations.OpenAPIDefinition;
import org.eclipse.microprofile.openapi.annotations.info.Contact;
import org.eclipse.microprofile.openapi.annotations.info.Info;
import org.eclipse.microprofile.openapi.annotations.servers.Server;

@OpenAPIDefinition(
        info = @Info(
                title = "quarkus-service-template API",
                version = "0.1.0",
                description = "Base Quarkus microservice template for Venta de Pasajes.",
                contact = @Contact(name = "Venta de Pasajes")),
        servers = @Server(url = "/", description = "Current host"))
public class TemplateOpenApiConfiguration {
}
