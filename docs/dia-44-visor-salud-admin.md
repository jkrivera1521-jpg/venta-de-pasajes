# Dia 44 - visor de salud consolidado en mfe-admin

Fecha de ejecucion: 2026-09-16

## Objetivo

Agregar al `mfe-admin` un visor consolidado de salud para revisar rapidamente el estado de frontends, MFEs y backends desde la consola administrativa.

Alcance del dia:

```text
Agregar health endpoint al frontend-shell.
Agregar API administrativa /api/admin/health en mfe-admin.
Consultar salud de shell, MFEs y servicios backend.
Mostrar resumen de frontends/backends activos.
Agregar pestanas Salud y Auditoria dentro de mfe-admin.
Mantener Auditoria como segunda vista sin perder filtros ni tabla.
Actualizar variables de entorno y scripts locales.
Documentar reversa y ejecucion desde cero.
```

## Resultado logrado

```text
frontend-shell ahora expone GET /api/health.
mfe-admin ahora expone GET /api/admin/health.
mfe-admin inicia en la vista Salud.
La vista Salud muestra estado general, frontends activos, backends activos y ultima consulta.
La tabla de salud lista componente, estado, HTTP, latencia, URL y respuesta resumida.
La vista Auditoria se mantiene disponible como pestana.
start-frontend-dev.ps1 ahora entrega al admin las URLs de health configuradas.
Se agrego DocumentApiUrl al script de arranque para el health de document-service.
```

## Archivos creados

```text
C:\VENTA-DE-PASAJES\apps\frontend-shell\app\api\health\route.ts
C:\VENTA-DE-PASAJES\apps\mfe-admin\app\api\admin\health\route.ts
C:\VENTA-DE-PASAJES\docs\dia-44-visor-salud-admin.md
```

## Archivos modificados

```text
C:\VENTA-DE-PASAJES\apps\mfe-admin\app\admin\embedded\page.tsx
C:\VENTA-DE-PASAJES\apps\mfe-admin\app\globals.css
C:\VENTA-DE-PASAJES\apps\mfe-admin\app\mfe\manifest\route.ts
C:\VENTA-DE-PASAJES\apps\mfe-admin\.env.example
C:\VENTA-DE-PASAJES\apps\README.md
C:\VENTA-DE-PASAJES\infra\env\frontend-app.env.example
C:\VENTA-DE-PASAJES\scripts\start-frontend-dev.ps1
C:\VENTA-DE-PASAJES\vitacora.md
```

## Endpoints agregados

```text
GET /api/health                 en frontend-shell
GET /api/admin/health           en mfe-admin
```

## Componentes monitoreados

```text
Frontend Shell:   http://localhost:3000/api/health
MFE Identity:     http://localhost:3001/api/health
MFE Dispatch:     http://localhost:3002/api/health
MFE Ticketing:    http://localhost:3003/api/health
MFE Reporting:    http://localhost:3004/api/health
MFE Admin:        http://localhost:3005/api/health
Identity Service: http://localhost:8081/api/v1/identity/health
Dispatch Service: http://localhost:8082/api/v1/dispatch/health
Ticketing Service:http://localhost:8083/api/v1/ticketing/health
Document Service: http://localhost:8084/api/v1/document/health
Reporting Service:http://localhost:8085/api/v1/reporting/health
Audit Service:    http://localhost:8086/api/v1/audit/health
```

## Reversa primero

Esta seccion sirve para limpiar o deshacer el Dia 44.

### Paso R1 - Detener frontend local si se quiere reiniciar

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

Si aparece `Acceso denegado`, cerrar la consola elevada que inicio esos procesos o ejecutar el stop desde una consola con el mismo nivel de permisos.

### Paso R2 - Eliminar endpoints agregados

Solo si se quiere revertir completamente:

```powershell
Remove-Item -LiteralPath .\apps\frontend-shell\app\api\health\route.ts -Force
Remove-Item -LiteralPath .\apps\mfe-admin\app\api\admin\health\route.ts -Force
```

Si las carpetas quedan vacias y tambien se quieren retirar:

```powershell
Remove-Item -LiteralPath .\apps\frontend-shell\app\api\health -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath .\apps\mfe-admin\app\api\admin\health -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath .\apps\mfe-admin\app\api\admin -Recurse -Force -ErrorAction SilentlyContinue
```

