# Dia 59 - Despliegue Cloud Run reporting-service

Fecha de ejecucion: 2026-09-21

## Objetivo

Publicar `reporting-service` en Artifact Registry, crear el tag operativo `dev` y desplegar el servicio en Cloud Run dev.

Alcance del dia:

```text
Validar prerequisitos de Google Cloud para reporting-service.
Publicar la imagen reporting-service:0.1.0-native en Artifact Registry.
Promover reporting-service:0.1.0-native a reporting-service:dev.
Ejecutar preflight de imagen para Cloud Run.
Desplegar reporting-service en Cloud Run dev.
Validar estado Ready, revision activa y health autenticado.
Documentar reversa y guia manual desde cero.
```

## Resultado logrado

```text
Artifact Registry contiene reporting-service:0.1.0-native.
Artifact Registry contiene reporting-service:dev.
Cloud Run desplego reporting-service en us-central1.
Revision lista: reporting-service-00001-fls.
Trafico: 100% a la revision lista.
Health autenticado: HTTP 200 OK.
```

Datos validados:

```text
Proyecto: project-fbb34cd7-0b82-43e1-867
Region: us-central1
Repositorio: venta-pasajes-dev
Imagen desplegada: us-central1-docker.pkg.dev/project-fbb34cd7-0b82-43e1-867/venta-pasajes-dev/reporting-service:dev
Digest Artifact Registry: sha256:00e576bf5c3c42196e7b0cce24ed9b60939666777d4d403b2fc34945b44f1c17
Cloud Run URL: https://reporting-service-io7kxgn6yq-uc.a.run.app
Health URL: https://reporting-service-io7kxgn6yq-uc.a.run.app/api/v1/reporting/health
```

## Archivos creados

```text
C:\VENTA-DE-PASAJES\docs\dia-59-despliegue-cloud-run-reporting-service.md
```

## Archivos modificados

```text
C:\VENTA-DE-PASAJES\README.md
C:\VENTA-DE-PASAJES\infra\README.md
C:\VENTA-DE-PASAJES\vitacora.md
```

## Reversa primero

Esta reversa deshace el despliegue de Cloud Run de `reporting-service` y, si se desea, elimina el tag `dev` creado en Artifact Registry.

### Paso 1 - Ubicarse en el proyecto

```powershell
$ProjectRoot = "C:\VENTA-DE-PASAJES"
Set-Location $ProjectRoot
```

### Paso 2 - Configurar gcloud para Windows

```powershell
$env:CLOUDSDK_PYTHON = "C:\Python312\python.exe"
$GcloudPath = "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd"
```

### Paso 3 - Revisar el servicio antes de eliminar

```powershell
& $GcloudPath run services describe reporting-service `
  --project "project-fbb34cd7-0b82-43e1-867" `
  --region "us-central1" `
  --format "json(status.url,status.latestReadyRevisionName,status.traffic)"
```

### Paso 4 - Eliminar el servicio Cloud Run si se quiere revertir completamente

Advertencia: este paso elimina el servicio Cloud Run dev `reporting-service`.

```powershell
& $GcloudPath run services delete reporting-service `
  --project "project-fbb34cd7-0b82-43e1-867" `
  --region "us-central1" `
  --quiet
```

### Paso 5 - Validar reversa Cloud Run

```powershell
& $GcloudPath run services describe reporting-service `
  --project "project-fbb34cd7-0b82-43e1-867" `
  --region "us-central1"
```

Resultado esperado despues de eliminar:

```text
NOT_FOUND
```

### Paso 6 - Eliminar solo el tag dev si se quiere revertir la promocion

Advertencia: este paso elimina el tag `dev` de Artifact Registry. No elimina necesariamente el digest si otros tags lo siguen apuntando.

```powershell
& $GcloudPath artifacts docker tags delete `
  "us-central1-docker.pkg.dev/project-fbb34cd7-0b82-43e1-867/venta-pasajes-dev/reporting-service:dev" `
  --project "project-fbb34cd7-0b82-43e1-867" `
  --quiet
```

### Paso 7 - Eliminar la imagen native si tambien se quiere limpiar Artifact Registry

Advertencia: ejecutar solo si se quiere borrar tambien `0.1.0-native`.

```powershell
& $GcloudPath artifacts docker images delete `
  "us-central1-docker.pkg.dev/project-fbb34cd7-0b82-43e1-867/venta-pasajes-dev/reporting-service:0.1.0-native" `
  --project "project-fbb34cd7-0b82-43e1-867" `
  --quiet
```

Si esa imagen comparte digest con otros tags, usar `--delete-tags` solo cuando se quiera borrar tambien esos tags.

