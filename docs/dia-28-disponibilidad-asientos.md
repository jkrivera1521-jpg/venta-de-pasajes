# Dia 28 - Disponibilidad de asientos

Fecha de ejecucion: 2026-09-14

## Objetivo

Agregar a `ticketing-service` una API para consultar salidas disponibles y mapa de asientos, usando un modelo de lectura local sincronizado desde datos de `dispatch-service`.

Alcance del dia:

```text
Crear endpoint para consultar salidas disponibles.
Crear endpoint para consultar mapa de asientos.
Sincronizar datos necesarios desde dispatch-service.
Definir modelo de lectura local.
Probar estados libre, reservado, vendido y anulado.
```

## Resultado logrado

```text
Se agrego la migracion V2__availability_read_model.sql.
Se creo el read model local synced_departures.
Se agrego la entidad SyncedDeparture.
Se agrego el enum SyncedDepartureStatus.
Se agregaron DTOs de disponibilidad y sincronizacion.
Se agrego TicketingAvailabilityService.
Se agrego TicketingAvailabilityResource.
Se agregaron endpoints bajo /api/v1/ticketing/availability.
Se actualizo el catalogo base para incluir synced_departures.
Se ampliaron pruebas Maven de 10 a 13.
Se amplio el script de validacion local para probar disponibilidad real.
```

## Idea clave

`dispatch-service` sigue siendo el dueno de la programacion de salidas, buses, rutas y terminales.

`ticketing-service` necesita consultar disponibilidad rapido y de forma transaccional, por eso guarda una copia local minima de cada salida en `synced_departures` y guarda el estado real de cada asiento en `departure_seats`.

```text
dispatch-service
  Crea/actualiza salidas, rutas, buses y layout.

ticketing-service
  Sincroniza una copia minima de la salida.
  Crea los asientos por salida.
  Calcula cuantos estan libres, reservados, vendidos, bloqueados o anulados.
```

No se lee directamente la base de datos de `dispatch-service`. La sincronizacion queda expuesta como una llamada controlada que mas adelante puede reemplazarse por eventos.

## Archivos principales

```text
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\resources\db\migration\V2__availability_read_model.sql
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\domain\SyncedDepartureStatus.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\persistence\entity\SyncedDeparture.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\api\TicketingAvailabilityResource.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\service\TicketingAvailabilityService.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\api\dto\DepartureAvailabilitySyncRequest.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\api\dto\DepartureSeatSyncRequest.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\api\dto\AvailableDepartureResponse.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\api\dto\SeatAvailabilityResponse.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\api\dto\SeatMapResponse.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\test\java\com\ventapasajes\ticketing\api\TicketingAvailabilityResourceContractTest.java
C:\VENTA-DE-PASAJES\scripts\verify-ticketing-service-local-db.ps1
```

## Endpoints creados

```text
POST /api/v1/ticketing/availability/sync/departures
GET  /api/v1/ticketing/availability/departures
GET  /api/v1/ticketing/availability/departures/{dispatchDepartureId}/seats
```

## Reversa primero

Esta seccion limpia la practica local. No elimina el codigo fuente.

### Paso R1 - Detener ticketing-service

```powershell
cd C:\VENTA-DE-PASAJES

Get-NetTCPConnection -LocalPort 18090,8083 -ErrorAction SilentlyContinue |
  Select-Object LocalAddress,LocalPort,State,OwningProcess |
  Format-Table -AutoSize
```

Si aparece un proceso escuchando, validar que sea `ticketing-service`:

```powershell
Get-CimInstance Win32_Process -Filter "name = 'java.exe'" |
  Select-Object ProcessId,CommandLine |
  Format-List
```

Detener:

```powershell
$TicketingPids = Get-NetTCPConnection -LocalPort 18090,8083 -ErrorAction SilentlyContinue |
  Where-Object { $_.State -eq "Listen" } |
  Select-Object -ExpandProperty OwningProcess -Unique

$TicketingPids | ForEach-Object {
  Stop-Process -Id $_ -Force
}
```

### Paso R2 - Detener PostgreSQL temporal

```powershell
docker ps -a --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}" |
  Select-String -Pattern "ticketing|55443|55444|postgres"
```

Eliminar contenedores temporales conocidos:

