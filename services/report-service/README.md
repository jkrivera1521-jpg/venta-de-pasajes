# report-service

Servicio Quarkus 3.25.2 / Java 21 para administrar plantillas de reportes y generar documentos XLSX, DOCX y PDF.

## Alcance

- Versiona plantillas `XLSX` y `DOCX` en PostgreSQL mediante Flyway.
- Extrae parametros de expresiones `${...}`, comentarios JXLS, MERGEFIELD, controles de contenido y bindings OpenDoPE de DOCX.
- Inspecciona cada plantilla y expone motor, capacidades, raiz XML y advertencias en el catalogo y el MFE.
- Activa una sola version por codigo; las versiones anteriores quedan `RETIRED`.
- Procesa XLSX con JXLS/POI, DOCX con docx4j y PDF mediante docx4j-export-fo, incluyendo fuentes Croscore, Crosextra y Symbol.
- Procesa OpenDoPE, repeticiones, condicionales, headers, footers, imagenes validadas, texto enriquecido permitido, TOC/bookmarks y MERGEFIELD.
- Actualiza graficos existentes mediante el contrato `charts.chartN`, sus caches y el workbook XLSX embebido.
- Ejecuta lotes asincronos, genera un ZIP, conserva errores parciales y aplica expiracion.
- Usa almacenamiento local en desarrollo y GCS cuando `APP_REPORT_STORAGE_PROVIDER=gcs`.
- Valida firma ZIP, extension, macros, rutas internas, XML externo, tamano y expansion.
- No registra datos de negocio ni el contenido binario en logs.

## API

Las operaciones protegidas requieren un JWT HS256 emitido por `identity-service` y los permisos indicados:

| Operacion | Metodo | Permiso |
| --- | --- | --- |
| Catalogo, versiones, parametros y descarga de originales | `GET /api/v1/templates/**` | `REPORT_TEMPLATE_READ` |
| Crear plantilla/version | `POST /api/v1/templates` | `REPORT_TEMPLATE_CREATE` |
| Modificar metadatos | Reservado para `PATCH /api/v1/templates/{code}` | `REPORT_TEMPLATE_UPDATE` |
| Eliminar logicamente | `DELETE /api/v1/templates/{code}` | `REPORT_TEMPLATE_UPDATE` |
| Activar version | `POST /api/v1/templates/{code}/versions/{version}/activate` | `REPORT_TEMPLATE_ACTIVATE` |
| Generar documento | `POST /api/v1/reports/generate` | `REPORT_GENERATE` |
| Crear lote | `POST /api/v1/report-jobs` | `REPORT_BATCH_GENERATE` |
| Estado/cancelacion de lote | `GET/POST /api/v1/report-jobs/**` | `REPORT_BATCH_GENERATE` |
| Descargar ZIP | `GET /api/v1/report-jobs/{id}/download` | `REPORT_JOB_DOWNLOAD` |

La carga usa `multipart/form-data` con `file`, `code`, `name`, `description`, `version`, `activate` y `parameterSchema`. La generacion individual recibe:

El catalogo permite filtrar `GET /api/v1/templates` por `code`, `documentType`, `status` y `version`. `GET /api/v1/templates/{code}/parameters` devuelve el contrato de la version activa; la ruta con `/versions/{version}/parameters` consulta una version concreta.

```json
{
  "templateCode": "NOMINA_MENSUAL",
  "templateVersion": 1,
  "outputFormat": "XLSX",
  "data": { "empleado": { "nombre": "Ana" } }
}
```

La respuesta de carga incluye `templateId`, `code`, `version`, `documentType`, `status`, `checksumSha256`, el contrato completo `parameters` y `inspection`. `inspection` contiene `engine`, `features`, `xmlRoot` y `warnings`. Por compatibilidad, la entrada `parameters` tambien se acepta como alias de `data`.

Los errores se devuelven como `application/problem+json` con `code`, `detail`, `status` y `traceId`.

## Pruebas con cURL

Los siguientes ejemplos cubren todos los endpoints REST del servicio. Estan escritos para PowerShell usando `curl.exe` para evitar el alias de PowerShell. Reemplaza `<JWT>` por un token emitido por `identity-service`; no incluyas tokens reales en el README ni en el repositorio.

