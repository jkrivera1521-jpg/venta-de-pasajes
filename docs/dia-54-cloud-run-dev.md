# Dia 54 - Plan de despliegue Cloud Run dev

Fecha de ejecucion: 2026-09-18

## Objetivo

Preparar el despliegue reproducible en Cloud Run dev para los seis backends y los seis frontends, sin ejecutar cambios reales en Google Cloud por defecto.

Alcance del dia:

```text
Crear descriptor Cloud Run dev de servicios.
Crear script PowerShell que genere comandos gcloud run deploy.
Soportar modo plan por defecto y modo ejecucion explicito.
Separar frontends publicos y backends privados.
Configurar Cloud SQL para servicios backend.
Documentar reversa y guia manual desde cero.
```

## Resultado logrado

```text
Se creo infra\cloudrun\dev-services.json.
Se creo scripts\deploy-cloudrun-dev.ps1.
El script genera logs\cloudrun-dev\deploy-cloudrun-dev.commands.ps1.
El script genera logs\cloudrun-dev\deploy-cloudrun-dev.commands.plan.json.
El plan incluye 12 servicios: 6 backend y 6 frontend.
Los backends quedan planificados como privados.
Los frontends quedan planificados como publicos para acceso web dev.
Los backends incluyen Cloud SQL mediante --add-cloudsql-instances.
```

## Archivos creados

```text
C:\VENTA-DE-PASAJES\infra\cloudrun\dev-services.json
C:\VENTA-DE-PASAJES\scripts\deploy-cloudrun-dev.ps1
C:\VENTA-DE-PASAJES\docs\dia-54-cloud-run-dev.md
```

## Archivos modificados

```text
C:\VENTA-DE-PASAJES\README.md
C:\VENTA-DE-PASAJES\infra\README.md
C:\VENTA-DE-PASAJES\vitacora.md
```

## Reversa primero

Esta reversa elimina la planificacion del Dia 54. No borra servicios reales de Cloud Run salvo que se ejecute el paso explicito de borrado cloud.

### Paso 1 - Ubicarse en el proyecto

```powershell
$ProjectRoot = "C:\VENTA-DE-PASAJES"
Set-Location $ProjectRoot
```

### Paso 2 - Borrar archivos locales del Dia 54

```powershell
Remove-Item -LiteralPath "$ProjectRoot\infra\cloudrun\dev-services.json" -Force
Remove-Item -LiteralPath "$ProjectRoot\scripts\deploy-cloudrun-dev.ps1" -Force
Remove-Item -LiteralPath "$ProjectRoot\logs\cloudrun-dev" -Recurse -Force -ErrorAction SilentlyContinue
```

### Paso 3 - Revertir README y vitacora

En:

```text
C:\VENTA-DE-PASAJES\README.md
C:\VENTA-DE-PASAJES\infra\README.md
C:\VENTA-DE-PASAJES\vitacora.md
```

Retirar las referencias al Dia 54, `dev-services.json` y `deploy-cloudrun-dev.ps1`.

### Paso 4 - Si se ejecuto despliegue real, borrar servicios Cloud Run dev

Advertencia: este paso elimina servicios reales de Cloud Run. Ejecutarlo solo si se quiere limpiar el ambiente dev.