### Paso 8 - Reversa documental local

Si solo se quiere quitar esta practica de la documentacion:

```powershell
Remove-Item -LiteralPath "$ProjectRoot\docs\dia-59-despliegue-cloud-run-reporting-service.md" -Force
```

Luego retirar las referencias al Dia 59 en:

```text
C:\VENTA-DE-PASAJES\README.md
C:\VENTA-DE-PASAJES\infra\README.md
C:\VENTA-DE-PASAJES\vitacora.md
```

## Guia manual desde cero

> Importante: ejecutar desde PowerShell en `C:\VENTA-DE-PASAJES`.

### Paso 1 - Ubicarse en el proyecto

```powershell
$ProjectRoot = "C:\VENTA-DE-PASAJES"
Set-Location $ProjectRoot
```

### Paso 2 - Configurar gcloud para Windows

```powershell
$env:CLOUDSDK_PYTHON = "C:\Python312\python.exe"
$GcloudPath = "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd"
```

### Paso 3 - Confirmar cuenta y proyecto activo

```powershell
& $GcloudPath auth list --filter=status:ACTIVE --format "value(account)"
& $GcloudPath config get-value project
```

Resultado observado:

```text
jkrivera1521@gmail.com
project-fbb34cd7-0b82-43e1-867
```

### Paso 4 - Validar prerequisitos cloud

```powershell
& $GcloudPath artifacts repositories describe venta-pasajes-dev `
  --project "project-fbb34cd7-0b82-43e1-867" `
  --location "us-central1" `
  --format "value(name)"

& $GcloudPath iam service-accounts describe `
  "reporting-service-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com" `
  --project "project-fbb34cd7-0b82-43e1-867" `
  --format "value(email)"

& $GcloudPath secrets describe "reporting-service__db-connection" `
  --project "project-fbb34cd7-0b82-43e1-867" `
  --format "value(name)"
```

Resultado esperado:

```text
Repositorio Artifact Registry existe.
Service account reporting-service-run existe.
Secret reporting-service__db-connection existe.
```

### Paso 5 - Publicar imagen native en Artifact Registry

Este paso asume que el Dia 58 ya creo la imagen local y tambien la etiqueta remota local.

```powershell
docker images --format "{{.Repository}}:{{.Tag}} {{.ID}} {{.Size}}" |
  Select-String -Pattern "reporting-service|venta-pasajes-dev/reporting-service"
```

Debe existir:

```text
reporting-service:0.1.0-native
us-central1-docker.pkg.dev/project-fbb34cd7-0b82-43e1-867/venta-pasajes-dev/reporting-service:0.1.0-native
```

Publicar:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-reporting-service-native.ps1 `
  -SkipNativeBuild `
  -SkipDockerBuild `
  -Push
```

Resultado observado:

```text
0.1.0-native: digest: sha256:00e576bf5c3c42196e7b0cce24ed9b60939666777d4d403b2fc34945b44f1c17
"pushed":true
"ready":true
```

### Paso 6 - Verificar imagen native publicada

```powershell
& $GcloudPath artifacts docker images describe `
  "us-central1-docker.pkg.dev/project-fbb34cd7-0b82-43e1-867/venta-pasajes-dev/reporting-service:0.1.0-native" `
  --project "project-fbb34cd7-0b82-43e1-867" `
  --format "value(image_summary.digest)"
```

Resultado observado:

```text
sha256:00e576bf5c3c42196e7b0cce24ed9b60939666777d4d403b2fc34945b44f1c17
```

### Paso 7 - Promover tag dev

Primero generar plan:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\promote-artifact-image-tags.ps1 `
  -ServiceIds reporting-service `
  -SourceTag 0.1.0-native `
  -TargetTag dev
```

Resultado observado:

```text
source_exists: True
target_exists_before: False
action: planned
```

Luego ejecutar:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\promote-artifact-image-tags.ps1 `
  -ServiceIds reporting-service `
  -SourceTag 0.1.0-native `
  -TargetTag dev `
  -Execute
```

Resultado observado:

```text
source_exists: True
target_exists_before: False
target_exists_after: True
action: tagged
```

### Paso 8 - Verificar tag dev

```powershell
& $GcloudPath artifacts docker images describe `
  "us-central1-docker.pkg.dev/project-fbb34cd7-0b82-43e1-867/venta-pasajes-dev/reporting-service:dev" `
  --project "project-fbb34cd7-0b82-43e1-867" `
  --format "value(image_summary.digest)"
