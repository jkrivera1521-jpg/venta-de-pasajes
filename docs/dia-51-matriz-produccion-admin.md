# Dia 51 - matriz de preparacion para produccion en mfe-admin

Fecha de ejecucion: 2026-09-18

## Objetivo

Agregar al `mfe-admin` una matriz objetiva de preparacion para produccion que lea el estado real del workspace y resuma que esta listo, que requiere atencion y que falta antes de considerar el aplicativo como productivo.

Alcance del dia:

```text
Crear API administrativa /api/admin/production-readiness.
Evaluar frontends, backends, migraciones, pruebas, scripts, observabilidad, despliegue, CI/CD, seguridad, secretos, backups e imagenes.
Agregar pestana Produccion en mfe-admin.
Mostrar score, categorias, evidencias, faltantes y recomendaciones.
Incluir production_readiness en diagnostic-export.
Actualizar manifest y README de apps.
Validar existencia real de rutas, typecheck, build y HTTP.
```

## Resultado logrado

```text
mfe-admin expone GET /api/admin/production-readiness.
La pantalla admin tiene una pestana Produccion.
La matriz calcula score global, totales y categorias.
El diagnostico exportable incluye production_readiness.
El manifest de mfe-admin declara la capacidad preparacion-produccion.
```

## Archivos creados

```text
C:\VENTA-DE-PASAJES\apps\mfe-admin\app\api\admin\production-readiness\route.ts
C:\VENTA-DE-PASAJES\docs\dia-51-matriz-produccion-admin.md
```

## Archivos modificados

```text
C:\VENTA-DE-PASAJES\apps\mfe-admin\app\admin\embedded\page.tsx
C:\VENTA-DE-PASAJES\apps\mfe-admin\app\api\admin\diagnostic-export\route.ts
C:\VENTA-DE-PASAJES\apps\mfe-admin\app\mfe\manifest\route.ts
C:\VENTA-DE-PASAJES\apps\README.md
C:\VENTA-DE-PASAJES\vitacora.md
```

## Endpoint agregado

```text
GET /api/admin/production-readiness
```

Respuesta resumida observada:

```json
{
  "score_percent": 58,
  "status": "missing",
  "totals": {
    "ready": 6,
    "warning": 3,
    "missing": 4,
    "total": 13
  }
}
```

Principales faltantes observados:

```text
Pruebas frontend y E2E.
Despliegue reproducible.
CI/CD.
Backups de base de datos.
```

Items en atencion:

```text
Autenticacion y autorizacion.
Secretos por ambiente.
Imagenes y artefactos.
```

## Reversa primero

Esta seccion sirve para deshacer el Dia 51 sin afectar Salud, Arranque, Runbook, Parametros, Diagnostico, Historial ni Auditoria.

### Paso 1 - Ir al proyecto

```powershell
$ProjectRoot = "C:\VENTA-DE-PASAJES"
Set-Location $ProjectRoot
```

### Paso 2 - Eliminar endpoint de produccion

```powershell
Remove-Item -LiteralPath "$ProjectRoot\apps\mfe-admin\app\api\admin\production-readiness" -Recurse -Force
```

### Paso 3 - Revertir diagnostic-export

En:

```text
C:\VENTA-DE-PASAJES\apps\mfe-admin\app\api\admin\diagnostic-export\route.ts
```

Quitar:

```text
Seccion production_readiness del arreglo sections.
Lectura productionReadiness.
Campos production_readiness_score, production_readiness_ready, production_readiness_warning y production_readiness_missing.
```

### Paso 4 - Revertir UI

En:

```text
C:\VENTA-DE-PASAJES\apps\mfe-admin\app\admin\embedded\page.tsx
```

Retirar:

```text
AdminView production.
Tipos ProductionReadinessStatus, ProductionReadinessCategory, ProductionReadinessItem y ProductionReadinessResponse.
Funciones readinessStateClass, readinessStateLabel y ProductionReadinessPanel.
Query productionReadiness.
Boton Evaluar.
Tab Produccion.
Tarjetas Score, Listos, Atencion y Faltan.
Render de la seccion Preparacion para produccion.
Campos production_readiness_* de DiagnosticExportResponse.
```

### Paso 5 - Revertir manifest y README

En:

```text
C:\VENTA-DE-PASAJES\apps\mfe-admin\app\mfe\manifest\route.ts
```

Eliminar:

```text
preparacion-produccion
```

En:

```text
C:\VENTA-DE-PASAJES\apps\README.md
```

Eliminar:

```text
/api/admin/production-readiness
```

### Paso 6 - Validar reversa

