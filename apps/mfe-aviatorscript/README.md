# MFE AviatorScript Studio

Micro-frontend para construir formulas de negocio con bloques visuales, ver el AviatorScript generado, validar tipos y probar la expresion con datos JSON.

## Desarrollo local

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
- La vista de AviatorScript es editable. Escribe cambios en el editor y pulsa `Aplicar al grafico`: el codigo se analiza sin ejecutar texto arbitrario, se convierte al AST soportado, se valida y se reconstruye el lienzo. Si la sintaxis no es representable, el lienzo anterior se conserva y se muestra un error recuperable. `Descartar cambios` restaura el codigo generado por los bloques.
- `Visualizar flujo` abre un analizador estatico de cualquier codigo compatible: el editor de fuente queda a la izquierda y el grafo de control interactivo a la derecha. El diagrama representa `if/elsif/else`, `for`, `while`, `continue`, `break`, `throw`, `return`, asignaciones y llamadas como `seq.list`, `seq.map` y `seq.add`. Selecciona un nodo para ver su codigo, rango de lineas, variables y conexiones; puedes cambiar la orientacion, contraer el contenido de decisiones/ciclos, expandir todo y exportar SVG, PNG o Mermaid. Editar la fuente actualiza el diagrama con debounce y nunca ejecuta el texto durante el analisis.
- `Validar` revisa conexiones, variables disponibles y compatibilidad de tipos.
- `Probar` ejecuta localmente el AST visual contra el JSON de contexto. El evaluador esta acotado a los bloques admitidos y no ejecuta texto arbitrario.
- La plantilla de nomina avanzada se carga como un programa completo de bloques genericos: validaciones, declaraciones, asignaciones, ramas `SI/ELSIF/ELSE`, ciclos `PARA CADA`, `CONTINUAR`, errores, colecciones y `DEVOLVER`. El lienzo representa la logica real y el codigo generado conserva el mismo orden y resultado del ejercicio. Las formulas antiguas que aun guarden un bloque compacto pueden usar `Descomponer` para convertirlo en piezas movibles sin cambiar el AST ni el AviatorScript.
- Los contenedores de control son jerarquicos: `SI`, `ELSIF`, `ELSE`, `PARA CADA` y `MIENTRAS` ajustan su ancho al contenido real de sus ramas y cadenas hijas, para que el bloque padre cubra visualmente todo lo que evalua. El ajuste se ejecuta despues del renderizado y se agrupa por frame para mantener fluido el lienzo incluso con programas grandes.
- `Guardar` almacena un borrador en el navegador y descarga un archivo `.aviatorscript.json`. `Abrir` restaura el workspace desde ese archivo. La exportacion tipada `onSave` puede conectarse a un flujo de persistencia externo.
- El selector de formulas consulta el catalogo de PostgreSQL y deja cargar una formula guardada como punto de partida de un borrador nuevo; al seleccionar una formula muestra su descripcion. El catalogo incluye versiones activas e inactivas y es de solo lectura; cambiar o guardar el borrador no modifica ni elimina la formula original. Las expresiones con funciones o sintaxis no disponibles en los bloques visuales muestran un aviso y no se cargan parcialmente.
- `Nueva` crea un programa AviatorScript generico desde cero con un bloque `DEVOLVER` conectado a `lista`, que genera `return seq.list();` y deja claro que la salida puede ser estructurada. La nomina avanzada se construye con los mismos componentes generales del lenguaje o se puede cargar como plantilla de solo lectura desde el catalogo; no existe un boton exclusivo de nomina.

### Operadores soportados

El editor expone los operadores usados por AviatorScript y los valida antes de ejecutar el sandbox:

- Matematicos: `+`, `-`, `*`, `/`, `%`, `**`.
- Comparacion: `==`, `!=`, `=~`, `>`, `>=`, `<`, `<=`.
- Logicos: `&&`, `||`.
- Bit a bit y desplazamiento: `&`, `|`, `^`, `<<`, `>>`, `>>>`.
- Unarios: `!`, `-`, `~`.

