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

## Descripcion detallada de archivos PowerShell agregados

En el Dia 16 se agrego un unico archivo `.ps1` nuevo:

```text
C:\VENTA-DE-PASAJES\scripts\new-quarkus-service.ps1
```

Los demas bloques `powershell` documentados en este dia son comandos de validacion ejecutados en consola; no son archivos `.ps1` adicionales.

### `scripts\new-quarkus-service.ps1`

Este script es un generador local de microservicios Quarkus. Su proposito es tomar la plantilla:

```text
C:\VENTA-DE-PASAJES\services\quarkus-service-template
```

y crear, a partir de ella, un nuevo servicio real dentro de:

```text
C:\VENTA-DE-PASAJES\services\<service-name>
```

No compila, no despliega, no crea bases de datos, no crea secretos y no llama a Google Cloud. Solo crea y adapta archivos locales del nuevo microservicio.

#### Parametros

| Parametro | Obligatorio | Ejemplo | Que controla |
| --- | --- | --- | --- |
| `-ServiceName` | Si | `identity-service` | Nombre del nuevo servicio. Debe empezar con letra minuscula, puede contener numeros y guiones, y debe terminar en `-service`. |
| `-PackageSegment` | No | `identity` | Segmento final del paquete Java `com.ventapasajes.<segmento>`. Si no se envia, el script lo deriva del nombre del servicio. |
| `-DatabaseName` | No | `identity_db` | Nombre de la base de datos que quedara configurado en `application.properties`. Si no se envia, usa `<packageSegment>_db`. |
| `-HttpPort` | No | `8081` | Puerto HTTP por defecto que quedara en la configuracion del servicio. Si no se envia, usa `8080`. |
| `-ProjectId` | No | `project-fbb34cd7-0b82-43e1-867` | Proyecto usado para armar el usuario IAM de Cloud SQL. No llama a Google Cloud; solo genera texto. |
| `-DryRun` | No | `-DryRun` | No crea archivos. Solo imprime un JSON con lo que haria. |
| `-Force` | No | `-Force` | Permite sobrescribir archivos generados si la carpeta destino ya existe y no esta vacia. Usarlo con cuidado. |

#### Validaciones iniciales

El script valida que:

- `ServiceName` cumpla el patron `^[a-z][a-z0-9-]*-service$`.
- `PackageSegment`, si se envia, cumpla el patron `^[a-z][a-z0-9]*$`.
- Exista la plantilla `services\quarkus-service-template`.
- La carpeta destino no tenga contenido previo, salvo que solo tenga `.gitkeep` o se use `-Force`.

Ejemplo: `identity-service` es valido; `IdentityService`, `identity`, `identity_service` o `identity-service-api` no cumplen el patron esperado.

#### Valores que calcula automaticamente

Con esta entrada:

```powershell
.\scripts\new-quarkus-service.ps1 `
  -ServiceName identity-service `
  -PackageSegment identity `
  -DatabaseName identity_db `
  -HttpPort 8081
```

el script calcula:

| Valor | Resultado |
| --- | --- |
| Dominio | `identity` |
| Clase base en PascalCase | `Identity` |
| Paquete Java | `com.ventapasajes.identity` |
| Carpeta destino | `C:\VENTA-DE-PASAJES\services\identity-service` |
| Usuario local/on-premise | `identity_user` |
| Service account runtime esperada | `identity-service-run` |
| Usuario IAM de Cloud SQL | `identity-service-run@project-fbb34cd7-0b82-43e1-867.iam` |
| Secreto de conexion esperado | `identity-service__db-connection` |
| Base path REST | `/api/v1/identity` |
| Puerto HTTP | `8081` |

#### Que hace en modo `-DryRun`

Cuando se ejecuta con `-DryRun`, no escribe ni modifica archivos. Devuelve un JSON de simulacion con:

