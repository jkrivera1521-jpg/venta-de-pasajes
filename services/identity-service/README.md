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
POST /api/v1/identity/password/forgot
POST /api/v1/identity/password/reset
GET /api/v1/identity/me
GET /api/v1/identity/users
POST /api/v1/identity/users
GET /api/v1/identity/roles
GET /api/v1/identity/permissions
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
APP_GOOGLE_DEFAULT_ROLE_CODE
APP_PUBLIC_DEFAULT_ROLE_CODE
APP_AUTH_RECOVERY_RESET_URL
APP_GMAIL_ENABLED
APP_GMAIL_CLIENT_ID
APP_GMAIL_CLIENT_SECRET
APP_GMAIL_REFRESH_TOKEN
APP_GMAIL_SENDER_EMAIL
```

En on-premise/offline debe leer variables de entorno o un archivo local seguro fuera del repositorio:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-identity-service-onprem.ps1 `
  -EnvFile C:\VENTA-DE-PASAJES-RUNTIME\identity-service.env `
  -MigrateAtStart
```

Las variables sensibles nunca deben quedar en `.env`, `application.properties` ni archivos de notas.

## Guia ampliada de arquitectura y operacion local

Esta seccion documenta el comportamiento real del servicio y complementa el resumen inicial.

### Responsabilidades

- Autenticacion local con usuario y contrasena.
- Registro publico de cuentas locales con rol CUSTOMER.
- Intercambio de Google ID tokens por JWT internos.
- Emision, renovacion y revocacion de sesiones centrales.
- Control de acceso por roles y permisos.
- Administracion de usuarios internos, perfiles y estados.
- Administracion de roles y catalogo de permisos.
- Menu dinamico recursivo, autorizacion por rol y nodos informativos.
- Avatar y preferencia de modo oscuro.
- Recuperacion de contrasena y acceso temporal.
- Persistencia de eventos en una tabla outbox.
- Health checks, OpenAPI, Swagger UI y logs configurables.

### Estructura del modulo

~~~text
services/identity-service/
  pom.xml
  README.md
  src/main/java/com/ventapasajes/identity/
    api/          Recursos REST, DTO, errores y OpenAPI
    auth/         Bearer filter, JWT, Google y hash de contrasenas
    domain/       Enumeraciones de usuario, rol e identidad
    health/       Liveness y readiness
    persistence/  Entidades Panache y auditoria
    service/      Casos de uso, bootstrap, sesiones y Gmail
  src/main/resources/
    application.properties
    db/migration/ Migraciones Flyway V1..V17
  src/test/java/  Pruebas REST, seguridad, migraciones y perfiles
~~~

| Elemento | Valor |
| --- | --- |
| Framework | Quarkus 3.25.2 |
| Java | 21 |
| Persistencia | Hibernate ORM Panache |
| Base de datos | PostgreSQL |
| Migraciones | Flyway V1 a V17 |
| Puerto HTTP local | 8081 |
| Base local | identity_db |
| Puerto PostgreSQL local | 55432 |
| JWT | HS256 |
| OpenAPI | /q/openapi |
| Swagger UI | /q/swagger-ui |

Hibernate no crea ni modifica el esquema. La propiedad quarkus.hibernate-orm.schema-management.strategy=none deja esa responsabilidad en Flyway.

+
## Diagramas Mermaid

Los siguientes diagramas resumen los flujos principales. El codigo fuente y la configuracion del servicio siguen siendo la fuente de verdad.

### Arquitectura del servicio

~~~mermaid
flowchart LR
    Browser["Shell y MFEs"] -->|Bearer JWT| API["identity-service<br/>Quarkus :8081"]
    API --> ORM["Hibernate ORM Panache"]
    ORM --> DB[("PostgreSQL<br/>identity_db")]
    API --> Flyway["Flyway<br/>V1..V17"]
    API --> JWKS["Google JWKS<br/>solo login Google"]
    API --> Gmail["Gmail API<br/>solo recuperacion"]
    API --> Outbox[("outbox_events")]
    API --> Health["Health / OpenAPI / Swagger"]
~~~

### Arranque local dockerizado

