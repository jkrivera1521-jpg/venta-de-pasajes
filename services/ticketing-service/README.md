# Quarkus Service Ticketing

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
GET /api/v1/ticketing/health
GET /api/v1/ticketing/resources
GET /api/v1/ticketing/seat-statuses
GET /api/v1/ticketing/reservation-statuses
GET /api/v1/ticketing/ticket-statuses
GET /q/health
GET /q/health/live
GET /q/health/ready
GET /q/openapi
GET /q/swagger-ui
```

## Endpoints funcionales principales

```text
POST /api/v1/ticketing/availability/sync/departures
GET  /api/v1/ticketing/availability/departures
GET  /api/v1/ticketing/availability/departures/{dispatchDepartureId}/seats
POST /api/v1/ticketing/passengers
GET  /api/v1/ticketing/passengers
PUT  /api/v1/ticketing/passengers/{passengerId}
POST /api/v1/ticketing/reservations
POST /api/v1/ticketing/reservations/expire
POST /api/v1/ticketing/tickets
GET  /api/v1/ticketing/tickets/{ticketId}
POST /api/v1/ticketing/tickets/{ticketId}/cancel
GET  /api/v1/ticketing/tickets/{ticketId}/document
POST /api/v1/ticketing/tickets/{ticketId}/document/reprint
POST /api/v1/ticketing/documents/process-pending
```

## Integracion documental

Cuando `APP_DOCUMENT_INTEGRATION_ENABLED=true`, el servicio puede procesar eventos locales `TicketSold`, llamar a `document-service`, guardar la referencia del PDF en `ticket_document_refs` y permitir reimpresion.

En perfil `gcp`, la integracion documental queda apagada por defecto para que `ticketing-service` pueda desplegarse de forma independiente. La generacion documental se reactiva cuando exista el flujo asincrono/event-driven o cuando se habilite explicitamente una integracion operacional.

Variables principales:

```text
APP_DOCUMENT_INTEGRATION_ENABLED=true
APP_DOCUMENT_WORKER_ENABLED=true
APP_DOCUMENT_WORKER_INTERVAL=15s
APP_DOCUMENT_WORKER_BATCH_SIZE=10
APP_DOCUMENT_SERVICE_BASE_URL=http://localhost:8084/api/v1/document
APP_DOCUMENT_MAX_ATTEMPTS=3
APP_DOCUMENT_RETRY_DELAY_SECONDS=30
```

Validacion integrada local con `document-service` y dos PostgreSQL temporales:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-ticketing-document-integration.ps1
```

## Ejecutar pruebas

```powershell
mvn -f .\services\ticketing-service\pom.xml test
```

## Compilacion nativa

Compila el binario nativo con Mandrel en Docker, crea la imagen local y la etiqueta para Artifact Registry:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-ticketing-service-native.ps1 -UseCleanWorkspace
```

Imagen local:

```text
ticketing-service:0.1.0-native
```

Imagen remota:

```text
us-central1-docker.pkg.dev/project-fbb34cd7-0b82-43e1-867/venta-pasajes-dev/ticketing-service:0.1.0-native
```

Validacion funcional local con PostgreSQL temporal:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-ticketing-service-native-local.ps1 `
  -ImageTag ticketing-service:0.1.0-native `
  -HttpPort 18096 `
  -DatabasePort 55452
```

Publicacion de una imagen ya construida:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-ticketing-service-native.ps1 `
  -SkipNativeBuild `
  -SkipDockerBuild `
  -Push
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
