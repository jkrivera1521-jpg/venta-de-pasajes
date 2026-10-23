# MFE AviatorScript Studio

Micro-frontend para construir, editar, validar, probar y versionar formulas de negocio AviatorScript. El flujo principal usa Blockly; el editor de codigo usa CodeMirror 6 y las validaciones y pruebas del usuario se ejecutan contra AviatorScript Java en `aviatorscript-service`.

La fuente AviatorScript (`expresion`) es el contrato ejecutable. El AST tipado y el workspace Blockly son representaciones de edicion y solo se actualizan cuando pueden reconstruir el mismo codigo sin perder semantica. El evaluador TypeScript local se conserva para validaciones estructurales y compatibilidad, pero no sustituye el motor Java ni se presenta como resultado definitivo.

La terminologia visible sigue el [glosario de producto](../../docs/aviatorscript-product-glossary.md): `formula` es la unidad de negocio, `expresion` es la fuente ejecutable, `plantilla` es una copia de referencia y `regla` queda reservado para el contrato legacy.

## Desarrollo local

### Autenticacion del catalogo y del motor

Cuando el MFE se carga desde `frontend-shell`, recibe el JWT de la sesion mediante el canal autenticado entre el Shell y el iframe. El MFE lo envia por sus proxies Next y el servicio Java aplica los permisos del token; no se utiliza el nombre visible del usuario como mecanismo de autorizacion. El acceso directo sin token conserva el editor local, pero no puede consultar plantillas ni validar, probar, guardar, publicar, activar o visualizar contra el servicio.

Los permisos disponibles son `aviatorscript.formulas.read`, `aviatorscript.formulas.write`, `aviatorscript.formulas.validate`, `aviatorscript.formulas.test`, `aviatorscript.formulas.execute`, `aviatorscript.formulas.publish`, `aviatorscript.formulas.activate` y `aviatorscript.formulas.visualize`. La auditoria de creador/publicador/activador se obtiene server-side desde el claim `login`.

Desde `C:\VENTA-DE-PASAJES`:

```powershell
npm run dev:mfe-aviatorscript
```

Abre `http://localhost:3006/rules/embedded`.

El editor se adapta a escritorio y movil. En escritorio, el lienzo y la expresion generada se muestran lado a lado. En movil, las categorias del toolbox se ubican arriba, las entradas de bloques se apilan y se alterna entre el lienzo y la vista de AviatorScript.

Las condiciones se muestran con el nivel de detalle que necesitan: un `SI` sin ramas alternativas usa un bloque compacto con `CONDICION` y `ENTONCES`, mientras que el bloque avanzado reserva los conectores `ELSIF` y `ELSE` para programas que realmente los contienen.

## Uso