~~~mermaid
sequenceDiagram
    participant P as PowerShell
    participant D as Docker
    participant DB as PostgreSQL
    participant B as identity-service

    P->>D: Iniciar venta-pasajes-identity-db
    D->>DB: PostgreSQL en red venta-pasajes-local
    P->>D: Construir identity-service:local
    P->>D: Ejecutar contenedor en puerto 8081
    B->>DB: JDBC a venta-pasajes-identity-db:5432/identity_db
    B->>DB: Ejecutar migraciones Flyway
    P->>B: GET /q/health/ready
    B-->>P: status UP
~~~

### Flujo de autenticacion local

~~~mermaid
sequenceDiagram
    participant C as Cliente o MFE
    participant API as identity-service
    participant DB as PostgreSQL
    participant JWT as JwtService

    C->>API: POST /auth/local/login
    API->>DB: Buscar usuario y credencial
    API->>API: Verificar password y estado
    API->>DB: Crear identity_session
    API->>JWT: Firmar token HS256
    JWT-->>API: Access token
    API-->>C: AuthTokenResponse

    C->>API: Request protegido con Bearer
    API->>JWT: Verificar firma, issuer y expiracion
    API->>DB: Validar sesion y permisos
    API-->>C: Respuesta autorizada
~~~

### Decision de autorizacion

~~~mermaid
flowchart TD
    Request["Request HTTP"] --> Public{"Endpoint publico?"}
    Public -->|Si| Execute["Ejecutar recurso"]
    Public -->|No| Header{"Bearer presente?"}
    Header -->|No| Unauthorized["401 UNAUTHORIZED"]
    Header -->|Si| Verify["Validar JWT HS256"]
    Verify -->|Invalido o expirado| Invalid["401 INVALID_TOKEN"]
    Verify -->|Valido| Session{"Sesion activa?"}
    Session -->|No| Revoked["401 SESSION_REVOKED"]
    Session -->|Si| Permission{"Tiene permiso requerido?"}
    Permission -->|No| Forbidden["403 FORBIDDEN"]
    Permission -->|Si| Execute
~~~

### Relacion de contenedores

~~~mermaid
flowchart TB
    subgraph Docker["Docker Desktop"]
        DB["venta-pasajes-identity-db<br/>PostgreSQL :5432"]
        API["venta-pasajes-identity-service<br/>Quarkus :8081"]
        DB --- Network["venta-pasajes-local"]
        API --- Network
    end

    Host["Windows host"] -->|localhost:55432| DB
    Host -->|localhost:8081| API
    API -->|JDBC interno<br/>venta-pasajes-identity-db:5432| DB
~~~


## Levantar PostgreSQL local dockerizado

Configuracion local predeterminada:

~~~text
Host:     localhost
Port:     55432
Database: identity_db
User:     identity_user
Password: IdentityLocal_ChangeMe_12345
JDBC:     jdbc:postgresql://localhost:55432/identity_db
~~~

La contrasena es solo para desarrollo local. Cambiala en ambientes compartidos y nunca la uses como secreto de produccion.

### Contenedor persistente recomendado

~~~powershell
docker volume create venta-pasajes-identity-pgdata
docker run -d --name venta-pasajes-identity-db --restart unless-stopped -e POSTGRES_DB=identity_db -e POSTGRES_USER=identity_user -e POSTGRES_PASSWORD=IdentityLocal_ChangeMe_12345 -p 55432:5432 -v venta-pasajes-identity-pgdata:/var/lib/postgresql/data postgres:16-alpine
~~~

Comprobar disponibilidad:

~~~powershell
docker exec venta-pasajes-identity-db pg_isready -U identity_user -d identity_db
~~~

Operaciones utiles:

~~~powershell
docker ps --filter "name=venta-pasajes-identity-db"
docker logs -f venta-pasajes-identity-db
docker stop venta-pasajes-identity-db
docker start venta-pasajes-identity-db
docker exec -it venta-pasajes-identity-db psql -U identity_user -d identity_db
~~~

Eliminar solo el contenedor y conservar los datos:

~~~powershell
docker rm -f venta-pasajes-identity-db
~~~

Eliminar tambien los datos locales, solo de forma intencional:

~~~powershell
docker volume rm venta-pasajes-identity-pgdata
~~~

Si el contenedor ya existe, no ejecutes otro docker run; usa docker start y vuelve a comprobar pg_isready.

### PostgreSQL temporal para validacion

El script oficial crea un contenedor temporal con postgres:16-alpine, genera el password, aplica Flyway, arranca el JAR JVM en el puerto 18081, valida readiness y detiene el contenedor:

~~~powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-identity-service-local-db.ps1
~~~

Valores predeterminados: PostgreSQL 55432, servicio 18081, base identity_db, usuario postgres y contenedor venta-pasajes-identity-pg-<PID>. Se pueden cambiar:

~~~powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-identity-service-local-db.ps1 -DatabasePort 55440 -HttpPort 18090
~~~

No uses esta opcion al mismo tiempo que el contenedor persistente en el puerto 55432.

## Arrancar identity-service en desarrollo

### Quarkus dev mode

Con PostgreSQL persistente iniciado, ejecuta desde C:\VENTA-DE-PASAJES:

~~~powershell
$env:QUARKUS_PROFILE = "onprem"
$env:APP_ENV = "local"
$env:APP_RUNTIME_TARGET = "onprem"
$env:APP_SECRETS_PROVIDER = "env"
$env:APP_DB_NAME = "identity_db"
$env:APP_DB_JDBC_URL = "jdbc:postgresql://localhost:55432/identity_db"
$env:APP_DB_USERNAME = "identity_user"
$env:APP_DB_PASSWORD = "IdentityLocal_ChangeMe_12345"
$env:APP_JWT_SIGNING_SECRET = "local-dev-jwt-signing-secret-change-me-32-bytes"
$env:APP_PASSWORD_PEPPER = "local-dev-password-pepper-change-me"
$env:APP_RECOVERY_TOKEN_PEPPER = "local-dev-recovery-token-pepper-change-me"
$env:APP_REFRESH_TOKEN_PEPPER = "local-dev-refresh-token-pepper-change-me"
$env:QUARKUS_FLYWAY_MIGRATE_AT_START = "true"
$env:APP_LOG_CONSOLE_JSON = "false"
mvn -f .\services\identity-service\pom.xml quarkus:dev
~~~

El servicio queda disponible en http://localhost:8081. En perfil dev Flyway migra al iniciar.

### Arranque desde JAR

~~~powershell
mvn -f .\services\identity-service\pom.xml package -DskipTests
~~~

El artefacto ejecutable queda en services/identity-service/target/quarkus-app/quarkus-run.jar.

Para usar el script on-premise:

1. Copia infra/env/identity-service.onprem.env.example a C:\VENTA-DE-PASAJES-RUNTIME\identity-service.env.
2. Completa las variables fuera del repositorio.
3. Ejecuta:

~~~powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-identity-service-onprem.ps1 -EnvFile C:\VENTA-DE-PASAJES-RUNTIME\identity-service.env -MigrateAtStart
~~~

El script exige APP_DB_JDBC_URL, APP_DB_USERNAME y APP_DB_PASSWORD, salvo que se use AllowEmptyDbPassword. Establece por defecto el perfil onprem y el puerto 8081.

+
## Levantar identity-service local dockerizado

Esta opcion ejecuta el servicio dentro de Docker y lo conecta al PostgreSQL persistente creado en la seccion anterior.

La direccion de la base depende del lugar desde donde se ejecuta:

~~~text
Desde PowerShell o Java en Windows:
jdbc:postgresql://localhost:55432/identity_db

Desde un contenedor Docker conectado a la misma red:
jdbc:postgresql://venta-pasajes-identity-db:5432/identity_db
~~~

Dentro del contenedor no se debe usar localhost para llegar al contenedor de PostgreSQL.

### 1. Iniciar y comprobar PostgreSQL

~~~powershell
docker start venta-pasajes-identity-db
docker exec venta-pasajes-identity-db pg_isready -U identity_user -d identity_db
~~~

### 2. Crear una red Docker compartida

Ejecuta la creacion de la red una sola vez:

~~~powershell
docker network create venta-pasajes-local
~~~

