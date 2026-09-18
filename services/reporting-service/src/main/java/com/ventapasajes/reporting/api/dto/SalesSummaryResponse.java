package com.ventapasajes.reporting.api.dto;

public record SalesSummaryResponse(
        long ticketsSold,
        long ticketsCancelled,
        MoneyResponse grossAmount,
        MoneyResponse netAmount) {
}
