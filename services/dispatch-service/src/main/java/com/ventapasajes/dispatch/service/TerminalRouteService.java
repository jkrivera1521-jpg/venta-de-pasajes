package com.ventapasajes.dispatch.service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

import com.ventapasajes.dispatch.api.ApiException;
import com.ventapasajes.dispatch.api.dto.PageMeta;
import com.ventapasajes.dispatch.api.dto.PageResponse;
import com.ventapasajes.dispatch.api.dto.RouteCreateRequest;
import com.ventapasajes.dispatch.api.dto.RouteResponse;
import com.ventapasajes.dispatch.api.dto.RouteUpdateRequest;
import com.ventapasajes.dispatch.api.dto.TerminalCreateRequest;
import com.ventapasajes.dispatch.api.dto.TerminalResponse;
import com.ventapasajes.dispatch.api.dto.TerminalUpdateRequest;
import com.ventapasajes.dispatch.persistence.entity.Bus;
import com.ventapasajes.dispatch.persistence.entity.DispatchRoute;
import com.ventapasajes.dispatch.persistence.entity.Terminal;

import io.quarkus.hibernate.orm.panache.PanacheQuery;
import io.quarkus.panache.common.Page;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;

@ApplicationScoped
public class TerminalRouteService {

    @Inject
    DispatchAuditService auditService;

    @Transactional
    public PageResponse<TerminalResponse> listTerminals(int page, int pageSize, String q, Boolean active) {
        PageRequest pageRequest = validatePage(page, pageSize);
        QuerySpec querySpec = terminalQuery(q, active);
        PanacheQuery<Terminal> query = Terminal.<Terminal>find(querySpec.listQuery("name"), querySpec.params());
        List<TerminalResponse> data = query.page(Page.of(pageRequest.pageIndex(), pageRequest.pageSize()))
                .list()
                .stream()
                .map(this::toTerminalResponse)
                .toList();

        long totalItems = querySpec.isEmpty()
                ? Terminal.count()
                : Terminal.count(querySpec.where(), querySpec.params());
        return new PageResponse<>(data, pageMeta(pageRequest, totalItems));
    }

    @Transactional
    public TerminalResponse getTerminal(UUID terminalId) {
        return toTerminalResponse(requireTerminal(terminalId));
    }

    @Transactional
    public TerminalResponse createTerminal(TerminalCreateRequest request, AuditContext auditContext) {
        request = requirePayload(request);
        validateTerminalDuplicates(null, request.legacyId(), request.localCode(), request.name());

        Terminal terminal = new Terminal();
        terminal.legacyId = request.legacyId();
        terminal.localCode = normalizeNullable(request.localCode());
        terminal.name = requiredText(request.name(), "name");
        terminal.managerName = normalizeNullable(request.managerName());
        terminal.address = normalizeNullable(request.address());
        terminal.phone = normalizeNullable(request.phone());
        terminal.email = normalizeNullable(request.email());
        terminal.active = request.active() == null || request.active();
        terminal.createdByUserId = auditContext == null ? null : auditContext.actorUserId();
        terminal.persist();

        TerminalResponse response = toTerminalResponse(terminal);
        auditService.record(auditContext, "TERMINAL_CREATED", "terminal", terminal.id, payload("terminal", response));
        return response;
    }

