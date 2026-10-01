param(
  [string]$ProjectId = "project-fbb34cd7-0b82-43e1-867",
  [string]$CloudSqlInstance = "venta-pasajes-prod-sql",
  [string]$DatabaseName = "identity_db",
  [string]$ImportBucket = "venta-pasajes-prod-documents",
  [string]$CloudSqlUser = "identity-prod-run@project-fbb34cd7-0b82-43e1-867.iam",
  [string]$OutputDir = "logs\go-live",
  [string[]]$OperatorEmails = @(),
  [string[]]$SupervisorEmails = @(),
  [switch]$Execute
)

$ErrorActionPreference = "Stop"
$PSNativeCommandUseErrorActionPreference = $false

$ProjectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
Set-Location $ProjectRoot

$script:GcloudCommand = if (Test-Path -LiteralPath "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd") {
  "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd"
} else {
  "gcloud"
}

function Resolve-ProjectPath {
  param([string]$Path)

  if ([System.IO.Path]::IsPathRooted($Path)) {
    return [System.IO.Path]::GetFullPath($Path)
  }

  return [System.IO.Path]::GetFullPath((Join-Path $ProjectRoot $Path))
}

function Sql-Text {
  param([string]$Value)

  if ($null -eq $Value) {
    return "NULL"
  }

  return "'" + $Value.Replace("'", "''") + "'"
}

function Normalize-Email {
  param([string]$Email)

  if ([string]::IsNullOrWhiteSpace($Email)) {
    return ""
  }

  return $Email.Trim().ToLowerInvariant()
}

function Invoke-Gcloud {
  param([string[]]$Arguments)

  $PreviousErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    $Output = @(& $script:GcloudCommand @Arguments 2>&1)
    $ExitCode = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $PreviousErrorActionPreference
  }

  return [pscustomobject]@{
    exit_code = $ExitCode
    output = @($Output | ForEach-Object { $_.ToString() })
  }
}

if ($OperatorEmails.Count -eq 0) {
  throw "Debe informar al menos un correo de boleteria con -OperatorEmails."
}

if ($SupervisorEmails.Count -eq 0) {
  throw "Debe informar al menos un correo de supervisores con -SupervisorEmails."
}

if (Test-Path -LiteralPath "C:\Python312\python.exe") {
  $env:CLOUDSDK_PYTHON = "C:\Python312\python.exe"
}

$ResolvedOutputDir = Resolve-ProjectPath -Path $OutputDir
New-Item -ItemType Directory -Force -Path $ResolvedOutputDir | Out-Null

$RunId = Get-Date -Format "yyyyMMdd-HHmmss"
$SqlPath = Join-Path $ResolvedOutputDir "dia79-operational-identities.sql"
$ResultPath = Join-Path $ResolvedOutputDir "dia79-operational-identities-evidence.json"
$GcsUri = "gs://$ImportBucket/migration/dia79/operational-identities/$RunId.sql"

$SqlLines = [System.Collections.Generic.List[string]]::new()
$SqlLines.Add("-- Dia 79 - correos operativos productivos")
$SqlLines.Add("BEGIN;")

foreach ($Email in @($OperatorEmails | ForEach-Object { Normalize-Email $_ } | Where-Object { $_ } | Sort-Object -Unique)) {
  $Login = Sql-Text $Email
  $DisplayName = Sql-Text "Boleteria - $Email"
  $SqlLines.Add("INSERT INTO authorized_identities (type, value, active) VALUES ('EMAIL', $Login, true) ON CONFLICT (type, value) DO UPDATE SET active = true, updated_at = now();")
  $SqlLines.Add("INSERT INTO users (identity_type, login, email, display_name, status) VALUES ('GOOGLE', $Login, $Login, $DisplayName, 'ACTIVE') ON CONFLICT (login) DO UPDATE SET email = excluded.email, display_name = excluded.display_name, status = 'ACTIVE', identity_type = CASE WHEN users.identity_type = 'LOCAL' THEN 'HYBRID' ELSE users.identity_type END, updated_at = now();")
  $SqlLines.Add("INSERT INTO user_roles (user_id, role_id) SELECT u.id, r.id FROM users u JOIN roles r ON r.code = 'TICKET_SELLER' WHERE u.login = $Login ON CONFLICT DO NOTHING;")
}

