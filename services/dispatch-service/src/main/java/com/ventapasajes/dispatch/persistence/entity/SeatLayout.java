package com.ventapasajes.dispatch.persistence.entity;

import com.ventapasajes.dispatch.persistence.AuditablePanacheEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

@Entity
@Table(name = "seat_layouts")
public class SeatLayout extends AuditablePanacheEntity {

    @Column(nullable = false, columnDefinition = "citext", unique = true)
    public String name;

    @Column(name = "seat_count", nullable = false)
    public Integer seatCount;

    @Column(nullable = false)
    public boolean active = true;
}
