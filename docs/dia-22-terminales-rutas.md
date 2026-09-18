# Dia 22 - Terminales y rutas

Fecha de practica: 2026-09-09

## Objetivo

Implementar en `dispatch-service` la administracion inicial de origenes y destinos:

```text
- CRUD de terminales.
- CRUD de rutas.
- Validacion de duplicados.
- Busquedas y filtros.
- Auditoria de cambios importantes.
```

El criterio de avance del dia es:

```text
El sistema puede administrar origenes y destinos.
```

## Resultado alcanzado

Se implementaron APIs reales para terminales y rutas dentro de `dispatch-service`.

Endpoints agregados:

```text
GET    /api/v1/dispatch/terminals
POST   /api/v1/dispatch/terminals
GET    /api/v1/dispatch/terminals/{terminalId}
PATCH  /api/v1/dispatch/terminals/{terminalId}
DELETE /api/v1/dispatch/terminals/{terminalId}

GET    /api/v1/dispatch/routes
POST   /api/v1/dispatch/routes
GET    /api/v1/dispatch/routes/{routeId}
PATCH  /api/v1/dispatch/routes/{routeId}
DELETE /api/v1/dispatch/routes/{routeId}
```

Validaciones implementadas:

```text
- Terminal con nombre obligatorio.
- Terminal no duplicada por nombre.
- Terminal no duplicada por local_code.
- Terminal no duplicada por legacy_id.
- Ruta con terminal origen obligatoria.
- Ruta con terminal destino obligatoria.
- Ruta con origen y destino diferentes.
- Ruta no duplicada por pareja origen/destino.
- Filtros por estado activo.
- Busqueda por texto.
- Paginacion basica.
```

Auditoria implementada:

```text
TERMINAL_CREATED
TERMINAL_UPDATED
TERMINAL_DEACTIVATED
ROUTE_CREATED
ROUTE_UPDATED
ROUTE_DEACTIVATED
```

Resultado de pruebas unitarias:

```text
Tests run: 12, Failures: 0, Errors: 0, Skipped: 0
BUILD SUCCESS
```

Resultado de validacion practica con PostgreSQL temporal:

```json
{"service":"dispatch-service","validation":"terminals-routes-crud","quarkus_profile":"onprem","secrets_provider":"env","database":"dispatch_db","database_port":55437,"http_port":18085,"created_terminals":2,"created_routes":1,"inactive_terminals":2,"inactive_routes":1,"audit_events":8,"duplicate_terminal_status":409,"duplicate_route_status":409,"invalid_route_status":400,"ready":true}
```

## Archivos creados o modificados

| Archivo | Proposito |
| --- | --- |
| `C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\ApiErrorResponse.java` | Respuesta estandar de errores REST. |
| `C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\ApiException.java` | Excepcion controlada para validacion, conflicto y no encontrado. |
| `C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\ApiExceptionMapper.java` | Convierte excepciones controladas en respuestas HTTP. |
| `C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\TerminalResource.java` | API REST de terminales. |
| `C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\RouteResource.java` | API REST de rutas. |
| `C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\dto\PageMeta.java` | Metadata de paginacion. |
| `C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\dto\PageResponse.java` | Respuesta paginada generica. |
| `C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\dto\TerminalCreateRequest.java` | Entrada para crear terminal. |
| `C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\dto\TerminalUpdateRequest.java` | Entrada para actualizar terminal. |
| `C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\dto\TerminalResponse.java` | Salida de terminal. |
| `C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\dto\RouteCreateRequest.java` | Entrada para crear ruta. |
| `C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\dto\RouteUpdateRequest.java` | Entrada para actualizar ruta. |
| `C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\dto\RouteResponse.java` | Salida de ruta. |
| `C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\service\AuditContext.java` | Contexto opcional de auditoria. |
| `C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\service\DispatchAuditService.java` | Registro de eventos en `outbox_events`. |
| `C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\service\TerminalRouteService.java` | Reglas de negocio de terminales y rutas. |
| `C:\VENTA-DE-PASAJES\services\dispatch-service\src\test\java\com\ventapasajes\dispatch\service\TerminalRouteServiceTest.java` | Pruebas unitarias de validaciones base. |
| `C:\VENTA-DE-PASAJES\services\dispatch-service\src\test\java\com\ventapasajes\dispatch\api\DispatchHealthResourceTest.java` | Verificacion OpenAPI con rutas nuevas. |
| `C:\VENTA-DE-PASAJES\scripts\verify-dispatch-terminals-routes.ps1` | Validacion real con PostgreSQL temporal. |
| `C:\VENTA-DE-PASAJES\services\dispatch-service\README.md` | Guia corta del servicio. |
| `C:\VENTA-DE-PASAJES\docs\openapi\dispatch-service.openapi.yaml` | Contrato OpenAPI estatico actualizado. |

## Reversa primero

Usar esta seccion solo si se desea limpiar la practica local o deshacer lo construido.

