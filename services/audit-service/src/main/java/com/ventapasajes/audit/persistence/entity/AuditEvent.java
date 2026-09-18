package com.ventapasajes.audit.persistence.entity;

import java.util.UUID;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "audit_events")
public class AuditEvent extends PanacheEntityBase {

    @Id
    @Column(nullable = false, updatable = false)
    public UUID id;
}
