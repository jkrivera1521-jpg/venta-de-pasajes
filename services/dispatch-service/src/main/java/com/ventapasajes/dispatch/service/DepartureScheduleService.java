package com.ventapasajes.dispatch.service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import com.ventapasajes.dispatch.api.ApiException;
import com.ventapasajes.dispatch.api.dto.DepartureCancelRequest;
import com.ventapasajes.dispatch.api.dto.DepartureCreateRequest;
import com.ventapasajes.dispatch.api.dto.DepartureResponse;
import com.ventapasajes.dispatch.api.dto.DepartureUpdateRequest;
import com.ventapasajes.dispatch.api.dto.PageMeta;
import com.ventapasajes.dispatch.api.dto.PageResponse;
import com.ventapasajes.dispatch.domain.DepartureStatus;
import com.ventapasajes.dispatch.persistence.entity.Bus;
import com.ventapasajes.dispatch.persistence.entity.Departure;
import com.ventapasajes.dispatch.persistence.entity.DispatchRoute;

import io.quarkus.hibernate.orm.panache.PanacheQuery;
import io.quarkus.panache.common.Page;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;

@ApplicationScoped
public class DepartureScheduleService {

    private static final ZoneId BUSINESS_ZONE = ZoneId.of("America/Guayaquil");

    @Inject
    DispatchAuditService auditService;

    @Transactional
    public PageResponse<DepartureResponse> listDepartures(
            int page,
            int pageSize,
            LocalDate dateFrom,
            LocalDate dateTo,
            UUID routeId,
            UUID busId,
            DepartureStatus status) {
        PageRequest pageRequest = validatePage(page, pageSize);
        validateDateRange(dateFrom, dateTo);
        QuerySpec querySpec = departureQuery(dateFrom, dateTo, routeId, busId, status);
        PanacheQuery<Departure> query = Departure.<Departure>find(querySpec.listQuery("departureAt"), querySpec.params());
        List<DepartureResponse> data = query.page(Page.of(pageRequest.pageIndex(), pageRequest.pageSize()))
                .list()
                .stream()
                .map(this::toDepartureResponse)
                .toList();

        long totalItems = querySpec.isEmpty()
                ? Departure.count()
                : Departure.count(querySpec.where(), querySpec.params());
        return new PageResponse<>(data, pageMeta(pageRequest, totalItems));
    }

    @Transactional
    public DepartureResponse getDeparture(UUID departureId) {
        return toDepartureResponse(requireDeparture(departureId));
    }

    @Transactional
    public DepartureResponse createDeparture(DepartureCreateRequest request, AuditContext auditContext) {
        request = requirePayload(request);
        Bus bus = requireActiveBus(request.busId(), "busId");
        DispatchRoute route = requireActiveRoute(request.routeId(), "routeId");
        Instant departureAt = requireFutureDepartureAt(request.departureAt());
        validateDepartureDuplicates(null, request.legacyId());
        validateBusScheduleConflict(null, bus.id, departureAt, DepartureStatus.SCHEDULED);

        Departure departure = new Departure();
        departure.legacyId = request.legacyId();
        departure.bus = bus;
        departure.route = route;
        departure.departureAt = departureAt;
        departure.status = DepartureStatus.SCHEDULED;
        departure.notes = normalizeNullable(request.notes());
        departure.createdByUserId = auditContext == null ? null : auditContext.actorUserId();
        departure.persist();

        DepartureResponse response = toDepartureResponse(departure);
        auditService.record(auditContext, "DepartureScheduled", "departure", departure.id, payload("departure", response));
        return response;
    }

