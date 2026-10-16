# Services

Backend workspace for Quarkus microservices.

## Modules

- `identity-service`
- `dispatch-service`
- `ticketing-service`
- `document-service`
- `reporting-service`
- `audit-service`
- `aviatorscript-service`
- `quarkus-service-template` (plantilla reusable para microservicios Quarkus)
- `toolchain-demo-service` (solo validacion local de Dia 10; no es modulo funcional)

Each service owns its database, exposes OpenAPI and publishes/consumes events according to `docs/events`. `aviatorscript-service` owns the `aviatorscript_db` database and the `calculos` schema for versioned formulas and calculation executions.

## Crear servicios backend

Usar la plantilla con:

```powershell
.\scripts\new-quarkus-service.ps1 `
  -ServiceName identity-service `
  -PackageSegment identity `
  -DatabaseName identity_db `
  -HttpPort 8081
```
