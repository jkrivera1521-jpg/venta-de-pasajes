import type { SchemaField, SchemaFieldType } from "./types";
import type { FormulaBinaryOperator, FormulaBuildResult, FormulaExpression, FormulaFunctionName, FormulaRoot, FormulaStatement, FormulaValueType } from "./formula";
import type { BlockSvg, WorkspaceSvg } from "blockly";
import { registerGenericAviatorBlocks } from "./blockly-generic-blocks";
import { DEFAULT_PAYROLL_CONFIG, GENERIC_BLOCK_TYPES, PAYROLL_CONFIG_GROUPS, PAYROLL_DECOMPOSED_BLOCK_TYPES, PAYROLL_FLOW_SECTIONS, PAYROLL_INPUT_FIELDS, PAYROLL_STATEMENT_BLOCKS, PAYROLL_VALIDATION_BLOCKS, appendPayrollAtomicErrorInputs, appendPayrollAtomicFlow, appendPayrollAtomicValidationInputs, appendPayrollConfigGroupInputs, appendPayrollConfigInputs, appendPayrollFlow, appendPayrollValidationInputs, appendPayrollValidationRuleInputs, decomposedPayrollWorkspaces, readDecomposedPayrollConfig, readPayrollConfig, setPayrollAtomicConditionInputs, setPayrollAtomicErrorInputs, setPayrollConfig, setPayrollValidationInputs, setPayrollValidationRuleInputs } from "./blockly-payroll";
import { loadFormulaExpressionIntoWorkspace } from "./blockly-serialization";

type BlocklyApi = typeof import("blockly");
type BlockLike = {
  type: string;
  getFieldValue(name: string): string | null;
  getInputTargetBlock(name: string): BlockLike | null;
  getNextBlock?(): BlockLike | null;
};

