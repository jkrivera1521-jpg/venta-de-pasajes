# Dia 21 - dispatch-service base

Fecha: 2026-09-07

## Objetivo

Crear la base tecnica de `dispatch-service`, el microservicio duenio del dominio de despacho y programacion.

Alcance del dia:

```text
- Crear proyecto Quarkus dispatch-service desde la plantilla estandar.
- Crear migracion inicial para terminales, rutas, tipos de bus, buses y layouts.
- Crear entidades base del dominio.
- Crear endpoints base.
- Configurar OpenAPI.
- Crear pruebas unitarias/base.
- Validar el servicio localmente con PostgreSQL temporal.
```

El CRUD completo de terminales/rutas queda para el Dia 22. El CRUD de tipos de bus, buses y layouts queda para el Dia 23.

## Resultado alcanzado durante la practica

Se creo `dispatch-service` en:

```text
C:\VENTA-DE-PASAJES\services\dispatch-service
```

El servicio quedo con:

```text
- API base en /api/v1/dispatch.
- Health en /api/v1/dispatch/health.
- OpenAPI en /q/openapi.
- Swagger UI en /q/swagger-ui.
- Migracion Flyway V1__dispatch_schema.sql.
- Modelo inicial de 8 tablas en dispatch_db.
- 8 pruebas automatizadas exitosas.
- Verificacion local exitosa con PostgreSQL temporal.
```

Resultado de pruebas:

```text
Tests run: 8, Failures: 0, Errors: 0, Skipped: 0
BUILD SUCCESS
```

Resultado de verificacion local:

```json
{"service":"dispatch-service","quarkus_profile":"onprem","secrets_provider":"env","database":"dispatch_db","migration_tool":"flyway","database_port":55436,"http_port":18084,"health_ready":"UP","dispatch_tables":8,"resources_count":6,"departure_statuses_count":4,"seat_positions_count":5,"openapi_title":"Dispatch Service API","container":"venta-pasajes-dispatch-pg-<pid>","ready":true}
```

## Archivos creados o modificados

| Archivo | Proposito |
| --- | --- |
| `C:\VENTA-DE-PASAJES\services\dispatch-service\pom.xml` | Proyecto Maven/Quarkus del servicio. |
| `C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\resources\application.properties` | Configuracion local, test, on-premise y GCP. |
| `C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\resources\db\migration\V1__dispatch_schema.sql` | Migracion inicial del dominio despacho. |
| `C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\DispatchHealthResource.java` | Endpoint de health funcional. |
| `C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\DispatchBaseResource.java` | Endpoints base del dominio dispatch. |
| `C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\DispatchOpenApiConfiguration.java` | Definicion OpenAPI del servicio. |
| `C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\dto\DispatchOverviewResponse.java` | DTO de resumen del dominio. |
| `C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\dto\DispatchResourceResponse.java` | DTO de recursos administrados por dispatch. |
| `C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\domain\DepartureStatus.java` | Estados permitidos para salidas. |
| `C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\domain\SeatPosition.java` | Posiciones permitidas para asientos. |
| `C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\persistence\entity\Terminal.java` | Entidad JPA para terminales. |
| `C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\persistence\entity\DispatchRoute.java` | Entidad JPA para rutas. |
| `C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\persistence\entity\BusType.java` | Entidad JPA para tipos de bus. |
| `C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\persistence\entity\SeatLayout.java` | Entidad JPA para layouts. |
| `C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\persistence\entity\SeatLayoutSeat.java` | Entidad JPA para asientos de layout. |
| `C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\persistence\entity\Bus.java` | Entidad JPA para buses. |
| `C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\persistence\entity\Departure.java` | Entidad JPA para salidas programadas. |
| `C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\service\DispatchCatalogService.java` | Servicio de catalogo base del dominio. |
| `C:\VENTA-DE-PASAJES\services\dispatch-service\src\test\java\com\ventapasajes\dispatch\api\DispatchBaseResourceTest.java` | Pruebas de endpoints base. |
| `C:\VENTA-DE-PASAJES\services\dispatch-service\src\test\java\com\ventapasajes\dispatch\api\DispatchHealthResourceTest.java` | Pruebas de health y OpenAPI. |
| `C:\VENTA-DE-PASAJES\services\dispatch-service\src\test\java\com\ventapasajes\dispatch\persistence\DispatchMigrationContractTest.java` | Prueba de contrato de migracion. |
| `C:\VENTA-DE-PASAJES\scripts\verify-dispatch-service-local-db.ps1` | Verificacion local con PostgreSQL temporal. |
| `C:\VENTA-DE-PASAJES\services\dispatch-service\README.md` | Resumen operativo del servicio. |

