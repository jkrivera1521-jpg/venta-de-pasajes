# Dia 75 - Plan de corte y rollback

Fecha: 2026-09-25

## Objetivo

Alinear el Dia 75 con `C:\VENTA-DE-PASAJES\tareas.md`: definir la ventana de corte, responsables, congelamiento del sistema antiguo, respaldo final, criterios de rollback y comunicacion a usuarios.

Este dia no ejecuta el corte productivo. Deja el cambio controlado y verificable.

## Resultado alcanzado

Se creo el paquete operativo de corte:

```text
C:\VENTA-DE-PASAJES\infra\cutover\prod-cutover-plan.json
C:\VENTA-DE-PASAJES\scripts\verify-cutover-rollback-plan.ps1
C:\VENTA-DE-PASAJES\logs\cutover\dia75-cutover-readiness.json
```

Resultado verificado:

```text
Ventana propuesta: 2026-09-28 22:00 a 23:30 America/Guayaquil
Plan de corte controlado listo: True
Ejecucion real autorizada: False
Bloqueos: 0
Advertencias: 2
```

La ejecucion real queda en `False` a proposito porque falta aprobacion explicita de negocio y asignar nombres concretos a responsables. El plan esta listo para control, no para disparar un corte sin autorizacion.

## Reversa primero

Esta reversa elimina solo archivos locales del Dia 75. No elimina Cloud Run, Cloud SQL, buckets, secretos ni datos.

### Paso R1 - Ubicarse en el workspace

```powershell
cd C:\VENTA-DE-PASAJES
```

### Paso R2 - Eliminar evidencia local del verificador

```powershell
Remove-Item -LiteralPath .\logs\cutover\dia75-cutover-readiness.json -Force
```

### Paso R3 - Eliminar plan y script del Dia 75

```powershell
Remove-Item -LiteralPath .\infra\cutover\prod-cutover-plan.json -Force
Remove-Item -LiteralPath .\scripts\verify-cutover-rollback-plan.ps1 -Force
Remove-Item -LiteralPath .\docs\dia-75-plan-corte-rollback.md -Force
```

### Paso R4 - Eliminar carpeta cutover si queda vacia

```powershell
if (Test-Path -LiteralPath .\infra\cutover) {
  $Items = Get-ChildItem -LiteralPath .\infra\cutover -Force
  if (@($Items).Count -eq 0) {
    Remove-Item -LiteralPath .\infra\cutover -Force
  }
}
```

## Cambios realizados

```text
infra/cutover/prod-cutover-plan.json
scripts/verify-cutover-rollback-plan.ps1
docs/dia-75-plan-corte-rollback.md
logs/cutover/dia75-cutover-readiness.json
```

## Definiciones del plan

### Ventana de corte

```text
Inicio propuesto: 2026-09-28T22:00:00-05:00
Fin propuesto:    2026-09-28T23:30:00-05:00
Zona horaria:     America/Guayaquil
Estado:           propuesta pendiente de aprobacion go/no-go
```

### Responsables definidos

```text
cutover_lead: responsable tecnico del proyecto
business_owner: responsable operativo de boleteria
legacy_owner: responsable sistema legacy Access/VB6
data_owner: responsable de datos
qa_owner: responsable QA/UAT
communications_owner: responsable de comunicacion operativa
```

Antes del corte real, cada rol debe tener nombre/persona concreta en la bitacora de corte.

### Congelamiento del sistema antiguo

```text
Freeze propuesto: 2026-09-28T20:00:00-05:00
Regla 1: no crear ni modificar rutas, buses, usuarios ni parametros despues del freeze.
Regla 2: no emitir boletos nuevos desde legacy una vez iniciado el freeze duro.
Regla 3: permitir solo consulta hasta confirmar respaldo final.
Regla 4: registrar cualquier excepcion antes de continuar.
```

### Respaldo final

Debe incluir:

```text
Copia final de usuario.mdb despues del freeze duro.
SHA256 de origen y copia.
Backup on-demand de Cloud SQL produccion.
Inventario del bucket documental productivo.
Commit o tag Git usado para el corte.
```

### Criterios de rollback

El rollback debe ejecutarse si aparece cualquiera de estos escenarios:

```text
Falla health backend o frontend que impide venta y no se resuelve en 30 minutos.
Conteos de migracion no cuadran y afectan pasajeros, salidas, asientos o boletos.
Usuario funcional no puede iniciar sesion u operar venta.
Mapa de asientos muestra disponibilidad incorrecta.
Emision de boleto registra datos incorrectos.
Documentos de boleto no se generan cuando el flujo los requiere.
Error de seguridad, exposicion de datos o acceso no autorizado.
Entrada productiva, dominio o TLS no queda disponible para usuarios.
Cualquier incidente P1 declarado por negocio o responsable tecnico.
```

## Guia manual desde cero

### Paso 1 - Preparar terminal

```powershell
cd C:\VENTA-DE-PASAJES
```

### Paso 2 - Verificar archivos requeridos

```powershell
Test-Path -LiteralPath .\infra\cutover\prod-cutover-plan.json
Test-Path -LiteralPath .\scripts\verify-cutover-rollback-plan.ps1
Test-Path -LiteralPath .\logs\cloudrun-prod\verify-cloudrun-prod-backends.json
Test-Path -LiteralPath .\logs\cloudrun-prod\verify-cloudrun-prod-frontends.json
Test-Path -LiteralPath .\logs\migration\dia74-final-rehearsal\final-migration-rehearsal.json
Test-Path -LiteralPath .\logs\backup-restore\verify-backup-restore-readiness-staging.json
```

Todos deben responder `True`.

### Paso 3 - Revisar ventana y estado del plan

```powershell
$Plan = Get-Content -LiteralPath .\infra\cutover\prod-cutover-plan.json -Raw | ConvertFrom-Json
$Plan.planned_window
$Plan.approval_status
$Plan.responsibilities | Select-Object role, owner, backup_owner
```

Resultado esperado:

```text
approval_status = proposed_pending_explicit_go_no_go
```

### Paso 4 - Ejecutar verificador del paquete de corte

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-cutover-rollback-plan.ps1 `
  -FailOnBlocker
```

Resultado esperado:

```text
Plan de corte controlado listo: True
Ejecucion real autorizada: False
```

La ejecucion real debe permanecer en `False` hasta que negocio apruebe formalmente el go/no-go.

### Paso 5 - Revisar evidencia JSON

```powershell
$Readiness = Get-Content -LiteralPath .\logs\cutover\dia75-cutover-readiness.json -Raw | ConvertFrom-Json
$Readiness.ready_for_controlled_cutover_plan
$Readiness.ready_for_real_execution
$Readiness.blockers
$Readiness.warnings
```

Resultado esperado:

```text
ready_for_controlled_cutover_plan = True
ready_for_real_execution = False
blockers = vacio
warnings = aprobacion pendiente y responsables por rol
```

### Paso 6 - Registrar aprobacion manual antes del corte real

No cambiar `approval_status` a `approved_for_execution` hasta tener aprobacion real.

Cuando exista aprobacion:

```powershell
$PlanPath = ".\infra\cutover\prod-cutover-plan.json"
$Plan = Get-Content -LiteralPath $PlanPath -Raw | ConvertFrom-Json
$Plan.approval_status = "approved_for_execution"
$Plan | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $PlanPath -Encoding UTF8

powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-cutover-rollback-plan.ps1 `
  -FailOnBlocker
```

Resultado esperado solo despues de aprobacion:

```text
Plan de corte controlado listo: True
Ejecucion real autorizada: True
```

### Paso 7 - Respaldo final del Access legacy

Ejecutar dentro de la ventana real, despues del freeze duro:

```powershell
$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$BackupDir = ".\backups\cutover-final\$Timestamp"
New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null

