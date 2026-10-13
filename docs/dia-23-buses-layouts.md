# Dia 23 - Tipos de bus, buses y layouts

Fecha de practica: 2026-09-09

## Objetivo

Implementar en `dispatch-service` la administracion de flota base:

```text
- CRUD de tipos de bus.
- CRUD de buses.
- CRUD de layouts de asientos.
- Validacion de cantidad y numeracion de asientos.
- Layout base de 25 asientos equivalente al sistema VB6.
```

El criterio de avance del dia es:

```text
El sistema puede modelar buses sin botones fijos.
```

## Resultado alcanzado

Se agregaron APIs reales para tipos de bus, layouts de asientos y buses.

Endpoints agregados:

```text
GET    /api/v1/dispatch/bus-types
POST   /api/v1/dispatch/bus-types
GET    /api/v1/dispatch/bus-types/{busTypeId}
PATCH  /api/v1/dispatch/bus-types/{busTypeId}
DELETE /api/v1/dispatch/bus-types/{busTypeId}

GET    /api/v1/dispatch/seat-layouts
POST   /api/v1/dispatch/seat-layouts
GET    /api/v1/dispatch/seat-layouts/{seatLayoutId}
PATCH  /api/v1/dispatch/seat-layouts/{seatLayoutId}
DELETE /api/v1/dispatch/seat-layouts/{seatLayoutId}

GET    /api/v1/dispatch/buses
POST   /api/v1/dispatch/buses
GET    /api/v1/dispatch/buses/{busId}
PATCH  /api/v1/dispatch/buses/{busId}
DELETE /api/v1/dispatch/buses/{busId}
```

Validaciones implementadas:

```text
- Tipo de bus con nombre obligatorio.
- Tipo de bus no duplicado por nombre.
- Tipo de bus no duplicado por legacy_id.
- Layout con nombre obligatorio.
- Layout no duplicado por nombre.
- Layout con al menos un asiento.
- Layout con maximo 80 asientos.
- Layout sin numeros de asiento repetidos.
- Layout sin coordenadas repetidas.
- Layout con numeracion consecutiva desde 1 hasta seat_count.
- Bus con codigo obligatorio.
- Bus con placa obligatoria.
- Bus no duplicado por codigo.
- Bus no duplicado por placa.
- Bus no duplicado por legacy_id.
- Bus solo puede usar terminal, tipo de bus y layout activos.
- No se puede cambiar la definicion de asientos de un layout usado por buses activos.
- No se puede desactivar un layout usado por buses activos.
- No se puede desactivar un tipo de bus usado por buses activos.
- No se puede desactivar un bus usado por salidas programadas o cerradas.
```

Layout inicial agregado por Flyway:

```text
Nombre: Legacy 25 asientos
ID fijo: 00000000-0000-0000-0000-000000000025
Cantidad: 25
```

La posicion de los 25 asientos se obtuvo del formulario legacy:

```text
C:\VENTA-DE-PASAJES\legacy\AsientosForm.frm
```

Resultado de pruebas unitarias:

```text
Tests run: 19, Failures: 0, Errors: 0, Skipped: 0
BUILD SUCCESS
```

Resultado de validacion practica con PostgreSQL temporal:

```json
{"service":"dispatch-service","validation":"buses-layouts-crud","quarkus_profile":"onprem","secrets_provider":"env","database":"dispatch_db","database_port":55438,"http_port":18086,"jar":"C:\\VENTA-DE-PASAJES\\services\\dispatch-service\\target\\quarkus-app-day23\\quarkus-run.jar","seed_layout":"Legacy 25 asientos","seed_seats":25,"inactive_buses":1,"audit_events":11,"invalid_layout_status":400,"duplicate_bus_type_status":409,"duplicate_bus_status":409,"layout_in_use_status":409,"ready":true}
```

## Archivos creados o modificados