### Variables de la sesion

```powershell
$env:BASE_URL = "http://localhost:8088"
$env:TOKEN = "<JWT>"
$env:TEMPLATE_CODE = "VENTAS_MENSUALES"
$env:TEMPLATE_VERSION = "1"
```

### Salud y contrato OpenAPI

```powershell
# Endpoint de salud de la aplicacion.
curl.exe -sS "$env:BASE_URL/api/v1/report/health"

# Contrato OpenAPI generado por Quarkus.
curl.exe -sS "$env:BASE_URL/q/openapi"
```

### Crear una plantilla o una nueva version

El endpoint recibe `multipart/form-data`. `parameterSchema` es un arreglo JSON opcional; los parametros detectados en la plantilla se combinan con los declarados explicitamente.

```powershell
curl.exe -sS -X POST "$env:BASE_URL/api/v1/templates" `
  -H "Authorization: Bearer $env:TOKEN" `
  -F "file=@C:/ruta/plantilla.xlsx;type=application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" `
  -F "code=$env:TEMPLATE_CODE" `
  -F "name=Ventas mensuales" `
  -F "description=Reporte de ventas mensuales" `
  -F "version=$env:TEMPLATE_VERSION" `
  -F "activate=true" `
  -F 'parameterSchema=[{"path":"empresa.nombre","dataType":"STRING","required":true,"description":"Nombre de la empresa"},{"path":"periodo","dataType":"STRING","required":true}]'
```

Para DOCX cambia el archivo y su tipo MIME:

```powershell
curl.exe -sS -X POST "$env:BASE_URL/api/v1/templates" `
  -H "Authorization: Bearer $env:TOKEN" `
  -F "file=@C:/ruta/plantilla.docx;type=application/vnd.openxmlformats-officedocument.wordprocessingml.document" `
  -F "code=VENTAS_DOCX" `
  -F "name=Ventas DOCX" `
  -F "version=1" `
  -F "activate=true"
```

### Consultar el catalogo

```powershell
# Todas las plantillas visibles.
curl.exe -sS "$env:BASE_URL/api/v1/templates" `
  -H "Authorization: Bearer $env:TOKEN"

# Filtros opcionales: code, documentType, status y version.
curl.exe -sS "$env:BASE_URL/api/v1/templates?code=$env:TEMPLATE_CODE&documentType=XLSX&status=ACTIVE&version=1" `
  -H "Authorization: Bearer $env:TOKEN"
```

### Consultar una plantilla y sus versiones

```powershell
# Devuelve la version activa.
curl.exe -sS "$env:BASE_URL/api/v1/templates/$env:TEMPLATE_CODE" `
  -H "Authorization: Bearer $env:TOKEN"

# Devuelve una version concreta usando query string.
curl.exe -sS "$env:BASE_URL/api/v1/templates/$env:TEMPLATE_CODE?version=$env:TEMPLATE_VERSION" `
  -H "Authorization: Bearer $env:TOKEN"

# Lista todas las versiones.
curl.exe -sS "$env:BASE_URL/api/v1/templates/$env:TEMPLATE_CODE/versions" `
  -H "Authorization: Bearer $env:TOKEN"

# Consulta una version concreta mediante la ruta versionada.
curl.exe -sS "$env:BASE_URL/api/v1/templates/$env:TEMPLATE_CODE/versions/$env:TEMPLATE_VERSION" `
  -H "Authorization: Bearer $env:TOKEN"
```

### Consultar parametros

```powershell
# Parametros de la version activa.
curl.exe -sS "$env:BASE_URL/api/v1/templates/$env:TEMPLATE_CODE/parameters" `
  -H "Authorization: Bearer $env:TOKEN"

# Parametros de una version especifica.
curl.exe -sS "$env:BASE_URL/api/v1/templates/$env:TEMPLATE_CODE/versions/$env:TEMPLATE_VERSION/parameters" `
  -H "Authorization: Bearer $env:TOKEN"
```

### Activar una version

La activacion retira transaccionalmente la version activa anterior del mismo codigo.

```powershell
curl.exe -sS -X POST "$env:BASE_URL/api/v1/templates/$env:TEMPLATE_CODE/versions/$env:TEMPLATE_VERSION/activate" `
  -H "Authorization: Bearer $env:TOKEN"
