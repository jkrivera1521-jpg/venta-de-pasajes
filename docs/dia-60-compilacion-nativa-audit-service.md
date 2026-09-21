# Dia 60 - Compilacion nativa audit-service

Fecha de ejecucion: 2026-09-21

## Objetivo

Preparar `audit-service` para generar imagen Docker nativa local y dejar el camino listo para publicar en Artifact Registry cuando se avance al despliegue Cloud Run dev.

Alcance del dia:

```text
Crear Dockerfile nativo para audit-service.
Crear script PowerShell de build/tag/push para audit-service.
Agregar modo PlanOnly para validar rutas sin compilar.
Agregar validacion temprana de Docker Desktop.
Ejecutar pruebas JVM de audit-service.
Compilar binario nativo con Mandrel.
Crear imagen Docker local audit-service:0.1.0-native.
Validar health del contenedor nativo local.
Documentar reversa y guia manual desde cero.
```

## Resultado logrado

```text
Se creo services\audit-service\src\main\docker\Dockerfile.native.
Se creo scripts\build-audit-service-native.ps1.
El script genera la imagen local audit-service:0.1.0-native.
El script etiqueta la imagen remota us-central1-docker.pkg.dev/project-fbb34cd7-0b82-43e1-867/venta-pasajes-dev/audit-service:0.1.0-native.
El script permite publicar con -Push.
El script valida Docker Desktop antes de ejecutar native-image o docker build.
Se valido el modo -PlanOnly.
Se ejecutaron pruebas Maven de audit-service.
Se compilo el binario nativo de audit-service.
Se creo la imagen Docker local.
Se levanto un contenedor temporal y /api/v1/audit/health respondio HTTP 200.
```

Datos validados:

```text
Servicio: audit-service
Puerto interno: 8086
Imagen local: audit-service:0.1.0-native
Imagen remota preparada: us-central1-docker.pkg.dev/project-fbb34cd7-0b82-43e1-867/venta-pasajes-dev/audit-service:0.1.0-native
Image ID local: sha256:3b93203879bfb6349fb0ebb09f6756129d53c40a31602403545e2634c6f3e785
Image size local: 108693924 bytes
Native runner size: 103411952 bytes
Health local: HTTP 200
Publicado en Artifact Registry: no
```

## Archivos creados

```text
C:\VENTA-DE-PASAJES\services\audit-service\src\main\docker\Dockerfile.native
C:\VENTA-DE-PASAJES\scripts\build-audit-service-native.ps1
C:\VENTA-DE-PASAJES\docs\dia-60-compilacion-nativa-audit-service.md
```

## Archivos modificados

```text
C:\VENTA-DE-PASAJES\README.md
C:\VENTA-DE-PASAJES\infra\README.md
C:\VENTA-DE-PASAJES\vitacora.md
```

## Reversa primero

Esta reversa elimina lo preparado en el Dia 60. La reversa cloud solo aplica si despues se publica la imagen con `-Push`.

### Paso 1 - Ubicarse en el proyecto

```powershell
$ProjectRoot = "C:\VENTA-DE-PASAJES"
Set-Location $ProjectRoot
```

### Paso 2 - Eliminar archivos locales del Dia 60

```powershell
Remove-Item -LiteralPath "$ProjectRoot\services\audit-service\src\main\docker\Dockerfile.native" -Force
Remove-Item -LiteralPath "$ProjectRoot\scripts\build-audit-service-native.ps1" -Force
Remove-Item -LiteralPath "$ProjectRoot\docs\dia-60-compilacion-nativa-audit-service.md" -Force
```

### Paso 3 - Revertir documentacion

En:

```text
C:\VENTA-DE-PASAJES\README.md
C:\VENTA-DE-PASAJES\infra\README.md
C:\VENTA-DE-PASAJES\vitacora.md
```

Retirar las referencias al Dia 60.

### Paso 4 - Eliminar imagenes Docker locales si se compilaron

```powershell
docker image rm audit-service:0.1.0-native -f
docker image rm us-central1-docker.pkg.dev/project-fbb34cd7-0b82-43e1-867/venta-pasajes-dev/audit-service:0.1.0-native -f
```

Si Docker no esta activo, este paso puede omitirse.

### Paso 5 - Reversa cloud si se publico la imagen

Advertencia: este paso elimina una imagen real de Artifact Registry. Ejecutarlo solo si previamente se publico con `-Push`.

```powershell
$env:CLOUDSDK_PYTHON = "C:\Python312\python.exe"
$GcloudPath = "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd"

& $GcloudPath artifacts docker images delete `
  "us-central1-docker.pkg.dev/project-fbb34cd7-0b82-43e1-867/venta-pasajes-dev/audit-service:0.1.0-native" `
  --project "project-fbb34cd7-0b82-43e1-867" `
  --quiet
```

Si esa imagen comparte digest con otros tags, usar `--delete-tags` solo cuando se quiera borrar tambien esos tags.

### Paso 6 - Validar reversa local

```powershell
Test-Path -LiteralPath "$ProjectRoot\services\audit-service\src\main\docker\Dockerfile.native"
Test-Path -LiteralPath "$ProjectRoot\scripts\build-audit-service-native.ps1"
Test-Path -LiteralPath "$ProjectRoot\docs\dia-60-compilacion-nativa-audit-service.md"
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
Test-Path -LiteralPath "$ProjectRoot\services\audit-service\src\main\docker\Dockerfile.native"
Test-Path -LiteralPath "$ProjectRoot\scripts\build-audit-service-native.ps1"
```

Resultado esperado:

```text
True
True
```

### Paso 3 - Validar plan de build nativo sin compilar

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-audit-service-native.ps1 -PlanOnly
```

