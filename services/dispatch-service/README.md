# Dispatch Service

Microservicio Quarkus dueno del dominio de despacho y programacion de buses del sistema Venta de Pasajes.

## Responsabilidad actual

- Terminales terrestres.
- Rutas entre terminal origen y destino.
- Tipos de bus.
- Buses.
- Layouts de asientos.
- Seed legacy de 25 asientos.
- Salidas programadas.
- Auditoria de cambios importantes mediante `outbox_events`.

## Endpoints

```text
GET    /api/v1/dispatch
GET    /api/v1/dispatch/health
GET    /api/v1/dispatch/resources
GET    /api/v1/dispatch/departure-statuses
GET    /api/v1/dispatch/seat-positions

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

GET    /api/v1/dispatch/departures
POST   /api/v1/dispatch/departures
GET    /api/v1/dispatch/departures/{departureId}
PATCH  /api/v1/dispatch/departures/{departureId}
DELETE /api/v1/dispatch/departures/{departureId}
POST   /api/v1/dispatch/departures/{departureId}/cancel

GET    /q/health
GET    /q/health/live
GET    /q/health/ready
GET    /q/openapi
GET    /q/swagger-ui
```

## Validaciones actuales

- Terminal: `name` obligatorio y unico.
- Terminal: `local_code` unico cuando se envia.
- Terminal: `legacy_id` unico cuando se envia.
- Ruta: origen obligatorio.
- Ruta: destino obligatorio.
- Ruta: origen y destino deben ser diferentes.
- Ruta: no se permite duplicar la misma pareja origen/destino.
- Tipo de bus: `name` obligatorio y unico.
- Tipo de bus: `legacy_id` unico cuando se envia.
- Layout: `name` obligatorio y unico.
- Layout: asientos obligatorios, maximo 80.
- Layout: numeros de asiento unicos y consecutivos desde 1.
- Layout: coordenadas `row_number` + `column_number` unicas.
- Bus: `code`, `plate`, `bus_type_id`, `terminal_id` y `seat_layout_id` obligatorios.
- Bus: `code`, `plate` y `legacy_id` unicos cuando se envian.
- Bus: solo puede usar terminal, tipo y layout activos.
- `DELETE` desactiva registros, no los borra fisicamente.
- No se puede desactivar una terminal si tiene rutas o buses activos.
- No se puede cambiar o desactivar un layout usado por buses activos.
- No se puede desactivar un tipo de bus usado por buses activos.
- No se puede desactivar un bus usado por salidas programadas o cerradas.
- Salida: `bus_id`, `route_id` y `departure_at` obligatorios.
- Salida: `departure_at` debe ser futuro.
- Salida: `legacy_id` unico cuando se envia.
- Salida: el bus y la ruta deben existir y estar activos.
- Salida: no se permite el mismo bus con la misma fecha/hora si otra salida esta `SCHEDULED` o `CLOSED`.
- Salida: `DELETE` cancela la salida, no la borra fisicamente.
- Salida cancelada no se puede actualizar.

## Auditoria

Los cambios importantes se registran en `outbox_events`:

```text
TERMINAL_CREATED
TERMINAL_UPDATED
TERMINAL_DEACTIVATED
ROUTE_CREATED
ROUTE_UPDATED
ROUTE_DEACTIVATED
BUS_TYPE_CREATED
BUS_TYPE_UPDATED
BUS_TYPE_DEACTIVATED
SEAT_LAYOUT_CREATED
SEAT_LAYOUT_UPDATED
SEAT_LAYOUT_DEACTIVATED
BUS_CREATED
BUS_UPDATED
BUS_DEACTIVATED
DepartureScheduled
DEPARTURE_UPDATED
DEPARTURE_CANCELLED
```

Se pueden enviar estos headers opcionales:

```text
X-Actor-User-Id: <uuid-del-usuario>
X-Correlation-Id: <uuid-de-correlacion>
```

## Ejecutar pruebas unitarias

```powershell
mvn -f .\services\dispatch-service\pom.xml test
```

Resultado actual esperado:

```text
Tests run: 19, Failures: 0, Errors: 0, Skipped: 0
BUILD SUCCESS
```

Despues del Dia 24:

```text
Tests run: 24, Failures: 0, Errors: 0, Skipped: 0
BUILD SUCCESS
```

## Empaquetar JVM

Si `target\quarkus-app` esta libre:

```powershell
mvn -f .\services\dispatch-service\pom.xml package -DskipTests
```

Artefacto normal:

```text
C:\VENTA-DE-PASAJES\services\dispatch-service\target\quarkus-app\quarkus-run.jar
```

Si Windows tiene bloqueado algun archivo bajo `target\quarkus-app`, generar una salida alternativa:

```powershell
mvn -f .\services\dispatch-service\pom.xml package -DskipTests "-Dquarkus.package.output-directory=quarkus-app-day24"
```

Artefacto alternativo:

```text
C:\VENTA-DE-PASAJES\services\dispatch-service\target\quarkus-app-day24\quarkus-run.jar
```

## Verificacion local con PostgreSQL temporal

Dia 22, terminales y rutas:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-dispatch-terminals-routes.ps1 `
  -DatabasePort 55437 `
  -HttpPort 18085
