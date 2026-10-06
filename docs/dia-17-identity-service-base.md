# Dia 17 - identity-service base

Fecha: 2026-09-02

## Objetivo

Crear el microservicio Quarkus `identity-service`, configurarlo para `identity_db`, agregar migraciones iniciales y dejar endpoints base listos para implementar autenticacion y autorizacion en el Dia 18.

## Resultado ejecutivo

Dia 17 completado.

Se genero `identity-service` desde la plantilla Quarkus, se agrego el esquema inicial de identidad con Flyway, se crearon entidades Panache base y se dejaron endpoints funcionales expuestos como stubs `501 NOT_IMPLEMENTED`.

La conexion de runtime fue verificada localmente contra PostgreSQL temporal en Docker: el JAR JVM arranco, Flyway aplico la migracion `V1__identity_schema.sql` y `/q/health/ready` respondio `UP`.

Tambien se verifico en Google Cloud que existen:

- Base `identity_db`.
- Usuario IAM de Cloud SQL `identity-service-run@project-fbb34cd7-0b82-43e1-867.iam`.
- Secreto `identity-service__db-connection`.

## Archivos principales

| Archivo | Proposito |
| --- | --- |
| `C:\VENTA-DE-PASAJES\services\identity-service\pom.xml` | Proyecto Quarkus `identity-service`. |
| `C:\VENTA-DE-PASAJES\services\identity-service\src\main\resources\application.properties` | Configuracion base: puerto `8081`, `identity_db`, Flyway y logs. |
| `C:\VENTA-DE-PASAJES\services\identity-service\src\main\resources\db\migration\V1__identity_schema.sql` | Migracion inicial de identidad. |
| `C:\VENTA-DE-PASAJES\services\identity-service\src\main\java\com\ventapasajes\identity\api\IdentityHealthResource.java` | Health funcional del servicio. |
| `C:\VENTA-DE-PASAJES\services\identity-service\src\main\java\com\ventapasajes\identity\api\IdentityBaseResource.java` | Endpoints base de auth, usuarios, roles, permisos y autorizaciones. |
| `C:\VENTA-DE-PASAJES\services\identity-service\src\main\java\com\ventapasajes\identity\persistence\entity` | Entidades Panache iniciales. |
| `C:\VENTA-DE-PASAJES\scripts\verify-identity-service-local-db.ps1` | Verificacion local con PostgreSQL temporal, Flyway y health ready. |
| `C:\VENTA-DE-PASAJES\docs\database\identity-db.sql` | DDL de diseno alineado con la migracion ejecutable. |

## Modelo de datos inicial

La migracion incluye:

- `users`: usuarios internos, login, estado, trazabilidad legacy, intentos fallidos y ultimo cambio de contrasena.
- `local_credentials`: hash de contrasena local, algoritmo y banderas de cambio obligatorio.
- `google_identities`: vinculacion con Google subject y correo verificado.
- `internal_profiles`: perfil operativo interno.
- `roles`, `permissions`, `role_permissions`, `user_roles`: autorizacion interna.
- `authorized_identities`: correos, dominios o sujetos Google autorizados.
- `password_reset_tokens`: activacion y recuperacion.
- `login_attempts`: auditoria de intentos de login.
- `outbox_events`: eventos pendientes de publicacion.

## Endpoints base

Implementados como base tecnica:

```text
GET  /api/v1/identity/health
POST /api/v1/identity/auth/local/login
POST /api/v1/identity/auth/google/exchange
POST /api/v1/identity/auth/logout
GET  /api/v1/identity/me
GET  /api/v1/identity/users
POST /api/v1/identity/users
GET  /api/v1/identity/users/{userId}
PATCH /api/v1/identity/users/{userId}
PUT  /api/v1/identity/users/{userId}/roles
POST /api/v1/identity/users/{userId}/activate
POST /api/v1/identity/users/{userId}/suspend
GET  /api/v1/identity/roles
POST /api/v1/identity/roles
GET  /api/v1/identity/permissions
GET  /api/v1/identity/authorized-identities
POST /api/v1/identity/authorized-identities
POST /api/v1/identity/password/forgot
POST /api/v1/identity/password/reset
```

Los endpoints funcionales distintos de health devuelven `501 NOT_IMPLEMENTED` hasta el Dia 18.

## Comandos ejecutados

Revision del alcance:

```powershell
$lines = Get-Content -Path tareas.md; $lines[807..840]
Get-ChildItem -LiteralPath services\identity-service -Force
Get-Content -Path docs\database\identity-db.sql
Get-Content -Path docs\openapi\identity-service.openapi.yaml
Get-Content -Path infra\env\backend-service.env.example
```

Generacion de servicio:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\new-quarkus-service.ps1 -ServiceName identity-service -PackageSegment identity -DatabaseName identity_db -HttpPort 8081
```

Validaciones locales:

```powershell
$Errors = $null
[System.Management.Automation.Language.Parser]::ParseFile((Resolve-Path .\scripts\new-quarkus-service.ps1), [ref]$null, [ref]$Errors)
[System.Management.Automation.Language.Parser]::ParseFile((Resolve-Path .\scripts\verify-identity-service-local-db.ps1), [ref]$null, [ref]$Errors)

mvn -f .\services\identity-service\pom.xml test
mvn -f .\services\identity-service\pom.xml package -DskipTests
mvn -f .\services\quarkus-service-template\pom.xml test

powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-identity-service-local-db.ps1
```

Comandos internos relevantes ejecutados por `verify-identity-service-local-db.ps1`:

```powershell
docker run --rm --name venta-pasajes-identity-pg-<pid> -e POSTGRES_DB=identity_db -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=<temporary-local-password> -p 55432:5432 -d postgres:16-alpine
docker exec venta-pasajes-identity-pg-<pid> pg_isready -U postgres -d identity_db
java -jar C:\VENTA-DE-PASAJES\services\identity-service\target\quarkus-app\quarkus-run.jar
Invoke-RestMethod -Uri http://localhost:18081/q/health/ready
docker stop venta-pasajes-identity-pg-<pid>
```

Verificaciones en Google Cloud:

```powershell
$env:CLOUDSDK_PYTHON = "C:\Python312\python.exe"

& "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd" sql databases describe identity_db --instance=venta-pasajes-dev-sql --project=project-fbb34cd7-0b82-43e1-867 --format=json

& "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd" sql users list --instance=venta-pasajes-dev-sql --project=project-fbb34cd7-0b82-43e1-867 --filter="name:identity-service-run" --format=json

