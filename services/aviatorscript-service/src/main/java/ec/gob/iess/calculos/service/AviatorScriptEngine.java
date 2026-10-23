package ec.gob.iess.calculos.service;

import com.googlecode.aviator.AviatorEvaluator;
import com.googlecode.aviator.Expression;
import com.googlecode.aviator.runtime.type.AviatorFunction;
import java.util.Map;

/**
 * Single execution boundary for source authored by the visual editor or by
 * the source editor. The source remains AviatorScript; aliases only preserve
 * the names exposed by the canonical editor contract.
 */
public final class AviatorScriptEngine {

    public static final int CONTRACT_VERSION = 1;
    public static final String ENGINE_ID = "aviator-5.8.0";
    public static final int MAX_SOURCE_LENGTH = 100_000;
    public static final int MAX_PARAMETER_COUNT = 200;

    private static final Map<String, String> FUNCTION_ALIASES = Map.of(
        "seq.filter", "filter",
        "seq.reduce", "reduce",
        "seq.count", "count",
        "seq.include", "include",
        "math.min", "min",
        "math.max", "max",
        "string.starts_with", "string.startsWith",
        "string.ends_with", "string.endsWith"
    );

    static {
        registerFunctionAliases();
    }

    private AviatorScriptEngine() {
    }

    public static Expression compile(String source) {
        validateSource(source);
        return AviatorEvaluator.compile(source);
    }

    public static Object execute(String source, Map<String, Object> parameters) {
        if (parameters == null) {
            throw new IllegalArgumentException("El mapa de parametros es obligatorio.");
        }
        if (parameters.size() > MAX_PARAMETER_COUNT) {
            throw new IllegalArgumentException("No se permiten más de " + MAX_PARAMETER_COUNT + " parámetros.");
        }
        return compile(source).execute(parameters);
    }

    public static void validateSource(String source) {
        if (source == null || source.isBlank()) {
            throw new IllegalArgumentException("El codigo AviatorScript es obligatorio.");
        }
        if (source.length() > MAX_SOURCE_LENGTH) {
            throw new IllegalArgumentException("El codigo AviatorScript supera el limite permitido.");
        }
    }

    private static void registerFunctionAliases() {
        FUNCTION_ALIASES.forEach((alias, original) -> {
            AviatorFunction function = AviatorEvaluator.getFunction(original);
            if (function != null) {
                AviatorEvaluator.getInstance().addFunction(alias, function);
            }
        });
    }
}
