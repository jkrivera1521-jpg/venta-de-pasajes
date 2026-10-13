# audit-service

Servicio Quarkus de auditoria funcional del sistema Venta de Pasajes.

## Responsabilidad

- Registrar eventos auditables de forma append-only.
- Deduplicar eventos por `source_service + event_id`.
- Consultar auditoria por fecha, actor, recurso, accion y correlation ID.
- Exponer eventos para integraciones administrativas y futuras pantallas de `mfe-admin`.

## Endpoints

```text
GET  /api/v1/audit
GET  /api/v1/audit/resources
GET  /api/v1/audit/health
POST /api/v1/audit/audit-events
GET  /api/v1/audit/audit-events
GET  /api/v1/audit/audit-events/{eventId}
GET  /q/health
GET  /q/openapi
GET  /q/swagger-ui
```

## Ejecucion local

```powershell
cd C:\VENTA-DE-PASAJES
mvn -f .\services\audit-service\pom.xml test
```

Para una validacion con PostgreSQL temporal:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-audit-service-local.ps1
```
