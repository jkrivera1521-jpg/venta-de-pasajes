# Quarkus Service Template

Plantilla base para microservicios backend Quarkus del sistema Venta de Pasajes.

## Incluye

- Quarkus `3.25.2` con Java 21.
- REST con `quarkus-rest-jackson`.
- Hibernate ORM Panache y PostgreSQL JDBC.
- Flyway para migraciones.
- SmallRye OpenAPI y Swagger UI.
- SmallRye Health.
- Logs JSON configurables por entorno.
- Perfil `gcp` para Google Cloud y perfil `onprem` para ejecucion offline.
- Pruebas base con `@QuarkusTest` y REST Assured.

## Endpoints base

```text
GET /api/v1/template/health
GET /q/health
GET /q/health/live
GET /q/health/ready
GET /q/openapi
GET /q/swagger-ui
```

## Ejecutar pruebas

```powershell
mvn -f .\services\quarkus-service-template\pom.xml test
```

## Crear un servicio desde la plantilla

Ejemplo para `identity-service`:

```powershell
.\scripts\new-quarkus-service.ps1 `
  -ServiceName identity-service `
  -PackageSegment identity `
  -DatabaseName identity_db `
  -HttpPort 8081
```

Luego:

```powershell
mvn -f .\services\identity-service\pom.xml test
```

## Secretos

La plantilla no guarda secretos reales.

En Google Cloud los servicios deben leer Secret Manager usando referencias como:

```text
<service>__db-connection
identity-service__jwt-signing-secret
```

En on-premise/offline los servicios deben leer variables de entorno o archivos locales seguros fuera del repositorio. El perfil recomendado es:

```text
QUARKUS_PROFILE=onprem
APP_SECRETS_PROVIDER=env
APP_DB_JDBC_URL=jdbc:postgresql://localhost:5432/<service_db>
APP_DB_USERNAME=<service_user>
APP_DB_PASSWORD=<set-outside-repository>
```

Las variables sensibles nunca deben quedar en `.env`, `application.properties` ni archivos de notas.
