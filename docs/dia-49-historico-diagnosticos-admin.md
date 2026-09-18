# Dia 49 - historico local de diagnosticos en mfe-admin

Fecha de ejecucion: 2026-09-17

## Objetivo

Agregar al `mfe-admin` un historial local de diagnosticos administrativos para guardar snapshots JSON, listar archivos previos y comparar el ultimo diagnostico contra el anterior.

Alcance del dia:

```text
Crear API administrativa /api/admin/diagnostic-history.
Permitir GET para listar snapshots guardados.
Permitir POST para generar y guardar un snapshot nuevo desde diagnostic-export.
Agregar boton Guardar snapshot en la pestana Diagnostico.
Mostrar cantidad de snapshots, ultimo archivo, archivo anterior y delta de errores.
Actualizar manifest y README de apps.
Validar existencia real de rutas, typecheck, build y HTTP.
```

## Resultado logrado

```text
mfe-admin expone GET /api/admin/diagnostic-history.
mfe-admin expone POST /api/admin/diagnostic-history.
Los snapshots se guardan por defecto en C:\VENTA-DE-PASAJES\logs\admin-diagnostics.
La pestana Diagnostico permite guardar snapshots desde la UI.
La pantalla muestra los ultimos snapshots guardados y compara el ultimo contra el anterior.
El manifest de mfe-admin declara la capacidad diagnostico-historico.
```

## Archivos creados

```text
C:\VENTA-DE-PASAJES\apps\mfe-admin\app\api\admin\diagnostic-history\route.ts
C:\VENTA-DE-PASAJES\docs\dia-49-historico-diagnosticos-admin.md
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
GET  /api/admin/diagnostic-history
POST /api/admin/diagnostic-history
```

`GET` devuelve:

```json
{
  "directory": "C:\\VENTA-DE-PASAJES\\logs\\admin-diagnostics",
  "total_snapshots": 2,
  "latest": {
    "file_name": "admin-diagnostic-2026-09-17T10-00-00-000Z.json",
    "summary": {
      "total_sections": 5,
      "ok_sections": 5,
      "failed_sections": 0
    }
  },
  "comparison": {
    "deltas": {
      "failed_sections": 0,
      "ok_sections": 0
    }
  }
}
```

`POST` genera un diagnostico usando `/api/admin/diagnostic-export` y lo guarda como archivo local.

## Reversa primero

Esta seccion sirve para deshacer el Dia 49 sin afectar Salud, Arranque, Runbook, Parametros, Diagnostico exportable ni Auditoria.

### Paso 1 - Ir al proyecto

```powershell
$ProjectRoot = "C:\VENTA-DE-PASAJES"
Set-Location $ProjectRoot
```

### Paso 2 - Eliminar endpoint de historial

```powershell
Remove-Item -LiteralPath "$ProjectRoot\apps\mfe-admin\app\api\admin\diagnostic-history" -Recurse -Force
```

### Paso 3 - Revertir UI de diagnostico

En el archivo:

```text
C:\VENTA-DE-PASAJES\apps\mfe-admin\app\admin\embedded\page.tsx
```

Retirar:

```text
Tipos DiagnosticHistorySummary, DiagnosticHistorySnapshot, DiagnosticHistoryComparison, DiagnosticHistoryResponse y DiagnosticHistoryCreateResponse.
Query diagnosticHistory.
Mutation saveDiagnosticSnapshot.
Propiedades history, onSaveSnapshot y savingSnapshot de DiagnosticPanel.
Tarjeta Historico local y tarjetas de snapshots.
Refresco diagnosticHistory.refetch().
Tarjeta superior Historial.
```

Dejar nuevamente la tarjeta superior de Diagnostico con la fecha generada:

```tsx
<Activity size={18} aria-hidden="true" />
<span>Generado</span>
<strong>{formatDateTime(diagnosticExport.data?.generated_at)}</strong>
```

### Paso 4 - Revertir estilos

En:

```text
C:\VENTA-DE-PASAJES\apps\mfe-admin\app\globals.css
```

