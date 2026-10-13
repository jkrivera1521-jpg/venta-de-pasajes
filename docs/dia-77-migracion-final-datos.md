# Dia 77 - Migracion final de datos

Fecha: 2026-09-25

## Objetivo

Alinear el Dia 77 con `C:\VENTA-DE-PASAJES\tareas.md`: detener uso del sistema antiguo, respaldar Access final, preparar la migracion final hacia produccion, validar conteos, validar muestras de datos y dejar lista el acta de aprobacion.

Este dia deja el paquete de migracion final preparado y probado localmente. No importa datos reales en Cloud SQL produccion sin aprobacion explicita del plan de corte.

## Resultado alcanzado

Se creo el paquete controlado de migracion final:

```text
C:\VENTA-DE-PASAJES\scripts\run-final-data-migration-prod.ps1
C:\VENTA-DE-PASAJES\docs\acta-validacion-migracion-final.md
C:\VENTA-DE-PASAJES\docs\dia-77-migracion-final-datos.md
```

Al ejecutar el script se generan artefactos locales ignorados por Git:

```text
C:\VENTA-DE-PASAJES\logs\migration\dia77-final-prod\final-data-migration-prod-readiness.json
C:\VENTA-DE-PASAJES\logs\migration\dia77-final-prod\identity_db-dia77-final.sql
C:\VENTA-DE-PASAJES\logs\migration\dia77-final-prod\dispatch_db-dia77-final.sql
C:\VENTA-DE-PASAJES\logs\migration\dia77-final-prod\ticketing_db-dia77-final.sql
C:\VENTA-DE-PASAJES\logs\migration\dia77-final-prod\apply-prod-migration.commands.ps1
C:\VENTA-DE-PASAJES\logs\migration\dia77-final-prod\acta-validacion-migracion-final-borrador.md
```

Estado esperado sin aprobacion real:

```text
Paquete de migracion listo: True
Ejecucion productiva autorizada: False
Migracion productiva ejecutada: False
Datos productivos aprobados: False
```

## Reversa primero

### Reversa local si no se ejecuto produccion

Esta reversa elimina solo archivos locales del Dia 77. No modifica Cloud SQL, Cloud Run, buckets ni datos.

```powershell
cd C:\VENTA-DE-PASAJES

Remove-Item -LiteralPath .\logs\migration\dia77-final-prod -Recurse -Force
Remove-Item -LiteralPath .\scripts\run-final-data-migration-prod.ps1 -Force
Remove-Item -LiteralPath .\docs\acta-validacion-migracion-final.md -Force
Remove-Item -LiteralPath .\docs\dia-77-migracion-final-datos.md -Force
```

Si se generaron copias locales de Access final y se decide limpiarlas:

```powershell
Remove-Item -LiteralPath .\backups\final-data-migration -Recurse -Force
```

### Reversa productiva si ya se importo Cloud SQL

Advertencia: ejecutar solo con aprobacion formal de rollback. Esto restaura la instancia completa desde un backup y puede perder cambios posteriores al backup.

```powershell
cd C:\VENTA-DE-PASAJES

$ProjectId = "project-fbb34cd7-0b82-43e1-867"
$Instance = "venta-pasajes-prod-sql"
$BackupId = "<backup-id-pre-migracion>"

gcloud sql backups restore $BackupId `
  --backup-instance $Instance `
  --restore-instance $Instance `
  --project $ProjectId `
  --quiet
```

Despues de restaurar, validar Cloud Run y conteos antes de reabrir operacion.

## Cambios realizados

```text
scripts/run-final-data-migration-prod.ps1
docs/acta-validacion-migracion-final.md
docs/dia-77-migracion-final-datos.md
README.md
infra/README.md
migration/README.md
vitacora.md
.gitignore
```

## Guia manual desde cero

### Paso 1 - Abrir PowerShell en el workspace

```powershell
cd C:\VENTA-DE-PASAJES
```

### Paso 2 - Confirmar insumos locales

```powershell
Test-Path -LiteralPath .\legacy\sistema\Proyect\usuario.mdb
Test-Path -LiteralPath .\infra\cutover\prod-cutover-plan.json
Test-Path -LiteralPath .\infra\gcloud\cloudsql-prod.json
Test-Path -LiteralPath .\logs\cloudrun-prod\verify-cloudrun-prod-backends.json
Test-Path -LiteralPath .\logs\cloudrun-prod\verify-cloudrun-prod-frontends.json
Test-Path -LiteralPath .\scripts\run-final-migration-rehearsal.ps1
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

### Paso 3 - Revisar aprobacion del plan de corte

```powershell
$Plan = Get-Content -LiteralPath .\infra\cutover\prod-cutover-plan.json -Raw | ConvertFrom-Json
$Plan.approval_status
$Plan.planned_window
```

Para ejecutar produccion, `approval_status` debe ser:

```text
approved_for_execution
```

Si sigue en `proposed_pending_explicit_go_no_go`, no importar en produccion.

### Paso 4 - Generar paquete final sin tocar produccion

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\run-final-data-migration-prod.ps1
```

Resultado esperado:

```text
Paquete de migracion listo: True
Ejecucion productiva autorizada: False
Migracion productiva ejecutada: False
Datos productivos aprobados: False
```

### Paso 5 - Revisar evidencia local

```powershell
$Result = Get-Content -LiteralPath .\logs\migration\dia77-final-prod\final-data-migration-prod-readiness.json -Raw | ConvertFrom-Json
$Result.ready_for_migration_package
$Result.ready_for_production_execution
$Result.rehearsal.local_validation.target_counts
$Result.production_execution_blockers
```

