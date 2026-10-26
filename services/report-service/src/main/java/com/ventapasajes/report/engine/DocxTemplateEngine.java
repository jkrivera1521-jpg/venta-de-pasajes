package com.ventapasajes.report.engine;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.util.HashMap;
import java.util.Map;

import com.fasterxml.jackson.databind.JsonNode;
import com.ventapasajes.report.api.ReportServiceException;
import com.ventapasajes.report.domain.OutputFormat;
import com.ventapasajes.report.persistence.entity.ReportTemplateVersion;

import org.docx4j.Docx4J;
import org.docx4j.convert.out.FOSettings;
import org.docx4j.model.datastorage.migration.VariablePrepare;
import org.docx4j.openpackaging.packages.WordprocessingMLPackage;

import jakarta.enterprise.context.ApplicationScoped;
import org.jboss.logging.Logger;

@ApplicationScoped
public class DocxTemplateEngine implements TemplateEngine {
    private static final Logger LOG = Logger.getLogger(DocxTemplateEngine.class);

    @Override
    public GeneratedReport generate(ReportTemplateVersion template, JsonNode parameters, OutputFormat format, String fileName) {
        if (format != OutputFormat.DOCX && format != OutputFormat.PDF) throw new ReportServiceException(422, "UNSUPPORTED_OUTPUT_FORMAT", "Una plantilla DOCX solo puede generar DOCX o PDF.");
        try {
            byte[] adaptedContent = LegacyDocxTemplateAdapter.adapt(template.blob.content, parameters);
            WordprocessingMLPackage document = WordprocessingMLPackage.load(new ByteArrayInputStream(adaptedContent));
            VariablePrepare.prepare(document);
            document.getMainDocumentPart().variableReplace(flatten(parameters));
            if (format == OutputFormat.DOCX) {
                ByteArrayOutputStream output = new ByteArrayOutputStream();
                document.save(output);
                return new GeneratedReport(output.toByteArray(), "application/vnd.openxmlformats-officedocument.wordprocessingml.document", fileName);
            }
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            FOSettings settings = Docx4J.createFOSettings();
            // setOpcPackage initializes docx4j's FOP configuration; setWmlPackage only stores the package.
            settings.setOpcPackage(document);
            settings.setApacheFopMime(FOSettings.MIME_PDF);
            Docx4J.toFO(settings, output, Docx4J.FLAG_EXPORT_PREFER_XSL);
            return new GeneratedReport(output.toByteArray(), "application/pdf", fileName);
        } catch (Exception error) {
            LOG.error("No se pudo procesar la plantilla DOCX.", error);
            throw new ReportServiceException(422, "TEMPLATE_RENDER_FAILED", "No se pudo procesar la plantilla DOCX.");
        }
    }

    private Map<String, String> flatten(JsonNode node) {
        Map<String, String> result = new HashMap<>();
        if (node != null && node.isObject()) node.fields().forEachRemaining(field -> flatten(field.getKey(), field.getValue(), result));
        return result;
    }

    private void flatten(String prefix, JsonNode node, Map<String, String> result) {
        if (node == null || node.isNull()) { result.put(prefix, ""); return; }
        if (node.isValueNode()) { result.put(prefix, node.asText()); return; }
        if (node.isObject()) node.fields().forEachRemaining(field -> flatten(prefix + "." + field.getKey(), field.getValue(), result));
        else if (node.isArray()) { result.put(prefix, node.toString()); }
    }
}