```powershell
$ProjectId = "project-fbb34cd7-0b82-43e1-867"
$Region = "us-central1"
$Services = @(
  "identity-service",
  "dispatch-service",
  "document-service",
  "reporting-service",
  "audit-service",
  "ticketing-service",
  "mfe-identity",
  "mfe-dispatch",
  "mfe-ticketing",
  "mfe-reporting",
  "mfe-admin",
  "frontend-shell"
)

foreach ($Service in $Services) {
  gcloud run services delete $Service `
    --project $ProjectId `
    --region $Region `
    --quiet
}
```

### Paso 5 - Validar reversa local

```powershell
Test-Path -LiteralPath "$ProjectRoot\infra\cloudrun\dev-services.json"
Test-Path -LiteralPath "$ProjectRoot\scripts\deploy-cloudrun-dev.ps1"
Test-Path -LiteralPath "$ProjectRoot\logs\cloudrun-dev"
```

Resultado esperado si se borro todo localmente:

```text
False
False
False
```

## Guia manual desde cero

> Importante: ejecutar desde PowerShell. Si la consola esta en `C:\Windows\system32`, primero ejecutar el Paso 1.
> Estado verificado: en Artifact Registry existen imagenes para `identity-service`, `dispatch-service` y `ticketing-service` con tag `0.1.0-native`. No usar `dev` en el despliegue real mientras ese tag no exista publicado.

### Paso 1 - Ubicarse en el proyecto

```powershell
$ProjectRoot = "C:\VENTA-DE-PASAJES"
Set-Location $ProjectRoot
```

### Paso 2 - Verificar archivos del Dia 54

```powershell
Test-Path -LiteralPath "$ProjectRoot\infra\cloudrun\dev-services.json"
Test-Path -LiteralPath "$ProjectRoot\scripts\deploy-cloudrun-dev.ps1"
```

Resultado esperado:

```text
True
True
```

### Paso 3 - Generar plan sin tocar Google Cloud

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\deploy-cloudrun-dev.ps1 `
  -ImageTag 0.1.0-native
```

Resultado esperado:

```text
Cloud Run dev plan generated.
Commands: C:\VENTA-DE-PASAJES\logs\cloudrun-dev\deploy-cloudrun-dev.commands.ps1
Plan: C:\VENTA-DE-PASAJES\logs\cloudrun-dev\deploy-cloudrun-dev.commands.plan.json
```

### Paso 4 - Revisar comandos generados

```powershell
Get-Content -LiteralPath "$ProjectRoot\logs\cloudrun-dev\deploy-cloudrun-dev.commands.ps1" -Raw
```

El archivo debe contener comandos `gcloud run deploy` para:

```text
identity-service
dispatch-service
document-service
reporting-service
audit-service
ticketing-service
mfe-identity
mfe-dispatch
mfe-ticketing
mfe-reporting
mfe-admin
frontend-shell
```

### Paso 5 - Validar plan JSON

```powershell
$Plan = Get-Content -LiteralPath "$ProjectRoot\logs\cloudrun-dev\deploy-cloudrun-dev.commands.plan.json" -Raw | ConvertFrom-Json
$Plan.services | Select-Object id,group,service_name,port,allow_unauthenticated,cloud_sql | Format-Table -AutoSize
$Plan.services.Count
```

Resultado esperado:

```text
12
```

### Paso 6 - Verificar imagenes antes de ejecutar despliegue real

El despliegue real solo funciona si Artifact Registry contiene la imagen y el tag exacto que se envia en `-ImageTag`.

Forma de una imagen valida:

```text
us-central1-docker.pkg.dev/project-fbb34cd7-0b82-43e1-867/venta-pasajes-dev/identity-service:0.1.0-native
```

Listar imagenes y tags publicados:

```powershell
$env:CLOUDSDK_PYTHON = "C:\Python312\python.exe"
$GcloudPath = "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd"

& $GcloudPath artifacts docker images list `
  "us-central1-docker.pkg.dev/project-fbb34cd7-0b82-43e1-867/venta-pasajes-dev" `
  --project "project-fbb34cd7-0b82-43e1-867" `
  --include-tags
```

Resultado esperado actualmente:

```text
dispatch-service   0.1.0-native
identity-service   0.1.0-native
ticketing-service  0.1.0-native
```

Si se usa el tag `dev`, el despliegue falla porque ese tag no esta publicado.

### Paso 7 - Ejecutar despliegue real

Advertencia: este paso si modifica Google Cloud.

El script valida primero que la imagen exista en Artifact Registry. Si la imagen no existe, detiene el despliegue antes de llamar a Cloud Run.

Con el estado actual, desplegar solo los tres servicios que ya tienen imagen publicada:

```powershell
$ImageTag = "0.1.0-native"

powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\deploy-cloudrun-dev.ps1 `
  -ImageTag $ImageTag `
  -ServiceIds identity-service,dispatch-service,ticketing-service `
  -CheckImagesOnly
