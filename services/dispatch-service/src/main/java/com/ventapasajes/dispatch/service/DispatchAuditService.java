package com.ventapasajes.dispatch.service;

import java.util.UUID;

import com.fasterxml.jackson.databind.ObjectMapper;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;

@ApplicationScoped
public class DispatchAuditService {

    @Inject
    Instance<EntityManager> entityManager;

    @Inject
    ObjectMapper objectMapper;

    public void record(AuditContext context, String eventType, String resourceType, UUID resourceId, Object payload) {
        try {
            String payloadJson = objectMapper.writeValueAsString(payload);
            UUID correlationId = context == null || context.correlationId() == null
                    ? UUID.randomUUID()
                    : context.correlationId();
            UUID actorUserId = context == null ? null : context.actorUserId();

            entityManager.get().createNativeQuery("""
                    INSERT INTO outbox_events (
                        event_type,
                        correlation_id,
                        actor_user_id,
                        resource_type,
                        resource_id,
                        payload
                    )
                    VALUES (?1, ?2, ?3, ?4, ?5, CAST(?6 AS jsonb))
                    """)
                    .setParameter(1, eventType)
                    .setParameter(2, correlationId)
                    .setParameter(3, actorUserId)
                    .setParameter(4, resourceType)
                    .setParameter(5, resourceId == null ? null : resourceId.toString())
                    .setParameter(6, payloadJson)
                    .executeUpdate();
        } catch (Exception exception) {
            throw new IllegalStateException("Could not record dispatch audit event.", exception);
        }
    }
}