Conecta el contenedor de PostgreSQL existente a esa red:

~~~powershell
docker network connect venta-pasajes-local venta-pasajes-identity-db
~~~

Si Docker informa que la red o la conexion ya existen, el paso ya fue realizado. Comprueba la red con:

~~~powershell
docker network inspect venta-pasajes-local
~~~

### 3. Empaquetar el servicio JVM

Desde C:\VENTA-DE-PASAJES:

~~~powershell
mvn -f .\services\identity-service\pom.xml package -DskipTests
~~~

Debe existir el directorio services/identity-service/target/quarkus-app.

### 4. Construir la imagen Docker

El proyecto contiene la imagen generica JVM en infra/docker/Dockerfile.quarkus-jvm. El contexto de build debe ser el directorio del servicio porque alli esta target/quarkus-app:

~~~powershell
docker build --pull -f .\infra\docker\Dockerfile.quarkus-jvm -t identity-service:local .\services\identity-service
~~~

### 5. Ejecutar identity-service conectado a PostgreSQL

~~~powershell
docker run -d --name venta-pasajes-identity-service --restart unless-stopped --network venta-pasajes-local -p 8081:8081 -e QUARKUS_PROFILE=onprem -e QUARKUS_HTTP_HOST=0.0.0.0 -e QUARKUS_HTTP_PORT=8081 -e APP_ENV=onprem -e APP_RUNTIME_TARGET=onprem -e APP_SECRETS_PROVIDER=env -e APP_DB_NAME=identity_db -e APP_DB_JDBC_URL=jdbc:postgresql://venta-pasajes-identity-db:5432/identity_db -e APP_DB_USERNAME=identity_user -e APP_DB_PASSWORD=IdentityLocal_ChangeMe_12345 -e QUARKUS_FLYWAY_MIGRATE_AT_START=true -e APP_JWT_SIGNING_SECRET=local-dev-jwt-signing-secret-change-me-32-bytes -e APP_PASSWORD_PEPPER=local-dev-password-pepper-change-me -e APP_RECOVERY_TOKEN_PEPPER=local-dev-recovery-token-pepper-change-me -e APP_REFRESH_TOKEN_PEPPER=local-dev-refresh-token-pepper-change-me -e APP_LOG_CONSOLE_JSON=false identity-service:local
~~~

La imagen generica declara 8080 como metadata, pero el servicio se configura explicitamente en 8081 y se publica con 8081:8081.

### 6. Verificar el contenedor

~~~powershell
docker ps --filter "name=venta-pasajes-identity-service"
docker logs -f venta-pasajes-identity-service
Invoke-RestMethod -Uri http://localhost:8081/q/health/ready
Invoke-RestMethod -Uri http://localhost:8081/api/v1/identity/health
~~~

El readiness debe devolver estado UP. En el primer arranque, Flyway crea y actualiza identity_db usando las migraciones del servicio.

### Bootstrap opcional del administrador

Si se necesita crear un administrador local desde el primer arranque, agrega estas variables al comando docker run:

~~~text
-e APP_BOOTSTRAP_ADMIN_ENABLED=true
-e APP_BOOTSTRAP_ADMIN_LOGIN=admin
-e APP_BOOTSTRAP_ADMIN_EMAIL=admin@local.test
-e APP_BOOTSTRAP_ADMIN_DISPLAY_NAME=Administrador Local
-e APP_BOOTSTRAP_ADMIN_PASSWORD=AdminLocal_ChangeMe_12345
~~~

Deshabilita el bootstrap despues de inicializar el ambiente compartido y cambia los valores locales de ejemplo.

### Detener, iniciar y actualizar

~~~powershell
docker stop venta-pasajes-identity-service
docker start venta-pasajes-identity-service
docker logs -f venta-pasajes-identity-service
~~~

Para actualizar la imagen despues de cambiar el codigo:

~~~powershell
mvn -f .\services\identity-service\pom.xml package -DskipTests
docker build --pull -f .\infra\docker\Dockerfile.quarkus-jvm -t identity-service:local .\services\identity-service
docker rm -f venta-pasajes-identity-service
~~~

