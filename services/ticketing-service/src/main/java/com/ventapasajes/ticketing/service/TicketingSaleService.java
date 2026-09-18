package com.ventapasajes.ticketing.service;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

import com.ventapasajes.ticketing.api.dto.CreateTicketRequest;
import com.ventapasajes.ticketing.api.dto.CancelTicketRequest;
import com.ventapasajes.ticketing.api.dto.ReservationPassengerRequest;
import com.ventapasajes.ticketing.api.dto.TicketResponse;
import com.ventapasajes.ticketing.domain.DepartureSeatStatus;
import com.ventapasajes.ticketing.domain.ReservationStatus;
import com.ventapasajes.ticketing.domain.SyncedDepartureStatus;
import com.ventapasajes.ticketing.domain.TicketStatus;
import com.ventapasajes.ticketing.persistence.entity.DepartureSeat;
import com.ventapasajes.ticketing.persistence.entity.OutboxEvent;
import com.ventapasajes.ticketing.persistence.entity.Passenger;
import com.ventapasajes.ticketing.persistence.entity.Reservation;
import com.ventapasajes.ticketing.persistence.entity.SyncedDeparture;
import com.ventapasajes.ticketing.persistence.entity.Ticket;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.persistence.LockModeType;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.ClientErrorException;
import jakarta.ws.rs.NotFoundException;
import jakarta.ws.rs.core.Response;

@ApplicationScoped
public class TicketingSaleService {

    @Inject
    TicketingReservationService reservationService;

    @Inject
    TicketingPassengerService passengerService;

    @Transactional
    public TicketResponse issueTicket(CreateTicketRequest request) {
        request = requirePayload(request);
        BigDecimal fareAmount = requireFareAmount(request.fareAmount());
        String currency = normalizeCurrency(request.currency());
        Instant now = Instant.now();

        reservationService.expireDueReservations(now);

        IssueContext context = request.reservationId() == null
                ? directSaleContext(request)
                : reservedSaleContext(request);

        Ticket ticket = new Ticket();
        ticket.ticketNumber = generateTicketNumber();
        ticket.passengerId = context.passenger().id;
        ticket.reservationId = context.reservation() == null ? null : context.reservation().id;
        ticket.departureSeatId = context.seat().id;
        ticket.dispatchDepartureId = context.seat().dispatchDepartureId;
        ticket.originTerminalId = context.departure().originTerminalId;
        ticket.destinationTerminalId = context.departure().destinationTerminalId;
        ticket.seatNumber = context.seat().seatNumber;
        ticket.fareAmount = fareAmount;
        ticket.currency = currency;
        ticket.status = TicketStatus.ISSUED;
        ticket.issuedAt = now;
        ticket.persist();

        if (context.reservation() != null) {
            context.reservation().status = ReservationStatus.CONVERTED_TO_TICKET;
        }

        context.seat().status = DepartureSeatStatus.SOLD;
        context.seat().passengerId = context.passenger().id;
        context.seat().reservationId = context.reservation() == null ? null : context.reservation().id;
        context.seat().holdExpiresAt = null;

        UUID eventId = persistOutboxEvent(
                "TicketSold",
                "ticket",
                ticket.id,
                ticketSoldPayload(ticket, context.departure(), context.passenger(), now));

        return toResponse(ticket, eventId);
    }

    @Transactional
    public TicketResponse ticket(UUID ticketId) {
        if (ticketId == null) {
            throw new BadRequestException("Field is required: ticketId.");
        }

        Ticket ticket = Ticket.findById(ticketId);
        if (ticket == null) {
            throw new NotFoundException("Ticket was not found.");
        }

        return toResponse(ticket, null);
    }

    @Transactional
    public TicketResponse cancelTicket(UUID ticketId, CancelTicketRequest request) {
        if (ticketId == null) {
            throw new BadRequestException("Field is required: ticketId.");
        }

        request = requirePayload(request);
        String reason = requireText(request.reason(), "reason");
        String cancelledBy = requireText(request.cancelledBy(), "cancelledBy");
        boolean releaseSeat = request.releaseSeat() == null || request.releaseSeat();
        Instant now = Instant.now();

        Ticket ticket = Ticket.<Ticket>findById(ticketId, LockModeType.PESSIMISTIC_WRITE);
        if (ticket == null) {
            throw new NotFoundException("Ticket was not found.");
        }
        if (ticket.status != TicketStatus.ISSUED) {
            throw new ClientErrorException("Ticket cannot be cancelled from its current status.", Response.Status.CONFLICT);
        }

        DepartureSeat seat = DepartureSeat
                .<DepartureSeat>findById(ticket.departureSeatId, LockModeType.PESSIMISTIC_WRITE);
        if (seat == null) {
            throw new NotFoundException("Ticket seat was not found.");
        }

        ticket.status = TicketStatus.VOIDED;
        ticket.cancelledAt = now;
        ticket.cancellationReason = reason;
        ticket.cancelledBy = cancelledBy;

        boolean seatReleased = false;
        if (releaseSeat && seat.status == DepartureSeatStatus.SOLD) {
            seat.status = DepartureSeatStatus.AVAILABLE;
            seat.passengerId = null;
            seat.reservationId = null;
            seat.holdExpiresAt = null;
            seatReleased = true;
        }

        UUID eventId = persistOutboxEvent(
                "TicketCancelled",
                "ticket",
                ticket.id,
                ticketCancelledPayload(ticket, seat, reason, cancelledBy, seatReleased, now));

        return toResponse(ticket, eventId);
    }