### Detener procesos locales

Ver procesos escuchando en los puertos usados durante la practica:

```powershell
Get-NetTCPConnection -LocalPort 18085,55437 -ErrorAction SilentlyContinue |
  Select-Object LocalAddress,LocalPort,State,OwningProcess |
  Format-Table -AutoSize
```

Si aparece un proceso Java del `dispatch-service` en `18085`, obtener detalle:

```powershell
$pidDispatch = (Get-NetTCPConnection -LocalPort 18085 -State Listen -ErrorAction SilentlyContinue).OwningProcess
Get-CimInstance Win32_Process -Filter "ProcessId = $pidDispatch" |
  Select-Object ProcessId,ParentProcessId,ExecutablePath,CommandLine |
  Format-List
```

Detener solo si corresponde al `dispatch-service` local:

```powershell
Stop-Process -Id $pidDispatch -Force
```

### Eliminar contenedor temporal de PostgreSQL

Ver contenedores temporales de esta practica:

```powershell
docker ps -a --filter "name=venta-pasajes-dispatch-crud" --format "{{.Names}}"
```

Detener uno si quedo vivo:

```powershell
docker stop <container-name>
```

Si se creo una base manual en un contenedor que no se va a eliminar:

```powershell
docker exec -e PGPASSWORD=<temporary-local-password> <container-name> `
  psql -U postgres -d postgres -c "DROP DATABASE IF EXISTS dispatch_db;"