La expresion de cada bloque se genera en AviatorScript y el evaluador local usa el mismo AST tipado. El codigo editado sigue el flujo codigo -> parser seguro -> AST -> bloques -> evaluador; no se ejecuta texto arbitrario con `eval` ni `Function`.

Con los datos de ejemplo del ejercicio de nomina, el sandbox devuelve `salarioBase: 1560`, `totalHorasExtras: 138.75`, `salarioNeto: 1912.946` y `clasificacion: "NOMINA_MEDIA"`.

### Validaciones de nomina avanzada

El bloque rojo `VALIDAR DATOS DE ENTRADA` contiene cuatro reglas editables: salario mensual, dias del mes, dias trabajados y calificacion de desempeno. Cada una permite cambiar comparadores, limites y mensaje de error. Los rangos incluyen un selector `O / Y`; el segundo limite de dias trabajados permite elegir la variable `diasMes` o un valor numerico.

Para rechazar `diasMes <= 1`, ubica `2. Dias del mes`, deja `menor o igual que`, cambia `0` por `1` y edita el mensaje debajo de `LANZAR ERROR`. El AviatorScript y el sandbox local usan estos mismos valores. En `Probar regla`, prueba un JSON con `diasMes: 1` para verificar el error y otro con `diasMes: 2` y `diasTrabajados: 1` para continuar el calculo.

La configuracion se conserva en el AST y el workspace del borrador. Las formulas originales de la base de datos no se alteran. Los borradores antiguos conservan su validacion de salario y reciben las otras validaciones iniciales. Al importar una plantilla, las validaciones no compatibles se rechazan sin sustituirlas por otras.

Pruebas de regresion (Node 24, sin base de datos):

```powershell
npm test -w @venta-pasajes/mfe-aviatorscript
```

## Integracion

El shell descubre este MFE mediante el manifest `/mfe/manifest`, la entrada `/rules/embedded` y el health check `/api/health`. El puerto local es `3006`.

El catalogo de contexto se obtiene con `GET /api/v1/rules/schema`; si no se configura una API se usa el mock local. Define `NEXT_PUBLIC_RULES_API_BASE_URL` para cambiar la base de esa API.

El servicio Java ejecuta formulas previamente registradas con `POST /api/v1/calculos/ejecutar`, ofrece `GET /api/v1/calculos/formulas` como catalogo de solo lectura y analiza codigo con `POST /api/v1/aviator/visualize`. Configura `AVIATORSCRIPT_SERVICE_URL` en el servidor Next.js si el servicio no esta en `http://localhost:8087`. El endpoint de visualizacion solo hace analisis estatico con lexer/parser y devuelve nodos, conexiones, diagnosticos y mapeo a lineas; no compila ni ejecuta el codigo. La validacion y el sandbox del constructor siguen siendo locales; no enviar la expresion generada al servicio como si estuviera persistida o compilada.

La integracion remota vigente del shell es manifest + iframe. El componente tambien se exporta desde `components/index.ts` para una futura integracion directa; Module Federation y Single-SPA no estan configurados.

## Estructura

- `components/VisualFormulaBuilder.tsx`: workspace, controles, guardado local y sandbox.
- `components/AviatorVisualizationWorkspace.tsx`: vista de codigo editable y grafo CFG interactivo.
- `components/AviatorFlowViewer.tsx`: layout, zoom, seleccion y exportaciones del grafo.
- `lib/blockly-editor.ts`: bloques, toolbox, adaptador workspace-AST.
- `lib/visualization.ts`: tipos y analisis local de control de flujo.
- `lib/formula.ts`: tipos AST, generador AviatorScript, validacion y evaluador local seguro.
- `lib/api.ts`: acceso al esquema de contexto.
- `app/api/v1/aviator/visualize/route.ts`: proxy server-side con limite de entrada y timeout hacia el servicio Java.
- `app/api/v1/rules/schema/route.ts`: esquema mock local.
