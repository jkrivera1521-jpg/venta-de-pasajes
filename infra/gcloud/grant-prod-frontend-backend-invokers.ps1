param(
  [string]$ProjectId = "project-fbb34cd7-0b82-43e1-867",
  [string]$Region = "us-central1",
  [string[]]$BackendServices = @(
    "identity-service-prod",
    "dispatch-service-prod",
    "ticketing-service-prod",
    "document-service-prod",
    "reporting-service-prod",
    "audit-service-prod"
  ),
  [string[]]$CallerServiceAccounts = @(
    "frontend-prod-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com",
    "mfe-identity-prod-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com",
    "mfe-dispatch-prod-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com",
    "mfe-ticketing-prod-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com",
    "mfe-reporting-prod-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com",
    "mfe-admin-prod-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com"
  ),
  [string]$GcloudPath = $env:GCLOUD_PATH,
  [string]$CloudSdkPython = $env:CLOUDSDK_PYTHON,
  [string]$OutputDir = "logs\cloudrun-prod",
  [switch]$Execute
)

$ErrorActionPreference = "Stop"

$ProjectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..\..")).Path
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

  $KnownPath = "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd"
  if (Test-Path -LiteralPath $KnownPath) {
    return $KnownPath
  }

  $Command = Get-Command gcloud.cmd -ErrorAction SilentlyContinue
  if ($Command) {
    return $Command.Source
  }

  throw "No se encontro gcloud.cmd. Configure -GcloudPath o GCLOUD_PATH."
}

function Initialize-CloudSdkPython {
  param([string]$ConfiguredPython)

  $PythonPath = First-Value @(
    $ConfiguredPython,
    $env:CLOUDSDK_PYTHON,
    "C:\Python312\python.exe",
    "C:\Python313\python.exe"
  )

  if (-not [string]::IsNullOrWhiteSpace($PythonPath) -and (Test-Path -LiteralPath $PythonPath)) {
    $env:CLOUDSDK_PYTHON = (Resolve-Path -LiteralPath $PythonPath).Path
  }
}

function Invoke-GcloudJson {
  param([string[]]$Arguments)

  $PreviousErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    $Output = & $script:Gcloud @Arguments 2>&1
    $ExitCode = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $PreviousErrorActionPreference
  }

  $Text = ($Output | ForEach-Object { $_.ToString() }) -join [Environment]::NewLine
  if ($ExitCode -ne 0) {
    throw "gcloud fallo con codigo ${ExitCode}: $($Arguments -join ' '). Detalle: $Text"
  }

  if ([string]::IsNullOrWhiteSpace($Text)) {
    return $null
  }

  return $Text | ConvertFrom-Json
}

function Invoke-Gcloud {
  param([string[]]$Arguments)

  $PreviousErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    $Output = & $script:Gcloud @Arguments 2>&1
    $ExitCode = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $PreviousErrorActionPreference
  }

  $Text = ($Output | ForEach-Object { $_.ToString() }) -join [Environment]::NewLine
  if ($ExitCode -ne 0) {
    throw "gcloud fallo con codigo ${ExitCode}: $($Arguments -join ' '). Detalle: $Text"
  }

  return $Text
}

function Has-InvokerBinding {
  param(
    $Policy,
    [string]$Member
  )

  return @(
    $Policy.bindings |
      Where-Object { $_.role -eq "roles/run.invoker" } |
      ForEach-Object { $_.members } |
      Where-Object { $_ -eq $Member }
  ).Count -gt 0
}

function Normalize-Values {
  param([string[]]$Values)

  return @($Values | ForEach-Object { $_ -split "," } | ForEach-Object { $_.Trim() } | Where-Object { $_ })
}

Initialize-CloudSdkPython -ConfiguredPython $CloudSdkPython
$script:Gcloud = Resolve-GcloudPath -ConfiguredGcloud $GcloudPath
$ResolvedOutputDir = Join-Path -Path $ProjectRoot -ChildPath $OutputDir
New-Item -ItemType Directory -Force -Path $ResolvedOutputDir | Out-Null

$Services = Normalize-Values -Values $BackendServices
$Callers = Normalize-Values -Values $CallerServiceAccounts
if ($Services.Count -eq 0) { throw "BackendServices no puede estar vacio." }
if ($Callers.Count -eq 0) { throw "CallerServiceAccounts no puede estar vacio." }

$Rows = New-Object System.Collections.Generic.List[object]

foreach ($Service in $Services) {
  $PolicyBefore = Invoke-GcloudJson -Arguments @(
    "run", "services", "get-iam-policy", $Service,
    "--project", $ProjectId,
    "--region", $Region,
    "--format", "json"
  )

  foreach ($Caller in $Callers) {
    $Member = "serviceAccount:$Caller"
    $ExistsBefore = Has-InvokerBinding -Policy $PolicyBefore -Member $Member
    $Action = if ($ExistsBefore) { "exists" } elseif ($Execute) { "grant" } else { "planned" }

    if ($Execute -and -not $ExistsBefore) {
      Invoke-Gcloud -Arguments @(
        "run", "services", "add-iam-policy-binding", $Service,
        "--project", $ProjectId,
        "--region", $Region,
        "--member", $Member,
        "--role", "roles/run.invoker",
        "--quiet"
      ) | Out-Null
    }

    $PolicyAfter = Invoke-GcloudJson -Arguments @(
      "run", "services", "get-iam-policy", $Service,
      "--project", $ProjectId,
      "--region", $Region,
      "--format", "json"
    )

    $Rows.Add([pscustomobject]@{
      backend_service = $Service
      member = $Member
      invoker_before = $ExistsBefore
      invoker_after = Has-InvokerBinding -Policy $PolicyAfter -Member $Member
      action = $Action
    }) | Out-Null
  }
}

$Result = [pscustomobject]@{
  generated_at = (Get-Date).ToString("o")
  project_id = $ProjectId
  region = $Region
  execute = [bool]$Execute
  backend_services = $Services
  caller_service_accounts = $Callers
  bindings = @($Rows.ToArray())
}

$Path = Join-Path -Path $ResolvedOutputDir -ChildPath "grant-prod-frontend-backend-invokers.json"
$Result | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $Path -Encoding UTF8

Write-Host "Prod frontend backend invoker plan generated."
Write-Host "Result: $Path"
$Rows | Format-Table backend_service, member, invoker_before, invoker_after, action -AutoSize
