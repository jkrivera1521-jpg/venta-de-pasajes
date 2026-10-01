[CmdletBinding()]
param(
  [string]$ResultPath = "logs\migration\dia77-final-prod\final-data-migration-prod-readiness.json",
  [string]$CommandPath = "logs\migration\dia77-final-prod\apply-prod-migration.commands.ps1",
  [string]$CutoverPlanPath = "infra\cutover\prod-cutover-plan.json",
  [switch]$ConfirmLegacyFreeze,
  [switch]$ConfirmBusinessGoNoGo,
  [switch]$ConfirmProductionImportExecuted,
  [switch]$ApproveDataMigration,
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

$ResolvedResultPath = Resolve-ProjectPath -Path $ResultPath
$ResolvedCommandPath = Resolve-ProjectPath -Path $CommandPath
$ResolvedCutoverPlanPath = Resolve-ProjectPath -Path $CutoverPlanPath

if (-not (Test-Path -LiteralPath $ResolvedResultPath)) {
  throw "No existe la evidencia de migracion final: $ResolvedResultPath"
}

if (-not (Test-Path -LiteralPath $ResolvedCommandPath)) {
  throw "No existe el archivo de comandos productivos: $ResolvedCommandPath"
}

if (-not (Test-Path -LiteralPath $ResolvedCutoverPlanPath)) {
  throw "No existe el plan de corte productivo: $ResolvedCutoverPlanPath"
}

$Result = Get-Content -LiteralPath $ResolvedResultPath -Raw | ConvertFrom-Json
$CutoverPlan = Get-Content -LiteralPath $ResolvedCutoverPlanPath -Raw | ConvertFrom-Json
$Blockers = [System.Collections.Generic.List[string]]::new()

if (-not [bool]$Result.ready_for_migration_package) {
  $Blockers.Add("El paquete de migracion final no esta listo.")
}
if ([string]$CutoverPlan.approval_status -ne "approved_for_execution") {
  $Blockers.Add("El plan de corte no esta aprobado para ejecucion real: $($CutoverPlan.approval_status)")
}
if (-not [bool]$ConfirmLegacyFreeze) {
  $Blockers.Add("No se confirmo congelamiento del legacy con -ConfirmLegacyFreeze.")
}
if (-not [bool]$ConfirmBusinessGoNoGo) {
  $Blockers.Add("No se confirmo GO/NO-GO de negocio con -ConfirmBusinessGoNoGo.")
}
if (-not [bool]$ConfirmProductionImportExecuted) {
  $Blockers.Add("No se confirmo que apply-prod-migration.commands.ps1 fue ejecutado exitosamente.")
}
if (-not [bool]$ApproveDataMigration) {
  $Blockers.Add("No se aprobo la validacion de datos productivos con -ApproveDataMigration.")
}

$ReadyForProductionExecution = $Blockers.Count -eq 0
$ProductionMigrationExecuted = $ReadyForProductionExecution
$DataValidationApproved = $ReadyForProductionExecution

$Result.ready_for_production_execution = $ReadyForProductionExecution
$Result.production_migration_executed = $ProductionMigrationExecuted
$Result.data_validation_approved = $DataValidationApproved
$Result.production_execution_blockers = @($Blockers)
$Result.warnings = if ($DataValidationApproved) { @() } else { @("La aprobacion de datos migrados sigue pendiente.") }

$ExecutionEvidence = [pscustomobject]@{
  recorded_at = (Get-Date).ToString("o")
  command_path = $ResolvedCommandPath
  command_last_write_time = (Get-Item -LiteralPath $ResolvedCommandPath).LastWriteTime.ToString("o")
  cutover_plan_path = $ResolvedCutoverPlanPath
  cutover_approval_status = [string]$CutoverPlan.approval_status
  confirmed_legacy_freeze = [bool]$ConfirmLegacyFreeze
  confirmed_business_go_no_go = [bool]$ConfirmBusinessGoNoGo
  confirmed_production_import_executed = [bool]$ConfirmProductionImportExecuted
  approved_data_migration = [bool]$ApproveDataMigration
}

$Result | Add-Member -NotePropertyName production_execution_evidence -NotePropertyValue $ExecutionEvidence -Force
$Result.generated_at = (Get-Date).ToString("o")
$Result | ConvertTo-Json -Depth 14 | Set-Content -LiteralPath $ResolvedResultPath -Encoding UTF8

Write-Host "Resultado JSON: $ResolvedResultPath"
Write-Host "Ejecucion productiva autorizada: $ReadyForProductionExecution"
Write-Host "Migracion productiva ejecutada: $ProductionMigrationExecuted"
Write-Host "Datos productivos aprobados: $DataValidationApproved"

if ($Blockers.Count -gt 0) {
  Write-Host "Bloqueos:"
  foreach ($Blocker in $Blockers) {
    Write-Host "- $Blocker"
  }
}

if ($FailOnBlocker -and $Blockers.Count -gt 0) {
  throw "La migracion final productiva aun tiene bloqueos."
}
