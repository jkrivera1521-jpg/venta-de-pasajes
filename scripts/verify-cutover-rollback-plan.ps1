param(
  [string]$PlanPath = "infra\cutover\prod-cutover-plan.json",
  [string]$OutputPath = "logs\cutover\dia75-cutover-readiness.json",
  [switch]$FailOnBlocker
)

$ErrorActionPreference = "Stop"

$ProjectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
Set-Location $ProjectRoot

function Resolve-ProjectPath {
  param([string]$Path)

  if ([System.IO.Path]::IsPathRooted($Path)) {
    return [System.IO.Path]::GetFullPath($Path)
  }

  return [System.IO.Path]::GetFullPath((Join-Path $ProjectRoot $Path))
}

function Read-JsonFile {
  param([string]$Path)

  if (-not (Test-Path -LiteralPath $Path)) {
    return $null
  }

  return Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json
}

function Add-Check {
  param(
    [System.Collections.Generic.List[object]]$Checks,
    [string]$Area,
    [string]$Name,
    [bool]$Passed,
    [string]$Detail = ""
  )

  $Checks.Add([pscustomobject]@{
    area = $Area
    name = $Name
    passed = $Passed
    detail = $Detail
  })
}

$ResolvedPlanPath = Resolve-ProjectPath -Path $PlanPath
if (-not (Test-Path -LiteralPath $ResolvedPlanPath)) {
  throw "No existe el plan de corte: $ResolvedPlanPath"
}

$Plan = Get-Content -LiteralPath $ResolvedPlanPath -Raw | ConvertFrom-Json

$EvidencePaths = [ordered]@{
  backend_prod = "logs\cloudrun-prod\verify-cloudrun-prod-backends.json"
  frontend_prod = "logs\cloudrun-prod\verify-cloudrun-prod-frontends.json"
  migration_rehearsal = "logs\migration\dia74-final-rehearsal\final-migration-rehearsal.json"
  staging_restore = "logs\backup-restore\verify-backup-restore-readiness-staging.json"
  backend_config = "infra\cloudrun\prod-backend-services.json"
  frontend_config = "infra\cloudrun\prod-frontend-services.json"
  day68_doc = "docs\dia-68-backups-restauracion-staging.md"
  day72_doc = "docs\dia-72-despliegue-productivo-backend.md"
  day73_doc = "docs\dia-73-despliegue-productivo-frontend.md"
  day74_doc = "docs\dia-74-ensayo-migracion-final.md"
}

$ResolvedEvidence = [ordered]@{}
foreach ($Key in $EvidencePaths.Keys) {
  $ResolvedEvidence[$Key] = Resolve-ProjectPath -Path $EvidencePaths[$Key]
}

$Backend = Read-JsonFile -Path $ResolvedEvidence.backend_prod
$Frontend = Read-JsonFile -Path $ResolvedEvidence.frontend_prod
$Migration = Read-JsonFile -Path $ResolvedEvidence.migration_rehearsal
$Restore = Read-JsonFile -Path $ResolvedEvidence.staging_restore

$Checks = [System.Collections.Generic.List[object]]::new()
$Warnings = [System.Collections.Generic.List[string]]::new()
$Blockers = [System.Collections.Generic.List[string]]::new()

foreach ($Key in $ResolvedEvidence.Keys) {
  $Exists = Test-Path -LiteralPath $ResolvedEvidence[$Key]
  Add-Check -Checks $Checks -Area "files" -Name $Key -Passed $Exists -Detail $ResolvedEvidence[$Key]
  if (-not $Exists) {
    $Blockers.Add("Falta evidencia requerida: $Key -> $($EvidencePaths[$Key])")
  }
}

$WindowDefined = (
  -not [string]::IsNullOrWhiteSpace([string]$Plan.planned_window.start_local) -and
  -not [string]::IsNullOrWhiteSpace([string]$Plan.planned_window.end_local) -and
  -not [string]::IsNullOrWhiteSpace([string]$Plan.time_zone)
)
Add-Check -Checks $Checks -Area "plan" -Name "planned window defined" -Passed $WindowDefined -Detail "$($Plan.planned_window.start_local) - $($Plan.planned_window.end_local) $($Plan.time_zone)"
if (-not $WindowDefined) {
  $Blockers.Add("No esta definida la ventana de corte.")
}

