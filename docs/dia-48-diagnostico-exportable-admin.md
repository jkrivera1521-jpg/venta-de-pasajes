# Dia 48 - diagnostico exportable en mfe-admin

Fecha de ejecucion: 2026-09-17

## Objetivo

Agregar al `mfe-admin` una exportacion consolidada de diagnostico administrativo para reunir salud, runbook, arranque, parametros y manifest en un solo JSON.

Alcance del dia:

```text
Crear API administrativa /api/admin/diagnostic-export.
Agregar pestana Diagnostico en mfe-admin.
Mostrar resumen de secciones OK/error.
Mostrar comandos copiables para ver o guardar el JSON.
Actualizar manifest y README de apps.
Validar existencia real de rutas, typecheck, build y HTTP.
```

## Resultado logrado

```text
mfe-admin expone GET /api/admin/diagnostic-export.
La pantalla admin tiene pestanas Salud, Arranque, Runbook, Parametros, Diagnostico y Auditoria.
Diagnostico muestra manifest, health, runbook, startup-checklist y runtime-config.
Cada seccion queda marcada como OK o Error.
El manifest de mfe-admin declara la capacidad diagnostico-exportable.
```

## Archivos creados

```text
C:\VENTA-DE-PASAJES\apps\mfe-admin\app\api\admin\diagnostic-export\route.ts
C:\VENTA-DE-PASAJES\docs\dia-48-diagnostico-exportable-admin.md
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
GET /api/admin/diagnostic-export
```

Respuesta resumida:

```json
{
  "summary": {
    "total_sections": 5,
    "ok_sections": 5,
    "failed_sections": 0,
    "runbook_items": 12,
    "startup_steps": 14,
    "runtime_config_items": 16
  },
  "sections": {
    "health": {
      "ok": true,
      "status": 200
    }
  }
}
```

## Reversa primero

Esta seccion sirve para deshacer el Dia 48 sin afectar Salud, Arranque, Runbook, Parametros ni Auditoria.

### Paso 1 - Eliminar endpoint

Eliminar:

```text
C:\VENTA-DE-PASAJES\apps\mfe-admin\app\api\admin\diagnostic-export\route.ts
```

Y si queda vacia, eliminar:

```text
C:\VENTA-DE-PASAJES\apps\mfe-admin\app\api\admin\diagnostic-export
```

### Paso 2 - Revertir pantalla admin

En `apps\mfe-admin\app\admin\embedded\page.tsx` quitar:

```text
AdminView diagnostic.
Icono Download si solo se uso para Diagnostico.
Tipos DiagnosticSection y DiagnosticExportResponse.
Componente DiagnosticPanel.
Query admin/diagnostic-export.
Pestana Diagnostico.
Tarjetas Secciones, OK, Errores y Generado.
Render del panel Diagnostico administrativo.
```

### Paso 3 - Revertir estilos

En `apps\mfe-admin\app\globals.css` quitar:

```text
diagnostic-grid
diagnostic-card
diagnostic-card-wide
diagnostic-card-header
diagnostic-state
diagnostic-state-ok
diagnostic-state-error
diagnostic-state-pending
```

### Paso 4 - Revertir manifest y README

En `apps\mfe-admin\app\mfe\manifest\route.ts`, quitar:

```text
diagnostico-exportable
```

En `apps\README.md`, quitar:

```text
/api/admin/diagnostic-export
```

### Paso 5 - Validar reversa

```powershell
cd C:\VENTA-DE-PASAJES
npm run typecheck -w @venta-pasajes/mfe-admin
npm run build -w @venta-pasajes/mfe-admin
```

Resultado esperado:

```text
typecheck OK.
build OK.
/api/admin/diagnostic-export ya no aparece en el listado de rutas del build.
```

## Guia manual desde cero

Esta guia no significa que los archivos deban crearse otra vez en este workspace. El Dia 48 ya esta implementado. Los pasos siguientes sirven para una maquina limpia, una reversa aplicada previamente o una practica donde se quiera rehacer el cambio desde cero.

Importante: si PowerShell muestra `PS C:\Windows\system32>`, primero moverse al proyecto.

```powershell
cd C:\VENTA-DE-PASAJES
```

Para confirmar el estado actual desde cualquier carpeta:

```powershell
$ProjectRoot = "C:\VENTA-DE-PASAJES"
Set-Location $ProjectRoot

Test-Path -LiteralPath "$ProjectRoot\apps\mfe-admin\app\api\admin\diagnostic-export\route.ts"
Select-String -Path "$ProjectRoot\apps\mfe-admin\app\mfe\manifest\route.ts" -Pattern "diagnostico-exportable"
```

Resultado esperado:

```text
True
Linea del manifest con diagnostico-exportable.
```

### Paso 1 - Confirmar prerequisitos

```powershell
$ProjectRoot = "C:\VENTA-DE-PASAJES"
Set-Location $ProjectRoot

@(
  "$ProjectRoot\apps\mfe-admin\app\api\admin\health\route.ts",
  "$ProjectRoot\apps\mfe-admin\app\api\admin\runbook\route.ts",
  "$ProjectRoot\apps\mfe-admin\app\api\admin\startup-checklist\route.ts",
  "$ProjectRoot\apps\mfe-admin\app\api\admin\runtime-config\route.ts"
) |
  ForEach-Object {
    [pscustomobject]@{
      Path = $_
      Exists = Test-Path -LiteralPath $_
    }
  } |
  Format-Table -AutoSize
```

Resultado esperado:

```text
Todas las rutas Exists=True.
```

### Paso 2 - Crear carpeta del endpoint, solo si no existe

