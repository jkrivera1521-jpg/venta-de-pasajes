# Dia 45 - runbook operativo en mfe-admin

Fecha de ejecucion: 2026-09-17

## Objetivo

Agregar al `mfe-admin` una vista de runbook operativo para que, junto al visor de salud, el operador tenga comandos listos para verificar, levantar o diagnosticar cada componente.

Alcance del dia:

```text
Crear API administrativa /api/admin/runbook.
Registrar guias de frontend-shell, MFEs y backends.
Mostrar documentos relacionados por componente.
Mostrar comandos de verificacion y diagnostico.
Agregar boton para copiar comandos desde la UI.
Agregar pestana Runbook en mfe-admin.
Actualizar manifest y README de apps.
Validar typecheck, build y HTTP.
```

## Resultado logrado

```text
mfe-admin ahora expone GET /api/admin/runbook.
La pantalla admin tiene pestanas Salud, Runbook y Auditoria.
Runbook muestra 12 guias: 6 frontends y 6 backends.
Cada guia muestra health URL, puertos, documentos, comandos de verificacion y comandos de arranque/diagnostico.
Los comandos se pueden copiar desde la UI.
El manifest de mfe-admin declara la capacidad runbook-operativo.
```

## Archivos creados

```text
C:\VENTA-DE-PASAJES\apps\mfe-admin\app\api\admin\runbook\route.ts
C:\VENTA-DE-PASAJES\docs\dia-45-runbook-operativo-admin.md
```

## Archivos modificados

```text
C:\VENTA-DE-PASAJES\apps\mfe-admin\app\admin\embedded\page.tsx
C:\VENTA-DE-PASAJES\apps\mfe-admin\app\globals.css
C:\VENTA-DE-PASAJES\apps\mfe-admin\app\mfe\manifest\route.ts
C:\VENTA-DE-PASAJES\apps\README.md
C:\VENTA-DE-PASAJES\vitacora.md
```

## Endpoint agregado

```text
GET /api/admin/runbook
```

Respuesta resumida:

```json
{
  "total_items": 12,
  "items": [
    {
      "id": "mfe-admin",
      "group": "frontend",
      "health_url": "http://localhost:3005/api/health",
      "ports": [3005]
    }
  ]
}
```

## Reversa primero

Esta seccion sirve para deshacer el Dia 45 sin afectar la vista de Salud ni Auditoria.

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

### Paso R2 - Eliminar endpoint de runbook

```powershell
Remove-Item -LiteralPath .\apps\mfe-admin\app\api\admin\runbook\route.ts -Force
Remove-Item -LiteralPath .\apps\mfe-admin\app\api\admin\runbook -Recurse -Force -ErrorAction SilentlyContinue
```

No borrar `apps\mfe-admin\app\api\admin\health`, porque pertenece al Dia 44.

### Paso R3 - Revertir vista Runbook en la pantalla admin

En `apps\mfe-admin\app\admin\embedded\page.tsx` retirar:

```text
BookOpen y Copy de lucide-react.
AdminView = "runbook".
Tipos RunbookCommand, RunbookItem y RunbookResponse.
CommandList.
RunbookPanel.
Estado copiedCommand.
Query ["admin", "runbook"].
copyCommand.
Pestana Runbook.
Tarjetas de conteo del runbook.
Panel Runbook.
```

Conservar las vistas `Salud` y `Auditoria`.

### Paso R4 - Revertir estilos del runbook

En `apps\mfe-admin\app\globals.css` retirar:

```text
.runbook-grid
.runbook-card
.runbook-card-header
.runbook-meta
.runbook-section
.command-list
.command-row
.copy-button
```

### Paso R5 - Revertir manifest y README

En `apps\mfe-admin\app\mfe\manifest\route.ts` quitar:

```text
runbook-operativo
```

En `apps\README.md` quitar:

```text
Referencia a /api/admin/runbook.
curl.exe -s "http://localhost:3005/api/admin/runbook"
```

### Paso R6 - Validar reversa

