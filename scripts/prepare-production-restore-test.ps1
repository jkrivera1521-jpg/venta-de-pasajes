param(
  [string]$ProjectId = "project-fbb34cd7-0b82-43e1-867",
  [string]$Region = "us-central1",
  [string]$CloudSqlConfigPath = ".\infra\gcloud\cloudsql-prod.json",
  [string]$ProdInfraEvidencePath = ".\logs\prod-infra\verify-prod-infra.json",
  [string]$BackupReadinessPath = ".\logs\backup-restore\verify-backup-restore-readiness-prod.json",
  [string]$Day68EvidencePath = ".\logs\backup-restore\dia68-restore-evidence.json",
  [string]$OutputDir = ".\logs\production-restore-test"
)

$ErrorActionPreference = "Stop"

$Root = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
Set-Location $Root

function Resolve-ProjectPath {
  param([string]$Path)

  if ([System.IO.Path]::IsPathRooted($Path)) {
    return $Path
  }

  return (Join-Path $Root $Path)
}

function Read-JsonIfExists {
  param([string]$Path)

  $ResolvedPath = Resolve-ProjectPath -Path $Path
  if (Test-Path -LiteralPath $ResolvedPath) {
    return Get-Content -LiteralPath $ResolvedPath -Raw | ConvertFrom-Json
  }

  return $null
}

function Format-Nullable {
  param($Value, [string]$Suffix = "")

  if ($null -eq $Value -or [string]::IsNullOrWhiteSpace([string]$Value)) {
    return "pendiente"
  }

  return "$Value$Suffix"
}

$ResolvedOutputDir = Resolve-ProjectPath -Path $OutputDir
New-Item -ItemType Directory -Force -Path $ResolvedOutputDir | Out-Null

$CloudSqlConfigResolved = Resolve-ProjectPath -Path $CloudSqlConfigPath
if (-not (Test-Path -LiteralPath $CloudSqlConfigResolved)) {
  throw "No existe la configuracion productiva Cloud SQL: $CloudSqlConfigResolved"
}

$CloudSqlConfig = Get-Content -LiteralPath $CloudSqlConfigResolved -Raw | ConvertFrom-Json
$ProdInfra = Read-JsonIfExists -Path $ProdInfraEvidencePath
$BackupReadiness = Read-JsonIfExists -Path $BackupReadinessPath
$Day68Evidence = Read-JsonIfExists -Path $Day68EvidencePath

$ExecutionEvidencePath = Join-Path $ResolvedOutputDir "dia86-production-restore-execution-evidence.json"
$ExecutionEvidence = if (Test-Path -LiteralPath $ExecutionEvidencePath) {
  Get-Content -LiteralPath $ExecutionEvidencePath -Raw | ConvertFrom-Json
} else {
  $null
}

$SourceInstance = [string]$CloudSqlConfig.instance.name
$DocumentBucket = if ($ProdInfra -and $ProdInfra.storage.document_bucket_name) {
  [string]$ProdInfra.storage.document_bucket_name
} else {
  "venta-pasajes-prod-documents"
}
$RestoreInstance = "venta-pasajes-prod-restore-test"

$ExpectedDatabases = @($CloudSqlConfig.databases | ForEach-Object { [string]$_.name })
$ExpectedUsers = @($CloudSqlConfig.iam_database_users | ForEach-Object { [string]$_.cloud_sql_username })
$BaselineRtoMinutes = if ($Day68Evidence) { [double]$Day68Evidence.cloud_sql_restore_duration_minutes } else { $null }
$LatestBackupId = if ($BackupReadiness) { [string]$BackupReadiness.cloud_sql.latest_successful_backup_id } else { $null }
$EstimatedRpoHours = if ($BackupReadiness) { $BackupReadiness.cloud_sql.estimated_rpo_hours } else { $null }

$ReadOnlyReady = (
  ($ProdInfra -and [bool]$ProdInfra.ready) -and
  ($BackupReadiness -and [bool]$BackupReadiness.readiness.ready_for_restore_test)
)

$ActualExecuted = ($ExecutionEvidence -and [bool]$ExecutionEvidence.controlled_restore_executed)
$ActualValidated = (
  $ActualExecuted -and
  [bool]$ExecutionEvidence.database_validation_ok -and
  [bool]$ExecutionEvidence.storage_validation_ok
)

