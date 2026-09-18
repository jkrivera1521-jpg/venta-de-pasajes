# Dia 38 - Integracion ticketing-documentos

Fecha de ejecucion: 2026-09-16

## Objetivo

Integrar `ticketing-service` con `document-service` para que un boleto vendido por el evento local `TicketSold` genere automaticamente su PDF, conserve la referencia documental en la base de boletos y permita reimpresion sin pasos manuales.

Alcance del dia:

```text
Consumir eventos TicketSold desde outbox_events de ticketing-service.
Llamar a document-service para generar el PDF de boleto.
Persistir la referencia en ticket_document_refs.
Exponer consulta de documento por boleto.
Exponer reimpresion por boleto.
Manejar reintentos y fallos temporales.
Validar el flujo local con dos PostgreSQL temporales.
```

## Resultado logrado

```text
ticketing-service procesa eventos TicketSold y solicita PDF a document-service.
document-service genera el PDF y devuelve metadata documental.
ticketing-service guarda document_id, download_url, checksum, storage_uri, estado y reintentos.
GET /api/v1/ticketing/tickets/{ticketId}/document devuelve la referencia asociada.
POST /api/v1/ticketing/tickets/{ticketId}/document/reprint devuelve el PDF ya generado para reimpresion.
POST /api/v1/ticketing/documents/process-pending permite procesar pendientes de forma deterministica.
El worker programado queda configurable con APP_DOCUMENT_WORKER_ENABLED.
```

Nota: el worker puede procesar automaticamente cada `APP_DOCUMENT_WORKER_INTERVAL`. El endpoint `process-pending` se conserva como herramienta operativa y para validaciones reproducibles.

## Archivos creados

```text
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\resources\db\migration\V6__ticket_document_refs.sql
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\domain\TicketDocumentStatus.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\persistence\entity\TicketDocumentRef.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\api\dto\TicketDocumentResponse.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\api\dto\ProcessTicketDocumentsResponse.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\service\TicketDocumentIntegrationService.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\service\TicketDocumentGenerationJob.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\api\TicketingTicketDocumentResource.java
C:\VENTA-DE-PASAJES\scripts\verify-ticketing-document-integration.ps1
C:\VENTA-DE-PASAJES\docs\dia-38-integracion-ticketing-documentos.md
```

## Archivos modificados

```text
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\resources\application.properties
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\api\TicketingTicketResource.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\test\java\com\ventapasajes\ticketing\api\TicketingTicketResourceContractTest.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\test\java\com\ventapasajes\ticketing\persistence\TicketingMigrationContractTest.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\test\java\com\ventapasajes\ticketing\RuntimeProfileConfigurationTest.java
C:\VENTA-DE-PASAJES\services\ticketing-service\README.md
C:\VENTA-DE-PASAJES\docs\openapi\ticketing-service.openapi.yaml
C:\VENTA-DE-PASAJES\docs\database\ticketing-db.sql
C:\VENTA-DE-PASAJES\scripts\verify-ticketing-service-local-db.ps1
C:\VENTA-DE-PASAJES\scripts\verify-ticketing-service-native-local.ps1
C:\VENTA-DE-PASAJES\scripts\verify-mfe-ticketing-stack.ps1
C:\VENTA-DE-PASAJES\vitacora.md
```

## Endpoints implementados

```text
GET  /api/v1/ticketing/tickets/{ticketId}/document
POST /api/v1/ticketing/tickets/{ticketId}/document/reprint
POST /api/v1/ticketing/documents/process-pending?limit=10
```

## Valores usados

```text
ticketing-service HTTP validacion: 18138
document-service HTTP validacion: 18139
PostgreSQL ticketing validacion: 15438
PostgreSQL document validacion: 15439
Base ticketing: ticketing_db
Base documents: documents_db
Perfil Quarkus: onprem
Storage document-service: local
Directorio storage validacion: C:\VENTA-DE-PASAJES\services\document-service\target\document-storage-dia38-<pid>
PDF descargado validacion: C:\VENTA-DE-PASAJES\services\document-service\target\dia38-reprint-<pid>.pdf
```

