# Dia 39 - reporting-service base

Fecha de ejecucion: 2026-09-16

## Objetivo

Crear `reporting-service` como microservicio Quarkus inicial para reportes operativos. El servicio mantiene su propio modelo de lectura en `reporting_db`, consume eventos `TicketSold` y `TicketCancelled`, y responde consultas de reportes sin cargar directamente el flujo transaccional de venta.

Alcance del dia:

```text
Crear proyecto Quarkus reporting-service.
Definir modelos de lectura.
Consumir eventos TicketSold y TicketCancelled.
Crear reportes por fecha.
Crear reportes por usuario.
Validar con PostgreSQL temporal.
```

## Resultado logrado

```text
Se genero reporting-service desde la plantilla Quarkus del monorepo.
Se agrego migracion V1 con dimensiones, fact_ticket_sales, fact_documents, report_export_jobs, processed_events y outbox_events.
Se implemento ingestión idempotente de TicketSold y TicketCancelled.
Se implementaron reportes por fecha, pasajeros, usuario y bus/ruta/terminal.
Se agrego verificador local con PostgreSQL temporal.
Se valido que el servicio consulta reporting_db y no ticketing_db.
```

## Archivos creados

```text
C:\VENTA-DE-PASAJES\services\reporting-service\pom.xml
C:\VENTA-DE-PASAJES\services\reporting-service\src\main\resources\application.properties
C:\VENTA-DE-PASAJES\services\reporting-service\src\main\resources\db\migration\V1__reporting_read_model.sql
C:\VENTA-DE-PASAJES\services\reporting-service\src\main\java\com\ventapasajes\reporting\api\*.java
C:\VENTA-DE-PASAJES\services\reporting-service\src\main\java\com\ventapasajes\reporting\api\dto\*.java
C:\VENTA-DE-PASAJES\services\reporting-service\src\main\java\com\ventapasajes\reporting\persistence\entity\*.java
C:\VENTA-DE-PASAJES\services\reporting-service\src\main\java\com\ventapasajes\reporting\service\*.java
C:\VENTA-DE-PASAJES\services\reporting-service\src\test\java\com\ventapasajes\reporting\api\ReportingContractTest.java
C:\VENTA-DE-PASAJES\scripts\verify-reporting-service-local.ps1
C:\VENTA-DE-PASAJES\docs\dia-39-reporting-service-base.md
```

## Archivos modificados

```text
C:\VENTA-DE-PASAJES\docs\database\reporting-db.sql
C:\VENTA-DE-PASAJES\docs\openapi\reporting-service.openapi.yaml
C:\VENTA-DE-PASAJES\services\reporting-service\README.md
C:\VENTA-DE-PASAJES\vitacora.md
```

## Endpoints implementados

```text
GET  /api/v1/reporting
GET  /api/v1/reporting/resources
GET  /api/v1/reporting/health
POST /api/v1/reporting/events/ticket-sold
POST /api/v1/reporting/events/ticket-cancelled
GET  /api/v1/reporting/reports/sales?date_from=YYYY-MM-DD&date_to=YYYY-MM-DD
GET  /api/v1/reporting/reports/passengers?date_from=YYYY-MM-DD&date_to=YYYY-MM-DD
GET  /api/v1/reporting/reports/sales/by-user?date_from=YYYY-MM-DD&date_to=YYYY-MM-DD
GET  /api/v1/reporting/reports/sales/by-bus?date_from=YYYY-MM-DD&date_to=YYYY-MM-DD&group_by=BUS
```

## Valores usados

```text
Servicio: reporting-service
Puerto local validacion: 18098
Puerto PostgreSQL temporal: 55454
Base temporal: reporting_db
Perfil Quarkus: onprem
Zona horaria reportes: America/Guayaquil
Evento entrada venta: TicketSold
Evento entrada anulacion: TicketCancelled
```

## Reversa primero

Esta seccion sirve para limpiar el ambiente antes de repetir la practica desde cero.

### Paso R1 - Detener reporting-service manual

```powershell
cd C:\VENTA-DE-PASAJES

Get-NetTCPConnection -LocalPort 18098 -ErrorAction SilentlyContinue |
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

El verificador crea contenedores con prefijo `venta-pasajes-d39-reporting-pg`.

```powershell
docker ps -a --filter "name=venta-pasajes-d39-reporting-pg" --format "{{.Names}}" |
  ForEach-Object { docker rm -f $_ }
```

Si se levanto una base manual:

```powershell
docker rm -f venta-pasajes-d39-reporting-pg-manual 2>$null
```

Verificar:

```powershell
docker ps -a --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}" |
  Select-String -Pattern "venta-pasajes-d39-reporting"