```

### Limpiar artefactos generados

Estos archivos son generados por Maven y se pueden reconstruir:

```powershell
mvn -f .\services\dispatch-service\pom.xml clean
```

Si Windows bloquea `target\quarkus-app`, cerrar terminales viejas o procesos Java que esten ejecutando ese servicio y reintentar.

### Deshacer archivos fuente del Dia 22

Solo ejecutar si realmente se quiere volver al estado del Dia 21. En un repositorio con Git, lo recomendado seria restaurar estos archivos desde control de versiones. Si no hay Git, eliminar manualmente estos archivos implica perder el avance del Dia 22.

Archivos propios del Dia 22:

```text
ApiErrorResponse.java
ApiException.java
ApiExceptionMapper.java
TerminalResource.java
RouteResource.java
PageMeta.java
PageResponse.java
TerminalCreateRequest.java
TerminalUpdateRequest.java
TerminalResponse.java
RouteCreateRequest.java
RouteUpdateRequest.java
RouteResponse.java
AuditContext.java
DispatchAuditService.java
TerminalRouteService.java
TerminalRouteServiceTest.java
verify-dispatch-terminals-routes.ps1
dia-22-terminales-rutas.md
```

Verificacion de limpieza:

```powershell
Get-NetTCPConnection -LocalPort 18085,55437 -ErrorAction SilentlyContinue
docker ps -a --filter "name=venta-pasajes-dispatch-crud" --format "{{.Names}}"
```

Ambos comandos no deberian devolver resultados si todo quedo limpio.

## Guia manual desde cero

### Paso 1 - Ubicarse en el proyecto

```powershell
cd C:\VENTA-DE-PASAJES
```

### Paso 2 - Confirmar que el Dia 21 esta completo

Verificar archivos base:

```powershell
Test-Path .\services\dispatch-service\pom.xml
Test-Path .\services\dispatch-service\src\main\resources\db\migration\V1__dispatch_schema.sql
Test-Path .\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\DispatchBaseResource.java
```

Resultado esperado:

```text
True
True
True
```

Ejecutar pruebas del estado base:

```powershell
mvn -f .\services\dispatch-service\pom.xml test
```

Antes del Dia 22 el resultado esperado era:

```text
Tests run: 8, Failures: 0, Errors: 0, Skipped: 0
BUILD SUCCESS
```

Despues de aplicar el Dia 22 el resultado sube a 12 pruebas.

### Paso 3 - Crear infraestructura comun de errores

En este paso, "infraestructura" no significa crear servidores, redes, bases de datos ni recursos en GCP. Significa crear codigo comun dentro del microservicio para que todas las APIs manejen errores de la misma forma.

Este codigo comun sera usado por `TerminalResource`, `RouteResource` y futuros recursos de `dispatch-service`.

Crear estos archivos en:

```text
C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api
```

Crear o confirmar la carpeta:

```powershell
New-Item -ItemType Directory -Force -Path .\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api
```

Archivos:

```text
ApiErrorResponse.java
ApiException.java
ApiExceptionMapper.java
```

Crear los archivos si no existen:

```powershell
New-Item -ItemType File -Force -Path .\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\ApiErrorResponse.java
New-Item -ItemType File -Force -Path .\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\ApiException.java
New-Item -ItemType File -Force -Path .\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\ApiExceptionMapper.java
```

Despues de crear los archivos, agregar el codigo Java correspondiente a cada clase.

Verificar que los archivos existan:

```powershell
Test-Path .\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\ApiErrorResponse.java
Test-Path .\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\ApiException.java
Test-Path .\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\ApiExceptionMapper.java
```

Resultado esperado:

```text
True
True
True
```

Responsabilidad:

```text
- `ApiException.validation(...)` devuelve HTTP 400.
- `ApiException.notFound(...)` devuelve HTTP 404.
- `ApiException.conflict(...)` devuelve HTTP 409.
- `ApiExceptionMapper` transforma esas excepciones en JSON.
```

Formato de error:

```json
{
  "error": {
    "code": "ROUTE_ALREADY_EXISTS",
    "message": "A route already exists with the same origin and destination."
  }
}
```

### Paso 4 - Crear DTOs de paginacion, terminales y rutas

Crear estos archivos en:

```text
C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\dto
```

Archivos:

```text
PageMeta.java
PageResponse.java
TerminalCreateRequest.java
TerminalUpdateRequest.java
TerminalResponse.java
RouteCreateRequest.java
RouteUpdateRequest.java
RouteResponse.java
```

Importante:

```text
El proyecto usa `quarkus.jackson.property-naming-strategy=SNAKE_CASE`.
Por eso `originTerminalId` en Java se recibe y responde como `origin_terminal_id` en JSON.
```

### Paso 5 - Crear servicio de auditoria

Crear:

```text
C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\service\AuditContext.java
C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\service\DispatchAuditService.java
```

La auditoria se escribe en:

```text
dispatch_db.outbox_events
```

Eventos registrados:

```text
TERMINAL_CREATED
TERMINAL_UPDATED
TERMINAL_DEACTIVATED
ROUTE_CREATED
ROUTE_UPDATED
ROUTE_DEACTIVATED
```

Headers opcionales para auditoria:

```text
X-Actor-User-Id
X-Correlation-Id
```

Por ahora no hay seguridad conectada en `dispatch-service`, asi que estos headers sirven como preparacion para conectar luego `identity-service`.

### Paso 6 - Crear servicio de negocio

Crear:

```text
C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\service\TerminalRouteService.java
```

Responsabilidades:

```text
- Listar terminales con `page`, `page_size`, `q`, `active`.
- Crear terminales.
- Obtener terminal por ID.
- Actualizar terminal.
- Desactivar terminal.
- Listar rutas con `page`, `page_size`, `origin_terminal_id`, `destination_terminal_id`, `q`, `active`.
- Crear rutas.
- Obtener ruta por ID.
- Actualizar ruta.
- Desactivar ruta.
- Validar duplicados.
- Registrar auditoria.
```

Reglas de terminal:

```text
- `name` es obligatorio.
- `name` no se puede repetir.
- `local_code` no se puede repetir si se envia.
- `legacy_id` no se puede repetir si se envia.
- `DELETE` no borra fisicamente; cambia `active=false`.
```

Reglas de ruta:

```text
- `origin_terminal_id` es obligatorio.
- `destination_terminal_id` es obligatorio.
- Origen y destino no pueden ser iguales.
- No se permite repetir la misma pareja origen/destino.
- Si no se envia `name`, se genera como: Terminal Origen - Terminal Destino.
- `DELETE` no borra fisicamente; cambia `active=false`.
```

### Paso 7 - Crear recursos REST

Crear:

```text
C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\TerminalResource.java
C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\RouteResource.java
```

Endpoints de terminales:

```text
GET    /api/v1/dispatch/terminals
POST   /api/v1/dispatch/terminals
GET    /api/v1/dispatch/terminals/{terminalId}
PATCH  /api/v1/dispatch/terminals/{terminalId}
DELETE /api/v1/dispatch/terminals/{terminalId}
```

Endpoints de rutas:

```text
GET    /api/v1/dispatch/routes
POST   /api/v1/dispatch/routes
GET    /api/v1/dispatch/routes/{routeId}
PATCH  /api/v1/dispatch/routes/{routeId}
DELETE /api/v1/dispatch/routes/{routeId}
```

### Paso 8 - Actualizar OpenAPI estatico

Actualizar:

```text
C:\VENTA-DE-PASAJES\docs\openapi\dispatch-service.openapi.yaml
```

Agregar o confirmar:

```text
- DELETE /terminals/{terminalId}
- GET /routes/{routeId}
- PATCH /routes/{routeId}
- DELETE /routes/{routeId}
- Filtros `q` y `active` en rutas.
- `RouteId` como parametro reutilizable.
- `UpdateRouteRequest`.
```

### Paso 9 - Crear pruebas unitarias

Crear:

```text
C:\VENTA-DE-PASAJES\services\dispatch-service\src\test\java\com\ventapasajes\dispatch\service\TerminalRouteServiceTest.java
```

Actualizar:

```text
C:\VENTA-DE-PASAJES\services\dispatch-service\src\test\java\com\ventapasajes\dispatch\api\DispatchHealthResourceTest.java
```

Validaciones cubiertas:

```text
- Paginacion valida.
- Paginacion invalida.
- Campos obligatorios.
- Nombre automatico de ruta.
- OpenAPI incluye `/api/v1/dispatch/terminals`.
- OpenAPI incluye `/api/v1/dispatch/routes`.
```

Ejecutar:

```powershell
mvn -f .\services\dispatch-service\pom.xml test
```

Resultado esperado despues del Dia 22:

```text
Tests run: 12, Failures: 0, Errors: 0, Skipped: 0
BUILD SUCCESS
```

### Paso 10 - Empaquetar el servicio

Intento normal:

```powershell
mvn -f .\services\dispatch-service\pom.xml package -DskipTests
```

Si este comando termina con `BUILD SUCCESS`, el artefacto se genera en la salida normal de Quarkus:

```text
C:\VENTA-DE-PASAJES\services\dispatch-service\target\quarkus-app\quarkus-run.jar
```

Verificar salida normal:

```powershell
Test-Path .\services\dispatch-service\target\quarkus-app\quarkus-run.jar
```

Resultado esperado si el empaquetado normal funciono:

```text
True
```

Si Windows responde que `generated-bytecode.jar` esta siendo usado por otro proceso, revisar:

```powershell
Get-CimInstance Win32_Process -Filter "name = 'java.exe'" |
  Select-Object ProcessId,CommandLine |
  Format-List