| Archivo | Proposito |
| --- | --- |
| `C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\BusTypeResource.java` | API REST de tipos de bus. |
| `C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\SeatLayoutResource.java` | API REST de layouts de asientos. |
| `C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\BusResource.java` | API REST de buses. |
| `C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\dto\BusTypeCreateRequest.java` | Entrada para crear tipo de bus. |
| `C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\dto\BusTypeUpdateRequest.java` | Entrada para actualizar tipo de bus. |
| `C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\dto\BusTypeResponse.java` | Salida de tipo de bus. |
| `C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\dto\SeatDefinitionRequest.java` | Entrada para definir un asiento dentro de un layout. |
| `C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\dto\SeatDefinitionResponse.java` | Salida de asiento dentro de un layout. |
| `C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\dto\SeatLayoutCreateRequest.java` | Entrada para crear layout. |
| `C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\dto\SeatLayoutUpdateRequest.java` | Entrada para actualizar layout. |
| `C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\dto\SeatLayoutResponse.java` | Salida de layout. |
| `C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\dto\BusCreateRequest.java` | Entrada para crear bus. |
| `C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\dto\BusUpdateRequest.java` | Entrada para actualizar bus. |
| `C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\dto\BusResponse.java` | Salida de bus. |
| `C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\service\BusFleetService.java` | Reglas de negocio de tipos de bus, layouts y buses. |
| `C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\resources\db\migration\V2__dispatch_seed_legacy_25_seat_layout.sql` | Seed Flyway del layout legacy de 25 asientos. |
| `C:\VENTA-DE-PASAJES\services\dispatch-service\src\test\java\com\ventapasajes\dispatch\service\BusFleetServiceTest.java` | Pruebas unitarias de validacion de layouts. |
| `C:\VENTA-DE-PASAJES\services\dispatch-service\src\test\java\com\ventapasajes\dispatch\persistence\DispatchMigrationContractTest.java` | Verificacion de migracion V1 y seed V2. |
| `C:\VENTA-DE-PASAJES\services\dispatch-service\src\test\java\com\ventapasajes\dispatch\api\DispatchHealthResourceTest.java` | Verificacion de OpenAPI generado con endpoints nuevos. |
| `C:\VENTA-DE-PASAJES\scripts\verify-dispatch-buses-layouts.ps1` | Validacion real con PostgreSQL temporal. |
| `C:\VENTA-DE-PASAJES\docs\openapi\dispatch-service.openapi.yaml` | Contrato OpenAPI estatico actualizado. |
| `C:\VENTA-DE-PASAJES\services\dispatch-service\README.md` | Guia corta del servicio actualizada. |

## Reversa primero

Usar esta seccion solo si se desea limpiar la practica local o retirar el avance del Dia 23.

### Detener servicio local

Ver procesos escuchando en los puertos usados durante la practica:

```powershell
Get-NetTCPConnection -LocalPort 18086,55438 -ErrorAction SilentlyContinue |
  Select-Object LocalAddress,LocalPort,State,OwningProcess |
  Format-Table -AutoSize
```

Si aparece un proceso Java del `dispatch-service` en `18086`, obtener detalle:

```powershell
$pidDispatch = (Get-NetTCPConnection -LocalPort 18086 -State Listen -ErrorAction SilentlyContinue).OwningProcess
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
docker ps -a --filter "name=venta-pasajes-dispatch-buses-layouts" --format "{{.Names}}"
```

Detener uno si quedo vivo:

```powershell
docker stop <container-name>
```

### Revertir datos del Dia 23 en una base manual

Advertencia:

```text
No ejecutar estos comandos en produccion.
Solo usarlos en una base local o temporal creada para practicar.
```

Si se desea eliminar el layout seed de 25 asientos de una base local:

```powershell
docker exec -e PGPASSWORD=<temporary-local-password> <container-name> `
  psql -U postgres -d dispatch_db -c "delete from seat_layout_seats where seat_layout_id = '00000000-0000-0000-0000-000000000025';"

docker exec -e PGPASSWORD=<temporary-local-password> <container-name> `
  psql -U postgres -d dispatch_db -c "delete from seat_layouts where id = '00000000-0000-0000-0000-000000000025';"
```

Si se quiere que Flyway pueda volver a ejecutar la migracion V2 en esa misma base local:

```powershell
docker exec -e PGPASSWORD=<temporary-local-password> <container-name> `
  psql -U postgres -d dispatch_db -c "delete from flyway_schema_history where version = '2';"
```

Confirmar que el seed ya no existe:

```powershell
docker exec -e PGPASSWORD=<temporary-local-password> <container-name> `
  psql -U postgres -d dispatch_db -tAc "select count(*) from seat_layouts where name = 'Legacy 25 asientos';"
```

Resultado esperado si se retiro:

```text
0
```

### Limpiar artefactos generados

Los artefactos Maven se pueden reconstruir:

```powershell
mvn -f .\services\dispatch-service\pom.xml clean
```

Si solo se desea quitar la salida alternativa del Dia 23:

```powershell
Remove-Item -LiteralPath .\services\dispatch-service\target\quarkus-app-day23 -Recurse -Force
```

### Deshacer archivos fuente del Dia 23

Solo hacerlo si realmente se quiere volver al estado del Dia 22. En un repositorio con Git, restaurar desde control de versiones. Si no hay Git, eliminar estos archivos implica perder el avance del Dia 23.

Archivos propios del Dia 23:

```text
BusTypeResource.java
SeatLayoutResource.java
BusResource.java
BusTypeCreateRequest.java
BusTypeUpdateRequest.java
BusTypeResponse.java
SeatDefinitionRequest.java
SeatDefinitionResponse.java
SeatLayoutCreateRequest.java
SeatLayoutUpdateRequest.java
SeatLayoutResponse.java
BusCreateRequest.java
BusUpdateRequest.java
BusResponse.java
BusFleetService.java
V2__dispatch_seed_legacy_25_seat_layout.sql
BusFleetServiceTest.java
verify-dispatch-buses-layouts.ps1
dia-23-buses-layouts.md
```

