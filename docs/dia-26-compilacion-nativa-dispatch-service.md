# Dia 26 - Compilacion nativa de dispatch-service

Fecha de ejecucion: 2026-09-10

## Objetivo

Compilar `dispatch-service` como binario nativo Quarkus, construir una imagen Docker apta para Cloud Run, validarla localmente con PostgreSQL temporal, publicarla en Artifact Registry dev y medir arranque/consumo.

Este documento deja una guia manual completa para repetir el proceso desde cero. Primero muestra la reversa para limpiar lo creado y luego el camino hacia el objetivo.

## Resultado logrado

```text
Se agrego Dockerfile nativo para dispatch-service.
Se agrego script asistido de build nativo, Docker build, tag y push.
Se agrego script asistido de prueba local con PostgreSQL temporal.
Se ejecutaron pruebas JVM del servicio.
Se genero una imagen nativa local de dispatch-service.
Se valido la imagen local con Flyway y PostgreSQL temporal.
Se publico la imagen en Artifact Registry dev.
```

Imagen publicada:

```text
us-central1-docker.pkg.dev/project-fbb34cd7-0b82-43e1-867/venta-pasajes-dev/dispatch-service:0.1.0-native
```

Digest remoto final:

```text
sha256:b7d59817c20e7cf477ff661ae28c7c97eb94d37512e3c6a5eb7a3cb751ec4d7a
```

## Archivos principales

```text
C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\docker\Dockerfile.native
C:\VENTA-DE-PASAJES\scripts\build-dispatch-service-native.ps1
C:\VENTA-DE-PASAJES\scripts\verify-dispatch-service-native-local.ps1
C:\VENTA-DE-PASAJES\services\dispatch-service\README.md
C:\VENTA-DE-PASAJES\docs\dia-26-compilacion-nativa-dispatch-service.md
C:\VENTA-DE-PASAJES\vitacora.md
```

## Valores usados

```text
Proyecto GCP: project-fbb34cd7-0b82-43e1-867
Region: us-central1
Repositorio Artifact Registry: venta-pasajes-dev
Imagen local: dispatch-service:0.1.0-native
Imagen remota: us-central1-docker.pkg.dev/project-fbb34cd7-0b82-43e1-867/venta-pasajes-dev/dispatch-service:0.1.0-native
Puerto interno del contenedor: 8082
Puerto local de prueba nativa: 18089
Puerto local de PostgreSQL temporal: 55441
Base de datos temporal: dispatch_db
Perfil Quarkus usado para prueba local: onprem
Proveedor de secretos en prueba local: env
```

## Reversa primero

Esta seccion sirve para dejar limpio el ambiente antes de repetir el proceso.

### Paso R1 - Detener contenedores temporales

```powershell
cd C:\VENTA-DE-PASAJES

docker rm -f venta-pasajes-dispatch-native-app-manual 2>$null
docker rm -f venta-pasajes-dispatch-native-pg-manual 2>$null
docker network rm venta-pasajes-dispatch-native-manual 2>$null
```

Si usaste el script asistido, los contenedores tienen nombres con el PID de PowerShell y normalmente se limpian solos. Para revisar si quedo algo:

```powershell
docker ps -a --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}" |
  Select-String -Pattern "dispatch-native"
```

### Paso R2 - Borrar imagen local

```powershell
docker rmi dispatch-service:0.1.0-native 2>$null
docker rmi us-central1-docker.pkg.dev/project-fbb34cd7-0b82-43e1-867/venta-pasajes-dev/dispatch-service:0.1.0-native 2>$null
```

Verificar:

```powershell
docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.ID}}\t{{.Size}}" |
  Select-String -Pattern "dispatch-service"
```

Si no devuelve nada, la imagen local ya no existe.

### Paso R3 - Quitar la imagen de Artifact Registry

Atencion: esto elimina la imagen remota. No ejecutar si Cloud Run u otro ambiente depende de ella.

Definir variables:

```powershell
$ProjectId = "project-fbb34cd7-0b82-43e1-867"
$Region = "us-central1"
$Repository = "venta-pasajes-dev"
$ImageName = "dispatch-service"
$ImageTag = "0.1.0-native"
$RemoteImage = "$Region-docker.pkg.dev/$ProjectId/$Repository/${ImageName}:$ImageTag"
$Gcloud = "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd"
$env:CLOUDSDK_PYTHON = "C:\Python312\python.exe"
```

