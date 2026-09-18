# Dia 43 - mfe-admin

Fecha de ejecucion: 2026-09-16

## Objetivo

Crear `mfe-admin` como microfrontend administrativo para consultar auditoria operacional desde el `frontend-shell`.

Alcance del dia:

```text
Crear MFE admin con Next.js App Router.
Consumir audit-service mediante proxy frontend /api/audit/*.
Agregar TanStack Query para consultas/mutaciones.
Agregar TanStack Table para listar eventos auditables.
Exponer manifest /mfe/manifest y health /api/health.
Integrar Admin en frontend-shell.
Actualizar scripts locales para incluir puerto 3005.
```

## Resultado logrado

```text
Se creo @venta-pasajes/mfe-admin.
Se agrego una pantalla embebida /admin/embedded para auditoria.
Se agregaron filtros por fecha, accion y tipo de recurso.
Se agrego tabla de eventos auditables con TanStack Table.
Se agrego boton Evento prueba para registrar un evento administrativo.
Se agrego proxy /api/audit/* hacia audit-service.
Se integro el modulo Admin en frontend-shell.
Se actualizo el contador de MFEs a 5/6.
Se corrigio el contrato frontend para leer respuestas snake_case de Quarkus.
```

## Archivos creados

```text
C:\VENTA-DE-PASAJES\apps\mfe-admin\package.json
C:\VENTA-DE-PASAJES\apps\mfe-admin\next.config.ts
C:\VENTA-DE-PASAJES\apps\mfe-admin\tsconfig.json
C:\VENTA-DE-PASAJES\apps\mfe-admin\next-env.d.ts
C:\VENTA-DE-PASAJES\apps\mfe-admin\.env.example
C:\VENTA-DE-PASAJES\apps\mfe-admin\app\providers.tsx
C:\VENTA-DE-PASAJES\apps\mfe-admin\app\layout.tsx
C:\VENTA-DE-PASAJES\apps\mfe-admin\app\page.tsx
C:\VENTA-DE-PASAJES\apps\mfe-admin\app\globals.css
C:\VENTA-DE-PASAJES\apps\mfe-admin\app\api\health\route.ts
C:\VENTA-DE-PASAJES\apps\mfe-admin\app\api\audit\[...path]\route.ts
C:\VENTA-DE-PASAJES\apps\mfe-admin\app\mfe\manifest\route.ts
C:\VENTA-DE-PASAJES\apps\mfe-admin\app\admin\embedded\page.tsx
C:\VENTA-DE-PASAJES\docs\dia-43-mfe-admin.md
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

Esta seccion sirve para limpiar el ambiente antes de repetir la practica desde cero o para deshacer el MFE admin.

### Paso R1 - Detener frontend local

```powershell
cd C:\VENTA-DE-PASAJES

powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\stop-frontend-dev.ps1
```

Validar puertos:

```powershell
Get-NetTCPConnection -LocalPort 3000,3001,3002,3003,3004,3005 -ErrorAction SilentlyContinue |
  Select-Object LocalAddress,LocalPort,State,OwningProcess |
  Format-Table -AutoSize
```

Si aparece `Acceso denegado`, normalmente esos procesos fueron creados desde otra consola elevada. Cerrar esa ventana de PowerShell/CMD o ejecutar el mismo comando anterior desde una consola con el mismo nivel de permisos.

Para identificar los procesos antes de detenerlos:

```powershell
$FrontendPids = Get-NetTCPConnection -LocalPort 3000,3001,3002,3003,3004,3005 -ErrorAction SilentlyContinue |
  Select-Object -ExpandProperty OwningProcess -Unique

Get-CimInstance Win32_Process |
  Where-Object { $FrontendPids -contains $_.ProcessId } |
  Select-Object ProcessId,Name,CommandLine |
  Format-List
