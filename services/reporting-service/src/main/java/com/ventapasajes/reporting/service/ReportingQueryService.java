package com.ventapasajes.reporting.service;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

import org.eclipse.microprofile.config.inject.ConfigProperty;

import com.ventapasajes.reporting.api.dto.MoneyResponse;
import com.ventapasajes.reporting.api.dto.PassengerSaleRowResponse;
import com.ventapasajes.reporting.api.dto.SaleRowResponse;
import com.ventapasajes.reporting.api.dto.SalesByUserRowResponse;
import com.ventapasajes.reporting.api.dto.SalesGroupRowResponse;
import com.ventapasajes.reporting.api.dto.SalesReportResponse;
import com.ventapasajes.reporting.api.dto.SalesSummaryResponse;
import com.ventapasajes.reporting.persistence.entity.FactTicketSale;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.ws.rs.BadRequestException;

@ApplicationScoped
public class ReportingQueryService {

    @ConfigProperty(name = "app.reporting.time-zone", defaultValue = "America/Guayaquil")
    String reportingTimeZone;

    public SalesReportResponse salesReport(
            String dateFrom,
            String dateTo,
            UUID terminalId,
            UUID routeId,
            UUID userId) {
        List<FactTicketSale> rows = findSales(dateFrom, dateTo, terminalId, routeId, userId);

        long sold = rows.stream().filter(row -> "SOLD".equals(row.status)).count();
        long cancelled = rows.stream().filter(row -> "CANCELLED".equals(row.status)).count();
        BigDecimal gross = rows.stream()
                .map(row -> row.price == null ? BigDecimal.ZERO : row.price)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal net = rows.stream()
                .map(this::netAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        String currency = rows.isEmpty() ? "USD" : rows.get(0).currency;

        List<SaleRowResponse> responseRows = rows.stream()
                .map(this::toSaleRow)
                .toList();

        return new SalesReportResponse(
                new SalesSummaryResponse(
                        sold,
                        cancelled,
                        new MoneyResponse(gross, currency),
                        new MoneyResponse(net, currency)),
                responseRows);
    }

    public List<PassengerSaleRowResponse> passengers(String dateFrom, String dateTo, UUID departureId, String query) {
        List<FactTicketSale> rows = findSales(dateFrom, dateTo, null, null, null).stream()
                .filter(row -> departureId == null || departureId.equals(row.departureId))
                .filter(row -> matchesPassengerQuery(row, query))
                .toList();

        return rows.stream()
                .map(row -> new PassengerSaleRowResponse(
                        row.passengerName,
                        row.passengerDocumentNumber,
                        row.ticketNumber,
                        row.departureAt,
                        row.busCode,
                        row.seatNumber))
                .toList();
    }

    public List<SalesByUserRowResponse> salesByUser(String dateFrom, String dateTo) {
        List<FactTicketSale> rows = findSales(dateFrom, dateTo, null, null, null);
        Map<String, UserAggregate> aggregates = new LinkedHashMap<>();

        for (FactTicketSale row : rows) {
            String key = row.soldByUserId == null ? "sin-usuario" : row.soldByUserId.toString();
            UserAggregate aggregate = aggregates.computeIfAbsent(key, ignored -> new UserAggregate(
                    row.soldByUserId,
                    row.sellerDisplayName == null ? key : row.sellerDisplayName));
            if ("SOLD".equals(row.status)) {
                aggregate.ticketsSold++;
            }
            aggregate.netAmount = aggregate.netAmount.add(netAmount(row));
        }

        return aggregates.values().stream()
                .sorted(Comparator.comparing((UserAggregate aggregate) -> aggregate.netAmount).reversed())
                .map(aggregate -> new SalesByUserRowResponse(
                        aggregate.userId,
                        aggregate.userDisplayName,
                        aggregate.ticketsSold,
                        new MoneyResponse(aggregate.netAmount, "USD")))
                .toList();
    }

    public List<SalesGroupRowResponse> salesByGroup(String dateFrom, String dateTo, String groupBy) {
        String normalizedGroup = groupBy == null || groupBy.isBlank() ? "BUS" : groupBy.trim().toUpperCase(Locale.ROOT);
        if (!List.of("BUS", "ROUTE", "TERMINAL").contains(normalizedGroup)) {
            throw new BadRequestException("group_by must be BUS, ROUTE or TERMINAL.");
        }

        List<FactTicketSale> rows = findSales(dateFrom, dateTo, null, null, null);
        Map<String, GroupAggregate> aggregates = new LinkedHashMap<>();

        for (FactTicketSale row : rows) {
            String key = groupKey(row, normalizedGroup);
            String label = groupLabel(row, normalizedGroup, key);
            GroupAggregate aggregate = aggregates.computeIfAbsent(key, ignored -> new GroupAggregate(key, label));
            if ("SOLD".equals(row.status)) {
                aggregate.ticketsSold++;
            }
            aggregate.netAmount = aggregate.netAmount.add(netAmount(row));
        }

        return aggregates.values().stream()
                .sorted(Comparator.comparing((GroupAggregate aggregate) -> aggregate.netAmount).reversed())
                .map(aggregate -> new SalesGroupRowResponse(
                        aggregate.groupKey,
                        aggregate.groupLabel,
                        aggregate.ticketsSold,
                        new MoneyResponse(aggregate.netAmount, "USD")))
                .toList();
    }

    private List<FactTicketSale> findSales(
            String dateFrom,
            String dateTo,
            UUID terminalId,
            UUID routeId,
            UUID userId) {
        DateRange range = parseRange(dateFrom, dateTo);
        StringBuilder query = new StringBuilder("soldAt >= ?1 and soldAt < ?2");
        List<Object> params = new ArrayList<>();
        params.add(range.startInclusive());
        params.add(range.endExclusive());

        if (terminalId != null) {
            params.add(terminalId);
            query.append(" and (originTerminalId = ?").append(params.size())
                    .append(" or destinationTerminalId = ?").append(params.size()).append(")");
        }
        if (routeId != null) {
            params.add(routeId);
            query.append(" and routeId = ?").append(params.size());
        }
        if (userId != null) {
            params.add(userId);
            query.append(" and soldByUserId = ?").append(params.size());
        }

        query.append(" order by soldAt desc");
        return FactTicketSale.<FactTicketSale>find(query.toString(), params.toArray()).list();
    }

    private DateRange parseRange(String dateFrom, String dateTo) {
        if (dateFrom == null || dateFrom.isBlank()) {
            throw new BadRequestException("date_from is required.");
        }
        if (dateTo == null || dateTo.isBlank()) {
            throw new BadRequestException("date_to is required.");
        }

        LocalDate from = LocalDate.parse(dateFrom);
        LocalDate to = LocalDate.parse(dateTo);
        if (to.isBefore(from)) {
            throw new BadRequestException("date_to must be greater than or equal to date_from.");
        }

        ZoneId zone = ZoneId.of(reportingTimeZone);
        return new DateRange(
                from.atStartOfDay(zone).toInstant(),
                to.plusDays(1).atStartOfDay(zone).toInstant());
    }

    private SaleRowResponse toSaleRow(FactTicketSale row) {
        return new SaleRowResponse(
                row.ticketId,
                row.ticketNumber,
                row.soldAt,
                row.passengerName,
                row.passengerDocumentNumber,
                row.busCode,
                row.origin,
                row.destination,
                row.seatNumber,
                row.soldByUserId,
                new MoneyResponse(row.price, row.currency),
                row.status);
    }

    private BigDecimal netAmount(FactTicketSale row) {
        if (!"CANCELLED".equals(row.status)) {
            return row.price == null ? BigDecimal.ZERO : row.price;
        }
        BigDecimal refund = row.refundAmount == null ? row.price : row.refundAmount;
        if (refund == null) {
            return BigDecimal.ZERO;
        }
        return row.price == null ? BigDecimal.ZERO : row.price.subtract(refund);
    }

    private static boolean matchesPassengerQuery(FactTicketSale row, String query) {
        if (query == null || query.isBlank()) {
            return true;
        }
        String normalized = query.trim().toLowerCase(Locale.ROOT);
        return contains(row.passengerName, normalized)
                || contains(row.passengerDocumentNumber, normalized)
                || contains(row.ticketNumber, normalized);
    }

    private static boolean contains(String value, String normalizedQuery) {
        return value != null && value.toLowerCase(Locale.ROOT).contains(normalizedQuery);
    }

    private static String groupKey(FactTicketSale row, String groupBy) {
        return switch (groupBy) {
            case "ROUTE" -> row.routeId == null
                    ? nullToUnknown(row.origin) + "->" + nullToUnknown(row.destination)
                    : row.routeId.toString();
            case "TERMINAL" -> row.originTerminalId == null ? nullToUnknown(row.origin) : row.originTerminalId.toString();
            default -> nullToUnknown(row.busCode);
        };
    }

    private static String groupLabel(FactTicketSale row, String groupBy, String fallback) {
        return switch (groupBy) {
            case "ROUTE" -> nullToUnknown(row.origin) + " - " + nullToUnknown(row.destination);
            case "TERMINAL" -> nullToUnknown(row.origin);
            default -> fallback;
        };
    }

    private static String nullToUnknown(String value) {
        return value == null || value.isBlank() ? "SIN_DATO" : value;
    }

    private record DateRange(Instant startInclusive, Instant endExclusive) {
    }

    private static final class UserAggregate {
        private final UUID userId;
        private final String userDisplayName;
        private long ticketsSold;
        private BigDecimal netAmount = BigDecimal.ZERO;

        private UserAggregate(UUID userId, String userDisplayName) {
            this.userId = userId;
            this.userDisplayName = userDisplayName;
        }
    }

    private static final class GroupAggregate {
        private final String groupKey;
        private final String groupLabel;
        private long ticketsSold;
        private BigDecimal netAmount = BigDecimal.ZERO;

        private GroupAggregate(String groupKey, String groupLabel) {
            this.groupKey = groupKey;
            this.groupLabel = groupLabel;
        }
    }
}
