# Dia 18 - Autenticacion y autorizacion

Fecha: 2026-09-03

## Objetivo

Implementar autenticacion hibrida en `identity-service`: Google OIDC, login local, JWT interno, roles, permisos, bloqueo por intentos fallidos y recuperacion de contrasena con token de un solo uso.

## Resultado ejecutivo

Dia 18 completado.

`identity-service` ya no expone stubs `501` para los endpoints principales de identidad. Ahora permite:

- Login local con usuario/contrasena.
- Hash seguro de contrasena con `PBKDF2WithHmacSHA256`, salt aleatorio y pepper configurable.
- Emision y validacion de JWT interno `HS256`.
- Middleware de permisos mediante anotacion `@RequiresPermission`.
- Validacion de ID token Google con issuer, audience, expiracion, correo verificado y firma `RS256` contra JWKS de Google.
- Modo de token Google de desarrollo solo cuando `APP_GOOGLE_DEV_TOKEN_ENABLED=true`.
- Autorizacion de Google por correo, dominio o subject registrado.
- Roles y permisos basicos con seed inicial para `ADMIN` y `TICKET_SELLER`.
- Bootstrap opcional de admin inicial para entornos on-premise/locales.
- Bloqueo temporal por intentos fallidos.
- Recuperacion/reset de contrasena con token de un solo uso.

## Archivos principales

| Archivo | Proposito |
| --- | --- |
| `C:\VENTA-DE-PASAJES\services\identity-service\src\main\java\com\ventapasajes\identity\api\IdentityBaseResource.java` | Endpoints funcionales de autenticacion, usuarios, roles, permisos y autorizaciones. |
| `C:\VENTA-DE-PASAJES\services\identity-service\src\main\java\com\ventapasajes\identity\auth` | JWT, hashing, Google ID token verifier, filtro Bearer y contexto de usuario actual. |
| `C:\VENTA-DE-PASAJES\services\identity-service\src\main\java\com\ventapasajes\identity\service\IdentityApplicationService.java` | Casos de uso de autenticacion/autorizacion. |
| `C:\VENTA-DE-PASAJES\services\identity-service\src\main\java\com\ventapasajes\identity\service\IdentityBootstrapService.java` | Bootstrap opcional de usuario admin inicial. |
| `C:\VENTA-DE-PASAJES\services\identity-service\src\main\java\com\ventapasajes\identity\api\dto` | Contratos de request/response. |
| `C:\VENTA-DE-PASAJES\services\identity-service\src\main\resources\application.properties` | Variables de seguridad, Google OIDC, JWT y perfiles `gcp`/`onprem`. |
| `C:\VENTA-DE-PASAJES\services\identity-service\src\main\resources\db\migration\V1__identity_schema.sql` | Seed de permisos/roles y algoritmo de credenciales. |
| `C:\VENTA-DE-PASAJES\scripts\verify-identity-auth-local.ps1` | Verificacion end-to-end local con PostgreSQL temporal. |
| `C:\VENTA-DE-PASAJES\docs\openapi\identity-service.openapi.yaml` | Contrato OpenAPI alineado con lo implementado. |
| `C:\VENTA-DE-PASAJES\services\identity-service\README.md` | Guia actualizada de endpoints y verificaciones. |

## Endpoints funcionales

```text
POST /api/v1/identity/auth/local/login
POST /api/v1/identity/auth/google/exchange
POST /api/v1/identity/auth/logout
GET  /api/v1/identity/me
GET  /api/v1/identity/users
POST /api/v1/identity/users
GET  /api/v1/identity/users/{userId}
PATCH /api/v1/identity/users/{userId}
PUT  /api/v1/identity/users/{userId}/roles
POST /api/v1/identity/users/{userId}/activate
POST /api/v1/identity/users/{userId}/suspend
GET  /api/v1/identity/roles
POST /api/v1/identity/roles
GET  /api/v1/identity/permissions
GET  /api/v1/identity/authorized-identities
POST /api/v1/identity/authorized-identities
POST /api/v1/identity/password/forgot
POST /api/v1/identity/password/reset
```

Los endpoints administrativos requieren `Authorization: Bearer <jwt>`.

## Variables clave

```text
APP_JWT_SIGNING_SECRET=<set-outside-repository>
APP_PASSWORD_PEPPER=<set-outside-repository>
APP_RECOVERY_TOKEN_PEPPER=<set-outside-repository>
APP_JWT_ISSUER=identity-service
APP_JWT_AUDIENCE=venta-pasajes
APP_GOOGLE_CLIENT_IDS=<google-oauth-client-id>
APP_GOOGLE_SIGNATURE_REQUIRED=true
APP_AUTH_LOCAL_MAX_FAILED_ATTEMPTS=5
APP_AUTH_LOCAL_LOCKOUT_MINUTES=15
APP_BOOTSTRAP_ADMIN_ENABLED=false
```

Para on-premise/offline se puede operar con login local sin depender de Google. El login Google real requiere poder validar las llaves publicas de Google, salvo modo de desarrollo controlado.