## Reversa primero

Esta reversa sirve para limpiar lo construido o detener una prueba local. No ejecutar en ambientes compartidos sin revisar antes.

### Detener servicio local en puerto 18084 o 8082

Buscar procesos que esten usando los puertos:

```powershell
Get-NetTCPConnection -LocalPort 18084,8082 -ErrorAction SilentlyContinue |
  Select-Object LocalAddress,LocalPort,State,OwningProcess |
  Format-Table -AutoSize
```

Si aparece un proceso y se desea detener:

```powershell
Stop-Process -Id <PID> -Force
```

### Eliminar PostgreSQL temporal de dispatch

Si se uso el script de verificacion, normalmente limpia el contenedor solo. Si quedo vivo:

```powershell
docker ps -a --filter "name=venta-pasajes-dispatch" --format "{{.Names}}"
docker rm -f venta-pasajes-dispatch-pg-manual
```

Si el contenedor fue creado por el script, tendra un nombre parecido a:

```text
venta-pasajes-dispatch-pg-<pid>
```

Eliminarlo manualmente:

```powershell
docker rm -f venta-pasajes-dispatch-pg-<pid>
```

### Eliminar paquete generado localmente

No elimina codigo fuente, solo artefactos de build:

```powershell
Remove-Item -LiteralPath .\services\dispatch-service\target -Recurse -Force -ErrorAction SilentlyContinue
```

### Revertir una base local persistente

Si en lugar de PostgreSQL temporal se creo una base local persistente llamada `dispatch_db`, se puede eliminar con cuidado:

```powershell
psql -h localhost -p 5432 -U postgres -d postgres -c "DROP DATABASE IF EXISTS dispatch_db;"
```

Si tambien se creo un usuario local:

```powershell
psql -h localhost -p 5432 -U postgres -d postgres -c "DROP USER IF EXISTS dispatch_user;"
```

### Eliminar el servicio generado

Atencion: esto borra el codigo del servicio. Usarlo solo si se quiere repetir el Dia 21 desde cero.

```powershell
Remove-Item -LiteralPath .\services\dispatch-service -Recurse -Force
New-Item -ItemType Directory -Force -Path .\services\dispatch-service | Out-Null
Set-Content -Path .\services\dispatch-service\.gitkeep -Value "keep"
```

## Guia manual desde cero

Esta guia reconstruye manualmente el objetivo del Dia 21.

### Paso 1 - Ubicarse en el proyecto

```powershell
cd C:\VENTA-DE-PASAJES
```

Validar herramientas:

```powershell
java -version
mvn -version
docker version
```

Resultado esperado:

```text
Java 21 disponible
Maven disponible
Docker disponible y con engine activo
```

Si Docker no responde, iniciar Docker Desktop:

```powershell
Start-Service -Name com.docker.service -ErrorAction SilentlyContinue
Start-Process -FilePath "C:\Program Files\Docker\Docker\Docker Desktop.exe" -WindowStyle Hidden
```

Esperar hasta que Docker responda:

```powershell
for ($i = 1; $i -le 60; $i++) {
  docker version *> $null
  if ($LASTEXITCODE -eq 0) {
    "Docker listo"
    break
  }
  Start-Sleep -Seconds 2
}
```

### Paso 2 - Generar dispatch-service desde la plantilla

Validar primero en modo seco:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\new-quarkus-service.ps1 `
  -DryRun `
  -ServiceName dispatch-service `
  -PackageSegment dispatch `
  -DatabaseName dispatch_db `
  -HttpPort 8082
```

