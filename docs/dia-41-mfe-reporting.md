# Dia 41 - mfe-reporting

Fecha de ejecucion: 2026-09-16

## Objetivo

Crear `mfe-reporting` como microfrontend operativo para consultar los reportes publicados por `reporting-service` desde el shell principal.

Nota de numeracion: en el plan original esta tarea aparece como Dia 40. En esta bitacora se documenta como Dia 41 porque Dia 40 se uso para introducir TanStack Query en todos los frontends.

Alcance del dia:

```text
Crear MFE de reportes.
Crear reporte de ventas por fecha.
Crear reporte de pasajeros por salida.
Crear reporte por usuario.
Crear reporte por bus/ruta/terminal.
Agregar exportacion CSV desde la pantalla activa.
Integrar con frontend-shell.
```

## Resultado logrado

```text
Se creo @venta-pasajes/mfe-reporting con Next.js App Router.
Se agrego TanStack Query para consumir reporting-service.
Se agrego TanStack Table para grillas de reportes.
Se agrego proxy /api/reporting/*.
Se agrego manifest /mfe/manifest.
Se integro Reportes en la barra lateral del shell.
Se actualizaron scripts de arranque/parada frontend para incluir puerto 3004.
Se agrego exportacion CSV del tab activo.
```

## Archivos creados

```text
C:\VENTA-DE-PASAJES\apps\mfe-reporting\package.json
C:\VENTA-DE-PASAJES\apps\mfe-reporting\next.config.ts
C:\VENTA-DE-PASAJES\apps\mfe-reporting\tsconfig.json
C:\VENTA-DE-PASAJES\apps\mfe-reporting\next-env.d.ts
C:\VENTA-DE-PASAJES\apps\mfe-reporting\.env.example
C:\VENTA-DE-PASAJES\apps\mfe-reporting\app\providers.tsx
C:\VENTA-DE-PASAJES\apps\mfe-reporting\app\layout.tsx
C:\VENTA-DE-PASAJES\apps\mfe-reporting\app\page.tsx
C:\VENTA-DE-PASAJES\apps\mfe-reporting\app\globals.css
C:\VENTA-DE-PASAJES\apps\mfe-reporting\app\api\health\route.ts
C:\VENTA-DE-PASAJES\apps\mfe-reporting\app\api\reporting\[...path]\route.ts
C:\VENTA-DE-PASAJES\apps\mfe-reporting\app\mfe\manifest\route.ts
C:\VENTA-DE-PASAJES\apps\mfe-reporting\app\reporting\embedded\page.tsx
C:\VENTA-DE-PASAJES\docs\dia-41-mfe-reporting.md
```

## Archivos modificados

```text
C:\VENTA-DE-PASAJES\package.json
C:\VENTA-DE-PASAJES\package-lock.json
C:\VENTA-DE-PASAJES\scripts\start-frontend-dev.ps1
C:\VENTA-DE-PASAJES\scripts\stop-frontend-dev.ps1
C:\VENTA-DE-PASAJES\apps\frontend-shell\app\page.tsx
C:\VENTA-DE-PASAJES\apps\frontend-shell\.env.example
C:\VENTA-DE-PASAJES\infra\env\frontend-app.env.example
C:\VENTA-DE-PASAJES\apps\README.md
C:\VENTA-DE-PASAJES\vitacora.md
```

## Reversa primero

Esta seccion sirve para limpiar el ambiente antes de repetir la practica desde cero o para deshacer el MFE reporting.

### Paso R1 - Detener frontend local

```powershell
cd C:\VENTA-DE-PASAJES

powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\stop-frontend-dev.ps1
```

Validar puertos:

```powershell
Get-NetTCPConnection -LocalPort 3000,3001,3002,3003,3004 -ErrorAction SilentlyContinue |
  Select-Object LocalAddress,LocalPort,State,OwningProcess |
  Format-Table -AutoSize
```

### Paso R2 - Retirar workspace si se revierte manualmente

Quitar `apps/mfe-reporting` del arreglo `workspaces` en `package.json`.

Quitar estos scripts:

```text
dev:mfe-reporting
build:frontend -> segmento @venta-pasajes/mfe-reporting
typecheck:frontend -> segmento @venta-pasajes/mfe-reporting
```

Luego:

```powershell
npm install
```

### Paso R3 - Retirar integracion del shell

En `apps\frontend-shell\app\page.tsx`:

```text
Volver contador MFEs de 4/6 a 3/6 si se revierte reporting.
Eliminar el modulo reporting habilitado.
Dejar Reportes disabled si se mantiene el item visual.
```

En `apps\frontend-shell\.env.example` quitar:

```text
NEXT_PUBLIC_MFE_REPORTING_MANIFEST_URL=http://localhost:3004/mfe/manifest
```

### Paso R4 - Restaurar scripts frontend

En `scripts\start-frontend-dev.ps1` quitar:

```text
MfeReportingPort
ReportingApiUrl
Assert-PortAvailable para 3004
Start-NextApp mfe-reporting
NEXT_PUBLIC_MFE_REPORTING_MANIFEST_URL
mfe_reporting_url / mfe_reporting_pid del JSON final
```

En `scripts\stop-frontend-dev.ps1` quitar:

```text
Puerto 3004.
logs\mfe-reporting.pid.
```

### Paso R5 - Eliminar carpeta reporting

Solo si se quiere borrar el MFE completo:

```powershell
Remove-Item -LiteralPath .\apps\mfe-reporting -Recurse -Force
```

## Guia manual desde cero

### Paso 1 - Entrar al proyecto

```powershell
cd C:\VENTA-DE-PASAJES
```

### Paso 2 - Confirmar base TanStack

```powershell
Select-String -Path .\apps\mfe-ticketing\package.json -Pattern "@tanstack/react-query"
Select-String -Path .\apps\frontend-shell\app\providers.tsx -Pattern "QueryClientProvider"
```

### Paso 3 - Crear estructura del MFE

```powershell
New-Item -ItemType Directory -Force -Path `
  .\apps\mfe-reporting\app\api\health, `
  .\apps\mfe-reporting\app\api\reporting\[...path], `
  .\apps\mfe-reporting\app\mfe\manifest, `
  .\apps\mfe-reporting\app\reporting\embedded
```

### Paso 4 - Crear archivos del MFE

Este paso no es un comando de PowerShell. Es la lista de archivos que deben existir dentro de
`C:\VENTA-DE-PASAJES\apps\mfe-reporting`.

No pegar nombres de archivos ni codigo TypeScript directamente en la consola. Abrir cada archivo
con el editor y guardar el contenido correspondiente. En esta version corregida del proyecto ya se
dejaron creados los archivos base del MFE.

Archivos esperados:

```text
package.json
next.config.ts
tsconfig.json
next-env.d.ts
.env.example
app\providers.tsx
app\layout.tsx
app\page.tsx
app\globals.css
app\api\health\route.ts
app\api\reporting\[...path]\route.ts
app\mfe\manifest\route.ts
app\reporting\embedded\page.tsx
```

Validar que el Paso 4 quedo completo:

```powershell
$ExpectedMfeReportingFiles = @(
  ".\apps\mfe-reporting\package.json",
  ".\apps\mfe-reporting\next.config.ts",
  ".\apps\mfe-reporting\tsconfig.json",
  ".\apps\mfe-reporting\next-env.d.ts",
  ".\apps\mfe-reporting\.env.example",
  ".\apps\mfe-reporting\app\providers.tsx",
  ".\apps\mfe-reporting\app\layout.tsx",
  ".\apps\mfe-reporting\app\page.tsx",
  ".\apps\mfe-reporting\app\globals.css",
  ".\apps\mfe-reporting\app\api\health\route.ts",
  ".\apps\mfe-reporting\app\api\reporting\[...path]\route.ts",
  ".\apps\mfe-reporting\app\mfe\manifest\route.ts",
  ".\apps\mfe-reporting\app\reporting\embedded\page.tsx"
)

$ExpectedMfeReportingFiles |
  ForEach-Object {
    [pscustomobject]@{
      Path = $_
      Exists = Test-Path -LiteralPath $_
    }
  } |
  Format-Table -AutoSize
```

Si alguno aparece en `False`, no continuar con `start-frontend-dev.ps1` todavia.
Primero crear el archivo faltante, porque npm necesita especialmente:

```powershell
Test-Path -LiteralPath .\apps\mfe-reporting\package.json
```

Ese comando debe responder:

```text
True
```

Valores clave:

```text
Nombre workspace: @venta-pasajes/mfe-reporting
Puerto local: 3004
Proxy frontend: /api/reporting/*
Backend por defecto: http://localhost:8085/api/v1/reporting
Manifest: http://localhost:3004/mfe/manifest
Entrada embebida: http://localhost:3004/reporting/embedded
```

### Paso 5 - Instalar dependencias

```powershell
npm install
```

### Paso 6 - Validar typecheck

```powershell
npm run typecheck:frontend
```

Resultado validado:

```text
@venta-pasajes/mfe-reporting typecheck OK.
typecheck:frontend OK.
```

### Paso 7 - Validar build

```powershell
npm run build:frontend
```

Resultado validado:

