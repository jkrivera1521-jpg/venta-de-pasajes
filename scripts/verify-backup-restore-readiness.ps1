param(
  [string]$Environment = "staging",
  [string]$ProjectId = "project-fbb34cd7-0b82-43e1-867",
  [string]$Region = "us-central1",
  [string]$CloudSqlInstanceName = "",
  [string]$DocumentBucketName = "",
  [string]$RestoreInstanceName = "",
  [string]$GcloudPath = "",
  [string]$CloudSdkPython = "",
  [string]$OutputDir = "logs\backup-restore",
  [switch]$FailOnNotReady
)

$ErrorActionPreference = "Stop"

$ProjectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
Set-Location $ProjectRoot

function First-Value {
  param([string[]]$Values)

  foreach ($Value in $Values) {
    if (-not [string]::IsNullOrWhiteSpace($Value)) {
      return $Value
    }
  }

  return ""
}

function Initialize-CloudSdkPython {
  param([string]$ConfiguredPython)

  $PythonPath = First-Value @(
    $ConfiguredPython,
    $env:CLOUDSDK_PYTHON,
    "C:\Python312\python.exe",
    "C:\Python313\python.exe",
    "C:\Program Files\Python312\python.exe",
    "C:\Program Files\Python313\python.exe"
  )

  if (-not [string]::IsNullOrWhiteSpace($PythonPath) -and (Test-Path -LiteralPath $PythonPath)) {
    $env:CLOUDSDK_PYTHON = (Resolve-Path -LiteralPath $PythonPath).Path
  }
}

function Resolve-GcloudPath {
  param([string]$ConfiguredGcloud)

  $Candidate = First-Value @($ConfiguredGcloud, $env:GCLOUD_PATH)
  if (-not [string]::IsNullOrWhiteSpace($Candidate)) {
    if ($Candidate.EndsWith(".ps1", [System.StringComparison]::OrdinalIgnoreCase)) {
      $CmdSibling = [System.IO.Path]::ChangeExtension($Candidate, ".cmd")
      if (Test-Path -LiteralPath $CmdSibling) {
        return (Resolve-Path -LiteralPath $CmdSibling).Path
      }
    }

    if (Test-Path -LiteralPath $Candidate) {
      return (Resolve-Path -LiteralPath $Candidate).Path
    }
  }

  $KnownChocolateyPath = "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd"
  if (Test-Path -LiteralPath $KnownChocolateyPath) {
    return $KnownChocolateyPath
  }

  $Command = Get-Command gcloud.cmd -ErrorAction SilentlyContinue
  if ($Command) {
    return $Command.Source
  }

  $Command = Get-Command gcloud -ErrorAction SilentlyContinue
  if ($Command) {
    return $Command.Source
  }

  throw "No se encontro gcloud. Defina -GcloudPath con la ruta real de gcloud.cmd."
}

function Invoke-Gcloud {
  param([string[]]$Arguments)

  $PreviousErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    $Output = & $script:ResolvedGcloudPath @Arguments 2>&1
    $ExitCode = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $PreviousErrorActionPreference
  }

  $Text = ($Output | ForEach-Object { $_.ToString() }) -join [Environment]::NewLine

  [pscustomobject]@{
    exit_code = $ExitCode
    output = $Text
  }
}

function Convert-JsonOutput {
  param([string]$Text)

  if ([string]::IsNullOrWhiteSpace($Text)) {
    return $null
  }

  return $Text | ConvertFrom-Json
}

function Parse-DateTime {
  param([string]$Value)

  if ([string]::IsNullOrWhiteSpace($Value)) {
    return $null
  }

  try {
    return [DateTimeOffset]::Parse($Value)
  } catch {
    return $null
  }
}

$CloudSqlInstanceName = First-Value @($CloudSqlInstanceName, "venta-pasajes-$Environment-sql")
$DocumentBucketName = First-Value @($DocumentBucketName, "venta-pasajes-$Environment-documents")
$RestoreInstanceName = First-Value @($RestoreInstanceName, "venta-pasajes-$Environment-restore-test")

Initialize-CloudSdkPython -ConfiguredPython $CloudSdkPython
$script:ResolvedGcloudPath = Resolve-GcloudPath -ConfiguredGcloud $GcloudPath

$ResolvedOutputDir = Join-Path -Path $ProjectRoot -ChildPath $OutputDir
New-Item -ItemType Directory -Force -Path $ResolvedOutputDir | Out-Null

$InstanceResult = Invoke-Gcloud -Arguments @(
  "sql",
  "instances",
  "describe",
  $CloudSqlInstanceName,
  "--project",
  $ProjectId,
  "--format=json"
)

