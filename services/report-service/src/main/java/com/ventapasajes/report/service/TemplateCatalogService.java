package com.ventapasajes.report.service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ventapasajes.report.api.ReportServiceException;
import com.ventapasajes.report.api.dto.TemplateParameterResponse;
import com.ventapasajes.report.api.dto.TemplateResponse;
import com.ventapasajes.report.api.dto.TemplateInspectionResponse;
import com.ventapasajes.report.api.dto.TemplateUploadResponse;
import com.ventapasajes.report.api.dto.TemplateVersionResponse;
import com.ventapasajes.report.domain.ParameterDataType;
import com.ventapasajes.report.domain.ParameterSource;
import com.ventapasajes.report.domain.TemplateStatus;
import com.ventapasajes.report.domain.TemplateVersionStatus;
import com.ventapasajes.report.persistence.ReportTemplateParameterRepository;
import com.ventapasajes.report.persistence.ReportTemplateRepository;
import com.ventapasajes.report.persistence.ReportTemplateVersionRepository;
import com.ventapasajes.report.persistence.entity.ReportTemplate;
import com.ventapasajes.report.persistence.entity.ReportTemplateParameter;
import com.ventapasajes.report.persistence.entity.ReportTemplateBlob;
import com.ventapasajes.report.persistence.entity.ReportTemplateVersion;
import com.ventapasajes.report.validation.TemplateFileValidator;
import com.ventapasajes.report.validation.TemplateParameterExtractor;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.core.Response;

@ApplicationScoped
public class TemplateCatalogService {
    @Inject ReportTemplateRepository templates;
    @Inject ReportTemplateVersionRepository versions;
    @Inject ReportTemplateParameterRepository parameters;
    @Inject TemplateFileValidator fileValidator;
    @Inject TemplateParameterExtractor extractor;
    @Inject ObjectMapper objectMapper;
    @Inject ReportAuditService audit;

