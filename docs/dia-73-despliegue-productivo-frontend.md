# Dia 73 - Despliegue productivo de frontend shell y MFEs

Fecha: 2026-09-24

## Objetivo

Desplegar en Cloud Run produccion el `frontend-shell` y los cinco microfrontends, usando servicios con sufijo `-prod`, variables productivas, imagenes promovidas desde el tag `dev` validado y backends privados `*-prod`.

Servicios desplegados:

```text
frontend-shell-prod
mfe-identity-prod
mfe-dispatch-prod
mfe-ticketing-prod
mfe-reporting-prod
mfe-admin-prod
```

## Reversa primero

Esta reversa elimina solo los frontends productivos creados en este dia y, opcionalmente, retira el tag frontend productivo. No elimina backends, Cloud SQL, buckets ni secretos.

### Paso R1 - Ubicarse en el workspace

```powershell
cd C:\VENTA-DE-PASAJES
$env:CLOUDSDK_PYTHON = "C:\Python312\python.exe"
$ProjectId = "project-fbb34cd7-0b82-43e1-867"
$Region = "us-central1"
$Repository = "venta-pasajes-dev"
$ImageTag = "prod-frontend-20260924"
$Gcloud = "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd"
```

### Paso R2 - Revisar servicios frontend productivos

```powershell
& $Gcloud run services list `
  --project $ProjectId `
  --region $Region `
  --format "table(metadata.name,status.url)" | Select-String "frontend-shell-prod|mfe-.*-prod"
```

### Paso R3 - Eliminar servicios frontend productivos

Advertencia: este paso elimina las URLs productivas directas de shell y MFEs.

```powershell
$FrontendServices = @(
  "frontend-shell-prod",
  "mfe-identity-prod",
  "mfe-dispatch-prod",
  "mfe-ticketing-prod",
  "mfe-reporting-prod",
  "mfe-admin-prod"
)

foreach ($Service in $FrontendServices) {
  & $Gcloud run services delete $Service `
    --project $ProjectId `
    --region $Region `
    --quiet
}
```

### Paso R4 - Opcional: eliminar tag productivo frontend

Ejecutar solo si se quiere retirar el alias `prod-frontend-20260924`.

```powershell
$Images = @(
  "frontend-shell",
  "mfe-identity",
  "mfe-dispatch",
  "mfe-ticketing",
  "mfe-reporting",
  "mfe-admin"
)

foreach ($Image in $Images) {
  & $Gcloud artifacts docker tags delete `
    "$Region-docker.pkg.dev/$ProjectId/$Repository/${Image}:$ImageTag" `
    --project $ProjectId `
    --quiet
}
```

### Paso R5 - Opcional: retirar invocacion MFE a backends privados

Ejecutar solo despues de eliminar o reemplazar los frontends productivos.

```powershell
$Backends = @(
  "identity-service-prod",
  "dispatch-service-prod",
  "ticketing-service-prod",
  "document-service-prod",
  "reporting-service-prod",
  "audit-service-prod"
)

$Callers = @(
  "frontend-prod-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com",
  "mfe-identity-prod-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com",
  "mfe-dispatch-prod-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com",
  "mfe-ticketing-prod-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com",
  "mfe-reporting-prod-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com",
  "mfe-admin-prod-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com"
)