    @Transactional
    public Reservation persistReservationDraft(
            Passenger passenger,
            DepartureSeat seat,
            String reservationCode,
            Instant expiresAt) {

        Objects.requireNonNull(passenger, "passenger must not be null");
        Objects.requireNonNull(seat, "seat must not be null");
        Objects.requireNonNull(reservationCode, "reservationCode must not be null");
        Objects.requireNonNull(expiresAt, "expiresAt must not be null");

        if (passenger.id == null) {
            passenger.persist();
        }
        if (seat.id == null) {
            seat.persist();
        }

        Reservation reservation = new Reservation();
        reservation.reservationCode = reservationCode;
        reservation.passengerId = passenger.id;
        reservation.dispatchDepartureId = seat.dispatchDepartureId;
        reservation.status = ReservationStatus.PENDING;
        reservation.expiresAt = expiresAt;
        reservation.persist();

        seat.passengerId = passenger.id;
        seat.reservationId = reservation.id;
        seat.status = DepartureSeatStatus.RESERVED;

        return reservation;
    }

    @Transactional
    public Ticket persistTicketIssue(
            Passenger passenger,
            DepartureSeat seat,
            Reservation reservation,
            String ticketNumber,
            BigDecimal fareAmount,
            UUID originTerminalId,
            UUID destinationTerminalId) {

        Objects.requireNonNull(passenger, "passenger must not be null");
        Objects.requireNonNull(seat, "seat must not be null");
        Objects.requireNonNull(ticketNumber, "ticketNumber must not be null");
        Objects.requireNonNull(fareAmount, "fareAmount must not be null");

        if (passenger.id == null) {
            passenger.persist();
        }
        if (seat.id == null) {
            seat.persist();
        }

        Ticket ticket = new Ticket();
        ticket.ticketNumber = ticketNumber;
        ticket.passengerId = passenger.id;
        ticket.reservationId = reservation == null ? null : reservation.id;
        ticket.departureSeatId = seat.id;
        ticket.dispatchDepartureId = seat.dispatchDepartureId;
        ticket.originTerminalId = originTerminalId;
        ticket.destinationTerminalId = destinationTerminalId;
        ticket.seatNumber = seat.seatNumber;
        ticket.fareAmount = fareAmount;
        ticket.status = TicketStatus.ISSUED;
        ticket.issuedAt = Instant.now();
        ticket.persist();

        if (reservation != null) {
            reservation.status = ReservationStatus.CONVERTED_TO_TICKET;
        }
        seat.passengerId = passenger.id;
        seat.status = DepartureSeatStatus.SOLD;

        return ticket;
    }

    private IssueContext directSaleContext(CreateTicketRequest request) {
        UUID dispatchDepartureId = requireUuid(request.dispatchDepartureId(), "dispatchDepartureId");
        String seatNumber = requireText(request.seatNumber(), "seatNumber");

        SyncedDeparture departure = requireScheduledDeparture(dispatchDepartureId);
        DepartureSeat seat = requireSeatForUpdate(dispatchDepartureId, seatNumber);
        if (seat.status != DepartureSeatStatus.AVAILABLE) {
            throw new ClientErrorException("Seat is not available for sale.", Response.Status.CONFLICT);
        }

        Passenger passenger = passengerService.findOrCreateFromRequest(requirePayload(request.passenger()));
        return new IssueContext(departure, seat, passenger, null);
    }

    private IssueContext reservedSaleContext(CreateTicketRequest request) {
        Reservation reservation = Reservation
                .<Reservation>findById(request.reservationId(), LockModeType.PESSIMISTIC_WRITE);
        if (reservation == null) {
            throw new NotFoundException("Reservation was not found.");
        }
        if (reservation.status != ReservationStatus.PENDING) {
            throw new ClientErrorException("Reservation is not pending.", Response.Status.CONFLICT);
        }
        if (reservation.expiresAt != null && !reservation.expiresAt.isAfter(Instant.now())) {
            throw new ClientErrorException("Reservation is expired.", Response.Status.CONFLICT);
        }

        SyncedDeparture departure = requireScheduledDeparture(reservation.dispatchDepartureId);
        DepartureSeat seat = DepartureSeat
                .<DepartureSeat>find("reservationId = ?1", reservation.id)
                .withLock(LockModeType.PESSIMISTIC_WRITE)
                .firstResult();
        if (seat == null) {
            throw new NotFoundException("Reserved seat was not found.");
        }
        if (seat.status != DepartureSeatStatus.RESERVED) {
            throw new ClientErrorException("Reserved seat is not available for sale.", Response.Status.CONFLICT);
        }
        if (request.dispatchDepartureId() != null && !request.dispatchDepartureId().equals(reservation.dispatchDepartureId)) {
            throw new BadRequestException("dispatchDepartureId does not match the reservation.");
        }
        if (request.seatNumber() != null && !request.seatNumber().trim().equalsIgnoreCase(seat.seatNumber)) {
            throw new BadRequestException("seatNumber does not match the reservation.");
        }

        Passenger passenger = Passenger.findById(reservation.passengerId);
        if (passenger == null) {
            throw new NotFoundException("Reservation passenger was not found.");
        }

        return new IssueContext(departure, seat, passenger, reservation);
    }