Despues de eliminar el contenedor, ejecuta nuevamente el comando docker run de esta seccion. El volumen de PostgreSQL no se elimina y los datos permanecen.

### Alternativa sin red compartida

Si no se desea conectar PostgreSQL a una red Docker, el contenedor puede alcanzar el puerto publicado del host mediante host.docker.internal:

~~~text
APP_DB_JDBC_URL=jdbc:postgresql://host.docker.internal:55432/identity_db
~~~

En ese caso elimina la opcion network del comando docker run y usa esa URL. La opcion recomendada es la red compartida.

## Bootstrap de administrador local

El bootstrap esta desactivado por defecto. Para crear o asegurar un administrador durante el arranque:

~~~powershell
$env:APP_BOOTSTRAP_ADMIN_ENABLED = "true"
$env:APP_BOOTSTRAP_ADMIN_LOGIN = "admin"
$env:APP_BOOTSTRAP_ADMIN_EMAIL = "admin@local.test"
$env:APP_BOOTSTRAP_ADMIN_DISPLAY_NAME = "Administrador Local"
$env:APP_BOOTSTRAP_ADMIN_PASSWORD = "AdminLocal_ChangeMe_12345"
~~~

El bootstrap no se ejecuta si falta login o password. Deshabilitalo despues de inicializar un ambiente compartido. La contrasena requiere al menos 12 caracteres.

## Verificacion rapida

~~~powershell
Invoke-RestMethod -Uri http://localhost:8081/api/v1/identity/health
Invoke-RestMethod -Uri http://localhost:8081/q/health
Invoke-RestMethod -Uri http://localhost:8081/q/health/live
Invoke-RestMethod -Uri http://localhost:8081/q/health/ready
~~~

La aplicacion no habilita Dev Services automaticamente porque quarkus.datasource.devservices.enabled=false; PostgreSQL debe estar disponible por Docker o por una instalacion externa.

## Catalogo completo de endpoints

La base funcional es /api/v1/identity. Los endpoints publicos no requieren token. Los demas usan:

~~~http
Authorization: Bearer <access_token>
~~~

### Salud y autenticacion

| Metodo | Ruta | Acceso | Funcion |
| --- | --- | --- | --- |
| GET | /health | Publico | Estado basico. |
| POST | /auth/local/login | Publico | Login local con login, password y force. |
| POST | /auth/local/register | Publico | Registro local publico. |
| POST | /auth/google/exchange | Publico | Google ID token a JWT interno. |
| POST | /auth/logout | Autenticado | Revoca todas las sesiones. |
| POST | /auth/logout/current | Autenticado | Revoca la sesion actual. |
| POST | /auth/refresh | Autenticado | Renueva el token. |
| POST | /password/forgot | Publico | Solicita recuperacion. |
| POST | /password/login | Publico | Login con token temporal. |
| POST | /password/reset | Publico | Cambia password con token temporal. |

### Perfil y sesiones

| Metodo | Ruta | Permiso |
| --- | --- | --- |
| GET | /me | Autenticado |
| PATCH | /me/avatar | Autenticado |
| PATCH | /me/theme | Autenticado |
| GET | /sessions | identity.sessions.read |
| POST | /sessions/{sessionId}/revoke | identity.sessions.revoke |
| POST | /users/{userId}/logout | identity.sessions.revoke |

### Menu dinamico

| Metodo | Ruta | Permiso |
| --- | --- | --- |
| GET | /menu | Autenticado |
| GET | /menu/admin | identity.menu.read |
| POST | /menu | identity.menu.manage |
| PATCH | /menu/{menuItemId} | identity.menu.manage |
| DELETE | /menu/{menuItemId} | identity.menu.manage |

El menu usa parent_id, sort_order, role_ids, target_url, manifest_url e informational_only. Los nodos informativos no deben navegar. La migracion actual permite menu recursivo.

### Usuarios internos

| Metodo | Ruta | Permiso |
| --- | --- | --- |
| GET | /users | identity.users.read |
| POST | /users | identity.users.write |
| GET | /users/{userId} | identity.users.read |
| PATCH | /users/{userId} | identity.users.write |
| PUT | /users/{userId}/roles | identity.roles.manage |
| POST | /users/{userId}/activate | identity.users.status |
| POST | /users/{userId}/suspend | identity.users.status |

