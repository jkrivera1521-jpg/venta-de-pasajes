package com.ventapasajes.ticketing.service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.eclipse.microprofile.config.inject.ConfigProperty;

import com.ventapasajes.ticketing.api.dto.CreateReservationRequest;
import com.ventapasajes.ticketing.api.dto.ExpireReservationsRequest;
import com.ventapasajes.ticketing.api.dto.ExpiredReservationsResponse;
import com.ventapasajes.ticketing.api.dto.ReservationPassengerRequest;
import com.ventapasajes.ticketing.api.dto.ReservationResponse;
import com.ventapasajes.ticketing.domain.DepartureSeatStatus;
import com.ventapasajes.ticketing.domain.ReservationStatus;
import com.ventapasajes.ticketing.domain.SyncedDepartureStatus;
import com.ventapasajes.ticketing.persistence.entity.DepartureSeat;
import com.ventapasajes.ticketing.persistence.entity.OutboxEvent;
import com.ventapasajes.ticketing.persistence.entity.Passenger;
import com.ventapasajes.ticketing.persistence.entity.Reservation;
import com.ventapasajes.ticketing.persistence.entity.SyncedDeparture;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.ClientErrorException;
import jakarta.ws.rs.NotFoundException;
import jakarta.ws.rs.core.Response;
import jakarta.persistence.LockModeType;

@ApplicationScoped
public class TicketingReservationService {

    @ConfigProperty(name = "app.reservation.default-hold-minutes", defaultValue = "15")
    int defaultHoldMinutes;

    @ConfigProperty(name = "app.reservation.max-hold-minutes", defaultValue = "120")
    int maxHoldMinutes;

    @Inject
    TicketingPassengerService passengerService;

    @Transactional
    public ReservationResponse reserveSeat(CreateReservationRequest request) {
        request = requirePayload(request);
        UUID dispatchDepartureId = requireUuid(request.dispatchDepartureId(), "dispatchDepartureId");
        String seatNumber = requireText(request.seatNumber(), "seatNumber");
        ReservationPassengerRequest passengerRequest = requirePayload(request.passenger());
        int holdMinutes = normalizeHoldMinutes(request.holdMinutes());
        Instant now = Instant.now();

        expireDueReservations(now);

        SyncedDeparture departure = requireScheduledDeparture(dispatchDepartureId);
        DepartureSeat seat = requireSeatForUpdate(dispatchDepartureId, seatNumber);
        if (seat.status != DepartureSeatStatus.AVAILABLE) {
            throw new ClientErrorException("Seat is not available.", Response.Status.CONFLICT);
        }

        Passenger passenger = passengerService.findOrCreateFromRequest(passengerRequest);
        Instant expiresAt = now.plusSeconds(holdMinutes * 60L);

        Reservation reservation = new Reservation();
        reservation.reservationCode = generateReservationCode();
        reservation.passengerId = passenger.id;
        reservation.dispatchDepartureId = dispatchDepartureId;
        reservation.status = ReservationStatus.PENDING;
        reservation.expiresAt = expiresAt;
        reservation.persist();

        seat.status = DepartureSeatStatus.RESERVED;
        seat.reservationId = reservation.id;
        seat.passengerId = passenger.id;
        seat.holdExpiresAt = expiresAt;

        UUID eventId = persistOutboxEvent(
                "SeatReserved",
                "reservation",
                reservation.id,
                reservedPayload(reservation, seat, departure, passenger, now));

        return toResponse(reservation, seat, eventId);
    }

    @Transactional
    public ReservationResponse reservation(UUID reservationId) {
        if (reservationId == null) {
            throw new BadRequestException("Field is required: reservationId.");
        }

        Reservation reservation = Reservation.findById(reservationId);
        if (reservation == null) {
            throw new NotFoundException("Reservation was not found.");
        }

        DepartureSeat seat = DepartureSeat
                .<DepartureSeat>find("reservationId = ?1", reservation.id)
                .firstResult();

        return toResponse(reservation, seat, null);
    }

    @Transactional
    public ExpiredReservationsResponse expireDueReservations(ExpireReservationsRequest request) {
        Instant expiredBefore = request == null || request.expiredBefore() == null
                ? Instant.now()
                : request.expiredBefore();
        return expireDueReservations(expiredBefore);
    }

    @Transactional
    public ExpiredReservationsResponse expireDueReservations(Instant expiredBefore) {
        Instant threshold = expiredBefore == null ? Instant.now() : expiredBefore;
        List<Reservation> reservations = Reservation
                .<Reservation>find("status = ?1 and expiresAt <= ?2 order by expiresAt",
                        ReservationStatus.PENDING,
                        threshold)
                .withLock(LockModeType.PESSIMISTIC_WRITE)
                .list();

        List<UUID> expiredIds = new ArrayList<>();
        Instant now = Instant.now();

        for (Reservation reservation : reservations) {
            DepartureSeat seat = DepartureSeat
                    .<DepartureSeat>find("reservationId = ?1", reservation.id)
                    .withLock(LockModeType.PESSIMISTIC_WRITE)
                    .firstResult();

            reservation.status = ReservationStatus.EXPIRED;
            expiredIds.add(reservation.id);

            if (seat != null && seat.status == DepartureSeatStatus.RESERVED) {
                seat.status = DepartureSeatStatus.AVAILABLE;
                seat.reservationId = null;
                seat.passengerId = null;
                seat.holdExpiresAt = null;
            }

            persistOutboxEvent(
                    "SeatReservationExpired",
                    "reservation",
                    reservation.id,
                    expiredPayload(reservation, seat, now));
        }

        return new ExpiredReservationsResponse(threshold, expiredIds.size(), List.copyOf(expiredIds));
    }

