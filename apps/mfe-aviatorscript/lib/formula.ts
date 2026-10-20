import type { SchemaField, SchemaFieldType } from "./types";
import { DEFAULT_PAYROLL_CONFIG, evaluatePayrollFormula, generatePayrollAviatorScript, normalizePayrollConfig, validatePayrollInputValidations, type PayrollFormulaConfig } from "./payroll-formula";

export type FormulaValueType = SchemaFieldType | "unknown" | "object" | "array";
export type FormulaLiteralValue = number | string | boolean;
export type FormulaBinaryOperator =
  | "+" | "-" | "*" | "/" | "%" | "**"
  | "&" | "|" | "^" | "<<" | ">>" | ">>>"
  | "==" | "!=" | "=~" | ">" | ">=" | "<" | "<=" | "&&" | "||";
export type FormulaFunctionName =
  | "math.abs" | "math.sqrt" | "math.round" | "math.pow"
  | "string.contains" | "string.starts_with" | "string.ends_with"
  | "seq.list" | "seq.map" | "seq.add";

export type FormulaExpression =
  | { kind: "literal"; valueType: Exclude<FormulaValueType, "unknown" | "array" | "object">; value: FormulaLiteralValue }
  | { kind: "variable"; key: string; valueType: FormulaValueType }
  | { kind: "member"; object: FormulaExpression; property: string; valueType: FormulaValueType }
  | { kind: "binary"; operator: FormulaBinaryOperator; left: FormulaExpression; right: FormulaExpression; valueType: FormulaValueType }
  | { kind: "unary"; operator: "!" | "-" | "~"; operand: FormulaExpression; valueType: FormulaValueType }
  | { kind: "conditional"; condition: FormulaExpression; whenTrue: FormulaExpression; whenFalse: FormulaExpression; valueType: FormulaValueType }
  | { kind: "call"; name: FormulaFunctionName; args: FormulaExpression[]; valueType: FormulaValueType }
  | { kind: "array"; items: FormulaExpression[]; valueType: "array" }
  | { kind: "object"; entries: { key: string; value: FormulaExpression }[]; valueType: "object" }
  | { kind: "payroll"; config: PayrollFormulaConfig; valueType: "object" };

export type FormulaStatement =
  | { kind: "section"; title: string }
  | { kind: "declaration"; name: string; value: FormulaExpression }
  | { kind: "assignment"; name: string; value: FormulaExpression }
  | { kind: "expression"; expression: FormulaExpression }
  | { kind: "if"; condition: FormulaExpression; then: FormulaStatement[]; elseIf: { condition: FormulaExpression; body: FormulaStatement[] }[]; otherwise: FormulaStatement[] }
  | { kind: "for"; item: string; collection: FormulaExpression; body: FormulaStatement[] }
  | { kind: "while"; condition: FormulaExpression; body: FormulaStatement[] }
  | { kind: "continue" }
  | { kind: "break" }
  | { kind: "throw"; message: FormulaExpression }
  | { kind: "return"; value: FormulaExpression };

export type FormulaProgram = { kind: "program"; statements: FormulaStatement[]; valueType: FormulaValueType };

export type FormulaRoot = FormulaExpression | FormulaProgram;

export interface FormulaDocument {
  format: "aviatorscript-formula";
  version: 1;
  name: string;
  expression: FormulaRoot;
  workspace: unknown;
  updatedAt: string;
}

export interface FormulaTemplate {
  codigo: string;
  nombre: string;
  descripcion?: string | null;
  version: number;
  expresion: string;
  activa: boolean;
  fechaCreacion?: string | null;
}

export interface FormulaIssue {
  path: string;
  message: string;
  severity: "error" | "warning";
}

export interface FormulaBuildResult {
  expression?: FormulaRoot;
  issues: FormulaIssue[];
}