foreach ($Backend in $Backends) {
  foreach ($Caller in $Callers) {
    & $Gcloud run services remove-iam-policy-binding $Backend `
      --project $ProjectId `
      --region $Region `
      --member "serviceAccount:$Caller" `
      --role "roles/run.invoker" `
      --quiet
  }
}
```

## Cambios realizados

```text
Artifact Registry: tag prod-frontend-20260924 creado para seis imagenes frontend desde dev.
Cloud Run IAM: 36 bindings roles/run.invoker aplicados desde cuentas frontend prod hacia seis backends privados prod.
Cloud Run: seis servicios frontend productivos desplegados con sufijo -prod.
Validacion: health, manifests MFE, rutas embedded, runtime config y admin aggregate health.
```

## Decisiones tecnicas

- Los backends productivos permanecen privados.
- Los frontends productivos quedaron publicos porque el navegador carga manifiestos e iframes directamente desde las URLs de los MFEs.
- Cada MFE usa su propia cuenta runtime `mfe-*-prod-run`; el shell usa `frontend-prod-run`.
- Las llamadas MFE hacia backends privados se realizan desde el proxy server-side del MFE con identity token.
- Se promovio desde `dev` a `prod-frontend-20260924` porque `dev` era el tag frontend validado previamente.
- `deploy-cloudrun-dev.ps1` conserva el nombre historico, pero en este dia apunta a produccion por `prod-frontend-services.json`.
- Se corrigio el script de despliegue para detectar tambien valores `UNRESOLVED_` dentro de los archivos `*.env.yaml`.

## Guia manual desde cero

### Paso 1 - Preparar terminal

```powershell
cd C:\VENTA-DE-PASAJES
$env:CLOUDSDK_PYTHON = "C:\Python312\python.exe"
$ProjectId = "project-fbb34cd7-0b82-43e1-867"
$Region = "us-central1"
$ImageTag = "prod-frontend-20260924"
$Gcloud = "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd"
```

### Paso 2 - Validar archivos requeridos

```powershell
Test-Path -LiteralPath .\infra\cloudrun\prod-frontend-services.json
Test-Path -LiteralPath .\infra\gcloud\grant-prod-frontend-backend-invokers.ps1
Test-Path -LiteralPath .\scripts\deploy-cloudrun-dev.ps1
Test-Path -LiteralPath .\scripts\verify-cloudrun-prod-frontends.ps1
```

Todos deben responder `True`.

### Paso 3 - Confirmar que los backends productivos estan listos

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-cloudrun-prod-backends.ps1 `
  -FailOnNotReady
```

Resultado esperado:

```text
Backend productivo listo: True
```

### Paso 4 - Promover imagenes frontend a tag productivo

Primero plan:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\promote-artifact-image-tags.ps1 `
  -ServiceIds frontend-shell,mfe-identity,mfe-dispatch,mfe-ticketing,mfe-reporting,mfe-admin `
  -SourceTag dev `
  -TargetTag $ImageTag
```

Debe mostrar `source_exists=True` para los seis frontends.

Ejecutar promocion real:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\promote-artifact-image-tags.ps1 `
  -ServiceIds frontend-shell,mfe-identity,mfe-dispatch,mfe-ticketing,mfe-reporting,mfe-admin `
  -SourceTag dev `
  -TargetTag $ImageTag `
  -Execute
```

### Paso 5 - Aplicar permisos de MFEs hacia backends privados

Primero plan:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\infra\gcloud\grant-prod-frontend-backend-invokers.ps1
```

Ejecutar permisos:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\infra\gcloud\grant-prod-frontend-backend-invokers.ps1 `
  -Execute
```

Validar evidencia:

```powershell
$Grant = Get-Content -LiteralPath .\logs\cloudrun-prod\grant-prod-frontend-backend-invokers.json -Raw | ConvertFrom-Json
@($Grant.bindings | Where-Object invoker_after).Count
```

Resultado esperado:

```text
36
```

### Paso 6 - Preflight de imagenes productivas

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\deploy-cloudrun-dev.ps1 `
  -ConfigPath .\infra\cloudrun\prod-frontend-services.json `
  -ImageTag $ImageTag `
  -FrontendOnly `
  -ResolveExistingServiceUrls `
  -CheckImagesOnly `
  -OutputPath logs\cloudrun-prod\deploy-cloudrun-prod-frontends.commands.ps1
```

Debe mostrar `exists=True` para los seis frontends.

### Paso 7 - Bootstrap inicial de servicios frontend

Ejecutar solo cuando los servicios `*-prod` aun no existen. Esta pasada puede usar URLs temporales `UNRESOLVED_` para crear los servicios y obtener sus URLs reales.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\deploy-cloudrun-dev.ps1 `
  -ConfigPath .\infra\cloudrun\prod-frontend-services.json `
  -ImageTag $ImageTag `
  -FrontendOnly `
  -ResolveExistingServiceUrls `
  -AllowUnresolved `
  -Execute `
  -OutputPath logs\cloudrun-prod\deploy-cloudrun-prod-frontends.commands.ps1
```

### Paso 8 - Generar plan definitivo sin valores temporales

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\deploy-cloudrun-dev.ps1 `
  -ConfigPath .\infra\cloudrun\prod-frontend-services.json `
  -ImageTag $ImageTag `
  -FrontendOnly `
  -ResolveExistingServiceUrls `
  -OutputPath logs\cloudrun-prod\deploy-cloudrun-prod-frontends.commands.ps1

$Plan = Get-Content -LiteralPath .\logs\cloudrun-prod\deploy-cloudrun-prod-frontends.commands.plan.json -Raw | ConvertFrom-Json
$Plan.services | Select-Object id,@{n='unresolved_count';e={@($_.unresolved).Count}}
```

Resultado esperado:

```text
unresolved_count = 0 para los seis servicios.
```

### Paso 9 - Ejecutar despliegue definitivo

Este paso modifica Cloud Run.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\deploy-cloudrun-dev.ps1 `
  -ConfigPath .\infra\cloudrun\prod-frontend-services.json `
  -ImageTag $ImageTag `
  -FrontendOnly `
  -ResolveExistingServiceUrls `
  -Execute `
  -OutputPath logs\cloudrun-prod\deploy-cloudrun-prod-frontends.commands.ps1
```

### Paso 10 - Verificar frontends productivos

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-cloudrun-prod-frontends.ps1 `
  -FailOnNotReady
```

Resultado esperado:

```text
services_ready: 6
services_prod_env: 6
services_account_match: 6
services_without_unresolved_env: 6
checks_passed: 19
checks_failed: 0
Frontend productivo listo: True
```

### Paso 11 - Probar admin agregado

```powershell
$AdminHealth = Invoke-WebRequest `
  -Uri "https://mfe-admin-prod-io7kxgn6yq-uc.a.run.app/api/admin/health" `
  -UseBasicParsing `
  -TimeoutSec 60

($AdminHealth.Content | ConvertFrom-Json).totals
```

Resultado esperado:

```text
frontend_up: 6
backend_up: 6
up: 12
down: 0
```

## Evidencia de ejecucion

Archivos:

```text
C:\VENTA-DE-PASAJES\logs\artifact-registry\promote-artifact-image-tags.plan.json
C:\VENTA-DE-PASAJES\logs\cloudrun-prod\grant-prod-frontend-backend-invokers.json
C:\VENTA-DE-PASAJES\logs\cloudrun-prod\deploy-cloudrun-prod-frontends.commands.plan.json
C:\VENTA-DE-PASAJES\logs\cloudrun-prod\verify-cloudrun-prod-frontends.json
```

Resumen final observado:

```text
Servicios frontend productivos: 6
Servicios Ready: 6
Servicios con NEXT_PUBLIC_APP_ENV=prod: 6
Service accounts productivas correctas: 6
Servicios sin UNRESOLVED_: 6
Checks HTTP y funcionales: 19/19
Admin aggregate health: 12/12 up
Frontend productivo listo: True
```

URLs productivas directas:

```text
https://frontend-shell-prod-io7kxgn6yq-uc.a.run.app
https://mfe-identity-prod-io7kxgn6yq-uc.a.run.app
https://mfe-dispatch-prod-io7kxgn6yq-uc.a.run.app
https://mfe-ticketing-prod-io7kxgn6yq-uc.a.run.app
https://mfe-reporting-prod-io7kxgn6yq-uc.a.run.app
https://mfe-admin-prod-io7kxgn6yq-uc.a.run.app
```

## Problemas encontrados y solucionados

### Imagen productiva no existia

El preflight fallo correctamente porque `prod-frontend-20260924` aun no existia. Se promovieron las seis imagenes desde `dev` y se repitio el preflight hasta obtener `exists=True`.

### Variables temporales escondidas en archivos YAML

El script detectaba `UNRESOLVED_` en argumentos, pero no dentro de `*.env.yaml`. Se corrigio `deploy-cloudrun-dev.ps1` para validar tambien los pares de variables antes de ejecutar.

### URLs propias de MFEs no existen antes del bootstrap

El primer despliegue necesita `-AllowUnresolved` para crear los servicios y obtener URLs. Despues se ejecuta una segunda pasada sin `-AllowUnresolved` para fijar URLs reales.

### Admin agregado inicialmente `degraded`

La primera consulta a `/api/admin/health` reporto backends abajo mientras se propagaban IAM/cold starts. La segunda consulta respondio `status=up` con 12/12 activos. El verificador quedo actualizado para validar este punto.

## Estado final

```text
Frontend productivo desplegado.
El shell carga manifests productivos de los cinco MFEs.
Los cinco MFEs responden rutas embedded en produccion.
Los proxies MFE pueden invocar backends privados productivos.
La entrada final con dominio y TLS puede retomarse desde el Dia 71 usando frontend-shell-prod.
```