```text
mfe-reporting build OK.
frontend-shell build OK.
```

### Paso 8 - Levantar frontend local

Si hay procesos anteriores:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\stop-frontend-dev.ps1
```

Levantar shell y MFEs:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-frontend-dev.ps1
```

Resultado validado:

```json
{"shell_url":"http://localhost:3000","mfe_identity_url":"http://localhost:3001","mfe_dispatch_url":"http://localhost:3002","mfe_ticketing_url":"http://localhost:3003","mfe_reporting_url":"http://localhost:3004"}
```

### Paso 9 - Validar HTTP frontend

```powershell
curl.exe -s -o NUL -w "%{http_code}" http://localhost:3000
curl.exe -s http://localhost:3004/api/health
curl.exe -s http://localhost:3004/mfe/manifest
curl.exe -s -o NUL -w "%{http_code}" http://localhost:3004/reporting/embedded
```

Resultados validados:

```text
frontend-shell: 200
mfe-reporting health: ok
mfe-reporting manifest: online
mfe-reporting embedded: 200
```

### Paso 10 - Probar datos reales

Para que las tablas muestren datos, `reporting-service` debe estar activo y escuchando en el URL configurado.

Opcion A, usar puerto por defecto del frontend:

```powershell
# Levantar reporting-service manualmente en 8085 siguiendo Dia 39.
# Luego abrir:
curl.exe -s http://localhost:3004/api/reporting/health
```

Opcion B, si `reporting-service` se levanta en otro puerto, por ejemplo `18098`, iniciar frontend asi:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-frontend-dev.ps1 `
  -ReportingApiUrl http://localhost:18098/api/v1/reporting
```

Si `curl.exe -s -o NUL -w "%{http_code}" http://localhost:3004/api/reporting/health` responde `502`, el MFE esta vivo pero `reporting-service` no esta disponible en el URL configurado.

## Troubleshooting aplicado

### Error: WorkingDirectory tiene un valor no valido

Sintoma:

```text
Start-Process : Este comando no se puede ejecutar porque el parametro "WorkingDirectory" tiene un valor no valido.
```

Causa:

```text
scripts\start-frontend-dev.ps1 intenta iniciar apps\mfe-reporting, pero la carpeta no tiene package.json o no existe.
```

Validacion:

```powershell
Test-Path -LiteralPath .\apps\mfe-reporting\package.json
Get-ChildItem -LiteralPath .\apps\mfe-reporting -Recurse -File
```

Correccion:

```text
Completar el Paso 4 antes de levantar los frontends.
```

Tambien se ajusto `scripts\start-frontend-dev.ps1` para que, si vuelve a faltar una carpeta de MFE,
muestre un error mas claro indicando el directorio faltante.

### Error: No workspaces found para mfe-reporting

Sintoma:

```text
npm error No workspaces found:
npm error   --workspace=@venta-pasajes/mfe-reporting
```

Causa:

```text
El package.json raiz tiene apps/mfe-reporting en workspaces, pero npm no encuentra
un paquete real llamado @venta-pasajes/mfe-reporting.
Normalmente pasa cuando apps\mfe-reporting existe solo con carpetas, pero falta
apps\mfe-reporting\package.json.
```

Validacion:

```powershell
Test-Path -LiteralPath .\apps\mfe-reporting\package.json
npm query .workspace --json | Select-String "mfe-reporting"
```

Resultado esperado:

```text
True
"name": "@venta-pasajes/mfe-reporting"
```

Correccion:

```powershell
npm install
npm run typecheck -w @venta-pasajes/mfe-reporting
npm run typecheck:frontend
```

Si `Test-Path` responde `False`, volver al Paso 4 y crear los archivos del MFE antes de ejecutar npm.

## Funcionalidad entregada

```text
Filtros por fecha desde/hasta.
Filtros opcionales por terminal_id, route_id, user_id y departure_id.
Busqueda de pasajero por texto.
Agrupacion BUS/ROUTE/TERMINAL.
KPIs: vendidos, cancelados, bruto y neto.
Tabs: Ventas, Pasajeros, Usuarios y Bus/Ruta.
Exportacion CSV del tab activo.
```

## Validacion final

```text
npm run typecheck:frontend: OK.
npm run build:frontend: OK.
frontend-shell HTTP 200.
mfe-reporting /api/health OK.
mfe-reporting /mfe/manifest OK.
mfe-reporting /reporting/embedded HTTP 200.
Proxy /api/reporting/health respondio 502 porque reporting-service no estaba levantado al momento de probar.
```

## Siguiente paso natural

```text
Continuar con audit-service.
Despues integrar mfe-admin para auditoria, parametros y salud de servicios.
```
