import type { Edge, Node } from "@xyflow/react";
import type { FormulaExpression, FormulaProgram, FormulaRoot, FormulaStatement, FormulaValueType } from "./formula";

export type AviatorFlowNodeKind = "start" | "end" | "process" | "decision" | "iteration" | "exception" | "return" | "function";

export interface AviatorSourceRange {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}

export interface AviatorFlowNodeData extends Record<string, unknown> {
  kind: AviatorFlowNodeKind;
  label: string;
  instruction: string;
  sourceCode: string;
  source: AviatorSourceRange;
  referencedVariables: string[];
  assignedVariables: string[];
  branches?: { label: string; targetId?: string }[];
  previousIds: string[];
  nextIds: string[];
  synthetic?: boolean;
}

export type AviatorFlowNode = Node<AviatorFlowNodeData, "aviator-flow-node">;
export type AviatorFlowEdge = Edge<{ label?: string }, "aviator-flow-edge">;

export interface AviatorFlowDiagnostic {
  severity: "error" | "warning";
  message: string;
  line?: number;
  column?: number;
}

export interface AviatorFlowGraph {
  valid: boolean;
  nodes: AviatorFlowNode[];
  edges: AviatorFlowEdge[];
  diagnostics: AviatorFlowDiagnostic[];
}

/**
 * Hides the contents of selected decisions/loops behind one visible summary
 * node while preserving the exits that can still be reached afterwards.
 */
export function collapseAviatorFlowGraph(graph: AviatorFlowGraph, collapsedIds: Set<string>): AviatorFlowGraph {
  if (!collapsedIds.size) return graph;
  const outgoing = new Map<string, string[]>();
  graph.edges.forEach((edge) => outgoing.set(edge.source, [...(outgoing.get(edge.source) ?? []), edge.target]));
  const hidden = new Set<string>();
  const boundaries = new Map<string, Set<string>>();

  collapsedIds.forEach((rootId) => {
    const root = graph.nodes.find((node) => node.id === rootId);
    if (!root || (root.data.kind !== "decision" && root.data.kind !== "iteration")) return;
    const seen = new Set<string>([rootId]);
    const queue = [...(outgoing.get(rootId) ?? [])];
    const rootBoundaries = new Set<string>();
    while (queue.length) {
      const currentId = queue.shift()!;
      if (seen.has(currentId)) continue;
      seen.add(currentId);
      const current = graph.nodes.find((node) => node.id === currentId);
      if (!current || current.data.synthetic || current.data.kind === "end") {
        if (current) rootBoundaries.add(currentId);
        continue;
      }
      hidden.add(currentId);
      queue.push(...(outgoing.get(currentId) ?? []));
    }
    hidden.delete(rootId);
    boundaries.set(rootId, rootBoundaries);
  });

  const visibleNodes = graph.nodes.filter((node) => !hidden.has(node.id));
  const visibleNodeIds = new Set(visibleNodes.map((node) => node.id));
  const collapsedSummaryNodes = [...boundaries.keys()].flatMap((rootId) => {
    const root = graph.nodes.find((node) => node.id === rootId);
    if (!root || !visibleNodeIds.has(rootId)) return [];
    return [{
      id: `collapsed-content-${rootId}`,
      type: "aviator-flow-node" as const,
      position: { x: 0, y: 0 },
      data: {
        kind: "process" as const,
        label: "Contenido oculto",
        instruction: "Contenido contraido",
        sourceCode: "",
        source: root.data.source,
        referencedVariables: [],
        assignedVariables: [],
        previousIds: [rootId],
        nextIds: [...(boundaries.get(rootId) ?? [])],
        synthetic: true
      }
    } satisfies AviatorFlowNode];
  });
  visibleNodes.push(...collapsedSummaryNodes);
  const visibleNodeIdsWithSummary = new Set(visibleNodes.map((node) => node.id));
  const visibleEdges = graph.edges.filter((edge) => visibleNodeIdsWithSummary.has(edge.source) && visibleNodeIdsWithSummary.has(edge.target) && !boundaries.has(edge.source));
  boundaries.forEach((targets, rootId) => {
    const summaryId = `collapsed-content-${rootId}`;
    if (!visibleNodeIdsWithSummary.has(rootId) || !visibleNodeIdsWithSummary.has(summaryId)) return;
    visibleEdges.push({
      id: `collapsed-${rootId}`,
      source: rootId,
      target: summaryId,
      type: "aviator-flow-edge",
      label: "contenido oculto"
    });
    targets.forEach((targetId) => {
      if (!visibleNodeIdsWithSummary.has(targetId)) return;
      visibleEdges.push({
        id: `collapsed-${summaryId}-${targetId}`,
        source: summaryId,
        target: targetId,
        type: "aviator-flow-edge",
        label: "continuacion"
      });
    });
  });
  return { ...graph, nodes: visibleNodes, edges: visibleEdges };
}

