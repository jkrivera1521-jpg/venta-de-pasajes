import assert from "node:assert/strict";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { registerHooks } from "node:module";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const libUrl = new URL("../lib/", import.meta.url).href;
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (context.parentURL?.startsWith(libUrl) && /^\.\/[\w-]+$/.test(specifier)) {
      return nextResolve(specifier + ".ts", context);
    }
    return nextResolve(specifier);
  }
});

const { evaluateFormula } = await import("../lib/formula.ts");
const { parseAviatorProgram, parseAviatorTemplate } = await import("../lib/formula-template.ts");

const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));
const fixturePath = resolve(repoRoot, "test-fixtures/aviatorscript-compatibility.json");
const fixtureDocument = JSON.parse(readFileSync(fixturePath, "utf8"));
const javaReportPath = process.env.AVIATOR_JAVA_REPORT
  ? resolve(process.env.AVIATOR_JAVA_REPORT)
  : resolve(repoRoot, "services/aviatorscript-service/target/aviator-compatibility/java-results.json");
const requireJavaReport = process.env.AVIATOR_REQUIRE_JAVA_REPORT === "true";

function inferType(value) {
  if (value === null) return "unknown";
  if (Array.isArray(value)) return "unknown";
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "string") return "string";
  return "unknown";
}

function schemaFromInputs(inputs) {
  return Object.entries(inputs).map(([key, value]) => ({
    key,
    label: key,
    type: inferType(value)
  }));
}

function classify(value) {
  if (value === null || value === undefined) return "null";
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "string") return "string";
  if (Array.isArray(value)) return "list";
  if (typeof value === "object") return "map";
  return "unknown";
}

function equivalentValue(expected, actual) {
  if (typeof expected === "number" && typeof actual === "number") {
    // Exact equality is intentional. Never hide financial differences with epsilon.
    return Object.is(expected, actual);
  }
  if (expected === null || actual === null) return expected === actual;
  if (Array.isArray(expected) && Array.isArray(actual)) {
    return expected.length === actual.length && expected.every((item, index) => equivalentValue(item, actual[index]));
  }
  if (typeof expected === "object" && typeof actual === "object" && !Array.isArray(expected) && !Array.isArray(actual)) {
    const expectedKeys = Object.keys(expected).sort();
    const actualKeys = Object.keys(actual).sort();
    return expectedKeys.length === actualKeys.length
      && expectedKeys.every((key, index) => key === actualKeys[index] && equivalentValue(expected[key], actual[key]));
  }
  return Object.is(expected, actual);
}

function matchesExpected(result, expected) {
  if (result.outcome !== expected.outcome) return false;
  if (expected.outcome === "success") {
    return result.type === expected.type && equivalentValue(result.value, expected.value);
  }
  if (result.type !== "error") return false;
  const contains = expected.errorMessageContains;
  return (!contains || result.error.includes(contains)) && (!expected.errorCategory || result.errorCategory === expected.errorCategory);
}

function runTypeScriptFixture(fixture) {
  const support = fixture.typescript?.support;
  if (support === "unsupported") {
    return {
      id: fixture.id,
      status: "unsupported",
      reason: fixture.typescript.reason
    };
  }

  try {
    const fields = schemaFromInputs(fixture.inputs);
    const root = support === "program"
      ? parseAviatorProgram(fixture.formula, fields)
      : parseAviatorTemplate(fixture.formula, fields);
    const value = evaluateFormula(root, fixture.inputs);
    const result = { id: fixture.id, outcome: "success", type: classify(value), value };
    return { ...result, expectedMatch: matchesExpected(result, fixture.expected) };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const result = { id: fixture.id, outcome: "error", type: "error", error: message, errorCategory: "runtime" };
    return { ...result, expectedMatch: matchesExpected(result, fixture.expected) };
  }
}

function readJavaReport() {
  if (!existsSync(javaReportPath)) return null;
  return JSON.parse(readFileSync(javaReportPath, "utf8"));
}

function compareEngines(typeScriptResult, javaResult) {
  if (!javaResult) {
    if (typeScriptResult.status === "unsupported") {
      return { status: "java-report-missing", reason: "No existe el reporte Java; " + typeScriptResult.reason };
    }
    if (!typeScriptResult.expectedMatch) {
      return { status: "failed", difference: "El evaluador TypeScript no coincide con el resultado esperado." };
    }
    return { status: "java-report-missing", difference: "No existe el reporte generado por AviatorScript Java." };
  }
  if (!javaResult.expectedMatch) {
    return { status: "failed", difference: "El fixture no coincide con el resultado esperado del motor Java." };
  }
  if (typeScriptResult.status === "unsupported") {
    return { status: "unsupported", reason: typeScriptResult.reason };
  }
  if (!typeScriptResult.expectedMatch) {
    return { status: "failed", difference: "El evaluador TypeScript no coincide con el resultado esperado." };
  }
  if (typeScriptResult.outcome !== javaResult.outcome || typeScriptResult.type !== javaResult.type) {
    return { status: "failed", difference: "Los motores devolvieron estados o tipos diferentes." };
  }
  if (typeScriptResult.outcome === "success" && !equivalentValue(typeScriptResult.value, javaResult.value)) {
    return { status: "failed", difference: "Los motores devolvieron valores diferentes; la comparacion numerica es exacta." };
  }
  return { status: "passed" };
}

test("compara el evaluador TypeScript con AviatorScript Java usando fixtures compartidos", () => {
  const javaReport = readJavaReport();
  if (requireJavaReport) {
    assert.ok(javaReport, "No se encontro el reporte Java en " + javaReportPath + ". Ejecuta primero AviatorCompatibilityFixtureTest.");
  }

  const javaResults = new Map((javaReport?.results ?? []).map((result) => [result.id, result]));
  const report = {
    fixtureVersion: fixtureDocument.version,
    javaEngine: javaReport?.engine ?? null,
    numericComparison: fixtureDocument.comparison.numeric,
    results: []
  };
  const differences = [];

  for (const fixture of fixtureDocument.fixtures) {
    const typeScriptResult = runTypeScriptFixture(fixture);
    const comparison = compareEngines(typeScriptResult, javaResults.get(fixture.id));
    report.results.push({
      id: fixture.id,
      typeScript: typeScriptResult,
      java: javaResults.get(fixture.id) ?? null,
      comparison
    });
    if (comparison.status === "failed") {
      differences.push(fixture.id + ": " + comparison.difference);
    }
  }

  const counts = report.results.reduce((accumulator, item) => {
    accumulator[item.comparison.status] = (accumulator[item.comparison.status] ?? 0) + 1;
    return accumulator;
  }, { passed: 0, failed: 0, unsupported: 0, "java-report-missing": 0 });
  report.counts = counts;

  if (javaReport) {
    const output = resolve(repoRoot, "services/aviatorscript-service/target/aviator-compatibility/compatibility-report.json");
    mkdirSync(resolve(output, ".."), { recursive: true });
    writeFileSync(output, JSON.stringify(report, null, 2) + "\n", "utf8");
  }

  assert.deepEqual(differences, [], differences.join(" | "));
});
