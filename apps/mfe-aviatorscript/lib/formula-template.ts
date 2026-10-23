import type { FormulaBinaryOperator, FormulaExpression, FormulaFunctionName, FormulaProgram, FormulaRoot, FormulaStatement, FormulaValueType } from "./formula";
import { PAYROLL_SCHEMA, payrollSchemaForTemplate } from "./payroll-formula";
import type { SchemaField } from "./types";
import { AVIATOR_FUNCTIONS } from "./aviator-contract";

type Token = { kind: "number" | "string" | "identifier" | "operator" | "section" | "end"; value: string };

const OPERATORS = [">>>", "**", "<<", ">>", "&&", "||", "==", "!=", "=~", ">=", "<=", "->", "+", "-", "*", "/", "%", "&", "|", "^", ">", "<", "!", "~", "?", ":", "(", ")", ",", "=", ";", "{", "}"];
const PRECEDENCE: Record<string, number> = {
  "||": 1,
  "&&": 2,
  "|": 3,
  "^": 4,
  "&": 5,
  "==": 6,
  "!=": 6,
  "=~": 6,
  ">": 7,
  ">=": 7,
  "<": 7,
  "<=": 7,
  "<<": 8,
  ">>": 8,
  ">>>": 8,
  "+": 9,
  "-": 9,
  "*": 10,
  "/": 10,
  "%": 10,
  "**": 11
};
const MAX_VISUAL_TOKENS = 4096;