    private SyncedDeparture requireScheduledDeparture(UUID dispatchDepartureId) {
        SyncedDeparture departure = SyncedDeparture
                .<SyncedDeparture>find("dispatchDepartureId = ?1", dispatchDepartureId)
                .firstResult();
        if (departure == null) {
            throw new NotFoundException("Departure was not found in ticketing read model.");
        }
        if (departure.status != SyncedDepartureStatus.SCHEDULED) {
            throw new ClientErrorException("Departure is not available for reservations.", Response.Status.CONFLICT);
        }
        return departure;
    }

    private DepartureSeat requireSeatForUpdate(UUID dispatchDepartureId, String seatNumber) {
        DepartureSeat seat = DepartureSeat
                .<DepartureSeat>find("dispatchDepartureId = ?1 and seatNumber = ?2", dispatchDepartureId, seatNumber)
                .withLock(LockModeType.PESSIMISTIC_WRITE)
                .firstResult();
        if (seat == null) {
            throw new NotFoundException("Seat was not found for this departure.");
        }
        return seat;
    }

    private int normalizeHoldMinutes(Integer holdMinutes) {
        int normalized = holdMinutes == null ? defaultHoldMinutes : holdMinutes;
        if (normalized < 1) {
            throw new BadRequestException("holdMinutes must be greater than or equal to 1.");
        }
        if (normalized > maxHoldMinutes) {
            throw new BadRequestException("holdMinutes must be less than or equal to " + maxHoldMinutes + ".");
        }
        return normalized;
    }

    private UUID persistOutboxEvent(
            String eventType,
            String aggregateType,
            UUID aggregateId,
            Map<String, Object> payload) {
        UUID eventId = UUID.randomUUID();
        payload.put("event_id", eventId.toString());

        OutboxEvent event = new OutboxEvent();
        event.eventId = eventId;
        event.eventType = eventType;
        event.aggregateType = aggregateType;
        event.aggregateId = aggregateId;
        event.payload = payload;
        event.persist();
        return eventId;
    }

    private Map<String, Object> reservedPayload(
            Reservation reservation,
            DepartureSeat seat,
            SyncedDeparture departure,
            Passenger passenger,
            Instant occurredAt) {
        Map<String, Object> payload = eventEnvelope("SeatReserved", occurredAt);
        payload.put("reservation_id", reservation.id.toString());
        payload.put("reservation_code", reservation.reservationCode);
        payload.put("dispatch_departure_id", reservation.dispatchDepartureId.toString());
        payload.put("departure_at", departure.departureAt.toString());
        payload.put("route_name", departure.routeName);
        payload.put("seat_number", seat.seatNumber);
        payload.put("departure_seat_id", seat.id.toString());
        payload.put("passenger_id", passenger.id.toString());
        payload.put("expires_at", reservation.expiresAt.toString());
        return payload;
    }

    private Map<String, Object> expiredPayload(
            Reservation reservation,
            DepartureSeat seat,
            Instant occurredAt) {
        Map<String, Object> payload = eventEnvelope("SeatReservationExpired", occurredAt);
        payload.put("reservation_id", reservation.id.toString());
        payload.put("reservation_code", reservation.reservationCode);
        payload.put("dispatch_departure_id", reservation.dispatchDepartureId.toString());
        payload.put("seat_number", seat == null ? null : seat.seatNumber);
        payload.put("departure_seat_id", seat == null ? null : seat.id.toString());
        payload.put("expired_at", occurredAt.toString());
        return payload;
    }

    private Map<String, Object> eventEnvelope(String eventType, Instant occurredAt) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("event_type", eventType);
        payload.put("schema_version", 1);
        payload.put("occurred_at", occurredAt.toString());
        payload.put("source_service", "ticketing-service");
        payload.put("correlation_id", UUID.randomUUID().toString());
        return payload;
    }

    private ReservationResponse toResponse(Reservation reservation, DepartureSeat seat, UUID eventId) {
        return new ReservationResponse(
                reservation.id,
                reservation.reservationCode,
                reservation.passengerId,
                reservation.dispatchDepartureId,
                seat == null ? null : seat.id,
                seat == null ? null : seat.seatNumber,
                reservation.status,
                reservation.expiresAt,
                seat == null ? null : seat.status,
                eventId);
    }

    private static String generateReservationCode() {
        return "RSV-" + UUID.randomUUID().toString().replace("-", "").substring(0, 12).toUpperCase();
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
}