- nombre del servicio;
- paquete Java calculado;
- base de datos;
- puerto;
- carpeta destino;
- usuario IAM de Cloud SQL;
- usuario local;
- nombre del secreto;
- base path de API;
- si la carpeta destino ya existe;
- si la carpeta destino solo tiene `.gitkeep`;
- cantidad de elementos existentes en destino.

Este modo sirve para validar que los nombres estan bien antes de crear archivos.

#### Que hace cuando se ejecuta sin `-DryRun`

Cuando se ejecuta realmente:

1. Crea la carpeta destino `services\<service-name>`.
2. Si la carpeta solo contenia `.gitkeep`, elimina ese `.gitkeep`.
3. Copia todo el contenido de `services\quarkus-service-template`, excepto `target` y `.gitkeep`.
4. Renombra la carpeta Java:

```text
src\main\java\com\ventapasajes\template
src\test\java\com\ventapasajes\template
```

a:

```text
src\main\java\com\ventapasajes\<packageSegment>
src\test\java\com\ventapasajes\<packageSegment>
```

5. Reemplaza textos dentro de archivos `.java`, `.xml`, `.properties`, `.md`, `.sql`, `.yml` y `.yaml`.
6. Renombra archivos cuyo nombre contiene `Template`, por ejemplo `TemplateHealthResourceTest.java`.
7. Devuelve un JSON final con los valores generados.

#### Reemplazos principales

| Texto de la plantilla | Texto generado |
| --- | --- |
| `quarkus-service-template` | Nombre del nuevo servicio, por ejemplo `identity-service`. |
| `template_db` | Nombre de base, por ejemplo `identity_db`. |
| `template_user` | Usuario local, por ejemplo `identity_user`. |
| `template-service-run@project-fbb34cd7-0b82-43e1-867.iam` | Usuario IAM de Cloud SQL del nuevo servicio. |
| `template-service__db-connection` | Nombre del secreto de conexion del nuevo servicio. |
| `/api/v1/template` | Base path del nuevo dominio, por ejemplo `/api/v1/identity`. |
| `QUARKUS_HTTP_PORT:8080` | Puerto configurado, por ejemplo `QUARKUS_HTTP_PORT:8081`. |
| `com.ventapasajes.template` | Paquete Java del nuevo servicio. |
| `Template` | Nombre PascalCase del dominio, por ejemplo `Identity`. |

#### Archivos que normalmente quedan adaptados

El script adapta principalmente:

- `pom.xml`;
- `README.md`;
- `src\main\resources\application.properties`;
- migracion inicial `src\main\resources\db\migration\V1__init_template.sql`;
- recursos Java bajo `src\main\java`;
- pruebas bajo `src\test\java`.

#### Salida esperada

Al finalizar, entrega un JSON parecido a:

```json
{"service_name":"identity-service","package":"com.ventapasajes.identity","database_name":"identity_db","http_port":8081,"target_root":"C:\\VENTA-DE-PASAJES\\services\\identity-service","cloud_sql_iam_user":"identity-service-run@project-fbb34cd7-0b82-43e1-867.iam","local_database_user":"identity_user","secret_name":"identity-service__db-connection","api_base_path":"/api/v1/identity","dry_run":false}
```

#### Riesgos y cuidados

- No usar `-Force` si la carpeta destino contiene trabajo manual que no esta respaldado.
- El script hace reemplazos de texto simples; por eso la plantilla debe conservar nombres controlados como `template`, `Template` y `quarkus-service-template`.
- Despues de generar un servicio, ejecutar pruebas Maven del servicio creado.
- Si el nuevo servicio requiere secretos, bases o IAM en Google Cloud, esos recursos se crean en dias posteriores o scripts de infraestructura; este generador no los crea.

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

## Paso a paso para crear, probar y publicar un nuevo servicio

> Esta guia es operacional y no fue ejecutada por Codex. Usar nombres reales del nuevo dominio antes de copiar comandos.

Ejemplo usado en esta guia:

| Variable | Valor de ejemplo |
| --- | --- |
| Servicio | `catalog-service` |
| Dominio | `catalog` |
| Paquete Java | `com.ventapasajes.catalog` |
| Base de datos | `catalog_db` |
| Puerto local JVM | `18091` |
| Tag de imagen | `0.1.0-jvm` |

### Paso N1 - Definir variables de trabajo

```powershell
cd C:\VENTA-DE-PASAJES

$ServiceName = "catalog-service"
$Domain = "catalog"
$PackageSegment = "catalog"
$DatabaseName = "catalog_db"
$HttpPort = 18091
$ImageTag = "0.1.0-jvm"

$ProjectId = "project-fbb34cd7-0b82-43e1-867"
$Region = "us-central1"
$Repository = "venta-pasajes-dev"
$GcloudPath = "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd"
$env:CLOUDSDK_PYTHON = "C:\Python312\python.exe"
```

### Paso N2 - Simular la creacion del servicio

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\new-quarkus-service.ps1 `
  -DryRun `
  -ServiceName $ServiceName `
  -PackageSegment $PackageSegment `
  -DatabaseName $DatabaseName `
  -HttpPort 8080 `
  -ProjectId $ProjectId
```

Revisar que el JSON devuelto tenga:

- `package` correcto;
- `database_name` correcto;
- `secret_name` esperado;
- `api_base_path` esperado;
- `target_root` dentro de `C:\VENTA-DE-PASAJES\services`.

### Paso N3 - Crear el servicio desde la plantilla

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\new-quarkus-service.ps1 `
  -ServiceName $ServiceName `
  -PackageSegment $PackageSegment `
  -DatabaseName $DatabaseName `
  -HttpPort 8080 `
  -ProjectId $ProjectId
```

Validar que los archivos base existan:

```powershell
Test-Path -LiteralPath ".\services\$ServiceName\pom.xml"
Test-Path -LiteralPath ".\services\$ServiceName\src\main\resources\application.properties"
Test-Path -LiteralPath ".\services\$ServiceName\src\main\java\com\ventapasajes\$PackageSegment"
Test-Path -LiteralPath ".\services\$ServiceName\src\test\java\com\ventapasajes\$PackageSegment"
```

### Paso N4 - Ejecutar pruebas unitarias/locales

```powershell
mvn -f ".\services\$ServiceName\pom.xml" test
```

Resultado esperado:

```text
BUILD SUCCESS
```

Estas pruebas validan el endpoint funcional `/api/v1/<dominio>/health`, los endpoints `/q/health/live`, `/q/health/ready` y el documento OpenAPI. En perfil `test` el health check automatico del datasource queda desactivado para no depender de PostgreSQL local.

### Paso N5 - Empaquetar el servicio Quarkus JVM

```powershell
mvn -f ".\services\$ServiceName\pom.xml" package -DskipTests
```

Validar que existe el paquete Quarkus:

```powershell
Test-Path -LiteralPath ".\services\$ServiceName\target\quarkus-app\quarkus-run.jar"
```

### Paso N6 - Probar localmente con Java

Esta prueba arranca el servicio desde el paquete JVM generado. Para smoke test local sin PostgreSQL se desactiva el health check automatico del datasource.

```powershell
$env:QUARKUS_HTTP_PORT = "$HttpPort"
$env:QUARKUS_DATASOURCE_HEALTH_ENABLED = "false"
$env:QUARKUS_FLYWAY_MIGRATE_AT_START = "false"

$Process = Start-Process `
  -FilePath "java" `
  -ArgumentList @("-jar", ".\services\$ServiceName\target\quarkus-app\quarkus-run.jar") `
  -PassThru `
  -WindowStyle Hidden

Start-Sleep -Seconds 8

curl.exe -s "http://localhost:$HttpPort/api/v1/$Domain/health"
curl.exe -s "http://localhost:$HttpPort/q/health/ready"
curl.exe -s "http://localhost:$HttpPort/q/openapi"

