import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  DEFAULT_PAYROLL_CONFIG, PAYROLL_INPUT_FIELDS, evaluatePayrollFormula,
  generatePayrollAviatorScript, normalizePayrollConfig, parseAdvancedPayrollConfig,
  validatePayrollInputValidations
} from "../lib/payroll-formula.ts";

const context = {
  salarioMensual: 1200, diasMes: 30, diasTrabajados: 26,
  aniosAntiguedad: 8, tipoEmpleado: "TECNICO", calificacionDesempeno: 92,
  horasExtras: [], descuentosAdicionales: []
};

test("diasMes <= 1 updates the script and rejects the exact boundary with the edited message", () => {
  const config = normalizePayrollConfig();
  const rule = config.inputValidations.diasMes;
  rule.conditions[0].limit = 1;
  rule.message = "Los dias del mes deben ser mayores que uno";
  assert.match(generatePayrollAviatorScript(config), /if \(diasMes <= 1\) \{\n    throw "Los dias del mes deben ser mayores que uno";/);
  for (const diasMes of [-1, 0, 1]) {
    assert.throws(() => evaluatePayrollFormula({ ...context, diasMes, diasTrabajados: 1 }, config), { message: rule.message });
  }
  assert.ok(Number.isFinite(evaluatePayrollFormula({ ...context, diasMes: 2, diasTrabajados: 1 }, config).salarioNeto));
  assert.deepEqual(parseAdvancedPayrollConfig(generatePayrollAviatorScript(config)), config);
  assert.equal(DEFAULT_PAYROLL_CONFIG.inputValidations.diasMes.conditions[0].limit, 0);
});

test("every input validation and comparison operator survives script round-trip", () => {
  for (const { key } of PAYROLL_INPUT_FIELDS) {
    for (const operator of ["<", "<=", ">", ">=", "==", "!="]) {
      const config = normalizePayrollConfig();
      const rule = config.inputValidations[key];
      rule.conditions[0] = { operator, limit: 1.25 };
      rule.message = `Validacion ${key}: "valor" no permitido\nRevisar`;
      assert.deepEqual(parseAdvancedPayrollConfig(generatePayrollAviatorScript(config)), config);
    }
  }
});

test("worked-day limits can use diasMes or an editable number", () => {
  const config = normalizePayrollConfig();
  const rule = config.inputValidations.diasTrabajados;
  rule.conditions[0] = { operator: "<=", limit: 1 };
  rule.message = "Dias trabajados fuera del nuevo rango";
  assert.throws(() => evaluatePayrollFormula({ ...context, diasTrabajados: 1 }, config), { message: rule.message });
  assert.throws(() => evaluatePayrollFormula({ ...context, diasTrabajados: 31 }, config), { message: rule.message });
  rule.conditions[1] = { operator: ">=", limit: 20 };
  assert.throws(() => evaluatePayrollFormula({ ...context, diasTrabajados: 20 }, config), { message: rule.message });
  assert.doesNotThrow(() => evaluatePayrollFormula({ ...context, diasTrabajados: 19 }, config));
  assert.deepEqual(parseAdvancedPayrollConfig(generatePayrollAviatorScript(config)), config);
});

test("score validation uses editable bounds, operators and O / Y", () => {
  const config = normalizePayrollConfig();
  const rule = config.inputValidations.calificacionDesempeno;
  rule.conditions = [{ operator: ">=", limit: 40 }, { operator: "<=", limit: 60 }];
  rule.join = "&&";
  rule.message = "Calificacion en intervalo rechazado";
  for (const score of [40, 50, 60]) {
    assert.throws(() => evaluatePayrollFormula({ ...context, calificacionDesempeno: score }, config), { message: rule.message });
  }
  assert.doesNotThrow(() => evaluatePayrollFormula({ ...context, calificacionDesempeno: 39 }, config));
  assert.deepEqual(parseAdvancedPayrollConfig(generatePayrollAviatorScript(config)), config);
});

test("legacy drafts retain the edited salary guard and default the other guards", () => {
  const { inputValidations, ...legacy } = normalizePayrollConfig();
  const migrated = normalizePayrollConfig({
    ...legacy, salaryValidationOperator: "<", salaryValidationLimit: 1,
    salaryValidationMessage: "Salario invalido"
  });
  assert.deepEqual(migrated.inputValidations.salarioMensual, {
    conditions: [{ operator: "<", limit: 1 }], join: "||", message: "Salario invalido"
  });
  assert.deepEqual(migrated.inputValidations.diasMes, inputValidations.diasMes);
  assert.deepEqual(normalizePayrollConfig(legacy), DEFAULT_PAYROLL_CONFIG);
  assert.deepEqual(normalizePayrollConfig(JSON.parse(JSON.stringify(migrated))), migrated);
});

test("the original database seed is still loadable without changing it", () => {
  const sql = readFileSync(new URL("../../../services/aviatorscript-service/src/main/resources/db/migration/V2__precargar_formula_nomina_avanzada.sql", import.meta.url), "utf8");
  const script = sql.split("$$")[1];
  assert.deepEqual(parseAdvancedPayrollConfig(script), DEFAULT_PAYROLL_CONFIG);
  assert.deepEqual(parseAdvancedPayrollConfig(generatePayrollAviatorScript(DEFAULT_PAYROLL_CONFIG)), DEFAULT_PAYROLL_CONFIG);
});

test("unsupported input guards are rejected instead of silently replaced", () => {
  const script = generatePayrollAviatorScript(DEFAULT_PAYROLL_CONFIG);
  assert.equal(parseAdvancedPayrollConfig(script.replace("diasMes <= 0", "diasMes + 1 <= 0")), null);
  assert.equal(parseAdvancedPayrollConfig(script.replace("diasTrabajados > diasMes", "diasTrabajados > otraVariable")), null);
  assert.equal(parseAdvancedPayrollConfig(script.replace("let salarioBase", 'if (diasMes == 1) { throw "extra"; }\nlet salarioBase')), null);
});

test("empty messages are editable but cannot pass validation or be tested", () => {
  const config = normalizePayrollConfig();
  config.inputValidations.diasMes.message = "";
  assert.doesNotThrow(() => generatePayrollAviatorScript(config));
  assert.equal(validatePayrollInputValidations(config)[0].field, "diasMes");
  assert.throws(() => evaluatePayrollFormula(context, config), /mensaje de error de Dias del mes/);
});

test("the first failed guard takes precedence over subsequent data errors", () => {
  assert.throws(() => evaluatePayrollFormula({ salarioMensual: -1 }, normalizePayrollConfig()), {
    message: "El salario mensual debe ser mayor que cero"
  });
});
