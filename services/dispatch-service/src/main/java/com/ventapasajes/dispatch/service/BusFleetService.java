package com.ventapasajes.dispatch.service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import com.ventapasajes.dispatch.api.ApiException;
import com.ventapasajes.dispatch.api.dto.BusCreateRequest;
import com.ventapasajes.dispatch.api.dto.BusResponse;
import com.ventapasajes.dispatch.api.dto.BusTypeCreateRequest;
import com.ventapasajes.dispatch.api.dto.BusTypeResponse;
import com.ventapasajes.dispatch.api.dto.BusTypeUpdateRequest;
import com.ventapasajes.dispatch.api.dto.BusUpdateRequest;
import com.ventapasajes.dispatch.api.dto.PageMeta;
import com.ventapasajes.dispatch.api.dto.PageResponse;
import com.ventapasajes.dispatch.api.dto.SeatDefinitionRequest;
import com.ventapasajes.dispatch.api.dto.SeatDefinitionResponse;
import com.ventapasajes.dispatch.api.dto.SeatLayoutCreateRequest;
import com.ventapasajes.dispatch.api.dto.SeatLayoutResponse;
import com.ventapasajes.dispatch.api.dto.SeatLayoutUpdateRequest;
import com.ventapasajes.dispatch.domain.DepartureStatus;
import com.ventapasajes.dispatch.domain.SeatPosition;
import com.ventapasajes.dispatch.persistence.entity.Bus;
import com.ventapasajes.dispatch.persistence.entity.BusType;
import com.ventapasajes.dispatch.persistence.entity.Departure;
import com.ventapasajes.dispatch.persistence.entity.SeatLayout;
import com.ventapasajes.dispatch.persistence.entity.SeatLayoutSeat;
import com.ventapasajes.dispatch.persistence.entity.Terminal;

import io.quarkus.hibernate.orm.panache.PanacheQuery;
import io.quarkus.panache.common.Page;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;

@ApplicationScoped
public class BusFleetService {

    private static final int MAX_SEATS_PER_LAYOUT = 80;

    @Inject
    DispatchAuditService auditService;

    @Transactional
    public PageResponse<BusTypeResponse> listBusTypes(int page, int pageSize, String q, Boolean active) {
        PageRequest pageRequest = validatePage(page, pageSize);
        QuerySpec querySpec = busTypeQuery(q, active);
        PanacheQuery<BusType> query = BusType.<BusType>find(querySpec.listQuery("name"), querySpec.params());
        List<BusTypeResponse> data = query.page(Page.of(pageRequest.pageIndex(), pageRequest.pageSize()))
                .list()
                .stream()
                .map(this::toBusTypeResponse)
                .toList();

        long totalItems = querySpec.isEmpty()
                ? BusType.count()
                : BusType.count(querySpec.where(), querySpec.params());
        return new PageResponse<>(data, pageMeta(pageRequest, totalItems));
    }

    @Transactional
    public BusTypeResponse getBusType(UUID busTypeId) {
        return toBusTypeResponse(requireBusType(busTypeId));
    }

    @Transactional
    public BusTypeResponse createBusType(BusTypeCreateRequest request, AuditContext auditContext) {
        request = requirePayload(request);
        validateBusTypeDuplicates(null, request.legacyId(), request.name());

        BusType busType = new BusType();
        busType.legacyId = request.legacyId();
        busType.name = requiredText(request.name(), "name");
        busType.description = normalizeNullable(request.description());
        busType.active = request.active() == null || request.active();
        busType.persist();

        BusTypeResponse response = toBusTypeResponse(busType);
        auditService.record(auditContext, "BUS_TYPE_CREATED", "bus_type", busType.id, payload("bus_type", response));
        return response;
    }

