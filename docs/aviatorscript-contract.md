# Contrato canónico de AviatorScript

## Decisión principal

El texto `expresion` es el contrato ejecutable y preserva el código fuente de cada fórmula. El workspace Blockly y el AST de `apps/mfe-aviatorscript/lib/formula.ts` son representaciones de edición: pueden transformar la fórmula solo cuando pueden reconstruir el mismo AviatorScript y su semántica.

La ejecución, la validación de compilación y las pruebas remotas usan `AviatorScriptEngine`, que delega en AviatorScript 5.8.0. El evaluador local del AST permanece temporalmente para pruebas unitarias, compatibilidad y análisis previo; no decide si una fórmula puede guardarse ni sustituye al motor Java.

## Contratos vigentes

| Superficie | Contrato | Responsabilidad |
| --- | --- | --- |
| `lib/aviator-contract.ts` | Operadores, funciones, versión 1 y esquema de sugerencias | Referencia tipada del editor |
| `lib/formula.ts` | AST, Blockly -> AST y AST -> AviatorScript | Representación editable sin ejecutar texto arbitrario |
| `POST /api/v1/calculos/validar` | `{ source }` -> `valid`, `diagnostics`, `engine`, `contractVersion` | Compilar con el motor real |
| `POST /api/v1/calculos/probar` | `{ source, parametros }` -> `result`, `success`, `error` | Ejecutar sin persistir |
| `POST /api/v1/calculos/ejecutar` | `{ idSolicitud, codigoFormula, parametros }` | Ejecutar una versión activa y registrar la ejecución |
| `GET /api/v1/rules/schema` | `SchemaField[]` | Adaptador de sugerencias del editor |
| `POST /api/v1/rules/validate` | `RuleDocument` legacy -> `ValidationIssue[]` | Adaptador: valida estructura y delega compilación al motor |
| `POST /api/v1/rules/test` | `RuleDocument` legacy + `testData` | Adaptador: convierte a AviatorScript y delega la prueba |

Los tres endpoints `/api/v1/rules/*` se conservan para consumidores existentes. `lib/rules.ts` sigue exportando el árbol `RuleDocument`, sus operadores de UI y sus funciones de normalización, pero ya no contiene un esquema distinto ni es el evaluador de la ejecución principal.

## Persistencia real del MFE

El MFE tiene dos mecanismos que no deben confundirse:

| Accion | Destino | Datos conservados |
| --- | --- | --- |
| `Guardar` | `localStorage` y descarga | Nombre, AST, workspace Blockly, expresion y fecha en `.aviatorscript.json`. |
| `Guardar version` | PostgreSQL mediante `aviatorscript-service` | Codigo, nombre, descripcion, version, expresion, ejemplo JSON y auditoria de ciclo de vida. |

La base de datos no persiste el workspace Blockly ni el AST de edición. El campo `expresion` es la fuente que se ejecuta y el campo `ejemplo` alimenta los datos iniciales de `Probar fórmula`.

`POST /api/v1/calculos/formulas` crea siempre una version nueva en `BORRADOR` y calcula el siguiente numero para el codigo. `POST /api/v1/calculos/formulas/{id}/publicar` cambia el estado a `PUBLICADA`. `POST /api/v1/calculos/formulas/{id}/activar` solo acepta una version publicada, desactiva la version activa anterior del mismo codigo y activa la nueva. Las versiones publicadas no se editan destructivamente.

La identidad visible en el Shell se utiliza para presentar el usuario, pero la auditoria no confia en datos enviados por el navegador. El servicio deriva el actor desde el JWT autenticado.

Todas las rutas del motor requieren `Authorization: Bearer <jwt>`. El servicio verifica el mismo JWT HS256 emitido por `identity-service` y toma el actor desde el claim `login`; los campos `creadoPor` y `actor` enviados por el cliente se ignoran para auditoria. Los permisos son independientes: `aviatorscript.formulas.read`, `.write`, `.validate`, `.test`, `.execute`, `.publish`, `.activate` y `.visualize`. La migracion `V16__aviatorscript_permissions.sql` registra estos permisos y los asigna inicialmente a `ADMIN`; otros roles deben recibir solo los permisos que necesiten desde `identity-service`.

## Plantillas y representabilidad

El catalogo devuelve todas las versiones, activas e inactivas. Seleccionar una plantilla crea una copia de trabajo y no modifica la fila original. `Nueva version` solo prepara esa copia en memoria; `Guardar version` es la operacion que crea la fila en PostgreSQL.

El MFE muestra `Editable visualmente` cuando puede convertir toda la expresión a AST y bloques. Si encuentra sintaxis, funciones o estructuras que no puede representar sin pérdida semántica, conserva la fuente completa en modo `Solo código`, no carga bloques parciales y bloquea las acciones visuales de validar, probar y persistir hasta que el código pueda convertirse. La ficha de la plantilla original es siempre `solo lectura`.

