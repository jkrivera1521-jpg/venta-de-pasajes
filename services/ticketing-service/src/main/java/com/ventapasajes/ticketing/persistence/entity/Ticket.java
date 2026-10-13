package com.ventapasajes.ticketing.persistence.entity;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

import com.ventapasajes.ticketing.domain.TicketStatus;
import com.ventapasajes.ticketing.persistence.AuditablePanacheEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;

@Entity
@Table(name = "tickets")
public class Ticket extends AuditablePanacheEntity {

    @Column(name = "legacy_id", unique = true)
    public Integer legacyId;

    @Column(name = "ticket_number", nullable = false, unique = true, length = 40)
    public String ticketNumber;

    @Column(name = "passenger_id", nullable = false)
    public UUID passengerId;

    @Column(name = "reservation_id")
    public UUID reservationId;

    @Column(name = "departure_seat_id", nullable = false)
    public UUID departureSeatId;

    @Column(name = "dispatch_departure_id", nullable = false)
    public UUID dispatchDepartureId;

    @Column(name = "origin_terminal_id")
    public UUID originTerminalId;

    @Column(name = "destination_terminal_id")
    public UUID destinationTerminalId;

    @Column(name = "seat_number", nullable = false, length = 12)
    public String seatNumber;

    @Column(name = "fare_amount", nullable = false, precision = 12, scale = 2)
    public BigDecimal fareAmount;

    @Column(nullable = false, length = 3)
    public String currency = "USD";

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 24)
    public TicketStatus status = TicketStatus.ISSUED;

    @Column(name = "issued_at", nullable = false)
    public Instant issuedAt = Instant.now();

    @Column(name = "cancelled_at")
    public Instant cancelledAt;

    @Column(name = "cancellation_reason", length = 500)
    public String cancellationReason;

    @Column(name = "cancelled_by", length = 120)
    public String cancelledBy;
}
