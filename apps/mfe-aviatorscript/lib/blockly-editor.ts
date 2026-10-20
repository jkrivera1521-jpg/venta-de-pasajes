import type { SchemaField, SchemaFieldType } from "./types";
import type { FormulaBinaryOperator, FormulaBuildResult, FormulaExpression, FormulaFunctionName, FormulaRoot, FormulaStatement, FormulaValueType } from "./formula";
import { DEFAULT_PAYROLL_CONFIG, PAYROLL_INPUT_FIELDS, normalizePayrollConfig, type PayrollFormulaConfig, type PayrollInputValidation, type PayrollValidationOperator } from "./payroll-formula";
import type { BlockSvg, WorkspaceSvg } from "blockly";

type BlocklyApi = typeof import("blockly");
type BlockLike = {
  type: string;
  getFieldValue(name: string): string | null;
  getInputTargetBlock(name: string): BlockLike | null;
  getNextBlock?(): BlockLike | null;
};

const PAYROLL_FIELDS = {
  seniorityThresholds: ["SENIORITY_10", "SENIORITY_5", "SENIORITY_2"],
  seniorityRates: ["SENIORITY_RATE_10", "SENIORITY_RATE_5", "SENIORITY_RATE_2"],
  positionRates: ["POSITION_TECH", "POSITION_SUPERVISOR", "POSITION_MANAGER"],
  performanceThresholds: ["PERFORMANCE_95", "PERFORMANCE_90", "PERFORMANCE_80"],
  performanceRates: ["PERFORMANCE_RATE_95", "PERFORMANCE_RATE_90", "PERFORMANCE_RATE_80"],
  overtimeMultipliers: ["OVERTIME_DAY", "OVERTIME_NIGHT", "OVERTIME_HOLIDAY"],
  progressiveThresholds: ["PROGRESSIVE_LIMIT_1", "PROGRESSIVE_LIMIT_2"],
  progressiveRates: ["PROGRESSIVE_RATE_1", "PROGRESSIVE_RATE_2"],
  classificationThresholds: ["CLASSIFICATION_LIMIT_1", "CLASSIFICATION_LIMIT_2"]
} as const;
type PayrollArrayField = keyof typeof PAYROLL_FIELDS;
const PAYROLL_PERCENT_FIELDS = new Set<PayrollArrayField>([
  "seniorityRates",
  "positionRates",
  "performanceRates",
  "progressiveRates"
]);
const NESTED_WIDTH_FIELD = "NESTED_WIDTH";
const NESTED_WIDTH_SPACER_CLASS = "aviatorNestedWidthSpacer";
const NESTED_WIDTH_SPACER_CHAR = "W";
const NESTED_CONTAINER_TYPES = new Set([
  "aviator_program",
  "aviator_if_simple",
  "aviator_if_statement",
  "aviator_elsif_clause",
  "aviator_for_statement",
  "aviator_while_statement"
]);

function validationFieldName(prefix: string, part: string, index = 0) {
  return `${prefix}_VALIDATION_${part}${index ? `_${index + 1}` : ""}`;
}

export function readPayrollConfig(
  block: BlockLike,
  validationBlock?: BlockLike | null,
  fallbackConfig: PayrollFormulaConfig = DEFAULT_PAYROLL_CONFIG
): PayrollFormulaConfig {
  const arrays = Object.fromEntries(Object.entries(PAYROLL_FIELDS).map(([key, names]) => [
    key,
    names.map((name, index) => {
      const rawValue = block.getFieldValue(name);
      const fallbackValues = fallbackConfig[key as PayrollArrayField] as readonly number[];
      if (rawValue === null || rawValue === "") return fallbackValues[index];
      const value = Number(rawValue);
      return PAYROLL_PERCENT_FIELDS.has(key as PayrollArrayField) ? value / 100 : value;
    })
  ])) as Pick<PayrollFormulaConfig, PayrollArrayField>;
  const inputValidations = Object.fromEntries(PAYROLL_INPUT_FIELDS.map(({ key, prefix }) => {
    const defaults = fallbackConfig.inputValidations[key];
    return [key, {
      conditions: defaults.conditions.map((condition, index) => {
        const isReference = key === "diasTrabajados" && index === 1
          && (validationBlock?.getFieldValue(validationFieldName(prefix, "SOURCE", index)) ?? "diasMes") === "diasMes";
        return {
          operator: (validationBlock?.getFieldValue(validationFieldName(prefix, "OPERATOR", index)) ?? condition.operator) as PayrollValidationOperator,
          limit: isReference ? "diasMes" : Number(validationBlock?.getFieldValue(validationFieldName(prefix, "LIMIT", index)) ?? condition.limit)
        };
      }),
      join: (validationBlock?.getFieldValue(validationFieldName(prefix, "JOIN")) ?? defaults.join) as PayrollInputValidation["join"],
      message: validationBlock?.getFieldValue(validationFieldName(prefix, "MESSAGE")) ?? defaults.message
    }];
  })) as PayrollFormulaConfig["inputValidations"];
  return normalizePayrollConfig({
    ...arrays,
    inputValidations
  });
}

const PAYROLL_VALIDATION_BLOCKS = [
  { type: "aviator_payroll_validation_salary", key: "salarioMensual", ruleIndex: 0 },
  { type: "aviator_payroll_validation_month_days", key: "diasMes", ruleIndex: 1 },
  { type: "aviator_payroll_validation_worked_days", key: "diasTrabajados", ruleIndex: 2 },
  { type: "aviator_payroll_validation_score", key: "calificacionDesempeno", ruleIndex: 3 }
] as const;

function readPayrollAtomicValidations(workspace: WorkspaceSvg, fallbackConfig: PayrollFormulaConfig) {
  const conditions = workspace.getBlocksByType("aviator_payroll_condition", false) as (BlockSvg & { data?: string })[];
  const errors = workspace.getBlocksByType("aviator_payroll_error", false) as (BlockSvg & { data?: string })[];
  const inputValidations = Object.fromEntries(PAYROLL_INPUT_FIELDS.map(({ key }) => {
    const defaultRule = fallbackConfig.inputValidations[key];
    const ruleConditions = conditions
      .map((block) => {
        const [blockKey, indexValue] = (block.data ?? "").split(":");
        return { block, blockKey, index: Number(indexValue) };
      })
      .filter((item) => item.blockKey === key && Number.isInteger(item.index))
      .sort((left, right) => left.index - right.index)
      .map(({ block, index }) => {
        const source = block.getFieldValue("SOURCE") ?? "NUMBER";
        const defaultCondition = defaultRule.conditions[index] ?? defaultRule.conditions[0];
        return {
          operator: (block.getFieldValue("OPERATOR") ?? defaultCondition.operator) as PayrollValidationOperator,
          limit: key === "diasTrabajados" && index === 1 && source === "diasMes"
            ? "diasMes"
            : Number(block.getFieldValue("LIMIT") ?? defaultCondition.limit)
        };
      });
    const errorBlock = errors.find((block) => block.data === key);
    const joinBlock = conditions.find((block) => block.data === `${key}:1`);
    return [key, {
      conditions: ruleConditions.length ? ruleConditions : defaultRule.conditions,
      join: (joinBlock?.getFieldValue("JOIN") ?? defaultRule.join) as PayrollInputValidation["join"],
      message: errorBlock?.getFieldValue("MESSAGE") ?? defaultRule.message
    }];
  })) as PayrollFormulaConfig["inputValidations"];
  return inputValidations;
}

function readDecomposedPayrollConfig(workspace: WorkspaceSvg, baseBlock?: BlockLike | null) {
  const configBlocks = [
    ...(baseBlock ? [baseBlock] : []),
    ...PAYROLL_CONFIG_GROUPS.flatMap(({ type }) => workspace.getBlocksByType(type, false)),
    ...workspace.getBlocksByType("aviator_payroll_config", false)
  ] as unknown as BlockLike[];
  let config = normalizePayrollConfig();
  for (const configBlock of configBlocks) {
    config = readPayrollConfig(configBlock, null, config);
  }
  const atomicValidations = workspace.getBlocksByType("aviator_payroll_condition", false).length > 0;
  if (atomicValidations) {
    config = normalizePayrollConfig({ ...config, inputValidations: readPayrollAtomicValidations(workspace, config) });
  } else {
    const validationBlocks = [
      ...workspace.getBlocksByType("aviator_payroll_validation", false),
      ...PAYROLL_VALIDATION_BLOCKS.flatMap(({ type }) => workspace.getBlocksByType(type, false))
    ] as unknown as BlockLike[];
    for (const validationBlock of validationBlocks) {
      const sourceBlock = configBlocks[0];
      if (sourceBlock) config = readPayrollConfig(sourceBlock, validationBlock, config);
    }
  }
  return config;
}

function setPayrollConfig(block: BlockSvg, config: PayrollFormulaConfig) {
  const normalized = normalizePayrollConfig(config);
  for (const [key, names] of Object.entries(PAYROLL_FIELDS) as [PayrollArrayField, readonly string[]][]) {
    normalized[key].forEach((value, index) => {
      const displayValue = PAYROLL_PERCENT_FIELDS.has(key) ? value * 100 : value;
      if (block.getField(names[index])) block.setFieldValue(String(displayValue), names[index]);
    });
  }
}