Ver tags:

```powershell
& $Gcloud artifacts docker tags list `
  "$Region-docker.pkg.dev/$ProjectId/$Repository/$ImageName" `
  --project=$ProjectId `
  --format="table(tag,digest,version)"
```

Borrar la imagen/tag:

```powershell
& $Gcloud artifacts docker images delete $RemoteImage `
  --project=$ProjectId `
  --delete-tags `
  --quiet
```

Validar que ya no esta el tag:

```powershell
& $Gcloud artifacts docker tags list `
  "$Region-docker.pkg.dev/$ProjectId/$Repository/$ImageName" `
  --project=$ProjectId `
  --filter="tag:$ImageTag"
```

### Paso R4 - Si se elimino el repositorio completo

Normalmente no borres el repositorio completo, porque `venta-pasajes-dev` tambien puede contener otras imagenes como `identity-service`.

Si aun asi quieres revisar si existe:

```powershell
& $Gcloud artifacts repositories describe $Repository `
  --project=$ProjectId `
  --location=$Region
```

Si responde `NOT_FOUND`, se puede recrear asi:

```powershell
& $Gcloud services enable artifactregistry.googleapis.com --project=$ProjectId

& $Gcloud artifacts repositories create $Repository `
  --project=$ProjectId `
  --location=$Region `
  --repository-format=docker `
  --description="Venta de Pasajes development Docker images"
```

## Guia manual desde cero

### Paso 1 - Ubicarse en el proyecto

```powershell
cd C:\VENTA-DE-PASAJES
```

Validar herramientas:

```powershell
mvn -version
docker version
& "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd" --version
```

### Paso 2 - Revisar procesos que pueden bloquear el build

En Windows, si hay un `java.exe` ejecutando `dispatch-service`, puede bloquear archivos de `target`.

```powershell
Get-NetTCPConnection -LocalPort 8082,18089,55441 -ErrorAction SilentlyContinue |
  Select-Object LocalAddress,LocalPort,State,OwningProcess |
  Format-Table -AutoSize
```

Revisar procesos Java:

```powershell
Get-CimInstance Win32_Process -Filter "name = 'java.exe'" |
  Select-Object ProcessId,CommandLine |
  Format-List
```

Si identificas un proceso propio de `dispatch-service`, detenerlo:

```powershell
Stop-Process -Id <process-id> -Force
```

Si PowerShell responde `Acceso denegado`, usar el build asistido con `-UseCleanWorkspace`, que compila en una copia temporal y evita tocar el `target` bloqueado.

### Paso 3 - Verificar Dockerfile nativo

Archivo:

```text
C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\docker\Dockerfile.native
```

Contenido esperado:

```dockerfile
FROM registry.access.redhat.com/ubi9/ubi-minimal:9.6

WORKDIR /work/

