package com.ventapasajes.dispatch.api.dto;

import java.util.List;

public record DispatchOverviewResponse(
        String service,
        String database,
        String basePath,
        List<DispatchResourceResponse> resources,
        List<String> departureStatuses,
        List<String> seatPositions) {
}