    @Transactional
    public BusTypeResponse updateBusType(UUID busTypeId, BusTypeUpdateRequest request, AuditContext auditContext) {
        request = requirePayload(request);
        BusType busType = requireBusType(busTypeId);

        Integer nextLegacyId = request.legacyId() == null ? busType.legacyId : request.legacyId();
        String nextName = request.name() == null ? busType.name : request.name();
        validateBusTypeDuplicates(busType.id, nextLegacyId, nextName);

        busType.legacyId = nextLegacyId;
        if (request.name() != null) {
            busType.name = requiredText(request.name(), "name");
        }
        if (request.description() != null) {
            busType.description = normalizeNullable(request.description());
        }
        if (request.active() != null) {
            busType.active = request.active();
        }
        busType.persist();

        BusTypeResponse response = toBusTypeResponse(busType);
        auditService.record(auditContext, "BUS_TYPE_UPDATED", "bus_type", busType.id, payload("bus_type", response));
        return response;
    }

    @Transactional
    public void deactivateBusType(UUID busTypeId, AuditContext auditContext) {
        BusType busType = requireBusType(busTypeId);
        long activeBusCount = Bus.count("busType.id = ?1 and active = true", busType.id);
        if (activeBusCount > 0) {
            throw ApiException.conflict("BUS_TYPE_IN_USE", "Bus type cannot be deactivated while active buses reference it.");
        }

        if (busType.active) {
            busType.active = false;
            busType.persist();
            auditService.record(auditContext, "BUS_TYPE_DEACTIVATED", "bus_type", busType.id, payload("bus_type", toBusTypeResponse(busType)));
        }
    }

    @Transactional
    public PageResponse<SeatLayoutResponse> listSeatLayouts(int page, int pageSize, String q, Boolean active) {
        PageRequest pageRequest = validatePage(page, pageSize);
        QuerySpec querySpec = seatLayoutQuery(q, active);
        PanacheQuery<SeatLayout> query = SeatLayout.<SeatLayout>find(querySpec.listQuery("name"), querySpec.params());
        List<SeatLayoutResponse> data = query.page(Page.of(pageRequest.pageIndex(), pageRequest.pageSize()))
                .list()
                .stream()
                .map(this::toSeatLayoutResponse)
                .toList();

        long totalItems = querySpec.isEmpty()
                ? SeatLayout.count()
                : SeatLayout.count(querySpec.where(), querySpec.params());
        return new PageResponse<>(data, pageMeta(pageRequest, totalItems));
    }

    @Transactional
    public SeatLayoutResponse getSeatLayout(UUID seatLayoutId) {
        return toSeatLayoutResponse(requireSeatLayout(seatLayoutId));
    }

    @Transactional
    public SeatLayoutResponse createSeatLayout(SeatLayoutCreateRequest request, AuditContext auditContext) {
        request = requirePayload(request);
        List<NormalizedSeat> seats = validateSeatDefinitions(request.seats());
        validateSeatLayoutDuplicate(null, request.name());

        SeatLayout seatLayout = new SeatLayout();
        seatLayout.name = requiredText(request.name(), "name");
        seatLayout.seatCount = seats.size();
        seatLayout.active = request.active() == null || request.active();
        seatLayout.persist();
        replaceSeatDefinitions(seatLayout, seats);

        SeatLayoutResponse response = toSeatLayoutResponse(seatLayout);
        auditService.record(auditContext, "SEAT_LAYOUT_CREATED", "seat_layout", seatLayout.id, payload("seat_layout", response));
        return response;
    }

    @Transactional
    public SeatLayoutResponse updateSeatLayout(UUID seatLayoutId, SeatLayoutUpdateRequest request, AuditContext auditContext) {
        request = requirePayload(request);
        SeatLayout seatLayout = requireSeatLayout(seatLayoutId);

        String nextName = request.name() == null ? seatLayout.name : request.name();
        validateSeatLayoutDuplicate(seatLayout.id, nextName);

        if (request.seats() != null && Bus.count("seatLayout.id = ?1 and active = true", seatLayout.id) > 0) {
            throw ApiException.conflict("SEAT_LAYOUT_IN_USE", "Seat layout cannot be changed while active buses reference it.");
        }

        if (request.name() != null) {
            seatLayout.name = requiredText(request.name(), "name");
        }
        if (request.seats() != null) {
            List<NormalizedSeat> seats = validateSeatDefinitions(request.seats());
            seatLayout.seatCount = seats.size();
            replaceSeatDefinitions(seatLayout, seats);
        }
        if (request.active() != null) {
            seatLayout.active = request.active();
        }
        seatLayout.persist();

        SeatLayoutResponse response = toSeatLayoutResponse(seatLayout);
        auditService.record(auditContext, "SEAT_LAYOUT_UPDATED", "seat_layout", seatLayout.id, payload("seat_layout", response));
        return response;
    }

