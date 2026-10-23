package com.ventapasajes.report.persistence;

import java.util.UUID;

import com.ventapasajes.report.persistence.entity.ReportJob;

import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import jakarta.enterprise.context.ApplicationScoped;

@ApplicationScoped
public class ReportJobRepository implements PanacheRepositoryBase<ReportJob, UUID> {
}
