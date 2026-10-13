# Dia 24 - Salidas programadas

Fecha de practica: 2026-09-10

## Objetivo

Implementar en `dispatch-service` la administracion de viajes o salidas programadas:

```text
- CRUD de salidas.
- Asociar salida con bus y ruta.
- Validar fecha y hora.
- Validar bus no duplicado en horario conflictivo.
- Publicar evento DepartureScheduled.
```

El criterio de avance del dia es:

```text
Se pueden programar viajes.
```

## Resultado alcanzado

Se agrego la API real de salidas programadas.

Endpoints agregados:

```text
GET    /api/v1/dispatch/departures
POST   /api/v1/dispatch/departures
GET    /api/v1/dispatch/departures/{departureId}
PATCH  /api/v1/dispatch/departures/{departureId}
DELETE /api/v1/dispatch/departures/{departureId}
POST   /api/v1/dispatch/departures/{departureId}/cancel
```

Regla importante:

```text
DELETE no borra fisicamente la salida.
DELETE cambia la salida a estado CANCELLED.
```

Validaciones implementadas:

```text
- bus_id obligatorio.
- route_id obligatorio.
- departure_at obligatorio.
- departure_at debe ser futuro.
- legacy_id no se puede repetir si se envia.
- El bus debe existir y estar activo.
- La ruta debe existir y estar activa.
- El mismo bus no puede tener otra salida en la misma fecha/hora si la otra salida esta SCHEDULED o CLOSED.
- Una salida CANCELLED no se puede actualizar.
- date_to no puede ser menor que date_from en filtros.
```

Evento generado:

```text
DepartureScheduled
```

El evento se registra en:

```text
dispatch_db.outbox_events
```

Por ahora queda en outbox como evento pendiente para publicacion posterior. Esto deja preparado el camino para conectar mensajeria real mas adelante.

Resultado de pruebas unitarias:

```text
Tests run: 24, Failures: 0, Errors: 0, Skipped: 0
BUILD SUCCESS
```

Resultado de validacion practica con PostgreSQL temporal:

```json
{"service":"dispatch-service","validation":"departures-crud","quarkus_profile":"onprem","secrets_provider":"env","database":"dispatch_db","database_port":55439,"http_port":18087,"jar":"C:\\VENTA-DE-PASAJES\\services\\dispatch-service\\target\\quarkus-app-day24\\quarkus-run.jar","created_departures":2,"cancelled_departures":2,"departure_scheduled_events":2,"departure_events":5,"duplicate_schedule_status":409,"past_departure_status":400,"delete_cancels":true,"ready":true}
```

## Archivos creados o modificados

| Archivo | Proposito |
| --- | --- |
| `C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\DepartureResource.java` | API REST de salidas programadas. |
| `C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\dto\DepartureCreateRequest.java` | Entrada para programar una salida. |
| `C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\dto\DepartureUpdateRequest.java` | Entrada para actualizar una salida. |
| `C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\dto\DepartureCancelRequest.java` | Entrada para cancelar una salida con motivo. |
| `C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\dto\DepartureResponse.java` | Salida de una salida programada. |
| `C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\service\DepartureScheduleService.java` | Reglas de negocio de salidas programadas. |
| `C:\VENTA-DE-PASAJES\services\dispatch-service\src\test\java\com\ventapasajes\dispatch\service\DepartureScheduleServiceTest.java` | Pruebas unitarias de fechas, filtros y estados. |
| `C:\VENTA-DE-PASAJES\services\dispatch-service\src\test\java\com\ventapasajes\dispatch\api\DispatchHealthResourceTest.java` | Verifica que OpenAPI incluya `/departures`. |
| `C:\VENTA-DE-PASAJES\scripts\verify-dispatch-departures.ps1` | Validacion real con PostgreSQL temporal. |
| `C:\VENTA-DE-PASAJES\docs\openapi\dispatch-service.openapi.yaml` | Contrato OpenAPI estatico actualizado. |
| `C:\VENTA-DE-PASAJES\services\dispatch-service\README.md` | Guia corta del servicio actualizada. |
| `C:\VENTA-DE-PASAJES\vitacora.md` | Registro de comandos, resultados y decisiones. |

## Reversa primero

Usar esta seccion solo si se desea limpiar la practica local o retirar el avance del Dia 24.

