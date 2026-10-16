import { DEFAULT_SCHEMA, normalizeRule, toAviatorScript, validateRuleDocument } from "../../../../../lib/rules";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  const rule = normalizeRule(payload);
  const issues = validateRuleDocument(rule, DEFAULT_SCHEMA);

  return Response.json({
    aviatorScript: issues.some((issue) => issue.severity === "error") ? undefined : toAviatorScript(rule, DEFAULT_SCHEMA),
    issues,
    valid: issues.every((issue) => issue.severity !== "error")
  });
}
