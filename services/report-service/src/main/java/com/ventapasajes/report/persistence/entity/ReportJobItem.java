package com.ventapasajes.report.persistence.entity;

import java.time.Instant;
import java.util.UUID;

import com.fasterxml.jackson.databind.JsonNode;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "report_job_item")
public class ReportJobItem {

    @Id
    public UUID id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "job_id", nullable = false)
    public ReportJob job;

    @Column(name = "item_index", nullable = false)
    public int itemIndex;

    @Column(name = "file_name", nullable = false, length = 180)
    public String fileName;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, columnDefinition = "jsonb")
    public JsonNode data;

    @Column(nullable = false, length = 16)
    public String status = "PENDING";

    @Column(name = "error_message", columnDefinition = "text")
    public String errorMessage;

    @Column(name = "generated_size")
    public Long generatedSize;

    @Column(name = "created_at", nullable = false)
    public Instant createdAt;
}