```powershell
$ProjectRoot = "C:\VENTA-DE-PASAJES"
[System.IO.Directory]::CreateDirectory("$ProjectRoot\apps\mfe-admin\app\api\admin\diagnostic-export") | Out-Null
```

### Paso 3 - Crear route.ts de diagnostic-export, solo si no existe

Archivo:

```text
apps\mfe-admin\app\api\admin\diagnostic-export\route.ts
```

El endpoint debe consultar:

```text
/mfe/manifest
/api/admin/health
/api/admin/runbook
/api/admin/startup-checklist
/api/admin/runtime-config
```

Debe devolver:

```text
generated_at
sections
summary
```

Validar existencia:

```powershell
$ProjectRoot = "C:\VENTA-DE-PASAJES"
Test-Path -LiteralPath "$ProjectRoot\apps\mfe-admin\app\api\admin\diagnostic-export\route.ts"
```

### Paso 4 - Actualizar pantalla admin

En `apps\mfe-admin\app\admin\embedded\page.tsx` agregar:

```text
Pestana Diagnostico.
Query a /api/admin/diagnostic-export.
Tarjetas de secciones, OK, errores y generado.
Panel con secciones y estados.
Comandos copiables para ver o guardar JSON.
Boton Exportar.
```

La pantalla debe mantener:

```text
Salud.
Arranque.
Runbook.
Parametros.
Diagnostico.
Auditoria.
```

### Paso 5 - Actualizar estilos

En `apps\mfe-admin\app\globals.css` agregar estilos para:

```text
diagnostic-grid
diagnostic-card
diagnostic-state
```

### Paso 6 - Actualizar contrato del MFE

En `apps\mfe-admin\app\mfe\manifest\route.ts`, agregar capacidad:

```text
diagnostico-exportable
```

Validar:

```powershell
$ProjectRoot = "C:\VENTA-DE-PASAJES"
Select-String -Path "$ProjectRoot\apps\mfe-admin\app\mfe\manifest\route.ts" -Pattern "diagnostico-exportable"
```

### Paso 7 - Actualizar README de apps

En `apps\README.md`, agregar:

```text
curl.exe -s "http://localhost:3005/api/admin/diagnostic-export"
```

### Paso 8 - Validar typecheck y build

```powershell
cd C:\VENTA-DE-PASAJES
npm run typecheck -w @venta-pasajes/mfe-admin
npm run build -w @venta-pasajes/mfe-admin
```

Resultado esperado:

```text
typecheck OK.
build OK.
Next lista /api/admin/diagnostic-export.
```

### Paso 9 - Levantar mfe-admin si no esta activo

```powershell
Get-NetTCPConnection -LocalPort 3005 -ErrorAction SilentlyContinue |
  Select-Object LocalAddress,LocalPort,State,OwningProcess
```

Si no hay salida:

```powershell
npm run dev:mfe-admin
```

### Paso 10 - Validar HTTP

```powershell
curl.exe -s -o NUL -w "%{http_code}" http://localhost:3005/api/admin/diagnostic-export

$Diagnostic = curl.exe -s http://localhost:3005/api/admin/diagnostic-export | ConvertFrom-Json
[pscustomobject]@{
  total_sections = $Diagnostic.summary.total_sections
  ok_sections = $Diagnostic.summary.ok_sections
  failed_sections = $Diagnostic.summary.failed_sections
  runbook_items = $Diagnostic.summary.runbook_items
  startup_steps = $Diagnostic.summary.startup_steps
  runtime_config_items = $Diagnostic.summary.runtime_config_items
}
```

Resultado esperado:

```text
HTTP 200.
total_sections=5.
ok_sections=5.
failed_sections=0.
runbook_items=12.
startup_steps=14.
runtime_config_items=16.
```

### Paso 11 - Guardar diagnostico en archivo

```powershell
$ProjectRoot = "C:\VENTA-DE-PASAJES"
Set-Location $ProjectRoot
New-Item -ItemType Directory -Force -Path "$ProjectRoot\logs" | Out-Null
curl.exe -s http://localhost:3005/api/admin/diagnostic-export -o "$ProjectRoot\logs\admin-diagnostic.json"
Test-Path -LiteralPath "$ProjectRoot\logs\admin-diagnostic.json"
```

Resultado esperado:

```text
True
```

## Troubleshooting

### curl devuelve 000

Significa que no hay servidor escuchando en el puerto 3005.

```powershell
Get-NetTCPConnection -LocalPort 3005 -ErrorAction SilentlyContinue
```

Si no hay salida:

```powershell
npm run dev:mfe-admin
```

### Una seccion aparece con Error

El endpoint exporta igual el JSON. Revisar el campo:

```text
sections.<nombre>.error
```

Las secciones consultadas son:

```text
manifest
health
runbook
startup_checklist
runtime_config
```

### El JSON no se guarda en logs

Crear la carpeta primero:

```powershell
New-Item -ItemType Directory -Force -Path C:\VENTA-DE-PASAJES\logs | Out-Null
```

## Validacion final

```text
Test-Path diagnostic-export route.ts: True.
Select-String diagnostico-exportable: OK.
npm run typecheck -w @venta-pasajes/mfe-admin: OK.
npm run build -w @venta-pasajes/mfe-admin: OK.
Next listo /api/admin/diagnostic-export.
curl /api/admin/diagnostic-export: HTTP 200.
/api/admin/diagnostic-export: total_sections=5, ok_sections=5, failed_sections=0.
runbook_items=12.
startup_steps=14.
runtime_config_items=16.
/admin/embedded: HTTP 200.
/mfe/manifest: contiene diagnostico-exportable y parametros-operativos.
```

## Siguiente paso natural

```text
Agregar descarga historica o persistencia local del diagnostico para comparar snapshots entre dias.
```
