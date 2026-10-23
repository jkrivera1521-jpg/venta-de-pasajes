import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { test } from "node:test";
import * as Blockly from "blockly";

// Node's TS loader needs extensions; the app resolves these imports through Next.js.
const libUrl = new URL("../lib/", import.meta.url).href;
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (context.parentURL?.startsWith(libUrl) && /^\.\/[\w-]+$/.test(specifier)) {
      return nextResolve(`${specifier}.ts`, context);
    }
    return nextResolve(specifier, context);
  }
});
const { buildFormulaFromWorkspace, compactPayrollGraph, createNewPayrollGraph, createStarterFormula, decomposePayrollGraph, getUserVariableFields, loadFormulaExpression, refreshPayrollFormulaGraph, registerAviatorBlocks } = await import("../lib/blockly-editor.ts");
const { DEFAULT_PAYROLL_CONFIG, PAYROLL_SCHEMA, evaluatePayrollFormula, normalizePayrollConfig, payrollProgramFromConfig } = await import("../lib/payroll-formula.ts");
const { compileFormula, evaluateFormula } = await import("../lib/formula.ts");
const { parseAviatorSource, variablesForTemplate } = await import("../lib/formula-template.ts");

function workspace() {
  const result = new Blockly.Workspace();
  const createBlock = result.newBlock.bind(result);
  // Exercise real Blockly connections/serialization without SVG rendering in Node.
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

function initialWorkspace() {
  const result = workspace();
  const root = result.newBlock("aviator_formula");
  const payroll = result.newBlock("aviator_payroll");
  const validation = result.newBlock("aviator_payroll_validation");
  root.getInput("VALUE").connection.connect(payroll.outputConnection);
  payroll.getInput("FLOW").connection.connect(validation.previousConnection);
  return result;
}

test("all editable guards survive workspace serialization and graph reconstruction", () => {
  const original = initialWorkspace();
  const restored = workspace();
  try {
    const guard = original.getBlocksByType("aviator_payroll_validation")[0];
    guard.setFieldValue("1", "MONTH_DAYS_VALIDATION_LIMIT");
    guard.setFieldValue("Dias del mes mayores que uno", "MONTH_DAYS_VALIDATION_MESSAGE");
    guard.setFieldValue("NUMBER", "WORKED_DAYS_VALIDATION_SOURCE_2");
    guard.setFieldValue("20", "WORKED_DAYS_VALIDATION_LIMIT_2");
    guard.setFieldValue("&&", "SCORE_VALIDATION_JOIN");
    const expected = buildFormulaFromWorkspace(original, []).expression;
    Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(original), restored);
    refreshPayrollFormulaGraph(api, restored);
    assert.deepEqual(buildFormulaFromWorkspace(restored, []).expression, expected);
    assert.equal(restored.getBlocksByType("aviator_payroll_validation").length, 1);
    const oldGuard = restored.getBlocksByType("aviator_payroll_validation")[0];
    refreshPayrollFormulaGraph(api, restored);
    assert.equal(restored.getBlocksByType("aviator_payroll_validation")[0], oldGuard);

    restored.getBlocksByType("aviator_payroll")[0].setFieldValue("11", "SENIORITY_10");
    assert.doesNotThrow(() => refreshPayrollFormulaGraph(api, restored));
    assert.deepEqual(buildFormulaFromWorkspace(restored, []).expression.config.inputValidations, expected.config.inputValidations);
    assert.equal(restored.getTopBlocks(false).length, 1);
  } finally {
    original.dispose();
    restored.dispose();
  }
});

