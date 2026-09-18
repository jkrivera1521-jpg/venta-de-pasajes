package com.ventapasajes.identity.api;

import org.eclipse.microprofile.openapi.annotations.OpenAPIDefinition;
import org.eclipse.microprofile.openapi.annotations.info.Contact;
import org.eclipse.microprofile.openapi.annotations.info.Info;
import org.eclipse.microprofile.openapi.annotations.servers.Server;

@OpenAPIDefinition(
        info = @Info(
                title = "Identity Service API",
                version = "0.1.0",
                description = "API base para identidad, usuarios, roles, permisos y autenticacion hibrida.",
                contact = @Contact(name = "Venta de Pasajes")),
        servers = @Server(url = "/", description = "Current host"))
public class IdentityOpenApiConfiguration {
}
