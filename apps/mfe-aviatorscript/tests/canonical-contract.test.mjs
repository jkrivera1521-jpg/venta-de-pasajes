import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { test } from "node:test";

const libUrl = new URL("../lib/", import.meta.url).href;
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (context.parentURL?.startsWith(libUrl) && /^\.\/[\w-]+$/.test(specifier)) {
      return nextResolve(`${specifier}.ts`, context);
    }
    return nextResolve(specifier);
  }
});

const { compileFormula, evaluateFormula, validateFormula } = await import("../lib/formula.ts");
const { parseAviatorSource } = await import("../lib/formula-template.ts");
const { createFormulaTestPayload } = await import("../lib/test-payload.ts");

test("el parser, AST y evaluador local conservan la semantica del contrato canonico", () => {
  const source = "seq.map(\"total\", salario + bonificacion, \"incluido\", seq.include(categorias, categoria))";
  const fields = [
    { key: "salario", label: "Salario", type: "number" },
    { key: "bonificacion", label: "Bonificacion", type: "number" },
    { key: "categorias", label: "Categorias", type: "unknown" },
    { key: "categoria", label: "Categoria", type: "string" }
  ];
  const parsed = parseAviatorSource(source, fields);

  const issues = validateFormula(parsed, fields);
  assert.equal(issues.length, 0, issues.map((issue) => issue.message).join("\n"));
  assert.match(compileFormula(parsed), /^seq\.map\("total", \(salario \+ bonificacion\), "incluido", seq\.include\(categorias, categoria\)\)$/);
  assert.deepEqual(evaluateFormula(parsed, {
    salario: 1200,
    bonificacion: 150,
    categorias: ["SOFTWARE", "SERVICIOS"],
    categoria: "SOFTWARE"
  }), { total: 1350, incluido: true });

  const payload = JSON.parse(createFormulaTestPayload(parsed, fields));
  assert.ok(Array.isArray(payload.parametros.categorias));
});

test("el literal nulo se genera como nil, que es el contrato de AviatorScript", () => {
  const parsed = parseAviatorSource(
    'if (cotizacionId == nil) { throw "Cotizacion requerida"; }',
    [{ key: "cotizacionId", label: "Cotizacion", type: "string" }]
  );

  const compiled = compileFormula(parsed);
  assert.match(compiled, /cotizacionId == nil/);
  assert.doesNotMatch(compiled, /== null/);
});
