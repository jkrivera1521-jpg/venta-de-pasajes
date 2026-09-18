# Dia 55 - Promocion de tags en Artifact Registry

Fecha de ejecucion: 2026-09-18

## Objetivo

Corregir el bloqueo detectado en el Dia 54: Cloud Run intentaba desplegar imagenes con tag `dev`, pero Artifact Registry solo tenia imagenes backend publicadas con tag `0.1.0-native`.

Alcance del dia:

```text
Crear un script para promover tags existentes en Artifact Registry.
Usar modo plan por defecto, sin modificar Google Cloud.
Permitir ejecucion real solo con -Execute.
Promover de 0.1.0-native a dev para los backends que ya tienen imagen publicada.
Documentar reversa y guia manual desde cero.
```

## Resultado logrado

```text
Se creo scripts\promote-artifact-image-tags.ps1.
El script valida imagenes origen en Artifact Registry.
El script genera logs\artifact-registry\promote-artifact-image-tags.commands.ps1.
El script genera logs\artifact-registry\promote-artifact-image-tags.plan.json.
Se probo en modo plan, sin -Execute.
Se confirmo que existen imagenes origen 0.1.0-native para identity-service, dispatch-service y ticketing-service.
Se confirmo que los tags dev aun no existen para esos tres servicios.
```

## Archivos creados

```text
C:\VENTA-DE-PASAJES\scripts\promote-artifact-image-tags.ps1
C:\VENTA-DE-PASAJES\docs\dia-55-promocion-tags-artifact-registry.md
```

## Archivos modificados

```text
C:\VENTA-DE-PASAJES\README.md
C:\VENTA-DE-PASAJES\infra\README.md
C:\VENTA-DE-PASAJES\vitacora.md
```

## Reversa primero

Esta reversa tiene dos partes: reversa local y reversa cloud. La reversa cloud solo aplica si se ejecuto el script con `-Execute`.

### Paso 1 - Ubicarse en el proyecto

```powershell
$ProjectRoot = "C:\VENTA-DE-PASAJES"
Set-Location $ProjectRoot
```

### Paso 2 - Reversa local

Eliminar script, logs locales y documento del Dia 55:

```powershell
Remove-Item -LiteralPath "$ProjectRoot\scripts\promote-artifact-image-tags.ps1" -Force
Remove-Item -LiteralPath "$ProjectRoot\logs\artifact-registry" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath "$ProjectRoot\docs\dia-55-promocion-tags-artifact-registry.md" -Force
```

Validar:

```powershell
Test-Path -LiteralPath "$ProjectRoot\scripts\promote-artifact-image-tags.ps1"
Test-Path -LiteralPath "$ProjectRoot\logs\artifact-registry"
Test-Path -LiteralPath "$ProjectRoot\docs\dia-55-promocion-tags-artifact-registry.md"
```

Resultado esperado:

```text
False
False
False
```

### Paso 3 - Retirar referencias documentales

En:

```text
C:\VENTA-DE-PASAJES\README.md
C:\VENTA-DE-PASAJES\infra\README.md
C:\VENTA-DE-PASAJES\vitacora.md
```

Retirar las referencias al Dia 55 y a `promote-artifact-image-tags.ps1`.

### Paso 4 - Reversa cloud si se crearon tags dev

Advertencia: este paso elimina tags reales en Artifact Registry. No elimina el digest de la imagen; solo retira el alias `dev`.

```powershell
$ProjectId = "project-fbb34cd7-0b82-43e1-867"
$Region = "us-central1"
$Repository = "venta-pasajes-dev"
$TargetTag = "dev"
$Services = @(
  "identity-service",
  "dispatch-service",
  "ticketing-service"
)

$env:CLOUDSDK_PYTHON = "C:\Python312\python.exe"
$GcloudPath = "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd"

foreach ($Service in $Services) {
  $Image = "$Region-docker.pkg.dev/$ProjectId/$Repository/${Service}:$TargetTag"

  & $GcloudPath artifacts docker images describe $Image `
    --project $ProjectId `
    --format json *> $null

  if ($LASTEXITCODE -eq 0) {
    & $GcloudPath artifacts docker tags delete $Image `
      --project $ProjectId `
      --quiet
  }
}
```