$Blockers = New-Object System.Collections.Generic.List[string]
if (-not $ProdInfra) { $Blockers.Add("No existe evidencia de infraestructura productiva: $ProdInfraEvidencePath") }
if ($ProdInfra -and -not [bool]$ProdInfra.ready) { $Blockers.Add("La evidencia de infraestructura productiva no esta lista.") }
if (-not $BackupReadiness) { $Blockers.Add("No existe evidencia de backup/restore productiva de solo lectura: $BackupReadinessPath") }
if ($BackupReadiness -and -not [bool]$BackupReadiness.readiness.ready_for_restore_test) { $Blockers.Add("La verificacion productiva no esta lista para restauracion temporal.") }
if (-not $Day68Evidence) { $Blockers.Add("No existe evidencia del RTO base del Dia 68: $Day68EvidencePath") }
if (-not $ActualExecuted) { $Blockers.Add("La restauracion temporal productiva no se ha ejecutado aun. Ejecutar el script generado solo en ventana aprobada.") }

$CommandScriptPath = Join-Path $ResolvedOutputDir "dia86-production-restore-commands.ps1"
$ReadinessPath = Join-Path $ResolvedOutputDir "dia86-production-restore-readiness.json"
$PlanPath = Join-Path $ResolvedOutputDir "dia86-production-restore-plan.json"
$EvidenceDocPath = Join-Path $Root "docs\evidencia-restauracion-produccion-controlada.md"
$ProcedureDocPath = Join-Path $Root "docs\procedimiento-restauracion-produccion.md"

$CommandTemplate = @'
param(
  [switch]$Execute,
  [switch]$KeepTemporaryResources
)

$ErrorActionPreference = "Stop"

if (-not $Execute) {
  throw "Ejecucion bloqueada. Vuelva a ejecutar con -Execute solo dentro de una ventana aprobada."
}

$Root = "__ROOT__"
$ProjectId = "__PROJECT_ID__"
$Region = "__REGION__"
$SourceInstance = "__SOURCE_INSTANCE__"
$RestoreInstance = "__RESTORE_INSTANCE__"
$DocumentBucket = "__DOCUMENT_BUCKET__"
$OutputDir = "__OUTPUT_DIR__"
$BackupReadinessPath = "__BACKUP_READINESS_PATH__"
$ExecutionEvidencePath = "__EXECUTION_EVIDENCE_PATH__"
$Gcloud = "__GCLOUD_PATH__"

$PythonCandidates = @(
  $env:CLOUDSDK_PYTHON,
  "C:\Python312\python.exe",
  "C:\Python313\python.exe",
  "C:\Python311\python.exe"
)

foreach ($PythonCandidate in $PythonCandidates) {
  if (-not [string]::IsNullOrWhiteSpace($PythonCandidate) -and (Test-Path -LiteralPath $PythonCandidate)) {
    $env:CLOUDSDK_PYTHON = (Resolve-Path -LiteralPath $PythonCandidate).Path
    break
  }
}

Set-Location $Root
New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

if (-not (Test-Path -LiteralPath $Gcloud)) {
  $Command = Get-Command gcloud.cmd -ErrorAction SilentlyContinue
  if (-not $Command) {
    $Command = Get-Command gcloud -ErrorAction SilentlyContinue
  }
  if (-not $Command) {
    throw "No se encontro gcloud."
  }
  $Gcloud = $Command.Source
}

function Invoke-GcloudChecked {
  param([string[]]$Arguments)

  $PreviousErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    $Output = & $Gcloud @Arguments 2>&1
    $ExitCode = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $PreviousErrorActionPreference
  }

  $Text = ($Output | ForEach-Object { $_.ToString() }) -join [Environment]::NewLine

  if ($ExitCode -ne 0) {
    throw "gcloud fallo ($ExitCode): $Text"
  }

  return $Text
}

function Convert-JsonText {
  param([string]$Text)

  if ([string]::IsNullOrWhiteSpace($Text)) {
    return $null
  }

  return $Text | ConvertFrom-Json
}

