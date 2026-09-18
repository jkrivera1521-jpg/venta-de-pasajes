# Identity Service

Microservicio de identidad del sistema Venta de Pasajes.

## Incluye

- Quarkus `3.25.2` con Java 21.
- REST con `quarkus-rest-jackson`.
- Hibernate ORM Panache y PostgreSQL JDBC.
- Flyway para migraciones.
- SmallRye OpenAPI y Swagger UI.
- SmallRye Health.
- Logs JSON configurables por entorno.
- Autenticacion local, Google OIDC configurable, JWT interno y permisos por rol.
- Pruebas con `@QuarkusTest`, REST Assured y verificacion local con PostgreSQL temporal.

## Endpoints principales

```text
GET /api/v1/identity/health
POST /api/v1/identity/auth/local/login
POST /api/v1/identity/auth/google/exchange
POST /api/v1/identity/auth/logout
GET /api/v1/identity/me
GET /api/v1/identity/users
POST /api/v1/identity/users
GET /api/v1/identity/roles
GET /api/v1/identity/permissions
GET /api/v1/identity/authorized-identities
GET /q/health
GET /q/health/live
GET /q/health/ready
GET /q/openapi
GET /q/swagger-ui
```

Los endpoints administrativos requieren:

```text
Authorization: Bearer <access_token>
```

## Ejecutar pruebas

```powershell
mvn -f .\services\identity-service\pom.xml test
```

## Empaquetar JVM

```powershell
mvn -f .\services\identity-service\pom.xml package -DskipTests
```

## Empaquetar nativo

Compila el binario nativo con Mandrel en Docker y crea la imagen local `identity-service:0.1.0-native`:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-identity-service-native.ps1 `
  -ProjectId project-fbb34cd7-0b82-43e1-867 `
  -Region us-central1 `
  -Repository venta-pasajes-dev `
  -ImageTag 0.1.0-native `
  -UseCleanWorkspace
```

`-UseCleanWorkspace` evita errores de archivos bloqueados en Windows cuando hay un `identity-service` JVM corriendo desde `target`.

Verificar la imagen nativa con PostgreSQL temporal:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-identity-service-native-local.ps1 `
  -ImageTag identity-service:0.1.0-native `
  -HttpPort 18083 `
  -DatabasePort 55435
```

Publicar en Artifact Registry dev:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-identity-service-native.ps1 `
  -ProjectId project-fbb34cd7-0b82-43e1-867 `
  -Region us-central1 `
  -Repository venta-pasajes-dev `
  -ImageTag 0.1.0-native `
  -SkipNativeBuild `
  -SkipDockerBuild `
  -Push `
  -CreateRepository
```

## Verificar conexion local a base

Este comando levanta PostgreSQL temporal en Docker, arranca el JAR JVM con perfil `onprem`, aplica Flyway y valida `/q/health/ready`.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-identity-service-local-db.ps1
```

## Verificar autenticacion local

Este comando levanta PostgreSQL temporal, crea un admin bootstrap con secretos generados al vuelo, prueba login local, JWT, permisos y reset de contrasena. No imprime contrasenas ni tokens.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-identity-auth-local.ps1
```

## Secretos

El servicio no guarda secretos reales.

En Google Cloud debe leer Secret Manager usando referencias como:

```text
identity-service__db-connection
identity-service__jwt-signing-secret
```

La plataforma de despliegue debe inyectar como variables los valores reales de:

```text
APP_JWT_SIGNING_SECRET
APP_PASSWORD_PEPPER
APP_RECOVERY_TOKEN_PEPPER
APP_GOOGLE_CLIENT_IDS
```

En on-premise/offline debe leer variables de entorno o un archivo local seguro fuera del repositorio:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-identity-service-onprem.ps1 `
  -EnvFile C:\VENTA-DE-PASAJES-RUNTIME\identity-service.env `
  -MigrateAtStart
```

Las variables sensibles nunca deben quedar en `.env`, `application.properties` ni archivos de notas.