foreach ($Email in @($SupervisorEmails | ForEach-Object { Normalize-Email $_ } | Where-Object { $_ } | Sort-Object -Unique)) {
  $Login = Sql-Text $Email
  $DisplayName = Sql-Text "Supervisor - $Email"
  $SqlLines.Add("INSERT INTO authorized_identities (type, value, active) VALUES ('EMAIL', $Login, true) ON CONFLICT (type, value) DO UPDATE SET active = true, updated_at = now();")
  $SqlLines.Add("INSERT INTO users (identity_type, login, email, display_name, status) VALUES ('GOOGLE', $Login, $Login, $DisplayName, 'ACTIVE') ON CONFLICT (login) DO UPDATE SET email = excluded.email, display_name = excluded.display_name, status = 'ACTIVE', identity_type = CASE WHEN users.identity_type = 'LOCAL' THEN 'HYBRID' ELSE users.identity_type END, updated_at = now();")
  $SqlLines.Add("INSERT INTO user_roles (user_id, role_id) SELECT u.id, r.id FROM users u JOIN roles r ON r.code = 'ADMIN' WHERE u.login = $Login ON CONFLICT DO NOTHING;")
}

$SqlLines.Add("COMMIT;")
$SqlLines | Set-Content -LiteralPath $SqlPath -Encoding UTF8

$UploadOutput = @()
$ImportOutput = @()
$Executed = $false

if ($Execute) {
  $UploadResult = Invoke-Gcloud -Arguments @("storage", "cp", $SqlPath, $GcsUri, "--project", $ProjectId)
  $UploadOutput = @($UploadResult.output)
  if ($UploadResult.exit_code -ne 0) {
    throw "No se pudo subir SQL operativo a Cloud Storage: $($UploadOutput -join ' ')"
  }

  $ImportResult = Invoke-Gcloud -Arguments @("sql", "import", "sql", $CloudSqlInstance, $GcsUri, "--project", $ProjectId, "--database", $DatabaseName, "--user", $CloudSqlUser, "--quiet")
  $ImportOutput = @($ImportResult.output)
  if ($ImportResult.exit_code -ne 0) {
    throw "No se pudo importar SQL operativo en Cloud SQL: $($ImportOutput -join ' ')"
  }

  $Executed = $true
}

$Result = [pscustomobject]@{
  generated_at = (Get-Date).ToString("o")
  run_id = $RunId
  executed = $Executed
  project_id = $ProjectId
  cloud_sql_instance = $CloudSqlInstance
  database = $DatabaseName
  cloud_sql_user = $CloudSqlUser
  operator_emails = @($OperatorEmails | ForEach-Object { Normalize-Email $_ } | Where-Object { $_ } | Sort-Object -Unique)
  supervisor_emails = @($SupervisorEmails | ForEach-Object { Normalize-Email $_ } | Where-Object { $_ } | Sort-Object -Unique)
  role_mapping = [pscustomobject]@{
    operators = "TICKET_SELLER"
    supervisors = "ADMIN"
  }
  paths = [pscustomobject]@{
    sql = $SqlPath
    evidence = $ResultPath
    gcs_uri = $GcsUri
  }
  upload_output = @($UploadOutput)
  import_output = @($ImportOutput)
}

$Result | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $ResultPath -Encoding UTF8

Write-Host "SQL operativo: $SqlPath"
Write-Host "Evidencia: $ResultPath"
Write-Host "GCS: $GcsUri"
Write-Host "Ejecutado: $Executed"