function tokenize(source: string): Token[] {
  if (source.length > 10_000) throw new Error("La formula supera el limite de longitud para el editor visual.");
  const tokens: Token[] = [];
  let index = 0;
  while (index < source.length) {
    const char = source[index];
    if (source.startsWith("##", index)) {
      const lineEnd = source.indexOf("\n", index);
      const end = lineEnd === -1 ? source.length : lineEnd;
      tokens.push({ kind: "section", value: source.slice(index + 2, end).trim() });
      index = end;
      continue;
    }
    if (source.startsWith("//", index)) {
      const lineEnd = source.indexOf("\n", index);
      index = lineEnd === -1 ? source.length : lineEnd;
      continue;
    }
    if (/\s/.test(char)) {
      index += 1;
      continue;
    }
    if (char === "'" || char === '"') {
      const quote = char;
      let value = "";
      index += 1;
      let closed = false;
      while (index < source.length) {
        const current = source[index++];
        if (current === quote) {
          closed = true;
          break;
        }
        if (current !== "\\") {
          value += current;
          continue;
        }
        if (index >= source.length) throw new Error("La formula termina con una secuencia de escape incompleta.");
        const escaped = source[index++];
        const escapes: Record<string, string> = { n: "\n", r: "\r", t: "\t", "\\": "\\", "'": "'", '"': '"' };
        if (escaped === "u") {
          const code = source.slice(index, index + 4);
          if (!/^[\da-fA-F]{4}$/.test(code)) throw new Error("La formula contiene un escape Unicode invalido.");
          value += String.fromCharCode(Number.parseInt(code, 16));
          index += 4;
        } else {
          value += escapes[escaped] ?? escaped;
        }
      }
      if (!closed) throw new Error("Hay un texto sin comillas de cierre.");
      tokens.push({ kind: "string", value });
      continue;
    }
    const rest = source.slice(index);
    const number = rest.match(/^(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/);
    if (number) {
      tokens.push({ kind: "number", value: number[0] });
      index += number[0].length;
      continue;
    }
    const identifier = rest.match(/^[A-Za-z_$][A-Za-z\d_$]*(?:\.[A-Za-z_$][A-Za-z\d_$]*)*/);
    if (identifier) {
      tokens.push({ kind: "identifier", value: identifier[0] });
      index += identifier[0].length;
      continue;
    }
    const operator = OPERATORS.find((candidate) => rest.startsWith(candidate));
    if (!operator) throw new Error(`Simbolo no compatible con el constructor: ${char}`);
    tokens.push({ kind: "operator", value: operator });
    index += operator.length;
    if (tokens.length > MAX_VISUAL_TOKENS) throw new Error("La formula es demasiado compleja para cargarla como bloques visuales.");
  }
  tokens.push({ kind: "end", value: "" });
  return tokens;
}

export function parseAviatorTemplate(source: string, fields: SchemaField[]): FormulaExpression {
  const tokens = tokenize(source);
  if (tokens.length > MAX_VISUAL_TOKENS + 1) throw new Error("La formula es demasiado compleja para cargarla como bloques visuales.");
  const schema = new Map(fields.map((field) => [field.key, field.type]));
  let position = 0;
  const current = () => tokens[position];
  const consume = (expected?: string) => {
    const token = current();
    if (expected && token.value !== expected) throw new Error(`Se esperaba "${expected}" en la formula.`);
    position += 1;
    return token;
  };

  function parsePrimary(): FormulaExpression {
    const token = current();
    if (token.kind === "number") {
      consume();
      const value = Number(token.value);
      if (!Number.isFinite(value)) throw new Error("La formula contiene un numero fuera de rango.");
      return { kind: "literal", valueType: "number", value };
    }
    if (token.kind === "string") {
      consume();
      return { kind: "literal", valueType: "string", value: token.value };
    }
    if (token.value === "(") {
      consume("(");
      const expression = parseExpression(0);
      consume(")");
      return expression;
    }
    if (token.kind === "operator" && (token.value === "!" || token.value === "-" || token.value === "~")) {
      consume();
      const operand = parseExpression(7);
      return { kind: "unary", operator: token.value, operand, valueType: token.value === "!" ? "boolean" : "number" };
    }
    if (token.kind !== "identifier") throw new Error("La formula contiene una expresion que no se reconoce.");
    consume();
    if (token.value === "nil") return { kind: "literal", valueType: "null", value: null };
    if (token.value === "true" || token.value === "false") {
      return { kind: "literal", valueType: "boolean", value: token.value === "true" };
    }
    if (token.value === "lambda") {
      consume("(");
      const parameters: string[] = [];
      if (current().value !== ")") {
        do {
          const parameter = consume();
          if (parameter.kind !== "identifier" || parameter.value.includes(".")) throw new Error("Los parametros de lambda deben ser nombres simples.");
          parameters.push(parameter.value);
          if (current().value !== ",") break;
          consume(",");
        } while (true);
      }
      consume(")");
      consume("->");
      const body = parseExpression(0);
      consume("end");
      return { kind: "lambda", parameters, body, valueType: "lambda" };
    }
    if (current().value === "(") {
      if (!AVIATOR_FUNCTIONS.has(token.value as FormulaFunctionName)) {
        throw new Error(`La funcion ${token.value} no esta disponible como plantilla visual.`);
      }
      consume("(");
      const args: FormulaExpression[] = [];
      if (current().value !== ")") {
        do {
          args.push(parseExpression(0));
          if (current().value !== ",") break;
          consume(",");
        } while (true);
      }
      consume(")");
      const name = token.value as FormulaFunctionName;
      if (name === "seq.map" && args.length % 2 !== 0) throw new Error("seq.map requiere pares de clave y valor.");
      const expectedArgs = name === "math.pow" || name === "math.min" || name === "math.max" || name.startsWith("string.") || name === "seq.add" || name === "seq.include" ? 2
        : name === "seq.count" ? 1
          : name === "seq.filter" ? 2
            : name === "seq.reduce" ? 3 : undefined;
      if (expectedArgs !== undefined && args.length !== expectedArgs) throw new Error(`${name} requiere ${expectedArgs} argumento(s).`);
      if (["seq.filter", "seq.reduce"].includes(name) && args[1]?.kind !== "lambda") throw new Error(`${name} requiere una lambda como segundo argumento.`);
      const valueType: FormulaValueType = name === "seq.map" ? "object"
        : name === "seq.list" || name === "seq.add" || name === "seq.filter" ? "array"
          : name === "seq.include" ? "boolean"
          : name === "seq.count" || name.startsWith("math.") ? "number"
            : name.startsWith("string.") ? "boolean" : "unknown";
      return { kind: "call", name, args, valueType };
    }
    if (schema.has(token.value) || !token.value.includes(".")) {
      return { kind: "variable", key: token.value, valueType: schema.get(token.value) ?? "unknown" };
    }
    const [rootKey, ...properties] = token.value.split(".");
    let member: FormulaExpression = { kind: "variable", key: rootKey, valueType: schema.get(rootKey) ?? "unknown" };
    for (const property of properties) member = { kind: "member", object: member, property, valueType: "unknown" };
    return member;
  }

  function parseExpression(minPrecedence: number): FormulaExpression {
    let left = parsePrimary();
    while (true) {
      const operator = current().value;
      if (operator === "?" && minPrecedence <= 0) {
        consume("?");
        const whenTrue = parseExpression(0);
        consume(":");
        const whenFalse = parseExpression(0);
        const valueType = whenTrue.valueType === "unknown" ? whenFalse.valueType : whenTrue.valueType;
        left = { kind: "conditional", condition: left, whenTrue, whenFalse, valueType };
        continue;
      }
      const precedence = PRECEDENCE[operator];
      if (precedence === undefined || precedence < minPrecedence) break;
      consume();
      const right = parseExpression(precedence + 1);
      const valueType: FormulaValueType = ["==", "!=", "=~", ">", ">=", "<", "<=", "&&", "||"].includes(operator) ? "boolean" : "number";
      left = { kind: "binary", operator: operator as FormulaBinaryOperator, left, right, valueType };
    }
    return left;
  }

  if (!source.trim()) throw new Error("La formula guardada no tiene una expresion.");
  const expression = parseExpression(0);
  if (current().kind !== "end") throw new Error(`La formula contiene texto no compatible cerca de "${current().value}".`);
  return expression;
}

const PROGRAM_KEYWORDS = new Set(["let", "if", "elsif", "else", "for", "in", "while", "continue", "break", "throw", "return"]);

export function parseAviatorProgram(source: string, fields: SchemaField[]): FormulaProgram {
  const tokens = tokenize(source);
  const schema = new Map(fields.map((field) => [field.key, field.type]));
  let position = 0;
  const current = () => tokens[position];
  const consume = (expected?: string) => {
    const token = current();
    if (expected && token.value !== expected) throw new Error(`Se esperaba "${expected}" en la formula.`);
    position += 1;
    return token;
  };

  function parsePrimary(): FormulaExpression {
    const token = current();
    if (token.kind === "number") {
      consume();
      const value = Number(token.value);
      if (!Number.isFinite(value)) throw new Error("La formula contiene un numero fuera de rango.");
      return { kind: "literal", valueType: "number", value };
    }
    if (token.kind === "string") {
      consume();
      return { kind: "literal", valueType: "string", value: token.value };
    }
    if (token.value === "(") {
      consume("(");
      const expression = parseExpression(0);
      consume(")");
      return expression;
    }
    if (token.kind === "operator" && (token.value === "!" || token.value === "-" || token.value === "~")) {
      consume();
      const operand = parseExpression(12);
      return { kind: "unary", operator: token.value, operand, valueType: token.value === "!" ? "boolean" : "number" };
    }
    if (token.kind !== "identifier") throw new Error("La formula contiene una expresion que no se reconoce.");
    consume();
    if (token.value === "nil") return { kind: "literal", valueType: "null", value: null };
    if (token.value === "true" || token.value === "false") {
      return { kind: "literal", valueType: "boolean", value: token.value === "true" };
    }
    if (token.value === "lambda") {
      consume("(");
      const parameters: string[] = [];
      if (current().value !== ")") {
        do {
          const parameter = consume();
          if (parameter.kind !== "identifier" || parameter.value.includes(".")) throw new Error("Los parametros de lambda deben ser nombres simples.");
          parameters.push(parameter.value);
          if (current().value !== ",") break;
          consume(",");
        } while (true);
      }
      consume(")");
      consume("->");
      const body = parseExpression(0);
      consume("end");
      return { kind: "lambda", parameters, body, valueType: "lambda" };
    }
    if (current().value === "(") {
      if (!AVIATOR_FUNCTIONS.has(token.value as FormulaFunctionName)) {
        throw new Error(`La funcion ${token.value} no esta disponible como plantilla visual.`);
      }
      consume("(");
      const args: FormulaExpression[] = [];
      if (current().value !== ")") {
        do {
          args.push(parseExpression(0));
          if (current().value !== ",") break;
          consume(",");
        } while (true);
      }
      consume(")");
      const name = token.value as FormulaFunctionName;
      if (name === "seq.map" && args.length % 2 !== 0) throw new Error("seq.map requiere pares de clave y valor.");
      const expectedArgs = name === "math.pow" || name === "math.min" || name === "math.max" || name.startsWith("string.") || name === "seq.add" || name === "seq.include" ? 2
        : name === "seq.count" ? 1
          : name === "seq.filter" ? 2
            : name === "seq.reduce" ? 3 : undefined;
      if (expectedArgs !== undefined && args.length !== expectedArgs) throw new Error(`${name} requiere ${expectedArgs} argumento(s).`);
      if (["seq.filter", "seq.reduce"].includes(name) && args[1]?.kind !== "lambda") throw new Error(`${name} requiere una lambda como segundo argumento.`);
      const valueType: FormulaValueType = name === "seq.map" ? "object"
        : name === "seq.list" || name === "seq.add" || name === "seq.filter" ? "array"
          : name === "seq.include" ? "boolean"
          : name === "seq.count" || name.startsWith("math.") ? "number"
            : name.startsWith("string.") ? "boolean" : "unknown";
      return { kind: "call", name, args, valueType };
    }
    if (schema.has(token.value) || !token.value.includes(".")) {
      return { kind: "variable", key: token.value, valueType: schema.get(token.value) ?? "unknown" };
    }
    const [rootKey, ...properties] = token.value.split(".");
    let member: FormulaExpression = { kind: "variable", key: rootKey, valueType: schema.get(rootKey) ?? "unknown" };
    for (const property of properties) member = { kind: "member", object: member, property, valueType: "unknown" };
    return member;
  }

  function parseExpression(minPrecedence: number): FormulaExpression {
    let left = parsePrimary();
    while (true) {
      const operator = current().value;
      if (operator === "?" && minPrecedence <= 0) {
        consume("?");
        const whenTrue = parseExpression(0);
        consume(":");
        const whenFalse = parseExpression(0);
        const valueType = whenTrue.valueType === "unknown" ? whenFalse.valueType : whenTrue.valueType;
        left = { kind: "conditional", condition: left, whenTrue, whenFalse, valueType };
        continue;
      }
      const precedence = PRECEDENCE[operator];
      if (precedence === undefined || precedence < minPrecedence) break;
      consume();
      const right = parseExpression(precedence + 1);
      const valueType: FormulaValueType = ["==", "!=", "=~", ">", ">=", "<", "<=", "&&", "||"].includes(operator) ? "boolean" : "number";
      left = { kind: "binary", operator: operator as FormulaBinaryOperator, left, right, valueType };
    }
    return left;
  }

  function parseBlock(): FormulaStatement[] {
    consume("{");
    return parseStatements(true);
  }

  function parseCondition(): FormulaExpression {
    consume("(");
    const condition = parseExpression(0);
    consume(")");
    return condition;
  }

  function parseIf(): FormulaStatement {
    consume("if");
    const condition = parseCondition();
    const then = parseBlock();
    const elseIf: { condition: FormulaExpression; body: FormulaStatement[] }[] = [];
    while (current().value === "elsif") {
      consume("elsif");
      elseIf.push({ condition: parseCondition(), body: parseBlock() });
    }
    const otherwise = current().value === "else" ? (consume("else"), parseBlock()) : [];
    return { kind: "if", condition, then, elseIf, otherwise };
  }

  function parseStatement(): FormulaStatement {
    const token = current();
    if (token.kind === "section") {
      consume();
      return { kind: "section", title: token.value };
    }
    if (token.value === "let") {
      consume("let");
      const name = consume().value;
      consume("=");
      const value = parseExpression(0);
      consume(";");
      return { kind: "declaration", name, value };
    }
    if (token.value === "if") return parseIf();
    if (token.value === "for") {
      consume("for");
      const item = consume().value;
      consume("in");
      const collection = parseExpression(0);
      return { kind: "for", item, collection, body: parseBlock() };
    }
    if (token.value === "while") {
      consume("while");
      const condition = parseCondition();
      return { kind: "while", condition, body: parseBlock() };
    }
    if (token.value === "continue" || token.value === "break") {
      consume();
      consume(";");
      return { kind: token.value === "continue" ? "continue" : "break" };
    }
    if (token.value === "throw") {
      consume("throw");
      const message = parseExpression(0);
      consume(";");
      return { kind: "throw", message };
    }
    if (token.value === "return") {
      consume("return");
      const value = parseExpression(0);
      consume(";");
      return { kind: "return", value };
    }
    if (token.kind === "identifier" && tokens[position + 1]?.value === "=") {
      const name = consume().value;
      consume("=");
      const value = parseExpression(0);
      consume(";");
      return { kind: "assignment", name, value };
    }
    const expression = parseExpression(0);
    consume(";");
    return { kind: "expression", expression };
  }

  function parseStatements(stopAtClosingBrace = false): FormulaStatement[] {
    const statements: FormulaStatement[] = [];
    while (current().kind !== "end" && (!stopAtClosingBrace || current().value !== "}")) {
      statements.push(parseStatement());
    }
    if (stopAtClosingBrace) consume("}");
    return statements;
  }

  function findReturnType(statements: FormulaStatement[]): FormulaValueType {
    for (let index = statements.length - 1; index >= 0; index -= 1) {
      const statement = statements[index];
      if (statement.kind === "return") return statement.value.valueType;
      if (statement.kind === "if") {
        const nested = findReturnType([...statement.then, ...statement.elseIf.flatMap((branch) => branch.body), ...statement.otherwise]);
        if (nested !== "unknown") return nested;
      }
      if (statement.kind === "for" || statement.kind === "while") {
        const nested = findReturnType(statement.body);
        if (nested !== "unknown") return nested;
      }
    }
    return "unknown";
  }

  const statements = parseStatements();
  if (current().kind !== "end") throw new Error(`La formula contiene texto no compatible cerca de "${current().value}".`);
  return { kind: "program", statements, valueType: findReturnType(statements) };
}

export function parseAviatorSource(source: string, fields: SchemaField[]): FormulaRoot {
  const tokens = tokenize(source);
  const isProgram = tokens.some((token) => token.kind === "section"
    || (token.kind === "identifier" && PROGRAM_KEYWORDS.has(token.value))
    || [";", "{", "}"].includes(token.value));
  return isProgram ? parseAviatorProgram(source, fields) : parseAviatorTemplate(source, fields);
}

export function schemaForTemplate(expression: FormulaRoot, fields: SchemaField[]): SchemaField[] {
  if (expression.kind === "payroll") return payrollSchemaForTemplate(fields);
  const result = [...fields];
  const known = new Set(fields.map((field) => field.key));
  const localNames = new Set<string>();
  function visit(node: FormulaExpression) {
    if (node.kind === "payroll") return;
    if (node.kind === "variable") {
      if (localNames.has(node.key)) return;
      if (!known.has(node.key)) {
        result.push({ key: node.key, label: node.key, type: "unknown", description: "Variable tomada de la formula guardada; confirma su tipo en el esquema JVM." });
        known.add(node.key);
      }
      return;
    }
    if (node.kind === "literal") return;
    if (node.kind === "member") visit(node.object);
    else if (node.kind === "unary") visit(node.operand);
    else if (node.kind === "conditional") {
      visit(node.condition);
      visit(node.whenTrue);
      visit(node.whenFalse);
    } else if (node.kind === "call") node.args.forEach(visit);
    else if (node.kind === "lambda") {
      const previous = new Set(localNames);
      node.parameters.forEach((parameter) => localNames.add(parameter));
      visit(node.body);
      localNames.clear();
      previous.forEach((name) => localNames.add(name));
    }
    else if (node.kind === "array") node.items.forEach(visit);
    else if (node.kind === "object") node.entries.forEach(({ value }) => visit(value));
    else {
      visit(node.left);
      visit(node.right);
    }
  }
  function visitStatements(statements: FormulaStatement[]) {
    statements.forEach((statement) => {
      switch (statement.kind) {
        case "section":
        case "continue":
        case "break":
          break;
        case "declaration":
        case "assignment":
          visit(statement.value);
          break;
        case "expression": visit(statement.expression); break;
        case "throw":
        case "return": visit(statement.kind === "throw" ? statement.message : statement.value); break;
        case "if":
          visit(statement.condition);
          visitStatements(statement.then);
          statement.elseIf.forEach((branch) => { visit(branch.condition); visitStatements(branch.body); });
          visitStatements(statement.otherwise);
          break;
        case "for": visit(statement.collection); visitStatements(statement.body); break;
        case "while": visit(statement.condition); visitStatements(statement.body); break;
      }
    });
  }
  function collectLocalNames(statements: FormulaStatement[]) {
    statements.forEach((statement) => {
      switch (statement.kind) {
        case "declaration":
        case "assignment":
          localNames.add(statement.name);
          break;
        case "if":
          collectLocalNames(statement.then);
          statement.elseIf.forEach((branch) => collectLocalNames(branch.body));
          collectLocalNames(statement.otherwise);
          break;
        case "for":
          localNames.add(statement.item);
          collectLocalNames(statement.body);
          break;
        case "while":
          collectLocalNames(statement.body);
          break;
        default:
          break;
      }
    });
  }
  if (expression.kind === "program") {
    collectLocalNames(expression.statements);
    visitStatements(expression.statements);
  } else visit(expression);
  return result;
}

export function variablesForTemplate(expression: FormulaRoot, fields: SchemaField[]): SchemaField[] {
  const available = new Map<string, SchemaField>();
  [...PAYROLL_SCHEMA, ...fields].forEach((field) => available.set(field.key, field));

  if (expression.kind === "payroll") {
    return PAYROLL_SCHEMA.map((field) => available.get(field.key) ?? field);
  }

  const keys = new Set<string>();
  const localNames = new Set<string>();
  function visit(node: FormulaExpression) {
    if (node.kind === "payroll") return;
    if (node.kind === "variable") {
      if (!localNames.has(node.key)) keys.add(node.key);
      return;
    }
    if (node.kind === "literal") return;
    if (node.kind === "member") visit(node.object);
    else if (node.kind === "unary") visit(node.operand);
    else if (node.kind === "conditional") {
      visit(node.condition);
      visit(node.whenTrue);
      visit(node.whenFalse);
    } else if (node.kind === "call") node.args.forEach(visit);
    else if (node.kind === "lambda") {
      const previous = new Set(localNames);
      node.parameters.forEach((parameter) => localNames.add(parameter));
      visit(node.body);
      localNames.clear();
      previous.forEach((name) => localNames.add(name));
    }
    else if (node.kind === "array") node.items.forEach(visit);
    else if (node.kind === "object") node.entries.forEach(({ value }) => visit(value));
    else {
      visit(node.left);
      visit(node.right);
    }
  }
  function collectLocalNames(statements: FormulaStatement[]) {
    statements.forEach((statement) => {
      switch (statement.kind) {
        case "declaration":
        case "assignment":
          localNames.add(statement.name);
          break;
        case "if":
          collectLocalNames(statement.then);
          statement.elseIf.forEach((branch) => collectLocalNames(branch.body));
          collectLocalNames(statement.otherwise);
          break;
        case "for":
          localNames.add(statement.item);
          collectLocalNames(statement.body);
          break;
        case "while":
          collectLocalNames(statement.body);
          break;
        default:
          break;
      }
    });
  }
  function visitStatements(statements: FormulaStatement[]) {
    statements.forEach((statement) => {
      switch (statement.kind) {
        case "declaration":
        case "assignment":
          visit(statement.value);
          break;
        case "expression": visit(statement.expression); break;
        case "throw":
        case "return": visit(statement.kind === "throw" ? statement.message : statement.value); break;
        case "if":
          visit(statement.condition);
          visitStatements(statement.then);
          statement.elseIf.forEach((branch) => { visit(branch.condition); visitStatements(branch.body); });
          visitStatements(statement.otherwise);
          break;
        case "for": visit(statement.collection); visitStatements(statement.body); break;
        case "while": visit(statement.condition); visitStatements(statement.body); break;
        case "section":
        case "continue":
        case "break":
          break;
      }
    });
  }

  if (expression.kind === "program") {
    collectLocalNames(expression.statements);
    visitStatements(expression.statements);
  } else visit(expression);

  return [...keys].map((key) => available.get(key) ?? {
    key,
    label: key,
    type: "unknown",
    description: "Variable tomada de la formula guardada; confirma su tipo en el esquema JVM."
  });
}
