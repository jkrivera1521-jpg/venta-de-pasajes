QUIERO QUE ME DES EL PROYECTO LISTO .zip incluyendo flyway configurado para que se levante sin problemas en mi ambiente de desarrollo.

Procesó durante 1m 55s

## 13. Descargar el proyecto completo

motor-calculos.zip

Proyecto Quarkus · Java 21 · AviatorScript · PostgreSQL · Flyway

Incluye código fuente, migración SQL, Docker Compose, pruebas y guía de ejecución.

Descargar el proyecto ZIP

## 14. Cómo levantarlo en tu Windows 11

Una vez descargado y descomprimido el ZIP:

1. Verifica que tengas instalado JDK 21, Maven 3.9+ y Docker Desktop.
    
2. Abre una terminal en la carpeta `motor-calculos`.
    
3. Ejecuta el archivo `iniciar-desarrollo.bat`, o ejecuta estos comandos manualmente:
    

```
docker compose up -d
mvn quarkus:dev
```

Flyway ejecutará automáticamente la migración inicial al arrancar Quarkus, creará las tablas y registrará la fórmula de prueba.

Después podrás probar:

- API: `http://localhost:8080/api/v1/calculos/ejecutar`
    
- Estado de salud: `http://localhost:8080/q/health`
    

Importante: he generado y verificado la integridad del ZIP, pero no he podido ejecutar la compilación Maven en este entorno porque Maven no está instalado aquí. Por tanto, todavía debes ejecutar la compilación y las pruebas en tu equipo para confirmar la compatibilidad de todas las dependencias.

dame ejemplos como probar los endpoints

Te dejo ejemplos prácticos para probar los endpoints del proyecto `motor-calculos` con Postman, PowerShell y `curl`, incluyendo cálculos exitosos, fórmulas inexistentes y errores de validación.

## 1. Levantar el servicio

Desde la carpeta donde descomprimiste el ZIP, ejecuta:

```
docker compose up -d
mvn quarkus:dev
```

Comprueba que Quarkus esté activo:

- API de cálculo: `http://localhost:8080/api/v1/calculos/ejecutar`
    
- Salud del servicio: `http://localhost:8080/q/health`
    

El endpoint de ejecución utiliza el método POST y recibe JSON.

## 2. Ejemplo principal: ejecutar una fórmula

En Postman configura:

POST

`http://localhost:8080/api/v1/calculos/ejecutar`

Headers

|Key|Value|
|---|---|
|`Content-Type`|`application/json`|

Body → raw → JSON

{ "idSolicitud": "REQ-001", "codigoFormula": "FORM-NOMINA-001", "parametros": { "salario": 1200, "bonificacion": 150, "descuento": 50 } }

La fórmula previamente registrada en PostgreSQL es:

`salario + bonificacion - descuento`

El resultado matemático esperado es `1300`.

La respuesta debe incluir el identificador de ejecución generado por PostgreSQL, la fórmula y su versión, los parámetros recibidos, el resultado, el estado y los tiempos de ejecución.

## 3. Probar desde PowerShell con `curl.exe`

Si estás en Windows 11, puedes ejecutar estas solicitudes desde PowerShell.

### Caso A: cálculo exitoso

Esperado: HTTP 200 OK

```
$body = @{
    idSolicitud = "REQ-002"
    codigoFormula = "FORM-NOMINA-001"
    parametros = @{
        salario = 2000
        bonificacion = 300
        descuento = 100
    }
} | ConvertTo-Json -Depth 10

curl.exe -X POST `
  "http://localhost:8080/api/v1/calculos/ejecutar" `
  -H "Content-Type: application/json" `
  -d $body
```

Resultado matemático esperado: `2200`.

### Caso B: fórmula inexistente

Esperado: HTTP 404 Not Found

```
$body = @{
    idSolicitud = "REQ-003"
    codigoFormula = "FORMULA-INEXISTENTE"
    parametros = @{
        salario = 1000
    }
} | ConvertTo-Json -Depth 10

curl.exe -X POST `
  "http://localhost:8080/api/v1/calculos/ejecutar" `
  -H "Content-Type: application/json" `
  -d $body
```

El servicio debe responder con el estado `FORMULA_NO_ENCONTRADA` y guardar el intento en PostgreSQL, si la transacción de registro se completa correctamente.

