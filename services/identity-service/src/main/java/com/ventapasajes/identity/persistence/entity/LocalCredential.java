package com.ventapasajes.identity.persistence.entity;

import java.time.Instant;
import java.util.UUID;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

@Entity
@Table(name = "local_credentials")
public class LocalCredential extends PanacheEntityBase {

    @Id
    @Column(name = "user_id", nullable = false)
    public UUID userId;

    @Column(name = "password_hash")
    public String passwordHash;

    @Column(name = "password_algorithm", nullable = false)
    public String passwordAlgorithm = "PBKDF2WithHmacSHA256";

    @Column(name = "temporary_password", nullable = false)
    public boolean temporaryPassword;

    @Column(name = "must_change_password", nullable = false)
    public boolean mustChangePassword = true;

    @Column(name = "created_at", nullable = false, updatable = false)
    public Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    public Instant updatedAt;

    @PrePersist
    void prePersist() {
        Instant now = Instant.now();
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = Instant.now();
    }
}
