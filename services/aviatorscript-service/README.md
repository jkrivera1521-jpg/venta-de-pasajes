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

Flyway crea el esquema, las tablas y precarga `FORM-NOMINA-001` junto con el ejercicio `FORM-NOMINA-AVANZADA-001`. La formula avanzada incluye una descripcion breve, validaciones, sueldo proporcional, bonificaciones, horas extra, descuentos y clasificacion del salario neto. Sus tasas son solo ilustrativas, no normativa laboral. La migracion inserta el ejercicio con `ON CONFLICT DO NOTHING`: no actualiza ni reemplaza formulas ni versiones existentes. Para cambiar los valores de conexion, usa `APP_DB_JDBC_URL`, `APP_DB_USERNAME`, `APP_DB_PASSWORD` y `QUARKUS_HTTP_PORT`. El archivo `.env.example` contiene valores locales de referencia y no debe contener secretos reales.

## API

### Autenticacion y permisos

Las rutas de formulas, ejecucion, validacion, prueba y visualizacion requieren un JWT Bearer emitido por `identity-service`. El servicio verifica firma, emisor, audiencia y expiracion, y autoriza con estos permisos independientes:

| Operacion | Permiso |
| --- | --- |
| Consultar catalogo | `aviatorscript.formulas.read` |
| Guardar version borrador | `aviatorscript.formulas.write` |
| Validar con el motor real | `aviatorscript.formulas.validate` |
| Probar sin persistir | `aviatorscript.formulas.test` |
| Ejecutar version activa | `aviatorscript.formulas.execute` |
| Publicar | `aviatorscript.formulas.publish` |
| Activar | `aviatorscript.formulas.activate` |
| Visualizar flujo | `aviatorscript.formulas.visualize` |

La migracion de identidad `V16__aviatorscript_permissions.sql` registra los permisos y los asigna al rol `ADMIN`. Para desarrollo directo, el servicio usa los mismos valores locales de `APP_JWT_SIGNING_SECRET`, `APP_JWT_ISSUER` y `APP_JWT_AUDIENCE` que `identity-service`; en produccion deben configurarse mediante secretos compartidos, nunca con valores de ejemplo.

Ejecutar una formula:

```powershell
curl.exe -X POST http://localhost:8087/api/v1/calculos/ejecutar `
  -H "Authorization: Bearer $AccessToken" `
  -H "Content-Type: application/json" `
  -d '{"idSolicitud":"REQ-0001","codigoFormula":"FORM-NOMINA-001","parametros":{"salario":1200,"bonificacion":150,"descuento":50}}'
```

La respuesta contiene el identificador de ejecucion, la version usada, el resultado, el tipo de resultado, el estado y los tiempos de procesamiento. Los estados principales son `EXITOSO`, `SOLICITUD_INVALIDA`, `FORMULA_NO_ENCONTRADA` y `ERROR_CALCULO`.

Validar y probar codigo sin persistir:

```powershell
curl.exe -X POST http://localhost:8087/api/v1/calculos/validar `
  -H "Authorization: Bearer $AccessToken" `
  -H "Content-Type: application/json" `
  -d '{"source":"return salario + bonificacion;"}'

curl.exe -X POST http://localhost:8087/api/v1/calculos/probar `
  -H "Authorization: Bearer $AccessToken" `
  -H "Content-Type: application/json" `
  -d '{"source":"return salario + bonificacion;","parametros":{"salario":1200,"bonificacion":150}}'
