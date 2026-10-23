import type { FormulaExpression, FormulaRoot, FormulaStatement, FormulaValueType } from "./formula";
import { PAYROLL_SCHEMA } from "./payroll-formula";
import { roundCurrency, type SchemaField, type SchemaFieldType } from "./types";

const PAYROLL_ARRAY_SAMPLES: Record<string, unknown> = {
  horasExtras: [
    { horas: 5, tipo: "DIURNA" },
    { horas: 3, tipo: "NOCTURNA" },
    { horas: 2, tipo: "FERIADO" }
  ],
  descuentosAdicionales: [
    { concepto: "PRESTAMO", valor: 75 },
    { concepto: "ANTICIPO", valor: 40 }
  ]
};

export type FormulaTestRequest = {
  idSolicitud: string;
  codigoFormula: string;
  parametros: Record<string, unknown>;
};

export type FormulaTestPayloadMetadata = Partial<Pick<FormulaTestRequest, "idSolicitud" | "codigoFormula">>;

const BLOCKED_PATH_PARTS = new Set(["__proto__", "prototype", "constructor"]);

function getPathValue(source: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((current, part) => {
    if (!part || BLOCKED_PATH_PARTS.has(part) || !current || typeof current !== "object") return undefined;
    if (!Object.prototype.hasOwnProperty.call(current, part)) return undefined;
    return (current as Record<string, unknown>)[part];
  }, source);
}

function setPathValue(target: Record<string, unknown>, path: string, value: unknown) {
  const parts = path.split(".");
  if (!parts.length || parts.some((part) => !part || BLOCKED_PATH_PARTS.has(part))) return;

  let current = target;
  for (const part of parts.slice(0, -1)) {
    const child = current[part];
    if (!child || typeof child !== "object" || Array.isArray(child)) current[part] = {};
    current = current[part] as Record<string, unknown>;
  }
  current[parts[parts.length - 1]] = value;
}

function concreteType(type: FormulaValueType | undefined): type is Exclude<FormulaValueType, "unknown" | "null" | "object" | "array" | "lambda"> {
  return Boolean(type && !["unknown", "null", "object", "array", "lambda"].includes(type));
}

function collectVariableTypes(expression: FormulaRoot, fields: SchemaField[]) {
  const fieldTypes = new Map(fields.map((field) => [field.key, field.type]));
  const variables = new Map<string, FormulaValueType>();

  function expressionType(node: FormulaExpression): FormulaValueType {
    if (node.kind === "variable") return fieldTypes.get(node.key) ?? node.valueType;
    return node.valueType;
  }

  function visit(node: FormulaExpression, expected?: FormulaValueType, locals = new Set<string>()) {
    if (node.kind === "payroll" || node.kind === "literal") return;
    if (node.kind === "variable") {
      if (locals.has(node.key)) return;
      const schemaType = fieldTypes.get(node.key);
      const type = schemaType && schemaType !== "unknown"
        ? schemaType
        : concreteType(node.valueType) ? node.valueType
          : expected === "array" || expected === "object" ? expected
            : concreteType(expected) ? expected : "unknown";
      const previous = variables.get(node.key);
      if (!previous || previous === "unknown" || type !== "unknown") variables.set(node.key, type);
      return;
    }
    if (node.kind === "member") {
      visit(node.object, "object", locals);
      return;
    }
    if (node.kind === "unary") {
      visit(node.operand, node.operator === "!" ? "boolean" : "number");
      return;
    }
    if (node.kind === "conditional") {
      visit(node.condition, "boolean", locals);
      visit(node.whenTrue, node.valueType, locals);
      visit(node.whenFalse, node.valueType, locals);
      return;
    }
    if (node.kind === "call") {
      if (["seq.count", "seq.filter", "seq.reduce", "seq.include"].includes(node.name)) {
        visit(node.args[0], "array", locals);
        if (node.name === "seq.filter" || node.name === "seq.reduce") visit(node.args[1], "lambda", locals);
        if (node.name === "seq.reduce") visit(node.args[2], "unknown", locals);
        if (node.name === "seq.include") visit(node.args[1], "unknown", locals);
        return;
      }
      const argumentType = node.name.startsWith("string.") ? "string" : "number";
      node.args.forEach((argument) => visit(argument, argumentType, locals));
      return;
    }
    if (node.kind === "lambda") {
      const lambdaLocals = new Set(locals);
      node.parameters.forEach((parameter) => lambdaLocals.add(parameter));
      visit(node.body, "unknown", lambdaLocals);
      return;
    }
    if (node.kind === "array") {
      node.items.forEach((item) => visit(item, "unknown", locals));
      return;
    }
    if (node.kind === "object") {
      node.entries.forEach(({ value }) => visit(value, "unknown", locals));
      return;
    }
    if (node.kind === "binary" && ["+", "-", "*", "/", "%", ">", ">=", "<", "<="].includes(node.operator)) {
      visit(node.left, "number", locals);
      visit(node.right, "number", locals);
      return;
    }
    if (node.kind === "binary" && (node.operator === "&&" || node.operator === "||")) {
      visit(node.left, "boolean", locals);
      visit(node.right, "boolean", locals);
      return;
    }
    if (node.kind === "binary") {
      visit(node.left, expressionType(node.right), locals);
      visit(node.right, expressionType(node.left), locals);
    }
  }

  function visitStatements(statements: FormulaStatement[], locals = new Set<string>()) {
    for (const statement of statements) {
      switch (statement.kind) {
        case "section":
        case "continue":
        case "break":
          break;
        case "declaration":
          visit(statement.value, "unknown", locals);
          locals.add(statement.name);
          break;
        case "assignment":
          visit(statement.value, "unknown", locals);
          locals.add(statement.name);
          break;
        case "expression": visit(statement.expression, "unknown", locals); break;
        case "throw": visit(statement.message, "string", locals); break;
        case "return": visit(statement.value, "unknown", locals); break;
        case "if":
          visit(statement.condition, "boolean", locals);
          visitStatements(statement.then, new Set(locals));
          statement.elseIf.forEach((branch) => {
            visit(branch.condition, "boolean", locals);
            visitStatements(branch.body, new Set(locals));
          });
          visitStatements(statement.otherwise, new Set(locals));
          break;
        case "for":
          visit(statement.collection, "array", locals);
          const loopLocals = new Set(locals);
          loopLocals.add(statement.item);
          visitStatements(statement.body, loopLocals);
          break;
        case "while":
          visit(statement.condition, "boolean", locals);
          visitStatements(statement.body, new Set(locals));
          break;
      }
    }
  }

  if (expression.kind === "program") visitStatements(expression.statements);
  else visit(expression);
  return variables;
}

