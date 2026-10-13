package com.ventapasajes.dispatch.persistence.entity;

import java.util.UUID;

import com.ventapasajes.dispatch.persistence.AuditablePanacheEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "buses")
public class Bus extends AuditablePanacheEntity {

    @Column(name = "legacy_id", unique = true)
    public Integer legacyId;

    @Column(nullable = false, columnDefinition = "citext", unique = true)
    public String code;

    @Column(nullable = false, columnDefinition = "citext", unique = true)
    public String plate;

    public String description;

    @Column(name = "default_destination")
    public String defaultDestination;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "bus_type_id", nullable = false)
    public BusType busType;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "terminal_id", nullable = false)
    public Terminal terminal;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "seat_layout_id", nullable = false)
    public SeatLayout seatLayout;

    @Column(nullable = false)
    public boolean active = true;

    @Column(name = "created_by_user_id")
    public UUID createdByUserId;
}
