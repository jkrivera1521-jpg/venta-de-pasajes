package com.ventapasajes.report.validation;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.security.MessageDigest;
import java.util.Locale;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

import org.eclipse.microprofile.config.inject.ConfigProperty;

import com.ventapasajes.report.api.ReportServiceException;
import com.ventapasajes.report.domain.DocumentType;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.ws.rs.core.Response;

@ApplicationScoped
public class TemplateFileValidator {
    private static final int MAX_ENTRIES = 2000;
    private static final long MAX_UNCOMPRESSED = 64L * 1024 * 1024;
    @ConfigProperty(name = "app.report.template.max-bytes") long maxBytes;

    public ValidatedTemplate validate(String originalName, String contentType, byte[] content) {
        if (content == null || content.length == 0) throw fail("TEMPLATE_EMPTY", "La plantilla esta vacia.");
        if (content.length > maxBytes) throw fail("TEMPLATE_TOO_LARGE", "La plantilla supera el limite configurado.");
        String fileName = originalName == null ? "" : originalName.trim();
        int dot = fileName.lastIndexOf('.');
        if (dot <= 0) throw fail("TEMPLATE_EXTENSION", "La plantilla debe tener extension .xlsx o .docx.");
        String extension = fileName.substring(dot + 1).toLowerCase(Locale.ROOT);
        DocumentType type;
        if ("xlsx".equals(extension)) type = DocumentType.XLSX;
        else if ("docx".equals(extension)) type = DocumentType.DOCX;
        else throw fail("TEMPLATE_EXTENSION", "Solo se permiten plantillas XLSX o DOCX.");
        validateContentType(type, contentType);
        if (content.length < 4 || content[0] != 'P' || content[1] != 'K') throw fail("TEMPLATE_SIGNATURE", "El archivo no tiene una firma Office Open XML valida.");
        scanZip(content, extension);
        String checksum = sha256(content);
        String resolvedType = contentType == null || contentType.isBlank() ? contentTypeFor(type) : contentType;
        return new ValidatedTemplate(type, extension, resolvedType, content, checksum);
    }

    private void scanZip(byte[] content, String extension) {
        long uncompressed = 0;
        int entries = 0;
        boolean contentTypes = false;
        boolean mainDocument = false;
        try (ZipInputStream zip = new ZipInputStream(new ByteArrayInputStream(content))) {
            ZipEntry entry;
            byte[] buffer = new byte[8192];
            while ((entry = zip.getNextEntry()) != null) {
                entries++;
                if (entries > MAX_ENTRIES) throw fail("TEMPLATE_ZIP_LIMIT", "La plantilla contiene demasiadas entradas ZIP.");
                String name = entry.getName();
                String lower = name.toLowerCase(Locale.ROOT);
                contentTypes |= "[content_types].xml".equals(lower);
                mainDocument |= "xlsx".equals(extension) && "xl/workbook.xml".equals(lower);
                mainDocument |= "docx".equals(extension) && "word/document.xml".equals(lower);
                if (name.startsWith("/") || name.contains("../") || name.contains("\\..\\") || name.matches("^[A-Za-z]:.*")) throw fail("TEMPLATE_PATH", "La plantilla contiene una ruta interna insegura.");
                if (lower.endsWith("vbaproject.bin") || lower.endsWith(".xlsm") || lower.endsWith(".docm") || "xlsm".equals(extension) || "docm".equals(extension)) throw fail("TEMPLATE_MACRO", "Las plantillas con macros no estan permitidas.");
                int read;
                while ((read = zip.read(buffer)) >= 0) {
                    uncompressed += read;
                    if (uncompressed > MAX_UNCOMPRESSED) throw fail("TEMPLATE_ZIP_LIMIT", "La plantilla supera el limite de expansion ZIP.");
                    if (isXml(lower)) {
                        String text = new String(buffer, 0, read, java.nio.charset.StandardCharsets.UTF_8);
                        if (text.contains("<!DOCTYPE") || text.contains("<!ENTITY") || text.contains("TargetMode=\"External\"")) throw fail("TEMPLATE_XML", "La plantilla contiene XML externo no permitido.");
                    }
                }
                zip.closeEntry();
            }
            if (!contentTypes || !mainDocument) throw fail("TEMPLATE_SIGNATURE", "El paquete no contiene la estructura Office esperada.");
        } catch (IOException error) {
            throw fail("TEMPLATE_ZIP", "La plantilla no es un paquete Office valido.");
        }
    }

    private boolean isXml(String name) { return name.endsWith(".xml") || name.endsWith(".rels"); }
    private void validateContentType(DocumentType type, String contentType) {
        if (contentType == null || contentType.isBlank() || "application/octet-stream".equalsIgnoreCase(contentType)) return;
        if (!contentTypeFor(type).equalsIgnoreCase(contentType)) throw fail("TEMPLATE_CONTENT_TYPE", "El Content-Type no corresponde a la extension de la plantilla.");
    }
    private String contentTypeFor(DocumentType type) { return type == DocumentType.XLSX ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document"; }
    private String sha256(byte[] bytes) {
        try { return java.util.HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes)); }
        catch (Exception error) { throw new IllegalStateException("No se pudo calcular la huella del archivo.", error); }
    }
    private ReportServiceException fail(String code, String detail) { return new ReportServiceException(422, code, detail); }

    public record ValidatedTemplate(DocumentType documentType, String extension, String contentType, byte[] content, String checksum) { }
}
