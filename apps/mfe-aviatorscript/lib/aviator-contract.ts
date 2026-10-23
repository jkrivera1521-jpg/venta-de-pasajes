import type { SchemaField } from "./types";

/**
 * Canonical contract shared by the visual AST, source editor and API adapters.
 * The source string remains the executable contract; AST/workspace are editor
 * representations that must compile back to this source without semantic loss.
 */
export const AVIATOR_CONTRACT_VERSION = 1 as const;

export type AviatorBinaryOperator =
  | "+" | "-" | "*" | "/" | "%" | "**"
  | "&" | "|" | "^" | "<<" | ">>" | ">>>"
  | "==" | "!=" | "=~" | ">" | ">=" | "<" | "<=" | "&&" | "||";

export type AviatorUnaryOperator = "!" | "-" | "~";

export type AviatorFunctionName =
  | "math.abs" | "math.sqrt" | "math.round" | "math.pow" | "math.min" | "math.max"
  | "string.contains" | "string.starts_with" | "string.ends_with"
  | "seq.list" | "seq.map" | "seq.add" | "seq.include" | "seq.count" | "seq.filter" | "seq.reduce";

export const AVIATOR_FUNCTIONS = new Set<AviatorFunctionName>([
  "math.abs", "math.sqrt", "math.round", "math.pow", "math.min", "math.max",
  "string.contains", "string.starts_with", "string.ends_with",
  "seq.list", "seq.map", "seq.add", "seq.include", "seq.count", "seq.filter", "seq.reduce"
]);

export const AVIATOR_BINARY_OPERATORS = new Set<AviatorBinaryOperator>([
  "+", "-", "*", "/", "%", "**", "&", "|", "^", "<<", ">>", ">>>",
  "==", "!=", "=~", ">", ">=", "<", "<=", "&&", "||"
]);

export const AVIATOR_UNARY_OPERATORS = new Set<AviatorUnaryOperator>(["!", "-", "~"]);

/**
 * UI hints only. The Aviator engine accepts dynamic context maps; this schema
 * helps the builder suggest variables and types but never replaces compilation
 * or execution validation in the backend.
 */
export const CANONICAL_AVIATOR_SCHEMA: SchemaField[] = [
  {
    key: "user.isVip",
    label: "Usuario VIP",
    type: "boolean",
    description: "Indica si el pasajero tiene una cuenta VIP."
  },
  {
    key: "user.age",
    label: "Edad del usuario",
    type: "number",
    description: "Edad registrada del pasajero."
  },
  {
    key: "order.amount",
    label: "Monto del pedido",
    type: "number",
    description: "Valor total de la orden antes de descuentos."
  },
  {
    key: "order.category",
    label: "Categoria del pedido",
    type: "enum",
    options: ["ELECTRO", "ROPA", "HOGAR"],
    description: "Categoria comercial de la orden."
  },
  {
    key: "order.createdAt",
    label: "Fecha de la orden",
    type: "date",
    description: "Fecha en la que fue creada la orden."
  },
  {
    key: "passenger.email",
    label: "Correo del pasajero",
    type: "string",
    description: "Correo usado para la compra."
  }
];

export type AviatorDiagnostic = {
  code?: string;
  column?: number;
  line?: number;
  message: string;
  severity: "error" | "warning";
};

export type AviatorValidationResponse = {
  contractVersion: typeof AVIATOR_CONTRACT_VERSION;
  diagnostics: AviatorDiagnostic[];
  engine: string;
  valid: boolean;
};

export type AviatorSourceTestResponse = {
  contractVersion: typeof AVIATOR_CONTRACT_VERSION;
  engine: string;
  error?: string;
  executionTimeMs: number;
  result?: unknown;
  success: boolean;
};

export type AviatorSourceTestRequest = {
  parametros: Record<string, unknown>;
  source: string;
};
