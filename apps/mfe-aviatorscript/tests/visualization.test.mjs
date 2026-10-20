import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { test } from "node:test";

const libUrl = new URL("../lib/", import.meta.url).href;
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (context.parentURL?.startsWith(libUrl) && /^\.\/[\w-]+$/.test(specifier)) return nextResolve(`${specifier}.ts`, context);
    return nextResolve(specifier, context);
  }
});

const { parseAviatorSource } = await import("../lib/formula-template.ts");
const { buildLocalAviatorFlow } = await import("../lib/visualization.ts");
const { DEFAULT_PAYROLL_CONFIG, generatePayrollAviatorScript } = await import("../lib/payroll-formula.ts");

test("construye un CFG con decisiones, ramas, ciclo, throw, continue y return", () => {
  const source = `if (salarioMensual <= 0) {
  throw "salario invalido";
} else {
  for item in horasExtras {
    if (item.horas <= 0) { continue; }
    total = total + item.horas;
  }
}
return seq.map("total", total);`;
  const graph = buildLocalAviatorFlow(source, parseAviatorSource(source, []));
  const kinds = new Set(graph.nodes.map((node) => node.data.kind));
  assert.deepEqual([...kinds].sort(), ["decision", "end", "exception", "iteration", "process", "return", "start"].sort());
  assert.ok(graph.edges.some((edge) => edge.label === "true"));
  assert.ok(graph.edges.some((edge) => edge.label === "continuar"));
  assert.ok(graph.nodes.some((node) => node.data.source.startLine === 2 && node.data.kind === "exception"));
});

test("conserva referencias de variables y rangos para funciones de colecciones", () => {
  const source = `let detalle = seq.list();
seq.add(detalle, seq.map("tipo", item.tipo));
return detalle;`;
  const graph = buildLocalAviatorFlow(source, parseAviatorSource(source, []));
  const functionNode = graph.nodes.find((node) => node.data.kind === "function");
  assert.ok(functionNode);
  assert.ok(functionNode.data.referencedVariables.includes("detalle"));
  assert.equal(functionNode.data.source.startLine, 2);
  assert.ok(graph.valid);
});

test("analiza la nomina avanzada sin compartir salidas entre fragmentos", () => {
  const source = generatePayrollAviatorScript(DEFAULT_PAYROLL_CONFIG);
  const graph = buildLocalAviatorFlow(source, parseAviatorSource(source, []));

  assert.ok(graph.valid);
  assert.ok(graph.nodes.length > 80);
  assert.ok(graph.nodes.length < 200);
  assert.ok(graph.edges.length > 100);
});
