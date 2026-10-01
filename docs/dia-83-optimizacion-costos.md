# Dia 83 - Optimizacion de costos

Fecha: 2026-09-28

## Objetivo

Alinear el Dia 83 con `C:\VENTA-DE-PASAJES\tareas.md`: revisar `min_instances`, CPU/RAM por servicio, almacenamiento, volumen de logs, presupuesto y alertas.

El objetivo practico es dejar un paquete seguro para estimar costo mensual, recolectar evidencia real y preparar ajustes sin aplicar cambios automaticamente.

## Resultado alcanzado

Se creo el paquete de optimizacion de costos:

```text
C:\VENTA-DE-PASAJES\scripts\prepare-cost-optimization-review.ps1
C:\VENTA-DE-PASAJES\docs\dia-83-optimizacion-costos.md
C:\VENTA-DE-PASAJES\docs\reporte-costo-mensual-estimado.md
```

Al ejecutar el preparador se generan archivos locales ignorados por Git:

```text
C:\VENTA-DE-PASAJES\logs\cost-optimization\dia83-cost-optimization-readiness.json
C:\VENTA-DE-PASAJES\logs\cost-optimization\dia83-cost-optimization-commands.ps1
C:\VENTA-DE-PASAJES\logs\cost-optimization\dia83-budget-alert-template.ps1
C:\VENTA-DE-PASAJES\logs\cost-optimization\dia83-cost-adjustments-plan.json
```

Estado esperado mientras el Dia 82 no este cerrado con evidencia real:

```text
Paquete optimizacion costos listo: True
Revision real costos autorizada: False
Guardrails de configuracion OK: True
Costo real mensual validado: False
```

## Cambios realizados

```text
scripts/prepare-cost-optimization-review.ps1
docs/dia-83-optimizacion-costos.md
docs/reporte-costo-mensual-estimado.md
README.md
infra/README.md
vitacora.md
```

## Reversa primero

### Reversa si solo se preparo el paquete

Esta reversa elimina solo archivos locales del Dia 83. No modifica Cloud Run, Cloud SQL, Logging ni Billing.

```powershell
cd C:\VENTA-DE-PASAJES

Remove-Item -LiteralPath .\logs\cost-optimization -Recurse -Force
Remove-Item -LiteralPath .\scripts\prepare-cost-optimization-review.ps1 -Force
Remove-Item -LiteralPath .\docs\dia-83-optimizacion-costos.md -Force
Remove-Item -LiteralPath .\docs\reporte-costo-mensual-estimado.md -Force
```

### Reversa si se creo un presupuesto en Billing

Si se ejecuto `dia83-budget-alert-template.ps1`, revisar primero el presupuesto creado:

```powershell
cd C:\VENTA-DE-PASAJES

$env:CLOUDSDK_PYTHON = "C:\Python312\python.exe"
$GcloudPath = "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd"
$BillingAccountId = "<billing-account-id-real>"

& $GcloudPath billing budgets list --billing-account=$BillingAccountId
```

Eliminar el presupuesto solo si negocio confirma que fue creado por error:

```powershell
$BudgetId = "<budget-id-real>"
& $GcloudPath billing budgets delete $BudgetId --billing-account=$BillingAccountId
```

### Reversa si se aplicaron ajustes manuales

El paquete del Dia 83 no aplica ajustes automaticamente. Si una persona cambio configuracion despues de revisar el plan, revertir con los valores base del repo:

```text
C:\VENTA-DE-PASAJES\infra\cloudrun\prod-backend-services.json
C:\VENTA-DE-PASAJES\infra\cloudrun\prod-frontend-services.json
C:\VENTA-DE-PASAJES\infra\gcloud\cloudsql-prod.json
```

Valores base actuales:

```text
Cloud Run min_instances: 0
Cloud Run max_instances: 2
Cloud Run CPU: 1
Cloud Run memoria: 512Mi
Cloud SQL tier: db-f1-micro
Cloud SQL storage: 10GB SSD
```

## Guia manual desde cero

### Paso 1 - Abrir PowerShell en el workspace

```powershell
cd C:\VENTA-DE-PASAJES
```

### Paso 2 - Confirmar archivos reales que usa el Dia 83