```powershell
npm run typecheck -w @venta-pasajes/mfe-admin
npm run build -w @venta-pasajes/mfe-admin
```

Resultado esperado:

```text
typecheck OK.
build OK.
/api/admin/runbook ya no aparece en el listado de rutas del build.
```

## Guia manual desde cero

Esta guia no significa que el archivo deba crearse otra vez en este momento. En este workspace el Dia 45 ya esta implementado. Los pasos siguientes son una receta de reconstruccion para una maquina limpia, una reversa aplicada previamente o una practica donde se quiera rehacer el cambio desde cero.

Para solo comprobar que ya existe:

```powershell
Test-Path -LiteralPath .\apps\mfe-admin\app\api\admin\runbook\route.ts
curl.exe -s http://localhost:3005/api/admin/runbook
```

Resultado esperado:

```text
True
JSON con generated_at, items y total_items.
```

### Paso 1 - Entrar al proyecto

```powershell
cd C:\VENTA-DE-PASAJES
```

### Paso 2 - Confirmar prerequisito Dia 44

```powershell
Test-Path -LiteralPath .\apps\mfe-admin\app\api\admin\health\route.ts
Test-Path -LiteralPath .\docs\dia-44-visor-salud-admin.md
```

Resultado esperado:

```text
True
True
```

### Paso 3 - Crear carpeta del endpoint

```powershell
[System.IO.Directory]::CreateDirectory(".\apps\mfe-admin\app\api\admin\runbook") | Out-Null
```

### Paso 4 - Crear route.ts del runbook, solo si no existe

En una instalacion limpia, o si se aplico la reversa, crear el archivo:

```text
apps\mfe-admin\app\api\admin\runbook\route.ts
```

Si `Test-Path` ya devuelve `True`, no recrear el archivo; continuar con la validacion del endpoint.

El endpoint debe devolver:

```text
generated_at
items
total_items
```

Cada item debe tener:

```text
id
name
group
ports
health_url
docs
verify_commands
start_commands
```

Validar existencia:

```powershell
Test-Path -LiteralPath .\apps\mfe-admin\app\api\admin\runbook\route.ts
```

### Paso 5 - Actualizar pantalla admin

En `apps\mfe-admin\app\admin\embedded\page.tsx` agregar:

```text
Pestana Runbook.
Query a /api/admin/runbook.
Tarjetas de total, frontends, backends y actualizado.
Panel con tarjetas por componente.
Boton Copiar para comandos.
```

La pantalla debe mantener:

```text
Salud.
Runbook.
Auditoria.
```

### Paso 6 - Actualizar estilos

En `apps\mfe-admin\app\globals.css` agregar estilos para:

```text
runbook-grid
runbook-card
runbook-meta
command-row
copy-button
```

### Paso 7 - Actualizar contrato del MFE

En `apps\mfe-admin\app\mfe\manifest\route.ts`, agregar capacidad:

```text
runbook-operativo
```

Validar:

```powershell
Select-String -Path .\apps\mfe-admin\app\mfe\manifest\route.ts -Pattern "runbook-operativo"
```

### Paso 8 - Validar typecheck

```powershell
npm run typecheck -w @venta-pasajes/mfe-admin
npm run typecheck:frontend
```

Resultado validado:

```text
mfe-admin typecheck OK.
typecheck:frontend OK.
```

### Paso 9 - Validar build

```powershell
npm run build -w @venta-pasajes/mfe-admin
npm run build:frontend
```

Resultado validado:

```text
mfe-admin build OK.
build:frontend OK.
```

El build de `mfe-admin` debe listar:

```text
/api/admin/health
/api/admin/runbook
/api/audit/[...path]
/api/health
/mfe/manifest
/admin/embedded
```

### Paso 10 - Validar HTTP

Si `mfe-admin` ya esta corriendo en `3005`, usarlo. Si no:

```powershell
npm run dev:mfe-admin
```

En otra terminal:

```powershell
curl.exe -s http://localhost:3005/api/admin/runbook
curl.exe -s -o NUL -w "%{http_code}" http://localhost:3005/admin/embedded
curl.exe -s http://localhost:3005/mfe/manifest
```

