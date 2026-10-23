package ec.gob.iess.calculos.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class AviatorScriptEngineTest {

    @Test
    void ejecutaLaSemanticaCanonicaDeColeccionesYFunciones() {
        String source = """
            let activos = seq.filter(items, lambda(item) -> item.enabled == true end);
            let total = seq.reduce(activos, lambda(acc, item) -> acc + item.amount end, 0.0);
            return seq.map("total", total, "cantidad", seq.count(activos), "inicia", string.starts_with(prefix, "A"));
            """;
        Map<String, Object> parameters = new LinkedHashMap<>();
        parameters.put("items", List.of(
            Map.of("enabled", true, "amount", 10),
            Map.of("enabled", false, "amount", 99),
            Map.of("enabled", true, "amount", 5)
        ));
        parameters.put("prefix", "AviatorScript");

        @SuppressWarnings("unchecked")
        Map<String, Object> result = (Map<String, Object>) AviatorScriptEngine.execute(source, parameters);

        assertEquals(15.0, ((Number) result.get("total")).doubleValue());
        assertEquals(2L, ((Number) result.get("cantidad")).longValue());
        assertEquals(true, result.get("inicia"));
    }

    @Test
    void conservaElOperadorDePertenenciaComoSeqInclude() {
        Object result = AviatorScriptEngine.execute(
            "return seq.include(valores, valor);",
            Map.of("valores", List.of("A", "B"), "valor", "B")
        );

        assertEquals(true, result);
        assertFalse((Boolean) AviatorScriptEngine.execute(
            "return seq.include(valores, valor);",
            Map.of("valores", List.of("A", "B"), "valor", "C")
        ));
    }

    @Test
    void rechazaFuenteVacia() {
        assertThrows(IllegalArgumentException.class, () -> AviatorScriptEngine.compile("  "));
    }
}