- Arrastra bloques desde las categorias `Programa`, `Variables JVM`, `Valores`, `Matematicas`, `Comparacion`, `Logica`, `Texto`, `Colecciones y objetos`, `Funciones`, `Control` y `Errores y salida`.
- En `Variables JVM`, arrastra `dato JVM`, escribe el nombre de la variable y elige su tipo. Las variables se crean a medida que las necesita la formula; las variables entregadas por el esquema aparecen agrupadas como sugerencias y no son obligatorias.
- El bloque fijo `programa AviatorScript` es la raiz de una formula completa. Conecta declaraciones `let`, asignaciones, secciones, condiciones `SI/ELSIF/ELSE`, ciclos `PARA CADA` o `MIENTRAS`, `CONTINUAR`, `SALIR DEL CICLO`, `LANZAR ERROR` y `DEVOLVER`.
- Las expresiones se construyen con variables JVM, variables locales escritas en el bloque, literales, operadores, acceso a propiedades (`item.horas`), listas y objetos. Al agregar o conectar un bloque, el programa completo se refleja inmediatamente en AviatorScript.
- La vista de AviatorScript es editable con CodeMirror 6. Incluye numeración, resaltado, autocompletado, cierre de corchetes, formateo, diagnóstico por línea y selección de rangos. Pulsa `Aplicar al gráfico` para convertir el código mediante el parser seguro. Si la sintaxis no es representable, el lienzo anterior se conserva y la fórmula pasa a `Solo código`: la fuente completa queda visible y editable, pero `Guardar`, `Validar`, `Probar fórmula` y `Guardar versión` permanecen bloqueados hasta lograr una conversión visual válida. `Descartar cambios` restaura el código generado por los bloques.
- `Visualizar flujo` abre un analizador estatico de cualquier codigo compatible: el editor de fuente queda a la izquierda y el grafo de control interactivo a la derecha. El diagrama representa `if/elsif/else`, `for`, `while`, `continue`, `break`, `throw`, `return`, asignaciones y llamadas como `seq.list`, `seq.map` y `seq.add`. Selecciona un nodo para ver su codigo, rango de lineas, variables y conexiones; puedes cambiar la orientacion, contraer el contenido de decisiones/ciclos, expandir todo y abrir `Exportar`. La exportacion permite generar el flujo completo, dividirlo por paginas para diagramas altos, exportar solo el nodo seleccionado, ajustar el ancho base y elegir resolucion estandar, alta o maxima para SVG y PNG. Editar la fuente actualiza el diagrama con debounce y nunca ejecuta el texto durante el analisis.
- `Validar` revisa primero conexiones, variables disponibles y compatibilidad de tipos, y despues compila el AviatorScript con el mismo motor Java que ejecuta las formulas persistidas.
- `Probar fórmula` envía siempre el mismo AviatorScript y el JSON de contexto al motor real mediante `POST /api/v1/calculos/probar`, sin persistir la fórmula. El evaluador local del AST se conserva para pruebas unitarias y compatibilidad interna, pero no participa en las pruebas del usuario ni funciona como fallback.
- La plantilla de nomina avanzada se carga como un programa completo de bloques genericos: validaciones, declaraciones, asignaciones, ramas `SI/ELSIF/ELSE`, ciclos `PARA CADA`, `CONTINUAR`, errores, colecciones y `DEVOLVER`. El lienzo representa la logica real y el codigo generado conserva el mismo orden y resultado del ejercicio. Las formulas antiguas que aun guarden un bloque compacto pueden usar `Descomponer` para convertirlo en piezas movibles sin cambiar el AST ni el AviatorScript.
- Los contenedores de control son jerarquicos: `SI`, `ELSIF`, `ELSE`, `PARA CADA` y `MIENTRAS` ajustan su ancho al contenido real de sus ramas y cadenas hijas, para que el bloque padre cubra visualmente todo lo que evalua. El ajuste se ejecuta despues del renderizado y se agrupa por frame para mantener fluido el lienzo incluso con programas grandes.
- `Guardar` conserva hasta 25 borradores en `localStorage` y descarga un archivo `.aviatorscript.json` con nombre, AST, workspace y fecha. `Abrir` restaura ese documento local; no escribe en PostgreSQL.
- `Guardar version` persiste realmente una nueva fila `BORRADOR` en PostgreSQL mediante el servicio Java. Requiere formula visual valida, compilacion valida y ejemplo JSON valido. `Publicar` cambia `BORRADOR` a `PUBLICADA`; `Activar` desactiva la version activa anterior del mismo codigo y activa la version publicada. `Nueva version` solo crea una copia editable y nunca modifica la plantilla original.
- El selector de fórmulas consulta el catálogo de PostgreSQL y deja cargar una fórmula guardada como punto de partida de un borrador nuevo; al seleccionar una fórmula muestra su descripción, versión, estado, creador y ejemplo. El catálogo incluye versiones activas e inactivas y la fórmula original es de solo lectura. Las expresiones compatibles muestran `Editable visualmente`; las que contienen funciones o sintaxis no disponibles en los bloques muestran `Solo código` y conservan la fuente completa.
- `Nueva` crea un programa AviatorScript generico desde cero con un bloque `DEVOLVER` conectado a `lista`, que genera `return seq.list();` y deja claro que la salida puede ser estructurada. La nomina avanzada se construye con los mismos componentes generales del lenguaje o se puede cargar como plantilla del catalogo; no existe un boton exclusivo de nomina.

### Operadores soportados

El editor expone los operadores usados por AviatorScript y los valida antes de enviarlos al motor real:

- Matematicos: `+`, `-`, `*`, `/`, `%`, `**`.
- Comparacion: `==`, `!=`, `=~`, `>`, `>=`, `<`, `<=`.
- Logicos: `&&`, `||`.
- Bit a bit y desplazamiento: `&`, `|`, `^`, `<<`, `>>`, `>>>`.
- Unarios: `!`, `-`, `~`.

La expresion de cada bloque se genera en AviatorScript y el editor conserva un AST tipado para representar la formula. El codigo editado sigue el flujo codigo -> parser seguro -> AST -> bloques, mientras que las pruebas del usuario siguen codigo -> validacion del motor -> ejecucion del motor; no se ejecuta texto arbitrario con `eval` ni `Function`.

