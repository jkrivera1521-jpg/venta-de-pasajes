import type { SchemaField } from "./types";

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
        contents: [block("aviator_number"), block("aviator_text"), block("aviator_date"), block("aviator_boolean"), block("aviator_null")]
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
        contents: [block("aviator_member"), block("aviator_list"), block("aviator_list_item"), block("aviator_list_add"), block("aviator_object"), block("aviator_object_entry"), block("aviator_lambda"), block("aviator_collection_function")]
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
