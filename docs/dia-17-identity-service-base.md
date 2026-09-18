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
