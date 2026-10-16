# aviatorscript-service

Servicio Quarkus para ejecutar formulas versionadas almacenadas en PostgreSQL mediante AviatorScript. Cada ejecucion se registra en la base de datos y devuelve el resultado evaluado, su version y el estado de la operacion.

## Desarrollo local

Requisitos: JDK 21, Maven 3.9 o superior y Docker Desktop.

Desde la raiz del monorepo:

```powershell
.\scripts\start-aviatorscript-service.ps1
```

El script levanta PostgreSQL con Docker Compose y luego inicia Quarkus. Si PostgreSQL ya esta levantado en `localhost:5432`, usa `-SkipDatabase`.

Para detener solo la base local:

```powershell
.\scripts\stop-aviatorscript-service.ps1
```

Tambien puedes iniciar manualmente la base y Maven:

```powershell
docker compose -f .\services\aviatorscript-service\docker-compose.yml up -d
mvn -f .\services\aviatorscript-service\pom.xml quarkus:dev
```

### PostgreSQL con `docker run`

Si prefieres levantar la base sin Compose, usa un contenedor y una red propios del servicio. El puerto `55437` evita conflictos con la base de identidad que usa `55432`:

```powershell
$LocalDbPassword = "AviatorLocal_ChangeMe_12345"
$NetworkName = "venta-pasajes-aviatorscript-local"

docker network inspect $NetworkName *> $null
if ($LASTEXITCODE -ne 0) {
  docker network create $NetworkName
}

docker run -d `
  --name venta-pasajes-aviatorscript-db `
  --network $NetworkName `
  -e POSTGRES_DB=aviatorscript_db `
  -e POSTGRES_USER=aviatorscript_user `
  -e "POSTGRES_PASSWORD=$LocalDbPassword" `
  -p 55437:5432 `
  -v venta-pasajes-aviatorscript-pgdata:/var/lib/postgresql/data `
  postgres:16-alpine

$env:APP_DB_JDBC_URL = "jdbc:postgresql://localhost:55437/aviatorscript_db"
$env:APP_DB_USERNAME = "aviatorscript_user"
$env:APP_DB_PASSWORD = $LocalDbPassword
mvn -f .\services\aviatorscript-service\pom.xml quarkus:dev
```

Si el contenedor ya existe, no ejecutes nuevamente `docker run`; configura las variables `APP_DB_*` y ejecuta Maven. Para eliminarlo junto con su volumen local usa `docker rm -f venta-pasajes-aviatorscript-db` y `docker volume rm venta-pasajes-aviatorscript-pgdata`.

La configuracion local por defecto usa:

- API: `http://localhost:8087`
- Health: `http://localhost:8087/q/health`
- OpenAPI: `http://localhost:8087/q/openapi`
- Swagger UI: `http://localhost:8087/q/swagger-ui`
- Base: `aviatorscript_db`
- Usuario: `aviatorscript_user`
- Esquema: `calculos`

Flyway crea el esquema, las tablas y la formula de ejemplo `FORM-NOMINA-001` al iniciar. Para cambiar los valores, usa las variables `APP_DB_JDBC_URL`, `APP_DB_USERNAME`, `APP_DB_PASSWORD` y `QUARKUS_HTTP_PORT`. El archivo `.env.example` contiene valores locales de referencia y no debe contener secretos reales.

## API

Ejecutar una formula:

```powershell
curl.exe -X POST http://localhost:8087/api/v1/calculos/ejecutar `
  -H "Content-Type: application/json" `
  -d '{"idSolicitud":"REQ-0001","codigoFormula":"FORM-NOMINA-001","parametros":{"salario":1200,"bonificacion":150,"descuento":50}}'
```

La respuesta contiene el identificador de ejecucion, la version usada, el resultado, el tipo de resultado, el estado y los tiempos de procesamiento. Los estados principales son `EXITOSO`, `SOLICITUD_INVALIDA`, `FORMULA_NO_ENCONTRADA` y `ERROR_CALCULO`.

## Formula y versionado

Las formulas se almacenan en `calculos.formula`. Una version publicada debe ser inmutable; para publicar una nueva version se inserta otra fila con el mismo codigo y un numero de version mayor. La migracion inicial se encuentra en `src/main/resources/db/migration/V1__crear_motor_calculos.sql`.

Las expresiones AviatorScript deben validarse y limitarse antes de exponer este servicio fuera de una red confiable. Antes de un despliegue compartido deben agregarse autenticacion/autorizacion, limites de entrada y ejecucion, funciones permitidas y proteccion contra formulas no confiables.

## Pruebas

```powershell
mvn -f .\services\aviatorscript-service\pom.xml test
```

La prueba de recurso requiere una base PostgreSQL con la configuracion local disponible. Para empaquetar el servicio:

```powershell
mvn -f .\services\aviatorscript-service\pom.xml package -DskipTests
```
