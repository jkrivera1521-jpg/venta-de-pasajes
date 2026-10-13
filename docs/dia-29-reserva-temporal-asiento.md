# Dia 29 - Reserva temporal de asiento

Fecha de ejecucion: 2026-09-15

## Objetivo

Agregar a `ticketing-service` una API para tomar temporalmente un asiento antes de vender el boleto, impidiendo que dos usuarios reserven el mismo asiento al mismo tiempo.

Alcance del dia:

```text
Implementar reserva temporal.
Definir tiempo de expiracion.
Implementar liberacion automatica con job interno.
Publicar eventos SeatReserved y SeatReservationExpired.
Probar doble reserva sobre el mismo asiento.
```

## Resultado logrado

```text
Se agrego la migracion V3__reservation_expiration_indexes.sql.
Se agregaron DTOs de reserva temporal.
Se agrego TicketingReservationService.
Se agrego TicketingReservationResource.
Se agrego ReservationExpirationJob con scheduler configurable.
Se agregaron eventos de outbox SeatReserved y SeatReservationExpired.
Se agrego bloqueo pesimista sobre departure_seats al reservar.
Se protegieron asientos RESERVED y SOLD para que la sincronizacion desde dispatch no sobrescriba estado transaccional.
Se ampliaron pruebas Maven de 13 a 18.
Se amplio el script de validacion local para probar reserva, doble reserva y expiracion.
```

## Idea clave

La disponibilidad se decide en `departure_seats`.

Cuando un usuario reserva un asiento:

```text
departure_seats.status pasa de AVAILABLE a RESERVED.
departure_seats.reservation_id guarda la reserva activa.
departure_seats.passenger_id guarda el pasajero que tomo la reserva.
departure_seats.hold_expires_at guarda hasta cuando se mantiene el asiento.
reservations.status queda en PENDING.
outbox_events registra SeatReserved.
```

Para evitar doble reserva, el servicio bloquea la fila del asiento con `PESSIMISTIC_WRITE` dentro de una transaccion. Si otra solicitud intenta reservar el mismo asiento, espera a que termine la primera transaccion y luego recibe `409 Conflict` porque el asiento ya no esta `AVAILABLE`.

Cuando la reserva expira:

```text
reservations.status pasa de PENDING a EXPIRED.
departure_seats.status vuelve a AVAILABLE.
reservation_id, passenger_id y hold_expires_at se limpian del asiento.
outbox_events registra SeatReservationExpired.
```

## Archivos principales

```text
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\resources\db\migration\V3__reservation_expiration_indexes.sql
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\api\TicketingReservationResource.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\service\TicketingReservationService.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\service\ReservationExpirationJob.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\service\TicketingAvailabilityService.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\api\dto\CreateReservationRequest.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\api\dto\ReservationPassengerRequest.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\api\dto\ReservationResponse.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\api\dto\ExpireReservationsRequest.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\api\dto\ExpiredReservationsResponse.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\test\java\com\ventapasajes\ticketing\api\TicketingReservationResourceContractTest.java
C:\VENTA-DE-PASAJES\scripts\verify-ticketing-service-local-db.ps1
```

## Endpoints creados

```text
POST /api/v1/ticketing/reservations
GET  /api/v1/ticketing/reservations/{reservationId}
POST /api/v1/ticketing/reservations/expire
```

## Configuracion agregada

```properties
app.reservation.default-hold-minutes=15
app.reservation.max-hold-minutes=120
app.reservation.expiration-job.enabled=true
app.reservation.expiration-job.interval=60s
```

En ambiente `test`, el job queda desactivado para que las pruebas unitarias no dependan de base de datos.

## Reversa primero

Esta seccion limpia la practica local. No elimina el codigo fuente.

### Paso R1 - Detener ticketing-service

```powershell
cd C:\VENTA-DE-PASAJES

Get-NetTCPConnection -LocalPort 18090,8083 -ErrorAction SilentlyContinue |
  Select-Object LocalAddress,LocalPort,State,OwningProcess |
  Format-Table -AutoSize
```

Si aparece un proceso escuchando:

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

Eliminar contenedores temporales conocidos solo si ya no se estan usando:

```powershell
docker rm -f venta-pasajes-ticketing-base-pg-script 2>$null
docker rm -f venta-pasajes-ticketing-reservation-pg-manual 2>$null
```

### Paso R3 - Limpiar artefactos compilados

```powershell
mvn -f .\services\ticketing-service\pom.xml clean
```

## Guia manual desde cero

### Paso 1 - Ubicarse en el proyecto

```powershell
cd C:\VENTA-DE-PASAJES
```

### Paso 2 - Revisar la tarea del dia

```powershell
Select-String -Path .\tareas.md -Pattern "### Dia 29" -Context 0,24
```

### Paso 3 - Verificar migracion V3