type RemoteFlowNode = Partial<AviatorFlowNode> & {
  data?: Partial<AviatorFlowNodeData>;
  type?: string;
  position?: { x: number; y: number };
};

/** Adapta el contrato plano del servicio Java al nodo que consume React Flow. */
export function normalizeAviatorFlowGraph(value: unknown): AviatorFlowGraph {
  const candidate = value && typeof value === "object" ? value as {
    valid?: unknown;
    nodes?: unknown;
    edges?: unknown;
    diagnostics?: unknown;
  } : {};
  const nodes = Array.isArray(candidate.nodes) ? candidate.nodes.flatMap((item): AviatorFlowNode[] => {
    if (!item || typeof item !== "object") return [];
    const raw = item as RemoteFlowNode;
    const rawData = raw.data ?? raw as unknown as Partial<AviatorFlowNodeData>;
    const kind = rawData.kind ?? (raw.type as AviatorFlowNodeKind | undefined);
    if (!kind || typeof raw.id !== "string") return [];
    return [{
      id: raw.id,
      type: "aviator-flow-node",
      position: raw.position ?? { x: 0, y: 0 },
      data: {
        assignedVariables: Array.isArray(rawData.assignedVariables) ? rawData.assignedVariables : [],
        branches: Array.isArray(rawData.branches) ? rawData.branches : [],
        instruction: typeof rawData.instruction === "string" ? rawData.instruction : "Instruccion",
        kind,
        label: typeof rawData.label === "string" ? rawData.label : "Nodo",
        nextIds: Array.isArray(rawData.nextIds) ? rawData.nextIds : [],
        previousIds: Array.isArray(rawData.previousIds) ? rawData.previousIds : [],
        referencedVariables: Array.isArray(rawData.referencedVariables) ? rawData.referencedVariables : [],
        source: rawData.source && typeof rawData.source === "object" ? rawData.source : { startLine: 1, startColumn: 1, endLine: 1, endColumn: 1 },
        sourceCode: typeof rawData.sourceCode === "string" ? rawData.sourceCode : "",
        synthetic: rawData.synthetic === true
      }
    }];
  }) : [];
  const edges = Array.isArray(candidate.edges) ? candidate.edges.flatMap((item): AviatorFlowEdge[] => {
    if (!item || typeof item !== "object") return [];
    const raw = item as Partial<AviatorFlowEdge>;
    if (typeof raw.id !== "string" || typeof raw.source !== "string" || typeof raw.target !== "string") return [];
    return [{ id: raw.id, source: raw.source, target: raw.target, type: "aviator-flow-edge", label: typeof raw.label === "string" ? raw.label : undefined }];
  }) : [];
  const diagnostics = Array.isArray(candidate.diagnostics) ? candidate.diagnostics.filter((item): item is AviatorFlowDiagnostic => Boolean(item && typeof item === "object" && typeof (item as AviatorFlowDiagnostic).message === "string")) : [];
  return { valid: candidate.valid !== false, nodes, edges, diagnostics };
}