```

Detener solo si corresponde a esta practica:

```powershell
Stop-Process -Id <process-id> -Force
```

### Paso R2 - Retirar workspace si se revierte manualmente

Quitar `apps/mfe-admin` del arreglo `workspaces` en `package.json`.

Quitar estos scripts:

```text
dev:mfe-admin
build:frontend -> segmento @venta-pasajes/mfe-admin
typecheck:frontend -> segmento @venta-pasajes/mfe-admin
```

Luego regenerar lockfile:

```powershell
npm install
```

### Paso R3 - Retirar integracion del shell

En `apps\frontend-shell\app\page.tsx`:

```text
Volver contador MFEs de 5/6 a 4/6 si se revierte admin.
Eliminar el modulo admin habilitado.
Dejar Admin disabled si se mantiene el item visual.
```

En `apps\frontend-shell\.env.example` quitar:

```text
NEXT_PUBLIC_MFE_ADMIN_MANIFEST_URL=http://localhost:3005/mfe/manifest
```

En `infra\env\frontend-app.env.example` quitar:

```text
NEXT_PUBLIC_MFE_ADMIN_MANIFEST_URL=http://localhost:3005/mfe/manifest
```

### Paso R4 - Restaurar scripts frontend

En `scripts\start-frontend-dev.ps1` quitar:

```text
MfeAdminPort
AuditApiUrl
Assert-PortAvailable para 3005
Start-NextApp mfe-admin
NEXT_PUBLIC_MFE_ADMIN_MANIFEST_URL
mfe_admin_url / mfe_admin_pid del JSON final
```

En `scripts\stop-frontend-dev.ps1` quitar:

```text
Puerto 3005.
logs\mfe-admin.pid.
```

### Paso R5 - Eliminar carpeta admin

Solo si se quiere borrar el MFE completo:

```powershell
Remove-Item -LiteralPath .\apps\mfe-admin -Recurse -Force
```

## Guia manual desde cero

### Paso 1 - Entrar al proyecto

```powershell
cd C:\VENTA-DE-PASAJES
```

### Paso 2 - Confirmar prerequisito audit-service

```powershell
Test-Path .\services\audit-service\pom.xml
Test-Path .\scripts\verify-audit-service-local.ps1
Test-Path .\docs\dia-42-audit-service.md
```

Resultado esperado:

```text
True
True
True
```

Si alguno aparece en `False`, completar primero el Dia 42.

### Paso 3 - Crear estructura del MFE

```powershell
$MfeAdminDirs = @(
  ".\apps\mfe-admin\app\api\health",
  ".\apps\mfe-admin\app\api\audit\[...path]",
  ".\apps\mfe-admin\app\mfe\manifest",
  ".\apps\mfe-admin\app\admin\embedded"
)

$MfeAdminDirs | ForEach-Object {
  [System.IO.Directory]::CreateDirectory($_) | Out-Null
}
```

### Paso 4 - Crear archivos del MFE

Este paso no es un comando de PowerShell. Es la lista de archivos que deben existir dentro de
`C:\VENTA-DE-PASAJES\apps\mfe-admin`.

No pegar nombres de archivos ni codigo TypeScript/TSX directamente en la consola. Abrir cada archivo
con el editor y guardar el contenido correspondiente. En esta version del proyecto ya se dejaron
creados los archivos base del MFE.

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
app\api\audit\[...path]\route.ts
app\mfe\manifest\route.ts
app\admin\embedded\page.tsx
```

Validar que el Paso 4 quedo completo:

```powershell
$ExpectedMfeAdminFiles = @(
  ".\apps\mfe-admin\package.json",
  ".\apps\mfe-admin\next.config.ts",
  ".\apps\mfe-admin\tsconfig.json",
  ".\apps\mfe-admin\next-env.d.ts",
  ".\apps\mfe-admin\.env.example",
  ".\apps\mfe-admin\app\providers.tsx",
  ".\apps\mfe-admin\app\layout.tsx",
  ".\apps\mfe-admin\app\page.tsx",
  ".\apps\mfe-admin\app\globals.css",
  ".\apps\mfe-admin\app\api\health\route.ts",
  ".\apps\mfe-admin\app\api\audit\[...path]\route.ts",
  ".\apps\mfe-admin\app\mfe\manifest\route.ts",
  ".\apps\mfe-admin\app\admin\embedded\page.tsx"
)

$ExpectedMfeAdminFiles |
  ForEach-Object {
    [pscustomobject]@{
      Path = $_
      Exists = Test-Path -LiteralPath $_
    }
  } |
  Format-Table -AutoSize
```

Si alguno aparece en `False`, no continuar con `start-frontend-dev.ps1` todavia.

Valores clave:

```text
Nombre workspace: @venta-pasajes/mfe-admin
Puerto local: 3005
Proxy frontend: /api/audit/*
Backend por defecto: http://localhost:8086/api/v1/audit
Manifest: http://localhost:3005/mfe/manifest
Entrada embebida: http://localhost:3005/admin/embedded
```