### Caso C: falta el código de fórmula

Esperado: HTTP 400 Bad Request

```
$body = @{
    idSolicitud = "REQ-004"
    parametros = @{
        salario = 1000
    }
} | ConvertTo-Json -Depth 10

curl.exe -X POST `
  "http://localhost:8080/api/v1/calculos/ejecutar" `
  -H "Content-Type: application/json" `
  -d $body
```

Este caso debe devolver `SOLICITUD_INVALIDA`.

### Caso D: variable faltante

Resultado por verificar con la versión de AviatorScript utilizada.

```
$body = @{
    idSolicitud = "REQ-005"
    codigoFormula = "FORM-NOMINA-001"
    parametros = @{
        salario = 1000
    }
} | ConvertTo-Json -Depth 10

curl.exe -X POST `
  "http://localhost:8080/api/v1/calculos/ejecutar" `
  -H "Content-Type: application/json" `
  -d $body
```

La expresión también necesita `bonificacion` y `descuento`. Dependiendo de cómo AviatorScript resuelva las variables faltantes, el resultado podría ser un error de evaluación o un valor no esperado. Para producción, recomiendo validar explícitamente las variables requeridas antes de ejecutar la fórmula.

## 4. Comprobar el estado de Quarkus

En el navegador abre:

Health Check

Comprueba el estado del servicio y sus comprobaciones de salud.