    @Transactional
    public TerminalResponse updateTerminal(UUID terminalId, TerminalUpdateRequest request, AuditContext auditContext) {
        request = requirePayload(request);
        Terminal terminal = requireTerminal(terminalId);

        Integer nextLegacyId = request.legacyId() == null ? terminal.legacyId : request.legacyId();
        String nextLocalCode = request.localCode() == null ? terminal.localCode : request.localCode();
        String nextName = request.name() == null ? terminal.name : request.name();
        validateTerminalDuplicates(terminal.id, nextLegacyId, nextLocalCode, nextName);

        terminal.legacyId = nextLegacyId;
        if (request.localCode() != null) {
            terminal.localCode = normalizeNullable(request.localCode());
        }
        if (request.name() != null) {
            terminal.name = requiredText(request.name(), "name");
        }
        if (request.managerName() != null) {
            terminal.managerName = normalizeNullable(request.managerName());
        }
        if (request.address() != null) {
            terminal.address = normalizeNullable(request.address());
        }
        if (request.phone() != null) {
            terminal.phone = normalizeNullable(request.phone());
        }
        if (request.email() != null) {
            terminal.email = normalizeNullable(request.email());
        }
        if (request.active() != null) {
            terminal.active = request.active();
        }
        terminal.persist();

        TerminalResponse response = toTerminalResponse(terminal);
        auditService.record(auditContext, "TERMINAL_UPDATED", "terminal", terminal.id, payload("terminal", response));
        return response;
    }

    @Transactional
    public void deactivateTerminal(UUID terminalId, AuditContext auditContext) {
        Terminal terminal = requireTerminal(terminalId);
        long activeRouteCount = DispatchRoute.count(
                "(originTerminal.id = ?1 or destinationTerminal.id = ?1) and active = true",
                terminal.id);
        long busCount = Bus.count("terminal.id = ?1 and active = true", terminal.id);
        if (activeRouteCount > 0 || busCount > 0) {
            throw ApiException.conflict(
                    "TERMINAL_IN_USE",
                    "Terminal cannot be deactivated while active routes or buses reference it.");
        }

        if (terminal.active) {
            terminal.active = false;
            terminal.persist();
            auditService.record(auditContext, "TERMINAL_DEACTIVATED", "terminal", terminal.id, payload("terminal", toTerminalResponse(terminal)));
        }
    }

    @Transactional
    public PageResponse<RouteResponse> listRoutes(
            int page,
            int pageSize,
            UUID originTerminalId,
            UUID destinationTerminalId,
            String q,
            Boolean active) {
        PageRequest pageRequest = validatePage(page, pageSize);
        QuerySpec querySpec = routeQuery(originTerminalId, destinationTerminalId, q, active);
        PanacheQuery<DispatchRoute> query = DispatchRoute.<DispatchRoute>find(querySpec.listQuery("name"), querySpec.params());
        List<RouteResponse> data = query.page(Page.of(pageRequest.pageIndex(), pageRequest.pageSize()))
                .list()
                .stream()
                .map(this::toRouteResponse)
                .toList();

        long totalItems = querySpec.isEmpty()
                ? DispatchRoute.count()
                : DispatchRoute.count(querySpec.where(), querySpec.params());
        return new PageResponse<>(data, pageMeta(pageRequest, totalItems));
    }

    @Transactional
    public RouteResponse getRoute(UUID routeId) {
        return toRouteResponse(requireRoute(routeId));
    }

    @Transactional
    public RouteResponse createRoute(RouteCreateRequest request, AuditContext auditContext) {
        request = requirePayload(request);
        Terminal origin = requireActiveTerminal(request.originTerminalId(), "originTerminalId");
        Terminal destination = requireActiveTerminal(request.destinationTerminalId(), "destinationTerminalId");
        validateDifferentTerminals(origin.id, destination.id);
        validateRouteDuplicate(null, origin.id, destination.id);

        DispatchRoute route = new DispatchRoute();
        route.originTerminal = origin;
        route.destinationTerminal = destination;
        route.name = request.name() == null || request.name().isBlank()
                ? defaultRouteName(origin, destination)
                : request.name().trim();
        route.active = request.active() == null || request.active();
        route.persist();

        RouteResponse response = toRouteResponse(route);
        auditService.record(auditContext, "ROUTE_CREATED", "route", route.id, payload("route", response));
        return response;
    }

