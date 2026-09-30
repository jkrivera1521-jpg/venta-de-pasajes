# Dia 10 - Toolchain backend Quarkus

Fecha: 2026-09-01

## Objetivo

Validar que el entorno local puede construir un microservicio Quarkus con Java LTS, Maven, Quarkus CLI y compilacion nativa basada en Mandrel/GraalVM.

## Tareas ejecutadas

- Se verifico Java LTS.
- Se verifico Maven.
- Se verifico Quarkus CLI.
- Se verifico Docker Desktop y Docker Engine.
- Se verifico que `native-image` no esta instalado como binario local.
- Se eligio compilacion nativa en contenedor con Mandrel para evitar dependencia global de GraalVM.
- Se creo el servicio demo `C:\VENTA-DE-PASAJES\services\toolchain-demo-service`.
- Se agrego un endpoint REST de salud de toolchain.
- Se agrego prueba automatizada con `@QuarkusTest` y REST Assured.
- Se ejecuto compilacion y pruebas JVM.
- Se ejecuto compilacion nativa en Docker con imagen Mandrel.
- Se ejecuto smoke test del binario nativo dentro de Docker.

## Versiones detectadas

| Componente | Version / detalle |
| --- | --- |
| Java | `21.0.8` LTS, Oracle JDK, ruta `C:\tools\jdk\jdk-21.0.8` |
| Maven | `Apache Maven 3.9.6`, ruta `C:\tools\apache-maven-3.9.6-bin\apache-maven-3.9.6` |
| Quarkus CLI | `3.25.2`, ruta `C:\ProgramData\chocolatey\bin\quarkus.exe` |
| Docker client | `28.3.2` |
| Docker Desktop | `4.44.3 (202357)` |
| Docker engine | `28.3.2`, contexto `desktop-linux` |
| native-image local | No instalado en PATH |
| Builder nativo | `quay.io/quarkus/ubi9-quarkus-mandrel-builder-image:jdk-21` |
| Mandrel dentro del builder | `Mandrel-23.1.12.1-Final`, JDK `21.0.12.1+1-LTS` |

## Servicio demo

Ubicacion:

```text
C:\VENTA-DE-PASAJES\services\toolchain-demo-service
```

Coordenadas Maven:

```text
com.ventapasajes:toolchain-demo-service:0.1.0-SNAPSHOT
```

Extensiones Quarkus:

- `quarkus-rest-jackson`
- `quarkus-smallrye-openapi`
- `quarkus-arc`

Endpoint validado:

```text
GET /api/v1/toolchain/health
```

Respuesta:

```json
{"status":"ok","service":"toolchain-demo-service","runtime":"quarkus"}
```

## Comandos ejecutados

Verificacion JVM:

```powershell
mvn -f .\services\toolchain-demo-service\pom.xml test
```

Resultado:

```text
Tests run: 1, Failures: 0, Errors: 0, Skipped: 0
BUILD SUCCESS
Total time: 53.562 s
```

Build nativo:

```powershell
mvn -f .\services\toolchain-demo-service\pom.xml package "-Dnative" "-DskipTests" "-Dquarkus.native.container-build=true" "-Dquarkus.native.builder-image=quay.io/quarkus/ubi9-quarkus-mandrel-builder-image:jdk-21"
```

Resultado:

```text
Running Quarkus native-image plugin on MANDREL 23.1.12.1 JDK 21.0.12.1+1-LTS
Produced artifacts:
  /project/toolchain-demo-service-0.1.0-SNAPSHOT-runner (executable)
BUILD SUCCESS
Total time: 01:56 min
```

Smoke test nativo:

```text
Respuesta HTTP: {"status":"ok","service":"toolchain-demo-service","runtime":"quarkus"}
```

## Artefactos generados

