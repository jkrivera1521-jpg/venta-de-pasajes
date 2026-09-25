param(
  [string]$AccessPath = "legacy\sistema\Proyect\usuario.mdb",
  [string]$OutputDir = "logs\migration\dia77-final-prod",
  [string]$BackupRoot = "backups\final-data-migration",
  [string]$CutoverPlanPath = "infra\cutover\prod-cutover-plan.json",
  [string]$CloudSqlProdConfigPath = "infra\gcloud\cloudsql-prod.json",
  [string]$ProdBackendEvidencePath = "logs\cloudrun-prod\verify-cloudrun-prod-backends.json",
  [string]$ProdFrontendEvidencePath = "logs\cloudrun-prod\verify-cloudrun-prod-frontends.json",
  [string]$ContainerName = "venta-pasajes-dia77-migration",
  [switch]$ConfirmLegacyFreeze,
  [switch]$ConfirmBusinessGoNoGo,
  [switch]$ApproveDataMigration,
  [switch]$FailOnTechnicalBlocker
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

function Write-ProductionCommandFile {
  param(
    [string]$Path,
    [string]$ProjectId,
    [string]$InstanceName,
    [string]$BucketName,
    [string]$RunId,
    [string]$IdentitySqlPath,
    [string]$DispatchSqlPath,
    [string]$TicketingSqlPath
  )

  $Lines = @(
    "# Dia 77 - comandos productivos generados",
    "# Ejecutar solo dentro de la ventana aprobada y despues del backup Cloud SQL.",
    "# Este archivo importa SQL final en Cloud SQL prod usando archivos subidos a Cloud Storage.",
    "",
    "`$ProjectId = '$ProjectId'",
    "`$Instance = '$InstanceName'",
    "`$Bucket = '$BucketName'",
    "`$RunId = '$RunId'",
    "`$GcsBase = `"gs://`$Bucket/migration/dia77/`$RunId`"",
    "`$IdentitySql = '$IdentitySqlPath'",
    "`$DispatchSql = '$DispatchSqlPath'",
    "`$TicketingSql = '$TicketingSqlPath'",
    "",
    "gcloud sql instances describe `$Instance --project `$ProjectId --format `"value(serviceAccountEmailAddress)`"",
    "gcloud sql backups create --instance `$Instance --project `$ProjectId --description `"dia77-pre-final-data-migration-`$RunId`"",
    "gcloud sql backups list --instance `$Instance --project `$ProjectId --limit 5",
    "",
    "gcloud storage cp `$IdentitySql `"`$GcsBase/identity_db-dia77-final.sql`" --project `$ProjectId",
    "gcloud storage cp `$DispatchSql `"`$GcsBase/dispatch_db-dia77-final.sql`" --project `$ProjectId",
    "gcloud storage cp `$TicketingSql `"`$GcsBase/ticketing_db-dia77-final.sql`" --project `$ProjectId",
    "",
    "gcloud sql import sql `$Instance `"`$GcsBase/identity_db-dia77-final.sql`" --database identity_db --project `$ProjectId --quiet",
    "gcloud sql import sql `$Instance `"`$GcsBase/dispatch_db-dia77-final.sql`" --database dispatch_db --project `$ProjectId --quiet",
    "gcloud sql import sql `$Instance `"`$GcsBase/ticketing_db-dia77-final.sql`" --database ticketing_db --project `$ProjectId --quiet",
    "",
    "gcloud sql operations list --instance `$Instance --project `$ProjectId --limit 10"
  )

  Set-Content -LiteralPath $Path -Value $Lines -Encoding UTF8
}

function Write-ValidationActDraft {
  param(
    [string]$Path,
    [object]$Evidence
  )

  $Counts = $Evidence.rehearsal.local_validation.target_counts
  $AccessTables = $Evidence.rehearsal.access.tables
  $GeneratedAt = $Evidence.generated_at
  $RunId = $Evidence.run_id

  $Lines = @(
    "# Acta de validacion de migracion final - borrador",
    "",
    "Run ID: $RunId",
    "",
    "Generado: $GeneratedAt",
    "",
    "Estado: PENDIENTE_EJECUCION_PRODUCTIVA_Y_FIRMA",
    "",
    "## Conteos origen Access",
    "",
    "| Tabla | Filas |",
    "| --- | ---: |"
  )

  foreach ($Table in $AccessTables) {
    $Lines += "| $($Table.name) | $($Table.count) |"
  }

  $Lines += @(
    "",
    "## Conteos validados en PostgreSQL local",
    "",
    "| Control | Filas |",
    "| --- | ---: |"
  )

  foreach ($Property in $Counts.PSObject.Properties) {
    $Lines += "| $($Property.Name) | $($Property.Value) |"
  }

  $Lines += @(
    "",
    "## Firmas",
    "",
    "| Rol | Nombre | Aprobacion | Firma | Fecha |",
    "| --- | --- | --- | --- | --- |",
    "| Responsable de datos | <nombre> | Pendiente | <firma> | <fecha> |",
    "| Responsable de negocio | <nombre> | Pendiente | <firma> | <fecha> |",
    "| Responsable tecnico | <nombre> | Pendiente | <firma> | <fecha> |",
    "",
    "## Nota",
    "",
    "Este borrador no prueba que produccion ya tenga los datos. Debe cerrarse despues de importar en Cloud SQL prod y validar conteos reales."
  )

  Set-Content -LiteralPath $Path -Value $Lines -Encoding UTF8
}

$RunId = Get-Date -Format "yyyyMMdd-HHmmss"
$ResolvedOutputDir = Resolve-ProjectPath -Path $OutputDir
$ResolvedBackupRoot = Resolve-ProjectPath -Path $BackupRoot
$ResolvedGeneratedDir = Join-Path $ResolvedOutputDir "generated"
$ResolvedAccessPath = Resolve-ProjectPath -Path $AccessPath
$ResolvedCutoverPlanPath = Resolve-ProjectPath -Path $CutoverPlanPath
$ResolvedCloudSqlProdConfigPath = Resolve-ProjectPath -Path $CloudSqlProdConfigPath
$ResolvedBackendEvidencePath = Resolve-ProjectPath -Path $ProdBackendEvidencePath
$ResolvedFrontendEvidencePath = Resolve-ProjectPath -Path $ProdFrontendEvidencePath
$RehearsalScriptPath = Resolve-ProjectPath -Path "scripts\run-final-migration-rehearsal.ps1"

New-Item -ItemType Directory -Force -Path $ResolvedOutputDir | Out-Null
New-Item -ItemType Directory -Force -Path $ResolvedGeneratedDir | Out-Null
New-Item -ItemType Directory -Force -Path $ResolvedBackupRoot | Out-Null

$Checks = [System.Collections.Generic.List[object]]::new()
$TechnicalBlockers = [System.Collections.Generic.List[string]]::new()
$ProductionExecutionBlockers = [System.Collections.Generic.List[string]]::new()
$Warnings = [System.Collections.Generic.List[string]]::new()

$RequiredFiles = [ordered]@{
  access = $ResolvedAccessPath
  cutover_plan = $ResolvedCutoverPlanPath
  cloudsql_prod_config = $ResolvedCloudSqlProdConfigPath
  prod_backend_evidence = $ResolvedBackendEvidencePath
  prod_frontend_evidence = $ResolvedFrontendEvidencePath
  rehearsal_script = $RehearsalScriptPath
}

foreach ($Key in $RequiredFiles.Keys) {
  $Exists = Test-Path -LiteralPath $RequiredFiles[$Key]
  Add-Check -Checks $Checks -Area "files" -Name $Key -Passed $Exists -Detail $RequiredFiles[$Key]
  if (-not $Exists) {
    $TechnicalBlockers.Add("Falta archivo requerido: $Key -> $($RequiredFiles[$Key])")
  }
}

if ($TechnicalBlockers.Count -eq 0) {
  $RehearsalArgs = @(
    "-NoProfile",
    "-ExecutionPolicy", "Bypass",
    "-File", $RehearsalScriptPath,
    "-AccessPath", $ResolvedAccessPath,
    "-OutputDir", $ResolvedGeneratedDir,
    "-BackupRoot", $ResolvedBackupRoot,
    "-ContainerName", $ContainerName,
    "-ValidateLocal",
    "-FailOnBlocked"
  )

  & powershell @RehearsalArgs
  if ($LASTEXITCODE -ne 0) {
    throw "El ensayo tecnico de migracion final fallo con codigo $LASTEXITCODE."
  }
}

$RehearsalJsonPath = Join-Path $ResolvedGeneratedDir "final-migration-rehearsal.json"
$Rehearsal = Read-JsonFile -Path $RehearsalJsonPath
$CutoverPlan = Read-JsonFile -Path $ResolvedCutoverPlanPath
$CloudSqlProd = Read-JsonFile -Path $ResolvedCloudSqlProdConfigPath
$BackendProd = Read-JsonFile -Path $ResolvedBackendEvidencePath
$FrontendProd = Read-JsonFile -Path $ResolvedFrontendEvidencePath

$RehearsalReady = $false
if ($Rehearsal) {
  $RehearsalReady = [bool]$Rehearsal.ready_for_staging_execution -and @($Rehearsal.blockers).Count -eq 0
}
Add-Check -Checks $Checks -Area "migration" -Name "local validation ready" -Passed $RehearsalReady -Detail $RehearsalJsonPath
if (-not $RehearsalReady) {
  $TechnicalBlockers.Add("La validacion local de migracion final no esta lista.")
}

$BackendReady = $false
if ($BackendProd) {
  $BackendReady = [bool]$BackendProd.ready -and ([int]$BackendProd.summary.services_ready -eq 6) -and ([int]$BackendProd.summary.smoke_tests_passed -eq 6)
}
Add-Check -Checks $Checks -Area "prod" -Name "backend prod ready" -Passed $BackendReady -Detail $ResolvedBackendEvidencePath
if (-not $BackendReady) {
  $TechnicalBlockers.Add("Los backends productivos no tienen evidencia lista 6/6.")
}

$FrontendReady = $false
if ($FrontendProd) {
  $FrontendReady = ([int]$FrontendProd.summary.services_ready -eq 6) -and ([int]$FrontendProd.summary.checks_failed -eq 0)
}
Add-Check -Checks $Checks -Area "prod" -Name "frontend prod ready" -Passed $FrontendReady -Detail $ResolvedFrontendEvidencePath
if (-not $FrontendReady) {
  $TechnicalBlockers.Add("Los frontends productivos no tienen evidencia lista.")
}

$CutoverPlanApproved = $false
if ($CutoverPlan) {
  $CutoverPlanApproved = [string]$CutoverPlan.approval_status -eq "approved_for_execution"
}
Add-Check -Checks $Checks -Area "approval" -Name "cutover approved" -Passed $CutoverPlanApproved -Detail "approval_status=$($CutoverPlan.approval_status)"

$LegacyFreezeConfirmed = [bool]$ConfirmLegacyFreeze
Add-Check -Checks $Checks -Area "approval" -Name "legacy freeze confirmed" -Passed $LegacyFreezeConfirmed -Detail "ConfirmLegacyFreeze=$ConfirmLegacyFreeze"

$BusinessGoNoGoConfirmed = [bool]$ConfirmBusinessGoNoGo
Add-Check -Checks $Checks -Area "approval" -Name "business go no-go confirmed" -Passed $BusinessGoNoGoConfirmed -Detail "ConfirmBusinessGoNoGo=$ConfirmBusinessGoNoGo"

$DataApproved = [bool]$ApproveDataMigration
Add-Check -Checks $Checks -Area "approval" -Name "data migration approved" -Passed $DataApproved -Detail "ApproveDataMigration=$ApproveDataMigration"

if (-not $CutoverPlanApproved) {
  $ProductionExecutionBlockers.Add("El plan de corte no esta aprobado para ejecucion real: $($CutoverPlan.approval_status)")
}
if (-not $LegacyFreezeConfirmed) {
  $ProductionExecutionBlockers.Add("No se confirmo congelamiento del legacy con -ConfirmLegacyFreeze.")
}
if (-not $BusinessGoNoGoConfirmed) {
  $ProductionExecutionBlockers.Add("No se confirmo GO/NO-GO de negocio con -ConfirmBusinessGoNoGo.")
}
if (-not $DataApproved) {
  $Warnings.Add("La aprobacion de datos migrados queda pendiente hasta validar conteos reales en produccion.")
}

$IdentitySqlDia77 = Join-Path $ResolvedOutputDir "identity_db-dia77-final.sql"
$DispatchSqlDia77 = Join-Path $ResolvedOutputDir "dispatch_db-dia77-final.sql"
$TicketingSqlDia77 = Join-Path $ResolvedOutputDir "ticketing_db-dia77-final.sql"

if ($Rehearsal -and $Rehearsal.generated_sql) {
  Copy-Item -LiteralPath $Rehearsal.generated_sql.identity_db -Destination $IdentitySqlDia77 -Force
  Copy-Item -LiteralPath $Rehearsal.generated_sql.dispatch_db -Destination $DispatchSqlDia77 -Force
  Copy-Item -LiteralPath $Rehearsal.generated_sql.ticketing_db -Destination $TicketingSqlDia77 -Force
}

$BucketName = "venta-pasajes-prod-documents"
$ProjectId = if ($CloudSqlProd) { [string]$CloudSqlProd.project_id } else { "" }
$InstanceName = if ($CloudSqlProd) { [string]$CloudSqlProd.instance.name } else { "" }
$CommandFilePath = Join-Path $ResolvedOutputDir "apply-prod-migration.commands.ps1"
Write-ProductionCommandFile `
  -Path $CommandFilePath `
  -ProjectId $ProjectId `
  -InstanceName $InstanceName `
  -BucketName $BucketName `
  -RunId $RunId `
  -IdentitySqlPath $IdentitySqlDia77 `
  -DispatchSqlPath $DispatchSqlDia77 `
  -TicketingSqlPath $TicketingSqlDia77

$ReadyForMigrationPackage = $TechnicalBlockers.Count -eq 0
$ReadyForProductionExecution = $ReadyForMigrationPackage -and $CutoverPlanApproved -and $LegacyFreezeConfirmed -and $BusinessGoNoGoConfirmed
$ProductionMigrationExecuted = $false
$DataValidationApproved = $DataApproved -and $ProductionMigrationExecuted

$Result = [pscustomobject]@{
  generated_at = (Get-Date).ToString("o")
  run_id = $RunId
  ready_for_migration_package = $ReadyForMigrationPackage
  ready_for_production_execution = $ReadyForProductionExecution
  production_migration_executed = $ProductionMigrationExecuted
  data_validation_approved = $DataValidationApproved
  project_id = $ProjectId
  cloud_sql_instance = $InstanceName
  document_bucket = $BucketName
  paths = [pscustomobject]@{
    access_source = $ResolvedAccessPath
    output_dir = $ResolvedOutputDir
    backup_root = $ResolvedBackupRoot
    rehearsal_json = $RehearsalJsonPath
    identity_sql = $IdentitySqlDia77
    dispatch_sql = $DispatchSqlDia77
    ticketing_sql = $TicketingSqlDia77
    production_commands = $CommandFilePath
  }
  rehearsal = $Rehearsal
  checks = @($Checks)
  technical_blockers = @($TechnicalBlockers)
  production_execution_blockers = @($ProductionExecutionBlockers)
  warnings = @($Warnings)
}

$ActPath = Join-Path $ResolvedOutputDir "acta-validacion-migracion-final-borrador.md"
Write-ValidationActDraft -Path $ActPath -Evidence $Result
$Result.paths | Add-Member -NotePropertyName validation_act_draft -NotePropertyValue $ActPath -Force

$ResultPath = Join-Path $ResolvedOutputDir "final-data-migration-prod-readiness.json"
$Result | ConvertTo-Json -Depth 14 | Set-Content -LiteralPath $ResultPath -Encoding UTF8

@($Checks) |
  Select-Object area, name, passed, detail |
  Format-Table -AutoSize

Write-Host "Resultado JSON: $ResultPath"
Write-Host "Acta borrador: $ActPath"
Write-Host "Comandos productivos: $CommandFilePath"
Write-Host "Paquete de migracion listo: $ReadyForMigrationPackage"
Write-Host "Ejecucion productiva autorizada: $ReadyForProductionExecution"
Write-Host "Migracion productiva ejecutada: $ProductionMigrationExecuted"
Write-Host "Datos productivos aprobados: $DataValidationApproved"

if ($Warnings.Count -gt 0) {
  Write-Host "Advertencias:"
  foreach ($Warning in $Warnings) {
    Write-Host "- $Warning"
  }
}

if ($ProductionExecutionBlockers.Count -gt 0) {
  Write-Host "Bloqueos de ejecucion productiva:"
  foreach ($Blocker in $ProductionExecutionBlockers) {
    Write-Host "- $Blocker"
  }
}

if ($TechnicalBlockers.Count -gt 0) {
  Write-Host "Bloqueos tecnicos:"
  foreach ($Blocker in $TechnicalBlockers) {
    Write-Host "- $Blocker"
  }
}

if ($FailOnTechnicalBlocker -and $TechnicalBlockers.Count -gt 0) {
  throw "La migracion final tiene bloqueos tecnicos."
}