Stop-Process -Id $Process.Id -Force
```

Resultado esperado en el endpoint funcional:

```json
{"status":"ok","service":"catalog-service","runtime":"quarkus"}
```

### Paso N7 - Generar imagen Docker JVM local

La imagen JVM usa el Dockerfile comun:

```text
C:\VENTA-DE-PASAJES\infra\docker\Dockerfile.quarkus-jvm
```

Construir imagen:

```powershell
$LocalImage = "${ServiceName}:${ImageTag}"

docker build --pull `
  -f .\infra\docker\Dockerfile.quarkus-jvm `
  -t $LocalImage `
  ".\services\$ServiceName"
```

Validar la imagen:

```powershell
docker image inspect $LocalImage --format "{{.Id}} {{.Size}} {{.Architecture}}/{{.Os}}"
```

### Paso N8 - Probar localmente con Docker

```powershell
$ContainerName = "$ServiceName-local-smoke"

docker rm -f $ContainerName 2>$null

docker run -d `
  --name $ContainerName `
  -p "${HttpPort}:8080" `
  -e APP_ENV=local `
  -e APP_RUNTIME_TARGET=local `
  -e APP_SECRETS_PROVIDER=env `
  -e QUARKUS_DATASOURCE_HEALTH_ENABLED=false `
  -e QUARKUS_FLYWAY_MIGRATE_AT_START=false `
  $LocalImage

Start-Sleep -Seconds 8

curl.exe -s "http://localhost:$HttpPort/api/v1/$Domain/health"
curl.exe -s "http://localhost:$HttpPort/q/health/ready"

docker logs $ContainerName --tail 80
docker rm -f $ContainerName
```

### Paso N9 - Etiquetar imagen para Artifact Registry

```powershell
$ArtifactImage = "$Region-docker.pkg.dev/$ProjectId/$Repository/${ServiceName}:${ImageTag}"

docker tag $LocalImage $ArtifactImage
```

### Paso N10 - Autenticar Docker contra Artifact Registry

```powershell
& $GcloudPath auth configure-docker "$Region-docker.pkg.dev" --quiet
```

Si el repositorio no existiera, crearlo una sola vez:

```powershell
& $GcloudPath artifacts repositories create $Repository `
  --project=$ProjectId `
  --location=$Region `
  --repository-format=docker `
  --description="Venta de Pasajes development Docker images"
```

En este proyecto el repositorio esperado es:

```text
us-central1-docker.pkg.dev/project-fbb34cd7-0b82-43e1-867/venta-pasajes-dev
```

### Paso N11 - Subir la imagen a Google Cloud

```powershell
docker push $ArtifactImage
```

Validar que la imagen existe en Artifact Registry:

```powershell
& $GcloudPath artifacts docker images describe $ArtifactImage `
  --project=$ProjectId `
  --format="value(image_summary.digest)"
```

### Paso N12 - Smoke test remoto en Cloud Run

Este smoke test despliega temporalmente la imagen en Cloud Run para validar que arranca fuera de la maquina local. No sustituye la integracion real del servicio al ambiente dev.

Para un servicio nuevo de verdad, antes del despliegue productivo o dev formal se debe:

- agregarlo a `infra\cloudrun\dev-services.json`;
- crear su service account runtime;
- crear su base de datos si aplica;
- crear su secreto `*_db-connection`;
- asignar IAM minimo;
- decidir si usara Cloud SQL.

Smoke remoto temporal:

```powershell
$CloudRunService = "$ServiceName-smoke"

& $GcloudPath run deploy $CloudRunService `
  --project=$ProjectId `
  --region=$Region `
  --platform=managed `
  --image=$ArtifactImage `
  --port=8080 `
  --allow-unauthenticated `
  --set-env-vars="APP_ENV=dev,APP_RUNTIME_TARGET=gcp,APP_SECRETS_PROVIDER=env,QUARKUS_DATASOURCE_HEALTH_ENABLED=false,QUARKUS_FLYWAY_MIGRATE_AT_START=false"

