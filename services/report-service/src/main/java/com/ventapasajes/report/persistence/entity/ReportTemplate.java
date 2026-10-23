package com.ventapasajes.report.persistence.entity;

import java.time.Instant;
import java.util.UUID;

import com.ventapasajes.report.domain.DocumentType;
import com.ventapasajes.report.domain.TemplateStatus;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "report_template")
public class ReportTemplate {

    @Id
    public UUID id;

    @Column(nullable = false, unique = true, length = 80)
    public String code;

    @Column(nullable = false, length = 180)
    public String name;

    @Column(columnDefinition = "text")
    public String description;

    @Enumerated(EnumType.STRING)
    @Column(name = "document_type", nullable = false, length = 8)
    public DocumentType documentType;

    @Column(name = "active_version")
    public Integer activeVersion;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    public TemplateStatus status = TemplateStatus.DRAFT;

    @Column(name = "created_by", nullable = false, length = 160)
    public String createdBy;

    @Column(name = "created_at", nullable = false)
    public Instant createdAt;

    @Column(name = "updated_by", nullable = false, length = 160)
    public String updatedBy;

    @Column(name = "updated_at", nullable = false)
    public Instant updatedAt;

    @Column(name = "deleted_at")
    public Instant deletedAt;
}