```powershell
npm run typecheck -w @venta-pasajes/mfe-admin
npm run build -w @venta-pasajes/mfe-admin

Test-Path -LiteralPath "$ProjectRoot\apps\mfe-admin\app\api\admin\production-readiness\route.ts"
Select-String -Path "$ProjectRoot\apps\mfe-admin\app\mfe\manifest\route.ts" -Pattern "preparacion-produccion"
```

Resultado esperado despues de reversar:

```text
False
Sin resultados para preparacion-produccion.
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
  "$ProjectRoot\apps\mfe-admin\app\api\admin\production-readiness\route.ts",
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

### Paso 3 - Validar capacidad en manifest

```powershell
Select-String -Path "$ProjectRoot\apps\mfe-admin\app\mfe\manifest\route.ts" -Pattern "preparacion-produccion"
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

### Paso 6 - Validar endpoint de produccion

```powershell
curl.exe -s -o NUL -w "%{http_code}" "http://localhost:3005/api/admin/production-readiness"
```

Debe responder:

```text
200
```

Ver resumen:

```powershell
$Readiness = curl.exe -s "http://localhost:3005/api/admin/production-readiness" | ConvertFrom-Json
[pscustomobject]@{
  Score = $Readiness.score_percent
  Status = $Readiness.status
  Ready = $Readiness.totals.ready
  Warning = $Readiness.totals.warning
  Missing = $Readiness.totals.missing
  Total = $Readiness.totals.total
} | Format-List
```

### Paso 7 - Ver principales acciones pendientes

```powershell
$Readiness.next_actions |
  Select-Object -First 8 id,status,title |
  Format-Table -AutoSize
```

### Paso 8 - Validar que diagnostic-export integre produccion

```powershell
$Diagnostic = curl.exe -s "http://localhost:3005/api/admin/diagnostic-export" | ConvertFrom-Json
[pscustomobject]@{
  Sections = $Diagnostic.summary.total_sections
  Ok = $Diagnostic.summary.ok_sections
  Failed = $Diagnostic.summary.failed_sections
  ProductionScore = $Diagnostic.summary.production_readiness_score
  ProductionMissing = $Diagnostic.summary.production_readiness_missing
} | Format-List
```

### Paso 9 - Validar manifest por HTTP

```powershell
$Manifest = curl.exe -s "http://localhost:3005/mfe/manifest" | ConvertFrom-Json
$Manifest.capabilities
```

Debe incluir:

```text
preparacion-produccion
```

### Paso 10 - Validar frontend completo

```powershell
npm run typecheck:frontend
npm run build:frontend
```

## Comandos de validacion ejecutados

```powershell
npm run typecheck -w @venta-pasajes/mfe-admin
npm run build -w @venta-pasajes/mfe-admin
curl.exe -s -o NUL -w "%{http_code}" http://localhost:3005/api/admin/production-readiness
curl.exe -s http://localhost:3005/api/admin/production-readiness
curl.exe -s http://localhost:3005/api/admin/diagnostic-export
curl.exe -s http://localhost:3005/mfe/manifest
npm run typecheck:frontend
npm run build:frontend
```

Resultados observados:

```text
production-readiness route.ts existe.
mfe-admin typecheck OK.
mfe-admin build OK.
build de mfe-admin incluye /api/admin/production-readiness.
/api/admin/production-readiness respondio HTTP 200.
score_percent=58.
status=missing.
ready=6.
warning=3.
missing=4.
total=13.
diagnostic-export ahora total_sections=6.
diagnostic-export ok_sections=6.
diagnostic-export failed_sections=0.
diagnostic-export production_readiness_score=58.
manifest HTTP contiene preparacion-produccion.
typecheck:frontend OK.
build:frontend OK.
```

## Lectura ejecutiva

```text
El aplicativo tiene una base funcional amplia, pero no esta al 100% para produccion.
La brecha principal ya no es solo funcionalidad: es industrializacion.
Faltan pruebas frontend/E2E, CI/CD, despliegue reproducible y backups de base de datos.
Seguridad, secretos e imagenes existen parcialmente y requieren hardening.
```

## Troubleshooting

### Error: curl devuelve 000

Significa que `mfe-admin` no esta escuchando en `3005`.

```powershell
npm run dev:mfe-admin
```

### Error: ruta no existe desde C:\Windows\system32

Ejecutar:

```powershell
$ProjectRoot = "C:\VENTA-DE-PASAJES"
Set-Location $ProjectRoot
```

Luego repetir el comando usando rutas absolutas con `$ProjectRoot`.