El ejemplo de una plantilla debe ser un objeto JSON. El servicio aplica limites de 100.000 caracteres para la expresion y el ejemplo, y de 20 niveles de profundidad para el ejemplo. Las formulas historicas pueden tener descripcion, ejemplo o auditoria nulos; el catalogo mantiene compatibilidad y el MFE muestra valores de respaldo.

## Proxies y contrato HTTP del MFE

El navegador llama las rutas Next del MFE, que reenvian al servicio usando `AVIATORSCRIPT_SERVICE_URL`:

| Ruta del MFE | Upstream | Uso |
| --- | --- | --- |
| `GET /api/v1/calculos/formulas` | `GET /api/v1/calculos/formulas` | Catalogo, cache local y modo offline. |
| `POST /api/v1/calculos/formulas` | `POST /api/v1/calculos/formulas` | Nueva version `BORRADOR`. |
| `POST /api/v1/calculos/formulas/{id}/publicar` | Igual | Publicacion. |
| `POST /api/v1/calculos/formulas/{id}/activar` | Igual | Activacion. |
| `POST /api/v1/calculos/validar` | `POST /api/v1/calculos/validar` | Compilacion con AviatorScript Java. |
| `POST /api/v1/calculos/probar` | `POST /api/v1/calculos/probar` | Ejecucion temporal sin persistir. |
| `POST /api/v1/aviator/visualize` | `POST /api/v1/aviator/visualize` | Analisis estatico del flujo. |

Los endpoints del motor estan descritos en `docs/openapi/aviatorscript-service.openapi.yaml`. El proxy valida forma y tamaño de entrada, usa `no-store` y devuelve errores distinguibles para servicio no disponible, payload invalido y respuestas upstream no validas.

## Sintaxis y funciones canónicas

Se conservan los operadores que ya exponen el constructor: `+`, `-`, `*`, `/`, `%`, `**`, comparaciones, `&&`, `||`, operaciones bit a bit y los unarios `!`, `-`, `~`. Las estructuras de programa son `let`, asignación, `if/elsif/else`, `for item in lista`, `while`, `continue`, `break`, `throw` y `return`.

Las funciones de alto nivel del editor son:

- Matemáticas: `math.abs`, `math.sqrt`, `math.round`, `math.pow`, `math.min`, `math.max`.
- Texto: `string.contains`, `string.starts_with`, `string.ends_with`.
- Colecciones: `seq.list`, `seq.map`, `seq.add`, `seq.include`, `seq.count`, `seq.filter`, `seq.reduce`.

Algunas funciones tienen nombres distintos dentro del registro de Aviator. El motor instala únicamente adaptadores de nombre: `seq.filter -> filter`, `seq.reduce -> reduce`, `seq.count -> count`, `seq.include -> include`, `math.min -> min`, `math.max -> max`, `string.starts_with -> string.startsWith` y `string.ends_with -> string.endsWith`. `seq.map` se deja intacta porque ya es una función nativa de Aviator; no se reemplaza por `map`.

El contexto es un mapa dinámico (`parametros`). El esquema del MFE solo ofrece sugerencias y tipos iniciales; la compilación real no exige que todas las variables estén registradas en ese catálogo.

## Incompatibilidades corregidas

- El editor y `lib/rules` tenían esquemas duplicados; ambos apuntan ahora a `CANONICAL_AVIATOR_SCHEMA`.
- `/api/v1/rules/validate` y `/test` evaluaban con JavaScript, aunque el backend ejecutaba AviatorScript. Ahora conservan la forma de respuesta legacy y delegan compilación/ejecución al servicio Java.
- El operador legacy `in` generaba `.contains(...)`; el adaptador genera `seq.include(lista, valor)`.
- El backend registraba aliases dentro de `AviatorCalculationService`; se trasladaron a `AviatorScriptEngine`, compartido por cálculo, validación y prueba.
- El editor seguirá rechazando como bloques los programas que no pueda representar, pero conserva el código fuente y reporta el motivo; no crea una representación visual parcial.

## Flujo resultante

1. Blockly o el editor de código producen/reciben una fórmula.
2. El parser seguro y la validación AST detectan errores de estructura y tipos.
3. `Validar` envía el AviatorScript generado a `/api/v1/calculos/validar`.
4. `Guardar versión` solo queda habilitado después de una compilación válida.
5. `Probar` envía el mismo `source` y `parametros` a `/api/v1/calculos/probar`.
6. `Ejecutar` usa la versión activa persistida y registra la ejecución.

## Migración incremental

1. **Completado:** contrato canónico tipado, engine común, proxies Next y adaptadores legacy.
2. **Completado:** pruebas del engine para lambdas, colecciones, funciones de texto, pertenencia y rechazo de fuente inválida; prueba de round-trip parser/AST/evaluador.
3. **Siguiente:** migrar consumidores externos de `/api/v1/rules/validate` y `/test` a `/api/v1/calculos/validar` y `/probar`, manteniendo telemetría de uso.
4. **Posterior:** retirar el evaluador local y `RuleDocument` únicamente cuando no existan consumidores legacy y todas las fórmulas incompatibles tengan una migración explícita.
