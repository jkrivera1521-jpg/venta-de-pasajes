import type { SchemaField } from "./types";
import type { FormulaBinaryOperator, FormulaExpression, FormulaFunctionName, FormulaProgram, FormulaStatement } from "./formula";

export type PayrollFormulaConfig = {
  inputValidations: Record<PayrollValidationField, PayrollInputValidation>;
  seniorityThresholds: [number, number, number];
  seniorityRates: [number, number, number];
  positionRates: [number, number, number];
  performanceThresholds: [number, number, number];
  performanceRates: [number, number, number];
  overtimeMultipliers: [number, number, number];
  progressiveThresholds: [number, number];
  progressiveRates: [number, number];
  classificationThresholds: [number, number];
};

export type PayrollValidationOperator = "<" | "<=" | ">" | ">=" | "==" | "!=";
export type PayrollValidationField = "salarioMensual" | "diasMes" | "diasTrabajados" | "calificacionDesempeno";
export type PayrollInputValidation = {
  conditions: { operator: PayrollValidationOperator; limit: number | "diasMes" }[];
  join: "||" | "&&";
  message: string;
};

export const PAYROLL_INPUT_FIELDS = [
  { key: "salarioMensual", label: "Salario mensual", prefix: "SALARY", count: 1 },
  { key: "diasMes", label: "Dias del mes", prefix: "MONTH_DAYS", count: 1 },
  { key: "diasTrabajados", label: "Dias trabajados", prefix: "WORKED_DAYS", count: 2 },
  { key: "calificacionDesempeno", label: "Calificacion de desempeno", prefix: "SCORE", count: 2 }
] as const;

type LegacyPayrollValidation = {
  salaryValidationOperator?: PayrollValidationOperator;
  salaryValidationLimit?: number;
  salaryValidationMessage?: string;
};

export const DEFAULT_PAYROLL_CONFIG: PayrollFormulaConfig = {
  inputValidations: {
    salarioMensual: { conditions: [{ operator: "<=", limit: 0 }], join: "||", message: "El salario mensual debe ser mayor que cero" },
    diasMes: { conditions: [{ operator: "<=", limit: 0 }], join: "||", message: "Los dias del mes deben ser mayores que cero" },
    diasTrabajados: { conditions: [{ operator: "<", limit: 0 }, { operator: ">", limit: "diasMes" }], join: "||", message: "Los dias trabajados estan fuera del rango permitido" },
    calificacionDesempeno: { conditions: [{ operator: "<", limit: 0 }, { operator: ">", limit: 100 }], join: "||", message: "La calificacion debe estar entre 0 y 100" }
  },
  seniorityThresholds: [10, 5, 2],
  seniorityRates: [0.12, 0.08, 0.04],
  positionRates: [0.05, 0.1, 0.15],
  performanceThresholds: [95, 90, 80],
  performanceRates: [0.15, 0.1, 0.05],
  overtimeMultipliers: [1.5, 2, 2.5],
  progressiveThresholds: [1500, 2000],
  progressiveRates: [0.05, 0.08],
  classificationThresholds: [1000, 2000]
};

export function normalizePayrollConfig(config?: (Partial<PayrollFormulaConfig> & LegacyPayrollValidation) | null): PayrollFormulaConfig {
  const inputValidations = Object.fromEntries(PAYROLL_INPUT_FIELDS.map(({ key }) => {
    const rule = config?.inputValidations?.[key] ?? DEFAULT_PAYROLL_CONFIG.inputValidations[key];
    return [key, structuredClone(rule)];
  })) as PayrollFormulaConfig["inputValidations"];
  // Older drafts stored only the editable salary guard. Preserve it on migration.
  if (!config?.inputValidations?.salarioMensual) {
    const salary = inputValidations.salarioMensual;
    salary.conditions[0].operator = config?.salaryValidationOperator ?? salary.conditions[0].operator;
    salary.conditions[0].limit = config?.salaryValidationLimit ?? salary.conditions[0].limit;
    salary.message = config?.salaryValidationMessage ?? salary.message;
  }
  return {
    inputValidations,
    seniorityThresholds: config?.seniorityThresholds ?? [...DEFAULT_PAYROLL_CONFIG.seniorityThresholds],
    seniorityRates: config?.seniorityRates ?? [...DEFAULT_PAYROLL_CONFIG.seniorityRates],
    positionRates: config?.positionRates ?? [...DEFAULT_PAYROLL_CONFIG.positionRates],
    performanceThresholds: config?.performanceThresholds ?? [...DEFAULT_PAYROLL_CONFIG.performanceThresholds],
    performanceRates: config?.performanceRates ?? [...DEFAULT_PAYROLL_CONFIG.performanceRates],
    overtimeMultipliers: config?.overtimeMultipliers ?? [...DEFAULT_PAYROLL_CONFIG.overtimeMultipliers],
    progressiveThresholds: config?.progressiveThresholds ?? [...DEFAULT_PAYROLL_CONFIG.progressiveThresholds],
    progressiveRates: config?.progressiveRates ?? [...DEFAULT_PAYROLL_CONFIG.progressiveRates],
    classificationThresholds: config?.classificationThresholds ?? [...DEFAULT_PAYROLL_CONFIG.classificationThresholds]
  };
}