### Detener servicio local

Ver procesos escuchando en los puertos usados durante la practica:

```powershell
Get-NetTCPConnection -LocalPort 18087,55439 -ErrorAction SilentlyContinue |
  Select-Object LocalAddress,LocalPort,State,OwningProcess |
  Format-Table -AutoSize
```

Si aparece un proceso Java del `dispatch-service` en `18087`, obtener detalle:

```powershell
$pidDispatch = (Get-NetTCPConnection -LocalPort 18087 -State Listen -ErrorAction SilentlyContinue).OwningProcess
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
docker ps -a --filter "name=venta-pasajes-dispatch-departures" --format "{{.Names}}"
```

Detener uno si quedo vivo:

```powershell
docker stop <container-name>
```

### Revertir datos del Dia 24 en una base manual

Advertencia:

```text
No ejecutar estos comandos en produccion.
Solo usarlos en una base local o temporal creada para practicar.
```

Eliminar salidas de prueba:

```powershell
docker exec -e PGPASSWORD=<temporary-local-password> <container-name> `
  psql -U postgres -d dispatch_db -c "delete from departures where legacy_id in (2401, 2402, 2403, 2404, 2405);"
```

Eliminar eventos de salida de prueba:

```powershell
docker exec -e PGPASSWORD=<temporary-local-password> <container-name> `
  psql -U postgres -d dispatch_db -c "delete from outbox_events where event_type in ('DepartureScheduled','DEPARTURE_UPDATED','DEPARTURE_CANCELLED') and actor_user_id = '00000000-0000-0000-0000-000000000024';"
```

Eliminar datos base usados por la practica:

```powershell
docker exec -e PGPASSWORD=<temporary-local-password> <container-name> `
  psql -U postgres -d dispatch_db -c "delete from buses where legacy_id = 2401;"

docker exec -e PGPASSWORD=<temporary-local-password> <container-name> `
  psql -U postgres -d dispatch_db -c "delete from routes where name = 'Ruta Dia 24';"

docker exec -e PGPASSWORD=<temporary-local-password> <container-name> `
  psql -U postgres -d dispatch_db -c "delete from bus_types where legacy_id = 2401;"

docker exec -e PGPASSWORD=<temporary-local-password> <container-name> `
  psql -U postgres -d dispatch_db -c "delete from terminals where legacy_id in (2401, 2402);"
```

Confirmar limpieza:

```powershell
docker exec -e PGPASSWORD=<temporary-local-password> <container-name> `
  psql -U postgres -d dispatch_db -tAc "select count(*) from departures where legacy_id in (2401, 2405);"
