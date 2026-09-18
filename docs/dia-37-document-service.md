# Dia 37 - document-service

Fecha de ejecucion: 2026-09-16

## Objetivo

Crear `document-service` como microservicio Quarkus para generar comprobantes PDF de boleto, almacenar el archivo generado y dejar publicado el evento funcional `DocumentGenerated` mediante outbox.

Este documento tambien deja una guia manual completa para repetir el proceso desde cero. Primero muestra la reversa para limpiar lo creado y luego el camino hacia el objetivo.

Alcance del dia:

```text
Crear proyecto Quarkus document-service.
Crear plantilla HTML de boleto.
Generar PDF de boleto.
Guardar PDF en proveedor configurable: local para on-premise/desarrollo y gcs para Google Cloud.
Crear endpoint de descarga.
Persistir metadata documental.
Publicar evento DocumentGenerated en outbox_events.
Validar flujo local con PostgreSQL temporal.
```

## Resultado logrado

```text
Se genero document-service desde la plantilla Quarkus del monorepo.
Se agrego contrato REST para generar documentos de boleto.
Se agrego plantilla HTML resources/templates/ticket.html.
Se agrego generador PDF con PDFBox.
Se agrego almacenamiento local y Cloud Storage configurable.
Se agregaron tablas documents, document_templates y outbox_events con Flyway.
Se agrego endpoint de metadata y descarga PDF.
Se agrego evento DocumentGenerated en outbox_events.
Se agrego script de validacion local con PostgreSQL temporal.
Se valido generacion, descarga PDF, checksum y evento outbox.
```

## Archivos creados

```text
C:\VENTA-DE-PASAJES\services\document-service\src\main\resources\templates\ticket.html
C:\VENTA-DE-PASAJES\services\document-service\src\main\java\com\ventapasajes\document\domain\DocumentStatus.java
C:\VENTA-DE-PASAJES\services\document-service\src\main\java\com\ventapasajes\document\domain\DocumentType.java
C:\VENTA-DE-PASAJES\services\document-service\src\main\java\com\ventapasajes\document\persistence\entity\GeneratedDocument.java
C:\VENTA-DE-PASAJES\services\document-service\src\main\java\com\ventapasajes\document\persistence\entity\OutboxEvent.java
C:\VENTA-DE-PASAJES\services\document-service\src\main\java\com\ventapasajes\document\api\DocumentBaseResource.java
C:\VENTA-DE-PASAJES\services\document-service\src\main\java\com\ventapasajes\document\api\TicketDocumentResource.java
C:\VENTA-DE-PASAJES\services\document-service\src\main\java\com\ventapasajes\document\api\dto\*.java
C:\VENTA-DE-PASAJES\services\document-service\src\main\java\com\ventapasajes\document\service\*.java
C:\VENTA-DE-PASAJES\services\document-service\src\test\java\com\ventapasajes\document\service\TicketDocumentRenderingTest.java
C:\VENTA-DE-PASAJES\scripts\verify-document-service-local.ps1
C:\VENTA-DE-PASAJES\docs\dia-37-document-service.md
```

## Archivos modificados

```text
C:\VENTA-DE-PASAJES\services\document-service\pom.xml
C:\VENTA-DE-PASAJES\services\document-service\src\main\resources\application.properties
C:\VENTA-DE-PASAJES\services\document-service\src\main\resources\db\migration\V1__init_template.sql
C:\VENTA-DE-PASAJES\services\document-service\README.md
C:\VENTA-DE-PASAJES\docs\openapi\document-service.openapi.yaml
C:\VENTA-DE-PASAJES\vitacora.md
```

## Endpoints implementados

```text
GET  /api/v1/document
GET  /api/v1/document/health
GET  /api/v1/document/resources
POST /api/v1/document/documents/tickets/{ticketId}
GET  /api/v1/document/documents/{documentId}
GET  /api/v1/document/documents/{documentId}/download
GET  /q/health/ready
GET  /q/openapi
GET  /q/swagger-ui
```

## Valores usados

```text
Servicio: document-service
Puerto local validacion: 18097
Puerto PostgreSQL temporal: 55453
Base temporal: documents_db
Perfil Quarkus: onprem
Proveedor storage validado localmente: local
Directorio storage validacion: C:\VENTA-DE-PASAJES\services\document-service\target\document-storage-verify-15624
PDF descargado validacion: C:\VENTA-DE-PASAJES\services\document-service\target\document-service-verify-15624.pdf
Proveedor GCP configurado: gcs
Bucket esperado GCP: venta-pasajes-dev-documents
Evento funcional: DocumentGenerated
```

