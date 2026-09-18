# Dia 16 - Plantilla estandar de microservicio Quarkus

Fecha: 2026-09-02

## Objetivo

Crear una plantilla reutilizable para construir microservicios backend Quarkus con el mismo estandar tecnico: REST, persistencia, migraciones, OpenAPI, health checks y logs JSON.

## Resultado ejecutivo

Dia 16 completado.

Se creo la plantilla base `C:\VENTA-DE-PASAJES\services\quarkus-service-template` y el generador `C:\VENTA-DE-PASAJES\scripts\new-quarkus-service.ps1`.

La plantilla compila, ejecuta pruebas y genera paquete Quarkus. Tambien permite crear servicios nuevos rapidamente sin repetir configuracion base.

## Stack incluido

| Area | Decision |
| --- | --- |
| Runtime | Quarkus `3.25.2` con Java 21 |
| REST | `quarkus-rest-jackson` |
| Persistencia | Hibernate ORM Panache |
| Base de datos | PostgreSQL JDBC |
| Migraciones | Flyway |
| Contrato tecnico | SmallRye OpenAPI y Swagger UI |
| Salud | SmallRye Health |
| Logs | JSON logging configurable por entorno |
| Tests | `@QuarkusTest` y REST Assured |

## Estructura creada

```text
C:\VENTA-DE-PASAJES\services\quarkus-service-template
|-- README.md
|-- pom.xml
|-- src
|   |-- main
|   |   |-- java\com\ventapasajes\template
|   |   |   |-- api
|   |   |   |-- health
|   |   |   `-- persistence
|   |   `-- resources
|   |       |-- application.properties
|   |       `-- db\migration\V1__init_template.sql
|   `-- test
|       `-- java\com\ventapasajes\template\api\TemplateHealthResourceTest.java
C:\VENTA-DE-PASAJES\scripts\new-quarkus-service.ps1
```

## Endpoints base

```text
GET /api/v1/template/health
GET /q/health
GET /q/health/live
GET /q/health/ready
GET /q/openapi
GET /q/swagger-ui
```

## Configuracion base

- API funcional bajo `/api/v1/<dominio>`.
- Endpoints tecnicos bajo `/q`.
- Datasource PostgreSQL preparado para cada base por servicio.
- Flyway configurado con `db/migration`.
- Logs JSON activos en perfil `prod`.
- Perfil `gcp` preparado para Secret Manager/Cloud SQL IAM.
- Perfil `onprem` preparado para variables de entorno o archivo local seguro.
- En perfil `test` se desactiva el health check automatico del datasource para probar la plantilla sin PostgreSQL local.
- No se guardan secretos reales en `application.properties`.

## Generador de servicios

Script creado:

```text
C:\VENTA-DE-PASAJES\scripts\new-quarkus-service.ps1
```

Uso previsto:

```powershell
.\scripts\new-quarkus-service.ps1 `
  -ServiceName identity-service `
  -PackageSegment identity `
  -DatabaseName identity_db `
  -HttpPort 8081
```

El generador:

- Copia la plantilla.
- Cambia `quarkus-service-template` por el nombre del servicio.
- Renombra paquetes Java desde `com.ventapasajes.template`.
- Ajusta endpoint base, nombre de base, usuario local/on-premise, usuario IAM de Cloud SQL y nombre de secreto.
- No sobrescribe un servicio existente con contenido salvo que se use `-Force`.

Validacion en modo seco para `identity-service`:

```json
{"service_name":"identity-service","package":"com.ventapasajes.identity","database_name":"identity_db","http_port":8081,"target_root":"C:\\VENTA-DE-PASAJES\\services\\identity-service","cloud_sql_iam_user":"identity-service-run@project-fbb34cd7-0b82-43e1-867.iam","secret_name":"identity-service__db-connection","api_base_path":"/api/v1/identity","target_exists":true,"only_gitkeep":true,"dry_run":true}
```

## Incidencia corregida

La primera ejecucion de pruebas fallo porque `/q/health/ready` incluia el health check automatico del datasource e intentaba conectarse a `localhost:5432`.

Accion:

- Se agrego `%test.quarkus.datasource.health.enabled=false`.
- Se conservaron los health checks propios de la plantilla.
- Se actualizaron propiedades obsoletas de Hibernate ORM y JSON logging.

Resultado posterior:

```text
Tests run: 3, Failures: 0, Errors: 0, Skipped: 0
BUILD SUCCESS
```

## Comandos ejecutados

Revision del alcance y archivos base:

```powershell
$lines = Get-Content -Path tareas.md; $lines[786..807]
Get-Content -Path services\toolchain-demo-service\pom.xml
Get-Content -Path services\toolchain-demo-service\src\main\resources\application.properties
Get-Content -Path docs\dia-10-toolchain-quarkus-java.md
```

Validaciones de script:

```powershell
$Errors = $null
[System.Management.Automation.Language.Parser]::ParseFile((Resolve-Path .\scripts\new-quarkus-service.ps1), [ref]$null, [ref]$Errors)

powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\new-quarkus-service.ps1 -DryRun -ServiceName identity-service -PackageSegment identity -DatabaseName identity_db -HttpPort 8081
```

Pruebas y build:

```powershell
mvn -f .\services\quarkus-service-template\pom.xml test
mvn -f .\services\quarkus-service-template\pom.xml package -DskipTests
```

Consulta de estado local:

```powershell
git status --short
```

Resultado: la carpeta `C:\VENTA-DE-PASAJES` no esta inicializada como repositorio Git.

## Validacion

- Plantilla Quarkus creada: OK.
- REST base: OK.
- Hibernate ORM Panache configurado: OK.
- Flyway configurado: OK.
- OpenAPI disponible: OK.
- Health endpoints disponibles: OK.
- Logs JSON configurados: OK.
- Generador de servicio en `DryRun`: OK.
- Tests Maven: OK.
- Package Maven: OK.

## Pendientes para dias posteriores

- Dia 17: crear `identity-service` desde la plantilla.
- Conectar `identity-service` a `identity_db`.
- Convertir el DDL del dominio identidad en migraciones reales.
- Agregar endpoints funcionales de identidad segun contratos OpenAPI.

## Reversa primero

> Estandarizacion documental agregada el 2026-09-16 para que este dia tambien tenga una ruta segura de limpieza antes de repetir la practica.

Este dia pertenece a la etapa inicial del proyecto. Antes de ejecutar una reversa, revisar si el archivo contiene recursos externos reales, como Google Cloud, Docker, bases de datos o imagenes publicadas. No ejecutar comandos destructivos si no estas seguro de que el recurso no esta siendo usado.

### Paso R1 - Ubicarse en el workspace

```powershell
cd C:\VENTA-DE-PASAJES
```

### Paso R2 - Revisar recursos o archivos mencionados

```powershell
Select-String -Path .\docs\dia-16-plantilla-estandar-microservicio-quarkus.md -Pattern "C:\\VENTA-DE-PASAJES|docker|gcloud|mvn|npm|Remove-Item|delete|rm|Cloud SQL|Artifact Registry|Secret Manager" -Context 0,2
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
Select-String -Path .\docs\dia-16-plantilla-estandar-microservicio-quarkus.md -Pattern "Archivo|Archivos|C:\\VENTA-DE-PASAJES" -Context 0,4
```

Si aun asi necesitas retirar solo este documento de la practica, hacer primero una copia:

```powershell
New-Item -ItemType Directory -Force -Path .\backups | Out-Null
Copy-Item -LiteralPath .\docs\dia-16-plantilla-estandar-microservicio-quarkus.md -Destination .\backups\dia-16-plantilla-estandar-microservicio-quarkus-manual-backup.md -Force
```

Despues de respaldar, se podria eliminar manualmente el documento con:

```powershell
Remove-Item -LiteralPath .\docs\dia-16-plantilla-estandar-microservicio-quarkus.md -Force
```

## Guia manual desde cero

> Estandarizacion documental agregada el 2026-09-16. Esta guia permite repetir el dia sin depender de Codex, usando el documento como fuente de verdad.

### Paso 1 - Ubicarse en el proyecto

```powershell
cd C:\VENTA-DE-PASAJES
```

### Paso 2 - Leer el alcance del dia en el backlog

```powershell
Select-String -Path .\tareas.md -Pattern "Dia 16|Dia 16" -Context 0,40
```

### Paso 3 - Leer la documentacion del dia

```powershell
Get-Content -LiteralPath .\docs\dia-16-plantilla-estandar-microservicio-quarkus.md
```

### Paso 4 - Verificar archivos y rutas mencionadas

```powershell
Select-String -Path .\docs\dia-16-plantilla-estandar-microservicio-quarkus.md -Pattern "C:\\VENTA-DE-PASAJES" -AllMatches
```

Para cada ruta importante que aparezca en el documento:

```powershell
Test-Path -LiteralPath "<ruta-copiada-del-documento>"
```

### Paso 5 - Ejecutar comandos documentados

Buscar bloques de comandos del documento y ejecutarlos en orden, validando el resultado de cada bloque antes de continuar:

```powershell
Select-String -Path .\docs\dia-16-plantilla-estandar-microservicio-quarkus.md -Pattern "```powershell|```text|mvn |npm |docker |gcloud |curl.exe|powershell " -Context 0,6
```

### Paso 6 - Registrar la repeticion en bitacora

```powershell
Add-Content -LiteralPath .\vitacora.md -Value "`nReplica manual Dia 16 - <fecha>: comandos ejecutados y resultado."
```

### Paso 7 - Validar criterio de avance

Revisar la seccion de criterio de avance, resultado, estado final o pendientes del documento:

```powershell
Select-String -Path .\docs\dia-16-plantilla-estandar-microservicio-quarkus.md -Pattern "Criterio de avance|Resultado|Estado final|Pendiente|Pendientes" -Context 0,8
```
