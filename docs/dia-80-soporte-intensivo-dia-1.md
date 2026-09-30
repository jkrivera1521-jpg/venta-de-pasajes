# Dia 80 - Soporte intensivo dia 1

Fecha: 2026-09-28

## Objetivo

Alinear el Dia 80 con `C:\VENTA-DE-PASAJES\tareas.md`: revisar errores por servicio, revisar ventas del dia, revisar reportes, revisar consumo Cloud SQL y documentar cualquier ajuste urgente.

Este dia prepara el soporte intensivo post-arranque. No ejecuta revision real mientras el Dia 79 siga sin apertura productiva confirmada.

## Resultado alcanzado

Se creo el paquete de soporte dia 1:

```text
C:\VENTA-DE-PASAJES\scripts\prepare-post-start-day1-report.ps1
C:\VENTA-DE-PASAJES\docs\dia-80-soporte-intensivo-dia-1.md
C:\VENTA-DE-PASAJES\docs\reporte-post-arranque-dia-1.md
```

Al ejecutar el preparador se generan archivos locales ignorados por Git:

```text
C:\VENTA-DE-PASAJES\logs\post-start-day1\dia80-post-start-day1-readiness.json
C:\VENTA-DE-PASAJES\logs\post-start-day1\dia80-post-start-day1-commands.ps1
```

Estado esperado mientras Dia 79 no este abierto:

```text
Paquete soporte listo: True
Revision real autorizada: False
Revision real ejecutada: False
```

## Reversa primero

### Reversa si solo se preparo el paquete

Esta reversa elimina solo archivos locales del Dia 80. No modifica Cloud Run, Cloud SQL, Storage ni usuarios.

```powershell
cd C:\VENTA-DE-PASAJES

Remove-Item -LiteralPath .\logs\post-start-day1 -Recurse -Force
Remove-Item -LiteralPath .\scripts\prepare-post-start-day1-report.ps1 -Force
Remove-Item -LiteralPath .\docs\dia-80-soporte-intensivo-dia-1.md -Force
Remove-Item -LiteralPath .\docs\reporte-post-arranque-dia-1.md -Force
```

### Reversa si ya se ejecuto la revision real

La revision real solo recolecta evidencia. No ajusta configuracion automaticamente.

```powershell
cd C:\VENTA-DE-PASAJES

Get-Content -LiteralPath .\logs\post-start-day1\dia80-post-start-day1-evidence.json -Raw |
  ConvertFrom-Json
```

Si durante soporte se aprobo un ajuste urgente, registrar el cambio en:

```text
C:\VENTA-DE-PASAJES\logs\post-start-day1\dia80-urgent-config-review.md
C:\VENTA-DE-PASAJES\docs\registro-incidencias-iniciales.md
```

Para reversar un ajuste real, usar el plan especifico registrado en esa incidencia. No ejecutar cambios masivos sin aprobacion de negocio y tecnico.

## Cambios realizados

```text
scripts/prepare-post-start-day1-report.ps1
docs/dia-80-soporte-intensivo-dia-1.md
docs/reporte-post-arranque-dia-1.md
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
Test-Path -LiteralPath .\infra\gcloud\cloudsql-prod.json
Test-Path -LiteralPath .\docs\registro-incidencias-iniciales.md
```

Resultado esperado:

```text
True
True
True
True
True
```

### Paso 3 - Preparar paquete sin revisar operacion real

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\prepare-post-start-day1-report.ps1
```

Resultado esperado si Dia 79 sigue sin apertura:

```text
Paquete soporte listo: True
Revision real autorizada: False
Revision real ejecutada: False
```

### Paso 4 - Revisar bloqueos

```powershell
$Result = Get-Content -LiteralPath .\logs\post-start-day1\dia80-post-start-day1-readiness.json -Raw |
  ConvertFrom-Json

$Result.business_blockers
$Result.technical_blockers
```

Resultado esperado actual:

```text
La operacion real del Dia 79 no esta iniciada.
No existe evidencia de monitoreo de apertura Dia 79.
No se confirmo apertura real con -ConfirmGoLiveStarted.
No se confirmo negocio abierto con -ConfirmBusinessOpen.
```

### Paso 5 - Preparar revision real cuando ya exista apertura

Ejecutar solo despues de que el Dia 79 tenga apertura productiva real y evidencia de monitoreo:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\prepare-post-start-day1-report.ps1 `
  -ConfirmGoLiveStarted `
  -ConfirmBusinessOpen
```

Resultado esperado sin bloqueos:

```text
Paquete soporte listo: True
Revision real autorizada: True
Revision real ejecutada: False
```

### Paso 6 - Ejecutar recoleccion de soporte

Ejecutar solo si el Paso 5 queda autorizado:

```powershell
.\logs\post-start-day1\dia80-post-start-day1-commands.ps1
```

Evidencia esperada:

```text
logs\post-start-day1\dia80-cloudrun-errors.txt
logs\post-start-day1\dia80-*-logs.txt
logs\post-start-day1\dia80-sales-report.json
logs\post-start-day1\dia80-passenger-report.json
logs\post-start-day1\dia80-sales-by-user.json
logs\post-start-day1\dia80-sales-by-bus.json
logs\post-start-day1\dia80-cloudsql-describe.json
logs\post-start-day1\dia80-cloudsql-operations.txt
logs\post-start-day1\dia80-cloudsql-cpu.json
logs\post-start-day1\dia80-cloudsql-disk.json
logs\post-start-day1\dia80-urgent-config-review.md
logs\post-start-day1\dia80-post-start-day1-evidence.json
```

### Paso 7 - Completar reporte post-arranque

```powershell
notepad .\docs\reporte-post-arranque-dia-1.md
notepad .\docs\registro-incidencias-iniciales.md
```

Actualizar:

```text
1. Errores por servicio.
2. Ventas del dia.
3. Reportes por usuario y bus.
4. Consumo Cloud SQL.
5. Incidencias criticas abiertas.
6. Ajustes urgentes aprobados.
7. Decision de avance.
```

## Pruebas y validaciones

Validar sintaxis:

```powershell
$Errors = $null
[System.Management.Automation.PSParser]::Tokenize(
  (Get-Content -LiteralPath .\scripts\prepare-post-start-day1-report.ps1 -Raw),
  [ref]$Errors
) | Out-Null
if ($Errors.Count -gt 0) { $Errors } else { "parse-ok" }
```

Validar comandos generados:

```powershell
$Errors = $null
[System.Management.Automation.PSParser]::Tokenize(
  (Get-Content -LiteralPath .\logs\post-start-day1\dia80-post-start-day1-commands.ps1 -Raw),
  [ref]$Errors
) | Out-Null
if ($Errors.Count -gt 0) { $Errors } else { "commands-parse-ok" }
```

Validar documento:

```powershell
Select-String -Path .\docs\dia-80-soporte-intensivo-dia-1.md `
  -Pattern "Reversa primero|Guia manual desde cero|Estado final"
```

## Peticiones HTTP/HTTPS listas para copiar

Health publico del shell:

```powershell
curl.exe -s "https://frontend-shell-prod-io7kxgn6yq-uc.a.run.app/api/health"
```

Los backends productivos son privados; usar token:

```powershell
$Token = gcloud auth print-identity-token
$Headers = @{ Authorization = "Bearer $Token" }

Invoke-RestMethod -Method GET `
  -Uri "https://reporting-service-prod-io7kxgn6yq-uc.a.run.app/api/v1/reporting/health" `
  -Headers $Headers
```

Reporte de ventas del dia:

```powershell
$Today = (Get-Date).ToString("yyyy-MM-dd")

Invoke-RestMethod -Method GET `
  -Uri "https://reporting-service-prod-io7kxgn6yq-uc.a.run.app/api/v1/reporting/reports/sales?date_from=$Today&date_to=$Today" `
  -Headers $Headers
```

## Publicacion o despliegue

No se despliega codigo nuevo en este dia. Cualquier ajuste urgente debe registrarse primero en `dia80-urgent-config-review.md` y ejecutarse solo con aprobacion.

## Verificacion en consola web o por comandos

Errores recientes:

```powershell
gcloud logging read "resource.type=cloud_run_revision AND severity>=ERROR" `
  --project project-fbb34cd7-0b82-43e1-867 `
  --limit 200
```

Cloud SQL:

```powershell
gcloud sql instances describe venta-pasajes-prod-sql `
  --project project-fbb34cd7-0b82-43e1-867 `
  --format json
```

## Problemas encontrados y soluciones

### Dia 79 no tiene apertura real

Solucion: preparar el paquete y bloquear la revision real hasta confirmar apertura productiva.

### No existe evidencia de monitoreo Dia 79

Solucion: ejecutar primero los comandos del Dia 79 cuando negocio apruebe la apertura.

### Ajustes urgentes no deben automatizarse

Solucion: el comando genera una plantilla de revision. Todo ajuste real requiere aprobacion y registro de reversa.

## Estado final

Paquete de soporte intensivo dia 1 creado.

Reporte post-arranque dia 1 creado.

Comandos de recoleccion generados pero no ejecutados.

No se revisaron ventas reales porque la operacion productiva no esta iniciada.

No se aplicaron ajustes urgentes.

El soporte real queda bloqueado hasta cierre del Dia 79.

Siguiente paso natural: Dia 81 - Soporte intensivo dia 2.