```powershell
docker rm -f venta-pasajes-ticketing-base-pg-manual 2>$null
docker rm -f venta-pasajes-ticketing-base-pg-script 2>$null
```

### Paso R3 - Limpiar artefactos compilados

```powershell
mvn -f .\services\ticketing-service\pom.xml clean
```

## Guia manual desde cero

En esta guia, "desde cero" significa limpiar ejecuciones anteriores, compilar el codigo ya creado y levantar una base PostgreSQL temporal vacia para que Flyway aplique las migraciones `V1` y `V2`.

### Paso 1 - Ubicarse en el proyecto

```powershell
cd C:\VENTA-DE-PASAJES
```

### Paso 2 - Revisar la tarea del dia

```powershell
Select-String -Path .\tareas.md -Pattern "### Dia 28" -Context 0,24
```

### Paso 3 - Verificar la migracion V2

```powershell
Test-Path .\services\ticketing-service\src\main\resources\db\migration\V2__availability_read_model.sql

Select-String -Path .\services\ticketing-service\src\main\resources\db\migration\V2__availability_read_model.sql `
  -Pattern "synced_departures|dispatch_departure_id|seat_count|idx_synced_departures"
```

Resultado esperado:

```text
True
Fragmentos SQL de synced_departures encontrados.
```

### Paso 4 - Verificar codigo creado

```powershell
Test-Path .\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\api\TicketingAvailabilityResource.java
Test-Path .\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\service\TicketingAvailabilityService.java
Test-Path .\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\persistence\entity\SyncedDeparture.java
```

Resultado esperado:

```text
True
True
True
```

Listar archivos nuevos del API:

```powershell
Get-ChildItem .\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\api\dto -File |
  Select-Object Name |
  Format-Table -AutoSize
```

### Paso 5 - Ejecutar pruebas Maven

```powershell
mvn -f .\services\ticketing-service\pom.xml test
```

Resultado real:

```text
Tests run: 13, Failures: 0, Errors: 0, Skipped: 0
BUILD SUCCESS
```

### Paso 6 - Empaquetar el servicio

```powershell
mvn -f .\services\ticketing-service\pom.xml package -DskipTests
```

Verificar artefacto:

```powershell
Test-Path .\services\ticketing-service\target\quarkus-app\quarkus-run.jar
```

Resultado esperado:

```text
True
```

### Paso 7 - Validacion asistida completa

Si el puerto `55443` esta libre:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-ticketing-service-local-db.ps1 `
  -DatabasePort 55443 `
  -HttpPort 18090
```

Si `55443` esta ocupado por otra practica, usar `55444`:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-ticketing-service-local-db.ps1 `
  -DatabasePort 55444 `
  -HttpPort 18090
```

Resultado real obtenido:

```json
{
  "service": "ticketing-service",
  "validation": "local-postgresql-flyway",
  "database": "ticketing_db",
  "database_port": 55444,
  "http_port": 18090,
  "health_status": "ok",
  "overview_service": "ticketing-service",
  "resources_count": 6,
  "seat_statuses": 5,
  "reservation_statuses": 5,
  "ticket_statuses": 4,
  "availability_departures": 1,
  "availability_total_seats": 4,
  "availability_available_seats": 1,
  "availability_reserved_seats": 1,
  "availability_sold_seats": 1,
  "availability_cancelled_seats": 1,
  "public_tables": 7,
  "unique_constraints_or_indexes": 18,
  "flyway_version": "2",
  "ready": true
}
```

### Paso 8 - Levantar PostgreSQL manualmente

Usa este flujo si quieres practicar los curls a mano.

```powershell
$DbPassword = [Guid]::NewGuid().ToString("N")

docker run --rm --name venta-pasajes-ticketing-availability-pg-manual `
  -e POSTGRES_DB=ticketing_db `
  -e POSTGRES_USER=postgres `
  -e "POSTGRES_PASSWORD=$DbPassword" `
  -p "55444:5432" `
  -d postgres:16-alpine
```

Esperar:

```powershell
docker exec venta-pasajes-ticketing-availability-pg-manual `
  pg_isready -U postgres -d ticketing_db