### Paso 5 - Validar reversa cloud

```powershell
$ProjectId = "project-fbb34cd7-0b82-43e1-867"
$Region = "us-central1"
$Repository = "venta-pasajes-dev"
$TargetTag = "dev"
$Services = @(
  "identity-service",
  "dispatch-service",
  "ticketing-service"
)

$env:CLOUDSDK_PYTHON = "C:\Python312\python.exe"
$GcloudPath = "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd"

foreach ($Service in $Services) {
  $Image = "$Region-docker.pkg.dev/$ProjectId/$Repository/${Service}:$TargetTag"

  & $GcloudPath artifacts docker images describe $Image `
    --project $ProjectId `
    --format "value(image_summary.digest)"

  [pscustomobject]@{
    Service = $Service
    DevTagExists = ($LASTEXITCODE -eq 0)
  }
}
```

Resultado esperado despues de borrar los tags:

```text
DevTagExists = False
```

## Guia manual desde cero

> Importante: ejecutar desde PowerShell. Si la consola esta en `C:\Windows\system32`, primero ejecutar el Paso 1.

### Paso 1 - Ubicarse en el proyecto

```powershell
$ProjectRoot = "C:\VENTA-DE-PASAJES"
Set-Location $ProjectRoot
```

### Paso 2 - Verificar archivos y gcloud

```powershell
Test-Path -LiteralPath "$ProjectRoot\scripts\promote-artifact-image-tags.ps1"
Test-Path -LiteralPath "$ProjectRoot\scripts\deploy-cloudrun-dev.ps1"

$env:CLOUDSDK_PYTHON = "C:\Python312\python.exe"
$GcloudPath = "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd"
& $GcloudPath version
```

Resultado esperado de los `Test-Path`:

```text
True
True
```

### Paso 3 - Revisar tags publicados actualmente

```powershell
$env:CLOUDSDK_PYTHON = "C:\Python312\python.exe"
$GcloudPath = "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd"

& $GcloudPath artifacts docker images list `
  "us-central1-docker.pkg.dev/project-fbb34cd7-0b82-43e1-867/venta-pasajes-dev" `
  --project "project-fbb34cd7-0b82-43e1-867" `
  --include-tags
```

Estado verificado antes de ejecutar promocion:

```text
dispatch-service   0.1.0-native
identity-service   0.1.0-native
ticketing-service  0.1.0-native
```

### Paso 4 - Generar plan sin modificar Google Cloud

Este comando solo valida y genera archivos locales en `logs\artifact-registry`.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\promote-artifact-image-tags.ps1 `
  -SourceTag 0.1.0-native `
  -TargetTag dev
```

Resultado esperado:

```text
Artifact Registry tag promotion plan generated.
Commands: C:\VENTA-DE-PASAJES\logs\artifact-registry\promote-artifact-image-tags.commands.ps1
Plan: C:\VENTA-DE-PASAJES\logs\artifact-registry\promote-artifact-image-tags.plan.json
```

Tabla esperada:

```text
identity-service    source_exists True    target_exists_before False    action planned
dispatch-service    source_exists True    target_exists_before False    action planned
ticketing-service   source_exists True    target_exists_before False    action planned
```

### Paso 5 - Revisar el plan generado

```powershell
Get-Content -LiteralPath "$ProjectRoot\logs\artifact-registry\promote-artifact-image-tags.plan.json" -Raw | ConvertFrom-Json
Get-Content -LiteralPath "$ProjectRoot\logs\artifact-registry\promote-artifact-image-tags.commands.ps1" -Raw
```

Confirmar que los comandos generados apunten de:

```text
:0.1.0-native
```