```

### Paso R3 - Liberar puertos

```powershell
Get-NetTCPConnection -LocalPort 18098,55454 -ErrorAction SilentlyContinue |
  Select-Object LocalAddress,LocalPort,State,OwningProcess |
  Format-Table -AutoSize
```

Si algun puerto quedo ocupado por esta practica:

```powershell
Stop-Process -Id <process-id> -Force
```

### Paso R4 - Borrar archivos generados por validacion

```powershell
Remove-Item -Recurse -Force .\logs\dia-39 -ErrorAction SilentlyContinue
```

Si se quiere limpiar completamente el build:

```powershell
mvn -f .\services\reporting-service\pom.xml clean
```

### Paso R5 - Revertir base persistente si se aplico manualmente

En la validacion se usa una base temporal. Si se aplico sobre una base local persistente y se quiere deshacer:

```powershell
psql -h localhost -p <reporting-db-port> -U postgres -d reporting_db -c "DROP TABLE IF EXISTS outbox_events, processed_events, idempotency_keys, report_export_jobs, fact_documents, fact_ticket_sales, dim_departures, dim_buses, dim_routes, dim_terminals, dim_users CASCADE;"
psql -h localhost -p <reporting-db-port> -U postgres -d reporting_db -c "DELETE FROM flyway_schema_history WHERE version = '1';"
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

Ejecutar este bloque completo. Es seguro porque solo llama al generador cuando `reporting-service` no existe o cuando la carpeta contiene unicamente `.gitkeep`.

```powershell
$ServiceExists = Test-Path .\services\reporting-service\pom.xml
$DryRun = powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\new-quarkus-service.ps1 `
  -ServiceName reporting-service `
  -PackageSegment reporting `
  -DatabaseName reporting_db `
  -HttpPort 8085 `
  -DryRun | ConvertFrom-Json

if ($ServiceExists -or ($DryRun.target_exists -and -not $DryRun.only_gitkeep)) {
  "reporting-service ya existe. No ejecutar el generador. Continuar con el Paso 3."
} else {
  powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\new-quarkus-service.ps1 `
    -ServiceName reporting-service `
    -PackageSegment reporting `
    -DatabaseName reporting_db `
    -HttpPort 8085
}
```

Interpretacion para este proyecto cuando Dia 39 ya fue aplicado:

```text
Si la consola muestra "reporting-service ya existe", no hay que corregir nada.
Ese mensaje significa que el servicio ya esta creado y debes continuar con el Paso 3.
```

No ejecutar manualmente este comando si `Test-Path .\services\reporting-service\pom.xml` devuelve `True`:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\new-quarkus-service.ps1 `
  -ServiceName reporting-service `
  -PackageSegment reporting `
  -DatabaseName reporting_db `
  -HttpPort 8085
```

Resultado esperado:

```json
{"service_name":"reporting-service","package":"com.ventapasajes.reporting","database_name":"reporting_db","http_port":8085}
```

Si se ejecuta el comando manual anterior cuando el servicio ya existe, aparecera este error:

```text
Target service is not empty. Use -Force to overwrite generated files
```

No es un error de Maven ni de Quarkus. Significa que `reporting-service` ya existe y el script evito sobrescribirlo. Para continuar la practica actual, saltar al Paso 3:

```powershell
Test-Path .\services\reporting-service\src\main\resources\db\migration\V1__reporting_read_model.sql
```

No usar `-Force` salvo que se quiera regenerar deliberadamente desde la plantilla y se tenga claro que se van a sobrescribir archivos generados dentro de `services\reporting-service`.

### Paso 3 - Confirmar migracion del read model

```powershell
Test-Path .\services\reporting-service\src\main\resources\db\migration\V1__reporting_read_model.sql

Select-String -Path .\services\reporting-service\src\main\resources\db\migration\V1__reporting_read_model.sql `
  -Pattern "fact_ticket_sales|processed_events|report_export_jobs|idx_fact_ticket_sales_seller_time"
```

### Paso 4 - Ejecutar pruebas

```powershell
mvn -f .\services\reporting-service\pom.xml test
```

Resultado esperado:

```text
Tests run: 7, Failures: 0, Errors: 0, Skipped: 0
BUILD SUCCESS
```

### Paso 5 - Construir JAR Quarkus

```powershell
mvn -f .\services\reporting-service\pom.xml -DskipTests clean package
```

JAR esperado:

```text
C:\VENTA-DE-PASAJES\services\reporting-service\target\quarkus-app\quarkus-run.jar
```

### Paso 6 - Ejecutar validacion automatica completa

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-reporting-service-local.ps1
```

