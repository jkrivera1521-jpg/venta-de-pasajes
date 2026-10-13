package com.ventapasajes.audit.service;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ventapasajes.audit.api.dto.AuditEventPageResponse;
import com.ventapasajes.audit.api.dto.AuditEventRequest;
import com.ventapasajes.audit.api.dto.AuditEventResponse;
import com.ventapasajes.audit.api.dto.AuditIngestResponse;
import com.ventapasajes.audit.api.dto.PageMetaResponse;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.NotFoundException;

@ApplicationScoped
public class AuditEventService {

    private static final int DEFAULT_PAGE = 1;
    private static final int DEFAULT_PAGE_SIZE = 25;
    private static final int MAX_PAGE_SIZE = 100;

    @Inject
    Instance<EntityManager> entityManager;

    @Inject
    ObjectMapper objectMapper;

    @Transactional
    public AuditIngestResponse record(String idempotencyKey, AuditEventRequest request) {
        AuditEventRequest payload = requirePayload(request);
        UUID eventId = requireUuid(payload.eventId(), "eventId");
        String sourceService = requireText(payload.sourceService(), "sourceService");
        String eventType = requireText(payload.eventType(), "eventType");
        String action = normalizeNullable(payload.action());
        if (action == null) {
            action = deriveAction(eventType);
        }

        AuditEventResponse existing = findBySourceEventId(eventId);
        if (existing != null && sourceService.equals(existing.sourceService())) {
            persistProcessedEvent(sourceService, eventId, eventType, payload.schemaVersion(), existing.correlationId(), "IGNORED", null);
            return new AuditIngestResponse(eventId, "DUPLICATE", false, existing);
        }

        int schemaVersion = normalizeSchemaVersion(payload.schemaVersion());
        Instant occurredAt = payload.occurredAt() == null ? Instant.now() : payload.occurredAt();
        UUID correlationId = payload.correlationId() == null ? UUID.randomUUID() : payload.correlationId();
        String normalizedIdempotencyKey = normalizeNullable(idempotencyKey);
        if (normalizedIdempotencyKey == null) {
            normalizedIdempotencyKey = sourceService + ":" + eventId;
        }

        String payloadJson = toJson(payload.payload() == null ? objectMapper.createObjectNode() : payload.payload());
        String rawEventJson = toJson(payload);

        entityManager.get().createNativeQuery("""
                INSERT INTO audit_events (
                    source_service,
                    source_event_id,
                    event_type,
                    schema_version,
                    occurred_at,
                    correlation_id,
                    causation_id,
                    actor_user_id,
                    action,
                    resource_type,
                    resource_id,
                    idempotency_key,
                    payload,
                    raw_event
                )
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, CAST(?13 AS jsonb), CAST(?14 AS jsonb))
                """)
                .setParameter(1, sourceService)
                .setParameter(2, eventId)
                .setParameter(3, eventType)
                .setParameter(4, schemaVersion)
                .setParameter(5, occurredAt)
                .setParameter(6, correlationId)
                .setParameter(7, payload.causationId())
                .setParameter(8, payload.actorUserId())
                .setParameter(9, action)
                .setParameter(10, normalizeNullable(payload.resourceType()))
                .setParameter(11, normalizeNullable(payload.resourceId()))
                .setParameter(12, normalizedIdempotencyKey)
                .setParameter(13, payloadJson)
                .setParameter(14, rawEventJson)
                .executeUpdate();

        persistProcessedEvent(sourceService, eventId, eventType, schemaVersion, correlationId, "PROCESSED", null);
        persistOutboxEvent(payload, eventId, correlationId, action, normalizedIdempotencyKey, payloadJson);

        AuditEventResponse response = getByEventId(eventId);
        return new AuditIngestResponse(eventId, "PROCESSED", true, response);
    }

    public AuditEventResponse getByEventId(UUID eventId) {
        AuditEventResponse response = findBySourceEventId(requireUuid(eventId, "eventId"));
        if (response == null) {
            throw new NotFoundException("Audit event was not found.");
        }
        return response;
    }

