import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { test } from "node:test";
import * as Blockly from "blockly";

const libUrl = new URL("../lib/", import.meta.url).href;
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (context.parentURL?.startsWith(libUrl) && /^\.\/[\w-]+$/.test(specifier)) {
      return nextResolve(`${specifier}.ts`, context);
    }
    return nextResolve(specifier);
  }
});

const { buildFormulaFromWorkspace, loadFormulaExpression, registerAviatorBlocks } = await import("../lib/blockly-editor.ts");
const { compileFormula } = await import("../lib/formula.ts");
const { parseAviatorSource, schemaForTemplate } = await import("../lib/formula-template.ts");
const { createTemplateTestPayload } = await import("../lib/test-payload.ts");

function workspace() {
  const result = new Blockly.Workspace();
  const createBlock = result.newBlock.bind(result);
  result.newBlock = (...args) => {
    const block = createBlock(...args);
    block.initSvg = () => {};
    block.render = () => {};
    return block;
  };
  return result;
}

const api = { ...Blockly, svgResize() {} };
registerAviatorBlocks(api, { current: [] }, false);

const migration = readFileSync(new URL("../../../services/aviatorscript-service/src/main/resources/db/migration/V3__precargar_plantillas_avanzadas.sql", import.meta.url), "utf8");
const sources = [...migration.matchAll(/\$\$\r?\n([\s\S]*?)\r?\n\s*\$\$/g)].map((match) => match[1]);
const examplesMigration = readFileSync(new URL("../../../services/aviatorscript-service/src/main/resources/db/migration/V5__sincronizar_ejemplos_documentados.sql", import.meta.url), "utf8");
const documentedExamples = [...examplesMigration.matchAll(/\$\$\r?\n([\s\S]*?)\r?\n\$\$::jsonb/g)].map((match) => JSON.parse(match[1]));
const expertMigration = readFileSync(new URL("../../../services/aviatorscript-service/src/main/resources/db/migration/V6__precargar_plantillas_expertas.sql", import.meta.url), "utf8");
const expertSources = [...expertMigration.matchAll(/'FORM-(?:ACTUARIAL-SEGUROS-V4|UTILITIES-ENERGIA-V2|REASEGURO-XOL-V1)'[\s\S]*?\$\$\r?\n([\s\S]*?)\r?\n\s*\$\$,\r?\n\s*TRUE/g)].map((match) => match[1]);
const expertExamples = [...expertMigration.matchAll(/\$\$\s*\r?\n(\s*\{[\s\S]*?)\r?\n\s*\$\$::jsonb/g)].map((match) => JSON.parse(match[1].trim()));
const tourismTransportMigration = readFileSync(new URL("../../../services/aviatorscript-service/src/main/resources/db/migration/V7__precargar_plantillas_turismo_transporte.sql", import.meta.url), "utf8");
const tourismTransportSources = [...tourismTransportMigration.matchAll(/'FORM-(?:TURISMO-DYNAMIC-PACKAGING-V1|TRANSPORTE-TARIFICACION-V1)'[\s\S]*?\$\$\r?\n([\s\S]*?)\r?\n\s*\$\$,\r?\n\s*TRUE/g)].map((match) => match[1]);
const tourismTransportExamples = [...tourismTransportMigration.matchAll(/\$\$\s*\r?\n(\s*\{[\s\S]*?)\r?\n\s*\$\$::jsonb/g)].map((match) => JSON.parse(match[1].trim()));

test("las plantillas avanzadas del catalogo se cargan como bloques editables", () => {
  assert.equal(sources.length, 3);

  for (const source of sources) {
    const parsed = parseAviatorSource(source, []);
    const fields = schemaForTemplate(parsed, []);
    const created = workspace();
    try {
      registerAviatorBlocks(api, { current: fields }, false);
      loadFormulaExpression(api, created, parsed);
      const built = buildFormulaFromWorkspace(created, fields);

      assert.equal(parsed.kind, "program");
      assert.equal(built.issues.length, 0, built.issues.map((issue) => issue.message).join("\n"));
      assert.ok(created.getBlocksByType("aviator_program").length > 0);
      assert.ok(created.getBlocksByType("aviator_lambda").length > 0 || created.getBlocksByType("aviator_for_statement").length > 0);
      assert.match(compileFormula(built.expression), /seq\.(filter|reduce)|for /);
    } finally {
      created.dispose();
    }
  }
});

test("el ejemplo guardado de una formula se usa como payload completo de prueba", () => {
  const payload = createTemplateTestPayload({
    idSolicitud: "ENVIO-2026-0001",
    codigoFormula: "FORM-LOGISTICA-TARIFARIO-V3",
    parametros: { paquetes: [{ pesoRealKg: 12 }] }
  }, "{}", { codigoFormula: "FORMULA-LOCAL" });

  assert.deepEqual(JSON.parse(payload), {
    idSolicitud: "ENVIO-2026-0001",
    codigoFormula: "FORM-LOGISTICA-TARIFARIO-V3",
    parametros: { paquetes: [{ pesoRealKg: 12 }] }
  });
});

test("V5 conserva los ejemplos completos de los documentos", () => {
  assert.equal(documentedExamples.length, 3);
  assert.equal(documentedExamples[0].parametros.historialCrediticio.length, 4);
  assert.equal(documentedExamples[1].parametros.ventasDirectas.length, 4);
  assert.equal(documentedExamples[1].parametros.ventasEquipoSubordinado.length, 2);
  assert.equal(documentedExamples[2].parametros.paquetes.length, 2);
  assert.equal(documentedExamples[2].parametros.condicionesEntorno.temporadaAlta, true);
});

test("V6 registra las plantillas expertas y sus ejemplos completos", () => {
  assert.equal(expertSources.length, 3);
  assert.deepEqual(expertExamples.map((example) => example.codigoFormula), [
    "FORM-ACTUARIAL-SEGUROS-V4",
    "FORM-UTILITIES-ENERGIA-V2",
    "FORM-REASEGURO-XOL-V1"
  ]);
  assert.equal(expertExamples[0].parametros.asegurados.length, 5);
  assert.equal(expertExamples[1].parametros.lecturasIntervalo.length, 4);
  assert.equal(expertExamples[2].parametros.capasReaseguro.length, 3);

  for (const source of expertSources) {
    const parsed = parseAviatorSource(source, []);
    assert.equal(parsed.kind, "program");
    assert.ok(parsed.statements.length > 0);
  }
});

test("V7 registra las plantillas de turismo y transporte con sus ejemplos", () => {
  assert.equal(tourismTransportSources.length, 2);
  assert.deepEqual(tourismTransportExamples.map((example) => example.codigoFormula), [
    "FORM-TURISMO-DYNAMIC-PACKAGING-V1",
    "FORM-TRANSPORTE-TARIFICACION-V1"
  ]);
  assert.equal(tourismTransportExamples[0].parametros.pasajeros.length, 4);
  assert.equal(tourismTransportExamples[0].parametros.servicios.length, 3);
  assert.equal(tourismTransportExamples[1].parametros.encomiendasYEquipaje.length, 2);

  for (const source of tourismTransportSources) {
    const parsed = parseAviatorSource(source, []);
    assert.equal(parsed.kind, "program");
    assert.ok(parsed.statements.length > 0);
  }
});