    @Transactional
    public TemplateUploadResponse upload(String code, String name, String description, Integer requestedVersion,
            boolean activate, String originalName, String contentType, byte[] content, JsonNode declaredSchema, String actor) {
        String normalizedCode = normalizeCode(code);
        if (name == null || name.isBlank()) throw bad("INVALID_TEMPLATE", "El nombre de la plantilla es obligatorio.");
        TemplateFileValidator.ValidatedTemplate file = fileValidator.validate(originalName, contentType, content);
        ReportTemplate template = templates.findByCodeIncludingDeleted(normalizedCode);
        if (template != null && template.status == TemplateStatus.DELETED) {
            throw conflict("TEMPLATE_CODE_RESERVED", "El codigo " + normalizedCode + " pertenece a una plantilla eliminada y no puede reutilizarse. Usa otro codigo o restaura la plantilla desde el flujo administrativo.");
        }
        Instant now = Instant.now();
        boolean newTemplate = template == null;
        if (template == null) {
            template = new ReportTemplate();
            template.id = UUID.randomUUID();
            template.code = normalizedCode;
            template.documentType = file.documentType();
            template.createdAt = now;
            template.createdBy = actor;
        } else if (template.documentType != file.documentType()) {
            throw conflict("TEMPLATE_TYPE_MISMATCH", "El codigo ya existe con otro tipo de documento.");
        }
        template.name = name.trim();
        template.description = description == null ? null : description.trim();
        template.updatedBy = actor;
        template.updatedAt = now;
        template.status = TemplateStatus.DRAFT;
        if (newTemplate) templates.persist(template);

        int nextVersion = requestedVersion == null ? versions.listByTemplate(template).stream().mapToInt(v -> v.version).max().orElse(0) + 1 : requestedVersion;
        if (nextVersion < 1 || versions.findByTemplateAndVersion(template, nextVersion) != null) throw conflict("TEMPLATE_VERSION_EXISTS", "La version solicitada ya existe.");
        if (versions.find("template = ?1 and checksumSha256 = ?2", template, file.checksum()).firstResult() != null) throw conflict("TEMPLATE_DUPLICATE", "La plantilla ya fue registrada con la misma huella.");

        ReportTemplateVersion version = new ReportTemplateVersion();
        version.id = UUID.randomUUID();
        version.template = template;
        version.version = nextVersion;
        version.fileName = originalName == null || originalName.isBlank() ? normalizedCode.toLowerCase(Locale.ROOT) + "." + file.extension() : originalName;
        version.contentType = file.contentType();
        version.fileExtension = file.extension();
        version.fileSize = (long) file.content().length;
        version.checksumSha256 = file.checksum();
        ReportTemplateBlob blob = new ReportTemplateBlob();
        blob.id = version.id;
        blob.templateVersion = version;
        blob.content = file.content();
        blob.createdAt = now;
        version.blob = blob;
        version.status = TemplateVersionStatus.DRAFT;
        version.createdBy = actor;
        version.createdAt = now;
        versions.persist(version);
        TemplateParameterExtractor.Inspection inspection = extractor.inspect(file.extension(), file.content());
        List<TemplateParameterExtractor.ExtractedParameter> discovered = inspection.parameters();
        for (TemplateParameterExtractor.ExtractedParameter parameter : mergeSchema(discovered, declaredSchema)) {
            ReportTemplateParameter entity = new ReportTemplateParameter();
            entity.id = UUID.randomUUID();
            entity.templateVersion = version;
            entity.name = parameter.name();
            entity.path = parameter.path();
            entity.dataType = parameter.dataType();
            entity.required = parameter.required();
            entity.repeated = parameter.repeated();
            entity.collection = parameter.collection();
            entity.defaultValue = parameter.defaultValue() == null ? null : objectMapper.valueToTree(parameter.defaultValue());
            entity.description = parameter.description();
            entity.source = parameter.source();
            entity.createdAt = now;
            parameters.persist(entity);
        }
        if (activate) activateInternal(template, version, actor, now);
        audit.record("TEMPLATE_VERSION_CREATED", "REPORT_TEMPLATE_VERSION", version.id.toString(), actor,
                Map.of("templateCode", template.code, "version", version.version, "activated", activate));
        if (activate) audit.record("TEMPLATE_VERSION_ACTIVATED", "REPORT_TEMPLATE_VERSION", version.id.toString(), actor,
                Map.of("templateCode", template.code, "version", version.version));
        List<TemplateParameterResponse> parameterResponses = parameters.listByVersion(version).stream().map(this::parameterResponse).toList();
        return new TemplateUploadResponse(template.id, template.code, version.version, template.documentType.name(), version.status.name(), version.checksumSha256, parameterResponses, TemplateInspectionResponse.from(inspection.metadata()));
    }

    @Transactional
    public List<TemplateResponse> list() {
        return list(null, null, null, null);
    }

    @Transactional
    public List<TemplateResponse> list(String code, String documentType, String status, Integer version) {
        return templates.listVisible().stream()
                .filter(value -> code == null || code.isBlank() || value.code.equalsIgnoreCase(code))
                .filter(value -> documentType == null || documentType.isBlank() || value.documentType.name().equalsIgnoreCase(documentType))
                .filter(value -> status == null || status.isBlank() || value.status.name().equalsIgnoreCase(status))
                .filter(value -> version == null || value.activeVersion != null && value.activeVersion.equals(version))
                .map(this::templateResponse).toList();
    }

    @Transactional
    public TemplateVersionResponse get(String code, Integer version) {
        ReportTemplate template = requireTemplate(code);
        ReportTemplateVersion selected = version == null ? versions.findActive(template) : versions.findByTemplateAndVersion(template, version);
        if (selected == null) throw notFound("TEMPLATE_VERSION_NOT_FOUND", "No existe una version disponible para la plantilla.");
        return versionResponse(selected);
    }