Write-Host "Revalidando precondiciones de restauracion productiva..."
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-backup-restore-readiness.ps1 `
  -Environment prod `
  -CloudSqlInstanceName $SourceInstance `
  -DocumentBucketName $DocumentBucket `
  -RestoreInstanceName $RestoreInstance `
  -FailOnNotReady

$BackupReadiness = Get-Content -LiteralPath $BackupReadinessPath -Raw | ConvertFrom-Json
$BackupId = [string]$BackupReadiness.cloud_sql.latest_successful_backup_id
$BackupEnd = [DateTimeOffset]$BackupReadiness.cloud_sql.latest_successful_backup_end_time
$RestoreBucket = "venta-pasajes-prod-restore-test-$(Get-Date -Format yyyyMMddHHmmss)"

$TotalStart = Get-Date
$RestoreStart = $null
$RestoreEnd = $null
$RestoreBucketDeleted = $false
$RestoreInstanceDeleted = $false
$StorageValidationOk = $false
$StorageSampleObject = $null
$RestoredDatabases = @()
$RestoredUsers = @()
$RestoreInstanceCreated = $false
$RestoreBucketCreated = $false

try {
  Write-Host "Creando instancia temporal Cloud SQL: $RestoreInstance"
  Invoke-GcloudChecked -Arguments @(
    "sql", "instances", "create", $RestoreInstance,
    "--project=$ProjectId",
    "--database-version=POSTGRES_16",
    "--edition=ENTERPRISE",
    "--tier=db-f1-micro",
    "--region=$Region",
    "--availability-type=ZONAL",
    "--storage-type=SSD",
    "--storage-size=10",
    "--no-backup",
    "--no-deletion-protection",
    "--storage-auto-increase",
    "--database-flags=cloudsql.iam_authentication=on",
    "--quiet"
  ) | Out-Null
  $RestoreInstanceCreated = $true

  Write-Host "Restaurando backup $BackupId en instancia temporal..."
  $RestoreStart = Get-Date
  Invoke-GcloudChecked -Arguments @(
    "sql", "backups", "restore", $BackupId,
    "--backup-instance=$SourceInstance",
    "--restore-instance=$RestoreInstance",
    "--project=$ProjectId",
    "--quiet"
  ) | Out-Null
  $RestoreEnd = Get-Date

  $DatabasesJson = Invoke-GcloudChecked -Arguments @(
    "sql", "databases", "list",
    "--instance=$RestoreInstance",
    "--project=$ProjectId",
    "--format=json"
  )
  $RestoredDatabases = @((Convert-JsonText -Text $DatabasesJson) | ForEach-Object { [string]$_.name })

  $UsersJson = Invoke-GcloudChecked -Arguments @(
    "sql", "users", "list",
    "--instance=$RestoreInstance",
    "--project=$ProjectId",
    "--format=json"
  )
  $RestoredUsers = @((Convert-JsonText -Text $UsersJson) | ForEach-Object { [string]$_.name })

  Write-Host "Creando bucket temporal documental: gs://$RestoreBucket"
  Invoke-GcloudChecked -Arguments @(
    "storage", "buckets", "create", "gs://$RestoreBucket",
    "--project=$ProjectId",
    "--location=$Region",
    "--uniform-bucket-level-access",
    "--public-access-prevention",
    "--default-storage-class=STANDARD"
  ) | Out-Null
  $RestoreBucketCreated = $true

  $StorageListOutput = & $Gcloud "storage" "ls" "--recursive" "gs://$DocumentBucket/**" "--project=$ProjectId" 2>&1
  $StorageListExitCode = $LASTEXITCODE
  if ($StorageListExitCode -eq 0) {
    $StorageSampleObject = @(
      $StorageListOutput |
        ForEach-Object { $_.ToString().Trim() } |
        Where-Object { $_ -like "gs://*" -and -not $_.EndsWith("/") } |
        Select-Object -First 1
    )
  }

  if ($StorageSampleObject) {
    Invoke-GcloudChecked -Arguments @(
      "storage", "cp",
      $StorageSampleObject,
      "gs://$RestoreBucket/_restore-tests/sample-object",
      "--project=$ProjectId"
    ) | Out-Null
  }

  $BucketDescribe = Invoke-GcloudChecked -Arguments @(
    "storage", "buckets", "describe", "gs://$RestoreBucket",
    "--project=$ProjectId",
    "--format=json"
  )
  $StorageValidationOk = -not [string]::IsNullOrWhiteSpace($BucketDescribe)
} finally {
  if (-not $KeepTemporaryResources) {
    if ($RestoreBucketCreated) {
      try {
        & $Gcloud "storage" "rm" "--recursive" "gs://$RestoreBucket" "--project=$ProjectId" "--quiet" | Out-Null
        $RestoreBucketDeleted = $true
      } catch {
        Write-Warning "No se pudo eliminar el bucket temporal $RestoreBucket. Revisar manualmente."
      }
    }

    if ($RestoreInstanceCreated) {
      try {
        & $Gcloud "sql" "instances" "delete" $RestoreInstance "--project=$ProjectId" "--quiet" | Out-Null
        $RestoreInstanceDeleted = $true
      } catch {
        Write-Warning "No se pudo eliminar la instancia temporal $RestoreInstance. Revisar manualmente."
      }
    }
  }
}

$TotalEnd = Get-Date
$ExpectedDatabases = @("__EXPECTED_DATABASES__".Split(",") | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
$ExpectedUsers = @("__EXPECTED_USERS__".Split(",") | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
$MissingDatabases = @($ExpectedDatabases | Where-Object { $RestoredDatabases -notcontains $_ })
$MissingUsers = @($ExpectedUsers | Where-Object { $RestoredUsers -notcontains $_ })

$Evidence = [pscustomobject]@{
  generated_at = (Get-Date).ToString("o")
  controlled_restore_executed = $true
  project_id = $ProjectId
  source_instance = $SourceInstance
  backup_id = $BackupId
  latest_backup_end_time = $BackupReadiness.cloud_sql.latest_successful_backup_end_time
  rpo_hours_at_restore_start = [Math]::Round(($TotalStart.ToUniversalTime() - $BackupEnd.UtcDateTime).TotalHours, 2)
  restore_instance = $RestoreInstance
  restore_instance_deleted = $RestoreInstanceDeleted
  cloud_sql_restore_seconds = if ($RestoreStart -and $RestoreEnd) { [Math]::Round(($RestoreEnd - $RestoreStart).TotalSeconds, 2) } else { $null }
  cloud_sql_restore_minutes = if ($RestoreStart -and $RestoreEnd) { [Math]::Round(($RestoreEnd - $RestoreStart).TotalMinutes, 2) } else { $null }
  total_recovery_seconds = [Math]::Round(($TotalEnd - $TotalStart).TotalSeconds, 2)
  total_recovery_minutes = [Math]::Round(($TotalEnd - $TotalStart).TotalMinutes, 2)
  restored_databases = $RestoredDatabases
  expected_databases = $ExpectedDatabases
  missing_databases = $MissingDatabases
  restored_iam_users = $RestoredUsers.Count
  expected_iam_users = $ExpectedUsers.Count
  missing_iam_users = $MissingUsers
  database_validation_ok = (($MissingDatabases.Count -eq 0) -and ($MissingUsers.Count -eq 0))
  document_bucket = $DocumentBucket
  restore_bucket = $RestoreBucket
  restore_bucket_deleted = $RestoreBucketDeleted
  storage_sample_object = $StorageSampleObject
  storage_validation_ok = $StorageValidationOk
}

$Evidence | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $ExecutionEvidencePath -Encoding UTF8

Write-Host "Restauracion controlada completada."
Write-Host "RTO total minutos: $($Evidence.total_recovery_minutes)"
Write-Host "RPO horas al iniciar: $($Evidence.rpo_hours_at_restore_start)"
Write-Host "Evidencia: $ExecutionEvidencePath"
'@

$GcloudPath = if ($BackupReadiness -and $BackupReadiness.gcloud_path) {
  [string]$BackupReadiness.gcloud_path
} else {
  "gcloud.cmd"
}

$CommandScript = $CommandTemplate.
  Replace("__ROOT__", $Root.Replace("\", "\\")).
  Replace("__PROJECT_ID__", $ProjectId).
  Replace("__REGION__", $Region).
  Replace("__SOURCE_INSTANCE__", $SourceInstance).
  Replace("__RESTORE_INSTANCE__", $RestoreInstance).
  Replace("__DOCUMENT_BUCKET__", $DocumentBucket).
  Replace("__OUTPUT_DIR__", $ResolvedOutputDir.Replace("\", "\\")).
  Replace("__BACKUP_READINESS_PATH__", (Resolve-ProjectPath -Path $BackupReadinessPath).Replace("\", "\\")).
  Replace("__EXECUTION_EVIDENCE_PATH__", $ExecutionEvidencePath.Replace("\", "\\")).
  Replace("__GCLOUD_PATH__", $GcloudPath.Replace("\", "\\")).
  Replace("__EXPECTED_DATABASES__", ($ExpectedDatabases -join ",")).
  Replace("__EXPECTED_USERS__", ($ExpectedUsers -join ","))

Set-Content -LiteralPath $CommandScriptPath -Value $CommandScript -Encoding UTF8

$Readiness = [pscustomobject]@{
  generated_at = (Get-Date).ToString("o")
  day = 86
  objective = "Prueba de restauracion en produccion controlada"
  project_id = $ProjectId
  source_instance = $SourceInstance
  restore_instance = $RestoreInstance
  document_bucket = $DocumentBucket
  prod_infra_ready = if ($ProdInfra) { [bool]$ProdInfra.ready } else { $false }
  backup_readiness_ready = if ($BackupReadiness) { [bool]$BackupReadiness.readiness.ready_for_restore_test } else { $false }
  latest_successful_backup_id = $LatestBackupId
  latest_successful_backup_end_time = if ($BackupReadiness) { [string]$BackupReadiness.cloud_sql.latest_successful_backup_end_time } else { $null }
  measured_rpo_hours = $EstimatedRpoHours
  baseline_rto_minutes_from_day68 = $BaselineRtoMinutes
  controlled_restore_executed = $ActualExecuted
  measured_prod_rto_minutes = if ($ActualExecuted) { $ExecutionEvidence.total_recovery_minutes } else { $null }
  database_validation_ok = if ($ActualExecuted) { [bool]$ExecutionEvidence.database_validation_ok } else { $false }
  storage_validation_ok = if ($ActualExecuted) { [bool]$ExecutionEvidence.storage_validation_ok } else { $false }
  ready_for_controlled_restore = $ReadOnlyReady
  criteria_met = $ActualValidated
  blockers = @($Blockers)
  command_script = $CommandScriptPath
}

$Plan = [pscustomobject]@{
  generated_at = $Readiness.generated_at
  steps = @(
    "Verificar infraestructura productiva y backups de solo lectura.",
    "Crear instancia temporal Cloud SQL sin backups ni deletion protection.",
    "Restaurar ultimo backup exitoso de produccion en la instancia temporal.",
    "Validar bases e IAM DB users restaurados.",
    "Crear bucket documental temporal y copiar una muestra documental si existe.",
    "Medir RPO al inicio y RTO total hasta evidencia validada.",
    "Eliminar instancia y bucket temporales salvo que se use KeepTemporaryResources.",
    "Regenerar este paquete para incorporar evidencia real."
  )
  execution_command = "powershell -NoProfile -ExecutionPolicy Bypass -File .\logs\production-restore-test\dia86-production-restore-commands.ps1 -Execute"
}

$Readiness | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $ReadinessPath -Encoding UTF8
$Plan | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $PlanPath -Encoding UTF8

$LatestBackupEndDisplay = if ($BackupReadiness) { [string]$BackupReadiness.cloud_sql.latest_successful_backup_end_time } else { "pendiente" }
$MeasuredProdRtoDisplay = if ($ActualExecuted) { Format-Nullable $ExecutionEvidence.total_recovery_minutes " minutos" } else { "pendiente de ejecutar script controlado" }
$DatabaseValidationDisplay = if ($ActualExecuted) { [string][bool]$ExecutionEvidence.database_validation_ok } else { "pendiente" }
$StorageValidationDisplay = if ($ActualExecuted) { [string][bool]$ExecutionEvidence.storage_validation_ok } else { "pendiente" }
$BlockerDisplay = if ($Blockers.Count -gt 0) { ($Blockers | ForEach-Object { "- $_" }) -join [Environment]::NewLine } else { "- Sin bloqueos." }

$EvidenceDoc = @"
# Evidencia de restauracion produccion controlada

## Estado

| Campo | Valor |
| --- | --- |
| Ambiente | prod |
| Instancia fuente | $SourceInstance |
| Bucket documental | gs://$DocumentBucket |
| Backup mas reciente | $(Format-Nullable $LatestBackupId) |
| Fin del backup mas reciente | $LatestBackupEndDisplay |
| RPO medido de solo lectura | $(Format-Nullable $EstimatedRpoHours " horas") |
| RTO base medido Dia 68 | $(Format-Nullable $BaselineRtoMinutes " minutos") |
| Restauracion productiva temporal ejecutada | $ActualExecuted |
| RTO productivo medido | $MeasuredProdRtoDisplay |
| Validacion de bases restauradas | $DatabaseValidationDisplay |
| Validacion documental | $StorageValidationDisplay |
| Criterio completo | $ActualValidated |

## Lectura ejecutiva

La verificacion de solo lectura confirma que produccion tiene Cloud SQL RUNNABLE, backups activos, bucket documental existente y un nombre de instancia temporal libre para prueba de restauracion.

La restauracion real productiva queda controlada por el script:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\logs\production-restore-test\dia86-production-restore-commands.ps1 -Execute
```

