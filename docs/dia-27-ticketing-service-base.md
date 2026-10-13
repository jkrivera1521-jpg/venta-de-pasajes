# Dia 27 - ticketing-service base

Fecha de ejecucion: 2026-09-14

## Objetivo

Crear la base tecnica de `ticketing-service`, el microservicio dueno del dominio de boleteria y venta de pasajes.

Alcance del dia:

```text
Crear proyecto Quarkus ticketing-service.
Crear migracion inicial para pasajeros, asientos por salida, reservas y boletos.
Definir restricciones unicas del modelo inicial de venta.
Configurar una frontera transaccional inicial.
Configurar OpenAPI y endpoints base del dominio.
Validar localmente con PostgreSQL temporal.
```

Este documento esta escrito como guia de practica, similar al Dia 26: el codigo fuente Java ya quedo creado como entregable del dia y aqui se documenta como revisar, compilar, ejecutar, probar y limpiar el ambiente.

## Resultado logrado

```text
Servicio creado: C:\VENTA-DE-PASAJES\services\ticketing-service
Paquete Java: com.ventapasajes.ticketing
Base local: ticketing_db
Puerto default del servicio: 8083
Puerto usado en validacion local manual/asistida: 18090
PostgreSQL temporal usado en validacion: 55443 o 55444
Migracion Flyway: V1__ticketing_schema.sql
Pruebas Maven: 10 OK
Artefacto JVM: target\quarkus-app\quarkus-run.jar
```

## Mapeo del dominio

El documento de tareas usa nombres de negocio en espanol. El proyecto mantiene nombres tecnicos en ingles, como ya ocurre en `identity-service` y `dispatch-service`.

```text
pasajeros        -> passengers
asientos_salida  -> departure_seats
reservas         -> reservations
boletos          -> tickets
```

## Archivos principales

```text
C:\VENTA-DE-PASAJES\services\ticketing-service\pom.xml
C:\VENTA-DE-PASAJES\services\ticketing-service\README.md
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\resources\application.properties
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\resources\db\migration\V1__ticketing_schema.sql
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\api
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\domain
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\persistence
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\service
C:\VENTA-DE-PASAJES\services\ticketing-service\src\test\java\com\ventapasajes\ticketing
C:\VENTA-DE-PASAJES\scripts\verify-ticketing-service-local-db.ps1
```

## Que contiene el codigo creado

```text
api
  Expone health, overview del dominio, recursos administrados y estados del modelo.

domain
  Define enums de estado: pasajero, asiento por salida, reserva y boleto.

persistence
  Define la entidad base auditable y las entidades JPA/Panache del modelo inicial.

service
  Contiene consultas de catalogo y una frontera transaccional inicial para venta/reserva.

db\migration
  Contiene el SQL versionado que Flyway ejecuta al arrancar contra PostgreSQL.

tests
  Validan health, OpenAPI, overview, migracion Flyway, perfiles y transacciones.
```

## Reversa primero

Esta seccion sirve para limpiar el ambiente antes de repetir la practica. No borra el codigo fuente del servicio.

### Paso R1 - Detener ticketing-service si esta levantado

Revisar puertos:

```powershell
cd C:\VENTA-DE-PASAJES

Get-NetTCPConnection -LocalPort 8083,18090,55443,55444 -ErrorAction SilentlyContinue |
  Select-Object LocalAddress,LocalPort,State,OwningProcess |
  Format-Table -AutoSize
```

Revisar procesos Java:

```powershell
Get-CimInstance Win32_Process -Filter "name = 'java.exe'" |
  Select-Object ProcessId,CommandLine |
  Format-List
```

Detener solo los procesos que correspondan a `ticketing-service`:

```powershell
$TicketingPids = Get-NetTCPConnection -LocalPort 8083,18090 -ErrorAction SilentlyContinue |
  Where-Object { $_.State -eq "Listen" } |
  Select-Object -ExpandProperty OwningProcess -Unique

$TicketingPids

$TicketingPids | ForEach-Object {
  Stop-Process -Id $_ -Force
}
```

### Paso R2 - Detener PostgreSQL temporal

Ver contenedores relacionados:

```powershell
docker ps -a --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}" |
  Select-String -Pattern "ticketing|55443|55444|postgres"
```

