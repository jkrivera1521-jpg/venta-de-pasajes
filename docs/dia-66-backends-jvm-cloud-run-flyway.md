# Dia 66 - Backends JVM en Cloud Run y migraciones Flyway

## Objetivo

Cerrar el bloqueo tecnico dejado en el Dia 65: los backends privados de Cloud Run ya eran invocados por los MFEs, pero las consultas funcionales devolvian HTTP 500.

El diagnostico real fue:

```text
Los backends JVM conectan a Cloud SQL.
Las tablas no existian porque Flyway no estaba migrando el esquema dev.
Al activar Flyway, el usuario IAM de cada servicio no tenia permisos para crear objetos en public.
```

## Resultado

Se creo una ruta JVM para los seis backends y se desplego en Cloud Run con tag `0.1.1-jvm`.

Backends validados:

```text
identity-service  /api/v1/identity/health                         200
dispatch-service  /api/v1/dispatch/health                         200
document-service  /api/v1/document/health                         200
reporting-service /api/v1/reporting/health                        200
audit-service     /api/v1/audit/health                            200
ticketing-service /api/v1/ticketing/health                        200
dispatch-service  /api/v1/dispatch/terminals?page=1&page_size=1   200
dispatch-service  /api/v1/dispatch/departures?page=1&page_size=1  200
ticketing-service /api/v1/ticketing/passengers                    200
ticketing-service /api/v1/ticketing/availability/departures       200
reporting-service /api/v1/reporting/reports/sales                 200
audit-service     /api/v1/audit/audit-events                      200
```

## Archivos creados o modificados

```text
C:\VENTA-DE-PASAJES\infra\docker\Dockerfile.quarkus-jvm
C:\VENTA-DE-PASAJES\scripts\build-backend-jvm-images.ps1
C:\VENTA-DE-PASAJES\infra\gcloud\grant-cloudsql-schema-dev.ps1
C:\VENTA-DE-PASAJES\infra\cloudrun\dev-services.json
C:\VENTA-DE-PASAJES\docs\dia-66-backends-jvm-cloud-run-flyway.md
```

## Decisiones tecnicas

- Se mantiene la ruta nativa como pendiente tecnico porque GraalVM/Mandrel falla con clases `jnr` del Cloud SQL Socket Factory.
- Se agrega ruta JVM para Cloud Run dev. Es mas pesada que native, pero desbloquea Cloud SQL y validacion funcional.
- Se activa Flyway en los seis backends solo para el despliegue dev de Cloud Run.
- Se aplican grants de esquema por base, manteniendo una base por microservicio.
- No se mezclan datos entre servicios.

## Reversa primero

### Reversa operativa de Cloud Run

Si el despliegue JVM causa problemas, volver al tag backend anterior usado por Cloud Run dev:

```powershell
cd C:\VENTA-DE-PASAJES

powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\deploy-cloudrun-dev.ps1 `
  -ImageTag dev `
  -BackendOnly `
  -Execute
```

### Reversa de configuracion Flyway dev

Quitar de los backends en `infra\cloudrun\dev-services.json`:

```text
QUARKUS_FLYWAY_MIGRATE_AT_START=true
QUARKUS_FLYWAY_BASELINE_ON_MIGRATE=true
```

Despues redeplegar backends con el tag que corresponda:

```powershell
cd C:\VENTA-DE-PASAJES

powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\deploy-cloudrun-dev.ps1 `
  -ImageTag 0.1.1-jvm `
  -BackendOnly `
  -Execute
```

### Reversa de permisos de base

No revocar permisos ni borrar tablas si ya existen datos utiles.

Solo para un entorno dev descartable, revisar primero:

```powershell
cd C:\VENTA-DE-PASAJES

Get-Content -LiteralPath .\logs\cloudsql-dev\grant-cloudsql-schema-dev.plan.json -Raw
```

Si se necesita reconstruir desde cero, crear un respaldo o snapshot de Cloud SQL antes de borrar objetos.

### Reversa de archivos

Eliminar manualmente solo si se quiere volver al estado anterior del repositorio:

```powershell
cd C:\VENTA-DE-PASAJES

Remove-Item -LiteralPath .\infra\docker\Dockerfile.quarkus-jvm -Force
Remove-Item -LiteralPath .\scripts\build-backend-jvm-images.ps1 -Force
Remove-Item -LiteralPath .\infra\gcloud\grant-cloudsql-schema-dev.ps1 -Force
```

## Guia manual desde cero

### Paso 1 - Verificar herramientas

```powershell
cd C:\VENTA-DE-PASAJES

git status
docker version
gcloud config get-value project
```

Si `gcloud` falla por Python en Windows:

```powershell
$env:CLOUDSDK_PYTHON = "C:\Python312\python.exe"
```

### Paso 2 - Generar plan de imagenes JVM

```powershell
cd C:\VENTA-DE-PASAJES

powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-backend-jvm-images.ps1 `
  -ImageTag 0.1.1-jvm `
  -PlanOnly
```

Revisar:

```powershell
Get-Content -LiteralPath .\logs\backend-jvm-images\build-backend-jvm-images.plan.json -Raw
```

### Paso 3 - Construir imagenes JVM locales