type PayrollExpr = FormulaExpression;

function payrollNumber(value: number): PayrollExpr {
  return { kind: "literal", valueType: "number", value };
}

function payrollText(value: string): PayrollExpr {
  return { kind: "literal", valueType: "string", value };
}

function payrollVariable(key: string, valueType: PayrollExpr["valueType"] = "unknown"): PayrollExpr {
  return { kind: "variable", key, valueType };
}

function payrollMember(object: PayrollExpr, property: string, valueType: PayrollExpr["valueType"] = "unknown"): PayrollExpr {
  return { kind: "member", object, property, valueType };
}

function payrollBinary(operator: FormulaBinaryOperator, left: PayrollExpr, right: PayrollExpr): PayrollExpr {
  const boolean = ["==", "!=", "=~", ">", ">=", "<", "<=", "&&", "||"].includes(operator);
  return { kind: "binary", operator, left, right, valueType: boolean ? "boolean" : "number" };
}

function payrollCall(name: FormulaFunctionName, args: PayrollExpr[], valueType: PayrollExpr["valueType"]): PayrollExpr {
  return { kind: "call", name, args, valueType };
}

function payrollCondition(
  key: string,
  condition: { operator: PayrollValidationOperator; limit: number | "diasMes" }
) {
  const limit = typeof condition.limit === "number" ? payrollNumber(condition.limit) : payrollVariable(condition.limit, "number");
  return payrollBinary(condition.operator, payrollVariable(key, "number"), limit);
}

function payrollObject(entries: { key: string; value: PayrollExpr }[]): PayrollExpr {
  return { kind: "object", entries, valueType: "object" };
}

function payrollIf(
  condition: PayrollExpr,
  then: FormulaStatement[],
  elseIf: { condition: PayrollExpr; body: FormulaStatement[] }[] = [],
  otherwise: FormulaStatement[] = []
): FormulaStatement {
  return { kind: "if", condition, then, elseIf, otherwise };
}

function payrollDeclaration(name: string, value: PayrollExpr): FormulaStatement {
  return { kind: "declaration", name, value };
}

function payrollAssignment(name: string, value: PayrollExpr): FormulaStatement {
  return { kind: "assignment", name, value };
}

/**
 * Builds the advanced payroll as the same generic AST used by the visual editor.
 * This keeps every statement visible as a real Blockly block instead of hiding
 * the calculation inside a payroll summary block.
 */