```

Dia 23, tipos de bus, buses y layouts:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-dispatch-buses-layouts.ps1 `
  -DatabasePort 55438 `
  -HttpPort 18086
```

Dia 24, salidas programadas:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-dispatch-departures.ps1 `
  -DatabasePort 55439 `
  -HttpPort 18087
```

## Peticiones curl.exe

En PowerShell, si la consola queda mostrando `>>`, cancelar con `Ctrl+C` y volver a ejecutar el bloque. Para evitar problemas de comillas, los cuerpos JSON se crean con `ConvertTo-Json`, se guardan en un archivo temporal y se envian con `curl.exe --data-binary "@archivo.json"`.

Preparar variables:

```powershell
$baseUrl = "http://localhost:18087/api/v1/dispatch"
$actorId = "00000000-0000-0000-0000-000000000024"
$correlationId = "00000000-0000-0000-0000-000000000224"
curl.exe -i -S "$baseUrl/health"
```

Consultar layout seed:

```powershell
$seedPage = curl.exe -sS -X GET "$baseUrl/seat-layouts?q=Legacy%2025%20asientos&active=true&page=1&page_size=10" |
  ConvertFrom-Json

$seedLayoutId = $seedPage.data[0].id
curl.exe -sS -X GET "$baseUrl/seat-layouts/$seedLayoutId"
```

Crear tipo de bus:

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
```

Crear layout manual:

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

curl.exe -sS -X POST "$baseUrl/seat-layouts" `
  -H "Content-Type: application/json" `
  -H "X-Actor-User-Id: $actorId" `
  -H "X-Correlation-Id: $correlationId" `
  --data-binary "@$layoutBodyPath"
```

Crear bus:

```powershell
$busBody = @{
  legacy_id = 2301
  code = "BUS-D23-001"
  plate = "PBD-2301"
  description = "Unidad validada Dia 23"
  default_destination = "Guayaquil"
  bus_type_id = $busType.id
  terminal_id = "<terminal-id>"
  seat_layout_id = $seedLayoutId
} | ConvertTo-Json -Compress

$busBodyPath = Join-Path $env:TEMP "dispatch-bus.json"
$busBody | Set-Content -LiteralPath $busBodyPath -Encoding ascii

curl.exe -sS -X POST "$baseUrl/buses" `
  -H "Content-Type: application/json" `
  -H "X-Actor-User-Id: $actorId" `
  -H "X-Correlation-Id: $correlationId" `
  --data-binary "@$busBodyPath"
```

Programar salida:

```powershell
$departureAt = (Get-Date).ToUniversalTime().AddDays(2).ToString("yyyy-MM-ddTHH:mm:ssZ")

$departureBody = @{
  legacy_id = 2401
  bus_id = "<bus-id>"
  route_id = "<route-id>"
  departure_at = $departureAt
  notes = "Salida validada Dia 24"
} | ConvertTo-Json -Compress

$departureBodyPath = Join-Path $env:TEMP "dispatch-departure.json"
$departureBody | Set-Content -LiteralPath $departureBodyPath -Encoding ascii

$departure = curl.exe -sS -X POST "$baseUrl/departures" `
  -H "Content-Type: application/json" `
  -H "X-Actor-User-Id: $actorId" `
  -H "X-Correlation-Id: $correlationId" `
  --data-binary "@$departureBodyPath" |
  ConvertFrom-Json
```

Listar salidas programadas:

```powershell
curl.exe -sS -X GET "$baseUrl/departures?status=SCHEDULED&page=1&page_size=10"
```

Cancelar salida:

```powershell
$cancelBody = @{
  reason = "Cancelacion solicitada"
} | ConvertTo-Json -Compress

$cancelBodyPath = Join-Path $env:TEMP "dispatch-cancel-departure.json"
$cancelBody | Set-Content -LiteralPath $cancelBodyPath -Encoding ascii

curl.exe -sS -X POST "$baseUrl/departures/$($departure.id)/cancel" `
  -H "Content-Type: application/json" `
  -H "X-Actor-User-Id: $actorId" `
  -H "X-Correlation-Id: $correlationId" `
  --data-binary "@$cancelBodyPath"
```

## Secretos

No se guardan secretos reales en el repositorio.

En GCP se usara Secret Manager. En on-premise/offline se usaran variables de entorno o archivos locales seguros fuera del repositorio.

## Compilacion nativa

Ejecutar pruebas antes del build:

```powershell
mvn -f .\services\dispatch-service\pom.xml test
```

Construir binario nativo e imagen Docker local. Usar `-UseCleanWorkspace` cuando Windows mantenga archivos bloqueados en `target` por un `java.exe` activo:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-dispatch-service-native.ps1 -UseCleanWorkspace
```

Probar la imagen nativa con PostgreSQL temporal:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-dispatch-service-native-local.ps1
```

Publicar en Artifact Registry dev:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-dispatch-service-native.ps1 -UseCleanWorkspace -Push -CreateRepository
```

Imagen remota esperada:

```text
us-central1-docker.pkg.dev/project-fbb34cd7-0b82-43e1-867/venta-pasajes-dev/dispatch-service:0.1.0-native
```