$ResponsibilitiesComplete = @($Plan.responsibilities).Count -ge 6
Add-Check -Checks $Checks -Area "plan" -Name "responsibilities defined" -Passed $ResponsibilitiesComplete -Detail "$(@($Plan.responsibilities).Count) roles"
if (-not $ResponsibilitiesComplete) {
  $Blockers.Add("Faltan responsables minimos del corte.")
}

$FreezeDefined = $null -ne $Plan.legacy_freeze -and @($Plan.legacy_freeze.rules).Count -gt 0
Add-Check -Checks $Checks -Area "plan" -Name "legacy freeze defined" -Passed $FreezeDefined -Detail "$(@($Plan.legacy_freeze.rules).Count) reglas"
if (-not $FreezeDefined) {
  $Blockers.Add("No esta definido el congelamiento del sistema antiguo.")
}

$FinalBackupDefined = $null -ne $Plan.final_backup -and [bool]$Plan.final_backup.required -and @($Plan.final_backup.steps).Count -gt 0
Add-Check -Checks $Checks -Area "plan" -Name "final backup defined" -Passed $FinalBackupDefined -Detail "$(@($Plan.final_backup.steps).Count) pasos"
if (-not $FinalBackupDefined) {
  $Blockers.Add("No esta definido el respaldo final.")
}

$RollbackCriteriaDefined = @($Plan.rollback_criteria).Count -ge 5
Add-Check -Checks $Checks -Area "plan" -Name "rollback criteria defined" -Passed $RollbackCriteriaDefined -Detail "$(@($Plan.rollback_criteria).Count) criterios"
if (-not $RollbackCriteriaDefined) {
  $Blockers.Add("Faltan criterios de rollback suficientes.")
}

$RollbackPlanDefined = $null -ne $Plan.rollback_plan -and @($Plan.rollback_plan.before_opening_sales).Count -gt 0 -and @($Plan.rollback_plan.after_opening_sales).Count -gt 0
Add-Check -Checks $Checks -Area "plan" -Name "rollback plan defined" -Passed $RollbackPlanDefined -Detail "before/after sales"
if (-not $RollbackPlanDefined) {
  $Blockers.Add("No esta definido el plan de rollback antes y despues de abrir ventas.")
}

$CommunicationsDefined = @($Plan.communications).Count -ge 4
Add-Check -Checks $Checks -Area "plan" -Name "communications defined" -Passed $CommunicationsDefined -Detail "$(@($Plan.communications).Count) mensajes"
if (-not $CommunicationsDefined) {
  $Blockers.Add("No esta definida la comunicacion a usuarios.")
}

$TimelineDefined = @($Plan.cutover_timeline).Count -ge 8
Add-Check -Checks $Checks -Area "plan" -Name "timeline defined" -Passed $TimelineDefined -Detail "$(@($Plan.cutover_timeline).Count) fases"
if (-not $TimelineDefined) {
  $Blockers.Add("No esta definida la linea de tiempo de corte.")
}

$BackendReady = $false
if ($Backend) {
  $BackendReady = [bool]$Backend.ready -and
    ([int]$Backend.summary.services_ready -eq 6) -and
    ([int]$Backend.summary.smoke_tests_passed -eq 6)
}
Add-Check -Checks $Checks -Area "evidence" -Name "prod backends ready" -Passed $BackendReady -Detail "services_ready=$($Backend.summary.services_ready); smoke_tests_passed=$($Backend.summary.smoke_tests_passed)"
if (-not $BackendReady) {
  $Blockers.Add("Los backends productivos no tienen evidencia lista 6/6.")
}