Eliminar si se desea:

```css
.diagnostic-actions {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.copy-button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}
```

### Paso 5 - Revertir manifest y README

En:

```text
C:\VENTA-DE-PASAJES\apps\mfe-admin\app\mfe\manifest\route.ts
```

Eliminar:

```text
diagnostico-historico
```

En:

```text
C:\VENTA-DE-PASAJES\apps\README.md
```

Eliminar las referencias a:

```text
/api/admin/diagnostic-history
```

### Paso 6 - Eliminar snapshots generados

Solo si tambien se quiere borrar el historial local creado durante la practica:

```powershell
Remove-Item -LiteralPath "$ProjectRoot\logs\admin-diagnostics" -Recurse -Force
```

### Paso 7 - Validar reversa

```powershell
npm run typecheck -w @venta-pasajes/mfe-admin
npm run build -w @venta-pasajes/mfe-admin

Test-Path -LiteralPath "$ProjectRoot\apps\mfe-admin\app\api\admin\diagnostic-history\route.ts"
Select-String -Path "$ProjectRoot\apps\mfe-admin\app\mfe\manifest\route.ts" -Pattern "diagnostico-historico"
```

Resultado esperado de los dos ultimos comandos despues de reversar:

```text
False
Sin resultados para diagnostico-historico.
```

## Guia manual desde cero

> Importante: ejecutar estos comandos desde PowerShell. Si la consola esta en `C:\Windows\system32`, primero ejecutar el Paso 1.

### Paso 1 - Ubicarse en el proyecto

```powershell
$ProjectRoot = "C:\VENTA-DE-PASAJES"
Set-Location $ProjectRoot
```

Confirmar ubicacion:

```powershell
Get-Location
```

Debe responder:

```text
C:\VENTA-DE-PASAJES
```

### Paso 2 - Verificar rutas base reales

```powershell
@(
  "$ProjectRoot\apps\mfe-admin\app\api\admin\health\route.ts",
  "$ProjectRoot\apps\mfe-admin\app\api\admin\runbook\route.ts",
  "$ProjectRoot\apps\mfe-admin\app\api\admin\startup-checklist\route.ts",
  "$ProjectRoot\apps\mfe-admin\app\api\admin\runtime-config\route.ts",
  "$ProjectRoot\apps\mfe-admin\app\api\admin\diagnostic-export\route.ts",
  "$ProjectRoot\apps\mfe-admin\app\api\admin\diagnostic-history\route.ts"
) | ForEach-Object {
  [pscustomobject]@{
    Path = $_
    Exists = Test-Path -LiteralPath $_
  }
} | Format-Table -AutoSize
```

Todas deben responder `Exists=True`.

### Paso 3 - Validar capacidad en manifest

```powershell
Select-String -Path "$ProjectRoot\apps\mfe-admin\app\mfe\manifest\route.ts" -Pattern "diagnostico-historico"
```

### Paso 4 - Ejecutar typecheck y build del MFE admin

```powershell
npm run typecheck -w @venta-pasajes/mfe-admin
npm run build -w @venta-pasajes/mfe-admin
```

### Paso 5 - Levantar mfe-admin

Si no esta corriendo en el puerto `3005`:

```powershell
npm run dev:mfe-admin
```

Dejar esa consola abierta. En otra consola:

```powershell
$ProjectRoot = "C:\VENTA-DE-PASAJES"
Set-Location $ProjectRoot
```

### Paso 6 - Validar endpoint de historial

```powershell
curl.exe -s -o NUL -w "%{http_code}" "http://localhost:3005/api/admin/diagnostic-history"
```

Debe responder:

```text
200
```

Ver historial:

```powershell
curl.exe -s "http://localhost:3005/api/admin/diagnostic-history"
```

### Paso 7 - Guardar snapshots

Guardar primer snapshot:

```powershell
curl.exe -s -X POST "http://localhost:3005/api/admin/diagnostic-history"
```

