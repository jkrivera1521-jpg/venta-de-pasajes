package com.ventapasajes.identity.persistence.entity;

import java.time.Instant;
import java.util.UUID;

import com.ventapasajes.identity.persistence.AuditablePanacheEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

@Entity
@Table(name = "google_identities")
public class GoogleIdentity extends AuditablePanacheEntity {

    @Column(name = "user_id", nullable = false)
    public UUID userId;

    @Column(name = "google_subject", nullable = false)
    public String googleSubject;

    @Column(nullable = false)
    public String email;

    @Column(name = "email_verified", nullable = false)
    public boolean emailVerified;

    @Column(name = "linked_at", nullable = false)
    public Instant linkedAt;

    @Column(name = "last_seen_at")
    public Instant lastSeenAt;
}