function isAdvancedPayrollExpression(expression: FormulaRoot, fields: SchemaField[]) {
  if (expression.kind === "payroll") return true;
  const variableKeys = collectVariableTypes(expression, fields);
  return [
    "salarioMensual",
    "diasMes",
    "diasTrabajados",
    "aniosAntiguedad",
    "tipoEmpleado",
    "calificacionDesempeno",
    "horasExtras",
    "descuentosAdicionales"
  ].every((key) => variableKeys.has(key));
}

function inferUnknownType(key: string): SchemaFieldType {
  const normalized = key.toLowerCase();
  if (/^(is|has|can|should)[._]|vip|activo|active|habilitado|enabled/.test(normalized)) return "boolean";
  if (/email|correo|nombre|name|categoria|category|tipo|type|estado|status|texto|text|id$/.test(normalized)) return "string";
  if (/fecha|date|createdat|updatedat/.test(normalized)) return "date";
  return "number";
}

function sampleValue(type: FormulaValueType, key: string, field?: SchemaField): unknown {
  if (type === "array") return [];
  if (type === "object") return {};
  const resolvedType = type === "unknown" ? field?.type ?? inferUnknownType(key) : type;
  const normalized = key.toLowerCase();
  switch (resolvedType) {
    case "currency":
      if (/salario|salary|sueldo/.test(normalized)) return roundCurrency(2400);
      if (/bonificacion|bonus/.test(normalized)) return roundCurrency(500);
      if (/descuento|discount|monto|amount|total|precio|price/.test(normalized)) return roundCurrency(600);
      return roundCurrency(100);
    case "number":
      if (/salario|salary|sueldo/.test(normalized)) return 2400;
      if (/bonificacion|bonus/.test(normalized)) return 500;
      if (/descuento|discount|rate|tasa|porcentaje|percent|factor/.test(normalized)) return 0.1;
      if (/edad|age/.test(normalized)) return 31;
      if (/monto|amount|total|precio|price/.test(normalized)) return 600;
      return 100;
    case "boolean":
      return false;
    case "date":
      return new Date().toISOString().slice(0, 10);
    case "enum":
      return field?.options?.[0] ?? "EJEMPLO";
    case "string":
      return /email|correo/.test(normalized) ? "pasajero@ejemplo.com" : "ejemplo";
    default:
      return 100;
  }
}

function parsePreviousPayload(payload?: string): FormulaTestRequest | null {
  if (!payload) return null;
  try {
    const parsed: unknown = JSON.parse(payload);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const object = parsed as Record<string, unknown>;
    const hasRequestEnvelope = Object.prototype.hasOwnProperty.call(object, "parametros");
    const parametros = hasRequestEnvelope ? object.parametros : object;
    if (!parametros || typeof parametros !== "object" || Array.isArray(parametros)) return null;

    return {
      idSolicitud: typeof object.idSolicitud === "string" ? object.idSolicitud : "",
      codigoFormula: typeof object.codigoFormula === "string" ? object.codigoFormula : "",
      parametros: parametros as Record<string, unknown>
    };
  } catch {
    return null;
  }
}

