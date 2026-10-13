package com.ventapasajes.dispatch.persistence.entity;

import java.time.Instant;
import java.util.UUID;

import com.ventapasajes.dispatch.domain.DepartureStatus;
import com.ventapasajes.dispatch.persistence.AuditablePanacheEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "departures")
public class Departure extends AuditablePanacheEntity {

    @Column(name = "legacy_id", unique = true)
    public Integer legacyId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "bus_id", nullable = false)
    public Bus bus;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "route_id", nullable = false)
    public DispatchRoute route;

    @Column(name = "departure_at", nullable = false)
    public Instant departureAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    public DepartureStatus status = DepartureStatus.SCHEDULED;

    public String notes;

    @Column(name = "created_by_user_id")
    public UUID createdByUserId;

    @Column(name = "cancelled_by_user_id")
    public UUID cancelledByUserId;

    @Column(name = "cancellation_reason")
    public String cancellationReason;

    @Column(name = "cancelled_at")
    public Instant cancelledAt;
}