export function registerAviatorBlocks(Blockly: BlocklyApi, fieldsRef: { current: SchemaField[] }, mobileLayout: boolean) {
  Blockly.Blocks.aviator_formula = {
    init() {
      this.appendValueInput("VALUE").appendField(mobileLayout ? "resultado" : "resultado de la formula");
      this.setColour("#07877d");
      this.setDeletable(false);
      this.setMovable(false);
      this.setTooltip("Conecta aqui el bloque que devuelve el resultado de la formula.");
    }
  };

  Blockly.Blocks.aviator_payroll = {
    init() {
      appendPayrollConfigInputs(this as unknown as BlockSvg, Blockly, "Nomina avanzada");
      this.appendStatementInput("FLOW").appendField("Flujo de la formula");
      this.setOutput(true);
      this.setDeletable(false);
      this.setMovable(false);
      this.setColour("#177a54");
      this.setTooltip("El flujo conectado muestra las condiciones y operaciones completas. Cambia los umbrales o tasas para actualizar en vivo las formulas del grafico y el AviatorScript.");
    }
  };

  Blockly.Blocks.aviator_payroll_config = {
    init() {
      appendPayrollConfigInputs(this as unknown as BlockSvg, Blockly, "Parametros de nomina");
      this.setColour("#177a54");
      this.setDeletable(false);
      this.setMovable(true);
      this.setTooltip("Parametros editables de la formula descompuesta. Cambialos para actualizar sus etapas y el AviatorScript.");
    }
  };

  Blockly.Blocks.aviator_payroll_result = {
    init() {
      this.appendDummyInput().appendField("resultado de nomina avanzada");
      this.setOutput(true, "Object");
      this.setColour("#087e8b");
      this.setDeletable(false);
      this.setMovable(true);
      this.setTooltip("Salida de la formula avanzada. Sus etapas se muestran como bloques independientes.");
    }
  };

  for (const group of PAYROLL_CONFIG_GROUPS) {
    Blockly.Blocks[group.type] = {
      init() {
        appendPayrollConfigGroupInputs(this as unknown as BlockSvg, Blockly, group.type, group.title);
        this.setColour(group.colour);
        this.setDeletable(false);
        this.setMovable(true);
        this.setTooltip("Parametros editables de esta parte de la formula avanzada.");
      }
    };
  }

  for (const validation of PAYROLL_VALIDATION_BLOCKS) {
    Blockly.Blocks[validation.type] = {
      init() {
        appendPayrollValidationRuleInputs(this as unknown as BlockSvg, Blockly, mobileLayout, validation.ruleIndex);
        this.setPreviousStatement(true);
        this.setNextStatement(true);
        this.setColour("#d24738");
        this.setDeletable(false);
        this.setMovable(true);
        this.setTooltip("Regla de validacion editable. Cambia el comparador, el limite o el mensaje.");
      }
    };
  }

  Blockly.Blocks.aviator_payroll_condition = {
    init() {
      appendPayrollAtomicValidationInputs(this as unknown as BlockSvg, Blockly);
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour("#d24738");
      this.setDeletable(false);
      this.setMovable(true);
      this.setTooltip("Condicion individual de validacion. Edita operador, limite y conector.");
    }
  };

  Blockly.Blocks.aviator_payroll_error = {
    init() {
      appendPayrollAtomicErrorInputs(this as unknown as BlockSvg, Blockly);
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour("#d24738");
      this.setDeletable(false);
      this.setMovable(true);
      this.setTooltip("Mensaje que se devuelve cuando la validacion falla.");
    }
  };

  for (const statement of PAYROLL_STATEMENT_BLOCKS) {
    Blockly.Blocks[statement.type] = {
      init() {
        this.appendDummyInput().appendField(new Blockly.FieldLabel(""), "TEXT");
        this.setPreviousStatement(true);
        this.setNextStatement(true);
        this.setColour(statement.colour);
        this.setDeletable(false);
        this.setMovable(true);
        this.setTooltip(statement.tooltip);
      }
    };
  }

  Blockly.Blocks.aviator_payroll_statement = {
    init() {
      this.appendDummyInput().appendField(new Blockly.FieldLabel(""), "TEXT");
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour("#177a54");
      this.setDeletable(false);
      this.setMovable(true);
      this.setTooltip("Paso individual de la formula avanzada.");
    }
  };

  for (const section of PAYROLL_FLOW_SECTIONS) {
    Blockly.Blocks[section.type] = {
      init() {
        if (section.type === "aviator_payroll_validation") {
          appendPayrollValidationInputs(this as unknown as BlockSvg, Blockly, mobileLayout);
        } else {
          section.lines(DEFAULT_PAYROLL_CONFIG).forEach((line, index) => {
            this.appendDummyInput(`LINE_ROW_${index}`).appendField(new Blockly.FieldLabel(line), `LINE_${index}`);
          });
        }
        this.setPreviousStatement(true);
        this.setNextStatement(true);
        this.setColour(section.colour);
        this.setDeletable(false);
        this.setMovable(false);
        this.setTooltip(section.tooltip);
      }
    };
  }

  registerGenericAviatorBlocks(Blockly, fieldsRef, mobileLayout);

}

export {
  PAYROLL_CONFIG_GROUPS,
  PAYROLL_DECOMPOSED_BLOCK_TYPES,
  PAYROLL_FLOW_SECTIONS,
  PAYROLL_INPUT_FIELDS,
  PAYROLL_STATEMENT_BLOCKS,
  PAYROLL_VALIDATION_BLOCKS,
  compactPayrollGraph,
  createNewPayrollGraph,
  decomposePayrollGraph,
  isDecomposedPayrollWorkspaceState,
  readPayrollConfig,
  refreshPayrollFormulaGraph
} from "./blockly-payroll";
export { createFormulaToolbox } from "./blockly-toolbox";
export { fitNestedBlockContainers } from "./blockly-layout";

