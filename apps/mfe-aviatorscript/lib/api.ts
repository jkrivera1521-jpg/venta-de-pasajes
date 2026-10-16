import type { RuleDocument, SchemaField, TestResponse, ValidateResponse } from "./types";

const rulesApiBase = (process.env.NEXT_PUBLIC_RULES_API_BASE_URL || "/api/v1/rules").replace(/\/$/, "");

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${rulesApiBase}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });
  const body = await response.json().catch(() => null) as { error?: string } | T | null;
  if (!response.ok) {
    const message = body && typeof body === "object" && "error" in body ? body.error : undefined;
    throw new Error(message || `La API respondio con HTTP ${response.status}.`);
  }
  return body as T;
}

export function getRuleSchema() {
  return request<SchemaField[]>("/schema", { method: "GET" });
}

export function validateRule(rule: RuleDocument) {
  return request<ValidateResponse>("/validate", {
    body: JSON.stringify(rule),
    method: "POST"
  });
}

export function testRule(rule: RuleDocument, testData: unknown) {
  return request<TestResponse>("/test", {
    body: JSON.stringify({ ruleStructure: rule, testData }),
    method: "POST"
  });
}