### Paso 5 - Instalar dependencias

```powershell
npm install
```

Confirmar que npm reconoce el workspace:

```powershell
npm query .workspace --json | Select-String "mfe-admin"
```

Si no aparece `mfe-admin`, revisar que `package.json` tenga:

```text
workspaces -> apps/mfe-admin
apps\mfe-admin\package.json -> name: @venta-pasajes/mfe-admin
```

### Paso 6 - Validar typecheck

```powershell
npm run typecheck -w @venta-pasajes/mfe-admin
npm run typecheck:frontend
```

Resultado validado:

```text
@venta-pasajes/mfe-admin typecheck OK.
typecheck:frontend OK.
```

### Paso 7 - Validar build

```powershell
npm run build -w @venta-pasajes/mfe-admin
npm run build:frontend
```

Resultado validado:

```text
mfe-admin build OK.
build:frontend OK.
frontend-shell build OK.
```

Rutas generadas por `mfe-admin`:

```text
/
/admin/embedded
/api/audit/[...path]
/api/health
/mfe/manifest
```

### Paso 8 - Levantar solo mfe-admin

Este paso sirve para validar el MFE aunque los otros puertos del shell esten ocupados.

Terminal 1. Ejecutar y dejar esta terminal abierta:

```powershell
npm run dev:mfe-admin
```

No cerrar esta terminal todavia. Mientras `next dev` esta activo debe verse algo parecido a:

```text
Local: http://127.0.0.1:3005
Ready
```

Terminal 2. Abrir otra ventana de PowerShell en `C:\VENTA-DE-PASAJES` y ejecutar:

```powershell
curl.exe -s http://localhost:3005/api/health
curl.exe -s http://localhost:3005/mfe/manifest
curl.exe -s -o NUL -w "%{http_code}" http://localhost:3005/admin/embedded
```

Resultados validados:

```text
mfe-admin health: {"service":"mfe-admin","status":"ok"}
mfe-admin manifest: status online
mfe-admin embedded: 200
```

Despues de validar, volver a la Terminal 1 y detener con `Ctrl+C`.

Si despues de `Ctrl+C` aparece:

```text
npm error Lifecycle script `dev` failed with error:
npm error code 4294967295
```

No significa que el MFE haya fallado. En Windows ese codigo puede aparecer cuando se interrumpe manualmente `next dev`. Si ya se validaron los `200`, se puede continuar.

### Paso 9 - Levantar shell y todos los MFEs

Detener procesos anteriores:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\stop-frontend-dev.ps1
```

Levantar shell y MFEs:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-frontend-dev.ps1
```

Resultado esperado:

```json
{"shell_url":"http://localhost:3000","mfe_identity_url":"http://localhost:3001","mfe_dispatch_url":"http://localhost:3002","mfe_ticketing_url":"http://localhost:3003","mfe_reporting_url":"http://localhost:3004","mfe_admin_url":"http://localhost:3005"}
```

Si `start-frontend-dev.ps1` falla indicando que otro dev server ya esta corriendo, cerrar primero las ventanas anteriores de Next.js o ejecutar:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\stop-frontend-dev.ps1
```

Si aparece `Acceso denegado`, cerrar la consola elevada que dejo vivos los procesos o repetir el stop desde una consola elevada.

### Paso 10 - Validar HTTP frontend

```powershell
curl.exe -s -o NUL -w "%{http_code}" http://localhost:3000
curl.exe -s http://localhost:3005/api/health
curl.exe -s http://localhost:3005/mfe/manifest
curl.exe -s -o NUL -w "%{http_code}" http://localhost:3005/admin/embedded
```

Resultados validados:

```text
frontend-shell: 200
mfe-admin health: ok
mfe-admin manifest: online
mfe-admin embedded: 200
```

### Paso 11 - Probar datos reales de auditoria

Para que la tabla muestre eventos reales, `audit-service` debe estar activo en el URL configurado.

Opcion A, usar puerto por defecto del frontend:

```powershell
# Levantar audit-service manualmente en 8086 siguiendo Dia 42.
curl.exe -s http://localhost:3005/api/audit/health
curl.exe -s "http://localhost:3005/api/audit/audit-events?page=1&page_size=10"
```

Opcion B, si `audit-service` se levanta en otro puerto, por ejemplo `18099`, iniciar frontend asi:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-frontend-dev.ps1 `
  -AuditApiUrl http://localhost:18099/api/v1/audit
