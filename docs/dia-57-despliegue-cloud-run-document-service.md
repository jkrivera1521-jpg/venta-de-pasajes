# Dia 57 - Despliegue Cloud Run document-service

Fecha de ejecucion: 2026-09-18

## Objetivo

Publicar operacionalmente `document-service` en Cloud Run dev usando la imagen `dev` ya disponible en Artifact Registry.

Alcance del dia:

```text
Validar que document-service:0.1.0-native existe en Artifact Registry.
Validar que document-service:dev existe en Artifact Registry.
Ejecutar preflight de Cloud Run para document-service.
Desplegar document-service en Cloud Run dev.
Validar estado Ready, revision activa y health autenticado.
Documentar reversa y guia manual desde cero.
```

## Resultado logrado

```text
Artifact Registry contiene document-service:0.1.0-native.
Artifact Registry contiene document-service:dev.
Cloud Run desplego document-service en us-central1.
Revision lista: document-service-00001-9lc.
Trafico: 100% a la revision lista.
Health autenticado: HTTP 200 OK.
```

Datos validados:

```text
Proyecto: project-fbb34cd7-0b82-43e1-867
Region: us-central1
Repositorio: venta-pasajes-dev
Imagen desplegada: us-central1-docker.pkg.dev/project-fbb34cd7-0b82-43e1-867/venta-pasajes-dev/document-service:dev
Digest Artifact Registry: sha256:d87c7df18dc91dc5f9db3f7c2a09f5df16182c96c22b4e8baaaec101b0abda18
Cloud Run URL: https://document-service-io7kxgn6yq-uc.a.run.app
Health URL: https://document-service-io7kxgn6yq-uc.a.run.app/api/v1/document/health
```

## Archivos creados

```text
C:\VENTA-DE-PASAJES\docs\dia-57-despliegue-cloud-run-document-service.md
```

## Archivos modificados

```text
C:\VENTA-DE-PASAJES\README.md
C:\VENTA-DE-PASAJES\infra\README.md
C:\VENTA-DE-PASAJES\vitacora.md
```

## Reversa primero

Esta reversa deshace el despliegue de Cloud Run de `document-service`. No elimina imagenes de Artifact Registry porque en esta practica solo se verifico que los tags ya existian antes del despliegue.

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
& $GcloudPath run services describe document-service `
  --project "project-fbb34cd7-0b82-43e1-867" `
  --region "us-central1" `
  --format "json(status.url,status.latestReadyRevisionName,status.traffic)"
```

### Paso 4 - Eliminar el servicio Cloud Run si se quiere revertir completamente

Advertencia: este paso elimina el servicio Cloud Run dev `document-service`.

```powershell
& $GcloudPath run services delete document-service `
  --project "project-fbb34cd7-0b82-43e1-867" `
  --region "us-central1" `
  --quiet
```

### Paso 5 - Validar reversa Cloud Run

```powershell
& $GcloudPath run services describe document-service `
  --project "project-fbb34cd7-0b82-43e1-867" `
  --region "us-central1"
```

Resultado esperado despues de eliminar:

```text
NOT_FOUND
```

### Paso 6 - Reversa documental local

Si solo se quiere quitar esta practica de la documentacion:

```powershell
Remove-Item -LiteralPath "$ProjectRoot\docs\dia-57-despliegue-cloud-run-document-service.md" -Force
```

Luego retirar las referencias al Dia 57 en:

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

### Paso 4 - Verificar imagen native en Artifact Registry

```powershell
& $GcloudPath artifacts docker images describe `
  "us-central1-docker.pkg.dev/project-fbb34cd7-0b82-43e1-867/venta-pasajes-dev/document-service:0.1.0-native" `
  --project "project-fbb34cd7-0b82-43e1-867" `
  --format "value(image_summary.digest)"
```

Resultado observado:

```text
sha256:d87c7df18dc91dc5f9db3f7c2a09f5df16182c96c22b4e8baaaec101b0abda18
```

### Paso 5 - Verificar tag dev en Artifact Registry

```powershell
& $GcloudPath artifacts docker images describe `
  "us-central1-docker.pkg.dev/project-fbb34cd7-0b82-43e1-867/venta-pasajes-dev/document-service:dev" `
  --project "project-fbb34cd7-0b82-43e1-867" `
  --format "value(image_summary.digest)"
```

Resultado observado:

```text
sha256:d87c7df18dc91dc5f9db3f7c2a09f5df16182c96c22b4e8baaaec101b0abda18
```

Si el tag `dev` no existe, crearlo desde el tag native:

```powershell
& $GcloudPath artifacts docker tags add `
  "us-central1-docker.pkg.dev/project-fbb34cd7-0b82-43e1-867/venta-pasajes-dev/document-service:0.1.0-native" `
  "us-central1-docker.pkg.dev/project-fbb34cd7-0b82-43e1-867/venta-pasajes-dev/document-service:dev" `
  --project "project-fbb34cd7-0b82-43e1-867" `
  --quiet