Variables nuevas:

```text
APP_DOCUMENT_INTEGRATION_ENABLED=true
APP_DOCUMENT_WORKER_ENABLED=true
APP_DOCUMENT_WORKER_INTERVAL=15s
APP_DOCUMENT_WORKER_BATCH_SIZE=10
APP_DOCUMENT_SERVICE_BASE_URL=http://localhost:8084/api/v1/document
APP_DOCUMENT_MAX_ATTEMPTS=3
APP_DOCUMENT_RETRY_DELAY_SECONDS=30
```

## Reversa primero

Esta seccion sirve para limpiar el ambiente antes de repetir la practica desde cero.

### Paso R1 - Detener servicios Java manuales

Revisar puertos usados por la practica:

```powershell
cd C:\VENTA-DE-PASAJES

Get-NetTCPConnection -LocalPort 18138,18139 -ErrorAction SilentlyContinue |
  Select-Object LocalAddress,LocalPort,State,OwningProcess |
  Format-Table -AutoSize
```

Ver el comando del proceso antes de detenerlo:

```powershell
Get-CimInstance Win32_Process -Filter "name = 'java.exe'" |
  Select-Object ProcessId,CommandLine |
  Format-List
```

Si el proceso corresponde a `ticketing-service` o `document-service` de esta practica:

```powershell
Stop-Process -Id <process-id> -Force
```

### Paso R2 - Eliminar PostgreSQL temporales

El verificador crea contenedores con prefijo `venta-pasajes-d38`. Si quedo alguno:

```powershell
docker ps -a --filter "name=venta-pasajes-d38" --format "{{.Names}}" |
  ForEach-Object { docker rm -f $_ }
```

Si se levantaron contenedores manuales:

```powershell
docker rm -f venta-pasajes-d38-ticketing-pg-manual 2>$null
docker rm -f venta-pasajes-d38-document-pg-manual 2>$null
```

Verificar:

```powershell
docker ps -a --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}" |
  Select-String -Pattern "venta-pasajes-d38"
```

### Paso R3 - Liberar puertos

```powershell
Get-NetTCPConnection -LocalPort 18138,18139,15438,15439 -ErrorAction SilentlyContinue |
  Select-Object LocalAddress,LocalPort,State,OwningProcess |
  Format-Table -AutoSize
```

Si algun puerto quedo ocupado por un proceso de esta practica:

```powershell
Stop-Process -Id <process-id> -Force
```

### Paso R4 - Borrar archivos generados por validacion

```powershell
Remove-Item -Recurse -Force .\logs\dia-38 -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force .\services\document-service\target\document-storage-dia38-* -ErrorAction SilentlyContinue
Remove-Item -Force .\services\document-service\target\dia38-reprint-*.pdf -ErrorAction SilentlyContinue
```

Si se quiere limpiar completamente los builds:

```powershell
mvn -f .\services\document-service\pom.xml clean
mvn -f .\services\ticketing-service\pom.xml clean
```

### Paso R5 - Revertir la base si se aplico sobre una base persistente

En la validacion se usan bases temporales. Si se aplico la migracion en una base local persistente y se quiere deshacer solo esta practica:

```powershell
psql -h localhost -p <ticketing-db-port> -U postgres -d ticketing_db -c "DROP TABLE IF EXISTS ticket_document_refs;"
psql -h localhost -p <ticketing-db-port> -U postgres -d ticketing_db -c "DELETE FROM flyway_schema_history WHERE version = '6';"
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

`docker info` debe responder sin error. Si aparece `dockerDesktopLinuxEngine` o `The system cannot find the file specified`, iniciar Docker Desktop y esperar:

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

### Paso 2 - Ejecutar pruebas JVM

```powershell
mvn -f .\services\document-service\pom.xml test
mvn -f .\services\ticketing-service\pom.xml test
```

Resultado esperado:

```text
BUILD SUCCESS
```

### Paso 3 - Construir los JAR Quarkus

```powershell
mvn -f .\services\document-service\pom.xml -DskipTests clean package
mvn -f .\services\ticketing-service\pom.xml -DskipTests clean package
```

JAR esperados:

```text
C:\VENTA-DE-PASAJES\services\document-service\target\quarkus-app\quarkus-run.jar
C:\VENTA-DE-PASAJES\services\ticketing-service\target\quarkus-app\quarkus-run.jar
```

### Paso 4 - Ejecutar validacion automatica completa

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-ticketing-document-integration.ps1
```