Nota: la escritura real en Google Cloud Storage queda implementada por configuracion `APP_DOCUMENT_STORAGE_PROVIDER=gcs` y `APP_DOCUMENT_BUCKET`. La validacion ejecutada en esta practica uso storage local para no depender de credenciales ni bucket remoto.

## Reversa primero

Esta seccion sirve para dejar limpio el ambiente antes de repetir la practica desde cero.

### Paso R1 - Detener document-service manual

Revisar si el puerto de validacion esta ocupado:

```powershell
cd C:\VENTA-DE-PASAJES

Get-NetTCPConnection -LocalPort 18097 -ErrorAction SilentlyContinue |
  Select-Object LocalAddress,LocalPort,State,OwningProcess |
  Format-Table -AutoSize
```

Si el proceso corresponde a esta practica, detenerlo:

```powershell
Stop-Process -Id <process-id> -Force
```

Revisar procesos Java antes de detener algo manualmente:

```powershell
Get-CimInstance Win32_Process -Filter "name = 'java.exe'" |
  Select-Object ProcessId,CommandLine |
  Format-List
```

### Paso R2 - Detener PostgreSQL temporal

El script crea contenedores con nombre `venta-pasajes-document-pg-<pid>` y los limpia al finalizar. Si quedo alguno:

```powershell
docker ps -a --filter "name=venta-pasajes-document-pg" --format "{{.Names}}" |
  ForEach-Object { docker rm -f $_ }
```

Si se uso una base manual:

```powershell
docker rm -f venta-pasajes-document-pg-manual 2>$null
```

Verificar:

```powershell
docker ps -a --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}" |
  Select-String -Pattern "venta-pasajes-document"
```

### Paso R3 - Liberar puerto PostgreSQL

```powershell
Get-NetTCPConnection -LocalPort 55453 -ErrorAction SilentlyContinue |
  Select-Object LocalAddress,LocalPort,State,OwningProcess |
  Format-Table -AutoSize
```

Si aparece un proceso propio de esta practica, detenerlo:

```powershell
Stop-Process -Id <process-id> -Force
```

### Paso R4 - Borrar archivos generados por validacion local

```powershell
Remove-Item -Recurse -Force .\services\document-service\target\document-storage-verify-* -ErrorAction SilentlyContinue
Remove-Item -Force .\services\document-service\target\document-service-verify-*.pdf -ErrorAction SilentlyContinue
Remove-Item -Force .\services\document-service\target\document-service-verify-*.log -ErrorAction SilentlyContinue
```

Si se quiere limpiar completamente el build del servicio:

```powershell
mvn -f .\services\document-service\pom.xml clean
```

### Paso R5 - Borrar objetos de Cloud Storage si se probo GCS

Solo ejecutar si se genero un PDF real en el bucket.

```powershell
$Bucket = "venta-pasajes-dev-documents"
$Object = "tickets/<ticket-id>/<ticket-number>.pdf"

gcloud storage rm "gs://$Bucket/$Object"
```

Verificar:

```powershell
gcloud storage ls "gs://$Bucket/tickets/<ticket-id>/"
```

## Guia manual desde cero

### Paso 1 - Validar herramientas

```powershell
cd C:\VENTA-DE-PASAJES

java -version
mvn -version
docker version
docker info
```

`docker info` debe responder sin error. Si aparece un mensaje sobre `dockerDesktopLinuxEngine` o pipe inexistente, iniciar Docker Desktop y esperar hasta que el motor Linux este activo.

En Windows se puede iniciar Docker Desktop desde PowerShell asi:

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

Si `docker info` sigue fallando, abrir Docker Desktop manualmente y esperar a que indique que el engine esta corriendo.

### Paso 2 - Ejecutar pruebas JVM

```powershell
mvn -f .\services\document-service\pom.xml test
```

Resultado esperado:

```text
Tests run: 5, Failures: 0, Errors: 0, Skipped: 0
BUILD SUCCESS
```

### Paso 3 - Construir jar Quarkus

```powershell
mvn -f .\services\document-service\pom.xml -DskipTests clean package
```

Jar de arranque esperado:

```text
C:\VENTA-DE-PASAJES\services\document-service\target\quarkus-app\quarkus-run.jar
```

### Paso 4 - Levantar PostgreSQL temporal

```powershell
$DatabasePassword = [Guid]::NewGuid().ToString("N")

docker run `
  --name venta-pasajes-document-pg-manual `
  -e POSTGRES_DB=documents_db `
  -e POSTGRES_USER=postgres `
  -e POSTGRES_PASSWORD=$DatabasePassword `
  -p 55453:5432 `
  -d postgres:16-alpine

docker exec venta-pasajes-document-pg-manual `
  pg_isready -h localhost -p 5432 -U postgres -d documents_db
