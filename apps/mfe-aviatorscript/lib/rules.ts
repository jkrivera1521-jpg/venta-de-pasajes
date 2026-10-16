import type {
  ComparisonOperator,
  LogicalOperator,
  RuleConditionNode,
  RuleDocument,
  RuleGroupNode,
  RuleNode,
  RuleValue,
  SchemaField,
  SchemaFieldType,
  ValidationIssue
} from "./types";

export const DEFAULT_SCHEMA: SchemaField[] = [
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

export const OPERATOR_LABELS: Record<ComparisonOperator, string> = {
  equals: "Es igual a",
  not_equals: "Es diferente de",
  greater_than: "Es mayor que",
  greater_or_equal: "Es mayor o igual que",
  less_than: "Es menor que",
  less_or_equal: "Es menor o igual que",
  contains: "Contiene",
  starts_with: "Empieza con",
  ends_with: "Termina con",
  in: "Esta en la lista",
  is_true: "Es verdadero",
  is_false: "Es falso"
};

export const OPERATORS_BY_TYPE: Record<SchemaFieldType, ComparisonOperator[]> = {
  boolean: ["equals", "not_equals", "is_true", "is_false"],
  date: ["equals", "not_equals", "greater_than", "greater_or_equal", "less_than", "less_or_equal"],
  enum: ["equals", "not_equals", "in"],
  number: ["equals", "not_equals", "greater_than", "greater_or_equal", "less_than", "less_or_equal"],
  string: ["equals", "not_equals", "contains", "starts_with", "ends_with", "in"]
};

export function createId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

export function createCondition(fieldKey = ""): RuleConditionNode {
  return {
    id: createId("condition"),
    kind: "condition",
    fieldKey,
    operator: "equals",
    value: ""
  };
}

export function createGroup(logicalOperator: LogicalOperator = "AND"): RuleGroupNode {
  return {
    id: createId("group"),
    kind: "group",
    logicalOperator,
    children: [createCondition()]
  };
}

export function createInitialRule(schema: SchemaField[] = DEFAULT_SCHEMA): RuleDocument {
  return {
    version: 1,
    root: {
      ...createGroup("AND"),
      children: [createCondition(schema[0]?.key ?? "")]
    }
  };
}

export function getField(schema: SchemaField[], key: string) {
  return schema.find((field) => field.key === key);
}

export function defaultOperatorForField(field?: SchemaField): ComparisonOperator {
  return OPERATORS_BY_TYPE[field?.type ?? "string"][0];
}

export function defaultValueForField(field?: SchemaField, operator?: ComparisonOperator): RuleValue {
  if (operator === "is_true" || operator === "is_false") {
    return true;
  }
  if (field?.type === "boolean") {
    return true;
  }
  if (field?.type === "number") {
    return 0;
  }
  return field?.type === "enum" ? (field.options?.[0] ?? "") : "";
}

export function updateNodeById(root: RuleGroupNode, nodeId: string, update: (node: RuleNode) => RuleNode): RuleGroupNode {
  if (root.id === nodeId) {
    return update(root) as RuleGroupNode;
  }

  return {
    ...root,
    children: root.children.map((child) => {
      if (child.id === nodeId) {
        return update(child);
      }
      if (child.kind === "group") {
        return updateNodeById(child, nodeId, update);
      }
      return child;
    })
  };
}

export function appendChildToGroup(root: RuleGroupNode, groupId: string, child: RuleNode): RuleGroupNode {
  return updateNodeById(root, groupId, (node) => {
    if (node.kind !== "group") {
      return node;
    }
    return { ...node, children: [...node.children, child] };
  });
}

export function removeNodeById(root: RuleGroupNode, nodeId: string): RuleGroupNode {
  return {
    ...root,
    children: root.children
      .filter((child) => child.id !== nodeId)
      .map((child) => child.kind === "group" ? removeNodeById(child, nodeId) : child)
  };
}

export function validateRuleDocument(rule: RuleDocument, schema: SchemaField[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const schemaByKey = new Map(schema.map((field) => [field.key, field]));

  function visit(node: RuleNode, path: string) {
    if (node.kind === "group") {
      if (node.children.length === 0) {
        issues.push({
          message: "Agrega al menos una condicion a este grupo.",
          nodeId: node.id,
          path,
          severity: "error"
        });
      }
      node.children.forEach((child, index) => visit(child, `${path}.children[${index}]`));
      return;
    }

    const field = schemaByKey.get(node.fieldKey);
    if (!field) {
      issues.push({
        message: "Selecciona un campo del esquema.",
        nodeId: node.id,
        path: `${path}.fieldKey`,
        severity: "error"
      });
      return;
    }

    const validOperators = OPERATORS_BY_TYPE[field.type];
    if (!validOperators.includes(node.operator)) {
      issues.push({
        message: `El operador no es compatible con ${field.label}.`,
        nodeId: node.id,
        path: `${path}.operator`,
        severity: "error"
      });
    }

    if (node.operator === "is_true" || node.operator === "is_false") {
      return;
    }

    if (node.value === undefined || node.value === "" || (Array.isArray(node.value) && node.value.length === 0)) {
      issues.push({
        message: "Completa el valor de la condicion.",
        nodeId: node.id,
        path: `${path}.value`,
        severity: "error"
      });
      return;
    }

    if (node.operator === "in" && !Array.isArray(node.value)) {
      issues.push({
        message: "Ingresa una lista de valores.",
        nodeId: node.id,
        path: `${path}.value`,
        severity: "error"
      });
    }

    if (field.type === "number" && (typeof node.value !== "number" || Number.isNaN(node.value))) {
      issues.push({
        message: "El valor debe ser un numero.",
        nodeId: node.id,
        path: `${path}.value`,
        severity: "error"
      });
    }

    if (field.type === "boolean" && typeof node.value !== "boolean") {
      issues.push({
        message: "El valor debe ser verdadero o falso.",
        nodeId: node.id,
        path: `${path}.value`,
        severity: "error"
      });
    }

    if (field.type === "enum") {
      const values = Array.isArray(node.value) ? node.value : [node.value];
      const invalidOption = values.some((value) => typeof value !== "string" || !field.options?.includes(value));
      if (invalidOption) {
        issues.push({
          message: "Selecciona una opcion valida del catalogo.",
          nodeId: node.id,
          path: `${path}.value`,
          severity: "error"
        });
      }
    }
  }

  visit(rule.root, "root");
  return issues;
}

function escapeAviatorString(value: string) {
  return `\"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}\"`;
}

function aviatorValue(value: RuleValue | undefined) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => typeof item === "string" ? escapeAviatorString(item) : String(item)).join(", ")}]`;
  }
  if (typeof value === "string") {
    return escapeAviatorString(value);
  }
  return String(value);
}

export function toAviatorScript(rule: RuleDocument, schema: SchemaField[]) {
  const schemaByKey = new Map(schema.map((field) => [field.key, field]));

  function conditionScript(condition: RuleConditionNode) {
    const field = schemaByKey.get(condition.fieldKey);
    const fieldExpression = condition.fieldKey || "<campo>";
    if (condition.operator === "is_true") return fieldExpression;
    if (condition.operator === "is_false") return `!${fieldExpression}`;
    const value = aviatorValue(condition.value);
    const stringOperator = ["contains", "starts_with", "ends_with"].includes(condition.operator)
      ? `string.${condition.operator}(${fieldExpression}, ${value})`
      : undefined;
    if (stringOperator) return stringOperator;
    if (condition.operator === "in") return `${value}.contains(${fieldExpression})`;
    const operators: Record<ComparisonOperator, string> = {
      equals: "==",
      not_equals: "!=",
      greater_than: ">",
      greater_or_equal: ">=",
      less_than: "<",
      less_or_equal: "<=",
      contains: "contains",
      starts_with: "startsWith",
      ends_with: "endsWith",
      in: "in",
      is_true: "",
      is_false: ""
    };
    void field;
    return `${fieldExpression} ${operators[condition.operator]} ${value}`;
  }

  function groupScript(group: RuleGroupNode): string {
    const joiner = group.logicalOperator === "AND" ? " && " : " || ";
    return `(${group.children.map((child) => child.kind === "group" ? groupScript(child) : conditionScript(child)).join(joiner)})`;
  }

  return groupScript(rule.root);
}

function readPath(payload: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((value, segment) => {
    if (value && typeof value === "object" && segment in value) {
      return (value as Record<string, unknown>)[segment];
    }
    return undefined;
  }, payload);
}

function compare(value: unknown, operator: ComparisonOperator, expected: RuleValue | undefined) {
  if (operator === "is_true") return value === true;
  if (operator === "is_false") return value === false;
  if (operator === "contains") return typeof value === "string" && typeof expected === "string" && value.includes(expected);
  if (operator === "starts_with") return typeof value === "string" && typeof expected === "string" && value.startsWith(expected);
  if (operator === "ends_with") return typeof value === "string" && typeof expected === "string" && value.endsWith(expected);
  if (operator === "in") return Array.isArray(expected) && expected.includes(value as never);

  if (operator === "equals") return value === expected;
  if (operator === "not_equals") return value !== expected;
  if (operator === "greater_than") return typeof value === "number" && typeof expected === "number" && value > expected;
  if (operator === "greater_or_equal") return typeof value === "number" && typeof expected === "number" && value >= expected;
  if (operator === "less_than") return typeof value === "number" && typeof expected === "number" && value < expected;
  return typeof value === "number" && typeof expected === "number" && value <= expected;
}

export function evaluateRule(rule: RuleDocument, testData: unknown): boolean {
  function visit(node: RuleNode): boolean {
    if (node.kind === "condition") {
      return compare(readPath(testData, node.fieldKey), node.operator, node.value);
    }
    const values = node.children.map(visit);
    return node.logicalOperator === "AND" ? values.every(Boolean) : values.some(Boolean);
  }

  return visit(rule.root);
}

export function normalizeRule(input: unknown): RuleDocument {
  if (input && typeof input === "object" && "root" in input) {
    return input as RuleDocument;
  }
  return {
    version: 1,
    root: input as RuleGroupNode
  };
}
