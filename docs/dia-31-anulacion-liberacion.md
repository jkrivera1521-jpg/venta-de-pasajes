# Dia 31 - Anulacion y liberacion

Fecha de ejecucion: 2026-09-15

## Objetivo

Agregar a `ticketing-service` una API para anular boletos emitidos, registrar el motivo, liberar el asiento cuando corresponde y publicar el evento `TicketCancelled`.

Alcance del dia:

```text
Implementar anulacion de boleto.
Definir permisos de anulacion.
Registrar motivo.
Liberar asiento si corresponde.
Publicar evento TicketCancelled.
```

## Resultado logrado

```text
Se agrego la migracion V4__ticket_cancellation_trace.sql.
Se agregaron columnas cancellation_reason y cancelled_by a tickets.
Se agrego indice idx_tickets_cancelled_at.
Se agrego CancelTicketRequest.
Se amplio TicketResponse con cancelled_at, cancellation_reason y cancelled_by.
Se agrego POST /api/v1/ticketing/tickets/{ticketId}/cancel.
Se amplio TicketingSaleService con cancelacion transaccional.
Se marca el boleto como VOIDED.
Se registra motivo, usuario operador y fecha de anulacion.
Se libera el asiento a AVAILABLE cuando release_seat=true.
Se publica TicketCancelled en outbox_events.
Se bloquea doble anulacion con HTTP 409.
Se ampliaron pruebas Maven de 21 a 24.
Se amplio scripts\verify-ticketing-service-local-db.ps1 para validar anulacion y liberacion.
```

## Permiso funcional definido

Hasta integrar autorizacion real de `identity-service`, la API exige `cancelled_by` en el cuerpo para trazabilidad operativa.

Permiso funcional objetivo:

```text
ticketing.tickets.cancel
```

Cuando el flujo de JWT/roles quede conectado, ese permiso debe proteger:

```text
POST /api/v1/ticketing/tickets/{ticketId}/cancel
```

## Idea clave

La anulacion conserva el boleto para auditoria:

```text
tickets.status = VOIDED
tickets.cancelled_at = fecha de anulacion
tickets.cancellation_reason = motivo operativo
tickets.cancelled_by = usuario u operador que anulo
```

Si el boleto estaba `ISSUED`, el asiento puede liberarse:

```text
departure_seats.status = AVAILABLE
departure_seats.passenger_id = null
departure_seats.reservation_id = null
departure_seats.hold_expires_at = null
```

No se borra el boleto. La trazabilidad queda en `tickets` y en `outbox_events` con `TicketCancelled`.

## Archivos principales

```text
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\resources\db\migration\V4__ticket_cancellation_trace.sql
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\api\TicketingTicketResource.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\service\TicketingSaleService.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\persistence\entity\Ticket.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\api\dto\CancelTicketRequest.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\api\dto\TicketResponse.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\test\java\com\ventapasajes\ticketing\api\TicketingTicketResourceContractTest.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\test\java\com\ventapasajes\ticketing\persistence\TicketingMigrationContractTest.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\test\java\com\ventapasajes\ticketing\service\TicketingTransactionConfigurationTest.java
C:\VENTA-DE-PASAJES\scripts\verify-ticketing-service-local-db.ps1
```

## Endpoint creado

```text
POST /api/v1/ticketing/tickets/{ticketId}/cancel
```

## Cuerpo de anulacion

```json
{
  "reason": "Solicitud del pasajero",
  "cancelled_by": "admin-local",
  "release_seat": true
}
```

Reglas:

```text
reason es obligatorio.
cancelled_by es obligatorio mientras no exista JWT/roles integrado.
release_seat por defecto es true.
Solo tickets ISSUED pueden anularse.
Un segundo intento de anulacion responde HTTP 409.
```

## Reversa primero

Esta seccion limpia la practica local. No elimina el codigo fuente.

### Paso R1 - Detener ticketing-service

```powershell
cd C:\VENTA-DE-PASAJES

Get-NetTCPConnection -LocalPort 18090,18092,8083 -ErrorAction SilentlyContinue |
  Select-Object LocalAddress,LocalPort,State,OwningProcess |
  Format-Table -AutoSize
```

Si el proceso fue lanzado en otra consola, detenerlo con `Ctrl+C` en esa consola.

### Paso R2 - Detener PostgreSQL temporal

```powershell
docker ps -a --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}" |
  Select-String -Pattern "ticketing|55444|55446|postgres"
```

Eliminar contenedores temporales que ya no se usan:

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
Select-String -Path .\tareas.md -Pattern "### Dia 31|Dia 31" -Context 0,45
```

### Paso 3 - Verificar migracion V4

```powershell
Test-Path .\services\ticketing-service\src\main\resources\db\migration\V4__ticket_cancellation_trace.sql

Select-String -Path .\services\ticketing-service\src\main\resources\db\migration\V4__ticket_cancellation_trace.sql `
  -Pattern "cancellation_reason|cancelled_by|idx_tickets_cancelled_at"
```

Resultado esperado:

```text
True
Fragmentos de trazabilidad encontrados.
```

### Paso 4 - Verificar codigo creado

```powershell
Test-Path .\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\api\dto\CancelTicketRequest.java

Select-String -Path .\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\api\TicketingTicketResource.java `
  -Pattern "/cancel|cancelTicket"