```

Resultado observado:

```text
sha256:00e576bf5c3c42196e7b0cce24ed9b60939666777d4d403b2fc34945b44f1c17
```

### Paso 9 - Ejecutar preflight de imagen para Cloud Run

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\deploy-cloudrun-dev.ps1 `
  -ImageTag dev `
  -ServiceIds reporting-service `
  -CheckImagesOnly
```

Resultado esperado:

```text
reporting-service   True
```

### Paso 10 - Ejecutar despliegue real

Este paso modifica Cloud Run.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\deploy-cloudrun-dev.ps1 `
  -ImageTag dev `
  -ServiceIds reporting-service `
  -Execute
```

Resultado observado:

```text
reporting-service backend reporting-service 8085 False True
```

### Paso 11 - Validar estado Cloud Run

```powershell
& $GcloudPath run services describe reporting-service `
  --project "project-fbb34cd7-0b82-43e1-867" `
  --region "us-central1" `
  --format "json(status.url,status.latestReadyRevisionName,status.conditions,status.traffic)"
```

Resultado observado:

```text
Ready: True
ConfigurationsReady: True
RoutesReady: True
latestReadyRevisionName: reporting-service-00001-fls
traffic: 100%
url: https://reporting-service-io7kxgn6yq-uc.a.run.app
```

### Paso 12 - Validar health autenticado

`reporting-service` esta privado, por eso se envia `Authorization: Bearer`.

```powershell
$Url = (& $GcloudPath run services describe reporting-service `
  --project "project-fbb34cd7-0b82-43e1-867" `
  --region "us-central1" `
  --format "value(status.url)").Trim()

$Token = (& $GcloudPath auth print-identity-token).Trim()
$HealthUrl = "$Url/api/v1/reporting/health"

curl.exe --ssl-no-revoke -i -sS -w "`nHTTP_STATUS:%{http_code}`n" `
  -H "Authorization: Bearer $Token" `
  $HealthUrl
```

Resultado observado:

```text
HTTP/1.1 200 OK
{"status":"ok","service":"reporting-service","runtime":"quarkus","checked_at":"2026-09-21T14:47:00.858884Z"}
HTTP_STATUS:200
```

## Comandos de validacion ejecutados

```powershell
git status --short
docker images --format "{{.Repository}}:{{.Tag}} {{.ID}} {{.Size}}" | Select-String -Pattern "reporting-service|venta-pasajes-dev/reporting-service"
& $GcloudPath auth list --filter=status:ACTIVE --format "value(account)"
& $GcloudPath config get-value project
& $GcloudPath artifacts repositories describe venta-pasajes-dev --project project-fbb34cd7-0b82-43e1-867 --location us-central1 --format "value(name)"
& $GcloudPath iam service-accounts describe "reporting-service-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com" --project project-fbb34cd7-0b82-43e1-867 --format "value(email)"
& $GcloudPath secrets describe "reporting-service__db-connection" --project project-fbb34cd7-0b82-43e1-867 --format "value(name)"
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-reporting-service-native.ps1 -SkipNativeBuild -SkipDockerBuild -Push
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\promote-artifact-image-tags.ps1 -ServiceIds reporting-service -SourceTag 0.1.0-native -TargetTag dev
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\promote-artifact-image-tags.ps1 -ServiceIds reporting-service -SourceTag 0.1.0-native -TargetTag dev -Execute
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\deploy-cloudrun-dev.ps1 -ImageTag dev -ServiceIds reporting-service -CheckImagesOnly
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\deploy-cloudrun-dev.ps1 -ImageTag dev -ServiceIds reporting-service -Execute
curl.exe --ssl-no-revoke -i -sS -w "`nHTTP_STATUS:%{http_code}`n" -H "Authorization: Bearer $Token" $HealthUrl
```

Resultados observados:

```text
Worktree limpio antes de iniciar.
Cuenta activa: jkrivera1521@gmail.com.
Proyecto activo: project-fbb34cd7-0b82-43e1-867.
Repositorio Artifact Registry existe.
Service account reporting-service-run existe.
Secret reporting-service__db-connection existe.
reporting-service:0.1.0-native publicado con digest sha256:00e576bf5c3c42196e7b0cce24ed9b60939666777d4d403b2fc34945b44f1c17.
reporting-service:dev creado y apunta al mismo digest.
Cloud Run Ready: True.
Revision lista: reporting-service-00001-fls.
Trafico: 100%.
Health: HTTP 200 OK.
```

## Notas operativas

```text
reporting-service queda privado en Cloud Run dev.
La validacion de health requiere token de identidad.
El servicio mantiene su base propia reporting_db.
El servicio no debe consultar bases de otros microservicios directamente.
Los datos de reportes deben llegar al read model por eventos o sincronizacion controlada.
```
