package com.ventapasajes.report.engine;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.util.LinkedHashMap;
import java.util.Map;

import com.fasterxml.jackson.databind.JsonNode;
import com.ventapasajes.report.api.ReportServiceException;
import com.ventapasajes.report.domain.OutputFormat;
import com.ventapasajes.report.persistence.entity.ReportTemplateVersion;

import jakarta.enterprise.context.ApplicationScoped;
import org.jboss.logging.Logger;
import org.jxls.builder.JxlsStreaming;
import org.jxls.transform.poi.JxlsPoi;

@ApplicationScoped
public class JxlsExcelTemplateEngine implements TemplateEngine {
    private static final Logger LOG = Logger.getLogger(JxlsExcelTemplateEngine.class);

    @Override
    public GeneratedReport generate(ReportTemplateVersion template, JsonNode parameters, OutputFormat format, String fileName) {
        if (format != OutputFormat.XLSX) throw new ReportServiceException(422, "UNSUPPORTED_OUTPUT_FORMAT", "Una plantilla XLSX solo puede generar XLSX.");
        byte[] adaptedContent = LegacyJxlsTemplateAdapter.adapt(template.blob.content);
        try (InputStream input = new ByteArrayInputStream(adaptedContent); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            Map<String, Object> variables = new LinkedHashMap<>();
            if (parameters != null && parameters.isObject()) {
                var fields = parameters.fields();
                while (fields.hasNext()) {
                    var field = fields.next();
                    variables.put(field.getKey(), jsonValue(field.getValue()));
                }
            }
            JxlsPoi.fill(input, JxlsStreaming.AUTO_DETECT, variables, output);
            return new GeneratedReport(output.toByteArray(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", fileName);
        } catch (Exception error) {
            LOG.error("No se pudo procesar la plantilla XLSX con JXLS.", error);
            throw new ReportServiceException(422, "TEMPLATE_RENDER_FAILED", "No se pudo procesar la plantilla XLSX con JXLS.");
        }
    }

    private Object jsonValue(JsonNode node) {
        if (node == null || node.isNull()) return null;
        if (node.isTextual()) return node.textValue();
        if (node.isBoolean()) return node.booleanValue();
        if (node.isIntegralNumber()) return node.longValue();
        if (node.isFloatingPointNumber()) return node.doubleValue();
        if (node.isArray()) return node.valueStream().map(this::jsonValue).toList();
        if (node.isObject()) {
            Map<String, Object> values = new java.util.LinkedHashMap<>();
            node.fields().forEachRemaining(field -> values.put(field.getKey(), jsonValue(field.getValue())));
            return values;
        }
        return node.asText();
    }
}