### Paso R3 - Revertir pantalla admin

En `apps\mfe-admin\app\admin\embedded\page.tsx` retirar:

```text
Tipos HealthOverview y HealthCheckResult.
Funcion jsonRequest usada para /api/admin/health si ya no se necesita.
Componentes HealthState y HealthTable.
Estado activeView.
Query ["admin", "health"].
Pestanas Salud/Auditoria.
Render condicional de la vista Salud.
```

Dejar nuevamente la pantalla solo con la vista de auditoria del Dia 43.

### Paso R4 - Revertir estilos

En `apps\mfe-admin\app\globals.css` retirar:

```text
.view-tabs
.view-tab
.view-tab-active
.component-cell
.health-state
.health-state-up
.health-state-down
.url-cell
```

### Paso R5 - Revertir manifest, entorno y script

En `apps\mfe-admin\app\mfe\manifest\route.ts` quitar:

```text
salud-consolidada
```

En `apps\mfe-admin\.env.example` e `infra\env\frontend-app.env.example` quitar las variables:

```text
ADMIN_*_HEALTH_URL
```

En `scripts\start-frontend-dev.ps1` quitar:

```text
DocumentApiUrl
Join-UrlPath
ADMIN_*_HEALTH_URL dentro del ambiente de mfe-admin
```

## Guia manual desde cero

### Paso 1 - Entrar al proyecto

```powershell
cd C:\VENTA-DE-PASAJES
```

### Paso 2 - Confirmar que Dia 43 existe

```powershell
Test-Path .\apps\mfe-admin\package.json
Test-Path .\apps\mfe-admin\app\admin\embedded\page.tsx
Test-Path .\docs\dia-43-mfe-admin.md
```

Resultado esperado:

```text
True
True
True
```

### Paso 3 - Crear carpetas nuevas

```powershell
$Dia44Dirs = @(
  ".\apps\frontend-shell\app\api\health",
  ".\apps\mfe-admin\app\api\admin\health"
)

$Dia44Dirs | ForEach-Object {
  [System.IO.Directory]::CreateDirectory($_) | Out-Null
}
```

### Paso 4 - Crear archivos nuevos

Este paso no es un comando de PowerShell. Es la lista de archivos que deben existir y guardarse desde el editor:

```text
apps\frontend-shell\app\api\health\route.ts
apps\mfe-admin\app\api\admin\health\route.ts
```

Validar:

```powershell
Test-Path -LiteralPath .\apps\frontend-shell\app\api\health\route.ts
Test-Path -LiteralPath .\apps\mfe-admin\app\api\admin\health\route.ts
```

Resultado esperado:

```text
True
True
```

### Paso 5 - Actualizar configuracion local

Confirmar que `scripts\start-frontend-dev.ps1` incluye `DocumentApiUrl` y las variables `ADMIN_*_HEALTH_URL`:

```powershell
Select-String -Path .\scripts\start-frontend-dev.ps1 -Pattern "DocumentApiUrl","ADMIN_SHELL_HEALTH_URL","ADMIN_AUDIT_HEALTH_URL"
```

Confirmar que el `.env.example` de admin contiene las URLs:

```powershell
Select-String -Path .\apps\mfe-admin\.env.example -Pattern "ADMIN_MFE_TICKETING_HEALTH_URL","ADMIN_DOCUMENT_HEALTH_URL"
```

### Paso 6 - Validar typecheck

```powershell
npm run typecheck -w @venta-pasajes/mfe-admin
npm run typecheck -w @venta-pasajes/frontend-shell
npm run typecheck:frontend
```

Resultado validado:

```text
mfe-admin typecheck OK.
frontend-shell typecheck OK.
typecheck:frontend OK.
```

### Paso 7 - Validar build

```powershell
npm run build -w @venta-pasajes/mfe-admin
npm run build -w @venta-pasajes/frontend-shell
npm run build:frontend
```

Resultado validado:

```text
mfe-admin build OK.
frontend-shell build OK.
build:frontend OK.
```

Rutas generadas:

```text
mfe-admin:
/admin/embedded
/api/admin/health
/api/audit/[...path]
/api/health
/mfe/manifest

frontend-shell:
/
/api/health
```

### Paso 8 - Levantar frontends