Verificacion de limpieza:

```powershell
Get-NetTCPConnection -LocalPort 18086,55438 -ErrorAction SilentlyContinue
docker ps -a --filter "name=venta-pasajes-dispatch-buses-layouts" --format "{{.Names}}"
```

Ambos comandos no deberian devolver resultados si todo quedo limpio.

## Guia manual desde cero

### Paso 1 - Ubicarse en el proyecto

```powershell
cd C:\VENTA-DE-PASAJES
```

### Paso 2 - Confirmar prerequisitos

Verificar Java, Maven y Docker:

```powershell
java -version
mvn -version
docker version
```

Verificar base del servicio:

```powershell
Test-Path .\services\dispatch-service\pom.xml
Test-Path .\services\dispatch-service\src\main\resources\db\migration\V1__dispatch_schema.sql
Test-Path .\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\persistence\entity\Bus.java
Test-Path .\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\persistence\entity\SeatLayout.java
Test-Path .\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\persistence\entity\SeatLayoutSeat.java
```

Resultado esperado:

```text
True
True
True
True
True
```

### Paso 3 - Entender los objetos que se agregan

`bus_types` representa categorias de bus:

```text
Ejemplos: Interprovincial, Ejecutivo, Escolar, Turismo.
```

`seat_layouts` representa una plantilla de distribucion de asientos:

```text
Ejemplo: Legacy 25 asientos.
```

`seat_layout_seats` representa cada asiento dentro de esa plantilla:

```text
seat_number: numero visible del asiento.
row_number: fila visual.
column_number: columna visual.
position: WINDOW, AISLE, MIDDLE, DRIVER o BLOCKED.
```

`buses` representa unidades fisicas:

```text
code: codigo interno del bus.
plate: placa o matricula.
bus_type_id: tipo de bus.
terminal_id: terminal donde pertenece u opera.
seat_layout_id: plantilla de asientos que usa.
```

### Paso 4 - Revisar el layout fijo del VB6

El sistema legacy tenia botones fijos para los asientos:

```powershell
Select-String -Path .\legacy\AsientosForm.frm -Pattern "Begin VB.CommandButton Cmd|Caption|Left|Top" |
  Select-Object -First 120
```

La migracion ya no debe depender de botones fijos. Por eso se modela el layout en tablas:

```text
seat_layouts
seat_layout_seats
```

### Paso 5 - Crear DTOs de tipos de bus

Crear o verificar estos archivos:

```powershell
Test-Path .\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\dto\BusTypeCreateRequest.java
Test-Path .\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\dto\BusTypeUpdateRequest.java
Test-Path .\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\dto\BusTypeResponse.java
```

Campos esperados:

```text
legacyId
name
description
active
```

Por configuracion Jackson, en JSON se usan nombres como:

```json
{
  "legacy_id": 2301,
  "name": "Interprovincial",
  "description": "Bus para rutas interprovinciales",
  "active": true
}
```

### Paso 6 - Crear DTOs de layouts

Crear o verificar:

```powershell
Test-Path .\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\dto\SeatDefinitionRequest.java
Test-Path .\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\dto\SeatDefinitionResponse.java
Test-Path .\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\dto\SeatLayoutCreateRequest.java
Test-Path .\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\dto\SeatLayoutUpdateRequest.java
Test-Path .\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\dto\SeatLayoutResponse.java
```

Ejemplo JSON esperado:

```json
{
  "name": "Manual 4 asientos",
  "seats": [
    { "seat_number": 1, "label": "1", "row_number": 1, "column_number": 1, "position": "WINDOW" },
    { "seat_number": 2, "label": "2", "row_number": 1, "column_number": 2, "position": "AISLE" }
  ]
}
```

### Paso 7 - Crear DTOs de buses

Crear o verificar:

```powershell
Test-Path .\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\dto\BusCreateRequest.java
Test-Path .\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\dto\BusUpdateRequest.java
Test-Path .\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\dto\BusResponse.java
```

Ejemplo JSON esperado:

```json
{
  "legacy_id": 2301,
  "code": "BUS-D23-001",
  "plate": "PBD-2301",
  "description": "Unidad validada Dia 23",
  "default_destination": "Guayaquil",
  "bus_type_id": "<bus-type-id>",
  "terminal_id": "<terminal-id>",
  "seat_layout_id": "<seat-layout-id>"
}
```

### Paso 8 - Crear recursos REST

Crear o verificar:

```powershell
Test-Path .\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\BusTypeResource.java
Test-Path .\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\SeatLayoutResource.java
Test-Path .\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\BusResource.java
```

Cada resource debe recibir headers de auditoria:

```text
X-Actor-User-Id
X-Correlation-Id
```