Eliminar contenedores temporales conocidos:

```powershell
docker rm -f venta-pasajes-ticketing-base-pg-manual 2>$null
docker rm -f venta-pasajes-ticketing-base-pg-script 2>$null
```

Verificar que ya no hay un proceso escuchando en el puerto de base:

```powershell
Get-NetTCPConnection -LocalPort 55443,55444 -ErrorAction SilentlyContinue |
  Select-Object LocalAddress,LocalPort,State,OwningProcess |
  Format-Table -AutoSize
```

Si aparecen estados como `TimeWait` o `FinWait2`, normalmente son conexiones cerrandose. El estado que bloquea el puerto es `Listen`.

### Paso R3 - Limpiar artefactos generados

```powershell
mvn -f .\services\ticketing-service\pom.xml clean
```

### Paso R4 - Limpiar variables sensibles de PowerShell

```powershell
Remove-Item Env:\APP_DB_PASSWORD -ErrorAction SilentlyContinue
Remove-Item Env:\APP_DB_JDBC_URL -ErrorAction SilentlyContinue
Remove-Item Env:\APP_DB_USERNAME -ErrorAction SilentlyContinue
```

## Guia manual desde cero

En esta guia, "desde cero" significa desde un ambiente limpio de ejecucion: sin Quarkus levantado, sin PostgreSQL temporal anterior y sin `target` compilado. El codigo fuente del Dia 27 ya forma parte del proyecto, por eso no se vuelve a pegar Java dentro del documento.

### Paso 1 - Ubicarse en el proyecto

```powershell
cd C:\VENTA-DE-PASAJES
```

### Paso 2 - Revisar la tarea del dia

```powershell
Select-String -Path .\tareas.md -Pattern "### Dia 27" -Context 0,32
```

### Paso 3 - Confirmar que el servicio existe

```powershell
Test-Path .\services\ticketing-service\pom.xml
Test-Path .\services\ticketing-service\src\main\resources\application.properties
Test-Path .\services\ticketing-service\src\main\resources\db\migration\V1__ticketing_schema.sql
```

Resultado esperado:

```text
True
True
True
```

Si la carpeta no existe porque fue borrada en una practica anterior, se puede recrear la base Quarkus con la plantilla:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\new-quarkus-service.ps1 `
  -ServiceName ticketing-service `
  -PackageSegment ticketing `
  -DatabaseName ticketing_db `
  -HttpPort 8083
```

Importante: ese comando solo crea el esqueleto Quarkus. El codigo especifico del Dia 27, como entidades, DTOs, servicios, migracion real y pruebas, ya debe estar en el proyecto antes de hacer la practica completa.

### Paso 4 - Revisar configuracion del servicio

```powershell
Select-String -Path .\services\ticketing-service\src\main\resources\application.properties `
  -Pattern "quarkus.application.name|app.database.name|QUARKUS_HTTP_PORT|smallrye-openapi|swagger-ui|%gcp|%onprem"
```

Debe verse configuracion para:

```text
Nombre de aplicacion: ticketing-service
Base default: ticketing_db
Puerto default: 8083
OpenAPI y Swagger UI
Perfil gcp
Perfil onprem
```

### Paso 5 - Revisar migracion Flyway

La migracion ya esta creada en:

```text
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\resources\db\migration\V1__ticketing_schema.sql
```

Verificar fragmentos importantes:

```powershell
Select-String -Path .\services\ticketing-service\src\main\resources\db\migration\V1__ticketing_schema.sql `
  -Pattern "CREATE EXTENSION|CREATE TABLE|CREATE UNIQUE INDEX|CONSTRAINT"
```

La migracion debe incluir:

```text
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

passengers
reservations
departure_seats
tickets
outbox_events
```

Las extensiones `pgcrypto` y `citext` no se ejecutan directamente en PowerShell. Son SQL de PostgreSQL y Flyway las ejecuta automaticamente cuando el servicio arranca con:

```powershell
$env:QUARKUS_FLYWAY_MIGRATE_AT_START = "true"
```

### Paso 6 - Revisar restricciones unicas

```powershell
Select-String -Path .\services\ticketing-service\src\main\resources\db\migration\V1__ticketing_schema.sql `
  -Pattern "UNIQUE|CREATE UNIQUE INDEX"
```