Ese script crea recursos temporales, mide RTO/RPO y limpia al finalizar si no se usa `-KeepTemporaryResources`.

## Evidencia JSON

```text
$ReadinessPath
$PlanPath
$ExecutionEvidencePath
```

## Bloqueos

$BlockerDisplay
"@

$ProcedureTemplate = @'
# Procedimiento de restauracion produccion

## Objetivo

Recuperar una copia controlada de produccion en recursos temporales sin modificar la instancia productiva original.

## Precondiciones

- Cloud SQL produccion debe existir y estar RUNNABLE.
- Backups Cloud SQL produccion deben estar habilitados.
- Debe existir al menos un backup exitoso.
- El bucket documental productivo debe existir.
- El nombre temporal `__RESTORE_INSTANCE__` debe estar libre.
- La ventana debe estar aprobada por responsable tecnico y responsable de datos.

## Verificacion previa de solo lectura

```powershell
cd C:\VENTA-DE-PASAJES

powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-backup-restore-readiness.ps1 `
  -Environment prod `
  -CloudSqlInstanceName __SOURCE_INSTANCE__ `
  -DocumentBucketName __DOCUMENT_BUCKET__ `
  -RestoreInstanceName __RESTORE_INSTANCE__
```

Resultado esperado:

```text
Overall ready for restore test: True
```

