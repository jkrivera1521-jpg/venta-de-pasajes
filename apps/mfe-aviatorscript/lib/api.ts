import type { FormulaTemplate } from "./formula";
import type { RuleDocument, SchemaField, TestResponse, ValidateResponse } from "./types";
import { normalizeAviatorFlowGraph, type AviatorFlowGraph } from "./visualization";

const rulesApiBase = (process.env.NEXT_PUBLIC_RULES_API_BASE_URL || "/api/v1/rules").replace(/\/$/, "");

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  return requestFrom<T>(`${rulesApiBase}${path}`, init);
}

async function requestFrom<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
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

export function getFormulaTemplates() {
  return requestFrom<FormulaTemplate[]>("/api/v1/calculos/formulas", { method: "GET" });
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

export async function visualizeAviatorSource(source: string): Promise<AviatorFlowGraph> {
  const response = await requestFrom<unknown>("/api/v1/aviator/visualize", {
    body: JSON.stringify({ source, includeSourceMapping: true }),
    method: "POST"
  });
  return normalizeAviatorFlowGraph(response);
}