```

Resultado esperado:

```text
0
```

### Limpiar artefactos generados

Los artefactos Maven se pueden reconstruir:

```powershell
mvn -f .\services\dispatch-service\pom.xml clean
```

Si solo se desea quitar la salida alternativa del Dia 24:

```powershell
Remove-Item -LiteralPath .\services\dispatch-service\target\quarkus-app-day24 -Recurse -Force
```

### Deshacer archivos fuente del Dia 24

Solo hacerlo si realmente se quiere volver al estado del Dia 23. En un repositorio con Git, restaurar desde control de versiones. Si no hay Git, eliminar estos archivos implica perder el avance del Dia 24.

Archivos propios del Dia 24:

```text
DepartureResource.java
DepartureCreateRequest.java
DepartureUpdateRequest.java
DepartureCancelRequest.java
DepartureResponse.java
DepartureScheduleService.java
DepartureScheduleServiceTest.java
verify-dispatch-departures.ps1
dia-24-salidas-programadas.md
```

Tambien se modificaron:

```text
DispatchHealthResourceTest.java
dispatch-service.openapi.yaml
README.md
vitacora.md
```

Verificacion de limpieza:

```powershell
Get-NetTCPConnection -LocalPort 18087,55439 -ErrorAction SilentlyContinue
docker ps -a --filter "name=venta-pasajes-dispatch-departures" --format "{{.Names}}"
```

Ambos comandos no deberian devolver resultados si todo quedo limpio.

## Guia manual desde cero

### Paso 1 - Ubicarse en el proyecto

```powershell
cd C:\VENTA-DE-PASAJES
```

### Paso 2 - Confirmar prerequisitos

```powershell
java -version
mvn -version
docker version
```

Verificar que los dias anteriores esten listos:

```powershell
Test-Path .\services\dispatch-service\pom.xml
Test-Path .\services\dispatch-service\src\main\resources\db\migration\V1__dispatch_schema.sql
Test-Path .\services\dispatch-service\src\main\resources\db\migration\V2__dispatch_seed_legacy_25_seat_layout.sql
Test-Path .\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\BusResource.java
Test-Path .\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\RouteResource.java
Test-Path .\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\TerminalResource.java
```

Resultado esperado:

```text
True
True
True
True
True
True
```

### Paso 3 - Entender la tabla de salidas

La tabla ya existia desde el Dia 21:

```text
departures
```

Campos principales:

```text
legacy_id: id del sistema anterior si aplica.
bus_id: bus asignado al viaje.
route_id: ruta asignada al viaje.
departure_at: fecha y hora de salida.
status: SCHEDULED, CANCELLED, CLOSED o DEPARTED.
notes: observaciones.
cancelled_by_user_id: usuario que cancelo.
cancellation_reason: motivo de cancelacion.
cancelled_at: fecha/hora de cancelacion.
```

Ver definicion SQL:

```powershell
Select-String -Path .\services\dispatch-service\src\main\resources\db\migration\V1__dispatch_schema.sql -Pattern "CREATE TABLE departures" -Context 0,25
```

### Paso 4 - Crear DTOs de salidas

Crear o verificar:

```powershell
Test-Path .\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\dto\DepartureCreateRequest.java
Test-Path .\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\dto\DepartureUpdateRequest.java
Test-Path .\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\dto\DepartureCancelRequest.java
Test-Path .\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\dto\DepartureResponse.java
```

Entrada para crear:

```json
{
  "legacy_id": 2401,
  "bus_id": "<bus-id>",
  "route_id": "<route-id>",
  "departure_at": "2026-09-12T15:00:00Z",
  "notes": "Salida validada Dia 24"
}
```

Entrada para actualizar:

```json
{
  "departure_at": "2026-09-13T15:00:00Z",
  "notes": "Salida actualizada Dia 24"
}
```

Entrada para cancelar:

```json
{
  "reason": "Cancelacion validada Dia 24"
}
```

### Paso 5 - Crear servicio de negocio

Crear o verificar:

```powershell
Test-Path .\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\service\DepartureScheduleService.java
```

Responsabilidades:

```text
- Listar salidas con filtros.
- Crear salidas.
- Obtener salida por ID.
- Actualizar salida.
- Cancelar salida.
- Validar bus activo.
- Validar ruta activa.
- Validar fecha futura.
- Validar conflicto bus + fecha/hora.
- Registrar evento DepartureScheduled en outbox_events.
```

### Paso 6 - Crear resource REST

Crear o verificar:

```powershell
Test-Path .\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\DepartureResource.java
```

Endpoints:

```text
GET    /api/v1/dispatch/departures
POST   /api/v1/dispatch/departures
GET    /api/v1/dispatch/departures/{departureId}
PATCH  /api/v1/dispatch/departures/{departureId}
DELETE /api/v1/dispatch/departures/{departureId}
POST   /api/v1/dispatch/departures/{departureId}/cancel
```

### Paso 7 - Actualizar OpenAPI estatico

Actualizar:

```text
C:\VENTA-DE-PASAJES\docs\openapi\dispatch-service.openapi.yaml
```

Debe incluir:

```text
- PATCH /departures/{departureId}
- DELETE /departures/{departureId}
- POST /departures/{departureId}/cancel
- CreateDepartureRequest
- UpdateDepartureRequest
- CancelDepartureRequest
- Departure con bus, ruta, terminal origen/destino, estado y campos de cancelacion.
```

Verificar:

```powershell
Select-String -Path .\docs\openapi\dispatch-service.openapi.yaml -Pattern "/departures|UpdateDepartureRequest|CancelDepartureRequest|DepartureScheduled"
```

Nota:

```text
El evento DepartureScheduled se documenta en el dia y en la bitacora.
El OpenAPI documenta HTTP; no documenta todos los eventos internos.
```

### Paso 8 - Crear pruebas unitarias

Crear o verificar:

```powershell
Test-Path .\services\dispatch-service\src\test\java\com\ventapasajes\dispatch\service\DepartureScheduleServiceTest.java
```

Actualizar:

```powershell
Test-Path .\services\dispatch-service\src\test\java\com\ventapasajes\dispatch\api\DispatchHealthResourceTest.java
```

Cobertura agregada:

```text
- Paginacion valida.
- Paginacion invalida.
- Rango date_from/date_to valido.
- Rango date_from/date_to invalido.
- departure_at futuro obligatorio.
- Estados que bloquean horario del bus: SCHEDULED y CLOSED.
- Estados que no bloquean horario del bus: CANCELLED y DEPARTED.
- OpenAPI generado incluye /api/v1/dispatch/departures.
```

### Paso 9 - Ejecutar pruebas Maven

```powershell
mvn -f .\services\dispatch-service\pom.xml test
```

Resultado esperado:

```text
Tests run: 24, Failures: 0, Errors: 0, Skipped: 0
BUILD SUCCESS
```

### Paso 10 - Empaquetar el servicio

Intento normal:

```powershell
mvn -f .\services\dispatch-service\pom.xml package -DskipTests
```

Si termina en `BUILD SUCCESS`, el artefacto queda en:

```text
C:\VENTA-DE-PASAJES\services\dispatch-service\target\quarkus-app\quarkus-run.jar
```

Si Windows tiene bloqueado `target\quarkus-app`, crear una salida alternativa:

```powershell
mvn -f .\services\dispatch-service\pom.xml package -DskipTests "-Dquarkus.package.output-directory=quarkus-app-day24"
```

Verificar salida alternativa:

```powershell
Test-Path .\services\dispatch-service\target\quarkus-app-day24\quarkus-run.jar
```

### Paso 11 - Ejecutar validacion automatica

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-dispatch-departures.ps1 `
  -DatabasePort 55439 `
  -HttpPort 18087
```