$Instance = if ($InstanceResult.exit_code -eq 0) { Convert-JsonOutput -Text $InstanceResult.output } else { $null }
$InstanceExists = $null -ne $Instance

$BackupRows = @()
$LatestSuccessfulBackup = $null

if ($InstanceExists) {
  $BackupsResult = Invoke-Gcloud -Arguments @(
    "sql",
    "backups",
    "list",
    "--instance",
    $CloudSqlInstanceName,
    "--project",
    $ProjectId,
    "--format=json",
    "--limit=30"
  )

  if ($BackupsResult.exit_code -eq 0) {
    $ParsedBackups = Convert-JsonOutput -Text $BackupsResult.output
    if ($ParsedBackups) {
      foreach ($Backup in $ParsedBackups) {
        $BackupRows += $Backup
      }
    }

    $LatestSuccessfulBackup = @(
      $BackupRows |
        Where-Object { $_.status -eq "SUCCESSFUL" } |
        Sort-Object { Parse-DateTime -Value $_.endTime } -Descending |
        Select-Object -First 1
    )
    if ($LatestSuccessfulBackup.Count -gt 0) {
      $LatestSuccessfulBackup = $LatestSuccessfulBackup[0]
    } else {
      $LatestSuccessfulBackup = $null
    }
  }
}

$RestoreInstanceResult = Invoke-Gcloud -Arguments @(
  "sql",
  "instances",
  "describe",
  $RestoreInstanceName,
  "--project",
  $ProjectId,
  "--format=json"
)
$RestoreInstanceExists = $RestoreInstanceResult.exit_code -eq 0

$BucketResult = Invoke-Gcloud -Arguments @(
  "storage",
  "buckets",
  "describe",
  "gs://$DocumentBucketName",
  "--project",
  $ProjectId,
  "--format=json"
)
$Bucket = if ($BucketResult.exit_code -eq 0) { Convert-JsonOutput -Text $BucketResult.output } else { $null }
$BucketExists = $null -ne $Bucket

$LatestBackupEnd = if ($LatestSuccessfulBackup) { Parse-DateTime -Value $LatestSuccessfulBackup.endTime } else { $null }
$EstimatedRpoHours = $null
if ($LatestBackupEnd) {
  $EstimatedRpoHours = [Math]::Round(([DateTimeOffset]::UtcNow - $LatestBackupEnd).TotalHours, 2)
}

$BackupEnabled = $false
$BackupStartTime = $null
if ($InstanceExists -and $Instance.settings.backupConfiguration) {
  $BackupEnabled = [bool]$Instance.settings.backupConfiguration.enabled
  $BackupStartTime = [string]$Instance.settings.backupConfiguration.startTime
}

$ReadyForRestoreTest = (
  $InstanceExists -and
  $BackupEnabled -and
  ($null -ne $LatestSuccessfulBackup) -and
  $BucketExists -and
  (-not $RestoreInstanceExists)
)

$RestoreCommand = $null
if ($LatestSuccessfulBackup) {
  $StorageType = switch ([string]$Instance.settings.dataDiskType) {
    "PD_HDD" { "HDD" }
    "PD_SSD" { "SSD" }
    default { "SSD" }
  }
  $DatabaseFlags = @(
    $Instance.settings.databaseFlags |
      ForEach-Object { "$($_.name)=$($_.value)" }
  ) -join ","

  $CreateRestoreInstanceCommand = @(
    "gcloud sql instances create $RestoreInstanceName",
    "--project=$ProjectId",
    "--database-version=$($Instance.databaseVersion)",
    "--tier=$($Instance.settings.tier)",
    "--region=$Region",
    "--availability-type=ZONAL",
    "--storage-type=$StorageType",
    "--storage-size=$($Instance.settings.dataDiskSizeGb)",
    "--no-backup",
    "--no-deletion-protection",
    "--storage-auto-increase"
  )

  if (-not [string]::IsNullOrWhiteSpace($DatabaseFlags)) {
    $CreateRestoreInstanceCommand += "--database-flags=$DatabaseFlags"
  }

  $RestoreBackupCommand = @(
    "gcloud sql backups restore $($LatestSuccessfulBackup.id)",
    "--backup-instance=$CloudSqlInstanceName",
    "--restore-instance=$RestoreInstanceName",
    "--project=$ProjectId",
    "--quiet"
  )

  $RestoreCommand = (($CreateRestoreInstanceCommand -join " ") + [Environment]::NewLine + ($RestoreBackupCommand -join " "))
}

