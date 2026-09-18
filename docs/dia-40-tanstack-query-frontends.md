# Dia 40 - TanStack Query en frontends

Fecha de ejecucion: 2026-09-16

## Objetivo

Agregar TanStack Query a `frontend-shell`, `mfe-identity`, `mfe-dispatch` y `mfe-ticketing` para que la carga de datos, cache, refetch e invalidacion de recursos no dependan de `fetch + useEffect + useState` repetidos en cada pantalla.

Alcance del dia:

```text
Mantener Next.js App Router.
Agregar QueryClientProvider por aplicacion frontend.
Migrar carga de manifiestos del shell a useQuery.
Migrar datos operativos de ticketing a useQuery/useMutation.
Migrar catalogos de dispatch a useQuery/useMutation.
Migrar sesion y datos protegidos de identity a useQuery/useMutation.
Validar typecheck, build y arranque local.
```

## Resultado logrado

```text
Se instalo @tanstack/react-query en los cuatro workspaces frontend.
Cada app tiene su propio QueryClientProvider.
frontend-shell consulta manifests MFE con useQuery.
frontend-shell inicializa el reloj con valor estable para evitar hydration mismatch.
mfe-ticketing usa queries para salidas/mapa de asientos y mutations para sincronizar demo/emitir boleto.
mfe-dispatch usa una query de recursos operativos y mutations que invalidan catalogos.
mfe-identity usa una query de sesion protegida por token y limpia cache al cerrar sesion.
Se conservaron App Router y Route Handlers existentes.
No se agrego TanStack Router porque Next App Router ya cubre el enrutamiento.
```

## Archivos creados

```text
C:\VENTA-DE-PASAJES\apps\frontend-shell\app\providers.tsx
C:\VENTA-DE-PASAJES\apps\mfe-identity\app\providers.tsx
C:\VENTA-DE-PASAJES\apps\mfe-dispatch\app\providers.tsx
C:\VENTA-DE-PASAJES\apps\mfe-ticketing\app\providers.tsx
C:\VENTA-DE-PASAJES\docs\dia-40-tanstack-query-frontends.md
```

## Archivos modificados

```text
C:\VENTA-DE-PASAJES\package-lock.json
C:\VENTA-DE-PASAJES\apps\frontend-shell\package.json
C:\VENTA-DE-PASAJES\apps\mfe-identity\package.json
C:\VENTA-DE-PASAJES\apps\mfe-dispatch\package.json
C:\VENTA-DE-PASAJES\apps\mfe-ticketing\package.json
C:\VENTA-DE-PASAJES\apps\frontend-shell\app\layout.tsx
C:\VENTA-DE-PASAJES\apps\frontend-shell\app\page.tsx
C:\VENTA-DE-PASAJES\apps\mfe-identity\app\layout.tsx
C:\VENTA-DE-PASAJES\apps\mfe-dispatch\app\layout.tsx
C:\VENTA-DE-PASAJES\apps\mfe-ticketing\app\layout.tsx
C:\VENTA-DE-PASAJES\apps\frontend-shell\app\components\RemoteMfeFrame.tsx
C:\VENTA-DE-PASAJES\apps\mfe-identity\app\identity\embedded\page.tsx
C:\VENTA-DE-PASAJES\apps\mfe-dispatch\app\dispatch\embedded\page.tsx
C:\VENTA-DE-PASAJES\apps\mfe-ticketing\app\ticketing\embedded\page.tsx
C:\VENTA-DE-PASAJES\vitacora.md
```

## Reversa primero

Esta seccion sirve para limpiar el ambiente antes de repetir la practica desde cero o volver al estado previo.

### Paso R1 - Detener frontend local

```powershell
cd C:\VENTA-DE-PASAJES

powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\stop-frontend-dev.ps1
```

Validar que los puertos frontend quedaron libres:

```powershell
Get-NetTCPConnection -LocalPort 3000,3001,3002,3003 -ErrorAction SilentlyContinue |
  Select-Object LocalAddress,LocalPort,State,OwningProcess |
  Format-Table -AutoSize
```

### Paso R2 - Revertir paquetes TanStack

Si se necesita retirar TanStack Query de los workspaces:

```powershell
npm uninstall @tanstack/react-query -w @venta-pasajes/frontend-shell
npm uninstall @tanstack/react-query -w @venta-pasajes/mfe-identity
npm uninstall @tanstack/react-query -w @venta-pasajes/mfe-dispatch
npm uninstall @tanstack/react-query -w @venta-pasajes/mfe-ticketing
```

### Paso R3 - Eliminar providers si se revierte manualmente

```powershell
Remove-Item -LiteralPath .\apps\frontend-shell\app\providers.tsx -Force
Remove-Item -LiteralPath .\apps\mfe-identity\app\providers.tsx -Force
Remove-Item -LiteralPath .\apps\mfe-dispatch\app\providers.tsx -Force
Remove-Item -LiteralPath .\apps\mfe-ticketing\app\providers.tsx -Force
```

