package com.ventapasajes.ticketing.api.dto;

import org.eclipse.microprofile.openapi.annotations.media.Schema;

@Schema(name = "TicketingResourceResponse", description = "Managed ticketing resource.")
public record TicketingResourceResponse(
        @Schema(description = "Technical resource code.") String code,
        @Schema(description = "Business resource name.") String name,
        @Schema(description = "Owning service.") String owner,
        @Schema(description = "Resource responsibility.") String description) {
}