Para reutilizar JARs ya construidos:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-ticketing-document-integration.ps1 -SkipPackage
```

Resultado esperado:

```json
{"service":"ticketing-document-integration","runtime":"jvm","ready":true}
```

### Paso 5 - Levantar PostgreSQL manuales

Usar estos puertos para no chocar con practicas anteriores:

```powershell
$TicketingHttpPort = 18138
$DocumentHttpPort = 18139
$TicketingDatabasePort = 15438
$DocumentDatabasePort = 15439
$TicketingDbPassword = [Guid]::NewGuid().ToString("N")
$DocumentDbPassword = [Guid]::NewGuid().ToString("N")

docker run --name venta-pasajes-d38-ticketing-pg-manual `
  -e POSTGRES_DB=ticketing_db `
  -e POSTGRES_USER=postgres `
  -e "POSTGRES_PASSWORD=$TicketingDbPassword" `
  -p "${TicketingDatabasePort}:5432" `
  -d postgres:16-alpine

docker run --name venta-pasajes-d38-document-pg-manual `
  -e POSTGRES_DB=documents_db `
  -e POSTGRES_USER=postgres `
  -e "POSTGRES_PASSWORD=$DocumentDbPassword" `
  -p "${DocumentDatabasePort}:5432" `
  -d postgres:16-alpine
```

Esperar disponibilidad:

```powershell
for ($i = 1; $i -le 45; $i++) {
  docker exec venta-pasajes-d38-ticketing-pg-manual pg_isready -U postgres -d ticketing_db *> $null
  $TicketingReady = $LASTEXITCODE -eq 0
  docker exec venta-pasajes-d38-document-pg-manual pg_isready -U postgres -d documents_db *> $null
  $DocumentReady = $LASTEXITCODE -eq 0
  if ($TicketingReady -and $DocumentReady) { "PostgreSQL listos"; break }
  Start-Sleep -Seconds 2
}
```

### Paso 6 - Levantar document-service manual

```powershell
$DocumentStorageDir = (Join-Path (Resolve-Path ".\services\document-service\target").Path "document-storage-dia38-manual")
$DocumentJar = (Resolve-Path ".\services\document-service\target\quarkus-app\quarkus-run.jar").Path
New-Item -ItemType Directory -Force -Path $DocumentStorageDir | Out-Null

$env:APP_ENV = "onprem"
$env:APP_RUNTIME_TARGET = "onprem"
$env:APP_SECRETS_PROVIDER = "env"
$env:APP_DB_NAME = "documents_db"
$env:APP_DB_JDBC_URL = "jdbc:postgresql://localhost:$DocumentDatabasePort/documents_db"
$env:APP_DB_USERNAME = "postgres"
$env:APP_DB_PASSWORD = $DocumentDbPassword
$env:APP_DOCUMENT_STORAGE_PROVIDER = "local"
$env:APP_DOCUMENT_LOCAL_DIR = $DocumentStorageDir
$env:APP_LOG_CONSOLE_JSON = "false"
$env:QUARKUS_PROFILE = "onprem"
$env:QUARKUS_HTTP_PORT = "$DocumentHttpPort"
$env:QUARKUS_FLYWAY_MIGRATE_AT_START = "true"

$DocumentProcess = Start-Process `
  -FilePath "java" `
  -ArgumentList @("-jar", $DocumentJar) `
  -WorkingDirectory ".\services\document-service" `
  -PassThru