const OPERATOR_OPTIONS: [string, string][] = [
  ["igual a", "=="],
  ["diferente de", "!="],
  ["coincide con patron", "=~"],
  ["mayor que", ">"],
  ["mayor o igual que", ">="],
  ["menor que", "<"],
  ["menor o igual que", "<="]
];
const MATH_OPERATOR_OPTIONS: [string, string][] = [
  ["+ sumar", "+"],
  ["- restar", "-"],
  ["x multiplicar", "*"],
  ["/ dividir", "/"],
  ["% modulo", "%"],
  ["** potencia", "**"],
  ["& bit AND", "&"],
  ["| bit OR", "|"],
  ["^ bit XOR", "^"],
  ["<< desplazar izquierda", "<<"],
  [">> desplazar derecha", ">>"],
  [">>> desplazar sin signo", ">>>"]
];
const PAYROLL_VALIDATION_OPERATORS: [string, PayrollValidationOperator][] = [
  ["menor o igual que", "<="],
  ["menor que", "<"],
  ["mayor o igual que", ">="],
  ["mayor que", ">"],
  ["igual a", "=="],
  ["diferente de", "!="]
];

function payrollNumber(value: number) {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(4)));
}

const PAYROLL_FLOW_SECTIONS: {
  type: string;
  colour: string;
  tooltip: string;
  lines: (config: PayrollFormulaConfig) => string[];
}[] = [
  {
    type: "aviator_payroll_validation",
    colour: "#d24738",
    tooltip: "Edita los comparadores, limites y mensajes de cada validacion. O rechaza si se cumple alguna condicion; Y requiere ambas.",
    lines: () => []
  },
  {
    type: "aviator_payroll_seniority",
    colour: "#177a54",
    tooltip: "Calcula el salario proporcional y la bonificacion por antiguedad usando los limites y tasas editables arriba.",
    lines: (config: PayrollFormulaConfig) => [
      "SALARIO BASE Y BONIFICACION POR ANTIGUEDAD",
      "salarioBase = salarioMensual * diasTrabajados / diasMes",
      "bonificacionAntiguedad = 0",
      "IF aniosAntiguedad >= " + payrollNumber(config.seniorityThresholds[0]) + ":",
      "  bonificacionAntiguedad = salarioBase * " + payrollNumber(config.seniorityRates[0]),
      "ELSIF aniosAntiguedad >= " + payrollNumber(config.seniorityThresholds[1]) + ":",
      "  bonificacionAntiguedad = salarioBase * " + payrollNumber(config.seniorityRates[1]),
      "ELSIF aniosAntiguedad >= " + payrollNumber(config.seniorityThresholds[2]) + ":",
      "  bonificacionAntiguedad = salarioBase * " + payrollNumber(config.seniorityRates[2]),
      "ELSE: bonificacionAntiguedad = 0"
    ]
  },
  {
    type: "aviator_payroll_position",
    colour: "#177a54",
    tooltip: "Asigna la bonificacion de cargo segun TECNICO, SUPERVISOR o GERENTE; si no coincide, usa cero.",
    lines: (config: PayrollFormulaConfig) => [
      "BONIFICACION POR CARGO",
      "bonificacionCargo = 0",
      'IF tipoEmpleado == "TECNICO":',
      "  bonificacionCargo = salarioBase * " + payrollNumber(config.positionRates[0]),
      'ELSIF tipoEmpleado == "SUPERVISOR":',
      "  bonificacionCargo = salarioBase * " + payrollNumber(config.positionRates[1]),
      'ELSIF tipoEmpleado == "GERENTE":',
      "  bonificacionCargo = salarioBase * " + payrollNumber(config.positionRates[2]),
      "ELSE: bonificacionCargo = 0"
    ]
  },
  {
    type: "aviator_payroll_performance",
    colour: "#177a54",
    tooltip: "Calcula la bonificacion por desempeno con los tres rangos y tasas configurables.",
    lines: (config: PayrollFormulaConfig) => [
      "BONIFICACION POR DESEMPENO",
      "bonificacionDesempeno = 0",
      "IF calificacionDesempeno >= " + payrollNumber(config.performanceThresholds[0]) + ":",
      "  bonificacionDesempeno = salarioBase * " + payrollNumber(config.performanceRates[0]),
      "ELSIF calificacionDesempeno >= " + payrollNumber(config.performanceThresholds[1]) + ":",
      "  bonificacionDesempeno = salarioBase * " + payrollNumber(config.performanceRates[1]),
      "ELSIF calificacionDesempeno >= " + payrollNumber(config.performanceThresholds[2]) + ":",
      "  bonificacionDesempeno = salarioBase * " + payrollNumber(config.performanceRates[2]),
      "ELSE: bonificacionDesempeno = 0"
    ]
  },
  {
    type: "aviator_payroll_overtime",
    colour: "#c77711",
    tooltip: "Recorre cada hora extra; omite horas no positivas, aplica el multiplicador por tipo y acumula el detalle.",
    lines: (config: PayrollFormulaConfig) => [
      "CALCULO DE HORAS EXTRAS",
      "valorHora = salarioMensual / 240.0",
      "totalHorasExtras = 0; detalleHorasExtras = seq.list()",
      "FOR item IN horasExtras:",
      "  horas = item.horas; multiplicador = 0",
      "  IF horas <= 0: CONTINUE",
      '  IF item.tipo == "DIURNA":',
      "    multiplicador = " + payrollNumber(config.overtimeMultipliers[0]),
      '  ELSIF item.tipo == "NOCTURNA":',
      "    multiplicador = " + payrollNumber(config.overtimeMultipliers[1]),
      '  ELSIF item.tipo == "FERIADO":',
      "    multiplicador = " + payrollNumber(config.overtimeMultipliers[2]),
      "  ELSE:",
      '    THROW "Tipo de hora extra no reconocido"',
      "  importe = valorHora * horas * multiplicador",
      "  totalHorasExtras += importe",
      "  seq.add(detalleHorasExtras, seq.map(",
      '    "tipo", item.tipo, "horas", horas,',
      '    "multiplicador", multiplicador,',
      '    "importe", importe))'
    ]
  },
  {
    type: "aviator_payroll_progressive",
    colour: "#7650b3",
    tooltip: "Suma ingresos y aplica el descuento progresivo por tramos con los limites y tasas editables arriba.",
    lines: (config: PayrollFormulaConfig) => [
      "INGRESOS BRUTOS Y DESCUENTO PROGRESIVO",
      "totalBonificaciones =",
      "  bonificacionAntiguedad + bonificacionCargo +",
      "  bonificacionDesempeno",
      "ingresosBrutos =",
      "  salarioBase + totalBonificaciones + totalHorasExtras",
      "descuentoProgresivo = 0",
      "IF ingresosBrutos <= " + payrollNumber(config.progressiveThresholds[0]) + ":",
      "  descuentoProgresivo = 0",
      "ELSIF ingresosBrutos <= " + payrollNumber(config.progressiveThresholds[1]) + ":",
      "  descuentoProgresivo =",
      "    (ingresosBrutos - " + payrollNumber(config.progressiveThresholds[0]) + ")",
      "    * " + payrollNumber(config.progressiveRates[0]),
      "ELSE: descuentoProgresivo =",
      "  (" + payrollNumber(config.progressiveThresholds[1]) + " - " + payrollNumber(config.progressiveThresholds[0]) + ")",
      "  * " + payrollNumber(config.progressiveRates[0]) + " +",
      "  (ingresosBrutos - " + payrollNumber(config.progressiveThresholds[1]) + ")",
      "  * " + payrollNumber(config.progressiveRates[1])
    ]
  },
  {
    type: "aviator_payroll_discounts",
    colour: "#c77711",
    tooltip: "Recorre descuentos adicionales, rechaza valores negativos y acumula sus conceptos y valores.",
    lines: (_config) => [
      "DESCUENTOS ADICIONALES",
      "totalDescuentosAdicionales = 0",
      "detalleDescuentos = seq.list()",
      "FOR descuento IN descuentosAdicionales:",
      "  IF descuento.valor < 0:",
      '    THROW "Un descuento no puede ser negativo"',
      "  totalDescuentosAdicionales += descuento.valor",
      "  seq.add(detalleDescuentos, seq.map(",
      '    "concepto", descuento.concepto,',
      '    "valor", descuento.valor))'
    ]
  },
  {
    type: "aviator_payroll_classification",
    colour: "#7650b3",
    tooltip: "Calcula el salario neto y lo clasifica con los limites configurables arriba.",
    lines: (config: PayrollFormulaConfig) => [
      "SALARIO NETO Y CLASIFICACION",
      "totalDescuentos = descuentoProgresivo +",
      "  totalDescuentosAdicionales",
      "salarioNeto = ingresosBrutos - totalDescuentos",
      "IF salarioNeto < 0:",
      '  clasificacion = "ERROR_SALDO_NEGATIVO"',
      'ELSIF salarioNeto < ' + payrollNumber(config.classificationThresholds[0]) + ':',
      '  clasificacion = "NOMINA_BAJA"',
      'ELSIF salarioNeto <= ' + payrollNumber(config.classificationThresholds[1]) + ':',
      '  clasificacion = "NOMINA_MEDIA"',
      'ELSE: clasificacion = "NOMINA_ALTA"'
    ]
  },
  {
    type: "aviator_payroll_return",
    colour: "#087e8b",
    tooltip: "Devuelve los totales, detalles de horas extra y descuentos, salario neto y clasificacion.",
    lines: () => [
      "RETURN seq.map(",
      '  "salarioBase", salarioBase,',
      '  "bonificacionAntiguedad", bonificacionAntiguedad,',
      '  "bonificacionCargo", bonificacionCargo,',
      '  "bonificacionDesempeno", bonificacionDesempeno,',
      '  "totalBonificaciones", totalBonificaciones,',
      '  "totalHorasExtras", totalHorasExtras,',
      '  "detalleHorasExtras", detalleHorasExtras,',
      '  "ingresosBrutos", ingresosBrutos,',
      '  "descuentoProgresivo", descuentoProgresivo,',
      '  "detalleDescuentos", detalleDescuentos,',
      '  "totalDescuentosAdicionales", totalDescuentosAdicionales,',
      '  "totalDescuentos", totalDescuentos,',
      '  "salarioNeto", salarioNeto,',
      '  "clasificacion", clasificacion',
      ")"
    ]
  }
] as const;
const PAYROLL_CONFIG_GROUPS = [
  { type: "aviator_payroll_seniority_config", title: "Antiguedad y bonificacion", colour: "#177a54" },
  { type: "aviator_payroll_position_config", title: "Bonificacion por cargo", colour: "#177a54" },
  { type: "aviator_payroll_performance_config", title: "Desempeno y bonificacion", colour: "#177a54" },
  { type: "aviator_payroll_overtime_config", title: "Horas extra", colour: "#c77711" },
  { type: "aviator_payroll_progressive_config", title: "Descuento progresivo", colour: "#7650b3" },
  { type: "aviator_payroll_classification_config", title: "Clasificacion neta", colour: "#7650b3" }
] as const;
const PAYROLL_STATEMENT_BLOCKS = [
  { type: "aviator_payroll_header_statement", colour: "#087e8b", tooltip: "Seccion de la formula avanzada." },
  { type: "aviator_payroll_if_statement", colour: "#7650b3", tooltip: "Condicion IF o ELSIF de la formula." },
  { type: "aviator_payroll_else_statement", colour: "#7650b3", tooltip: "Rama ELSE de la formula." },
  { type: "aviator_payroll_for_statement", colour: "#c77711", tooltip: "Iteracion FOR sobre una lista de datos." },
  { type: "aviator_payroll_continue_statement", colour: "#c77711", tooltip: "Salta al siguiente elemento de la iteracion." },
  { type: "aviator_payroll_throw_statement", colour: "#d24738", tooltip: "Lanza un error controlado." },
  { type: "aviator_payroll_return_statement", colour: "#087e8b", tooltip: "Devuelve el resultado de la formula." },
  { type: "aviator_payroll_assignment_statement", colour: "#177a54", tooltip: "Asignacion u operacion de la formula." }
] as const;
const PAYROLL_DECOMPOSED_BLOCK_TYPES = new Set([
  "aviator_payroll_config",
  "aviator_payroll_result",
  "aviator_payroll_statement",
  "aviator_payroll_condition",
  "aviator_payroll_error",
  ...PAYROLL_STATEMENT_BLOCKS.map((statement) => statement.type),
  ...PAYROLL_CONFIG_GROUPS.map((group) => group.type),
  ...PAYROLL_VALIDATION_BLOCKS.map((group) => group.type),
  ...PAYROLL_FLOW_SECTIONS.map((section) => section.type)
]);
const GENERIC_BLOCK_TYPES = new Set([
  "aviator_program",
  "aviator_section",
  "aviator_let",
  "aviator_set",
  "aviator_expression_statement",
  "aviator_user_variable",
  "aviator_if_simple",
  "aviator_if_statement",
  "aviator_elsif_clause",
  "aviator_for_statement",
  "aviator_while_statement",
  "aviator_continue_statement",
  "aviator_break_statement",
  "aviator_throw_statement",
  "aviator_return_statement",
  "aviator_member",
  "aviator_list",
  "aviator_list_item",
  "aviator_list_add",
  "aviator_object",
  "aviator_object_entry",
  "aviator_bit_not"
]);
const renderedPayrollConfigs = new WeakMap<BlockSvg, string>();
const decomposedPayrollWorkspaces = new WeakSet<WorkspaceSvg>();