type StatementMeta = {
  path: string;
  source: AviatorSourceRange;
  sourceCode: string;
  branches?: { kind: "elsif" | "else"; source: AviatorSourceRange; sourceCode: string }[];
};

type StatementMap = Map<string, StatementMeta>;

type Fragment = {
  entry?: string;
  normalExits: string[];
  breakExits: string[];
  continueExits: string[];
  terminalExits: string[];
};

function emptyFragment(): Fragment {
  return {
    normalExits: [],
    breakExits: [],
    continueExits: [],
    terminalExits: []
  };
}

function clampText(value: string, max = 132) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > max ? `${normalized.slice(0, max - 1)}...` : normalized;
}

function expressionLabel(expression: FormulaExpression): string {
  switch (expression.kind) {
    case "literal": return typeof expression.value === "string" ? JSON.stringify(expression.value) : String(expression.value);
    case "variable": return expression.key;
    case "member": return `${expressionLabel(expression.object)}.${expression.property}`;
    case "binary": return `${expressionLabel(expression.left)} ${expression.operator} ${expressionLabel(expression.right)}`;
    case "unary": return `${expression.operator}${expressionLabel(expression.operand)}`;
    case "conditional": return `${expressionLabel(expression.condition)} ? ... : ...`;
    case "call": return `${expression.name}(${expression.args.map(expressionLabel).join(", ")})`;
    case "lambda": return `lambda(${expression.parameters.join(", ")}) -> ${expressionLabel(expression.body)} end`;
    case "array": return `seq.list(${expression.items.map(expressionLabel).join(", ")})`;
    case "object": return `seq.map(${expression.entries.map(({ key, value }) => `${key}: ${expressionLabel(value)}`).join(", ")})`;
    case "payroll": return "Calculo de nomina avanzada";
  }
}

function expressionVariables(expression: FormulaExpression, referenced = new Set<string>(), locals = new Set<string>()) {
  switch (expression.kind) {
    case "variable": if (!locals.has(expression.key)) referenced.add(expression.key); break;
    case "member": expressionVariables(expression.object, referenced, locals); break;
    case "unary": expressionVariables(expression.operand, referenced, locals); break;
    case "binary":
      expressionVariables(expression.left, referenced, locals);
      expressionVariables(expression.right, referenced, locals);
      break;
    case "conditional":
      expressionVariables(expression.condition, referenced, locals);
      expressionVariables(expression.whenTrue, referenced, locals);
      expressionVariables(expression.whenFalse, referenced, locals);
      break;
    case "call": expression.args.forEach((argument) => expressionVariables(argument, referenced, locals)); break;
    case "lambda": {
      const lambdaLocals = new Set(locals);
      expression.parameters.forEach((parameter) => lambdaLocals.add(parameter));
      expressionVariables(expression.body, referenced, lambdaLocals);
      break;
    }
    case "array": expression.items.forEach((item) => expressionVariables(item, referenced, locals)); break;
    case "object": expression.entries.forEach(({ value }) => expressionVariables(value, referenced, locals)); break;
    case "literal":
    case "payroll":
      break;
  }
  return [...referenced];
}

function lineBraceDelta(line: string) {
  let delta = 0;
  let quote = "";
  let escaped = false;
  for (const char of line) {
    if (quote) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = "";
      continue;
    }
    if (char === "\"" || char === "'") quote = char;
    else if (char === "{") delta += 1;
    else if (char === "}") delta -= 1;
  }
  return delta;
}

function blockEnd(lines: string[], startLine: number) {
  let depth = 0;
  let opened = false;
  for (let line = startLine; line < lines.length; line += 1) {
    const delta = lineBraceDelta(lines[line]);
    if (lines[line].includes("{")) opened = true;
    depth += delta;
    if (opened && depth <= 0) return line;
  }
  return startLine;
}