const RELATIONAL_OPERATORS = new Set<FormulaBinaryOperator>([">", ">=", "<", "<="]);
const NUMERIC_OPERATORS = new Set<FormulaBinaryOperator>(["+", "-", "*", "/", "%", "**", "&", "|", "^", "<<", ">>", ">>>"]);
const BOOLEAN_OPERATORS = new Set<FormulaBinaryOperator>(["==", "!=", "=~", ">", ">=", "<", "<=", "&&", "||"]);

export function formulaExpressionType(expression: FormulaRoot): FormulaValueType {
  return expression.valueType;
}

function compileExpression(expression: FormulaExpression): string {
  switch (expression.kind) {
    case "payroll":
      return generatePayrollAviatorScript(expression.config);
    case "literal":
      return typeof expression.value === "string" ? JSON.stringify(expression.value) : String(expression.value);
    case "variable":
      return expression.key;
    case "binary":
      return `(${compileExpression(expression.left)} ${expression.operator} ${compileExpression(expression.right)})`;
    case "unary":
      return `(${expression.operator}${compileExpression(expression.operand)})`;
    case "conditional":
      return `(${compileExpression(expression.condition)} ? ${compileExpression(expression.whenTrue)} : ${compileExpression(expression.whenFalse)})`;
    case "member":
      return `${compileExpression(expression.object)}.${expression.property}`;
    case "call":
      return `${expression.name}(${expression.args.map(compileExpression).join(", ")})`;
    case "array":
      return `seq.list(${expression.items.map(compileExpression).join(", ")})`;
    case "object":
      return `seq.map(${expression.entries.map(({ key, value }) => `${JSON.stringify(key)}, ${compileExpression(value)}`).join(", ")})`;
  }
}

function compileCondition(expression: FormulaExpression) {
  const compiled = compileExpression(expression);
  return compiled.startsWith("(") && compiled.endsWith(")") ? compiled.slice(1, -1) : compiled;
}

function compileStatements(statements: FormulaStatement[], level = 0): string {
  return statements.map((statement) => {
    switch (statement.kind) {
      case "section": return `${"  ".repeat(level)}## ${statement.title}`;
      case "declaration": return `${"  ".repeat(level)}let ${statement.name} = ${compileExpression(statement.value)};`;
      case "assignment": return `${"  ".repeat(level)}${statement.name} = ${compileExpression(statement.value)};`;
      case "expression": return `${"  ".repeat(level)}${compileExpression(statement.expression)};`;
      case "continue": return `${"  ".repeat(level)}continue;`;
      case "break": return `${"  ".repeat(level)}break;`;
      case "throw": return `${"  ".repeat(level)}throw ${compileExpression(statement.message)};`;
      case "return": return `${"  ".repeat(level)}return ${compileExpression(statement.value)};`;
      case "for": return [
        `${"  ".repeat(level)}for ${statement.item} in ${compileExpression(statement.collection)} {`,
        compileStatements(statement.body, level + 1),
        `${"  ".repeat(level)}}`
      ].join("\n");
      case "while": return [
        `${"  ".repeat(level)}while (${compileCondition(statement.condition)}) {`,
        compileStatements(statement.body, level + 1),
        `${"  ".repeat(level)}}`
      ].join("\n");
      case "if": {
        const lines = [
          `${"  ".repeat(level)}if (${compileCondition(statement.condition)}) {`,
          compileStatements(statement.then, level + 1),
          `${"  ".repeat(level)}}`
        ];
        for (const branch of statement.elseIf) {
          lines.push(`${"  ".repeat(level)}elsif (${compileCondition(branch.condition)}) {`);
          lines.push(compileStatements(branch.body, level + 1));
          lines.push(`${"  ".repeat(level)}}`);
        }
        if (statement.otherwise.length) {
          lines.push(`${"  ".repeat(level)}else {`);
          lines.push(compileStatements(statement.otherwise, level + 1));
          lines.push(`${"  ".repeat(level)}}`);
        }
        return lines.join("\n");
      }
    }
  }).join("\n");
}