$FrontendReady = $false
if ($Frontend) {
  $FrontendReady = ([int]$Frontend.summary.services_ready -eq 6) -and
    ([int]$Frontend.summary.checks_failed -eq 0) -and
    ([int]$Frontend.summary.checks_passed -eq 19)
}
Add-Check -Checks $Checks -Area "evidence" -Name "prod frontends ready" -Passed $FrontendReady -Detail "services_ready=$($Frontend.summary.services_ready); checks_failed=$($Frontend.summary.checks_failed)"
if (-not $FrontendReady) {
  $Blockers.Add("Los frontends productivos no tienen evidencia lista.")
}

$MigrationReady = $false
if ($Migration) {
  $MigrationReady = [bool]$Migration.ready_for_staging_execution -and @($Migration.blockers).Count -eq 0
}
Add-Check -Checks $Checks -Area "evidence" -Name "migration rehearsal ready" -Passed $MigrationReady -Detail "estimated_cutover=$($Migration.estimated_cutover.estimated_cutover_minutes) minutes"
if (-not $MigrationReady) {
  $Blockers.Add("El ensayo de migracion final no esta listo.")
}

$RestoreReady = $false
if ($Restore) {
  $RestoreReady = [bool]$Restore.readiness.ready_for_restore_test -and @($Restore.readiness.blockers).Count -eq 0
}
Add-Check -Checks $Checks -Area "evidence" -Name "restore readiness ready" -Passed $RestoreReady -Detail "staging backup/restore readiness"
if (-not $RestoreReady) {
  $Blockers.Add("No existe evidencia de backup/restore staging lista.")
}

if ([string]$Plan.approval_status -ne "approved_for_execution") {
  $Warnings.Add("El plan esta definido, pero no esta aprobado para ejecucion real: $($Plan.approval_status)")
}

$RoleOwnersWithoutNamedPerson = @(
  $Plan.responsibilities |
    Where-Object { [string]$_.owner -match "^Responsable " -or [string]$_.owner -match " designado$" }
)
if ($RoleOwnersWithoutNamedPerson.Count -gt 0) {
  $Warnings.Add("Los responsables estan definidos por rol. Antes del corte real asignar nombres/personas concretas en la bitacora de corte.")
}

$ReadyForControlledCutoverPlan = $Blockers.Count -eq 0
$ReadyForRealExecution = $ReadyForControlledCutoverPlan -and ([string]$Plan.approval_status -eq "approved_for_execution")

$Result = [pscustomobject]@{
  generated_at = (Get-Date).ToString("o")
  plan_path = $ResolvedPlanPath
  project_id = $Plan.project_id
  region = $Plan.region
  time_zone = $Plan.time_zone
  planned_window = $Plan.planned_window
  approval_status = $Plan.approval_status
  ready_for_controlled_cutover_plan = $ReadyForControlledCutoverPlan
  ready_for_real_execution = $ReadyForRealExecution
  checks = @($Checks)
  blockers = @($Blockers)
  warnings = @($Warnings)
  evidence = $ResolvedEvidence
}

$ResolvedOutputPath = Resolve-ProjectPath -Path $OutputPath
$OutputDir = Split-Path -Parent $ResolvedOutputPath
New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
$Result | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $ResolvedOutputPath -Encoding UTF8

@($Checks) |
  Select-Object area, name, passed, detail |
  Format-Table -AutoSize

Write-Host "Resultado JSON: $ResolvedOutputPath"
Write-Host "Plan de corte controlado listo: $ReadyForControlledCutoverPlan"
Write-Host "Ejecucion real autorizada: $ReadyForRealExecution"

if ($Warnings.Count -gt 0) {
  Write-Host "Advertencias:"
  foreach ($Warning in $Warnings) {
    Write-Host "- $Warning"
  }
}

if ($Blockers.Count -gt 0) {
  Write-Host "Bloqueos:"
  foreach ($Blocker in $Blockers) {
    Write-Host "- $Blocker"
  }
}

if ($FailOnBlocker -and $Blockers.Count -gt 0) {
  exit 2
}
