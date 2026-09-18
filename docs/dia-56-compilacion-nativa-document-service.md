# Dia 56 - Compilacion nativa document-service

Fecha de ejecucion: 2026-09-18

## Objetivo

Preparar `document-service` para generar imagen Docker nativa y publicarla en Artifact Registry, siguiendo el mismo patron usado por `identity-service`, `dispatch-service` y `ticketing-service`.

Alcance del dia:

```text
Crear Dockerfile nativo para document-service.
Crear script PowerShell de build/tag/push para document-service.
Agregar modo PlanOnly para validar rutas sin compilar.
Corregir la variable del bucket documental en Cloud Run dev.
Documentar reversa y guia manual desde cero.
```

## Resultado logrado

```text
Se creo services\document-service\src\main\docker\Dockerfile.native.
Se creo scripts\build-document-service-native.ps1.
El script genera la imagen local document-service:0.1.0-native.
El script etiqueta la imagen remota us-central1-docker.pkg.dev/project-fbb34cd7-0b82-43e1-867/venta-pasajes-dev/document-service:0.1.0-native.
El script permite publicar con -Push.
Se corrigio infra\cloudrun\dev-services.json para usar APP_DOCUMENT_BUCKET.
Se valido el modo -PlanOnly.
Se ejecutaron pruebas Maven de document-service.
```

## Archivos creados

```text
C:\VENTA-DE-PASAJES\services\document-service\src\main\docker\Dockerfile.native
C:\VENTA-DE-PASAJES\scripts\build-document-service-native.ps1
C:\VENTA-DE-PASAJES\docs\dia-56-compilacion-nativa-document-service.md
```

## Archivos modificados

```text
C:\VENTA-DE-PASAJES\infra\cloudrun\dev-services.json
C:\VENTA-DE-PASAJES\services\document-service\README.md
C:\VENTA-DE-PASAJES\README.md
C:\VENTA-DE-PASAJES\infra\README.md
C:\VENTA-DE-PASAJES\vitacora.md
```

## Reversa primero

Esta reversa elimina lo preparado en el Dia 56. La reversa cloud solo aplica si se publico la imagen con `-Push`.

### Paso 1 - Ubicarse en el proyecto

```powershell
$ProjectRoot = "C:\VENTA-DE-PASAJES"
Set-Location $ProjectRoot
```

### Paso 2 - Eliminar archivos locales del Dia 56

```powershell
Remove-Item -LiteralPath "$ProjectRoot\services\document-service\src\main\docker\Dockerfile.native" -Force
Remove-Item -LiteralPath "$ProjectRoot\scripts\build-document-service-native.ps1" -Force
Remove-Item -LiteralPath "$ProjectRoot\docs\dia-56-compilacion-nativa-document-service.md" -Force
```

### Paso 3 - Revertir documentacion y descriptor

En:

```text
C:\VENTA-DE-PASAJES\README.md
C:\VENTA-DE-PASAJES\infra\README.md
C:\VENTA-DE-PASAJES\vitacora.md
C:\VENTA-DE-PASAJES\services\document-service\README.md
C:\VENTA-DE-PASAJES\infra\cloudrun\dev-services.json
```

Retirar las referencias al Dia 56 y, si se desea volver al estado anterior, cambiar `APP_DOCUMENT_BUCKET` por el nombre anterior usado antes de esta correccion.

### Paso 4 - Eliminar imagenes Docker locales si se compilaron

```powershell
docker image rm document-service:0.1.0-native -f
docker image rm us-central1-docker.pkg.dev/project-fbb34cd7-0b82-43e1-867/venta-pasajes-dev/document-service:0.1.0-native -f
```

Si Docker no esta activo, este paso puede omitirse.

### Paso 5 - Reversa cloud si se publico la imagen

Advertencia: este paso elimina una imagen real de Artifact Registry.

```powershell
$env:CLOUDSDK_PYTHON = "C:\Python312\python.exe"
$GcloudPath = "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd"

& $GcloudPath artifacts docker images delete `
  "us-central1-docker.pkg.dev/project-fbb34cd7-0b82-43e1-867/venta-pasajes-dev/document-service:0.1.0-native" `
  --project "project-fbb34cd7-0b82-43e1-867" `
  --quiet
```

Si esa imagen comparte digest con otros tags, usar `--delete-tags` solo cuando se quiera borrar tambien esos tags.

### Paso 6 - Validar reversa local

```powershell
Test-Path -LiteralPath "$ProjectRoot\services\document-service\src\main\docker\Dockerfile.native"
Test-Path -LiteralPath "$ProjectRoot\scripts\build-document-service-native.ps1"
Test-Path -LiteralPath "$ProjectRoot\docs\dia-56-compilacion-nativa-document-service.md"
```

Resultado esperado:

```text
False
False
False
```

## Guia manual desde cero

> Importante: ejecutar desde PowerShell en `C:\VENTA-DE-PASAJES`.

### Paso 1 - Ubicarse en el proyecto

```powershell
$ProjectRoot = "C:\VENTA-DE-PASAJES"
Set-Location $ProjectRoot
```

### Paso 2 - Verificar archivos creados

```powershell
Test-Path -LiteralPath "$ProjectRoot\services\document-service\src\main\docker\Dockerfile.native"
Test-Path -LiteralPath "$ProjectRoot\scripts\build-document-service-native.ps1"
```

Resultado esperado:

```text
True
True
```

### Paso 3 - Validar descriptor Cloud Run

```powershell
Get-Content -LiteralPath "$ProjectRoot\infra\cloudrun\dev-services.json" -Raw | ConvertFrom-Json | Out-Null

