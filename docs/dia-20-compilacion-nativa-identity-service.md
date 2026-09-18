# Dia 20 - Compilacion nativa de identity-service

Fecha: 2026-09-03

## Objetivo

Compilar `identity-service` como binario nativo Quarkus, construir una imagen Docker apta para Cloud Run, probarla localmente con PostgreSQL temporal y publicarla en Artifact Registry dev.

Este documento tambien deja una guia manual completa para repetir el proceso desde cero, quitar la imagen de Artifact Registry y subirla nuevamente.

## Resultado ejecutivo

Dia 20 completado.

Se genero una imagen nativa de `identity-service`, se valido localmente con PostgreSQL temporal y se publico en Artifact Registry:

```text
us-central1-docker.pkg.dev/project-fbb34cd7-0b82-43e1-867/venta-pasajes-dev/identity-service:0.1.0-native
```

Digest remoto final:

```text
sha256:7d1bde055269a8b70fa9eebee788b1cf5b63e33ee92dfcce13f0b3a93ade0ae8
```

## Conceptos rapidos

`identity-service` es el microservicio de identidad y accesos.

La compilacion nativa toma el codigo Java/Quarkus y genera un ejecutable Linux nativo. Ese ejecutable arranca mas rapido que un JAR tradicional porque no necesita iniciar una JVM completa de la misma forma.

La imagen Docker contiene ese ejecutable nativo y lo deja listo para ejecutarse en contenedores, por ejemplo Docker local, Cloud Run o un ambiente on-premise.

Artifact Registry es el repositorio privado de Google Cloud donde se guardan imagenes Docker. En este proyecto usamos el repositorio `venta-pasajes-dev` para ambiente de desarrollo.

## Archivos principales

| Archivo | Proposito |
| --- | --- |
| `C:\VENTA-DE-PASAJES\services\identity-service\pom.xml` | Define dependencias, plugins y perfil nativo Quarkus. |
| `C:\VENTA-DE-PASAJES\services\identity-service\src\main\resources\application.properties` | Configuracion por entorno e inclusion de migraciones Flyway en native. |
| `C:\VENTA-DE-PASAJES\services\identity-service\src\main\java\com\ventapasajes\identity\api\NativeReflectionConfiguration.java` | Registro de clases usadas por Jackson/reflection en imagen nativa. |
| `C:\VENTA-DE-PASAJES\services\identity-service\src\main\docker\Dockerfile.native` | Dockerfile que empaqueta el binario nativo en una imagen runtime minimal. |
| `C:\VENTA-DE-PASAJES\services\identity-service\.dockerignore` | Evita copiar todo `target`, salvo el runner nativo requerido por Docker. |
| `C:\VENTA-DE-PASAJES\scripts\build-identity-service-native.ps1` | Script asistido para build nativo, Docker build, tag y push a Artifact Registry. |
| `C:\VENTA-DE-PASAJES\scripts\verify-identity-service-native-local.ps1` | Script asistido para prueba local completa con PostgreSQL temporal. |
| `C:\VENTA-DE-PASAJES\services\identity-service\README.md` | Resumen de comandos del servicio. |

## Imagen generada

| Elemento | Valor |
| --- | --- |
| Imagen local | `identity-service:0.1.0-native` |
| Imagen Artifact Registry | `us-central1-docker.pkg.dev/project-fbb34cd7-0b82-43e1-867/venta-pasajes-dev/identity-service:0.1.0-native` |
| Digest remoto final | `sha256:7d1bde055269a8b70fa9eebee788b1cf5b63e33ee92dfcce13f0b3a93ade0ae8` |
| Binario nativo | `C:\VENTA-DE-PASAJES\services\identity-service\target\identity-service-0.1.0-SNAPSHOT-runner` |
| Tamano runner | `107,356,400 bytes` |
| Tamano imagen segun `docker image inspect` | `111,314,071 bytes` |
| Base runtime | `registry.access.redhat.com/ubi9/ubi-minimal:9.6` |
| Builder nativo | `quay.io/quarkus/ubi9-quarkus-mandrel-builder-image:jdk-21` |

## Flujo completo

El flujo completo es:

```text
1. Verificar prerequisitos locales.
2. Probar el servicio en JVM.
3. Compilar el binario nativo.
4. Verificar que exista el runner nativo.
5. Construir la imagen Docker local.
6. Ejecutar PostgreSQL temporal en Docker.
7. Ejecutar identity-service nativo conectado a ese PostgreSQL.
8. Probar health, login y endpoint protegido /me.
9. Etiquetar la imagen con ruta de Artifact Registry.
10. Autenticar Docker contra Artifact Registry.
11. Publicar la imagen.
12. Verificar el tag remoto.
```

## Prerequisitos

Antes de construir manualmente, validar que existan estas herramientas:

