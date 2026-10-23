# Glosario de producto: AviatorScript Studio

Este glosario define el lenguaje visible del MFE. Las etiquetas de la interfaz, mensajes, tooltips y documentación deben usar estos términos. Los nombres de campos JSON y rutas HTTP mantienen su forma técnica aunque no lleven acentos.

## Términos principales

| Término canónico | Definición de producto | Uso recomendado |
| --- | --- | --- |
| **Fórmula** | Regla de negocio completa identificada por código y versión. Es el objeto que se construye, valida, prueba y publica. | Usar `fórmula` en la interfaz y en la documentación funcional. |
| **Regla** | Nombre histórico del contrato `RuleDocument` y de los endpoints legacy `/api/v1/rules/*`. | Reservar para compatibilidad técnica; no usar como nombre principal del MFE. |
| **Expresión** | Fuente AviatorScript que representa la fórmula y que se almacena en la columna `expresion`. | Usar al hablar del contenido ejecutable guardado. |
| **Código AviatorScript** | La misma fuente cuando se edita, copia, valida o visualiza como texto. | Usar en editores, diagnósticos, cURL y Mermaid. |
| **AST** | Representación estructurada intermedia de la fórmula. | Usar solo en explicaciones técnicas; no presentarlo como una fórmula distinta. |
| **Workspace** | Estado serializable del lienzo Blockly, incluidos bloques, conexiones y posiciones. | Usar al hablar de archivos locales `.aviatorscript.json`. |
| **Plantilla** | Fórmula existente del catálogo que sirve como punto de partida. | Aclarar siempre que la plantilla original es de solo lectura. |
| **Versión** | Registro inmutable de una fórmula en la base de datos, identificado por `codigo` y número de versión. | Usar `v1`, `v2`, etc. en el catálogo y ciclo de vida. |
| **Ejemplo de prueba** | Objeto JSON recomendado para probar una fórmula. Se almacena en `ejemplo`. | No llamarlo sandbox ni resultado esperado. |
| **Parámetros** | Datos JSON enviados al motor para una prueba o ejecución. | Usar en API y en mensajes técnicos; en la UI puede decirse `Datos de prueba`. |
| **Variable de contexto** | Valor externo disponible para la fórmula durante la ejecución. | Usar en el esquema y en `Variables para probar`. |
| **Observación** | Diagnóstico que explica un error o advertencia de estructura, tipos o compilación. | Mostrar antes de permitir validar, probar o persistir. |

## Estados de la fórmula

No se deben mezclar los estados de persistencia con los estados de representación visual.

### Ciclo de vida persistido

| Estado visible | Valor técnico | Significado |
| --- | --- | --- |
| **Borrador** | `BORRADOR` | Versión guardada en PostgreSQL que aún no ha sido publicada. |
| **Publicada** | `PUBLICADA` | Versión aprobada e inmutable, pero que puede no ser la que se ejecuta. |
| **Activa** | `PUBLICADA` + `activa = true` | Versión publicada seleccionada para ejecutar por `codigoFormula`. |

`Activa` no es un valor adicional de la columna `estado`; es una condición de la versión publicada. Solo puede existir una versión activa por código.

### Estados de trabajo del editor

| Estado visible | Alcance | Significado |
| --- | --- | --- |
| **Borrador local** | Navegador | Cambios aún no guardados en PostgreSQL. Puede existir en memoria, `localStorage` o un archivo descargado. |
| **Validada** | Editor | La fórmula pasó las validaciones locales y compiló con AviatorScript Java. Todavía no implica persistencia. |
| **Versión guardada** | Editor | La fórmula ya tiene una fila persistida; puede publicarse si está en `BORRADOR`. |

Una fórmula puede estar `Validada` sin ser una `Versión guardada`. `Guardar` y `Guardar versión` son acciones diferentes.

## Estados de representación

| Etiqueta | Significado | Acciones |
| --- | --- | --- |
| **Editable visualmente** | Toda la fuente pudo convertirse a AST y bloques sin pérdida conocida de semántica. | Permite editar bloques, validar, probar y guardar una versión. |
| **Solo código** | La fuente es válida o legible, pero contiene elementos que los bloques actuales no representan completamente. | Permite revisar, editar, copiar y visualizar; bloquea las acciones visuales que podrían persistir o ejecutar una conversión incompleta. |
| **Solo lectura** | La fórmula pertenece al catálogo original y no es la copia de trabajo. | Permite consultar y copiar; usar `Nueva versión` para editar. |

## Acciones de producto

| Acción | Definición visible |
| --- | --- |
| **Nueva** | Crea una fórmula nueva desde cero en el editor. |
| **Abrir** | Restaura una fórmula desde un archivo `.aviatorscript.json`. |
| **Guardar** | Conserva un borrador en el navegador y descarga el archivo local. No escribe en PostgreSQL. |
| **Guardar versión** | Crea una nueva versión `BORRADOR` en PostgreSQL. |
| **Validar** | Revisa estructura, tipos y compilación con AviatorScript Java. No persiste. |
| **Probar fórmula** | Ejecuta la expresión actual con los datos de prueba en el motor real. No persiste una fórmula ni una ejecución. |
| **Publicar** | Cambia una versión persistida de `BORRADOR` a `PUBLICADA`. |
| **Activar** | Selecciona una versión `PUBLICADA` para las ejecuciones y desactiva la anterior. |
| **Nueva versión** | Crea una copia editable de una plantilla o versión sin cambiar el original. |
| **Presentación interactiva** | Grafo estático navegable del flujo de control AviatorScript. No ejecuta la fórmula. |
| **Vista Mermaid** | Código Mermaid y diagrama estático generado desde el flujo. No ejecuta la fórmula. |

## Reglas de escritura

- Usar siempre `fórmula`, `expresión`, `código`, `versión`, `descripción`, `validación`, `publicación`, `activación`, `catálogo`, `parámetros`, `ejecución`, `línea`, `número` y `pestaña` en textos visibles.
- Usar **Probar fórmula**, no `Probar regla` ni `Probar sandbox`.
- Usar **Código AviatorScript** para el editor y **Expresión guardada** para la fuente persistida en la ficha de una versión.
- Usar **Plantilla original · solo lectura** para el registro seleccionado del catálogo.
- Usar **Editable visualmente** y **Solo código** como estados de representación exactos.
- Usar **Borrador**, **Publicada** y **Activa** como estados de producto; conservar `BORRADOR`, `PUBLICADA` y `activa` solo en API, base de datos, logs o documentación técnica.
- Mantener sin traducir los identificadores técnicos: `codigo`, `expresion`, `ejemplo`, `creadoPor`, `RuleDocument`, `AviatorScript`, `Blockly`, `Mermaid` y las rutas HTTP.
- En mensajes dirigidos a personas, preferir “motor AviatorScript” o “motor real” frente a “sandbox”.

## Mapa de equivalencias técnicas

| UI | API o persistencia |
| --- | --- |
| Código BD | `codigo` |
| Código AviatorScript | `expresion` |
| Datos de prueba / Ejemplo de prueba | `ejemplo` o `parametros` |
| Creado por | `creadoPor` |
| Publicada por | `publicadoPor` |
| Activada por | `activadoPor` |
| Borrador | `estado = BORRADOR` |
| Publicada | `estado = PUBLICADA` |
| Activa | `activa = true` |

Este glosario es la referencia de producto para nuevas pantallas, tooltips, mensajes de validación, pruebas de navegador y documentación del MFE.