$RemoteUrl = & $GcloudPath run services describe $CloudRunService `
  --project=$ProjectId `
  --region=$Region `
  --format="value(status.url)"

curl.exe -s "$RemoteUrl/api/v1/$Domain/health"
curl.exe -s "$RemoteUrl/q/health/ready"
```

Resultado esperado:

```json
{"status":"ok","service":"catalog-service","runtime":"quarkus"}
```

Si el smoke test fue temporal, eliminar el servicio de prueba cuando termines:

```powershell
& $GcloudPath run services delete $CloudRunService `
  --project=$ProjectId `
  --region=$Region `
  --quiet
```

### Paso N13 - Alternativa usando script existente

Existe un script para construir y subir imagenes JVM:

```text
C:\VENTA-DE-PASAJES\scripts\build-backend-jvm-images.ps1
```

Pero este script solo acepta servicios registrados como backend en:

```text
C:\VENTA-DE-PASAJES\infra\cloudrun\dev-services.json
```

Cuando el nuevo servicio ya este registrado en ese archivo, se puede usar:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-backend-jvm-images.ps1 `
  -ServiceIds $ServiceName `
  -ImageTag $ImageTag `
  -UseCleanWorkspace `
  -Push
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

### Reversa efectiva del servicio de ejemplo `catalog-service` - no ejecutada

> Estado: documentada para uso manual futuro. No fue ejecutada por Codex.
>
> Advertencia: esta reversa borra recursos locales y remotos creados al seguir el apartado `Paso a paso para crear, probar y publicar un nuevo servicio`. No ejecutarla si `catalog-service` ya fue convertido en un microservicio real del proyecto.

Esta reversa cubre lo creado por los pasos N1 a N13:

- contenedor local de smoke test;
- imagen Docker local;
- tag local apuntando a Artifact Registry;
- imagen/tag publicado en Artifact Registry;
- servicio temporal de Cloud Run `catalog-service-smoke`;
- carpeta local `C:\VENTA-DE-PASAJES\services\catalog-service`.

No elimina bases Cloud SQL, secretos, service accounts ni entradas de `infra\cloudrun\dev-services.json`, salvo en los pasos opcionales marcados al final, porque esos recursos no se crean en el paso a paso base.

#### Paso NR1 - Definir variables de reversa

```powershell
cd C:\VENTA-DE-PASAJES

$ProjectRoot = "C:\VENTA-DE-PASAJES"
$ServiceName = "catalog-service"
$Domain = "catalog"
$DatabaseName = "catalog_db"
$ImageTag = "0.1.0-jvm"
$Region = "us-central1"
$ProjectId = "project-fbb34cd7-0b82-43e1-867"
$Repository = "venta-pasajes-dev"
$GcloudPath = "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd"
$env:CLOUDSDK_PYTHON = "C:\Python312\python.exe"

$ServiceRoot = Join-Path $ProjectRoot "services\$ServiceName"
$LocalImage = "${ServiceName}:${ImageTag}"
$ArtifactImage = "$Region-docker.pkg.dev/$ProjectId/$Repository/${ServiceName}:${ImageTag}"
$ContainerName = "$ServiceName-local-smoke"
$CloudRunService = "$ServiceName-smoke"
```

#### Paso NR2 - Revisar que se esta apuntando al servicio correcto

```powershell
[pscustomobject]@{
  service_name = $ServiceName
  service_root = $ServiceRoot
  local_image = $LocalImage
  artifact_image = $ArtifactImage
  container_name = $ContainerName
  cloud_run_service = $CloudRunService
} | Format-List
```

Validar visualmente que todos los valores apunten a `catalog-service`.

#### Paso NR3 - Detener proceso Java local si quedo abierto

```powershell
$ServiceJarFragment = "services\$ServiceName\target\quarkus-app\quarkus-run.jar"

Get-CimInstance Win32_Process -Filter "name = 'java.exe'" |
  Where-Object { $_.CommandLine -like "*$ServiceJarFragment*" } |
  Select-Object ProcessId,CommandLine |
  Format-List
