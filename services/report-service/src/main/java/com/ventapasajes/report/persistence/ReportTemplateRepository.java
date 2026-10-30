package com.ventapasajes.report.persistence;

import java.util.List;
import java.util.UUID;

import com.ventapasajes.report.domain.TemplateStatus;
import com.ventapasajes.report.persistence.entity.ReportTemplate;

import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import jakarta.enterprise.context.ApplicationScoped;

@ApplicationScoped
public class ReportTemplateRepository implements PanacheRepositoryBase<ReportTemplate, UUID> {

    public ReportTemplate findByCode(String code) {
        return find("code = ?1 and status <> ?2", code, TemplateStatus.DELETED).firstResult();
    }

    public ReportTemplate findByCodeIncludingDeleted(String code) {
        return find("code = ?1", code).firstResult();
    }

    public List<ReportTemplate> listVisible() {
        return list("status <> ?1 order by code", TemplateStatus.DELETED);
    }
}
