import { DEFAULT_SCHEMA, normalizeRule, toAviatorScript, validateRuleDocument } from "../../../../../lib/rules";
import { callAviatorEngine } from "../_aviator-engine";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const startedAt = performance.now();
  const payload = await request.json().catch(() => null) as { ruleStructure?: unknown; testData?: unknown } | null;
  let rule;
  let issues;
  try {
    rule = normalizeRule(payload?.ruleStructure);
    issues = validateRuleDocument(rule, DEFAULT_SCHEMA);
  } catch {
    return Response.json({
      error: "La regla legacy no tiene una estructura valida.",
      executionTimeMs: Number((performance.now() - startedAt).toFixed(2)),
      success: false
    }, { status: 400 });
  }

  if (issues.some((issue) => issue.severity === "error")) {
    return Response.json({
      error: "La regla tiene errores de validacion.",
      executionTimeMs: Number((performance.now() - startedAt).toFixed(2)),
      success: false
    }, { status: 422 });
  }

  try {
    const upstream = await callAviatorEngine(request, "/api/v1/calculos/probar", {
      parametros: payload?.testData && typeof payload.testData === "object" && !Array.isArray(payload.testData) ? payload.testData : {},
      source: toAviatorScript(rule, DEFAULT_SCHEMA)
    });
    const response = upstream.payload as { success?: boolean; result?: unknown; executionTimeMs?: number; error?: string };
    if (response.success !== true) {
      return Response.json({
        error: response.error ?? "No se pudo ejecutar la regla con AviatorScript.",
        executionTimeMs: response.executionTimeMs ?? Number((performance.now() - startedAt).toFixed(2)),
        success: false
      }, { status: upstream.status === 200 ? 422 : upstream.status });
    }
    const matched = typeof response.result === "boolean" ? response.result : undefined;
    return Response.json({
      executionTimeMs: response.executionTimeMs ?? Number((performance.now() - startedAt).toFixed(2)),
      ...(matched === undefined ? {} : { matched }),
      result: response.result,
      success: true
    }, { status: upstream.status });
  } catch {
    return Response.json({
      error: "No se pudo ejecutar la regla con el motor AviatorScript.",
      executionTimeMs: Number((performance.now() - startedAt).toFixed(2)),
      success: false
    }, { status: 503 });
  }
}