Restricciones esperadas:

```text
passengers.legacy_id unico
passengers.document_type + document_number unico
passengers.email unico cuando no es null
reservations.reservation_code unico
departure_seats.dispatch_departure_id + seat_number unico
tickets.legacy_id unico
tickets.ticket_number unico
tickets.departure_seat_id unico para tickets activos
outbox_events.event_id unico
```

### Paso 7 - Revisar codigo Java creado

Este paso solo lista archivos. No copia codigo Java en el documento.

```powershell
Get-ChildItem .\services\ticketing-service\src\main\java\com\ventapasajes\ticketing -Recurse -File |
  Where-Object { $_.Extension -eq ".java" } |
  Select-Object FullName |
  Format-Table -AutoSize
```

Validar entidades:

```powershell
Get-ChildItem .\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\persistence\entity -File |
  Select-Object Name |
  Format-Table -AutoSize
```

Entidades esperadas:

```text
Passenger.java
Reservation.java
DepartureSeat.java
Ticket.java
OutboxEvent.java
```

Validar DTOs, API y servicios:

```powershell
Get-ChildItem .\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\api -Recurse -File |
  Select-Object Name |
  Format-Table -AutoSize

Get-ChildItem .\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\service -File |
  Select-Object Name |
  Format-Table -AutoSize
```

### Paso 8 - Revisar transacciones

```powershell
Select-String -Path .\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\service\TicketingSaleService.java `
  -Pattern "@Transactional|persistReservationDraft|persistTicketIssue"
```

Que significa:

```text
@Transactional indica que las escrituras de venta deben ejecutarse dentro de una transaccion.
persistReservationDraft(...) prepara una reserva inicial.
persistTicketIssue(...) persiste el boleto y marca el asiento como vendido.
```

### Paso 9 - Ejecutar pruebas Maven

```powershell
mvn -f .\services\ticketing-service\pom.xml test
```

Resultado real del dia:

```text
Tests run: 10, Failures: 0, Errors: 0, Skipped: 0
BUILD SUCCESS
```

Las pruebas cubren:

```text
Health local.
SmallRye Health.
OpenAPI.
Overview de ticketing.
Recursos del modelo inicial.
Estados de asientos, reservas y boletos.
Contrato de migracion Flyway.
Metodos transaccionales.
Perfiles GCP/onprem.
```

### Paso 10 - Empaquetar el servicio

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

Si Windows responde que un archivo dentro de `target\quarkus-app` esta siendo usado, hay un Java anterior ejecutando el servicio. Detenlo con los pasos de reversa y repite:

```powershell
mvn -f .\services\ticketing-service\pom.xml clean
mvn -f .\services\ticketing-service\pom.xml package -DskipTests
```

### Paso 11 - Validacion asistida completa

Este script automatiza PostgreSQL temporal, variables, arranque del servicio, curls, validacion de tablas y limpieza.

Si el puerto `55443` esta libre:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-ticketing-service-local-db.ps1 `
  -DatabasePort 55443 `
  -HttpPort 18090
```

Si `55443` esta ocupado:

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
  "quarkus_profile": "onprem",
  "secrets_provider": "env",
  "database": "ticketing_db",
  "database_port": 55444,
  "http_port": 18090,
  "health_status": "ok",
  "overview_service": "ticketing-service",
  "resources_count": 5,
  "seat_statuses": 5,
  "reservation_statuses": 5,
  "ticket_statuses": 4,
  "public_tables": 6,
  "unique_constraints_or_indexes": 15,
  "flyway_version": "1",
  "ready": true
}
```

### Paso 12 - Validacion manual con PostgreSQL temporal

Usar este flujo si quieres hacerlo a mano.

Primero verificar que no hay otro PostgreSQL usando el puerto:

```powershell
Get-NetTCPConnection -LocalPort 55443 -ErrorAction SilentlyContinue |
  Select-Object LocalAddress,LocalPort,State,OwningProcess |
  Format-Table -AutoSize