```

### Paso 5 - Ejecutar pruebas Maven

```powershell
mvn -f .\services\ticketing-service\pom.xml test
```

Resultado real:

```text
Tests run: 24, Failures: 0, Errors: 0, Skipped: 0
BUILD SUCCESS
```

### Paso 6 - Empaquetar el servicio

Si hay un Quarkus manual usando `target\quarkus-app`, usar salida alterna:

```powershell
mvn -f .\services\ticketing-service\pom.xml package -DskipTests "-Dquarkus.package.output-directory=quarkus-app-day31"
```

Verificar:

```powershell
Test-Path .\services\ticketing-service\target\quarkus-app-day31\quarkus-run.jar
```

### Paso 7 - Validacion asistida completa

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-ticketing-service-local-db.ps1 `
  -DatabasePort 55446 `
  -HttpPort 18092 `
  -JarPath .\services\ticketing-service\target\quarkus-app-day31\quarkus-run.jar
```

Resultado real obtenido:

```json
{
  "service": "ticketing-service",
  "database_port": 55446,
  "http_port": 18092,
  "ticket_status": "ISSUED",
  "duplicate_ticket_http_status": 409,
  "cancelled_ticket_status": "VOIDED",
  "cancellation_reason": "Solicitud del pasajero en validacion local",
  "cancelled_by": "admin-local",
  "duplicate_cancellation_http_status": 409,
  "seats_available_after_cancellation": 1,
  "seats_sold_after_cancellation": 1,
  "ticket_cancellation_outbox_events": 1,
  "voided_tickets": 1,
  "flyway_version": "4",
  "ready": true
}
```

### Paso 8 - Anular manualmente un boleto

Con un boleto `ISSUED` existente:

```powershell
$TicketBaseUrl = "http://localhost:18092/api/v1/ticketing/tickets"
$TicketId = "<ticket_id_emitido>"

$CancelPayload = @{
  reason = "Solicitud del pasajero"
  cancelled_by = "admin-local"
  release_seat = $true
} | ConvertTo-Json -Compress

Invoke-RestMethod -Uri "$TicketBaseUrl/$TicketId/cancel" `
  -Method Post `
  -ContentType "application/json" `
  -Body $CancelPayload
```

Resultado esperado:

```text
status: VOIDED
cancelled_at: no nulo
cancellation_reason: Solicitud del pasajero
cancelled_by: admin-local
```

### Paso 9 - Verificar asiento liberado

```powershell
Invoke-RestMethod -Uri "$AvailabilityBaseUrl/departures/$DispatchDepartureId/seats"
```

El asiento anulado queda:

```text
status: AVAILABLE
available: true
```

### Paso 10 - Revisar eventos en outbox

```powershell
docker exec -e "PGPASSWORD=$DbPassword" venta-pasajes-ticketing-reservation-pg-manual `
  psql -U postgres -d ticketing_db -c "select event_type, aggregate_type, status, created_at from outbox_events order by created_at;"
```

Resultado esperado:

```text
TicketSold
TicketCancelled
```

## Comandos ejecutados en este dia

```powershell
Select-String -Path .\tareas.md -Pattern "### Dia 31|Dia 31" -Context 0,45
Get-Content .\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\service\TicketingSaleService.java
Get-Content .\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\api\TicketingTicketResource.java
Get-Content .\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\persistence\entity\Ticket.java
Get-Content .\services\ticketing-service\src\main\resources\db\migration\V1__ticketing_schema.sql
Get-Content .\services\ticketing-service\src\test\java\com\ventapasajes\ticketing\api\TicketingTicketResourceContractTest.java
Get-Content .\services\ticketing-service\src\test\java\com\ventapasajes\ticketing\persistence\TicketingMigrationContractTest.java
Get-Content .\scripts\verify-ticketing-service-local-db.ps1
mvn -f .\services\ticketing-service\pom.xml test
mvn -f .\services\ticketing-service\pom.xml package -DskipTests "-Dquarkus.package.output-directory=quarkus-app-day31"
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-ticketing-service-local-db.ps1 -DatabasePort 55446 -HttpPort 18092 -JarPath .\services\ticketing-service\target\quarkus-app-day31\quarkus-run.jar
Get-NetTCPConnection -LocalPort 18092,55446 -ErrorAction SilentlyContinue | Select-Object LocalAddress,LocalPort,State,OwningProcess | Format-Table -AutoSize
```

## Problemas y soluciones

| Problema | Causa probable | Solucion |
| --- | --- | --- |
| `HTTP 409 Conflict` al anular. | El boleto ya no esta `ISSUED`. | Consultar el boleto; si ya esta `VOIDED`, la anulacion ya fue aplicada. |
| `reason` requerido. | La anulacion debe conservar motivo. | Enviar `reason` no vacio. |
| `cancelled_by` requerido. | Aun no esta integrado JWT/roles. | Enviar identificador operativo temporal. |
| El asiento no queda libre. | `release_seat=false` o el asiento no estaba `SOLD`. | Usar `release_seat=true` y revisar mapa de asientos. |
| Flyway queda en version 3. | El artefacto no incluye V4. | Empaquetar nuevamente y arrancar con `QUARKUS_FLYWAY_MIGRATE_AT_START=true`. |

## Estado final

```text
ticketing-service puede anular boletos emitidos.
ticketing-service conserva motivo, operador y fecha de anulacion.
ticketing-service libera el asiento cuando release_seat=true.
ticketing-service bloquea doble anulacion con HTTP 409.
ticketing-service publica TicketCancelled en outbox_events.
Flyway llega a version 4.
La validacion local con PostgreSQL temporal queda OK.
```

Siguiente paso natural: Dia 32, pasajeros/clientes.
