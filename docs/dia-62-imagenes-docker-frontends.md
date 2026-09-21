# Dia 62 - Imagenes Docker frontends Next.js

Fecha de ejecucion: 2026-09-21

## Objetivo

Preparar, validar y publicar imagenes Docker de los seis frontends Next.js para que el siguiente dia pueda desplegarse la capa frontend en Cloud Run sin volver a fallar por imagen inexistente.

Alcance del dia:

```text
Corregir empaquetado standalone de archivos static de Next.js.
Crear Dockerfile reusable para frontends Next.js standalone.
Crear script reproducible para construir y publicar imagenes frontend.
Construir los seis frontends.
Validar health local de los seis contenedores.
Publicar las seis imagenes en Artifact Registry con tag 0.1.0-frontend.
Validar los digests remotos en Artifact Registry.
Documentar reversa y guia manual desde cero.
```

## Resultado logrado

```text
frontend-shell:0.1.0-frontend construido y publicado.
mfe-identity:0.1.0-frontend construido y publicado.
mfe-dispatch:0.1.0-frontend construido y publicado.
mfe-ticketing:0.1.0-frontend construido y publicado.
mfe-reporting:0.1.0-frontend construido y publicado.
mfe-admin:0.1.0-frontend construido y publicado.
Todos los contenedores locales respondieron /api/health con HTTP 200.
```

Datos validados:

```text
Proyecto: project-fbb34cd7-0b82-43e1-867
Region: us-central1
Repositorio: venta-pasajes-dev
Tag publicado: 0.1.0-frontend
Dockerfile frontend: C:\VENTA-DE-PASAJES\infra\docker\Dockerfile.next-standalone
Script build/push: C:\VENTA-DE-PASAJES\scripts\build-frontend-images.ps1
```

Digests confirmados en Artifact Registry:

```text
frontend-shell  sha256:3e4090952e5dbc87d58394750629496dbd822da3802550fddf31e528dbc5fa3d
mfe-identity    sha256:709b9331da5860ad9d5f6b77ae2647af3627f06f07845fc4f6543276f4bad7ab
mfe-dispatch    sha256:bb36e124592af17ce10aa1738679beb940bdc5c5ca2e5a43400adaffb0b9105d
mfe-ticketing   sha256:2e01380c5e51dc68b66ce3fee6096eea89f9671efe692c0ad8eb5af7bd120fb8
mfe-reporting   sha256:f7293fac10f7c0ef50da4b8df263f915ca63a26d400df4403c55cc39377f4d52
mfe-admin       sha256:3ee3df00d486821d7fd7c3263b2cf968f6c6b882739d4c438fd1752f8bf005de
```

## Archivos creados

```text
C:\VENTA-DE-PASAJES\docs\dia-62-imagenes-docker-frontends.md
C:\VENTA-DE-PASAJES\infra\docker\Dockerfile.next-standalone
C:\VENTA-DE-PASAJES\scripts\build-frontend-images.ps1
```

## Archivos modificados

```text
C:\VENTA-DE-PASAJES\package.json
C:\VENTA-DE-PASAJES\scripts\build-frontend-artifacts.ps1
C:\VENTA-DE-PASAJES\README.md
C:\VENTA-DE-PASAJES\infra\README.md
C:\VENTA-DE-PASAJES\vitacora.md
```

## Reversa primero

Esta reversa elimina el tag frontend publicado en Artifact Registry y limpia las imagenes/artefactos locales generados.

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

### Paso 3 - Revisar tags remotos antes de eliminarlos