Para reutilizar el JAR ya construido:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-reporting-service-local.ps1 -SkipPackage
```

Resultado esperado:

```json
{"service":"reporting-service","ready":true}
```

### Paso 7 - Levantar PostgreSQL manual

```powershell
$DatabasePort = 55454
$HttpPort = 18098
$DatabasePassword = [Guid]::NewGuid().ToString("N")

docker run --name venta-pasajes-d39-reporting-pg-manual `
  -e POSTGRES_DB=reporting_db `
  -e POSTGRES_USER=postgres `
  -e "POSTGRES_PASSWORD=$DatabasePassword" `
  -p "${DatabasePort}:5432" `
  -d postgres:16-alpine
```

Esperar disponibilidad:

```powershell
for ($i = 1; $i -le 45; $i++) {
  docker exec venta-pasajes-d39-reporting-pg-manual pg_isready -U postgres -d reporting_db *> $null
  if ($LASTEXITCODE -eq 0) {
    "PostgreSQL listo"
    break
  }
  Start-Sleep -Seconds 2
}
```

### Paso 8 - Levantar reporting-service manual

```powershell
$ReportingJar = (Resolve-Path ".\services\reporting-service\target\quarkus-app\quarkus-run.jar").Path

$env:APP_ENV = "onprem"
$env:APP_RUNTIME_TARGET = "onprem"
$env:APP_SECRETS_PROVIDER = "env"
$env:APP_DB_NAME = "reporting_db"
$env:APP_DB_JDBC_URL = "jdbc:postgresql://localhost:$DatabasePort/reporting_db"
$env:APP_DB_USERNAME = "postgres"
$env:APP_DB_PASSWORD = $DatabasePassword
$env:APP_REPORTING_TIME_ZONE = "America/Guayaquil"
$env:APP_LOG_CONSOLE_JSON = "false"
$env:QUARKUS_PROFILE = "onprem"
$env:QUARKUS_HTTP_PORT = "$HttpPort"
$env:QUARKUS_FLYWAY_MIGRATE_AT_START = "true"

$ReportingProcess = Start-Process `
  -FilePath "java" `
  -ArgumentList @("-jar", $ReportingJar) `
  -WorkingDirectory ".\services\reporting-service" `
  -PassThru
```

Verificar:

```powershell
for ($i = 1; $i -le 45; $i++) {
  try {
    $Health = Invoke-RestMethod -Uri "http://localhost:$HttpPort/q/health/ready" -TimeoutSec 2
    if ($Health.status -eq "UP") { "reporting-service listo"; break }
  } catch {
    Start-Sleep -Seconds 2
  }
}
```

### Paso 9 - Ingerir TicketSold

```powershell
$Today = (Get-Date).ToString("yyyy-MM-dd")
$Now = (Get-Date).ToUniversalTime()
$TicketId = [guid]::NewGuid().ToString()
$DepartureId = [guid]::NewGuid().ToString()
$SellerId = [guid]::NewGuid().ToString()

$TicketSoldPayload = @{
  event_id = [guid]::NewGuid().ToString()
  event_type = "TicketSold"
  schema_version = 1
  occurred_at = $Now.ToString("o")
  source_service = "ticketing-service"
  correlation_id = [guid]::NewGuid().ToString()
  ticket_id = $TicketId
  ticket_number = "RPT-MANUAL-001"
  dispatch_departure_id = $DepartureId
  passenger_name = "Ana Reporte"
  passenger_document_type = "CEDULA"
  passenger_document_number = "3900000001"
  seat_number = "1"
  fare_amount = 25.50
  currency = "USD"
  sold_by_user_id = $SellerId
  seller_display_name = "Operador Manual"
  bus_code = "BUS-RPT-01"
  origin = "Terminal Quito"
  destination = "Terminal Guayaquil"
  departure_at = $Now.AddHours(4).ToString("o")
} | ConvertTo-Json -Depth 8 -Compress

Invoke-RestMethod `
  -Uri "http://localhost:$HttpPort/api/v1/reporting/events/ticket-sold" `
  -Method Post `
  -ContentType "application/json" `
  -Body $TicketSoldPayload
```

### Paso 10 - Consultar reporte de ventas

```powershell
Invoke-RestMethod `
  -Uri "http://localhost:$HttpPort/api/v1/reporting/reports/sales?date_from=$Today&date_to=$Today"