Resultado esperado:

```text
"service":"audit-service"
"mode":"plan"
"local_image":"audit-service:0.1.0-native"
"artifact_image":"us-central1-docker.pkg.dev/project-fbb34cd7-0b82-43e1-867/venta-pasajes-dev/audit-service:0.1.0-native"
"requires_docker":true
"ready":true
```

Resultado real validado:

```text
ready: true
requires_docker: true
```

### Paso 4 - Ejecutar pruebas JVM del servicio

```powershell
mvn -f .\services\audit-service\pom.xml test
```

Resultado real validado:

```text
BUILD SUCCESS
Tests run: 7, Failures: 0, Errors: 0, Skipped: 0
```

### Paso 5 - Verificar Docker antes de compilar nativo

```powershell
docker info
```

Si responde `dockerDesktopLinuxEngine`, `The system cannot find the file specified` o un error de conexion, abrir Docker Desktop y esperar hasta que indique que esta corriendo.

### Paso 6 - Compilar nativo y crear imagen local

Este paso puede tardar varios minutos.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-audit-service-native.ps1 -UseCleanWorkspace
```

Resultado esperado:

```text
"service":"audit-service"
"local_image":"audit-service:0.1.0-native"
"artifact_image":"us-central1-docker.pkg.dev/project-fbb34cd7-0b82-43e1-867/venta-pasajes-dev/audit-service:0.1.0-native"
"ready":true
```

Resultado real validado el 2026-09-21:

```text
BUILD SUCCESS
local_image: audit-service:0.1.0-native
image_id: sha256:3b93203879bfb6349fb0ebb09f6756129d53c40a31602403545e2634c6f3e785
native_runner_bytes: 103411952
image_size_bytes: 108693924
ready: true
```

### Paso 7 - Inspeccionar imagen local

```powershell
docker image inspect audit-service:0.1.0-native --format "{{.Id}} {{.Size}} {{.Architecture}}/{{.Os}}"
```

Resultado real validado:

```text
sha256:3b93203879bfb6349fb0ebb09f6756129d53c40a31602403545e2634c6f3e785 108693924 amd64/linux
```

### Paso 8 - Probar health del contenedor nativo local

Este paso levanta un contenedor temporal en el puerto local `18086` y lo elimina al terminar.

```powershell
$ContainerName = "venta-pasajes-audit-native-test"
$Port = 18086

$Existing = docker ps -a --filter "name=$ContainerName" --format "{{.Names}}"
if ($Existing -contains $ContainerName) {
  docker rm -f $ContainerName | Out-Null
}

$ContainerId = docker run -d `
  --name $ContainerName `
  -p ${Port}:8086 `
  -e QUARKUS_DATASOURCE_HEALTH_ENABLED=false `
  audit-service:0.1.0-native

try {
  Start-Sleep -Seconds 3
  curl.exe -s -i "http://localhost:$Port/api/v1/audit/health"
}
finally {
  docker rm -f $ContainerName | Out-Null
}
```

Resultado real validado:

```text
HTTP 200
{"status":"ok","service":"audit-service","runtime":"quarkus","checked_at":"2026-09-21T15:27:32.223310Z"}
```

### Paso 9 - Publicar imagen en Artifact Registry

Ejecutar solo despues de que el Paso 6 haya creado la imagen local y cuando se quiera publicar realmente.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-audit-service-native.ps1 `
  -SkipNativeBuild `
  -SkipDockerBuild `
  -Push
```

### Paso 10 - Verificar imagen publicada

```powershell
$env:CLOUDSDK_PYTHON = "C:\Python312\python.exe"
$GcloudPath = "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd"

& $GcloudPath artifacts docker images describe `
  "us-central1-docker.pkg.dev/project-fbb34cd7-0b82-43e1-867/venta-pasajes-dev/audit-service:0.1.0-native" `
  --project "project-fbb34cd7-0b82-43e1-867" `
  --format "value(image_summary.digest)"
```

## Comandos de validacion ejecutados

```powershell
Test-Path -LiteralPath .\services\audit-service\src\main\docker\Dockerfile.native
Test-Path -LiteralPath .\scripts\build-audit-service-native.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-audit-service-native.ps1 -PlanOnly
docker info --format "{{json .ServerVersion}}"
mvn -f .\services\audit-service\pom.xml test
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-audit-service-native.ps1 -UseCleanWorkspace
docker image inspect audit-service:0.1.0-native --format "{{.Id}} {{.Size}} {{.Architecture}}/{{.Os}}"
curl.exe -s "http://localhost:18086/api/v1/audit/health"
```

Resultados observados:

```text
PlanOnly: ready=true.
Docker activo: 28.3.2.
Maven test: BUILD SUCCESS.
Tests run: 7, Failures: 0, Errors: 0, Skipped: 0.
Native build: BUILD SUCCESS.
Docker build: audit-service:0.1.0-native creado.
Health contenedor nativo: HTTP 200.
No se ejecuto -Push; no se modifico Artifact Registry.
```

## Notas operativas

```text
audit-service mantiene su propia base audit_db.
La prueba de health local no requiere consultar PostgreSQL.
El servicio es append-only a nivel funcional para eventos auditables.
Para Cloud Run dev, primero publicar audit-service:0.1.0-native o promoverlo a dev antes de desplegar.
```
