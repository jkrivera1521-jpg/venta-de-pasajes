package ec.gob.iess.calculos.compatibility;

import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.fasterxml.jackson.databind.node.ObjectNode;
import ec.gob.iess.calculos.service.AviatorScriptEngine;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * Executes the shared fixtures against the official Java engine. The JSON
 * report is consumed by the TypeScript compatibility test.
 */
class AviatorCompatibilityFixtureTest {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final TypeReference<Map<String, Object>> PARAMETERS_TYPE = new TypeReference<>() {
    };

    @Test
    void ejecutaTodosLosFixturesConAviatorJavaYGeneraReporte() throws Exception {
        JsonNode fixtureDocument = MAPPER.readTree(Files.readString(resolveFixturesPath()));
        ArrayNode results = JsonNodeFactory.instance.arrayNode();
        List<String> failures = new ArrayList<>();

        for (JsonNode fixture : fixtureDocument.path("fixtures")) {
            ObjectNode result = executeFixture(fixture);
            results.add(result);
            if (!result.path("expectedMatch").asBoolean(false)) {
                failures.add(fixture.path("id").asText("sin-id") + ": " + result.path("difference").asText());
            }
        }

        ObjectNode report = JsonNodeFactory.instance.objectNode();
        report.put("fixtureVersion", fixtureDocument.path("version").asInt());
        report.put("engine", AviatorScriptEngine.ENGINE_ID);
        report.put("generatedAt", Instant.now().toString());
        report.set("results", results);
        report.put("passed", failures.isEmpty());
        writeReport(report);

        assertTrue(failures.isEmpty(), "Diferencias en AviatorScript Java: " + String.join(" | ", failures));
    }

    private ObjectNode executeFixture(JsonNode fixture) {
        ObjectNode result = JsonNodeFactory.instance.objectNode();
        String id = fixture.path("id").asText();
        String source = fixture.path("formula").asText();
        Map<String, Object> parameters = MAPPER.convertValue(fixture.path("inputs"), PARAMETERS_TYPE);
        JsonNode expected = fixture.path("expected");

        result.put("id", id);
        result.put("outcome", "error");
        result.put("type", "error");

        try {
            Object value = AviatorScriptEngine.execute(source, parameters);
            JsonNode actual = value == null ? JsonNodeFactory.instance.nullNode() : MAPPER.valueToTree(value);
            result.put("outcome", "success");
            result.put("type", classify(actual));
            result.set("value", actual);

            boolean expectedMatch = "success".equals(expected.path("outcome").asText())
                && expected.path("type").asText().equals(classify(actual))
                && equivalentJson(expected.path("value"), actual);
            result.put("expectedMatch", expectedMatch);
            if (!expectedMatch) {
                result.put("difference", "El resultado Java no coincide con el valor o tipo esperado.");
            }
        } catch (Exception error) {
            String message = error.getMessage() == null ? error.getClass().getSimpleName() : error.getMessage();
            result.put("error", message);
            boolean expectedMatch = "error".equals(expected.path("outcome").asText())
                && expected.path("type").asText().equals("error")
                && matchesExpectedError(expected, message);
            result.put("expectedMatch", expectedMatch);
            if (!expectedMatch) {
                result.put("difference", "El error Java no coincide con el comportamiento esperado.");
            }
        }
        return result;
    }

    private static boolean matchesExpectedError(JsonNode expected, String message) {
        String expectedText = expected.path("errorMessageContains").asText("");
        if (!expectedText.isBlank() && !message.contains(expectedText)) {
            return false;
        }
        return expected.path("errorCategory").isMissingNode()
            || "runtime".equals(expected.path("errorCategory").asText());
    }

    private static String classify(JsonNode value) {
        if (value == null || value.isNull()) return "null";
        if (value.isNumber()) return "number";
        if (value.isBoolean()) return "boolean";
        if (value.isTextual()) return "string";
        if (value.isArray()) return "list";
        if (value.isObject()) return "map";
        return "unknown";
    }

    private static boolean equivalentJson(JsonNode expected, JsonNode actual) {
        if (expected == null || expected.isMissingNode()) return actual == null || actual.isNull();
        if (expected.isNumber() && actual != null && actual.isNumber()) {
            // Exact decimal comparison: no epsilon is allowed for financial rules.
            return expected.decimalValue().compareTo(actual.decimalValue()) == 0;
        }
        if (expected.isObject() && actual != null && actual.isObject()) {
            if (expected.size() != actual.size()) return false;
            var fields = expected.fields();
            while (fields.hasNext()) {
                var entry = fields.next();
                if (!actual.has(entry.getKey()) || !equivalentJson(entry.getValue(), actual.get(entry.getKey()))) {
                    return false;
                }
            }
            return true;
        }
        if (expected.isArray() && actual != null && actual.isArray()) {
            if (expected.size() != actual.size()) return false;
            for (int index = 0; index < expected.size(); index++) {
                if (!equivalentJson(expected.get(index), actual.get(index))) return false;
            }
            return true;
        }
        return expected.equals(actual);
    }

    private static Path resolveFixturesPath() {
        String configured = System.getProperty("aviator.compatibility.fixtures");
        List<Path> candidates = new ArrayList<>();
        if (configured != null && !configured.isBlank()) candidates.add(Path.of(configured));
        candidates.add(Path.of("test-fixtures", "aviatorscript-compatibility.json"));
        candidates.add(Path.of("..", "..", "test-fixtures", "aviatorscript-compatibility.json"));
        return candidates.stream()
            .filter(Files::isRegularFile)
            .findFirst()
            .orElseThrow(() -> new IllegalStateException("No se encontro el fixture compartido de compatibilidad."));
    }

    private static void writeReport(ObjectNode report) throws IOException {
        Path output = Path.of(System.getProperty(
            "aviator.compatibility.javaReport",
            "target/aviator-compatibility/java-results.json"
        ));
        Files.createDirectories(output.getParent());
        MAPPER.writerWithDefaultPrettyPrinter().writeValue(output.toFile(), report);
    }
}
