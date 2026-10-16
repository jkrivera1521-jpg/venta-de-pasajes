import { DEFAULT_SCHEMA, evaluateRule, normalizeRule, validateRuleDocument } from "../../../../../lib/rules";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const startedAt = performance.now();
  const payload = await request.json().catch(() => null) as { ruleStructure?: unknown; testData?: unknown } | null;
  const rule = normalizeRule(payload?.ruleStructure);
  const issues = validateRuleDocument(rule, DEFAULT_SCHEMA);

  if (issues.some((issue) => issue.severity === "error")) {
    return Response.json({
      error: "La regla tiene errores de validacion.",
      executionTimeMs: Number((performance.now() - startedAt).toFixed(2)),
      success: false
    }, { status: 422 });
  }

  const matched = evaluateRule(rule, payload?.testData ?? {});
  return Response.json({
    executionTimeMs: Number((performance.now() - startedAt).toFixed(2)),
    matched,
    result: matched,
    success: true
  });
}