Get-NetTCPConnection -LocalPort 18084,18085,8082 -ErrorAction SilentlyContinue |
  Select-Object LocalAddress,LocalPort,State,OwningProcess |
  Format-Table -AutoSize
```

Si no puedes detener el proceso por permisos, empaquetar en un directorio alterno:

```powershell
mvn -f .\services\dispatch-service\pom.xml package -DskipTests "-Dquarkus.package.output-directory=quarkus-app-day22"
```

Artefacto esperado solo si se uso el empaquetado alternativo:

```text
C:\VENTA-DE-PASAJES\services\dispatch-service\target\quarkus-app-day22\quarkus-run.jar
```

Verificar:

```powershell
Test-Path .\services\dispatch-service\target\quarkus-app-day22\quarkus-run.jar
```

Resumen:

```text
Si usaste el comando normal, verifica `target\quarkus-app\quarkus-run.jar`.
Si usaste el comando alternativo, verifica `target\quarkus-app-day22\quarkus-run.jar`.
No deben existir necesariamente las dos carpetas.
```

### Paso 11 - Ejecutar validacion automatica con PostgreSQL temporal

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-dispatch-terminals-routes.ps1 `
  -DatabasePort 55437 `
  -HttpPort 18085
```

Resultado esperado:

```json
{"service":"dispatch-service","validation":"terminals-routes-crud","created_terminals":2,"created_routes":1,"inactive_terminals":2,"inactive_routes":1,"audit_events":8,"duplicate_terminal_status":409,"duplicate_route_status":409,"invalid_route_status":400,"ready":true}
```

### Paso 12 - Validacion manual con PostgreSQL temporal

Crear variables:

```powershell
$dbPort = 55437
$httpPort = 18085
$container = "venta-pasajes-dispatch-crud-manual"
$pgPassword = [Convert]::ToBase64String(([guid]::NewGuid()).ToByteArray()).TrimEnd("=")
$normalJarPath = "C:\VENTA-DE-PASAJES\services\dispatch-service\target\quarkus-app\quarkus-run.jar"
$alternateJarPath = "C:\VENTA-DE-PASAJES\services\dispatch-service\target\quarkus-app-day22\quarkus-run.jar"

if (Test-Path $normalJarPath) {
  $jarPath = $normalJarPath
} elseif (Test-Path $alternateJarPath) {
  $jarPath = $alternateJarPath
} else {
  throw "No se encontro quarkus-run.jar. Ejecuta primero el Paso 10."
}
```

Levantar PostgreSQL:

```powershell
docker run --rm --name $container `
  -e POSTGRES_DB=dispatch_db `
  -e POSTGRES_USER=postgres `
  -e "POSTGRES_PASSWORD=$pgPassword" `
  -p "$dbPort`:5432" `
  -d postgres:16-alpine
```

Esperar a PostgreSQL:

```powershell
docker exec $container pg_isready -U postgres -d dispatch_db
```

Configurar variables del servicio:

```powershell
$env:QUARKUS_PROFILE = "onprem"
$env:QUARKUS_HTTP_PORT = "$httpPort"
$env:APP_ENV = "local"
$env:APP_RUNTIME_TARGET = "onprem"
$env:APP_SECRETS_PROVIDER = "env"
$env:APP_DB_NAME = "dispatch_db"
$env:APP_DB_JDBC_URL = "jdbc:postgresql://localhost:$dbPort/dispatch_db"
$env:APP_DB_USERNAME = "postgres"
$env:APP_DB_PASSWORD = $pgPassword
$env:QUARKUS_FLYWAY_MIGRATE_AT_START = "true"
$env:APP_LOG_CONSOLE_JSON = "false"
```

Arrancar servicio:

```powershell
$app = Start-Process `
  -FilePath "java" `
  -ArgumentList @("-jar", $jarPath) `
  -WindowStyle Hidden `
  -PassThru