## Ejemplos Postman y curl

Antes de probar en Postman, levantar `identity-service` con PostgreSQL y un admin bootstrap temporal.

Ejemplo local:

```powershell
docker run --rm --name venta-pasajes-postgres-dev `
  -e POSTGRES_DB=identity_db `
  -e POSTGRES_USER=postgres `
  -e POSTGRES_PASSWORD=postgres_dev_password `
  -p 5432:5432 `
  -d postgres:16-alpine

mvn -f .\services\identity-service\pom.xml package -DskipTests

$env:QUARKUS_PROFILE="onprem"
$env:QUARKUS_HTTP_PORT="8081"
$env:APP_RUNTIME_TARGET="onprem"
$env:APP_SECRETS_PROVIDER="env"
$env:APP_DB_JDBC_URL="jdbc:postgresql://localhost:5432/identity_db"
$env:APP_DB_USERNAME="postgres"
$env:APP_DB_PASSWORD="postgres_dev_password"
$env:APP_JWT_SIGNING_SECRET="local-dev-jwt-signing-secret-change-me-32-bytes"
$env:APP_PASSWORD_PEPPER="local-dev-password-pepper-change-me"
$env:APP_RECOVERY_TOKEN_PEPPER="local-dev-recovery-token-pepper-change-me"
$env:APP_GOOGLE_CLIENT_IDS="local-google-client-placeholder"
$env:APP_AUTH_RECOVERY_RETURN_TOKEN_ENABLED="true"
$env:APP_BOOTSTRAP_ADMIN_ENABLED="true"
$env:APP_BOOTSTRAP_ADMIN_LOGIN="admin"
$env:APP_BOOTSTRAP_ADMIN_EMAIL="admin@onprem.local"
$env:APP_BOOTSTRAP_ADMIN_PASSWORD="AdminTemp-2026!!"
$env:QUARKUS_FLYWAY_MIGRATE_AT_START="true"

java -jar .\services\identity-service\target\quarkus-app\quarkus-run.jar
```

Verificar health:

```http
GET http://localhost:8081/q/health/ready
```

Comando curl:

```powershell
curl.exe -X GET "http://localhost:8081/q/health/ready"
```

Login local:

```http
POST http://localhost:8081/api/v1/identity/auth/local/login
Content-Type: application/json

{
  "login": "admin",
  "password": "AdminTemp-2026!!"
}
```

Comando curl:

```powershell
$loginResponse = curl.exe -s -X POST "http://localhost:8081/api/v1/identity/auth/local/login" `
  -H "Content-Type: application/json" `
  -d '{"login":"admin","password":"AdminTemp-2026!!"}' | ConvertFrom-Json

$accessToken = $loginResponse.access_token
$accessToken
```

Usar token:

```http
GET http://localhost:8081/api/v1/identity/me
Authorization: Bearer <access_token>
```

Comando curl:

```powershell
curl.exe -X GET "http://localhost:8081/api/v1/identity/me" `
  -H "Authorization: Bearer $accessToken"
```

Listar permisos:

```powershell
curl.exe -X GET "http://localhost:8081/api/v1/identity/permissions" `
  -H "Authorization: Bearer $accessToken"
```

Listar roles:

```powershell
curl.exe -X GET "http://localhost:8081/api/v1/identity/roles" `
  -H "Authorization: Bearer $accessToken"
```

Listar usuarios:

```powershell
curl.exe -X GET "http://localhost:8081/api/v1/identity/users" `
  -H "Authorization: Bearer $accessToken"
```

Solicitar recuperacion de contrasena local:

```powershell
$forgotResponse = curl.exe -s -X POST "http://localhost:8081/api/v1/identity/password/forgot" `
  -H "Content-Type: application/json" `
  -d '{"login_or_email":"admin"}' | ConvertFrom-Json

$recoveryToken = $forgotResponse.recovery_token
```

Cambiar contrasena con token temporal:

```powershell
$resetBody = @{
  token = $recoveryToken
  new_password = "AdminTemp-2026-Reset!!"
} | ConvertTo-Json -Compress

curl.exe -X POST "http://localhost:8081/api/v1/identity/password/reset" `
  -H "Content-Type: application/json" `
  -d $resetBody
```

Probar login con la nueva contrasena:

```powershell
$loginResponse = curl.exe -s -X POST "http://localhost:8081/api/v1/identity/auth/local/login" `
  -H "Content-Type: application/json" `
  -d '{"login":"admin","password":"AdminTemp-2026-Reset!!"}' | ConvertFrom-Json