```

Verificar:

```powershell
for ($i = 1; $i -le 45; $i++) {
  try {
    $Health = Invoke-RestMethod -Uri "http://localhost:$DocumentHttpPort/q/health/ready" -TimeoutSec 2
    if ($Health.status -eq "UP") { "document-service listo"; break }
  } catch {
    Start-Sleep -Seconds 2
  }
}
```

### Paso 7 - Levantar ticketing-service manual

```powershell
$TicketingJar = (Resolve-Path ".\services\ticketing-service\target\quarkus-app\quarkus-run.jar").Path

$env:APP_ENV = "onprem"
$env:APP_RUNTIME_TARGET = "onprem"
$env:APP_SECRETS_PROVIDER = "env"
$env:APP_DB_NAME = "ticketing_db"
$env:APP_DB_JDBC_URL = "jdbc:postgresql://localhost:$TicketingDatabasePort/ticketing_db"
$env:APP_DB_USERNAME = "postgres"
$env:APP_DB_PASSWORD = $TicketingDbPassword
$env:APP_DOCUMENT_SERVICE_BASE_URL = "http://localhost:$DocumentHttpPort/api/v1/document"
$env:APP_DOCUMENT_INTEGRATION_ENABLED = "true"
$env:APP_DOCUMENT_WORKER_ENABLED = "false"
$env:APP_RESERVATION_EXPIRATION_JOB_ENABLED = "false"
$env:APP_LOG_CONSOLE_JSON = "false"
$env:QUARKUS_PROFILE = "onprem"
$env:QUARKUS_HTTP_PORT = "$TicketingHttpPort"
$env:QUARKUS_FLYWAY_MIGRATE_AT_START = "true"

$TicketingProcess = Start-Process `
  -FilePath "java" `
  -ArgumentList @("-jar", $TicketingJar) `
  -WorkingDirectory ".\services\ticketing-service" `
  -PassThru
```

Verificar:

```powershell
for ($i = 1; $i -le 45; $i++) {
  try {
    $Health = Invoke-RestMethod -Uri "http://localhost:$TicketingHttpPort/q/health/ready" -TimeoutSec 2
    if ($Health.status -eq "UP") { "ticketing-service listo"; break }
  } catch {
    Start-Sleep -Seconds 2
  }
}
```

### Paso 8 - Sincronizar una salida vendible

```powershell
$DispatchDepartureId = [guid]::NewGuid().ToString()
$RunId = (Get-Date).ToUniversalTime().ToString("yyyyMMddHHmmssfff")

$SyncPayload = @{
  dispatch_departure_id = $DispatchDepartureId
  legacy_id = 3801
  bus_id = [guid]::NewGuid().ToString()
  bus_code = "BUS-D38"
  bus_plate = "PBT-3801"
  route_id = [guid]::NewGuid().ToString()
  route_name = "Quito - Guayaquil"
  origin_terminal_id = [guid]::NewGuid().ToString()
  origin_terminal_name = "Terminal Quito"
  destination_terminal_id = [guid]::NewGuid().ToString()
  destination_terminal_name = "Terminal Guayaquil"
  departure_at = (Get-Date).ToUniversalTime().AddDays(1).ToString("o")
  status = "SCHEDULED"
  seats = @(
    @{ seat_number = "1"; status = "AVAILABLE" },
    @{ seat_number = "2"; status = "AVAILABLE" }
  )
  source_updated_at = (Get-Date).ToUniversalTime().ToString("o")
} | ConvertTo-Json -Depth 8 -Compress

Invoke-RestMethod `
  -Uri "http://localhost:$TicketingHttpPort/api/v1/ticketing/availability/sync/departures" `
  -Method Post `
  -ContentType "application/json" `
  -Body $SyncPayload
```

### Paso 9 - Vender boleto

```powershell
$TicketPayload = @{
  dispatch_departure_id = $DispatchDepartureId
  seat_number = "1"
  fare_amount = 25.50
  currency = "USD"
  passenger = @{
    document_type = "CEDULA"
    document_number = "3800000001"
    first_name = "Dia38"
    last_name = "Documento"
    email = "dia38.documento.$RunId@example.local"
    phone = "0938000001"
  }
} | ConvertTo-Json -Depth 8 -Compress