function statementNeedle(statement: FormulaStatement, branch: "if" | "elsif" | "else" = "if") {
  switch (statement.kind) {
    case "section": return `## ${statement.title}`;
    case "declaration": return `let ${statement.name}`;
    case "assignment": return `${statement.name} =`;
    case "if": return branch === "elsif" ? "elsif" : branch === "else" ? "else" : "if";
    case "for": return `for ${statement.item} in`;
    case "while": return "while";
    case "continue": return "continue";
    case "break": return "break";
    case "throw": return "throw";
    case "return": return "return";
    case "expression": return statement.expression.kind === "call" ? `${statement.expression.name}(` : "";
  }
}

function findSourceLine(lines: string[], statement: FormulaStatement, fromLine: number, branch: "if" | "elsif" | "else" = "if") {
  const needle = statementNeedle(statement, branch);
  for (let line = Math.max(0, fromLine); line < lines.length; line += 1) {
    const trimmed = lines[line].trimStart();
    if (needle && trimmed.startsWith(needle)) return line;
    if (!needle && trimmed && !trimmed.startsWith("##") && trimmed !== "{" && trimmed !== "}") return line;
  }
  return Math.min(Math.max(0, fromLine), Math.max(0, lines.length - 1));
}

function rangeFor(lines: string[], startLine: number, endLine: number): AviatorSourceRange {
  const startText = lines[startLine] ?? "";
  const endText = lines[endLine] ?? startText;
  return {
    startLine: startLine + 1,
    startColumn: startText.length - startText.trimStart().length + 1,
    endLine: endLine + 1,
    endColumn: Math.max(1, endText.length + 1)
  };
}

function mapSourceStatements(source: string, program: FormulaProgram): StatementMap {
  const lines = source.split(/\r?\n/);
  const result: StatementMap = new Map();

  function mapStatements(statements: FormulaStatement[], fromLine: number, prefix: string): number {
    let cursor = fromLine;
    statements.forEach((statement, index) => {
      const path = `${prefix}.${index}`;
      const startLine = findSourceLine(lines, statement, cursor);
      let endLine = statement.kind === "if" || statement.kind === "for" || statement.kind === "while"
        ? blockEnd(lines, startLine)
        : startLine;
      const branchRanges: StatementMeta["branches"] = [];

      if (statement.kind === "if") {
        const thenCursor = mapStatements(statement.then, startLine + 1, `${path}.then`);
        let branchCursor = thenCursor;
        statement.elseIf.forEach((branch, branchIndex) => {
          const branchStart = findSourceLine(lines, statement, branchCursor, "elsif");
          const branchEnd = blockEnd(lines, branchStart);
          const nestedEnd = mapStatements(branch.body, branchStart + 1, `${path}.elseIf.${branchIndex}`);
          branchRanges?.push({ kind: "elsif", source: rangeFor(lines, branchStart, Math.max(branchEnd, nestedEnd - 1)), sourceCode: lines.slice(branchStart, Math.max(branchEnd, nestedEnd - 1) + 1).join("\n").trim() });
          branchCursor = branchEnd + 1;
          endLine = Math.max(endLine, branchEnd, nestedEnd - 1);
        });
        if (statement.otherwise.length) {
          const elseStart = findSourceLine(lines, statement, branchCursor, "else");
          const elseEnd = blockEnd(lines, elseStart);
          const nestedEnd = mapStatements(statement.otherwise, elseStart + 1, `${path}.otherwise`);
          branchRanges?.push({ kind: "else", source: rangeFor(lines, elseStart, Math.max(elseEnd, nestedEnd - 1)), sourceCode: lines.slice(elseStart, Math.max(elseEnd, nestedEnd - 1) + 1).join("\n").trim() });
          endLine = Math.max(endLine, elseEnd, nestedEnd - 1);
        }
      } else if (statement.kind === "for" || statement.kind === "while") {
        const nestedEnd = mapStatements(statement.body, startLine + 1, `${path}.body`);
        endLine = Math.max(endLine, nestedEnd - 1);
      }

      result.set(path, {
        path,
        source: rangeFor(lines, startLine, Math.max(startLine, endLine)),
        sourceCode: lines.slice(startLine, Math.max(startLine, endLine) + 1).join("\n").trim(),
        branches: branchRanges?.length ? branchRanges : undefined
      });
      cursor = Math.max(cursor, endLine + 1);
    });
    return cursor;
  }

  mapStatements(program.statements, 0, "root");
  return result;
}