Resultado esperado:

```json
{"service":"dispatch-service","validation":"departures-crud","created_departures":2,"cancelled_departures":2,"departure_scheduled_events":2,"departure_events":5,"duplicate_schedule_status":409,"past_departure_status":400,"delete_cancels":true,"ready":true}
```

## Validacion manual con PostgreSQL temporal

### Paso 12 - Crear variables locales

```powershell
$dbPort = 55439
$httpPort = 18087
$container = "venta-pasajes-dispatch-departures-manual"
$pgPassword = [Convert]::ToBase64String(([guid]::NewGuid()).ToByteArray()).TrimEnd("=")
$normalJarPath = "C:\VENTA-DE-PASAJES\services\dispatch-service\target\quarkus-app\quarkus-run.jar"
$alternateJarPath = "C:\VENTA-DE-PASAJES\services\dispatch-service\target\quarkus-app-day24\quarkus-run.jar"

if (Test-Path $normalJarPath) {
  $jarPath = $normalJarPath
} elseif (Test-Path $alternateJarPath) {
  $jarPath = $alternateJarPath
} else {
  throw "No se encontro quarkus-run.jar. Ejecuta primero el Paso 10."
}
```

### Paso 13 - Levantar PostgreSQL

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

Resultado esperado:

```text
dispatch_db:5432 - accepting connections
```

### Paso 14 - Configurar variables del servicio

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

### Paso 15 - Arrancar el servicio

```powershell
$app = Start-Process `
  -FilePath "java" `
  -ArgumentList @("-jar", $jarPath) `
  -WindowStyle Hidden `
  -PassThru
```

Verificar que este listo:

```powershell
curl.exe -i -S "http://localhost:$httpPort/q/health/ready"
curl.exe -i -S "http://localhost:$httpPort/api/v1/dispatch/health"
```

Resultado esperado:

```text
HTTP/1.1 200 OK
```

### Paso 16 - Preparar variables HTTP

```powershell
$baseUrl = "http://localhost:$httpPort/api/v1/dispatch"
$actorId = "00000000-0000-0000-0000-000000000024"
$correlationId = "00000000-0000-0000-0000-000000000224"
```

Nota para PowerShell:

```text
La forma mas estable de enviar JSON con curl.exe es guardar el body en un archivo temporal y usar --data-binary "@archivo.json".
Esto evita problemas de comillas y evita que PowerShell deje la consola en `>>`.
```