test("the generic program builder creates a structured AviatorScript program", () => {
  const created = workspace();
  try {
    registerAviatorBlocks(api, { current: [
      { key: "salarioMensual", label: "Salario mensual", type: "number" },
      { key: "diasTrabajados", label: "Dias trabajados", type: "number" },
      { key: "diasMes", label: "Dias del mes", type: "number" },
      { key: "horasExtras", label: "Horas extra", type: "unknown" }
    ] }, false);
    createStarterFormula(api, created, []);
    assert.equal(created.getBlocksByType("aviator_program").length, 1);
    assert.equal(created.getBlocksByType("aviator_return_statement").length, 0);
    assert.equal(created.getBlocksByType("aviator_program")[0].getInputTargetBlock("BODY"), null);
    const starter = buildFormulaFromWorkspace(created, []).expression;
    assert.equal(starter, undefined);

    const program = {
      kind: "program",
      valueType: "object",
      statements: [
        { kind: "section", title: "Validacion de datos de entrada" },
        { kind: "if", condition: { kind: "binary", operator: "<=", left: { kind: "variable", key: "salarioMensual", valueType: "number" }, right: { kind: "literal", valueType: "number", value: 0 }, valueType: "boolean" }, then: [{ kind: "throw", message: { kind: "literal", valueType: "string", value: "El salario mensual debe ser mayor que cero" } }], elseIf: [], otherwise: [] },
        { kind: "declaration", name: "salarioBase", value: { kind: "binary", operator: "/", left: { kind: "binary", operator: "*", left: { kind: "variable", key: "salarioMensual", valueType: "number" }, right: { kind: "variable", key: "diasTrabajados", valueType: "number" }, valueType: "number" }, right: { kind: "variable", key: "diasMes", valueType: "number" }, valueType: "number" } },
        { kind: "declaration", name: "detalle", value: { kind: "call", name: "seq.list", args: [], valueType: "array" } },
        { kind: "for", item: "item", collection: { kind: "variable", key: "horasExtras", valueType: "array" }, body: [
          { kind: "if", condition: { kind: "binary", operator: "<=", left: { kind: "member", object: { kind: "variable", key: "item", valueType: "object" }, property: "horas", valueType: "number" }, right: { kind: "literal", valueType: "number", value: 0 }, valueType: "boolean" }, then: [{ kind: "continue" }], elseIf: [], otherwise: [] },
          { kind: "expression", expression: { kind: "call", name: "seq.add", args: [{ kind: "variable", key: "detalle", valueType: "array" }, { kind: "object", entries: [{ key: "tipo", value: { kind: "member", object: { kind: "variable", key: "item", valueType: "object" }, property: "tipo", valueType: "string" } }] , valueType: "object" }], valueType: "array" } }
        ] },
        { kind: "return", value: { kind: "object", entries: [{ key: "salarioBase", value: { kind: "variable", key: "salarioBase", valueType: "number" } }, { key: "detalle", value: { kind: "variable", key: "detalle", valueType: "array" } }], valueType: "object" } }
      ]
    };
    loadFormulaExpression(api, created, program);
    const built = buildFormulaFromWorkspace(created, [
      { key: "salarioMensual", label: "Salario mensual", type: "number" },
      { key: "diasTrabajados", label: "Dias trabajados", type: "number" },
      { key: "diasMes", label: "Dias del mes", type: "number" },
      { key: "horasExtras", label: "Horas extra", type: "unknown" }
    ]).expression;
    assert.equal(created.getBlocksByType("aviator_program").length, 1);
    assert.equal(created.getBlocksByType("aviator_if_simple").length, 2);
    assert.equal(created.getBlocksByType("aviator_if_statement").length, 0);
    assert.equal(created.getBlocksByType("aviator_for_statement").length, 1);
    assert.equal(created.getBlocksByType("aviator_throw_statement").length, 1);
    assert.match(compileFormula(built), /if \(salarioMensual <= 0\)/);
    assert.match(compileFormula(built), /for item in horasExtras/);
    assert.deepEqual(evaluateFormula(built, { salarioMensual: 1200, diasTrabajados: 26, diasMes: 30, horasExtras: [{ tipo: "VACIA", horas: 0 }, { tipo: "DIURNA", horas: 2 }] }), { salarioBase: 1040, detalle: [{ tipo: "DIURNA" }] });
    assert.throws(() => evaluateFormula(built, { salarioMensual: 0, diasTrabajados: 26, diasMes: 30, horasExtras: [] }), /El salario mensual debe ser mayor que cero/);
  } finally {
    created.dispose();
    registerAviatorBlocks(api, { current: [] }, false);
  }
});

