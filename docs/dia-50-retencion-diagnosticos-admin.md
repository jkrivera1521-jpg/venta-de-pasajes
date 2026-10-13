# Dia 50 - retencion segura de diagnosticos en mfe-admin

Fecha de ejecucion: 2026-09-17

## Objetivo

Agregar al `mfe-admin` una limpieza segura del historico local de diagnosticos para conservar los snapshots mas recientes y evitar crecimiento indefinido de archivos JSON.

Alcance del dia:

```text
Extender /api/admin/diagnostic-history con metodo DELETE.
Permitir simulacion de limpieza con dry_run=true.
Permitir limpieza real con dry_run=false.
Conservar por defecto los ultimos 20 snapshots.
Agregar acciones de simulacion y limpieza en la pestana Diagnostico.
Actualizar manifest y README de apps.
Validar existencia real de rutas, typecheck, build y HTTP.
```

## Resultado logrado

```text
mfe-admin soporta DELETE /api/admin/diagnostic-history.
La limpieza usa keep=20 por defecto.
El modo dry_run=true es el comportamiento seguro por defecto.
La UI permite simular limpieza antes de eliminar archivos.
La UI pide confirmacion antes de ejecutar limpieza real.
El manifest de mfe-admin declara la capacidad diagnostico-retencion.
```

## Archivos modificados

```text
C:\VENTA-DE-PASAJES\apps\mfe-admin\app\api\admin\diagnostic-history\route.ts
C:\VENTA-DE-PASAJES\apps\mfe-admin\app\admin\embedded\page.tsx
C:\VENTA-DE-PASAJES\apps\mfe-admin\app\mfe\manifest\route.ts
C:\VENTA-DE-PASAJES\apps\README.md
C:\VENTA-DE-PASAJES\vitacora.md
```

## Archivo creado

```text
C:\VENTA-DE-PASAJES\docs\dia-50-retencion-diagnosticos-admin.md
```

## Endpoint extendido

```text
DELETE /api/admin/diagnostic-history?keep=20&dry_run=true
DELETE /api/admin/diagnostic-history?keep=20&dry_run=false
```

Parametros:

```text
keep: cantidad de snapshots recientes que se conservan. Minimo 1, maximo 100, default 20.
dry_run: si no se envia o es distinto de false, solo simula la limpieza.
```

Respuesta resumida:

```json
{
  "dry_run": true,
  "keep": 20,
  "candidate_count": 0,
  "deleted_count": 0,
  "remaining_count": 2,
  "snapshots": []
}
```

## Reversa primero

Esta seccion sirve para deshacer el Dia 50 sin eliminar el endpoint de historial creado en el Dia 49.

### Paso 1 - Ir al proyecto

```powershell
$ProjectRoot = "C:\VENTA-DE-PASAJES"
Set-Location $ProjectRoot
```

### Paso 2 - Revertir metodo DELETE del endpoint

En:

```text
C:\VENTA-DE-PASAJES\apps\mfe-admin\app\api\admin\diagnostic-history\route.ts
```

Quitar:

```text
Import unlink desde node:fs/promises.
Constante defaultRetentionKeep.
Funciones parseKeep y parseDryRun.
Funcion export async function DELETE(request: Request).
```

Mantener:

```text
GET /api/admin/diagnostic-history.
POST /api/admin/diagnostic-history.
```

### Paso 3 - Revertir acciones visuales

En:

```text
C:\VENTA-DE-PASAJES\apps\mfe-admin\app\admin\embedded\page.tsx
```

Retirar:

```text
Tipo DiagnosticHistoryCleanupResponse.
Props cleanupResult, cleaningHistory, onPreviewCleanup y onCleanupHistory de DiagnosticPanel.
Comandos DELETE del arreglo historyCommands.
Botones Simular limpieza y Limpiar antiguos.
Mutation previewDiagnosticCleanup.
Mutation cleanupDiagnosticHistory.
Variables diagnosticCleanupResult y diagnosticCleanupPending.
Confirmacion window.confirm para limpieza.
```

### Paso 4 - Revertir manifest y README

En:

```text
C:\VENTA-DE-PASAJES\apps\mfe-admin\app\mfe\manifest\route.ts
```

Eliminar:

```text
diagnostico-retencion
```

En:

```text
C:\VENTA-DE-PASAJES\apps\README.md
```

Eliminar la referencia a:

```text
DELETE /api/admin/diagnostic-history?keep=20&dry_run=true|false
```

### Paso 5 - Validar reversa

```powershell
npm run typecheck -w @venta-pasajes/mfe-admin
npm run build -w @venta-pasajes/mfe-admin

Select-String -Path "$ProjectRoot\apps\mfe-admin\app\api\admin\diagnostic-history\route.ts" -Pattern "export async function DELETE"
Select-String -Path "$ProjectRoot\apps\mfe-admin\app\mfe\manifest\route.ts" -Pattern "diagnostico-retencion"
```

Resultado esperado despues de reversar:

```text
Sin resultados para DELETE.
Sin resultados para diagnostico-retencion.
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

### Paso 2 - Verificar rutas reales

```powershell
@(
  "$ProjectRoot\apps\mfe-admin\app\api\admin\diagnostic-history\route.ts",
  "$ProjectRoot\apps\mfe-admin\app\api\admin\diagnostic-export\route.ts",
  "$ProjectRoot\apps\mfe-admin\app\admin\embedded\page.tsx",
  "$ProjectRoot\apps\mfe-admin\app\mfe\manifest\route.ts"
) | ForEach-Object {
  [pscustomobject]@{
    Path = $_
    Exists = Test-Path -LiteralPath $_
  }
} | Format-Table -AutoSize
```

Todas deben responder `Exists=True`.

### Paso 3 - Validar que el endpoint tenga DELETE

```powershell
Select-String -Path "$ProjectRoot\apps\mfe-admin\app\api\admin\diagnostic-history\route.ts" -Pattern "export async function DELETE"
```

### Paso 4 - Validar capacidad en manifest

```powershell
Select-String -Path "$ProjectRoot\apps\mfe-admin\app\mfe\manifest\route.ts" -Pattern "diagnostico-retencion"
```

### Paso 5 - Ejecutar typecheck y build del MFE admin

```powershell
npm run typecheck -w @venta-pasajes/mfe-admin
npm run build -w @venta-pasajes/mfe-admin
```

### Paso 6 - Levantar mfe-admin

Si no esta corriendo en el puerto `3005`:

```powershell
npm run dev:mfe-admin
```

Dejar esa consola abierta. En otra consola:

```powershell
$ProjectRoot = "C:\VENTA-DE-PASAJES"
Set-Location $ProjectRoot
```

### Paso 7 - Crear snapshots de prueba si no existen

```powershell
curl.exe -s -X POST "http://localhost:3005/api/admin/diagnostic-history"
Start-Sleep -Milliseconds 1200
curl.exe -s -X POST "http://localhost:3005/api/admin/diagnostic-history"
```

### Paso 8 - Simular limpieza segura

Este comando no elimina archivos:

```powershell
curl.exe -s -X DELETE "http://localhost:3005/api/admin/diagnostic-history?keep=20&dry_run=true"
```

Para ver campos clave:

```powershell
$Preview = curl.exe -s -X DELETE "http://localhost:3005/api/admin/diagnostic-history?keep=20&dry_run=true" | ConvertFrom-Json
$Preview.dry_run
$Preview.keep
$Preview.candidate_count
$Preview.deleted_count
$Preview.remaining_count
```

### Paso 9 - Ejecutar limpieza real segura

Este comando conserva los ultimos 20 snapshots. Si existen menos de 20, no borra nada:

```powershell
curl.exe -s -X DELETE "http://localhost:3005/api/admin/diagnostic-history?keep=20&dry_run=false"
```

### Paso 10 - Confirmar historial

```powershell
$History = curl.exe -s "http://localhost:3005/api/admin/diagnostic-history" | ConvertFrom-Json
$History.total_snapshots
$History.latest.file_name
$History.previous.file_name
```

### Paso 11 - Validar manifest por HTTP

```powershell
$Manifest = curl.exe -s "http://localhost:3005/mfe/manifest" | ConvertFrom-Json
$Manifest.capabilities
```

Debe incluir:

```text
diagnostico-exportable
diagnostico-historico
diagnostico-retencion
```

### Paso 12 - Validar frontend completo

```powershell
npm run typecheck:frontend
npm run build:frontend
```

## Comandos de validacion ejecutados

```powershell
Test-Path -LiteralPath .\apps\mfe-admin\app\api\admin\diagnostic-history\route.ts
Select-String -Path .\apps\mfe-admin\app\api\admin\diagnostic-history\route.ts -Pattern "export async function DELETE"
Select-String -Path .\apps\mfe-admin\app\mfe\manifest\route.ts -Pattern "diagnostico-retencion"
npm run typecheck -w @venta-pasajes/mfe-admin
npm run build -w @venta-pasajes/mfe-admin
curl.exe -s -X DELETE "http://localhost:3005/api/admin/diagnostic-history?keep=20&dry_run=true"
curl.exe -s -X DELETE "http://localhost:3005/api/admin/diagnostic-history?keep=20&dry_run=false"
curl.exe -s http://localhost:3005/api/admin/diagnostic-history
curl.exe -s http://localhost:3005/mfe/manifest
npm run typecheck:frontend
npm run build:frontend
```

Resultados observados:

```text
diagnostic-history route.ts existe.
endpoint contiene export async function DELETE.
manifest contiene diagnostico-retencion.
mfe-admin typecheck OK.
mfe-admin build OK.
build de mfe-admin incluye /api/admin/diagnostic-history.
Simulacion DELETE respondio dry_run=True, keep=20, candidate_count=0, deleted_count=0, remaining_count=5.
Limpieza real segura respondio dry_run=False, keep=20, candidate_count=0, deleted_count=0, remaining_count=5.
No se eliminaron snapshots porque total_snapshots=5 y keep=20.
manifest HTTP contiene diagnostico-exportable, diagnostico-historico y diagnostico-retencion.
typecheck:frontend OK.
build:frontend OK.
Se validaron rutas absolutas desde C:\Windows\system32 con Exists=True.
```

## Troubleshooting

### Error: ruta no existe desde C:\Windows\system32

Ejecutar:

```powershell
$ProjectRoot = "C:\VENTA-DE-PASAJES"
Set-Location $ProjectRoot
```

Luego repetir el comando usando rutas absolutas con `$ProjectRoot`.

### Error: curl devuelve 000

Significa que `mfe-admin` no esta escuchando en `3005`.

```powershell
npm run dev:mfe-admin
```

### No se elimina nada

Si `candidate_count=0`, no hay snapshots antiguos que eliminar con el valor actual de `keep`.

Ejemplo:

```text
total_snapshots=2
keep=20
candidate_count=0
```

Esto es correcto: se conservan todos.
