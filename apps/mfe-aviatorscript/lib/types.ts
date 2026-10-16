export type SchemaFieldType = "string" | "number" | "boolean" | "date" | "enum";

export type LogicalOperator = "AND" | "OR";

export type ComparisonOperator =
  | "equals"
  | "not_equals"
  | "greater_than"
  | "greater_or_equal"
  | "less_than"
  | "less_or_equal"
  | "contains"
  | "starts_with"
  | "ends_with"
  | "in"
  | "is_true"
  | "is_false";

export type RuleValue = string | number | boolean | string[] | number[];

export interface SchemaField {
  key: string;
  label: string;
  type: SchemaFieldType;
  description?: string;
  options?: string[];
}

export interface RuleConditionNode {
  id: string;
  kind: "condition";
  fieldKey: string;
  operator: ComparisonOperator;
  value?: RuleValue;
}

export interface RuleGroupNode {
  id: string;
  kind: "group";
  logicalOperator: LogicalOperator;
  children: RuleNode[];
}

export type RuleNode = RuleConditionNode | RuleGroupNode;

export interface RuleDocument {
  version: 1;
  root: RuleGroupNode;
}

export interface ValidationIssue {
  path: string;
  message: string;
  nodeId?: string;
  severity: "error" | "warning";
}

export interface ValidateResponse {
  valid: boolean;
  issues: ValidationIssue[];
  aviatorScript?: string;
}

export interface TestResponse {
  success: boolean;
  result?: unknown;
  matched?: boolean;
  executionTimeMs: number;
  error?: string;
}
