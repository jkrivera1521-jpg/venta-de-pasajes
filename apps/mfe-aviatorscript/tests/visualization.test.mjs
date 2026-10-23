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
const { buildLocalAviatorFlow, collapseAviatorFlowGraph } = await import("../lib/visualization.ts");
const { buildMermaidFlowchart, collapseMermaidFlowchart, mermaidNodeId } = await import("../lib/mermaid.ts");
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

test("escapa las etiquetas Mermaid con expresiones y comillas internas", () => {
  const source = `let detalle = seq.list();
seq.add(detalle, seq.map("tipo", item.tipo, "horas", item.horas));
return detalle;`;
  const graph = buildLocalAviatorFlow(source, parseAviatorSource(source, []));
  const mermaid = buildMermaidFlowchart(graph);
  assert.match(mermaid, /#quot;tipo#quot;/);
  assert.match(mermaid, /#quot;horas#quot;/);
  assert.doesNotMatch(mermaid, /seq\.map\("tipo"/);
  assert.doesNotMatch(mermaid, /#(?:40|41);/);
});

test("analiza la nomina avanzada sin compartir salidas entre fragmentos", () => {
  const source = generatePayrollAviatorScript(DEFAULT_PAYROLL_CONFIG);
  const graph = buildLocalAviatorFlow(source, parseAviatorSource(source, []));

  assert.ok(graph.valid);
  assert.ok(graph.nodes.length > 80);
  assert.ok(graph.nodes.length < 200);
  assert.ok(graph.edges.length > 100);
});

test("contrae una decision en el grafo Mermaid y conserva una salida visible", () => {
  const source = `if (salarioMensual <= 0) {
  throw "salario invalido";
} else {
  total = salarioMensual;
}
return total;`;
  const graph = buildLocalAviatorFlow(source, parseAviatorSource(source, []));
  const decision = graph.nodes.find((node) => node.data.kind === "decision");
  assert.ok(decision);

  const collapsed = collapseAviatorFlowGraph(graph, new Set([decision.id]));
  assert.ok(collapsed.nodes.some((node) => node.id === decision.id));
  assert.ok(collapsed.edges.some((edge) => edge.label === "contenido oculto"));
  assert.equal(collapsed.edges.filter((edge) => edge.source === decision.id).length, 1);
  assert.ok(collapsed.nodes.some((node) => node.id.startsWith(`collapsed-content-${decision.id}`) && node.data.label === "Contenido oculto"));
  assert.ok(collapsed.nodes.length < graph.nodes.length);

  const collapsedSource = collapseMermaidFlowchart(buildMermaidFlowchart(graph), graph, collapsed);
  assert.match(collapsedSource, /contenido oculto/);
  assert.match(collapsedSource, new RegExp(`\\b${mermaidNodeId(decision.id)}\\b`));
});
