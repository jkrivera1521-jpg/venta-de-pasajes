package com.ventapasajes.report.persistence.entity;

import java.time.Instant;
import java.util.UUID;

import com.fasterxml.jackson.databind.JsonNode;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "report_audit_event")
public class ReportAuditEvent {

    @Id
    public UUID id;

    @Column(name = "event_id", nullable = false, unique = true)
    public UUID eventId;

    @Column(nullable = false, length = 80)
    public String action;

    @Column(name = "resource_type", nullable = false, length = 80)
    public String resourceType;

    @Column(name = "resource_id", length = 160)
    public String resourceId;

    @Column(nullable = false, length = 160)
    public String actor;

    @Column(name = "correlation_id", nullable = false)
    public UUID correlationId;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, columnDefinition = "jsonb")
    public JsonNode metadata;

    @Column(name = "occurred_at", nullable = false)
    public Instant occurredAt;
}