## Peticiones HTTP/HTTPS listas con curl.exe

### Ver layout seed de 25 asientos

```powershell
$seedPage = curl.exe -sS -X GET "$baseUrl/seat-layouts?q=Legacy%2025%20asientos&active=true&page=1&page_size=10" |
  ConvertFrom-Json

$seedLayoutId = $seedPage.data[0].id
$seedLayoutId
```

### Crear terminal origen

```powershell
$originBody = @{
  legacy_id = 2401
  local_code = "D24O"
  name = "Terminal Origen Dia 24"
  manager_name = "Operador Origen"
  address = "Av. Origen"
  phone = "022400001"
  email = "origen24@example.local"
} | ConvertTo-Json -Compress

$originBodyPath = Join-Path $env:TEMP "dispatch-d24-origin.json"
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
  legacy_id = 2402
  local_code = "D24D"
  name = "Terminal Destino Dia 24"
  manager_name = "Operador Destino"
  address = "Av. Destino"
  phone = "022400002"
  email = "destino24@example.local"
} | ConvertTo-Json -Compress

$destinationBodyPath = Join-Path $env:TEMP "dispatch-d24-destination.json"
$destinationBody | Set-Content -LiteralPath $destinationBodyPath -Encoding ascii

$destination = curl.exe -sS -X POST "$baseUrl/terminals" `
  -H "Content-Type: application/json" `
  -H "X-Actor-User-Id: $actorId" `
  -H "X-Correlation-Id: $correlationId" `
  --data-binary "@$destinationBodyPath" |
  ConvertFrom-Json

$destination
```

### Crear ruta

```powershell
$routeBody = @{
  origin_terminal_id = $origin.id
  destination_terminal_id = $destination.id
  name = "Ruta Dia 24"
} | ConvertTo-Json -Compress

$routeBodyPath = Join-Path $env:TEMP "dispatch-d24-route.json"
$routeBody | Set-Content -LiteralPath $routeBodyPath -Encoding ascii

$route = curl.exe -sS -X POST "$baseUrl/routes" `
  -H "Content-Type: application/json" `
  -H "X-Actor-User-Id: $actorId" `
  -H "X-Correlation-Id: $correlationId" `
  --data-binary "@$routeBodyPath" |
  ConvertFrom-Json

$route
```

### Crear tipo de bus

```powershell
$busTypeBody = @{
  legacy_id = 2401
  name = "Tipo Dia 24"
  description = "Tipo para validar salidas"
} | ConvertTo-Json -Compress

$busTypeBodyPath = Join-Path $env:TEMP "dispatch-d24-bus-type.json"
$busTypeBody | Set-Content -LiteralPath $busTypeBodyPath -Encoding ascii

$busType = curl.exe -sS -X POST "$baseUrl/bus-types" `
  -H "Content-Type: application/json" `
  -H "X-Actor-User-Id: $actorId" `
  -H "X-Correlation-Id: $correlationId" `
  --data-binary "@$busTypeBodyPath" |
  ConvertFrom-Json

$busType
```

### Crear bus

```powershell
$busBody = @{
  legacy_id = 2401
  code = "BUS-D24-001"
  plate = "PBD-2401"
  description = "Unidad para salidas Dia 24"
  default_destination = "Destino Dia 24"
  bus_type_id = $busType.id
  terminal_id = $origin.id
  seat_layout_id = $seedLayoutId
} | ConvertTo-Json -Compress

$busBodyPath = Join-Path $env:TEMP "dispatch-d24-bus.json"
$busBody | Set-Content -LiteralPath $busBodyPath -Encoding ascii

$bus = curl.exe -sS -X POST "$baseUrl/buses" `
  -H "Content-Type: application/json" `
  -H "X-Actor-User-Id: $actorId" `
  -H "X-Correlation-Id: $correlationId" `
  --data-binary "@$busBodyPath" |
  ConvertFrom-Json

$bus
```

### Programar salida

