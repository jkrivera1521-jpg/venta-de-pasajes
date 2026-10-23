# MFE AviatorScript Studio: guia funcional y tecnica

## Alcance

`apps/mfe-aviatorscript` es un microfrontend cargado por el Shell mediante iframe en `/rules/embedded`. Su manifest esta disponible en `/mfe/manifest` y el health check en `/api/health`. El MFE puede funcionar de forma independiente en el puerto `3006`.

La terminologia de producto y las etiquetas canonicas estan definidas en [`aviatorscript-product-glossary.md`](./aviatorscript-product-glossary.md). Ese documento debe consultarse antes de agregar nuevos estados, botones o mensajes.

El objetivo del modulo es que una persona pueda construir una formula AviatorScript con bloques, revisar el codigo generado, validarlo y probarlo contra el motor Java sin mantener una implementacion paralela de la semantica del backend.

## Arquitectura de representaciones

```text
Blockly workspace <-> AST tipado <-> fuente AviatorScript
                                      |
                                      +--> validacion Java
                                      +--> prueba Java
                                      +--> ejecucion de version activa
                                      +--> analisis estatico local/remoto
```

- La fuente AviatorScript es la representacion ejecutable y debe conservarse.
- El AST y el workspace son representaciones editables.
- El parser de importacion es seguro y no usa `eval` ni `Function`.
- El analisis de flujo no compila ni ejecuta la formula.
- El resultado que el usuario ve en `Probar fórmula` proviene de `aviatorscript-service`.

## Modos de una plantilla

### Editable visualmente

La formula fue convertida por completo al AST y a bloques. Se pueden editar bloques, codigo, variables de prueba y parametros; despues de validar con el motor real se puede guardar una nueva version.

### Solo código

La formula mantiene su fuente completa, pero existe una instruccion no representable por los bloques actuales. El MFE no hace una conversion parcial porque podria cambiar la regla. El usuario puede revisar, copiar, analizar y corregir el codigo; mientras permanezca en este modo, las acciones visuales de guardar, validar y probar quedan deshabilitadas.

### Solo lectura de plantilla

La formula original del catalogo nunca se edita desde el MFE. La seleccion del catalogo carga una copia de trabajo. `Nueva version` hace explicita esa copia y `Guardar version` es la operacion que la inserta como una fila nueva.

## Persistencia real

### Documento local

`Guardar` llama a `saveFormulaToBrowser` y `downloadFormula`:

- guarda hasta 25 documentos por nombre en `localStorage` bajo `aviatorscript-formulas-v1`;
- descarga un archivo con formato `aviatorscript-formula`, version `1`, nombre, AST, workspace y fecha;
- no escribe en PostgreSQL.

`Abrir` valida el formato y restaura el workspace. El archivo local es el unico mecanismo que conserva la serializacion Blockly.

### PostgreSQL

`Guardar version` usa el proxy Next `POST /api/v1/calculos/formulas`, que llama al servicio Java. El servicio:

1. valida el codigo, nombre, expresion y ejemplo;
2. calcula el siguiente numero de version para el codigo;
3. crea una fila `BORRADOR` con `activa = false`;
4. conserva `expresion` y `ejemplo` como contrato de catalogo;
5. registra `creadoPor`, usando `desconocido` si el actor no esta disponible.

La persistencia de base no guarda workspace Blockly ni AST. Esta separacion es intencional: la base sirve para ejecutar y versionar la fuente; el archivo local sirve para reabrir la edicion visual completa.

### Ciclo de vida

```text
BORRADOR --Publicar--> PUBLICADA --Activar--> ACTIVA
                              |
                              +--> las versiones anteriores permanecen historicas
```

Al activar una version publicada se desactivan las versiones activas anteriores del mismo codigo. Las versiones publicadas no se modifican: una correccion requiere otra fila y otro numero de version.

## Contratos HTTP

### Proxy del MFE

| Metodo | Ruta | Upstream | Uso |
| --- | --- | --- | --- |
| `GET` | `/api/v1/calculos/formulas` | `GET /api/v1/calculos/formulas` | Catalogo y cache offline. |
| `POST` | `/api/v1/calculos/formulas` | `POST /api/v1/calculos/formulas` | Crear version borrador. |
| `POST` | `/api/v1/calculos/formulas/:id/publicar` | Igual | Publicar. |
| `POST` | `/api/v1/calculos/formulas/:id/activar` | Igual | Activar. |
| `POST` | `/api/v1/calculos/validar` | `POST /api/v1/calculos/validar` | Compilar con Java. |
| `POST` | `/api/v1/calculos/probar` | `POST /api/v1/calculos/probar` | Ejecutar sin persistir. |
| `POST` | `/api/v1/aviator/visualize` | `POST /api/v1/aviator/visualize` | Obtener CFG estatico. |
| `GET` | `/api/v1/calculos/endpoint` | N/A | URL para cURL. |

Las rutas de proxy aplican `no-store`, limites de cuerpo y timeouts. Un error del catalogo diferencia servicio caido, catalogo vacio y catalogo cacheado offline.

### Guardar version

Request:

```json
{
  "codigo": "FORM-EJEMPLO-001",
  "nombre": "Formula de ejemplo",
  "descripcion": "Descripcion funcional",
  "expresion": "return salario + bonificacion;",
  "ejemplo": { "salario": 1200, "bonificacion": 150 },
  "creadoPor": "desconocido"
}
```

Response `201`: `FormulaTemplate` con `id`, `version`, `estado: "BORRADOR"`, `activa: false`, fechas y auditoria.

