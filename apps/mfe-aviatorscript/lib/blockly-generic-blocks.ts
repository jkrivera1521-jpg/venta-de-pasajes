import type { BlockSvg } from "blockly";
import type { SchemaField } from "./types";

type BlocklyApi = typeof import("blockly");

const NESTED_WIDTH_FIELD = "NESTED_WIDTH";
const NESTED_WIDTH_SPACER_CLASS = "aviatorNestedWidthSpacer";

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

export function registerGenericAviatorBlocks(Blockly: BlocklyApi, fieldsRef: { current: SchemaField[] }, mobileLayout: boolean) {
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

  Blockly.Blocks.aviator_lambda = {
    init() {
      this.appendDummyInput()
        .appendField("lambda(")
        .appendField(new Blockly.FieldTextInput("item"), "PARAM_1")
        .appendField(",")
        .appendField(new Blockly.FieldTextInput(""), "PARAM_2")
        .appendField(")");
      this.appendValueInput("BODY").appendField("->");
      this.setOutput(true, "Lambda");
      this.setColour("#7650b3");
      this.setTooltip("Funcion pequena para filtrar o reducir elementos de una lista.");
    }
  };

  Blockly.Blocks.aviator_collection_function = {
    init() {
      this.appendValueInput("COLLECTION")
        .appendField(new Blockly.FieldDropdown([
          ["contar elementos de", "seq.count"],
          ["filtrar", "seq.filter"],
          ["reducir", "seq.reduce"]
        ]), "FUNCTION");
      this.appendValueInput("CALLBACK").appendField("con lambda");
      this.appendValueInput("INITIAL").appendField("inicial");
      this.setInputsInline(!mobileLayout);
      this.setOutput(true);
      this.setColour("#1686a6");
      this.setTooltip("Opera sobre una lista usando una lambda: contar, filtrar o reducir.");
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
          ["moneda", "currency"],
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

  Blockly.Blocks.aviator_null = {
    init() {
      this.appendDummyInput().appendField("nulo (nil)");
      this.setOutput(true);
      this.setColour("#1686a6");
      this.setTooltip("Valor nulo de AviatorScript.");
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
      this.appendValueInput("VALUE").setCheck("Number").appendField(new Blockly.FieldDropdown([["valor absoluto", "math.abs"], ["raiz cuadrada", "math.sqrt"], ["redondear", "math.round"], ["minimo", "math.min"], ["maximo", "math.max"]]), "FUNCTION");
      this.appendValueInput("SECOND_VALUE").setCheck("Number").appendField("y");
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
      this.appendDummyInput().appendField(new Blockly.FieldDropdown([["contiene", "string.contains"], ["empieza con", "string.starts_with"], ["termina con", "string.ends_with"], ["pertenece a", "seq.include"]]), "FUNCTION");
      this.appendValueInput("SEARCH");
      this.setInputsInline(!mobileLayout);
      this.setOutput(true, "Boolean");
      this.setColour("#1686a6");
      this.setTooltip("Comprueba si un texto contiene o coincide con otro texto.");
    }
  };
}