```

### Paso 5 - Configurar variables on-premise/local

```powershell
$env:APP_ENV = "onprem"
$env:APP_RUNTIME_TARGET = "onprem"
$env:APP_SECRETS_PROVIDER = "env"
$env:APP_DB_NAME = "documents_db"
$env:APP_DB_JDBC_URL = "jdbc:postgresql://localhost:55453/documents_db"
$env:APP_DB_USERNAME = "postgres"
$env:APP_DB_PASSWORD = $DatabasePassword
$env:APP_DOCUMENT_STORAGE_PROVIDER = "local"
$env:APP_DOCUMENT_LOCAL_DIR = "C:\VENTA-DE-PASAJES\services\document-service\target\document-storage-manual"
$env:APP_LOG_CONSOLE_JSON = "false"
$env:QUARKUS_PROFILE = "onprem"
$env:QUARKUS_HTTP_PORT = "18097"
$env:QUARKUS_FLYWAY_MIGRATE_AT_START = "true"
```

### Paso 6 - Arrancar document-service

```powershell
java -jar .\services\document-service\target\quarkus-app\quarkus-run.jar
```

Debe quedar escuchando en:

```text
http://localhost:18097
```

### Paso 7 - Validar health y catalogo

En otra terminal:

```powershell
Invoke-RestMethod -Uri "http://localhost:18097/api/v1/document/health"
Invoke-RestMethod -Uri "http://localhost:18097/api/v1/document"
Invoke-RestMethod -Uri "http://localhost:18097/api/v1/document/resources"
```

### Paso 8 - Generar PDF de boleto

```powershell
$TicketId = [Guid]::NewGuid().ToString()

$Payload = @{
  template_code = "DEFAULT_TICKET"
  requested_by_user_id = [Guid]::NewGuid().ToString()
  correlation_id = [Guid]::NewGuid().ToString()
  ticket = @{
    ticket_number = "D37-MANUAL-001"
    passenger_name = "Marta Cliente"
    document_type = "CEDULA"
    document_number = "1919191919"
    price = 25.50
    currency = "USD"
    bus_code = "BUS-D37"
    bus_type = "Doble piso"
    origin = "Quito"
    destination = "Cuenca"
    departure_at = (Get-Date).ToUniversalTime().AddDays(1).ToString("o")
    seat_number = "P2-30"
    seat_position = "Piso 2 zona VIP"
    sold_at = (Get-Date).ToUniversalTime().ToString("o")
  }
} | ConvertTo-Json -Depth 8 -Compress

$Document = Invoke-RestMethod `
  -Uri "http://localhost:18097/api/v1/document/documents/tickets/$TicketId" `
  -Method Post `
  -ContentType "application/json" `
  -Body $Payload

$Document
```

Resultado esperado:

```text
status: GENERATED
storage_provider: local
storage_uri: local://tickets/<ticket-id>/D37-MANUAL-001.pdf
download_url: /api/v1/document/documents/<document-id>/download
event_id: <uuid>
```

### Paso 9 - Descargar PDF

```powershell
$PdfPath = "C:\VENTA-DE-PASAJES\services\document-service\target\D37-MANUAL-001.pdf"
New-Item -ItemType Directory -Force -Path (Split-Path $PdfPath) | Out-Null

Invoke-WebRequest `
  -Uri "http://localhost:18097/api/v1/document/documents/$($Document.document_id)/download" `
  -OutFile $PdfPath

Test-Path $PdfPath
```

Validar cabecera PDF:

```powershell
$Bytes = [System.IO.File]::ReadAllBytes($PdfPath)
[System.Text.Encoding]::ASCII.GetString($Bytes, 0, 4)
```

Debe devolver:

```text
%PDF
```

Nota: usar `$PdfPath` absoluto evita que `[System.IO.File]::ReadAllBytes()` busque el archivo bajo `C:\Windows\system32` cuando PowerShell fue abierto como administrador o cuando el directorio actual de .NET no coincide con el prompt.

### Paso 10 - Verificar evento DocumentGenerated

```powershell
docker exec venta-pasajes-document-pg-manual `
  psql -U postgres -d documents_db `
  -c "select event_type, status, payload->>'document_id' as document_id from outbox_events;"
