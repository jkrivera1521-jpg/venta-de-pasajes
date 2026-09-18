package com.ventapasajes.identity.persistence.entity;

import java.util.UUID;

import com.ventapasajes.identity.domain.AuthorizedIdentityType;
import com.ventapasajes.identity.persistence.AuditablePanacheEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;

@Entity
@Table(name = "authorized_identities")
public class AuthorizedIdentity extends AuditablePanacheEntity {

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    public AuthorizedIdentityType type;

    @Column(nullable = false)
    public String value;

    @Column(nullable = false)
    public boolean active = true;

    @Column(name = "created_by_user_id")
    public UUID createdByUserId;
}