```

Si aparece un proceso de `catalog-service`, detenerlo:

```powershell
Get-CimInstance Win32_Process -Filter "name = 'java.exe'" |
  Where-Object { $_.CommandLine -like "*$ServiceJarFragment*" } |
  ForEach-Object {
    Stop-Process -Id $_.ProcessId -Force
  }
```

#### Paso NR4 - Eliminar contenedor local de smoke test

```powershell
docker ps -a --filter "name=$ContainerName" --format "table {{.Names}}\t{{.Image}}\t{{.Status}}"

docker rm -f $ContainerName
```

Si Docker responde que no existe el contenedor, continuar con el siguiente paso.

#### Paso NR5 - Eliminar servicio temporal de Cloud Run

Este servicio solo existe si ejecutaste el Paso N12.

```powershell
& $GcloudPath run services describe $CloudRunService `
  --project=$ProjectId `
  --region=$Region `
  --format="value(metadata.name)"
```

Si existe, eliminarlo:

```powershell
& $GcloudPath run services delete $CloudRunService `
  --project=$ProjectId `
  --region=$Region `
  --quiet
```

Validar que ya no existe:

```powershell
& $GcloudPath run services describe $CloudRunService `
  --project=$ProjectId `
  --region=$Region `
  --format="value(metadata.name)"
```

El resultado esperado despues de borrar es un error de recurso no encontrado.

#### Paso NR6 - Eliminar imagen publicada en Artifact Registry

Este paso elimina la imagen/tag remoto subido con `docker push`.

```powershell
& $GcloudPath artifacts docker images describe $ArtifactImage `
  --project=$ProjectId `
  --format="value(image_summary.digest)"
```

Si la imagen existe, eliminarla:

```powershell
& $GcloudPath artifacts docker images delete $ArtifactImage `
  --project=$ProjectId `
  --delete-tags `
  --quiet
```

Validar que ya no existe:

```powershell
& $GcloudPath artifacts docker images describe $ArtifactImage `
  --project=$ProjectId `
  --format="value(image_summary.digest)"
```

El resultado esperado despues de borrar es un error de imagen no encontrada.

#### Paso NR7 - Eliminar imagenes Docker locales

```powershell
docker image ls $ServiceName
docker image ls "$Region-docker.pkg.dev/$ProjectId/$Repository/$ServiceName"
```

Eliminar tags locales:

```powershell
docker image rm $LocalImage $ArtifactImage -f
```

Si alguno de los tags no existe, Docker puede mostrar error para ese tag; validar que no queden imagenes:

```powershell
docker image ls $ServiceName
docker image ls "$Region-docker.pkg.dev/$ProjectId/$Repository/$ServiceName"
```

#### Paso NR8 - Eliminar la carpeta local del microservicio generado

Este paso elimina:

```text
C:\VENTA-DE-PASAJES\services\catalog-service
```

Incluye una verificacion de seguridad para impedir borrar una ruta fuera de `C:\VENTA-DE-PASAJES\services`.

```powershell
$ServicesRoot = [System.IO.Path]::GetFullPath((Join-Path $ProjectRoot "services"))
$ExpectedServiceRoot = [System.IO.Path]::GetFullPath((Join-Path $ServicesRoot $ServiceName))

if ($ServiceName -ne "catalog-service") {
  throw "Esta reversa esta escrita para catalog-service. Revisa ServiceName antes de borrar."
}

