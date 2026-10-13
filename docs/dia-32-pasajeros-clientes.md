# Dia 32 - Pasajeros/clientes

Fecha de ejecucion: 2026-09-15

## Objetivo

Agregar a `ticketing-service` una API para gestionar pasajeros de forma independiente del boleto, con busqueda, deduplicacion razonable, validaciones e historial de boletos.

Alcance del dia:

```text
Implementar CRUD de pasajeros.
Buscar por documento, nombre o apellido.
Evitar duplicados razonables.
Relacionar historial de boletos.
Agregar validaciones.
```

## Resultado logrado

```text
Se agrego la migracion V5__passenger_search_indexes.sql.
Se agregaron indices para busqueda por documento, nombre/apellido y estado.
Se agregaron PassengerRequest y PassengerResponse.
Se agrego TicketingPassengerService.
Se agrego TicketingPassengerResource.
Se agrego CRUD HTTP de pasajeros.
Se agrego busqueda por document_type, document_number, q y status.
Se agrego historial de boletos por pasajero.
Se evita duplicidad por document_type + document_number con HTTP 409.
Se evita duplicidad por email con HTTP 409.
Se refactorizaron reserva y venta para reutilizar el servicio de pasajeros.
Se ampliaron pruebas Maven de 24 a 27.
Se amplio scripts\verify-ticketing-service-local-db.ps1 para validar pasajeros contra PostgreSQL real.
```

## Endpoints creados

```text
GET    /api/v1/ticketing/passengers
POST   /api/v1/ticketing/passengers
GET    /api/v1/ticketing/passengers/{passengerId}
PUT    /api/v1/ticketing/passengers/{passengerId}
DELETE /api/v1/ticketing/passengers/{passengerId}
GET    /api/v1/ticketing/passengers/{passengerId}/tickets
```

Filtros de busqueda:

```text
document_type
document_number
q
status
```

`q` busca sobre:

```text
first_name
last_name
document_number
```

## Cuerpo de pasajero

```json
{
  "document_type": "CEDULA",
  "document_number": "1919191919",
  "first_name": "Marta",
  "last_name": "Cliente",
  "email": "marta.cliente@example.com",
  "phone": "0977777777",
  "status": "ACTIVE"
}
```

Reglas:

```text
document_number es obligatorio.
first_name es obligatorio.
last_name es obligatorio.
document_type por defecto es CEDULA.
status por defecto es ACTIVE.
DELETE no elimina fisicamente: marca el pasajero como INACTIVE.
document_type + document_number no puede repetirse.
email no puede repetirse cuando no es null.
```

## Idea clave

El pasajero ahora tiene vida propia dentro de `ticketing-service`.

Reserva y venta ya no crean pasajeros con logica duplicada. Ambos flujos usan:

```text
TicketingPassengerService.findOrCreateFromRequest(...)
```

Eso mantiene una sola regla para normalizar nombres, documento, email y telefono cuando el pasajero llega desde una reserva o una venta directa.

## Archivos principales

```text
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\resources\db\migration\V5__passenger_search_indexes.sql
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\api\TicketingPassengerResource.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\service\TicketingPassengerService.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\service\TicketingReservationService.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\service\TicketingSaleService.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\api\dto\PassengerRequest.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\api\dto\PassengerResponse.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\test\java\com\ventapasajes\ticketing\api\TicketingPassengerResourceContractTest.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\test\java\com\ventapasajes\ticketing\persistence\TicketingMigrationContractTest.java
C:\VENTA-DE-PASAJES\scripts\verify-ticketing-service-local-db.ps1
```

## Reversa primero

Esta seccion limpia la practica local. No elimina el codigo fuente.

### Paso R1 - Detener ticketing-service

```powershell
cd C:\VENTA-DE-PASAJES

Get-NetTCPConnection -LocalPort 18090,18093,8083 -ErrorAction SilentlyContinue |
  Select-Object LocalAddress,LocalPort,State,OwningProcess |
  Format-Table -AutoSize
```

Si el proceso fue lanzado en otra consola, detenerlo con `Ctrl+C` en esa consola.

### Paso R2 - Detener PostgreSQL temporal

```powershell
docker ps -a --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}" |
  Select-String -Pattern "ticketing|55444|55447|postgres"
```

Eliminar contenedores temporales que ya no se usan:

```powershell
docker rm -f venta-pasajes-ticketing-base-pg-script 2>$null
```

## Guia manual desde cero

### Paso 1 - Ubicarse en el proyecto

```powershell
cd C:\VENTA-DE-PASAJES
```

### Paso 2 - Revisar la tarea del dia

```powershell
Select-String -Path .\tareas.md -Pattern "### Dia 32|Dia 32" -Context 0,45
```

### Paso 3 - Verificar migracion V5

```powershell
Test-Path .\services\ticketing-service\src\main\resources\db\migration\V5__passenger_search_indexes.sql

Select-String -Path .\services\ticketing-service\src\main\resources\db\migration\V5__passenger_search_indexes.sql `
  -Pattern "idx_passengers_document_number|idx_passengers_name_search|idx_passengers_status_name"
```

Resultado esperado:

```text
True
Fragmentos de indices encontrados.
```

### Paso 4 - Verificar codigo creado

```powershell
Test-Path .\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\api\TicketingPassengerResource.java
Test-Path .\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\service\TicketingPassengerService.java