```

Verificar salud:

```powershell
curl.exe -s "http://localhost:$httpPort/q/health/ready"
curl.exe -s "http://localhost:$httpPort/api/v1/dispatch/health"
```

## Peticiones HTTP/HTTPS listas con curl.exe

Crear variables para las pruebas:

```powershell
$baseUrl = "http://localhost:18085/api/v1/dispatch"
$actorId = "00000000-0000-0000-0000-000000000022"
$correlationId = "00000000-0000-0000-0000-000000000222"
```

Nota para PowerShell:

```text
Si la consola queda mostrando `>>`, significa que PowerShell cree que el comando no termino.
Cancela con Ctrl+C y vuelve a ejecutar el bloque.
Evita escribir JSON con comillas escapadas como `\"`.
En Windows PowerShell tambien puede fallar `curl.exe --data-raw $body` porque el shell puede alterar las comillas internas del JSON.
La forma mas estable es guardar el JSON en un archivo temporal y enviarlo con `--data-binary "@archivo.json"`.
```

Antes de crear registros, comprobar que las variables y el servicio esten listos:

```powershell
$baseUrl
$actorId
$correlationId

curl.exe -i -S "$baseUrl/health"
```

Resultado esperado:

```text
HTTP/1.1 200 OK
```

Si no devuelve HTTP 200, el servicio no esta levantado o `$baseUrl` esta vacio. Recordatorio importante: el script `verify-dispatch-terminals-routes.ps1` levanta el servicio solo para la prueba automatica y lo detiene al final. Para probar manualmente con `curl.exe`, primero se debe ejecutar la seccion "Validacion manual con PostgreSQL temporal" y dejar el servicio encendido.

Si un comando con `curl.exe -s` no muestra nada, primero construye el body de la peticion y luego quita el modo silencioso para ver el error real:

```powershell
$originBodyPath = Join-Path $env:TEMP "dispatch-origin-terminal.json"
$originBody | Set-Content -LiteralPath $originBodyPath -Encoding ascii

curl.exe -i -S -X POST "$baseUrl/terminals" `
  -H "Content-Type: application/json" `
  -H "X-Actor-User-Id: $actorId" `
  -H "X-Correlation-Id: $correlationId" `
  --data-binary "@$originBodyPath"

$LASTEXITCODE
```

Interpretacion rapida:

```text
HTTP 201: terminal creada.
HTTP 400: body invalido o campo obligatorio faltante.
HTTP 409: terminal duplicada.
curl exit code distinto de 0 sin HTTP: servicio caido, URL mala o puerto incorrecto.
$LASTEXITCODE = 0 no significa HTTP 200; solo significa que curl.exe pudo comunicarse.
Si ves HTTP 400 y content-length: 0, ConvertFrom-Json no mostrara nada porque no hay cuerpo JSON que convertir.
```

Con el ajuste de manejo de errores del servicio, un JSON mal formado debe responder:

```json
{"error":{"code":"BAD_REQUEST","message":"Request body or parameters are invalid."}}
```

Si responde HTTP 500:

```text
El request ya llego al servicio, pero el backend fallo internamente.
En este dia, lo primero que se debe revisar es la conexion a PostgreSQL.
```

Verificar readiness real del servicio:

```powershell
curl.exe -i -S "http://localhost:18085/q/health/ready"
```

Si ves algo similar a `Database connections health check DOWN` o `password authentication failed`, el servicio se levanto sin las variables correctas de base de datos. En ese caso, cerrar la terminal donde esta corriendo el servicio o detener el proceso que escucha en `18085`:

```powershell
Get-NetTCPConnection -LocalPort 18085 -ErrorAction SilentlyContinue |
  Select-Object LocalAddress,LocalPort,State,OwningProcess |
  Format-Table -AutoSize

Stop-Process -Id <OwningProcess> -Force
```

Luego volver a levantar PostgreSQL y el servicio con las variables correctas. Si ya existe el contenedor manual:

```powershell
$container = "venta-pasajes-dispatch-crud-manual"
$dbPort = 55437
$httpPort = 18085
$pgPassword = docker exec $container printenv POSTGRES_PASSWORD
$jarPath = "C:\VENTA-DE-PASAJES\services\dispatch-service\target\quarkus-app\quarkus-run.jar"

