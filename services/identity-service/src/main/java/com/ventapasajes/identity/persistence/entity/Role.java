package com.ventapasajes.identity.persistence.entity;

import com.ventapasajes.identity.domain.RoleStatus;
import com.ventapasajes.identity.persistence.AuditablePanacheEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;

@Entity
@Table(name = "roles")
public class Role extends AuditablePanacheEntity {

    @Column(nullable = false)
    public String code;

    @Column(nullable = false)
    public String name;

    public String description;

    @Column(nullable = false)
    public boolean active = true;

    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    public RoleStatus status = RoleStatus.ACTIVE;
}
