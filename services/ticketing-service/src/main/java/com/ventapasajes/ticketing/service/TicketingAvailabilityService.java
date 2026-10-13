package com.ventapasajes.ticketing.service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import com.ventapasajes.ticketing.api.dto.AvailableDepartureResponse;
import com.ventapasajes.ticketing.api.dto.DepartureAvailabilitySyncRequest;
import com.ventapasajes.ticketing.api.dto.DepartureSeatSyncRequest;
import com.ventapasajes.ticketing.api.dto.SeatAvailabilityResponse;
import com.ventapasajes.ticketing.api.dto.SeatMapResponse;
import com.ventapasajes.ticketing.domain.DepartureSeatStatus;
import com.ventapasajes.ticketing.domain.SyncedDepartureStatus;
import com.ventapasajes.ticketing.persistence.entity.DepartureSeat;
import com.ventapasajes.ticketing.persistence.entity.SyncedDeparture;

import io.quarkus.hibernate.orm.panache.PanacheQuery;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.NotFoundException;

@ApplicationScoped
public class TicketingAvailabilityService {

    private static final ZoneId BUSINESS_ZONE = ZoneId.of("America/Guayaquil");

    @Transactional
    public SeatMapResponse syncDeparture(DepartureAvailabilitySyncRequest request) {
        request = requirePayload(request);
        List<NormalizedSeat> seats = normalizeSeats(request);

        SyncedDeparture departure = SyncedDeparture
                .<SyncedDeparture>find("dispatchDepartureId = ?1", requireUuid(request.dispatchDepartureId(), "dispatchDepartureId"))
                .firstResult();

        if (departure == null) {
            departure = new SyncedDeparture();
            departure.dispatchDepartureId = request.dispatchDepartureId();
        }

        departure.legacyId = request.legacyId();
        departure.busId = requireUuid(request.busId(), "busId");
        departure.busCode = requireText(request.busCode(), "busCode");
        departure.busPlate = normalizeNullable(request.busPlate());
        departure.routeId = requireUuid(request.routeId(), "routeId");
        departure.routeName = requireText(request.routeName(), "routeName");
        departure.originTerminalId = requireUuid(request.originTerminalId(), "originTerminalId");
        departure.originTerminalName = requireText(request.originTerminalName(), "originTerminalName");
        departure.destinationTerminalId = requireUuid(request.destinationTerminalId(), "destinationTerminalId");
        departure.destinationTerminalName = requireText(request.destinationTerminalName(), "destinationTerminalName");
        departure.departureAt = requireInstant(request.departureAt(), "departureAt");
        departure.status = request.status() == null ? SyncedDepartureStatus.SCHEDULED : request.status();
        departure.seatCount = seats.size();
        departure.sourceUpdatedAt = request.sourceUpdatedAt();
        departure.syncedAt = Instant.now();
        departure.persist();

        syncSeats(departure.dispatchDepartureId, seats);

        return seatMap(departure.dispatchDepartureId);
    }

    @Transactional
    public List<AvailableDepartureResponse> availableDepartures(
            LocalDate dateFrom,
            LocalDate dateTo,
            UUID originTerminalId,
            UUID destinationTerminalId,
            UUID routeId) {
        validateDateRange(dateFrom, dateTo);

        QuerySpec querySpec = new QuerySpec();
        querySpec.add("status = " + querySpec.bind(SyncedDepartureStatus.SCHEDULED));
        if (dateFrom != null) {
            querySpec.add("departureAt >= " + querySpec.bind(dateFrom.atStartOfDay(BUSINESS_ZONE).toInstant()));
        }
        if (dateTo != null) {
            querySpec.add("departureAt < " + querySpec.bind(dateTo.plusDays(1).atStartOfDay(BUSINESS_ZONE).toInstant()));
        }
        if (originTerminalId != null) {
            querySpec.add("originTerminalId = " + querySpec.bind(originTerminalId));
        }
        if (destinationTerminalId != null) {
            querySpec.add("destinationTerminalId = " + querySpec.bind(destinationTerminalId));
        }
        if (routeId != null) {
            querySpec.add("routeId = " + querySpec.bind(routeId));
        }

        PanacheQuery<SyncedDeparture> query = SyncedDeparture
                .<SyncedDeparture>find(querySpec.listQuery("departureAt"), querySpec.params());

        return query.list()
                .stream()
                .map(this::toAvailableDeparture)
                .filter(AvailableDepartureResponse::sellable)
                .toList();
    }

