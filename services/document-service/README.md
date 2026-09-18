# document-service

Servicio Quarkus responsable de generar comprobantes PDF de boletos, guardar metadata documental, almacenar el archivo en proveedor configurable y dejar el evento `DocumentGenerated` en outbox.

## Incluye

- Quarkus `3.25.2` con Java 21.
- REST con `quarkus-rest-jackson`.
- Hibernate ORM Panache y PostgreSQL JDBC.
- Flyway para migraciones.
- SmallRye OpenAPI y Swagger UI.
- SmallRye Health.
- Logs JSON configurables por entorno.
- Perfil `gcp` para Google Cloud y perfil `onprem` para ejecucion offline.
- Pruebas base con `@QuarkusTest`, REST Assured y renderizado PDF.
- Generacion de PDF con PDFBox.
- Almacenamiento local para desarrollo/on-premise y Cloud Storage configurable para GCP.

## Endpoints principales

```text
GET  /api/v1/document
GET /api/v1/document/health
GET  /api/v1/document/resources
POST /api/v1/document/documents/tickets/{ticketId}
GET  /api/v1/document/documents/{documentId}
GET  /api/v1/document/documents/{documentId}/download
GET /q/health
GET /q/health/live
GET /q/health/ready
GET /q/openapi
GET /q/swagger-ui
```

## Ejecutar pruebas

```powershell
mvn -f .\services\document-service\pom.xml test
```

## Validacion local completa

Levanta PostgreSQL temporal en Docker, arranca el servicio JVM, genera un PDF, lo descarga y valida el evento `DocumentGenerated`:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-document-service-local.ps1
```

Para reutilizar el jar ya construido:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-document-service-local.ps1 -SkipPackage
```

## Compilacion nativa

Validar rutas de build sin compilar:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-document-service-native.ps1 -PlanOnly
```

Compilar binario nativo, crear imagen local y etiquetar para Artifact Registry:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-document-service-native.ps1 -UseCleanWorkspace
```

Imagen local:

```text
document-service:0.1.0-native
```

Imagen remota:

```text
us-central1-docker.pkg.dev/project-fbb34cd7-0b82-43e1-867/venta-pasajes-dev/document-service:0.1.0-native
```

Publicar una imagen ya construida:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-document-service-native.ps1 `
  -SkipNativeBuild `
  -SkipDockerBuild `
  -Push
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
APP_DB_JDBC_URL=jdbc:postgresql://localhost:5432/documents_db
APP_DB_USERNAME=document_user
APP_DB_PASSWORD=<set-outside-repository>
APP_DOCUMENT_STORAGE_PROVIDER=local
APP_DOCUMENT_LOCAL_DIR=<path-outside-repository-or-target>
```

En Google Cloud:

```text
APP_DOCUMENT_STORAGE_PROVIDER=gcs
APP_DOCUMENT_BUCKET=venta-pasajes-dev-documents
```

Las variables sensibles nunca deben quedar en `.env`, `application.properties` ni archivos de notas.