export function compileFormula(expression: FormulaRoot): string {
  return expression.kind === "program" ? compileStatements(expression.statements) : compileExpression(expression);
}

export function validateFormula(expression: FormulaRoot, fields: SchemaField[]): FormulaIssue[] {
  const issues: FormulaIssue[] = [];
  const schema = new Map(fields.map((field) => [field.key, field]));

  function visit(node: FormulaExpression, path: string, locals = new Map<string, FormulaValueType>()): FormulaValueType {
    if (node.kind === "payroll") {
      const config = normalizePayrollConfig(node.config);
      const numbers = [
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
      if (numbers.some((value) => !Number.isFinite(value) || value < 0)) {
        issues.push({ path, message: "Los umbrales y porcentajes deben ser numeros validos y no negativos.", severity: "error" });
      }
      issues.push(...validatePayrollInputValidations(config).map(({ field, message }) => ({
        path: `${path}.inputValidations.${field}`, message, severity: "error" as const
      })));
      if (!(config.seniorityThresholds[0] > config.seniorityThresholds[1]
        && config.seniorityThresholds[1] > config.seniorityThresholds[2])) {
        issues.push({ path, message: "Los niveles de antiguedad deben estar ordenados de mayor a menor.", severity: "error" });
      }
      if (!(config.performanceThresholds[0] > config.performanceThresholds[1]
        && config.performanceThresholds[1] > config.performanceThresholds[2])) {
        issues.push({ path, message: "Los niveles de desempeno deben estar ordenados de mayor a menor.", severity: "error" });
      }
      if (!(config.progressiveThresholds[0] < config.progressiveThresholds[1]
        && config.classificationThresholds[0] < config.classificationThresholds[1])) {
        issues.push({ path, message: "Los limites de descuento y clasificacion deben estar ordenados de menor a mayor.", severity: "error" });
      }
      return "object";
    }
    if (node.kind === "literal") return node.valueType;
    if (node.kind === "variable") {
      if (locals.has(node.key)) return locals.get(node.key) ?? "unknown";
      const field = schema.get(node.key);
      if (!field) {
        issues.push({ path, message: `La variable ${node.key} ya no existe en el esquema.`, severity: "error" });
        return "unknown";
      }
      return field.type;
    }

    if (node.kind === "member") {
      const objectType = visit(node.object, `${path}.object`, locals);
      if (objectType !== "object" && objectType !== "array" && objectType !== "unknown") {
        issues.push({ path, message: "El acceso a una propiedad necesita un objeto o elemento de lista.", severity: "error" });
      }
      return node.valueType;
    }

    if (node.kind === "unary") {
      const operandType = visit(node.operand, `${path}.operand`, locals);
      const expected = node.operator === "!" ? "boolean" : "number";
      if (operandType !== expected && operandType !== "unknown") {
        issues.push({ path, message: node.operator === "!" ? "NOT necesita una condicion booleana." : "Este operador unario necesita un numero.", severity: "error" });
      }
      return expected;
    }

    if (node.kind === "binary") {
      const leftType = visit(node.left, `${path}.left`, locals);
      const rightType = visit(node.right, `${path}.right`, locals);
      const numeric = [leftType, rightType].every((type) => type === "number" || type === "unknown");
      const boolean = [leftType, rightType].every((type) => type === "boolean" || type === "unknown");
      if (NUMERIC_OPERATORS.has(node.operator) && !numeric) {
        issues.push({ path, message: "La operacion matematica requiere dos valores numericos.", severity: "error" });
      }
      if (["&&", "||"].includes(node.operator) && !boolean) {
        issues.push({ path, message: "AND y OR requieren dos condiciones booleanas.", severity: "error" });
      }
      if (RELATIONAL_OPERATORS.has(node.operator) && !numeric) {
        issues.push({ path, message: "La comparacion mayor/menor requiere valores numericos.", severity: "error" });
      }
      if (node.operator === "=~" && ![leftType, rightType].every((type) => ["string", "enum", "unknown"].includes(type))) {
        issues.push({ path, message: "La comparacion por patron requiere dos valores de texto.", severity: "error" });
      }
      if (["==", "!="].includes(node.operator) && leftType !== "unknown" && rightType !== "unknown" && leftType !== rightType) {
        const textTypes = new Set<FormulaValueType>(["string", "enum", "date"]);
        if (!(textTypes.has(leftType) && textTypes.has(rightType))) {
          issues.push({ path, message: "Compara valores del mismo tipo de dato.", severity: "error" });
        }
      }
      return BOOLEAN_OPERATORS.has(node.operator) ? "boolean" : "number";
    }

    if (node.kind === "conditional") {
      const conditionType = visit(node.condition, `${path}.condition`, locals);
      const trueType = visit(node.whenTrue, `${path}.whenTrue`, locals);
      const falseType = visit(node.whenFalse, `${path}.whenFalse`, locals);
      if (conditionType !== "boolean" && conditionType !== "unknown") {
        issues.push({ path: `${path}.condition`, message: "La condicion del bloque SI necesita un resultado booleano.", severity: "error" });
      }
      if (trueType !== falseType && trueType !== "unknown" && falseType !== "unknown") {
        issues.push({ path, message: "Los resultados de SI y SI NO deben ser del mismo tipo.", severity: "error" });
      }
      return trueType === "unknown" ? falseType : trueType;
    }

    if (node.kind !== "call") return node.valueType;

    const argTypes = node.args.map((argument, index) => visit(argument, `${path}.args[${index}]`, locals));
    if (argTypes.some((type) => type !== "number" && type !== "unknown") && node.name.startsWith("math.")) {
      issues.push({ path, message: "Esta funcion matematica solo admite numeros.", severity: "error" });
    }
    if (argTypes.some((type) => !["string", "enum", "date", "unknown"].includes(type)) && node.name.startsWith("string.")) {
      issues.push({ path, message: "Esta funcion de texto solo admite valores de texto.", severity: "error" });
    }
    return node.valueType;
  }

  function visitStatements(statements: FormulaStatement[], path: string, locals = new Map<string, FormulaValueType>()): FormulaValueType {
    let returnType: FormulaValueType = "unknown";
    statements.forEach((statement, index) => {
      const statementPath = `${path}[${index}]`;
      switch (statement.kind) {
        case "section":
          if (!statement.title.trim()) issues.push({ path: statementPath, message: "La seccion necesita un titulo.", severity: "error" });
          break;
        case "declaration":
          if (!/^[A-Za-z_$][A-Za-z\d_$]*$/.test(statement.name)) issues.push({ path: statementPath, message: "El nombre de la variable no es valido.", severity: "error" });
          locals.set(statement.name, visit(statement.value, `${statementPath}.value`, locals));
          break;
        case "assignment":
          if (!/^[A-Za-z_$][A-Za-z\d_$]*$/.test(statement.name)) issues.push({ path: statementPath, message: "El nombre de la variable no es valido.", severity: "error" });
          locals.set(statement.name, visit(statement.value, `${statementPath}.value`, locals));
          break;
        case "expression": visit(statement.expression, `${statementPath}.expression`, locals); break;
        case "throw": visit(statement.message, `${statementPath}.message`, locals); break;
        case "return": returnType = visit(statement.value, `${statementPath}.value`, locals); break;
        case "continue":
        case "break": break;
        case "if":
          if (visit(statement.condition, `${statementPath}.condition`, locals) !== "boolean") issues.push({ path: `${statementPath}.condition`, message: "La condicion necesita devolver verdadero o falso.", severity: "error" });
          visitStatements(statement.then, `${statementPath}.then`, new Map(locals));
          statement.elseIf.forEach((branch, branchIndex) => {
            if (visit(branch.condition, `${statementPath}.elseIf[${branchIndex}].condition`, locals) !== "boolean") issues.push({ path: `${statementPath}.elseIf[${branchIndex}].condition`, message: "La condicion necesita devolver verdadero o falso.", severity: "error" });
            visitStatements(branch.body, `${statementPath}.elseIf[${branchIndex}].body`, new Map(locals));
          });
          visitStatements(statement.otherwise, `${statementPath}.otherwise`, new Map(locals));
          break;
        case "for": {
          const collectionType = visit(statement.collection, `${statementPath}.collection`, locals);
          if (collectionType !== "array" && collectionType !== "unknown") issues.push({ path: `${statementPath}.collection`, message: "El ciclo PARA CADA necesita una lista.", severity: "error" });
          const loopLocals = new Map(locals);
          loopLocals.set(statement.item, "unknown");
          visitStatements(statement.body, `${statementPath}.body`, loopLocals);
          break;
        }
        case "while":
          if (visit(statement.condition, `${statementPath}.condition`, locals) !== "boolean") issues.push({ path: `${statementPath}.condition`, message: "La condicion necesita devolver verdadero o falso.", severity: "error" });
          visitStatements(statement.body, `${statementPath}.body`, new Map(locals));
          break;
      }
    });
    return returnType;
  }

  if (expression.kind === "program") visitStatements(expression.statements, "program")
  else visit(expression, "formula");
  return issues;
}

function resolvePath(data: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((current, part) => {
    if (current && typeof current === "object" && part in current) {
      return (current as Record<string, unknown>)[part];
    }
    return undefined;
  }, data);
}

export function evaluateFormula(expression: FormulaRoot, data: unknown): unknown {
  const locals: Record<string, unknown> = {};
  const control = { returned: false, value: undefined as unknown };
  function evaluate(node: FormulaExpression): unknown {
    if (node.kind === "payroll") return evaluatePayrollFormula(data, node.config ?? DEFAULT_PAYROLL_CONFIG);
    if (node.kind === "literal") return node.value;
    if (node.kind === "variable") {
      const value = resolvePath({ ...(data && typeof data === "object" ? data as Record<string, unknown> : {}), ...locals }, node.key);
      if (value === undefined) throw new Error(`No se encontro la variable ${node.key} en los datos de prueba.`);
      return value;
    }
    if (node.kind === "member") {
      const object = evaluate(node.object);
      if (!object || typeof object !== "object") throw new Error(`No se puede leer ${node.property} en un valor que no es objeto.`);
      return (object as Record<string, unknown>)[node.property];
    }
    if (node.kind === "unary") {
      const operand = evaluate(node.operand);
      if (node.operator === "!") return !operand;
      if (node.operator === "~") return ~Number(operand);
      return -Number(operand);
    }
    if (node.kind === "conditional") {
      return evaluate(node.condition) ? evaluate(node.whenTrue) : evaluate(node.whenFalse);
    }
    if (node.kind === "call") {
      const args = node.args.map(evaluate);
      switch (node.name) {
        case "math.abs": return Math.abs(Number(args[0]));
        case "math.sqrt": {
          const value = Number(args[0]);
          if (value < 0) throw new Error("La raiz cuadrada requiere un valor mayor o igual que cero.");
          return Math.sqrt(value);
        }
        case "math.round": return Math.round(Number(args[0]));
        case "math.pow": return Math.pow(Number(args[0]), Number(args[1]));
        case "string.contains": return String(args[0]).includes(String(args[1]));
        case "string.starts_with": return String(args[0]).startsWith(String(args[1]));
        case "string.ends_with": return String(args[0]).endsWith(String(args[1]));
        case "seq.list": return args;
        case "seq.map": {
          const result: Record<string, unknown> = {};
          for (let index = 0; index < args.length; index += 2) result[String(args[index])] = args[index + 1];
          return result;
        }
        case "seq.add": {
          if (!Array.isArray(args[0])) throw new Error("seq.add necesita una lista como primer argumento.");
          args[0].push(args[1]);
          return args[0];
        }
      }
    }
    if (node.kind === "array") return node.items.map(evaluate);
    if (node.kind === "object") return Object.fromEntries(node.entries.map(({ key, value }) => [key, evaluate(value)]));

    const left = evaluate(node.left);
    const right = evaluate(node.right);
    switch (node.operator) {
      case "+": return Number(left) + Number(right);
      case "-": return Number(left) - Number(right);
      case "*": return Number(left) * Number(right);
      case "/":
        if (Number(right) === 0) throw new Error("No se puede dividir para cero.");
        return Number(left) / Number(right);
      case "%":
        if (Number(right) === 0) throw new Error("No se puede calcular el modulo para cero.");
        return Number(left) % Number(right);
      case "**": return Number(left) ** Number(right);
      case "&": return Number(left) & Number(right);
      case "|": return Number(left) | Number(right);
      case "^": return Number(left) ^ Number(right);
      case "<<": return Number(left) << Number(right);
      case ">>": return Number(left) >> Number(right);
      case ">>>": return Number(left) >>> Number(right);
      case "==": return left === right;
      case "!=": return left !== right;
      case "=~": {
        try {
          return new RegExp(String(right)).test(String(left));
        } catch {
          throw new Error("El patron de la comparacion =~ no es valido.");
        }
      }
      case ">": return Number(left) > Number(right);
      case ">=": return Number(left) >= Number(right);
      case "<": return Number(left) < Number(right);
      case "<=": return Number(left) <= Number(right);
      case "&&": return Boolean(left) && Boolean(right);
      case "||": return Boolean(left) || Boolean(right);
    }
  }

  function execute(statements: FormulaStatement[]): "break" | "continue" | undefined {
    for (const statement of statements) {
      switch (statement.kind) {
        case "section": break;
        case "declaration": locals[statement.name] = evaluate(statement.value); break;
        case "assignment": locals[statement.name] = evaluate(statement.value); break;
        case "expression": evaluate(statement.expression); break;
        case "continue": return "continue";
        case "break": return "break";
        case "throw": throw new Error(String(evaluate(statement.message)));
        case "return": control.value = evaluate(statement.value); control.returned = true; return;
        case "if": {
          let branchExecuted = false;
          if (evaluate(statement.condition)) {
            branchExecuted = true;
            const signal = execute(statement.then);
            if (signal) return signal;
          }
          if (!branchExecuted) for (const branch of statement.elseIf) {
            if (evaluate(branch.condition)) {
              branchExecuted = true;
              const signal = execute(branch.body);
              if (signal) return signal;
              break;
            }
          }
          if (!branchExecuted) {
            const signal = execute(statement.otherwise);
            if (signal) return signal;
          }
          break;
        }
        case "for": {
          const collection = evaluate(statement.collection);
          if (!Array.isArray(collection)) throw new Error(`La variable del ciclo ${statement.item} no contiene una lista.`);
          for (const item of collection) {
            locals[statement.item] = item;
            const signal = execute(statement.body);
            if (control.returned) return;
            if (signal === "break") break;
          }
          break;
        }
        case "while": {
          let guard = 0;
          while (evaluate(statement.condition)) {
            if (++guard > 10_000) throw new Error("El ciclo mientras supero el limite de seguridad.");
            const signal = execute(statement.body);
            if (control.returned || signal === "break") break;
          }
          break;
        }
      }
      if (control.returned) return;
    }
  }

  if (expression.kind === "program") {
    execute(expression.statements);
    if (!control.returned) throw new Error("El programa debe terminar con un bloque DEVOLVER.");
    return control.value;
  }
  return evaluate(expression);
}
