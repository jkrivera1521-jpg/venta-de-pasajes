import type { BlockSvg, WorkspaceSvg } from "blockly";
import type { FormulaExpression, FormulaRoot, FormulaStatement } from "./formula";

type BlocklyApi = typeof import("blockly");

export type PayrollBlockFactory = (Blockly: BlocklyApi, workspace: WorkspaceSvg, node: Extract<FormulaExpression, { kind: "payroll" }>) => BlockSvg;

export function loadFormulaExpressionIntoWorkspace(
  Blockly: BlocklyApi,
  workspace: WorkspaceSvg,
  expression: FormulaRoot,
  createPayrollBlock: PayrollBlockFactory
) {
  function connect(parent: BlockSvg, inputName: string, child: BlockSvg) {
    const inputConnection = parent.getInput(inputName)?.connection;
    const outputConnection = child.outputConnection;
    if (!inputConnection || !outputConnection) throw new Error("No se pudo conectar un bloque de la plantilla.");
    inputConnection.connect(outputConnection);
  }

  function createBlock(node: FormulaExpression): BlockSvg {
    let block!: BlockSvg;
    if (node.kind === "payroll") {
      block = createPayrollBlock(Blockly, workspace, node);
    } else if (node.kind === "literal") {
      const type = node.valueType === "number" ? "aviator_number"
        : node.valueType === "boolean" ? "aviator_boolean"
          : node.valueType === "date" ? "aviator_date"
            : node.valueType === "null" ? "aviator_null" : "aviator_text";
      block = workspace.newBlock(type);
      if (node.valueType !== "null") block.setFieldValue(String(node.value), "VALUE");
    } else if (node.kind === "variable") {
      block = workspace.newBlock("aviator_variable");
      block.setFieldValue(node.key, "FIELD");
    } else if (node.kind === "member") {
      block = workspace.newBlock("aviator_member");
      block.setFieldValue(node.property, "PROPERTY");
      connect(block, "OBJECT", createBlock(node.object));
    } else if (node.kind === "lambda") {
      block = workspace.newBlock("aviator_lambda");
      block.setFieldValue(node.parameters[0] ?? "item", "PARAM_1");
      block.setFieldValue(node.parameters[1] ?? "", "PARAM_2");
      connect(block, "BODY", createBlock(node.body));
    } else if (node.kind === "binary") {
      const type = ["+", "-", "*", "/", "%", "**", "&", "|", "^", "<<", ">>", ">>>"].includes(node.operator) ? "aviator_math"
        : ["&&", "||"].includes(node.operator) ? "aviator_logic" : "aviator_compare";
      block = workspace.newBlock(type);
      block.setFieldValue(node.operator, "OP");
      connect(block, "LEFT", createBlock(node.left));
      connect(block, "RIGHT", createBlock(node.right));
    } else if (node.kind === "unary") {
      block = workspace.newBlock(node.operator === "!" ? "aviator_not" : node.operator === "~" ? "aviator_bit_not" : "aviator_negate");
      connect(block, "VALUE", createBlock(node.operand));
    } else if (node.kind === "conditional") {
      block = workspace.newBlock("aviator_if");
      connect(block, "CONDITION", createBlock(node.condition));
      connect(block, "THEN", createBlock(node.whenTrue));
      connect(block, "ELSE", createBlock(node.whenFalse));
    } else if (node.kind === "call" && node.name === "math.pow") {
      block = workspace.newBlock("aviator_power");
      connect(block, "BASE", createBlock(node.args[0]));
      connect(block, "EXPONENT", createBlock(node.args[1]));
    } else if (node.kind === "call" && node.name.startsWith("math.")) {
      block = workspace.newBlock("aviator_math_function");
      block.setFieldValue(node.name, "FUNCTION");
      connect(block, "VALUE", createBlock(node.args[0]));
      if (node.name === "math.min" || node.name === "math.max") connect(block, "SECOND_VALUE", createBlock(node.args[1]));
    } else if (node.kind === "call" && ["seq.count", "seq.filter", "seq.reduce"].includes(node.name)) {
      block = workspace.newBlock("aviator_collection_function");
      block.setFieldValue(node.name, "FUNCTION");
      connect(block, "COLLECTION", createBlock(node.args[0]));
      if (node.name !== "seq.count") connect(block, "CALLBACK", createBlock(node.args[1]));
      if (node.name === "seq.reduce") connect(block, "INITIAL", createBlock(node.args[2]));
    } else if (node.kind === "call" && node.name === "seq.list") {
      block = workspace.newBlock("aviator_list");
      let previous: BlockSvg | null = null;
      for (const item of node.args) {
        const itemBlock = workspace.newBlock("aviator_list_item");
        connect(itemBlock, "VALUE", createBlock(item));
        if (previous?.nextConnection && itemBlock.previousConnection) previous.nextConnection.connect(itemBlock.previousConnection);
        else if (block.getInput("ITEMS")?.connection && itemBlock.previousConnection) block.getInput("ITEMS")?.connection?.connect(itemBlock.previousConnection);
        previous = itemBlock;
        itemBlock.initSvg();
        itemBlock.render();
      }
    } else if (node.kind === "call" && node.name === "seq.map") {
      block = workspace.newBlock("aviator_object");
      let previous: BlockSvg | null = null;
      for (let index = 0; index < node.args.length; index += 2) {
        const key = node.args[index];
        const value = node.args[index + 1];
        if (!key || !value || key.kind !== "literal" || typeof key.value !== "string") continue;
        const entry = workspace.newBlock("aviator_object_entry");
        entry.setFieldValue(key.value, "KEY");
        connect(entry, "VALUE", createBlock(value));
        if (previous?.nextConnection && entry.previousConnection) previous.nextConnection.connect(entry.previousConnection);
        else if (block.getInput("ENTRIES")?.connection && entry.previousConnection) block.getInput("ENTRIES")?.connection?.connect(entry.previousConnection);
        previous = entry;
        entry.initSvg();
        entry.render();
      }
    } else if (node.kind === "array") {
      block = workspace.newBlock("aviator_list");
      let previous: BlockSvg | null = null;
      for (const item of node.items) {
        const itemBlock = workspace.newBlock("aviator_list_item");
        connect(itemBlock, "VALUE", createBlock(item));
        if (previous?.nextConnection && itemBlock.previousConnection) previous.nextConnection.connect(itemBlock.previousConnection);
        else if (block.getInput("ITEMS")?.connection && itemBlock.previousConnection) block.getInput("ITEMS")?.connection?.connect(itemBlock.previousConnection);
        previous = itemBlock;
        itemBlock.initSvg();
        itemBlock.render();
      }
    } else if (node.kind === "object") {
      block = workspace.newBlock("aviator_object");
      let previous: BlockSvg | null = null;
      for (const entryValue of node.entries) {
        const entry = workspace.newBlock("aviator_object_entry");
        entry.setFieldValue(entryValue.key, "KEY");
        connect(entry, "VALUE", createBlock(entryValue.value));
        if (previous?.nextConnection && entry.previousConnection) previous.nextConnection.connect(entry.previousConnection);
        else if (block.getInput("ENTRIES")?.connection && entry.previousConnection) block.getInput("ENTRIES")?.connection?.connect(entry.previousConnection);
        previous = entry;
        entry.initSvg();
        entry.render();
      }
    } else if (node.kind === "call") {
      block = workspace.newBlock("aviator_string_function");
      block.setFieldValue(node.name, "FUNCTION");
      connect(block, "TEXT", createBlock(node.args[0]));
      connect(block, "SEARCH", createBlock(node.args[1]));
    }
    block.initSvg();
    block.render();
    return block;
  }

  function connectStatements(input: BlockSvg, inputName: string, statements: FormulaStatement[]) {
    let previous: BlockSvg | null = null;
    for (const statement of statements) {
      const current = createStatement(statement);
      if (previous?.nextConnection && current.previousConnection) previous.nextConnection.connect(current.previousConnection);
      else if (input.getInput(inputName)?.connection && current.previousConnection) input.getInput(inputName)?.connection?.connect(current.previousConnection);
      previous = current;
    }
  }

  function createStatement(statement: FormulaStatement): BlockSvg {
    let block: BlockSvg;
    switch (statement.kind) {
      case "section":
        block = workspace.newBlock("aviator_section");
        block.setFieldValue(statement.title, "TITLE");
        break;
      case "declaration":
      case "assignment":
        block = workspace.newBlock(statement.kind === "declaration" ? "aviator_let" : "aviator_set");
        block.setFieldValue(statement.name, "NAME");
        connect(block, "VALUE", createBlock(statement.value));
        break;
      case "expression":
        if (statement.expression.kind === "call" && statement.expression.name === "seq.add") {
          block = workspace.newBlock("aviator_list_add");
          connect(block, "LIST", createBlock(statement.expression.args[0]));
          connect(block, "VALUE", createBlock(statement.expression.args[1]));
        } else {
          block = workspace.newBlock("aviator_expression_statement");
          connect(block, "VALUE", createBlock(statement.expression));
        }
        break;
      case "if":
        block = workspace.newBlock(statement.elseIf.length > 0 || statement.otherwise.length > 0 ? "aviator_if_statement" : "aviator_if_simple");
        connect(block, "CONDITION", createBlock(statement.condition));
        connectStatements(block, "THEN", statement.then);
        if (statement.elseIf.length > 0 || statement.otherwise.length > 0) {
          let previousElseIf: BlockSvg | null = null;
          for (const branch of statement.elseIf) {
            const branchBlock = workspace.newBlock("aviator_elsif_clause");
            connect(branchBlock, "CONDITION", createBlock(branch.condition));
            connectStatements(branchBlock, "BODY", branch.body);
            if (previousElseIf?.nextConnection && branchBlock.previousConnection) previousElseIf.nextConnection.connect(branchBlock.previousConnection);
            else if (block.getInput("ELSE_IF")?.connection && branchBlock.previousConnection) block.getInput("ELSE_IF")?.connection?.connect(branchBlock.previousConnection);
            previousElseIf = branchBlock;
            branchBlock.initSvg();
            branchBlock.render();
          }
          connectStatements(block, "ELSE", statement.otherwise);
        }
        break;
      case "for":
        block = workspace.newBlock("aviator_for_statement");
        block.setFieldValue(statement.item, "ITEM");
        connect(block, "COLLECTION", createBlock(statement.collection));
        connectStatements(block, "BODY", statement.body);
        break;
      case "while":
        block = workspace.newBlock("aviator_while_statement");
        connect(block, "CONDITION", createBlock(statement.condition));
        connectStatements(block, "BODY", statement.body);
        break;
      case "continue": block = workspace.newBlock("aviator_continue_statement"); break;
      case "break": block = workspace.newBlock("aviator_break_statement"); break;
      case "throw":
        block = workspace.newBlock("aviator_throw_statement");
        connect(block, "MESSAGE", createBlock(statement.message));
        break;
      case "return":
        block = workspace.newBlock("aviator_return_statement");
        connect(block, "VALUE", createBlock(statement.value));
        break;
    }
    block.initSvg();
    block.render();
    return block;
  }

  workspace.clear();
  if (expression.kind === "program") {
    const root = workspace.newBlock("aviator_program");
    root.initSvg();
    connectStatements(root, "BODY", expression.statements);
    root.render();
    root.moveBy(28, 28);
    return root;
  }
  const root = workspace.newBlock("aviator_formula");
  root.initSvg();
  connect(root, "VALUE", createBlock(expression));
  root.render();
  root.moveBy(28, 28);
  return root;
}


