# Dia 64 - Runtime config del shell en Cloud Run

Fecha de ejecucion: 2026-09-21

## Objetivo

Corregir el `frontend-shell` publico para que no use URLs `localhost` embebidas en el JavaScript del navegador.

Alcance del dia:

```text
Detectar si el shell publico contiene URLs localhost en sus bundles.
Agregar endpoint runtime para resolver manifiestos MFE desde variables de entorno de Cloud Run.
Consumir ese endpoint desde el shell con TanStack Query.
Evitar que RemoteMfeFrame consulte manifiestos antes de tener una URL real.
Construir, validar localmente, publicar y desplegar solo frontend-shell.
Validar la URL publica con runtime config y bundles sin localhost.
Documentar reversa y guia manual desde cero.
```

## Problema encontrado

Aunque Cloud Run tenia variables de entorno correctas para los MFEs, el `frontend-shell` usaba valores `NEXT_PUBLIC_MFE_*` directamente dentro del componente cliente.

En Next.js, esos valores publicos quedan embebidos durante el build. Como la imagen anterior fue construida antes de tener URLs publicas reales, el navegador recibia referencias como:

```text
http://localhost:3003/mfe/manifest
```

Eso falla en Cloud Run porque el navegador del usuario intenta buscar `localhost` en su propia maquina, no dentro de Google Cloud.

## Resultado logrado

```text
Se agrego /api/shell/runtime-config en frontend-shell.
El endpoint lee las URLs MFE desde variables de entorno en tiempo de ejecucion.
El shell consulta /api/shell/runtime-config antes de cargar MFEs remotos.
RemoteMfeFrame ya no consulta manifiestos vacios.
Se construyo frontend-shell:0.1.1-frontend.
Se publico frontend-shell:0.1.1-frontend en Artifact Registry.
Se promovio frontend-shell:0.1.1-frontend a frontend-shell:dev.
Se desplego solo frontend-shell en Cloud Run dev.
La URL publica responde HTTP 200.
El runtime config publico devuelve las cinco URLs MFE reales.
Los cinco /mfe/manifest responden HTTP 200.
Los bundles publicos del shell tienen 0 coincidencias de localhost.
```

URL validada:

```text
frontend-shell https://frontend-shell-io7kxgn6yq-uc.a.run.app
```

Revision lista:

```text
frontend-shell frontend-shell-00003-rbv
```

Digest validado para tags `0.1.1-frontend` y `dev`:

```text
frontend-shell sha256:7095b7a74f02dba6d927c713590895265439d1a969dd4b4e5226b8e0858f7a79
```

## Archivos creados

```text
C:\VENTA-DE-PASAJES\apps\frontend-shell\app\api\shell\runtime-config\route.ts
C:\VENTA-DE-PASAJES\docs\dia-64-runtime-config-shell-cloud-run.md
```

## Archivos modificados

```text
C:\VENTA-DE-PASAJES\apps\frontend-shell\app\page.tsx
C:\VENTA-DE-PASAJES\apps\frontend-shell\app\components\RemoteMfeFrame.tsx
C:\VENTA-DE-PASAJES\README.md
C:\VENTA-DE-PASAJES\infra\README.md
C:\VENTA-DE-PASAJES\vitacora.md
```

## Ajustes tecnicos realizados

### Endpoint runtime del shell

Se creo:

```text
C:\VENTA-DE-PASAJES\apps\frontend-shell\app\api\shell\runtime-config\route.ts
```

El endpoint devuelve:

```text
generated_at
manifests.admin
manifests.dispatch
manifests.identity
manifests.reporting
manifests.ticketing
service
```

### Carga runtime con TanStack Query

El shell ahora consulta:

```text
/api/shell/runtime-config
```

Y usa esas URLs para construir la lista de modulos remotos. Asi las URLs pueden cambiar en Cloud Run sin reconstruir el bundle cliente por cada cambio de entorno.

