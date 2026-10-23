package com.ventapasajes.report.persistence.entity;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "report_template_blob")
public class ReportTemplateBlob {
    @Id
    @Column(name = "template_version_id")
    public UUID id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "template_version_id", insertable = false, updatable = false)
    public ReportTemplateVersion templateVersion;

    @Column(nullable = false, columnDefinition = "bytea")
    public byte[] content;

    @Column(name = "created_at", nullable = false)
    public Instant createdAt;
}