$accessToken = $loginResponse.access_token
```

En Postman, copiar el campo `access_token` de la respuesta del login y pegarlo en `Authorization > Type: Bearer Token`.

## Comandos ejecutados

Revision e inspeccion:

```powershell
$lines = Get-Content -Path tareas.md; $lines[832..858]
rg --files services/identity-service/src/main services/identity-service/src/test infra/env docs/openapi docs/database | sort
Get-Content -Path services/identity-service/pom.xml
Get-Content -Path services/identity-service/src/main/resources/application.properties
Get-Content -Path docs/openapi/identity-service.openapi.yaml
Get-Content -Path services/identity-service/src/main/java/com/ventapasajes/identity/api/IdentityBaseResource.java
Get-Content -Path services/identity-service/src/main/resources/db/migration/V1__identity_schema.sql
Get-Content -Path services/identity-service/src/main/java/com/ventapasajes/identity/persistence/entity/UserAccount.java
Get-Content -Path services/identity-service/src/main/java/com/ventapasajes/identity/persistence/entity/LocalCredential.java
Get-Content -Path services/identity-service/src/main/java/com/ventapasajes/identity/persistence/entity/Role.java
Get-Content -Path services/identity-service/src/main/java/com/ventapasajes/identity/persistence/entity/PermissionCatalogItem.java
Get-Content -Path scripts/verify-identity-service-local-db.ps1
Get-Content -Path scripts/start-identity-service-onprem.ps1
rg "identity-service" infra/env docs -n
```

Preparacion:

```powershell
New-Item -ItemType Directory -Force -Path services/identity-service/src/main/java/com/ventapasajes/identity/api/dto, services/identity-service/src/main/java/com/ventapasajes/identity/auth, services/identity-service/src/main/java/com/ventapasajes/identity/service
```

Validaciones:

```powershell
mvn -f .\services\identity-service\pom.xml test

$Errors=$null
[System.Management.Automation.Language.Parser]::ParseFile((Resolve-Path .\scripts\verify-identity-auth-local.ps1), [ref]$null, [ref]$Errors)

mvn -f .\services\identity-service\pom.xml package -DskipTests

powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-identity-auth-local.ps1

powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-identity-service-local-db.ps1

docker ps --filter "name=venta-pasajes-identity" --format "table {{.Names}}\t{{.Status}}"
```

Comandos internos relevantes ejecutados por `verify-identity-auth-local.ps1`:

```powershell
docker run --rm --name venta-pasajes-identity-auth-pg-<pid> -e POSTGRES_DB=identity_db -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=<temporary-local-password> -p 55433:5432 -d postgres:16-alpine
docker exec venta-pasajes-identity-auth-pg-<pid> pg_isready -U postgres -d identity_db
java -jar C:\VENTA-DE-PASAJES\services\identity-service\target\quarkus-app\quarkus-run.jar
Invoke-RestMethod -Uri http://localhost:18082/q/health/ready
Invoke-RestMethod -Uri http://localhost:18082/api/v1/identity/auth/local/login -Method Post -Body <redacted-json>
Invoke-RestMethod -Uri http://localhost:18082/api/v1/identity/me -Headers @{Authorization="Bearer <redacted-token>"}
Invoke-RestMethod -Uri http://localhost:18082/api/v1/identity/permissions -Headers @{Authorization="Bearer <redacted-token>"}
Invoke-RestMethod -Uri http://localhost:18082/api/v1/identity/password/forgot -Method Post -Body <redacted-json>
Invoke-RestMethod -Uri http://localhost:18082/api/v1/identity/password/reset -Method Post -Body <redacted-json>
docker stop venta-pasajes-identity-auth-pg-<pid>
```

## Resultados

```text
Tests run: 14, Failures: 0, Errors: 0, Skipped: 0
```

```text
BUILD SUCCESS
```

```json
{"service":"identity-service","quarkus_profile":"onprem","secrets_provider":"env","database":"identity_db","migration_tool":"flyway","database_port":55433,"http_port":18082,"bootstrap_admin_login":"admin","token_returned":true,"roles_count":2,"permissions_count":8,"users_count":1,"password_recovery_verified":true,"container":"venta-pasajes-identity-auth-pg-<pid>","ready":true}
```

```json
{"service":"identity-service","quarkus_profile":"onprem","secrets_provider":"env","database":"identity_db","migration_tool":"flyway","database_port":55432,"http_port":18081,"health_ready":"UP","container":"venta-pasajes-identity-pg-<pid>","ready":true}
```

## Ajustes durante validacion

- Primera corrida de pruebas detecto que `POST /auth/logout` respondia `415` si no llegaba `Content-Type`; se corrigio con `@Consumes(MediaType.WILDCARD)`.
- Primera corrida end-to-end detecto que `APP_GOOGLE_CLIENT_IDS` vacio impedia arrancar Quarkus; se definio placeholder local configurable.
- La prueba end-to-end detecto un `ORDER BY` incompatible con `SELECT DISTINCT` sobre `citext`; se corrigio ordenando por alias.

## Estado

- Criterio de avance del Dia 18 cumplido.
- No se guardaron secretos reales, contrasenas, access tokens ni peppers en el repositorio ni en la bitacora.
- Pendiente futuro: si se requiere invalidar JWT inmediatamente al hacer logout, agregar tabla de sesiones/revocacion o usar refresh tokens persistentes.