### Publicar y activar

Request opcional:

```json
{ "actor": "usuario-shell" }
```

- Publicar responde `200` y cambia `BORRADOR` a `PUBLICADA`.
- Activar responde `200` solo para una version `PUBLICADA`; desactiva la version activa anterior del mismo codigo.
- `404` indica que el id no existe y `400` indica una transicion invalida.

### Validar y probar

Validacion:

```json
{ "source": "return salario + bonificacion;" }
```

Prueba:

```json
{
  "source": "return salario + bonificacion;",
  "parametros": { "salario": 1200, "bonificacion": 150 }
}
```

La validacion devuelve `contractVersion`, `engine`, `valid` y diagnosticos con linea/columna. La prueba devuelve `contractVersion`, `engine`, `success`, `result`, `executionTimeMs` y `error` cuando corresponde.

## Catalogo y datos de prueba

Cada `FormulaTemplate` puede incluir:

```text
id, codigo, nombre, descripcion, version, expresion, ejemplo,
activa, fechaCreacion, estado, creadoPor, publicadoPor,
fechaPublicacion, activadoPor, fechaActivacion
```

`ejemplo` es el JSON base de la pestaña `Probar fórmula`. El MFE lo combina con los campos que detecta en la expresión y conserva los valores editados cuando las variables siguen presentes. El backend exige que el ejemplo sea un objeto JSON, con límite de 100.000 caracteres y profundidad máxima de 20.

## Componentes y dependencias

### React

| Componente | Responsabilidad |
| --- | --- |
| `VisualFormulaBuilder` | Coordinador de estado y ciclo de vida. |
| `FormulaToolbar` | Acciones y estados de trabajo. |
| `FormulaTemplateCatalog` | Catalogo, cache offline y ficha original. |
| `FormulaWorkspacePanel` | Constructor, flujo interactivo y Mermaid. |
| `FormulaScriptPanel` | Codigo, prueba JSON y cURL. |
| `CodeMirrorEditor` | Editor base CodeMirror 6. |
| `AviatorCodeEditor` | Editor AviatorScript con rangos y diagnosticos. |
| `JsonCodeEditor` | Editor JSON con lint y formateo. |
| `CurlCodeViewer` | Comando cURL y copia. |
| `FormulaTestValues` | Variables tipadas y ejemplo de prueba. |
| `AviatorVisualizationWorkspace` | Coordinacion del CFG y Mermaid. |
| `AviatorFlowViewer` | `@xyflow/react`, Dagre, zoom y exportacion. |
| `AviatorNodeInspector` | Inspector accesible de nodos y conexiones. |
| `MermaidDiagramViewer` | Mermaid, temas, colapsado y exportacion segura. |

### Hooks, dominio y rutas

- `usePanelResizers`: resize de paneles con puntero/teclado.
- `lib/formula.ts`, `formula-template.ts`, `payroll-formula.ts`: AST, parser seguro, plantillas y nomina.
- `lib/blockly-editor.ts`, `blockly-generic-blocks.ts`, `blockly-toolbox.ts`, `blockly-layout.ts`, `blockly-payroll.ts`, `blockly-serialization.ts`: Blockly y serializacion.
- `lib/aviator-contract.ts`: operadores, funciones y respuestas canonicas.
- `lib/api.ts`: cliente HTTP del MFE.
- `lib/formula-persistence.ts`: persistencia local y descarga.
- `lib/test-payload.ts`: JSON de prueba.
- `lib/visualization.ts`, `lib/mermaid.ts`, `lib/mermaid-sanitizer.ts`: CFG, Mermaid y seguridad SVG.
- `lib/rules.ts`: adaptacion temporal del contrato legacy.
- `app/api/v1/calculos/*`: proxies de catalogo, persistencia, ciclo de vida, validacion y prueba.
- `app/api/v1/aviator/visualize`: proxy server-side de visualizacion.
- `app/api/v1/rules/*`: endpoints legacy adaptados al motor Java.

Dependencias principales: Next.js, React, TanStack Query, Blockly, CodeMirror 6, `@xyflow/react`, `@dagrejs/dagre`, Mermaid, DOMPurify, `lucide-react`, Playwright y jsdom.

## Limitaciones operativas

- El servicio Java debe estar disponible para validar, probar, guardar versiones, publicar o activar.
- El MFE recibe la identidad del Shell para auditoria, pero la autenticacion/autorizacion efectiva del servicio debe configurarse en el despliegue.
- Las plantillas con funciones o sintaxis fuera del contrato visual pasan a `Solo código` y no deben ser convertidas manualmente a bloques sin una regla de equivalencia.
- El codigo Mermaid y el CFG no representan el resultado de ejecucion; solo explican la estructura estatica.
- El editor TypeScript no debe declararse equivalente al motor Java por el hecho de aceptar una sintaxis; la compatibilidad se establece mediante fixtures.

## Verificacion

```powershell
npm test -w @venta-pasajes/mfe-aviatorscript
npm run typecheck -w @venta-pasajes/mfe-aviatorscript
npm run build -w @venta-pasajes/mfe-aviatorscript
npm run test:e2e -w @venta-pasajes/mfe-aviatorscript
mvn -f .\services\aviatorscript-service\pom.xml test
```

Documentos relacionados:

- `docs/aviatorscript-contract.md`
- `docs/aviatorscript-compatibility.md`
- `docs/aviatorscript-compatibility-report.md`
- `docs/aviatorscript-mermaid-security.md`
- `docs/openapi/aviatorscript-service.openapi.yaml`
