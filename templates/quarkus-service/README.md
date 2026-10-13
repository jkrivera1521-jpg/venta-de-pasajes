# Plantilla Quarkus Service

La plantilla de codigo para microservicios Quarkus vive en:

```text
services/quarkus-service-template
```

El generador reutilizable vive en:

```text
scripts/new-quarkus-service.ps1
```

## Uso recomendado

Primero validar en modo seco:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\new-quarkus-service.ps1 `
  -ServiceName catalog-service `
  -PackageSegment catalog `
  -DatabaseName catalog_db `
  -HttpPort 8087 `
  -DryRun
```

Crear solo si el servicio no existe o solo contiene `.gitkeep`:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\new-quarkus-service.ps1 `
  -ServiceName catalog-service `
  -PackageSegment catalog `
  -DatabaseName catalog_db `
  -HttpPort 8087
```

## Incluye

- Quarkus 3.25.2 con Java 21.
- REST, OpenAPI, health checks y logs JSON.
- PostgreSQL JDBC, Panache y Flyway.
- Perfiles `gcp` y `onprem`.
- Tests base.

## Despues de crear

- Agregar DDL en `docs/database` y migracion Flyway real.
- Agregar contrato OpenAPI en `docs/openapi`.
- Agregar config Cloud Run en `infra/cloudrun/dev-services.json` y `infra/cloudrun/prod-backend-services.json`.
- Agregar build/verify script si el modulo tiene validaciones especiales.
- Registrar el servicio en `services/README.md`, `README.md` y `vitacora.md`.