Estos headers son opcionales por ahora. Luego podran venir del JWT interno.

### Paso 9 - Crear servicio de negocio

Crear o verificar:

```powershell
Test-Path .\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\service\BusFleetService.java
```

Responsabilidades:

```text
- Listar, crear, obtener, actualizar y desactivar tipos de bus.
- Listar, crear, obtener, actualizar y desactivar layouts.
- Listar, crear, obtener, actualizar y desactivar buses.
- Validar duplicados.
- Validar asientos.
- Proteger layouts y tipos de bus que estan siendo usados.
- Registrar eventos en outbox_events.
```

Eventos registrados:

```text
BUS_TYPE_CREATED
BUS_TYPE_UPDATED
BUS_TYPE_DEACTIVATED
SEAT_LAYOUT_CREATED
SEAT_LAYOUT_UPDATED
SEAT_LAYOUT_DEACTIVATED
BUS_CREATED
BUS_UPDATED
BUS_DEACTIVATED
```

### Paso 10 - Crear migracion Flyway del layout legacy

Crear o verificar:

```powershell
Test-Path .\services\dispatch-service\src\main\resources\db\migration\V2__dispatch_seed_legacy_25_seat_layout.sql
```

Ver fragmentos principales:

```powershell
Select-String -Path .\services\dispatch-service\src\main\resources\db\migration\V2__dispatch_seed_legacy_25_seat_layout.sql -Pattern "Legacy 25 asientos|00000000-0000-0000-0000-000000000025|25, '25'"
```

Resultado esperado:

```text
Debe aparecer el nombre Legacy 25 asientos.
Debe aparecer el ID fijo 00000000-0000-0000-0000-000000000025.
Debe aparecer el asiento 25.
```

### Paso 11 - Crear pruebas unitarias

Crear o verificar:

```powershell
Test-Path .\services\dispatch-service\src\test\java\com\ventapasajes\dispatch\service\BusFleetServiceTest.java
```

Actualizar estas pruebas existentes:

```powershell
Test-Path .\services\dispatch-service\src\test\java\com\ventapasajes\dispatch\persistence\DispatchMigrationContractTest.java
Test-Path .\services\dispatch-service\src\test\java\com\ventapasajes\dispatch\api\DispatchHealthResourceTest.java
```

Cobertura agregada:

```text
- Layout con numeracion consecutiva aceptado.
- Labels se normalizan.
- Layout sin numero consecutivo se rechaza.
- Layout con asiento duplicado se rechaza.
- Layout con coordenada duplicada se rechaza.
- Layout con fila, columna o posicion invalida se rechaza.
- Migracion V2 contiene el seed Legacy 25 asientos.
- OpenAPI generado incluye bus-types, seat-layouts y buses.
```

### Paso 12 - Ejecutar pruebas Maven

```powershell
mvn -f .\services\dispatch-service\pom.xml test
```

Resultado esperado:

```text
Tests run: 19, Failures: 0, Errors: 0, Skipped: 0
BUILD SUCCESS
```

### Paso 13 - Empaquetar el servicio

Intento normal:

```powershell
mvn -f .\services\dispatch-service\pom.xml package -DskipTests
```

Si termina en `BUILD SUCCESS`, el artefacto queda en:

```text
C:\VENTA-DE-PASAJES\services\dispatch-service\target\quarkus-app\quarkus-run.jar
```

Verificar:

```powershell
Test-Path .\services\dispatch-service\target\quarkus-app\quarkus-run.jar
```

Si Windows tiene bloqueado `target\quarkus-app`, crear una salida alternativa:

```powershell
mvn -f .\services\dispatch-service\pom.xml package -DskipTests "-Dquarkus.package.output-directory=quarkus-app-day23"
```

Verificar salida alternativa:

```powershell
Test-Path .\services\dispatch-service\target\quarkus-app-day23\quarkus-run.jar
```

### Paso 14 - Ejecutar validacion automatica

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-dispatch-buses-layouts.ps1 `
  -DatabasePort 55438 `
  -HttpPort 18086
```

Resultado esperado:

```json
{"service":"dispatch-service","validation":"buses-layouts-crud","seed_layout":"Legacy 25 asientos","seed_seats":25,"inactive_buses":1,"audit_events":11,"invalid_layout_status":400,"duplicate_bus_type_status":409,"duplicate_bus_status":409,"layout_in_use_status":409,"ready":true}
```

## Validacion manual con PostgreSQL temporal

### Paso 15 - Crear variables locales

```powershell
$dbPort = 55438
$httpPort = 18086
$container = "venta-pasajes-dispatch-buses-layouts-manual"
$pgPassword = [Convert]::ToBase64String(([guid]::NewGuid()).ToByteArray()).TrimEnd("=")
$normalJarPath = "C:\VENTA-DE-PASAJES\services\dispatch-service\target\quarkus-app\quarkus-run.jar"
$alternateJarPath = "C:\VENTA-DE-PASAJES\services\dispatch-service\target\quarkus-app-day23\quarkus-run.jar"

