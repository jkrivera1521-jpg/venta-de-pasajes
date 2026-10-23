import type { BlockSvg, WorkspaceSvg } from "blockly";
import { DEFAULT_PAYROLL_CONFIG, PAYROLL_INPUT_FIELDS, normalizePayrollConfig, type PayrollFormulaConfig, type PayrollInputValidation, type PayrollValidationOperator } from "./payroll-formula";

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
  "aviator_lambda",
  "aviator_collection_function",
  "aviator_null",
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


export {
  DEFAULT_PAYROLL_CONFIG,
  GENERIC_BLOCK_TYPES,
  PAYROLL_CONFIG_GROUPS,
  PAYROLL_DECOMPOSED_BLOCK_TYPES,
  PAYROLL_FLOW_SECTIONS,
  PAYROLL_INPUT_FIELDS,
  PAYROLL_STATEMENT_BLOCKS,
  PAYROLL_VALIDATION_BLOCKS,
  appendPayrollAtomicErrorInputs,
  appendPayrollAtomicFlow,
  appendPayrollAtomicValidationInputs,
  appendPayrollConfigGroupInputs,
  appendPayrollConfigInputs,
  appendPayrollFlow,
  appendPayrollValidationInputs,
  appendPayrollValidationRuleInputs,
  decomposedPayrollWorkspaces,
  readDecomposedPayrollConfig,
  setPayrollAtomicConditionInputs,
  setPayrollAtomicErrorInputs,
  setPayrollConfig,
  setPayrollValidationInputs,
  setPayrollValidationRuleInputs
};