[Abrir `http://localhost:8080/q/health`](http://localhost:8080/q/health)

Si PostgreSQL está correctamente configurado, el servicio debe iniciar sin errores de conexión y Flyway debe completar la migración inicial.

## 5. Verificar los resultados directamente en PostgreSQL

Puedes conectarte a la base `motor_calculos` desde DBeaver, pgAdmin o `psql`.

### Consultar las ejecuciones

```
SELECT
    id,
    id_solicitud,
    codigo_formula,
    version_formula,
    parametros,
    resultado,
    estado,
    error,
    fecha_inicio,
    duracion_ms
FROM calculos.ejecucion
ORDER BY id DESC
LIMIT 20;
```

### Comprobar que Flyway ejecutó la migración

```
SELECT *
FROM flyway_schema_history
ORDER BY installed_rank;
```

Si la tabla de historial está dentro del esquema `public`, esta consulta debería mostrar la migración `V1__crear_motor_calculos.sql` como exitosa.

## 6. Resumen de pruebas

|Prueba|Resultado esperado|
|---|---|
|Fórmula válida|HTTP 200, estado `EXITOSO`|
|Código inexistente|HTTP 404|
|Solicitud incompleta|HTTP 400|
|Error durante el cálculo|HTTP 422|
|PostgreSQL no disponible|Error de infraestructura; revisar los logs|

Importante: el ZIP actual expone un único endpoint de negocio: `POST /api/v1/calculos/ejecutar`. El health check es proporcionado por Quarkus. No hay todavía endpoints para registrar fórmulas, consultar ejecuciones por ID o listar el historial; esos procesos se administran por ahora mediante SQL y pueden añadirse como una siguiente versión de la API.

dame el ejemplo con curl no con powershell

Aquí tienes los ejemplos utilizando `curl` estándar, compatibles con Linux, macOS, Git Bash y otras terminales que tengan `curl` instalado.

## 1. Ejecutar una fórmula correctamente

Endpoint: `POST http://localhost:8080/api/v1/calculos/ejecutar`

```
curl -X POST "http://localhost:8080/api/v1/calculos/ejecutar" \
  -H "Content-Type: application/json" \
  -d '{
    "idSolicitud": "REQ-001",
    "codigoFormula": "FORM-NOMINA-001",
    "parametros": {
      "salario": 1200,
      "bonificacion": 150,
      "descuento": 50
    }
  }'
```

Resultado matemático esperado: `1300`.

## 2. Ejecutar otra fórmula con diferentes parámetros

```
curl -X POST "http://localhost:8080/api/v1/calculos/ejecutar" \
  -H "Content-Type: application/json" \
  -d '{
    "idSolicitud": "REQ-002",
    "codigoFormula": "FORM-NOMINA-001",
    "parametros": {
      "salario": 2000,
      "bonificacion": 300,
      "descuento": 100
    }
  }'
```

Resultado matemático esperado: `2200`.

## 3. Probar una fórmula inexistente

```
curl -i -X POST "http://localhost:8080/api/v1/calculos/ejecutar" \
  -H "Content-Type: application/json" \
  -d '{
    "idSolicitud": "REQ-003",
    "codigoFormula": "FORMULA-INEXISTENTE",
    "parametros": {
      "salario": 1000
    }
  }'
```

Respuesta esperada: HTTP `404 Not Found`.

## 4. Probar una solicitud inválida

```
curl -i -X POST "http://localhost:8080/api/v1/calculos/ejecutar" \
  -H "Content-Type: application/json" \
  -d '{
    "idSolicitud": "",
    "codigoFormula": "FORM-NOMINA-001",
    "parametros": {}
  }'
```

Respuesta esperada: HTTP `400 Bad Request`.

## 5. Consultar el estado del servicio

```
curl -i "http://localhost:8080/q/health"
```

Si Quarkus está levantado correctamente, debería responder con HTTP `200 OK` y un JSON con el estado de salud.

## 6. Mostrar la respuesta JSON formateada

Si tienes `jq` instalado, puedes combinarlo con `curl`:

```
curl -s -X POST "http://localhost:8080/api/v1/calculos/ejecutar" \
  -H "Content-Type: application/json" \
  -d '{
    "idSolicitud": "REQ-004",
    "codigoFormula": "FORM-NOMINA-001",
    "parametros": {
      "salario": 1200,
      "bonificacion": 150,
      "descuento": 50
    }
  }' | jq .
```

Importante: antes de ejecutar las pruebas, asegúrate de haber iniciado PostgreSQL, levantado Quarkus y ejecutado la migración de Flyway que registra `FORM-NOMINA-001`.

cual es el procedimiento para agregar una nueva formula a la base de datos

En el proyecto `motor-calculos`, puedes agregar una nueva fórmula directamente en PostgreSQL mediante un `INSERT` en la tabla `calculos.formula`. Después podrás ejecutarla usando el endpoint REST existente, sin modificar el código Java ni reiniciar Quarkus.

## 1. Registrar una nueva fórmula

Por ejemplo, vamos a crear una fórmula para calcular el IVA del 15 %.

```
INSERT INTO calculos.formula (
    codigo,
    nombre,
    version,
    expresion,
    activa
)
VALUES (
    'FORM-IVA-001',
    'Cálculo de IVA',
    1,
    'subtotal * 0.15',
    TRUE
);
```

La expresión `subtotal * 0.15` utiliza la variable `subtotal`, cuyo valor será proporcionado por el consumidor de la API.

## 2. Verificar que se registró correctamente

```
SELECT
    id,
    codigo,
    nombre,
    version,
    expresion,
    activa,
    fecha_creacion
FROM calculos.formula
WHERE codigo = 'FORM-IVA-001';
```

Deberías encontrar la fórmula con versión `1` y estado activo.

## 3. Ejecutar la fórmula con `curl`

Una vez registrada, ejecuta el siguiente comando desde tu terminal:

```
curl -X POST "http://localhost:8080/api/v1/calculos/ejecutar" \
  -H "Content-Type: application/json" \
  -d '{
    "idSolicitud": "REQ-IVA-001",
    "codigoFormula": "FORM-IVA-001",
    "parametros": {
      "subtotal": 100
    }
  }'
```

Resultado matemático esperado:

100×0.15=15100×0.15=15

La respuesta debe incluir el resultado `15`, el código de fórmula, su versión, los parámetros recibidos y el identificador del registro de ejecución.

## 4. Agregar una fórmula más compleja

AviatorScript permite expresar operaciones combinadas. Por ejemplo, para calcular el precio final con IVA y descuento:

```
INSERT INTO calculos.formula (
    codigo,
    nombre,
    version,
    expresion,
    activa
)
VALUES (
    'FORM-PRECIO-001',
    'Precio final con IVA y descuento',
    1,
    '(subtotal - descuento) * 1.15',
    TRUE
);
```

Prueba con `curl`:

```
curl -X POST "http://localhost:8080/api/v1/calculos/ejecutar" \
  -H "Content-Type: application/json" \
  -d '{
    "idSolicitud": "REQ-PRECIO-001",
    "codigoFormula": "FORM-PRECIO-001",
    "parametros": {
      "subtotal": 100,
      "descuento": 10
    }
  }'
```

Resultado matemático esperado: `103.5`.

## 5. ¿Tengo que modificar Flyway cada vez que agrego una fórmula?

No necesariamente. Hay dos tipos de cambios diferentes:

|Cambio|Procedimiento recomendado|
|---|---|
|Agregar una fórmula de negocio|Insertar un registro en `calculos.formula`.|
|Cambiar la estructura de una tabla|Crear una nueva migración Flyway.|
|Registrar una fórmula inicial que debe existir en todos los ambientes|Incluirla en una migración Flyway versionada.|
|Cambiar la expresión de una fórmula existente|Crear una nueva versión de la fórmula.|

Flyway se utiliza para versionar cambios estructurales y datos iniciales controlados. Las fórmulas de negocio que se administran dinámicamente pueden incorporarse mediante SQL o, idealmente, mediante un endpoint administrativo protegido.

## 6. Una consideración importante sobre las versiones

El servicio actual utiliza una caché de expresiones compiladas y selecciona la versión activa más alta. Para mantener la trazabilidad, te recomiendo que cada modificación cree una nueva versión y que las versiones anteriores no se sobrescriban.

Por ejemplo:

```
INSERT INTO calculos.formula (
    codigo,
    nombre,
    version,
    expresion,
    activa
)
VALUES (
    'FORM-IVA-001',
    'Cálculo de IVA',
    2,
    'subtotal * 0.15 + recargo',
    TRUE
);
```

Antes de usar este ejemplo, debes asegurarte de que `recargo` se envíe como parámetro y de que solo haya una versión activa por código, o ajustar el mecanismo de selección de versiones.

Mi recomendación: el siguiente paso sería incorporar un módulo de administración de fórmulas con endpoints como `POST /api/v1/formulas`, `GET /api/v1/formulas/{codigo}` y `POST /api/v1/formulas/{codigo}/versiones`, con autenticación y validación de expresiones. Así ya no necesitarías insertar las fórmulas manualmente en PostgreSQL.

quiero un ejemplo super complejo con estructuras de control de flujo

Procesó durante 21s

como se haría para procesar masivamente ?

Para procesar cálculos masivamente en tu motor de Quarkus + AviatorScript + PostgreSQL, te recomiendo diseñar un mecanismo de procesamiento por lotes (batch processing). Así podrás ejecutar una misma fórmula sobre miles o millones de registros sin tener que enviar una petición HTTP por cada cálculo.

Por ejemplo, podrías calcular la nómina de 20.000 empleados, las cuotas de miles de créditos o las comisiones de una cartera de clientes.

## 1. Arquitectura propuesta

1. Cliente / sistema origen

Envía un lote de 20.000 empleados

2. API REST de Quarkus

Valida la solicitud y registra el trabajo

3. PostgreSQL

Guarda el lote, sus registros y el estado del trabajo

4. Procesador por lotes

Lee bloques de registros y ejecuta AviatorScript

5. Resultados y auditoría

Guarda resultados, errores y estadísticas del lote

La decisión más importante es que la petición HTTP no debería quedarse esperando a que terminen los 20.000 cálculos. Es mejor registrar el trabajo, devolver un identificador y permitir que un procesador lo ejecute en segundo plano.

## 2. Cómo sería la API de procesamiento masivo

En lugar de usar el endpoint individual:

`POST /api/v1/calculos/ejecutar`

crearía tres endpoints específicos para procesamiento masivo:

|Método|Endpoint|Función|
|---|---|---|
|`POST`|`/api/v1/calculos/lotes`|Registra un lote de cálculos|
|`GET`|`/api/v1/calculos/lotes/{id}`|Consulta el avance del lote|
|`GET`|`/api/v1/calculos/lotes/{id}/resultados`|Recupera resultados y errores|

El primer endpoint respondería inmediatamente con HTTP `202 Accepted`, indicando que el procesamiento fue aceptado y está pendiente.

### Ejemplo de petición

```
{
  "codigoFormula": "FORM-NOMINA-AVANZADA-001",
  "versionFormula": 1,
  "registros": [
    {
      "idReferencia": "EMP-001",
      "parametros": {
        "salarioMensual": 1800,
        "diasTrabajados": 30,
        "diasMes": 30,
        "aniosAntiguedad": 8,
        "tipoEmpleado": "TECNICO",
        "calificacionDesempeno": 92,
        "horasExtras": [],
        "descuentosAdicionales": []
      }
    },
    {
      "idReferencia": "EMP-002",
      "parametros": {
        "salarioMensual": 2500,
        "diasTrabajados": 25,
        "diasMes": 30,
        "aniosAntiguedad": 3,
        "tipoEmpleado": "SUPERVISOR",
        "calificacionDesempeno": 85,
        "horasExtras": [],
        "descuentosAdicionales": []
      }
    }
  ]
}
```

La fórmula es la misma para todos los registros, pero cada empleado tiene sus propios parámetros.

La respuesta inicial podría ser:

```
{
  "idLote": "LOT-20261013-00001",
  "estado": "PENDIENTE",
  "totalRegistros": 2,
  "procesados": 0,
  "exitosos": 0,
  "fallidos": 0
}
```

## 3. Tablas que añadiría a PostgreSQL

Conservaría tus tablas actuales `calculos.formula` y `calculos.ejecucion`, y añadiría dos tablas para administrar el lote y sus registros.

```

CREATE TABLE calculos.lote (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    codigo_lote VARCHAR(80) NOT NULL UNIQUE,
    codigo_formula VARCHAR(100) NOT NULL,
    version_formula INTEGER NOT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',
    total_registros INTEGER NOT NULL DEFAULT 0,
    procesados INTEGER NOT NULL DEFAULT 0,
    exitosos INTEGER NOT NULL DEFAULT 0,
    fallidos INTEGER NOT NULL DEFAULT 0,
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_inicio TIMESTAMPTZ,
    fecha_fin TIMESTAMPTZ
);

CREATE TABLE calculos.lote_detalle (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    lote_id BIGINT NOT NULL
        REFERENCES calculos.lote(id),
    id_referencia VARCHAR(150) NOT NULL,
    parametros JSONB NOT NULL,
    resultado JSONB,
    estado VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',
    error TEXT,
    intentos INTEGER NOT NULL DEFAULT 0,
    fecha_inicio TIMESTAMPTZ,
    fecha_fin TIMESTAMPTZ,

    CONSTRAINT uq_lote_referencia
        UNIQUE (lote_id, id_referencia)
);

CREATE INDEX idx_lote_estado
    ON calculos.lote (estado, fecha_creacion);

CREATE INDEX idx_lote_detalle_pendiente
    ON calculos.lote_detalle (lote_id, id)
    WHERE estado = 'PENDIENTE';
```

Los estados podrían ser:

- Lote: `PENDIENTE`, `PROCESANDO`, `COMPLETADO`, `COMPLETADO_CON_ERRORES` y `FALLIDO`.
    
- Registro: `PENDIENTE`, `PROCESANDO`, `EXITOSO` y `FALLIDO`.
    

El `id_referencia` permite identificar a qué empleado, crédito o transacción corresponde cada resultado. Si el detalle ya contiene el resultado completo, no es obligatorio duplicarlo en `calculos.ejecucion`; puedes mantener ambas tablas relacionadas si necesitas conservar la auditoría individual existente.

## 4. El procesador que ejecuta los cálculos

En Quarkus puedes usar un trabajador programado con `@Scheduled` que consulte lotes pendientes. Para comenzar, implementaría un trabajador que tome un bloque de 200 o 500 registros, ejecute las fórmulas y persista los resultados en una transacción por bloque.

El siguiente código ilustra la estructura; los métodos de repositorio y de ejecución son interfaces que debes implementar con tus entidades actuales.

```

import io.quarkus.scheduler.Scheduled;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

@ApplicationScoped
public class ProcesadorLotes {

    @Inject
    LoteRepository loteRepository;

    @Inject
    FormulaService formulaService;

    @Inject
    LoteDetalleService detalleService;

    @Scheduled(every = "2s")
    void procesarPendientes() {

        // Reclama un lote mediante una operación atómica
        // para evitar que otro trabajador tome el mismo lote.
        var lote = loteRepository.reclamarSiguienteLote();

        if (lote.isEmpty()) {
            return;
        }

        var trabajo = lote.get();

        try {
            while (true) {

                // Obtiene un bloque limitado de registros
                // y los marca como PROCESANDO atómicamente.
                var bloque = detalleService
                    .reclamarPendientes(trabajo.id(), 200);

                if (bloque.isEmpty()) {
                    break;
                }

                for (var registro : bloque) {
                    try {
                        // Ejecuta la versión fijada al lote.
                        var resultado = formulaService.ejecutar(
                            trabajo.codigoFormula(),
                            trabajo.versionFormula(),
                            registro.parametros()
                        );

                        detalleService.marcarExitoso(
                            registro.id(),
                            resultado
                        );

                    } catch (Exception ex) {
                        detalleService.marcarFallido(
                            registro.id(),
                            ex.getMessage()
                        );
                    }
                }

                // Actualiza contadores desde los estados
                // persistidos, no desde contadores en memoria.
                loteRepository.actualizarProgreso(
                    trabajo.id()
                );
            }

            loteRepository.finalizarSiCorresponde(
                trabajo.id()
            );

        } catch (Exception ex) {
            loteRepository.registrarErrorDeProcesamiento(
                trabajo.id(),
                ex.getMessage()
            );
        }
    }
}
```

Importante para producción: los métodos que reclaman lotes y registros deben utilizar transacciones cortas y bloqueos seguros. Una estrategia habitual en PostgreSQL es `FOR UPDATE SKIP LOCKED`, junto con una actualización atómica del estado. Si ejecutas el servicio en varias instancias, eso evita que dos trabajadores reclamen simultáneamente el mismo registro. Cada bloque debería confirmar sus cambios independientemente; no mantengas una sola transacción abierta durante miles de cálculos.

Además, una excepción en un registro no debería detener todo el lote. Los errores de negocio se registran por separado y los demás registros continúan procesándose.

## 5. ¿Cómo consultar el avance?

Una consulta como:

`GET /api/v1/calculos/lotes/LOT-20261013-00001`

podría devolver:

```
{
  "idLote": "LOT-20261013-00001",
  "estado": "PROCESANDO",
  "totalRegistros": 20000,
  "procesados": 12500,
  "exitosos": 12480,
  "fallidos": 20,
  "porcentajeAvance": 62.5
}
```

El porcentaje se calcula así:

Avance=exitosos+fallidostotalRegistros×100Avance=totalRegistrosexitosos+fallidos​×100

Para obtener resultados, el endpoint de resultados puede admitir paginación, por ejemplo `?page=0&size=100`, y filtros por estado. Evita devolver los 20.000 resultados en una única respuesta.

## 6. ¿Cuánto procesamiento puedes conseguir?

Depende de la complejidad de las fórmulas, el hardware, las consultas a la base de datos y la cantidad de trabajadores. No asumiría un rendimiento específico sin hacer pruebas.

|Estrategia|Cuándo utilizarla|
|---|---|
|Un trabajador, bloques de 200–500|Primera versión, simple de operar|
|Varios trabajadores concurrentes|Cuando las mediciones demuestren que necesitas más capacidad|
|Cola de mensajes, como Kafka o RabbitMQ|Cuando necesitas desacoplar productores y consumidores, absorber picos y escalar de forma independiente|
|Quarkus con un motor batch dedicado|Cuando necesitas planificación, reinicios, checkpoints y gestión formal de trabajos extensos|

Para optimizar el motor, compilaría cada fórmula una sola vez y reutilizaría la expresión compilada para todos los registros de ese lote. También evitaría consultar PostgreSQL por cada operación matemática: la fórmula se carga una vez, mientras que los resultados se escriben por bloques.

### Mi recomendación para tu proyecto

Empezaría con PostgreSQL + Quarkus + AviatorScript, un registro de lote y procesamiento en bloques de 200 registros, dejando preparada la posibilidad de añadir varios trabajadores.

Hay una decisión de diseño que conviene tomar desde el principio: ¿quieres que el sistema reciba los 20.000 registros dentro de una petición JSON, o que reciba un archivo CSV/Excel con los registros para procesarlo de manera asíncrona? Para volúmenes grandes, normalmente prefiero el archivo o una fuente de datos existente, porque evita solicitudes HTTP enormes.