```powershell
docker version
mvn -version
java -version
```

Para publicar en Google Cloud tambien se necesita `gcloud` autenticado:

```powershell
gcloud auth list
gcloud config list
```

En esta maquina `gcloud` puede no estar en el `PATH` de todas las terminales. Si PowerShell no reconoce `gcloud`, usar la ruta completa:

```powershell
& "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd" auth list
```

Si `gcloud` necesita Python explicito:

```powershell
$env:CLOUDSDK_PYTHON = "C:\Python312\python.exe"
```

Variables recomendadas para no repetir rutas:

```powershell
$ProjectId = "project-fbb34cd7-0b82-43e1-867"
$Region = "us-central1"
$Repository = "venta-pasajes-dev"
$ImageName = "identity-service"
$ImageTag = "0.1.0-native"
$LocalImage = "${ImageName}:${ImageTag}"
$ArtifactImage = "$Region-docker.pkg.dev/$ProjectId/$Repository/${ImageName}:${ImageTag}"
$Gcloud = "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd"
$GcloudBin = Split-Path -Parent $Gcloud
$env:CLOUDSDK_PYTHON = "C:\Python312\python.exe"
$env:PATH = "$GcloudBin;$env:PATH"
```

## Paso 1 - Ubicarse en el proyecto

```powershell
cd C:\VENTA-DE-PASAJES
```

Validar que el servicio exista:

```powershell
Test-Path .\services\identity-service\pom.xml
Test-Path .\services\identity-service\src\main\docker\Dockerfile.native
```

Resultado esperado:

```text
True
True
```

## Paso 2 - Revisar puertos y procesos que pueden bloquear el build

En Windows, si existe un `java.exe` ejecutando `identity-service`, puede bloquear archivos dentro de `target`.

Revisar puertos usados por el servicio:

```powershell
Get-NetTCPConnection -LocalPort 8081,18081,18082,18083 -ErrorAction SilentlyContinue |
  Select-Object LocalAddress,LocalPort,State,OwningProcess |
  Format-Table -AutoSize
```

Revisar procesos Java:

```powershell
Get-CimInstance Win32_Process -Filter "name = 'java.exe'" |
  Select-Object ProcessId,CommandLine |
  Format-List
```

Si aparece un proceso Java que esta usando `8081` y se desea detener:

```powershell
Stop-Process -Id <PID> -Force
```

Si `Stop-Process` no funciona:

```powershell
taskkill /PID <PID> /T /F
```

Cuando no se pueda detener el proceso, usar el flujo con carpeta temporal limpia descrito mas abajo.

## Paso 3 - Ejecutar pruebas del servicio

Antes de compilar nativo, correr pruebas JVM:

```powershell
mvn -f .\services\identity-service\pom.xml test -DskipTests
```

Resultado esperado del Dia 20:

```text
Tests run: 14, Failures: 0, Errors: 0, Skipped: 0
BUILD SUCCESS
```

Si esta fase falla, no continuar al build nativo. Primero corregir las pruebas.

## Paso 4 - Compilar el binario nativo directamente

Comando manual directo:

```powershell
mvn -f ".\services\identity-service\pom.xml" package `
  "-Dnative" `
  "-DskipTests" `
  "-Dquarkus.native.container-build=true" `
  "-Dquarkus.native.builder-image=quay.io/quarkus/ubi9-quarkus-mandrel-builder-image:jdk-21"
```

El uso de comillas en los parametros `-D...` evita que PowerShell/Maven interpreten mal propiedades con puntos.

Resultado esperado:

```text
BUILD SUCCESS
Finished generating 'identity-service-0.1.0-SNAPSHOT-runner'
```

Archivo esperado:

```text
C:\VENTA-DE-PASAJES\services\identity-service\target\identity-service-0.1.0-SNAPSHOT-runner
```

Verificar el runner:

```powershell
Get-ChildItem .\services\identity-service\target |
  Where-Object { $_.Name -like "*-runner" -and $_.Name -notlike "*.jar" } |
  Select-Object Name,Length,LastWriteTime |
  Format-Table -AutoSize
```

## Paso 5 - Compilar el binario nativo desde carpeta limpia

Este paso es recomendado en Windows cuando el build directo falla por archivos bloqueados en `target`.

Crear carpeta temporal:

```powershell
$CleanRoot = Join-Path ([System.IO.Path]::GetTempPath()) "venta-pasajes-identity-native-manual"
$CleanService = Join-Path $CleanRoot "identity-service"
Remove-Item -LiteralPath $CleanRoot -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $CleanService | Out-Null
```

Copiar el servicio sin `target`:

```powershell
Get-ChildItem -LiteralPath .\services\identity-service -Force |
  Where-Object { $_.Name -notin @("target", ".git", ".idea", ".vscode") } |
  ForEach-Object {
    Copy-Item -LiteralPath $_.FullName -Destination $CleanService -Recurse -Force
  }
```