    @Transactional
    public void deactivateSeatLayout(UUID seatLayoutId, AuditContext auditContext) {
        SeatLayout seatLayout = requireSeatLayout(seatLayoutId);
        long activeBusCount = Bus.count("seatLayout.id = ?1 and active = true", seatLayout.id);
        if (activeBusCount > 0) {
            throw ApiException.conflict("SEAT_LAYOUT_IN_USE", "Seat layout cannot be deactivated while active buses reference it.");
        }

        if (seatLayout.active) {
            seatLayout.active = false;
            seatLayout.persist();
            auditService.record(auditContext, "SEAT_LAYOUT_DEACTIVATED", "seat_layout", seatLayout.id, payload("seat_layout", toSeatLayoutResponse(seatLayout)));
        }
    }

    @Transactional
    public PageResponse<BusResponse> listBuses(
            int page,
            int pageSize,
            String q,
            UUID terminalId,
            UUID busTypeId,
            UUID seatLayoutId,
            Boolean active) {
        PageRequest pageRequest = validatePage(page, pageSize);
        QuerySpec querySpec = busQuery(q, terminalId, busTypeId, seatLayoutId, active);
        PanacheQuery<Bus> query = Bus.<Bus>find(querySpec.listQuery("code"), querySpec.params());
        List<BusResponse> data = query.page(Page.of(pageRequest.pageIndex(), pageRequest.pageSize()))
                .list()
                .stream()
                .map(this::toBusResponse)
                .toList();

        long totalItems = querySpec.isEmpty()
                ? Bus.count()
                : Bus.count(querySpec.where(), querySpec.params());
        return new PageResponse<>(data, pageMeta(pageRequest, totalItems));
    }

    @Transactional
    public BusResponse getBus(UUID busId) {
        return toBusResponse(requireBus(busId));
    }

    @Transactional
    public BusResponse createBus(BusCreateRequest request, AuditContext auditContext) {
        request = requirePayload(request);
        BusType busType = requireActiveBusType(request.busTypeId(), "busTypeId");
        Terminal terminal = requireActiveTerminal(request.terminalId(), "terminalId");
        SeatLayout seatLayout = requireActiveSeatLayout(request.seatLayoutId(), "seatLayoutId");
        validateBusDuplicates(null, request.legacyId(), request.code(), request.plate());

        Bus bus = new Bus();
        bus.legacyId = request.legacyId();
        bus.code = requiredText(request.code(), "code");
        bus.plate = requiredText(request.plate(), "plate").toUpperCase(Locale.ROOT);
        bus.description = normalizeNullable(request.description());
        bus.defaultDestination = normalizeNullable(request.defaultDestination());
        bus.busType = busType;
        bus.terminal = terminal;
        bus.seatLayout = seatLayout;
        bus.active = request.active() == null || request.active();
        bus.createdByUserId = auditContext == null ? null : auditContext.actorUserId();
        bus.persist();

        BusResponse response = toBusResponse(bus);
        auditService.record(auditContext, "BUS_CREATED", "bus", bus.id, payload("bus", response));
        return response;
    }