if (Test-Path $normalJarPath) {
  $jarPath = $normalJarPath
} elseif (Test-Path $alternateJarPath) {
  $jarPath = $alternateJarPath
} else {
  throw "No se encontro quarkus-run.jar. Ejecuta primero el Paso 13."
}
```

### Paso 16 - Levantar PostgreSQL

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

### Paso 17 - Configurar variables del servicio

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

### Paso 18 - Arrancar el servicio

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

### Paso 19 - Preparar variables HTTP

```powershell
$baseUrl = "http://localhost:$httpPort/api/v1/dispatch"
$actorId = "00000000-0000-0000-0000-000000000023"
$correlationId = "00000000-0000-0000-0000-000000000223"
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

$seedPage
$seedLayoutId = $seedPage.data[0].id
```

Obtener detalle del layout:

```powershell
$seedLayout = curl.exe -sS -X GET "$baseUrl/seat-layouts/$seedLayoutId" |
  ConvertFrom-Json

$seedLayout.name
$seedLayout.seat_count
$seedLayout.seats.Count
$seedLayout.seats | Select-Object seat_number,label,row_number,column_number,position | Format-Table -AutoSize
```

Resultado esperado:

```text
Legacy 25 asientos
25
25
```

### Probar layout invalido

Debe devolver HTTP 400 porque falta el asiento 2:

```powershell
$invalidLayoutBody = @{
  name = "Layout incompleto"
  seats = @(
    @{ seat_number = 1; label = "1"; row_number = 1; column_number = 1; position = "WINDOW" },
    @{ seat_number = 3; label = "3"; row_number = 1; column_number = 2; position = "AISLE" }
  )
} | ConvertTo-Json -Depth 10 -Compress

$invalidLayoutBodyPath = Join-Path $env:TEMP "dispatch-invalid-layout.json"
$invalidLayoutBody | Set-Content -LiteralPath $invalidLayoutBodyPath -Encoding ascii

curl.exe -i -S -X POST "$baseUrl/seat-layouts" `
  -H "Content-Type: application/json" `
  -H "X-Actor-User-Id: $actorId" `
  -H "X-Correlation-Id: $correlationId" `
  --data-binary "@$invalidLayoutBodyPath"
```

### Crear layout manual de 4 asientos

```powershell
$layoutBody = @{
  name = "Manual 4 asientos"
  seats = @(
    @{ seat_number = 1; label = "1"; row_number = 1; column_number = 1; position = "WINDOW" },
    @{ seat_number = 2; label = "2"; row_number = 1; column_number = 2; position = "AISLE" },
    @{ seat_number = 3; label = "3"; row_number = 1; column_number = 4; position = "AISLE" },
    @{ seat_number = 4; label = "4"; row_number = 1; column_number = 5; position = "WINDOW" }
  )
} | ConvertTo-Json -Depth 10 -Compress

$layoutBodyPath = Join-Path $env:TEMP "dispatch-layout.json"
$layoutBody | Set-Content -LiteralPath $layoutBodyPath -Encoding ascii

$customLayout = curl.exe -sS -X POST "$baseUrl/seat-layouts" `
  -H "Content-Type: application/json" `
  -H "X-Actor-User-Id: $actorId" `
  -H "X-Correlation-Id: $correlationId" `
  --data-binary "@$layoutBodyPath" |
  ConvertFrom-Json

$customLayout
```

### Actualizar layout manual a 5 asientos

```powershell
$updateLayoutBody = @{
  name = "Manual 5 asientos"
  seats = @(
    @{ seat_number = 1; label = "1"; row_number = 1; column_number = 1; position = "WINDOW" },
    @{ seat_number = 2; label = "2"; row_number = 1; column_number = 2; position = "AISLE" },
    @{ seat_number = 3; label = "3"; row_number = 1; column_number = 3; position = "MIDDLE" },
    @{ seat_number = 4; label = "4"; row_number = 1; column_number = 4; position = "AISLE" },
    @{ seat_number = 5; label = "5"; row_number = 1; column_number = 5; position = "WINDOW" }
  )
} | ConvertTo-Json -Depth 10 -Compress

$updateLayoutBodyPath = Join-Path $env:TEMP "dispatch-update-layout.json"
$updateLayoutBody | Set-Content -LiteralPath $updateLayoutBodyPath -Encoding ascii

$customLayout = curl.exe -sS -X PATCH "$baseUrl/seat-layouts/$($customLayout.id)" `
  -H "Content-Type: application/json" `
  -H "X-Actor-User-Id: $actorId" `
  -H "X-Correlation-Id: $correlationId" `
  --data-binary "@$updateLayoutBodyPath" |
  ConvertFrom-Json

