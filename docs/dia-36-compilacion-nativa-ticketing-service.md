# Dia 36 - Compilacion nativa de ticketing-service

Fecha de ejecucion: 2026-09-15

## Objetivo

Preparar `ticketing-service` para despliegue como servicio nativo Quarkus, con imagen Docker publicada en Artifact Registry dev y validacion funcional local contra PostgreSQL.

Este documento tambien deja una guia manual completa para repetir el proceso desde cero. Primero muestra la reversa para limpiar lo creado y luego el camino hacia el objetivo.

Alcance del dia:

```text
Configurar build nativo.
Resolver problemas de transacciones y drivers.
Ejecutar pruebas unitarias e integracion.
Publicar imagen en Artifact Registry dev.
Medir arranque y consumo.
```

## Resultado logrado

```text
Se configuro el perfil native con container-build y Mandrel JDK 21.
Se incluyeron migraciones Flyway dentro del binario nativo.
Se agrego Dockerfile.native para runtime UBI minimal en puerto 8083.
Se agrego script de build, tag y push para ticketing-service.
Se agrego script de verificacion nativa local con PostgreSQL temporal.
Se ejecuto mvn test: 27 pruebas OK.
Se genero binario nativo y Docker image local.
Se valido flujo funcional en native: pasajero, disponibilidad, reserva, expiracion, venta, duplicado 409 y anulacion.
Se publico la imagen en Artifact Registry dev.
```

## Archivos creados

```text
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\docker\Dockerfile.native
C:\VENTA-DE-PASAJES\scripts\build-ticketing-service-native.ps1
C:\VENTA-DE-PASAJES\scripts\verify-ticketing-service-native-local.ps1
C:\VENTA-DE-PASAJES\docs\dia-36-compilacion-nativa-ticketing-service.md
```

## Archivos modificados

```text
C:\VENTA-DE-PASAJES\services\ticketing-service\pom.xml
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\resources\application.properties
C:\VENTA-DE-PASAJES\services\ticketing-service\README.md
C:\VENTA-DE-PASAJES\vitacora.md
```

## Imagen generada

```text
Imagen local:
ticketing-service:0.1.0-native

Imagen Artifact Registry:
us-central1-docker.pkg.dev/project-fbb34cd7-0b82-43e1-867/venta-pasajes-dev/ticketing-service:0.1.0-native

Digest:
sha256:6613d98994de7bec869b950ae5e9e0241954a3b71ee690c2b0a5fef17d06ca13
```

Medidas del build:

```text
Native runner: 105079024 bytes
Docker image: 109751256 bytes
maven-native-build: 80970 ms
docker-build: 7288 ms
docker-push: 81487 ms
```

## Valores usados

```text
Proyecto GCP: project-fbb34cd7-0b82-43e1-867
Region: us-central1
Repositorio Artifact Registry: venta-pasajes-dev
Imagen local: ticketing-service:0.1.0-native
Imagen remota: us-central1-docker.pkg.dev/project-fbb34cd7-0b82-43e1-867/venta-pasajes-dev/ticketing-service:0.1.0-native
Puerto interno del contenedor: 8083
Puerto local de prueba nativa: 18096
Puerto local de PostgreSQL temporal: 55452
Base de datos temporal: ticketing_db
Perfil Quarkus usado para prueba local: onprem
Proveedor de secretos en prueba local: env
Builder native: quay.io/quarkus/ubi9-quarkus-mandrel-builder-image:jdk-21
```

## Reversa primero

Esta seccion sirve para dejar limpio el ambiente antes de repetir el proceso desde cero.

### Paso R1 - Detener contenedores y redes temporales

```powershell
cd C:\VENTA-DE-PASAJES

docker ps -a --filter "name=venta-pasajes-ticketing-native" --format "{{.Names}}" |
  ForEach-Object { docker rm -f $_ }

docker network ls --filter "name=venta-pasajes-ticketing-native" --format "{{.Name}}" |
  ForEach-Object { docker network rm $_ }
```