export function payrollProgramFromConfig(inputConfig: PayrollFormulaConfig): FormulaProgram {
  const config = normalizePayrollConfig(inputConfig);
  const v = payrollVariable;
  const n = payrollNumber;
  const member = payrollMember;
  const binary = payrollBinary;
  const call = payrollCall;
  const add = (left: PayrollExpr, right: PayrollExpr) => binary("+", left, right);
  const multiply = (left: PayrollExpr, right: PayrollExpr) => binary("*", left, right);
  const subtract = (left: PayrollExpr, right: PayrollExpr) => binary("-", left, right);
  const divide = (left: PayrollExpr, right: PayrollExpr) => binary("/", left, right);
  const section = (title: string): FormulaStatement => ({ kind: "section", title });

  const statements: FormulaStatement[] = [section("Validacion de datos de entrada")];
  for (const { key } of PAYROLL_INPUT_FIELDS) {
    const rule = config.inputValidations[key];
    const conditions = rule.conditions.map((condition) => payrollCondition(key, condition));
    const rejected = conditions.slice(1).reduce(
      (current, condition) => binary(rule.join, current, condition),
      conditions[0]
    );
    statements.push(payrollIf(rejected, [{ kind: "throw", message: payrollText(rule.message) }]));
  }

  statements.push(
    section("Salario base y bonificaciones por antiguedad"),
    payrollDeclaration("salarioBase", divide(multiply(v("salarioMensual", "number"), v("diasTrabajados", "number")), v("diasMes", "number"))),
    payrollDeclaration("bonificacionAntiguedad", n(0)),
    payrollIf(
      binary(">=", v("aniosAntiguedad", "number"), n(config.seniorityThresholds[0])),
      [payrollAssignment("bonificacionAntiguedad", multiply(v("salarioBase", "number"), n(config.seniorityRates[0])))],
      [
        { condition: binary(">=", v("aniosAntiguedad", "number"), n(config.seniorityThresholds[1])), body: [payrollAssignment("bonificacionAntiguedad", multiply(v("salarioBase", "number"), n(config.seniorityRates[1])))] },
        { condition: binary(">=", v("aniosAntiguedad", "number"), n(config.seniorityThresholds[2])), body: [payrollAssignment("bonificacionAntiguedad", multiply(v("salarioBase", "number"), n(config.seniorityRates[2])))] }
      ],
      [payrollAssignment("bonificacionAntiguedad", n(0))]
    ),
    section("Bonificacion por cargo"),
    payrollDeclaration("bonificacionCargo", n(0)),
    payrollIf(
      binary("==", v("tipoEmpleado", "string"), payrollText("TECNICO")),
      [payrollAssignment("bonificacionCargo", multiply(v("salarioBase", "number"), n(config.positionRates[0])))],
      [
        { condition: binary("==", v("tipoEmpleado", "string"), payrollText("SUPERVISOR")), body: [payrollAssignment("bonificacionCargo", multiply(v("salarioBase", "number"), n(config.positionRates[1])))] },
        { condition: binary("==", v("tipoEmpleado", "string"), payrollText("GERENTE")), body: [payrollAssignment("bonificacionCargo", multiply(v("salarioBase", "number"), n(config.positionRates[2])))] }
      ],
      [payrollAssignment("bonificacionCargo", n(0))]
    ),
    section("Bonificacion por desempeno"),
    payrollDeclaration("bonificacionDesempeno", n(0)),
    payrollIf(
      binary(">=", v("calificacionDesempeno", "number"), n(config.performanceThresholds[0])),
      [payrollAssignment("bonificacionDesempeno", multiply(v("salarioBase", "number"), n(config.performanceRates[0])))],
      [
        { condition: binary(">=", v("calificacionDesempeno", "number"), n(config.performanceThresholds[1])), body: [payrollAssignment("bonificacionDesempeno", multiply(v("salarioBase", "number"), n(config.performanceRates[1])))] },
        { condition: binary(">=", v("calificacionDesempeno", "number"), n(config.performanceThresholds[2])), body: [payrollAssignment("bonificacionDesempeno", multiply(v("salarioBase", "number"), n(config.performanceRates[2])))] }
      ],
      [payrollAssignment("bonificacionDesempeno", n(0))]
    ),
    section("Calculo de horas extra"),
    payrollDeclaration("valorHora", divide(v("salarioMensual", "number"), n(240))),
    payrollDeclaration("totalHorasExtras", n(0)),
    payrollDeclaration("detalleHorasExtras", call("seq.list", [], "array")),
    {
      kind: "for",
      item: "item",
      collection: v("horasExtras", "array"),
      body: [
        payrollDeclaration("horas", member(v("item", "object"), "horas", "number")),
        payrollDeclaration("multiplicador", n(0)),
        payrollIf(binary("<=", v("horas", "number"), n(0)), [{ kind: "continue" }]),
        payrollIf(
          binary("==", member(v("item", "object"), "tipo", "string"), payrollText("DIURNA")),
          [payrollAssignment("multiplicador", n(config.overtimeMultipliers[0]))],
          [
            { condition: binary("==", member(v("item", "object"), "tipo", "string"), payrollText("NOCTURNA")), body: [payrollAssignment("multiplicador", n(config.overtimeMultipliers[1]))] },
            { condition: binary("==", member(v("item", "object"), "tipo", "string"), payrollText("FERIADO")), body: [payrollAssignment("multiplicador", n(config.overtimeMultipliers[2]))] }
          ],
          [{ kind: "throw", message: payrollText("Tipo de hora extra no reconocido") }]
        ),
        payrollDeclaration("importe", multiply(multiply(v("valorHora", "number"), v("horas", "number")), v("multiplicador", "number"))),
        payrollAssignment("totalHorasExtras", add(v("totalHorasExtras", "number"), v("importe", "number"))),
        {
          kind: "expression",
          expression: call("seq.add", [
            v("detalleHorasExtras", "array"),
            payrollObject([
              { key: "tipo", value: member(v("item", "object"), "tipo", "string") },
              { key: "horas", value: v("horas", "number") },
              { key: "multiplicador", value: v("multiplicador", "number") },
              { key: "importe", value: v("importe", "number") }
            ])
          ], "array")
        }
      ]
    },
    section("Descuento progresivo y salario neto"),
    payrollDeclaration("totalBonificaciones", add(add(v("bonificacionAntiguedad", "number"), v("bonificacionCargo", "number")), v("bonificacionDesempeno", "number"))),
    payrollDeclaration("ingresosBrutos", add(add(v("salarioBase", "number"), v("totalBonificaciones", "number")), v("totalHorasExtras", "number"))),
    payrollDeclaration("descuentoProgresivo", n(0)),
    payrollIf(
      binary("<=", v("ingresosBrutos", "number"), n(config.progressiveThresholds[0])),
      [payrollAssignment("descuentoProgresivo", n(0))],
      [
        { condition: binary("<=", v("ingresosBrutos", "number"), n(config.progressiveThresholds[1])), body: [payrollAssignment("descuentoProgresivo", multiply(subtract(v("ingresosBrutos", "number"), n(config.progressiveThresholds[0])), n(config.progressiveRates[0])))] }
      ],
      [payrollAssignment("descuentoProgresivo", add(
        multiply(subtract(n(config.progressiveThresholds[1]), n(config.progressiveThresholds[0])), n(config.progressiveRates[0])),
        multiply(subtract(v("ingresosBrutos", "number"), n(config.progressiveThresholds[1])), n(config.progressiveRates[1]))
      ))]
    ),
    section("Descuentos adicionales y desglose devuelto"),
    payrollDeclaration("totalDescuentosAdicionales", n(0)),
    payrollDeclaration("detalleDescuentos", call("seq.list", [], "array")),
    {
      kind: "for",
      item: "descuento",
      collection: v("descuentosAdicionales", "array"),
      body: [
        payrollIf(binary("<", member(v("descuento", "object"), "valor", "number"), n(0)), [{ kind: "throw", message: payrollText("Un descuento no puede ser negativo") }]),
        payrollAssignment("totalDescuentosAdicionales", add(v("totalDescuentosAdicionales", "number"), member(v("descuento", "object"), "valor", "number"))),
        {
          kind: "expression",
          expression: call("seq.add", [
            v("detalleDescuentos", "array"),
            payrollObject([
              { key: "concepto", value: member(v("descuento", "object"), "concepto", "string") },
              { key: "valor", value: member(v("descuento", "object"), "valor", "number") }
            ])
          ], "array")
        }
      ]
    },
    payrollDeclaration("totalDescuentos", add(v("descuentoProgresivo", "number"), v("totalDescuentosAdicionales", "number"))),
    payrollDeclaration("salarioNeto", subtract(v("ingresosBrutos", "number"), v("totalDescuentos", "number"))),
    payrollDeclaration("clasificacion", payrollText("")),
    payrollIf(
      binary("<", v("salarioNeto", "number"), n(0)),
      [payrollAssignment("clasificacion", payrollText("ERROR_SALDO_NEGATIVO"))],
      [
        { condition: binary("<", v("salarioNeto", "number"), n(config.classificationThresholds[0])), body: [payrollAssignment("clasificacion", payrollText("NOMINA_BAJA"))] },
        { condition: binary("<=", v("salarioNeto", "number"), n(config.classificationThresholds[1])), body: [payrollAssignment("clasificacion", payrollText("NOMINA_MEDIA"))] }
      ],
      [payrollAssignment("clasificacion", payrollText("NOMINA_ALTA"))]
    ),
    {
      kind: "return",
      value: payrollObject([
        { key: "salarioBase", value: v("salarioBase", "number") },
        { key: "bonificacionAntiguedad", value: v("bonificacionAntiguedad", "number") },
        { key: "bonificacionCargo", value: v("bonificacionCargo", "number") },
        { key: "bonificacionDesempeno", value: v("bonificacionDesempeno", "number") },
        { key: "totalBonificaciones", value: v("totalBonificaciones", "number") },
        { key: "totalHorasExtras", value: v("totalHorasExtras", "number") },
        { key: "detalleHorasExtras", value: v("detalleHorasExtras", "array") },
        { key: "ingresosBrutos", value: v("ingresosBrutos", "number") },
        { key: "descuentoProgresivo", value: v("descuentoProgresivo", "number") },
        { key: "detalleDescuentos", value: v("detalleDescuentos", "array") },
        { key: "totalDescuentosAdicionales", value: v("totalDescuentosAdicionales", "number") },
        { key: "totalDescuentos", value: v("totalDescuentos", "number") },
        { key: "salarioNeto", value: v("salarioNeto", "number") },
        { key: "clasificacion", value: v("clasificacion", "string") }
      ])
    }
  );

  return { kind: "program", statements, valueType: "object" };
}