```

### Generar un documento individual

`outputFormat` acepta `XLSX`, `DOCX` o `PDF`. La respuesta es binaria y se guarda con `--output`.

```powershell
$generateBody = @'
{
  "templateCode": "VENTAS_MENSUALES",
  "templateVersion": 1,
  "outputFormat": "XLSX",
  "fileName": "ventas-octubre.xlsx",
  "data": {
    "empresa": { "nombre": "Venta de Pasajes" },
    "periodo": "2026-10",
    "ventas": [
      { "fecha": "2026-10-01", "total": 125.5 },
      { "fecha": "2026-10-02", "total": 220.0 }
    ]
  }
}
'@

$generateBody | curl.exe -sS -X POST "$env:BASE_URL/api/v1/reports/generate" `
  -H "Authorization: Bearer $env:TOKEN" `
  -H "Content-Type: application/json" `
  --data-binary '@-' `
  --output ventas-octubre.xlsx
```

Para PDF o DOCX cambia `outputFormat`, `fileName` y la extension de `--output`:

```powershell
($generateBody -replace '"XLSX"', '"PDF"' -replace 'ventas-octubre\.xlsx', 'ventas-octubre.pdf') |
  curl.exe -sS -X POST "$env:BASE_URL/api/v1/reports/generate" `
    -H "Authorization: Bearer $env:TOKEN" `
    -H "Content-Type: application/json" `
    --data-binary '@-' `
    --output ventas-octubre.pdf
```

### Crear un lote asincrono

El endpoint devuelve `202 Accepted` y un identificador de trabajo. Guarda ese identificador en `$env:JOB_ID` para consultar, cancelar o descargar el lote.

```powershell
$batchBody = @'
{
  "templateCode": "VENTAS_MENSUALES",
  "templateVersion": 1,
  "outputFormat": "XLSX",
  "zipFileName": "ventas-octubre.zip",
  "documents": [
    {
      "fileName": "ventas-norte.xlsx",
      "data": {
        "empresa": { "nombre": "Sucursal Norte" },
        "periodo": "2026-10"
      }
    },
    {
      "fileName": "ventas-sur.xlsx",
      "data": {
        "empresa": { "nombre": "Sucursal Sur" },
        "periodo": "2026-10"
      }
    }
  ]
}
'@

$batchResponse = $batchBody | curl.exe -sS -X POST "$env:BASE_URL/api/v1/report-jobs" `
  -H "Authorization: Bearer $env:TOKEN" `
  -H "Content-Type: application/json" `
  --data-binary '@-'

$batchResponse
# Copia el campo id de la respuesta:
$env:JOB_ID = "<UUID_DEL_TRABAJO>"
```

### Consultar, descargar y cancelar un lote

```powershell
# Consulta el estado del lote.
curl.exe -sS "$env:BASE_URL/api/v1/report-jobs/$env:JOB_ID" `
  -H "Authorization: Bearer $env:TOKEN"

# Repite la consulta hasta que status sea COMPLETED o FAILED.
# Cuando sea COMPLETED, descarga el ZIP:
curl.exe -sS "$env:BASE_URL/api/v1/report-jobs/$env:JOB_ID/download" `
  -H "Authorization: Bearer $env:TOKEN" `
  --output reportes.zip

# Cancela un lote PENDING o RUNNING.
curl.exe -sS -X POST "$env:BASE_URL/api/v1/report-jobs/$env:JOB_ID/cancel" `
  -H "Authorization: Bearer $env:TOKEN"
```

### Eliminar logicamente una plantilla

La eliminacion no borra fisicamente el historial de versiones; cambia el estado del catalogo segun las reglas del servicio.

```powershell
curl.exe -sS -X DELETE "$env:BASE_URL/api/v1/templates/$env:TEMPLATE_CODE" `
  -H "Authorization: Bearer $env:TOKEN"
