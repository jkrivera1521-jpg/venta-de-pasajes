import type { FormulaPersistenceRequest, FormulaTemplate } from "./formula";
import type { AviatorSourceTestResponse, AviatorValidationResponse } from "./aviator-contract";
import type { RuleDocument, SchemaField, TestResponse, ValidateResponse } from "./types";
import { normalizeAviatorFlowGraph, type AviatorFlowGraph } from "./visualization";

const rulesApiBase = (process.env.NEXT_PUBLIC_RULES_API_BASE_URL || "/api/v1/rules").replace(/\/$/, "");

type AccessToken = string | null | undefined;

async function request<T>(path: string, init?: RequestInit, accessToken?: AccessToken): Promise<T> {
  return requestFrom<T>(`${rulesApiBase}${path}`, init, accessToken);
}

async function requestFrom<T>(url: string, init?: RequestInit, accessToken?: AccessToken): Promise<T> {
  const headers = new Headers(init?.headers);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }
  const response = await fetch(url, {
    ...init,
    headers
  });
  const body = await response.json().catch(() => null) as { error?: string | { code?: string; message?: string } } | T | null;
  if (!response.ok) {
    const error = body && typeof body === "object" && "error" in body ? body.error : undefined;
    const message = typeof error === "string" ? error : error?.message;
    throw new Error(message || `La API respondio con HTTP ${response.status}.`);
  }
  return body as T;
}

export function getRuleSchema() {
  return request<SchemaField[]>("/schema", { method: "GET" });
}

export function getFormulaTemplates(accessToken?: AccessToken) {
  return requestFrom<FormulaTemplate[]>("/api/v1/calculos/formulas", { method: "GET" }, accessToken);
}

export function saveFormulaToDatabase(payload: FormulaPersistenceRequest, accessToken?: AccessToken) {
  return requestFrom<FormulaTemplate>("/api/v1/calculos/formulas", {
    body: JSON.stringify(payload),
    method: "POST"
  }, accessToken);
}

export function publishFormula(id: number, accessToken?: AccessToken) {
  return requestFrom<FormulaTemplate>(`/api/v1/calculos/formulas/${id}/publicar`, {
    method: "POST"
  }, accessToken);
}

export function activateFormula(id: number, accessToken?: AccessToken) {
  return requestFrom<FormulaTemplate>(`/api/v1/calculos/formulas/${id}/activar`, {
    method: "POST"
  }, accessToken);
}

export function getCalculationEndpoint() {
  return requestFrom<{ executionUrl: string }>("/api/v1/calculos/endpoint", { method: "GET" });
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

/** Validate source with the same AviatorScript engine used by the service. */
export function validateAviatorSource(source: string, accessToken?: AccessToken) {
  return requestFrom<AviatorValidationResponse>("/api/v1/calculos/validar", {
    body: JSON.stringify({ source }),
    method: "POST"
  }, accessToken);
}

/** Execute source with the real AviatorScript engine, without persisting it. */
export function testAviatorSource(source: string, parametros: Record<string, unknown>, accessToken?: AccessToken) {
  return requestFrom<AviatorSourceTestResponse>("/api/v1/calculos/probar", {
    body: JSON.stringify({ parametros, source }),
    method: "POST"
  }, accessToken);
}

export async function visualizeAviatorSource(source: string, accessToken?: AccessToken): Promise<AviatorFlowGraph> {
  const response = await requestFrom<unknown>("/api/v1/aviator/visualize", {
    body: JSON.stringify({ source, includeSourceMapping: true }),
    method: "POST"
  }, accessToken);
  return normalizeAviatorFlowGraph(response);
}