function payrollFlowKey(config: PayrollFormulaConfig) {
  return JSON.stringify({
    seniorityThresholds: config.seniorityThresholds,
    seniorityRates: config.seniorityRates,
    positionRates: config.positionRates,
    performanceThresholds: config.performanceThresholds,
    performanceRates: config.performanceRates,
    overtimeMultipliers: config.overtimeMultipliers,
    progressiveThresholds: config.progressiveThresholds,
    progressiveRates: config.progressiveRates,
    classificationThresholds: config.classificationThresholds
  });
}

function appendPayrollValidationInputs(block: BlockSvg, Blockly: BlocklyApi, mobileLayout: boolean) {
  block.appendDummyInput().appendField("VALIDAR DATOS DE ENTRADA");
  PAYROLL_INPUT_FIELDS.forEach(({ key, label, prefix }, ruleIndex) => {
    const rule = DEFAULT_PAYROLL_CONFIG.inputValidations[key];
    block.appendDummyInput().appendField(`${ruleIndex + 1}. ${label}`);
    rule.conditions.forEach((condition, index) => {
      if (index) {
        block.appendDummyInput().appendField(new Blockly.FieldDropdown([
          ["O (alguna condicion)", "||"], ["Y (ambas condiciones)", "&&"]
        ]), validationFieldName(prefix, "JOIN"));
      }
      const labelRow = block.appendDummyInput().appendField(`SI ${key}`);
      const row = mobileLayout ? block.appendDummyInput() : labelRow;
      const operator = new Blockly.FieldDropdown(PAYROLL_VALIDATION_OPERATORS);
      operator.setValue(condition.operator);
      row.appendField(operator, validationFieldName(prefix, "OPERATOR", index));
      const limitName = validationFieldName(prefix, "LIMIT", index);
      const canReferenceMonth = key === "diasTrabajados" && index === 1;
      if (canReferenceMonth) {
        const source = new Blockly.FieldDropdown([["diasMes", "diasMes"], ["valor", "NUMBER"]]);
        source.setValidator((value) => {
          block.getField(limitName)?.setVisible(value === "NUMBER");
          return value;
        });
        row.appendField(source, validationFieldName(prefix, "SOURCE", index));
      }
      const limit = new Blockly.FieldNumber(typeof condition.limit === "number" ? condition.limit : 30);
      row.appendField(limit, limitName);
      if (canReferenceMonth) limit.setVisible(false);
    });
    block.appendDummyInput().appendField("LANZAR ERROR con mensaje:");
    const message = new Blockly.FieldTextInput(rule.message);
    message.maxDisplayLength = mobileLayout ? 32 : 64;
    block.appendDummyInput().appendField(message, validationFieldName(prefix, "MESSAGE"));
  });
}

function appendPayrollValidationRuleInputs(block: BlockSvg, Blockly: BlocklyApi, mobileLayout: boolean, ruleIndex: number) {
  const { key, label, prefix } = PAYROLL_INPUT_FIELDS[ruleIndex];
  const rule = DEFAULT_PAYROLL_CONFIG.inputValidations[key];
  block.appendDummyInput().appendField(`${ruleIndex + 1}. ${label}`);
  rule.conditions.forEach((condition, index) => {
    if (index) {
      block.appendDummyInput().appendField(new Blockly.FieldDropdown([
        ["O (alguna condicion)", "||"], ["Y (ambas condiciones)", "&&"]
      ]), validationFieldName(prefix, "JOIN"));
    }
    const labelRow = block.appendDummyInput().appendField(`SI ${key}`);
    const row = mobileLayout ? block.appendDummyInput() : labelRow;
    const operator = new Blockly.FieldDropdown(PAYROLL_VALIDATION_OPERATORS);
    operator.setValue(condition.operator);
    row.appendField(operator, validationFieldName(prefix, "OPERATOR", index));
    const limitName = validationFieldName(prefix, "LIMIT", index);
    const canReferenceMonth = key === "diasTrabajados" && index === 1;
    if (canReferenceMonth) {
      const source = new Blockly.FieldDropdown([["diasMes", "diasMes"], ["valor", "NUMBER"]]);
      source.setValidator((value) => {
        block.getField(limitName)?.setVisible(value === "NUMBER");
        return value;
      });
      row.appendField(source, validationFieldName(prefix, "SOURCE", index));
    }
    const limit = new Blockly.FieldNumber(typeof condition.limit === "number" ? condition.limit : 30);
    row.appendField(limit, limitName);
    if (canReferenceMonth) limit.setVisible(false);
  });
  block.appendDummyInput().appendField("LANZAR ERROR");
  const message = new Blockly.FieldTextInput(rule.message);
  message.maxDisplayLength = mobileLayout ? 32 : 64;
  block.appendDummyInput().appendField(message, validationFieldName(prefix, "MESSAGE"));
}