```

Crear una contrasena temporal en esta misma consola:

```powershell
$DbPassword = [Guid]::NewGuid().ToString("N")
```

Levantar PostgreSQL temporal:

```powershell
docker run --rm --name venta-pasajes-ticketing-base-pg-manual `
  -e POSTGRES_DB=ticketing_db `
  -e POSTGRES_USER=postgres `
  -e "POSTGRES_PASSWORD=$DbPassword" `
  -p "55443:5432" `
  -d postgres:16-alpine
```

Esperar hasta que PostgreSQL este listo:

```powershell
docker exec venta-pasajes-ticketing-base-pg-manual `
  pg_isready -U postgres -d ticketing_db
```

Configurar variables para Quarkus en la misma consola:

```powershell
$env:QUARKUS_PROFILE = "onprem"
$env:QUARKUS_HTTP_PORT = "18090"
$env:APP_ENV = "local"
$env:APP_RUNTIME_TARGET = "onprem"
$env:APP_SECRETS_PROVIDER = "env"
$env:APP_DB_NAME = "ticketing_db"
$env:APP_DB_JDBC_URL = "jdbc:postgresql://localhost:55443/ticketing_db"
$env:APP_DB_USERNAME = "postgres"
$env:APP_DB_PASSWORD = $DbPassword
$env:QUARKUS_FLYWAY_MIGRATE_AT_START = "true"
$env:APP_LOG_CONSOLE_JSON = "false"
```

Verificar que la contrasena existe sin imprimirla:

```powershell
[bool]$env:APP_DB_PASSWORD
```

Resultado esperado:

```text
True
```

Arrancar el servicio:

```powershell
java -jar .\services\ticketing-service\target\quarkus-app\quarkus-run.jar
```

Cuando esta consola queda con Quarkus corriendo, dejarla abierta. Para probar endpoints, abrir otra consola PowerShell.

### Paso 13 - Probar endpoints con curl.exe

Ejecutar en otra consola mientras Quarkus sigue corriendo:

```powershell
cd C:\VENTA-DE-PASAJES

$baseUrl = "http://localhost:18090/api/v1/ticketing"

curl.exe -i -S "$baseUrl/health"
curl.exe -sS "$baseUrl"
curl.exe -sS "$baseUrl/resources"
curl.exe -sS "$baseUrl/seat-statuses"
curl.exe -sS "$baseUrl/reservation-statuses"
curl.exe -sS "$baseUrl/ticket-statuses"
curl.exe -i -S "http://localhost:18090/q/openapi"
```

Endpoints disponibles:

```text
GET /api/v1/ticketing
GET /api/v1/ticketing/health
GET /api/v1/ticketing/resources
GET /api/v1/ticketing/seat-statuses
GET /api/v1/ticketing/reservation-statuses
GET /api/v1/ticketing/ticket-statuses
GET /q/health
GET /q/health/live
GET /q/health/ready
GET /q/openapi
GET /q/swagger-ui
```

### Paso 14 - Revisar tablas creadas por Flyway

Si estas usando el contenedor manual:

```powershell
docker exec -e "PGPASSWORD=$DbPassword" venta-pasajes-ticketing-base-pg-manual `
  psql -U postgres -d ticketing_db -c "\dt"
```

Ver restricciones e indices:

```powershell
docker exec -e "PGPASSWORD=$DbPassword" venta-pasajes-ticketing-base-pg-manual `
  psql -U postgres -d ticketing_db -c "\di"
```

Ver historial Flyway:

```powershell
docker exec -e "PGPASSWORD=$DbPassword" venta-pasajes-ticketing-base-pg-manual `
  psql -U postgres -d ticketing_db -c "select installed_rank, version, description, success from flyway_schema_history order by installed_rank;"
```

Ver extensiones:

```powershell
docker exec -e "PGPASSWORD=$DbPassword" venta-pasajes-ticketing-base-pg-manual `
  psql -U postgres -d ticketing_db -c "select extname, extversion from pg_extension where extname in ('pgcrypto','citext') order by extname;"
