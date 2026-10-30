package com.ventapasajes.report.validation;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.databind.ObjectMapper;

class JsonToXmlConverterTest {
    @Test
    void convertsNestedObjectsArraysAndEscapesText() throws Exception {
        String xml = new JsonToXmlConverter().convert(new ObjectMapper().readTree("""
                {"customer":{"name":"Ana & Luis"},"items":[{"name":"A < B"},{"name":"C"}],"active":true}
                """), "invoice");
        assertTrue(xml.contains("<invoice>"));
        assertTrue(xml.contains("<customer><name>Ana &amp; Luis</name></customer>"));
        assertTrue(xml.contains("<items><item><name>A &lt; B</name></item><item><name>C</name></item></items>"));
        assertTrue(xml.contains("<active>true</active>"));
    }

    @Test
    void rejectsInvalidXmlElementNames() throws Exception {
        assertThrows(IllegalArgumentException.class, () -> new JsonToXmlConverter().convert(new ObjectMapper().readTree("{\"value\":1}"), "invoice root"));
        assertThrows(IllegalArgumentException.class, () -> new JsonToXmlConverter().convert(new ObjectMapper().readTree("{\"bad key\":1}"), "invoice"));
    }

    @Test
    void rejectsPayloadsThatExceedDepthOrTextLimits() throws Exception {
        JsonToXmlConverter converter = new JsonToXmlConverter(new JsonToXmlConverter.Limits(2, 20, 10, 1000));

        assertThrows(IllegalArgumentException.class, () -> converter.convert(new ObjectMapper().readTree("{\"one\":{\"two\":{\"three\":1}}}"), "invoice"));
        assertThrows(IllegalArgumentException.class, () -> converter.convert(new ObjectMapper().readTree("{\"description\":\"01234567890\"}"), "invoice"));
    }

    @Test
    void preservesNullsAsEmptyElementsAndSupportsNestedArrays() throws Exception {
        String xml = new JsonToXmlConverter().convert(new ObjectMapper().readTree("""
                {"trips":[{"passengers":[{"name":"Ana"},{"name":"Luis"}],"departure":null}]}
                """), "report");

        assertTrue(xml.contains("<trips><item><passengers><item><name>Ana</name></item><item><name>Luis</name></item></passengers><departure"));
    }
}