$env:QUARKUS_PROFILE = "onprem"
$env:QUARKUS_HTTP_PORT = "$httpPort"
$env:APP_ENV = "local"
$env:APP_RUNTIME_TARGET = "onprem"
$env:APP_SECRETS_PROVIDER = "env"
$env:APP_DB_NAME = "dispatch_db"
$env:APP_DB_JDBC_URL = "jdbc:postgresql://localhost:$dbPort/dispatch_db"
$env:APP_DB_USERNAME = "postgres"
$env:APP_DB_PASSWORD = $pgPassword
$env:QUARKUS_FLYWAY_MIGRATE_AT_START = "true"
$env:APP_LOG_CONSOLE_JSON = "false"

java -jar $jarPath
```

En otra terminal, confirmar que Flyway creo las tablas y que la base esta lista:

```powershell
curl.exe -i -S "http://localhost:18085/q/health/ready"

docker exec -e PGPASSWORD=$pgPassword $container `
  psql -U postgres -d dispatch_db -tAc "select count(*) from information_schema.tables where table_schema = 'public';"
```

### Crear terminal origen

```powershell
$originBody = @{
  legacy_id = 2201
  local_code = "UIO"
  name = "Terminal Quitumbe"
  manager_name = "Operador Norte"
  address = "Av. Quitumbe"
  phone = "022000001"
  email = "quitumbe@example.local"
} | ConvertTo-Json -Compress

$originBodyPath = Join-Path $env:TEMP "dispatch-origin-terminal.json"
$originBody | Set-Content -LiteralPath $originBodyPath -Encoding ascii

$origin = curl.exe -sS -X POST "$baseUrl/terminals" `
  -H "Content-Type: application/json" `
  -H "X-Actor-User-Id: $actorId" `
  -H "X-Correlation-Id: $correlationId" `
  --data-binary "@$originBodyPath" |
  ConvertFrom-Json

$origin
```

### Crear terminal destino

```powershell
$destinationBody = @{
  legacy_id = 2202
  local_code = "GYE"
  name = "Terminal Guayaquil"
  manager_name = "Operador Costa"
  address = "Av. Terminal"
  phone = "042000001"
  email = "guayaquil@example.local"
} | ConvertTo-Json -Compress

$destinationBodyPath = Join-Path $env:TEMP "dispatch-destination-terminal.json"
$destinationBody | Set-Content -LiteralPath $destinationBodyPath -Encoding ascii

$destination = curl.exe -sS -X POST "$baseUrl/terminals" `
  -H "Content-Type: application/json" `
  -H "X-Actor-User-Id: $actorId" `
  -H "X-Correlation-Id: $correlationId" `
  --data-binary "@$destinationBodyPath" |
  ConvertFrom-Json

$destination
```

### Listar terminales

```powershell
curl.exe -s -X GET "$baseUrl/terminals?page=1&page_size=10"
```

### Buscar terminales activas por texto

```powershell
curl.exe -s -X GET "$baseUrl/terminals?q=quitumbe&active=true&page=1&page_size=10"
```

### Obtener una terminal por ID

```powershell
curl.exe -s -X GET "$baseUrl/terminals/$($origin.id)"
```

### Actualizar terminal

```powershell
$updateTerminalBody = @{
  manager_name = "Operador Sierra"
  phone = "022000099"
} | ConvertTo-Json -Compress

$updateTerminalBodyPath = Join-Path $env:TEMP "dispatch-update-terminal.json"
$updateTerminalBody | Set-Content -LiteralPath $updateTerminalBodyPath -Encoding ascii

curl.exe -s -X PATCH "$baseUrl/terminals/$($origin.id)" `
  -H "Content-Type: application/json" `
  -H "X-Actor-User-Id: $actorId" `
  -H "X-Correlation-Id: $correlationId" `
  --data-binary "@$updateTerminalBodyPath"
```

### Probar duplicado de terminal

Debe devolver HTTP 409:

```powershell
$duplicateTerminalBody = @{
  local_code = "UIO-2"
  name = "terminal quitumbe"
} | ConvertTo-Json -Compress

$duplicateTerminalBodyPath = Join-Path $env:TEMP "dispatch-duplicate-terminal.json"
$duplicateTerminalBody | Set-Content -LiteralPath $duplicateTerminalBodyPath -Encoding ascii

curl.exe -i -X POST "$baseUrl/terminals" `
  -H "Content-Type: application/json" `
  -H "X-Actor-User-Id: $actorId" `
  -H "X-Correlation-Id: $correlationId" `
  --data-binary "@$duplicateTerminalBodyPath"
```

### Crear ruta

Si no se envia `name`, el servicio genera el nombre automaticamente:

```powershell
$routeBody = @{
  origin_terminal_id = $origin.id
  destination_terminal_id = $destination.id
} | ConvertTo-Json -Compress

$routeBodyPath = Join-Path $env:TEMP "dispatch-route.json"
$routeBody | Set-Content -LiteralPath $routeBodyPath -Encoding ascii

$route = curl.exe -s -X POST "$baseUrl/routes" `
  -H "Content-Type: application/json" `
  -H "X-Actor-User-Id: $actorId" `
  -H "X-Correlation-Id: $correlationId" `
  --data-binary "@$routeBodyPath" |
  ConvertFrom-Json

$route
```

