package com.ventapasajes.report.validation;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.List;

import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ventapasajes.report.api.ReportServiceException;
import com.ventapasajes.report.domain.ParameterDataType;

class DynamicImageValidatorTest {
    private static final String PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

    @Test
    void acceptsDataUriAndNormalizesItToRawBase64() throws Exception {
        var payload = new ObjectMapper().readTree("{\"cover\":\"data:image/png;base64," + PNG + "\"}");
        var parameter = new TemplateParameterExtractor.ExtractedParameter("cover", "cover", ParameterDataType.IMAGE, true, false, false, null, null, null);

        var normalized = new DynamicImageValidator().normalize(payload, List.of(parameter));

        assertEquals(PNG, normalized.get("cover").asText());
    }

    @Test
    void acceptsImageObjectAndNormalizesOnlyTheDataValue() throws Exception {
        var payload = new ObjectMapper().readTree("{\"items\":[{\"image\":{\"data\":\"" + PNG + "\",\"contentType\":\"image/png\",\"altText\":\"logo\"}}]}");
        var parameter = new TemplateParameterExtractor.ExtractedParameter("image", "items.image", ParameterDataType.IMAGE, false, true, false, null, null, null);

        var normalized = new DynamicImageValidator().normalize(payload, List.of(parameter));

        assertEquals(PNG, normalized.get("items").get(0).get("image").asText());
    }

    @Test
    void rejectsFakeBase64() throws Exception {
        var payload = new ObjectMapper().readTree("{\"cover\":\"bm90IGFuIGltYWdl\"}");
        var parameter = new TemplateParameterExtractor.ExtractedParameter("cover", "cover", ParameterDataType.IMAGE, true, false, false, null, null, null);

        ReportServiceException error = assertThrows(ReportServiceException.class, () -> new DynamicImageValidator().normalize(payload, List.of(parameter)));

        assertEquals("INVALID_IMAGE", error.code());
    }

    @Test
    void rejectsMismatchedDeclaredContentType() throws Exception {
        var payload = new ObjectMapper().readTree("{\"cover\":{\"data\":\"" + PNG + "\",\"contentType\":\"image/jpeg\"}}");
        var parameter = new TemplateParameterExtractor.ExtractedParameter("cover", "cover", ParameterDataType.IMAGE, true, false, false, null, null, null);

        ReportServiceException error = assertThrows(ReportServiceException.class, () -> new DynamicImageValidator().normalize(payload, List.of(parameter)));

        assertEquals("INVALID_IMAGE", error.code());
    }

    @Test
    void leavesOptionalImageInsideCollectionMissing() throws Exception {
        var payload = new ObjectMapper().readTree("{\"items\":[{\"name\":\"without-image\"}]}");
        var parameter = new TemplateParameterExtractor.ExtractedParameter("image", "items.image", ParameterDataType.IMAGE, false, true, false, null, null, null);

        var normalized = new DynamicImageValidator().normalize(payload, List.of(parameter));

        assertEquals("without-image", normalized.get("items").get(0).get("name").asText());
    }
}