Copy-Item -LiteralPath .\legacy\sistema\Proyect\usuario.mdb `
  -Destination "$BackupDir\usuario.mdb" `
  -Force

Get-FileHash -LiteralPath .\legacy\sistema\Proyect\usuario.mdb -Algorithm SHA256
Get-FileHash -LiteralPath "$BackupDir\usuario.mdb" -Algorithm SHA256
```

Los hashes deben coincidir.

### Paso 8 - Backup final Cloud SQL produccion

Ejecutar solo dentro de la ventana real:

```powershell
$env:CLOUDSDK_PYTHON = "C:\Python312\python.exe"
$ProjectId = "project-fbb34cd7-0b82-43e1-867"
$Instance = "venta-pasajes-prod-sql"
$Description = "dia75-pre-cutover-final-backup"
$Gcloud = "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd"

& $Gcloud sql backups create `
  --instance $Instance `
  --project $ProjectId `
  --description $Description

& $Gcloud sql backups list `
  --instance $Instance `
  --project $ProjectId `
  --limit 5 `
  --format "table(id,status,endTime,description)"
```

Guardar el `id` del backup en la bitacora de corte.

### Paso 9 - Inventario documental productivo

```powershell
$ProjectId = "project-fbb34cd7-0b82-43e1-867"
$Bucket = "venta-pasajes-prod-documents"
$Gcloud = "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd"

& $Gcloud storage ls --recursive "gs://$Bucket" `
  --project $ProjectId `
  > .\logs\cutover\prod-documents-inventory.txt
```

### Paso 10 - Verificacion tecnica antes de go-live

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-cloudrun-prod-backends.ps1 `
  -FailOnNotReady

powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-cloudrun-prod-frontends.ps1 `
  -FailOnNotReady
```

### Paso 11 - Comunicacion a usuarios

Mensajes base definidos en el plan:

```powershell
$Plan = Get-Content -LiteralPath .\infra\cutover\prod-cutover-plan.json -Raw | ConvertFrom-Json
$Plan.communications | Select-Object id, when, audience, message | Format-Table -AutoSize
```

## Comandos de validacion ejecutados

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-cutover-rollback-plan.ps1 -FailOnBlocker
```

Resultado observado:

```text
Archivos requeridos: 10/10.
Ventana definida: True.
Responsables definidos: 6 roles.
Congelamiento legacy definido: True.
Respaldo final definido: True.
Criterios rollback definidos: 9.
Comunicaciones definidas: 5.
Backends prod listos: True.
Frontends prod listos: True.
Ensayo migracion listo: True.
Backup/restore staging listo: True.
Plan de corte controlado listo: True.
Ejecucion real autorizada: False.
```

## Peticiones HTTP/HTTPS

No aplica como requisito principal del Dia 75. La validacion tecnica usa scripts existentes.

Si se requiere una comprobacion rapida del shell productivo:

```powershell
curl.exe -s "https://frontend-shell-prod-io7kxgn6yq-uc.a.run.app/api/health"
```

## Problemas encontrados y soluciones

### No habia paquete formal de corte

Se creo `infra/cutover/prod-cutover-plan.json` para centralizar ventana, responsables, freeze, backup, rollback y comunicacion.

### El plan no debe autorizar ejecucion real por accidente

El estado inicial queda como `proposed_pending_explicit_go_no_go`. Por eso el verificador devuelve:

```text
Plan de corte controlado listo: True
Ejecucion real autorizada: False
```

### Responsables por rol, no por nombre

El plan define roles obligatorios. Antes del corte real hay que registrar nombres concretos en la bitacora de corte.

## Estado final

```text
Plan de corte definido.
Plan de rollback definido.
Congelamiento legacy definido.
Respaldo final definido.
Comunicacion a usuarios definida.
Evidencias de dias 68, 72, 73 y 74 enlazadas.
Verificador ejecutado sin bloqueos.
Ejecucion real protegida por aprobacion explicita.
```

Siguiente paso natural: Dia 76 - Capacitacion operativa.