    @Transactional
    public DepartureResponse updateDeparture(UUID departureId, DepartureUpdateRequest request, AuditContext auditContext) {
        request = requirePayload(request);
        Departure departure = requireDeparture(departureId);
        if (departure.status == DepartureStatus.CANCELLED) {
            throw ApiException.conflict("DEPARTURE_ALREADY_CANCELLED", "Cancelled departures cannot be updated.");
        }

        DepartureStatus nextStatus = request.status() == null ? departure.status : request.status();
        if (nextStatus == DepartureStatus.CANCELLED) {
            return cancelDeparture(departureId, new DepartureCancelRequest("Cancelled through PATCH."), auditContext);
        }

        Integer nextLegacyId = request.legacyId() == null ? departure.legacyId : request.legacyId();
        Bus nextBus = request.busId() == null ? departure.bus : requireActiveBus(request.busId(), "busId");
        DispatchRoute nextRoute = request.routeId() == null ? departure.route : requireActiveRoute(request.routeId(), "routeId");
        Instant nextDepartureAt = request.departureAt() == null
                ? departure.departureAt
                : requireFutureDepartureAt(request.departureAt());

        validateDepartureDuplicates(departure.id, nextLegacyId);
        validateBusScheduleConflict(departure.id, nextBus.id, nextDepartureAt, nextStatus);

        departure.legacyId = nextLegacyId;
        departure.bus = nextBus;
        departure.route = nextRoute;
        departure.departureAt = nextDepartureAt;
        departure.status = nextStatus;
        if (request.notes() != null) {
            departure.notes = normalizeNullable(request.notes());
        }
        departure.persist();

        DepartureResponse response = toDepartureResponse(departure);
        auditService.record(auditContext, "DEPARTURE_UPDATED", "departure", departure.id, payload("departure", response));
        return response;
    }

    @Transactional
    public DepartureResponse cancelDeparture(UUID departureId, DepartureCancelRequest request, AuditContext auditContext) {
        Departure departure = requireDeparture(departureId);
        if (departure.status != DepartureStatus.CANCELLED) {
            departure.status = DepartureStatus.CANCELLED;
            departure.cancelledByUserId = auditContext == null ? null : auditContext.actorUserId();
            departure.cancellationReason = request == null ? null : normalizeNullable(request.reason());
            departure.cancelledAt = Instant.now();
            departure.persist();
            auditService.record(auditContext, "DEPARTURE_CANCELLED", "departure", departure.id, payload("departure", toDepartureResponse(departure)));
        }

        return toDepartureResponse(departure);
    }

    private QuerySpec departureQuery(
            LocalDate dateFrom,
            LocalDate dateTo,
            UUID routeId,
            UUID busId,
            DepartureStatus status) {
        QuerySpec querySpec = new QuerySpec();
        if (dateFrom != null) {
            querySpec.add("departureAt >= " + querySpec.bind(dateFrom.atStartOfDay(BUSINESS_ZONE).toInstant()));
        }
        if (dateTo != null) {
            querySpec.add("departureAt < " + querySpec.bind(dateTo.plusDays(1).atStartOfDay(BUSINESS_ZONE).toInstant()));
        }
        if (routeId != null) {
            querySpec.add("route.id = " + querySpec.bind(routeId));
        }
        if (busId != null) {
            querySpec.add("bus.id = " + querySpec.bind(busId));
        }
        if (status != null) {
            querySpec.add("status = " + querySpec.bind(status));
        }
        return querySpec;
    }

    private void validateDepartureDuplicates(UUID currentDepartureId, Integer legacyId) {
        if (legacyId == null) {
            return;
        }

        long count = currentDepartureId == null
                ? Departure.count("legacyId = ?1", legacyId)
                : Departure.count("id <> ?1 and legacyId = ?2", currentDepartureId, legacyId);
        if (count > 0) {
            throw ApiException.conflict("DEPARTURE_LEGACY_ID_ALREADY_EXISTS", "A departure already exists with the same legacy id.");
        }
    }

    private void validateBusScheduleConflict(UUID currentDepartureId, UUID busId, Instant departureAt, DepartureStatus status) {
        if (!blocksBusSchedule(status)) {
            return;
        }

        long count = currentDepartureId == null
                ? Departure.count(
                        "bus.id = ?1 and departureAt = ?2 and (status = ?3 or status = ?4)",
                        busId,
                        departureAt,
                        DepartureStatus.SCHEDULED,
                        DepartureStatus.CLOSED)
                : Departure.count(
                        "id <> ?1 and bus.id = ?2 and departureAt = ?3 and (status = ?4 or status = ?5)",
                        currentDepartureId,
                        busId,
                        departureAt,
                        DepartureStatus.SCHEDULED,
                        DepartureStatus.CLOSED);

        if (count > 0) {
            throw ApiException.conflict("BUS_SCHEDULE_CONFLICT", "Bus already has a scheduled or closed departure at the same date and time.");
        }
    }