Compilar nativo desde la copia limpia:

```powershell
mvn -f "$CleanService\pom.xml" package `
  "-Dnative" `
  "-DskipTests" `
  "-Dquarkus.native.container-build=true" `
  "-Dquarkus.native.builder-image=quay.io/quarkus/ubi9-quarkus-mandrel-builder-image:jdk-21"
```

Copiar el runner generado al proyecto principal:

```powershell
$NativeRunner = Get-ChildItem -LiteralPath "$CleanService\target" -File |
  Where-Object { $_.Name -like "*-runner" -and $_.Name -notlike "*.jar" } |
  Sort-Object LastWriteTimeUtc -Descending |
  Select-Object -First 1

Copy-Item -LiteralPath $NativeRunner.FullName `
  -Destination .\services\identity-service\target\identity-service-0.1.0-SNAPSHOT-runner `
  -Force
```

Verificar que el runner quedo en el proyecto:

```powershell
Get-Item .\services\identity-service\target\identity-service-0.1.0-SNAPSHOT-runner |
  Select-Object FullName,Length,LastWriteTime
```

## Paso 6 - Construir la imagen Docker local

Construir imagen:

```powershell
docker build --pull `
  -f .\services\identity-service\src\main\docker\Dockerfile.native `
  -t identity-service:0.1.0-native `
  .\services\identity-service
```

Verificar imagen local:

```powershell
docker image inspect identity-service:0.1.0-native --format '{{.Id}} {{.Size}}'
```

Resultado esperado del Dia 20:

```text
sha256:7d1bde055269a8b70fa9eebee788b1cf5b63e33ee92dfcce13f0b3a93ade0ae8 111314071
```

Listar imagen local:

```powershell
docker images identity-service
```

## Paso 7 - Crear red Docker temporal para prueba local

Crear red:

```powershell
docker network create venta-pasajes-identity-native-manual
```

Si ya existe:

```powershell
docker network inspect venta-pasajes-identity-native-manual
```

## Paso 8 - Levantar PostgreSQL temporal

Definir credenciales temporales para la prueba:

```powershell
$DatabaseName = "identity_db"
$DatabaseUser = "postgres"
$DatabasePassword = "temporary-local-db-password"
$AdminPassword = "temporary-local-admin-password"
$JwtSecret = "temporary-local-jwt-secret-with-enough-length-1234567890"
$PasswordPepper = "temporary-local-password-pepper"
$RecoveryPepper = "temporary-local-recovery-pepper"
```

Levantar PostgreSQL:

```powershell
docker run --name venta-pasajes-identity-native-pg-manual `
  --network venta-pasajes-identity-native-manual `
  -e POSTGRES_DB=$DatabaseName `
  -e POSTGRES_USER=$DatabaseUser `
  -e POSTGRES_PASSWORD=$DatabasePassword `
  -p 55435:5432 `
  -d postgres:16-alpine
```

Esperar hasta que PostgreSQL acepte conexiones desde la red Docker:

```powershell
docker run --rm `
  --network venta-pasajes-identity-native-manual `
  postgres:16-alpine `
  pg_isready -h venta-pasajes-identity-native-pg-manual -p 5432 -U $DatabaseUser -d $DatabaseName
```

Resultado esperado:

```text
venta-pasajes-identity-native-pg-manual:5432 - accepting connections
```

## Paso 9 - Levantar identity-service nativo local

Ejecutar el contenedor:

```powershell
docker run --name venta-pasajes-identity-native-app-manual `
  --network venta-pasajes-identity-native-manual `
  -p 18083:8081 `
  -e APP_ENV=onprem `
  -e APP_RUNTIME_TARGET=onprem `
  -e APP_SECRETS_PROVIDER=env `
  -e QUARKUS_PROFILE=onprem `
  -e QUARKUS_HTTP_PORT=8081 `
  -e QUARKUS_FLYWAY_MIGRATE_AT_START=true `
  -e APP_DB_NAME=$DatabaseName `
  -e APP_DB_JDBC_URL="jdbc:postgresql://venta-pasajes-identity-native-pg-manual:5432/$DatabaseName" `
  -e APP_DB_USERNAME=$DatabaseUser `
  -e APP_DB_PASSWORD=$DatabasePassword `
  -e APP_JWT_SIGNING_SECRET=$JwtSecret `
  -e APP_PASSWORD_PEPPER=$PasswordPepper `
  -e APP_RECOVERY_TOKEN_PEPPER=$RecoveryPepper `
  -e APP_GOOGLE_CLIENT_IDS=local-google-client-placeholder `
  -e APP_BOOTSTRAP_ADMIN_ENABLED=true `
  -e APP_BOOTSTRAP_ADMIN_LOGIN=admin `
  -e APP_BOOTSTRAP_ADMIN_EMAIL=admin@example.local `
  -e APP_BOOTSTRAP_ADMIN_DISPLAY_NAME=Administrador `
  -e APP_BOOTSTRAP_ADMIN_PASSWORD=$AdminPassword `
  -d identity-service:0.1.0-native
```

