package com.ventapasajes.ticketing.persistence.entity;

import java.time.Instant;
import java.util.UUID;

import com.ventapasajes.ticketing.domain.SyncedDepartureStatus;
import com.ventapasajes.ticketing.persistence.AuditablePanacheEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;

@Entity
@Table(name = "synced_departures")
public class SyncedDeparture extends AuditablePanacheEntity {

    @Column(name = "dispatch_departure_id", nullable = false, unique = true)
    public UUID dispatchDepartureId;

    @Column(name = "legacy_id")
    public Integer legacyId;

    @Column(name = "bus_id", nullable = false)
    public UUID busId;

    @Column(name = "bus_code", nullable = false, length = 80)
    public String busCode;

    @Column(name = "bus_plate", length = 40)
    public String busPlate;

    @Column(name = "route_id", nullable = false)
    public UUID routeId;

    @Column(name = "route_name", nullable = false, length = 240)
    public String routeName;

    @Column(name = "origin_terminal_id", nullable = false)
    public UUID originTerminalId;

    @Column(name = "origin_terminal_name", nullable = false, length = 240)
    public String originTerminalName;

    @Column(name = "destination_terminal_id", nullable = false)
    public UUID destinationTerminalId;

    @Column(name = "destination_terminal_name", nullable = false, length = 240)
    public String destinationTerminalName;

    @Column(name = "departure_at", nullable = false)
    public Instant departureAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 24)
    public SyncedDepartureStatus status = SyncedDepartureStatus.SCHEDULED;

    @Column(name = "seat_count", nullable = false)
    public Integer seatCount;

    @Column(name = "source_updated_at")
    public Instant sourceUpdatedAt;

    @Column(name = "synced_at", nullable = false)
    public Instant syncedAt = Instant.now();
}
