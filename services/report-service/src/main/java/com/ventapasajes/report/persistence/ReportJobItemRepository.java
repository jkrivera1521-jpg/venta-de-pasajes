package com.ventapasajes.report.persistence;

import java.util.List;
import java.util.UUID;

import com.ventapasajes.report.persistence.entity.ReportJob;
import com.ventapasajes.report.persistence.entity.ReportJobItem;

import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import jakarta.enterprise.context.ApplicationScoped;

@ApplicationScoped
public class ReportJobItemRepository implements PanacheRepositoryBase<ReportJobItem, UUID> {

    public List<ReportJobItem> listByJob(ReportJob job) {
        return list("job = ?1 order by itemIndex", job);
    }
}