    @Transactional
    public SeatMapResponse seatMap(UUID dispatchDepartureId) {
        SyncedDeparture departure = requireDeparture(dispatchDepartureId);
        List<DepartureSeat> seats = DepartureSeat
                .<DepartureSeat>find("dispatchDepartureId = ?1", dispatchDepartureId)
                .list()
                .stream()
                .sorted(Comparator.comparing(seat -> seat.seatNumber, TicketingAvailabilityService::compareSeatNumbers))
                .toList();

        SeatCounts counts = countSeats(dispatchDepartureId);

        return new SeatMapResponse(
                departure.dispatchDepartureId,
                departure.routeName,
                departure.originTerminalName,
                departure.destinationTerminalName,
                departure.departureAt,
                departure.status,
                counts.total(),
                counts.available(),
                counts.reserved(),
                counts.sold(),
                counts.blocked(),
                counts.cancelled(),
                seats.stream().map(this::toSeatResponse).toList());
    }

    private void syncSeats(UUID dispatchDepartureId, List<NormalizedSeat> normalizedSeats) {
        for (NormalizedSeat normalizedSeat : normalizedSeats) {
            DepartureSeat seat = DepartureSeat
                    .<DepartureSeat>find("dispatchDepartureId = ?1 and seatNumber = ?2",
                            dispatchDepartureId,
                            normalizedSeat.seatNumber())
                    .firstResult();

            if (seat == null) {
                seat = new DepartureSeat();
                seat.dispatchDepartureId = dispatchDepartureId;
                seat.seatNumber = normalizedSeat.seatNumber();
                seat.status = normalizedSeat.status();
            } else if (normalizedSeat.explicitStatus() && canApplySyncedStatus(seat)) {
                seat.status = normalizedSeat.status();
            }

            seat.persist();
        }
    }

    private AvailableDepartureResponse toAvailableDeparture(SyncedDeparture departure) {
        SeatCounts counts = countSeats(departure.dispatchDepartureId);
        boolean sellable = departure.status == SyncedDepartureStatus.SCHEDULED && counts.available() > 0;

        return new AvailableDepartureResponse(
                departure.dispatchDepartureId,
                departure.legacyId,
                departure.busId,
                departure.busCode,
                departure.busPlate,
                departure.routeId,
                departure.routeName,
                departure.originTerminalId,
                departure.originTerminalName,
                departure.destinationTerminalId,
                departure.destinationTerminalName,
                departure.departureAt,
                departure.status,
                counts.total(),
                counts.available(),
                counts.reserved(),
                counts.sold(),
                counts.blocked(),
                counts.cancelled(),
                sellable,
                departure.syncedAt);
    }

    private SeatAvailabilityResponse toSeatResponse(DepartureSeat seat) {
        return new SeatAvailabilityResponse(
                seat.id,
                seat.seatNumber,
                seat.status,
                seat.status == DepartureSeatStatus.AVAILABLE,
                seat.reservationId,
                seat.passengerId,
                seat.holdExpiresAt);
    }

    private SeatCounts countSeats(UUID dispatchDepartureId) {
        int total = (int) DepartureSeat.count("dispatchDepartureId = ?1", dispatchDepartureId);
        int available = countSeatsByStatus(dispatchDepartureId, DepartureSeatStatus.AVAILABLE);
        int reserved = countSeatsByStatus(dispatchDepartureId, DepartureSeatStatus.RESERVED);
        int sold = countSeatsByStatus(dispatchDepartureId, DepartureSeatStatus.SOLD);
        int blocked = countSeatsByStatus(dispatchDepartureId, DepartureSeatStatus.BLOCKED);
        int cancelled = countSeatsByStatus(dispatchDepartureId, DepartureSeatStatus.CANCELLED);
        return new SeatCounts(total, available, reserved, sold, blocked, cancelled);
    }

    private int countSeatsByStatus(UUID dispatchDepartureId, DepartureSeatStatus status) {
        return (int) DepartureSeat.count("dispatchDepartureId = ?1 and status = ?2", dispatchDepartureId, status);
    }

