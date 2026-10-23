package com.ventapasajes.report.persistence.entity;

import java.time.Instant;
import java.util.UUID;

import com.ventapasajes.report.domain.TemplateVersionStatus;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import jakarta.persistence.OneToOne;

@Entity
@Table(name = "report_template_version", uniqueConstraints = {
        @UniqueConstraint(name = "uk_report_template_version", columnNames = { "template_id", "version" }),
        @UniqueConstraint(name = "uk_report_template_checksum", columnNames = { "template_id", "checksum_sha256" })
})
public class ReportTemplateVersion {

    @Id
    public UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "template_id", nullable = false)
    public ReportTemplate template;

    @Column(nullable = false)
    public Integer version;

    @Column(name = "file_name", nullable = false, length = 180)
    public String fileName;

    @Column(name = "content_type", nullable = false, length = 120)
    public String contentType;

    @Column(name = "file_extension", nullable = false, length = 8)
    public String fileExtension;

    @Column(name = "file_size", nullable = false)
    public Long fileSize;

    @Column(name = "checksum_sha256", nullable = false, length = 64)
    public String checksumSha256;

    @OneToOne(mappedBy = "templateVersion", fetch = FetchType.EAGER, cascade = jakarta.persistence.CascadeType.ALL, optional = false)
    public ReportTemplateBlob blob;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    public TemplateVersionStatus status = TemplateVersionStatus.DRAFT;

    @Column(name = "created_by", nullable = false, length = 160)
    public String createdBy;

    @Column(name = "created_at", nullable = false)
    public Instant createdAt;

    @Column(name = "activated_at")
    public Instant activatedAt;
}