```

Si la pantalla muestra `Sin backend`, el MFE esta vivo pero `audit-service` no esta disponible en el URL configurado.

## Troubleshooting aplicado

### Error: puerto ocupado o acceso denegado al detener

Sintoma:

```text
scripts\stop-frontend-dev.ps1 detecta puertos 3000-3004 ocupados.
Stop-Process o taskkill responde Acceso denegado.
```

Causa:

```text
Los dev servers anteriores fueron creados desde otra consola con permisos elevados.
La terminal actual no puede detenerlos.
```

Solucion:

```text
Cerrar la consola donde se iniciaron esos servidores.
O ejecutar stop-frontend-dev.ps1 desde una consola con el mismo nivel de permisos.
Luego volver a ejecutar start-frontend-dev.ps1.
```

### Error: No workspaces found para mfe-admin

Sintoma:

```text
npm error No workspaces found:
npm error   --workspace=@venta-pasajes/mfe-admin
```

Causa:

```text
apps\mfe-admin existe como carpeta, pero falta package.json o no esta registrado en workspaces.
```

Validar:

```powershell
Test-Path -LiteralPath .\apps\mfe-admin\package.json
npm query .workspace --json | Select-String "mfe-admin"
```

### Error: New-Item no reconoce LiteralPath

Sintoma:

```text
New-Item : No se encuentra ningun parametro que coincida con el nombre del parametro 'LiteralPath'.
```

Causa:

```text
Windows PowerShell no expone -LiteralPath en New-Item. Ademas, la carpeta [...path] no debe crearse con -Path sin escapar, porque los corchetes pueden interpretarse como patron.
```

Solucion:

```powershell
$MfeAdminDirs = @(
  ".\apps\mfe-admin\app\api\health",
  ".\apps\mfe-admin\app\api\audit\[...path]",
  ".\apps\mfe-admin\app\mfe\manifest",
  ".\apps\mfe-admin\app\admin\embedded"
)

$MfeAdminDirs | ForEach-Object {
  [System.IO.Directory]::CreateDirectory($_) | Out-Null
}
```

### Pantalla admin sin datos

Sintoma:

```text
La pantalla carga, pero la tabla de auditoria no muestra eventos.
```

Causas posibles:

```text
audit-service no esta levantado.
AUDIT_API_URL apunta a otro puerto.
No existen eventos en audit_events para los filtros seleccionados.
```

Validar:

```powershell
curl.exe -s http://localhost:3005/api/audit/health
curl.exe -s "http://localhost:3005/api/audit/audit-events?page=1&page_size=10"
```

### curl devuelve 000 en localhost:3005

Sintoma:

```text
curl.exe -s -o NUL -w "%{http_code}" http://localhost:3005/admin/embedded
000
```

Causa:

```text
No hay servidor escuchando en 3005. Normalmente ocurrio porque se presiono Ctrl+C o porque npm run dev:mfe-admin termino y regreso al prompt.
```

Validar:

```powershell
Get-NetTCPConnection -LocalPort 3005 -ErrorAction SilentlyContinue |
  Select-Object LocalAddress,LocalPort,State,OwningProcess |
  Format-Table -AutoSize
```

Solucion:

```powershell
npm run dev:mfe-admin
```

Dejar esa terminal abierta y ejecutar los `curl` desde una segunda terminal.

## Validacion final

```text
npm install: OK.
npm run typecheck -w @venta-pasajes/mfe-admin: OK.
npm run build -w @venta-pasajes/mfe-admin: OK.
npm run typecheck:frontend: OK.
npm run build:frontend: OK.
curl http://localhost:3005/api/health: OK.
curl http://localhost:3005/mfe/manifest: OK.
curl http://localhost:3005/admin/embedded: HTTP 200.
```

Nota:

```text
El arranque completo del shell no se dejo corriendo porque existian procesos antiguos en 3000-3004 creados desde otra consola elevada.
Se valido mfe-admin de forma aislada en 3005 y se documento la limpieza para volver a levantar todo el shell.
```

## Siguiente paso natural

```text
Continuar con la integracion de administracion avanzada: parametros, catalogos operativos, permisos administrativos o visor de salud consolidado.
```
