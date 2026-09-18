package com.ventapasajes.identity.persistence.entity;

import java.time.Instant;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

@Entity
@Table(name = "permissions")
public class PermissionCatalogItem extends PanacheEntityBase {

    @Id
    @Column(nullable = false)
    public String code;

    @Column(nullable = false)
    public String description;

    @Column(name = "created_at", nullable = false, updatable = false)
    public Instant createdAt;

    @PrePersist
    void prePersist() {
        createdAt = Instant.now();
    }
}