```powershell
$ProjectId = "project-fbb34cd7-0b82-43e1-867"
$Region = "us-central1"
$Repository = "venta-pasajes-dev"
$ImageTag = "0.1.0-frontend"
$Apps = "frontend-shell", "mfe-identity", "mfe-dispatch", "mfe-ticketing", "mfe-reporting", "mfe-admin"

$Apps | ForEach-Object {
  $Image = "$Region-docker.pkg.dev/$ProjectId/$Repository/$_`:$ImageTag"
  & $GcloudPath artifacts docker images describe $Image `
    --project $ProjectId `
    --format "value(image_summary.fully_qualified_digest)"
}
```

### Paso 4 - Eliminar los tags publicados

Advertencia: este paso elimina los tags `0.1.0-frontend` de Artifact Registry.

```powershell
$Apps | ForEach-Object {
  $Tag = "$Region-docker.pkg.dev/$ProjectId/$Repository/$_`:$ImageTag"
  & $GcloudPath artifacts docker tags delete $Tag `
    --project $ProjectId `
    --quiet
}
```

### Paso 5 - Validar que los tags ya no existen

```powershell
$Apps | ForEach-Object {
  $Image = "$Region-docker.pkg.dev/$ProjectId/$Repository/$_`:$ImageTag"
  & $GcloudPath artifacts docker images describe $Image `
    --project $ProjectId
}
```

Resultado esperado despues de eliminar:

```text
Image not found.
```

### Paso 6 - Limpiar imagenes locales

```powershell
$Apps | ForEach-Object {
  docker rmi "$_`:$ImageTag" --force
  docker rmi "$Region-docker.pkg.dev/$ProjectId/$Repository/$_`:$ImageTag" --force
}
```

### Paso 7 - Limpiar artefactos locales generados

```powershell
Remove-Item -LiteralPath "$ProjectRoot\artifacts\frontend\0.1.0-frontend" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath "$ProjectRoot\logs\frontend-images\build-frontend-images.0.1.0-frontend.json" -Force -ErrorAction SilentlyContinue
```

### Paso 8 - Reversa documental local

Si solo se quiere quitar esta practica del repositorio:

```powershell
Remove-Item -LiteralPath "$ProjectRoot\docs\dia-62-imagenes-docker-frontends.md" -Force
Remove-Item -LiteralPath "$ProjectRoot\scripts\build-frontend-images.ps1" -Force
Remove-Item -LiteralPath "$ProjectRoot\infra\docker\Dockerfile.next-standalone" -Force
```

Luego retirar las referencias al Dia 62 en:

```text
C:\VENTA-DE-PASAJES\package.json
C:\VENTA-DE-PASAJES\README.md
C:\VENTA-DE-PASAJES\infra\README.md
C:\VENTA-DE-PASAJES\vitacora.md
```

Y revertir en `scripts\build-frontend-artifacts.ps1` la copia de static si se desea volver al estado anterior.

## Guia manual desde cero

> Importante: ejecutar desde PowerShell en `C:\VENTA-DE-PASAJES`.

### Paso 1 - Ubicarse en el proyecto

```powershell
$ProjectRoot = "C:\VENTA-DE-PASAJES"
Set-Location $ProjectRoot
```

### Paso 2 - Validar archivos requeridos

```powershell
Test-Path -LiteralPath .\scripts\build-frontend-artifacts.ps1
Test-Path -LiteralPath .\scripts\build-frontend-images.ps1
Test-Path -LiteralPath .\infra\docker\Dockerfile.next-standalone
Test-Path -LiteralPath .\infra\cloudrun\dev-services.json
```

Todos deben responder:

```text
True
```

### Paso 3 - Confirmar Docker Desktop

```powershell
docker info --format "{{json .ServerVersion}}"
```

Si falla, abrir Docker Desktop y esperar a que este en estado `Running`.

### Paso 4 - Configurar gcloud para Windows

```powershell
$env:CLOUDSDK_PYTHON = "C:\Python312\python.exe"
$GcloudPath = "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd"
```

### Paso 5 - Confirmar cuenta, proyecto y repositorio

```powershell
& $GcloudPath auth list --filter=status:ACTIVE --format "value(account)"
& $GcloudPath config get-value project
& $GcloudPath artifacts repositories describe venta-pasajes-dev `
  --project "project-fbb34cd7-0b82-43e1-867" `
  --location "us-central1" `
  --format "value(name)"
```

Resultado observado:

```text
jkrivera1521@gmail.com
project-fbb34cd7-0b82-43e1-867
projects/project-fbb34cd7-0b82-43e1-867/locations/us-central1/repositories/venta-pasajes-dev
```

### Paso 6 - Revisar plan de imagenes sin construir

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-frontend-images.ps1 -PlanOnly
```

Debe listar:

```text
frontend-shell puerto 3000
mfe-identity puerto 3001
mfe-dispatch puerto 3002
mfe-ticketing puerto 3003
mfe-reporting puerto 3004
mfe-admin puerto 3005
```

### Paso 7 - Construir artefactos e imagenes locales

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-frontend-images.ps1 -ImageTag 0.1.0-frontend
```