Ver logs:

```powershell
docker logs -f venta-pasajes-identity-native-app-manual
```

En otra terminal, validar que esta corriendo:

```powershell
docker ps --filter "name=venta-pasajes-identity-native-app-manual"
```

## Paso 10 - Probar health con curl

Health tecnico de Quarkus:

```powershell
curl.exe -s "http://localhost:18083/q/health/ready"
```

Resultado esperado:

```json
{"status":"UP","checks":[...]}
```

Health funcional del servicio:

```powershell
curl.exe -s "http://localhost:18083/api/v1/identity/health"
```

Resultado esperado:

```json
{"service":"identity-service","status":"UP"}
```

Si el servicio no responde, revisar logs:

```powershell
docker logs venta-pasajes-identity-native-app-manual --tail 120
```

## Paso 11 - Probar login local con curl

Crear body JSON:

```powershell
$loginBody = @{
  login = "admin"
  password = $AdminPassword
} | ConvertTo-Json -Compress
```

Ejecutar login:

```powershell
$loginResponse = curl.exe -s -X POST "http://localhost:18083/api/v1/identity/auth/local/login" `
  -H "Content-Type: application/json" `
  -d $loginBody | ConvertFrom-Json
```

Verificar que se recibio token:

```powershell
$loginResponse.access_token
```

Guardar access token:

```powershell
$accessToken = $loginResponse.access_token
```

No pegar este token en bitacoras ni documentos compartidos.

## Paso 12 - Probar endpoint protegido con curl

Consultar usuario actual:

```powershell
curl.exe -s -X GET "http://localhost:18083/api/v1/identity/me" `
  -H "Authorization: Bearer $accessToken"
```

Resultado esperado:

```json
{"login":"admin","display_name":"Administrador","roles":["ADMIN"],...}
```

Probar roles:

```powershell
curl.exe -s -X GET "http://localhost:18083/api/v1/identity/roles" `
  -H "Authorization: Bearer $accessToken"
```

Probar permisos:

```powershell
curl.exe -s -X GET "http://localhost:18083/api/v1/identity/permissions" `
  -H "Authorization: Bearer $accessToken"
```

Probar usuarios:

```powershell
curl.exe -s -X GET "http://localhost:18083/api/v1/identity/users" `
  -H "Authorization: Bearer $accessToken"
```

## Paso 13 - Detener prueba local manual

Detener contenedores:

```powershell
docker rm -f venta-pasajes-identity-native-app-manual
docker rm -f venta-pasajes-identity-native-pg-manual
```

Eliminar red temporal:

```powershell
docker network rm venta-pasajes-identity-native-manual
```

Verificar que no quedaron recursos temporales:

```powershell
docker ps -a --filter "name=venta-pasajes-identity-native" --format "{{.Names}}"
docker network ls --filter "name=venta-pasajes-identity-native" --format "{{.Name}}"
```

Si no imprime nada, la limpieza quedo correcta.

## Paso 14 - Publicar en Artifact Registry

Definir variables:

```powershell
$ProjectId = "project-fbb34cd7-0b82-43e1-867"
$Region = "us-central1"
$Repository = "venta-pasajes-dev"
$ImageName = "identity-service"
$ImageTag = "0.1.0-native"
$LocalImage = "${ImageName}:${ImageTag}"
$ArtifactImage = "$Region-docker.pkg.dev/$ProjectId/$Repository/${ImageName}:${ImageTag}"
$Gcloud = "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd"
$env:CLOUDSDK_PYTHON = "C:\Python312\python.exe"
$env:PATH = "$(Split-Path -Parent $Gcloud);$env:PATH"
```

Seleccionar proyecto:

```powershell
& $Gcloud config set project $ProjectId
```

Verificar cuenta activa:

```powershell
& $Gcloud auth list
```

Habilitar API de Artifact Registry si hiciera falta:

```powershell
& $Gcloud services enable artifactregistry.googleapis.com --project=$ProjectId
```

Verificar si el repositorio existe:

```powershell
& $Gcloud artifacts repositories describe $Repository `
  --project=$ProjectId `
  --location=$Region
```

Si no existe, crearlo:

```powershell
& $Gcloud artifacts repositories create $Repository `
  --project=$ProjectId `
  --location=$Region `
  --repository-format=docker `
  --description="Venta de Pasajes development Docker images"
```

Configurar Docker para autenticarse contra Artifact Registry:

```powershell
& $Gcloud auth configure-docker "$Region-docker.pkg.dev" --quiet
```