```powershell
Test-Path .\services\ticketing-service\src\main\resources\db\migration\V3__reservation_expiration_indexes.sql

Select-String -Path .\services\ticketing-service\src\main\resources\db\migration\V3__reservation_expiration_indexes.sql `
  -Pattern "idx_reservations_pending_expiration|idx_departure_seats_reservation_id|idx_departure_seats_hold_expiration"
```

Resultado esperado:

```text
True
Indices de expiracion encontrados.
```

### Paso 4 - Verificar codigo creado

```powershell
Test-Path .\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\api\TicketingReservationResource.java
Test-Path .\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\service\TicketingReservationService.java
Test-Path .\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\service\ReservationExpirationJob.java
```

Resultado esperado:

```text
True
True
True
```

### Paso 5 - Ejecutar pruebas Maven

```powershell
mvn -f .\services\ticketing-service\pom.xml test
```

Resultado real:

```text
Tests run: 18, Failures: 0, Errors: 0, Skipped: 0
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
  "resources_count": 6,
  "availability_total_seats": 4,
  "availability_available_seats": 1,
  "availability_reserved_seats": 1,
  "reservation_status": "PENDING",
  "reservation_seat_status": "RESERVED",
  "duplicate_reservation_http_status": 409,
  "seats_available_after_reservation": 0,
  "seats_reserved_after_reservation": 2,
  "expired_reservations": 1,
  "seats_available_after_expiration": 1,
  "seats_reserved_after_expiration": 1,
  "reservation_outbox_events": 2,
  "public_tables": 7,
  "flyway_version": "3",
  "ready": true
}
```

### Paso 8 - Levantar PostgreSQL manualmente

Usa este flujo si quieres practicar los curls a mano.

```powershell
$DbPassword = [Guid]::NewGuid().ToString("N")

docker run --rm --name venta-pasajes-ticketing-reservation-pg-manual `
  -e POSTGRES_DB=ticketing_db `
  -e POSTGRES_USER=postgres `
  -e "POSTGRES_PASSWORD=$DbPassword" `
  -p "55444:5432" `
  -d postgres:16-alpine
```

Esperar:

```powershell
docker exec venta-pasajes-ticketing-reservation-pg-manual `
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

Arrancar:

```powershell
java -jar .\services\ticketing-service\target\quarkus-app\quarkus-run.jar
```

### Paso 10 - Sincronizar una salida con asientos

En otra consola:

```powershell
cd C:\VENTA-DE-PASAJES

$TicketingBaseUrl = "http://localhost:18090/api/v1/ticketing"
$AvailabilityBaseUrl = "$TicketingBaseUrl/availability"
$ReservationBaseUrl = "$TicketingBaseUrl/reservations"
$DispatchDepartureId = "00000000-0000-0000-0000-000000029001"
```

Crear una salida futura con cuatro asientos:

```powershell
$SyncPayload = @{
  dispatch_departure_id = $DispatchDepartureId
  legacy_id = 2901
  bus_id = "00000000-0000-0000-0000-000000029101"
  bus_code = "BUS-D29"
  bus_plate = "PBA-2901"
  route_id = "00000000-0000-0000-0000-000000029201"
  route_name = "Quito - Guayaquil"
  origin_terminal_id = "00000000-0000-0000-0000-000000029301"
  origin_terminal_name = "Terminal Quito"
  destination_terminal_id = "00000000-0000-0000-0000-000000029302"
  destination_terminal_name = "Terminal Guayaquil"
  departure_at = (Get-Date).ToUniversalTime().AddDays(1).ToString("o")
  status = "SCHEDULED"
  seats = @(
    @{ seat_number = "1"; status = "AVAILABLE" },
    @{ seat_number = "2"; status = "AVAILABLE" },
    @{ seat_number = "3"; status = "SOLD" },
    @{ seat_number = "4"; status = "CANCELLED" }
  )
  source_updated_at = (Get-Date).ToUniversalTime().ToString("o")
} | ConvertTo-Json -Depth 8 -Compress

Invoke-RestMethod -Uri "$AvailabilityBaseUrl/sync/departures" `
  -Method Post `
  -ContentType "application/json" `
  -Body $SyncPayload
```

### Paso 11 - Reservar asiento

```powershell
$ReservationPayload = @{
  dispatch_departure_id = $DispatchDepartureId
  seat_number = "1"
  hold_minutes = 15
  passenger = @{
    document_type = "CEDULA"
    document_number = "1717171717"
    first_name = "Ana"
    last_name = "Viajera"
    email = "ana.viajera@example.com"
    phone = "0999999999"
  }
} | ConvertTo-Json -Depth 8 -Compress

Invoke-RestMethod -Uri $ReservationBaseUrl `
  -Method Post `
  -ContentType "application/json" `
  -Body $ReservationPayload
```

Resultado esperado:

```text
status: PENDING
seat_status: RESERVED
reservation_code: RSV-...
```