```powershell
$departureAt = (Get-Date).ToUniversalTime().AddDays(2).ToString("yyyy-MM-ddTHH:mm:ssZ")

$departureBody = @{
  legacy_id = 2401
  bus_id = $bus.id
  route_id = $route.id
  departure_at = $departureAt
  notes = "Salida validada Dia 24"
} | ConvertTo-Json -Compress

$departureBodyPath = Join-Path $env:TEMP "dispatch-d24-departure.json"
$departureBody | Set-Content -LiteralPath $departureBodyPath -Encoding ascii

$departure = curl.exe -sS -X POST "$baseUrl/departures" `
  -H "Content-Type: application/json" `
  -H "X-Actor-User-Id: $actorId" `
  -H "X-Correlation-Id: $correlationId" `
  --data-binary "@$departureBodyPath" |
  ConvertFrom-Json

$departure
```

Resultado esperado:

```text
status = SCHEDULED
```

### Probar conflicto de horario

Debe devolver HTTP 409 porque el mismo bus ya tiene una salida en la misma fecha/hora:

```powershell
$duplicateDepartureBody = @{
  legacy_id = 2402
  bus_id = $bus.id
  route_id = $route.id
  departure_at = $departureAt
  notes = "Conflicto mismo bus y horario"
} | ConvertTo-Json -Compress

$duplicateDepartureBodyPath = Join-Path $env:TEMP "dispatch-d24-duplicate-departure.json"
$duplicateDepartureBody | Set-Content -LiteralPath $duplicateDepartureBodyPath -Encoding ascii

curl.exe -i -S -X POST "$baseUrl/departures" `
  -H "Content-Type: application/json" `
  -H "X-Actor-User-Id: $actorId" `
  -H "X-Correlation-Id: $correlationId" `
  --data-binary "@$duplicateDepartureBodyPath"
```

### Probar fecha pasada

Debe devolver HTTP 400:

```powershell
$pastDepartureAt = (Get-Date).ToUniversalTime().AddDays(-1).ToString("yyyy-MM-ddTHH:mm:ssZ")

$pastDepartureBody = @{
  legacy_id = 2403
  bus_id = $bus.id
  route_id = $route.id
  departure_at = $pastDepartureAt
  notes = "Fecha pasada"
} | ConvertTo-Json -Compress

$pastDepartureBodyPath = Join-Path $env:TEMP "dispatch-d24-past-departure.json"
$pastDepartureBody | Set-Content -LiteralPath $pastDepartureBodyPath -Encoding ascii

curl.exe -i -S -X POST "$baseUrl/departures" `
  -H "Content-Type: application/json" `
  -H "X-Actor-User-Id: $actorId" `
  -H "X-Correlation-Id: $correlationId" `
  --data-binary "@$pastDepartureBodyPath"
```

### Listar salidas por bus, estado y rango de fechas

```powershell
$dateFrom = (Get-Date).AddDays(1).ToString("yyyy-MM-dd")
$dateTo = (Get-Date).AddDays(5).ToString("yyyy-MM-dd")

curl.exe -sS -X GET "$baseUrl/departures?bus_id=$($bus.id)&status=SCHEDULED&date_from=$dateFrom&date_to=$dateTo&page=1&page_size=10"
```

### Obtener salida por ID

```powershell
curl.exe -sS -X GET "$baseUrl/departures/$($departure.id)"
```

### Actualizar salida

```powershell
$updatedDepartureAt = (Get-Date).ToUniversalTime().AddDays(3).ToString("yyyy-MM-ddTHH:mm:ssZ")

$updateDepartureBody = @{
  departure_at = $updatedDepartureAt
  notes = "Salida actualizada Dia 24"
} | ConvertTo-Json -Compress

$updateDepartureBodyPath = Join-Path $env:TEMP "dispatch-d24-update-departure.json"
$updateDepartureBody | Set-Content -LiteralPath $updateDepartureBodyPath -Encoding ascii

$departure = curl.exe -sS -X PATCH "$baseUrl/departures/$($departure.id)" `
  -H "Content-Type: application/json" `
  -H "X-Actor-User-Id: $actorId" `
  -H "X-Correlation-Id: $correlationId" `
  --data-binary "@$updateDepartureBodyPath" |
  ConvertFrom-Json

$departure
```

### Cancelar salida con motivo