export function validatePayrollInputValidations(config: PayrollFormulaConfig, allowEmptyMessage = false) {
  const issues: { field: PayrollValidationField; message: string }[] = [];
  for (const { key, label, count } of PAYROLL_INPUT_FIELDS) {
    const rule = config.inputValidations[key];
    if (!rule || !Array.isArray(rule.conditions) || rule.conditions.length !== count) {
      issues.push({ field: key, message: `La validacion de ${label} necesita ${count} condicion(es).` });
      continue;
    }
    if (typeof rule.message !== "string" || (!allowEmptyMessage && !rule.message.trim())) {
      issues.push({ field: key, message: `Escribe el mensaje de error de ${label}.` });
    }
    if (!["||", "&&"].includes(rule.join)) {
      issues.push({ field: key, message: `Selecciona O / Y para la validacion de ${label}.` });
    }
    rule.conditions.forEach((condition, index) => {
      if (!condition || !["<", "<=", ">", ">=", "==", "!="].includes(condition.operator)) {
        issues.push({ field: key, message: `Selecciona un comparador valido para ${label}.` });
      }
      const limit = condition?.limit;
      const validReference = key === "diasTrabajados" && index === 1 && limit === "diasMes";
      if (!validReference && (typeof limit !== "number" || !Number.isFinite(limit))) {
        issues.push({ field: key, message: `El limite de ${label} debe ser un numero valido.` });
      }
    });
  }
  return issues;
}

function generateInputValidations(config: PayrollFormulaConfig) {
  const [issue] = validatePayrollInputValidations(config, true);
  if (issue) throw new Error(issue.message);
  return PAYROLL_INPUT_FIELDS.map(({ key }) => {
    const rule = config.inputValidations[key];
    const condition = rule.conditions.map(({ operator, limit }) =>
      `${key} ${operator} ${typeof limit === "number" ? number(limit) : limit}`
    ).join(` ${rule.join} `);
    return `if (${condition}) {\n    throw ${JSON.stringify(rule.message)};\n}`;
  }).join("\n");
}

export const PAYROLL_SCHEMA: SchemaField[] = [
  { key: "salarioMensual", label: "Salario mensual", type: "number" },
  { key: "diasMes", label: "Dias del mes", type: "number" },
  { key: "diasTrabajados", label: "Dias trabajados", type: "number" },
  { key: "aniosAntiguedad", label: "Antiguedad en anos", type: "number" },
  { key: "tipoEmpleado", label: "Tipo de empleado", type: "enum", options: ["TECNICO", "SUPERVISOR", "GERENTE"] },
  { key: "calificacionDesempeno", label: "Calificacion de desempeno", type: "number" },
  { key: "horasExtras", label: "Horas extra", type: "unknown", description: "Lista de horas con tipo DIURNA, NOCTURNA o FERIADO." },
  { key: "descuentosAdicionales", label: "Descuentos adicionales", type: "unknown", description: "Lista de descuentos con concepto y valor." }
];

