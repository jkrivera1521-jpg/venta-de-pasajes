package com.ventapasajes.dispatch.persistence.entity;

import com.ventapasajes.dispatch.persistence.AuditablePanacheEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

@Entity
@Table(name = "bus_types")
public class BusType extends AuditablePanacheEntity {

    @Column(name = "legacy_id", unique = true)
    public Integer legacyId;

    @Column(nullable = false, columnDefinition = "citext", unique = true)
    public String name;

    public String description;

    @Column(nullable = false)
    public boolean active = true;
}