function setPayrollValidationRuleInputs(block: BlockSvg, config: PayrollFormulaConfig, key: typeof PAYROLL_INPUT_FIELDS[number]["key"]) {
  const { prefix } = PAYROLL_INPUT_FIELDS.find((field) => field.key === key) ?? PAYROLL_INPUT_FIELDS[0];
  const rule = config.inputValidations[key];
  rule.conditions.forEach(({ operator, limit }, index) => {
    block.setFieldValue(operator, validationFieldName(prefix, "OPERATOR", index));
    if (key === "diasTrabajados" && index === 1) {
      block.setFieldValue(typeof limit === "number" ? "NUMBER" : limit, validationFieldName(prefix, "SOURCE", index));
    }
    if (typeof limit === "number") block.setFieldValue(String(limit), validationFieldName(prefix, "LIMIT", index));
  });
  if (rule.conditions.length > 1) block.setFieldValue(rule.join, validationFieldName(prefix, "JOIN"));
  block.setFieldValue(rule.message, validationFieldName(prefix, "MESSAGE"));
}

function appendPayrollAtomicValidationInputs(block: BlockSvg, Blockly: BlocklyApi) {
  block.appendDummyInput().appendField(new Blockly.FieldLabel("Si"), "LABEL");
  block.appendDummyInput()
    .appendField(new Blockly.FieldDropdown(PAYROLL_VALIDATION_OPERATORS), "OPERATOR")
    .appendField(new Blockly.FieldDropdown([["valor", "NUMBER"], ["diasMes", "diasMes"]]), "SOURCE")
    .appendField(new Blockly.FieldNumber(0), "LIMIT");
  block.appendDummyInput().appendField(new Blockly.FieldDropdown([
    ["O (alguna condicion)", "||"], ["Y (ambas condiciones)", "&&"]
  ]), "JOIN");
}

function setPayrollAtomicConditionInputs(
  block: BlockSvg,
  config: PayrollFormulaConfig,
  key: typeof PAYROLL_INPUT_FIELDS[number]["key"],
  index: number
) {
  const field = PAYROLL_INPUT_FIELDS.find((item) => item.key === key) ?? PAYROLL_INPUT_FIELDS[0];
  const rule = config.inputValidations[key];
  const condition = rule.conditions[index] ?? rule.conditions[0];
  const isReference = key === "diasTrabajados" && index === 1 && condition.limit === "diasMes";
  block.setFieldValue(`SI ${field.label}`, "LABEL");
  block.setFieldValue(condition.operator, "OPERATOR");
  block.setFieldValue(isReference ? "diasMes" : "NUMBER", "SOURCE");
  block.setFieldValue(typeof condition.limit === "number" ? String(condition.limit) : "0", "LIMIT");
  block.setFieldValue(rule.join, "JOIN");
  block.getField("SOURCE")?.setVisible(key === "diasTrabajados" && index === 1);
  block.getField("LIMIT")?.setVisible(!isReference);
  block.getField("JOIN")?.setVisible(index > 0);
}

function appendPayrollAtomicErrorInputs(block: BlockSvg, Blockly: BlocklyApi) {
  block.appendDummyInput().appendField(new Blockly.FieldLabel("Error de validacion"), "LABEL");
  block.appendDummyInput().appendField("LANZAR ERROR");
  block.appendDummyInput().appendField(new Blockly.FieldTextInput("Mensaje de error"), "MESSAGE");
}

function setPayrollAtomicErrorInputs(block: BlockSvg, config: PayrollFormulaConfig, key: typeof PAYROLL_INPUT_FIELDS[number]["key"]) {
  const field = PAYROLL_INPUT_FIELDS.find((item) => item.key === key) ?? PAYROLL_INPUT_FIELDS[0];
  block.setFieldValue(`Error de ${field.label.toLowerCase()}`, "LABEL");
  block.setFieldValue(config.inputValidations[key].message, "MESSAGE");
}

function setPayrollValidationInputs(block: BlockSvg, config: PayrollFormulaConfig) {
  for (const { key, prefix } of PAYROLL_INPUT_FIELDS) {
    const rule = config.inputValidations[key];
    rule.conditions.forEach(({ operator, limit }, index) => {
      block.setFieldValue(operator, validationFieldName(prefix, "OPERATOR", index));
      if (key === "diasTrabajados" && index === 1) {
        block.setFieldValue(typeof limit === "number" ? "NUMBER" : limit, validationFieldName(prefix, "SOURCE", index));
      }
      if (typeof limit === "number") block.setFieldValue(String(limit), validationFieldName(prefix, "LIMIT", index));
    });
    if (rule.conditions.length > 1) block.setFieldValue(rule.join, validationFieldName(prefix, "JOIN"));
    block.setFieldValue(rule.message, validationFieldName(prefix, "MESSAGE"));
  }
}

function appendPayrollConfigInputs(block: BlockSvg, Blockly: BlocklyApi, title: string) {
  const value = (initial: number) => new Blockly.FieldNumber(initial, 0, 1_000_000, 0.01);
  const rate = (initial: number) => new Blockly.FieldNumber(initial * 100, 0, 100, 1);
  block.appendDummyInput().appendField(title);
  block.appendDummyInput().appendField("Antiguedad: anos").appendField(value(10), "SENIORITY_10").appendField("/").appendField(value(5), "SENIORITY_5").appendField("/").appendField(value(2), "SENIORITY_2");
  block.appendDummyInput().appendField("Bonificacion antiguedad: %").appendField(rate(0.12), "SENIORITY_RATE_10").appendField("/").appendField(rate(0.08), "SENIORITY_RATE_5").appendField("/").appendField(rate(0.04), "SENIORITY_RATE_2");
  block.appendDummyInput().appendField("Bonificacion por cargo: tecnico").appendField(rate(0.05), "POSITION_TECH").appendField("supervisor").appendField(rate(0.1), "POSITION_SUPERVISOR");
  block.appendDummyInput().appendField("gerente").appendField(rate(0.15), "POSITION_MANAGER");
  block.appendDummyInput().appendField("Desempeno: puntos").appendField(value(95), "PERFORMANCE_95").appendField("/").appendField(value(90), "PERFORMANCE_90").appendField("/").appendField(value(80), "PERFORMANCE_80");
  block.appendDummyInput().appendField("Bonificacion desempeno: %").appendField(rate(0.15), "PERFORMANCE_RATE_95").appendField("/").appendField(rate(0.1), "PERFORMANCE_RATE_90").appendField("/").appendField(rate(0.05), "PERFORMANCE_RATE_80");
  block.appendDummyInput().appendField("Horas extra: diurna").appendField(value(1.5), "OVERTIME_DAY").appendField("nocturna").appendField(value(2), "OVERTIME_NIGHT").appendField("feriado").appendField(value(2.5), "OVERTIME_HOLIDAY");
  block.appendDummyInput().appendField("Descuento progresivo: limites").appendField(value(1500), "PROGRESSIVE_LIMIT_1").appendField("/").appendField(value(2000), "PROGRESSIVE_LIMIT_2");
  block.appendDummyInput().appendField("Tasas por tramo").appendField(rate(0.05), "PROGRESSIVE_RATE_1").appendField("/").appendField(rate(0.08), "PROGRESSIVE_RATE_2");
  block.appendDummyInput().appendField("Clasificacion neta: baja menor a").appendField(value(1000), "CLASSIFICATION_LIMIT_1").appendField("media hasta").appendField(value(2000), "CLASSIFICATION_LIMIT_2");
}

function appendPayrollConfigGroupInputs(block: BlockSvg, Blockly: BlocklyApi, type: string, title: string) {
  const value = (initial: number) => new Blockly.FieldNumber(initial, 0, 1_000_000, 0.01);
  const rate = (initial: number) => new Blockly.FieldNumber(initial * 100, 0, 100, 1);
  block.appendDummyInput().appendField(title);
  if (type === "aviator_payroll_seniority_config") {
    block.appendDummyInput().appendField("Anos").appendField(value(10), "SENIORITY_10").appendField("/").appendField(value(5), "SENIORITY_5").appendField("/").appendField(value(2), "SENIORITY_2");
    block.appendDummyInput().appendField("Tasas %").appendField(rate(0.12), "SENIORITY_RATE_10").appendField("/").appendField(rate(0.08), "SENIORITY_RATE_5").appendField("/").appendField(rate(0.04), "SENIORITY_RATE_2");
  } else if (type === "aviator_payroll_position_config") {
    block.appendDummyInput().appendField("Tecnico %").appendField(rate(0.05), "POSITION_TECH").appendField("Supervisor %").appendField(rate(0.1), "POSITION_SUPERVISOR");
    block.appendDummyInput().appendField("Gerente %").appendField(rate(0.15), "POSITION_MANAGER");
  } else if (type === "aviator_payroll_performance_config") {
    block.appendDummyInput().appendField("Puntos").appendField(value(95), "PERFORMANCE_95").appendField("/").appendField(value(90), "PERFORMANCE_90").appendField("/").appendField(value(80), "PERFORMANCE_80");
    block.appendDummyInput().appendField("Tasas %").appendField(rate(0.15), "PERFORMANCE_RATE_95").appendField("/").appendField(rate(0.1), "PERFORMANCE_RATE_90").appendField("/").appendField(rate(0.05), "PERFORMANCE_RATE_80");
  } else if (type === "aviator_payroll_overtime_config") {
    block.appendDummyInput().appendField("Diurna").appendField(value(1.5), "OVERTIME_DAY").appendField("Nocturna").appendField(value(2), "OVERTIME_NIGHT").appendField("Feriado").appendField(value(2.5), "OVERTIME_HOLIDAY");
  } else if (type === "aviator_payroll_progressive_config") {
    block.appendDummyInput().appendField("Limites").appendField(value(1500), "PROGRESSIVE_LIMIT_1").appendField("/").appendField(value(2000), "PROGRESSIVE_LIMIT_2");
    block.appendDummyInput().appendField("Tasas %").appendField(rate(0.05), "PROGRESSIVE_RATE_1").appendField("/").appendField(rate(0.08), "PROGRESSIVE_RATE_2");
  } else {
    block.appendDummyInput().appendField("Baja menor a").appendField(value(1000), "CLASSIFICATION_LIMIT_1").appendField("Media hasta").appendField(value(2000), "CLASSIFICATION_LIMIT_2");
  }
}