Este paso ejecuta:

```text
Build de shared-types.
Typecheck de cada frontend.
next build de cada frontend.
Empaquetado standalone.
Build Docker de cada imagen.
Tag local y tag remoto local para Artifact Registry.
```

### Paso 8 - Validar imagenes locales

```powershell
docker images --format "{{.Repository}}:{{.Tag}} {{.ID}} {{.Size}}" |
  Select-String -Pattern "frontend-shell|mfe-identity|mfe-dispatch|mfe-ticketing|mfe-reporting|mfe-admin"
```

Debe existir cada imagen con el tag:

```text
0.1.0-frontend
```

### Paso 9 - Validar health local de todos los contenedores

```powershell
$Checks = @(
  @{ App = "frontend-shell"; Image = "frontend-shell:0.1.0-frontend"; ContainerPort = 3000; HostPort = 13000 },
  @{ App = "mfe-identity"; Image = "mfe-identity:0.1.0-frontend"; ContainerPort = 3001; HostPort = 13001 },
  @{ App = "mfe-dispatch"; Image = "mfe-dispatch:0.1.0-frontend"; ContainerPort = 3002; HostPort = 13002 },
  @{ App = "mfe-ticketing"; Image = "mfe-ticketing:0.1.0-frontend"; ContainerPort = 3003; HostPort = 13003 },
  @{ App = "mfe-reporting"; Image = "mfe-reporting:0.1.0-frontend"; ContainerPort = 3004; HostPort = 13004 },
  @{ App = "mfe-admin"; Image = "mfe-admin:0.1.0-frontend"; ContainerPort = 3005; HostPort = 13005 }
)

$Results = foreach ($Check in $Checks) {
  $ContainerName = "venta-pasajes-$($Check.App)-frontend-test"
  $Existing = docker ps -a --filter "name=$ContainerName" --format "{{.Names}}"
  if ($Existing -contains $ContainerName) { docker rm -f $ContainerName | Out-Null }
  docker run -d --name $ContainerName -p "$($Check.HostPort):$($Check.ContainerPort)" $Check.Image | Out-Null
  try {
    Start-Sleep -Seconds 3
    $Status = curl.exe -s -o NUL -w "%{http_code}" "http://localhost:$($Check.HostPort)/api/health"
    [pscustomobject]@{ App = $Check.App; Status = $Status }
  }
  finally {
    docker rm -f $ContainerName | Out-Null
  }
}

$Results | Format-Table -AutoSize
```

Resultado observado:

```text
frontend-shell 200
mfe-identity   200
mfe-dispatch   200
mfe-ticketing  200
mfe-reporting  200
mfe-admin      200
```

### Paso 10 - Publicar en Artifact Registry

Como las imagenes locales ya existen, no se recompila Next ni Docker:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-frontend-images.ps1 `
  -ImageTag 0.1.0-frontend `
  -SkipNextBuild `
  -SkipDockerBuild `
  -Push
```

### Paso 11 - Validar digests remotos

```powershell
$ProjectId = "project-fbb34cd7-0b82-43e1-867"
$Region = "us-central1"
$Repository = "venta-pasajes-dev"
$ImageTag = "0.1.0-frontend"
$Apps = "frontend-shell", "mfe-identity", "mfe-dispatch", "mfe-ticketing", "mfe-reporting", "mfe-admin"

$Apps | ForEach-Object {
  $Image = "$Region-docker.pkg.dev/$ProjectId/$Repository/$_`:$ImageTag"
  $Digest = (& $GcloudPath artifacts docker images describe $Image `
    --project $ProjectId `
    --format "value(image_summary.fully_qualified_digest)").Trim()
  [pscustomobject]@{ App = $_; Digest = $Digest }
} | Format-Table -AutoSize
```

Debe devolver digest para los seis frontends.

## Nota importante para el siguiente dia

Este dia publica `0.1.0-frontend`. Todavia no se despliega Cloud Run frontend y todavia no se promueve a `dev`.

El siguiente paso operativo es:

```text
Promover frontend-shell y MFEs desde 0.1.0-frontend a dev.
Desplegar frontends en Cloud Run dev usando imagenes ya existentes.
Resolver URLs entre shell, MFEs y backends desplegados.
Validar manifiestos /mfe/manifest y health publico /api/health.
```