$customLayout.seat_count
```

### Desactivar layout manual

```powershell
curl.exe -i -S -X DELETE "$baseUrl/seat-layouts/$($customLayout.id)" `
  -H "X-Actor-User-Id: $actorId" `
  -H "X-Correlation-Id: $correlationId"
```

### Crear tipo de bus

```powershell
$busTypeBody = @{
  legacy_id = 2301
  name = "Interprovincial"
  description = "Bus para rutas interprovinciales"
} | ConvertTo-Json -Compress

$busTypeBodyPath = Join-Path $env:TEMP "dispatch-bus-type.json"
$busTypeBody | Set-Content -LiteralPath $busTypeBodyPath -Encoding ascii

$busType = curl.exe -sS -X POST "$baseUrl/bus-types" `
  -H "Content-Type: application/json" `
  -H "X-Actor-User-Id: $actorId" `
  -H "X-Correlation-Id: $correlationId" `
  --data-binary "@$busTypeBodyPath" |
  ConvertFrom-Json

$busType
```

### Probar tipo de bus duplicado

Debe devolver HTTP 409:

```powershell
$duplicateBusTypeBody = @{
  legacy_id = 2302
  name = "interprovincial"
} | ConvertTo-Json -Compress

$duplicateBusTypeBodyPath = Join-Path $env:TEMP "dispatch-duplicate-bus-type.json"
$duplicateBusTypeBody | Set-Content -LiteralPath $duplicateBusTypeBodyPath -Encoding ascii

curl.exe -i -S -X POST "$baseUrl/bus-types" `
  -H "Content-Type: application/json" `
  -H "X-Actor-User-Id: $actorId" `
  -H "X-Correlation-Id: $correlationId" `
  --data-binary "@$duplicateBusTypeBodyPath"
```

### Actualizar tipo de bus

```powershell
$updateBusTypeBody = @{
  description = "Bus interprovincial validado"
} | ConvertTo-Json -Compress

$updateBusTypeBodyPath = Join-Path $env:TEMP "dispatch-update-bus-type.json"
$updateBusTypeBody | Set-Content -LiteralPath $updateBusTypeBodyPath -Encoding ascii

$busType = curl.exe -sS -X PATCH "$baseUrl/bus-types/$($busType.id)" `
  -H "Content-Type: application/json" `
  -H "X-Actor-User-Id: $actorId" `
  -H "X-Correlation-Id: $correlationId" `
  --data-binary "@$updateBusTypeBodyPath" |
  ConvertFrom-Json

$busType
```

### Crear terminal para asociar el bus

```powershell
$terminalBody = @{
  legacy_id = 2301
  local_code = "DAY23"
  name = "Terminal Dia 23"
  manager_name = "Operador Dia 23"
  address = "Av. Dia 23"
  phone = "022300001"
  email = "day23@example.local"
} | ConvertTo-Json -Compress

$terminalBodyPath = Join-Path $env:TEMP "dispatch-day23-terminal.json"
$terminalBody | Set-Content -LiteralPath $terminalBodyPath -Encoding ascii

$terminal = curl.exe -sS -X POST "$baseUrl/terminals" `
  -H "Content-Type: application/json" `
  -H "X-Actor-User-Id: $actorId" `
  -H "X-Correlation-Id: $correlationId" `
  --data-binary "@$terminalBodyPath" |
  ConvertFrom-Json

$terminal
```

### Crear bus usando el layout de 25 asientos

```powershell
$busBody = @{
  legacy_id = 2301
  code = "BUS-D23-001"
  plate = "PBD-2301"
  description = "Unidad validada Dia 23"
  default_destination = "Guayaquil"
  bus_type_id = $busType.id
  terminal_id = $terminal.id
  seat_layout_id = $seedLayoutId
} | ConvertTo-Json -Compress

$busBodyPath = Join-Path $env:TEMP "dispatch-bus.json"
$busBody | Set-Content -LiteralPath $busBodyPath -Encoding ascii

$bus = curl.exe -sS -X POST "$baseUrl/buses" `
  -H "Content-Type: application/json" `
  -H "X-Actor-User-Id: $actorId" `
  -H "X-Correlation-Id: $correlationId" `
  --data-binary "@$busBodyPath" |
  ConvertFrom-Json

$bus
$bus.seat_count
```

Resultado esperado:

```text
25
```

### Listar buses

```powershell
curl.exe -sS -X GET "$baseUrl/buses?page=1&page_size=10"
```

### Buscar bus por placa

```powershell
curl.exe -sS -X GET "$baseUrl/buses?q=PBD-2301&active=true&page=1&page_size=10"
```

### Obtener bus por ID

```powershell
curl.exe -sS -X GET "$baseUrl/buses/$($bus.id)"
```

### Probar bus duplicado

Debe devolver HTTP 409 porque repite el codigo:

```powershell
$duplicateBusBody = @{
  legacy_id = 2302
  code = "bus-d23-001"
  plate = "PBD-2302"
  bus_type_id = $busType.id
  terminal_id = $terminal.id
  seat_layout_id = $seedLayoutId
} | ConvertTo-Json -Compress