    private Bus requireActiveBus(UUID busId, String fieldName) {
        if (busId == null) {
            throw ApiException.validation("VALIDATION_ERROR", "Field is required: " + fieldName + ".");
        }
        Bus bus = Bus.findById(busId);
        if (bus == null) {
            throw ApiException.notFound("BUS_NOT_FOUND", "Bus was not found: " + busId + ".");
        }
        if (!bus.active) {
            throw ApiException.validation("BUS_INACTIVE", "Bus is inactive: " + busId + ".");
        }
        return bus;
    }

    private DispatchRoute requireActiveRoute(UUID routeId, String fieldName) {
        if (routeId == null) {
            throw ApiException.validation("VALIDATION_ERROR", "Field is required: " + fieldName + ".");
        }
        DispatchRoute route = DispatchRoute.findById(routeId);
        if (route == null) {
            throw ApiException.notFound("ROUTE_NOT_FOUND", "Route was not found: " + routeId + ".");
        }
        if (!route.active) {
            throw ApiException.validation("ROUTE_INACTIVE", "Route is inactive: " + routeId + ".");
        }
        return route;
    }

    private Departure requireDeparture(UUID departureId) {
        if (departureId == null) {
            throw ApiException.validation("VALIDATION_ERROR", "Field is required: departureId.");
        }
        Departure departure = Departure.findById(departureId);
        if (departure == null) {
            throw ApiException.notFound("DEPARTURE_NOT_FOUND", "Departure was not found.");
        }
        return departure;
    }

    private DepartureResponse toDepartureResponse(Departure departure) {
        return new DepartureResponse(
                departure.id,
                departure.legacyId,
                departure.bus.id,
                departure.bus.code,
                departure.bus.plate,
                departure.route.id,
                departure.route.name,
                departure.route.originTerminal.id,
                departure.route.originTerminal.name,
                departure.route.destinationTerminal.id,
                departure.route.destinationTerminal.name,
                departure.departureAt,
                departure.status,
                departure.notes,
                departure.cancellationReason,
                departure.cancelledAt,
                departure.createdAt,
                departure.updatedAt);
    }

    private PageMeta pageMeta(PageRequest pageRequest, long totalItems) {
        int totalPages = totalItems == 0 ? 0 : (int) Math.ceil((double) totalItems / pageRequest.pageSize());
        return new PageMeta(pageRequest.page(), pageRequest.pageSize(), totalItems, totalPages);
    }

    static PageRequest validatePage(int page, int pageSize) {
        if (page < 1) {
            throw ApiException.validation("VALIDATION_ERROR", "Query parameter page must be greater than or equal to 1.");
        }
        if (pageSize < 1 || pageSize > 100) {
            throw ApiException.validation("VALIDATION_ERROR", "Query parameter page_size must be between 1 and 100.");
        }
        return new PageRequest(page, pageSize);
    }

    static void validateDateRange(LocalDate dateFrom, LocalDate dateTo) {
        if (dateFrom != null && dateTo != null && dateTo.isBefore(dateFrom)) {
            throw ApiException.validation("INVALID_DATE_RANGE", "date_to must be greater than or equal to date_from.");
        }
    }

    static Instant requireFutureDepartureAt(Instant departureAt) {
        if (departureAt == null) {
            throw ApiException.validation("VALIDATION_ERROR", "Field is required: departureAt.");
        }
        if (!departureAt.isAfter(Instant.now())) {
            throw ApiException.validation("DEPARTURE_AT_MUST_BE_FUTURE", "Departure date and time must be in the future.");
        }
        return departureAt;
    }

    static boolean blocksBusSchedule(DepartureStatus status) {
        return status == DepartureStatus.SCHEDULED || status == DepartureStatus.CLOSED;
    }

    static String normalizeNullable(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private <T> T requirePayload(T payload) {
        if (payload == null) {
            throw ApiException.validation("VALIDATION_ERROR", "Request body is required.");
        }
        return payload;
    }

    private Map<String, Object> payload(String key, Object value) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put(key, value);
        return payload;
    }

    record PageRequest(int page, int pageSize) {
        int pageIndex() {
            return page - 1;
        }
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

        boolean isEmpty() {
            return predicates.isEmpty();
        }

        String where() {
            return String.join(" and ", predicates);
        }

        String listQuery(String orderBy) {
            String order = " order by " + orderBy;
            return isEmpty() ? order.trim() : where() + order;
        }

        Object[] params() {
            return params.toArray();
        }
    }
}
