package com.ventapasajes.reporting.api;

import java.util.List;
import java.util.UUID;

import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.responses.APIResponse;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

import com.ventapasajes.reporting.api.dto.PassengerSaleRowResponse;
import com.ventapasajes.reporting.api.dto.SalesByUserRowResponse;
import com.ventapasajes.reporting.api.dto.SalesGroupRowResponse;
import com.ventapasajes.reporting.api.dto.SalesReportResponse;
import com.ventapasajes.reporting.service.ReportingQueryService;

import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;

@Path("/api/v1/reporting/reports")
@Produces(MediaType.APPLICATION_JSON)
@Tag(name = "reports")
public class ReportingReportResource {

    @Inject
    ReportingQueryService queryService;

    @GET
    @Path("/sales")
    @Operation(summary = "Return sales report by date range.")
    @APIResponse(responseCode = "200", description = "Sales report returned.")
    public SalesReportResponse sales(
            @QueryParam("date_from") String dateFrom,
            @QueryParam("date_to") String dateTo,
            @QueryParam("terminal_id") UUID terminalId,
            @QueryParam("route_id") UUID routeId,
            @QueryParam("user_id") UUID userId) {
        return queryService.salesReport(dateFrom, dateTo, terminalId, routeId, userId);
    }

    @GET
    @Path("/passengers")
    @Operation(summary = "Return passenger sales rows by departure or date range.")
    @APIResponse(responseCode = "200", description = "Passenger rows returned.")
    public List<PassengerSaleRowResponse> passengers(
            @QueryParam("date_from") String dateFrom,
            @QueryParam("date_to") String dateTo,
            @QueryParam("departure_id") UUID departureId,
            @QueryParam("q") String query) {
        return queryService.passengers(dateFrom, dateTo, departureId, query);
    }

    @GET
    @Path("/sales/by-user")
    @Operation(summary = "Return sales grouped by user.")
    @APIResponse(responseCode = "200", description = "Sales by user returned.")
    public List<SalesByUserRowResponse> salesByUser(
            @QueryParam("date_from") String dateFrom,
            @QueryParam("date_to") String dateTo) {
        return queryService.salesByUser(dateFrom, dateTo);
    }

    @GET
    @Path("/sales/by-bus")
    @Operation(summary = "Return sales grouped by bus, route or terminal.")
    @APIResponse(responseCode = "200", description = "Grouped sales returned.")
    public List<SalesGroupRowResponse> salesByBus(
            @QueryParam("date_from") String dateFrom,
            @QueryParam("date_to") String dateTo,
            @QueryParam("group_by") String groupBy) {
        return queryService.salesByGroup(dateFrom, dateTo, groupBy);
    }
}
