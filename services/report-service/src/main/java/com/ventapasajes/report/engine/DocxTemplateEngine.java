package com.ventapasajes.report.engine;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.util.HashMap;
import java.util.Map;

import com.fasterxml.jackson.databind.JsonNode;
import com.ventapasajes.report.api.ReportServiceException;
import com.ventapasajes.report.domain.OutputFormat;
import com.ventapasajes.report.domain.TemplateFeature;
import com.ventapasajes.report.persistence.entity.ReportTemplateVersion;
import com.ventapasajes.report.validation.JsonToXmlConverter;
import com.ventapasajes.report.validation.DynamicImageValidator;
import com.ventapasajes.report.validation.TemplateParameterExtractor;

import org.docx4j.Docx4J;
import org.docx4j.Docx4jProperties;
import org.docx4j.convert.out.FOSettings;
import org.docx4j.fonts.IdentityPlusMapper;
import org.docx4j.model.datastorage.migration.VariablePrepare;
import org.docx4j.model.fields.merge.DataFieldName;
import org.docx4j.model.fields.merge.MailMerger;
import org.docx4j.openpackaging.parts.JaxbXmlPart;
import org.docx4j.openpackaging.parts.Part;
import org.docx4j.openpackaging.parts.WordprocessingML.FooterPart;
import org.docx4j.openpackaging.parts.WordprocessingML.HeaderPart;
import org.docx4j.openpackaging.parts.WordprocessingML.MainDocumentPart;
import org.docx4j.openpackaging.packages.WordprocessingMLPackage;
import org.docx4j.toc.TocGenerator;

import jakarta.enterprise.context.ApplicationScoped;
import org.jboss.logging.Logger;

@ApplicationScoped
public class DocxTemplateEngine implements TemplateEngine {
    private static final Logger LOG = Logger.getLogger(DocxTemplateEngine.class);
    private final TemplateParameterExtractor extractor = new TemplateParameterExtractor();
    private final JsonToXmlConverter jsonToXml = new JsonToXmlConverter();
    private final RichTextTemplateProcessor richText = new RichTextTemplateProcessor();
    private final DynamicImageValidator images = new DynamicImageValidator();
    private final ChartTemplateProcessor charts = new ChartTemplateProcessor();

    @Override
    public GeneratedReport generate(ReportTemplateVersion template, JsonNode parameters, OutputFormat format, String fileName) {
        if (format != OutputFormat.DOCX && format != OutputFormat.PDF) throw new ReportServiceException(422, "UNSUPPORTED_OUTPUT_FORMAT", "Una plantilla DOCX solo puede generar DOCX o PDF.");
        try {
            byte[] adaptedContent = OpenDopeTemplateAdapter.repair(
                    LegacyDocxTemplateAdapter.adapt(template.blob.content, parameters));
            TemplateParameterExtractor.Inspection inspection = extractor.inspect("docx", adaptedContent);
            JsonNode normalizedParameters = images.normalize(parameters, inspection.parameters());
            adaptedContent = charts.apply(adaptedContent, normalizedParameters);
            WordprocessingMLPackage document = WordprocessingMLPackage.load(new ByteArrayInputStream(adaptedContent));
            document.setFontMapper(new IdentityPlusMapper());
            if (inspection.metadata().isOpenDope()) {
                if (inspection.metadata().xmlRoot() == null || inspection.metadata().xmlRoot().isBlank()) {
                    throw new ReportServiceException(422, "OPENDOPE_XML_ROOT_MISSING", "La plantilla OpenDoPE no declara una raiz XML de datos.");
                }
                String xml = jsonToXml.convert(normalizedParameters, inspection.metadata().xmlRoot());
                Docx4J.bind(document, xml, Docx4J.FLAG_BIND_INSERT_XML | Docx4J.FLAG_BIND_BIND_XML);
                // OpenDoPE binding writes scalar values as plain text. Materialize rich text
                // afterwards so the generated runs are not overwritten by the binding pass.
                if (inspection.metadata().has(TemplateFeature.RICH_TEXT)) richText.apply(document, normalizedParameters);
            }
            if (!inspection.metadata().isOpenDope()
                    || inspection.metadata().has(TemplateFeature.LEGACY_VARIABLES)
                    || inspection.metadata().has(TemplateFeature.LEGACY_JXLS)) {
                VariablePrepare.prepare(document);
                replaceVariables(document, flatten(normalizedParameters));
            }
            if (inspection.metadata().has(TemplateFeature.MERGEFIELD)) {
                Map<DataFieldName, String> fields = new HashMap<>();
                flatten(normalizedParameters).forEach((key, value) -> fields.put(new DataFieldName(key), value));
                MailMerger.performMerge(document, fields, true);
            }
            if (inspection.metadata().has(TemplateFeature.TOC_BOOKMARKS)) updateTableOfContents(document);
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
        } catch (ReportServiceException error) {
            throw error;
        } catch (Exception error) {
            LOG.error("No se pudo procesar la plantilla DOCX.", error);
            throw new ReportServiceException(422, "TEMPLATE_RENDER_FAILED", "No se pudo procesar la plantilla DOCX.");
        }
    }

    private void updateTableOfContents(WordprocessingMLPackage document) {
        try {
            Docx4jProperties.setProperty("docx4j.toc.BookmarksIntegrity.remediate", Boolean.TRUE);
            new TocGenerator(document).updateToc(true);
        } catch (Exception error) {
            LOG.warn("No se pudo actualizar automaticamente la tabla de contenido; se conservara la plantilla original.", error);
        }
    }

    private Map<String, String> flatten(JsonNode node) {
        Map<String, String> result = new HashMap<>();
        if (node != null && node.isObject()) node.fields().forEachRemaining(field -> flatten(field.getKey(), field.getValue(), result));
        return result;
    }

    private void replaceVariables(WordprocessingMLPackage document, Map<String, String> mappings) throws Exception {
        for (Part part : document.getParts().getParts().values()) {
            if (!(part instanceof JaxbXmlPart<?> xmlPart)) continue;
            if (part instanceof MainDocumentPart || part instanceof HeaderPart || part instanceof FooterPart) xmlPart.variableReplace(mappings);
        }
    }

    private void flatten(String prefix, JsonNode node, Map<String, String> result) {
        if (node == null || node.isNull()) { result.put(prefix, ""); return; }
        if (node.isValueNode()) { result.put(prefix, node.asText()); return; }
        if (node.isObject()) node.fields().forEachRemaining(field -> flatten(prefix + "." + field.getKey(), field.getValue(), result));
        else if (node.isArray()) { result.put(prefix, node.toString()); }
    }
}
