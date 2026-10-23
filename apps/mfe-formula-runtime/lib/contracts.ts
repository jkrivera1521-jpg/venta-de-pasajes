export type SchemaType = "string" | "number" | "integer" | "boolean" | "object" | "array" | "null" | "unknown";

export type JsonSchema = {
  type?: SchemaType | SchemaType[];
  title?: string;
  description?: string;
  format?: string;
  enum?: Array<string | number | boolean>;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  default?: unknown;
  nullable?: boolean;
  minItems?: number;
  maxItems?: number;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
};

export type UiSection = { title?: string; description?: string; fields?: string[]; columns?: number; component?: string };
export type UiSchema = { title?: string; description?: string; icon?: string; sections?: UiSection[]; submitLabel?: string; resultTitle?: string };

export type FormulaTemplate = {
  id: number;
  codigo: string;
  nombre: string;
  descripcion?: string | null;
  version: number;
  expresion?: string;
  ejemplo?: Record<string, unknown> | null;
  contratoEntrada?: JsonSchema | null;
  contratoSalida?: JsonSchema | null;
  configuracionInterfaz?: UiSchema | null;
  activa: boolean;
  estado?: string | null;
  creadoPor?: string | null;
};

export type RuntimeExecution = {
  idEjecucion?: number;
  codigoFormula?: string;
  versionFormula?: number;
  resultado?: unknown;
  tipoResultado?: string;
  estado?: string;
  error?: string | null;
  fechaInicio?: string;
  duracionMs?: number;
};

export function inputExample(formula: FormulaTemplate): Record<string, unknown> {
  const example = formula.ejemplo;
  if (!example || typeof example !== "object" || Array.isArray(example)) return {};
  const parameters = example.parametros;
  return parameters && typeof parameters === "object" && !Array.isArray(parameters)
    ? parameters as Record<string, unknown>
    : example;
}

function inferType(value: unknown): SchemaType {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") return Number.isInteger(value) ? "integer" : "number";
  if (typeof value === "object") return "object";
  if (typeof value === "string") return "string";
  return "unknown";
}

export function inferSchema(value: unknown, title?: string): JsonSchema {
  const type = inferType(value);
  if (type === "object") {
    const properties: Record<string, JsonSchema> = {};
    Object.entries(value as Record<string, unknown>).forEach(([key, child]) => {
      properties[key] = inferSchema(child, humanize(key));
    });
    return { type, title, properties, required: Object.keys(properties) };
  }
  if (type === "array") {
    const values = value as unknown[];
    const sample = values.find((item) => item !== null);
    return { type, title, items: inferSchema(sample ?? "", title ? `${title} item` : undefined), minItems: 0 };
  }
  return { type, title, nullable: value === null, default: value };
}

export function schemaForFormula(formula: FormulaTemplate): JsonSchema {
  return formula.contratoEntrada && typeof formula.contratoEntrada === "object"
    ? formula.contratoEntrada
    : inferSchema(inputExample(formula), "Parámetros");
}

export function humanize(value: string) {
  return value
    .replace(/[._-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (letter) => letter.toUpperCase());
}

export function schemaType(schema: JsonSchema): SchemaType {
  if (Array.isArray(schema.type)) return schema.type.find((type) => type !== "null") ?? "unknown";
  return schema.type ?? "unknown";
}

export function createValue(schema: JsonSchema): unknown {
  if (schema.default !== undefined) return schema.default;
  switch (schemaType(schema)) {
    case "object": return Object.fromEntries(Object.entries(schema.properties ?? {}).map(([key, child]) => [key, createValue(child)]));
    case "array": return [];
    case "boolean": return false;
    case "number":
    case "integer": return 0;
    default: return "";
  }
}

export function readPath(value: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((current, key) => current && typeof current === "object" ? (current as Record<string, unknown>)[key] : undefined, value);
}

export function writePath(value: Record<string, unknown>, path: string, nextValue: unknown) {
  const parts = path.split(".");
  const result = structuredClone(value) as Record<string, unknown>;
  let cursor: any = result;
  parts.forEach((part, index) => {
    if (index === parts.length - 1) {
      cursor[part] = nextValue;
      return;
    }
    const current = cursor[part];
    const nextPartIsIndex = /^\d+$/.test(parts[index + 1]);
    cursor[part] = current && typeof current === "object" ? current : nextPartIsIndex ? [] : {};
    cursor = cursor[part];
  });
  return result;
}

export function validateInput(schema: JsonSchema, value: unknown, path = "Parámetros", required = true): string[] {
  const errors: string[] = [];
  const type = schemaType(schema);
  if ((value === undefined || value === "") && !required) return errors;
  if (value == null || value === "") {
    if (schema.nullable || schema.default !== undefined) return errors;
    return required ? [`${path} es obligatorio.`] : errors;
  }
  if (type === "object") {
    if (typeof value !== "object" || Array.isArray(value)) return [`${path} debe ser un objeto.`];
    const objectValue = value as Record<string, unknown>;
    Object.entries(schema.properties ?? {}).forEach(([key, child]) => {
      const childErrors = validateInput(child, objectValue[key], `${path}.${child.title ?? humanize(key)}`, schema.required?.includes(key) ?? false);
      errors.push(...childErrors);
    });
  } else if (type === "array") {
    if (!Array.isArray(value)) return [`${path} debe ser una lista.`];
    if (schema.minItems !== undefined && value.length < schema.minItems) errors.push(`${path} debe contener al menos ${schema.minItems} elemento(s).`);
    if (schema.maxItems !== undefined && value.length > schema.maxItems) errors.push(`${path} no puede contener más de ${schema.maxItems} elemento(s).`);
    value.forEach((item, index) => errors.push(...validateInput(schema.items ?? {}, item, `${path} ${index + 1}`)));
  } else if (type === "number" || type === "integer") {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || (type === "integer" && !Number.isInteger(numeric))) errors.push(`${path} debe ser un número válido.`);
    if (schema.minimum !== undefined && numeric < schema.minimum) errors.push(`${path} debe ser mayor o igual a ${schema.minimum}.`);
    if (schema.maximum !== undefined && numeric > schema.maximum) errors.push(`${path} debe ser menor o igual a ${schema.maximum}.`);
  } else if (type === "boolean" && typeof value !== "boolean") {
    errors.push(`${path} debe ser verdadero o falso.`);
  } else if (type === "string") {
    const text = String(value);
    if (schema.minLength !== undefined && text.length < schema.minLength) errors.push(`${path} es demasiado corto.`);
    if (schema.maxLength !== undefined && text.length > schema.maxLength) errors.push(`${path} es demasiado largo.`);
    if (schema.pattern) {
      try { if (!new RegExp(schema.pattern).test(text)) errors.push(`${path} tiene un formato inválido.`); } catch { /* backend validates the contract */ }
    }
  }
  return errors;
}
