# toolchain-demo-service

Servicio Quarkus minimo creado para validar la toolchain backend del Dia 10.

No es un modulo funcional de negocio. Sirve como referencia inicial para verificar Java 21, Maven, Quarkus, OpenAPI, pruebas JVM y compilacion nativa en contenedor.

## Endpoint

```text
GET /api/v1/toolchain/health
```

Respuesta esperada:

```json
{"status":"ok","service":"toolchain-demo-service","runtime":"quarkus"}
```

## Comandos validados

Pruebas JVM:

```powershell
mvn -f .\services\toolchain-demo-service\pom.xml test
```

Build nativo con Mandrel en Docker:

```powershell
mvn -f .\services\toolchain-demo-service\pom.xml package "-Dnative" "-DskipTests" "-Dquarkus.native.container-build=true" "-Dquarkus.native.builder-image=quay.io/quarkus/ubi9-quarkus-mandrel-builder-image:jdk-21"
```

El binario nativo generado desde Windows es Linux porque se construye dentro del contenedor. Para probarlo localmente, ejecutarlo dentro de Docker.