```

Ambos endpoints usan `AviatorScriptEngine` y devuelven `contractVersion` y `engine`. La validacion informa diagnosticos de compilacion; la prueba devuelve el resultado de AviatorScript sin crear una ejecucion persistida.

Consultar las formulas guardadas para usarlas como plantillas de nuevas formulas:

```powershell
curl.exe http://localhost:8087/api/v1/calculos/formulas -H "Authorization: Bearer $AccessToken"
```

Este catalogo devuelve todas las versiones registradas, activas e inactivas, con su codigo, nombre, descripcion, expresion, ejemplo, estado y auditoria. Las filas anteriores a las migraciones de descripcion o ciclo de vida pueden devolver algunos metadatos nulos. El `GET` es de consulta, pero el recurso tambien ofrece `POST /api/v1/calculos/formulas` para crear una nueva version `BORRADOR`, y `POST /api/v1/calculos/formulas/{id}/publicar` y `/activar` para avanzar su ciclo de vida. No ofrece edicion destructiva ni eliminacion de formulas existentes. El constructor visual convierte las expresiones compatibles en una copia nueva; guardar esa copia desde el MFE crea una fila nueva y no modifica la plantilla original.

La solicitud de persistencia tiene esta forma:

```json
{
  "codigo": "FORM-EJEMPLO-001",
  "nombre": "Formula de ejemplo",
  "descripcion": "Descripcion funcional",
  "expresion": "return salario + bonificacion;",
  "ejemplo": { "salario": 1200, "bonificacion": 150 },
  "creadoPor": "desconocido"
}
```

El servicio valida que el ejemplo sea un objeto JSON, limita expresion y ejemplo a 100.000 caracteres y el ejemplo a 20 niveles de profundidad. Calcula el siguiente numero de version por codigo, asigna `BORRADOR` y deja `activa = false`. `publicar` registra `publicadoPor` y `fechaPublicacion`; `activar` solo acepta una version publicada, desactiva la version activa anterior del mismo codigo y registra `activadoPor` y `fechaActivacion`.

Analizar codigo AviatorScript para visualizar su flujo de control:

```powershell
curl.exe -X POST http://localhost:8087/api/v1/aviator/visualize `
  -H "Content-Type: application/json" `
  -d '{"source":"if (salarioMensual <= 0) { throw \"salario invalido\"; } return seq.map(\"salario\", salarioMensual);","includeSourceMapping":true}'
```

La respuesta contiene `nodes`, `edges` y `diagnostics`. Cada nodo incluye tipo (`decision`, `iteration`, `exception`, `return`, `process` o `function`), variables referenciadas, variables asignadas y rango de lineas. El analisis es estatico: no ejecuta, no compila y no modifica formulas almacenadas. El parser aplica limites de 10.000 caracteres, 4.096 tokens y 80 niveles de anidacion; ante codigo incompleto devuelve diagnosticos recuperables para que el editor conserve la fuente.

## Formula y versionado

Las formulas se almacenan en `calculos.formula`. Una version publicada debe ser inmutable; para publicar una nueva version se inserta otra fila con el mismo codigo y un numero de version mayor. La columna `expresion` es el codigo ejecutable y `ejemplo` es el contexto JSON recomendado para probarlo; el workspace Blockly y el AST de edicion pertenecen al archivo local del MFE, no a esta tabla. Flyway crea el esquema inicial en `src/main/resources/db/migration/V1__crear_motor_calculos.sql`, agrega descripcion y formulas demostrativas en las migraciones posteriores y conserva los seeds existentes con `ON CONFLICT DO NOTHING`.

El MFE separa explicitamente el ciclo de trabajo: `Guardar` es local y descarga `.aviatorscript.json`; `Guardar version` persiste `BORRADOR`; `Publicar` pasa a `PUBLICADA`; `Activar` desactiva la anterior y activa la nueva; `Nueva version` solo crea una copia editable en memoria. La auditoria se toma del JWT en el backend. El valor `desconocido` solo se conserva como respaldo cuando no existe una identidad autenticada en integraciones locales controladas.

Las expresiones AviatorScript deben validarse y limitarse antes de exponer este servicio fuera de una red confiable. `AviatorScriptEngine` centraliza la compilacion, los alias compatibles y los limites comunes para validar, probar y ejecutar. Antes de un despliegue compartido deben agregarse autenticacion/autorizacion, limites de ejecucion, funciones permitidas y proteccion contra formulas no confiables.

La arquitectura y la migracion de los endpoints legacy de `lib/rules` estan documentadas en `docs/aviatorscript-contract.md`.

El visualizador esta separado de `AviatorCalculationService`: `AviatorVisualizationService` construye un grafo de control intermedio con un lexer y parser recursivo, sin reutilizar el motor de ejecucion como analizador. La API de visualizacion no debe convertirse en un endpoint de ejecucion ni aceptar secretos del cliente.

## Pruebas

```powershell
mvn -f .\services\aviatorscript-service\pom.xml test
```

La prueba de recurso requiere una base PostgreSQL con la configuracion local disponible. Para empaquetar el servicio:

```powershell
mvn -f .\services\aviatorscript-service\pom.xml package -DskipTests
```