$Ticket = Invoke-RestMethod `
  -Uri "http://localhost:$TicketingHttpPort/api/v1/ticketing/tickets" `
  -Method Post `
  -ContentType "application/json" `
  -Body $TicketPayload

$Ticket
```

Resultado esperado:

```text
status = ISSUED
event_id presente
ticket_id presente
```

### Paso 10 - Procesar TicketSold y generar PDF

```powershell
$ProcessResponse = Invoke-RestMethod `
  -Uri "http://localhost:$TicketingHttpPort/api/v1/ticketing/documents/process-pending?limit=10" `
  -Method Post

$ProcessResponse
```

Resultado esperado:

```text
generated_documents = 1
failed_attempts = 0
```

### Paso 11 - Consultar documento asociado al boleto

```powershell
$DocumentRef = Invoke-RestMethod `
  -Uri "http://localhost:$TicketingHttpPort/api/v1/ticketing/tickets/$($Ticket.ticket_id)/document"

$DocumentRef
```

Resultado esperado:

```text
status = GENERATED
document_id presente
download_url presente
```

### Paso 12 - Reimprimir y descargar PDF

```powershell
$ReprintRef = Invoke-RestMethod `
  -Uri "http://localhost:$TicketingHttpPort/api/v1/ticketing/tickets/$($Ticket.ticket_id)/document/reprint" `
  -Method Post

$PdfPath = Join-Path (Resolve-Path ".\services\document-service\target").Path "dia38-manual-reprint.pdf"

Invoke-WebRequest `
  -Uri $ReprintRef.download_url `
  -OutFile $PdfPath

$Bytes = [System.IO.File]::ReadAllBytes($PdfPath)
[System.Text.Encoding]::ASCII.GetString($Bytes, 0, 4)
```

Resultado esperado:

```text
%PDF
```

### Paso 13 - Revisar bases de datos

```powershell
docker exec venta-pasajes-d38-ticketing-pg-manual `
  psql -U postgres -d ticketing_db `
  -c "select ticket_id, ticket_number, document_id, status, attempts from ticket_document_refs;"

docker exec venta-pasajes-d38-document-pg-manual `
  psql -U postgres -d documents_db `
  -c "select id, owner_type, owner_id, status, storage_uri from documents;"

docker exec venta-pasajes-d38-document-pg-manual `
  psql -U postgres -d documents_db `
  -c "select event_type, aggregate_type, aggregate_id from outbox_events where event_type = 'DocumentGenerated';"
```

### Paso 14 - Detener ejecucion manual

```powershell
Stop-Process -Id $TicketingProcess.Id -Force
Stop-Process -Id $DocumentProcess.Id -Force

docker rm -f venta-pasajes-d38-ticketing-pg-manual
docker rm -f venta-pasajes-d38-document-pg-manual

Remove-Item Env:APP_ENV,Env:APP_RUNTIME_TARGET,Env:APP_SECRETS_PROVIDER,Env:APP_DB_NAME,Env:APP_DB_JDBC_URL,Env:APP_DB_USERNAME,Env:APP_DB_PASSWORD,Env:APP_DOCUMENT_SERVICE_BASE_URL,Env:APP_DOCUMENT_INTEGRATION_ENABLED,Env:APP_DOCUMENT_WORKER_ENABLED,Env:APP_RESERVATION_EXPIRATION_JOB_ENABLED,Env:APP_LOG_CONSOLE_JSON,Env:QUARKUS_PROFILE,Env:QUARKUS_HTTP_PORT,Env:QUARKUS_FLYWAY_MIGRATE_AT_START -ErrorAction SilentlyContinue
```

## Peticiones HTTP listas con curl.exe

Procesar pendientes:

```powershell
curl.exe -s -X POST "http://localhost:18138/api/v1/ticketing/documents/process-pending?limit=10"
```

Consultar documento del boleto:

```powershell
curl.exe -s "http://localhost:18138/api/v1/ticketing/tickets/$($Ticket.ticket_id)/document"
```

Reimprimir documento:

```powershell
curl.exe -s -X POST "http://localhost:18138/api/v1/ticketing/tickets/$($Ticket.ticket_id)/document/reprint"
```

Descargar PDF:

```powershell
curl.exe -L "$($ReprintRef.download_url)" -o ".\services\document-service\target\dia38-curl-reprint.pdf"
```

## Pruebas y validaciones ejecutadas

### Pruebas ticketing-service

```powershell
mvn -f .\services\ticketing-service\pom.xml test
```

Resultado:

```text
Tests run: 29, Failures: 0, Errors: 0, Skipped: 0
BUILD SUCCESS
```

### Build ticketing-service

```powershell
mvn -f .\services\ticketing-service\pom.xml -DskipTests clean package
```

Resultado:

```text
BUILD SUCCESS
```

### Validacion integrada Dia 38

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-ticketing-document-integration.ps1 -SkipPackage
```

Resultado:

```json
{"service":"ticketing-document-integration","runtime":"jvm","ticketing_http_port":18138,"document_http_port":18139,"ticketing_database_port":15438,"document_database_port":15439,"ticket_id":"56d3b907-255f-4eb4-98c1-a4fbd3dc1ed7","ticket_number":"TKT-9C912B753DAA","ticket_status":"ISSUED","document_id":"4aa34bdf-ee69-450a-8f78-a0bd6a6d12a8","document_status":"GENERATED","document_storage_uri":"local://tickets/56d3b907-255f-4eb4-98c1-a4fbd3dc1ed7/TKT-9C912B753DAA.pdf","reprint_url":"http://localhost:18139/api/v1/document/documents/4aa34bdf-ee69-450a-8f78-a0bd6a6d12a8/download","downloaded_pdf":"C:\\VENTA-DE-PASAJES\\services\\document-service\\target\\dia38-reprint-8848.pdf","downloaded_pdf_bytes":1328,"generated_document_refs":1,"document_generated_events":1,"ready":true}
```

## Problemas encontrados y soluciones

### Consulta de documento respondia 404 aunque la fila existia

Diagnostico:

```text
POST /api/v1/ticketing/documents/process-pending genero 1 documento.
La tabla ticket_document_refs tenia status GENERATED y document_id.
GET /api/v1/ticketing/tickets/{ticketId}/document respondia Resource not found.
```

Solucion:

```text
Se movieron los endpoints /tickets/{ticketId}/document y /tickets/{ticketId}/document/reprint al recurso principal TicketingTicketResource.
TicketingTicketDocumentResource quedo solo para /api/v1/ticketing/documents/process-pending.
```

### Practicas previas no deben depender de document-service

Solucion:

```text
Se desactivo explicitamente APP_DOCUMENT_INTEGRATION_ENABLED=false y APP_DOCUMENT_WORKER_ENABLED=false en verificadores antiguos de ticketing/MFE.
El verificador nuevo verify-ticketing-document-integration.ps1 mantiene la integracion encendida.
```

### Consulta manual usaba una columna inexistente en documents

Diagnostico:

```text
El Paso 13 tenia select document_id ... from documents.
La tabla documents de document-service no tiene columna document_id; su clave primaria real es id.
```

Solucion:

```text
Se corrigio la consulta manual a select id, owner_type, owner_id, status, storage_uri from documents.
Se revalido el flujo completo despues de la correccion.
```

## Estado final

```text
Dia 38 completado.
La emision de boleto genera comprobante PDF sin pasos manuales cuando la integracion esta activa.
La referencia documental queda asociada al boleto.
La reimpresion reutiliza el documento generado.
Los reintentos quedan registrados por attempts, last_attempt_at, next_attempt_at y failure_reason.
La validacion integrada finalizo con ready=true.
```

Siguiente paso natural: iniciar Dia 39 con `reporting-service` base para consumir `TicketSold` y `TicketCancelled`.