export function getFormulaTestFields(expression: FormulaRoot, fields: SchemaField[]): SchemaField[] {
  if (isAdvancedPayrollExpression(expression, fields)) return PAYROLL_SCHEMA;

  const fieldByKey = new Map(fields.map((field) => [field.key, field]));
  return [...collectVariableTypes(expression, fields)].map(([key, valueType]) => {
    const schemaField = fieldByKey.get(key);
    const type = schemaField?.type && schemaField.type !== "unknown"
      ? schemaField.type
      : valueType === "unknown" || valueType === "null" || valueType === "lambda"
        ? inferUnknownType(key)
        : valueType === "object" || valueType === "array"
          ? "unknown"
        : valueType;
    return {
      key,
      label: schemaField?.label ?? key,
      type,
      description: schemaField?.description,
      options: schemaField?.options
    };
  });
}

export function readTestPayload(payload: string): FormulaTestRequest | null {
  return parsePreviousPayload(payload);
}

export function createTemplateTestPayload(
  example: unknown,
  fallbackPayload: string,
  metadata: FormulaTestPayloadMetadata = {}
) {
  let parsedExample: unknown = example;
  if (typeof parsedExample === "string") {
    try {
      parsedExample = JSON.parse(parsedExample);
    } catch {
      return fallbackPayload;
    }
  }
  if (!parsedExample || typeof parsedExample !== "object" || Array.isArray(parsedExample)) return fallbackPayload;

  const object = parsedExample as Record<string, unknown>;
  const parametros = object.parametros && typeof object.parametros === "object" && !Array.isArray(object.parametros)
    ? object.parametros
    : object;
  const fallback = parsePreviousPayload(fallbackPayload);
  const result: FormulaTestRequest = {
    idSolicitud: typeof object.idSolicitud === "string"
      ? object.idSolicitud
      : metadata.idSolicitud ?? fallback?.idSolicitud ?? "PRUEBA-LOCAL-0001",
    codigoFormula: typeof object.codigoFormula === "string"
      ? object.codigoFormula
      : metadata.codigoFormula ?? fallback?.codigoFormula ?? "FORMULA-LOCAL",
    parametros: parametros as Record<string, unknown>
  };
  return JSON.stringify(result, null, 2);
}

export function readTestPayloadField(payload: FormulaTestRequest, key: string): unknown {
  return getPathValue(payload.parametros, key);
}

export function updateTestPayloadField(payload: string, key: string, value: unknown, fallbackPayload: string): string {
  const current = parsePreviousPayload(payload) ?? parsePreviousPayload(fallbackPayload) ?? {
    idSolicitud: "PRUEBA-LOCAL-0001",
    codigoFormula: "FORMULA-LOCAL",
    parametros: {}
  };
  setPathValue(current.parametros, key, value);
  return JSON.stringify(current, null, 2);
}

export function createFormulaTestPayload(
  expression: FormulaRoot,
  fields: SchemaField[],
  previousPayload?: string,
  preserveExistingValues = true,
  metadata: FormulaTestPayloadMetadata = {}
) {
  const previous = parsePreviousPayload(previousPayload);
  if (preserveExistingValues && previousPayload && !previous) return previousPayload;

  const isPayroll = isAdvancedPayrollExpression(expression, fields);
  const defaults = isPayroll
    ? { idSolicitud: "NOMINA-2026-0001", codigoFormula: "FORM-NOMINA-AVANZADA-001" }
    : { idSolicitud: "PRUEBA-LOCAL-0001", codigoFormula: "FORMULA-LOCAL" };
  const result: FormulaTestRequest = {
    idSolicitud: metadata.idSolicitud ?? (isPayroll && previous?.idSolicitud === "PRUEBA-LOCAL-0001" ? defaults.idSolicitud : previous?.idSolicitud) ?? defaults.idSolicitud,
    codigoFormula: metadata.codigoFormula ?? previous?.codigoFormula ?? defaults.codigoFormula,
    parametros: {}
  };
  if (isPayroll) {
    for (const field of PAYROLL_SCHEMA) {
      const defaultValue = PAYROLL_ARRAY_SAMPLES[field.key] ?? sampleValue(field.type, field.key, field);
      const existingValue = preserveExistingValues && previous ? getPathValue(previous.parametros, field.key) : undefined;
      const isStructuredPayrollField = field.key === "horasExtras" || field.key === "descuentosAdicionales";
      const value = isStructuredPayrollField && !Array.isArray(existingValue)
        ? defaultValue
        : existingValue === undefined ? defaultValue : existingValue;
      setPathValue(result.parametros, field.key, value);
    }
    return JSON.stringify(result, null, 2);
  }

  const fieldByKey = new Map(fields.map((field) => [field.key, field]));
  for (const [key, type] of collectVariableTypes(expression, fields)) {
    const existingValue = preserveExistingValues && previous ? getPathValue(previous.parametros, key) : undefined;
    const value = existingValue === undefined
      ? sampleValue(type, key, fieldByKey.get(key))
      : existingValue;
    setPathValue(result.parametros, key, value);
  }
  return JSON.stringify(result, null, 2);
}