```

Resultado esperado:

```text
summary.tickets_sold = 1
rows[0].ticket_number = RPT-MANUAL-001
```

### Paso 11 - Consultar reporte por usuario

```powershell
Invoke-RestMethod `
  -Uri "http://localhost:$HttpPort/api/v1/reporting/reports/sales/by-user?date_from=$Today&date_to=$Today"
```

### Paso 12 - Revisar base de reportes

```powershell
docker exec venta-pasajes-d39-reporting-pg-manual `
  psql -U postgres -d reporting_db `
  -c "select ticket_id, ticket_number, status, price, currency from fact_ticket_sales;"

docker exec venta-pasajes-d39-reporting-pg-manual `
  psql -U postgres -d reporting_db `
  -c "select event_type, event_id, consumer_name, status from processed_events;"
```

### Paso 13 - Detener ejecucion manual

```powershell
Stop-Process -Id $ReportingProcess.Id -Force
docker rm -f venta-pasajes-d39-reporting-pg-manual

Remove-Item Env:APP_ENV,Env:APP_RUNTIME_TARGET,Env:APP_SECRETS_PROVIDER,Env:APP_DB_NAME,Env:APP_DB_JDBC_URL,Env:APP_DB_USERNAME,Env:APP_DB_PASSWORD,Env:APP_REPORTING_TIME_ZONE,Env:APP_LOG_CONSOLE_JSON,Env:QUARKUS_PROFILE,Env:QUARKUS_HTTP_PORT,Env:QUARKUS_FLYWAY_MIGRATE_AT_START -ErrorAction SilentlyContinue
```

## Peticiones HTTP listas con curl.exe

Health:

```powershell
curl.exe -s "http://localhost:18098/api/v1/reporting/health"
```

Recursos:

```powershell
curl.exe -s "http://localhost:18098/api/v1/reporting/resources"
```

Reporte de ventas:

```powershell
curl.exe -s "http://localhost:18098/api/v1/reporting/reports/sales?date_from=2026-09-16&date_to=2026-09-16"
```

Reporte por usuario:

```powershell
curl.exe -s "http://localhost:18098/api/v1/reporting/reports/sales/by-user?date_from=2026-09-16&date_to=2026-09-16"
```

Reporte por bus:

```powershell
curl.exe -s "http://localhost:18098/api/v1/reporting/reports/sales/by-bus?date_from=2026-09-16&date_to=2026-09-16&group_by=BUS"
```

## Pruebas y validaciones ejecutadas

### Pruebas JVM

```powershell
mvn -f .\services\reporting-service\pom.xml test
```

Resultado:

```text
Tests run: 7, Failures: 0, Errors: 0, Skipped: 0
BUILD SUCCESS
```

### Build JVM

```powershell
mvn -f .\services\reporting-service\pom.xml -DskipTests clean package
```

Resultado:

```text
BUILD SUCCESS
```

### Validacion integrada local

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-reporting-service-local.ps1 -SkipPackage
```

Resultado:

```json
{"service":"reporting-service","runtime":"jvm","quarkus_profile":"onprem","database":"reporting_db","migration_tool":"flyway","http_port":18098,"database_port":55454,"health_status":"ok","report_date":"2026-09-16","ticket_sold_events_processed":2,"ticket_cancelled_events_processed":1,"duplicate_event_processed":false,"fact_ticket_sales":2,"processed_events":3,"tickets_sold":1,"tickets_cancelled":1,"gross_amount":35.50,"net_amount":25.50,"passenger_rows":1,"sales_by_user_rows":2,"sales_by_bus_rows":1,"ready":true}
```

## Problemas encontrados y soluciones

### PowerShell conto mal arrays JSON de Invoke-RestMethod

Diagnostico:

```text
El endpoint sales/by-user devolvia un arreglo JSON, pero Windows PowerShell lo envolvio como arreglo anidado.
El verificador leia Count = 1 aunque internamente habia varias filas.
```

Solucion:

```text
Se agrego ConvertTo-Array en scripts\verify-reporting-service-local.ps1 para normalizar respuestas JSON antes de contar filas.
```

## Estado final

```text
Dia 39 completado.
reporting-service existe como microservicio Quarkus.
reporting_db tiene un read model inicial.
TicketSold crea/actualiza fact_ticket_sales.
TicketCancelled marca ventas como CANCELLED y conserva la anulacion.
processed_events impide reprocesamiento duplicado.
Los reportes por fecha, pasajero, usuario y bus consultan reporting_db.
La validacion local finalizo con ready=true.
```

Siguiente paso natural: iniciar Dia 40 con `mfe-reporting` para consultar estos reportes desde la consola operativa.
