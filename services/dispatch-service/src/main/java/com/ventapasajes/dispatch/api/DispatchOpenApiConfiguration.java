package com.ventapasajes.dispatch.api;

import org.eclipse.microprofile.openapi.annotations.OpenAPIDefinition;
import org.eclipse.microprofile.openapi.annotations.info.Contact;
import org.eclipse.microprofile.openapi.annotations.info.Info;
import org.eclipse.microprofile.openapi.annotations.servers.Server;

@OpenAPIDefinition(
        info = @Info(
                title = "Dispatch Service API",
                version = "0.1.0",
                description = "API base para terminales, rutas, tipos de bus, buses, layouts y salidas programadas.",
                contact = @Contact(name = "Venta de Pasajes")),
        servers = @Server(url = "/", description = "Current host"))
public class DispatchOpenApiConfiguration {
}
