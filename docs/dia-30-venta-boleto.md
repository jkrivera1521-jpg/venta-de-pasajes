# Dia 30 - Venta de boleto

Fecha de ejecucion: 2026-09-15

## Objetivo

Agregar a `ticketing-service` una API para emitir boletos de forma transaccional, validando pasajero, salida, asiento y doble venta.

Alcance del dia:

```text
Implementar endpoint de venta.
Validar pasajero.
Validar salida.
Validar asiento.
Confirmar boleto en transaccion.
Publicar evento TicketSold.
Probar doble venta del mismo asiento.
```

## Resultado logrado

```text
Se agrego TicketingTicketResource bajo /api/v1/ticketing/tickets.
Se agregaron DTOs CreateTicketRequest y TicketResponse.
Se amplio TicketingSaleService con emision transaccional de boletos.
Se soporta venta directa desde asiento AVAILABLE.
Se soporta conversion de una reserva PENDING vigente a boleto.
Se usa bloqueo pesimista sobre departure_seats y reservations.
Se marca el asiento como SOLD y se limpia hold_expires_at.
Se convierte la reserva en CONVERTED_TO_TICKET cuando la venta nace de una reserva.
Se publica evento TicketSold en outbox_events.
Se agregaron pruebas contractuales del recurso y del servicio.
Se amplio scripts\verify-ticketing-service-local-db.ps1 para probar venta y doble venta.
```

## Idea clave

La venta es la transicion final del asiento:

```text
AVAILABLE -> SOLD
RESERVED + reserva PENDING vigente -> SOLD + reserva CONVERTED_TO_TICKET
```

El servicio no confia solo en la API. Antes de crear el boleto, bloquea la fila del asiento con `PESSIMISTIC_WRITE`, valida que no haya expiraciones pendientes y confirma dentro de la misma transaccion:

```text
tickets.status = ISSUED
departure_seats.status = SOLD
outbox_events.event_type = TicketSold
```

Si alguien intenta vender el mismo asiento otra vez, el endpoint responde `409 Conflict`.

## Archivos principales

```text
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\api\TicketingTicketResource.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\service\TicketingSaleService.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\api\dto\CreateTicketRequest.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\api\dto\TicketResponse.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\test\java\com\ventapasajes\ticketing\api\TicketingTicketResourceContractTest.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\test\java\com\ventapasajes\ticketing\service\TicketingTransactionConfigurationTest.java
C:\VENTA-DE-PASAJES\scripts\verify-ticketing-service-local-db.ps1
```

## Endpoints creados

```text
POST /api/v1/ticketing/tickets
GET  /api/v1/ticketing/tickets/{ticketId}
```

## Cuerpo de venta directa

```json
{
  "dispatch_departure_id": "00000000-0000-0000-0000-000000028001",
  "seat_number": "1",
  "fare_amount": 25.50,
  "currency": "USD",
  "passenger": {
    "document_type": "CEDULA",
    "document_number": "1818181818",
    "first_name": "Luis",
    "last_name": "Comprador",
    "email": "luis.comprador@example.com",
    "phone": "0988888888"
  }
}
```

## Cuerpo para vender desde reserva

```json
{
  "reservation_id": "10239c1b-b779-4add-93fd-e5f75eabf297",
  "fare_amount": 25.50,
  "currency": "USD"
}
```

## Reversa primero

Esta seccion limpia la practica local. No elimina el codigo fuente.

### Paso R1 - Detener ticketing-service

```powershell
cd C:\VENTA-DE-PASAJES

Get-NetTCPConnection -LocalPort 18090,18091,8083 -ErrorAction SilentlyContinue |
  Select-Object LocalAddress,LocalPort,State,OwningProcess |
  Format-Table -AutoSize
```

Detener solo procesos de practica que ya no se esten usando:

```powershell
$TicketingPids = Get-NetTCPConnection -LocalPort 18090,18091,8083 -ErrorAction SilentlyContinue |
  Where-Object { $_.State -eq "Listen" } |
  Select-Object -ExpandProperty OwningProcess -Unique

$TicketingPids | ForEach-Object {
  Stop-Process -Id $_ -Force
}
```

Si aparece `Acceso denegado`, cerrar la consola donde corre Quarkus o presionar `Ctrl+C` ahi.

### Paso R2 - Detener PostgreSQL temporal

```powershell
docker ps -a --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}" |
  Select-String -Pattern "ticketing|55443|55444|55445|postgres"
```

Eliminar contenedores temporales que ya no se necesitan:

```powershell
docker rm -f venta-pasajes-ticketing-base-pg-script 2>$null
docker rm -f venta-pasajes-ticketing-reservation-pg-manual 2>$null
```

## Guia manual desde cero

### Paso 1 - Ubicarse en el proyecto

```powershell
cd C:\VENTA-DE-PASAJES
```

### Paso 2 - Revisar la tarea del dia

```powershell
Select-String -Path .\tareas.md -Pattern "### Dia 30|Dia 30" -Context 0,40
```

### Paso 3 - Verificar codigo creado

```powershell
Test-Path .\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\api\TicketingTicketResource.java
Test-Path .\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\api\dto\CreateTicketRequest.java
Test-Path .\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\api\dto\TicketResponse.java
```

Resultado esperado:

```text
True
True
True
```

### Paso 4 - Ejecutar pruebas Maven

```powershell
mvn -f .\services\ticketing-service\pom.xml test
```

Resultado real:

```text
Tests run: 21, Failures: 0, Errors: 0, Skipped: 0
BUILD SUCCESS
```

### Paso 5 - Empaquetar el servicio

Si no hay otro `ticketing-service` usando `target\quarkus-app`:

