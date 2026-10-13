package com.ventapasajes.dispatch.persistence.entity;

import com.ventapasajes.dispatch.persistence.AuditablePanacheEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

@Entity
@Table(
        name = "routes",
        uniqueConstraints = @UniqueConstraint(columnNames = {"origin_terminal_id", "destination_terminal_id"}))
public class DispatchRoute extends AuditablePanacheEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "origin_terminal_id", nullable = false)
    public Terminal originTerminal;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "destination_terminal_id", nullable = false)
    public Terminal destinationTerminal;

    @Column(nullable = false)
    public String name;

    @Column(nullable = false)
    public boolean active = true;
}