function appendPayrollFlow(Blockly: BlocklyApi, workspace: WorkspaceSvg, payroll: BlockSvg, inputConfig?: PayrollFormulaConfig) {
  const config = normalizePayrollConfig(inputConfig ?? readPayrollConfig(payroll));
  const blocks = PAYROLL_FLOW_SECTIONS.map((section) => {
    const block = workspace.newBlock(section.type);
    if (section.type === "aviator_payroll_validation") {
      setPayrollValidationInputs(block, config);
    } else {
      section.lines(DEFAULT_PAYROLL_CONFIG).forEach((_, index) => block.removeInput(`LINE_ROW_${index}`, true));
      section.lines(config).forEach((line, index) => {
        block.appendDummyInput(`LINE_ROW_${index}`).appendField(new Blockly.FieldLabel(line), `LINE_${index}`);
      });
    }
    return block;
  });
  blocks.forEach((block) => {
    block.initSvg();
    block.render();
  });

  const first = blocks[0];
  if (first?.previousConnection) payroll.getInput("FLOW")?.connection?.connect(first.previousConnection);
  for (let index = 1; index < blocks.length; index += 1) {
    const previous = blocks[index - 1];
    const current = blocks[index];
    if (previous?.nextConnection && current?.previousConnection) {
      previous.nextConnection.connect(current.previousConnection);
    }
  }
  renderedPayrollConfigs.set(payroll, payrollFlowKey(config));
  Blockly.svgResize(workspace);
}

function updatePayrollFlowLabels(workspace: WorkspaceSvg, config: PayrollFormulaConfig) {
  for (const section of PAYROLL_FLOW_SECTIONS) {
    if (section.type === "aviator_payroll_validation") continue;
    const block = workspace.getBlocksByType(section.type, false)[0] as BlockSvg | undefined;
    if (!block) continue;
    section.lines(config).forEach((line, index) => block.setFieldValue(line, `LINE_${index}`));
  }
}

function moveBlockTo(block: BlockSvg, x: number, y: number) {
  const current = block.getRelativeToSurfaceXY();
  block.moveBy(x - current.x, y - current.y);
}

function disconnectPayrollFlow(workspace: WorkspaceSvg) {
  for (const type of PAYROLL_FLOW_SECTIONS.map((section) => section.type)) {
    for (const block of workspace.getBlocksByType(type, false) as BlockSvg[]) {
      if (block.previousConnection?.isConnected()) block.previousConnection.disconnect();
      if (block.nextConnection?.isConnected()) block.nextConnection.disconnect();
      block.setMovable(true);
    }
  }
}

function blockHeight(block: BlockSvg) {
  return typeof block.getHeightWidth === "function" ? block.getHeightWidth().height : 120;
}

function blockWidth(block: BlockSvg) {
  return typeof block.getHeightWidth === "function" ? block.getHeightWidth().width : 320;
}

function payrollStatementType(line: string) {
  const normalized = line.trim().toUpperCase();
  if (/^[A-ZÁÉÍÓÚÑ ]+$/.test(normalized)) return "aviator_payroll_header_statement";
  if (normalized.startsWith("IF ") || normalized.startsWith("ELSIF ")) return "aviator_payroll_if_statement";
  if (normalized.startsWith("ELSE")) return "aviator_payroll_else_statement";
  if (normalized.startsWith("FOR ")) return "aviator_payroll_for_statement";
  if (normalized.includes("CONTINUE")) return "aviator_payroll_continue_statement";
  if (normalized.startsWith("THROW ")) return "aviator_payroll_throw_statement";
  if (normalized.startsWith("RETURN ")) return "aviator_payroll_return_statement";
  return "aviator_payroll_assignment_statement";
}

function appendPayrollAtomicFlow(Blockly: BlocklyApi, workspace: WorkspaceSvg, config: PayrollFormulaConfig) {
  const blocks: BlockSvg[] = [];
  for (const validation of PAYROLL_VALIDATION_BLOCKS) {
    const rule = config.inputValidations[validation.key];
    rule.conditions.forEach((_, index) => {
      const block = workspace.newBlock("aviator_payroll_condition") as BlockSvg & { data?: string };
      block.data = `${validation.key}:${index}`;
      setPayrollAtomicConditionInputs(block, config, validation.key, index);
      blocks.push(block);
    });
    const errorBlock = workspace.newBlock("aviator_payroll_error") as BlockSvg & { data?: string };
    errorBlock.data = validation.key;
    setPayrollAtomicErrorInputs(errorBlock, config, validation.key);
    blocks.push(errorBlock);
  }
  for (const section of PAYROLL_FLOW_SECTIONS) {
    if (section.type === "aviator_payroll_validation") continue;
    section.lines(config).forEach((line, index) => {
      const block = workspace.newBlock(payrollStatementType(line)) as BlockSvg;
      block.setFieldValue(line, "TEXT");
      block.data = `${section.type}:${index}`;
      blocks.push(block);
    });
  }
  blocks.forEach((block) => {
    block.initSvg();
    block.render();
    block.setMovable(true);
  });
  return blocks;
}

function createDecomposedPayrollGraph(
  Blockly: BlocklyApi,
  workspace: WorkspaceSvg,
  root: BlockSvg,
  config: PayrollFormulaConfig,
  origin = { x: 28, y: 28 }
) {
  const result = workspace.newBlock("aviator_payroll_result") as BlockSvg;
  result.initSvg();
  result.render();
  moveBlockTo(result, origin.x, origin.y);
  if (!result.outputConnection) throw new Error("No se pudo crear la salida de la formula descompuesta.");
  root.getInput("VALUE")?.connection?.connect(result.outputConnection);

  const parameterBlocks = PAYROLL_CONFIG_GROUPS.map((group) => {
    const block = workspace.newBlock(group.type) as BlockSvg;
    setPayrollConfig(block, config);
    block.initSvg();
    block.render();
    block.setMovable(true);
    return block;
  });
  const atomicBlocks = appendPayrollAtomicFlow(Blockly, workspace, config);
  let parameterY = origin.y + 90;
  for (const block of parameterBlocks) {
    moveBlockTo(block, origin.x, parameterY);
    parameterY += blockHeight(block) + 24;
  }
  const parameterWidth = Math.max(...parameterBlocks.map(blockWidth), 300);
  const flowWidth = Math.max(...atomicBlocks.map(blockWidth), 320);
  const flowStartX = origin.x + parameterWidth + 120;
  const columns = [
    { x: flowStartX, y: origin.y },
    { x: flowStartX + flowWidth + 80, y: origin.y },
    { x: flowStartX + (flowWidth + 80) * 2, y: origin.y }
  ];
  for (const block of atomicBlocks) {
    const column = columns.reduce((shortest, current) => current.y < shortest.y ? current : shortest, columns[0]);
    moveBlockTo(block, column.x, column.y);
    column.y += blockHeight(block) + 16;
  }
  renderedPayrollConfigs.set(parameterBlocks[0], payrollFlowKey(config));
  decomposedPayrollWorkspaces.add(workspace);
}

function updatePayrollAtomicFlow(workspace: WorkspaceSvg, config: PayrollFormulaConfig) {
  const sections = new Map(PAYROLL_FLOW_SECTIONS.map((section) => [section.type, section]));
  for (const { type } of PAYROLL_STATEMENT_BLOCKS) {
    for (const block of workspace.getBlocksByType(type, false) as (BlockSvg & { data?: string })[]) {
      const [sectionType, indexValue] = (block.data ?? "").split(":");
      const section = sections.get(sectionType);
      const index = Number(indexValue);
      const line = section && Number.isInteger(index) ? section.lines(config)[index] : undefined;
      if (line !== undefined) block.setFieldValue(line, "TEXT");
    }
  }
}

export function decomposePayrollGraph(Blockly: BlocklyApi, workspace: WorkspaceSvg) {
  if (decomposedPayrollWorkspaces.has(workspace)) return false;
  const payroll = workspace.getBlocksByType("aviator_payroll", false)[0] as BlockSvg | undefined;
  const root = workspace.getBlocksByType("aviator_formula", false)[0] as BlockSvg | undefined;
  if (!payroll || !root) return false;

  const payrollPosition = payroll.getRelativeToSurfaceXY();
  const validation = workspace.getBlocksByType("aviator_payroll_validation", false)[0] as BlockSvg | undefined;
  const config = readPayrollConfig(payroll, validation);
  const previousOutput = root.getInput("VALUE")?.connection?.targetBlock();
  if (previousOutput !== payroll) return false;

  Blockly.Events.disable();
  try {
    root.getInput("VALUE")?.connection?.disconnect();
    disconnectPayrollFlow(workspace);
    for (const type of PAYROLL_FLOW_SECTIONS.map((section) => section.type)) {
      for (const block of workspace.getBlocksByType(type, false) as BlockSvg[]) block.dispose(false, false);
    }
    payroll.dispose(false, false);

    createDecomposedPayrollGraph(Blockly, workspace, root, config, payrollPosition);
    Blockly.svgResize(workspace);
    return true;
  } finally {
    Blockly.Events.enable();
  }
}