Con los datos de ejemplo del ejercicio de nomina, el motor real devuelve `salarioBase: 1560`, `totalHorasExtras: 138.75`, `salarioNeto: 1912.946` y `clasificacion: "NOMINA_MEDIA"`.

### Validaciones de nomina avanzada

El bloque rojo `VALIDAR DATOS DE ENTRADA` contiene cuatro reglas editables: salario mensual, dias del mes, dias trabajados y calificacion de desempeno. Cada una permite cambiar comparadores, limites y mensaje de error. Los rangos incluyen un selector `O / Y`; el segundo limite de dias trabajados permite elegir la variable `diasMes` o un valor numerico.

Para rechazar `diasMes <= 1`, ubica `2. Días del mes`, deja `menor o igual que`, cambia `0` por `1` y edita el mensaje debajo de `LANZAR ERROR`. El AviatorScript y el motor real usan estos mismos valores. En `Probar fórmula`, prueba un JSON con `diasMes: 1` para verificar el error y otro con `diasMes: 2` y `diasTrabajados: 1` para continuar el cálculo.

La configuracion se conserva en el AST y el workspace del borrador. Las formulas originales de la base de datos no se alteran. Los borradores antiguos conservan su validacion de salario y reciben las otras validaciones iniciales. Al importar una plantilla, las validaciones no compatibles se rechazan sin sustituirlas por otras.

Pruebas de regresion (Node 24, sin base de datos):

```powershell
npm test -w @venta-pasajes/mfe-aviatorscript
```

## Integracion

El shell descubre este MFE mediante el manifest `/mfe/manifest`, la entrada `/rules/embedded` y el health check `/api/health`. El puerto local es `3006`.

El catalogo de contexto se obtiene con `GET /api/v1/rules/schema`; si no se configura una API se usa el mock local. Define `NEXT_PUBLIC_RULES_API_BASE_URL` para cambiar la base de esa API.

El servicio Java ejecuta formulas previamente registradas con `POST /api/v1/calculos/ejecutar`, guarda versiones con `POST /api/v1/calculos/formulas`, publica y activa con `POST /api/v1/calculos/formulas/{id}/publicar` y `/activar`, valida codigo con `POST /api/v1/calculos/validar`, prueba codigo sin persistir con `POST /api/v1/calculos/probar`, ofrece `GET /api/v1/calculos/formulas` como catalogo y analiza codigo con `POST /api/v1/aviator/visualize`. Configura `AVIATORSCRIPT_SERVICE_URL` en el servidor Next.js si el servicio no esta en `http://localhost:8087`. El endpoint de visualizacion hace analisis estatico con lexer/parser y devuelve nodos, conexiones, diagnosticos y mapeo a lineas; no compila ni ejecuta el codigo. El contrato completo y el plan de migracion estan en `docs/aviatorscript-contract.md`.

El request de persistencia contiene `codigo`, `nombre`, `descripcion`, `expresion`, `ejemplo` y `creadoPor`. El servicio calcula la siguiente version, crea el estado `BORRADOR` y conserva la expresion y el ejemplo. No persiste el workspace Blockly ni el AST de edicion; para conservarlos se usa el archivo `.aviatorscript.json`. El creador llega desde el Shell y usa `desconocido` cuando el MFE se abre sin usuario.

Las rutas Next del MFE actuan como proxy server-side, aplican limites y `no-store`, y diferencian catalogo vacio, servicio caido y catalogo offline. El contrato OpenAPI completo esta en `docs/openapi/aviatorscript-service.openapi.yaml` y la guia funcional detallada en `docs/aviatorscript-mfe.md`.

El manifest `/mfe/manifest` identifica este módulo como `Constructor visual de fórmulas AviatorScript` y declara sus capacidades de construcción visual, editor de código, validación/prueba contra el motor real, catálogo y versionado de fórmulas, visualización Mermaid, exportación de diagramas y generación de cURL. Las capacidades anteriores se conservan en la lista para mantener compatibilidad con consumidores existentes.

La integracion remota vigente del shell es manifest + iframe. El componente tambien se exporta desde `components/index.ts` para una futura integracion directa; Module Federation y Single-SPA no estan configurados.

Las pruebas de compatibilidad entre el evaluador local TypeScript y AviatorScript Java usan fixtures compartidos, comparacion numerica exacta y reportes de diferencias. La referencia siempre es el motor Java; una funcion que el MFE no soporte se marca como unsupported y debe probarse mediante el backend. Consulta docs/aviatorscript-compatibility.md.