Si se hicieron pruebas manuales con nombres fijos:

```powershell
docker rm -f venta-pasajes-ticketing-native-app-manual 2>$null
docker rm -f venta-pasajes-ticketing-native-pg-manual 2>$null
docker network rm venta-pasajes-ticketing-native-manual 2>$null
```

Verificar:

```powershell
docker ps -a --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}" |
  Select-String -Pattern "ticketing-native"

docker network ls --format "table {{.Name}}\t{{.Driver}}" |
  Select-String -Pattern "ticketing-native"
```

### Paso R2 - Liberar puertos temporales

```powershell
Get-NetTCPConnection -LocalPort 18096,55452 -ErrorAction SilentlyContinue |
  Select-Object LocalAddress,LocalPort,State,OwningProcess |
  Format-Table -AutoSize
```

Si aparece un proceso propio de la prueba nativa, detenerlo:

```powershell
Stop-Process -Id <process-id> -Force
```

### Paso R3 - Borrar imagenes locales

```powershell
docker rmi ticketing-service:0.1.0-native 2>$null
docker rmi us-central1-docker.pkg.dev/project-fbb34cd7-0b82-43e1-867/venta-pasajes-dev/ticketing-service:0.1.0-native 2>$null
```

Verificar:

```powershell
docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.ID}}\t{{.Size}}" |
  Select-String -Pattern "ticketing-service"
```

Si no devuelve nada, la imagen local ya no existe.

### Paso R4 - Quitar la imagen de Artifact Registry

Atencion: esto elimina la imagen remota. No ejecutar si Cloud Run u otro ambiente depende de ella.

Definir variables:

```powershell
$ProjectId = "project-fbb34cd7-0b82-43e1-867"
$Region = "us-central1"
$Repository = "venta-pasajes-dev"
$ImageName = "ticketing-service"
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

### Paso R5 - Si se elimino el repositorio completo

Normalmente no borres el repositorio completo, porque `venta-pasajes-dev` tambien contiene otras imagenes del proyecto.

Revisar si existe:

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

Si `gcloud` muestra problemas con Python en Windows, fijar el Python instalado:

```powershell
$env:CLOUDSDK_PYTHON = "C:\Python312\python.exe"
```

### Paso 2 - Revisar puertos y procesos que pueden bloquear

```powershell
Get-NetTCPConnection -LocalPort 8083,18096,55452 -ErrorAction SilentlyContinue |
  Select-Object LocalAddress,LocalPort,State,OwningProcess |
  Format-Table -AutoSize
```

Revisar procesos Java:

```powershell
Get-CimInstance Win32_Process -Filter "name = 'java.exe'" |
  Select-Object ProcessId,CommandLine |
  Format-List
```

Si identificas un proceso propio de `ticketing-service`, detenerlo:

```powershell
Stop-Process -Id <process-id> -Force
```

Si PowerShell responde `Acceso denegado`, usar el build asistido con `-UseCleanWorkspace`, que compila en una copia temporal y evita tocar el `target` bloqueado.

### Paso 3 - Verificar configuracion nativa

Dockerfile:

```powershell
Test-Path .\services\ticketing-service\src\main\docker\Dockerfile.native
Get-Content .\services\ticketing-service\src\main\docker\Dockerfile.native
```

Configuracion Maven y recursos nativos:

```powershell
Select-String -Path .\services\ticketing-service\pom.xml `
  -Pattern "quarkus.native.container-build|quarkus.native.builder-image"

Select-String -Path .\services\ticketing-service\src\main\resources\application.properties `
  -Pattern "quarkus.native.resources.includes"