### Paso 12 - Probar doble reserva

Repetir el mismo `POST`:

```powershell
Invoke-RestMethod -Uri $ReservationBaseUrl `
  -Method Post `
  -ContentType "application/json" `
  -Body $ReservationPayload
```

Resultado esperado:

```text
HTTP 409 Conflict
```

### Paso 13 - Consultar mapa despues de reservar

```powershell
Invoke-RestMethod -Uri "$AvailabilityBaseUrl/departures/$DispatchDepartureId/seats"
```

Resultado esperado:

```text
available_seats: 1 si habia dos libres inicialmente, o 0 si el set de prueba solo tenia un asiento libre.
reserved_seats: aumenta en 1.
```

### Paso 14 - Expirar reservas pendientes

Para pruebas manuales se puede adelantar el umbral de expiracion. En ejecucion normal, el job usa la hora actual.

```powershell
$ExpirePayload = @{
  expired_before = (Get-Date).ToUniversalTime().AddHours(2).ToString("o")
} | ConvertTo-Json -Compress

Invoke-RestMethod -Uri "$ReservationBaseUrl/expire" `
  -Method Post `
  -ContentType "application/json" `
  -Body $ExpirePayload
```

Resultado esperado:

```text
expired_reservations: 1
```

### Paso 15 - Revisar eventos en outbox

```powershell
docker exec -e "PGPASSWORD=$DbPassword" venta-pasajes-ticketing-reservation-pg-manual `
  psql -U postgres -d ticketing_db -c "select event_type, aggregate_type, status, created_at from outbox_events order by created_at;"
```

Resultado esperado:

```text
SeatReserved
SeatReservationExpired
```

### Paso 16 - Detener practica manual

En la consola donde corre Quarkus:

```text
Ctrl+C
```

Eliminar PostgreSQL temporal:

```powershell
docker rm -f venta-pasajes-ticketing-reservation-pg-manual
```

Limpiar variables sensibles:

```powershell
Remove-Item Env:\APP_DB_PASSWORD -ErrorAction SilentlyContinue
Remove-Item Env:\APP_DB_JDBC_URL -ErrorAction SilentlyContinue
Remove-Item Env:\APP_DB_USERNAME -ErrorAction SilentlyContinue
```

## Comandos ejecutados en este dia

```powershell
Select-String -Path .\tareas.md -Pattern "### Dia 29|Dia 29" -Context 0,70
Get-ChildItem .\services\ticketing-service\src\main\java\com\ventapasajes\ticketing -Recurse -File
Get-Content .\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\persistence\entity\DepartureSeat.java
Get-Content .\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\persistence\entity\Reservation.java
Get-Content .\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\persistence\entity\OutboxEvent.java
mvn -f .\services\ticketing-service\pom.xml test
mvn -f .\services\ticketing-service\pom.xml package -DskipTests
Get-NetTCPConnection -LocalPort 18090,55443,55444,55445 -ErrorAction SilentlyContinue | Select-Object LocalAddress,LocalPort,State,OwningProcess | Format-Table -AutoSize
docker ps -a --format "table {{.ID}}\t{{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}" | Select-String -Pattern "ticketing|55443|55444|55445|postgres"
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-ticketing-service-local-db.ps1 -DatabasePort 55444 -HttpPort 18090
```

## Problemas y soluciones

| Problema | Causa probable | Solucion |
| --- | --- | --- |
| `HTTP 409 Conflict` al reservar. | El asiento ya no esta `AVAILABLE`. | Consultar el mapa de asientos y seleccionar otro asiento. |
| La reserva no expira inmediatamente. | El job usa la hora actual y corre por intervalo. | Para pruebas, llamar `POST /reservations/expire` con `expired_before` futuro. |
| No aparecen eventos en `outbox_events`. | La reserva no llego a confirmarse o la expiracion no encontro reservas vencidas. | Revisar respuesta del endpoint y estado de `reservations`. |
| Flyway queda en version 2. | La migracion V3 no esta empaquetada. | Ejecutar `mvn package -DskipTests` y arrancar con `QUARKUS_FLYWAY_MIGRATE_AT_START=true`. |
| `port is already allocated` en `55443`. | Hay un PostgreSQL temporal anterior corriendo. | Usar `55444` o detener el contenedor anterior si ya no se necesita. |

## Estado final

```text
ticketing-service puede reservar temporalmente un asiento.
ticketing-service bloquea la doble reserva del mismo asiento.
ticketing-service libera reservas vencidas por endpoint y job interno configurable.
ticketing-service conserva RESERVED y SOLD aunque llegue una nueva sincronizacion de disponibilidad.
Se publican eventos SeatReserved y SeatReservationExpired en outbox_events.
Flyway llega a version 3.
La validacion local con PostgreSQL temporal queda OK.
```

Siguiente paso natural: Dia 30, venta de boleto.
