# Dia 42 - audit-service

Fecha de ejecucion: 2026-09-16

## Objetivo

Crear `audit-service` como microservicio Quarkus para auditoria funcional inmutable del sistema Venta de Pasajes.

Nota de numeracion: en el plan original `audit-service` aparecia como Dia 41, pero en esta bitacora el Dia 41 se uso para `mfe-reporting`. Por eso este entregable queda documentado como Dia 42.

Alcance del dia:

```text
Crear proyecto Quarkus audit-service.
Crear base audit_db.
Registrar eventos auditables append-only.
Deduplicar por source_service + event_id.
Crear consulta basica de auditoria.
Crear verificacion local con PostgreSQL temporal.
```

## Resultado logrado

```text
Se genero audit-service desde la plantilla Quarkus.
Se creo migracion V1 para audit_events, processed_events y outbox_events.
Se implemento POST /api/v1/audit/audit-events.
Se implemento GET /api/v1/audit/audit-events con filtros y paginacion.
Se implemento GET /api/v1/audit/audit-events/{eventId}.
Se mantuvo health, overview, resources y OpenAPI.
Se agrego verificador local scripts\verify-audit-service-local.ps1.
Se valido idempotencia: el primer evento procesa y el duplicado no crea otra fila.
```

## Archivos creados

```text
C:\VENTA-DE-PASAJES\services\audit-service\pom.xml
C:\VENTA-DE-PASAJES\services\audit-service\src\main\resources\application.properties
C:\VENTA-DE-PASAJES\services\audit-service\src\main\resources\db\migration\V1__audit_schema.sql
C:\VENTA-DE-PASAJES\services\audit-service\src\main\java\com\ventapasajes\audit\api\AuditBaseResource.java
C:\VENTA-DE-PASAJES\services\audit-service\src\main\java\com\ventapasajes\audit\api\AuditEventResource.java
C:\VENTA-DE-PASAJES\services\audit-service\src\main\java\com\ventapasajes\audit\api\dto\*.java
C:\VENTA-DE-PASAJES\services\audit-service\src\main\java\com\ventapasajes\audit\service\AuditEventService.java
C:\VENTA-DE-PASAJES\services\audit-service\src\main\java\com\ventapasajes\audit\persistence\entity\AuditEvent.java
C:\VENTA-DE-PASAJES\services\audit-service\src\test\java\com\ventapasajes\audit\api\AuditContractTest.java
C:\VENTA-DE-PASAJES\services\audit-service\README.md
C:\VENTA-DE-PASAJES\scripts\verify-audit-service-local.ps1
C:\VENTA-DE-PASAJES\docs\dia-42-audit-service.md
```

## Archivos modificados

```text
C:\VENTA-DE-PASAJES\docs\openapi\audit-service.openapi.yaml
C:\VENTA-DE-PASAJES\vitacora.md
```

## Endpoints implementados

```text
GET  /api/v1/audit
GET  /api/v1/audit/resources
GET  /api/v1/audit/health
POST /api/v1/audit/audit-events
GET  /api/v1/audit/audit-events
GET  /api/v1/audit/audit-events/{eventId}
GET  /q/health
GET  /q/openapi
GET  /q/swagger-ui
```

## Valores usados

```text
Servicio: audit-service
Puerto app por defecto: 8086
Puerto local validacion: 18099
Puerto PostgreSQL temporal: 55455
Base temporal: audit_db
Perfil Quarkus: onprem
Deduplicacion: source_service + event_id
Evento salida: AuditEventCreated
```

## Reversa primero

Esta seccion sirve para limpiar el ambiente antes de repetir la practica desde cero.

### Paso R1 - Detener audit-service manual

```powershell
cd C:\VENTA-DE-PASAJES

Get-NetTCPConnection -LocalPort 18099 -ErrorAction SilentlyContinue |
  Select-Object LocalAddress,LocalPort,State,OwningProcess |
  Format-Table -AutoSize
```

Si el proceso corresponde a esta practica:

```powershell
Stop-Process -Id <process-id> -Force
```

Revisar procesos Java antes de detener algo manualmente:

```powershell
Get-CimInstance Win32_Process -Filter "name = 'java.exe'" |
  Select-Object ProcessId,CommandLine |
  Format-List
```

### Paso R2 - Eliminar PostgreSQL temporal

El verificador crea contenedores con prefijo `venta-pasajes-d42-audit-pg`.

```powershell
docker ps -a --filter "name=venta-pasajes-d42-audit-pg" --format "{{.Names}}" |
  ForEach-Object { docker rm -f $_ }
```