    @Transactional
    public RouteResponse updateRoute(UUID routeId, RouteUpdateRequest request, AuditContext auditContext) {
        request = requirePayload(request);
        DispatchRoute route = requireRoute(routeId);
        Terminal origin = request.originTerminalId() == null
                ? route.originTerminal
                : requireActiveTerminal(request.originTerminalId(), "originTerminalId");
        Terminal destination = request.destinationTerminalId() == null
                ? route.destinationTerminal
                : requireActiveTerminal(request.destinationTerminalId(), "destinationTerminalId");

        validateDifferentTerminals(origin.id, destination.id);
        validateRouteDuplicate(route.id, origin.id, destination.id);

        route.originTerminal = origin;
        route.destinationTerminal = destination;
        if (request.name() != null) {
            route.name = requiredText(request.name(), "name");
        }
        if (request.active() != null) {
            route.active = request.active();
        }
        route.persist();

        RouteResponse response = toRouteResponse(route);
        auditService.record(auditContext, "ROUTE_UPDATED", "route", route.id, payload("route", response));
        return response;
    }

    @Transactional
    public void deactivateRoute(UUID routeId, AuditContext auditContext) {
        DispatchRoute route = requireRoute(routeId);
        if (route.active) {
            route.active = false;
            route.persist();
            auditService.record(auditContext, "ROUTE_DEACTIVATED", "route", route.id, payload("route", toRouteResponse(route)));
        }
    }

    private QuerySpec terminalQuery(String q, Boolean active) {
        QuerySpec querySpec = new QuerySpec();
        if (active != null) {
            querySpec.add("active = " + querySpec.bind(active));
        }
        String normalizedQ = normalizeNullable(q);
        if (normalizedQ != null) {
            String like = "%" + normalizedQ.toLowerCase(Locale.ROOT) + "%";
            String param = querySpec.bind(like);
            querySpec.add("("
                    + "lower(name) like " + param
                    + " or lower(localCode) like " + param
                    + " or lower(managerName) like " + param
                    + " or lower(address) like " + param
                    + " or lower(phone) like " + param
                    + " or lower(email) like " + param
                    + ")");
        }
        return querySpec;
    }

    private QuerySpec routeQuery(UUID originTerminalId, UUID destinationTerminalId, String q, Boolean active) {
        QuerySpec querySpec = new QuerySpec();
        if (originTerminalId != null) {
            querySpec.add("originTerminal.id = " + querySpec.bind(originTerminalId));
        }
        if (destinationTerminalId != null) {
            querySpec.add("destinationTerminal.id = " + querySpec.bind(destinationTerminalId));
        }
        if (active != null) {
            querySpec.add("active = " + querySpec.bind(active));
        }
        String normalizedQ = normalizeNullable(q);
        if (normalizedQ != null) {
            String like = "%" + normalizedQ.toLowerCase(Locale.ROOT) + "%";
            String param = querySpec.bind(like);
            querySpec.add("("
                    + "lower(name) like " + param
                    + " or lower(originTerminal.name) like " + param
                    + " or lower(destinationTerminal.name) like " + param
                    + ")");
        }
        return querySpec;
    }

    private void validateTerminalDuplicates(UUID currentTerminalId, Integer legacyId, String localCode, String name) {
        if (legacyId != null && terminalExists("legacyId = ?1", currentTerminalId, legacyId)) {
            throw ApiException.conflict("TERMINAL_LEGACY_ID_ALREADY_EXISTS", "A terminal already exists with the same legacy id.");
        }

        String normalizedLocalCode = normalizeNullable(localCode);
        if (normalizedLocalCode != null && terminalExists("lower(localCode) = ?1", currentTerminalId, normalizedLocalCode.toLowerCase(Locale.ROOT))) {
            throw ApiException.conflict("TERMINAL_LOCAL_CODE_ALREADY_EXISTS", "A terminal already exists with the same local code.");
        }

        String normalizedName = requiredText(name, "name").toLowerCase(Locale.ROOT);
        if (terminalExists("lower(name) = ?1", currentTerminalId, normalizedName)) {
            throw ApiException.conflict("TERMINAL_NAME_ALREADY_EXISTS", "A terminal already exists with the same name.");
        }
    }