    private boolean canApplySyncedStatus(DepartureSeat seat) {
        return seat.status != DepartureSeatStatus.RESERVED && seat.status != DepartureSeatStatus.SOLD;
    }

    private SyncedDeparture requireDeparture(UUID dispatchDepartureId) {
        if (dispatchDepartureId == null) {
            throw new BadRequestException("Field is required: dispatchDepartureId.");
        }
        SyncedDeparture departure = SyncedDeparture
                .<SyncedDeparture>find("dispatchDepartureId = ?1", dispatchDepartureId)
                .firstResult();
        if (departure == null) {
            throw new NotFoundException("Departure was not found in ticketing read model.");
        }
        return departure;
    }

    private List<NormalizedSeat> normalizeSeats(DepartureAvailabilitySyncRequest request) {
        List<DepartureSeatSyncRequest> requestSeats = request.seats();
        if (requestSeats == null || requestSeats.isEmpty()) {
            Integer seatCount = request.seatCount();
            if (seatCount == null || seatCount < 1) {
                throw new BadRequestException("Either seats or a positive seatCount is required.");
            }

            List<NormalizedSeat> generatedSeats = new ArrayList<>();
            for (int index = 1; index <= seatCount; index++) {
                generatedSeats.add(new NormalizedSeat(String.valueOf(index), DepartureSeatStatus.AVAILABLE, false));
            }
            return generatedSeats;
        }

        Map<String, NormalizedSeat> normalized = new LinkedHashMap<>();
        for (DepartureSeatSyncRequest seat : requestSeats) {
            String seatNumber = requireText(seat == null ? null : seat.seatNumber(), "seatNumber");
            DepartureSeatStatus status = seat.status() == null ? DepartureSeatStatus.AVAILABLE : seat.status();
            if (normalized.containsKey(seatNumber)) {
                throw new BadRequestException("Duplicated seat number: " + seatNumber + ".");
            }
            normalized.put(seatNumber, new NormalizedSeat(seatNumber, status, seat.status() != null));
        }
        return List.copyOf(normalized.values());
    }

    private static void validateDateRange(LocalDate dateFrom, LocalDate dateTo) {
        if (dateFrom != null && dateTo != null && dateTo.isBefore(dateFrom)) {
            throw new BadRequestException("date_to must be greater than or equal to date_from.");
        }
    }

    private <T> T requirePayload(T payload) {
        if (payload == null) {
            throw new BadRequestException("Request body is required.");
        }
        return payload;
    }

    private UUID requireUuid(UUID value, String fieldName) {
        if (value == null) {
            throw new BadRequestException("Field is required: " + fieldName + ".");
        }
        return value;
    }

    private Instant requireInstant(Instant value, String fieldName) {
        if (value == null) {
            throw new BadRequestException("Field is required: " + fieldName + ".");
        }
        return value;
    }

    private String requireText(String value, String fieldName) {
        String normalized = normalizeNullable(value);
        if (normalized == null) {
            throw new BadRequestException("Field is required: " + fieldName + ".");
        }
        return normalized;
    }

    private static String normalizeNullable(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private static int compareSeatNumbers(String left, String right) {
        Integer leftNumber = parseInteger(left);
        Integer rightNumber = parseInteger(right);
        if (leftNumber != null && rightNumber != null) {
            return leftNumber.compareTo(rightNumber);
        }
        return left.compareToIgnoreCase(right);
    }

    private static Integer parseInteger(String value) {
        try {
            return Integer.valueOf(value);
        } catch (NumberFormatException exception) {
            return null;
        }
    }

    private record NormalizedSeat(String seatNumber, DepartureSeatStatus status, boolean explicitStatus) {
    }

    private record SeatCounts(int total, int available, int reserved, int sold, int blocked, int cancelled) {
    }

    private static final class QuerySpec {
        private final List<String> predicates = new ArrayList<>();
        private final List<Object> params = new ArrayList<>();

        void add(String predicate) {
            predicates.add(predicate);
        }

        String bind(Object value) {
            params.add(value);
            return "?" + params.size();
        }

        String listQuery(String orderBy) {
            String order = " order by " + orderBy;
            return String.join(" and ", predicates) + order;
        }

        Object[] params() {
            return params.toArray();
        }
    }
}