    public AuditEventPageResponse search(
            String occurredFrom,
            String occurredTo,
            UUID actorUserId,
            String resourceType,
            String resourceId,
            String action,
            UUID correlationId,
            Integer page,
            Integer pageSize) {
        int normalizedPage = normalizePage(page);
        int normalizedPageSize = normalizePageSize(pageSize);
        int offset = (normalizedPage - 1) * normalizedPageSize;

        QueryParts queryParts = buildSearchQuery(
                occurredFrom,
                occurredTo,
                actorUserId,
                resourceType,
                resourceId,
                action,
                correlationId);

        Query dataQuery = entityManager.get().createNativeQuery("""
                SELECT
                    source_event_id,
                    event_type,
                    schema_version,
                    occurred_at,
                    ingested_at,
                    source_service,
                    correlation_id,
                    causation_id,
                    actor_user_id,
                    action,
                    resource_type,
                    resource_id,
                    idempotency_key,
                    payload::text,
                    raw_event::text
                FROM audit_events
                """ + queryParts.whereClause() + """
                ORDER BY occurred_at DESC, ingested_at DESC
                LIMIT :limit OFFSET :offset
                """);
        bindParameters(dataQuery, queryParts);
        dataQuery.setParameter("limit", normalizedPageSize);
        dataQuery.setParameter("offset", offset);

        @SuppressWarnings("unchecked")
        List<Object[]> rows = dataQuery.getResultList();
        List<AuditEventResponse> data = rows.stream()
                .map(this::toResponse)
                .toList();

        Query countQuery = entityManager.get().createNativeQuery("SELECT count(*) FROM audit_events " + queryParts.whereClause());
        bindParameters(countQuery, queryParts);
        long totalItems = ((Number) countQuery.getSingleResult()).longValue();
        long totalPages = totalItems == 0 ? 0 : (long) Math.ceil((double) totalItems / normalizedPageSize);

        return new AuditEventPageResponse(
                data,
                new PageMetaResponse(normalizedPage, normalizedPageSize, totalItems, totalPages));
    }

    private AuditEventResponse findBySourceEventId(UUID eventId) {
        @SuppressWarnings("unchecked")
        List<Object[]> rows = entityManager.get().createNativeQuery("""
                SELECT
                    source_event_id,
                    event_type,
                    schema_version,
                    occurred_at,
                    ingested_at,
                    source_service,
                    correlation_id,
                    causation_id,
                    actor_user_id,
                    action,
                    resource_type,
                    resource_id,
                    idempotency_key,
                    payload::text,
                    raw_event::text
                FROM audit_events
                WHERE source_event_id = ?1
                ORDER BY ingested_at DESC
                LIMIT 1
                """)
                .setParameter(1, eventId)
                .getResultList();
        return rows.isEmpty() ? null : toResponse(rows.get(0));
    }

    private void persistProcessedEvent(
            String sourceService,
            UUID eventId,
            String eventType,
            Integer schemaVersion,
            UUID correlationId,
            String status,
            String error) {
        entityManager.get().createNativeQuery("""
                INSERT INTO processed_events (
                    source_service,
                    event_id,
                    event_type,
                    schema_version,
                    consumer_name,
                    correlation_id,
                    status,
                    error
                )
                VALUES (?1, ?2, ?3, ?4, 'audit-service', ?5, ?6, ?7)
                ON CONFLICT (source_service, event_id, consumer_name) DO NOTHING
                """)
                .setParameter(1, sourceService)
                .setParameter(2, eventId)
                .setParameter(3, eventType)
                .setParameter(4, normalizeSchemaVersion(schemaVersion))
                .setParameter(5, correlationId)
                .setParameter(6, status)
                .setParameter(7, error)
                .executeUpdate();
    }

    private void persistOutboxEvent(
            AuditEventRequest request,
            UUID eventId,
            UUID correlationId,
            String action,
            String idempotencyKey,
            String payloadJson) {
        entityManager.get().createNativeQuery("""
                INSERT INTO outbox_events (
                    event_type,
                    schema_version,
                    correlation_id,
                    causation_id,
                    actor_user_id,
                    resource_type,
                    resource_id,
                    idempotency_key,
                    payload
                )
                VALUES ('AuditEventCreated', 1, ?1, ?2, ?3, ?4, ?5, ?6, jsonb_build_object(
                    'source_event_id', ?7,
                    'action', ?8,
                    'payload', CAST(?9 AS jsonb)
                ))
                """)
                .setParameter(1, correlationId)
                .setParameter(2, request.causationId())
                .setParameter(3, request.actorUserId())
                .setParameter(4, normalizeNullable(request.resourceType()))
                .setParameter(5, normalizeNullable(request.resourceId()))
                .setParameter(6, idempotencyKey)
                .setParameter(7, eventId)
                .setParameter(8, action)
                .setParameter(9, payloadJson)
                .executeUpdate();
    }