```powershell
$cancelBody = @{
  reason = "Cancelacion validada Dia 24"
} | ConvertTo-Json -Compress

$cancelBodyPath = Join-Path $env:TEMP "dispatch-d24-cancel-departure.json"
$cancelBody | Set-Content -LiteralPath $cancelBodyPath -Encoding ascii

$cancelledDeparture = curl.exe -sS -X POST "$baseUrl/departures/$($departure.id)/cancel" `
  -H "Content-Type: application/json" `
  -H "X-Actor-User-Id: $actorId" `
  -H "X-Correlation-Id: $correlationId" `
  --data-binary "@$cancelBodyPath" |
  ConvertFrom-Json

$cancelledDeparture.status
$cancelledDeparture.cancellation_reason
```

Resultado esperado:

```text
CANCELLED
Cancelacion validada Dia 24
```

### Programar segunda salida y cancelar con DELETE

```powershell
$secondDepartureAt = (Get-Date).ToUniversalTime().AddDays(4).ToString("yyyy-MM-ddTHH:mm:ssZ")

$secondDepartureBody = @{
  legacy_id = 2405
  bus_id = $bus.id
  route_id = $route.id
  departure_at = $secondDepartureAt
  notes = "Salida para cancelar con DELETE"
} | ConvertTo-Json -Compress

$secondDepartureBodyPath = Join-Path $env:TEMP "dispatch-d24-second-departure.json"
$secondDepartureBody | Set-Content -LiteralPath $secondDepartureBodyPath -Encoding ascii

$secondDeparture = curl.exe -sS -X POST "$baseUrl/departures" `
  -H "Content-Type: application/json" `
  -H "X-Actor-User-Id: $actorId" `
  -H "X-Correlation-Id: $correlationId" `
  --data-binary "@$secondDepartureBodyPath" |
  ConvertFrom-Json

curl.exe -i -S -X DELETE "$baseUrl/departures/$($secondDeparture.id)" `
  -H "X-Actor-User-Id: $actorId" `
  -H "X-Correlation-Id: $correlationId"

curl.exe -sS -X GET "$baseUrl/departures/$($secondDeparture.id)"
```

Resultado esperado:

```text
DELETE responde HTTP 204.
El GET posterior muestra status = CANCELLED.
```

### Ver OpenAPI generado

```powershell
curl.exe -sS "http://localhost:$httpPort/q/openapi"
```

### Abrir Swagger UI

```powershell
Start-Process "http://localhost:$httpPort/q/swagger-ui"
```

## Verificacion SQL

Ver tablas:

```powershell
docker exec -e PGPASSWORD=$pgPassword $container `
  psql -U postgres -d dispatch_db -c "\dt"
```

Ver salidas:

```powershell
docker exec -e PGPASSWORD=$pgPassword $container `
  psql -U postgres -d dispatch_db -c "select legacy_id, bus_id, route_id, departure_at, status, cancellation_reason from departures order by departure_at;"
```

Contar salidas:

```powershell
docker exec -e PGPASSWORD=$pgPassword $container `
  psql -U postgres -d dispatch_db -tAc "select count(*) from departures;"
```

Ver eventos de salidas:

```powershell
docker exec -e PGPASSWORD=$pgPassword $container `
  psql -U postgres -d dispatch_db -c "select event_type, resource_type, status, occurred_at from outbox_events where event_type in ('DepartureScheduled','DEPARTURE_UPDATED','DEPARTURE_CANCELLED') order by occurred_at;"
```

Contar `DepartureScheduled`:

```powershell
docker exec -e PGPASSWORD=$pgPassword $container `
  psql -U postgres -d dispatch_db -tAc "select count(*) from outbox_events where event_type = 'DepartureScheduled';"