Despues de eliminar providers, restaurar los `layout.tsx` para que el body vuelva a renderizar solo `{children}`:

```tsx
<body>{children}</body>
```

### Paso R4 - Restaurar flujo manual anterior

Si se revierte completamente, restaurar en cada pantalla los estados manuales previos:

```text
frontend-shell:
- manifest/status/error en RemoteMfeFrame.
- loadManifest con fetch manual.

mfe-ticketing:
- departures y seatMap en useState.
- loadDepartures/loadSeatMap con useCallback.
- syncDemoDeparture e issueTicket con busy manual.

mfe-dispatch:
- terminals/routes/busTypes/layouts/buses/departures en useState.
- loadData y runAction manuales.

mfe-identity:
- currentUser/users/roles/permissions/authorizedIdentities en useState.
- loadProtectedData manual.
- limpieza manual de estados en logout.
```

### Paso R5 - Limpiar builds opcional

```powershell
Remove-Item -LiteralPath .\apps\frontend-shell\.next -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath .\apps\mfe-identity\.next -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath .\apps\mfe-dispatch\.next -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath .\apps\mfe-ticketing\.next -Recurse -Force -ErrorAction SilentlyContinue
```

## Guia manual desde cero

### Paso 1 - Entrar al proyecto

```powershell
cd C:\VENTA-DE-PASAJES
```

### Paso 2 - Instalar dependencia

```powershell
npm install @tanstack/react-query `
  -w @venta-pasajes/frontend-shell `
  -w @venta-pasajes/mfe-identity `
  -w @venta-pasajes/mfe-dispatch `
  -w @venta-pasajes/mfe-ticketing
```

### Paso 3 - Crear providers

No pegar el bloque TypeScript directamente en PowerShell. Ese contenido va dentro de un archivo `.tsx`.

Primero verificar si ya existen:

```powershell
Test-Path .\apps\frontend-shell\app\providers.tsx
Test-Path .\apps\mfe-identity\app\providers.tsx
Test-Path .\apps\mfe-dispatch\app\providers.tsx
Test-Path .\apps\mfe-ticketing\app\providers.tsx
```

Si todos responden `True`, continuar con el Paso 4.

Si alguno falta, crearlo con este bloque PowerShell. Este bloque si se pega en la consola:

```powershell
$ProviderContent = @'
"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useState } from "react";

export function Providers({ children }: Readonly<{ children: ReactNode }>) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            gcTime: 10 * 60 * 1000,
            refetchOnWindowFocus: false,
            retry: 1,
            staleTime: 30 * 1000
          }
        }
      })
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
'@

$ProviderPaths = @(
  ".\apps\frontend-shell\app\providers.tsx",
  ".\apps\mfe-identity\app\providers.tsx",
  ".\apps\mfe-dispatch\app\providers.tsx",
  ".\apps\mfe-ticketing\app\providers.tsx"
)

foreach ($ProviderPath in $ProviderPaths) {
  $ProviderDirectory = Split-Path -Parent $ProviderPath
  New-Item -ItemType Directory -Force -Path $ProviderDirectory | Out-Null
  if (-not (Test-Path $ProviderPath)) {
    Set-Content -Path $ProviderPath -Value $ProviderContent -Encoding UTF8
    "Creado $ProviderPath"
  } else {
    "Ya existe $ProviderPath"
  }
}
```

El contenido que debe quedar dentro de cada `app\providers.tsx` es:

```tsx
"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useState } from "react";

export function Providers({ children }: Readonly<{ children: ReactNode }>) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            gcTime: 10 * 60 * 1000,
            refetchOnWindowFocus: false,
            retry: 1,
            staleTime: 30 * 1000
          }
        }
      })
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
```

### Paso 4 - Envolver layouts

Este paso significa modificar el archivo `layout.tsx` de cada aplicacion para que toda la pantalla quede dentro del `Providers` que se creo en el paso anterior.

En Next.js App Router, `layout.tsx` es la envoltura principal de una app. El parametro `children` representa la pagina que se esta mostrando. Si dejamos solo `{children}`, la pagina funciona, pero no tiene acceso al `QueryClient` de TanStack Query. Al cambiarlo a `<Providers>{children}</Providers>`, todas las paginas y componentes internos pueden usar `useQuery`, `useMutation` e invalidacion de cache.

Los siguientes fragmentos son codigo de archivo, no comandos de PowerShell.

Archivos a revisar:

```text
C:\VENTA-DE-PASAJES\apps\frontend-shell\app\layout.tsx
C:\VENTA-DE-PASAJES\apps\mfe-identity\app\layout.tsx
C:\VENTA-DE-PASAJES\apps\mfe-dispatch\app\layout.tsx
C:\VENTA-DE-PASAJES\apps\mfe-ticketing\app\layout.tsx
```

Arriba del archivo, junto a los imports existentes, debe estar:

```tsx
import { Providers } from "./providers";
```