Modificar roles mediante PATCH /users/{userId} requiere ademas identity.roles.manage. Los estados de usuario son ACTIVE, SUSPENDED, LOCKED, RETIRED y PENDING_ACTIVATION.

### Roles y permisos

| Metodo | Ruta | Permiso |
| --- | --- | --- |
| GET | /roles | identity.roles.read |
| POST | /roles | identity.roles.manage |
| PATCH | /roles/{roleId} | identity.roles.manage |
| PUT | /roles/{roleId} | identity.roles.manage |
| DELETE | /roles/{roleId} | identity.roles.manage |
| GET | /permissions | identity.permissions.read |

El rol ADMIN esta protegido. No puede desactivarse ni eliminarse; el borrado de otros roles es logico.

### Error estandar

~~~json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "The authenticated user lacks the required permission.",
    "details": null
  }
}
~~~

Codigos frecuentes: 200 consulta o actualizacion, 201 creacion, 202 recuperacion aceptada, 204 revocacion o eliminacion, 400 validacion, 401 autenticacion, 403 permisos, 404 inexistente, 409 conflicto y 502 fallo con Google o Gmail.

## Seguridad implementada

### JWT interno

- Firma HS256 con APP_JWT_SIGNING_SECRET.
- El secreto debe tener al menos 32 bytes.
- Incluye issuer, audience, usuario, sesion, login, email, nombre, roles, permisos, iat y exp.
- Cada request protegido valida tambien identity_sessions.
- Revocar una sesion invalida sus tokens.
- TTL predeterminado: 3600 segundos.

### Contrasenas

- PBKDF2WithHmacSHA256.
- Salt aleatorio de 16 bytes y clave derivada de 256 bits.
- 210000 iteraciones por defecto.
- Pepper externo en APP_PASSWORD_PEPPER.
- Minimo de 12 caracteres.
- Bloqueo por intentos fallidos configurable.

### Google y Gmail

Google valida issuer, audience, expiracion, email verificado y firma RS256 usando el JWKS configurado:

~~~text
APP_GOOGLE_CLIENT_IDS
APP_GOOGLE_ALLOWED_ISSUERS
APP_GOOGLE_JWKS_URL
APP_GOOGLE_SIGNATURE_REQUIRED
APP_GOOGLE_DEV_TOKEN_ENABLED
APP_GOOGLE_DEFAULT_ROLE_CODE
~~~

El token dev-google: solo debe habilitarse en pruebas locales controladas. Gmail esta deshabilitado por defecto y requiere APP_GMAIL_ENABLED, client ID, client secret, refresh token y sender email.

Los tokens de recuperacion son de un solo uso, se almacenan como hash y expiran. Variables asociadas: APP_RECOVERY_TOKEN_PEPPER, APP_REFRESH_TOKEN_PEPPER, APP_AUTH_RECOVERY_TOKEN_TTL_MINUTES, APP_AUTH_RECOVERY_RETURN_TOKEN_ENABLED y APP_AUTH_RECOVERY_RESET_URL.

## Base de datos y migraciones

La migracion inicial crea las extensiones pgcrypto y citext, y estas tablas:

~~~text
users
local_credentials
google_identities
internal_profiles
roles
permissions
role_permissions
user_roles
password_reset_tokens
login_attempts
identity_sessions
menu_items
menu_item_roles
outbox_events
flyway_schema_history
~~~

| Version | Cambio |
| --- | --- |
| V1 | Esquema inicial, roles y permisos base. |
| V2 | Auditoria de identidades Google. |
| V3 | Ciclo de vida de roles. |
| V4 | Rol CUSTOMER para Google. |
| V5 | Elimina identidad hibrida y exige email. |
| V6 | Proposito de tokens de recuperacion. |
| V7 | Elimina identidades autorizadas obsoletas. |
| V8 | Sesiones centrales. |
| V9 | Nombre de dispositivo de sesion. |
| V10 | Menu dinamico y permisos de menu. |
| V11 | Menu recursivo. |
| V12 | Elimina restriccion de profundidad heredada. |
| V13 | Nodos informativos. |
| V14 | Avatar. |
| V15 | Preferencia de modo oscuro. |
| V16 | Permisos de AviatorScript. |
| V17 | Permisos de report-service. |