$duplicateBusBodyPath = Join-Path $env:TEMP "dispatch-duplicate-bus.json"
$duplicateBusBody | Set-Content -LiteralPath $duplicateBusBodyPath -Encoding ascii

curl.exe -i -S -X POST "$baseUrl/buses" `
  -H "Content-Type: application/json" `
  -H "X-Actor-User-Id: $actorId" `
  -H "X-Correlation-Id: $correlationId" `
  --data-binary "@$duplicateBusBodyPath"
```

### Actualizar bus

```powershell
$updateBusBody = @{
  default_destination = "Cuenca"
  description = "Unidad actualizada Dia 23"
} | ConvertTo-Json -Compress

$updateBusBodyPath = Join-Path $env:TEMP "dispatch-update-bus.json"
$updateBusBody | Set-Content -LiteralPath $updateBusBodyPath -Encoding ascii

$bus = curl.exe -sS -X PATCH "$baseUrl/buses/$($bus.id)" `
  -H "Content-Type: application/json" `
  -H "X-Actor-User-Id: $actorId" `
  -H "X-Correlation-Id: $correlationId" `
  --data-binary "@$updateBusBodyPath" |
  ConvertFrom-Json

$bus.default_destination
```

Resultado esperado:

```text
Cuenca
```

### Probar proteccion del layout en uso

Debe devolver HTTP 409 porque el layout esta siendo usado por un bus activo:

```powershell
$layoutInUseBody = @{
  seats = @(
    @{ seat_number = 1; label = "1"; row_number = 1; column_number = 1; position = "WINDOW" }
  )
} | ConvertTo-Json -Depth 10 -Compress

$layoutInUseBodyPath = Join-Path $env:TEMP "dispatch-layout-in-use.json"
$layoutInUseBody | Set-Content -LiteralPath $layoutInUseBodyPath -Encoding ascii

curl.exe -i -S -X PATCH "$baseUrl/seat-layouts/$seedLayoutId" `
  -H "Content-Type: application/json" `
  -H "X-Actor-User-Id: $actorId" `
  -H "X-Correlation-Id: $correlationId" `
  --data-binary "@$layoutInUseBodyPath"
```

Tambien debe devolver HTTP 409:

```powershell
curl.exe -i -S -X DELETE "$baseUrl/seat-layouts/$seedLayoutId" `
  -H "X-Actor-User-Id: $actorId" `
  -H "X-Correlation-Id: $correlationId"
```

### Desactivar bus

```powershell
curl.exe -i -S -X DELETE "$baseUrl/buses/$($bus.id)" `
  -H "X-Actor-User-Id: $actorId" `
  -H "X-Correlation-Id: $correlationId"
```

### Desactivar tipo de bus

```powershell
curl.exe -i -S -X DELETE "$baseUrl/bus-types/$($busType.id)" `
  -H "X-Actor-User-Id: $actorId" `
  -H "X-Correlation-Id: $correlationId"
```

### Desactivar terminal de prueba

```powershell
curl.exe -i -S -X DELETE "$baseUrl/terminals/$($terminal.id)" `
  -H "X-Actor-User-Id: $actorId" `
  -H "X-Correlation-Id: $correlationId"
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

Ver tablas de flota:

```powershell
docker exec -e PGPASSWORD=$pgPassword $container `
  psql -U postgres -d dispatch_db -c "\dt"
```

Ver layout seed:

```powershell
docker exec -e PGPASSWORD=$pgPassword $container `
  psql -U postgres -d dispatch_db -c "select id, name, seat_count, active from seat_layouts order by name;"
```

Ver asientos del layout seed:

```powershell
docker exec -e PGPASSWORD=$pgPassword $container `
  psql -U postgres -d dispatch_db -c "select seat_number, label, row_number, column_number, position from seat_layout_seats where seat_layout_id = '00000000-0000-0000-0000-000000000025' order by seat_number;"
```

Contar buses:

```powershell
docker exec -e PGPASSWORD=$pgPassword $container `
  psql -U postgres -d dispatch_db -tAc "select count(*) from buses;"
```

Ver eventos de auditoria:

```powershell
docker exec -e PGPASSWORD=$pgPassword $container `
  psql -U postgres -d dispatch_db -c "select event_type, resource_type, status, occurred_at from outbox_events order by occurred_at;"