Guardar segundo snapshot para probar comparacion:

```powershell
Start-Sleep -Milliseconds 1200
curl.exe -s -X POST "http://localhost:3005/api/admin/diagnostic-history"
```

### Paso 8 - Confirmar archivos creados

```powershell
Get-ChildItem -LiteralPath "$ProjectRoot\logs\admin-diagnostics" -Filter "admin-diagnostic-*.json" |
  Select-Object Name, Length, LastWriteTime |
  Format-Table -AutoSize
```

### Paso 9 - Revisar resumen del historial

```powershell
$History = curl.exe -s "http://localhost:3005/api/admin/diagnostic-history" | ConvertFrom-Json
$History.total_snapshots
$History.latest.file_name
$History.previous.file_name
$History.comparison.deltas
```

### Paso 10 - Validar manifest por HTTP

```powershell
$Manifest = curl.exe -s "http://localhost:3005/mfe/manifest" | ConvertFrom-Json
$Manifest.capabilities
```

Debe incluir:

```text
diagnostico-exportable
diagnostico-historico
```

### Paso 11 - Validar frontend completo

```powershell
npm run typecheck:frontend
npm run build:frontend
```

## Comandos de validacion ejecutados

```powershell
Test-Path -LiteralPath .\apps\mfe-admin\app\api\admin\diagnostic-history\route.ts
Select-String -Path .\apps\mfe-admin\app\mfe\manifest\route.ts -Pattern "diagnostico-historico"
npm run typecheck -w @venta-pasajes/mfe-admin
npm run build -w @venta-pasajes/mfe-admin
npm run typecheck:frontend
npm run build:frontend
curl.exe -s -o NUL -w "%{http_code}" http://localhost:3005/api/admin/diagnostic-history
curl.exe -s -X POST http://localhost:3005/api/admin/diagnostic-history
curl.exe -s http://localhost:3005/api/admin/diagnostic-history
curl.exe -s http://localhost:3005/mfe/manifest
```

Resultados observados:

```text
diagnostic-history route.ts existe.
manifest contiene diagnostico-historico.
mfe-admin typecheck OK.
mfe-admin build OK.
build de mfe-admin incluye /api/admin/diagnostic-history.
typecheck:frontend OK.
build:frontend OK.
/api/admin/diagnostic-history respondio HTTP 200.
POST /api/admin/diagnostic-history creo snapshots JSON.
total_snapshots=2.
latest=admin-diagnostic-2026-09-17T21-44-00-246Z.json.
previous=admin-diagnostic-2026-09-17T21-43-52-231Z.json.
comparison.deltas.failed_sections=0.
comparison.deltas.ok_sections=0.
manifest HTTP contiene diagnostico-exportable y diagnostico-historico.
Se validaron rutas absolutas desde C:\Windows\system32 con Exists=True.
```

## Troubleshooting

### Error: ruta no existe desde C:\Windows\system32

Ejecutar:

```powershell
$ProjectRoot = "C:\VENTA-DE-PASAJES"
Set-Location $ProjectRoot
```

Luego repetir el comando usando rutas con `$ProjectRoot`.

### Error: curl devuelve 000

Significa que `mfe-admin` no esta escuchando en `3005`.

```powershell
npm run dev:mfe-admin
```

### Error: puerto 3005 ocupado

Revisar proceso:

```powershell
Get-NetTCPConnection -LocalPort 3005 -ErrorAction SilentlyContinue |
  Select-Object LocalAddress, LocalPort, State, OwningProcess |
  Format-Table -AutoSize
```

Si corresponde a un proceso viejo del frontend:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\stop-frontend-dev.ps1
```

### Cambiar carpeta de snapshots

Por defecto se usa:

```text
C:\VENTA-DE-PASAJES\logs\admin-diagnostics
```

Se puede cambiar con la variable:

```powershell
$env:ADMIN_DIAGNOSTIC_DIR = "C:\VENTA-DE-PASAJES\logs\admin-diagnostics-local"
npm run dev:mfe-admin
```