test("user JVM variables can be created on demand with an editable type", () => {
  const created = workspace();
  try {
    const root = created.newBlock("aviator_formula");
    const variable = created.newBlock("aviator_user_variable");
    variable.setFieldValue("montoPersonalizado", "FIELD");
    variable.setFieldValue("number", "TYPE");
    root.getInput("VALUE").connection.connect(variable.outputConnection);
    const userFields = getUserVariableFields(created);
    const built = buildFormulaFromWorkspace(created, userFields);
    assert.deepEqual(userFields, [{
      key: "montoPersonalizado",
      label: "montoPersonalizado",
      type: "number",
      description: "Variable JVM creada en esta formula."
    }]);
    assert.equal(compileFormula(built.expression), "montoPersonalizado");
    assert.equal(evaluateFormula(built.expression, { montoPersonalizado: 42 }), 42);
    assert.equal(built.issues.length, 0);
  } finally {
    created.dispose();
  }
});

test("currency JVM variables keep two decimal places", () => {
  const created = workspace();
  try {
    const root = created.newBlock("aviator_formula");
    const variable = created.newBlock("aviator_user_variable");
    variable.setFieldValue("precio", "FIELD");
    variable.setFieldValue("currency", "TYPE");
    root.getInput("VALUE").connection.connect(variable.outputConnection);
    const userFields = getUserVariableFields(created);
    const built = buildFormulaFromWorkspace(created, userFields);
    assert.deepEqual(userFields, [{
      key: "precio",
      label: "precio",
      type: "currency",
      description: "Variable JVM creada en esta formula."
    }]);
    assert.equal(built.expression.valueType, "currency");
    assert.equal(evaluateFormula(built.expression, { precio: 12.345 }), 12.35);
    assert.equal(built.issues.length, 0);
  } finally {
    created.dispose();
  }
});

test("template information lists context variables and excludes local variables", () => {
  const expression = parseAviatorSource("let total = salarioMensual + diasMes; return total;", PAYROLL_SCHEMA);
  assert.deepEqual(variablesForTemplate(expression, PAYROLL_SCHEMA).map((field) => [field.key, field.type]), [
    ["salarioMensual", "number"],
    ["diasMes", "number"]
  ]);
});

test("legacy Blockly fields keep the salary edit and initialize the remaining guards", () => {
  const original = initialWorkspace();
  const restored = workspace();
  try {
    const guard = original.getBlocksByType("aviator_payroll_validation")[0];
    guard.setFieldValue("1", "SALARY_VALIDATION_LIMIT");
    guard.setFieldValue("Salario mayor que uno", "SALARY_VALIDATION_MESSAGE");
    const saved = Blockly.serialization.workspaces.save(original);
    const fields = saved.blocks.blocks[0].inputs.VALUE.block.inputs.FLOW.block.fields;
    for (const key of Object.keys(fields)) {
      if (!key.startsWith("SALARY_")) delete fields[key];
    }
    Blockly.serialization.workspaces.load(saved, restored);
    refreshPayrollFormulaGraph(api, restored);
    const { inputValidations } = buildFormulaFromWorkspace(restored, []).expression.config;
    assert.equal(inputValidations.salarioMensual.conditions[0].limit, 1);
    assert.equal(inputValidations.salarioMensual.message, "Salario mayor que uno");
    assert.deepEqual(inputValidations.diasTrabajados, DEFAULT_PAYROLL_CONFIG.inputValidations.diasTrabajados);
    assert.deepEqual(inputValidations.calificacionDesempeno, DEFAULT_PAYROLL_CONFIG.inputValidations.calificacionDesempeno);
  } finally {
    original.dispose();
    restored.dispose();
  }
});