$StorageClass = $null
$UniformBucketLevelAccess = $null
$PublicAccessPrevention = $null
if ($BucketExists) {
  $StorageClass = First-Value @([string]$Bucket.storageClass, [string]$Bucket.default_storage_class)
  if ($null -ne $Bucket.iamConfiguration -and $null -ne $Bucket.iamConfiguration.uniformBucketLevelAccess) {
    $UniformBucketLevelAccess = [bool]$Bucket.iamConfiguration.uniformBucketLevelAccess.enabled
  } elseif ($null -ne $Bucket.uniform_bucket_level_access) {
    $UniformBucketLevelAccess = [bool]$Bucket.uniform_bucket_level_access
  }
  $PublicAccessPrevention = First-Value @(
    [string]$Bucket.iamConfiguration.publicAccessPrevention,
    [string]$Bucket.public_access_prevention
  )
}

$Result = [pscustomobject]@{
  generated_at = (Get-Date).ToString("o")
  environment = $Environment
  project_id = $ProjectId
  region = $Region
  gcloud_path = $script:ResolvedGcloudPath
  cloud_sql = [pscustomobject]@{
    source_instance_name = $CloudSqlInstanceName
    source_instance_exists = $InstanceExists
    source_instance_state = if ($InstanceExists) { [string]$Instance.state } else { $null }
    database_version = if ($InstanceExists) { [string]$Instance.databaseVersion } else { $null }
    tier = if ($InstanceExists) { [string]$Instance.settings.tier } else { $null }
    backup_enabled = $BackupEnabled
    backup_start_time = $BackupStartTime
    successful_backup_count = @($BackupRows | Where-Object { $_.status -eq "SUCCESSFUL" }).Count
    latest_successful_backup_id = if ($LatestSuccessfulBackup) { [string]$LatestSuccessfulBackup.id } else { $null }
    latest_successful_backup_end_time = if ($LatestSuccessfulBackup) { [string]$LatestSuccessfulBackup.endTime } else { $null }
    estimated_rpo_hours = $EstimatedRpoHours
    restore_instance_name = $RestoreInstanceName
    restore_instance_exists = $RestoreInstanceExists
  }
  storage = [pscustomobject]@{
    document_bucket_name = $DocumentBucketName
    document_bucket_exists = $BucketExists
    location = if ($BucketExists) { [string]$Bucket.location } else { $null }
    storage_class = $StorageClass
    uniform_bucket_level_access = $UniformBucketLevelAccess
    public_access_prevention = $PublicAccessPrevention
  }
  readiness = [pscustomobject]@{
    ready_for_restore_test = $ReadyForRestoreTest
    blockers = @(
      if (-not $InstanceExists) { "Cloud SQL source instance does not exist: $CloudSqlInstanceName" }
      if ($InstanceExists -and -not $BackupEnabled) { "Cloud SQL backups are not enabled." }
      if ($InstanceExists -and $null -eq $LatestSuccessfulBackup) { "No successful Cloud SQL backup was found." }
      if (-not $BucketExists) { "Document bucket does not exist: gs://$DocumentBucketName" }
      if ($RestoreInstanceExists) { "Restore test instance already exists: $RestoreInstanceName" }
    )
  }
  suggested_restore_command = $RestoreCommand
}

$OutputPath = Join-Path -Path $ResolvedOutputDir -ChildPath "verify-backup-restore-readiness-$Environment.json"
$Result | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $OutputPath -Encoding UTF8

$Display = @(
  [pscustomobject]@{ Area = "Cloud SQL"; Check = "source instance exists"; Value = $InstanceExists },
  [pscustomobject]@{ Area = "Cloud SQL"; Check = "backup enabled"; Value = $BackupEnabled },
  [pscustomobject]@{ Area = "Cloud SQL"; Check = "successful backups"; Value = $Result.cloud_sql.successful_backup_count },
  [pscustomobject]@{ Area = "Cloud SQL"; Check = "restore target free"; Value = (-not $RestoreInstanceExists) },
  [pscustomobject]@{ Area = "Storage"; Check = "document bucket exists"; Value = $BucketExists },
  [pscustomobject]@{ Area = "Overall"; Check = "ready for restore test"; Value = $ReadyForRestoreTest }
)

$Display | Format-Table -AutoSize

if ($Result.readiness.blockers.Count -gt 0) {
  Write-Host "Bloqueos:"
  foreach ($Blocker in $Result.readiness.blockers) {
    Write-Host "- $Blocker"
  }
}

Write-Host "Resultado JSON: $OutputPath"

if ($FailOnNotReady -and -not $ReadyForRestoreTest) {
  exit 2
}