Si se levanto una base manual:

```powershell
docker rm -f venta-pasajes-d42-audit-pg-manual 2>$null
```

Verificar:

```powershell
docker ps -a --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}" |
  Select-String -Pattern "venta-pasajes-d42-audit"
```

### Paso R3 - Liberar puertos

```powershell
Get-NetTCPConnection -LocalPort 18099,55455 -ErrorAction SilentlyContinue |
  Select-Object LocalAddress,LocalPort,State,OwningProcess |
  Format-Table -AutoSize
```

Si algun puerto quedo ocupado por esta practica:

```powershell
Stop-Process -Id <process-id> -Force
```

### Paso R4 - Borrar archivos generados por validacion

```powershell
Remove-Item -Recurse -Force .\logs\dia-42 -ErrorAction SilentlyContinue
```

Si se quiere limpiar completamente el build:

```powershell
mvn -f .\services\audit-service\pom.xml clean
```

### Paso R5 - Revertir base persistente si se aplico manualmente

En la validacion se usa una base temporal. Si se aplico sobre una base local persistente y se quiere deshacer:

```powershell
psql -h localhost -p <audit-db-port> -U postgres -d audit_db -c "DROP TABLE IF EXISTS outbox_events, processed_events, audit_events CASCADE;"
psql -h localhost -p <audit-db-port> -U postgres -d audit_db -c "DELETE FROM flyway_schema_history WHERE version = '1';"
```

No ejecutar este paso en una base compartida sin respaldo.

## Guia manual desde cero

### Paso 1 - Validar herramientas

```powershell
cd C:\VENTA-DE-PASAJES

java -version
mvn -version
docker version
docker info
```

`docker info` debe responder sin error. Si aparece `dockerDesktopLinuxEngine`, iniciar Docker Desktop:

```powershell
Start-Service -Name com.docker.service -ErrorAction SilentlyContinue
Start-Process -FilePath "C:\Program Files\Docker\Docker\Docker Desktop.exe" -WindowStyle Hidden

for ($i = 1; $i -le 60; $i++) {
  docker info *> $null
  if ($LASTEXITCODE -eq 0) {
    "Docker listo despues de $i intentos"
    break
  }
  Start-Sleep -Seconds 2
}

docker info
```

### Paso 2 - Crear servicio desde plantilla, solo si falta

Ejecutar este bloque completo. Es seguro porque solo llama al generador cuando `audit-service` no existe o cuando la carpeta contiene unicamente `.gitkeep`.

```powershell
$ServiceExists = Test-Path .\services\audit-service\pom.xml
$DryRun = powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\new-quarkus-service.ps1 `
  -ServiceName audit-service `
  -PackageSegment audit `
  -DatabaseName audit_db `
  -HttpPort 8086 `
  -DryRun | ConvertFrom-Json

if ($ServiceExists -or ($DryRun.target_exists -and -not $DryRun.only_gitkeep)) {
  "audit-service ya existe. No ejecutar el generador. Continuar con el Paso 3."
} else {
  powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\new-quarkus-service.ps1 `
    -ServiceName audit-service `
    -PackageSegment audit `
    -DatabaseName audit_db `
    -HttpPort 8086
}
```

No usar `-Force` salvo que se quiera regenerar deliberadamente desde la plantilla.

### Paso 3 - Confirmar archivos clave

```powershell
Test-Path .\services\audit-service\pom.xml
Test-Path .\services\audit-service\src\main\resources\db\migration\V1__audit_schema.sql
Test-Path .\services\audit-service\src\main\java\com\ventapasajes\audit\service\AuditEventService.java
Test-Path .\scripts\verify-audit-service-local.ps1
```

Resultado esperado:

```text
True
True
True
True
```

### Paso 4 - Ejecutar pruebas rapidas

```powershell
mvn -f .\services\audit-service\pom.xml test
```

Resultado validado:

```text
Tests run: 7, Failures: 0, Errors: 0, Skipped: 0
BUILD SUCCESS
```

### Paso 5 - Ejecutar verificacion automatica completa

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-audit-service-local.ps1
```

Resultado validado:

```json
{"service":"audit-service","runtime":"jvm","quarkus_profile":"onprem","database":"audit_db","migration_tool":"flyway","http_port":18099,"database_port":55455,"health_status":"ok","overview_service":"audit-service","resources_count":3,"action":"ticket.cancelled","first_event_processed":true,"duplicate_event_processed":false,"audit_events":1,"processed_events":1,"outbox_audit_event_created":1,"search_total_items":1,"ready":true}
```

