package com.ventapasajes.reporting.api.dto;

import java.util.List;

public record SalesReportResponse(
        SalesSummaryResponse summary,
        List<SaleRowResponse> rows) {
}