export function getUserVariableFields(workspace: WorkspaceSvg): SchemaField[] {
  const fields = new Map<string, SchemaField>();
  for (const block of workspace.getBlocksByType("aviator_user_variable", false)) {
    const key = block.getFieldValue("FIELD")?.trim() ?? "";
    if (!key) continue;
    const type = block.getFieldValue("TYPE") as SchemaFieldType | null;
    fields.set(key, {
      key,
      label: key,
      type: type && ["string", "number", "currency", "boolean", "date", "unknown"].includes(type) ? type : "unknown",
      description: "Variable JVM creada en esta formula."
    });
  }
  return [...fields.values()];
}

export function createStarterFormula(Blockly: BlocklyApi, workspace: WorkspaceSvg, fields: SchemaField[]) {
  decomposedPayrollWorkspaces.delete(workspace);
  const root = workspace.newBlock("aviator_program");
  root.initSvg();
  root.moveBy(28, 28);
  root.render();
  return root;
}

export function loadFormulaExpression(Blockly: BlocklyApi, workspace: WorkspaceSvg, expression: FormulaRoot) {
  decomposedPayrollWorkspaces.delete(workspace);
  return loadFormulaExpressionIntoWorkspace(Blockly, workspace, expression, (currentBlockly, currentWorkspace, node) => {
    const block = currentWorkspace.newBlock("aviator_payroll") as BlockSvg;
    setPayrollConfig(block, node.config);
    appendPayrollFlow(currentBlockly, currentWorkspace, block, node.config);
    return block;
  });
}


function valueTypeForField(type: SchemaFieldType): FormulaValueType {
  return type;
}