function number(value: number) {
  if (!Number.isFinite(value)) throw new Error("La configuracion de la formula contiene un numero invalido.");
  return String(value);
}

export function generatePayrollAviatorScript(inputConfig: PayrollFormulaConfig) {
  const config = normalizePayrollConfig(inputConfig);
  const display = (value: number) => Number.isInteger(value) ? String(value) : String(Number(value.toFixed(4)));
  const displayPercent = (value: number) => display(value * 100);
  const [seniority10, seniority5, seniority2] = config.seniorityThresholds.map(number);
  const [seniorityRate10, seniorityRate5, seniorityRate2] = config.seniorityRates.map(number);
  const [technicianRate, supervisorRate, managerRate] = config.positionRates.map(number);
  const [performance95, performance90, performance80] = config.performanceThresholds.map(number);
  const [performanceRate95, performanceRate90, performanceRate80] = config.performanceRates.map(number);
  const [dayMultiplier, nightMultiplier, holidayMultiplier] = config.overtimeMultipliers.map(number);
  const [firstThreshold, secondThreshold] = config.progressiveThresholds.map(number);
  const [firstRate, secondRate] = config.progressiveRates.map(number);
  const [lowSalary, midSalary] = config.classificationThresholds.map(number);

  return `## Generado desde el bloque visual: Nomina avanzada
## Antiguedad (anos): ${config.seniorityThresholds.map(display).join(" / ")}
## Bonificacion antiguedad (%): ${config.seniorityRates.map(displayPercent).join(" / ")}
## Bonificacion por cargo (%): tecnico ${displayPercent(config.positionRates[0])}, supervisor ${displayPercent(config.positionRates[1])}, gerente ${displayPercent(config.positionRates[2])}
## Desempeno (puntos): ${config.performanceThresholds.map(display).join(" / ")}
## Bonificacion desempeno (%): ${config.performanceRates.map(displayPercent).join(" / ")}
## Horas extra: diurna x${display(config.overtimeMultipliers[0])}, nocturna x${display(config.overtimeMultipliers[1])}, feriado x${display(config.overtimeMultipliers[2])}
## Descuento progresivo: limites ${config.progressiveThresholds.map(display).join(" / ")}; tasas (%) ${config.progressiveRates.map(displayPercent).join(" / ")}
## Clasificacion neta: baja < ${display(config.classificationThresholds[0])}; media <= ${display(config.classificationThresholds[1])}

## Validacion de datos de entrada
${generateInputValidations(config)}

## Salario base y bonificaciones por antiguedad
let salarioBase = salarioMensual * diasTrabajados / diasMes;
let bonificacionAntiguedad = 0;
if (aniosAntiguedad >= ${seniority10}) {
    bonificacionAntiguedad = salarioBase * ${seniorityRate10};
} elsif (aniosAntiguedad >= ${seniority5}) {
    bonificacionAntiguedad = salarioBase * ${seniorityRate5};
} elsif (aniosAntiguedad >= ${seniority2}) {
    bonificacionAntiguedad = salarioBase * ${seniorityRate2};
} else {
    bonificacionAntiguedad = 0;
}

## Bonificacion por cargo
let bonificacionCargo = 0;
if (tipoEmpleado == "TECNICO") {
    bonificacionCargo = salarioBase * ${technicianRate};
} elsif (tipoEmpleado == "SUPERVISOR") {
    bonificacionCargo = salarioBase * ${supervisorRate};
} elsif (tipoEmpleado == "GERENTE") {
    bonificacionCargo = salarioBase * ${managerRate};
} else {
    bonificacionCargo = 0;
}

## Bonificacion por desempeno
let bonificacionDesempeno = 0;
if (calificacionDesempeno >= ${performance95}) {
    bonificacionDesempeno = salarioBase * ${performanceRate95};
} elsif (calificacionDesempeno >= ${performance90}) {
    bonificacionDesempeno = salarioBase * ${performanceRate90};
} elsif (calificacionDesempeno >= ${performance80}) {
    bonificacionDesempeno = salarioBase * ${performanceRate80};
} else {
    bonificacionDesempeno = 0;
}

## Calculo de horas extra
let valorHora = salarioMensual / 240.0;
let totalHorasExtras = 0;
let detalleHorasExtras = seq.list();
for item in horasExtras {
    let horas = item.horas;
    let multiplicador = 0;
    if (horas <= 0) {
        continue;
    }
    if (item.tipo == "DIURNA") {
        multiplicador = ${dayMultiplier};
    } elsif (item.tipo == "NOCTURNA") {
        multiplicador = ${nightMultiplier};
    } elsif (item.tipo == "FERIADO") {
        multiplicador = ${holidayMultiplier};
    } else {
        throw "Tipo de hora extra no reconocido";
    }
    let importe = valorHora * horas * multiplicador;
    totalHorasExtras = totalHorasExtras + importe;
    seq.add(detalleHorasExtras, seq.map(
        "tipo", item.tipo,
        "horas", horas,
        "multiplicador", multiplicador,
        "importe", importe
    ));
}

## Descuento progresivo y salario neto
let totalBonificaciones = bonificacionAntiguedad + bonificacionCargo + bonificacionDesempeno;
let ingresosBrutos = salarioBase + totalBonificaciones + totalHorasExtras;
let descuentoProgresivo = 0;
if (ingresosBrutos <= ${firstThreshold}) {
    descuentoProgresivo = 0;
} elsif (ingresosBrutos <= ${secondThreshold}) {
    descuentoProgresivo = (ingresosBrutos - ${firstThreshold}) * ${firstRate};
} else {
    descuentoProgresivo = (${secondThreshold} - ${firstThreshold}) * ${firstRate} + (ingresosBrutos - ${secondThreshold}) * ${secondRate};
}

## Descuentos adicionales y desglose devuelto
let totalDescuentosAdicionales = 0;
let detalleDescuentos = seq.list();
for descuento in descuentosAdicionales {
    if (descuento.valor < 0) {
        throw "Un descuento no puede ser negativo";
    }
    totalDescuentosAdicionales = totalDescuentosAdicionales + descuento.valor;
    seq.add(detalleDescuentos, seq.map(
        "concepto", descuento.concepto,
        "valor", descuento.valor
    ));
}

let totalDescuentos = descuentoProgresivo + totalDescuentosAdicionales;
let salarioNeto = ingresosBrutos - totalDescuentos;
let clasificacion = "";
if (salarioNeto < 0) {
    clasificacion = "ERROR_SALDO_NEGATIVO";
} elsif (salarioNeto < ${lowSalary}) {
    clasificacion = "NOMINA_BAJA";
} elsif (salarioNeto <= ${midSalary}) {
    clasificacion = "NOMINA_MEDIA";
} else {
    clasificacion = "NOMINA_ALTA";
}

return seq.map(
    "salarioBase", salarioBase,
    "bonificacionAntiguedad", bonificacionAntiguedad,
    "bonificacionCargo", bonificacionCargo,
    "bonificacionDesempeno", bonificacionDesempeno,
    "totalBonificaciones", totalBonificaciones,
    "totalHorasExtras", totalHorasExtras,
    "detalleHorasExtras", detalleHorasExtras,
    "ingresosBrutos", ingresosBrutos,
    "descuentoProgresivo", descuentoProgresivo,
    "detalleDescuentos", detalleDescuentos,
    "totalDescuentosAdicionales", totalDescuentosAdicionales,
    "totalDescuentos", totalDescuentos,
    "salarioNeto", salarioNeto,
    "clasificacion", clasificacion
);`;
}

