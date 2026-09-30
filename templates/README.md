# Templates reutilizables

Este directorio es el punto de entrada para crear modulos nuevos sin copiar decisiones tecnicas a mano.

## Plantillas disponibles

- `templates/quarkus-service`: referencia operacional para microservicios Quarkus usando `services/quarkus-service-template` y `scripts/new-quarkus-service.ps1`.
- `templates/next-mfe`: plantilla base para microfrontends Next.js con manifest, health, ruta embedded, provider TanStack Query y proxy server-side hacia backend.

## Regla de uso

Antes de crear un modulo real, ejecutar siempre el modo seco del generador correspondiente y validar rutas:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\new-quarkus-service.ps1 `
  -ServiceName catalog-service `
  -PackageSegment catalog `
  -DatabaseName catalog_db `
  -HttpPort 8087 `
  -DryRun

powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\new-next-mfe.ps1 `
  -MfeName mfe-catalog `
  -PackageSegment catalog `
  -Title "Catalogos" `
  -LocalPort 3006 `
  -BackendPort 8087 `
  -DryRun
```
