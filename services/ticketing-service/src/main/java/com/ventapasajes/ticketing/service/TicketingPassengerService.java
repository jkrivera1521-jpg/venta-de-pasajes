package com.ventapasajes.ticketing.service;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import com.ventapasajes.ticketing.api.dto.PassengerRequest;
import com.ventapasajes.ticketing.api.dto.PassengerResponse;
import com.ventapasajes.ticketing.api.dto.ReservationPassengerRequest;
import com.ventapasajes.ticketing.api.dto.TicketResponse;
import com.ventapasajes.ticketing.domain.DocumentType;
import com.ventapasajes.ticketing.domain.PassengerStatus;
import com.ventapasajes.ticketing.persistence.entity.Passenger;
import com.ventapasajes.ticketing.persistence.entity.Ticket;

import io.quarkus.hibernate.orm.panache.PanacheQuery;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.persistence.LockModeType;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.ClientErrorException;
import jakarta.ws.rs.NotFoundException;
import jakarta.ws.rs.core.Response;

@ApplicationScoped
public class TicketingPassengerService {

    @Transactional
    public PassengerResponse create(PassengerRequest request) {
        request = requirePayload(request);
        DocumentType documentType = request.documentType() == null ? DocumentType.CEDULA : request.documentType();
        String documentNumber = requireText(request.documentNumber(), "documentNumber");

        Passenger existing = findByDocument(documentType, documentNumber);
        if (existing != null) {
            throw new ClientErrorException("Passenger already exists for this document.", Response.Status.CONFLICT);
        }
        assertEmailIsAvailable(normalizeNullable(request.email()), null);

        Passenger passenger = new Passenger();
        apply(request, passenger, documentType, documentNumber);
        passenger.status = request.status() == null ? PassengerStatus.ACTIVE : request.status();
        passenger.persist();

        return toResponse(passenger);
    }

    @Transactional
    public PassengerResponse update(UUID passengerId, PassengerRequest request) {
        if (passengerId == null) {
            throw new BadRequestException("Field is required: passengerId.");
        }
        request = requirePayload(request);

        Passenger passenger = Passenger.<Passenger>findById(passengerId, LockModeType.PESSIMISTIC_WRITE);
        if (passenger == null) {
            throw new NotFoundException("Passenger was not found.");
        }

        DocumentType documentType = request.documentType() == null ? passenger.documentType : request.documentType();
        String documentNumber = request.documentNumber() == null ? passenger.documentNumber : requireText(request.documentNumber(), "documentNumber");
        Passenger duplicate = findByDocument(documentType, documentNumber);
        if (duplicate != null && !duplicate.id.equals(passenger.id)) {
            throw new ClientErrorException("Passenger already exists for this document.", Response.Status.CONFLICT);
        }
        assertEmailIsAvailable(normalizeNullable(request.email()), passenger.id);

        apply(request, passenger, documentType, documentNumber);
        passenger.status = request.status() == null ? passenger.status : request.status();

        return toResponse(passenger);
    }

    @Transactional
    public PassengerResponse deactivate(UUID passengerId) {
        Passenger passenger = requirePassengerForUpdate(passengerId);
        passenger.status = PassengerStatus.INACTIVE;
        return toResponse(passenger);
    }

    @Transactional
    public PassengerResponse passenger(UUID passengerId) {
        Passenger passenger = requirePassenger(passengerId);
        return toResponse(passenger);
    }

