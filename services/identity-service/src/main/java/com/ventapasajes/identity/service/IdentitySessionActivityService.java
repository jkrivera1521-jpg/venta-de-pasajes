package com.ventapasajes.identity.service;

import java.time.Instant;
import java.util.UUID;

import com.ventapasajes.identity.persistence.entity.IdentitySession;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.transaction.Transactional;

@ApplicationScoped
public class IdentitySessionActivityService {

    @Transactional
    public void touch(UUID sessionId) {
        if (sessionId == null) {
            return;
        }
        IdentitySession session = IdentitySession.findById(sessionId);
        if (session != null && session.revokedAt == null && session.expiresAt.isAfter(Instant.now())) {
            session.lastSeenAt = Instant.now();
        }
    }
}
