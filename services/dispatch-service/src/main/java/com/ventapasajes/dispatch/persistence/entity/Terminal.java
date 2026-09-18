package com.ventapasajes.dispatch.persistence.entity;

import java.util.UUID;

import com.ventapasajes.dispatch.persistence.AuditablePanacheEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

@Entity
@Table(name = "terminals")
public class Terminal extends AuditablePanacheEntity {

    @Column(name = "legacy_id", unique = true)
    public Integer legacyId;

    @Column(name = "local_code", columnDefinition = "citext", unique = true)
    public String localCode;

    @Column(nullable = false, columnDefinition = "citext", unique = true)
    public String name;

    @Column(name = "manager_name")
    public String managerName;

    public String address;
    public String phone;

    @Column(columnDefinition = "citext")
    public String email;

    @Column(nullable = false)
    public boolean active = true;

    @Column(name = "created_by_user_id")
    public UUID createdByUserId;
}
