package com.ventapasajes.report.validation;

import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.Base64;
import java.util.Iterator;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.stream.ImageInputStream;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.fasterxml.jackson.databind.node.TextNode;
import com.ventapasajes.report.api.ReportServiceException;

import jakarta.enterprise.context.ApplicationScoped;

/** Validates and normalizes image payloads before they enter the DOCX/XML pipeline. */
@ApplicationScoped
public class DynamicImageValidator {
    private static final Pattern DATA_URI = Pattern.compile("^data:(image/[a-z0-9.+-]+);base64,(.+)$", Pattern.CASE_INSENSITIVE | Pattern.DOTALL);
    private static final int MAX_BYTES = 10 * 1024 * 1024;
    private static final int MAX_WIDTH = 5000;
    private static final int MAX_HEIGHT = 5000;
    private static final long MAX_PIXELS = 25_000_000L;

    public JsonNode normalize(JsonNode payload, List<TemplateParameterExtractor.ExtractedParameter> parameters) {
        JsonNode copy = payload == null || payload.isNull() ? JsonNodeFactory.instance.objectNode() : payload.deepCopy();
        if (parameters == null) return copy;
        for (TemplateParameterExtractor.ExtractedParameter parameter : parameters) {
            if (parameter.dataType() == com.ventapasajes.report.domain.ParameterDataType.IMAGE) {
                copy = normalizeAt(copy, parameter.path().split("\\."), 0, parameter.path(), parameter.required());
            }
        }
        return copy;
    }

    private JsonNode normalizeAt(JsonNode node, String[] path, int index, String displayPath, boolean required) {
        if (node == null || node.isNull()) {
            if (!required) return node;
            throw invalid(displayPath, "La imagen es obligatoria.");
        }
        if (index == path.length) return normalizeImage(node, displayPath);
        if (node.isArray()) {
            for (int item = 0; item < node.size(); item++) {
                ((com.fasterxml.jackson.databind.node.ArrayNode) node).set(item, normalizeAt(node.get(item), path, index, displayPath, required));
            }
            return node;
        }
        if (!node.isObject()) throw invalid(displayPath, "La ruta de la imagen no apunta a un objeto JSON.");
        ObjectNode object = (ObjectNode) node;
        String segment = path[index];
        if (!object.has(segment)) {
            if (!required) return object;
            throw invalid(displayPath, "La imagen no fue enviada.");
        }
        object.set(segment, normalizeAt(object.get(segment), path, index + 1, displayPath, required));
        return object;
    }

    private JsonNode normalizeImage(JsonNode value, String displayPath) {
        String encoded;
        String declaredContentType = null;
        if (value.isTextual()) {
            encoded = value.asText();
        } else if (value.isObject()) {
            JsonNode data = value.get("data");
            if (data == null || !data.isTextual()) throw invalid(displayPath, "La imagen debe incluir data base64.");
            encoded = data.asText();
            JsonNode contentType = value.get("contentType");
            if (contentType != null && !contentType.isNull()) {
                if (!contentType.isTextual()) throw invalid(displayPath, "contentType debe ser texto.");
                declaredContentType = contentType.asText();
            }
        } else {
            throw invalid(displayPath, "La imagen debe ser base64 o un objeto con data.");
        }
        Matcher dataUri = DATA_URI.matcher(encoded == null ? "" : encoded.trim());
        if (dataUri.matches()) {
            if (declaredContentType != null && !sameContentType(declaredContentType, dataUri.group(1))) {
                throw invalid(displayPath, "El contentType no coincide con el data URI.");
            }
            declaredContentType = dataUri.group(1);
            encoded = dataUri.group(2);
        }
        if (declaredContentType != null && !isSupportedContentType(declaredContentType)) {
            throw invalid(displayPath, "Formato de imagen no soportado: " + declaredContentType);
        }
        byte[] bytes;
        try {
            bytes = Base64.getDecoder().decode(encoded == null ? "" : encoded.trim());
        } catch (IllegalArgumentException error) {
            throw invalid(displayPath, "La imagen no contiene base64 valido.");
        }
        if (bytes.length == 0 || bytes.length > MAX_BYTES) throw invalid(displayPath, "La imagen debe tener entre 1 byte y 10 MB.");
        String detectedContentType = inspectImage(bytes, displayPath);
        if (declaredContentType != null && !sameContentType(declaredContentType, detectedContentType)) {
            throw invalid(displayPath, "El contenido real de la imagen no coincide con contentType.");
        }
        return TextNode.valueOf(Base64.getEncoder().encodeToString(bytes));
    }

    private String inspectImage(byte[] bytes, String displayPath) {
        try (ImageInputStream stream = ImageIO.createImageInputStream(new ByteArrayInputStream(bytes))) {
            if (stream == null) throw invalid(displayPath, "Los bytes no corresponden a una imagen soportada.");
            Iterator<ImageReader> readers = ImageIO.getImageReaders(stream);
            if (!readers.hasNext()) throw invalid(displayPath, "Los bytes no corresponden a una imagen soportada.");
            ImageReader reader = readers.next();
            try {
                reader.setInput(stream, true, true);
                int width = reader.getWidth(0);
                int height = reader.getHeight(0);
                if (width < 1 || height < 1 || width > MAX_WIDTH || height > MAX_HEIGHT || (long) width * height > MAX_PIXELS) {
                    throw invalid(displayPath, "Las dimensiones de la imagen superan el limite permitido.");
                }
                BufferedImage image = reader.read(0);
                if (image == null) throw invalid(displayPath, "No se pudo decodificar la imagen.");
                return contentType(reader.getFormatName());
            } finally {
                reader.dispose();
            }
        } catch (ReportServiceException error) {
            throw error;
        } catch (IOException | RuntimeException error) {
            throw invalid(displayPath, "No se pudo decodificar la imagen.");
        }
    }

    private String contentType(String format) {
        return switch (format.toLowerCase(Locale.ROOT)) {
            case "png" -> "image/png";
            case "jpg", "jpeg" -> "image/jpeg";
            case "gif" -> "image/gif";
            case "bmp" -> "image/bmp";
            default -> throw invalid("imagen", "Formato de imagen no soportado: " + format);
        };
    }

    private boolean isSupportedContentType(String value) {
        String normalized = value.toLowerCase(Locale.ROOT).trim();
        return normalized.equals("image/png") || normalized.equals("image/jpeg") || normalized.equals("image/gif") || normalized.equals("image/bmp");
    }

    private boolean sameContentType(String left, String right) {
        return left != null && right != null && left.trim().equalsIgnoreCase(right.trim());
    }

    private ReportServiceException invalid(String path, String message) {
        return new ReportServiceException(422, "INVALID_IMAGE", message + " Parametro: " + path);
    }
}