    @Transactional
    public BusResponse updateBus(UUID busId, BusUpdateRequest request, AuditContext auditContext) {
        request = requirePayload(request);
        Bus bus = requireBus(busId);

        Integer nextLegacyId = request.legacyId() == null ? bus.legacyId : request.legacyId();
        String nextCode = request.code() == null ? bus.code : request.code();
        String nextPlate = request.plate() == null ? bus.plate : request.plate();
        validateBusDuplicates(bus.id, nextLegacyId, nextCode, nextPlate);

        if (request.legacyId() != null) {
            bus.legacyId = request.legacyId();
        }
        if (request.code() != null) {
            bus.code = requiredText(request.code(), "code");
        }
        if (request.plate() != null) {
            bus.plate = requiredText(request.plate(), "plate").toUpperCase(Locale.ROOT);
        }
        if (request.description() != null) {
            bus.description = normalizeNullable(request.description());
        }
        if (request.defaultDestination() != null) {
            bus.defaultDestination = normalizeNullable(request.defaultDestination());
        }
        if (request.busTypeId() != null) {
            bus.busType = requireActiveBusType(request.busTypeId(), "busTypeId");
        }
        if (request.terminalId() != null) {
            bus.terminal = requireActiveTerminal(request.terminalId(), "terminalId");
        }
        if (request.seatLayoutId() != null) {
            bus.seatLayout = requireActiveSeatLayout(request.seatLayoutId(), "seatLayoutId");
        }
        if (request.active() != null) {
            bus.active = request.active();
        }
        bus.persist();

        BusResponse response = toBusResponse(bus);
        auditService.record(auditContext, "BUS_UPDATED", "bus", bus.id, payload("bus", response));
        return response;
    }

    @Transactional
    public void deactivateBus(UUID busId, AuditContext auditContext) {
        Bus bus = requireBus(busId);
        long scheduledDepartures = Departure.count(
                "bus.id = ?1 and (status = ?2 or status = ?3)",
                bus.id,
                DepartureStatus.SCHEDULED,
                DepartureStatus.CLOSED);
        if (scheduledDepartures > 0) {
            throw ApiException.conflict("BUS_IN_USE", "Bus cannot be deactivated while scheduled or closed departures reference it.");
        }

        if (bus.active) {
            bus.active = false;
            bus.persist();
            auditService.record(auditContext, "BUS_DEACTIVATED", "bus", bus.id, payload("bus", toBusResponse(bus)));
        }
    }

