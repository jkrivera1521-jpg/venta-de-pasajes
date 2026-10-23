package com.ventapasajes.report.persistence;

import java.util.UUID;

import com.ventapasajes.report.persistence.entity.ReportAuditEvent;

import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import jakarta.enterprise.context.ApplicationScoped;

@ApplicationScoped
public class ReportAuditEventRepository implements PanacheRepositoryBase<ReportAuditEvent, UUID> {
}