```

Resultado esperado:

```text
identity-service: True
dispatch-service: True
ticketing-service: True
Cloud Run dev plan generated.
```

Si el preflight anterior sale correcto, ejecutar el despliegue real de esos tres servicios:

```powershell
$ImageTag = "0.1.0-native"

powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\deploy-cloudrun-dev.ps1 `
  -ImageTag $ImageTag `
  -ServiceIds identity-service,dispatch-service,ticketing-service `
  -Execute
```

No ejecutar el despliegue completo de 12 servicios todavia. Faltan imagenes para:

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

Cuando todas las imagenes existan con un mismo tag real, repetir primero el preflight `-CheckImagesOnly` con ese tag y despues ejecutar `-Execute`.

### Paso 8 - Que significa el error con `dev`

El tag `dev` no existe actualmente en Artifact Registry. Por eso cualquier despliegue que apunte a `identity-service:dev`, `dispatch-service:dev` o `ticketing-service:dev` falla antes de desplegar.

Resultado observado:

```text
ERROR: Faltan imagenes en Artifact Registry: identity-service, dispatch-service, document-service, reporting-service, audit-service, ticketing-service
```

Este error no significa que `identity-service` no exista. Significa que no existe la combinacion `identity-service:dev`.

Si hay URLs no resueltas entre servicios, primero revisar el archivo generado en modo plan y definir las URLs requeridas. Para diagnostico controlado se pueden permitir URLs temporales, pero solo con un tag existente:

```powershell
$ImageTag = "0.1.0-native"

powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\deploy-cloudrun-dev.ps1 `
  -ImageTag $ImageTag `
  -ServiceIds identity-service,dispatch-service,ticketing-service `
  -Execute `
  -AllowUnresolved
```

Si se necesita saltar la validacion de imagenes para diagnostico avanzado, hacerlo solo sabiendo que Cloud Run fallara si la imagen no existe:

```powershell
$ImageTag = "0.1.0-native"

powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\deploy-cloudrun-dev.ps1 `
  -ImageTag $ImageTag `
  -ServiceIds identity-service,dispatch-service,ticketing-service `
  -Execute `
  -SkipImageCheck
```

## Peticiones HTTP listas para copiar

Despues de desplegar, obtener URL y probar salud:

```powershell
$ProjectId = "project-fbb34cd7-0b82-43e1-867"
$Region = "us-central1"
$Url = gcloud run services describe identity-service `
  --project $ProjectId `
  --region $Region `
  --format "value(status.url)"

curl.exe -s "$Url/api/v1/identity/health"
```

Para frontend shell:

```powershell
$ShellUrl = gcloud run services describe frontend-shell `
  --project "project-fbb34cd7-0b82-43e1-867" `
  --region "us-central1" `
  --format "value(status.url)"

curl.exe -s -o NUL -w "%{http_code}" "$ShellUrl/"
curl.exe -s "$ShellUrl/api/health"
```

## Comandos de validacion ejecutados

```powershell
Test-Path -LiteralPath .\infra\cloudrun\dev-services.json
Test-Path -LiteralPath .\scripts\deploy-cloudrun-dev.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\deploy-cloudrun-dev.ps1 -ImageTag 0.1.0-native
Get-Content -LiteralPath .\logs\cloudrun-dev\deploy-cloudrun-dev.commands.plan.json -Raw | ConvertFrom-Json
Select-String -Path .\logs\cloudrun-dev\deploy-cloudrun-dev.commands.ps1 -Pattern "gcloud|run|deploy|frontend-shell|identity-service"
```

Resultados observados:

```text
dev-services.json existe.
deploy-cloudrun-dev.ps1 existe.
El descriptor Cloud Run dev contiene 12 servicios.
El plan generado contiene 6 backends y 6 frontends.
Los 6 backends estan marcados como privados.
Los 6 backends tienen cloud_sql=true.
Se genero logs\cloudrun-dev\deploy-cloudrun-dev.commands.ps1.
Se genero logs\cloudrun-dev\deploy-cloudrun-dev.commands.plan.json.
logs/ esta ignorado por Git, por lo que el plan local no se versiona accidentalmente.
```

## Troubleshooting

### El plan contiene `<servicio-url>`