```

Resultado esperado despues de la secuencia:

```text
seat_layouts >= 2
seed layout = Legacy 25 asientos con 25 asientos
buses = 1
outbox_events >= 10
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
Get-NetTCPConnection -LocalPort 18086,55438 -ErrorAction SilentlyContinue
docker ps -a --filter "name=venta-pasajes-dispatch-buses-layouts" --format "{{.Names}}"
```

## Publicacion o despliegue

No se publico imagen ni se desplego en GCP durante este dia.

El objetivo del Dia 23 fue dejar el dominio de buses y layouts funcional en local, con pruebas automatizadas y validacion contra PostgreSQL temporal.

## Comandos ejecutados durante la practica

```powershell
Get-ChildItem .\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\dto | Select-Object Name,Length,LastWriteTime | Sort-Object Name | Format-Table -AutoSize
Get-ChildItem .\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api | Select-Object Name,Length,LastWriteTime | Sort-Object Name | Format-Table -AutoSize
Get-ChildItem .\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\service | Select-Object Name,Length,LastWriteTime | Sort-Object Name | Format-Table -AutoSize
Get-Content .\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\BusResource.java
Get-Content .\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\BusTypeResource.java
Get-Content .\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\SeatLayoutResource.java
Get-Content .\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\service\TerminalRouteService.java
Get-Content .\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\dto\BusTypeCreateRequest.java
Get-Content .\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\dto\SeatLayoutCreateRequest.java
Get-Content .\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\dto\BusCreateRequest.java
Get-Content .\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\persistence\entity\Bus.java
Get-Content .\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\persistence\entity\SeatLayoutSeat.java
Get-Content .\services\dispatch-service\src\main\resources\db\migration\V1__dispatch_schema.sql
Get-Content .\services\dispatch-service\pom.xml
Get-Content .\scripts\verify-dispatch-terminals-routes.ps1
mvn -f .\services\dispatch-service\pom.xml test
mvn -f .\services\dispatch-service\pom.xml package -DskipTests "-Dquarkus.package.output-directory=quarkus-app-day23"
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-dispatch-buses-layouts.ps1 -DatabasePort 55438 -HttpPort 18086
```

Comandos importantes dentro de `verify-dispatch-buses-layouts.ps1`:

```powershell
docker run --rm --name $ContainerName -e POSTGRES_DB=dispatch_db -e POSTGRES_USER=postgres -e "POSTGRES_PASSWORD=<temporary-local-password>" -p "$DatabasePort`:5432" -d postgres:16-alpine
docker exec $ContainerName pg_isready -U postgres -d dispatch_db
Start-Process -FilePath "java" -ArgumentList @("-jar", $ResolvedJarPath) -WindowStyle Hidden -PassThru
Invoke-RestMethod -Uri "http://localhost:$HttpPort/q/health/ready"
Invoke-RestMethod -Uri "http://localhost:$HttpPort/api/v1/dispatch/seat-layouts?q=Legacy%2025%20asientos&active=true&page=1&page_size=10"
Invoke-RestMethod -Uri "http://localhost:$HttpPort/api/v1/dispatch/bus-types" -Method Post
Invoke-RestMethod -Uri "http://localhost:$HttpPort/api/v1/dispatch/seat-layouts" -Method Post
Invoke-RestMethod -Uri "http://localhost:$HttpPort/api/v1/dispatch/buses" -Method Post
docker exec -e "PGPASSWORD=<temporary-local-password>" $ContainerName psql -U postgres -d dispatch_db -tAc "select count(*) from outbox_events where event_type in (...);"
Stop-Process -Id $AppProcess.Id -Force
docker stop $ContainerName
```

## Problemas encontrados y soluciones

### Problema 1 - Evitar puertos ocupados

Durante la practica anterior existian pruebas manuales en otros puertos. Para no interferir, este dia uso:

```text
HTTP: 18086
PostgreSQL: 55438
```

### Problema 2 - Empaquetado con archivos bloqueados

Si Windows mantiene abierto `target\quarkus-app`, Maven puede fallar por archivos en uso.

Solucion usada:

```powershell
mvn -f .\services\dispatch-service\pom.xml package -DskipTests "-Dquarkus.package.output-directory=quarkus-app-day23"
```

### Problema 3 - JSON con curl.exe en PowerShell

Para evitar que PowerShell altere comillas internas, todos los cuerpos JSON se guardan primero en archivo temporal:

```powershell
$body | Set-Content -LiteralPath $bodyPath -Encoding ascii
curl.exe --data-binary "@$bodyPath"
```

### Problema 4 - Layout en uso

El servicio no permite cambiar asientos de un layout usado por buses activos.

Esto protege ventas futuras:

```text
Si un bus ya usa un layout de 25 asientos, cambiarlo a 20 podria romper reservas, boletos o salidas.
```

La prueba esperada devuelve:

```text
HTTP 409 Conflict
```

## Estado final

```text
Dia 23 completado.
Las APIs de tipos de bus, layouts y buses estan implementadas.
El seed Legacy 25 asientos se crea con Flyway.
El sistema puede modelar buses sin botones fijos.
```

Siguiente paso natural:

```text
Dia 24 - Salidas programadas.
```