### Proteccion en RemoteMfeFrame

`RemoteMfeFrame` quedo con `enabled: Boolean(manifestUrl)`, por lo que no intenta descargar un manifiesto hasta que exista una URL real.

## Reversa primero

Esta reversa vuelve el `frontend-shell` desplegado a la imagen anterior `0.1.0-frontend`. No elimina los demas MFEs ni backends.

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

### Paso 3 - Confirmar que existe la imagen anterior

```powershell
$ProjectId = "project-fbb34cd7-0b82-43e1-867"
$Region = "us-central1"
$Repository = "venta-pasajes-dev"
$Image = "$Region-docker.pkg.dev/$ProjectId/$Repository/frontend-shell`:0.1.0-frontend"

& $GcloudPath artifacts docker images describe $Image `
  --project $ProjectId `
  --format "value(image_summary.fully_qualified_digest)"
```

Debe devolver un digest.

### Paso 4 - Promover la imagen anterior a dev

Primero generar plan:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\promote-artifact-image-tags.ps1 `
  -ServiceIds frontend-shell `
  -SourceTag 0.1.0-frontend `
  -TargetTag dev
```

Luego ejecutar:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\promote-artifact-image-tags.ps1 `
  -ServiceIds frontend-shell `
  -SourceTag 0.1.0-frontend `
  -TargetTag dev `
  -Execute
```

### Paso 5 - Redesplegar solo frontend-shell

Validar imagen:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\deploy-cloudrun-dev.ps1 `
  -ImageTag dev `
  -ServiceIds frontend-shell `
  -ResolveExistingServiceUrls `
  -CheckImagesOnly
```

Ejecutar despliegue:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\deploy-cloudrun-dev.ps1 `
  -ImageTag dev `
  -ServiceIds frontend-shell `
  -ResolveExistingServiceUrls `
  -Execute
```

### Paso 6 - Validar reversa

```powershell
$ShellUrl = "https://frontend-shell-io7kxgn6yq-uc.a.run.app"
curl.exe --ssl-no-revoke -s -o NUL -w "%{http_code}" "$ShellUrl/api/health"
```

Resultado esperado:

```text
200
```

### Paso 7 - Reversa local del codigo

Si esta practica ya fue confirmada en Git, revertir el commit correspondiente:

```powershell
git log --oneline -- docs/dia-64-runtime-config-shell-cloud-run.md
git revert <commit-del-dia-64>
```

Si todavia no fue confirmada en Git, revisar primero los cambios:

```powershell
git status --short
```

Y retirar solo los archivos del Dia 64.

## Guia manual desde cero

> Importante: ejecutar desde PowerShell en `C:\VENTA-DE-PASAJES`.

### Paso 1 - Ubicarse en el proyecto

```powershell
$ProjectRoot = "C:\VENTA-DE-PASAJES"
Set-Location $ProjectRoot
```

### Paso 2 - Confirmar estado local

```powershell
git status --short
```

### Paso 3 - Validar typecheck del shell

```powershell
npm run typecheck -w @venta-pasajes/frontend-shell
```

Resultado esperado:

```text
Sin errores TypeScript.
```

### Paso 4 - Validar build Next.js del shell

```powershell
npm run build -w @venta-pasajes/frontend-shell
```

Resultado esperado:

```text
/api/health
/api/shell/runtime-config
Build completado sin error.
```

### Paso 5 - Construir imagen local del shell

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-frontend-images.ps1 `
  -Apps frontend-shell `
  -ImageTag 0.1.1-frontend `
  -SkipSharedTypesBuild
```

### Paso 6 - Validar imagen local con URLs Cloud Run