No edites una migracion aplicada. Para el siguiente cambio crea una nueva version, por ejemplo V18__descripcion.sql.

## Variables y perfiles

Variables principales:

~~~text
QUARKUS_PROFILE
QUARKUS_HTTP_PORT
APP_ENV
APP_RUNTIME_TARGET
APP_SECRETS_PROVIDER
APP_DB_NAME
APP_DB_JDBC_URL
APP_DB_USERNAME
APP_DB_PASSWORD
QUARKUS_FLYWAY_MIGRATE_AT_START
APP_LOG_CONSOLE_JSON
APP_JWT_SIGNING_SECRET
APP_PASSWORD_PEPPER
APP_RECOVERY_TOKEN_PEPPER
APP_REFRESH_TOKEN_PEPPER
~~~

Perfiles:

| Perfil | Uso |
| --- | --- |
| dev | Desarrollo Quarkus; Flyway migra al inicio. |
| test | Pruebas automatizadas y configuracion aislada. |
| onprem | PostgreSQL local o red privada; secretos por entorno. |
| gcp | Cloud SQL, socket factory y Secret Manager en despliegue. |

Usa infra/env/identity-service.onprem.env.example como plantilla local y infra/env/identity-service.gcp.env.example para GCP. Los archivos reales con secretos deben vivir fuera del repositorio, por ejemplo en C:\VENTA-DE-PASAJES-RUNTIME.

## Pruebas y empaquetado

~~~powershell
mvn -f .\services\identity-service\pom.xml test
mvn -f .\services\identity-service\pom.xml package -DskipTests
~~~

Las pruebas cubren contratos REST, health, Google ID tokens, JWT, hash de contrasenas, migraciones y perfiles. Las verificaciones especializadas son:

~~~powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-identity-service-local-db.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-identity-auth-local.ps1
~~~

El segundo script valida autenticacion local, JWT, permisos y recuperacion contra PostgreSQL temporal. Genera secretos al vuelo y no imprime contrasenas ni tokens.

## Integracion con el shell

El shell espera por defecto:

~~~text
http://localhost:8081/api/v1/identity
~~~

El MFE de identidad se sirve normalmente en http://localhost:3001 y su manifest en:

~~~text
http://localhost:3001/mfe/manifest
~~~

El frontend debe enviar el JWT interno como Bearer token. El menu de /menu devuelve las opciones autorizadas por rol.

## Diagnostico rapido

### No conecta a PostgreSQL

1. Comprueba Docker Desktop.
2. Comprueba el contenedor y pg_isready.
3. Verifica que APP_DB_JDBC_URL, APP_DB_USERNAME y APP_DB_PASSWORD coincidan.
4. Verifica que 55432 no este ocupado.
5. Revisa docker logs y la salida de Quarkus.

### Flyway falla

- Revisa flyway_schema_history y la primera migracion fallida.
- No modifiques migraciones ya aplicadas.
- En una base local descartable, elimina el volumen y vuelve a crear el contenedor.
- No uses baseline-on-migrate para ocultar una base inconsistente.

### Login devuelve 401 o endpoint devuelve 403

Verifica login, password, estado del usuario, secreto JWT, expiracion de token y revocacion de sesion. Un 403 significa que el token es valido pero no tiene el permiso requerido; revisa la asignacion de roles.

### Google o Gmail falla

Google requiere client ID autorizado, issuer confiable, email verificado y firma valida. Gmail requiere APP_GMAIL_ENABLED=true y credenciales OAuth completas. En local ambos pueden permanecer deshabilitados.

## Reglas operativas

- No guardar secretos, tokens ni contrasenas en el repositorio.
- No usar valores locales de ejemplo en produccion.
- No imprimir secretos en logs.
- No ejecutar dos instancias en el puerto 8081.
- No ejecutar PostgreSQL temporal y persistente simultaneamente en 55432.
- Crear una nueva migracion Flyway por cada cambio de esquema.
- Proteger los endpoints administrativos con autenticacion y permisos.