    @Transactional
    public List<TemplateVersionResponse> listVersions(String code) {
        ReportTemplate template = requireTemplate(code);
        return versions.listByTemplate(template).stream().map(this::versionResponse).toList();
    }

    @Transactional
    public List<TemplateParameterResponse> listParameters(String code, int version) {
        ReportTemplate template = requireTemplate(code);
        ReportTemplateVersion selected = versions.findByTemplateAndVersion(template, version);
        if (selected == null) throw notFound("TEMPLATE_VERSION_NOT_FOUND", "No existe la version solicitada.");
        return parameters.listByVersion(selected).stream().map(this::parameterResponse).toList();
    }

    @Transactional
    public List<TemplateParameterResponse> listActiveParameters(String code) {
        TemplateVersionResponse active = get(code, null);
        return active.parameters();
    }

    @Transactional
    public void activate(String code, int version, String actor) {
        ReportTemplate template = requireTemplate(code);
        ReportTemplateVersion selected = versions.findByTemplateAndVersion(template, version);
        if (selected == null) throw notFound("TEMPLATE_VERSION_NOT_FOUND", "No existe la version solicitada.");
        activateInternal(template, selected, actor, Instant.now());
        audit.record("TEMPLATE_VERSION_ACTIVATED", "REPORT_TEMPLATE_VERSION", selected.id.toString(), actor,
                Map.of("templateCode", template.code, "version", selected.version));
    }

    @Transactional
    public void delete(String code, String actor) {
        ReportTemplate template = requireTemplate(code);
        template.status = TemplateStatus.DELETED;
        template.updatedBy = actor;
        template.updatedAt = Instant.now();
        audit.record("TEMPLATE_DELETED", "REPORT_TEMPLATE", template.id.toString(), actor,
                Map.of("templateCode", template.code));
    }

    @Transactional
    public ReportTemplateVersion requireGenerationVersion(String code, Integer version) {
        ReportTemplate template = requireTemplate(code);
        ReportTemplateVersion selected = version == null ? versions.findActive(template) : versions.findByTemplateAndVersion(template, version);
        if (selected == null) throw notFound("TEMPLATE_INACTIVE", "La plantilla no tiene una version activa disponible.");
        if (version == null && selected.status != TemplateVersionStatus.ACTIVE) throw notFound("TEMPLATE_INACTIVE", "La plantilla no esta activa.");
        return selected;
    }

    public List<ReportTemplateParameter> parametersFor(ReportTemplateVersion version) {
        return parameters.listByVersion(version);
    }

    @Transactional
    public TemplateDownload download(String code, int version) {
        ReportTemplate template = requireTemplate(code);
        ReportTemplateVersion selected = versions.findByTemplateAndVersion(template, version);
        if (selected == null) throw notFound("TEMPLATE_VERSION_NOT_FOUND", "No existe la version solicitada.");
        if (selected.blob == null || selected.blob.content == null) {
            throw notFound("TEMPLATE_CONTENT_NOT_FOUND", "No existe el archivo original de la version solicitada.");
        }
        return new TemplateDownload(selected.fileName, selected.contentType, selected.blob.content);
    }

    public record TemplateDownload(String fileName, String contentType, byte[] content) { }

    private void activateInternal(ReportTemplate template, ReportTemplateVersion selected, String actor, Instant now) {
        ReportTemplateVersion current = versions.findActive(template);
        if (current != null && current != selected) current.status = TemplateVersionStatus.RETIRED;
        selected.status = TemplateVersionStatus.ACTIVE;
        selected.activatedAt = now;
        template.activeVersion = selected.version;
        template.status = TemplateStatus.ACTIVE;
        template.updatedBy = actor;
        template.updatedAt = now;
    }