COPY target/*-runner /work/application

RUN chmod 775 /work/application \
    && chown 1001:root /work/application

EXPOSE 8082

ENV QUARKUS_HTTP_HOST=0.0.0.0
ENV QUARKUS_HTTP_PORT=8082

USER 1001

ENTRYPOINT ["./application"]
```

Verificar:

```powershell
Test-Path .\services\dispatch-service\src\main\docker\Dockerfile.native
Get-Content .\services\dispatch-service\src\main\docker\Dockerfile.native
```

### Paso 4 - Ejecutar pruebas JVM

```powershell
mvn -f .\services\dispatch-service\pom.xml test
```

Resultado logrado en este dia:

```text
Tests run: 24, Failures: 0, Errors: 0, Skipped: 0
BUILD SUCCESS
```

### Paso 5 - Compilar binario nativo

Este comando usa Docker para ejecutar Mandrel/GraalVM. Por eso no necesitas instalar GraalVM manualmente en Windows.

```powershell
mvn -f .\services\dispatch-service\pom.xml package `
  "-Dnative" `
  "-DskipTests" `
  "-Dquarkus.native.container-build=true" `
  "-Dquarkus.native.builder-image=quay.io/quarkus/ubi9-quarkus-mandrel-builder-image:jdk-21"
```

Notas importantes:

```text
Cada parametro -D va entre comillas para que PowerShell no lo interprete mal.
El builder usado es quay.io/quarkus/ubi9-quarkus-mandrel-builder-image:jdk-21.
El binario esperado queda como target\dispatch-service-0.1.0-SNAPSHOT-runner.
```

Si hay archivos bloqueados o no puedes detener el proceso Java, ejecutar el flujo asistido en copia temporal:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-dispatch-service-native.ps1 -UseCleanWorkspace
```

Resultado real de este dia:

```text
Running Quarkus native-image plugin on MANDREL 23.1.12.1 JDK 21.0.12.1+1-LTS
Finished generating 'dispatch-service-0.1.0-SNAPSHOT-runner' in 1m 1s.
BUILD SUCCESS
Tiempo total Maven native: 02:47 min
Runner: 105,070,832 bytes
```

### Paso 6 - Verificar el runner

Si compilaste directamente dentro de `services\dispatch-service`:

```powershell
Get-ChildItem .\services\dispatch-service\target |
  Where-Object { $_.Name -like "*-runner" -and $_.Name -notlike "*.jar" } |
  Select-Object Name,Length,LastWriteTime |
  Format-Table -AutoSize
```

Si usaste `-UseCleanWorkspace`, el script imprime el path temporal, por ejemplo:

```text
C:\Users\diego.martinezc\AppData\Local\Temp\venta-pasajes-dispatch-native-32948\dispatch-service\target\dispatch-service-0.1.0-SNAPSHOT-runner
```

### Paso 7 - Construir imagen Docker local

Si compilaste manualmente en el servicio:

```powershell
docker build --pull `
  -f .\services\dispatch-service\src\main\docker\Dockerfile.native `
  -t dispatch-service:0.1.0-native `
  .\services\dispatch-service
```

Verificar imagen:

```powershell
docker image inspect dispatch-service:0.1.0-native --format "{{.Id}} {{.Size}}"
docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.ID}}\t{{.Size}}" |
  Select-String -Pattern "dispatch-service"
```

Resultado real de este dia:

```text
Image ID: sha256:b7d59817c20e7cf477ff661ae28c7c97eb94d37512e3c6a5eb7a3cb751ec4d7a
docker image inspect size: 109,532,221 bytes
```

### Paso 8 - Probar localmente con PostgreSQL temporal

Crear red:

```powershell
docker network create venta-pasajes-dispatch-native-manual
```

Crear password temporal solo para esta prueba:

```powershell
$DbPassword = [Guid]::NewGuid().ToString("N")
```

Levantar PostgreSQL:

```powershell
docker run --name venta-pasajes-dispatch-native-pg-manual `
  --network venta-pasajes-dispatch-native-manual `
  -e POSTGRES_DB=dispatch_db `
  -e POSTGRES_USER=postgres `
  -e "POSTGRES_PASSWORD=$DbPassword" `
  -p "55441:5432" `
  -d postgres:16-alpine
```

Esperar readiness de PostgreSQL:

```powershell
docker exec venta-pasajes-dispatch-native-pg-manual `
  pg_isready -U postgres -d dispatch_db
```

Levantar `dispatch-service` nativo:

```powershell
docker run --name venta-pasajes-dispatch-native-app-manual `
  --network venta-pasajes-dispatch-native-manual `
  -p "18089:8082" `
  -e APP_ENV=onprem `
  -e APP_RUNTIME_TARGET=onprem `
  -e APP_SECRETS_PROVIDER=env `
  -e QUARKUS_PROFILE=onprem `
  -e QUARKUS_HTTP_PORT=8082 `
  -e QUARKUS_FLYWAY_MIGRATE_AT_START=true `
  -e APP_DB_NAME=dispatch_db `
  -e "APP_DB_JDBC_URL=jdbc:postgresql://venta-pasajes-dispatch-native-pg-manual:5432/dispatch_db" `
  -e APP_DB_USERNAME=postgres `
  -e "APP_DB_PASSWORD=$DbPassword" `
  -e APP_LOG_CONSOLE_JSON=false `
  -d dispatch-service:0.1.0-native
```

### Paso 9 - Probar health con curl.exe

Health tecnico de Quarkus:

```powershell
curl.exe -i -S "http://localhost:18089/q/health/ready"
```

Health del dominio:

```powershell
curl.exe -i -S "http://localhost:18089/api/v1/dispatch/health"
```

Respuesta esperada del health del dominio:

```json
{
  "status": "ok",
  "service": "dispatch-service",
  "runtime": "quarkus"
}
```

### Paso 10 - Probar endpoints funcionales con curl.exe

Overview del dominio:

```powershell
curl.exe -sS "http://localhost:18089/api/v1/dispatch"
```

Recursos administrados:

```powershell
curl.exe -sS "http://localhost:18089/api/v1/dispatch/resources"
```

Consultar layout seed:

```powershell
curl.exe -sS "http://localhost:18089/api/v1/dispatch/seat-layouts?q=Legacy%2025%20asientos&active=true&page=1&page_size=10"
```

Crear terminal:

```powershell
$ActorId = "00000000-0000-0000-0000-000000000026"
$CorrelationId = "00000000-0000-0000-0000-000000000226"

$TerminalBody = @{
  legacy_id = 2601
  local_code = "D26"
  name = "Terminal Native Dia 26"
  manager_name = "Operador Native"
  address = "Av. Native Dia 26"
  phone = "022600001"
  email = "native26@example.local"
} | ConvertTo-Json -Compress

$TerminalBodyPath = Join-Path $env:TEMP "dispatch-native-terminal.json"
$TerminalBody | Set-Content -LiteralPath $TerminalBodyPath -Encoding ascii

curl.exe -i -S -X POST "http://localhost:18089/api/v1/dispatch/terminals" `
  -H "Content-Type: application/json" `
  -H "X-Actor-User-Id: $ActorId" `
  -H "X-Correlation-Id: $CorrelationId" `
  --data-binary "@$TerminalBodyPath"
```

Listar terminales:

```powershell
curl.exe -sS "http://localhost:18089/api/v1/dispatch/terminals?page=1&page_size=10"
```

### Paso 11 - Medir arranque y consumo

Ver logs de arranque:

```powershell
docker logs venta-pasajes-dispatch-native-app-manual |
  Select-String -Pattern "started in|Listening on"
```

Ver consumo puntual:

```powershell
docker stats venta-pasajes-dispatch-native-app-manual --no-stream --format "{{json .}}"
```

Resultado medido por el script en este dia:

```text
startup_ms: 1469
memory_usage: 75.96MiB / 15.47GiB
cpu_percent: 0.00%
health_status: ok
resources_count: 6
seed_layout_count: 1
```

### Paso 12 - Detener prueba local manual

```powershell
docker rm -f venta-pasajes-dispatch-native-app-manual
docker rm -f venta-pasajes-dispatch-native-pg-manual
docker network rm venta-pasajes-dispatch-native-manual
```

### Paso 13 - Flujo asistido equivalente

El script de validacion automatiza los pasos de PostgreSQL temporal, arranque nativo, curls funcionales y medicion.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-dispatch-service-native-local.ps1
```

Resultado real de este dia:

```json
{
  "service": "dispatch-service",
  "runtime": "native-container",
  "image": "dispatch-service:0.1.0-native",
  "quarkus_profile": "onprem",
  "database": "dispatch_db",
  "migration_tool": "flyway",
  "http_port": 18089,
  "database_port": 55441,
  "startup_ms": 1469,
  "health_status": "ok",
  "overview_service": "dispatch-service",
  "resources_count": 6,
  "seed_layout_count": 1,
  "ready": true
}
```

## Publicar en Artifact Registry dev

### Paso 14 - Definir variables

```powershell
$ProjectId = "project-fbb34cd7-0b82-43e1-867"
$Region = "us-central1"
$Repository = "venta-pasajes-dev"
$ImageName = "dispatch-service"
$ImageTag = "0.1.0-native"
$LocalImage = "${ImageName}:$ImageTag"
$RemoteImage = "$Region-docker.pkg.dev/$ProjectId/$Repository/${ImageName}:$ImageTag"
$Gcloud = "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd"
$env:CLOUDSDK_PYTHON = "C:\Python312\python.exe"
```

Validar proyecto:

```powershell
& $Gcloud config get-value project
```

Si no es el proyecto correcto:

```powershell
& $Gcloud config set project $ProjectId
```

### Paso 15 - Verificar o crear repositorio

Verificar:

```powershell
& $Gcloud artifacts repositories describe $Repository `
  --project=$ProjectId `
  --location=$Region
```

Si no existe:

```powershell
& $Gcloud services enable artifactregistry.googleapis.com --project=$ProjectId

& $Gcloud artifacts repositories create $Repository `
  --project=$ProjectId `
  --location=$Region `
  --repository-format=docker `
  --description="Venta de Pasajes development Docker images"
```

### Paso 16 - Autenticar Docker contra Artifact Registry

```powershell
& $Gcloud auth configure-docker "$Region-docker.pkg.dev" --quiet
```

### Paso 17 - Etiquetar imagen

```powershell
docker tag $LocalImage $RemoteImage
```

Verificar tag local:

```powershell
docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.ID}}\t{{.Size}}" |
  Select-String -Pattern "dispatch-service"
```

### Paso 18 - Subir imagen

```powershell
docker push $RemoteImage
```

Resultado real de este dia:

```text
0.1.0-native: digest: sha256:b7d59817c20e7cf477ff661ae28c7c97eb94d37512e3c6a5eb7a3cb751ec4d7a size: 856
```

### Paso 19 - Verificar imagen publicada

Listar imagenes:

```powershell
& $Gcloud artifacts docker images list `
  "$Region-docker.pkg.dev/$ProjectId/$Repository/$ImageName" `
  --project=$ProjectId `
  --include-tags `
  --format="table(package,version,tags,createTime,updateTime,imageSizeBytes)"
```

Listar tags:

```powershell
& $Gcloud artifacts docker tags list `
  "$Region-docker.pkg.dev/$ProjectId/$Repository/$ImageName" `
  --project=$ProjectId `
  --format="table(tag,digest,version)"
```

Inspeccionar manifiesto OCI:

```powershell
docker manifest inspect $RemoteImage
```

Resultado observado:

```text
La etiqueta 0.1.0-native apunta al digest sha256:b7d59817c20e7cf477ff661ae28c7c97eb94d37512e3c6a5eb7a3cb751ec4d7a.
Tambien aparecen digests adicionales sin tag: uno del manifiesto linux/amd64 y otro de attestation.
Esto es normal cuando Docker publica una imagen como indice OCI.
```

## Quitar y subir nuevamente la imagen

### Paso 20 - Quitar solo la imagen dispatch-service

```powershell
$ProjectId = "project-fbb34cd7-0b82-43e1-867"
$Region = "us-central1"
$Repository = "venta-pasajes-dev"
$ImageName = "dispatch-service"
$ImageTag = "0.1.0-native"
$RemoteImage = "$Region-docker.pkg.dev/$ProjectId/$Repository/${ImageName}:$ImageTag"
$Gcloud = "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd"
$env:CLOUDSDK_PYTHON = "C:\Python312\python.exe"

& $Gcloud artifacts docker images delete $RemoteImage `
  --project=$ProjectId `
  --delete-tags `
  --quiet
```

Validar:

```powershell
& $Gcloud artifacts docker tags list `
  "$Region-docker.pkg.dev/$ProjectId/$Repository/$ImageName" `
  --project=$ProjectId `
  --filter="tag:$ImageTag"
```

Si el listado de tags no devuelve filas y al borrar aparece:

```text
NOT_FOUND: Requested entity was not found.
```

significa que el tag `0.1.0-native` ya no existe. En ese caso, `$RemoteImage` ya no se puede borrar porque esa ruta apunta a una etiqueta inexistente.

Puede ocurrir que Artifact Registry todavia muestre digests sin tag. Eso pasa porque Docker publico un indice OCI y Artifact Registry separa el indice, el manifiesto de plataforma y la attestation.

Listar digests restantes:

```powershell
& $Gcloud artifacts docker images list `
  "$Region-docker.pkg.dev/$ProjectId/$Repository/$ImageName" `
  --project=$ProjectId `
  --include-tags `
  --format="table(package,version,tags,createTime,updateTime,imageSizeBytes)"
```

Si quieres borrar tambien esos digests sin tag, hacerlo por digest exacto:

```powershell
$Digest = "sha256:<digest-sin-tag>"

& $Gcloud artifacts docker images delete `
  "$Region-docker.pkg.dev/$ProjectId/$Repository/$ImageName@$Digest" `
  --project=$ProjectId `
  --quiet
```

Para este proyecto, si solo querias quitar el tag `0.1.0-native` antes de volver a subir, no necesitas borrar los digests sin tag. Puedes continuar con el paso de subir nuevamente.

### Paso 21 - Subir nuevamente

Si la imagen local todavia existe:

```powershell
docker image inspect dispatch-service:0.1.0-native --format "{{.Id}} {{.Size}}"
docker tag dispatch-service:0.1.0-native $RemoteImage
docker push $RemoteImage
```

Si la imagen local ya no existe, repetir desde el build:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-dispatch-service-native.ps1 -UseCleanWorkspace
docker push $RemoteImage
```

O hacer build y push en un solo flujo:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-dispatch-service-native.ps1 `
  -UseCleanWorkspace `
  -Push `
  -CreateRepository
```

## Ver en Google Cloud Console

Ruta visual:

```text
Google Cloud Console
Artifact Registry
Repositorios
venta-pasajes-dev
Paquetes
dispatch-service
Versiones
0.1.0-native
```

Tambien puedes abrir directamente en el navegador:

```text
https://console.cloud.google.com/artifacts/docker/project-fbb34cd7-0b82-43e1-867/us-central1/venta-pasajes-dev/dispatch-service?project=project-fbb34cd7-0b82-43e1-867
```

## Problemas y soluciones

| Problema | Causa probable | Solucion |
| --- | --- | --- |
| `Port 8082 is already in use` | Ya hay un `dispatch-service` o Java escuchando en 8082. | Revisar con `Get-NetTCPConnection`; detener el proceso o usar otro puerto. |
| `Acceso denegado` al detener `java.exe` | El proceso fue iniciado con otro privilegio. | Usar `-UseCleanWorkspace` para compilar en copia temporal. |
| Maven interpreta mal `Dquarkus.native.builder-image` | Falta el guion inicial o PowerShell separo mal el parametro. | Usar `"-Dquarkus.native.builder-image=..."`. |
| `Repository "venta-pasajes-dev" not found` | El repositorio fue eliminado en la consola. | Crear el repositorio con `gcloud artifacts repositories create`. |
| `Connection to localhost:5432 refused` | El contenedor usa `localhost` dentro de Docker, no el host. | En Docker network usar el nombre del contenedor PostgreSQL en la URL JDBC. |
| `curl: Failed to connect` | El contenedor de la app no esta levantado o el puerto no fue publicado. | Revisar `docker ps` y `docker logs`. |
| En consola aparecen varias filas/digests | Artifact Registry muestra indice OCI, manifiesto de plataforma y attestation. | Validar que el tag `0.1.0-native` apunte al digest final esperado. |

## Comandos ejecutados en este dia

```powershell
Select-String -Path .\tareas.md -Pattern "### Dia 26|### Dia 26" -Context 0,28
Select-String -Path .\services\dispatch-service\pom.xml -Pattern "quarkus-maven-plugin|native|container-image|postgresql|jdbc|flyway|hibernate|profile" -Context 2,3
Get-Content .\services\dispatch-service\src\main\resources\application.properties
Get-ChildItem .\services\dispatch-service\src\main\docker -ErrorAction SilentlyContinue
Get-Content .\services\identity-service\src\main\docker\Dockerfile.native
Get-CimInstance Win32_Process -Filter "ProcessId = 50660" | Select-Object ProcessId,Name,CommandLine | Format-List
Get-NetTCPConnection -LocalPort 8082 -ErrorAction SilentlyContinue | Select-Object LocalAddress,LocalPort,State,OwningProcess | Format-Table -AutoSize
Stop-Process -Id 50660 -Force
mvn -f .\services\dispatch-service\pom.xml test
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-dispatch-service-native.ps1 -UseCleanWorkspace
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-dispatch-service-native-local.ps1
& "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd" auth configure-docker us-central1-docker.pkg.dev --quiet
docker push us-central1-docker.pkg.dev/project-fbb34cd7-0b82-43e1-867/venta-pasajes-dev/dispatch-service:0.1.0-native
& "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd" artifacts docker images list us-central1-docker.pkg.dev/project-fbb34cd7-0b82-43e1-867/venta-pasajes-dev/dispatch-service --project=project-fbb34cd7-0b82-43e1-867 --include-tags --format="table(package,version,tags,createTime,updateTime,imageSizeBytes)"
docker manifest inspect us-central1-docker.pkg.dev/project-fbb34cd7-0b82-43e1-867/venta-pasajes-dev/dispatch-service:0.1.0-native
```

## Estado final

```text
dispatch-service esta listo como imagen nativa para Cloud Run.
Imagen local: dispatch-service:0.1.0-native
Imagen remota: us-central1-docker.pkg.dev/project-fbb34cd7-0b82-43e1-867/venta-pasajes-dev/dispatch-service:0.1.0-native
Digest remoto: sha256:b7d59817c20e7cf477ff661ae28c7c97eb94d37512e3c6a5eb7a3cb751ec4d7a
Validacion local: OK
Artifact Registry dev: OK
```
