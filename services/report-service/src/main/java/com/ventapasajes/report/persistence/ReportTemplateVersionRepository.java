package com.ventapasajes.report.persistence;

import java.util.List;
import java.util.UUID;

import com.ventapasajes.report.domain.TemplateVersionStatus;
import com.ventapasajes.report.persistence.entity.ReportTemplate;
import com.ventapasajes.report.persistence.entity.ReportTemplateVersion;

import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import jakarta.enterprise.context.ApplicationScoped;

@ApplicationScoped
public class ReportTemplateVersionRepository implements PanacheRepositoryBase<ReportTemplateVersion, UUID> {

    public ReportTemplateVersion findByTemplateAndVersion(ReportTemplate template, int version) {
        return find("template = ?1 and version = ?2", template, version).firstResult();
    }

    public ReportTemplateVersion findActive(ReportTemplate template) {
        return find("template = ?1 and status = ?2", template, TemplateVersionStatus.ACTIVE).firstResult();
    }

    public List<ReportTemplateVersion> listByTemplate(ReportTemplate template) {
        return list("template = ?1 order by version desc", template);
    }
}
