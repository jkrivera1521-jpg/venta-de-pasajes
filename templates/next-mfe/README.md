# Plantilla Next.js MFE

Plantilla base para crear microfrontends de `Venta de Pasajes`.

## Uso recomendado

Primero validar en modo seco:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\new-next-mfe.ps1 `
  -MfeName mfe-catalog `
  -PackageSegment catalog `
  -Title "Catalogos" `
  -LocalPort 3006 `
  -BackendPort 8087 `
  -DryRun
```

Crear el MFE:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\new-next-mfe.ps1 `
  -MfeName mfe-catalog `
  -PackageSegment catalog `
  -Title "Catalogos" `
  -LocalPort 3006 `
  -BackendPort 8087
```

## Despues de crear

- Agregar `apps/<mfe>` a `workspaces` en `package.json`.
- Agregar scripts `dev:<mfe>`, build y typecheck si corresponde.
- Agregar manifiesto del MFE al shell.
- Agregar configuracion Cloud Run dev/prod.
- Ejecutar `npm install`.
- Ejecutar `npm run typecheck -w @venta-pasajes/<mfe>`.

## Incluye

- Next.js standalone.
- TanStack Query provider.
- Manifest `/mfe/manifest`.
- Health `/api/health`.
- Ruta embedded `/<segmento>/embedded`.
- Proxy server-side `/api/<segmento>/*` hacia el backend.
- Soporte para identity token de Cloud Run en llamadas service-to-service.