Resultado validado:

```text
/api/admin/runbook: total_items=12.
/admin/embedded: HTTP 200.
/mfe/manifest: contiene runbook-operativo.
```

Resumen validado con PowerShell:

```powershell
$Runbook = Invoke-RestMethod -Uri http://localhost:3005/api/admin/runbook
[pscustomobject]@{
  Total = $Runbook.total_items
  Frontends = ($Runbook.items | Where-Object group -eq 'frontend').Count
  Backends = ($Runbook.items | Where-Object group -eq 'backend').Count
  HasAudit = [bool]($Runbook.items | Where-Object id -eq 'audit-service')
  HasAdmin = [bool]($Runbook.items | Where-Object id -eq 'mfe-admin')
} | Format-Table -AutoSize
```

Resultado validado:

```text
Total=12
Frontends=6
Backends=6
HasAudit=True
HasAdmin=True
```

### Paso 11 - Validar documentos referenciados

```powershell
$content = Get-Content .\apps\mfe-admin\app\api\admin\runbook\route.ts -Raw
$matches = [regex]::Matches($content, 'docs\\\\[^"\]]+?\.md') |
  ForEach-Object { $_.Value } |
  Sort-Object -Unique

$matches |
  ForEach-Object {
    [pscustomobject]@{
      Path = $_
      Exists = Test-Path -LiteralPath $_
    }
  } |
  Format-Table -AutoSize
```

Resultado validado:

```text
Todos los documentos referenciados existen.
```

## Troubleshooting

### El boton Copiar no copia

El boton usa `navigator.clipboard`. En navegadores modernos funciona en `localhost` y contextos seguros.

Si no copia:

```text
Seleccionar el texto del comando manualmente.
Verificar que se esta usando http://localhost:3005 y no un origen bloqueado.
```

### /api/admin/runbook responde 404

Validar:

```powershell
Test-Path -LiteralPath .\apps\mfe-admin\app\api\admin\runbook\route.ts
npm run build -w @venta-pasajes/mfe-admin
```

Si el build no lista `/api/admin/runbook`, revisar la ubicacion del archivo.

Si `curl.exe -s http://localhost:3005/api/admin/runbook` no muestra nada, quitar `-s` o validar primero si el servidor esta levantado:

```powershell
Get-NetTCPConnection -LocalPort 3005 -ErrorAction SilentlyContinue |
  Select-Object LocalAddress,LocalPort,State,OwningProcess
```

Si no hay salida, arrancar `mfe-admin`:

```powershell
npm run dev:mfe-admin
```

### Un documento del runbook no existe

Ejecutar el Paso 11 y corregir el nombre del archivo en:

```text
apps\mfe-admin\app\api\admin\runbook\route.ts
```

## Correccion posterior por archivo faltante

Durante una revision manual, `Test-Path` devolvio `False` para:

```text
apps\mfe-admin\app\api\admin\runbook\route.ts
```

Accion aplicada:

```text
Se restauro el archivo route.ts del endpoint /api/admin/runbook.
Se valido typecheck de mfe-admin.
Se levanto mfe-admin en localhost:3005.
Se valido /api/admin/runbook con total_items=12.
Se valido /admin/embedded con HTTP 200.
Se valido build de mfe-admin y Next listo /api/admin/runbook como ruta dinamica.
```

## Validacion final

```text
npm run typecheck -w @venta-pasajes/mfe-admin: OK.
npm run build -w @venta-pasajes/mfe-admin: OK.
npm run typecheck:frontend: OK.
npm run build:frontend: OK.
curl http://localhost:3005/api/admin/runbook: OK.
curl http://localhost:3005/admin/embedded: HTTP 200.
curl http://localhost:3005/mfe/manifest: OK, contiene runbook-operativo.
Runbook total_items=12, frontends=6, backends=6.
Todos los documentos referenciados existen.
```

## Siguiente paso natural

```text
Agregar una vista de parametros administrativos o un checklist guiado para levantar backends con estado paso a paso.
```