Resultado esperado cuando la carpeta solo tiene `.gitkeep`:

```json
{"service_name":"dispatch-service","package":"com.ventapasajes.dispatch","database_name":"dispatch_db","http_port":8082,"target_exists":true,"only_gitkeep":true,"target_item_count":1,"dry_run":true}
```

Generar servicio:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\new-quarkus-service.ps1 `
  -ServiceName dispatch-service `
  -PackageSegment dispatch `
  -DatabaseName dispatch_db `
  -HttpPort 8082
```

Verificar estructura:

```powershell
rg --files .\services\dispatch-service
```

### Paso 3 - Reemplazar migracion placeholder por migracion real

Eliminar placeholder:

```powershell
Remove-Item -LiteralPath .\services\dispatch-service\src\main\resources\db\migration\V1__init_template.sql -Force
```

Crear:

```text
C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\resources\db\migration\V1__dispatch_schema.sql
```

La migracion debe contener:

```text
- CREATE EXTENSION IF NOT EXISTS pgcrypto;
- CREATE EXTENSION IF NOT EXISTS citext;
- CREATE TABLE terminals;
- CREATE TABLE routes;
- CREATE TABLE bus_types;
- CREATE TABLE seat_layouts;
- CREATE TABLE seat_layout_seats;
- CREATE TABLE buses;
- CREATE TABLE departures;
- CREATE TABLE outbox_events;
- Indice uq_departures_bus_time_active;
- Indices de busqueda para rutas, buses, salidas y outbox.
```

Verificar:

```powershell
rg -n "CREATE TABLE terminals|CREATE TABLE routes|CREATE TABLE bus_types|CREATE TABLE seat_layouts|CREATE TABLE seat_layout_seats|CREATE TABLE buses|CREATE TABLE departures|CREATE TABLE outbox_events|uq_departures_bus_time_active" .\services\dispatch-service\src\main\resources\db\migration\V1__dispatch_schema.sql
```

### Paso 4 - Crear paquetes Java del dominio

Crear carpetas:

```powershell
New-Item -ItemType Directory -Force -Path `
  .\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\domain, `
  .\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\persistence\entity, `
  .\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\dto, `
  .\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\service, `
  .\services\dispatch-service\src\test\java\com\ventapasajes\dispatch\persistence | Out-Null
```

Crear enums:

```text
domain\DepartureStatus.java -> SCHEDULED, CANCELLED, CLOSED, DEPARTED
domain\SeatPosition.java -> WINDOW, AISLE, MIDDLE, DRIVER, BLOCKED
```

Crear entidades:

```text
persistence\entity\Terminal.java
persistence\entity\DispatchRoute.java
persistence\entity\BusType.java
persistence\entity\SeatLayout.java
persistence\entity\SeatLayoutSeat.java
persistence\entity\Bus.java
persistence\entity\Departure.java
```

Estas entidades deben mapear las tablas creadas por Flyway. No se agregan todavia metodos CRUD completos porque eso corresponde a los dias 22 y 23.

### Paso 5 - Crear endpoints base

Crear DTOs:

```text
api\dto\DispatchOverviewResponse.java
api\dto\DispatchResourceResponse.java
```

Crear servicio de catalogo:

```text
service\DispatchCatalogService.java
```

Crear recurso REST:

```text
api\DispatchBaseResource.java
```

Endpoints esperados:

```text
GET /api/v1/dispatch
GET /api/v1/dispatch/resources
GET /api/v1/dispatch/departure-statuses
GET /api/v1/dispatch/seat-positions
GET /api/v1/dispatch/health
```

### Paso 6 - Configurar OpenAPI y perfiles

En `application.properties`, asegurar:

```properties
quarkus.smallrye-openapi.path=/q/openapi
quarkus.smallrye-openapi.info-title=Dispatch Service API
quarkus.smallrye-openapi.info-version=0.1.0
quarkus.smallrye-openapi.info-description=API base para terminales, rutas, tipos de bus, buses, layouts y salidas programadas.
quarkus.swagger-ui.always-include=true
quarkus.swagger-ui.path=/q/swagger-ui
quarkus.native.resources.includes=db/migration/*.sql
quarkus.flyway.baseline-on-migrate=${QUARKUS_FLYWAY_BASELINE_ON_MIGRATE:false}
```