```powershell
$ContainerName = "venta-pasajes-frontend-shell-runtime-test"
$Port = 13000
$Existing = docker ps -a --filter "name=$ContainerName" --format "{{.Names}}"
if ($Existing -contains $ContainerName) { docker rm -f $ContainerName | Out-Null }

docker run -d --name $ContainerName -p ${Port}:3000 `
  -e NEXT_PUBLIC_MFE_IDENTITY_MANIFEST_URL="https://mfe-identity-io7kxgn6yq-uc.a.run.app/mfe/manifest" `
  -e NEXT_PUBLIC_MFE_DISPATCH_MANIFEST_URL="https://mfe-dispatch-io7kxgn6yq-uc.a.run.app/mfe/manifest" `
  -e NEXT_PUBLIC_MFE_TICKETING_MANIFEST_URL="https://mfe-ticketing-io7kxgn6yq-uc.a.run.app/mfe/manifest" `
  -e NEXT_PUBLIC_MFE_REPORTING_MANIFEST_URL="https://mfe-reporting-io7kxgn6yq-uc.a.run.app/mfe/manifest" `
  -e NEXT_PUBLIC_MFE_ADMIN_MANIFEST_URL="https://mfe-admin-io7kxgn6yq-uc.a.run.app/mfe/manifest" `
  frontend-shell:0.1.1-frontend

try {
  Start-Sleep -Seconds 5
  curl.exe -s -o NUL -w "%{http_code}" "http://localhost:$Port/api/health"
  curl.exe -s "http://localhost:$Port/api/shell/runtime-config"
}
finally {
  docker rm -f $ContainerName | Out-Null
}
```

Resultado esperado:

```text
/api/health devuelve 200.
/api/shell/runtime-config devuelve las cinco URLs Cloud Run.
```

### Paso 7 - Publicar imagen en Artifact Registry

```powershell
$env:CLOUDSDK_PYTHON = "C:\Python312\python.exe"

powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-frontend-images.ps1 `
  -Apps frontend-shell `
  -ImageTag 0.1.1-frontend `
  -SkipNextBuild `
  -SkipDockerBuild `
  -Push
```

### Paso 8 - Confirmar digest remoto

```powershell
$GcloudPath = "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd"
$ProjectId = "project-fbb34cd7-0b82-43e1-867"
$Image = "us-central1-docker.pkg.dev/$ProjectId/venta-pasajes-dev/frontend-shell`:0.1.1-frontend"

& $GcloudPath artifacts docker images describe $Image `
  --project $ProjectId `
  --format "value(image_summary.fully_qualified_digest)"
```

Resultado observado:

```text
us-central1-docker.pkg.dev/project-fbb34cd7-0b82-43e1-867/venta-pasajes-dev/frontend-shell@sha256:7095b7a74f02dba6d927c713590895265439d1a969dd4b4e5226b8e0858f7a79
```

### Paso 9 - Promover frontend-shell a dev

Primero generar plan:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\promote-artifact-image-tags.ps1 `
  -ServiceIds frontend-shell `
  -SourceTag 0.1.1-frontend `
  -TargetTag dev
```

Luego ejecutar:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\promote-artifact-image-tags.ps1 `
  -ServiceIds frontend-shell `
  -SourceTag 0.1.1-frontend `
  -TargetTag dev `
  -Execute
```

### Paso 10 - Validar imagen dev antes del despliegue

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\deploy-cloudrun-dev.ps1 `
  -ImageTag dev `
  -ServiceIds frontend-shell `
  -ResolveExistingServiceUrls `
  -CheckImagesOnly
```

Resultado esperado:

```text
frontend-shell exists=True
```

### Paso 11 - Desplegar solo frontend-shell

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\deploy-cloudrun-dev.ps1 `
  -ImageTag dev `
  -ServiceIds frontend-shell `
  -ResolveExistingServiceUrls `
  -Execute
```

### Paso 12 - Validar runtime config publico

```powershell
$ShellUrl = "https://frontend-shell-io7kxgn6yq-uc.a.run.app"

curl.exe --ssl-no-revoke -s -o NUL -w "%{http_code}" "$ShellUrl/"
curl.exe --ssl-no-revoke -s -o NUL -w "%{http_code}" "$ShellUrl/api/shell/runtime-config"
curl.exe --ssl-no-revoke -s "$ShellUrl/api/shell/runtime-config"
```