test("opening an AST draft restores edited guards in desktop and mobile blocks", () => {
  const config = normalizePayrollConfig();
  config.inputValidations.diasMes.conditions[0].limit = 1;
  config.inputValidations.diasMes.message = "Los dias del mes deben ser mayores que uno";
  config.inputValidations.diasTrabajados.conditions[1].limit = 20;
  const expression = { kind: "payroll", valueType: "object", config };
  for (const mobile of [false, true]) {
    registerAviatorBlocks(api, { current: [] }, mobile);
    const opened = workspace();
    try {
      loadFormulaExpression(api, opened, JSON.parse(JSON.stringify(expression)));
      assert.deepEqual(buildFormulaFromWorkspace(opened, []).expression, expression);
    } finally {
      opened.dispose();
    }
  }
  registerAviatorBlocks(api, { current: [] }, false);
});

test("advanced payroll can be decomposed, edited and compacted without changing its AST model", () => {
  const original = initialWorkspace();
  try {
    refreshPayrollFormulaGraph(api, original);
    const initial = buildFormulaFromWorkspace(original, []).expression;
    assert.equal(decomposePayrollGraph(api, original), true);
    assert.equal(original.getBlocksByType("aviator_payroll").length, 0);
    assert.equal(original.getBlocksByType("aviator_payroll_config").length, 0);
    for (const type of [
      "aviator_payroll_seniority_config",
      "aviator_payroll_position_config",
      "aviator_payroll_performance_config",
      "aviator_payroll_overtime_config",
      "aviator_payroll_progressive_config",
      "aviator_payroll_classification_config"
    ]) assert.equal(original.getBlocksByType(type).length, 1);
    assert.equal(original.getBlocksByType("aviator_payroll_result").length, 1);
    assert.equal(original.getBlocksByType("aviator_payroll_validation").length, 0);
    assert.equal(original.getBlocksByType("aviator_payroll_validation_salary").length, 0);
    assert.equal(original.getBlocksByType("aviator_payroll_validation_month_days").length, 0);
    assert.equal(original.getBlocksByType("aviator_payroll_validation_worked_days").length, 0);
    assert.equal(original.getBlocksByType("aviator_payroll_validation_score").length, 0);
    assert.equal(original.getBlocksByType("aviator_payroll_condition").length, 6);
    assert.equal(original.getBlocksByType("aviator_payroll_error").length, 4);
    assert.ok([
      "aviator_payroll_header_statement",
      "aviator_payroll_if_statement",
      "aviator_payroll_else_statement",
      "aviator_payroll_for_statement",
      "aviator_payroll_continue_statement",
      "aviator_payroll_throw_statement",
      "aviator_payroll_return_statement",
      "aviator_payroll_assignment_statement"
    ].reduce((total, type) => total + original.getBlocksByType(type).length, 0) > 20);
    assert.deepEqual(buildFormulaFromWorkspace(original, []).expression, initial);

    const parameters = original.getBlocksByType("aviator_payroll_seniority_config")[0];
    parameters.setFieldValue("11", "SENIORITY_10");
    const validation = original.getBlocksByType("aviator_payroll_condition").find((block) => block.data === "diasMes:0");
    validation.setFieldValue("1", "LIMIT");
    const validationError = original.getBlocksByType("aviator_payroll_error").find((block) => block.data === "diasMes");
    validationError.setFieldValue("Dias del mes mayores que uno", "MESSAGE");
    refreshPayrollFormulaGraph(api, original);
    const edited = buildFormulaFromWorkspace(original, []).expression;
    assert.equal(edited.config.seniorityThresholds[0], 11);
    assert.equal(edited.config.inputValidations.diasMes.conditions[0].limit, 1);
    assert.equal(edited.config.inputValidations.diasMes.message, "Dias del mes mayores que uno");

    const savedDecomposed = Blockly.serialization.workspaces.save(original);
    const reopened = workspace();
    try {
      Blockly.serialization.workspaces.load(savedDecomposed, reopened);
      refreshPayrollFormulaGraph(api, reopened);
      assert.deepEqual(buildFormulaFromWorkspace(reopened, []).expression, edited);
      assert.equal(compactPayrollGraph(api, reopened), true);
      assert.deepEqual(buildFormulaFromWorkspace(reopened, []).expression, edited);
    } finally {
      reopened.dispose();
    }

    assert.equal(compactPayrollGraph(api, original), true);
    assert.equal(original.getBlocksByType("aviator_payroll_config").length, 0);
    assert.equal(original.getBlocksByType("aviator_payroll").length, 1);
    assert.deepEqual(buildFormulaFromWorkspace(original, []).expression, edited);
  } finally {
    original.dispose();
  }
});