```

### Paso 15 - Detener la practica manual

En la consola donde esta Quarkus, presionar:

```text
Ctrl+C
```

Luego eliminar el PostgreSQL temporal:

```powershell
docker rm -f venta-pasajes-ticketing-base-pg-manual
```

Limpiar variables sensibles:

```powershell
Remove-Item Env:\APP_DB_PASSWORD -ErrorAction SilentlyContinue
Remove-Item Env:\APP_DB_JDBC_URL -ErrorAction SilentlyContinue
Remove-Item Env:\APP_DB_USERNAME -ErrorAction SilentlyContinue
```

## Comandos ejecutados en este dia

```powershell
Select-String -Path .\tareas.md -Pattern "### Dia 27" -Context 0,32
Get-ChildItem .\services\ticketing-service -Force -Recurse
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\new-quarkus-service.ps1 -ServiceName ticketing-service -PackageSegment ticketing -DatabaseName ticketing_db -HttpPort 8083
Select-String -Path .\services\ticketing-service\src\main\resources\application.properties -Pattern "quarkus.application.name|app.database.name|QUARKUS_HTTP_PORT|smallrye-openapi|swagger-ui|%gcp|%onprem"
Select-String -Path .\services\ticketing-service\src\main\resources\db\migration\V1__ticketing_schema.sql -Pattern "CREATE EXTENSION|CREATE TABLE|CREATE UNIQUE INDEX|CONSTRAINT"
Select-String -Path .\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\service\TicketingSaleService.java -Pattern "@Transactional|persistReservationDraft|persistTicketIssue"
mvn -f .\services\ticketing-service\pom.xml test
mvn -f .\services\ticketing-service\pom.xml package -DskipTests
Test-Path .\services\ticketing-service\target\quarkus-app\quarkus-run.jar
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-ticketing-service-local-db.ps1 -DatabasePort 55444 -HttpPort 18090
curl.exe -sS "http://localhost:18090/api/v1/ticketing/health"
curl.exe -sS "http://localhost:18090/api/v1/ticketing"
curl.exe -sS "http://localhost:18090/api/v1/ticketing/resources"
curl.exe -sS "http://localhost:18090/api/v1/ticketing/ticket-statuses"
```

## Problemas y soluciones

| Problema | Causa probable | Solucion |
| --- | --- | --- |
| `curl.exe` responde `Failed to connect`. | El servicio no esta levantado o esta en otro puerto. | Verificar `QUARKUS_HTTP_PORT` y `Get-NetTCPConnection`. |
| Flyway no crea tablas. | `QUARKUS_FLYWAY_MIGRATE_AT_START` esta en `false` o no hay conexion a PostgreSQL. | Usar `QUARKUS_FLYWAY_MIGRATE_AT_START=true` y validar `APP_DB_JDBC_URL`. |
| `Connection to localhost:5432 refused`. | El servicio apunta al puerto default, pero PostgreSQL temporal esta en otro puerto. | Usar `APP_DB_JDBC_URL=jdbc:postgresql://localhost:55443/ticketing_db`. |
| `FileSystemException` sobre `target\quarkus-app\lib\boot\*.jar`. | Hay un Java anterior ejecutando el servicio y Windows bloquea los `.jar`. | Detener el PID que escucha en `8083` o `18090`, ejecutar `mvn clean` y repetir el paquete. |
| `Bind for 0.0.0.0:55443 failed: port is already allocated`. | Ya existe un contenedor o proceso usando `55443`. | Ejecutar `docker rm -f venta-pasajes-ticketing-base-pg-script` o usar `-DatabasePort 55444`. |
| En una segunda consola vuelve a fallar `docker run`. | La primera consola ya dejo PostgreSQL levantado. | En la segunda consola ejecutar solo los `curl.exe`; no crear otra base. |
| `FATAL: password authentication failed for user "postgres"`. | Java arranco con una contrasena distinta a la del contenedor PostgreSQL. | Definir `$DbPassword`, levantar PostgreSQL y configurar `$env:APP_DB_PASSWORD = $DbPassword` en la misma consola antes de `java -jar`. |
| No encuentro `rg`. | Ripgrep no esta instalado o no esta en PATH. | Usar los comandos alternativos con `Get-ChildItem`. |

## Estado final

```text
ticketing-service existe como microservicio Quarkus local.
Base tecnica del dominio de boleteria creada.
Modelo inicial de venta versionado con Flyway.
Restricciones unicas principales definidas.
OpenAPI disponible.
Transacciones configuradas en TicketingSaleService.
Pruebas Maven OK.
Validacion local con PostgreSQL temporal OK.
```

Siguiente paso natural: Dia 28, disponibilidad de asientos.
