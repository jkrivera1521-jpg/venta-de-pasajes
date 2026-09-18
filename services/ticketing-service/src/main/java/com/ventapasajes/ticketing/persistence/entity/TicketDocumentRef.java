package com.ventapasajes.ticketing.persistence.entity;

import java.time.Instant;
import java.util.UUID;

import com.ventapasajes.ticketing.domain.TicketDocumentStatus;
import com.ventapasajes.ticketing.persistence.AuditablePanacheEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;

@Entity
@Table(name = "ticket_document_refs")
public class TicketDocumentRef extends AuditablePanacheEntity {

    @Column(name = "ticket_id", nullable = false, unique = true)
    public UUID ticketId;

    @Column(name = "ticket_number", nullable = false, length = 40)
    public String ticketNumber;

    @Column(name = "source_event_id", nullable = false, unique = true)
    public UUID sourceEventId;

    @Column(name = "document_id")
    public UUID documentId;

    @Column(name = "document_event_id")
    public UUID documentEventId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 24)
    public TicketDocumentStatus status = TicketDocumentStatus.PENDING;

    @Column(name = "storage_provider", length = 24)
    public String storageProvider;

    @Column(name = "storage_uri")
    public String storageUri;

    @Column(name = "download_url")
    public String downloadUrl;

    @Column(name = "content_type", length = 80)
    public String contentType;

    @Column(name = "file_name", length = 180)
    public String fileName;

    @Column(name = "checksum_sha256", length = 64)
    public String checksumSha256;

    @Column(name = "size_bytes")
    public Long sizeBytes;

    @Column(nullable = false)
    public int attempts;

    @Column(name = "last_attempt_at")
    public Instant lastAttemptAt;

    @Column(name = "next_attempt_at")
    public Instant nextAttemptAt;

    @Column(name = "failure_reason")
    public String failureReason;

    @Column(name = "generated_at")
    public Instant generatedAt;

    public static TicketDocumentRef findByTicketId(UUID ticketId) {
        return find("ticketId = ?1", ticketId).firstResult();
    }

    public static TicketDocumentRef findBySourceEventId(UUID sourceEventId) {
        return find("sourceEventId = ?1", sourceEventId).firstResult();
    }
}