test("a new advanced payroll can be created without loading the formula catalog", () => {
  const created = workspace();
  try {
    const root = createNewPayrollGraph(api, created);
    assert.equal(root.type, "aviator_formula");
    assert.equal(created.getBlocksByType("aviator_payroll").length, 0);
    assert.equal(created.getBlocksByType("aviator_payroll_result").length, 1);
    assert.equal(created.getBlocksByType("aviator_payroll_seniority_config").length, 1);
    assert.equal(created.getBlocksByType("aviator_payroll_condition").length, 6);
    assert.equal(created.getBlocksByType("aviator_payroll_error").length, 4);

    const built = buildFormulaFromWorkspace(created, []).expression;
    assert.deepEqual(built.config, DEFAULT_PAYROLL_CONFIG);
    assert.deepEqual(evaluatePayrollFormula({
      salarioMensual: 1200,
      diasMes: 30,
      diasTrabajados: 26,
      aniosAntiguedad: 8,
      tipoEmpleado: "TECNICO",
      calificacionDesempeno: 92,
      horasExtras: [],
      descuentosAdicionales: []
    }, built.config), {
      salarioBase: 1040,
      bonificacionAntiguedad: 83.2,
      bonificacionCargo: 52,
      bonificacionDesempeno: 104,
      totalBonificaciones: 239.2,
      totalHorasExtras: 0,
      detalleHorasExtras: [],
      ingresosBrutos: 1279.2,
      descuentoProgresivo: 0,
      detalleDescuentos: [],
      totalDescuentosAdicionales: 0,
      totalDescuentos: 0,
      salarioNeto: 1279.2,
      clasificacion: "NOMINA_MEDIA"
    });
  } finally {
    created.dispose();
  }
});