function statementInstruction(statement: FormulaStatement): string {
  switch (statement.kind) {
    case "section": return "Seccion";
    case "declaration": return "Declaracion de variable";
    case "assignment": return "Asignacion de variable";
    case "expression": return statement.expression.kind === "call" ? "Invocacion de funcion" : "Expresion";
    case "if": return "Decision condicional";
    case "for": return "Iteracion for";
    case "while": return "Iteracion while";
    case "continue": return "Continuar ciclo";
    case "break": return "Salir del ciclo";
    case "throw": return "Excepcion controlada";
    case "return": return "Retorno de resultado";
  }
}

function statementLabel(statement: FormulaStatement): string {
  switch (statement.kind) {
    case "section": return statement.title || "Seccion";
    case "declaration": return `Declarar ${statement.name} = ${expressionLabel(statement.value)}`;
    case "assignment": return `Asignar ${statement.name} = ${expressionLabel(statement.value)}`;
    case "expression": return expressionLabel(statement.expression);
    case "if": return `Si ${expressionLabel(statement.condition)}`;
    case "for": return `Para cada ${statement.item} en ${expressionLabel(statement.collection)}`;
    case "while": return `Mientras ${expressionLabel(statement.condition)}`;
    case "continue": return "Continuar";
    case "break": return "Salir del ciclo";
    case "throw": return `Lanzar error: ${expressionLabel(statement.message)}`;
    case "return": return `Devolver ${expressionLabel(statement.value)}`;
  }
}

function statementExpressions(statement: FormulaStatement) {
  switch (statement.kind) {
    case "declaration": return { expression: statement.value, assigned: [statement.name] };
    case "assignment": return { expression: statement.value, assigned: [statement.name] };
    case "expression": return { expression: statement.expression, assigned: [] };
    case "if": return { expression: statement.condition, assigned: [] };
    case "for": return { expression: statement.collection, assigned: [statement.item] };
    case "while": return { expression: statement.condition, assigned: [] };
    case "throw": return { expression: statement.message, assigned: [] };
    case "return": return { expression: statement.value, assigned: [] };
    case "section":
    case "continue":
    case "break": return { expression: undefined, assigned: [] };
  }
}

function sourceFallback(): AviatorSourceRange {
  return { startLine: 1, startColumn: 1, endLine: 1, endColumn: 1 };
}