### Listar rutas

```powershell
curl.exe -s -X GET "$baseUrl/routes?page=1&page_size=10"
```

### Filtrar rutas por origen

```powershell
curl.exe -s -X GET "$baseUrl/routes?origin_terminal_id=$($origin.id)&active=true&page=1&page_size=10"
```

### Obtener ruta por ID

```powershell
curl.exe -s -X GET "$baseUrl/routes/$($route.id)"
```

### Actualizar ruta

```powershell
$updateRouteBody = @{
  name = "Quito - Guayaquil Express"
} | ConvertTo-Json -Compress

$updateRouteBodyPath = Join-Path $env:TEMP "dispatch-update-route.json"
$updateRouteBody | Set-Content -LiteralPath $updateRouteBodyPath -Encoding ascii

curl.exe -s -X PATCH "$baseUrl/routes/$($route.id)" `
  -H "Content-Type: application/json" `
  -H "X-Actor-User-Id: $actorId" `
  -H "X-Correlation-Id: $correlationId" `
  --data-binary "@$updateRouteBodyPath"
```

### Probar ruta con origen y destino iguales

Debe devolver HTTP 400:

```powershell
$invalidRouteBody = @{
  origin_terminal_id = $origin.id
  destination_terminal_id = $origin.id
} | ConvertTo-Json -Compress

$invalidRouteBodyPath = Join-Path $env:TEMP "dispatch-invalid-route.json"
$invalidRouteBody | Set-Content -LiteralPath $invalidRouteBodyPath -Encoding ascii

curl.exe -i -X POST "$baseUrl/routes" `
  -H "Content-Type: application/json" `
  -H "X-Actor-User-Id: $actorId" `
  -H "X-Correlation-Id: $correlationId" `
  --data-binary "@$invalidRouteBodyPath"
```

### Probar duplicado de ruta

Debe devolver HTTP 409:

```powershell
$duplicateRouteBody = @{
  origin_terminal_id = $origin.id
  destination_terminal_id = $destination.id
  name = "Duplicada"
} | ConvertTo-Json -Compress

$duplicateRouteBodyPath = Join-Path $env:TEMP "dispatch-duplicate-route.json"
$duplicateRouteBody | Set-Content -LiteralPath $duplicateRouteBodyPath -Encoding ascii

curl.exe -i -X POST "$baseUrl/routes" `
  -H "Content-Type: application/json" `
  -H "X-Actor-User-Id: $actorId" `
  -H "X-Correlation-Id: $correlationId" `
  --data-binary "@$duplicateRouteBodyPath"
```

### Desactivar ruta

```powershell
curl.exe -i -X DELETE "$baseUrl/routes/$($route.id)" `
  -H "X-Actor-User-Id: $actorId" `
  -H "X-Correlation-Id: $correlationId"
```

### Listar rutas inactivas

```powershell
curl.exe -s -X GET "$baseUrl/routes?active=false&page=1&page_size=10"
```

### Desactivar terminales

```powershell
curl.exe -i -X DELETE "$baseUrl/terminals/$($origin.id)" `
  -H "X-Actor-User-Id: $actorId" `
  -H "X-Correlation-Id: $correlationId"

curl.exe -i -X DELETE "$baseUrl/terminals/$($destination.id)" `
  -H "X-Actor-User-Id: $actorId" `
  -H "X-Correlation-Id: $correlationId"
```

### Ver OpenAPI generado

```powershell
curl.exe -s "http://localhost:18085/q/openapi"
```

### Abrir Swagger UI

```powershell
Start-Process "http://localhost:18085/q/swagger-ui"
```

## Verificacion SQL

Contar terminales:

```powershell
docker exec -e PGPASSWORD=$pgPassword $container `
  psql -U postgres -d dispatch_db -tAc "select count(*) from terminals;"
```

Contar rutas:

```powershell
docker exec -e PGPASSWORD=$pgPassword $container `
  psql -U postgres -d dispatch_db -tAc "select count(*) from routes;"
```

Ver eventos de auditoria:

```powershell
docker exec -e PGPASSWORD=$pgPassword $container `
  psql -U postgres -d dispatch_db -c "select event_type, resource_type, status, occurred_at from outbox_events order by occurred_at;"