```

Resultado esperado despues de la secuencia:

```text
departures = 2
DepartureScheduled = 2
eventos de salida >= 5
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
Get-NetTCPConnection -LocalPort 18087,55439 -ErrorAction SilentlyContinue
docker ps -a --filter "name=venta-pasajes-dispatch-departures" --format "{{.Names}}"
```

## Publicacion o despliegue

No se publico imagen ni se desplego en GCP durante este dia.

El objetivo del Dia 24 fue dejar salidas programadas funcionales en local, con pruebas automatizadas y validacion contra PostgreSQL temporal.

## Comandos ejecutados durante la practica

```powershell
Select-String -Path .\tareas.md -Pattern "Dia 24|Salidas programadas" -Context 0,22
Get-Content .\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\persistence\entity\Departure.java
Get-Content .\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\domain\DepartureStatus.java
Get-Content .\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\persistence\entity\DispatchRoute.java
Get-ChildItem .\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\dto | Select-Object Name,Length | Sort-Object Name | Format-Table -AutoSize
mvn -f .\services\dispatch-service\pom.xml test
mvn -f .\services\dispatch-service\pom.xml package -DskipTests "-Dquarkus.package.output-directory=quarkus-app-day24"
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-dispatch-departures.ps1 -DatabasePort 55439 -HttpPort 18087
Get-Content .\docs\openapi\dispatch-service.openapi.yaml
Get-Content .\services\dispatch-service\README.md
```

Comandos importantes dentro de `verify-dispatch-departures.ps1`:

```powershell
docker run --rm --name $ContainerName -e POSTGRES_DB=dispatch_db -e POSTGRES_USER=postgres -e "POSTGRES_PASSWORD=<temporary-local-password>" -p "$DatabasePort`:5432" -d postgres:16-alpine
docker exec $ContainerName pg_isready -U postgres -d dispatch_db
Start-Process -FilePath "java" -ArgumentList @("-jar", $ResolvedJarPath) -WindowStyle Hidden -PassThru
Invoke-RestMethod -Uri "http://localhost:$HttpPort/q/health/ready"
Invoke-RestMethod -Uri "http://localhost:$HttpPort/api/v1/dispatch/terminals" -Method Post
Invoke-RestMethod -Uri "http://localhost:$HttpPort/api/v1/dispatch/routes" -Method Post
Invoke-RestMethod -Uri "http://localhost:$HttpPort/api/v1/dispatch/bus-types" -Method Post
Invoke-RestMethod -Uri "http://localhost:$HttpPort/api/v1/dispatch/buses" -Method Post
Invoke-RestMethod -Uri "http://localhost:$HttpPort/api/v1/dispatch/departures" -Method Post
Invoke-RestMethod -Uri "http://localhost:$HttpPort/api/v1/dispatch/departures/<departure-id>" -Method Patch
Invoke-RestMethod -Uri "http://localhost:$HttpPort/api/v1/dispatch/departures/<departure-id>/cancel" -Method Post
Invoke-RestMethod -Uri "http://localhost:$HttpPort/api/v1/dispatch/departures/<departure-id>" -Method Delete
docker exec -e "PGPASSWORD=<temporary-local-password>" $ContainerName psql -U postgres -d dispatch_db -tAc "select count(*) from outbox_events where event_type in ('DepartureScheduled','DEPARTURE_UPDATED','DEPARTURE_CANCELLED');"
docker exec -e "PGPASSWORD=<temporary-local-password>" $ContainerName psql -U postgres -d dispatch_db -tAc "select count(*) from outbox_events where event_type = 'DepartureScheduled';"
Stop-Process -Id $AppProcess.Id -Force
docker stop $ContainerName
```

## Problemas encontrados y soluciones

### Problema 1 - Salidas dependen de datos de dias anteriores

Una salida no puede existir sola:

```text
Salida -> bus -> tipo de bus + terminal + layout
Salida -> ruta -> terminal origen + terminal destino
```

Solucion:

```text
El script de validacion crea todos los datos base en una base temporal antes de programar salidas.
```

### Problema 2 - Conflicto de horario

El indice unico de la base protege:

```text
bus_id + departure_at
```

Solo para estados:

```text
SCHEDULED
CLOSED
```

El servicio tambien valida esta regla antes de persistir y devuelve:

```text
HTTP 409 Conflict
```

### Problema 3 - Cancelacion no borra

Borrar fisicamente una salida podria romper historico, boletos o auditoria.

Solucion:

```text
DELETE /departures/{departureId} cambia status a CANCELLED.
POST /departures/{departureId}/cancel permite cancelar con motivo.
```

### Problema 4 - Evento `DepartureScheduled`

No se conecto todavia un broker externo.

Solucion:

```text
Al programar una salida se registra `DepartureScheduled` en `outbox_events`.
Luego otro componente podra tomar ese outbox y publicarlo a mensajeria real.
```

## Estado final

```text
Dia 24 completado.
La API de salidas programadas esta implementada.
El evento DepartureScheduled se registra en outbox_events.
Se pueden programar viajes.
```

Siguiente paso natural:

```text
Dia 25 - mfe-dispatch.
```