Etiquetar la imagen local con la ruta remota:

```powershell
docker tag $LocalImage $ArtifactImage
```

Publicar:

```powershell
docker push $ArtifactImage
```

Resultado esperado:

```text
0.1.0-native: digest: sha256:<digest-remoto> size: <manifest-size>
```

## Paso 15 - Verificar imagen publicada

Listar imagenes del repositorio:

```powershell
& $Gcloud artifacts docker images list `
  "$Region-docker.pkg.dev/$ProjectId/$Repository" `
  --project=$ProjectId `
  --include-tags
```

Ver tags de `identity-service`:

```powershell
& $Gcloud artifacts docker tags list `
  "$Region-docker.pkg.dev/$ProjectId/$Repository/$ImageName" `
  --project=$ProjectId
```

Ver en formato JSON:

```powershell
& $Gcloud artifacts docker tags list `
  "$Region-docker.pkg.dev/$ProjectId/$Repository/$ImageName" `
  --project=$ProjectId `
  --format=json
```

Validar que `0.1.0-native` apunte al digest esperado:

```powershell
& $Gcloud artifacts docker tags list `
  "$Region-docker.pkg.dev/$ProjectId/$Repository/$ImageName" `
  --project=$ProjectId `
  --format="table(tag,version)"
```

Resultado esperado del Dia 20:

```text
0.1.0-native  sha256:7d1bde055269a8b70fa9eebee788b1cf5b63e33ee92dfcce13f0b3a93ade0ae8
```

## Paso 16 - Ver en Google Cloud Console

Ruta visual:

```text
Google Cloud Console
Artifact Registry
Repositorios
venta-pasajes-dev
identity-service
Versiones
```

Validar:

```text
Proyecto: project-fbb34cd7-0b82-43e1-867
Ubicacion: us-central1
Repositorio: venta-pasajes-dev
Paquete: identity-service
Etiqueta: 0.1.0-native
```

Puede aparecer el tamano virtual vacio en la fila con `0.1.0-native` si esa fila corresponde a un indice OCI. Eso no significa que la imagen este vacia. La etiqueta sigue apuntando al digest correcto y Docker/Cloud Run resuelven internamente el manifiesto/capas reales.

## Paso 17 - Quitar la imagen de Artifact Registry

Atencion: borrar una imagen remota elimina el artefacto del repositorio. No ejecutar si Cloud Run u otro ambiente depende de esa imagen.

Primero listar tags:

```powershell
& $Gcloud artifacts docker tags list `
  "$Region-docker.pkg.dev/$ProjectId/$Repository/$ImageName" `
  --project=$ProjectId `
  --format="table(tag,version)"
```

Opcion A: quitar solo el tag `0.1.0-native`

Esto remueve la etiqueta, pero no necesariamente elimina todos los digests/capas asociados:

```powershell
& $Gcloud artifacts docker tags delete `
  "$Region-docker.pkg.dev/$ProjectId/$Repository/${ImageName}:$ImageTag" `
  --project=$ProjectId `
  --quiet
```

Verificar que el tag ya no aparece:

```powershell
& $Gcloud artifacts docker tags list `
  "$Region-docker.pkg.dev/$ProjectId/$Repository/$ImageName" `
  --project=$ProjectId `
  --format="table(tag,version)"
```

Opcion B: borrar la version etiquetada y sus tags

Esta es la opcion para limpiar la version publicada con ese tag:

```powershell
& $Gcloud artifacts docker images delete `
  "$Region-docker.pkg.dev/$ProjectId/$Repository/${ImageName}:$ImageTag" `
  --project=$ProjectId `
  --delete-tags `
  --quiet
```

Opcion C: borrar por digest exacto

Usar esta opcion cuando se conoce el digest remoto:

```powershell
$Digest = "sha256:7d1bde055269a8b70fa9eebee788b1cf5b63e33ee92dfcce13f0b3a93ade0ae8"

& $Gcloud artifacts docker images delete `
  "$Region-docker.pkg.dev/$ProjectId/$Repository/$ImageName@$Digest" `
  --project=$ProjectId `
  --delete-tags `
  --quiet
```

Verificar despues de borrar:

```powershell
& $Gcloud artifacts docker images list `
  "$Region-docker.pkg.dev/$ProjectId/$Repository/$ImageName" `
  --project=$ProjectId `
  --include-tags