Antes, el `body` normalmente estaba asi:

```tsx
<body>{children}</body>
```

Despues, debe quedar asi:

```tsx
<body>
  <Providers>{children}</Providers>
</body>
```

Ejemplo completo de `apps\mfe-ticketing\app\layout.tsx`:

```tsx
import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "MFE Ticketing",
  description: "Microfrontend de boleteria para venta de pasajes"
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="es">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

Verificar que ya esta aplicado:

```powershell
Select-String -Path .\apps\frontend-shell\app\layout.tsx -Pattern "Providers"
Select-String -Path .\apps\mfe-identity\app\layout.tsx -Pattern "Providers"
Select-String -Path .\apps\mfe-dispatch\app\layout.tsx -Pattern "Providers"
Select-String -Path .\apps\mfe-ticketing\app\layout.tsx -Pattern "Providers"
```

Si todos los comandos muestran `import { Providers } from "./providers";` y `<Providers>{children}</Providers>`, continuar con el Paso 5.

### Paso 5 - Migrar `frontend-shell`

En `RemoteMfeFrame.tsx`:

```text
Reemplazar estado manual manifest/status/error por useQuery.
Usar queryKey: ["frontend-shell", "mfe-manifest", manifestUrl, reloadToken].
Mantener reloadToken para forzar nueva consulta.
Mantener iframe, postMessage y calculo de altura como estaban.
```

### Paso 6 - Migrar `mfe-ticketing`

```text
Crear ticketingQueryKeys.
Usar useQuery para salidas por rango de fechas.
Usar useQuery para mapa de asientos por dispatch_departure_id.
Usar useMutation para sincronizar salida demo.
Usar useMutation para emitir boleto.
Invalidar salidas y mapa de asientos despues de cada venta.
```

### Paso 7 - Migrar `mfe-dispatch`

```text
Crear dispatchQueryKeys.resources.
Crear fetchDispatchResources.
Reemplazar estados de catalogos por resourcesQuery.data.
Usar useMutation para crear/desactivar/cancelar recursos.
Invalidar dispatchQueryKeys.resources al terminar cada accion.
```

### Paso 8 - Migrar `mfe-identity`

```text
Crear identityQueryKeys.session(token).
Crear fetchIdentitySession(token).
Habilitar useQuery solo si existe accessToken.
Usar sessionStorage solo como fuente del token.
Usar useMutation para login, roles, usuarios e identidades autorizadas.
Invalidar la sesion protegida despues de mutaciones.
Limpiar cache con queryClient.removeQueries al cerrar sesion.
```

### Paso 9 - Typecheck

```powershell
npm run typecheck:frontend
```

Resultado validado:

```text
shared-types OK
mfe-identity OK
mfe-dispatch OK
mfe-ticketing OK
frontend-shell OK
```

### Paso 10 - Build

```powershell
npm run build:frontend
npm run build -w @venta-pasajes/frontend-shell
```

Resultado validado:

```text
mfe-identity build OK
mfe-dispatch build OK
mfe-ticketing build OK
frontend-shell build OK
frontend-shell build OK despues de ajustar reloj sin hydration mismatch
```

### Paso 11 - Levantar frontend local

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-frontend-dev.ps1
```

Resultado validado:

```json
{"shell_url":"http://localhost:3000","mfe_identity_url":"http://localhost:3001","mfe_dispatch_url":"http://localhost:3002","mfe_ticketing_url":"http://localhost:3003"}
```

### Paso 12 - Validar HTTP

```powershell
curl.exe -s -o NUL -w "%{http_code}" http://localhost:3000
curl.exe -s http://localhost:3001/api/health
curl.exe -s http://localhost:3002/api/health
curl.exe -s http://localhost:3003/api/health
curl.exe -s http://localhost:3003/mfe/manifest
```

Resultados validados:

```text
frontend-shell: 200
mfe-identity health: ok
mfe-dispatch health: ok
mfe-ticketing health: ok
mfe-ticketing manifest: online
```

## Decisiones tecnicas

```text
Se uso TanStack Query v5.103.1.
No se uso TanStack Router porque el proyecto ya usa Next App Router.
No se forzo TanStack Table todavia; queda mejor para reportes y grillas grandes, especialmente mfe-reporting.
No se movieron formularios a TanStack Form para evitar una migracion demasiado grande en una sola practica.
Cada MFE conserva cache aislada para evitar contaminacion de sesion y datos entre modulos.
```

## Validacion final

```text
npm run typecheck:frontend: OK.
npm run build:frontend: OK.
frontend-shell build posterior al ajuste del reloj: OK.
Frontend local iniciado: http://localhost:3000.
Health de MFEs: OK.
```

## Siguiente paso natural

```text
Retomar el mfe-reporting usando esta base:
- TanStack Query para consultar reporting-service.
- TanStack Table para ventas, pasajeros, usuarios y buses.
- Filtros por fecha/ruta/terminal/usuario.
- Exportacion posterior a CSV/PDF.
```