Verificar configuracion:

```powershell
rg -n "quarkus.smallrye-openapi.info-title|quarkus.native.resources.includes|quarkus.flyway.baseline-on-migrate|dispatch_db|8082" .\services\dispatch-service\src\main\resources\application.properties
```

### Paso 7 - Crear pruebas

Pruebas esperadas:

```text
DispatchHealthResourceTest
DispatchBaseResourceTest
DispatchMigrationContractTest
RuntimeProfileConfigurationTest
```

Validan:

```text
- Health funcional.
- SmallRye health live/ready.
- OpenAPI disponible.
- Overview del dominio.
- Recursos administrados por dispatch-service.
- Estados de salida.
- Posiciones de asiento.
- Tablas y constraints esperados en la migracion.
- Perfiles GCP y on-premise.
```

### Paso 8 - Ejecutar pruebas Maven

```powershell
mvn -f .\services\dispatch-service\pom.xml test
```

Resultado esperado:

```text
Tests run: 8, Failures: 0, Errors: 0, Skipped: 0
BUILD SUCCESS
```

Si Maven muestra solo 4 pruebas, el servicio esta incompleto o se ejecuto antes de crear todos los archivos del Paso 7. Verificar las clases de prueba:

```powershell
Get-ChildItem .\services\dispatch-service\src\test\java -Recurse -File | Select-Object FullName
```

Para el estado final del Dia 21 deben existir estas 4 clases:

```text
DispatchHealthResourceTest.java
DispatchBaseResourceTest.java
RuntimeProfileConfigurationTest.java
DispatchMigrationContractTest.java
```

La suma esperada es:

```text
DispatchHealthResourceTest = 3 pruebas
DispatchBaseResourceTest = 3 pruebas
RuntimeProfileConfigurationTest = 1 prueba
DispatchMigrationContractTest = 1 prueba
Total = 8 pruebas
```

### Paso 9 - Empaquetar el servicio JVM

```powershell
mvn -f .\services\dispatch-service\pom.xml package -DskipTests
```

Resultado esperado:

```text
BUILD SUCCESS
```

Artefacto esperado:

```text
C:\VENTA-DE-PASAJES\services\dispatch-service\target\quarkus-app\quarkus-run.jar
```

Verificar:

```powershell
Test-Path .\services\dispatch-service\target\quarkus-app\quarkus-run.jar
```

### Paso 10 - Validar localmente con script

Este comando levanta PostgreSQL temporal, arranca `dispatch-service`, aplica Flyway y prueba endpoints.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-dispatch-service-local-db.ps1 `
  -DatabasePort 55436 `
  -HttpPort 18084
```

Resultado esperado:

```json
{"service":"dispatch-service","database":"dispatch_db","health_ready":"UP","dispatch_tables":8,"resources_count":6,"departure_statuses_count":4,"seat_positions_count":5,"openapi_title":"Dispatch Service API","ready":true}
```

### Paso 11 - Validar localmente de forma manual

Levantar PostgreSQL temporal:

```powershell
$DatabasePort = 55436
$HttpPort = 18084
$DatabaseName = "dispatch_db"
$DatabaseUser = "postgres"
$DatabasePassword = "temporary-local-db-password"

docker run --rm --name venta-pasajes-dispatch-pg-manual `
  -e POSTGRES_DB=$DatabaseName `
  -e POSTGRES_USER=$DatabaseUser `
  -e POSTGRES_PASSWORD=$DatabasePassword `
  -p "$DatabasePort`:5432" `
  -d postgres:16-alpine
```

Esperar PostgreSQL:

```powershell
docker exec venta-pasajes-dispatch-pg-manual pg_isready -U postgres -d dispatch_db
```

Configurar variables para el servicio:

```powershell
$env:QUARKUS_PROFILE = "onprem"
$env:QUARKUS_HTTP_PORT = "$HttpPort"
$env:APP_ENV = "local"
$env:APP_RUNTIME_TARGET = "onprem"
$env:APP_SECRETS_PROVIDER = "env"
$env:APP_DB_NAME = "dispatch_db"
$env:APP_DB_JDBC_URL = "jdbc:postgresql://localhost:$DatabasePort/dispatch_db"
$env:APP_DB_USERNAME = "postgres"
$env:APP_DB_PASSWORD = $DatabasePassword
$env:QUARKUS_FLYWAY_MIGRATE_AT_START = "true"
$env:APP_LOG_CONSOLE_JSON = "false"
```

Levantar el servicio:

```powershell
java -jar .\services\dispatch-service\target\quarkus-app\quarkus-run.jar
```

En otra terminal, probar con `curl.exe`.

## Peticiones HTTP/HTTPS listas con curl.exe

Health tecnico:

```powershell
curl.exe -s "http://localhost:18084/q/health/ready"
```

Health funcional:

```powershell
curl.exe -s "http://localhost:18084/api/v1/dispatch/health"
```

Overview del dominio:

```powershell
curl.exe -s "http://localhost:18084/api/v1/dispatch"
```

Recursos administrados:

```powershell
curl.exe -s "http://localhost:18084/api/v1/dispatch/resources"
```

Estados de salida:

```powershell
curl.exe -s "http://localhost:18084/api/v1/dispatch/departure-statuses"
```

Posiciones de asiento:

```powershell
curl.exe -s "http://localhost:18084/api/v1/dispatch/seat-positions"
```

OpenAPI:

```powershell
curl.exe -s "http://localhost:18084/q/openapi"
```

Swagger UI:

```powershell
Start-Process "http://localhost:18084/q/swagger-ui"
```

## Verificacion de base de datos

Consultar tablas creadas por Flyway:

```powershell
docker exec -e PGPASSWORD=temporary-local-db-password venta-pasajes-dispatch-pg-manual `
  psql -U postgres -d dispatch_db -c "\dt"
```

Contar tablas esperadas:

```powershell
docker exec -e PGPASSWORD=temporary-local-db-password venta-pasajes-dispatch-pg-manual `
  psql -U postgres -d dispatch_db -tAc "select count(*) from information_schema.tables where table_schema = 'public' and table_name in ('terminals','routes','bus_types','seat_layouts','seat_layout_seats','buses','departures','outbox_events');"
```

Resultado esperado:

```text
8
```

## Publicacion o despliegue

En el Dia 21 no se publico imagen Docker ni se desplego en Cloud Run.

El objetivo fue dejar el dominio de despacho creado a nivel de:

```text
- Proyecto Quarkus.
- Migraciones.
- Entidades.
- Endpoints base.
- OpenAPI.
- Pruebas.
- Validacion local con PostgreSQL temporal.
```

La compilacion nativa y publicacion futura de `dispatch-service` se realizara en el Dia 28, segun el plan de tareas.

## Problemas encontrados y soluciones

| Problema | Solucion |
| --- | --- |
| Docker no estaba levantado al intentar validar con PostgreSQL temporal. | Se inicio `com.docker.service` y Docker Desktop, luego se repitio la prueba. |
| La primera prueba de OpenAPI esperaba `Dispatch Service API`, pero Quarkus generaba `dispatch-service API`. | Se agregaron propiedades `quarkus.smallrye-openapi.info-title`, `info-version` e `info-description` en `application.properties`. |
| El script de verificacion leia OpenAPI con `Invoke-WebRequest` y no comparaba bien el contenido. | Se cambio a `Invoke-RestMethod` para tratar el YAML como texto. |

## Comandos ejecutados durante la practica

Lectura de alcance y contexto:

