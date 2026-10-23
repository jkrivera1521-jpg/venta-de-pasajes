package com.ventapasajes.report.persistence.entity;

import java.time.Instant;
import java.util.UUID;

import com.ventapasajes.report.domain.JobStatus;
import com.ventapasajes.report.domain.OutputFormat;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "report_job")
public class ReportJob {

    @Id
    public UUID id;

    @Column(name = "template_code", nullable = false, length = 80)
    public String templateCode;

    @Column(name = "template_version")
    public Integer templateVersion;

    @Enumerated(EnumType.STRING)
    @Column(name = "output_format", nullable = false, length = 8)
    public OutputFormat outputFormat;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    public JobStatus status = JobStatus.PENDING;

    @Column(name = "total_items", nullable = false)
    public int totalItems;

    @Column(name = "processed_items", nullable = false)
    public int processedItems;

    @Column(name = "successful_items", nullable = false)
    public int successfulItems;

    @Column(name = "failed_items", nullable = false)
    public int failedItems;

    @Column(name = "result_storage_key", length = 500)
    public String resultStorageKey;

    @Column(name = "zip_file_name", nullable = false, length = 180)
    public String zipFileName;

    @Column(name = "error_message", columnDefinition = "text")
    public String errorMessage;

    @Column(name = "created_by", nullable = false, length = 160)
    public String createdBy;

    @Column(name = "created_at", nullable = false)
    public Instant createdAt;

    @Column(name = "started_at")
    public Instant startedAt;

    @Column(name = "completed_at")
    public Instant completedAt;

    @Column(name = "expires_at", nullable = false)
    public Instant expiresAt;
}