```

## Paso 18 - Subir nuevamente la imagen a Artifact Registry

Si el repositorio `venta-pasajes-dev` fue eliminado desde la consola web, el `docker push` falla con un mensaje similar a:

```text
error from registry: Repository "venta-pasajes-dev" not found
```

Eso ocurre porque `docker push` puede subir una imagen a un repositorio existente, pero no crea el repositorio de Artifact Registry automaticamente.

Primero definir variables:

```powershell
$ProjectId = "project-fbb34cd7-0b82-43e1-867"
$Region = "us-central1"
$Repository = "venta-pasajes-dev"
$ImageName = "identity-service"
$ImageTag = "0.1.0-native"
$LocalImage = "${ImageName}:${ImageTag}"
$ArtifactImage = "$Region-docker.pkg.dev/$ProjectId/$Repository/${ImageName}:${ImageTag}"
$Gcloud = "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd"
$env:CLOUDSDK_PYTHON = "C:\Python312\python.exe"
$env:PATH = "$(Split-Path -Parent $Gcloud);$env:PATH"
```

Seleccionar el proyecto:

```powershell
& $Gcloud config set project $ProjectId
```

Habilitar la API de Artifact Registry si no estuviera habilitada:

```powershell
& $Gcloud services enable artifactregistry.googleapis.com --project=$ProjectId
```

Verificar si el repositorio existe:

```powershell
& $Gcloud artifacts repositories describe $Repository `
  --project=$ProjectId `
  --location=$Region
```

Si el comando anterior responde `NOT_FOUND` o indica que el repositorio no existe, crearlo nuevamente:

```powershell
& $Gcloud artifacts repositories create $Repository `
  --project=$ProjectId `
  --location=$Region `
  --repository-format=docker `
  --description="Venta de Pasajes development Docker images"
```

Verificar que el repositorio fue creado:

```powershell
& $Gcloud artifacts repositories list `
  --project=$ProjectId `
  --location=$Region `
  --format="table(name,format,location,description)"
```

Resultado esperado:

```text
REPOSITORY         FORMAT  LOCATION     DESCRIPTION
venta-pasajes-dev  DOCKER  us-central1  Venta de Pasajes development Docker images
```

Tambien se puede recrear desde la consola web:

```text
Google Cloud Console
Artifact Registry
Repositorios
Crear repositorio
Nombre: venta-pasajes-dev
Formato: Docker
Modo: Estandar
Tipo de ubicacion: Region
Region: us-central1
Descripcion: Venta de Pasajes development Docker images
Crear
```

Si la imagen local todavia existe:

```powershell
docker image inspect $LocalImage --format '{{.Id}} {{.Size}}'
```

Etiquetar nuevamente:

```powershell
docker tag $LocalImage $ArtifactImage
```

Autenticar Docker:

```powershell
& $Gcloud auth configure-docker us-central1-docker.pkg.dev --quiet
```

Subir nuevamente:

```powershell
docker push $ArtifactImage
```

Verificar:

```powershell
& $Gcloud artifacts docker tags list `
  "$Region-docker.pkg.dev/$ProjectId/$Repository/$ImageName" `
  --project=$ProjectId `
  --format="table(tag,version)"
```

Si la imagen local ya no existe, reconstruirla antes:

```powershell
mvn -f ".\services\identity-service\pom.xml" package `
  "-Dnative" `
  "-DskipTests" `
  "-Dquarkus.native.container-build=true" `
  "-Dquarkus.native.builder-image=quay.io/quarkus/ubi9-quarkus-mandrel-builder-image:jdk-21"

docker build --pull `
  -f .\services\identity-service\src\main\docker\Dockerfile.native `
  -t $LocalImage `
  .\services\identity-service

docker tag $LocalImage $ArtifactImage

docker push $ArtifactImage
```

## Paso 19 - Flujo asistido equivalente con scripts

El flujo manual anterior esta automatizado parcialmente en estos scripts.

Pruebas JVM:

```powershell
mvn -f .\services\identity-service\pom.xml test
```

Build nativo y Docker image:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-identity-service-native.ps1 `
  -ProjectId project-fbb34cd7-0b82-43e1-867 `
  -Region us-central1 `
  -Repository venta-pasajes-dev `
  -ImageTag 0.1.0-native `
  -UseCleanWorkspace
```

Verificacion local:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-identity-service-native-local.ps1 `
  -ImageTag identity-service:0.1.0-native `
  -HttpPort 18083 `
  -DatabasePort 55435
```

Publicacion:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-identity-service-native.ps1 `
  -ProjectId project-fbb34cd7-0b82-43e1-867 `
  -Region us-central1 `
  -Repository venta-pasajes-dev `
  -ImageTag 0.1.0-native `
  -SkipNativeBuild `
  -SkipDockerBuild `
  -Push `
  -CreateRepository
