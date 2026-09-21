# Dia 63 - Despliegue Cloud Run frontends

Fecha de ejecucion: 2026-09-21

## Objetivo

Promover las imagenes Docker frontend publicadas en el Dia 62 al tag operativo `dev` y desplegar los seis servicios frontend en Cloud Run dev.

Alcance del dia:

```text
Promover frontend-shell y MFEs desde 0.1.0-frontend a dev.
Corregir despliegue Cloud Run frontend para resolver URLs existentes.
Omitir la variable reservada PORT en --set-env-vars.
Usar placeholders seguros sin caracteres de redireccion de Windows.
Ejecutar bootstrap inicial para crear servicios frontend.
Ejecutar segunda pasada definitiva con URLs reales.
Validar Ready, revision, /api/health, /mfe/manifest y rutas embedded.
Documentar reversa y guia manual desde cero.
```

## Resultado logrado

```text
frontend-shell desplegado en Cloud Run dev.
mfe-identity desplegado en Cloud Run dev.
mfe-dispatch desplegado en Cloud Run dev.
mfe-ticketing desplegado en Cloud Run dev.
mfe-reporting desplegado en Cloud Run dev.
mfe-admin desplegado en Cloud Run dev.
Todos los servicios frontend quedaron publicos y con /api/health HTTP 200.
Los cinco MFEs respondieron /mfe/manifest HTTP 200.
Las cinco rutas embedded respondieron HTTP 200.
No quedaron variables de entorno con UNRESOLVED_ en Cloud Run.
```

URLs validadas:

```text
frontend-shell https://frontend-shell-io7kxgn6yq-uc.a.run.app
mfe-identity   https://mfe-identity-io7kxgn6yq-uc.a.run.app
mfe-dispatch   https://mfe-dispatch-io7kxgn6yq-uc.a.run.app
mfe-ticketing  https://mfe-ticketing-io7kxgn6yq-uc.a.run.app
mfe-reporting  https://mfe-reporting-io7kxgn6yq-uc.a.run.app
mfe-admin      https://mfe-admin-io7kxgn6yq-uc.a.run.app
```

Revisiones listas:

```text
mfe-identity   mfe-identity-00002-rtx
mfe-dispatch   mfe-dispatch-00002-dwt
mfe-ticketing  mfe-ticketing-00002-8g2
mfe-reporting  mfe-reporting-00002-2x5
mfe-admin      mfe-admin-00002-rbq
frontend-shell frontend-shell-00002-tz2
```

Digests validados para tag `dev`:

```text
frontend-shell  sha256:e9e4796f2acc71e8f18b4224f534e575e50f39ccf82b94df7ccc3516267a6b4b
mfe-identity    sha256:8b6f7e73bb10e175677afe3b7efaccdcd2bdb1b90c9b8a4f21190b4dff4e04dc
mfe-dispatch    sha256:bf65f2dd44a918c3bba323381a42bb2bd02a2e5b3047ec658e453ea798df426b
mfe-ticketing   sha256:5e85adcbbd9fb2fc81fce66c85a0321b9c8daee81cc89ab076eacea159934238
mfe-reporting   sha256:ef82dd206606cc05c8d71a21078947bb7233c836f46fae79e2699081c5552111
mfe-admin       sha256:2caa5502178fbd40cca8b23d2c0e81b9d0e9ee74eca6fc1ab6e7950c0fb870e9
```

## Archivos creados

```text
C:\VENTA-DE-PASAJES\docs\dia-63-despliegue-cloud-run-frontends.md
```

## Archivos modificados

```text
C:\VENTA-DE-PASAJES\scripts\deploy-cloudrun-dev.ps1
C:\VENTA-DE-PASAJES\docs\dia-62-imagenes-docker-frontends.md
C:\VENTA-DE-PASAJES\README.md
C:\VENTA-DE-PASAJES\infra\README.md
C:\VENTA-DE-PASAJES\vitacora.md
```

## Ajustes tecnicos realizados

### Resolver URLs existentes

Se agrego `-ResolveExistingServiceUrls` a `scripts\deploy-cloudrun-dev.ps1`.

Ese parametro consulta Cloud Run antes de generar los comandos y permite resolver valores como:

```text
${SERVICE_URL:identity-service}
${SERVICE_URL:mfe-identity}
${SERVICE_URL:frontend-shell}
```

### Evitar placeholders con caracteres peligrosos en Windows

Antes se generaban placeholders como:

```text
<mfe-identity-url>
```

En Windows, al pasar por `gcloud.cmd`, el caracter `<` puede interpretarse como redireccion. Se cambio por:

```text
UNRESOLVED_SERVICE_URL_mfe-identity
```

### Omitir variable reservada PORT

