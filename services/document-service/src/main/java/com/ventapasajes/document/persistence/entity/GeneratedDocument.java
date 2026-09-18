package com.ventapasajes.document.persistence.entity;

import java.time.Instant;
import java.util.UUID;

import com.ventapasajes.document.domain.DocumentStatus;
import com.ventapasajes.document.domain.DocumentType;
import com.ventapasajes.document.persistence.AuditablePanacheEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;

@Entity
@Table(name = "documents")
public class GeneratedDocument extends AuditablePanacheEntity {

    @Enumerated(EnumType.STRING)
    @Column(name = "owner_type", nullable = false, length = 24)
    public DocumentType ownerType;

    @Column(name = "owner_id", nullable = false)
    public UUID ownerId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 24)
    public DocumentType type;

    @Column(name = "template_code", nullable = false, length = 80)
    public String templateCode;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 24)
    public DocumentStatus status = DocumentStatus.PENDING;

    @Column(name = "storage_provider", nullable = false, length = 24)
    public String storageProvider = "local";

    @Column(name = "storage_uri")
    public String storageUri;

    @Column(name = "content_type", length = 80)
    public String contentType;

    @Column(name = "file_name", length = 180)
    public String fileName;

    @Column(name = "checksum_sha256", length = 64)
    public String checksumSha256;

    @Column(name = "size_bytes")
    public Long sizeBytes;

    @Column(name = "requested_by_user_id")
    public UUID requestedByUserId;

    @Column(name = "correlation_id")
    public UUID correlationId;

    @Column(name = "ticket_number", length = 60)
    public String ticketNumber;

    @Column(name = "passenger_name", length = 240)
    public String passengerName;

    @Column(name = "route_name", length = 240)
    public String routeName;

    @Column(name = "generated_at")
    public Instant generatedAt;

    @Column(name = "failure_reason")
    public String failureReason;

    public static GeneratedDocument findTicketDocument(UUID ticketId) {
        return find("ownerType = ?1 and ownerId = ?2 and type = ?3", DocumentType.TICKET, ticketId, DocumentType.TICKET)
                .firstResult();
    }
}
