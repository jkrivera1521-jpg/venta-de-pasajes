package com.ventapasajes.ticketing.persistence.entity;

import java.time.Instant;
import java.util.UUID;

import com.ventapasajes.ticketing.domain.DepartureSeatStatus;
import com.ventapasajes.ticketing.persistence.AuditablePanacheEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;

@Entity
@Table(name = "departure_seats")
public class DepartureSeat extends AuditablePanacheEntity {

    @Column(name = "dispatch_departure_id", nullable = false)
    public UUID dispatchDepartureId;

    @Column(name = "seat_number", nullable = false, length = 12)
    public String seatNumber;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 24)
    public DepartureSeatStatus status = DepartureSeatStatus.AVAILABLE;

    @Column(name = "reservation_id")
    public UUID reservationId;

    @Column(name = "passenger_id")
    public UUID passengerId;

    @Column(name = "hold_expires_at")
    public Instant holdExpiresAt;
}
