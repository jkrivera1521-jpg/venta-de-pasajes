package com.ventapasajes.identity.persistence.entity;

import java.time.Instant;
import java.util.UUID;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "identity_sessions")
public class IdentitySession extends PanacheEntityBase {

    @Id
    @Column(nullable = false, updatable = false)
    public UUID id;

    @Column(name = "user_id", nullable = false)
    public UUID userId;

    @Column(name = "expires_at", nullable = false)
    public Instant expiresAt;

    @Column(name = "last_seen_at", nullable = false)
    public Instant lastSeenAt;

    @Column(name = "revoked_at")
    public Instant revokedAt;

    @Column(name = "user_agent")
    public String userAgent;

    @Column(name = "device_name")
    public String deviceName;

    @Column(name = "ip_address")
    public String ipAddress;

    @Column(name = "created_at", nullable = false, updatable = false)
    public Instant createdAt;
}