```powershell
Get-Content .\tareas.md | Select-Object -Skip 880 -First 90
Get-Content .\docs\estandar-documentacion-dias.md
Get-ChildItem .\services -Recurse -Depth 2 | Select-Object FullName,Mode,Length,LastWriteTime | Format-Table -AutoSize
Get-Content .\vitacora.md -Tail 100
Get-Content .\scripts\new-quarkus-service.ps1
Get-Content .\docs\database\dispatch-db.sql
Get-Content .\docs\dia-08-diseno-modelo-postgresql.md | Select-Object -Skip 70 -First 50
Get-Content .\docs\dia-05-definicion-dominios-microservicios.md | Select-Object -Skip 64 -First 40
Get-Content .\services\identity-service\src\main\java\com\ventapasajes\identity\persistence\entity\UserAccount.java
Get-Content .\services\quarkus-service-template\src\main\resources\application.properties
```

Generacion del servicio:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\new-quarkus-service.ps1 -DryRun -ServiceName dispatch-service -PackageSegment dispatch -DatabaseName dispatch_db -HttpPort 8082
Get-ChildItem .\services\dispatch-service -Force | Select-Object Name,Mode,Length,LastWriteTime | Format-Table -AutoSize
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\new-quarkus-service.ps1 -ServiceName dispatch-service -PackageSegment dispatch -DatabaseName dispatch_db -HttpPort 8082
```

Creacion de paquetes:

```powershell
New-Item -ItemType Directory -Force -Path .\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\domain, .\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\persistence\entity, .\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\dto, .\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\service, .\services\dispatch-service\src\test\java\com\ventapasajes\dispatch\persistence | Out-Null
```

Pruebas y build:

```powershell
mvn -f .\services\dispatch-service\pom.xml test
mvn -f .\services\dispatch-service\pom.xml package -DskipTests
```

Verificacion local:

```powershell
docker version
Get-Process -Name "Docker Desktop","com.docker.backend","com.docker.service" -ErrorAction SilentlyContinue | Select-Object ProcessName,Id,StartTime | Format-Table -AutoSize
Get-Service -Name "com.docker.service" -ErrorAction SilentlyContinue | Select-Object Name,Status,StartType | Format-Table -AutoSize
Test-Path "C:\Program Files\Docker\Docker\Docker Desktop.exe"
Start-Service -Name com.docker.service -ErrorAction SilentlyContinue; Start-Process -FilePath "C:\Program Files\Docker\Docker\Docker Desktop.exe" -WindowStyle Hidden; for ($i = 1; $i -le 60; $i++) { docker version *> $null; if ($LASTEXITCODE -eq 0) { Write-Output "Docker ready after $i checks"; exit 0 }; Start-Sleep -Seconds 2 }; Write-Output "Docker did not become ready"; exit 1
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-dispatch-service-local-db.ps1 -DatabasePort 55436 -HttpPort 18084
docker ps -a --filter "name=venta-pasajes-dispatch" --format "{{.Names}}"
Get-NetTCPConnection -LocalPort 18084,55436,8082 -ErrorAction SilentlyContinue | Select-Object LocalAddress,LocalPort,State,OwningProcess | Format-Table -AutoSize
Get-ChildItem .\services\dispatch-service\target | Select-Object Name,Length,LastWriteTime | Format-Table -AutoSize
```

Validacion de script:

```powershell
$Errors = $null; [System.Management.Automation.Language.Parser]::ParseFile((Resolve-Path .\scripts\verify-dispatch-service-local-db.ps1), [ref]$null, [ref]$Errors)
```

Consulta oficial realizada:

```text
Se reviso la documentacion oficial de Quarkus OpenAPI para confirmar las propiedades quarkus.smallrye-openapi.info-title, info-version e info-description.
```

## Validacion final

```text
dispatch-service generado: OK
Migracion V1__dispatch_schema.sql: OK
Entidades JPA base: OK
Endpoints base: OK
OpenAPI configurado: OK
Pruebas Maven: OK
Package JVM: OK
Verificacion local con PostgreSQL temporal: OK
Contenedores temporales: ninguno
Puertos temporales 18084/55436/8082: libres al cierre
```

## Estado

- Criterio de avance del Dia 21 cumplido.
- El dominio de despacho/programacion esta creado.
- Siguiente paso natural: Dia 22, terminales y rutas.

## Referencias oficiales

- Quarkus OpenAPI and Swagger UI: `https://quarkus.io/guides/openapi-swaggerui/`
