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
Corregir compatibilidad native-image de PDFBox y Google Cloud Storage.
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
Se corrigio services\document-service\pom.xml para native-image:
  - PDFBox y Google Cloud Storage ya no arrastran commons-logging clasico.
  - Se agrego commons-logging-jboss-logging.
  - Se agregaron dependencias opcionales de BouncyCastle usadas por PDFBox.
  - Se agregaron log4j-api y log4j-over-slf4j solo como APIs/puentes requeridos por gRPC shaded Netty durante native-image.
Se agrego quarkus.native.additional-build-args para inicializar PublicKeySecurityHandler en runtime.
Se valido el modo -PlanOnly.
Se ejecutaron pruebas Maven de document-service.
Se compilo la imagen local document-service:0.1.0-native.
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
C:\VENTA-DE-PASAJES\services\document-service\pom.xml
C:\VENTA-DE-PASAJES\services\document-service\src\main\resources\application.properties
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
C:\VENTA-DE-PASAJES\services\document-service\pom.xml
C:\VENTA-DE-PASAJES\services\document-service\src\main\resources\application.properties
```

Retirar las referencias al Dia 56 y, si se desea volver al estado anterior:

```text
Cambiar APP_DOCUMENT_BUCKET por el nombre anterior usado antes de esta correccion.
Retirar del pom.xml las dependencias agregadas para native-image: commons-logging-jboss-logging, log4j-api, log4j-over-slf4j, bcpkix-jdk15to18 y bcprov-jdk15to18.
Retirar de application.properties la propiedad quarkus.native.additional-build-args si ya no se compila document-service en modo nativo.
```

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

Resultado real validado el 2026-09-18:

```text
BUILD SUCCESS
local_image: document-service:0.1.0-native
image_id: sha256:3c8d8b2a8e7231a13881bd486d894398db62c6a4d19bfeed0359206c24d681af
native_runner_bytes: 147927432
image_size_bytes: 135159151
ready: true
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
mvn -f .\services\document-service\pom.xml dependency:tree "-Dincludes=commons-logging:commons-logging,log4j:log4j,org.jboss.logging:commons-logging-jboss-logging,org.bouncycastle,org.apache.logging.log4j:log4j-api,org.apache.logging.log4j:log4j-core,org.slf4j:log4j-over-slf4j"
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-document-service-native.ps1 -UseCleanWorkspace
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
Dependency tree: sin commons-logging clasico, sin log4j:log4j y sin log4j-core.
Native build: BUILD SUCCESS.
Imagen Docker local creada: document-service:0.1.0-native.
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

### Error org.apache.log4j.Priority durante native-image

Sintoma:

```text
Caused by: java.lang.NoClassDefFoundError: org/apache/log4j/Priority
Caused by: java.lang.ClassNotFoundException: org.apache.log4j.Priority
```

Causa:

```text
PDFBox y Google Cloud Storage podian arrastrar commons-logging clasico.
En native-image, commons-logging intenta detectar Log4J 1.x y GraalVM exige clases que no deben formar parte del servicio.
```

Correccion aplicada:

```text
Se excluyo commons-logging de PDFBox y Google Cloud Storage.
Se agrego org.jboss.logging:commons-logging-jboss-logging.
```

### Error PublicKeySecurityHandler o ASN1Encodable durante native-image

Sintoma:

```text
Class initialization of org.apache.pdfbox.pdmodel.encryption.PublicKeySecurityHandler failed
Caused by: java.lang.ClassNotFoundException: org.bouncycastle.asn1.ASN1Encodable
```

Correccion aplicada:

```text
Se agregaron las dependencias opcionales de PDFBox:
org.bouncycastle:bcpkix-jdk15to18:1.77
org.bouncycastle:bcprov-jdk15to18:1.77

Se agrego:
quarkus.native.additional-build-args=--initialize-at-run-time=org.apache.pdfbox.pdmodel.encryption.PublicKeySecurityHandler
```

### Error Log4J2Logger o org.apache.log4j.Logger durante native-image

Sintoma:

```text
Discovered unresolved type during parsing: io.grpc.netty.shaded.io.netty.util.internal.logging.Log4J2Logger
Discovered unresolved type during parsing: org.apache.log4j.Logger
```

Causa:

```text
Google Cloud Storage incluye gRPC shaded Netty.
GraalVM analiza ramas opcionales de logging de Netty aunque el servicio use el logging de Quarkus.
```

Correccion aplicada:

```text
Se agrego org.apache.logging.log4j:log4j-api gestionado por Quarkus.
Se agrego org.slf4j:log4j-over-slf4j:2.0.6.
No se agrego log4j:log4j ni log4j-core.
```

Validar que el arbol de dependencias siga correcto:

```powershell
mvn -f .\services\document-service\pom.xml dependency:tree "-Dincludes=commons-logging:commons-logging,log4j:log4j,org.apache.logging.log4j:log4j-core,org.apache.logging.log4j:log4j-api,org.slf4j:log4j-over-slf4j"
```

Nota: durante native-image puede aparecer este mensaje:

```text
Log4j API could not find a logging provider.
```

En esta guia no es fatal si el proceso termina con `BUILD SUCCESS`; aparece porque se agrego solo `log4j-api` para satisfacer clases opcionales analizadas por GraalVM, no un proveedor Log4J completo.

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
La imagen local document-service:0.1.0-native fue compilada correctamente.
La imagen aun no fue publicada a Artifact Registry.
El siguiente paso natural es ejecutar el Paso 8 para publicar document-service y despues crear el tag dev.
```