    private SyncedDeparture requireScheduledDeparture(UUID dispatchDepartureId) {
        SyncedDeparture departure = SyncedDeparture
                .<SyncedDeparture>find("dispatchDepartureId = ?1", dispatchDepartureId)
                .firstResult();
        if (departure == null) {
            throw new NotFoundException("Departure was not found in ticketing read model.");
        }
        if (departure.status != SyncedDepartureStatus.SCHEDULED) {
            throw new ClientErrorException("Departure is not available for sale.", Response.Status.CONFLICT);
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

    private Map<String, Object> ticketSoldPayload(
            Ticket ticket,
            SyncedDeparture departure,
            Passenger passenger,
            Instant occurredAt) {
        Map<String, Object> payload = eventEnvelope("TicketSold", occurredAt);
        payload.put("ticket_id", ticket.id.toString());
        payload.put("ticket_number", ticket.ticketNumber);
        payload.put("reservation_id", ticket.reservationId == null ? null : ticket.reservationId.toString());
        payload.put("dispatch_departure_id", ticket.dispatchDepartureId.toString());
        payload.put("departure_at", departure.departureAt.toString());
        payload.put("route_name", departure.routeName);
        payload.put("origin_terminal_id", departure.originTerminalId.toString());
        payload.put("destination_terminal_id", departure.destinationTerminalId.toString());
        payload.put("seat_number", ticket.seatNumber);
        payload.put("departure_seat_id", ticket.departureSeatId.toString());
        payload.put("passenger_id", passenger.id.toString());
        payload.put("fare_amount", ticket.fareAmount);
        payload.put("currency", ticket.currency);
        return payload;
    }

    private Map<String, Object> ticketCancelledPayload(
            Ticket ticket,
            DepartureSeat seat,
            String reason,
            String cancelledBy,
            boolean seatReleased,
            Instant occurredAt) {
        Map<String, Object> payload = eventEnvelope("TicketCancelled", occurredAt);
        payload.put("ticket_id", ticket.id.toString());
        payload.put("ticket_number", ticket.ticketNumber);
        payload.put("reservation_id", ticket.reservationId == null ? null : ticket.reservationId.toString());
        payload.put("dispatch_departure_id", ticket.dispatchDepartureId.toString());
        payload.put("seat_number", ticket.seatNumber);
        payload.put("departure_seat_id", ticket.departureSeatId.toString());
        payload.put("seat_status_after_cancellation", seat.status.name());
        payload.put("seat_released", seatReleased);
        payload.put("reason", reason);
        payload.put("cancelled_by", cancelledBy);
        payload.put("cancelled_at", ticket.cancelledAt.toString());
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

    private TicketResponse toResponse(Ticket ticket, UUID eventId) {
        return new TicketResponse(
                ticket.id,
                ticket.ticketNumber,
                ticket.passengerId,
                ticket.reservationId,
                ticket.dispatchDepartureId,
                ticket.departureSeatId,
                ticket.seatNumber,
                ticket.fareAmount,
                ticket.currency,
                ticket.status,
                ticket.issuedAt,
                ticket.cancelledAt,
                ticket.cancellationReason,
                ticket.cancelledBy,
                eventId);
    }

    private BigDecimal requireFareAmount(BigDecimal fareAmount) {
        if (fareAmount == null) {
            throw new BadRequestException("Field is required: fareAmount.");
        }
        if (fareAmount.signum() < 0) {
            throw new BadRequestException("fareAmount must be greater than or equal to 0.");
        }
        return fareAmount;
    }

    private static String normalizeCurrency(String currency) {
        String normalized = currency == null || currency.isBlank() ? "USD" : currency.trim().toUpperCase();
        if (normalized.length() != 3) {
            throw new BadRequestException("currency must use a three-letter ISO code.");
        }
        return normalized;
    }

    private static String generateTicketNumber() {
        return "TKT-" + UUID.randomUUID().toString().replace("-", "").substring(0, 12).toUpperCase();
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

    private record IssueContext(
            SyncedDeparture departure,
            DepartureSeat seat,
            Passenger passenger,
            Reservation reservation) {
    }
}