Si no estan corriendo:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-frontend-dev.ps1
```

Si ya estan corriendo, no iniciar otra copia. Confirmar puertos:

```powershell
Get-NetTCPConnection -LocalPort 3000,3001,3002,3003,3004,3005 -ErrorAction SilentlyContinue |
  Select-Object LocalAddress,LocalPort,State,OwningProcess |
  Format-Table -AutoSize
```

### Paso 9 - Probar health consolidado

```powershell
curl.exe -s http://localhost:3000/api/health
curl.exe -s http://localhost:3005/api/health
curl.exe -s http://localhost:3005/api/admin/health
curl.exe -s -o NUL -w "%{http_code}" http://localhost:3005/admin/embedded
```

Resultado validado en esta practica:

```text
frontend-shell /api/health: 200.
mfe-admin /api/health: ok.
mfe-admin /api/admin/health: status=degraded.
mfe-admin /admin/embedded: 200.
frontends activos: 6/6.
backends activos: 0/6 porque no estaban levantados en 8081-8086.
```

Para ver el resumen en PowerShell:

```powershell
$Health = Invoke-RestMethod -Uri http://localhost:3005/api/admin/health
$Health.status
$Health.totals
```

### Paso 10 - Interpretar resultados

```text
status=up:
Todos los componentes monitoreados respondieron HTTP 2xx.

status=degraded:
Al menos un componente no respondio o devolvio un HTTP no exitoso.

HTTP vacio/null:
El componente no estaba escuchando, el puerto no estaba abierto o hubo timeout.
```

Si solo estan levantados los frontends, es normal ver:

```text
frontend_up=6
backend_up=0
status=degraded
```

Para que los backends aparezcan activos, levantar cada servicio Java con su base de datos siguiendo los dias correspondientes:

```text
Dia 17/18: identity-service
Dia 21-24: dispatch-service
Dia 27-31: ticketing-service
Dia 37: document-service
Dia 39: reporting-service
Dia 42: audit-service
```

## Troubleshooting

### curl devuelve 000

Sintoma:

```text
curl.exe -s -o NUL -w "%{http_code}" http://localhost:3005/api/admin/health
000
```

Causa:

```text
mfe-admin no esta corriendo en el puerto 3005.
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

Dejar esa terminal abierta.

### Typecheck falla en .next/types/validator.ts

Sintoma:

```text
Cannot find module '../../../app/api/admin/health/route.js'
Cannot find module '../../../app/api/health/route.js'
```

Causa:

```text
Next genero tipos para rutas nuevas, pero falta el archivo route.ts correspondiente.
Esto puede pasar si se creo la carpeta app\api\...\health pero no se guardo el route.ts.
```

Validar:

```powershell
Test-Path -LiteralPath .\apps\frontend-shell\app\api\health\route.ts
Test-Path -LiteralPath .\apps\mfe-admin\app\api\admin\health\route.ts
```

Resultado esperado:

```text
True
True
```

Despues de restaurar los archivos:

```powershell
npm run typecheck -w @venta-pasajes/mfe-admin
npm run typecheck -w @venta-pasajes/frontend-shell
npm run typecheck:frontend
```

### status degraded

No siempre es error. Significa que el visor funciono y encontro componentes caidos.

Ejemplo validado:

```text
Frontends 6/6 arriba.
Backends 0/6 abajo porque no estaban corriendo los servicios Java.
```

### El health de un backend apunta a otro puerto

Usar las variables:

```powershell
$env:ADMIN_AUDIT_HEALTH_URL = "http://localhost:18099/api/v1/audit/health"
npm run dev:mfe-admin
```

O iniciar todo con:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-frontend-dev.ps1 `
  -AuditApiUrl http://localhost:18099/api/v1/audit
```

## Validacion final

```text
npm run typecheck -w @venta-pasajes/mfe-admin: OK.
npm run typecheck -w @venta-pasajes/frontend-shell: OK.
npm run typecheck:frontend: OK.
npm run build -w @venta-pasajes/mfe-admin: OK.
npm run build -w @venta-pasajes/frontend-shell: OK.
npm run build:frontend: OK.
curl http://localhost:3005/api/health: OK.
curl http://localhost:3005/admin/embedded: HTTP 200.
curl http://localhost:3005/api/admin/health: OK, status degraded, frontends 6/6, backends 0/6.
```

## Siguiente paso natural

```text
Agregar acciones administrativas: reintentos operativos, catalogos de parametros o arranque/verificacion guiada de backends.
```