```

## Paso 20 - Limpieza local opcional

Eliminar contenedores temporales si quedaron vivos:

```powershell
docker rm -f venta-pasajes-identity-native-app-manual
docker rm -f venta-pasajes-identity-native-pg-manual
```

Eliminar red temporal:

```powershell
docker network rm venta-pasajes-identity-native-manual
```

Eliminar imagen local:

```powershell
docker rmi identity-service:0.1.0-native
docker rmi us-central1-docker.pkg.dev/project-fbb34cd7-0b82-43e1-867/venta-pasajes-dev/identity-service:0.1.0-native
```

Eliminar carpeta temporal limpia si se uso:

```powershell
Remove-Item -LiteralPath "$env:TEMP\venta-pasajes-identity-native-manual" -Recurse -Force -ErrorAction SilentlyContinue
```

## Problemas encontrados y resueltos

| Problema | Solucion |
| --- | --- |
| PowerShell/Maven interpreto mal `-Dquarkus.native.builder-image=...`. | Usar comillas alrededor de cada parametro `-D...`. |
| `target\quarkus-app\app\identity-service-0.1.0-SNAPSHOT.jar` estaba bloqueado por un `java.exe` escuchando en `8081`. | Detener el proceso Java o compilar desde carpeta limpia. |
| Jackson no podia serializar `AuthTokenResponse` en native. | Se agrego `NativeReflectionConfiguration` con DTOs y respuestas registradas para reflection. |
| La prueba nativa arrancaba el servicio antes de que PostgreSQL aceptara conexiones desde otro contenedor. | Validar `pg_isready` desde la red Docker compartida. |
| `docker-credential-gcloud` no estaba en `PATH` durante el push. | Agregar la carpeta `bin` de `gcloud` al `PATH`. |
| Artifact Registry `venta-pasajes-dev` no existia. | Crear el repositorio con `--repository-format=docker`. |

## Resultados del Dia 20

Pruebas JVM:

```text
Tests run: 14, Failures: 0, Errors: 0, Skipped: 0
BUILD SUCCESS
```

Build nativo:

```text
Running Quarkus native-image plugin on MANDREL 23.1.12.1 JDK 21.0.12.1+1-LTS
Finished generating 'identity-service-0.1.0-SNAPSHOT-runner' in 1m 1s.
BUILD SUCCESS
Total time: 01:24 min
```

Build Docker:

```json
{"service":"identity-service","native_runner_bytes":107356400,"local_image":"identity-service:0.1.0-native","artifact_image":"us-central1-docker.pkg.dev/project-fbb34cd7-0b82-43e1-867/venta-pasajes-dev/identity-service:0.1.0-native","pushed":false,"image_id":"sha256:7d1bde055269a8b70fa9eebee788b1cf5b63e33ee92dfcce13f0b3a93ade0ae8","image_size_bytes":111314071,"ready":true}
```

Verificacion local final:

```json
{"service":"identity-service","runtime":"native-container","image":"identity-service:0.1.0-native","quarkus_profile":"onprem","database":"identity_db","migration_tool":"flyway","http_port":18083,"database_port":55435,"startup_ms":1417,"health_ready":"UP","bootstrap_admin_login":"admin","token_returned":true,"current_user":"admin","network":"venta-pasajes-identity-native-<pid>","ready":true}
```

Publicacion:

```text
0.1.0-native: digest: sha256:7d1bde055269a8b70fa9eebee788b1cf5b63e33ee92dfcce13f0b3a93ade0ae8 size: 856
```

Verificacion remota:

```json
{
  "image": "us-central1-docker.pkg.dev/project-fbb34cd7-0b82-43e1-867/venta-pasajes-dev/identity-service",
  "version": "projects/project-fbb34cd7-0b82-43e1-867/locations/us-central1/repositories/venta-pasajes-dev/packages/identity-service/versions/sha256:7d1bde055269a8b70fa9eebee788b1cf5b63e33ee92dfcce13f0b3a93ade0ae8"
}
```

## Observaciones

- No se desplego aun en Cloud Run; el criterio de este dia era dejar el primer microservicio nativo listo y publicado como imagen.
- La prueba local usa `QUARKUS_PROFILE=onprem` para validar que la imagen tambien puede correr fuera de GCP.
- La imagen publicada se ejecutara en GCP con variables de entorno y secretos reales inyectados por el pipeline o por Cloud Run.
- Artifact Registry informa que el escaneo de vulnerabilidades esta deshabilitado porque `containerscanning.googleapis.com` no esta activo.
- No registrar contrasenas, tokens JWT, peppers ni secretos reales en bitacoras o documentos compartidos.

## Estado

- Criterio de avance del Dia 20 cumplido.
- Primer microservicio nativo esta listo como imagen Docker y publicado en Artifact Registry dev.
- Siguiente paso natural: Dia 21, `dispatch-service` base.

## Referencias oficiales

- Google Artifact Registry - Push and pull images: `https://docs.cloud.google.com/artifact-registry/docs/docker/pushing-and-pulling`
- Google Artifact Registry - Manage images: `https://docs.cloud.google.com/artifact-registry/docs/docker/manage-images`

## Reversa primero

