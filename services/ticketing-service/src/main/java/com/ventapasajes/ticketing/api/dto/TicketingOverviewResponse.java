package com.ventapasajes.ticketing.api.dto;

import java.util.List;

import org.eclipse.microprofile.openapi.annotations.media.Schema;

@Schema(name = "TicketingOverviewResponse", description = "Ticketing domain overview.")
public record TicketingOverviewResponse(
        @Schema(description = "Service name.") String service,
        @Schema(description = "Business domain name.") String domain,
        @Schema(description = "Managed resources.") List<TicketingResourceResponse> resources,
        @Schema(description = "Allowed departure seat statuses.") List<String> seatStatuses,
        @Schema(description = "Allowed reservation statuses.") List<String> reservationStatuses,
        @Schema(description = "Allowed ticket statuses.") List<String> ticketStatuses) {
}