hacia:

```text
:dev
```

### Paso 6 - Ejecutar promocion real de tags

Advertencia: este paso si modifica Artifact Registry. Crea o actualiza el tag `dev` para las tres imagenes.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\promote-artifact-image-tags.ps1 `
  -SourceTag 0.1.0-native `
  -TargetTag dev `
  -Execute
```

Resultado esperado:

```text
identity-service    source_exists True    target_exists_after True    action tagged
dispatch-service    source_exists True    target_exists_after True    action tagged
ticketing-service   source_exists True    target_exists_after True    action tagged
```

### Paso 7 - Validar que Cloud Run ya puede encontrar esos tags

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\deploy-cloudrun-dev.ps1 `
  -ImageTag dev `
  -ServiceIds identity-service,dispatch-service,ticketing-service `
  -CheckImagesOnly
```

Resultado esperado despues de ejecutar el Paso 6:

```text
service_id        exists
----------        ------
identity-service    True
dispatch-service    True
ticketing-service   True
```

### Paso 8 - Desplegar solo los tres backends publicados

Advertencia: este paso si modifica Cloud Run. Ejecutarlo solo despues de validar el Paso 7.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\deploy-cloudrun-dev.ps1 `
  -ImageTag dev `
  -ServiceIds identity-service,dispatch-service,ticketing-service `
  -Execute
```

## Comandos de validacion ejecutados

```powershell
$env:CLOUDSDK_PYTHON = "C:\Python312\python.exe"
& "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd" artifacts docker tags add --help
& "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd" artifacts docker tags delete --help
& "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd" artifacts docker images describe "us-central1-docker.pkg.dev/project-fbb34cd7-0b82-43e1-867/venta-pasajes-dev/identity-service:0.1.0-native" --project "project-fbb34cd7-0b82-43e1-867" --format=json
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\promote-artifact-image-tags.ps1
```

Resultados observados:

```text
gcloud artifacts docker tags add existe.
gcloud artifacts docker tags delete existe.
identity-service:0.1.0-native existe.
dispatch-service:0.1.0-native existe.
ticketing-service:0.1.0-native existe.
identity-service:dev no existe aun.
dispatch-service:dev no existe aun.
ticketing-service:dev no existe aun.
El script genero plan y comandos sin usar -Execute.
```

## Troubleshooting

### El script dice que falta una imagen origen

Significa que no existe la combinacion `servicio:0.1.0-native` en Artifact Registry. Revisar tags publicados:

```powershell
$env:CLOUDSDK_PYTHON = "C:\Python312\python.exe"
$GcloudPath = "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd"

& $GcloudPath artifacts docker images list `
  "us-central1-docker.pkg.dev/project-fbb34cd7-0b82-43e1-867/venta-pasajes-dev" `
  --project "project-fbb34cd7-0b82-43e1-867" `
  --include-tags
```

### El script funciona en plan pero no en Execute

Confirmar que la cuenta activa tenga permisos para administrar tags de Artifact Registry:

```powershell
$env:CLOUDSDK_PYTHON = "C:\Python312\python.exe"
$GcloudPath = "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd"

& $GcloudPath auth list
& $GcloudPath config get-value project
```

### El despliegue completo de 12 servicios sigue fallando

Esto es esperado por ahora. El Dia 55 solo resuelve tags `dev` para tres backends publicados:

```text
identity-service
dispatch-service
ticketing-service
```

Todavia faltan imagenes para:

```text
document-service
reporting-service
audit-service
mfe-identity
mfe-dispatch
mfe-ticketing
mfe-reporting
mfe-admin
frontend-shell
```

## Estado final y siguiente paso natural

```text
El proyecto ya puede planificar la promocion de tags desde 0.1.0-native hacia dev.
No se ejecuto la promocion real porque requiere modificar Artifact Registry.
El siguiente paso natural es crear imagenes faltantes para document-service, reporting-service, audit-service y los frontends.
```