```powershell
Test-Path -LiteralPath .\infra\cloudrun\prod-backend-services.json
Test-Path -LiteralPath .\infra\cloudrun\prod-frontend-services.json
Test-Path -LiteralPath .\infra\gcloud\cloudsql-prod.json
Test-Path -LiteralPath .\scripts\prepare-cost-optimization-review.ps1
```

Resultado esperado:

```text
True
True
True
True
```

### Paso 3 - Preparar paquete sin ejecutar cambios

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\prepare-cost-optimization-review.ps1
```

Resultado esperado si todavia no existe evidencia real del Dia 82:

```text
Paquete optimizacion costos listo: True
Revision real costos autorizada: False
Guardrails de configuracion OK: True
Costo real mensual validado: False
```

### Paso 4 - Revisar el resumen del diagnostico

```powershell
$Result = Get-Content -LiteralPath .\logs\cost-optimization\dia83-cost-optimization-readiness.json -Raw |
  ConvertFrom-Json

$Result | Select-Object `
  ready_for_cost_package, `
  ready_for_real_cost_review, `
  configuration_cost_guardrails_ok, `
  actual_monthly_cost_validated, `
  cost_under_control
```

Lectura esperada:

```text
ready_for_cost_package            : True
ready_for_real_cost_review        : False
configuration_cost_guardrails_ok  : True
actual_monthly_cost_validated     : False
cost_under_control                : False
```

### Paso 5 - Revisar configuracion Cloud Run

```powershell
$Backend = Get-Content -LiteralPath .\infra\cloudrun\prod-backend-services.json -Raw | ConvertFrom-Json
$Frontend = Get-Content -LiteralPath .\infra\cloudrun\prod-frontend-services.json -Raw | ConvertFrom-Json

@($Backend.services + ($Frontend.services | Where-Object group -eq "frontend")) |
  Select-Object id, group, service_name, cpu, memory, min_instances, max_instances |
  Format-Table -AutoSize
```

Resultado actual esperado:

```text
Todos los servicios productivos usan:
cpu=1
memory=512Mi
min_instances=0
max_instances=2
```

Interpretacion:

```text
min_instances=0 evita costo fijo por instancias minimas.
max_instances=2 limita crecimiento automatico durante el arranque.
CPU/RAM estan en una base pequena y homogenea.
```

### Paso 6 - Revisar almacenamiento Cloud SQL

```powershell
$Sql = Get-Content -LiteralPath .\infra\gcloud\cloudsql-prod.json -Raw | ConvertFrom-Json

$Sql.instance |
  Select-Object name, tier, storage_type, storage_size_gb, storage_auto_increase, availability_type, retained_backups_count |
  Format-List
```

Resultado actual esperado:

```text
name                   : venta-pasajes-prod-sql
tier                   : db-f1-micro
storage_type           : SSD
storage_size_gb        : 10
storage_auto_increase  : True
availability_type      : ZONAL
retained_backups_count : 14
```

### Paso 7 - Ejecutar recoleccion real de costos

Ejecutar solo despues de cerrar el Dia 82 y confirmar que produccion esta estable:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\prepare-cost-optimization-review.ps1 `
  -ConfirmProductionStable

.\logs\cost-optimization\dia83-cost-optimization-commands.ps1
```

Evidencia esperada:

```text
logs\cost-optimization\dia83-cost-evidence.json
logs\cost-optimization\dia83-cloudrun-services.json
logs\cost-optimization\dia83-cloudsql-instance.json
logs\cost-optimization\dia83-cloudrun-request-count.json
logs\cost-optimization\dia83-cloudrun-latency.json
logs\cost-optimization\dia83-cloudsql-cpu.json
logs\cost-optimization\dia83-cloudsql-disk-bytes-used.json
logs\cost-optimization\dia83-billing-project.txt
logs\cost-optimization\dia83-billing-accounts.txt
```

### Paso 8 - Revisar volumen de logs

```powershell
Get-Content -LiteralPath .\logs\cost-optimization\dia83-cloudrun-log-sample.json -Raw |
  ConvertFrom-Json |
  Group-Object severity |
  Select-Object Name, Count

Get-Content -LiteralPath .\logs\cost-optimization\dia83-logging-buckets.json -Raw |
  ConvertFrom-Json
```

No crear exclusiones de logs sin revisar impacto en auditoria, soporte y seguridad.

### Paso 9 - Crear presupuesto y alertas

Primero obtener el ID real de Billing desde la evidencia:

```powershell
Get-Content -LiteralPath .\logs\cost-optimization\dia83-billing-accounts.txt
```