Cloud Run define automaticamente `PORT`, por eso el script ahora omite `PORT` dentro de `--set-env-vars` y mantiene el puerto mediante `--port`.

## Reversa primero

Esta reversa elimina los seis frontends de Cloud Run dev y, opcionalmente, elimina los tags `dev` frontend en Artifact Registry.

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

### Paso 3 - Revisar servicios antes de eliminar

```powershell
$ProjectId = "project-fbb34cd7-0b82-43e1-867"
$Region = "us-central1"
$FrontendServices = "mfe-identity", "mfe-dispatch", "mfe-ticketing", "mfe-reporting", "mfe-admin", "frontend-shell"

$FrontendServices | ForEach-Object {
  & $GcloudPath run services describe $_ `
    --project $ProjectId `
    --region $Region `
    --format "table(metadata.name,status.url,status.latestReadyRevisionName)"
}
```

### Paso 4 - Eliminar servicios frontend de Cloud Run

Advertencia: este paso elimina los servicios frontend de Cloud Run dev.

```powershell
$FrontendServices | ForEach-Object {
  & $GcloudPath run services delete $_ `
    --project $ProjectId `
    --region $Region `
    --quiet
}
```

### Paso 5 - Validar eliminacion

```powershell
$FrontendServices | ForEach-Object {
  & $GcloudPath run services describe $_ `
    --project $ProjectId `
    --region $Region
}
```

Resultado esperado despues de eliminar:

```text
NOT_FOUND
```

### Paso 6 - Eliminar tags dev frontend si se quiere revertir tambien Artifact Registry

Advertencia: este paso elimina los tags `dev` de las imagenes frontend. No elimina necesariamente los digests si `0.1.0-frontend` sigue apuntando a ellos.

```powershell
$Repository = "venta-pasajes-dev"
$FrontendServices | ForEach-Object {
  $Tag = "$Region-docker.pkg.dev/$ProjectId/$Repository/$_`:dev"
  & $GcloudPath artifacts docker tags delete $Tag `
    --project $ProjectId `
    --quiet
}
```

### Paso 7 - Reversa documental local

Si solo se quiere quitar esta practica de la documentacion:

```powershell
Remove-Item -LiteralPath "$ProjectRoot\docs\dia-63-despliegue-cloud-run-frontends.md" -Force
```

Luego retirar las referencias al Dia 63 en:

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

### Paso 4 - Confirmar que existen las imagenes fuente del Dia 62

```powershell
$ProjectId = "project-fbb34cd7-0b82-43e1-867"
$Region = "us-central1"
$Repository = "venta-pasajes-dev"
$FrontendServices = "frontend-shell", "mfe-identity", "mfe-dispatch", "mfe-ticketing", "mfe-reporting", "mfe-admin"

$FrontendServices | ForEach-Object {
  $Image = "$Region-docker.pkg.dev/$ProjectId/$Repository/$_`:0.1.0-frontend"
  & $GcloudPath artifacts docker images describe $Image `
    --project $ProjectId `
    --format "value(image_summary.fully_qualified_digest)"
}
```

Debe devolver digest para los seis frontends.

### Paso 5 - Promover de 0.1.0-frontend a dev en modo plan

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\promote-artifact-image-tags.ps1 `
  -ServiceIds frontend-shell,mfe-identity,mfe-dispatch,mfe-ticketing,mfe-reporting,mfe-admin `
  -SourceTag 0.1.0-frontend `
  -TargetTag dev
```

Debe mostrar `source_exists=True` para todos.

### Paso 6 - Ejecutar promocion real a dev

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\promote-artifact-image-tags.ps1 `
  -ServiceIds frontend-shell,mfe-identity,mfe-dispatch,mfe-ticketing,mfe-reporting,mfe-admin `
  -SourceTag 0.1.0-frontend `
  -TargetTag dev `
  -Execute
```

Debe mostrar `target_exists_after=True`.

### Paso 7 - Preflight Cloud Run

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\deploy-cloudrun-dev.ps1 `
  -ImageTag dev `
  -FrontendOnly `
  -ResolveExistingServiceUrls `
  -CheckImagesOnly
```

Debe mostrar `exists=True` para:

```text
mfe-identity
mfe-dispatch
mfe-ticketing
mfe-reporting
mfe-admin
frontend-shell
```

### Paso 8 - Bootstrap inicial si los frontends aun no existen

Este paso crea los servicios frontend por primera vez. Puede dejar valores `UNRESOLVED_` temporalmente solo durante esta primera pasada.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\deploy-cloudrun-dev.ps1 `
  -ImageTag dev `
  -FrontendOnly `
  -ResolveExistingServiceUrls `
  -Execute `
  -AllowUnresolved
