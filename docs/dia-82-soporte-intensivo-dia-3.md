# Dia 82 - Soporte intensivo dia 3

Fecha: 2026-09-28

## Objetivo

Alinear el Dia 82 con `C:\VENTA-DE-PASAJES\tareas.md`: revisar estabilidad de servicios, latencia, costos preliminares, logs de seguridad y cierre de incidencias abiertas.

Este dia prepara la decision de pasar a soporte normal. No ejecuta la revision real mientras el Dia 81 no este ejecutado y cerrado.

## Resultado alcanzado

Se creo el paquete de soporte dia 3:

```text
C:\VENTA-DE-PASAJES\scripts\prepare-post-start-day3-report.ps1
C:\VENTA-DE-PASAJES\docs\dia-82-soporte-intensivo-dia-3.md
C:\VENTA-DE-PASAJES\docs\reporte-post-arranque-dia-3.md
```

Al ejecutar el preparador se generan archivos locales ignorados por Git:

```text
C:\VENTA-DE-PASAJES\logs\post-start-day3\dia82-post-start-day3-readiness.json
C:\VENTA-DE-PASAJES\logs\post-start-day3\dia82-post-start-day3-commands.ps1
```

Estado esperado mientras Dia 81 no este cerrado:

```text
Paquete soporte dia 3 listo: True
Decision soporte normal autorizada: False
Revision real dia 3 ejecutada: False
```

## Reversa primero

### Reversa si solo se preparo el paquete

Esta reversa elimina solo archivos locales del Dia 82. No modifica Cloud Run, Cloud SQL, Billing, logs ni incidencias reales.

```powershell
cd C:\VENTA-DE-PASAJES

Remove-Item -LiteralPath .\logs\post-start-day3 -Recurse -Force
Remove-Item -LiteralPath .\scripts\prepare-post-start-day3-report.ps1 -Force
Remove-Item -LiteralPath .\docs\dia-82-soporte-intensivo-dia-3.md -Force
Remove-Item -LiteralPath .\docs\reporte-post-arranque-dia-3.md -Force
```

### Reversa si ya se ejecuto la revision real

La revision real del Dia 82 recolecta evidencia y crea plantillas de decision. No cierra incidencias ni cambia configuracion automaticamente.

```powershell
cd C:\VENTA-DE-PASAJES

Get-Content -LiteralPath .\logs\post-start-day3\dia82-post-start-day3-evidence.json -Raw |
  ConvertFrom-Json
```

Si se cerro una incidencia por error, reabrirla en:

```text
C:\VENTA-DE-PASAJES\docs\registro-incidencias-iniciales.md
C:\VENTA-DE-PASAJES\logs\post-start-day3\dia82-incident-closure.md
```

Si se tomo una decision incorrecta de soporte normal, registrar reversa en `dia82-normal-support-transition.md` y volver temporalmente a soporte intensivo.

## Cambios realizados

```text
scripts/prepare-post-start-day3-report.ps1
docs/dia-82-soporte-intensivo-dia-3.md
docs/reporte-post-arranque-dia-3.md
README.md
infra/README.md
vitacora.md
```

## Guia manual desde cero

### Paso 1 - Abrir PowerShell en el workspace

```powershell
cd C:\VENTA-DE-PASAJES
```

### Paso 2 - Confirmar insumos

```powershell
Test-Path -LiteralPath .\logs\cloudrun-prod\verify-cloudrun-prod-backends.json
Test-Path -LiteralPath .\logs\cloudrun-prod\verify-cloudrun-prod-frontends.json
Test-Path -LiteralPath .\logs\go-live\dia79-go-live-readiness.json
Test-Path -LiteralPath .\logs\post-start-day2\dia81-post-start-day2-readiness.json
Test-Path -LiteralPath .\docs\reporte-post-arranque-dia-2.md
Test-Path -LiteralPath .\docs\registro-incidencias-iniciales.md
```

Resultado esperado:

```text
True
True
True
True
True
True
```

### Paso 3 - Preparar paquete sin ejecutar revision real

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\prepare-post-start-day3-report.ps1
```

Resultado esperado si Dia 81 sigue sin cierre:

```text
Paquete soporte dia 3 listo: True
Decision soporte normal autorizada: False
Revision real dia 3 ejecutada: False
```

### Paso 4 - Revisar bloqueos

```powershell
$Result = Get-Content -LiteralPath .\logs\post-start-day3\dia82-post-start-day3-readiness.json -Raw |
  ConvertFrom-Json

$Result.business_blockers
$Result.technical_blockers
```

Resultado esperado actual:

```text
La operacion real del Dia 79 no esta iniciada.
El soporte intensivo Dia 81 no esta ejecutado ni cerrado.
No existe evidencia de soporte real Dia 81.
No se confirmo cierre de Dia 81 con -ConfirmDay2Closed.
No se confirmo estabilidad de negocio con -ConfirmBusinessStable.
```

### Paso 5 - Preparar revision real cuando Dia 81 este cerrado

Ejecutar solo despues de cerrar el reporte post-arranque dia 2:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\prepare-post-start-day3-report.ps1 `
  -ConfirmDay2Closed `
  -ConfirmBusinessStable
```

Resultado esperado sin bloqueos:

```text
Paquete soporte dia 3 listo: True
Decision soporte normal autorizada: True
Revision real dia 3 ejecutada: False
```

### Paso 6 - Ejecutar recoleccion de soporte dia 3

Ejecutar solo si el Paso 5 queda autorizado:

```powershell
.\logs\post-start-day3\dia82-post-start-day3-commands.ps1
```

Evidencia esperada:

```text
logs\post-start-day3\dia82-*-health.json
logs\post-start-day3\dia82-*-describe.json
logs\post-start-day3\dia82-cloudrun-latency.json
logs\post-start-day3\dia82-cloudrun-request-count.json
logs\post-start-day3\dia82-preliminary-cost-review.md
logs\post-start-day3\dia82-security-audit-logs.txt
logs\post-start-day3\dia82-functional-audit-events.json
logs\post-start-day3\dia82-incident-closure.md
logs\post-start-day3\dia82-normal-support-transition.md
logs\post-start-day3\dia82-post-start-day3-evidence.json
```

### Paso 7 - Revisar estabilidad

```powershell
Get-ChildItem -LiteralPath .\logs\post-start-day3 -Filter "dia82-*-health.json"
Get-Content -LiteralPath .\logs\post-start-day3\dia82-cloudrun-errors.txt
```

Confirmar que no hay errores criticos repetidos por servicio.

### Paso 8 - Revisar latencia

```powershell
Get-Content -LiteralPath .\logs\post-start-day3\dia82-cloudrun-latency.json -Raw |
  ConvertFrom-Json
```

Registrar hallazgos en `docs\reporte-post-arranque-dia-3.md`.

### Paso 9 - Revisar costos preliminares

```powershell
notepad .\logs\post-start-day3\dia82-preliminary-cost-review.md
```

El analisis detallado de costos se hace en Dia 83.

### Paso 10 - Revisar logs de seguridad

```powershell
Get-Content -LiteralPath .\logs\post-start-day3\dia82-security-audit-logs.txt
Get-Content -LiteralPath .\logs\post-start-day3\dia82-functional-audit-events.json -Raw |
  ConvertFrom-Json
```

Revisar accesos sospechosos, errores de permisos y operaciones administrativas.

### Paso 11 - Cerrar incidencias abiertas

```powershell
notepad .\logs\post-start-day3\dia82-incident-closure.md
notepad .\docs\registro-incidencias-iniciales.md
```

No cerrar incidencias sin evidencia y aprobacion.

### Paso 12 - Decidir paso a soporte normal

```powershell
notepad .\logs\post-start-day3\dia82-normal-support-transition.md
notepad .\docs\reporte-post-arranque-dia-3.md
```

Registrar la decision final.

## Pruebas y validaciones

Validar sintaxis:

```powershell
$Errors = $null
[System.Management.Automation.PSParser]::Tokenize(
  (Get-Content -LiteralPath .\scripts\prepare-post-start-day3-report.ps1 -Raw),
  [ref]$Errors
) | Out-Null
if ($Errors.Count -gt 0) { $Errors } else { "parse-ok" }
```

Validar comandos generados:

```powershell
$Errors = $null
[System.Management.Automation.PSParser]::Tokenize(
  (Get-Content -LiteralPath .\logs\post-start-day3\dia82-post-start-day3-commands.ps1 -Raw),
  [ref]$Errors
) | Out-Null
if ($Errors.Count -gt 0) { $Errors } else { "commands-parse-ok" }
```

Validar documento:

```powershell
Select-String -Path .\docs\dia-82-soporte-intensivo-dia-3.md `
  -Pattern "Reversa primero|Guia manual desde cero|Estado final"
```

## Peticiones HTTP/HTTPS listas para copiar

Health publico del shell:

```powershell
curl.exe -s "https://frontend-shell-prod-io7kxgn6yq-uc.a.run.app/api/health"
```

Auditoria funcional:

```powershell
$Token = gcloud auth print-identity-token
$Headers = @{ Authorization = "Bearer $Token" }

Invoke-RestMethod -Method GET `
  -Uri "https://audit-service-prod-io7kxgn6yq-uc.a.run.app/api/v1/audit/audit-events?page=1&page_size=100" `
  -Headers $Headers
```

Ventas por bus:

```powershell
$Today = (Get-Date).ToString("yyyy-MM-dd")

Invoke-RestMethod -Method GET `
  -Uri "https://reporting-service-prod-io7kxgn6yq-uc.a.run.app/api/v1/reporting/reports/sales/by-bus?date_from=$Today&date_to=$Today" `
  -Headers $Headers
```

## Publicacion o despliegue

No se despliega codigo nuevo en este dia. Si se detecta una accion de optimizacion o costo, documentarla para Dia 83.

## Verificacion en consola web o por comandos

Latencia Cloud Run:

```powershell
$Start = (Get-Date).AddHours(-24).ToUniversalTime().ToString("o")
$End = (Get-Date).ToUniversalTime().ToString("o")
$LatencyFilter = "metric.type=`"run.googleapis.com/request_latencies`""

gcloud monitoring time-series list `
  --project project-fbb34cd7-0b82-43e1-867 `
  --filter $LatencyFilter `
  --interval "start=$Start,end=$End" `
  --format json
```

Logs de seguridad:

```powershell
gcloud logging read "logName:cloudaudit.googleapis.com" `
  --project project-fbb34cd7-0b82-43e1-867 `
  --limit 200
```

## Problemas encontrados y soluciones

### Dia 81 no esta cerrado

Solucion: preparar el paquete y bloquear la decision de soporte normal hasta ejecutar y cerrar el soporte dia 2.

### Costos preliminares no sustituyen Dia 83

Solucion: este dia solo recoge senales iniciales. La optimizacion formal se hace en Dia 83.

### Incidencias no se cierran automaticamente

Solucion: generar plantilla de cierre, exigir evidencia y aprobacion.

## Estado final

Paquete de soporte intensivo dia 3 creado.

Reporte post-arranque dia 3 creado.

Comandos de recoleccion generados pero no ejecutados.

No se reviso estabilidad real porque Dia 81 no esta cerrado.

No se cerraron incidencias.

No se autorizo paso a soporte normal.

Siguiente paso natural: Dia 83 - Optimizacion de costos.