test("advanced payroll is rendered as a real AviatorScript program", () => {
  const created = workspace();
  try {
    const program = payrollProgramFromConfig(DEFAULT_PAYROLL_CONFIG);
    loadFormulaExpression(api, created, program);
    const blocks = created.getAllBlocks(false).map((block) => block.type);
    assert.equal(created.getBlocksByType("aviator_program").length, 1);
    assert.ok(created.getBlocksByType("aviator_if_simple").length >= 5);
    assert.ok(created.getBlocksByType("aviator_if_statement").length >= 5);
    assert.equal(created.getBlocksByType("aviator_for_statement").length, 2);
    assert.ok(created.getBlocksByType("aviator_throw_statement").length >= 6);
    assert.equal(created.getBlocksByType("aviator_return_statement").length, 1);
    assert.ok(blocks.includes("aviator_object"));
    assert.ok(blocks.includes("aviator_list_add"));

    const built = buildFormulaFromWorkspace(created, PAYROLL_SCHEMA).expression;
    assert.equal(built.kind, "program");
    assert.match(compileFormula(built), /for item in horasExtras/);
    assert.match(compileFormula(built), /return seq\.map\(/);
    const result = evaluateFormula(built, {
      salarioMensual: 1800,
      diasMes: 30,
      diasTrabajados: 26,
      aniosAntiguedad: 8,
      tipoEmpleado: "TECNICO",
      calificacionDesempeno: 92,
      horasExtras: [
        { horas: 5, tipo: "DIURNA" },
        { horas: 3, tipo: "NOCTURNA" },
        { horas: 2, tipo: "FERIADO" }
      ],
      descuentosAdicionales: [
        { concepto: "PRESTAMO", valor: 75 },
        { concepto: "ANTICIPO", valor: 40 }
      ]
    });
    assert.equal(result.salarioBase, 1560);
    assert.equal(result.bonificacionAntiguedad, 124.8);
    assert.equal(result.bonificacionCargo, 78);
    assert.equal(result.bonificacionDesempeno, 156);
    assert.equal(result.totalBonificaciones, 358.8);
    assert.equal(result.totalHorasExtras, 138.75);
    assert.deepEqual(result.detalleHorasExtras, [
      { tipo: "DIURNA", horas: 5, multiplicador: 1.5, importe: 56.25 },
      { tipo: "NOCTURNA", horas: 3, multiplicador: 2, importe: 45 },
      { tipo: "FERIADO", horas: 2, multiplicador: 2.5, importe: 37.5 }
    ]);
    assert.ok(Math.abs(result.ingresosBrutos - 2057.55) < 1e-9);
    assert.ok(Math.abs(result.descuentoProgresivo - 29.604) < 1e-9);
    assert.deepEqual(result.detalleDescuentos, [
      { concepto: "PRESTAMO", valor: 75 },
      { concepto: "ANTICIPO", valor: 40 }
    ]);
    assert.equal(result.totalDescuentosAdicionales, 115);
    assert.ok(Math.abs(result.totalDescuentos - 144.604) < 1e-9);
    assert.ok(Math.abs(result.salarioNeto - 1912.946) < 1e-9);
    assert.equal(result.clasificacion, "NOMINA_MEDIA");
  } finally {
    created.dispose();
  }
});

test("an outer if keeps the complete program body nested inside its THEN branch", () => {
  const created = workspace();
  try {
    const source = `if (1 == 1) {\n${compileFormula(payrollProgramFromConfig(DEFAULT_PAYROLL_CONFIG))}\n}`;
    const parsed = parseAviatorSource(source, PAYROLL_SCHEMA);
    loadFormulaExpression(api, created, parsed);

    const root = created.getBlocksByType("aviator_program")[0];
    const outerIf = root.getInputTargetBlock("BODY");
    assert.ok(outerIf);
    assert.equal(outerIf.type, "aviator_if_simple");

    const nestedStatements = [];
    let current = outerIf.getInputTargetBlock("THEN");
    while (current) {
      nestedStatements.push(current.type);
      current = current.getNextBlock();
    }
    assert.equal(nestedStatements[0], "aviator_section");
    assert.equal(nestedStatements.at(-1), "aviator_return_statement");
    assert.ok(nestedStatements.includes("aviator_for_statement"));
    assert.ok(outerIf.getDescendants().some((block) => block.type === "aviator_throw_statement"));
  } finally {
    created.dispose();
  }
});

test("edited AviatorScript round-trips through the visual graph and evaluator", () => {
  const source = compileFormula(payrollProgramFromConfig(DEFAULT_PAYROLL_CONFIG));
  const parsed = parseAviatorSource(source, PAYROLL_SCHEMA);
  assert.equal(parsed.kind, "program");
  assert.equal(parsed.valueType, "object");
  assert.match(source, /for item in horasExtras/);
  assert.match(source, /return seq\.map\(/);

  const result = evaluateFormula(parsed, {
    salarioMensual: 1800,
    diasMes: 30,
    diasTrabajados: 26,
    aniosAntiguedad: 8,
    tipoEmpleado: "TECNICO",
    calificacionDesempeno: 92,
    horasExtras: [
      { horas: 5, tipo: "DIURNA" },
      { horas: 3, tipo: "NOCTURNA" },
      { horas: 2, tipo: "FERIADO" }
    ],
    descuentosAdicionales: [
      { concepto: "PRESTAMO", valor: 75 },
      { concepto: "ANTICIPO", valor: 40 }
    ]
  });
  assert.ok(Math.abs(result.salarioNeto - 1912.946) < 1e-9);
  assert.equal(result.clasificacion, "NOMINA_MEDIA");
});