```

Los codigos de plantilla son unicos. Una plantilla eliminada conserva su codigo para mantener la trazabilidad del historial, por lo que no puede reutilizarse en una nueva carga. Si el codigo ya existe y esta visible, carga una version mayor a la ultima registrada; si esta eliminado, usa otro codigo o restaura la plantilla mediante el flujo administrativo. El servicio responde `409 TEMPLATE_CODE_RESERVED` en el segundo caso y `409 TEMPLATE_VERSION_EXISTS` si la version solicitada ya existe.

### Errores y respuestas binarias

Para inspeccionar cabeceras y errores de validacion:

```powershell
curl.exe -i -sS "$env:BASE_URL/api/v1/templates/NO_EXISTE" `
  -H "Authorization: Bearer $env:TOKEN" `
  -H "Accept: application/problem+json"
```

Los errores de negocio y validacion usan `application/problem+json` con `code`, `detail`, `status` y `traceId`. Las respuestas de generacion individual son archivos binarios; las respuestas de descarga de lotes son `application/zip`.

## Estado y limites

El binario de cada version vive en `report_template_blob`, separado de la metadata y del versionado. El repositorio y la API mantienen separadas las tablas de catalogo, parametros, trabajos, blobs y auditoria. La activacion es transaccional. `report_job` guarda el ZIP en el proveedor configurado, no dentro de la transaccion.

Valores configurables principales:

- `APP_REPORT_TEMPLATE_MAX_BYTES` (10 MiB por defecto).
- `APP_REPORT_BATCH_MAX_DOCUMENTS` (500).
- `APP_REPORT_BATCH_EXPIRATION_HOURS` (24).
- `APP_REPORT_BATCH_PARALLELISM` (2).
- `APP_REPORT_PDF_ENABLED`.
- `APP_REPORT_PDF_MAX_BYTES` (50 MiB).
- `APP_REPORT_BATCH_MAX_REQUEST_BYTES` (50 MiB, aplicado tambien por el limite HTTP).
- `APP_REPORT_PARAMETERS_STRICT` (true: rechaza campos no declarados).
- `APP_REPORT_STORAGE_PROVIDER=local|gcs`, `APP_REPORT_STORAGE_LOCAL_DIR`, `APP_REPORT_STORAGE_BUCKET`.

En el perfil `local` el bucket tiene un valor marcador para que Quarkus pueda iniciar sin GCS. Si se usa `APP_REPORT_STORAGE_PROVIDER=gcs`, se debe configurar un bucket real mediante `APP_REPORT_STORAGE_BUCKET`; el servicio lo valida antes de leer o escribir.

Las plantillas no admiten macros (`xlsm/docm`), referencias XML externas ni rutas ZIP inseguras. La generacion PDF requiere una plantilla DOCX.

## DOCX avanzado

La guia operativa con ejemplos paso a paso y pruebas manuales del MFE esta en [`docs/docx4j/README.md`](docs/docx4j/README.md). Incluye contratos de JSON, fixtures, casos de error y comandos de validacion para cada capacidad.

El flujo recomendado es cargar la plantilla, revisar `inspection`, consultar el contrato de parametros, editar `data` en el popup de generacion y descargar DOCX o PDF. El MFE guarda y recupera el JSON de generacion por codigo y version mediante `Guardar` y `Reset`.

## Limitaciones conocidas

- La primera version procesa los lotes elemento por elemento, pero mantiene el ZIP final en memoria antes de almacenarlo; para lotes muy grandes debe migrarse el almacenamiento a un stream temporal o multipart.
- DOCX conserva la compatibilidad con variables preparadas por docx4j, marcadores divididos entre ejecuciones de Word, valores anidados y filas legacy `jt:forEach`. OpenDoPE requiere que la plantilla tenga Custom XML y bindings validos; no se inventan bindings faltantes.
- Las imagenes dinamicas se reciben como base64/data URI validada. No se aceptan URLs remotas por defecto.
- El texto enriquecido solo se procesa en controles de contenido rich text y con una lista blanca de XHTML.
- Los graficos deben existir en la plantilla, tener caches editables y un unico workbook XLSX embebido. Se valida que las cantidades de series y puntos coincidan; no se crean graficos nuevos.
- `docx4j-export-fo` genera un PDF valido y conserva el contenido compatible, pero la fidelidad visual de TOC y graficos puede diferir de Word. Las pruebas automatizadas verifican estructura y MIME; la comparacion pixel a pixel requiere revision visual.
- La auditoria es durable en `report_audit_event` dentro de la base del servicio. `APP_REPORT_AUDIT_URL` queda reservado para publicar eventos al `audit-service` mediante un adaptador autenticado.
- La prueba PostgreSQL con Testcontainers está etiquetada como integración y deshabilitada por defecto; CI debe ejecutarla con Docker.
- Los fixtures de XLSX se construyen en las pruebas para no versionar archivos binarios; las plantillas reales se cargan por `POST /api/v1/templates`.

En algunos entornos Windows restringidos, `@QuarkusTest` puede fallar antes de iniciar la aplicacion con `Unable to establish loopback connection` o `Invalid argument: connect` al crear un selector Netty. Ese error pertenece al entorno de ejecucion de la prueba; las pruebas de motor DOCX se pueden comprobar de forma aislada con `-Dtest=DocxTemplateEngineTest,DynamicImageValidatorTest,JsonToXmlConverterTest,RichTextSanitizerTest,TemplateParameterExtractorTest`. En una terminal Windows normal o CI con loopback habilitado debe ejecutarse tambien la suite completa.

## Desarrollo

### PostgreSQL local con Docker

El servicio usa una base PostgreSQL propia para mantener aislados sus datos de las bases de identidad y AviatorScript. El puerto `55438` es el puerto del host; dentro del contenedor PostgreSQL sigue escuchando en `5432`.

Desde PowerShell, en la raiz del monorepo:

```powershell
$LocalDbPassword = "ReportLocal_ChangeMe_12345"
$NetworkName = "venta-pasajes-report-local"
$ContainerName = "venta-pasajes-report-db"
$VolumeName = "venta-pasajes-report-pgdata"