```

Valores esperados:

```text
quarkus.native.container-build=true
quarkus.native.builder-image=quay.io/quarkus/ubi9-quarkus-mandrel-builder-image:jdk-21
quarkus.native.resources.includes=db/migration/*.sql
```

### Paso 4 - Ejecutar pruebas JVM

```powershell
mvn -f .\services\ticketing-service\pom.xml test
```

Resultado logrado en este dia:

```text
Tests run: 27, Failures: 0, Errors: 0, Skipped: 0
BUILD SUCCESS
```

### Paso 5 - Compilar binario nativo e imagen local con script

Este comando usa Docker para ejecutar Mandrel/GraalVM. No necesitas instalar GraalVM manualmente en Windows.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-ticketing-service-native.ps1 -UseCleanWorkspace
```

Resultado logrado en este dia:

```json
{"service":"ticketing-service","native_runner":"C:\\Users\\diego.martinezc\\AppData\\Local\\Temp\\venta-pasajes-ticketing-native-67412\\ticketing-service\\target\\ticketing-service-0.1.0-SNAPSHOT-runner","native_runner_bytes":105079024,"build_workspace":"C:\\Users\\diego.martinezc\\AppData\\Local\\Temp\\venta-pasajes-ticketing-native-67412","local_image":"ticketing-service:0.1.0-native","artifact_image":"us-central1-docker.pkg.dev/project-fbb34cd7-0b82-43e1-867/venta-pasajes-dev/ticketing-service:0.1.0-native","pushed":false,"timings":[{"name":"maven-native-build","elapsed_ms":80970},{"name":"docker-build","elapsed_ms":7288}],"image_id":"sha256:6613d98994de7bec869b950ae5e9e0241954a3b71ee690c2b0a5fef17d06ca13","image_size_bytes":109751256,"ready":true}
```

Verificar imagen local:

```powershell
docker image inspect ticketing-service:0.1.0-native --format "{{.Id}} {{.Size}}"
```

Resultado esperado:

```text
sha256:6613d98994de7bec869b950ae5e9e0241954a3b71ee690c2b0a5fef17d06ca13 109751256
```

### Paso 6 - Alternativa manual sin script de build

Compilar native:

```powershell
mvn -f .\services\ticketing-service\pom.xml package `
  "-Dnative" `
  "-DskipTests" `
  "-Dquarkus.native.container-build=true" `
  "-Dquarkus.native.builder-image=quay.io/quarkus/ubi9-quarkus-mandrel-builder-image:jdk-21"
```

Construir imagen Docker:

```powershell
docker build --pull `
  -f .\services\ticketing-service\src\main\docker\Dockerfile.native `
  -t ticketing-service:0.1.0-native `
  .\services\ticketing-service
```

Etiquetar imagen remota:

```powershell
docker tag ticketing-service:0.1.0-native `
  us-central1-docker.pkg.dev/project-fbb34cd7-0b82-43e1-867/venta-pasajes-dev/ticketing-service:0.1.0-native
```

### Paso 7 - Validar imagen nativa local

Ruta asistida recomendada:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-ticketing-service-native-local.ps1 `
  -ImageTag ticketing-service:0.1.0-native `
  -HttpPort 18096 `
  -DatabasePort 55452
```

Resultado logrado en este dia:

```json
{"service":"ticketing-service","runtime":"native-container","image":"ticketing-service:0.1.0-native","quarkus_profile":"onprem","database":"ticketing_db","migration_tool":"flyway","http_port":18096,"database_port":55452,"startup_ms":1450,"health_status":"ok","overview_service":"ticketing-service","resources_count":6,"seat_statuses":5,"reservation_statuses":5,"ticket_statuses":4,"passenger_status":"ACTIVE","synced_total_seats":4,"reservation_status":"PENDING","expired_reservations":1,"ticket_status":"ISSUED","ticket_number":"TKT-05BBC9EF19F3","sold_seat_status":"SOLD","duplicate_ticket_http_status":409,"cancelled_ticket_status":"VOIDED","memory_usage":"44.27MiB / 15.47GiB","cpu_percent":"0.02%","network":"venta-pasajes-ticketing-native-880","ready":true}
```

### Paso 8 - Validacion manual minima sin script

Crear red y base temporal:

```powershell
$NetworkName = "venta-pasajes-ticketing-native-manual"
$PostgresContainer = "venta-pasajes-ticketing-native-pg-manual"
$ServiceContainer = "venta-pasajes-ticketing-native-app-manual"
$DatabaseName = "ticketing_db"
$DatabaseUser = "postgres"
$DatabasePassword = "ticketing_native_manual_123"

docker network create $NetworkName

docker run --name $PostgresContainer `
  --network $NetworkName `
  -e POSTGRES_DB=$DatabaseName `
  -e POSTGRES_USER=$DatabaseUser `
  -e POSTGRES_PASSWORD=$DatabasePassword `
  -p 55452:5432 `
  -d postgres:16-alpine
```

Esperar PostgreSQL:

```powershell
docker run --rm --network $NetworkName postgres:16-alpine `
  pg_isready -h $PostgresContainer -p 5432 -U $DatabaseUser -d $DatabaseName
```

Levantar `ticketing-service` native:

```powershell
docker run --name $ServiceContainer `
  --network $NetworkName `
  -p 18096:8083 `
  -e APP_ENV=onprem `
  -e APP_RUNTIME_TARGET=onprem `
  -e APP_SECRETS_PROVIDER=env `
  -e QUARKUS_PROFILE=onprem `
  -e QUARKUS_HTTP_PORT=8083 `
  -e QUARKUS_FLYWAY_MIGRATE_AT_START=true `
  -e APP_RESERVATION_EXPIRATION_JOB_ENABLED=false `
  -e APP_DB_NAME=$DatabaseName `
  -e APP_DB_JDBC_URL="jdbc:postgresql://${PostgresContainer}:5432/$DatabaseName" `
  -e APP_DB_USERNAME=$DatabaseUser `
  -e APP_DB_PASSWORD=$DatabasePassword `
  -e APP_LOG_CONSOLE_JSON=false `
  -d ticketing-service:0.1.0-native
```

Validar health:

```powershell
curl.exe -sS "http://localhost:18096/q/health/ready"
curl.exe -sS "http://localhost:18096/api/v1/ticketing/health"
curl.exe -sS "http://localhost:18096/api/v1/ticketing/resources"
```

Medir consumo:

```powershell
docker stats $ServiceContainer --no-stream
```

Limpiar prueba manual:

```powershell
docker rm -f $ServiceContainer
docker rm -f $PostgresContainer
docker network rm $NetworkName
```

### Paso 9 - Publicar en Artifact Registry

Autenticacion Docker contra Artifact Registry:

```powershell
$Gcloud = "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd"
$env:CLOUDSDK_PYTHON = "C:\Python312\python.exe"

& $Gcloud auth configure-docker us-central1-docker.pkg.dev --quiet
```

Publicar con el script usando la imagen ya construida:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-ticketing-service-native.ps1 `
  -SkipNativeBuild `
  -SkipDockerBuild `
  -Push
```

Resultado logrado en este dia:

```json
{"service":"ticketing-service","native_runner":null,"native_runner_bytes":0,"build_workspace":null,"local_image":"ticketing-service:0.1.0-native","artifact_image":"us-central1-docker.pkg.dev/project-fbb34cd7-0b82-43e1-867/venta-pasajes-dev/ticketing-service:0.1.0-native","pushed":true,"timings":[{"name":"docker-push","elapsed_ms":81487}],"image_id":null,"image_size_bytes":null,"ready":true}
```

### Paso 10 - Confirmar imagen remota

```powershell
& $Gcloud artifacts docker images list `
  us-central1-docker.pkg.dev/project-fbb34cd7-0b82-43e1-867/venta-pasajes-dev/ticketing-service `
  --include-tags `
  --format="table[box](IMAGE,DIGEST,TAGS,UPDATE_TIME)" `
  --limit=5
```

Resultado logrado en este dia:

```text
IMAGE                                                                                           DIGEST                                                                  TAGS          UPDATE_TIME
us-central1-docker.pkg.dev/project-fbb34cd7-0b82-43e1-867/venta-pasajes-dev/ticketing-service   sha256:6613d98994de7bec869b950ae5e9e0241954a3b71ee690c2b0a5fef17d06ca13   0.1.0-native  2026-09-15T17:02:20
```

## Validacion funcional native

El script `scripts\verify-ticketing-service-native-local.ps1` ejecuta:

```text
1. Crea red Docker temporal.
2. Levanta PostgreSQL 16 temporal.
3. Levanta ticketing-service native con perfil onprem.
4. Espera /q/health/ready.
5. Consulta health, overview, resources y catalogos.
6. Crea pasajero.
7. Sincroniza una salida con asientos.
8. Reserva un asiento.
9. Expira la reserva.
10. Emite ticket.
11. Valida duplicado de venta con HTTP 409.
12. Confirma asiento SOLD.
13. Anula ticket.
14. Mide memoria y CPU con docker stats.
15. Limpia contenedores y red temporal.
```

Resultado:

```json
{"service":"ticketing-service","runtime":"native-container","image":"ticketing-service:0.1.0-native","quarkus_profile":"onprem","database":"ticketing_db","migration_tool":"flyway","http_port":18096,"database_port":55452,"startup_ms":1450,"health_status":"ok","overview_service":"ticketing-service","resources_count":6,"seat_statuses":5,"reservation_statuses":5,"ticket_statuses":4,"passenger_status":"ACTIVE","synced_total_seats":4,"reservation_status":"PENDING","expired_reservations":1,"ticket_status":"ISSUED","ticket_number":"TKT-05BBC9EF19F3","sold_seat_status":"SOLD","duplicate_ticket_http_status":409,"cancelled_ticket_status":"VOIDED","memory_usage":"44.27MiB / 15.47GiB","cpu_percent":"0.02%","network":"venta-pasajes-ticketing-native-880","ready":true}
```

## Artifact Registry

Consulta posterior al push:

```text
IMAGE                                                                                           DIGEST                                                                  TAGS
us-central1-docker.pkg.dev/project-fbb34cd7-0b82-43e1-867/venta-pasajes-dev/ticketing-service   sha256:6613d98994de7bec869b950ae5e9e0241954a3b71ee690c2b0a5fef17d06ca13   0.1.0-native
```

## Comandos ejecutados

```powershell
mvn -f .\services\ticketing-service\pom.xml test
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-ticketing-service-native.ps1 -UseCleanWorkspace
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-ticketing-service-native-local.ps1 -ImageTag ticketing-service:0.1.0-native -HttpPort 18096 -DatabasePort 55452
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-ticketing-service-native.ps1 -SkipNativeBuild -SkipDockerBuild -Push
gcloud artifacts docker images list us-central1-docker.pkg.dev/project-fbb34cd7-0b82-43e1-867/venta-pasajes-dev/ticketing-service --include-tags --format="table[box](IMAGE,DIGEST,TAGS,UPDATE_TIME)" --limit=5
```

## Resultados de pruebas

```text
mvn test:
Tests run: 27, Failures: 0, Errors: 0, Skipped: 0
BUILD SUCCESS

Native build:
BUILD SUCCESS

Native validation:
ready=true

Artifact Registry push:
0.1.0-native publicado con digest sha256:6613d98994de7bec869b950ae5e9e0241954a3b71ee690c2b0a5fef17d06ca13
```

## Limpieza

```text
Los puertos temporales 18096 y 55452 quedaron libres.
No quedaron contenedores temporales venta-pasajes-ticketing-native activos.
No quedaron redes Docker temporales venta-pasajes-ticketing-native activas.
```

## Criterio de avance

```text
Cumplido: Boleteria esta lista para desplegar como servicio nativo.
```