```

### Paso 6 - Ejecutar preflight de imagen para Cloud Run

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\deploy-cloudrun-dev.ps1 `
  -ImageTag dev `
  -ServiceIds document-service `
  -CheckImagesOnly
```

Resultado esperado:

```text
document-service   True
```

### Paso 7 - Ejecutar despliegue real

Este paso modifica Cloud Run.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\deploy-cloudrun-dev.ps1 `
  -ImageTag dev `
  -ServiceIds document-service `
  -Execute
```

Resultado observado:

```text
document-service backend document-service 8084 False True
```

### Paso 8 - Validar estado Cloud Run

```powershell
& $GcloudPath run services describe document-service `
  --project "project-fbb34cd7-0b82-43e1-867" `
  --region "us-central1" `
  --format "json(status.url,status.latestReadyRevisionName,status.conditions,status.traffic)"
```

Resultado observado:

```text
Ready: True
ConfigurationsReady: True
RoutesReady: True
latestReadyRevisionName: document-service-00001-9lc
traffic: 100%
url: https://document-service-io7kxgn6yq-uc.a.run.app
```

### Paso 9 - Validar health autenticado

`document-service` esta privado, por eso se envia `Authorization: Bearer`.

```powershell
$Url = (& $GcloudPath run services describe document-service `
  --project "project-fbb34cd7-0b82-43e1-867" `
  --region "us-central1" `
  --format "value(status.url)").Trim()

$Token = (& $GcloudPath auth print-identity-token).Trim()
$HealthUrl = "$Url/api/v1/document/health"

curl.exe --ssl-no-revoke -i -sS -w "`nHTTP_STATUS:%{http_code}`n" `
  -H "Authorization: Bearer $Token" `
  $HealthUrl
```

Resultado observado:

```text
HTTP/1.1 200 OK
{"status":"ok","service":"document-service","runtime":"quarkus","checked_at":"2026-09-18T20:27:34.007838Z"}
HTTP_STATUS:200
```

Nota Windows:

```text
Si curl responde CRYPT_E_NO_REVOCATION_CHECK, usar --ssl-no-revoke como se muestra arriba.
```

## Comandos de validacion ejecutados

```powershell
docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.ID}}\t{{.Size}}"
& $GcloudPath auth list --filter=status:ACTIVE --format "value(account)"
& $GcloudPath config get-value project
& $GcloudPath artifacts docker images describe "us-central1-docker.pkg.dev/project-fbb34cd7-0b82-43e1-867/venta-pasajes-dev/document-service:0.1.0-native" --project "project-fbb34cd7-0b82-43e1-867" --format "value(image_summary.digest)"
& $GcloudPath artifacts docker images describe "us-central1-docker.pkg.dev/project-fbb34cd7-0b82-43e1-867/venta-pasajes-dev/document-service:dev" --project "project-fbb34cd7-0b82-43e1-867" --format "value(image_summary.digest)"
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\deploy-cloudrun-dev.ps1 -ImageTag dev -ServiceIds document-service -CheckImagesOnly
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\deploy-cloudrun-dev.ps1 -ImageTag dev -ServiceIds document-service -Execute
& $GcloudPath run services describe document-service --project "project-fbb34cd7-0b82-43e1-867" --region "us-central1" --format "json(status.url,status.latestReadyRevisionName,status.conditions,status.traffic)"
curl.exe --ssl-no-revoke -i -sS -w "`nHTTP_STATUS:%{http_code}`n" -H "Authorization: Bearer $Token" $HealthUrl
```

## Troubleshooting

### El tag dev no existe

Crear el tag:

```powershell
& $GcloudPath artifacts docker tags add `
  "us-central1-docker.pkg.dev/project-fbb34cd7-0b82-43e1-867/venta-pasajes-dev/document-service:0.1.0-native" `
  "us-central1-docker.pkg.dev/project-fbb34cd7-0b82-43e1-867/venta-pasajes-dev/document-service:dev" `
  --project "project-fbb34cd7-0b82-43e1-867" `
  --quiet
```

### curl devuelve HTTP_STATUS:000

En Windows puede ser un problema de revocacion TLS:

```text
CRYPT_E_NO_REVOCATION_CHECK
```

Usar:

```powershell
curl.exe --ssl-no-revoke -i -sS -H "Authorization: Bearer $Token" $HealthUrl
```

### Health responde 401 o 403

Confirmar que se envia token:

```powershell
$Token = (& $GcloudPath auth print-identity-token).Trim()
```

Si la cuenta activa no tiene permiso de invocacion sobre Cloud Run, otorgar el permiso desde IAM antes de repetir la prueba.

## Estado final y siguiente paso natural

```text
document-service quedo desplegado en Cloud Run dev.
El servicio esta privado y responde health con token de identidad.
El siguiente paso natural es continuar con imagen nativa y despliegue de reporting-service o audit-service.
```