/**
 * Creates a complete advanced payroll formula without consulting the formula catalog.
 * The returned workspace is already decomposed so every parameter, validation and
 * calculation step is visible and editable from the first interaction.
 */
export function createNewPayrollGraph(
  Blockly: BlocklyApi,
  workspace: WorkspaceSvg,
  inputConfig: PayrollFormulaConfig = DEFAULT_PAYROLL_CONFIG
) {
  const config = normalizePayrollConfig(inputConfig);
  Blockly.Events.disable();
  try {
    workspace.clear();
    const root = workspace.newBlock("aviator_formula") as BlockSvg;
    root.initSvg();
    root.render();
    createDecomposedPayrollGraph(Blockly, workspace, root, config);
    Blockly.svgResize(workspace);
    return root;
  } finally {
    Blockly.Events.enable();
  }
}

export function compactPayrollGraph(Blockly: BlocklyApi, workspace: WorkspaceSvg) {
  const parameterBlocks = [
    ...workspace.getBlocksByType("aviator_payroll_config", false),
    ...PAYROLL_CONFIG_GROUPS.flatMap(({ type }) => workspace.getBlocksByType(type, false))
  ] as BlockSvg[];
  if (!decomposedPayrollWorkspaces.has(workspace) && parameterBlocks.length === 0) return false;
  const root = workspace.getBlocksByType("aviator_formula", false)[0] as BlockSvg | undefined;
  const parameters = parameterBlocks[0];
  if (!root || !parameters) return false;
  const config = readDecomposedPayrollConfig(workspace, parameters);

  Blockly.Events.disable();
  try {
    root.getInput("VALUE")?.connection?.disconnect();
    for (const type of PAYROLL_DECOMPOSED_BLOCK_TYPES) {
      for (const block of workspace.getBlocksByType(type, false) as BlockSvg[]) {
        if (block.previousConnection?.isConnected()) block.previousConnection.disconnect();
        if (block.nextConnection?.isConnected()) block.nextConnection.disconnect();
        block.dispose(false, false);
      }
    }
    const payroll = workspace.newBlock("aviator_payroll") as BlockSvg;
    setPayrollConfig(payroll, config);
    payroll.initSvg();
    payroll.render();
    moveBlockTo(payroll, 28, 28);
    if (!payroll.outputConnection) throw new Error("No se pudo reconstruir la salida de la formula compacta.");
    root.getInput("VALUE")?.connection?.connect(payroll.outputConnection);
    appendPayrollFlow(Blockly, workspace, payroll, config);
    decomposedPayrollWorkspaces.delete(workspace);
    Blockly.svgResize(workspace);
    return true;
  } finally {
    Blockly.Events.enable();
  }
}

export function isDecomposedPayrollWorkspaceState(state: unknown): boolean {
  if (!state || typeof state !== "object") return false;
  if (Array.isArray(state)) return state.some(isDecomposedPayrollWorkspaceState);
  return Object.entries(state as Record<string, unknown>).some(([key, value]) =>
    (key === "type" && (
      value === "aviator_payroll_config"
      || value === "aviator_payroll_result"
      || value === "aviator_payroll_statement"
      || PAYROLL_CONFIG_GROUPS.some((group) => group.type === value)
      || PAYROLL_VALIDATION_BLOCKS.some((block) => block.type === value)
    )) || isDecomposedPayrollWorkspaceState(value)
  );
}