| Artefacto                                                                                                                 | Detalle                                              |
| ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `C:\VENTA-DE-PASAJES\services\toolchain-demo-service\pom.xml`                                                             | Proyecto Maven Quarkus 3.25.2 con Java 21.           |
| `C:\VENTA-DE-PASAJES\services\toolchain-demo-service\src\main\java\com\ventapasajes\toolchain\ToolchainResource.java`     | Endpoint REST de validacion.                         |
| `C:\VENTA-DE-PASAJES\services\toolchain-demo-service\src\test\java\com\ventapasajes\toolchain\ToolchainResourceTest.java` | Prueba automatizada JVM.                             |
| `C:\VENTA-DE-PASAJES\services\toolchain-demo-service\target\toolchain-demo-service-0.1.0-SNAPSHOT-runner`                 | Binario nativo Linux generado por Mandrel en Docker. |

Tamano del binario nativo:

```text
63,414,480 bytes
```

## Observaciones

- El registro de extensiones de Quarkus no estuvo disponible al primer intento de generacion con CLI.
- Se fijo explicitamente el BOM `io.quarkus.platform:quarkus-bom:3.25.2` para evitar depender del catalogo dinamico.
- `native-image` local no esta instalado; no bloquea el desarrollo porque el build nativo por contenedor fue exitoso.
- El binario nativo generado desde Windows es Linux por usar Docker como builder; para smoke test local se ejecuto dentro de Docker.
- La salida de Docker incluyo advertencia `DOCKER_INSECURE_NO_IPTABLES_RAW is set`; no bloqueo compilacion ni ejecucion.
- Los artefactos en `target` quedan ignorados por `.gitignore`.

## Resultado

La toolchain backend queda validada. Se puede construir un microservicio Quarkus en JVM y tambien compilarlo nativamente con Mandrel mediante Docker.

## Pendientes

- Convertir esta referencia en una plantilla reutilizable para los microservicios reales cuando inicie la implementacion backend.
- Decidir si el equipo quiere instalar GraalVM/Mandrel local o mantener exclusivamente build nativo por contenedor.
- Definir una version fija de builder image para CI/CD cuando se construyan imagenes productivas.

## Solución a los Pendientes

|Pendiente|Estado|Evidencia|
|---|---|---|
|Convertir referencia en plantilla reutilizable para microservicios reales|Cubierto|Existe la plantilla en [quarkus-service-template](C:/VENTA-DE-PASAJES/services/quarkus-service-template/README.md), el generador [new-quarkus-service.ps1](C:/VENTA-DE-PASAJES/scripts/new-quarkus-service.ps1), y documentación en [día 16](C:/VENTA-DE-PASAJES/docs/dia-16-plantilla-estandar-microservicio-quarkus.md). También hay plantillas finales en [templates/quarkus-service](C:/VENTA-DE-PASAJES/templates/quarkus-service/template.json).|
|Decidir GraalVM/Mandrel local vs build nativo por contenedor|Cubierto|En [día 10](C:/VENTA-DE-PASAJES/docs/dia-10-toolchain-backend-quarkus.md) quedó decidido usar **build nativo por contenedor con Mandrel**, evitando instalar GraalVM globalmente. Los scripts nativos usan `quarkus.native.container-build=true`.|
|Definir versión fija de builder image para CI/CD productivo|Cubierto parcialmente|Los scripts usan un builder fijo: `quay.io/quarkus/ubi9-quarkus-mandrel-builder-image:jdk-21`, por ejemplo en [build-identity-service-native.ps1](C:/VENTA-DE-PASAJES/scripts/build-identity-service-native.ps1). Pero para producción estricta sería mejor fijarlo por digest `@sha256`, porque un tag como `jdk-21` puede cambiar con el tiempo.|
Nota importante: el despliegue productivo actual quedó usando imágenes **JVM** con tag `prod-backend-0.1.1-jvm`, como se ve en [prod-backend-services.json](C:/VENTA-DE-PASAJES/infra/cloudrun/prod-backend-services.json). Eso fue por compatibilidad práctica con Cloud SQL/GraalVM/Mandrel, así que el tercer pendiente **no bloquea producción actual**, pero sí conviene endurecerlo si retomamos imágenes nativas productivas.

### REVERSA

Como maven genero la carpeta .\services\toolchain-demo-service\target, con este comando la eliminarmos :

```powershell
Remove-Item -LiteralPath .\services\toolchain-demo-service\target -Recurse -Force
```