docker network inspect $NetworkName *> $null
if ($LASTEXITCODE -ne 0) {
  docker network create $NetworkName | Out-Null
}

docker container inspect $ContainerName *> $null
if ($LASTEXITCODE -eq 0) {
  docker start $ContainerName
} else {
  docker run -d `
    --name $ContainerName `
    --network $NetworkName `
    --restart unless-stopped `
    -e POSTGRES_DB=report_db `
    -e POSTGRES_USER=report_user `
    -e "POSTGRES_PASSWORD=$LocalDbPassword" `
    -p 55438:5432 `
    -v "${VolumeName}:/var/lib/postgresql/data" `
    postgres:16-alpine
}
```

El volumen conserva la base aunque se detenga el contenedor. Para comprobar que PostgreSQL esta listo:

```powershell
docker exec venta-pasajes-report-db pg_isready -U report_user -d report_db
```

El servicio puede leer las variables desde `services/report-service/.env.example`; copia el archivo a `services/report-service/.env` para trabajar localmente y no subas ese archivo. Si el contenedor ya existe, no ejecutes de nuevo `docker run`; usa `docker start venta-pasajes-report-db`.

Si necesitas eliminar completamente la base local, incluyendo sus datos:

```powershell
docker rm -f venta-pasajes-report-db
docker volume rm venta-pasajes-report-pgdata
docker network rm venta-pasajes-report-local
```

### Arrancar Quarkus

```powershell
mvn -f .\services\report-service\pom.xml test
mvn -f .\services\report-service\pom.xml quarkus:dev
```

Con la configuracion del ejemplo, la conexion es `jdbc:postgresql://localhost:55438/report_db`, el servicio usa el puerto `8088` y el almacenamiento local queda en `target/report-storage`. En PowerShell, las variables pueden cargarse antes de Maven:

```powershell
$env:APP_DB_JDBC_URL = "jdbc:postgresql://localhost:55438/report_db"
$env:APP_DB_USERNAME = "report_user"
$env:APP_DB_PASSWORD = "ReportLocal_ChangeMe_12345"
$env:QUARKUS_FLYWAY_MIGRATE_AT_START = "true"
mvn -f .\services\report-service\pom.xml quarkus:dev
```

Para desplegar la imagen JVM se usa `infra/cloudrun/dev-services.json`; la imagen nativa usa `scripts/build-report-service-native.ps1`.

Las rutas protegidas requieren configurar `APP_JWT_SIGNING_SECRET`, `APP_JWT_ISSUER` y `APP_JWT_AUDIENCE`; no se incluye una clave JWT por defecto.

La migracion de permisos vive en `services/identity-service/src/main/resources/db/migration/V17__report_service_permissions.sql`.