    private QueryParts buildSearchQuery(
            String occurredFrom,
            String occurredTo,
            UUID actorUserId,
            String resourceType,
            String resourceId,
            String action,
            UUID correlationId) {
        List<String> conditions = new ArrayList<>();
        List<QueryParameter> parameters = new ArrayList<>();

        Instant from = parseInstant(occurredFrom, "occurred_from");
        if (from != null) {
            conditions.add("occurred_at >= :occurredFrom");
            parameters.add(new QueryParameter("occurredFrom", from));
        }

        Instant to = parseInstant(occurredTo, "occurred_to");
        if (to != null) {
            conditions.add("occurred_at <= :occurredTo");
            parameters.add(new QueryParameter("occurredTo", to));
        }

        if (actorUserId != null) {
            conditions.add("actor_user_id = :actorUserId");
            parameters.add(new QueryParameter("actorUserId", actorUserId));
        }

        String normalizedResourceType = normalizeNullable(resourceType);
        if (normalizedResourceType != null) {
            conditions.add("resource_type = :resourceType");
            parameters.add(new QueryParameter("resourceType", normalizedResourceType));
        }

        String normalizedResourceId = normalizeNullable(resourceId);
        if (normalizedResourceId != null) {
            conditions.add("resource_id = :resourceId");
            parameters.add(new QueryParameter("resourceId", normalizedResourceId));
        }

        String normalizedAction = normalizeNullable(action);
        if (normalizedAction != null) {
            conditions.add("action = :action");
            parameters.add(new QueryParameter("action", normalizedAction));
        }

        if (correlationId != null) {
            conditions.add("correlation_id = :correlationId");
            parameters.add(new QueryParameter("correlationId", correlationId));
        }

        String whereClause = conditions.isEmpty() ? "" : " WHERE " + String.join(" AND ", conditions) + " ";
        return new QueryParts(whereClause, parameters);
    }

    private static void bindParameters(Query query, QueryParts queryParts) {
        for (QueryParameter parameter : queryParts.parameters()) {
            query.setParameter(parameter.name(), parameter.value());
        }
    }

    private AuditEventResponse toResponse(Object[] row) {
        return new AuditEventResponse(
                toUuid(row[0]),
                toStringValue(row[1]),
                ((Number) row[2]).intValue(),
                toInstant(row[3]),
                toInstant(row[4]),
                toStringValue(row[5]),
                toUuid(row[6]),
                toUuid(row[7]),
                toUuid(row[8]),
                toStringValue(row[9]),
                toStringValue(row[10]),
                toStringValue(row[11]),
                toStringValue(row[12]),
                readJson(row[13]),
                readJson(row[14]));
    }

    private JsonNode readJson(Object value) {
        if (value == null) {
            return objectMapper.createObjectNode();
        }
        try {
            return objectMapper.readTree(value.toString());
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Could not parse audit JSON payload.", exception);
        }
    }

    private String toJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException exception) {
            throw new BadRequestException("Could not serialize audit payload.");
        }
    }

    private static AuditEventRequest requirePayload(AuditEventRequest request) {
        if (request == null) {
            throw new BadRequestException("Request body is required.");
        }
        return request;
    }

    private static UUID requireUuid(UUID value, String fieldName) {
        if (value == null) {
            throw new BadRequestException("Field is required: " + fieldName + ".");
        }
        return value;
    }

    private static String requireText(String value, String fieldName) {
        String normalized = normalizeNullable(value);
        if (normalized == null) {
            throw new BadRequestException("Field is required: " + fieldName + ".");
        }
        return normalized;
    }

    private static int normalizeSchemaVersion(Integer schemaVersion) {
        if (schemaVersion == null) {
            return 1;
        }
        if (schemaVersion < 1) {
            throw new BadRequestException("schemaVersion must be greater than or equal to 1.");
        }
        return schemaVersion;
    }

    private static int normalizePage(Integer page) {
        if (page == null) {
            return DEFAULT_PAGE;
        }
        return Math.max(DEFAULT_PAGE, page);
    }

    private static int normalizePageSize(Integer pageSize) {
        if (pageSize == null) {
            return DEFAULT_PAGE_SIZE;
        }
        return Math.max(1, Math.min(MAX_PAGE_SIZE, pageSize));
    }

    private static Instant parseInstant(String value, String fieldName) {
        String normalized = normalizeNullable(value);
        if (normalized == null) {
            return null;
        }
        try {
            return Instant.parse(normalized);
        } catch (RuntimeException exception) {
            throw new BadRequestException(fieldName + " must be an ISO-8601 instant.");
        }
    }

    private static String deriveAction(String eventType) {
        StringBuilder builder = new StringBuilder();
        for (int i = 0; i < eventType.length(); i++) {
            char character = eventType.charAt(i);
            if (Character.isUpperCase(character) && i > 0) {
                builder.append('.');
            }
            builder.append(Character.toLowerCase(character));
        }
        return builder.toString();
    }

    private static String normalizeNullable(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private static String toStringValue(Object value) {
        return value == null ? null : value.toString();
    }

    private static UUID toUuid(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof UUID uuid) {
            return uuid;
        }
        return UUID.fromString(value.toString());
    }

    private static Instant toInstant(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof Instant instant) {
            return instant;
        }
        if (value instanceof Timestamp timestamp) {
            return timestamp.toInstant();
        }
        if (value instanceof OffsetDateTime offsetDateTime) {
            return offsetDateTime.toInstant();
        }
        return Instant.parse(value.toString());
    }

    private record QueryParts(String whereClause, List<QueryParameter> parameters) {
    }

    private record QueryParameter(String name, Object value) {
    }
}
