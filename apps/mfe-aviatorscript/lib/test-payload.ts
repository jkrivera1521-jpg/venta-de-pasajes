import type { FormulaExpression, FormulaRoot, FormulaStatement, FormulaValueType } from "./formula";
import { PAYROLL_SCHEMA } from "./payroll-formula";
import type { SchemaField, SchemaFieldType } from "./types";

const PAYROLL_ARRAY_SAMPLES: Record<string, unknown> = {
  horasExtras: [
    { tipo: "DIURNA", horas: 8 },
    { tipo: "NOCTURNA", horas: 3 }
  ],
  descuentosAdicionales: [{ concepto: "Seguro", valor: 115 }]
};

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

function concreteType(type: FormulaValueType | undefined): type is Exclude<FormulaValueType, "unknown" | "object"> {
  return Boolean(type && type !== "unknown" && type !== "object");
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
      const argumentType = node.name.startsWith("string.") ? "string" : "number";
      node.args.forEach((argument) => visit(argument, argumentType, locals));
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
    if (["+", "-", "*", "/", "%", ">", ">=", "<", "<="].includes(node.operator)) {
      visit(node.left, "number", locals);
      visit(node.right, "number", locals);
      return;
    }
    if (node.operator === "&&" || node.operator === "||") {
      visit(node.left, "boolean", locals);
      visit(node.right, "boolean", locals);
      return;
    }
    visit(node.left, expressionType(node.right), locals);
    visit(node.right, expressionType(node.left), locals);
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

function inferUnknownType(key: string): SchemaFieldType {
  const normalized = key.toLowerCase();
  if (/^(is|has|can|should)[._]|vip|activo|active|habilitado|enabled/.test(normalized)) return "boolean";
  if (/email|correo|nombre|name|categoria|category|tipo|type|estado|status|texto|text/.test(normalized)) return "string";
  if (/fecha|date|createdat|updatedat/.test(normalized)) return "date";
  return "number";
}

function sampleValue(type: FormulaValueType, key: string, field?: SchemaField): unknown {
  const resolvedType = type === "unknown" || type === "object" ? field?.type ?? inferUnknownType(key) : type;
  const normalized = key.toLowerCase();
  switch (resolvedType) {
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

function parsePreviousPayload(payload?: string): Record<string, unknown> | null {
  if (!payload) return null;
  try {
    const parsed: unknown = JSON.parse(payload);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

export function getFormulaTestFields(expression: FormulaRoot, fields: SchemaField[]): SchemaField[] {
  if (expression.kind === "payroll") return PAYROLL_SCHEMA;

  const fieldByKey = new Map(fields.map((field) => [field.key, field]));
  return [...collectVariableTypes(expression, fields)].map(([key, valueType]) => {
    const schemaField = fieldByKey.get(key);
    const type = schemaField?.type && schemaField.type !== "unknown"
      ? schemaField.type
      : valueType === "unknown" || valueType === "object" || valueType === "array"
        ? inferUnknownType(key)
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

export function readTestPayload(payload: string): Record<string, unknown> | null {
  return parsePreviousPayload(payload);
}

export function readTestPayloadField(payload: Record<string, unknown>, key: string): unknown {
  return getPathValue(payload, key);
}

export function updateTestPayloadField(payload: string, key: string, value: unknown, fallbackPayload: string): string {
  const current = parsePreviousPayload(payload) ?? parsePreviousPayload(fallbackPayload) ?? {};
  setPathValue(current, key, value);
  return JSON.stringify(current, null, 2);
}

export function createFormulaTestPayload(
  expression: FormulaRoot,
  fields: SchemaField[],
  previousPayload?: string,
  preserveExistingValues = true
) {
  const previous = parsePreviousPayload(previousPayload);
  if (preserveExistingValues && previousPayload && !previous) return previousPayload;

  const result: Record<string, unknown> = {};
  if (expression.kind === "payroll") {
    for (const field of PAYROLL_SCHEMA) {
      const defaultValue = PAYROLL_ARRAY_SAMPLES[field.key] ?? sampleValue(field.type, field.key, field);
      const existingValue = preserveExistingValues && previous ? getPathValue(previous, field.key) : undefined;
      setPathValue(result, field.key, existingValue === undefined ? defaultValue : existingValue);
    }
    return JSON.stringify(result, null, 2);
  }

  const fieldByKey = new Map(fields.map((field) => [field.key, field]));
  for (const [key, type] of collectVariableTypes(expression, fields)) {
    const existingValue = preserveExistingValues && previous ? getPathValue(previous, key) : undefined;
    const value = existingValue === undefined
      ? sampleValue(type, key, fieldByKey.get(key))
      : existingValue;
    setPathValue(result, key, value);
  }
  return JSON.stringify(result, null, 2);
}