    private boolean terminalExists(String condition, UUID currentTerminalId, Object value) {
        if (currentTerminalId == null) {
            return Terminal.count(condition, value) > 0;
        }
        return Terminal.count("id <> ?1 and " + condition.replace("?1", "?2"), currentTerminalId, value) > 0;
    }

    private void validateRouteDuplicate(UUID currentRouteId, UUID originTerminalId, UUID destinationTerminalId) {
        String condition = "originTerminal.id = ?1 and destinationTerminal.id = ?2";
        long count = currentRouteId == null
                ? DispatchRoute.count(condition, originTerminalId, destinationTerminalId)
                : DispatchRoute.count("id <> ?1 and originTerminal.id = ?2 and destinationTerminal.id = ?3",
                        currentRouteId, originTerminalId, destinationTerminalId);
        if (count > 0) {
            throw ApiException.conflict("ROUTE_ALREADY_EXISTS", "A route already exists with the same origin and destination.");
        }
    }

    private Terminal requireTerminal(UUID terminalId) {
        if (terminalId == null) {
            throw ApiException.validation("VALIDATION_ERROR", "Field is required: terminalId.");
        }
        Terminal terminal = Terminal.findById(terminalId);
        if (terminal == null) {
            throw ApiException.notFound("TERMINAL_NOT_FOUND", "Terminal was not found.");
        }
        return terminal;
    }

    private Terminal requireActiveTerminal(UUID terminalId, String fieldName) {
        Terminal terminal = requireTerminalWithFieldName(terminalId, fieldName);
        if (!terminal.active) {
            throw ApiException.validation("TERMINAL_INACTIVE", "Terminal is inactive: " + terminalId + ".");
        }
        return terminal;
    }

    private Terminal requireTerminalWithFieldName(UUID terminalId, String fieldName) {
        if (terminalId == null) {
            throw ApiException.validation("VALIDATION_ERROR", "Field is required: " + fieldName + ".");
        }
        Terminal terminal = Terminal.findById(terminalId);
        if (terminal == null) {
            throw ApiException.notFound("TERMINAL_NOT_FOUND", "Terminal was not found: " + terminalId + ".");
        }
        return terminal;
    }

    private DispatchRoute requireRoute(UUID routeId) {
        if (routeId == null) {
            throw ApiException.validation("VALIDATION_ERROR", "Field is required: routeId.");
        }
        DispatchRoute route = DispatchRoute.findById(routeId);
        if (route == null) {
            throw ApiException.notFound("ROUTE_NOT_FOUND", "Route was not found.");
        }
        return route;
    }

    private void validateDifferentTerminals(UUID originTerminalId, UUID destinationTerminalId) {
        if (originTerminalId.equals(destinationTerminalId)) {
            throw ApiException.validation("ROUTE_TERMINALS_MUST_BE_DIFFERENT", "Origin and destination terminals must be different.");
        }
    }

    private TerminalResponse toTerminalResponse(Terminal terminal) {
        return new TerminalResponse(
                terminal.id,
                terminal.legacyId,
                terminal.localCode,
                terminal.name,
                terminal.managerName,
                terminal.address,
                terminal.phone,
                terminal.email,
                terminal.active,
                terminal.createdAt,
                terminal.updatedAt);
    }

    private RouteResponse toRouteResponse(DispatchRoute route) {
        return new RouteResponse(
                route.id,
                route.originTerminal.id,
                route.originTerminal.name,
                route.destinationTerminal.id,
                route.destinationTerminal.name,
                route.name,
                route.active,
                route.createdAt,
                route.updatedAt);
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

    static String requiredText(String value, String fieldName) {
        if (value == null || value.isBlank()) {
            throw ApiException.validation("VALIDATION_ERROR", "Field is required: " + fieldName + ".");
        }
        return value.trim();
    }

    static String normalizeNullable(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    static String defaultRouteName(Terminal origin, Terminal destination) {
        return origin.name + " - " + destination.name;
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
