# reporting-service

Servicio Quarkus de reportes operativos del sistema Venta de Pasajes. Mantiene un modelo de lectura propio en `reporting_db` y evita que las consultas de administracion carguen directamente el flujo transaccional de ventas.

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
GET /api/v1/reporting
GET /api/v1/reporting/resources
GET /api/v1/reporting/health
GET /q/health
GET /q/health/live
GET /q/health/ready
GET /q/openapi
GET /q/swagger-ui
```

## Endpoints funcionales

```text
POST /api/v1/reporting/events/ticket-sold
POST /api/v1/reporting/events/ticket-cancelled
GET  /api/v1/reporting/reports/sales
GET  /api/v1/reporting/reports/passengers
GET  /api/v1/reporting/reports/sales/by-user
GET  /api/v1/reporting/reports/sales/by-bus
```

## Configuracion

```text
APP_REPORTING_TIME_ZONE=America/Guayaquil
APP_DB_JDBC_URL=jdbc:postgresql://localhost:5432/reporting_db
APP_DB_USERNAME=reporting_user
APP_DB_PASSWORD=<set-outside-repository>
```

## Ejecutar pruebas

```powershell
mvn -f .\services\reporting-service\pom.xml test
```

## Validacion local completa

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-reporting-service-local.ps1
```

## Secretos

El servicio no guarda secretos reales.

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