Select-String -Path .\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\api\TicketingPassengerResource.java `
  -Pattern "createPassenger|updatePassenger|deactivatePassenger|ticketHistory"
```

### Paso 5 - Ejecutar pruebas Maven

```powershell
mvn -f .\services\ticketing-service\pom.xml test
```

Resultado real:

```text
Tests run: 27, Failures: 0, Errors: 0, Skipped: 0
BUILD SUCCESS
```

### Paso 6 - Empaquetar el servicio

Si hay un Quarkus manual usando `target\quarkus-app`, usar salida alterna:

```powershell
mvn -f .\services\ticketing-service\pom.xml package -DskipTests "-Dquarkus.package.output-directory=quarkus-app-day32"
```

Verificar:

```powershell
Test-Path .\services\ticketing-service\target\quarkus-app-day32\quarkus-run.jar
```

### Paso 7 - Validacion asistida completa

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-ticketing-service-local-db.ps1 `
  -DatabasePort 55447 `
  -HttpPort 18093 `
  -JarPath .\services\ticketing-service\target\quarkus-app-day32\quarkus-run.jar
```

Resultado real obtenido:

```json
{
  "service": "ticketing-service",
  "database_port": 55447,
  "http_port": 18093,
  "passenger_status": "ACTIVE",
  "duplicate_passenger_http_status": 409,
  "duplicate_passenger_email_http_status": 409,
  "passenger_search_by_document": 1,
  "passenger_search_by_name": 1,
  "updated_passenger_last_name": "Cliente Actualizada",
  "deactivated_passenger_status": "INACTIVE",
  "ticket_history_count": 1,
  "passengers_count": 3,
  "flyway_version": "5",
  "ready": true
}
```

### Paso 8 - Crear pasajero manualmente

```powershell
$PassengerBaseUrl = "http://localhost:18093/api/v1/ticketing/passengers"

$PassengerPayload = @{
  document_type = "CEDULA"
  document_number = "1919191919"
  first_name = "Marta"
  last_name = "Cliente"
  email = "marta.cliente@example.com"
  phone = "0977777777"
} | ConvertTo-Json -Compress

Invoke-RestMethod -Uri $PassengerBaseUrl `
  -Method Post `
  -ContentType "application/json" `
  -Body $PassengerPayload
```

### Paso 9 - Buscar pasajeros

```powershell
Invoke-RestMethod -Uri "$PassengerBaseUrl?document_number=1919191919"
Invoke-RestMethod -Uri "$PassengerBaseUrl?q=Marta"
Invoke-RestMethod -Uri "$PassengerBaseUrl?status=ACTIVE"
```

### Paso 10 - Consultar historial de boletos

```powershell
$PassengerId = "<passenger_id>"

Invoke-RestMethod -Uri "$PassengerBaseUrl/$PassengerId/tickets"
```

## Comandos ejecutados en este dia

```powershell
Select-String -Path .\tareas.md -Pattern "### Dia 32|Dia 32" -Context 0,45
Get-Content .\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\service\TicketingPassengerService.java
Get-Content .\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\api\TicketingPassengerResource.java
Get-Content .\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\service\TicketingReservationService.java
Get-Content .\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\service\TicketingSaleService.java
Get-Content .\services\ticketing-service\src\main\resources\db\migration\V1__ticketing_schema.sql
Get-Content .\scripts\verify-ticketing-service-local-db.ps1
mvn -f .\services\ticketing-service\pom.xml test
mvn -f .\services\ticketing-service\pom.xml package -DskipTests "-Dquarkus.package.output-directory=quarkus-app-day32"
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-ticketing-service-local-db.ps1 -DatabasePort 55447 -HttpPort 18093 -JarPath .\services\ticketing-service\target\quarkus-app-day32\quarkus-run.jar
Get-NetTCPConnection -LocalPort 18093,55447 -State Listen -ErrorAction SilentlyContinue | Select-Object LocalAddress,LocalPort,OwningProcess
docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}" | Select-String -Pattern "55447|18093|venta-pasajes-ticketing-base-pg"
```

## Problemas y soluciones

| Problema | Causa probable | Solucion |
| --- | --- | --- |
| `HTTP 409 Conflict` al crear pasajero. | Ya existe `document_type + document_number` o `email`. | Buscar el pasajero existente y actualizarlo si corresponde. |
| El historial de boletos vuelve vacio. | El pasajero todavia no tiene tickets emitidos. | Emitir un boleto para ese `passenger_id` mediante reserva o venta directa. |
| `DELETE` no borra filas. | La baja es logica para conservar historial. | Revisar `status=INACTIVE`. |
| Flyway queda en version 4. | El artefacto no incluye V5. | Empaquetar nuevamente y arrancar con `QUARKUS_FLYWAY_MIGRATE_AT_START=true`. |

## Estado final

```text
ticketing-service puede crear, consultar, actualizar y desactivar pasajeros.
ticketing-service permite buscar pasajeros por documento, nombre/apellido o estado.
ticketing-service evita duplicados por documento y email con HTTP 409.
ticketing-service expone historial de boletos por pasajero.
Reserva y venta reutilizan una sola logica de find-or-create de pasajeros.
Flyway llega a version 5.
La validacion local con PostgreSQL temporal queda OK.
```

Siguiente paso natural: Dia 33, mfe-ticketing base.