Para reutilizar el jar ya construido:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-audit-service-local.ps1 -SkipPackage
```

### Paso 6 - Probar manualmente con PostgreSQL propio

Levantar PostgreSQL temporal manual:

```powershell
docker run --name venta-pasajes-d42-audit-pg-manual `
  -e POSTGRES_DB=audit_db `
  -e POSTGRES_USER=postgres `
  -e POSTGRES_PASSWORD=postgres `
  -p 55455:5432 `
  -d postgres:16-alpine
```

Compilar:

```powershell
mvn -f .\services\audit-service\pom.xml -DskipTests clean package
```

Configurar ambiente:

```powershell
$env:APP_ENV = "onprem"
$env:APP_RUNTIME_TARGET = "onprem"
$env:APP_SECRETS_PROVIDER = "env"
$env:APP_DB_NAME = "audit_db"
$env:APP_DB_JDBC_URL = "jdbc:postgresql://localhost:55455/audit_db"
$env:APP_DB_USERNAME = "postgres"
$env:APP_DB_PASSWORD = "postgres"
$env:APP_LOG_CONSOLE_JSON = "false"
$env:QUARKUS_PROFILE = "onprem"
$env:QUARKUS_HTTP_PORT = "18099"
$env:QUARKUS_FLYWAY_MIGRATE_AT_START = "true"
```

Ejecutar:

```powershell
java -jar .\services\audit-service\target\quarkus-app\quarkus-run.jar
```

En otra terminal:

```powershell
curl.exe -s http://localhost:18099/api/v1/audit/health
curl.exe -s http://localhost:18099/api/v1/audit/resources
```

Crear evento auditable:

```powershell
$EventId = [guid]::NewGuid().ToString()
$Payload = @{
  event_id = $EventId
  event_type = "TicketCancelled"
  schema_version = 1
  occurred_at = (Get-Date).ToUniversalTime().ToString("o")
  source_service = "ticketing-service"
  correlation_id = [guid]::NewGuid().ToString()
  actor_user_id = [guid]::NewGuid().ToString()
  action = "ticket.cancelled"
  resource_type = "ticket"
  resource_id = [guid]::NewGuid().ToString()
  payload = @{
    ticket_number = "AUD-MANUAL-001"
    reason = "Prueba manual Dia 42"
    amount = 25.50
    currency = "USD"
  }
} | ConvertTo-Json -Depth 8 -Compress

Invoke-RestMethod `
  -Uri "http://localhost:18099/api/v1/audit/audit-events" `
  -Method Post `
  -Headers @{ "Idempotency-Key" = "manual-$EventId" } `
  -ContentType "application/json" `
  -Body $Payload
```

Consultar:

```powershell
Invoke-RestMethod -Uri "http://localhost:18099/api/v1/audit/audit-events/$EventId"
Invoke-RestMethod -Uri "http://localhost:18099/api/v1/audit/audit-events?action=ticket.cancelled&page=1&page_size=10"
```

### Paso 7 - Revisar base de datos

```powershell
docker exec venta-pasajes-d42-audit-pg-manual `
  psql -U postgres -d audit_db `
  -c "select source_service, event_type, action, resource_type, occurred_at from audit_events order by occurred_at desc;"

docker exec venta-pasajes-d42-audit-pg-manual `
  psql -U postgres -d audit_db `
  -c "select event_type, status, attempts from outbox_events;"
```

## Troubleshooting

### Error: Target service is not empty

Si aparece:

```text
Target service is not empty. Use -Force to overwrite generated files
```

Significa que `services\audit-service` ya existe. No es error de Maven. Continuar con el Paso 3.

### Error: Docker Desktop no responde

Si aparece `dockerDesktopLinuxEngine` o `The system cannot find the file specified`, iniciar Docker Desktop y repetir:

```powershell
docker info
```

### Error: puerto ocupado

Revisar:

```powershell
Get-NetTCPConnection -LocalPort 18099,55455 -ErrorAction SilentlyContinue |
  Select-Object LocalAddress,LocalPort,State,OwningProcess |
  Format-Table -AutoSize
```

Detener solo si corresponde a esta practica:

```powershell
Stop-Process -Id <process-id> -Force
```

## Validacion final

```text
mvn -f .\services\audit-service\pom.xml test: OK.
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-audit-service-local.ps1: OK.
audit-service health: ok.
audit_events: 1.
processed_events: 1.
outbox AuditEventCreated: 1.
Evento duplicado: processed=false.
```

## Siguiente paso natural

```text
Continuar con mfe-admin.
Integrar pantalla de auditoria consumiendo audit-service.
```