export function refreshPayrollFormulaGraph(Blockly: BlocklyApi, workspace: WorkspaceSvg) {
  const payroll = workspace.getBlocksByType("aviator_payroll", false)[0] as BlockSvg | undefined;
  const parameters = (
    workspace.getBlocksByType("aviator_payroll_config", false)[0]
    ?? PAYROLL_CONFIG_GROUPS.flatMap(({ type }) => workspace.getBlocksByType(type, false))[0]
  ) as BlockSvg | undefined;
  const isDecomposed = decomposedPayrollWorkspaces.has(workspace) || (!payroll && Boolean(parameters));
  if (isDecomposed) decomposedPayrollWorkspaces.add(workspace);
  const payrollBlock = payroll ?? parameters;
  if (!payrollBlock) return;
  const validationBlock = workspace.getBlocksByType("aviator_payroll_validation", false)[0] as BlockSvg | undefined
    ?? (payroll?.getInputTargetBlock("FLOW") as BlockSvg | null);
  const config = isDecomposed
    ? readDecomposedPayrollConfig(workspace, payrollBlock)
    : readPayrollConfig(payrollBlock, validationBlock);
  const configKey = payrollFlowKey(config);
  if (renderedPayrollConfigs.get(payrollBlock) === configKey) return;

  Blockly.Events.disable();
  try {
    if (isDecomposed) {
      const hasAtomicStatements = PAYROLL_STATEMENT_BLOCKS.some(({ type }) => workspace.getBlocksByType(type, false).length > 0)
        || workspace.getBlocksByType("aviator_payroll_statement", false).length > 0;
      if (hasAtomicStatements) {
        updatePayrollAtomicFlow(workspace, config);
      } else {
        updatePayrollFlowLabels(workspace, config);
      }
      renderedPayrollConfigs.set(payrollBlock, configKey);
      return;
    }
    // Blockly disposes the entire connected stack, including next blocks.
    validationBlock?.dispose(false, false);
    appendPayrollFlow(Blockly, workspace, payrollBlock, config);
  } finally {
    Blockly.Events.enable();
  }
}

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

  Blockly.Blocks.aviator_program = {
    init() {
      this.appendDummyInput().appendField("programa AviatorScript").appendField(new Blockly.FieldLabel("", NESTED_WIDTH_SPACER_CLASS), NESTED_WIDTH_FIELD);
      this.appendStatementInput("BODY");
      this.setColour("#07877d");
      this.setDeletable(false);
      this.setMovable(false);
      this.setTooltip("Raiz del programa. Conecta declaraciones, controles, errores y el bloque DEVOLVER.");
    }
  };

  Blockly.Blocks.aviator_section = {
    init() {
      this.appendDummyInput().appendField("SECCION").appendField(new Blockly.FieldTextInput("Nueva seccion"), "TITLE");
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour("#087e8b");
      this.setTooltip("Comentario de seccion que se refleja en el codigo generado.");
    }
  };

  const initStatementBlock = (block: BlockSvg, colour: string, tooltip: string) => {
    block.setPreviousStatement(true);
    block.setNextStatement(true);
    block.setColour(colour);
    block.setTooltip(tooltip);
  };

  Blockly.Blocks.aviator_let = {
    init() {
      this.appendDummyInput().appendField("DECLARAR").appendField(new Blockly.FieldTextInput("variable"), "NAME");
      this.appendValueInput("VALUE").appendField("igual a");
      initStatementBlock(this as unknown as BlockSvg, "#177a54", "Declara una variable local con let.");
    }
  };

  Blockly.Blocks.aviator_set = {
    init() {
      this.appendDummyInput().appendField("ASIGNAR").appendField(new Blockly.FieldTextInput("variable"), "NAME");
      this.appendValueInput("VALUE").appendField("igual a");
      initStatementBlock(this as unknown as BlockSvg, "#177a54", "Actualiza una variable local.");
    }
  };

  Blockly.Blocks.aviator_expression_statement = {
    init() {
      this.appendValueInput("VALUE").appendField("EJECUTAR");
      initStatementBlock(this as unknown as BlockSvg, "#1686a6", "Ejecuta una expresion como paso del programa.");
    }
  };

  Blockly.Blocks.aviator_if_statement = {
    init() {
      this.appendValueInput("CONDITION").setCheck("Boolean").appendField("SI").appendField(new Blockly.FieldLabel("", NESTED_WIDTH_SPACER_CLASS), NESTED_WIDTH_FIELD);
      this.appendStatementInput("THEN").appendField("ENTONCES");
      this.appendStatementInput("ELSE_IF").appendField("ELSIF");
      this.appendStatementInput("ELSE").appendField("ELSE");
      initStatementBlock(this as unknown as BlockSvg, "#7650b3", "Condicion con ramas SI, ELSIF y ELSE.");
    }
  };

  Blockly.Blocks.aviator_if_simple = {
    init() {
      this.appendValueInput("CONDITION").setCheck("Boolean").appendField("SI").appendField(new Blockly.FieldLabel("", NESTED_WIDTH_SPACER_CLASS), NESTED_WIDTH_FIELD);
      this.appendStatementInput("THEN").appendField("ENTONCES");
      initStatementBlock(this as unknown as BlockSvg, "#7650b3", "Condicion simple sin ramas alternativas.");
    }
  };

  Blockly.Blocks.aviator_elsif_clause = {
    init() {
      this.appendValueInput("CONDITION").setCheck("Boolean").appendField("CONDICION").appendField(new Blockly.FieldLabel("", NESTED_WIDTH_SPACER_CLASS), NESTED_WIDTH_FIELD);
      this.appendStatementInput("BODY").appendField("HACER");
      initStatementBlock(this as unknown as BlockSvg, "#7650b3", "Rama ELSIF adicional.");
    }
  };

  Blockly.Blocks.aviator_for_statement = {
    init() {
      this.appendDummyInput().appendField("PARA CADA").appendField(new Blockly.FieldTextInput("item"), "ITEM").appendField("EN");
      this.appendValueInput("COLLECTION").setCheck("Array").appendField(new Blockly.FieldLabel("", NESTED_WIDTH_SPACER_CLASS), NESTED_WIDTH_FIELD);
      this.appendStatementInput("BODY").appendField("HACER");
      initStatementBlock(this as unknown as BlockSvg, "#c77711", "Itera una lista y ejecuta sus bloques internos.");
    }
  };

  Blockly.Blocks.aviator_while_statement = {
    init() {
      this.appendValueInput("CONDITION").setCheck("Boolean").appendField("MIENTRAS").appendField(new Blockly.FieldLabel("", NESTED_WIDTH_SPACER_CLASS), NESTED_WIDTH_FIELD);
      this.appendStatementInput("BODY").appendField("HACER");
      initStatementBlock(this as unknown as BlockSvg, "#c77711", "Repite un bloque mientras la condicion sea verdadera.");
    }
  };

  Blockly.Blocks.aviator_continue_statement = {
    init() {
      this.appendDummyInput().appendField("CONTINUAR");
      initStatementBlock(this as unknown as BlockSvg, "#c77711", "Salta al siguiente elemento del ciclo.");
    }
  };

  Blockly.Blocks.aviator_break_statement = {
    init() {
      this.appendDummyInput().appendField("SALIR DEL CICLO");
      initStatementBlock(this as unknown as BlockSvg, "#c77711", "Termina el ciclo actual.");
    }
  };

  Blockly.Blocks.aviator_throw_statement = {
    init() {
      this.appendValueInput("MESSAGE").appendField("LANZAR ERROR");
      initStatementBlock(this as unknown as BlockSvg, "#d24738", "Detiene la formula con un mensaje controlado.");
    }
  };

  Blockly.Blocks.aviator_return_statement = {
    init() {
      this.appendValueInput("VALUE").appendField("DEVOLVER");
      initStatementBlock(this as unknown as BlockSvg, "#087e8b", "Devuelve un valor, objeto o lista como resultado de la formula.");
    }
  };

  Blockly.Blocks.aviator_member = {
    init() {
      this.appendValueInput("OBJECT").appendField("propiedad");
      this.appendDummyInput().appendField(".").appendField(new Blockly.FieldTextInput("campo"), "PROPERTY");
      this.setInputsInline(!mobileLayout);
      this.setOutput(true);
      this.setColour("#087e8b");
      this.setTooltip("Lee una propiedad de un objeto, por ejemplo item.horas.");
    }
  };

  Blockly.Blocks.aviator_list = {
    init() {
      this.appendStatementInput("ITEMS").appendField("lista");
      this.setOutput(true, "Array");
      this.setColour("#1686a6");
      this.setTooltip("Crea una lista a partir de bloques ELEMENTO.");
    }
  };

  Blockly.Blocks.aviator_list_item = {
    init() {
      this.appendValueInput("VALUE").appendField("elemento");
      initStatementBlock(this as unknown as BlockSvg, "#1686a6", "Elemento de una lista.");
    }
  };

  Blockly.Blocks.aviator_list_add = {
    init() {
      this.appendValueInput("LIST").setCheck("Array").appendField("AGREGAR en");
      this.appendValueInput("VALUE").appendField("valor");
      initStatementBlock(this as unknown as BlockSvg, "#1686a6", "Agrega un valor a una lista existente.");
    }
  };

  Blockly.Blocks.aviator_object = {
    init() {
      this.appendStatementInput("ENTRIES").appendField("objeto");
      this.setOutput(true, "Object");
      this.setColour("#087e8b");
      this.setTooltip("Construye un objeto estructurado para devolverlo o usarlo en otra expresion.");
    }
  };

  Blockly.Blocks.aviator_object_entry = {
    init() {
      this.appendDummyInput().appendField("campo").appendField(new Blockly.FieldTextInput("nombre"), "KEY");
      this.appendValueInput("VALUE").appendField("valor");
      initStatementBlock(this as unknown as BlockSvg, "#087e8b", "Campo de un objeto estructurado.");
    }
  };

  Blockly.Blocks.aviator_variable = {
    init() {
      this.appendDummyInput()
        .appendField("dato")
        .appendField(new Blockly.FieldTextInput("variable"), "FIELD");
      this.setOutput(true);
      this.setColour("#087e8b");
      this.setTooltip("Dato del contexto JVM o variable local. Escribe su nombre tal como se usa en AviatorScript.");
    }
  };

  Blockly.Blocks.aviator_context_variable = {
    init() {
      this.appendDummyInput()
        .appendField("dato JVM")
        .appendField(new Blockly.FieldDropdown(() => {
          const options = fieldsRef.current.map((field) => [mobileLayout ? field.key : field.label, field.key] as [string, string]);
          return options.length ? options : [["Sin variables", ""]];
        }), "FIELD");
      this.setOutput(true);
      this.setColour("#087e8b");
      this.setTooltip(() => {
        const field = fieldsRef.current.find((item) => item.key === this.getFieldValue("FIELD"));
        return field ? `${field.label} (${field.key})${field.description ? `: ${field.description}` : ""}` : "Selecciona una variable del contexto JVM.";
      });
    }
  };

  Blockly.Blocks.aviator_user_variable = {
    init() {
      this.appendDummyInput()
        .appendField("dato JVM")
        .appendField(new Blockly.FieldTextInput("miVariable"), "FIELD")
        .appendField("tipo")
        .appendField(new Blockly.FieldDropdown([
          ["automatico", "unknown"],
          ["texto", "string"],
          ["numero", "number"],
          ["booleano", "boolean"],
          ["fecha", "date"]
        ]), "TYPE");
      this.setOutput(true);
      this.setColour("#087e8b");
      this.setTooltip("Crea una variable JVM para esta formula. Define su nombre y tipo cuando la necesites.");
    }
  };

  Blockly.Blocks.aviator_number = {
    init() {
      this.appendDummyInput().appendField("numero").appendField(new Blockly.FieldNumber(0), "VALUE");
      this.setOutput(true, "Number");
      this.setColour("#c77711");
      this.setTooltip("Valor numerico constante.");
    }
  };

  Blockly.Blocks.aviator_text = {
    init() {
      this.appendDummyInput().appendField("texto").appendField(new Blockly.FieldTextInput(""), "VALUE");
      this.setOutput(true, "String");
      this.setColour("#1686a6");
      this.setTooltip("Texto constante.");
    }
  };

  Blockly.Blocks.aviator_date = {
    init() {
      this.appendDummyInput().appendField("fecha ISO").appendField(new Blockly.FieldTextInput("2026-01-01"), "VALUE");
      this.setOutput(true, "Date");
      this.setColour("#1686a6");
      this.setTooltip("Fecha escrita como AAAA-MM-DD.");
    }
  };

  Blockly.Blocks.aviator_boolean = {
    init() {
      this.appendDummyInput().appendField("valor").appendField(new Blockly.FieldDropdown([["Verdadero", "true"], ["Falso", "false"]]), "VALUE");
      this.setOutput(true, "Boolean");
      this.setColour("#26823b");
      this.setTooltip("Valor verdadero o falso.");
    }
  };

  Blockly.Blocks.aviator_math = {
    init() {
      this.appendValueInput("LEFT").setCheck("Number");
      this.appendDummyInput().appendField(new Blockly.FieldDropdown(MATH_OPERATOR_OPTIONS), "OP");
      this.appendValueInput("RIGHT").setCheck("Number");
      this.setInputsInline(!mobileLayout);
      this.setOutput(true, "Number");
      this.setColour("#c77711");
      this.setTooltip("Operacion aritmetica entre dos valores.");
    }
  };

  Blockly.Blocks.aviator_compare = {
    init() {
      this.appendValueInput("LEFT").appendField("si");
      this.appendDummyInput().appendField(new Blockly.FieldDropdown(OPERATOR_OPTIONS), "OP");
      this.appendValueInput("RIGHT");
      this.setInputsInline(!mobileLayout);
      this.setOutput(true, "Boolean");
      this.setColour("#7650b3");
      this.setTooltip("Compara dos valores y devuelve verdadero o falso.");
    }
  };

  Blockly.Blocks.aviator_logic = {
    init() {
      this.appendValueInput("LEFT").setCheck("Boolean");
      this.appendDummyInput().appendField(new Blockly.FieldDropdown([["Y tambien", "&&"], ["O bien", "||"]]), "OP");
      this.appendValueInput("RIGHT").setCheck("Boolean");
      this.setInputsInline(!mobileLayout);
      this.setOutput(true, "Boolean");
      this.setColour("#26823b");
      this.setTooltip("Combina dos condiciones con AND u OR.");
    }
  };

  Blockly.Blocks.aviator_not = {
    init() {
      this.appendValueInput("VALUE").setCheck("Boolean").appendField("no se cumple");
      this.setOutput(true, "Boolean");
      this.setColour("#26823b");
      this.setTooltip("Invierte el resultado de una condicion.");
    }
  };

  Blockly.Blocks.aviator_negate = {
    init() {
      this.appendValueInput("VALUE").setCheck("Number").appendField("cambiar signo de");
      this.setOutput(true, "Number");
      this.setColour("#c77711");
      this.setTooltip("Devuelve el negativo de un numero.");
    }
  };

  Blockly.Blocks.aviator_bit_not = {
    init() {
      this.appendValueInput("VALUE").setCheck("Number").appendField("bit NOT de");
      this.setOutput(true, "Number");
      this.setColour("#c77711");
      this.setTooltip("Invierte los bits de un numero con el operador ~ de AviatorScript.");
    }
  };

  Blockly.Blocks.aviator_if = {
    init() {
      this.appendValueInput("CONDITION").setCheck("Boolean").appendField("si");
      this.appendValueInput("THEN").appendField("entonces devolver");
      this.appendValueInput("ELSE").appendField("si no devolver");
      this.setOutput(true);
      this.setColour("#177a54");
      this.setTooltip("Devuelve un resultado u otro segun se cumpla la condicion.");
    }
  };

  Blockly.Blocks.aviator_math_function = {
    init() {
      this.appendValueInput("VALUE").setCheck("Number").appendField(new Blockly.FieldDropdown([["valor absoluto", "math.abs"], ["raiz cuadrada", "math.sqrt"], ["redondear", "math.round"]]), "FUNCTION");
      this.setOutput(true, "Number");
      this.setColour("#d18a2e");
      this.setTooltip("Aplica una funcion matematica a un numero.");
    }
  };

  Blockly.Blocks.aviator_power = {
    init() {
      this.appendValueInput("BASE").setCheck("Number").appendField("elevar");
      this.appendValueInput("EXPONENT").setCheck("Number").appendField("a la potencia");
      this.setInputsInline(!mobileLayout);
      this.setOutput(true, "Number");
      this.setColour("#d18a2e");
      this.setTooltip("Eleva un numero a la potencia indicada.");
    }
  };

  Blockly.Blocks.aviator_string_function = {
    init() {
      this.appendValueInput("TEXT").appendField("el texto");
      this.appendDummyInput().appendField(new Blockly.FieldDropdown([["contiene", "string.contains"], ["empieza con", "string.starts_with"], ["termina con", "string.ends_with"]]), "FUNCTION");
      this.appendValueInput("SEARCH");
      this.setInputsInline(!mobileLayout);
      this.setOutput(true, "Boolean");
      this.setColour("#1686a6");
      this.setTooltip("Comprueba si un texto contiene o coincide con otro texto.");
    }
  };
}