& "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd" secrets describe identity-service__db-connection --project=project-fbb34cd7-0b82-43e1-867 --format=json
```

## Resultados de validacion

Pruebas unitarias/base:

```text
Tests run: 7, Failures: 0, Errors: 0, Skipped: 0
BUILD SUCCESS
```

Package JVM:

```text
BUILD SUCCESS
```

Verificacion local con PostgreSQL temporal:

```json
{"service":"identity-service","database":"identity_db","migration_tool":"flyway","database_port":55432,"http_port":18081,"health_ready":"UP","container":"venta-pasajes-identity-pg-<pid>","ready":true}
```

Log de Flyway:

```text
Database: jdbc:postgresql://localhost:55432/identity_db (PostgreSQL 16.15)
Migrating schema "public" to version "1 - identity schema"
Successfully applied 1 migration to schema "public", now at version v1
```

Google Cloud:

- `identity_db`: existe en `venta-pasajes-dev-sql`.
- Usuario IAM `identity-service-run@project-fbb34cd7-0b82-43e1-867.iam`: existe.
- Secreto `identity-service__db-connection`: existe y pertenece a `identity-service`.

## Nota sobre Cloud SQL dev

La migracion fue validada contra PostgreSQL local temporal. No se aplico el DDL sobre Cloud SQL dev en este dia porque aun no hay un runner/rol de migracion con privilegios de esquema definido para ejecutar DDL de forma controlada.

## Levantar `identity-service` y PostgreSQL localmente con Docker

> Apartado operativo agregado para repetir la prueba de forma dockerizada. No fue ejecutado por Codex.
>
> Estos comandos levantan una base PostgreSQL local y el servicio `identity-service` como contenedor Docker. No usan Cloud SQL, Secret Manager ni recursos de Google Cloud.

### Que se levanta

| Recurso | Nombre local | Puerto host | Proposito |
| --- | --- | --- | --- |
| Red Docker | `venta-pasajes-identity-local` | No aplica | Permite que el contenedor del servicio vea a PostgreSQL por nombre DNS interno. |
| Volumen Docker | `venta-pasajes-identity-pgdata` | No aplica | Persiste datos locales de PostgreSQL aunque se reinicien contenedores. |
| PostgreSQL | `venta-pasajes-identity-db` | `55432 -> 5432` | Base local `identity_db`. |
| Servicio Quarkus | `venta-pasajes-identity-service` | `18081 -> 8081` | API local de `identity-service`. |
| Imagen JVM local | `identity-service:local` | No aplica | Imagen construida desde `services\identity-service`. |

### Paso L1 - Ubicarse en el proyecto

```powershell
cd C:\VENTA-DE-PASAJES
```

### Paso L2 - Compilar el servicio JVM

Este paso genera `target\quarkus-app`, que es lo que copia el Dockerfile JVM.

```powershell
mvn -f .\services\identity-service\pom.xml test
mvn -f .\services\identity-service\pom.xml package -DskipTests
```

Si el primer comando falla, no continuar. Primero corregir pruebas.

### Paso L3 - Construir la imagen Docker local del servicio

En este repositorio no se debe construir esta imagen con `docker build` directo desde `services\identity-service`, porque `services\identity-service\.dockerignore` excluye `target/*`. Eso hace que Docker no vea `target\quarkus-app` aunque Maven lo haya generado.

Usar el script del monorepo, que crea un contexto temporal correcto y deja la imagen local `identity-service:local`.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-backend-jvm-images.ps1 `
  -ConfigPath .\infra\cloudrun\dev-services.json `
  -ServiceIds identity-service `
  -ImageTag local `
  -UseCleanWorkspace
```

Validar que la imagen exista:

```powershell
docker image ls identity-service
```

Resultado esperado:

```text
identity-service   local
```

Si al ejecutar el Paso L6 aparece `Unable to find image 'identity-service:local' locally`, significa que este Paso L3 no se ejecuto o fallo antes de crear la imagen.

### Paso L4 - Crear red y volumen local

```powershell
docker network create venta-pasajes-identity-local
docker volume create venta-pasajes-identity-pgdata
```

Si Docker indica que la red o el volumen ya existen, continuar.

### Paso L5 - Levantar PostgreSQL local dockerizado

```powershell
$LocalDbPassword = "IdentityLocal_ChangeMe_12345"

docker run -d `
  --name venta-pasajes-identity-db `
  --network venta-pasajes-identity-local `
  -e POSTGRES_DB=identity_db `
  -e POSTGRES_USER=identity_user `
  -e "POSTGRES_PASSWORD=$LocalDbPassword" `
  -p 55432:5432 `
  -v venta-pasajes-identity-pgdata:/var/lib/postgresql/data `
  postgres:16-alpine
```

Esperar a que PostgreSQL este listo:

```powershell
for ($Attempt = 1; $Attempt -le 45; $Attempt++) {
  docker exec venta-pasajes-identity-db pg_isready -U identity_user -d identity_db
  if ($LASTEXITCODE -eq 0) { break }
  Start-Sleep -Seconds 2
}
```

### Paso L6 - Levantar `identity-service` dockerizado

Este comando arranca el servicio con perfil `onprem`, lee secretos desde variables de entorno y aplica Flyway al iniciar.

```powershell
$LocalDbPassword = "IdentityLocal_ChangeMe_12345"

docker run -d `
  --name venta-pasajes-identity-service `
  --network venta-pasajes-identity-local `
  -p 18081:8081 `
  -e QUARKUS_PROFILE=onprem `
  -e QUARKUS_HTTP_PORT=8081 `
  -e APP_ENV=local-docker `
  -e APP_RUNTIME_TARGET=onprem `
  -e APP_SECRETS_PROVIDER=env `
  -e APP_DB_NAME=identity_db `
  -e APP_DB_JDBC_URL=jdbc:postgresql://venta-pasajes-identity-db:5432/identity_db `
  -e APP_DB_USERNAME=identity_user `
  -e "APP_DB_PASSWORD=$LocalDbPassword" `
  -e QUARKUS_FLYWAY_MIGRATE_AT_START=true `
  -e APP_LOG_CONSOLE_JSON=false `
  -e APP_JWT_SIGNING_SECRET=local-docker-jwt-signing-secret-change-me-32-bytes `
  -e APP_PASSWORD_PEPPER=local-docker-password-pepper-change-me `
  -e APP_RECOVERY_TOKEN_PEPPER=local-docker-recovery-token-pepper-change-me `
  -e APP_REFRESH_TOKEN_PEPPER=local-docker-refresh-token-pepper-change-me `
  -e APP_BOOTSTRAP_ADMIN_ENABLED=true `
  -e APP_BOOTSTRAP_ADMIN_LOGIN=admin `
  -e APP_BOOTSTRAP_ADMIN_EMAIL=admin@local.test `
  -e APP_BOOTSTRAP_ADMIN_DISPLAY_NAME="Administrador Local" `
  -e APP_BOOTSTRAP_ADMIN_PASSWORD=AdminLocal_ChangeMe_12345 `
  identity-service:local
```

Notas importantes:

- `APP_DB_JDBC_URL` usa el nombre del contenedor `venta-pasajes-identity-db`, no `localhost`, porque el servicio corre dentro de Docker.
- `QUARKUS_FLYWAY_MIGRATE_AT_START=true` crea o actualiza las tablas locales al arrancar.
- Las claves y contrasenas del ejemplo son solo locales. No copiarlas a produccion.
- `APP_BOOTSTRAP_ADMIN_ENABLED=true` crea o asegura un usuario local `admin` para pruebas funcionales.

### Paso L7 - Validar salud del servicio

```powershell
curl.exe -s http://localhost:18081/q/health/ready
curl.exe -s http://localhost:18081/api/v1/identity/health
```

Resultado esperado:

```text
UP
```

El formato exacto puede ser JSON, pero debe indicar estado saludable.

### Paso L8 - Validar que Flyway creo tablas en PostgreSQL

```powershell
docker exec -it venta-pasajes-identity-db `
  psql -U identity_user -d identity_db -c "\dt"
```

Debe mostrar tablas como `users`, `roles`, `permissions`, `local_credentials`, `password_reset_tokens` y `flyway_schema_history`.

### Paso L9 - Probar login local del admin bootstrap

```powershell
$LoginResponse = Invoke-RestMethod `
  -Uri "http://localhost:18081/api/v1/identity/auth/local/login" `
  -Method Post `
  -ContentType "application/json" `
  -Body (@{
    login = "admin"
    password = "AdminLocal_ChangeMe_12345"
  } | ConvertTo-Json)

$LoginResponse
```

Si el login responde `access_token`, probar `/me`:

```powershell
$Headers = @{ Authorization = "Bearer $($LoginResponse.access_token)" }

Invoke-RestMethod `
  -Uri "http://localhost:18081/api/v1/identity/me" `
  -Method Get `
  -Headers $Headers
```

### Paso L10 - Ver logs locales

```powershell
docker logs venta-pasajes-identity-db --tail 80
docker logs venta-pasajes-identity-service --tail 120
```

### Paso L11 - Reiniciar solo el servicio despues de cambios de codigo

Si cambias codigo Java y quieres probar de nuevo sin borrar la base:

```powershell
mvn -f .\services\identity-service\pom.xml test

powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-backend-jvm-images.ps1 `
  -ConfigPath .\infra\cloudrun\dev-services.json `
  -ServiceIds identity-service `
  -ImageTag local `
  -UseCleanWorkspace

docker rm -f venta-pasajes-identity-service

$LocalDbPassword = "IdentityLocal_ChangeMe_12345"

docker run -d `
  --name venta-pasajes-identity-service `
  --network venta-pasajes-identity-local `
  -p 18081:8081 `
  -e QUARKUS_PROFILE=onprem `
  -e QUARKUS_HTTP_PORT=8081 `
  -e APP_ENV=local-docker `
  -e APP_RUNTIME_TARGET=onprem `
  -e APP_SECRETS_PROVIDER=env `
  -e APP_DB_NAME=identity_db `
  -e APP_DB_JDBC_URL=jdbc:postgresql://venta-pasajes-identity-db:5432/identity_db `
  -e APP_DB_USERNAME=identity_user `
  -e "APP_DB_PASSWORD=$LocalDbPassword" `
  -e QUARKUS_FLYWAY_MIGRATE_AT_START=true `
  -e APP_LOG_CONSOLE_JSON=false `
  -e APP_JWT_SIGNING_SECRET=local-docker-jwt-signing-secret-change-me-32-bytes `
  -e APP_PASSWORD_PEPPER=local-docker-password-pepper-change-me `
  -e APP_RECOVERY_TOKEN_PEPPER=local-docker-recovery-token-pepper-change-me `
  -e APP_REFRESH_TOKEN_PEPPER=local-docker-refresh-token-pepper-change-me `
  -e APP_BOOTSTRAP_ADMIN_ENABLED=true `
  -e APP_BOOTSTRAP_ADMIN_LOGIN=admin `
  -e APP_BOOTSTRAP_ADMIN_EMAIL=admin@local.test `
  -e APP_BOOTSTRAP_ADMIN_DISPLAY_NAME="Administrador Local" `
  -e APP_BOOTSTRAP_ADMIN_PASSWORD=AdminLocal_ChangeMe_12345 `
  identity-service:local
```

### Paso L12 - Limpieza local

Para detener todo sin borrar los datos de la base:

```powershell
docker rm -f venta-pasajes-identity-service
docker rm -f venta-pasajes-identity-db
docker network rm venta-pasajes-identity-local
```

Para borrar tambien la base local persistida y la imagen:

```powershell
docker rm -f venta-pasajes-identity-service
docker rm -f venta-pasajes-identity-db
docker volume rm venta-pasajes-identity-pgdata
docker network rm venta-pasajes-identity-local
docker image rm identity-service:local -f
```

## Probar `identity-service` localmente con compilacion nativa

> Apartado operativo agregado para pruebas locales nativas. No fue ejecutado por Codex.
>
> Este flujo no es el recomendado para cada cambio pequeño. Usarlo cuando quieras validar que `identity-service` tambien funciona como binario nativo dentro de Docker.

### Advertencias antes de compilar nativo

La compilacion nativa es mucho mas pesada que la compilacion JVM.

| Advertencia | Detalle |
| --- | --- |
| Tiempo | Puede tardar varios minutos. En equipos modestos puede superar 10, 20 o mas minutos. |
| CPU y memoria | Usa bastante CPU y RAM porque GraalVM/Mandrel analiza la aplicacion completa. |
| Docker obligatorio | Este proyecto compila nativo usando builder image de Quarkus/Mandrel en Docker. |
| Internet | La primera vez puede descargar `quay.io/quarkus/ubi9-quarkus-mandrel-builder-image:jdk-21` y capas base. |
| Espacio en disco | Puede crear artefactos grandes en `target`, imagenes Docker y workspaces temporales. |
| Fallos mas dificiles | Algunos errores nativos no aparecen en JVM, por ejemplo problemas de reflexion, inicializacion de clases o librerias no compatibles. |
| No tocar produccion | Este apartado solo prueba localmente. No publica en Artifact Registry si no usas `-Push`. |

Por eso el flujo normal de desarrollo local usa JVM. El flujo nativo se reserva para validaciones tecnicas puntuales o antes de decidir si una imagen nativa sera candidata para despliegue.

### Que hace el flujo nativo

El script:

```text
C:\VENTA-DE-PASAJES\scripts\build-identity-service-native.ps1
```

hace lo siguiente:

- toma `services\identity-service`;
- opcionalmente copia el servicio a un workspace temporal limpio con `-UseCleanWorkspace`;
- ejecuta Maven con perfil nativo;
- usa el builder `quay.io/quarkus/ubi9-quarkus-mandrel-builder-image:jdk-21`;
- genera un runner nativo en `target`;
- construye una imagen Docker local;
- etiqueta la imagen como `identity-service:<ImageTag>`;
- solo publica en Artifact Registry si se agrega `-Push`.

El script de prueba:

```text
C:\VENTA-DE-PASAJES\scripts\verify-identity-service-native-local.ps1
```

hace una prueba local completa y temporal:

- crea una red Docker temporal;
- levanta PostgreSQL temporal;
- levanta la imagen nativa de `identity-service`;
- aplica Flyway;
- valida `/q/health/ready`;
- crea un admin bootstrap temporal;
- prueba login local;
- prueba `/api/v1/identity/me`;
- elimina contenedores y red al finalizar.

### Archivos y carpetas usados para publicar una imagen nativa en la nube

La consola web de Google Cloud no compila automaticamente la carpeta local `C:\VENTA-DE-PASAJES`. Para desplegar por interfaz grafica, primero debe existir una imagen Docker publicada en Artifact Registry.

En este proyecto, la imagen nativa de `identity-service` se construye desde estos archivos y carpetas:

| Ruta | Para que se usa | Se sube directamente a Cloud Run? |
| --- | --- | --- |
| `C:\VENTA-DE-PASAJES\services\identity-service\pom.xml` | Define el proyecto Maven, Java 21, Quarkus, dependencias y perfil `native`. | No. Maven lo usa para compilar. |
| `C:\VENTA-DE-PASAJES\services\identity-service\src\main\java` | Codigo fuente Java del microservicio. | No como carpeta. Se compila dentro del binario nativo. |
| `C:\VENTA-DE-PASAJES\services\identity-service\src\main\resources\application.properties` | Configuracion de perfiles `local`, `onprem`, `gcp`, datasource, Flyway, secretos y logs. | No como archivo suelto. Queda empaquetado en la aplicacion. |
| `C:\VENTA-DE-PASAJES\services\identity-service\src\main\resources\db\migration` | Migraciones Flyway de `identity_db`. | No como carpeta suelta. Se incluye como recurso de la aplicacion nativa. |
| `C:\VENTA-DE-PASAJES\services\identity-service\src\main\docker\Dockerfile.native` | Dockerfile que empaqueta el runner nativo en una imagen Docker. | No. Docker lo usa para construir la imagen. |
| `C:\VENTA-DE-PASAJES\scripts\build-identity-service-native.ps1` | Orquesta compilacion nativa, construccion Docker, tag local y push opcional a Artifact Registry. | No. Es herramienta local. |
| `C:\VENTA-DE-PASAJES\scripts\verify-identity-service-native-local.ps1` | Prueba local temporal con PostgreSQL, Flyway, health, login y `/me`. | No. Es herramienta local de validacion. |
| `C:\VENTA-DE-PASAJES\infra\cloudrun\prod-backend-services.json` | Fuente de verdad para comparar la configuracion productiva: nombre Cloud Run, puerto, service account, Cloud SQL, variables y secretos. | No automaticamente desde la consola. Se usa como checklist. |
| `C:\VENTA-DE-PASAJES\infra\gcloud\secrets-prod.json` | Define los secretos productivos esperados y accessors. | No. Los valores viven en Secret Manager. |
| `C:\VENTA-DE-PASAJES\services\identity-service\target` | Salida local de Maven si no usas workspace limpio. | No. Solo sirve para construir la imagen. |
| `%TEMP%\venta-pasajes-identity-native-<PID>\identity-service` | Workspace temporal cuando se usa `-UseCleanWorkspace`. | No. Se elimina o queda como evidencia temporal local. |

Lo que finalmente usa Cloud Run no es la carpeta del proyecto, sino esta imagen:

```text
us-central1-docker.pkg.dev/project-fbb34cd7-0b82-43e1-867/venta-pasajes-dev/identity-service:<tag>
```

Ejemplo de tag nativo productivo:

```text
us-central1-docker.pkg.dev/project-fbb34cd7-0b82-43e1-867/venta-pasajes-dev/identity-service:identity-prod-native-20261006-1200
```

### Paso previo obligatorio antes de usar la consola web

Para que la consola web pueda desplegar una imagen, primero se debe publicar la imagen en Artifact Registry. Este paso sigue siendo local porque el navegador no puede tomar directamente tu carpeta `C:\VENTA-DE-PASAJES` ni tu imagen Docker local.

```powershell
cd C:\VENTA-DE-PASAJES

$ImageTag = "identity-prod-native-" + (Get-Date -Format "yyyyMMdd-HHmm")

powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-identity-service-native.ps1 `
  -ProjectId project-fbb34cd7-0b82-43e1-867 `
  -Region us-central1 `
  -Repository venta-pasajes-dev `
  -ImageTag $ImageTag `
  -UseCleanWorkspace `
  -Push
```

Al finalizar, guardar la ruta de la imagen:

```powershell
$ImageUri = "us-central1-docker.pkg.dev/project-fbb34cd7-0b82-43e1-867/venta-pasajes-dev/identity-service:$ImageTag"
$ImageUri
```

Validar que existe:

```powershell
$GcloudPath = "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd"
$env:CLOUDSDK_PYTHON = "C:\Python312\python.exe"

& $GcloudPath artifacts docker images describe $ImageUri `
  --project=project-fbb34cd7-0b82-43e1-867 `
  --format="value(image_summary.digest)"
```

### Publicar por interfaz grafica de Google Cloud

> Usar estos pasos solo despues de publicar la imagen en Artifact Registry.
>
> Para produccion real, preferir crear una revision candidata sin trafico y mover trafico solo despues de validar. Si la consola no muestra una opcion clara para evitar trafico inmediato, no continuar por interfaz grafica; usar el flujo por comandos de la seccion productiva.

#### Paso G1 - Seleccionar proyecto

1. Abrir `https://console.cloud.google.com/`.
2. En el selector superior de proyecto, elegir:

```text
project-fbb34cd7-0b82-43e1-867
```

#### Paso G2 - Confirmar que la imagen existe en Artifact Registry

1. Ir a `Artifact Registry`.
2. Entrar en `Repositorios`.
3. Abrir el repositorio:

```text
venta-pasajes-dev
```

4. Ubicacion esperada:

```text
us-central1
```

5. Abrir la imagen:

```text
identity-service
```

6. Confirmar que existe el tag que acabas de publicar, por ejemplo:

```text
identity-prod-native-20261006-1200
```

7. Copiar la ruta completa de la imagen. Debe verse similar a:

```text
us-central1-docker.pkg.dev/project-fbb34cd7-0b82-43e1-867/venta-pasajes-dev/identity-service:identity-prod-native-20261006-1200
```

#### Paso G3 - Abrir el servicio productivo en Cloud Run

1. Ir a `Cloud Run`.
2. Entrar en `Servicios`.
3. Verificar region:

```text
us-central1
```

4. Abrir:

```text
identity-service-prod
```

No crear un servicio nuevo si el objetivo es actualizar produccion. El servicio productivo ya existe; se debe crear una nueva revision.

#### Paso G4 - Crear una nueva revision desde la imagen

1. Dentro de `identity-service-prod`, elegir `Editar y desplegar nueva revision` o la opcion equivalente de nueva revision.
2. En imagen de contenedor, pegar la imagen publicada:

```text
us-central1-docker.pkg.dev/project-fbb34cd7-0b82-43e1-867/venta-pasajes-dev/identity-service:<tag>
```

3. Configurar puerto del contenedor:

```text
8081
```

4. Configurar recursos igual que `infra\cloudrun\prod-backend-services.json`:

```text
CPU: 1
Memoria: 512Mi
Min instances: 0
Max instances: 2
```

5. Configurar autenticacion:

```text
Requerir autenticacion
```

No permitir `allUsers`.

6. Configurar identidad de servicio:

```text
identity-prod-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com
```

#### Paso G5 - Configurar variables de entorno

Estas variables deben quedar alineadas con `C:\VENTA-DE-PASAJES\infra\cloudrun\prod-backend-services.json`.

```text
APP_ENV=prod
APP_RUNTIME_TARGET=gcp
APP_SECRETS_PROVIDER=google-secret-manager
GOOGLE_CLOUD_PROJECT=project-fbb34cd7-0b82-43e1-867
QUARKUS_PROFILE=gcp
QUARKUS_HTTP_PORT=8081
CLOUD_SQL_CONNECTION_NAME=project-fbb34cd7-0b82-43e1-867:us-central1:venta-pasajes-prod-sql
APP_DB_JDBC_URL=jdbc:postgresql:///identity_db?cloudSqlInstance=project-fbb34cd7-0b82-43e1-867:us-central1:venta-pasajes-prod-sql&socketFactory=com.google.cloud.sql.postgres.SocketFactory&enableIamAuth=true&sslmode=disable
APP_DATABASE_SECRET_NAME=identity-service-prod__db-connection
APP_DB_USERNAME=identity-prod-run@project-fbb34cd7-0b82-43e1-867.iam
QUARKUS_FLYWAY_MIGRATE_AT_START=true
QUARKUS_FLYWAY_BASELINE_ON_MIGRATE=true
APP_JWT_SIGNING_SECRET_NAME=identity-service-prod__jwt-signing-secret
APP_PASSWORD_PEPPER_SECRET_NAME=identity-service-prod__password-pepper
APP_RECOVERY_TOKEN_PEPPER_SECRET_NAME=identity-service-prod__recovery-token-pepper
APP_REFRESH_TOKEN_PEPPER_SECRET_NAME=identity-service-prod__refresh-token-pepper
```

Nota: estos valores son nombres y configuracion. No pegar secretos reales como texto plano en la revision.

#### Paso G6 - Configurar Cloud SQL

En la seccion de conexiones o Cloud SQL, agregar:

```text
project-fbb34cd7-0b82-43e1-867:us-central1:venta-pasajes-prod-sql
```

Esto debe coincidir con `CLOUD_SQL_CONNECTION_NAME`.

#### Paso G7 - Revisar trafico antes de desplegar

Si la consola muestra una opcion como `Enviar trafico inmediatamente` o `Servir esta revision inmediatamente`, desactivarla para crear una revision candidata sin trafico.

Si la consola no permite desplegar sin trafico de forma clara, detener el proceso y usar los pasos por comandos de la seccion `Publicar cambios de identity-service en produccion`.

#### Paso G8 - Desplegar revision candidata

1. Revisar resumen final.
2. Confirmar que:
   - servicio: `identity-service-prod`;
   - region: `us-central1`;
   - imagen: `identity-service:<tag nuevo>`;
   - autenticacion: requerida;
   - service account: `identity-prod-run`;
   - Cloud SQL: `venta-pasajes-prod-sql`;
   - puerto: `8081`.
3. Crear la revision.

#### Paso G9 - Probar revision candidata

Si la consola muestra una URL etiquetada de la revision candidata, probar health con identidad autenticada. Desde terminal:

```powershell
$GcloudPath = "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd"
$IdentityToken = & $GcloudPath auth print-identity-token
$CandidateUrl = "<url-candidata-de-la-consola>"

curl.exe -s `
  -H "Authorization: Bearer $IdentityToken" `
  "$CandidateUrl/api/v1/identity/health"
```

Si no tienes URL candidata, revisar la revision desde Cloud Run y confirmar que este `Ready`.

#### Paso G10 - Mover trafico desde la consola

Solo si las pruebas salieron bien:

1. En `identity-service-prod`, ir a la pestana de `Revisiones` o `Trafico`.
2. Seleccionar `Administrar trafico`.
3. Asignar `100%` a la revision nueva.
4. Guardar.
5. Confirmar que la revision anterior queda sin trafico, pero no eliminarla todavia.

#### Paso G11 - Rollback desde la consola

Si algo falla:

1. En `identity-service-prod`, ir a `Revisiones` o `Trafico`.
2. Elegir `Administrar trafico`.
3. Regresar `100%` a la revision anterior.
4. Guardar.
5. Validar health y login.

Importante: si la revision nueva ejecuto una migracion Flyway incompatible, mover trafico hacia atras no revierte la base de datos. En ese caso se requiere decision tecnica sobre correccion hacia adelante o restauracion desde backup.

### Referencias oficiales utiles

- Google Cloud documenta que Cloud Run puede desplegar una nueva revision desde una imagen de contenedor existente y que las revisiones son inmutables: `https://docs.cloud.google.com/run/docs/deploying`.
- Artifact Registry es el servicio usado para almacenar imagenes Docker/OCI y luego desplegarlas en Cloud Run: `https://docs.cloud.google.com/artifact-registry/docs/docker`.
- Google Cloud tambien documenta el flujo de almacenar imagenes Docker en Artifact Registry antes de usarlas en otros servicios: `https://docs.cloud.google.com/artifact-registry/docs/docker/store-docker-container-images`.

### Paso N1 - Ubicarse en el proyecto

```powershell
cd C:\VENTA-DE-PASAJES
```

### Paso N2 - Verificar Docker y espacio basico

```powershell
docker version
docker system df
```

Si Docker no responde, no continuar.

### Paso N3 - Compilar nativo y crear imagen local

Este paso puede tardar bastante.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-identity-service-native.ps1 `
  -ProjectId project-fbb34cd7-0b82-43e1-867 `
  -Region us-central1 `
  -Repository venta-pasajes-dev `
  -ImageTag local-native `
  -UseCleanWorkspace
```

Resultado esperado al final:

```json
{
  "service": "identity-service",
  "local_image": "identity-service:local-native",
  "ready": true
}
```

Validar que la imagen exista:

```powershell
docker image ls identity-service
```

Debe aparecer:

```text
identity-service   local-native
```

### Paso N4 - Probar la imagen nativa localmente

Este comando levanta base y servicio en contenedores temporales. Al terminar, limpia esos contenedores.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-identity-service-native-local.ps1 `
  -ImageTag identity-service:local-native `
  -HttpPort 18083 `
  -DatabasePort 55435 `
  -TimeoutSeconds 180
```

Resultado esperado:

```json
{
  "service": "identity-service",
  "runtime": "native-container",
  "image": "identity-service:local-native",
  "health_ready": "UP",
  "token_returned": true,
  "current_user": "admin",
  "ready": true
}
```

### Paso N5 - Interpretar el resultado

Si `ready` es `true`, significa que la imagen nativa:

- arranco correctamente;
- pudo conectarse a PostgreSQL;
- aplico Flyway;
- respondio health;
- ejecuto login local;
- valido el usuario actual con JWT.

Si falla, revisar el mensaje impreso por el script. El script muestra logs recientes del contenedor nativo antes de limpiar.

### Paso N6 - Limpiar imagen nativa local si ya no se necesita

La prueba temporal elimina contenedores, pero no elimina la imagen local.

```powershell
docker image rm identity-service:local-native -f
```

Si tambien quieres liberar espacio general de Docker, revisar primero:

```powershell
docker system df
```

No ejecutar limpiezas globales como `docker system prune -a` sin revisar, porque podrian eliminar imagenes de otros servicios del proyecto.

### Cuando usar JVM y cuando usar nativo

| Caso | Recomendacion |
| --- | --- |
| Estoy cambiando codigo y quiero validar rapido | Usar JVM local dockerizado. |
| Estoy validando health, login y base antes de seguir desarrollando | Usar JVM. |
| Estoy evaluando tiempo de arranque o consumo para Cloud Run | Probar nativo. |
| Estoy cerca de publicar una imagen nativa | Ejecutar prueba nativa local completa. |
| Falla nativo pero JVM funciona | No publicar nativo hasta corregir la causa. |
| Solo quiero probar funcionalidad del servicio | No usar nativo; consume mas tiempo sin aportar mucho en esa etapa. |

## Publicar cambios de `identity-service` en produccion

> Apartado operativo posterior al Dia 17. No fue ejecutado por Codex.
>
> Produccion ya esta funcionando. Por eso un cambio en `identity-service` no debe publicarse como "borrar y crear otra vez", sino como una nueva revision de Cloud Run con imagen nueva, validacion, cambio de trafico y rollback preparado.

### Concepto: que significa reemplazar el servicio

En Cloud Run, `identity-service-prod` no se reemplaza borrando el servicio. Lo correcto es:

1. Compilar una imagen nueva de `identity-service`.
2. Publicarla en Artifact Registry con un tag unico.
3. Crear una nueva revision de `identity-service-prod` usando esa imagen.
4. Probar la nueva revision sin enviarle trafico real.
5. Mover trafico a la revision nueva solo si la prueba sale bien.
6. Si algo falla, regresar el trafico a la revision anterior.

El servicio productivo conserva:

- el mismo nombre Cloud Run: `identity-service-prod`;
- la misma URL base;
- la misma service account: `identity-prod-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com`;
- la misma base: `identity_db` dentro de `venta-pasajes-prod-sql`;
- los mismos secretos productivos `identity-service-prod__...`;
- el mismo modelo privado, sin `allUsers`.

Lo unico que cambia es la revision activa y la imagen que ejecuta esa revision.

### Riesgo especial de `identity-service`

`identity-service` controla login, JWT, usuarios, roles, permisos y recuperacion de contrasena. Un error aqui puede bloquear el ingreso al sistema completo.

Antes de publicar, clasificar el cambio:

| Tipo de cambio | Riesgo | Tratamiento |
| --- | --- | --- |
| Cambio interno sin migracion | Medio | Probar local, construir imagen, desplegar revision sin trafico y validar health/login. |
| Cambio en endpoints usados por frontends | Alto | Validar shell/MFEs contra el nuevo contrato antes de mover trafico. |
| Cambio en JWT, roles o permisos | Alto | Probar login, `/me`, permisos y flujo de usuario administrador. |
| Cambio con migracion Flyway nueva | Muy alto | Crear backup Cloud SQL antes del despliegue. La migracion puede ejecutarse aunque la revision este sin trafico. |
| Cambio destructivo de base, como `DROP`, `RENAME` o cambio incompatible | Critico | No publicar directo. Hacer migracion en dos fases compatible hacia atras. |

### Paso P1 - Ubicarse en el proyecto

```powershell
cd C:\VENTA-DE-PASAJES
```

### Paso P2 - Definir variables productivas

Usar un tag unico por despliegue. No reutilizar `prod-backend-0.1.1-jvm` si estas publicando una correccion nueva.

```powershell
$ProjectId = "project-fbb34cd7-0b82-43e1-867"
$Region = "us-central1"
$Repository = "venta-pasajes-dev"
$ServiceId = "identity-service"
$CloudRunService = "identity-service-prod"
$CloudSqlConnectionName = "project-fbb34cd7-0b82-43e1-867:us-central1:venta-pasajes-prod-sql"
$GcloudPath = "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd"
$env:CLOUDSDK_PYTHON = "C:\Python312\python.exe"

$Tag = "identity-prod-" + (Get-Date -Format "yyyyMMdd-HHmm")
$ArtifactImage = "$Region-docker.pkg.dev/$ProjectId/$Repository/${ServiceId}:$Tag"
```

### Paso P3 - Verificar estado local antes de construir

```powershell
git status --short
mvn -f .\services\identity-service\pom.xml test
mvn -f .\services\identity-service\pom.xml package -DskipTests
```

No continuar si las pruebas fallan.

### Paso P4 - Probar el cambio localmente con Docker

Ejecutar primero el apartado `Levantar identity-service y PostgreSQL localmente con Docker` de este mismo documento.

Validaciones minimas:

```powershell
curl.exe -s http://localhost:18081/q/health/ready
curl.exe -s http://localhost:18081/api/v1/identity/health
```

Si el cambio toca autenticacion:

```powershell
$LoginResponse = Invoke-RestMethod `
  -Uri "http://localhost:18081/api/v1/identity/auth/local/login" `
  -Method Post `
  -ContentType "application/json" `
  -Body (@{
    login = "admin"
    password = "AdminLocal_ChangeMe_12345"
  } | ConvertTo-Json)

$Headers = @{ Authorization = "Bearer $($LoginResponse.access_token)" }
Invoke-RestMethod -Uri "http://localhost:18081/api/v1/identity/me" -Method Get -Headers $Headers
```

### Paso P5 - Crear evidencia del estado actual de produccion

Antes de cambiar nada, guardar la revision e imagen actuales para rollback.

```powershell
New-Item -ItemType Directory -Force -Path .\logs\cloudrun-prod | Out-Null

$SnapshotPath = ".\logs\cloudrun-prod\identity-service-prod-before-$Tag.json"

& $GcloudPath run services describe $CloudRunService `
  --project=$ProjectId `
  --region=$Region `
  --format=json |
  Set-Content -LiteralPath $SnapshotPath -Encoding UTF8

$Before = Get-Content -LiteralPath $SnapshotPath -Raw | ConvertFrom-Json
$CurrentImage = [string]@($Before.spec.template.spec.containers)[0].image
$CurrentTraffic = @($Before.status.traffic | Where-Object { $_.percent -gt 0 })
$RollbackRevisions = ($CurrentTraffic | ForEach-Object { "$($_.revisionName)=$($_.percent)" }) -join ","

[pscustomobject]@{
  current_image = $CurrentImage
  rollback_revisions = $RollbackRevisions
  snapshot_path = $SnapshotPath
} | Format-List
```

Guardar el valor de `rollback_revisions`. Si algo falla, ese valor permite devolver el trafico a la revision anterior.

### Paso P6 - Crear backup si hay migraciones de base

Revisar si agregaste migraciones nuevas:

```powershell
git diff --name-only HEAD -- .\services\identity-service\src\main\resources\db\migration
```

Si hay migracion nueva y vas a tocar produccion, crear backup antes de desplegar:

```powershell
& $GcloudPath sql backups create `
  --project=$ProjectId `
  --instance=venta-pasajes-prod-sql `
  --description="pre-$CloudRunService-$Tag"
```

Importante:

- una revision `--no-traffic` puede arrancar igual y ejecutar Flyway;
- si `QUARKUS_FLYWAY_MIGRATE_AT_START=true`, la migracion puede aplicarse antes de mover trafico;
- por eso el backup debe existir antes de crear la revision nueva;
- una migracion productiva debe ser compatible con la version anterior mientras dure el rollback.

### Paso P7 - Construir y publicar imagen productiva

Este script usa la configuracion de `infra\cloudrun\prod-backend-services.json`, pero solo para `identity-service`.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-backend-jvm-images.ps1 `
  -ConfigPath .\infra\cloudrun\prod-backend-services.json `
  -ProjectId $ProjectId `
  -Region $Region `
  -Repository $Repository `
  -ServiceIds identity-service `
  -ImageTag $Tag `
  -UseCleanWorkspace `
  -Push
```

Validar que la imagen exista en Artifact Registry:

```powershell
& $GcloudPath artifacts docker images describe $ArtifactImage `
  --project=$ProjectId `
  --format="value(image_summary.digest)"
```

### Paso P8 - Crear revision nueva sin trafico real

Este paso crea una nueva revision de `identity-service-prod` con la imagen nueva y etiqueta `candidate`, pero sin mover usuarios reales a esa revision.

```powershell
$ProdEnvVars = @(
  "APP_ENV=prod",
  "APP_RUNTIME_TARGET=gcp",
  "APP_SECRETS_PROVIDER=google-secret-manager",
  "GOOGLE_CLOUD_PROJECT=$ProjectId",
  "QUARKUS_PROFILE=gcp",
  "QUARKUS_HTTP_PORT=8081",
  "CLOUD_SQL_CONNECTION_NAME=$CloudSqlConnectionName",
  "APP_DB_JDBC_URL=jdbc:postgresql:///identity_db?cloudSqlInstance=$CloudSqlConnectionName&socketFactory=com.google.cloud.sql.postgres.SocketFactory&enableIamAuth=true&sslmode=disable",
  "APP_DATABASE_SECRET_NAME=identity-service-prod__db-connection",
  "APP_DB_USERNAME=identity-prod-run@$ProjectId.iam",
  "QUARKUS_FLYWAY_MIGRATE_AT_START=true",
  "QUARKUS_FLYWAY_BASELINE_ON_MIGRATE=true",
  "APP_JWT_SIGNING_SECRET_NAME=identity-service-prod__jwt-signing-secret",
  "APP_PASSWORD_PEPPER_SECRET_NAME=identity-service-prod__password-pepper",
  "APP_RECOVERY_TOKEN_PEPPER_SECRET_NAME=identity-service-prod__recovery-token-pepper",
  "APP_REFRESH_TOKEN_PEPPER_SECRET_NAME=identity-service-prod__refresh-token-pepper"
) -join ","

& $GcloudPath run deploy $CloudRunService `
  --project=$ProjectId `
  --region=$Region `
  --platform=managed `
  --image=$ArtifactImage `
  --service-account="identity-prod-run@$ProjectId.iam.gserviceaccount.com" `
  --port=8081 `
  --cpu=1 `
  --memory=512Mi `
  --min-instances=0 `
  --max-instances=2 `
  --add-cloudsql-instances=$CloudSqlConnectionName `
  --set-env-vars=$ProdEnvVars `
  --no-allow-unauthenticated `
  --tag=candidate `
  --no-traffic
```

### Paso P9 - Obtener URL candidata y probar sin trafico real

```powershell
$AfterNoTraffic = & $GcloudPath run services describe $CloudRunService `
  --project=$ProjectId `
  --region=$Region `
  --format=json |
  ConvertFrom-Json

$CandidateRevision = [string]$AfterNoTraffic.status.latestCreatedRevisionName
$CandidateUrl = [string](@($AfterNoTraffic.status.traffic | Where-Object { $_.tag -eq "candidate" } | Select-Object -First 1).url)

[pscustomobject]@{
  candidate_revision = $CandidateRevision
  candidate_url = $CandidateUrl
} | Format-List
```

Probar health autenticado:

```powershell
$IdentityToken = & $GcloudPath auth print-identity-token

curl.exe -s `
  -H "Authorization: Bearer $IdentityToken" `
  "$CandidateUrl/api/v1/identity/health"
```

Si el cambio toca autenticacion, probar tambien un flujo real controlado desde el frontend o desde una cuenta autorizada de prueba. No mover trafico solo por ver `Ready=True`.

### Paso P10 - Mover trafico a la revision nueva

Si la revision candidata paso las pruebas, mover el 100% del trafico:

```powershell
& $GcloudPath run services update-traffic $CloudRunService `
  --project=$ProjectId `
  --region=$Region `
  --to-revisions="$CandidateRevision=100"
```

Validar:

```powershell
& $GcloudPath run services describe $CloudRunService `
  --project=$ProjectId `
  --region=$Region `
  --format="table(status.traffic.revisionName,status.traffic.percent,status.traffic.tag)"
```

### Paso P11 - Verificacion productiva posterior

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-cloudrun-prod-backends.ps1 `
  -ConfigPath .\infra\cloudrun\prod-backend-services.json `
  -ProjectId $ProjectId `
  -Region $Region `
  -ImageTag $Tag `
  -FailOnNotReady
```

Revisar tambien logs de la revision nueva:

```powershell
& $GcloudPath logging read `
  "resource.type=cloud_run_revision AND resource.labels.service_name=$CloudRunService" `
  --project=$ProjectId `
  --limit=50 `
  --format="table(timestamp,severity,textPayload)"
```

### Paso P12 - Rollback si algo falla

Si despues de publicar aparecen errores de login, permisos, health o base de datos, regresar trafico al estado anterior:

```powershell
& $GcloudPath run services update-traffic $CloudRunService `
  --project=$ProjectId `
  --region=$Region `
  --to-revisions=$RollbackRevisions
```

Validar que el servicio volvio a la revision anterior:

```powershell
& $GcloudPath run services describe $CloudRunService `
  --project=$ProjectId `
  --region=$Region `
  --format="table(status.traffic.revisionName,status.traffic.percent,status.traffic.tag)"
```

Si el problema incluyo una migracion de base incompatible, el rollback de Cloud Run no deshace automaticamente la base de datos. En ese caso se debe decidir con el responsable de datos si se corrige hacia adelante o si se restaura Cloud SQL desde el backup creado en el Paso P6.

### Resumen de decision para produccion

| Pregunta | Si la respuesta es no |
| --- | --- |
| Las pruebas de `identity-service` pasan localmente? | No construir imagen productiva. |
| La prueba Docker local con PostgreSQL funciona? | No publicar imagen. |
| La imagen existe en Artifact Registry? | No desplegar Cloud Run. |
| Existe snapshot de revision anterior? | No mover trafico. |
| Hay backup si existen migraciones? | No crear revision nueva. |
| La revision `candidate` responde health y login controlado? | No mover trafico. |
| Se puede ejecutar rollback con `RollbackRevisions`? | No continuar sin capturar estado anterior. |

## Pendientes para dias posteriores

- Dia 18: implementar autenticacion Google y local.
- Agregar hash real de contrasena con pepper obtenido desde el proveedor de secretos del entorno.
- Reemplazar stubs `501` por casos de uso reales.
- Definir runner de migraciones para aplicar DDL a Cloud SQL dev y posteriores entornos.
- Mantener soporte on-premise/offline usando `QUARKUS_PROFILE=onprem` y proveedor de secretos por variables/archivo local.

## Reversa primero

> Estandarizacion documental agregada el 2026-09-16 para que este dia tambien tenga una ruta segura de limpieza antes de repetir la practica.

Este dia pertenece a la etapa inicial del proyecto. Antes de ejecutar una reversa, revisar si el archivo contiene recursos externos reales, como Google Cloud, Docker, bases de datos o imagenes publicadas. No ejecutar comandos destructivos si no estas seguro de que el recurso no esta siendo usado.

### Paso R1 - Ubicarse en el workspace

```powershell
cd C:\VENTA-DE-PASAJES
```

### Paso R2 - Revisar recursos o archivos mencionados

```powershell
Select-String -Path .\docs\dia-17-identity-service-base.md -Pattern "C:\\VENTA-DE-PASAJES|docker|gcloud|mvn|npm|Remove-Item|delete|rm|Cloud SQL|Artifact Registry|Secret Manager" -Context 0,2
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
Select-String -Path .\docs\dia-17-identity-service-base.md -Pattern "Archivo|Archivos|C:\\VENTA-DE-PASAJES" -Context 0,4
```

Si aun asi necesitas retirar solo este documento de la practica, hacer primero una copia:

```powershell
New-Item -ItemType Directory -Force -Path .\backups | Out-Null
Copy-Item -LiteralPath .\docs\dia-17-identity-service-base.md -Destination .\backups\dia-17-identity-service-base-manual-backup.md -Force
```

Despues de respaldar, se podria eliminar manualmente el documento con:

```powershell
Remove-Item -LiteralPath .\docs\dia-17-identity-service-base.md -Force
```

## Guia manual desde cero

> Estandarizacion documental agregada el 2026-09-16. Esta guia permite repetir el dia sin depender de Codex, usando el documento como fuente de verdad.

### Paso 1 - Ubicarse en el proyecto

```powershell
cd C:\VENTA-DE-PASAJES
```

### Paso 2 - Leer el alcance del dia en el backlog

```powershell
Select-String -Path .\tareas.md -Pattern "Dia 17|Dia 17" -Context 0,40
```

### Paso 3 - Leer la documentacion del dia

```powershell
Get-Content -LiteralPath .\docs\dia-17-identity-service-base.md
```

### Paso 4 - Verificar archivos y rutas mencionadas

```powershell
Select-String -Path .\docs\dia-17-identity-service-base.md -Pattern "C:\\VENTA-DE-PASAJES" -AllMatches
```

Para cada ruta importante que aparezca en el documento:

```powershell
Test-Path -LiteralPath "<ruta-copiada-del-documento>"
```

### Paso 5 - Ejecutar comandos documentados

Buscar bloques de comandos del documento y ejecutarlos en orden, validando el resultado de cada bloque antes de continuar:

```powershell
Select-String -Path .\docs\dia-17-identity-service-base.md -Pattern "```powershell|```text|mvn |npm |docker |gcloud |curl.exe|powershell " -Context 0,6
```

### Paso 6 - Registrar la repeticion en bitacora

```powershell
Add-Content -LiteralPath .\vitacora.md -Value "`nReplica manual Dia 17 - <fecha>: comandos ejecutados y resultado."
```

### Paso 7 - Validar criterio de avance

Revisar la seccion de criterio de avance, resultado, estado final o pendientes del documento:

```powershell
Select-String -Path .\docs\dia-17-identity-service-base.md -Pattern "Criterio de avance|Resultado|Estado final|Pendiente|Pendientes" -Context 0,8
```