```

### Paso 9 - Arrancar ticketing-service manualmente

Configurar variables en la misma consola donde existe `$DbPassword`:

```powershell
$env:QUARKUS_PROFILE = "onprem"
$env:QUARKUS_HTTP_PORT = "18090"
$env:APP_ENV = "local"
$env:APP_RUNTIME_TARGET = "onprem"
$env:APP_SECRETS_PROVIDER = "env"
$env:APP_DB_NAME = "ticketing_db"
$env:APP_DB_JDBC_URL = "jdbc:postgresql://localhost:55444/ticketing_db"
$env:APP_DB_USERNAME = "postgres"
$env:APP_DB_PASSWORD = $DbPassword
$env:QUARKUS_FLYWAY_MIGRATE_AT_START = "true"
$env:APP_LOG_CONSOLE_JSON = "false"
```

Verificar que el password no esta vacio, sin imprimirlo:

```powershell
[bool]$env:APP_DB_PASSWORD
```

Arrancar:

```powershell
java -jar .\services\ticketing-service\target\quarkus-app\quarkus-run.jar
```

Esta consola queda ocupada con Quarkus. Para los siguientes pasos, abre otra consola PowerShell.

### Paso 10 - Sincronizar una salida desde dispatch

En otra consola:

```powershell
cd C:\VENTA-DE-PASAJES

$TicketingBaseUrl = "http://localhost:18090/api/v1/ticketing"
$AvailabilityBaseUrl = "$TicketingBaseUrl/availability"
$DispatchDepartureId = "00000000-0000-0000-0000-000000028001"
$SyncBodyPath = Join-Path $env:TEMP "ticketing-availability-sync.json"
```

Crear el cuerpo JSON de sincronizacion:

```powershell
@'
{
  "dispatch_departure_id": "00000000-0000-0000-0000-000000028001",
  "legacy_id": 2801,
  "bus_id": "00000000-0000-0000-0000-000000028101",
  "bus_code": "BUS-D28",
  "bus_plate": "PBA-2801",
  "route_id": "00000000-0000-0000-0000-000000028201",
  "route_name": "Quito - Guayaquil",
  "origin_terminal_id": "00000000-0000-0000-0000-000000028301",
  "origin_terminal_name": "Terminal Quito",
  "destination_terminal_id": "00000000-0000-0000-0000-000000028302",
  "destination_terminal_name": "Terminal Guayaquil",
  "departure_at": "2026-09-15T10:00:00Z",
  "status": "SCHEDULED",
  "seats": [
    { "seat_number": "1", "status": "AVAILABLE" },
    { "seat_number": "2", "status": "RESERVED" },
    { "seat_number": "3", "status": "SOLD" },
    { "seat_number": "4", "status": "CANCELLED" }
  ],
  "source_updated_at": "2026-09-14T21:30:00Z"
}
'@ | Set-Content -LiteralPath $SyncBodyPath -Encoding ascii
```

Enviar con `curl.exe`:

```powershell
curl.exe -i -S -X POST "$AvailabilityBaseUrl/sync/departures" `
  -H "Content-Type: application/json" `
  --data-binary "@$SyncBodyPath"
```

Resultado esperado:

```text
HTTP/1.1 201 Created
Respuesta JSON con total_seats=4.
```

### Paso 11 - Consultar salidas disponibles con curl.exe

```powershell
curl.exe -sS "$AvailabilityBaseUrl/departures"
```

Con filtros:

```powershell
curl.exe -sS "$AvailabilityBaseUrl/departures?date_from=2026-09-15&date_to=2026-09-15"
```

Con filtros de terminales:

```powershell
curl.exe -sS "$AvailabilityBaseUrl/departures?origin_terminal_id=00000000-0000-0000-0000-000000028301&destination_terminal_id=00000000-0000-0000-0000-000000028302"
```

### Paso 12 - Consultar mapa de asientos con curl.exe

```powershell
curl.exe -sS "$AvailabilityBaseUrl/departures/$DispatchDepartureId/seats"
```

Resultado esperado:

```text
total_seats: 4
available_seats: 1
reserved_seats: 1
sold_seats: 1
cancelled_seats: 1
```

Interpretacion:

```text
AVAILABLE = libre para venta o reserva.
RESERVED  = reservado temporalmente.
SOLD      = boleto emitido.
CANCELLED = anulado/no disponible.
BLOCKED   = bloqueado administrativamente.
```

### Paso 13 - Revisar en PostgreSQL

Si estas usando el contenedor manual:

```powershell
docker exec -e "PGPASSWORD=$DbPassword" venta-pasajes-ticketing-availability-pg-manual `
  psql -U postgres -d ticketing_db -c "select dispatch_departure_id, route_name, departure_at, status, seat_count from synced_departures;"
```

