package com.ventapasajes.reporting.persistence.entity;

import java.time.Instant;
import java.util.UUID;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

@Entity
@Table(name = "processed_events")
public class ProcessedEvent extends PanacheEntityBase {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    @Column(name = "source_service", nullable = false)
    public String sourceService;

    @Column(name = "event_id", nullable = false)
    public UUID eventId;

    @Column(name = "event_type", nullable = false)
    public String eventType;

    @Column(name = "schema_version", nullable = false)
    public int schemaVersion = 1;

    @Column(name = "consumer_name", nullable = false)
    public String consumerName;

    @Column(name = "correlation_id")
    public UUID correlationId;

    @Column(nullable = false)
    public String status = "PROCESSED";

    @Column(name = "processed_at", nullable = false)
    public Instant processedAt;

    @Column
    public String error;

    @PrePersist
    void prePersist() {
        if (processedAt == null) {
            processedAt = Instant.now();
        }
    }

    public static boolean alreadyProcessed(UUID eventId, String consumerName) {
        return count("eventId = ?1 and consumerName = ?2", eventId, consumerName) > 0;
    }
}
