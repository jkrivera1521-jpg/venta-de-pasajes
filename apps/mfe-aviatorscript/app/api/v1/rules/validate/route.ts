import { DEFAULT_SCHEMA, normalizeRule, toAviatorScript, validateRuleDocument } from "../../../../../lib/rules";
import { callAviatorEngine } from "../_aviator-engine";
import type { AviatorValidationResponse } from "../../../../../lib/aviator-contract";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  let rule;
  try {
    rule = normalizeRule(payload);
  } catch {
    return Response.json({ aviatorScript: undefined, issues: [{ message: "La regla legacy no tiene una estructura valida.", path: "root", severity: "error" }], valid: false }, { status: 400 });
  }

  let issues;
  try {
    issues = validateRuleDocument(rule, DEFAULT_SCHEMA);
  } catch {
    return Response.json({ aviatorScript: undefined, issues: [{ message: "La regla legacy no tiene una estructura valida.", path: "root", severity: "error" }], valid: false }, { status: 400 });
  }
  if (issues.some((issue) => issue.severity === "error")) {
    return Response.json({ aviatorScript: undefined, issues, valid: false });
  }

  const aviatorScript = toAviatorScript(rule, DEFAULT_SCHEMA);
  try {
    const upstream = await callAviatorEngine(request, "/api/v1/calculos/validar", { source: aviatorScript });
    const response = upstream.payload as Partial<AviatorValidationResponse> & { error?: string };
    const engineIssues = Array.isArray(response.diagnostics)
      ? response.diagnostics.map((diagnostic) => ({
        message: diagnostic.message,
        path: diagnostic.line ? `source.line.${diagnostic.line}` : "source",
        severity: diagnostic.severity === "warning" ? "warning" : "error" as const
      }))
      : [{ message: response.error ?? "El motor AviatorScript no devolvio diagnosticos.", path: "source", severity: "error" as const }];

    return Response.json({
      aviatorScript: response.valid ? aviatorScript : undefined,
      issues: [...issues, ...engineIssues],
      valid: response.valid === true && engineIssues.every((issue) => issue.severity !== "error")
    }, { status: upstream.status });
  } catch {
    return Response.json({
      aviatorScript: undefined,
      issues: [{ message: "No se pudo validar la regla con el motor AviatorScript.", path: "source", severity: "error" }],
      valid: false
    }, { status: 503 });
  }
}