```powershell
cd C:\VENTA-DE-PASAJES

powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-backend-jvm-images.ps1 `
  -ImageTag 0.1.1-jvm
```

### Paso 4 - Publicar imagenes en Artifact Registry

```powershell
cd C:\VENTA-DE-PASAJES

powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-backend-jvm-images.ps1 `
  -ImageTag 0.1.1-jvm `
  -SkipPackage `
  -SkipDockerBuild `
  -Push
```

### Paso 5 - Verificar que las imagenes existen

```powershell
cd C:\VENTA-DE-PASAJES

powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\deploy-cloudrun-dev.ps1 `
  -ImageTag 0.1.1-jvm `
  -BackendOnly `
  -CheckImagesOnly
```

Debe mostrar `exists=True` para:

```text
identity-service
dispatch-service
document-service
reporting-service
audit-service
ticketing-service
```

### Paso 6 - Aplicar permisos de esquema Cloud SQL

Primero plan:

```powershell
cd C:\VENTA-DE-PASAJES

powershell -NoProfile -ExecutionPolicy Bypass -File .\infra\gcloud\grant-cloudsql-schema-dev.ps1
```

Luego ejecutar:

```powershell
cd C:\VENTA-DE-PASAJES

powershell -NoProfile -ExecutionPolicy Bypass -File .\infra\gcloud\grant-cloudsql-schema-dev.ps1 `
  -Execute
```

Este script:

```text
Crea o reutiliza un bucket temporal de imports SQL.
Da permiso de lectura al service account interno de Cloud SQL.
Sube SQL pequeno por base.
Ejecuta gcloud sql import sql.
Elimina los objetos SQL importados del bucket.
```

### Paso 7 - Desplegar backends JVM en Cloud Run

```powershell
cd C:\VENTA-DE-PASAJES

powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\deploy-cloudrun-dev.ps1 `
  -ImageTag 0.1.1-jvm `
  -BackendOnly `
  -Execute
```

### Paso 8 - Validar health y consultas reales

```powershell
cd C:\VENTA-DE-PASAJES

$env:CLOUDSDK_PYTHON = "C:\Python312\python.exe"
$GcloudPath = "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd"
$ProjectId = "project-fbb34cd7-0b82-43e1-867"
$Region = "us-central1"
$Token = (& $GcloudPath auth print-identity-token).Trim()

$ServiceUrls = @{}
foreach ($ServiceId in @("identity-service","dispatch-service","document-service","reporting-service","audit-service","ticketing-service")) {
  $ServiceUrls[$ServiceId] = (& $GcloudPath run services describe $ServiceId --project $ProjectId --region $Region --format "value(status.url)").Trim()
}

$Checks = @(
  @{ service="identity-service"; path="/api/v1/identity/health" },
  @{ service="dispatch-service"; path="/api/v1/dispatch/health" },
  @{ service="document-service"; path="/api/v1/document/health" },
  @{ service="reporting-service"; path="/api/v1/reporting/health" },
  @{ service="audit-service"; path="/api/v1/audit/health" },
  @{ service="ticketing-service"; path="/api/v1/ticketing/health" },
  @{ service="dispatch-service"; path="/api/v1/dispatch/terminals?page=1&page_size=1" },
  @{ service="dispatch-service"; path="/api/v1/dispatch/departures?page=1&page_size=1" },
  @{ service="ticketing-service"; path="/api/v1/ticketing/passengers" },
  @{ service="ticketing-service"; path="/api/v1/ticketing/availability/departures?date_from=2026-09-01&date_to=2026-09-30" },
  @{ service="reporting-service"; path="/api/v1/reporting/reports/sales?date_from=2026-09-01&date_to=2026-09-30" },
  @{ service="audit-service"; path="/api/v1/audit/audit-events" }
)

$Rows = foreach ($Check in $Checks) {
  $Url = "$($ServiceUrls[$Check.service])$($Check.path)"
  $Response = Invoke-WebRequest -Uri $Url -Headers @{ Authorization = "Bearer $Token" } -UseBasicParsing -TimeoutSec 60
  [pscustomobject]@{ service=$Check.service; path=$Check.path; code=[int]$Response.StatusCode; bytes=$Response.Content.Length }
}

$Rows | Format-Table -AutoSize
```

## Evidencia ejecutada

```text
Imagenes backend publicadas con tag 0.1.1-jvm.
deploy-cloudrun-dev.ps1 -ImageTag 0.1.1-jvm -BackendOnly -CheckImagesOnly: seis imagenes existen.
grant-cloudsql-schema-dev.ps1 -Execute: imports SQL aplicados a seis bases.
deploy-cloudrun-dev.ps1 -ImageTag 0.1.1-jvm -BackendOnly -Execute: OK.
Health privado de seis backends: HTTP 200.
Consultas reales de dispatch, ticketing, reporting y audit: HTTP 200.
```

## Pendiente tecnico

La compilacion nativa con Cloud SQL Socket Factory sigue pendiente. La ruta JVM queda como camino estable para Cloud Run dev mientras se decide una de estas opciones:

```text
Mantener JVM para backends con Cloud SQL.
Resolver configuracion native-image de Cloud SQL Socket Factory.
Separar native on-prem/local y JVM cloud.
```
