# On-premise/offline runbook

Fecha: 2026-09-02

## Objetivo

Permitir que el sistema Venta de Pasajes pueda ejecutarse en un ambiente local/on-premise sin depender de Google Cloud ni de Google Secret Manager.

## Regla principal

El codigo no debe depender de un unico proveedor de secretos.

| Entorno | Proveedor recomendado |
| --- | --- |
| Local desarrollo | Variables de entorno o archivo `.env` local ignorado por Git |
| Google Cloud dev/staging/prod | Google Secret Manager |
| On-premise/offline | Variables de entorno, archivo local protegido, Docker secrets, Kubernetes secrets o Vault |

Los secretos reales nunca se guardan en el repositorio.

## Perfiles Quarkus

Los servicios backend usan perfiles:

| Perfil | Uso |
| --- | --- |
| `gcp` | Runtime en Google Cloud. Defaults orientados a Cloud SQL IAM y Secret Manager. |
| `onprem` | Runtime offline/on-premise. Defaults orientados a PostgreSQL local/red privada y variables `APP_DB_*`. |
| `test` | Pruebas automatizadas sin dependencia obligatoria de PostgreSQL externo. |

## Variables backend comunes

```text
QUARKUS_PROFILE=onprem
APP_ENV=onprem
APP_RUNTIME_TARGET=onprem
APP_SECRETS_PROVIDER=env
APP_DB_NAME=identity_db
APP_DB_JDBC_URL=jdbc:postgresql://localhost:5432/identity_db
APP_DB_USERNAME=identity_user
APP_DB_PASSWORD=<set-outside-repository>
APP_LOG_CONSOLE_JSON=false
APP_JWT_SIGNING_SECRET=<set-outside-repository>
APP_PASSWORD_PEPPER=<set-outside-repository>
APP_RECOVERY_TOKEN_PEPPER=<set-outside-repository>
```

Para `identity-service`, usar como plantilla:

```text
C:\VENTA-DE-PASAJES\infra\env\identity-service.onprem.env.example
```

Crear el archivo real fuera del repositorio, por ejemplo:

```text
C:\VENTA-DE-PASAJES-RUNTIME\identity-service.env
```

Ese archivo real puede contener contrasenas y claves, pero no debe copiarse a Git.

## Arranque on-premise de identity-service

Empaquetar:

```powershell
mvn -f .\services\identity-service\pom.xml package -DskipTests
```

Arrancar usando archivo de entorno externo:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-identity-service-onprem.ps1 `
  -EnvFile C:\VENTA-DE-PASAJES-RUNTIME\identity-service.env `
  -MigrateAtStart
```

Verificar:

```powershell
Invoke-RestMethod -Uri http://localhost:8081/q/health/ready
Invoke-RestMethod -Uri http://localhost:8081/api/v1/identity/health
```

## Verificacion automatica local

Este comando no usa Google Cloud. Levanta PostgreSQL temporal en Docker, arranca `identity-service` con `QUARKUS_PROFILE=onprem`, aplica Flyway y valida readiness:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-identity-service-local-db.ps1
```

Resultado esperado:

```json
{"service":"identity-service","quarkus_profile":"onprem","secrets_provider":"env","database":"identity_db","health_ready":"UP","ready":true}
```

Para validar autenticacion local, JWT interno, permisos y recuperacion de contrasena contra PostgreSQL temporal:

```powershell
mvn -f .\services\identity-service\pom.xml package -DskipTests
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-identity-auth-local.ps1
```

Resultado esperado:

```json
{"service":"identity-service","quarkus_profile":"onprem","secrets_provider":"env","database":"identity_db","token_returned":true,"permissions_count":8,"password_recovery_verified":true,"ready":true}
```

## Google Cloud sigue soportado

Para GCP se usa:

```text
QUARKUS_PROFILE=gcp
APP_RUNTIME_TARGET=gcp
APP_SECRETS_PROVIDER=google-secret-manager
APP_DATABASE_SECRET_NAME=identity-service__db-connection
```

Plantilla:

```text
C:\VENTA-DE-PASAJES\infra\env\identity-service.gcp.env.example
```

## Decision de arquitectura

Desde este punto, Secret Manager no se trata como dependencia universal del aplicativo. Es solo el proveedor de secretos del runtime GCP.

La regla para nuevo codigo sera:

- Leer configuracion desde propiedades/variables de entorno.
- Encapsular lectura de secretos detras de una interfaz de aplicacion.
- Implementar proveedor GCP solo para despliegues cloud.
- Implementar proveedor `env`/archivo local para on-premise.
- No imprimir secretos en logs, bitacoras ni errores.
- Usar autenticacion local cuando el despliegue on-premise no tenga salida a Google.

## Pendientes tecnicos

- Crear scripts equivalentes para los demas servicios cuando se generen.
- Definir instalacion como Windows Service, Docker Compose o Kubernetes on-premise segun infraestructura final.
- Agregar revocacion persistente de sesiones si se decide invalidar JWT antes de su expiracion.