## Ejecucion controlada

Ejecutar solo dentro de una ventana aprobada:

```powershell
cd C:\VENTA-DE-PASAJES

powershell -NoProfile -ExecutionPolicy Bypass -File .\logs\production-restore-test\dia86-production-restore-commands.ps1 -Execute
```

Para conservar recursos temporales para inspeccion manual:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\logs\production-restore-test\dia86-production-restore-commands.ps1 -Execute -KeepTemporaryResources
```

## Limpieza manual si se conservan recursos

```powershell
gcloud storage rm --recursive gs://venta-pasajes-prod-restore-test-<timestamp> `
  --project __PROJECT_ID__ `
  --quiet

gcloud sql instances delete __RESTORE_INSTANCE__ `
  --project __PROJECT_ID__ `
  --quiet
```

## Cierre del procedimiento

Despues de ejecutar la prueba real:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\prepare-production-restore-test.ps1
```

El cierre queda completo cuando `criteria_met` sea `True` en:

```text
__READINESS_PATH__
```
'@

$ProcedureDoc = $ProcedureTemplate.
  Replace("__RESTORE_INSTANCE__", $RestoreInstance).
  Replace("__SOURCE_INSTANCE__", $SourceInstance).
  Replace("__DOCUMENT_BUCKET__", $DocumentBucket).
  Replace("__PROJECT_ID__", $ProjectId).
  Replace("__READINESS_PATH__", $ReadinessPath)

Set-Content -LiteralPath $EvidenceDocPath -Value $EvidenceDoc -Encoding UTF8
Set-Content -LiteralPath $ProcedureDocPath -Value $ProcedureDoc -Encoding UTF8

Write-Host "Paquete restauracion produccion listo: $($Readiness.ready_for_controlled_restore)"
Write-Host "Restauracion controlada ejecutada: $($Readiness.controlled_restore_executed)"
Write-Host "Criterio completo: $($Readiness.criteria_met)"
Write-Host "RPO horas: $($Readiness.measured_rpo_hours)"
Write-Host "RTO base minutos: $($Readiness.baseline_rto_minutes_from_day68)"
Write-Host "Bloqueos: $($Readiness.blockers.Count)"