$DocumentService = (Get-Content -LiteralPath "$ProjectRoot\infra\cloudrun\dev-services.json" -Raw | ConvertFrom-Json).services |
  Where-Object id -eq "document-service"

$DocumentService.env.APP_DOCUMENT_BUCKET
```

Resultado esperado:

```text
venta-pasajes-dev-documents
```

### Paso 4 - Ejecutar pruebas JVM del servicio

```powershell
mvn -f .\services\document-service\pom.xml test
```

Resultado esperado:

```text
BUILD SUCCESS
Tests run: 5, Failures: 0, Errors: 0, Skipped: 0
```

### Paso 5 - Validar plan de build nativo sin compilar

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-document-service-native.ps1 -PlanOnly
```

Resultado esperado:

```text
"service":"document-service"
"mode":"plan"
"local_image":"document-service:0.1.0-native"
"artifact_image":"us-central1-docker.pkg.dev/project-fbb34cd7-0b82-43e1-867/venta-pasajes-dev/document-service:0.1.0-native"
"ready":true
```

### Paso 6 - Verificar Docker antes de compilar nativo

```powershell
docker info
```

Si responde `dockerDesktopLinuxEngine` o `The system cannot find the file specified`, abrir Docker Desktop y repetir este paso.

### Paso 7 - Compilar nativo y crear imagen local

Este paso puede tardar varios minutos.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-document-service-native.ps1 -UseCleanWorkspace
```

Resultado esperado:

```text
"service":"document-service"
"local_image":"document-service:0.1.0-native"
"artifact_image":"us-central1-docker.pkg.dev/project-fbb34cd7-0b82-43e1-867/venta-pasajes-dev/document-service:0.1.0-native"
"ready":true
```

### Paso 8 - Publicar imagen en Artifact Registry

Ejecutar solo despues de que el Paso 7 haya creado la imagen local.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-document-service-native.ps1 `
  -SkipNativeBuild `
  -SkipDockerBuild `
  -Push
```

### Paso 9 - Verificar imagen publicada

```powershell
$env:CLOUDSDK_PYTHON = "C:\Python312\python.exe"
$GcloudPath = "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd"

& $GcloudPath artifacts docker images describe `
  "us-central1-docker.pkg.dev/project-fbb34cd7-0b82-43e1-867/venta-pasajes-dev/document-service:0.1.0-native" `
  --project "project-fbb34cd7-0b82-43e1-867" `
  --format "value(image_summary.digest)"
```

Resultado esperado:

```text
sha256:<digest>
```

### Paso 10 - Crear tag dev para document-service

Ejecutar despues de publicar `0.1.0-native`.

```powershell
$env:CLOUDSDK_PYTHON = "C:\Python312\python.exe"
$GcloudPath = "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd"

& $GcloudPath artifacts docker tags add `
  "us-central1-docker.pkg.dev/project-fbb34cd7-0b82-43e1-867/venta-pasajes-dev/document-service:0.1.0-native" `
  "us-central1-docker.pkg.dev/project-fbb34cd7-0b82-43e1-867/venta-pasajes-dev/document-service:dev" `
  --project "project-fbb34cd7-0b82-43e1-867" `
  --quiet
```

### Paso 11 - Validar preflight Cloud Run para document-service

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\deploy-cloudrun-dev.ps1 `
  -ImageTag dev `
  -ServiceIds document-service `
  -CheckImagesOnly
```

Resultado esperado despues de publicar y crear el tag:

```text
document-service   True
```

## Comandos de validacion ejecutados

```powershell
Get-Content -LiteralPath .\infra\cloudrun\dev-services.json -Raw | ConvertFrom-Json | Out-Null
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-document-service-native.ps1 -PlanOnly
mvn -f .\services\document-service\pom.xml test
Test-Path -LiteralPath .\services\document-service\src\main\docker\Dockerfile.native
Test-Path -LiteralPath .\scripts\build-document-service-native.ps1
```

Resultados observados:

```text
dev-services.json OK.
PlanOnly devolvio ready=true.
Dockerfile.native existe.
build-document-service-native.ps1 existe.
Maven test: BUILD SUCCESS.
Tests run: 5, Failures: 0, Errors: 0, Skipped: 0.
```

## Troubleshooting

### Docker no esta activo

```powershell
docker info
```

Si falla, abrir Docker Desktop y esperar a que Docker Engine este listo.

### Native runner no encontrado

Si aparece:

```text
Native runner was not found under ...\target. Run the native build first.
```

significa que se intento construir o publicar la imagen sin ejecutar antes la compilacion nativa. Ejecutar:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-document-service-native.ps1 -UseCleanWorkspace
```

### Imagen no aparece en Artifact Registry

Verificar que se haya usado `-Push` y que la cuenta activa tenga permisos:

```powershell
$env:CLOUDSDK_PYTHON = "C:\Python312\python.exe"
$GcloudPath = "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd"

& $GcloudPath auth list
& $GcloudPath config get-value project
```

## Estado final y siguiente paso natural

```text
document-service ya tiene ruta reproducible para compilar imagen nativa.
La imagen no fue compilada ni publicada durante esta validacion ligera.
El siguiente paso natural es ejecutar la compilacion nativa real, publicar document-service y despues avanzar con reporting-service o audit-service.
```