export function payrollSchemaForTemplate(fields: SchemaField[]) {
  const result = [...fields];
  const keys = new Set(fields.map((field) => field.key));
  for (const field of PAYROLL_SCHEMA) {
    if (!keys.has(field.key)) result.push(field);
  }
  return result;
}

export function parseAdvancedPayrollConfig(source: string): PayrollFormulaConfig | null {
  const requiredParts = [
    "for item in horasExtras",
    "for descuento in descuentosAdicionales",
    "bonificacionAntiguedad",
    "bonificacionCargo",
    "bonificacionDesempeno",
    "descuentoProgresivo",
    'return seq.map('
  ];
  if (!requiredParts.every((part) => source.includes(part))) return null;

  const calculationsStart = source.indexOf("let salarioBase");
  if (calculationsStart < 0) return null;
  const guards = source.slice(0, calculationsStart).replace(/^\s*##[^\n]*/gm, "").trim();
  const guardPattern = /\s*if\s*\(([^{}]+?)\)\s*\{\s*throw\s+("(?:\\.|[^"\\])*")\s*;\s*\}/y;
  const inputValidations = {} as PayrollFormulaConfig["inputValidations"];
  const numberPattern = "([-+]?\\d+(?:\\.\\d+)?(?:[eE][-+]?\\d+)?)";
  const operandPattern = `(${numberPattern.slice(1, -1)}|diasMes)`;
  const operatorPattern = "(<=|>=|==|!=|<|>)";
  for (const { key, count } of PAYROLL_INPUT_FIELDS) {
    const guard = guardPattern.exec(guards);
    if (!guard) return null;
    const comparison = `${key}\\s*${operatorPattern}\\s*${operandPattern}`;
    const condition = guard[1].match(new RegExp(`^\\s*${comparison}\\s*(?:(\\|\\||&&)\\s*${comparison}\\s*)?$`));
    if (!condition || (condition[3] ? 2 : 1) !== count) return null;
    let message: unknown;
    try {
      message = JSON.parse(guard[2]);
    } catch {
      return null;
    }
    if (typeof message !== "string") return null;
    const limit = (value: string): number | "diasMes" => value === "diasMes" ? value : Number(value);
    inputValidations[key] = {
      conditions: [
        { operator: condition[1] as PayrollValidationOperator, limit: limit(condition[2]) },
        ...(count === 2 ? [{ operator: condition[4] as PayrollValidationOperator, limit: limit(condition[5]) }] : [])
      ],
      join: (condition[3] ?? "||") as PayrollInputValidation["join"],
      message
    };
  }
  if (guards.slice(guardPattern.lastIndex).trim()) return null;
  // Guards may use the same comparisons as the calculation tiers. Parse the tiers separately.
  source = source.slice(calculationsStart);
  const captures = (text: string, pattern: RegExp) => [...text.matchAll(pattern)].map((match) => Number(match[1]));
  const exactCapture = (text: string, pattern: RegExp) => {
    const match = text.match(pattern);
    return match ? Number(match[1]) : undefined;
  };
  const seniorityThresholds = captures(source, new RegExp(`aniosAntiguedad\\s*>=\\s*${numberPattern}`, "g"));
  const seniorityRates = captures(source, new RegExp(`bonificacionAntiguedad\\s*=\\s*salarioBase\\s*\\*\\s*${numberPattern}`, "g"));
  const positionRate = (role: string) => exactCapture(source, new RegExp(`tipoEmpleado\\s*==\\s*"${role}"\\s*\\)\\s*\\{\\s*bonificacionCargo\\s*=\\s*salarioBase\\s*\\*\\s*${numberPattern}`));
  const performanceThresholds = captures(source, new RegExp(`calificacionDesempeno\\s*>=\\s*${numberPattern}`, "g"));
  const performanceRates = captures(source, new RegExp(`bonificacionDesempeno\\s*=\\s*salarioBase\\s*\\*\\s*${numberPattern}`, "g"));
  const overtimeMultiplier = (kind: string) => exactCapture(source, new RegExp(`item\\.tipo\\s*==\\s*"${kind}"\\s*\\)\\s*\\{\\s*multiplicador\\s*=\\s*${numberPattern}`));
  const progressiveStart = source.indexOf("let descuentoProgresivo = 0;");
  const progressiveEnd = source.indexOf("let totalDescuentosAdicionales = 0;", progressiveStart);
  const progressive = source.slice(progressiveStart, progressiveEnd);
  const progressiveThresholds = captures(progressive, new RegExp(`ingresosBrutos\\s*<=\\s*${numberPattern}`, "g"));
  const progressiveRates = [...progressive.matchAll(new RegExp(`\\(ingresosBrutos\\s*-\\s*${numberPattern}\\)\\s*\\*\\s*${numberPattern}`, "g"))]
    .map((match) => Number(match[2]));
  const classificationStart = source.indexOf('let clasificacion = "";');
  const classificationEnd = source.indexOf("return seq.map(", classificationStart);
  const classification = source.slice(classificationStart, classificationEnd);
  const lowLimit = exactCapture(classification, new RegExp(`elsif\\s*\\(salarioNeto\\s*<\\s*${numberPattern}`));
  const middleLimit = exactCapture(classification, new RegExp(`elsif\\s*\\(salarioNeto\\s*<=\\s*${numberPattern}`));
  const config: PayrollFormulaConfig = {
    inputValidations,
    seniorityThresholds: seniorityThresholds as PayrollFormulaConfig["seniorityThresholds"],
    seniorityRates: seniorityRates as PayrollFormulaConfig["seniorityRates"],
    positionRates: [positionRate("TECNICO"), positionRate("SUPERVISOR"), positionRate("GERENTE")] as PayrollFormulaConfig["positionRates"],
    performanceThresholds: performanceThresholds as PayrollFormulaConfig["performanceThresholds"],
    performanceRates: performanceRates as PayrollFormulaConfig["performanceRates"],
    overtimeMultipliers: [overtimeMultiplier("DIURNA"), overtimeMultiplier("NOCTURNA"), overtimeMultiplier("FERIADO")] as PayrollFormulaConfig["overtimeMultipliers"],
    progressiveThresholds: progressiveThresholds as PayrollFormulaConfig["progressiveThresholds"],
    progressiveRates: progressiveRates as PayrollFormulaConfig["progressiveRates"],
    classificationThresholds: [lowLimit, middleLimit] as PayrollFormulaConfig["classificationThresholds"]
  };
  const values = [
    ...config.seniorityThresholds,
    ...config.seniorityRates,
    ...config.positionRates,
    ...config.performanceThresholds,
    ...config.performanceRates,
    ...config.overtimeMultipliers,
    ...config.progressiveThresholds,
    ...config.progressiveRates,
    ...config.classificationThresholds
  ];
  return values.length === 24
    && values.every((value) => Number.isFinite(value))
    && validatePayrollInputValidations(config).length === 0
    ? config
    : null;
}

function readNumber(data: unknown, key: string) {
  const value = (data as Record<string, unknown> | null)?.[key];
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`El dato ${key} debe ser un numero.`);
  return value;
}