Luego ejecutar la plantilla con el ID real:

```powershell
$BillingAccountId = "<billing-account-id-real>"

powershell -NoProfile -ExecutionPolicy Bypass -File .\logs\cost-optimization\dia83-budget-alert-template.ps1 `
  -BillingAccountId $BillingAccountId `
  -BudgetAmountUsd 150
```

La plantilla crea alertas al 50%, 75% forecast, 90% y 100%.

### Paso 10 - Revisar plan de ajustes

```powershell
Get-Content -LiteralPath .\logs\cost-optimization\dia83-cost-adjustments-plan.json -Raw |
  ConvertFrom-Json
```

Decision base actual:

```text
No bajar mas Cloud Run porque ya esta en min_instances=0.
No subir CPU/RAM sin evidencia de saturacion.
No cambiar Cloud SQL sin evidencia de 30 dias.
No excluir logs de auditoria, errores ni seguridad.
Crear presupuesto con alertas cuando negocio confirme monto.
```

## Pruebas y validaciones

### Validar sintaxis del script

```powershell
$Errors = $null
[void][System.Management.Automation.PSParser]::Tokenize(
  (Get-Content -LiteralPath .\scripts\prepare-cost-optimization-review.ps1 -Raw),
  [ref]$Errors
)

$Errors
```

Resultado esperado:

```text
Sin errores.
```

### Validar sintaxis de los comandos generados

```powershell
$Errors = $null
[void][System.Management.Automation.PSParser]::Tokenize(
  (Get-Content -LiteralPath .\logs\cost-optimization\dia83-cost-optimization-commands.ps1 -Raw),
  [ref]$Errors
)

$Errors
```

Resultado esperado:

```text
Sin errores.
```

### Validar que el reporte existe

```powershell
Test-Path -LiteralPath .\docs\reporte-costo-mensual-estimado.md
```

Resultado esperado:

```text
True
```

## Peticiones HTTP/HTTPS listas para copiar

El Dia 83 es de costos, por eso no crea endpoints nuevos. Si se necesita validar que el shell productivo sigue vivo antes de recolectar costos, usar:

```powershell
$env:CLOUDSDK_PYTHON = "C:\Python312\python.exe"
$GcloudPath = "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd"
$ProjectId = "project-fbb34cd7-0b82-43e1-867"
$Region = "us-central1"

$ShellUrl = (& $GcloudPath run services describe frontend-shell-prod --project $ProjectId --region $Region --format "value(status.url)").Trim()

curl.exe -s "$ShellUrl/api/health"
```

## Publicacion o despliegue

No aplica despliegue de aplicacion.

El unico cambio real opcional es crear presupuesto y alertas en Billing con:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\logs\cost-optimization\dia83-budget-alert-template.ps1 `
  -BillingAccountId "<billing-account-id-real>" `
  -BudgetAmountUsd 150
```

## Verificacion en consola web o por comandos

En Google Cloud Console revisar:

```text
Cloud Run > servicios productivos > Metrics
Cloud SQL > venta-pasajes-prod-sql > Metrics
Logging > Logs Explorer / Log buckets
Billing > Budgets & alerts
Billing > Reports
```

Por comandos:

```powershell
Get-Content -LiteralPath .\logs\cost-optimization\dia83-cost-optimization-readiness.json -Raw |
  ConvertFrom-Json

Get-Content -LiteralPath .\docs\reporte-costo-mensual-estimado.md
```

## Problemas encontrados y soluciones

Problema:

```text
No existe un archivo unico infra\cloudrun\prod-services.json.
```

Solucion:

```text
El Dia 83 usa los archivos reales del repo:
infra\cloudrun\prod-backend-services.json
infra\cloudrun\prod-frontend-services.json
```

Problema:

```text
No se puede certificar costo mensual real sin operacion productiva estable y Billing.
```

Solucion:

```text
El paquete separa dos estados:
1. costo controlado por configuracion;
2. costo real validado con evidencia de Billing y Monitoring.
```

## Estado final

Estado del Dia 83:

```text
Paquete de optimizacion de costos preparado.
Reporte de costo mensual estimado creado.
Plan de ajustes creado.
Plantilla de presupuesto y alertas creada.
No se aplicaron cambios reales en GCP.
```

Siguiente paso natural:

```text
Dia 84 - Documentacion tecnica final.
```
