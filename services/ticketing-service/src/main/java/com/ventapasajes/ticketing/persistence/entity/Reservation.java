package com.ventapasajes.ticketing.persistence.entity;

import java.time.Instant;
import java.util.UUID;

import com.ventapasajes.ticketing.domain.ReservationStatus;
import com.ventapasajes.ticketing.persistence.AuditablePanacheEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;

@Entity
@Table(name = "reservations")
public class Reservation extends AuditablePanacheEntity {

    @Column(name = "reservation_code", nullable = false, unique = true, length = 40)
    public String reservationCode;

    @Column(name = "passenger_id", nullable = false)
    public UUID passengerId;

    @Column(name = "dispatch_departure_id", nullable = false)
    public UUID dispatchDepartureId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    public ReservationStatus status = ReservationStatus.PENDING;

    @Column(name = "expires_at", nullable = false)
    public Instant expiresAt;
}