export function buildLocalAviatorFlow(source: string, expression: FormulaRoot): AviatorFlowGraph {
  const nodes: AviatorFlowNode[] = [];
  const edges: AviatorFlowEdge[] = [];
  const sourceMap = expression.kind === "program" ? mapSourceStatements(source, expression) : new Map<string, StatementMeta>();
  let nodeCounter = 0;
  let edgeCounter = 0;

  function addNode(kind: AviatorFlowNodeKind, label: string, instruction: string, path: string, statement?: FormulaStatement, sourceOverride?: AviatorSourceRange, synthetic = false) {
    const meta = sourceMap.get(path);
    const sourceRange = sourceOverride ?? meta?.source ?? sourceFallback();
    const expressionInfo = statement ? statementExpressions(statement) : { expression: undefined, assigned: [] };
    const referencedVariables = expressionInfo.expression ? expressionVariables(expressionInfo.expression) : [];
    const id = `flow-${nodeCounter += 1}-${path.replace(/[^A-Za-z0-9]+/g, "-")}`;
    nodes.push({
      id,
      type: "aviator-flow-node",
      position: { x: 0, y: 0 },
      data: {
        kind,
        label: clampText(label),
        instruction,
        sourceCode: meta?.sourceCode || label,
        source: sourceRange,
        referencedVariables,
        assignedVariables: expressionInfo.assigned,
        previousIds: [],
        nextIds: [],
        branches: statement?.kind === "if" ? [{ label: "true" }, { label: "false" }] : undefined,
        synthetic
      }
    });
    return id;
  }

  function addEdge(sourceId: string, targetId: string, label?: string) {
    if (edges.some((edge) => edge.source === sourceId && edge.target === targetId && edge.label === label)) return;
    edges.push({
      id: `flow-edge-${edgeCounter += 1}`,
      source: sourceId,
      target: targetId,
      type: "aviator-flow-edge",
      label,
      animated: label === "siguiente" || label === "cuerpo"
    });
  }

  function buildSequence(statements: FormulaStatement[], prefix: string): Fragment {
    let entry: string | undefined;
    let previousExits: string[] = [];
    const fragment = emptyFragment();
    statements.forEach((statement, index) => {
      const current = buildStatement(statement, `${prefix}.${index}`);
      if (!entry) entry = current.entry;
      previousExits.forEach((previous) => current.entry && addEdge(previous, current.entry, "siguiente"));
      previousExits = current.normalExits;
      fragment.breakExits.push(...current.breakExits);
      fragment.continueExits.push(...current.continueExits);
      fragment.terminalExits.push(...current.terminalExits);
    });
    return { ...fragment, entry, normalExits: previousExits };
  }

  function buildStatement(statement: FormulaStatement, path: string): Fragment {
    if (statement.kind === "if") {
      const decision = addNode("decision", statementLabel(statement), statementInstruction(statement), path, statement);
      const merge = addNode("process", "Continuacion de la decision", "Punto de convergencia", `${path}.merge`, statement, undefined, true);
      const fragment = emptyFragment();
      const thenFragment = buildSequence(statement.then, `${path}.then`);
      if (thenFragment.entry) addEdge(decision, thenFragment.entry, "true");
      else addEdge(decision, merge, "true");
      thenFragment.normalExits.forEach((exit) => addEdge(exit, merge, "siguiente"));

      let lastDecision = decision;
      statement.elseIf.forEach((branch, index) => {
        const branchPath = `${path}.elseIf.${index}`;
        const branchMeta = sourceMap.get(path)?.branches?.[index];
        const branchNode = addNode("decision", `Si no, ${expressionLabel(branch.condition)}`, "Rama elsif", branchPath, { kind: "if", condition: branch.condition, then: branch.body, elseIf: [], otherwise: [] }, branchMeta?.source);
        addEdge(lastDecision, branchNode, "false");
        const body = buildSequence(branch.body, branchPath);
        if (body.entry) addEdge(branchNode, body.entry, "true");
        else addEdge(branchNode, merge, "true");
        body.normalExits.forEach((exit) => addEdge(exit, merge, "siguiente"));
        fragmentBreaks(body, fragment);
        lastDecision = branchNode;
      });

      if (statement.otherwise.length) {
        const elseMeta = sourceMap.get(path)?.branches?.find((branch) => branch.kind === "else");
        const body = buildSequence(statement.otherwise, `${path}.otherwise`);
        if (body.entry) addEdge(lastDecision, body.entry, "false");
        else addEdge(lastDecision, merge, "false");
        body.normalExits.forEach((exit) => addEdge(exit, merge, "siguiente"));
        fragmentBreaks(body, fragment);
        if (elseMeta) {
          const mergeNode = nodes.find((node) => node.id === merge);
          if (mergeNode) mergeNode.data.source = elseMeta.source;
        }
      } else {
        addEdge(lastDecision, merge, "false");
      }
      fragmentBreaks(thenFragment, fragment);
      fragment.terminalExits.push(...thenFragment.terminalExits);
      return { entry: decision, normalExits: [merge], breakExits: fragment.breakExits, continueExits: fragment.continueExits, terminalExits: fragment.terminalExits };
    }

    if (statement.kind === "for" || statement.kind === "while") {
      const loop = addNode("iteration", statementLabel(statement), statementInstruction(statement), path, statement);
      const merge = addNode("process", "Continuacion del ciclo", "Salida de la iteracion", `${path}.merge`, statement, undefined, true);
      const body = buildSequence(statement.body, `${path}.body`);
      if (body.entry) addEdge(loop, body.entry, "cuerpo");
      else addEdge(loop, merge, "cuerpo vacio");
      addEdge(loop, merge, "salir");
      body.normalExits.forEach((exit) => addEdge(exit, loop, "siguiente"));
      body.continueExits.forEach((exit) => addEdge(exit, loop, "continuar"));
      body.breakExits.forEach((exit) => addEdge(exit, merge, "salir"));
      return { entry: loop, normalExits: [merge], breakExits: [], continueExits: [], terminalExits: body.terminalExits };
    }

    const expressions = statementExpressions(statement);
    const kind: AviatorFlowNodeKind = statement.kind === "throw"
      ? "exception"
      : statement.kind === "return"
        ? "return"
        : statement.kind === "expression" && statement.expression.kind === "call"
          ? "function"
          : "process";
    const id = addNode(kind, statementLabel(statement), statementInstruction(statement), path, statement);
    if (statement.kind === "return" || statement.kind === "throw") {
      return { entry: id, normalExits: [], breakExits: [], continueExits: [], terminalExits: [id] };
    }
    if (statement.kind === "break") {
      return { entry: id, normalExits: [], breakExits: [id], continueExits: [], terminalExits: [] };
    }
    if (statement.kind === "continue") {
      return { entry: id, normalExits: [], breakExits: [], continueExits: [id], terminalExits: [] };
    }
    return { entry: id, normalExits: [id], breakExits: [], continueExits: [], terminalExits: [] };
  }

  function fragmentBreaks(fragment: Fragment, target: Fragment) {
    target.breakExits.push(...fragment.breakExits);
    target.continueExits.push(...fragment.continueExits);
  }

  const start = addNode("start", "Inicio", "Inicio del proceso", "root.start", undefined, sourceFallback(), true);
  const end = addNode("end", "Fin", "Finalizacion normal", "root.end", undefined, sourceFallback(), true);
  if (expression.kind === "program") {
    const sequence = buildSequence(expression.statements, "root");
    if (sequence.entry) addEdge(start, sequence.entry, "inicio");
    else addEdge(start, end, "vacio");
    sequence.normalExits.forEach((exit) => addEdge(exit, end, "fin"));
    sequence.terminalExits.forEach((exit) => addEdge(exit, end, "fin"));
  } else {
    const node = addNode(expression.kind === "call" ? "function" : "process", expressionLabel(expression), expression.kind === "call" ? "Invocacion de funcion" : "Expresion", "root.expression", undefined, sourceFallback());
    addEdge(start, node, "inicio");
    addEdge(node, end, "fin");
  }

  const incoming = new Map<string, string[]>();
  const outgoing = new Map<string, string[]>();
  edges.forEach((edge) => {
    outgoing.set(edge.source, [...(outgoing.get(edge.source) ?? []), edge.target]);
    incoming.set(edge.target, [...(incoming.get(edge.target) ?? []), edge.source]);
  });
  nodes.forEach((node) => {
    node.data.previousIds = incoming.get(node.id) ?? [];
    node.data.nextIds = outgoing.get(node.id) ?? [];
  });

  return { valid: true, nodes, edges, diagnostics: [] };
}

export function layoutAviatorFlow(graph: AviatorFlowGraph): AviatorFlowGraph {
  return graph;
}
