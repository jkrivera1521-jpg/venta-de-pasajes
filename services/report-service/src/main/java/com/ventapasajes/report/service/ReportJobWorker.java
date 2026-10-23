package com.ventapasajes.report.service;

import java.io.ByteArrayOutputStream;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

import org.eclipse.microprofile.config.inject.ConfigProperty;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ventapasajes.report.api.dto.GenerateReportRequest;
import com.ventapasajes.report.domain.JobStatus;
import com.ventapasajes.report.engine.GeneratedReport;
import com.ventapasajes.report.persistence.ReportJobItemRepository;
import com.ventapasajes.report.persistence.entity.ReportJob;
import com.ventapasajes.report.persistence.entity.ReportJobItem;
import com.ventapasajes.report.storage.ReportStorageService;
import com.ventapasajes.report.validation.FileNameSanitizer;

import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.spi.CDI;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;

@ApplicationScoped
public class ReportJobWorker {
    @Inject ReportJobService jobs;
    @Inject ReportJobItemRepository items;
    @Inject ReportGenerationService generation;
    @Inject ReportStorageService storage;
    @Inject FileNameSanitizer fileNames;
    @Inject ObjectMapper objectMapper;
    @ConfigProperty(name = "app.report.batch.parallelism") int parallelism;
    private ExecutorService executor;

    @PostConstruct
    void init() { executor = Executors.newFixedThreadPool(Math.max(1, parallelism)); }

    public void submit(UUID id) {
        executor.submit(() -> CDI.current().select(ReportJobWorker.class).get().process(id));
    }

    public void process(UUID id) {
        ReportJobWorker self = CDI.current().select(ReportJobWorker.class).get();
        JobSnapshot job = self.start(id);
        if (job == null) return;

        List<String> errors = new ArrayList<>();
        Set<String> entryNames = new HashSet<>();
        try (ByteArrayOutputStream bytes = new ByteArrayOutputStream(); ZipOutputStream zip = new ZipOutputStream(bytes)) {
            int index = 0;
            for (ItemSnapshot item : self.loadItems(id)) {
                if (self.isCancelled(id)) {
                    self.finishCancelled(id);
                    return;
                }
                try {
                    GeneratedReport result = generation.generate(
                            new GenerateReportRequest(job.templateCode(), job.templateVersion(), job.outputFormat(),
                                    objectMapper.convertValue(item.data(), java.util.Map.class), item.fileName()),
                            job.createdBy());
                    String extension = result.fileName().substring(result.fileName().lastIndexOf('.') + 1);
                    String entryName = uniqueEntry(fileNames.zipEntry(result.fileName(), index++, extension), entryNames);
                    zip.putNextEntry(new ZipEntry(entryName));
                    zip.write(result.content());
                    zip.closeEntry();
                    self.markItemCompleted(id, item.id(), result.content().length);
                } catch (RuntimeException error) {
                    self.markItemFailed(id, item.id(), error.getMessage());
                    errors.add(item.itemIndex() + ": " + (error.getMessage() == null ? "Error de generacion." : error.getMessage()));
                }
            }
            if (self.isCancelled(id)) {
                self.finishCancelled(id);
                return;
            }
            if (!errors.isEmpty()) {
                zip.putNextEntry(new ZipEntry("errors.json"));
                zip.write(objectMapper.writeValueAsBytes(errors));
                zip.closeEntry();
            }
            zip.finish();
            String key = "jobs/" + id + "/" + job.zipFileName();
            storage.store(key, bytes.toByteArray(), "application/zip");
            self.finishCompleted(id, key, errors.isEmpty() ? null : "Algunos documentos no pudieron generarse.");
        } catch (Exception error) {
            self.finishFailed(id, "No se pudo completar el lote.");
        }
    }

    @Transactional
    JobSnapshot start(UUID id) {
        ReportJob job = jobs.require(id);
        if (job.status == JobStatus.CANCELLED || job.status != JobStatus.PENDING) return null;
        job.status = JobStatus.RUNNING;
        job.startedAt = java.time.Instant.now();
        return new JobSnapshot(job.templateCode, job.templateVersion, job.outputFormat.name(), job.zipFileName, job.createdBy);
    }

    @Transactional
    List<ItemSnapshot> loadItems(UUID id) {
        ReportJob job = jobs.require(id);
        return items.listByJob(job).stream()
                .map(item -> new ItemSnapshot(item.id, item.itemIndex, item.fileName, item.data))
                .toList();
    }

    @Transactional
    boolean isCancelled(UUID id) {
        return jobs.require(id).status == JobStatus.CANCELLED;
    }

    @Transactional
    void markItemCompleted(UUID jobId, UUID itemId, long size) {
        ReportJob job = jobs.require(jobId);
        if (job.status == JobStatus.CANCELLED) return;
        ReportJobItem item = items.findById(itemId);
        if (item == null || "COMPLETED".equals(item.status)) return;
        item.status = "COMPLETED";
        item.generatedSize = size;
        job.processedItems++;
        job.successfulItems++;
    }

    @Transactional
    void markItemFailed(UUID jobId, UUID itemId, String message) {
        ReportJob job = jobs.require(jobId);
        if (job.status == JobStatus.CANCELLED) return;
        ReportJobItem item = items.findById(itemId);
        if (item == null || "FAILED".equals(item.status)) return;
        item.status = "FAILED";
        item.errorMessage = message;
        job.processedItems++;
        job.failedItems++;
    }

    @Transactional
    void finishCompleted(UUID id, String key, String message) {
        ReportJob job = jobs.require(id);
        if (job.status == JobStatus.CANCELLED) return;
        job.resultStorageKey = key;
        job.errorMessage = message;
        job.status = job.successfulItems == 0 ? JobStatus.FAILED : JobStatus.COMPLETED;
        job.completedAt = java.time.Instant.now();
    }

    @Transactional
    void finishFailed(UUID id, String message) {
        ReportJob job = jobs.require(id);
        if (job.status == JobStatus.CANCELLED) return;
        job.status = JobStatus.FAILED;
        job.errorMessage = message;
        job.completedAt = java.time.Instant.now();
    }

    @Transactional
    void finishCancelled(UUID id) {
        ReportJob job = jobs.require(id);
        job.status = JobStatus.CANCELLED;
        job.completedAt = java.time.Instant.now();
    }

    private String uniqueEntry(String candidate, Set<String> names) {
        if (names.add(candidate)) return candidate;
        int dot = candidate.lastIndexOf('.');
        String base = dot > 0 ? candidate.substring(0, dot) : candidate;
        String extension = dot > 0 ? candidate.substring(dot) : "";
        int suffix = 2;
        String unique;
        do { unique = base + "-" + suffix++ + extension; } while (!names.add(unique));
        return unique;
    }

    @PreDestroy
    void close() { if (executor != null) executor.shutdownNow(); }

    private record JobSnapshot(String templateCode, Integer templateVersion, String outputFormat, String zipFileName, String createdBy) { }
    private record ItemSnapshot(UUID id, int itemIndex, String fileName, JsonNode data) { }
}