```

Si los servicios ya existen, este paso se puede omitir y pasar directo al Paso 9.

### Paso 9 - Despliegue definitivo con URLs reales

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\deploy-cloudrun-dev.ps1 `
  -ImageTag dev `
  -FrontendOnly `
  -ResolveExistingServiceUrls `
  -Execute
```

Esta segunda pasada no debe requerir `-AllowUnresolved`.

### Paso 10 - Validar Ready y health

```powershell
$FrontendServices = "mfe-identity", "mfe-dispatch", "mfe-ticketing", "mfe-reporting", "mfe-admin", "frontend-shell"

$Rows = foreach ($Service in $FrontendServices) {
  $Json = & $GcloudPath run services describe $Service `
    --project $ProjectId `
    --region $Region `
    --format json | ConvertFrom-Json

  [pscustomobject]@{
    Service = $Service
    Url = $Json.status.url
    Ready = (($Json.status.conditions | Where-Object type -eq "Ready" | Select-Object -First 1).status)
    Revision = $Json.status.latestReadyRevisionName
  }
}

$Rows | Format-Table -AutoSize

$Rows | ForEach-Object {
  $Status = curl.exe --ssl-no-revoke -s -o NUL -w "%{http_code}" "$($_.Url)/api/health"
  [pscustomobject]@{ Service = $_.Service; Status = $Status; HealthUrl = "$($_.Url)/api/health" }
} | Format-Table -AutoSize
```

Resultado esperado:

```text
Ready=True en los seis servicios.
HTTP 200 en los seis /api/health.
```

### Paso 11 - Validar manifiestos MFE

```powershell
$Mfes = @{
  "mfe-identity" = "https://mfe-identity-io7kxgn6yq-uc.a.run.app"
  "mfe-dispatch" = "https://mfe-dispatch-io7kxgn6yq-uc.a.run.app"
  "mfe-ticketing" = "https://mfe-ticketing-io7kxgn6yq-uc.a.run.app"
  "mfe-reporting" = "https://mfe-reporting-io7kxgn6yq-uc.a.run.app"
  "mfe-admin" = "https://mfe-admin-io7kxgn6yq-uc.a.run.app"
}

$Mfes.Keys | Sort-Object | ForEach-Object {
  $Url = "$($Mfes[$_])/mfe/manifest"
  $Status = curl.exe --ssl-no-revoke -s -o NUL -w "%{http_code}" $Url
  [pscustomobject]@{ Service = $_; Status = $Status; Url = $Url }
} | Format-Table -AutoSize
```

Resultado esperado:

```text
HTTP 200 en los cinco /mfe/manifest.
```

### Paso 12 - Validar rutas embedded

```powershell
$EmbeddedChecks = @(
  @{ Service = "mfe-identity"; Url = "https://mfe-identity-io7kxgn6yq-uc.a.run.app/identity/embedded" },
  @{ Service = "mfe-dispatch"; Url = "https://mfe-dispatch-io7kxgn6yq-uc.a.run.app/dispatch/embedded" },
  @{ Service = "mfe-ticketing"; Url = "https://mfe-ticketing-io7kxgn6yq-uc.a.run.app/ticketing/embedded" },
  @{ Service = "mfe-reporting"; Url = "https://mfe-reporting-io7kxgn6yq-uc.a.run.app/reporting/embedded" },
  @{ Service = "mfe-admin"; Url = "https://mfe-admin-io7kxgn6yq-uc.a.run.app/admin/embedded" }
)

$EmbeddedChecks | ForEach-Object {
  $Status = curl.exe --ssl-no-revoke -s -o NUL -w "%{http_code}" $_.Url
  [pscustomobject]@{ Service = $_.Service; Status = $Status; Url = $_.Url }
} | Format-Table -AutoSize
```

Resultado esperado:

```text
HTTP 200 en las cinco rutas embedded.
```

### Paso 13 - Validar que no quedaron placeholders

```powershell
$FrontendServices | ForEach-Object {
  $Json = & $GcloudPath run services describe $_ `
    --project $ProjectId `
    --region $Region `
    --format json | ConvertFrom-Json

  $EnvText = (($Json.spec.template.spec.containers[0].env | ForEach-Object { "$($_.name)=$($_.value)" }) -join "`n")
  [pscustomobject]@{ Service = $_; ContainsUnresolved = $EnvText.Contains("UNRESOLVED_") }
} | Format-Table -AutoSize
```

Resultado esperado:

```text
ContainsUnresolved=False en los seis servicios.
```

## Nota para el siguiente dia

La capa frontend ya esta desplegada en Cloud Run dev. El siguiente paso natural es hacer una validacion funcional end-to-end desde el shell publico:

```text
Abrir frontend-shell publico.
Verificar carga visual de MFEs remotos.
Probar identidad, despachos, boletos, reporting y admin contra backends Cloud Run.
Documentar errores de integracion de APIs privadas/autenticadas si aparecen.
```