function validationConditionMatches(value: number, operator: PayrollValidationOperator, limit: number) {
  switch (operator) {
    case "<": return value < limit;
    case "<=": return value <= limit;
    case ">": return value > limit;
    case ">=": return value >= limit;
    case "==": return value === limit;
    case "!=": return value !== limit;
  }
}

export function evaluatePayrollFormula(data: unknown, inputConfig: PayrollFormulaConfig) {
  const config = normalizePayrollConfig(inputConfig);
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Los datos de prueba deben ser un objeto.");
  const [issue] = validatePayrollInputValidations(config);
  if (issue) throw new Error(issue.message);
  for (const { key } of PAYROLL_INPUT_FIELDS) {
    const rule = config.inputValidations[key];
    const value = readNumber(data, key);
    const matches = (condition: PayrollInputValidation["conditions"][number]) => validationConditionMatches(
      value, condition.operator, typeof condition.limit === "number" ? condition.limit : readNumber(data, condition.limit)
    );
    const rejected = rule.join === "&&" ? rule.conditions.every(matches) : rule.conditions.some(matches);
    if (rejected) throw new Error(rule.message);
  }
  const salary = readNumber(data, "salarioMensual");
  const monthDays = readNumber(data, "diasMes");
  const workedDays = readNumber(data, "diasTrabajados");
  const seniority = readNumber(data, "aniosAntiguedad");
  const score = readNumber(data, "calificacionDesempeno");
  const role = (data as Record<string, unknown>).tipoEmpleado;

  const salaryBase = salary * workedDays / monthDays;
  const seniorityIndex = config.seniorityThresholds.findIndex((threshold) => seniority >= threshold);
  const seniorityBonus = seniorityIndex < 0 ? 0 : salaryBase * config.seniorityRates[seniorityIndex];
  const positionIndex = ["TECNICO", "SUPERVISOR", "GERENTE"].indexOf(String(role));
  const positionBonus = positionIndex < 0 ? 0 : salaryBase * config.positionRates[positionIndex];
  const performanceIndex = config.performanceThresholds.findIndex((threshold) => score >= threshold);
  const performanceBonus = performanceIndex < 0 ? 0 : salaryBase * config.performanceRates[performanceIndex];

  const overtimeInput = (data as Record<string, unknown>).horasExtras ?? [];
  if (!Array.isArray(overtimeInput)) throw new Error("horasExtras debe ser una lista.");
  const multipliers: Record<string, number> = {
    DIURNA: config.overtimeMultipliers[0],
    NOCTURNA: config.overtimeMultipliers[1],
    FERIADO: config.overtimeMultipliers[2]
  };
  const overtimeDetails: Record<string, unknown>[] = [];
  let overtimeTotal = 0;
  for (const value of overtimeInput) {
    if (!value || typeof value !== "object") throw new Error("Cada hora extra debe ser un objeto.");
    const item = value as Record<string, unknown>;
    if (typeof item.horas !== "number" || !Number.isFinite(item.horas)) throw new Error("Las horas extra deben incluir un numero de horas.");
    if (item.horas <= 0) continue;
    const multiplier = multipliers[String(item.tipo)];
    if (multiplier === undefined) throw new Error("Tipo de hora extra no reconocido");
    const amount = salary / 240 * item.horas * multiplier;
    overtimeTotal += amount;
    overtimeDetails.push({ tipo: item.tipo, horas: item.horas, multiplicador: multiplier, importe: amount });
  }

  const bonuses = seniorityBonus + positionBonus + performanceBonus;
  const grossIncome = salaryBase + bonuses + overtimeTotal;
  const [firstLimit, secondLimit] = config.progressiveThresholds;
  const [firstRate, secondRate] = config.progressiveRates;
  const progressiveDiscount = grossIncome <= firstLimit ? 0
    : grossIncome <= secondLimit ? (grossIncome - firstLimit) * firstRate
      : (secondLimit - firstLimit) * firstRate + (grossIncome - secondLimit) * secondRate;

  const discountsInput = (data as Record<string, unknown>).descuentosAdicionales ?? [];
  if (!Array.isArray(discountsInput)) throw new Error("descuentosAdicionales debe ser una lista.");
  const discountDetails: Record<string, unknown>[] = [];
  let additionalDiscounts = 0;
  for (const value of discountsInput) {
    if (!value || typeof value !== "object") throw new Error("Cada descuento debe ser un objeto.");
    const item = value as Record<string, unknown>;
    if (typeof item.valor !== "number" || !Number.isFinite(item.valor)) throw new Error("Cada descuento debe incluir un valor numerico.");
    if (item.valor < 0) throw new Error("Un descuento no puede ser negativo");
    additionalDiscounts += item.valor;
    discountDetails.push({ concepto: item.concepto, valor: item.valor });
  }

  const totalDiscounts = progressiveDiscount + additionalDiscounts;
  const netSalary = grossIncome - totalDiscounts;
  const [lowLimit, midLimit] = config.classificationThresholds;
  const classification = netSalary < 0 ? "ERROR_SALDO_NEGATIVO"
    : netSalary < lowLimit ? "NOMINA_BAJA"
      : netSalary <= midLimit ? "NOMINA_MEDIA" : "NOMINA_ALTA";

  return {
    salarioBase: salaryBase,
    bonificacionAntiguedad: seniorityBonus,
    bonificacionCargo: positionBonus,
    bonificacionDesempeno: performanceBonus,
    totalBonificaciones: bonuses,
    totalHorasExtras: overtimeTotal,
    detalleHorasExtras: overtimeDetails,
    ingresosBrutos: grossIncome,
    descuentoProgresivo: progressiveDiscount,
    detalleDescuentos: discountDetails,
    totalDescuentosAdicionales: additionalDiscounts,
    totalDescuentos: totalDiscounts,
    salarioNeto: netSalary,
    clasificacion: classification
  };
}