export function buildFormulaFromWorkspace(workspace: WorkspaceSvg, fields: SchemaField[]): FormulaBuildResult {
  const issues: FormulaBuildResult["issues"] = [];
  const schema = new Map(fields.map((field) => [field.key, field]));
  const topBlocks = workspace.getTopBlocks(false);
  const roots = topBlocks.filter((item) => item.type === "aviator_formula" || item.type === "aviator_program");
  if (roots.length !== 1) {
    issues.push({ path: "formula", message: "El lienzo debe tener un solo bloque de resultado.", severity: "error" });
  }
  if (topBlocks.some((item) => !["aviator_formula", "aviator_program"].includes(item.type) && !PAYROLL_DECOMPOSED_BLOCK_TYPES.has(item.type) && !GENERIC_BLOCK_TYPES.has(item.type))) {
    issues.push({ path: "workspace", message: "Conecta los bloques sueltos al resultado de la formula o eliminalos.", severity: "error" });
  }
  const root = roots[0] as unknown as BlockLike | undefined;
  if (!root) return { issues };
  const localNames = new Set<string>();
  const payrollConfigBlock = (
    workspace.getBlocksByType("aviator_payroll_config", false)[0]
    ?? PAYROLL_CONFIG_GROUPS.flatMap(({ type }) => workspace.getBlocksByType(type, false))[0]
  ) as unknown as BlockLike | undefined;
  const payrollValidationBlock = workspace.getBlocksByType("aviator_payroll_validation", false)[0] as unknown as BlockLike | undefined;

  function required(block: BlockLike, input: string, path: string): FormulaExpression | undefined {
    const connected = block.getInputTargetBlock(input);
    if (!connected) {
      issues.push({ path, message: "Conecta un bloque en este espacio.", severity: "error" });
      return undefined;
    }
    return readExpression(connected, path);
  }

  function readStatements(first: BlockLike | null, path: string): FormulaStatement[] {
    const statements: FormulaStatement[] = [];
    let current = first;
    let index = 0;
    while (current) {
      const statementPath = `${path}[${index}]`;
      const requiredStatementValue = (input: string, suffix: string) => required(current!, input, `${statementPath}.${suffix}`);
      switch (current.type) {
        case "aviator_section":
          statements.push({ kind: "section", title: current.getFieldValue("TITLE") ?? "" });
          break;
        case "aviator_let":
        case "aviator_set": {
          const value = requiredStatementValue("VALUE", "value");
          const name = current.getFieldValue("NAME") ?? "variable";
          if (value) statements.push({ kind: current.type === "aviator_let" ? "declaration" : "assignment", name, value });
          localNames.add(name);
          break;
        }
        case "aviator_expression_statement": {
          const expression = requiredStatementValue("VALUE", "expression");
          if (expression) statements.push({ kind: "expression", expression });
          break;
        }
        case "aviator_if_simple":
        case "aviator_if_statement": {
          const condition = requiredStatementValue("CONDITION", "condition");
          const then = readStatements(current.getInputTargetBlock("THEN"), `${statementPath}.then`);
          if (current.type === "aviator_if_simple") {
            if (condition) statements.push({ kind: "if", condition, then, elseIf: [], otherwise: [] });
            break;
          }
          const elseIf: { condition: FormulaExpression; body: FormulaStatement[] }[] = [];
          let branch = current.getInputTargetBlock("ELSE_IF");
          let branchIndex = 0;
          while (branch) {
            const branchCondition = required(branch, "CONDITION", `${statementPath}.elseIf[${branchIndex}].condition`);
            if (branchCondition) elseIf.push({ condition: branchCondition, body: readStatements(branch.getInputTargetBlock("BODY"), `${statementPath}.elseIf[${branchIndex}].body`) });
            branch = branch.getNextBlock?.() ?? null;
            branchIndex += 1;
          }
          const otherwise = readStatements(current.getInputTargetBlock("ELSE"), `${statementPath}.otherwise`);
          if (condition) statements.push({ kind: "if", condition, then, elseIf, otherwise });
          break;
        }
        case "aviator_for_statement": {
          const collection = requiredStatementValue("COLLECTION", "collection");
          const item = current.getFieldValue("ITEM") ?? "item";
          localNames.add(item);
          if (collection) statements.push({ kind: "for", item, collection, body: readStatements(current.getInputTargetBlock("BODY"), `${statementPath}.body`) });
          break;
        }
        case "aviator_while_statement": {
          const condition = requiredStatementValue("CONDITION", "condition");
          if (condition) statements.push({ kind: "while", condition, body: readStatements(current.getInputTargetBlock("BODY"), `${statementPath}.body`) });
          break;
        }
        case "aviator_continue_statement": statements.push({ kind: "continue" }); break;
        case "aviator_break_statement": statements.push({ kind: "break" }); break;
        case "aviator_throw_statement": {
          const message = requiredStatementValue("MESSAGE", "message");
          if (message) statements.push({ kind: "throw", message });
          break;
        }
        case "aviator_return_statement": {
          const value = requiredStatementValue("VALUE", "value");
          if (value) statements.push({ kind: "return", value });
          break;
        }
        case "aviator_list_item": {
          const value = requiredStatementValue("VALUE", "value");
          if (value) statements.push({ kind: "expression", expression: value });
          break;
        }
        case "aviator_list_add": {
          const list = requiredStatementValue("LIST", "list");
          const value = requiredStatementValue("VALUE", "value");
          if (list && value) statements.push({ kind: "expression", expression: { kind: "call", name: "seq.add", args: [list, value], valueType: "array" } });
          break;
        }
        default:
          issues.push({ path: statementPath, message: "Conecta solo bloques de instrucciones validos en este espacio.", severity: "error" });
      }
      current = current.getNextBlock?.() ?? null;
      index += 1;
    }
    return statements;
  }

  function readExpression(block: BlockLike, path: string): FormulaExpression | undefined {
    const field = block.getFieldValue("VALUE") ?? "";
    switch (block.type) {
      case "aviator_user_variable": {
        const key = block.getFieldValue("FIELD")?.trim() ?? "";
        if (!key) {
          issues.push({ path, message: "Escribe un nombre para la variable JVM.", severity: "error" });
          return undefined;
        }
        const type = block.getFieldValue("TYPE") as SchemaFieldType | null;
        return { kind: "variable", key, valueType: type && ["string", "number", "currency", "boolean", "date", "unknown"].includes(type) ? type : "unknown" };
      }
      case "aviator_variable":
      case "aviator_context_variable": {
        const key = block.getFieldValue("FIELD") ?? "";
        const schemaField = schema.get(key);
        if (!schemaField && !localNames.has(key)) {
          issues.push({ path, message: "Selecciona una variable disponible en el esquema JVM.", severity: "error" });
          return undefined;
        }
        return { kind: "variable", key, valueType: schemaField ? valueTypeForField(schemaField.type) : "unknown" };
      }
      case "aviator_member": {
        const object = required(block, "OBJECT", `${path}.object`);
        const property = block.getFieldValue("PROPERTY") ?? "";
        if (!object || !property) return undefined;
        return { kind: "member", object, property, valueType: "unknown" };
      }
      case "aviator_payroll":
        return {
          kind: "payroll",
          config: readPayrollConfig(block, block.getInputTargetBlock("FLOW") ?? payrollValidationBlock),
          valueType: "object"
        };
      case "aviator_payroll_result":
        if (!payrollConfigBlock) {
          issues.push({ path, message: "La formula descompuesta necesita su bloque de parametros de nomina.", severity: "error" });
          return undefined;
        }
        return {
          kind: "payroll",
          config: readDecomposedPayrollConfig(workspace, payrollConfigBlock),
          valueType: "object"
        };
      case "aviator_number": {
        const value = Number(field);
        if (!Number.isFinite(value)) {
          issues.push({ path, message: "Ingresa un numero valido.", severity: "error" });
          return undefined;
        }
        return { kind: "literal", valueType: "number", value };
      }
      case "aviator_text":
        return { kind: "literal", valueType: "string", value: field };
      case "aviator_date": {
        const [year, month, day] = field.split("-").map(Number);
        const parsed = new Date(Date.UTC(year, month - 1, day));
        const isValidDate = /^\d{4}-\d{2}-\d{2}$/.test(field)
          && parsed.getUTCFullYear() === year
          && parsed.getUTCMonth() === month - 1
          && parsed.getUTCDate() === day;
        if (!isValidDate) {
          issues.push({ path, message: "Usa una fecha valida con formato AAAA-MM-DD.", severity: "error" });
          return undefined;
        }
        return { kind: "literal", valueType: "date", value: field };
      }
      case "aviator_boolean":
        return { kind: "literal", valueType: "boolean", value: block.getFieldValue("VALUE") === "true" };
      case "aviator_math":
      case "aviator_compare":
      case "aviator_logic": {
        const left = required(block, "LEFT", `${path}.left`);
        const right = required(block, "RIGHT", `${path}.right`);
        if (!left || !right) return undefined;
        const operator = (block.getFieldValue("OP") ?? "==") as FormulaBinaryOperator;
        const valueType: FormulaValueType = block.type === "aviator_math" ? "number" : "boolean";
        return { kind: "binary", operator, left, right, valueType } as FormulaExpression;
      }
      case "aviator_not":
      case "aviator_negate":
      case "aviator_bit_not": {
        const operand = required(block, "VALUE", `${path}.value`);
        if (!operand) return undefined;
        return {
          kind: "unary",
          operator: block.type === "aviator_not" ? "!" : block.type === "aviator_bit_not" ? "~" : "-",
          operand,
          valueType: block.type === "aviator_not" ? "boolean" : "number"
        };
      }
      case "aviator_if": {
        const condition = required(block, "CONDITION", `${path}.condition`);
        const whenTrue = required(block, "THEN", `${path}.whenTrue`);
        const whenFalse = required(block, "ELSE", `${path}.whenFalse`);
        if (!condition || !whenTrue || !whenFalse) return undefined;
        const valueType = whenTrue.valueType === "unknown" ? whenFalse.valueType : whenTrue.valueType;
        return { kind: "conditional", condition, whenTrue, whenFalse, valueType };
      }
      case "aviator_math_function": {
        const argument = required(block, "VALUE", `${path}.value`);
        if (!argument) return undefined;
        const name = block.getFieldValue("FUNCTION") as FormulaFunctionName;
        if (name === "math.min" || name === "math.max") {
          const second = required(block, "SECOND_VALUE", `${path}.secondValue`);
          if (!second) return undefined;
          return { kind: "call", name, args: [argument, second], valueType: "number" };
        }
        return { kind: "call", name, args: [argument], valueType: "number" };
      }
      case "aviator_power": {
        const base = required(block, "BASE", `${path}.base`);
        const exponent = required(block, "EXPONENT", `${path}.exponent`);
        if (!base || !exponent) return undefined;
        return { kind: "call", name: "math.pow", args: [base, exponent], valueType: "number" };
      }
      case "aviator_string_function": {
        const text = required(block, "TEXT", `${path}.text`);
        const search = required(block, "SEARCH", `${path}.search`);
        if (!text || !search) return undefined;
        return { kind: "call", name: block.getFieldValue("FUNCTION") as FormulaFunctionName, args: [text, search], valueType: "boolean" };
      }
      case "aviator_null":
        return { kind: "literal", valueType: "null", value: null };
      case "aviator_lambda": {
        const parameters = [block.getFieldValue("PARAM_1")?.trim() ?? "", block.getFieldValue("PARAM_2")?.trim() ?? ""].filter(Boolean);
        if (!parameters.length) {
          issues.push({ path, message: "La lambda necesita al menos un parametro.", severity: "error" });
          return undefined;
        }
        const previousLocals = new Set(localNames);
        parameters.forEach((parameter) => localNames.add(parameter));
        const body = required(block, "BODY", `${path}.body`);
        localNames.clear();
        previousLocals.forEach((name) => localNames.add(name));
        if (!body) return undefined;
        return { kind: "lambda", parameters, body, valueType: "lambda" };
      }
      case "aviator_collection_function": {
        const name = block.getFieldValue("FUNCTION") as FormulaFunctionName;
        const collection = required(block, "COLLECTION", `${path}.collection`);
        if (!collection) return undefined;
        if (name === "seq.count") return { kind: "call", name, args: [collection], valueType: "number" };
        const callback = required(block, "CALLBACK", `${path}.callback`);
        if (!callback) return undefined;
        if (callback.kind !== "lambda") {
          issues.push({ path: `${path}.callback`, message: "Conecta un bloque lambda como callback.", severity: "error" });
          return undefined;
        }
        if (name === "seq.filter") return { kind: "call", name, args: [collection, callback], valueType: "array" };
        const initial = required(block, "INITIAL", `${path}.initial`);
        if (!initial) return undefined;
        return { kind: "call", name: "seq.reduce", args: [collection, callback, initial], valueType: initial.valueType };
      }
      case "aviator_list": {
        const items = readStatements(block.getInputTargetBlock("ITEMS"), `${path}.items`)
          .filter((statement): statement is Extract<FormulaStatement, { kind: "expression" }> => statement.kind === "expression")
          .map((statement) => statement.expression);
        return { kind: "call", name: "seq.list", args: items, valueType: "array" };
      }
      case "aviator_object": {
        const entries: { key: string; value: FormulaExpression }[] = [];
        let entry = block.getInputTargetBlock("ENTRIES");
        while (entry) {
          const value = required(entry, "VALUE", `${path}.entries.${entries.length}.value`);
          const key = entry.getFieldValue("KEY") ?? "";
          if (value && key) entries.push({ key, value });
          entry = entry.getNextBlock?.() ?? null;
        }
        return { kind: "object", entries, valueType: "object" };
      }
      default:
        issues.push({ path, message: "Este bloque todavia no se puede usar en una formula.", severity: "error" });
        return undefined;
    }
  }

  const expression = root.type === "aviator_program"
    ? (() => {
      const statements = readStatements(root.getInputTargetBlock("BODY"), "program");
      if (!statements.length) return undefined;
      const lastReturn = [...statements].reverse().find((statement): statement is Extract<FormulaStatement, { kind: "return" }> => statement.kind === "return");
      return { kind: "program" as const, statements, valueType: lastReturn?.value.valueType ?? "unknown" as FormulaValueType };
    })()
    : required(root, "VALUE", "formula.resultado");
  return { expression, issues };
}