Significa que una variable depende de una URL que Cloud Run entrega despues del primer despliegue. Generar plan, desplegar servicios base, consultar URLs con `gcloud run services describe` y luego redeplegar el servicio que depende de esas URLs.

### Cloud Run responde que la imagen no existe

Ejemplo del error:

```text
Image 'us-central1-docker.pkg.dev/project-fbb34cd7-0b82-43e1-867/venta-pasajes-dev/identity-service:tag-no-publicado' not found.
```

Esto significa que Cloud Run recibio el comando, pero Artifact Registry no tiene esa imagen con ese tag. Publicar primero la imagen en Artifact Registry con el mismo tag usado en `-ImageTag`.

La version corregida del script valida la imagen antes del despliegue y debe mostrar un mensaje controlado parecido a:

```text
No existe la imagen requerida para identity-service: us-central1-docker.pkg.dev/.../identity-service:tag-no-publicado.
Publique la imagen en Artifact Registry o use un -ImageTag existente.
```

Verificar el tag que si existe actualmente:

```powershell
& "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd" artifacts docker images describe `
  "us-central1-docker.pkg.dev/project-fbb34cd7-0b82-43e1-867/venta-pasajes-dev/identity-service:0.1.0-native" `
  --project "project-fbb34cd7-0b82-43e1-867"
```

Si el intento fallido dejo el servicio creado sin una revision util, revisar y borrar:

```powershell
gcloud run services describe identity-service `
  --project "project-fbb34cd7-0b82-43e1-867" `
  --region "us-central1"

gcloud run services delete identity-service `
  --project "project-fbb34cd7-0b82-43e1-867" `
  --region "us-central1" `
  --quiet
```

### gcloud no se reconoce

Configurar la ruta:

```powershell
$env:GCLOUD_PATH = "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd"
```

O pasarla directo:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\deploy-cloudrun-dev.ps1 `
  -GcloudPath "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd"
```

### gcloud.ps1 muestra NativeCommandError

Si PowerShell muestra errores desde:

```text
C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.ps1
```

usar `gcloud.cmd`:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\deploy-cloudrun-dev.ps1 `
  -ImageTag 0.1.0-native `
  -ServiceIds identity-service,dispatch-service,ticketing-service `
  -GcloudPath "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd"
```

La version corregida del script ya prefiere `gcloud.cmd` cuando existe.

### Error: Invalid choice 'run deploy ...'

Si `gcloud` responde algo parecido a:

```text
Invalid choice: 'run deploy identity-service ...'
```

significa que PowerShell paso todo `run deploy ...` como un solo argumento. Usar la version corregida de:

```text
C:\VENTA-DE-PASAJES\scripts\deploy-cloudrun-dev.ps1
```

La version corregida ejecuta `gcloud` con argumentos separados mediante splatting real.

### Error: no se encontro Python

Si aparece:

```text
no se encontro Python; ejecutar sin argumentos para instalar desde Microsoft Store
```

definir Python para Google Cloud SDK:

```powershell
$env:CLOUDSDK_PYTHON = "C:\Python312\python.exe"
gcloud version
```

En esta maquina se verifico que existe:

```text
C:\Python312\python.exe
```

Tambien se puede pasar la ruta directamente al script:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\deploy-cloudrun-dev.ps1 `
  -ImageTag 0.1.0-native `
  -ServiceIds identity-service,dispatch-service,ticketing-service `
  -CloudSdkPython "C:\Python312\python.exe"
```

Si ese archivo no existe, instalar Python o usar la ruta real donde este instalado. El script intenta usar `C:\Python312\python.exe` automaticamente cuando existe.

### Backends privados no responden desde curl local

Los backends estan planificados con `--no-allow-unauthenticated`. Para probar desde consola se requiere identidad autorizada o temporalmente permitir invocacion en dev.

## Estado final y siguiente paso natural

```text
El proyecto ya tiene un plan reproducible de Cloud Run dev.
Falta publicar imagenes completas de todos los servicios y frontends en Artifact Registry.
El siguiente paso natural es crear build/publish de imagenes para backend y frontend, o ejecutar el primer despliegue dev cuando existan las imagenes.
```
