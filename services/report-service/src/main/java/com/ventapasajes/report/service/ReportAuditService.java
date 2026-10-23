package com.ventapasajes.report.service;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ventapasajes.report.persistence.ReportAuditEventRepository;
import com.ventapasajes.report.persistence.entity.ReportAuditEvent;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;

/** Persists operational events without storing request payloads or document contents. */
@ApplicationScoped
public class ReportAuditService {
    @Inject ReportAuditEventRepository events;
    @Inject ObjectMapper objectMapper;

    @Transactional
    public void record(String action, String resourceType, String resourceId, String actor, Map<String, ?> metadata) {
        ReportAuditEvent event = new ReportAuditEvent();
        event.id = UUID.randomUUID();
        event.eventId = UUID.randomUUID();
        event.action = action;
        event.resourceType = resourceType;
        event.resourceId = resourceId;
        event.actor = actor == null || actor.isBlank() ? "desconocido" : actor;
        event.correlationId = UUID.randomUUID();
        event.metadata = metadata == null ? objectMapper.createObjectNode() : objectMapper.valueToTree(metadata);
        event.occurredAt = Instant.now();
        events.persist(event);
    }
}