Ver asientos:

```powershell
docker exec -e "PGPASSWORD=$DbPassword" venta-pasajes-ticketing-availability-pg-manual `
  psql -U postgres -d ticketing_db -c "select seat_number, status from departure_seats where dispatch_departure_id = '00000000-0000-0000-0000-000000028001' order by seat_number;"
```

Ver Flyway:

```powershell
docker exec -e "PGPASSWORD=$DbPassword" venta-pasajes-ticketing-availability-pg-manual `
  psql -U postgres -d ticketing_db -c "select installed_rank, version, description, success from flyway_schema_history order by installed_rank;"
```

### Paso 14 - Detener practica manual

En la consola donde corre Quarkus:

```text
Ctrl+C
```

Eliminar PostgreSQL temporal:

```powershell
docker rm -f venta-pasajes-ticketing-availability-pg-manual
```

Limpiar variables sensibles:

```powershell
Remove-Item Env:\APP_DB_PASSWORD -ErrorAction SilentlyContinue
Remove-Item Env:\APP_DB_JDBC_URL -ErrorAction SilentlyContinue
Remove-Item Env:\APP_DB_USERNAME -ErrorAction SilentlyContinue
```

## Comandos ejecutados en este dia

```powershell
Select-String -Path .\tareas.md -Pattern "### Dia 28|### Día 28|Dia 28|Día 28" -Context 0,40
Get-ChildItem .\services\ticketing-service\src\main\java\com\ventapasajes\ticketing -Recurse -File
Get-Content .\services\ticketing-service\src\main\resources\db\migration\V1__ticketing_schema.sql
Get-Content .\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\dto\DepartureResponse.java
Get-Content .\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\domain\DepartureStatus.java
mvn -f .\services\ticketing-service\pom.xml test
Get-NetTCPConnection -LocalPort 18090,55443,55444,55445 -ErrorAction SilentlyContinue | Select-Object LocalAddress,LocalPort,State,OwningProcess | Format-Table -AutoSize
docker ps -a --format "table {{.ID}}\t{{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}" | Select-String -Pattern "ticketing|55443|55444|55445|postgres"
mvn -f .\services\ticketing-service\pom.xml package -DskipTests
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-ticketing-service-local-db.ps1 -DatabasePort 55444 -HttpPort 18090
```

## Problemas y soluciones

| Problema | Causa probable | Solucion |
| --- | --- | --- |
| `port is already allocated` en `55443`. | Hay un PostgreSQL temporal anterior corriendo. | Usar `55444` o detener el contenedor anterior si ya no se necesita. |
| `curl.exe` no conecta a `18090`. | `ticketing-service` no esta levantado. | Revisar la consola de Quarkus o ejecutar la validacion asistida. |
| `GET /availability/departures` devuelve `[]`. | No se sincronizo ninguna salida con asientos libres o la salida no esta `SCHEDULED`. | Ejecutar primero el `POST /availability/sync/departures`. |
| `GET /availability/departures/{id}/seats` devuelve 404. | Ese `dispatch_departure_id` no existe en `synced_departures`. | Sincronizar la salida o revisar el UUID usado. |
| Flyway queda en version 1. | La migracion V2 no esta en `src\main\resources\db\migration`. | Verificar `V2__availability_read_model.sql` y volver a empaquetar. |

## Estado final

```text
ticketing-service puede recibir una salida sincronizada desde dispatch-service.
ticketing-service puede listar salidas vendibles.
ticketing-service puede devolver el mapa de asientos por salida.
El mapa refleja estados AVAILABLE, RESERVED, SOLD y CANCELLED.
Flyway llega a version 2.
La validacion local con PostgreSQL temporal queda OK.
```

Siguiente paso natural: Dia 29, reserva temporal de asiento.