    @Transactional
    public List<PassengerResponse> search(
            DocumentType documentType,
            String documentNumber,
            String query,
            PassengerStatus status) {
        QuerySpec spec = new QuerySpec();

        if (documentType != null) {
            spec.add("documentType = " + spec.bind(documentType));
        }
        if (normalizeNullable(documentNumber) != null) {
            spec.add("documentNumber = " + spec.bind(documentNumber.trim()));
        }
        if (status != null) {
            spec.add("status = " + spec.bind(status));
        }
        String normalizedQuery = normalizeNullable(query);
        if (normalizedQuery != null) {
            String like = "%" + normalizedQuery.toLowerCase() + "%";
            String expression = "(lower(firstName) like " + spec.bind(like)
                    + " or lower(lastName) like " + spec.bind(like)
                    + " or lower(documentNumber) like " + spec.bind(like) + ")";
            spec.add(expression);
        }

        PanacheQuery<Passenger> passengers = Passenger
                .<Passenger>find(spec.query(), spec.params());
        return passengers.list()
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public List<TicketResponse> ticketHistory(UUID passengerId) {
        Passenger passenger = requirePassenger(passengerId);
        return Ticket.<Ticket>find("passengerId = ?1 order by issuedAt desc", passenger.id)
                .list()
                .stream()
                .map(this::toTicketResponse)
                .toList();
    }

    @Transactional
    public Passenger findOrCreateFromRequest(ReservationPassengerRequest request) {
        request = requirePayload(request);
        DocumentType documentType = request.documentType() == null ? DocumentType.CEDULA : request.documentType();
        String documentNumber = requireText(request.documentNumber(), "passenger.documentNumber");

        Passenger passenger = findByDocument(documentType, documentNumber);
        if (passenger == null) {
            passenger = new Passenger();
            passenger.documentType = documentType;
            passenger.documentNumber = documentNumber;
        }

        assertEmailIsAvailable(normalizeNullable(request.email()), passenger.id);

        passenger.firstName = requireText(request.firstName(), "passenger.firstName");
        passenger.lastName = requireText(request.lastName(), "passenger.lastName");
        passenger.email = normalizeNullable(request.email());
        passenger.phone = normalizeNullable(request.phone());
        passenger.status = PassengerStatus.ACTIVE;
        passenger.persist();

        return passenger;
    }

    private void apply(PassengerRequest request, Passenger passenger, DocumentType documentType, String documentNumber) {
        passenger.documentType = documentType;
        passenger.documentNumber = documentNumber;
        passenger.firstName = requireText(request.firstName(), "firstName");
        passenger.lastName = requireText(request.lastName(), "lastName");
        passenger.email = normalizeNullable(request.email());
        passenger.phone = normalizeNullable(request.phone());
    }

    private Passenger findByDocument(DocumentType documentType, String documentNumber) {
        return Passenger
                .<Passenger>find("documentType = ?1 and documentNumber = ?2", documentType, documentNumber)
                .firstResult();
    }

    private void assertEmailIsAvailable(String email, UUID passengerId) {
        if (email == null) {
            return;
        }
        Passenger duplicate = Passenger
                .<Passenger>find("email = ?1", email)
                .firstResult();
        if (duplicate != null && (passengerId == null || !duplicate.id.equals(passengerId))) {
            throw new ClientErrorException("Passenger already exists for this email.", Response.Status.CONFLICT);
        }
    }

    private Passenger requirePassenger(UUID passengerId) {
        if (passengerId == null) {
            throw new BadRequestException("Field is required: passengerId.");
        }
        Passenger passenger = Passenger.findById(passengerId);
        if (passenger == null) {
            throw new NotFoundException("Passenger was not found.");
        }
        return passenger;
    }

    private Passenger requirePassengerForUpdate(UUID passengerId) {
        if (passengerId == null) {
            throw new BadRequestException("Field is required: passengerId.");
        }
        Passenger passenger = Passenger.<Passenger>findById(passengerId, LockModeType.PESSIMISTIC_WRITE);
        if (passenger == null) {
            throw new NotFoundException("Passenger was not found.");
        }
        return passenger;
    }

    private PassengerResponse toResponse(Passenger passenger) {
        long ticketCount = Ticket.count("passengerId = ?1", passenger.id);
        return new PassengerResponse(
                passenger.id,
                passenger.legacyId,
                passenger.documentType,
                passenger.documentNumber,
                passenger.firstName,
                passenger.lastName,
                passenger.email,
                passenger.phone,
                passenger.status,
                ticketCount,
                passenger.createdAt,
                passenger.updatedAt);
    }

    private TicketResponse toTicketResponse(Ticket ticket) {
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
                null);
    }

    private <T> T requirePayload(T payload) {
        if (payload == null) {
            throw new BadRequestException("Request body is required.");
        }
        return payload;
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

        String query() {
            String where = predicates.isEmpty() ? "" : String.join(" and ", predicates);
            String order = " order by lastName, firstName";
            return where + order;
        }

        Object[] params() {
            return params.toArray();
        }
    }
}
