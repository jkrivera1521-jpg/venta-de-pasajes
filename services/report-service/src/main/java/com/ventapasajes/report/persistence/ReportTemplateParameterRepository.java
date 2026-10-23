package com.ventapasajes.report.persistence;

import java.util.List;
import java.util.UUID;

import com.ventapasajes.report.persistence.entity.ReportTemplateParameter;
import com.ventapasajes.report.persistence.entity.ReportTemplateVersion;

import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import jakarta.enterprise.context.ApplicationScoped;

@ApplicationScoped
public class ReportTemplateParameterRepository implements PanacheRepositoryBase<ReportTemplateParameter, UUID> {

    public List<ReportTemplateParameter> listByVersion(ReportTemplateVersion version) {
        return list("templateVersion = ?1 order by path", version);
    }
}