if (-not (Test-Path -LiteralPath $ExpectedServiceRoot)) {
  Write-Host "No existe la carpeta local del servicio: $ExpectedServiceRoot"
}
else {
  $ResolvedServiceRoot = [System.IO.Path]::GetFullPath((Resolve-Path -LiteralPath $ExpectedServiceRoot).Path)
  $ResolvedParent = [System.IO.Path]::GetFullPath((Split-Path -Parent $ResolvedServiceRoot))

  if (-not $ResolvedServiceRoot.StartsWith($ServicesRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Ruta fuera de services. No se elimina: $ResolvedServiceRoot"
  }

  if ($ResolvedParent -ne $ServicesRoot) {
    throw "La carpeta no cuelga directamente de services. No se elimina: $ResolvedServiceRoot"
  }

  if ((Split-Path -Leaf $ResolvedServiceRoot) -ne $ServiceName) {
    throw "La carpeta final no coincide con ServiceName. No se elimina: $ResolvedServiceRoot"
  }

  Remove-Item -LiteralPath $ResolvedServiceRoot -Recurse -Force
}
```

Validar que ya no existe:

```powershell
Test-Path -LiteralPath "C:\VENTA-DE-PASAJES\services\catalog-service"
```

Resultado esperado:

```text
False
```

#### Paso NR9 - Revisar logs o planes generados

Si usaste `scripts\build-backend-jvm-images.ps1`, pudo actualizar:

```text
C:\VENTA-DE-PASAJES\logs\backend-jvm-images\build-backend-jvm-images.plan.json
```

Ese archivo puede contener evidencia de otros servicios, por eso no se elimina automaticamente. Revisarlo antes de borrarlo:

```powershell
Test-Path -LiteralPath ".\logs\backend-jvm-images\build-backend-jvm-images.plan.json"
Get-Content -LiteralPath ".\logs\backend-jvm-images\build-backend-jvm-images.plan.json" -ErrorAction SilentlyContinue
```

Si confirma que solo contiene evidencia descartable del servicio de ejemplo:

```powershell
Remove-Item -LiteralPath ".\logs\backend-jvm-images\build-backend-jvm-images.plan.json" -Force
```

#### Paso NR10 - Opcional si integraste formalmente el servicio al ambiente dev

Estos pasos no aplican al paso a paso base. Solo usarlos si despues agregaste `catalog-service` a infraestructura real.

Revisar si el servicio fue registrado en Cloud Run config:

```powershell
Select-String -Path .\infra\cloudrun\dev-services.json -Pattern "catalog-service" -Context 2,4
```

Si aparece, retirar manualmente la entrada JSON correspondiente y validar que el JSON sigue siendo valido:

```powershell
Get-Content -LiteralPath .\infra\cloudrun\dev-services.json -Raw | ConvertFrom-Json | Out-Null
```

Si creaste un secreto de conexion:

```powershell
& $GcloudPath secrets delete "catalog-service__db-connection" `
  --project=$ProjectId `
  --quiet
```

Si creaste una service account runtime:

```powershell
& $GcloudPath iam service-accounts delete "catalog-service-run@$ProjectId.iam.gserviceaccount.com" `
  --project=$ProjectId `
  --quiet
```

Si creaste base Cloud SQL `catalog_db`, revisar primero:

```powershell
& $GcloudPath sql databases list `
  --project=$ProjectId `
  --instance="venta-pasajes-dev-sql" `
  --filter="name=$DatabaseName"
```

Eliminar solo si fue creada para esta prueba:

```powershell
& $GcloudPath sql databases delete $DatabaseName `
  --project=$ProjectId `
  --instance="venta-pasajes-dev-sql" `
  --quiet
```

#### Paso NR11 - Validacion final de limpieza

```powershell
[pscustomobject]@{
  local_service_folder_exists = Test-Path -LiteralPath "C:\VENTA-DE-PASAJES\services\catalog-service"
  local_container = (docker ps -a --filter "name=$ContainerName" --format "{{.Names}}")
  local_image = (docker image ls $ServiceName --format "{{.Repository}}:{{.Tag}}")
} | Format-List

& $GcloudPath run services describe $CloudRunService `
  --project=$ProjectId `
  --region=$Region `
  --format="value(metadata.name)"

& $GcloudPath artifacts docker images describe $ArtifactImage `
  --project=$ProjectId `
  --format="value(image_summary.digest)"
```

Resultados esperados:

- `local_service_folder_exists = False`;
- sin contenedor local;
- sin imagen local;
- Cloud Run devuelve no encontrado;
- Artifact Registry devuelve imagen no encontrada.

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
