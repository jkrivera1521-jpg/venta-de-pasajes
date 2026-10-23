package com.ventapasajes.report.service;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.eclipse.microprofile.config.inject.ConfigProperty;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ventapasajes.report.api.ReportServiceException;
import com.ventapasajes.report.api.dto.CreateReportJobRequest;
import com.ventapasajes.report.api.dto.ReportJobResponse;
import com.ventapasajes.report.auth.AuthenticatedUser;
import com.ventapasajes.report.domain.JobStatus;
import com.ventapasajes.report.domain.OutputFormat;
import com.ventapasajes.report.persistence.ReportJobItemRepository;
import com.ventapasajes.report.persistence.ReportJobRepository;
import com.ventapasajes.report.persistence.entity.ReportJob;
import com.ventapasajes.report.persistence.entity.ReportJobItem;
import com.ventapasajes.report.storage.ReportStorageService;
import com.ventapasajes.report.validation.FileNameSanitizer;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.core.Response;

@ApplicationScoped
public class ReportJobService {
    @Inject ReportJobRepository jobs;
    @Inject ReportJobItemRepository items;
    @Inject ObjectMapper objectMapper;
    @Inject FileNameSanitizer fileNames;
    @Inject ReportStorageService storage;
    @Inject ReportAuditService audit;
    @ConfigProperty(name = "app.report.batch.max-documents") int maxDocuments;
    @ConfigProperty(name = "app.report.batch.expiration-hours") int expirationHours;

    @Transactional
    public ReportJobResponse create(CreateReportJobRequest request, AuthenticatedUser user) {
        if (request.documents().size() > maxDocuments) throw new ReportServiceException(413, "BATCH_TOO_LARGE", "El lote supera el numero maximo de documentos.");
        OutputFormat format;
        try { format = OutputFormat.valueOf(request.outputFormat().toUpperCase()); }
        catch (Exception error) { throw new ReportServiceException(Response.Status.BAD_REQUEST, "INVALID_OUTPUT_FORMAT", "El formato de salida no es valido."); }
        ReportJob job = new ReportJob();
        job.id = UUID.randomUUID();
        job.templateCode = request.templateCode();
        job.templateVersion = request.templateVersion();
        job.outputFormat = format;
        job.status = JobStatus.PENDING;
        job.totalItems = request.documents().size();
        job.zipFileName = fileNames.sanitize(request.zipFileName(), request.templateCode().toLowerCase() + "-lote-" + job.id, "zip");
        job.createdBy = user.actor();
        job.createdAt = Instant.now();
        job.expiresAt = job.createdAt.plus(Duration.ofHours(expirationHours));
        jobs.persist(job);
        for (int index = 0; index < request.documents().size(); index++) {
            var document = request.documents().get(index);
            ReportJobItem item = new ReportJobItem();
            item.id = UUID.randomUUID(); item.job = job; item.itemIndex = index;
            item.fileName = document.fileName() == null ? "documento-" + (index + 1) : document.fileName();
            item.data = objectMapper.valueToTree(document.parameters()); item.status = "PENDING"; item.createdAt = job.createdAt;
            items.persist(item);
        }
        audit.record("REPORT_BATCH_CREATED", "REPORT_JOB", job.id.toString(), user.actor(),
                java.util.Map.of("templateCode", job.templateCode, "documents", job.totalItems));
        return response(job);
    }

    @Transactional
    public ReportJobResponse get(UUID id) { return response(require(id)); }

    @Transactional
    public byte[] download(UUID id) {
        ReportJob job = require(id);
        if (job.expiresAt.isBefore(Instant.now()) || job.resultStorageKey == null) throw new ReportServiceException(Response.Status.NOT_FOUND, "RESULT_NOT_FOUND", "El resultado no existe o expiro.");
        return storage.read(job.resultStorageKey);
    }

    @Transactional
    public void cancel(UUID id) {
        ReportJob job = require(id);
        if (job.status == JobStatus.PENDING || job.status == JobStatus.RUNNING) job.status = JobStatus.CANCELLED;
    }

    public ReportJob require(UUID id) { ReportJob job = jobs.findById(id); if (job == null) throw new ReportServiceException(Response.Status.NOT_FOUND, "JOB_NOT_FOUND", "No existe el trabajo solicitado."); return job; }
    public ReportJobResponse response(ReportJob job) { return new ReportJobResponse(job.id, job.templateCode, job.templateVersion, job.outputFormat.name(), job.status.name(), job.totalItems, job.processedItems, job.successfulItems, job.failedItems, job.zipFileName, job.resultStorageKey == null ? null : "/api/v1/report-jobs/" + job.id + "/download", job.errorMessage, job.createdAt, job.completedAt, job.expiresAt); }
}