```

Resultado esperado:

```text
DocumentGenerated | PENDING | <document-id>
```

### Paso 11 - Ejecutar verificacion automatica completa

Antes de ejecutar este paso, detener el `document-service` manual del Paso 6 y PostgreSQL manual del Paso 4, porque el verificador necesita usar los puertos `18097` y `55453`.

Tambien confirmar que Docker Desktop este activo:

```powershell
docker info
```

Si responde `dockerDesktopLinuxEngine` o `The system cannot find the file specified`, volver al Paso 1 y levantar Docker Desktop.

Verificar puertos ocupados:

```powershell
Get-NetTCPConnection -LocalPort 18097,55453 -ErrorAction SilentlyContinue |
  Select-Object LocalAddress,LocalPort,State,OwningProcess |
  Format-Table -AutoSize
```

Si el proceso del puerto `18097` corresponde al `java -jar` de esta practica:

```powershell
Stop-Process -Id <process-id> -Force
```

Si PostgreSQL fue levantado manualmente con el nombre de esta guia:

```powershell
docker rm -f venta-pasajes-document-pg-manual
```

Ejecutar validacion con los puertos por defecto:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-document-service-local.ps1
```

El verificador ejecuta `mvn clean package` cuando no se usa `-SkipPackage`. Esto limpia un `target\quarkus-app` incompleto si una ejecucion anterior fue interrumpida.

Para reutilizar el jar ya construido:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-document-service-local.ps1 -SkipPackage
```

Si se quiere mantener arriba la ejecucion manual, usar otros puertos para la validacion automatica:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-document-service-local.ps1 `
  -SkipPackage `
  -HttpPort 18197 `
  -DatabasePort 15453
```

Nota: en Windows algunos rangos de puertos quedan reservados aunque no aparezcan como conexiones activas. Revisar rangos excluidos:

```powershell
netsh interface ipv4 show excludedportrange protocol=tcp
```

Evitar puertos dentro de esos rangos para `-HttpPort` y `-DatabasePort`.

### Paso 12 - Probar modo Cloud Storage

Solo si existe el bucket y credenciales ADC/IAM.

```powershell
gcloud auth application-default login

$env:APP_DOCUMENT_STORAGE_PROVIDER = "gcs"
$env:APP_DOCUMENT_BUCKET = "venta-pasajes-dev-documents"
```

Luego repetir el POST de generacion. El `storage_uri` esperado cambia a:

```text
gs://venta-pasajes-dev-documents/tickets/<ticket-id>/<ticket-number>.pdf
```

## Validaciones ejecutadas

### Pruebas JVM

Comando:

```powershell
mvn -f .\services\document-service\pom.xml test
```

Resultado:

```text
Tests run: 5, Failures: 0, Errors: 0, Skipped: 0
BUILD SUCCESS
```

### Validacion funcional local

Comando:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-document-service-local.ps1 -SkipPackage
```

Resultado:

```json
{"service":"document-service","runtime":"jvm","quarkus_profile":"onprem","database":"documents_db","migration_tool":"flyway","http_port":18097,"database_port":55453,"health_status":"ok","overview_service":"document-service","resources_count":3,"ticket_id":"8d5c0006-6d84-4549-8dfc-104ff4aa6051","ticket_number":"D37-20260916152415745","document_id":"1a00f33c-e209-41f5-91c1-151a85b7232b","document_status":"GENERATED","storage_provider":"local","storage_uri":"local://tickets/8d5c0006-6d84-4549-8dfc-104ff4aa6051/D37-20260916152415745.pdf","downloaded_pdf":"C:\\VENTA-DE-PASAJES\\services\\document-service\\target\\document-service-verify-15624.pdf","downloaded_pdf_bytes":1329,"checksum_sha256":"efd1ea0fdebc12c016899e261e66d9b9aec111fe2d3b4c1056c536d8f6c281fc","outbox_document_generated_events":1,"storage_dir":"C:\\VENTA-DE-PASAJES\\services\\document-service\\target\\document-storage-verify-15624","ready":true}
```

## Notas tecnicas

- El PDF se genera con PDFBox desde los datos normalizados del boleto.
- La plantilla HTML queda versionada como base imprimible y para futura evolucion de plantillas.
- El proveedor `local` permite validar sin Google Cloud.
- El proveedor `gcs` usa el SDK de Cloud Storage y credenciales del runtime.
- `DocumentGenerated` queda en `outbox_events` con estado `PENDING`; el publicador real a Pub/Sub se conecta en una practica posterior.
- `document-service` no valida si el boleto es vendible; recibe el snapshot de ticket desde `ticketing-service` u otro orquestador autorizado.

## Siguiente paso sugerido

Integrar `ticketing-service` o `mfe-ticketing` para solicitar el comprobante despues de una venta emitida y mostrar accion de descarga/reimpresion en la pantalla de boleteria.