## Seguridad del visualizador Mermaid

El SVG generado por Mermaid se conserva con `securityLevel: "strict"`, se sanitiza con DOMPurify antes de renderizarlo y el mismo resultado sanitizado se utiliza para las exportaciones SVG y PNG. La allowlist y las pruebas de seguridad, junto con la recomendacion CSP para el shell o proxy, estan documentadas en `docs/aviatorscript-mermaid-security.md`.

## Componentes y dependencias

### Componentes React

- `components/VisualFormulaBuilder.tsx`: coordinacion de estado, Blockly, AST, codigo, catalogo, pruebas y ciclo de vida.
- `components/FormulaToolbar.tsx`: acciones `Nueva`, `Abrir`, `Guardar`, `Guardar version`, `Publicar`, `Activar`, `Validar` y `Probar`.
- `components/FormulaTemplateCatalog.tsx`: catalogo remoto/offline, estados de error, plantillas y ficha original de solo lectura.
- `components/FormulaWorkspacePanel.tsx`: pestañas `Constructor`, `Presentacion interactiva` y `Vista Mermaid`.
- `components/FormulaScriptPanel.tsx`: pestañas `AviatorScript`, `Probar fórmula` y `cURL`, observaciones, datos de prueba y resultados.
- `components/CodeMirrorEditor.tsx`: editor base CodeMirror 6 para AviatorScript, JSON y Mermaid.
- `components/AviatorCodeEditor.tsx`: editor AviatorScript con rangos de fuente y diagnosticos.
- `components/JsonCodeEditor.tsx`: editor JSON con lint, formateo y copia.
- `components/CurlCodeViewer.tsx`: visualizacion y copia del comando cURL.
- `components/FormulaTestValues.tsx`: controles tipados y JSON de variables usadas por la formula.
- `components/AviatorVisualizationWorkspace.tsx`: coordinacion del grafo, inspector y Mermaid.
- `components/AviatorFlowViewer.tsx`: `@xyflow/react`, Dagre, zoom, minimapa y exportacion.
- `components/AviatorNodeInspector.tsx`: inspector accesible de nodos, variables, codigo y conexiones.
- `components/MermaidDiagramViewer.tsx`: renderizado Mermaid, temas, colapsado, zoom y exportaciones seguras.

### Hooks, librerias y rutas

- `hooks/usePanelResizers.ts`: separadores de ancho/alto con puntero y teclado.
- `lib/formula.ts`, `formula-template.ts`, `payroll-formula.ts`: AST, parser seguro, plantillas y nomina avanzada.
- `lib/blockly-editor.ts`, `blockly-generic-blocks.ts`, `blockly-toolbox.ts`, `blockly-layout.ts`, `blockly-payroll.ts`, `blockly-serialization.ts`: bloques, toolbox, layout y serializacion.
- `lib/aviator-contract.ts`: operadores, funciones, esquema y respuestas canonicas.
- `lib/api.ts`: cliente HTTP de esquema, catalogo, persistencia, ciclo de vida, validacion, prueba y visualizacion.
- `lib/formula-persistence.ts`: `localStorage`, cache offline y descarga `.aviatorscript.json`.
- `lib/test-payload.ts`: construccion, lectura y actualizacion del JSON de prueba.
- `lib/visualization.ts`, `lib/mermaid.ts`, `lib/mermaid-sanitizer.ts`: CFG, generacion Mermaid y seguridad SVG.
- `lib/rules.ts`: adaptacion temporal de los endpoints legacy.
- `app/api/v1/calculos/*`: proxies de catalogo, persistencia, ciclo de vida, validacion y prueba.
- `app/api/v1/aviator/visualize/route.ts`: proxy server-side de analisis estatico.
- `app/api/v1/rules/*`: compatibilidad con `RuleDocument` legacy usando el motor Java.

Dependencias principales: Next.js, React, TanStack Query, Blockly, CodeMirror 6 (`codemirror` y `@codemirror/*`), `@xyflow/react`, `@dagrejs/dagre`, Mermaid, DOMPurify, `lucide-react`, Playwright y jsdom.

Consulta [`docs/aviatorscript-mfe.md`](../../docs/aviatorscript-mfe.md) para el inventario completo, payloads, estados y limites, y [`docs/aviatorscript-product-glossary.md`](../../docs/aviatorscript-product-glossary.md) para las etiquetas y estados canonicos.
