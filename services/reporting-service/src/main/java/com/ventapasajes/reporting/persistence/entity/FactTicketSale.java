package com.ventapasajes.reporting.persistence.entity;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

@Entity
@Table(name = "fact_ticket_sales")
public class FactTicketSale extends PanacheEntityBase {

    @Id
    @Column(name = "ticket_id", nullable = false, updatable = false)
    public UUID ticketId;

    @Column(name = "legacy_id")
    public Integer legacyId;

    @Column(name = "ticket_number", nullable = false)
    public String ticketNumber;

    @Column(name = "departure_id", nullable = false)
    public UUID departureId;

    @Column(name = "route_id")
    public UUID routeId;

    @Column(name = "origin_terminal_id")
    public UUID originTerminalId;

    @Column(name = "destination_terminal_id")
    public UUID destinationTerminalId;

    @Column(name = "passenger_id")
    public UUID passengerId;

    @Column(name = "passenger_name")
    public String passengerName;

    @Column(name = "passenger_document_type")
    public String passengerDocumentType;

    @Column(name = "passenger_document_number")
    public String passengerDocumentNumber;

    @Column(name = "seat_number")
    public Integer seatNumber;

    @Column(name = "seat_position")
    public String seatPosition;

    @Column(nullable = false, precision = 12, scale = 2)
    public BigDecimal price = BigDecimal.ZERO;

    @Column(nullable = false, length = 3)
    public String currency = "USD";

    @Column(name = "payment_method")
    public String paymentMethod;

    @Column(nullable = false)
    public String status = "SOLD";

    @Column(name = "sold_at", nullable = false)
    public Instant soldAt;

    @Column(name = "sold_by_user_id")
    public UUID soldByUserId;

    @Column(name = "seller_display_name")
    public String sellerDisplayName;

    @Column(name = "cancelled_at")
    public Instant cancelledAt;

    @Column(name = "cancelled_by_user_id")
    public UUID cancelledByUserId;

    @Column(name = "cancellation_reason")
    public String cancellationReason;

    @Column(name = "refund_amount", precision = 12, scale = 2)
    public BigDecimal refundAmount;

    @Column(name = "bus_code")
    public String busCode;

    @Column(name = "bus_type")
    public String busType;

    @Column(name = "origin")
    public String origin;

    @Column(name = "destination")
    public String destination;

    @Column(name = "departure_at")
    public Instant departureAt;

    @Column(name = "last_event_id")
    public UUID lastEventId;

    @Column(name = "updated_at", nullable = false)
    public Instant updatedAt;

    @PrePersist
    @PreUpdate
    void touch() {
        updatedAt = Instant.now();
    }
}
