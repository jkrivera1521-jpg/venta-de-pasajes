package com.ventapasajes.report.persistence.entity;

import java.time.Instant;
import java.util.UUID;

import com.fasterxml.jackson.databind.JsonNode;
import com.ventapasajes.report.domain.ParameterDataType;
import com.ventapasajes.report.domain.ParameterSource;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "report_template_parameter")
public class ReportTemplateParameter {

    @Id
    public UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "template_version_id", nullable = false)
    public ReportTemplateVersion templateVersion;

    @Column(nullable = false, length = 120)
    public String name;

    @Column(nullable = false, length = 240)
    public String path;

    @Enumerated(EnumType.STRING)
    @Column(name = "data_type", nullable = false, length = 24)
    public ParameterDataType dataType;

    @Column(nullable = false)
    public boolean required;

    @Column(nullable = false)
    public boolean repeated;

    @Column(nullable = false)
    public boolean collection;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "default_value", columnDefinition = "jsonb")
    public JsonNode defaultValue;

    @Column(columnDefinition = "text")
    public String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    public ParameterSource source;

    @Column(name = "created_at", nullable = false)
    public Instant createdAt;
}