Resultado esperado:

```text
HTTP 200 en home.
HTTP 200 en /api/shell/runtime-config.
Las cinco URLs de manifests apuntan a *.a.run.app.
```

### Paso 13 - Validar manifests remotos desde el runtime config

```powershell
$Config = curl.exe --ssl-no-revoke -s "$ShellUrl/api/shell/runtime-config" | ConvertFrom-Json

$Config.manifests.PSObject.Properties | ForEach-Object {
  $Name = $_.Name
  $Url = $_.Value
  $Status = curl.exe --ssl-no-revoke -s -o NUL -w "%{http_code}" $Url
  [pscustomobject]@{ mfe = $Name; status = $Status; url = $Url }
} | Sort-Object mfe | Format-Table -AutoSize
```

Resultado observado:

```text
admin     200
dispatch  200
identity  200
reporting 200
ticketing 200
```

### Paso 14 - Validar que los bundles publicos no contienen localhost

```powershell
$Html = curl.exe --ssl-no-revoke -s "$ShellUrl/"
$Scripts = [regex]::Matches($Html, 'src="([^"]+\.js[^"]*)"') |
  ForEach-Object { $_.Groups[1].Value } |
  Sort-Object -Unique

$Results = foreach ($Script in $Scripts) {
  $ScriptUrl = if ($Script.StartsWith("http")) { $Script } else { "$ShellUrl$Script" }
  $Body = curl.exe --ssl-no-revoke -s $ScriptUrl
  [pscustomobject]@{
    Script = $Script
    ContainsLocalhost = $Body.Contains("localhost:")
    ContainsRuntimeConfig = $Body.Contains("/api/shell/runtime-config")
  }
}

$Results | Format-Table -AutoSize
"TOTAL_SCRIPTS=$($Scripts.Count)"
"LOCALHOST_MATCHES=$(@($Results | Where-Object { $_.ContainsLocalhost }).Count)"
"RUNTIME_CONFIG_MATCHES=$(@($Results | Where-Object { $_.ContainsRuntimeConfig }).Count)"
```

Resultado observado:

```text
TOTAL_SCRIPTS=8
LOCALHOST_MATCHES=0
RUNTIME_CONFIG_MATCHES=1
```

## Comandos de validacion ejecutados

```powershell
npm run typecheck -w @venta-pasajes/frontend-shell
npm run build -w @venta-pasajes/frontend-shell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-frontend-images.ps1 -Apps frontend-shell -ImageTag 0.1.1-frontend -SkipSharedTypesBuild
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-frontend-images.ps1 -Apps frontend-shell -ImageTag 0.1.1-frontend -SkipNextBuild -SkipDockerBuild -Push
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\promote-artifact-image-tags.ps1 -ServiceIds frontend-shell -SourceTag 0.1.1-frontend -TargetTag dev
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\promote-artifact-image-tags.ps1 -ServiceIds frontend-shell -SourceTag 0.1.1-frontend -TargetTag dev -Execute
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\deploy-cloudrun-dev.ps1 -ImageTag dev -ServiceIds frontend-shell -ResolveExistingServiceUrls -CheckImagesOnly
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\deploy-cloudrun-dev.ps1 -ImageTag dev -ServiceIds frontend-shell -ResolveExistingServiceUrls -Execute
```

## Nota para el siguiente dia

El shell publico ya no depende de URLs `localhost` embebidas en el bundle. El siguiente paso natural es validar una navegacion end-to-end desde el shell publico:

```text
Abrir frontend-shell publico.
Confirmar carga visual de los cinco MFEs.
Validar cuales llamadas de API backend fallan por autenticacion o CORS.
Documentar ajustes de seguridad/API gateway necesarios para produccion.
```