> Estandarizacion documental agregada el 2026-09-16 para que este dia tambien tenga una ruta segura de limpieza antes de repetir la practica.

Este dia pertenece a la etapa inicial del proyecto. Antes de ejecutar una reversa, revisar si el archivo contiene recursos externos reales, como Google Cloud, Docker, bases de datos o imagenes publicadas. No ejecutar comandos destructivos si no estas seguro de que el recurso no esta siendo usado.

### Paso R1 - Ubicarse en el workspace

```powershell
cd C:\VENTA-DE-PASAJES
```

### Paso R2 - Revisar recursos o archivos mencionados

```powershell
Select-String -Path .\docs\dia-20-compilacion-nativa-identity-service.md -Pattern "C:\\VENTA-DE-PASAJES|docker|gcloud|mvn|npm|Remove-Item|delete|rm|Cloud SQL|Artifact Registry|Secret Manager" -Context 0,2
```

### Paso R3 - Detener procesos locales si este dia levanto herramientas

```powershell
Get-NetTCPConnection -LocalPort 3000,3001,3002,3003,8081,8082,8083,18083,18089,18096 -ErrorAction SilentlyContinue |
  Select-Object LocalAddress,LocalPort,State,OwningProcess |
  Format-Table -AutoSize

Get-CimInstance Win32_Process -Filter "name = 'java.exe' or name = 'node.exe'" |
  Select-Object ProcessId,CommandLine |
  Format-List
```

Si identificas un proceso propio de la practica, detenerlo:

```powershell
Stop-Process -Id <process-id> -Force
```

### Paso R4 - Revisar contenedores temporales

```powershell
docker ps -a --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}" |
  Select-String -Pattern "venta-pasajes|identity|dispatch|ticketing|native|postgres"
```

Si el contenedor fue creado solo para repetir este dia y no se usa en otra practica:

```powershell
docker rm -f <container-name>
```

### Paso R5 - Reversa de archivos locales

La reversa de archivos debe hacerse con control de cambios o backup. Este workspace inicio sin Git en los primeros dias, por eso no se recomienda borrar archivos a ciegas.

```powershell
Select-String -Path .\docs\dia-20-compilacion-nativa-identity-service.md -Pattern "Archivo|Archivos|C:\\VENTA-DE-PASAJES" -Context 0,4
```

Si aun asi necesitas retirar solo este documento de la practica, hacer primero una copia:

```powershell
New-Item -ItemType Directory -Force -Path .\backups | Out-Null
Copy-Item -LiteralPath .\docs\dia-20-compilacion-nativa-identity-service.md -Destination .\backups\dia-20-compilacion-nativa-identity-service-manual-backup.md -Force
```

Despues de respaldar, se podria eliminar manualmente el documento con:

```powershell
Remove-Item -LiteralPath .\docs\dia-20-compilacion-nativa-identity-service.md -Force
```

## Guia manual desde cero

> Estandarizacion documental agregada el 2026-09-16. Esta guia permite repetir el dia sin depender de Codex, usando el documento como fuente de verdad.

### Paso 1 - Ubicarse en el proyecto

```powershell
cd C:\VENTA-DE-PASAJES
```

### Paso 2 - Leer el alcance del dia en el backlog

```powershell
Select-String -Path .\tareas.md -Pattern "Dia 20|Dia 20" -Context 0,40
```

### Paso 3 - Leer la documentacion del dia

```powershell
Get-Content -LiteralPath .\docs\dia-20-compilacion-nativa-identity-service.md
```

### Paso 4 - Verificar archivos y rutas mencionadas

```powershell
Select-String -Path .\docs\dia-20-compilacion-nativa-identity-service.md -Pattern "C:\\VENTA-DE-PASAJES" -AllMatches
```

Para cada ruta importante que aparezca en el documento:

```powershell
Test-Path -LiteralPath "<ruta-copiada-del-documento>"
```

### Paso 5 - Ejecutar comandos documentados

Buscar bloques de comandos del documento y ejecutarlos en orden, validando el resultado de cada bloque antes de continuar:

```powershell
Select-String -Path .\docs\dia-20-compilacion-nativa-identity-service.md -Pattern "```powershell|```text|mvn |npm |docker |gcloud |curl.exe|powershell " -Context 0,6
```

### Paso 6 - Registrar la repeticion en bitacora

```powershell
Add-Content -LiteralPath .\vitacora.md -Value "`nReplica manual Dia 20 - <fecha>: comandos ejecutados y resultado."
```

### Paso 7 - Validar criterio de avance

Revisar la seccion de criterio de avance, resultado, estado final o pendientes del documento:

```powershell
Select-String -Path .\docs\dia-20-compilacion-nativa-identity-service.md -Pattern "Criterio de avance|Resultado|Estado final|Pendiente|Pendientes" -Context 0,8
```