    private List<TemplateParameterExtractor.ExtractedParameter> mergeSchema(List<TemplateParameterExtractor.ExtractedParameter> discovered, JsonNode schema) {
        Map<String, TemplateParameterExtractor.ExtractedParameter> merged = new java.util.LinkedHashMap<>();
        discovered.forEach(value -> merged.put(value.path(), value));
        if (schema != null && !schema.isArray()) throw bad("INVALID_PARAMETER_SCHEMA", "parameterSchema debe ser un arreglo JSON.");
        if (schema != null) for (JsonNode item : schema) {
            String path = text(item, "path", text(item, "name", ""));
            if (path.isBlank()) continue;
            if (!path.matches("[A-Za-z_][A-Za-z0-9_]*(\\.[A-Za-z_][A-Za-z0-9_]*)*")) throw bad("INVALID_PARAMETER_SCHEMA", "El nombre del parametro no es valido: " + path);
            ParameterDataType type = enumValue(ParameterDataType.class, text(item, "dataType", "UNKNOWN"), ParameterDataType.UNKNOWN);
            merged.put(path, new TemplateParameterExtractor.ExtractedParameter(text(item, "name", path.split("\\.", 2)[0]), path, type, item.path("required").asBoolean(true), item.path("repeated").asBoolean(false), item.path("collection").asBoolean(false), item.get("defaultValue"), text(item, "description", null), ParameterSource.DECLARED));
        }
        return new ArrayList<>(merged.values());
    }

    private TemplateResponse templateResponse(ReportTemplate value) {
        return new TemplateResponse(value.code, value.name, value.description, value.documentType.name(), value.status.name(), value.activeVersion, value.createdBy, value.createdAt, value.updatedAt);
    }

    private TemplateVersionResponse versionResponse(ReportTemplateVersion value) {
        List<TemplateParameterResponse> params = parameters.listByVersion(value).stream().map(this::parameterResponse).toList();
        TemplateParameterExtractor.Inspection inspection = inspectVersion(value);
        return new TemplateVersionResponse(value.template.code, value.version, value.template.name, value.template.description, value.template.documentType.name(), value.fileName, value.contentType, value.fileSize, value.checksumSha256, value.status.name(), value.createdBy, value.createdAt, value.activatedAt, params, TemplateInspectionResponse.from(inspection.metadata()));
    }

    private TemplateParameterExtractor.Inspection inspectVersion(ReportTemplateVersion value) {
        return extractor.inspect(value.fileExtension, value.blob == null ? new byte[0] : value.blob.content);
    }

    private TemplateParameterResponse parameterResponse(ReportTemplateParameter value) {
        return new TemplateParameterResponse(value.name, value.path, value.dataType.name(), value.required, value.repeated, value.collection, value.defaultValue, value.description, value.source.name());
    }

    private ReportTemplate requireTemplate(String code) { ReportTemplate value = templates.findByCode(normalizeCode(code)); if (value == null) throw notFound("TEMPLATE_NOT_FOUND", "No existe la plantilla solicitada."); return value; }
    private String normalizeCode(String value) { if (value == null || !value.matches("[A-Za-z0-9][A-Za-z0-9._-]{1,79}")) throw bad("INVALID_TEMPLATE_CODE", "El codigo debe tener entre 2 y 80 caracteres alfanumericos."); return value.toUpperCase(Locale.ROOT); }
    private String text(JsonNode node, String name, String fallback) { JsonNode value = node.get(name); return value == null || value.isNull() ? fallback : value.asText(); }
    private <T extends Enum<T>> T enumValue(Class<T> type, String value, T fallback) { try { return Enum.valueOf(type, value.toUpperCase(Locale.ROOT)); } catch (Exception error) { return fallback; } }
    private ReportServiceException bad(String code, String detail) { return new ReportServiceException(Response.Status.BAD_REQUEST, code, detail); }
    private ReportServiceException conflict(String code, String detail) { return new ReportServiceException(Response.Status.CONFLICT, code, detail); }
    private ReportServiceException notFound(String code, String detail) { return new ReportServiceException(Response.Status.NOT_FOUND, code, detail); }
}