    private QuerySpec busTypeQuery(String q, Boolean active) {
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
                    + " or lower(description) like " + param
                    + ")");
        }
        return querySpec;
    }

    private QuerySpec seatLayoutQuery(String q, Boolean active) {
        QuerySpec querySpec = new QuerySpec();
        if (active != null) {
            querySpec.add("active = " + querySpec.bind(active));
        }
        String normalizedQ = normalizeNullable(q);
        if (normalizedQ != null) {
            String param = querySpec.bind("%" + normalizedQ.toLowerCase(Locale.ROOT) + "%");
            querySpec.add("lower(name) like " + param);
        }
        return querySpec;
    }

    private QuerySpec busQuery(String q, UUID terminalId, UUID busTypeId, UUID seatLayoutId, Boolean active) {
        QuerySpec querySpec = new QuerySpec();
        if (terminalId != null) {
            querySpec.add("terminal.id = " + querySpec.bind(terminalId));
        }
        if (busTypeId != null) {
            querySpec.add("busType.id = " + querySpec.bind(busTypeId));
        }
        if (seatLayoutId != null) {
            querySpec.add("seatLayout.id = " + querySpec.bind(seatLayoutId));
        }
        if (active != null) {
            querySpec.add("active = " + querySpec.bind(active));
        }
        String normalizedQ = normalizeNullable(q);
        if (normalizedQ != null) {
            String like = "%" + normalizedQ.toLowerCase(Locale.ROOT) + "%";
            String param = querySpec.bind(like);
            querySpec.add("("
                    + "lower(code) like " + param
                    + " or lower(plate) like " + param
                    + " or lower(description) like " + param
                    + " or lower(defaultDestination) like " + param
                    + " or lower(busType.name) like " + param
                    + " or lower(terminal.name) like " + param
                    + ")");
        }
        return querySpec;
    }

    private void validateBusTypeDuplicates(UUID currentBusTypeId, Integer legacyId, String name) {
        if (legacyId != null && busTypeExists("legacyId = ?1", currentBusTypeId, legacyId)) {
            throw ApiException.conflict("BUS_TYPE_LEGACY_ID_ALREADY_EXISTS", "A bus type already exists with the same legacy id.");
        }

        String normalizedName = requiredText(name, "name").toLowerCase(Locale.ROOT);
        if (busTypeExists("lower(name) = ?1", currentBusTypeId, normalizedName)) {
            throw ApiException.conflict("BUS_TYPE_NAME_ALREADY_EXISTS", "A bus type already exists with the same name.");
        }
    }

    private boolean busTypeExists(String condition, UUID currentBusTypeId, Object value) {
        if (currentBusTypeId == null) {
            return BusType.count(condition, value) > 0;
        }
        return BusType.count("id <> ?1 and " + condition.replace("?1", "?2"), currentBusTypeId, value) > 0;
    }

    private void validateSeatLayoutDuplicate(UUID currentSeatLayoutId, String name) {
        String normalizedName = requiredText(name, "name").toLowerCase(Locale.ROOT);
        long count = currentSeatLayoutId == null
                ? SeatLayout.count("lower(name) = ?1", normalizedName)
                : SeatLayout.count("id <> ?1 and lower(name) = ?2", currentSeatLayoutId, normalizedName);
        if (count > 0) {
            throw ApiException.conflict("SEAT_LAYOUT_NAME_ALREADY_EXISTS", "A seat layout already exists with the same name.");
        }
    }

    private void validateBusDuplicates(UUID currentBusId, Integer legacyId, String code, String plate) {
        if (legacyId != null && busExists("legacyId = ?1", currentBusId, legacyId)) {
            throw ApiException.conflict("BUS_LEGACY_ID_ALREADY_EXISTS", "A bus already exists with the same legacy id.");
        }

        String normalizedCode = requiredText(code, "code").toLowerCase(Locale.ROOT);
        if (busExists("lower(code) = ?1", currentBusId, normalizedCode)) {
            throw ApiException.conflict("BUS_CODE_ALREADY_EXISTS", "A bus already exists with the same code.");
        }

        String normalizedPlate = requiredText(plate, "plate").toLowerCase(Locale.ROOT);
        if (busExists("lower(plate) = ?1", currentBusId, normalizedPlate)) {
            throw ApiException.conflict("BUS_PLATE_ALREADY_EXISTS", "A bus already exists with the same plate.");
        }
    }

    private boolean busExists(String condition, UUID currentBusId, Object value) {
        if (currentBusId == null) {
            return Bus.count(condition, value) > 0;
        }
        return Bus.count("id <> ?1 and " + condition.replace("?1", "?2"), currentBusId, value) > 0;
    }

    private BusType requireBusType(UUID busTypeId) {
        if (busTypeId == null) {
            throw ApiException.validation("VALIDATION_ERROR", "Field is required: busTypeId.");
        }
        BusType busType = BusType.findById(busTypeId);
        if (busType == null) {
            throw ApiException.notFound("BUS_TYPE_NOT_FOUND", "Bus type was not found.");
        }
        return busType;
    }

    private BusType requireActiveBusType(UUID busTypeId, String fieldName) {
        if (busTypeId == null) {
            throw ApiException.validation("VALIDATION_ERROR", "Field is required: " + fieldName + ".");
        }
        BusType busType = requireBusType(busTypeId);
        if (!busType.active) {
            throw ApiException.validation("BUS_TYPE_INACTIVE", "Bus type is inactive: " + busTypeId + ".");
        }
        return busType;
    }

    private Terminal requireActiveTerminal(UUID terminalId, String fieldName) {
        if (terminalId == null) {
            throw ApiException.validation("VALIDATION_ERROR", "Field is required: " + fieldName + ".");
        }
        Terminal terminal = Terminal.findById(terminalId);
        if (terminal == null) {
            throw ApiException.notFound("TERMINAL_NOT_FOUND", "Terminal was not found: " + terminalId + ".");
        }
        if (!terminal.active) {
            throw ApiException.validation("TERMINAL_INACTIVE", "Terminal is inactive: " + terminalId + ".");
        }
        return terminal;
    }

    private SeatLayout requireSeatLayout(UUID seatLayoutId) {
        if (seatLayoutId == null) {
            throw ApiException.validation("VALIDATION_ERROR", "Field is required: seatLayoutId.");
        }
        SeatLayout seatLayout = SeatLayout.findById(seatLayoutId);
        if (seatLayout == null) {
            throw ApiException.notFound("SEAT_LAYOUT_NOT_FOUND", "Seat layout was not found.");
        }
        return seatLayout;
    }

    private SeatLayout requireActiveSeatLayout(UUID seatLayoutId, String fieldName) {
        if (seatLayoutId == null) {
            throw ApiException.validation("VALIDATION_ERROR", "Field is required: " + fieldName + ".");
        }
        SeatLayout seatLayout = requireSeatLayout(seatLayoutId);
        if (!seatLayout.active) {
            throw ApiException.validation("SEAT_LAYOUT_INACTIVE", "Seat layout is inactive: " + seatLayoutId + ".");
        }
        return seatLayout;
    }

    private Bus requireBus(UUID busId) {
        if (busId == null) {
            throw ApiException.validation("VALIDATION_ERROR", "Field is required: busId.");
        }
        Bus bus = Bus.findById(busId);
        if (bus == null) {
            throw ApiException.notFound("BUS_NOT_FOUND", "Bus was not found.");
        }
        return bus;
    }

    private void replaceSeatDefinitions(SeatLayout seatLayout, List<NormalizedSeat> seats) {
        SeatLayoutSeat.delete("seatLayout.id = ?1", seatLayout.id);
        for (NormalizedSeat seat : seats) {
            SeatLayoutSeat seatEntity = new SeatLayoutSeat();
            seatEntity.seatLayout = seatLayout;
            seatEntity.seatNumber = seat.seatNumber();
            seatEntity.label = seat.label();
            seatEntity.rowNumber = seat.rowNumber();
            seatEntity.columnNumber = seat.columnNumber();
            seatEntity.position = seat.position();
            seatEntity.active = seat.active();
            seatEntity.persist();
        }
    }

    private BusTypeResponse toBusTypeResponse(BusType busType) {
        return new BusTypeResponse(
                busType.id,
                busType.legacyId,
                busType.name,
                busType.description,
                busType.active,
                busType.createdAt,
                busType.updatedAt);
    }

    private SeatLayoutResponse toSeatLayoutResponse(SeatLayout seatLayout) {
        List<SeatDefinitionResponse> seats = SeatLayoutSeat.<SeatLayoutSeat>list(
                        "seatLayout.id = ?1 order by seatNumber",
                        seatLayout.id)
                .stream()
                .map(this::toSeatDefinitionResponse)
                .toList();
        return new SeatLayoutResponse(
                seatLayout.id,
                seatLayout.name,
                seatLayout.seatCount,
                seatLayout.active,
                seats,
                seatLayout.createdAt,
                seatLayout.updatedAt);
    }

    private SeatDefinitionResponse toSeatDefinitionResponse(SeatLayoutSeat seat) {
        return new SeatDefinitionResponse(
                seat.id,
                seat.seatNumber,
                seat.label,
                seat.rowNumber,
                seat.columnNumber,
                seat.position,
                seat.active);
    }

    private BusResponse toBusResponse(Bus bus) {
        return new BusResponse(
                bus.id,
                bus.legacyId,
                bus.code,
                bus.plate,
                bus.description,
                bus.defaultDestination,
                bus.busType.id,
                bus.busType.name,
                bus.terminal.id,
                bus.terminal.name,
                bus.seatLayout.id,
                bus.seatLayout.name,
                bus.seatLayout.seatCount,
                bus.active,
                bus.createdAt,
                bus.updatedAt);
    }

    private PageMeta pageMeta(PageRequest pageRequest, long totalItems) {
        int totalPages = totalItems == 0 ? 0 : (int) Math.ceil((double) totalItems / pageRequest.pageSize());
        return new PageMeta(pageRequest.page(), pageRequest.pageSize(), totalItems, totalPages);
    }

    static List<NormalizedSeat> validateSeatDefinitions(List<SeatDefinitionRequest> seats) {
        if (seats == null || seats.isEmpty()) {
            throw ApiException.validation("SEAT_LAYOUT_EMPTY", "Seat layout must contain at least one seat.");
        }
        if (seats.size() > MAX_SEATS_PER_LAYOUT) {
            throw ApiException.validation("SEAT_LAYOUT_TOO_LARGE", "Seat layout cannot contain more than 80 seats.");
        }

        List<NormalizedSeat> normalized = new ArrayList<>();
        Set<Integer> duplicatedSeatNumbers = seats.stream()
                .filter(seat -> seat != null && seat.seatNumber() != null)
                .collect(Collectors.groupingBy(SeatDefinitionRequest::seatNumber, Collectors.counting()))
                .entrySet()
                .stream()
                .filter(entry -> entry.getValue() > 1)
                .map(Map.Entry::getKey)
                .collect(Collectors.toSet());
        if (!duplicatedSeatNumbers.isEmpty()) {
            throw ApiException.validation("SEAT_LAYOUT_DUPLICATED_SEAT", "Seat numbers must be unique.");
        }

        Set<String> duplicatedCoordinates = seats.stream()
                .filter(seat -> seat != null && seat.rowNumber() != null && seat.columnNumber() != null)
                .collect(Collectors.groupingBy(seat -> seat.rowNumber() + ":" + seat.columnNumber(), Collectors.counting()))
                .entrySet()
                .stream()
                .filter(entry -> entry.getValue() > 1)
                .map(Map.Entry::getKey)
                .collect(Collectors.toSet());
        if (!duplicatedCoordinates.isEmpty()) {
            throw ApiException.validation("SEAT_LAYOUT_DUPLICATED_POSITION", "Seat coordinates must be unique.");
        }

        for (SeatDefinitionRequest seat : seats) {
            if (seat == null) {
                throw ApiException.validation("SEAT_LAYOUT_INVALID_SEAT", "Seat definition cannot be null.");
            }
            if (seat.seatNumber() == null || seat.seatNumber() < 1) {
                throw ApiException.validation("SEAT_LAYOUT_INVALID_SEAT_NUMBER", "Seat number must be greater than zero.");
            }
            if (seat.rowNumber() == null || seat.rowNumber() < 1) {
                throw ApiException.validation("SEAT_LAYOUT_INVALID_ROW", "Seat row number must be greater than zero.");
            }
            if (seat.columnNumber() == null || seat.columnNumber() < 1) {
                throw ApiException.validation("SEAT_LAYOUT_INVALID_COLUMN", "Seat column number must be greater than zero.");
            }
            if (seat.position() == null) {
                throw ApiException.validation("SEAT_LAYOUT_INVALID_POSITION", "Seat position is required.");
            }

            String label = normalizeNullable(seat.label());
            normalized.add(new NormalizedSeat(
                    seat.seatNumber(),
                    label == null ? String.valueOf(seat.seatNumber()) : label,
                    seat.rowNumber(),
                    seat.columnNumber(),
                    seat.position(),
                    seat.active() == null || seat.active()));
        }

        List<Integer> seatNumbers = normalized.stream()
                .map(NormalizedSeat::seatNumber)
                .sorted()
                .toList();
        for (int index = 0; index < seatNumbers.size(); index++) {
            int expectedNumber = index + 1;
            if (seatNumbers.get(index) != expectedNumber) {
                throw ApiException.validation(
                        "SEAT_LAYOUT_NUMBERING_INVALID",
                        "Seat numbers must be consecutive from 1 to the seat count.");
            }
        }

        normalized.sort(Comparator.comparing(NormalizedSeat::seatNumber));
        return normalized;
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

    record NormalizedSeat(
            Integer seatNumber,
            String label,
            Integer rowNumber,
            Integer columnNumber,
            SeatPosition position,
            boolean active) {
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