```

Resultado esperado despues de la secuencia completa:

```text
terminals = 2
routes = 1
outbox_events >= 8
```

## Limpieza despues de prueba manual

Detener servicio:

```powershell
Stop-Process -Id $app.Id -Force
```

Detener PostgreSQL temporal:

```powershell
docker stop $container
```

Limpiar variables sensibles de la sesion:

```powershell
Remove-Item Env:\APP_DB_PASSWORD -ErrorAction SilentlyContinue
Remove-Item Env:\APP_DB_USERNAME -ErrorAction SilentlyContinue
Remove-Item Env:\APP_DB_JDBC_URL -ErrorAction SilentlyContinue
Remove-Item Env:\QUARKUS_PROFILE -ErrorAction SilentlyContinue
Remove-Item Env:\QUARKUS_HTTP_PORT -ErrorAction SilentlyContinue
Remove-Item Env:\QUARKUS_FLYWAY_MIGRATE_AT_START -ErrorAction SilentlyContinue
```

Confirmar limpieza:

```powershell
Get-NetTCPConnection -LocalPort 18085,55437 -ErrorAction SilentlyContinue
docker ps -a --filter "name=venta-pasajes-dispatch-crud" --format "{{.Names}}"
```

## Comandos ejecutados durante la practica

```powershell
rg -n "Dia 22|Terminales y rutas|terminales|rutas|routes|terminals" .\tareas.md .\docs .\services\dispatch-service
Get-ChildItem .\services\dispatch-service -Recurse -File | Select-Object FullName
Get-Content .\docs\openapi\dispatch-service.openapi.yaml
Get-Content .\docs\estandar-documentacion-dias.md
Get-Content .\services\identity-service\src\main\java\com\ventapasajes\identity\api\ApiException.java
Get-Content .\services\identity-service\src\main\java\com\ventapasajes\identity\api\ApiExceptionMapper.java
Get-Content .\services\identity-service\src\main\java\com\ventapasajes\identity\api\ApiErrorResponse.java
Get-Content .\services\identity-service\src\main\java\com\ventapasajes\identity\service\IdentityApplicationService.java
mvn -f .\services\dispatch-service\pom.xml test
mvn -f .\services\dispatch-service\pom.xml package -DskipTests
Get-CimInstance Win32_Process -Filter "name = 'java.exe'" | Select-Object ProcessId,CommandLine | Format-List
Get-NetTCPConnection -LocalPort 18084,18085,8082 -ErrorAction SilentlyContinue | Select-Object LocalAddress,LocalPort,State,OwningProcess | Format-Table -AutoSize
mvn -f .\services\dispatch-service\pom.xml package -DskipTests "-Dquarkus.package.output-directory=quarkus-app-day22"
$Errors = $null; [System.Management.Automation.Language.Parser]::ParseFile((Resolve-Path .\scripts\verify-dispatch-terminals-routes.ps1), [ref]$null, [ref]$Errors)
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-dispatch-terminals-routes.ps1 -DatabasePort 55437 -HttpPort 18085
docker ps -a --filter "name=venta-pasajes-dispatch-crud" --format "{{.Names}}"
Get-NetTCPConnection -LocalPort 18085,55437 -ErrorAction SilentlyContinue | Select-Object LocalAddress,LocalPort,State,OwningProcess | Format-Table -AutoSize
```

## Problemas encontrados y solucionados

### Problema 1 - Conteo anterior de pruebas

Antes de iniciar el Dia 22 se detecto que el workspace local habia quedado parcial y `mvn test` mostraba 4 pruebas en vez de 8.

Solucion:

```text
Se restauraron los archivos faltantes del Dia 21 y Maven volvio a reportar 8 pruebas.
```

### Problema 2 - Archivo bloqueado por Windows

El empaquetado normal fallo:

```text
generated-bytecode.jar: El proceso no tiene acceso al archivo porque esta siendo utilizado por otro proceso.
```

Diagnostico:

```text
Habia un proceso Java escuchando en 18084, puerto temporal usado por una prueba anterior de dispatch-service.
No se pudo detener desde esta terminal por acceso denegado.
```

Solucion usada durante la practica de Codex:

```powershell
mvn -f .\services\dispatch-service\pom.xml package -DskipTests "-Dquarkus.package.output-directory=quarkus-app-day22"
```

Esa solucion solo es necesaria si el empaquetado normal falla por un archivo bloqueado. Si el empaquetado normal funciona, se debe usar:

```text
C:\VENTA-DE-PASAJES\services\dispatch-service\target\quarkus-app\quarkus-run.jar
```

Con la salida alterna se genera:

```text
C:\VENTA-DE-PASAJES\services\dispatch-service\target\quarkus-app-day22\quarkus-run.jar
```

### Problema 3 - Limpieza de recursos temporales

El script `verify-dispatch-terminals-routes.ps1` limpia al final:

```text
- Proceso Java que el mismo script levanta.
- Contenedor PostgreSQL temporal.
- Variables de entorno sensibles de la sesion.
```

Validacion final:

```text
No quedaron contenedores temporales `venta-pasajes-dispatch-crud`.
No quedaron listeners activos en 18085 ni 55437.
```

## Estado final

```text
Dia 22 completado.
Las APIs de terminales y rutas estan implementadas.
El sistema puede administrar origenes y destinos.
```

Siguiente paso natural:

```text
Dia 23 - Tipos de bus, buses y layouts.
```