### Paso 6 - Congelar legacy y confirmar GO/NO-GO

Solo durante ventana real:

```text
1. Cerrar operacion en el sistema antiguo.
2. Confirmar cierre de caja.
3. Confirmar cero ventas pendientes.
4. Tomar backup final de Access.
5. Confirmar GO/NO-GO de negocio.
```

### Paso 7 - Recalcular paquete con confirmaciones reales

Ejecutar solo si el plan de corte ya fue aprobado:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\run-final-data-migration-prod.ps1 `
  -ConfirmLegacyFreeze `
  -ConfirmBusinessGoNoGo
```

Resultado esperado si el plan tambien esta aprobado:

```text
Ejecucion productiva autorizada: True
```

### Paso 8 - Crear backup Cloud SQL e importar SQL final

Revisar primero:

```powershell
Get-Content -LiteralPath .\logs\migration\dia77-final-prod\apply-prod-migration.commands.ps1
```

Ejecutar solo con aprobacion formal:

```powershell
.\logs\migration\dia77-final-prod\apply-prod-migration.commands.ps1
```

Este archivo hace:

```text
1. Describe Cloud SQL prod.
2. Crea backup on-demand pre-migracion.
3. Sube SQL final a Cloud Storage.
4. Importa identity_db.
5. Importa dispatch_db.
6. Importa ticketing_db.
7. Lista operaciones recientes de Cloud SQL.
```

### Paso 9 - Validar conteos reales de produccion

Despues de importar, validar en Cloud SQL produccion que los conteos coincidan con:

```text
identity_users: 1
identity_profiles: 1
dispatch_terminals: 2
dispatch_bus_types: 3
dispatch_buses: 1
dispatch_routes: 1
dispatch_departures: 1
ticketing_passengers: 3
ticketing_synced_departures: 1
ticketing_departure_seats: 25
ticketing_tickets: 3
```

### Paso 10 - Validar muestras funcionales

Revisar con negocio:

```text
Usuario migrado.
Bus migrado.
Salida migrada.
Boletos migrados.
Mapa de asientos.
```

### Paso 11 - Cerrar acta

Editar:

```text
C:\VENTA-DE-PASAJES\docs\acta-validacion-migracion-final.md
```

Completar:

```text
Resultado produccion
Estado
Firmas
Observaciones
```

Cuando los datos reales esten aprobados:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\run-final-data-migration-prod.ps1 `
  -ConfirmLegacyFreeze `
  -ConfirmBusinessGoNoGo `
  -ApproveDataMigration
```

## Pruebas y validaciones

Comandos ejecutados durante la practica:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\run-final-data-migration-prod.ps1
gcloud sql backups create --help
gcloud sql import sql --help
```

Resultado observado:

```text
Paquete de migracion listo: True
Ejecucion productiva autorizada: False
Migracion productiva ejecutada: False
Datos productivos aprobados: False

identity_users: 1
identity_profiles: 1
dispatch_terminals: 2
dispatch_bus_types: 3
dispatch_buses: 1
dispatch_routes: 1
dispatch_departures: 1
ticketing_passengers: 3
ticketing_synced_departures: 1
ticketing_departure_seats: 25
ticketing_tickets: 3
```

Bloqueos esperados antes del corte real:

```text
El plan de corte no esta aprobado para ejecucion real.
No se confirmo congelamiento del legacy.
No se confirmo GO/NO-GO de negocio.
```

Validar sintaxis:

```powershell
$Errors = $null
[System.Management.Automation.PSParser]::Tokenize(
  (Get-Content -LiteralPath .\scripts\run-final-data-migration-prod.ps1 -Raw),
  [ref]$Errors
) | Out-Null
if ($Errors.Count -gt 0) { $Errors } else { "parse-ok" }
```

Validar documento:

```powershell
Select-String -Path .\docs\dia-77-migracion-final-datos.md `
  -Pattern "Reversa primero|Guia manual desde cero|Estado final"
```

Validar JSON:

```powershell
$Result = Get-Content -LiteralPath .\logs\migration\dia77-final-prod\final-data-migration-prod-readiness.json -Raw | ConvertFrom-Json
$Result.ready_for_migration_package
$Result.production_execution_blockers
```

## Peticiones HTTP/HTTPS listas para copiar

No son requisito principal del Dia 77. Despues de una importacion real, se deben validar health productivos con los scripts existentes:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-cloudrun-prod-backends.ps1 -FailOnNotReady
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-cloudrun-prod-frontends.ps1 -FailOnNotReady
```

## Problemas encontrados y soluciones

### No se debe importar produccion sin aprobacion

Solucion: el script separa `ready_for_migration_package` de `ready_for_production_execution`.

### El plan de corte sigue pendiente

Solucion: si `approval_status` no es `approved_for_execution`, el paquete se genera, pero la ejecucion productiva queda bloqueada.

### La aprobacion de datos no puede simularse

Solucion: el acta queda en estado pendiente hasta validar conteos reales y muestras funcionales en produccion.

## Estado final

Paquete de migracion final creado.

SQL final generado desde Access.

Validacion local PostgreSQL ejecutada.

Comandos productivos generados pero no ejecutados.

Acta de validacion creada como pendiente.

Produccion no fue modificada.

Siguiente paso natural: Dia 78 - Prueba productiva controlada.