function block(type: string, fields?: Record<string, string>) {
  return { kind: "block", type, ...(fields ? { fields } : {}) };
}

export function createFormulaToolbox(fields: SchemaField[]) {
  return {
    kind: "categoryToolbox",
    contents: [
      {
        kind: "category",
        name: "Programa",
        colour: "#07877d",
        contents: [block("aviator_section"), block("aviator_let"), block("aviator_set"), block("aviator_expression_statement")]
      },
      {
        kind: "category",
        name: "Variables JVM",
        colour: "#087e8b",
        contents: [
          block("aviator_user_variable"),
          ...(fields.length ? [{
            kind: "category",
            name: "Sugeridas por el esquema",
            colour: "#087e8b",
            contents: fields.map((field) => block("aviator_context_variable", { FIELD: field.key }))
          }] : [])
        ]
      },
      {
        kind: "category",
        name: "Valores",
        colour: "#1686a6",
        contents: [block("aviator_number"), block("aviator_text"), block("aviator_date"), block("aviator_boolean")]
      },
      {
        kind: "category",
        name: "Matematicas",
        colour: "#c77711",
         contents: [block("aviator_math"), block("aviator_negate"), block("aviator_bit_not"), block("aviator_power")]
      },
      {
        kind: "category",
        name: "Comparacion",
        colour: "#7650b3",
        contents: [block("aviator_compare")]
      },
      {
        kind: "category",
        name: "Logica",
        colour: "#26823b",
        contents: [block("aviator_logic"), block("aviator_not"), block("aviator_boolean")]
      },
      {
        kind: "category",
        name: "Texto",
        colour: "#1686a6",
        contents: [block("aviator_text"), block("aviator_string_function")]
      },
      {
        kind: "category",
        name: "Colecciones y objetos",
        colour: "#087e8b",
        contents: [block("aviator_member"), block("aviator_list"), block("aviator_list_item"), block("aviator_list_add"), block("aviator_object"), block("aviator_object_entry")]
      },
      {
        kind: "category",
        name: "Funciones",
        colour: "#d18a2e",
        contents: [block("aviator_math_function"), block("aviator_power")]
      },
      {
        kind: "category",
        name: "Control",
        colour: "#177a54",
        contents: [block("aviator_if"), block("aviator_if_simple"), block("aviator_if_statement"), block("aviator_elsif_clause"), block("aviator_for_statement"), block("aviator_while_statement"), block("aviator_continue_statement"), block("aviator_break_statement")]
      },
      {
        kind: "category",
        name: "Errores y salida",
        colour: "#d24738",
        contents: [block("aviator_throw_statement"), block("aviator_return_statement")]
      }
    ]
  };
}

function nestedContainerContentWidth(block: BlockSvg, visiting = new Set<string>()): number {
  if (visiting.has(block.id)) return block.width;
  visiting.add(block.id);
  const origin = block.getRelativeToSurfaceXY();
  let width = block.width;
  for (const input of block.inputList) {
    let child = input.connection?.targetBlock() as BlockSvg | null;
    while (child) {
      const childOrigin = child.getRelativeToSurfaceXY();
      const childLeft = Math.max(0, childOrigin.x - origin.x);
      width = Math.max(width, childLeft + nestedContainerContentWidth(child, visiting) + 24);
      child = child.getNextBlock() as BlockSvg | null;
    }
  }
  visiting.delete(block.id);
  return width;
}

function nestedContainerDepth(block: BlockSvg) {
  let depth = 0;
  let parent = block.getParent() as BlockSvg | null;
  while (parent) {
    depth += 1;
    parent = parent.getParent() as BlockSvg | null;
  }
  return depth;
}

export function fitNestedBlockContainers(Blockly: BlocklyApi, workspace: WorkspaceSvg) {
  const containers = workspace.getAllBlocks(false)
    .filter((block) => NESTED_CONTAINER_TYPES.has(block.type)) as BlockSvg[];
  if (!containers.length) return;

  Blockly.Events.disable();
  try {
    containers.sort((left, right) => nestedContainerDepth(right) - nestedContainerDepth(left));
    // Render more than once: a deep child can change the size of its parent,
    // which then changes the size of every ancestor in the statement chain.
    for (let pass = 0; pass < 2; pass += 1) {
      for (const block of containers) {
        const field = block.getField(NESTED_WIDTH_FIELD);
        if (!field) continue;
        if (block.getFieldValue(NESTED_WIDTH_FIELD)) block.setFieldValue("", NESTED_WIDTH_FIELD);
        const requiredWidth = nestedContainerContentWidth(block) + 24;
        const missingWidth = requiredWidth - block.width;
        if (missingWidth > 0) {
          const spacer = NESTED_WIDTH_SPACER_CHAR.repeat(Math.ceil(missingWidth / 8));
          block.setFieldValue(spacer, NESTED_WIDTH_FIELD);
        }
        // This final render is what makes the parent background grow around
        // the complete BODY/THEN/ELSE chain after its descendants are ready.
        block.render();
      }
    }
  } finally {
    Blockly.Events.enable();
  }
}

export function getUserVariableFields(workspace: WorkspaceSvg): SchemaField[] {
  const fields = new Map<string, SchemaField>();
  for (const block of workspace.getBlocksByType("aviator_user_variable", false)) {
    const key = block.getFieldValue("FIELD")?.trim() ?? "";
    if (!key) continue;
    const type = block.getFieldValue("TYPE") as SchemaFieldType | null;
    fields.set(key, {
      key,
      label: key,
      type: type && ["string", "number", "boolean", "date", "unknown"].includes(type) ? type : "unknown",
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
  function connect(parent: BlockSvg, inputName: string, child: BlockSvg) {
    const inputConnection = parent.getInput(inputName)?.connection;
    const outputConnection = child.outputConnection;
    if (!inputConnection || !outputConnection) throw new Error("No se pudo conectar un bloque de la plantilla.");
    inputConnection.connect(outputConnection);
  }

  function createBlock(node: FormulaExpression): BlockSvg {
    let block!: BlockSvg;
    if (node.kind === "payroll") {
      block = workspace.newBlock("aviator_payroll");
      setPayrollConfig(block, node.config);
      appendPayrollFlow(Blockly, workspace, block, node.config);
    } else if (node.kind === "literal") {
      const type = node.valueType === "number" ? "aviator_number"
        : node.valueType === "boolean" ? "aviator_boolean"
          : node.valueType === "date" ? "aviator_date" : "aviator_text";
      block = workspace.newBlock(type);
      block.setFieldValue(String(node.value), "VALUE");
    } else if (node.kind === "variable") {
      block = workspace.newBlock("aviator_variable");
      block.setFieldValue(node.key, "FIELD");
    } else if (node.kind === "member") {
      block = workspace.newBlock("aviator_member");
      block.setFieldValue(node.property, "PROPERTY");
      connect(block, "OBJECT", createBlock(node.object));
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
        return { kind: "variable", key, valueType: type && ["string", "number", "boolean", "date", "unknown"].includes(type) ? type : "unknown" };
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
        return { kind: "call", name: block.getFieldValue("FUNCTION") as FormulaFunctionName, args: [argument], valueType: "number" };
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