```powershell
mvn -f .\services\ticketing-service\pom.xml package -DskipTests
```

Si Windows reporta que `generated-bytecode.jar` esta en uso, generar el artefacto en una salida alterna:

```powershell
mvn -f .\services\ticketing-service\pom.xml package -DskipTests "-Dquarkus.package.output-directory=quarkus-app-day30"
```

Verificar:

```powershell
Test-Path .\services\ticketing-service\target\quarkus-app-day30\quarkus-run.jar
```

### Paso 6 - Validacion asistida completa

Con puertos libres:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-ticketing-service-local-db.ps1 `
  -DatabasePort 55445 `
  -HttpPort 18091 `
  -JarPath .\services\ticketing-service\target\quarkus-app-day30\quarkus-run.jar
```

Resultado real obtenido:

```json
{
  "service": "ticketing-service",
  "validation": "local-postgresql-flyway",
  "database_port": 55445,
  "http_port": 18091,
  "ticket_status": "ISSUED",
  "duplicate_ticket_http_status": 409,
  "seats_available_after_ticket": 0,
  "seats_sold_after_ticket": 2,
  "ticket_outbox_events": 1,
  "issued_tickets": 1,
  "flyway_version": "3",
  "ready": true
}
```

### Paso 7 - Probar venta manualmente

Primero debe existir una salida sincronizada con un asiento `AVAILABLE`.

```powershell
$TicketingBaseUrl = "http://localhost:18091/api/v1/ticketing"
$AvailabilityBaseUrl = "$TicketingBaseUrl/availability"
$TicketBaseUrl = "$TicketingBaseUrl/tickets"
$DispatchDepartureId = "00000000-0000-0000-0000-000000028001"
```

Crear payload:

```powershell
$TicketPayload = @{
  dispatch_departure_id = $DispatchDepartureId
  seat_number = "1"
  fare_amount = 25.50
  currency = "USD"
  passenger = @{
    document_type = "CEDULA"
    document_number = "1818181818"
    first_name = "Luis"
    last_name = "Comprador"
    email = "luis.comprador@example.com"
    phone = "0988888888"
  }
} | ConvertTo-Json -Depth 8 -Compress
```

Vender:

```powershell
Invoke-RestMethod -Uri $TicketBaseUrl `
  -Method Post `
  -ContentType "application/json" `
  -Body $TicketPayload
```

Resultado esperado:

```text
status: ISSUED
ticket_number: TKT-...
seat_number: 1
```

Repetir el mismo `POST` debe responder:

```text
HTTP 409 Conflict
```

### Paso 8 - Verificar estado del asiento

```powershell
Invoke-RestMethod -Uri "$AvailabilityBaseUrl/departures/$DispatchDepartureId/seats"
```

El asiento vendido queda:

```text
status: SOLD
available: false
```

### Paso 9 - Revisar eventos en outbox

```powershell
docker exec -e "PGPASSWORD=$DbPassword" venta-pasajes-ticketing-reservation-pg-manual `
  psql -U postgres -d ticketing_db -c "select event_type, aggregate_type, status, created_at from outbox_events order by created_at;"
```

Resultado esperado:

```text
TicketSold
```

## Comandos ejecutados en este dia

```powershell
Select-String -Path .\tareas.md -Pattern "### Dia 30|Dia 30" -Context 0,45
Get-Content .\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\service\TicketingReservationService.java
Get-Content .\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\service\TicketingSaleService.java
Get-Content .\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\persistence\entity\Ticket.java
Get-Content .\services\ticketing-service\src\main\resources\db\migration\V1__ticketing_schema.sql
mvn -f .\services\ticketing-service\pom.xml test
mvn -f .\services\ticketing-service\pom.xml package -DskipTests
mvn -f .\services\ticketing-service\pom.xml package -DskipTests "-Dquarkus.package.output-directory=quarkus-app-day30"
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-ticketing-service-local-db.ps1 -DatabasePort 55445 -HttpPort 18091 -JarPath .\services\ticketing-service\target\quarkus-app-day30\quarkus-run.jar
Get-NetTCPConnection -LocalPort 18091,55445 -ErrorAction SilentlyContinue | Select-Object LocalAddress,LocalPort,State,OwningProcess | Format-Table -AutoSize
```

## Problemas y soluciones

| Problema | Causa probable | Solucion |
| --- | --- | --- |
| `HTTP 409 Conflict` al vender. | El asiento ya esta `RESERVED`, `SOLD`, `BLOCKED` o `CANCELLED`. | Consultar mapa de asientos y elegir uno `AVAILABLE`. |
| `generated-bytecode.jar` en uso al empaquetar. | Hay un Quarkus manual ejecutandose desde `target\quarkus-app`. | Cerrar esa consola o usar `-Dquarkus.package.output-directory=quarkus-app-day30`. |
| `Acceso denegado` al detener Java. | El proceso fue lanzado desde otra consola con permisos distintos. | Usar `Ctrl+C` en la consola donde corre Quarkus. |
| No aparece `TicketSold` en outbox. | La venta no se confirmo o fallo con `409`. | Revisar la respuesta del endpoint y el estado del asiento. |

## Estado final

```text
ticketing-service puede emitir boletos por API.
ticketing-service valida salida SCHEDULED, pasajero, asiento y tarifa.
ticketing-service bloquea doble venta del mismo asiento con HTTP 409.
ticketing-service cambia el asiento a SOLD en la misma transaccion.
ticketing-service publica TicketSold en outbox_events.
La validacion local con PostgreSQL temporal queda OK.
```

Siguiente paso natural: Dia 31, anulacion y liberacion.
