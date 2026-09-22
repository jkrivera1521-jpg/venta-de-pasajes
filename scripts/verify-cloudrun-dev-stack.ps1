param(
  [string]$ConfigPath = "infra\cloudrun\dev-services.json",
  [string]$ProjectId = "",
  [string]$Region = "",
  [string]$GcloudPath = "",
  [string]$CloudSdkPython = "",
  [string]$OutputDir = "logs\cloudrun-dev",
  [int]$TimeoutSec = 60,
  [switch]$SkipFunctionalChecks
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

function Invoke-GcloudJson {
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

  if ($ExitCode -ne 0) {
    throw "gcloud fallo con codigo ${ExitCode}: $($Arguments -join ' '). Detalle: $Text"
  }

  if ([string]::IsNullOrWhiteSpace($Text)) {
    return $null
  }

  return $Text | ConvertFrom-Json
}

function Invoke-GcloudText {
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

  if ($ExitCode -ne 0) {
    throw "gcloud fallo con codigo ${ExitCode}: $($Arguments -join ' '). Detalle: $Text"
  }

  return $Text.Trim()
}

function Join-Url {
  param(
    [string]$BaseUrl,
    [string]$Path
  )

  if ([string]::IsNullOrWhiteSpace($BaseUrl)) {
    return ""
  }

  if ([string]::IsNullOrWhiteSpace($Path)) {
    return $BaseUrl.TrimEnd("/")
  }

  return $BaseUrl.TrimEnd("/") + "/" + $Path.TrimStart("/")
}

function Get-StatusCode {
  param($ErrorRecord)

  if ($ErrorRecord.Exception.Response -and $ErrorRecord.Exception.Response.StatusCode) {
    return [int]$ErrorRecord.Exception.Response.StatusCode
  }

  return 0
}

function Invoke-HttpCheck {
  param(
    [string]$Name,
    [string]$ServiceId,
    [string]$Group,
    [string]$Url,
    [int]$ExpectedStatus,
    [hashtable]$Headers
  )

  if ([string]::IsNullOrWhiteSpace($Url)) {
    return [pscustomobject]@{
      name = $Name
      service_id = $ServiceId
      group = $Group
      url = $Url
      expected_status = $ExpectedStatus
      status_code = 0
      passed = $false
      elapsed_ms = 0
      bytes = 0
      error = "Service URL not resolved."
    }
  }

  $Stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
  try {
    $Response = Invoke-WebRequest -Uri $Url -Headers $Headers -Method GET -UseBasicParsing -TimeoutSec $TimeoutSec -ErrorAction Stop
    $Stopwatch.Stop()
    $Content = if ($null -ne $Response.Content) { [string]$Response.Content } else { "" }
    $StatusCode = [int]$Response.StatusCode

    return [pscustomobject]@{
      name = $Name
      service_id = $ServiceId
      group = $Group
      url = $Url
      expected_status = $ExpectedStatus
      status_code = $StatusCode
      passed = ($StatusCode -eq $ExpectedStatus)
      elapsed_ms = [int]$Stopwatch.ElapsedMilliseconds
      bytes = $Content.Length
      error = ""
    }
  } catch {
    $Stopwatch.Stop()
    $StatusCode = Get-StatusCode -ErrorRecord $_

    return [pscustomobject]@{
      name = $Name
      service_id = $ServiceId
      group = $Group
      url = $Url
      expected_status = $ExpectedStatus
      status_code = $StatusCode
      passed = ($StatusCode -eq $ExpectedStatus)
      elapsed_ms = [int]$Stopwatch.ElapsedMilliseconds
      bytes = 0
      error = $_.Exception.Message
    }
  }
}

function Add-Check {
  param(
    [string]$Name,
    [string]$ServiceId,
    [string]$Group,
    [string]$Path,
    [string]$Auth = "none",
    [int]$ExpectedStatus = 200
  )

  $script:Checks.Add([pscustomobject]@{
    name = $Name
    service_id = $ServiceId
    group = $Group
    path = $Path
    auth = $Auth
    expected_status = $ExpectedStatus
  }) | Out-Null
}

$ResolvedConfigPath = Resolve-Path -LiteralPath $ConfigPath
$Config = Get-Content -LiteralPath $ResolvedConfigPath.Path -Raw | ConvertFrom-Json

$ProjectId = First-Value @($ProjectId, $Config.default_project_id, $env:GOOGLE_CLOUD_PROJECT)
$Region = First-Value @($Region, $Config.default_region, $env:GOOGLE_CLOUD_REGION)

if ([string]::IsNullOrWhiteSpace($ProjectId)) {
  throw "ProjectId no pudo resolverse."
}

if ([string]::IsNullOrWhiteSpace($Region)) {
  throw "Region no pudo resolverse."
}

Initialize-CloudSdkPython -ConfiguredPython $CloudSdkPython
$script:ResolvedGcloudPath = Resolve-GcloudPath -ConfiguredGcloud $GcloudPath

$ResolvedOutputDir = Join-Path -Path $ProjectRoot -ChildPath $OutputDir
New-Item -ItemType Directory -Force -Path $ResolvedOutputDir | Out-Null

$ServiceRows = New-Object System.Collections.Generic.List[object]
$ServiceUrls = @{}

foreach ($Service in $Config.services) {
  try {
    $Description = Invoke-GcloudJson -Arguments @(
      "run",
      "services",
      "describe",
      $Service.service_name,
      "--project",
      $ProjectId,
      "--region",
      $Region,
      "--format=json"
    )

    $ReadyCondition = @($Description.status.conditions | Where-Object { $_.type -eq "Ready" } | Select-Object -First 1)
    $Ready = $ReadyCondition.Count -gt 0 -and $ReadyCondition[0].status -eq "True"
    $Url = [string]$Description.status.url
    $ServiceUrls[$Service.id] = $Url

    $ServiceRows.Add([pscustomobject]@{
      service_id = $Service.id
      group = $Service.group
      service_name = $Service.service_name
      ready = $Ready
      url = $Url
      revision = [string]$Description.status.latestReadyRevisionName
      error = ""
    }) | Out-Null
  } catch {
    $ServiceUrls[$Service.id] = ""
    $ServiceRows.Add([pscustomobject]@{
      service_id = $Service.id
      group = $Service.group
      service_name = $Service.service_name
      ready = $false
      url = ""
      revision = ""
      error = $_.Exception.Message
    }) | Out-Null
  }
}

$IdentityToken = Invoke-GcloudText -Arguments @("auth", "print-identity-token")
$AuthHeaders = @{
  Authorization = "Bearer $IdentityToken"
}

$script:Checks = New-Object System.Collections.Generic.List[object]

foreach ($Service in $Config.services) {
  $Auth = if ($Service.group -eq "backend") { "identity-token" } else { "none" }
  Add-Check -Name "$($Service.id) health" -ServiceId $Service.id -Group $Service.group -Path $Service.health_path -Auth $Auth
}

$ManifestServiceIds = @("mfe-identity", "mfe-dispatch", "mfe-ticketing", "mfe-reporting", "mfe-admin")
foreach ($ServiceId in $ManifestServiceIds) {
  Add-Check -Name "$ServiceId manifest" -ServiceId $ServiceId -Group "frontend" -Path "/mfe/manifest"
}

$EmbeddedPaths = @{
  "frontend-shell" = "/"
  "mfe-identity" = "/identity/embedded"
  "mfe-dispatch" = "/dispatch/embedded"
  "mfe-ticketing" = "/ticketing/embedded"
  "mfe-reporting" = "/reporting/embedded"
  "mfe-admin" = "/admin/embedded"
}

foreach ($ServiceId in $EmbeddedPaths.Keys) {
  Add-Check -Name "$ServiceId embedded" -ServiceId $ServiceId -Group "frontend" -Path $EmbeddedPaths[$ServiceId]
}

Add-Check -Name "frontend-shell runtime config" -ServiceId "frontend-shell" -Group "frontend" -Path "/api/shell/runtime-config"

if (-not $SkipFunctionalChecks) {
  Add-Check -Name "dispatch terminals list" -ServiceId "dispatch-service" -Group "backend" -Path "/api/v1/dispatch/terminals?page=1&page_size=1" -Auth "identity-token"
  Add-Check -Name "dispatch departures list" -ServiceId "dispatch-service" -Group "backend" -Path "/api/v1/dispatch/departures?page=1&page_size=1" -Auth "identity-token"
  Add-Check -Name "document resources list" -ServiceId "document-service" -Group "backend" -Path "/api/v1/document/resources" -Auth "identity-token"
  Add-Check -Name "reporting resources list" -ServiceId "reporting-service" -Group "backend" -Path "/api/v1/reporting/resources" -Auth "identity-token"
  Add-Check -Name "audit resources list" -ServiceId "audit-service" -Group "backend" -Path "/api/v1/audit/resources" -Auth "identity-token"
  Add-Check -Name "ticketing resources list" -ServiceId "ticketing-service" -Group "backend" -Path "/api/v1/ticketing/resources" -Auth "identity-token"
  Add-Check -Name "ticketing passengers list" -ServiceId "ticketing-service" -Group "backend" -Path "/api/v1/ticketing/passengers" -Auth "identity-token"
  Add-Check -Name "ticketing availability list" -ServiceId "ticketing-service" -Group "backend" -Path "/api/v1/ticketing/availability/departures?date_from=2026-09-01&date_to=2026-09-30" -Auth "identity-token"
  Add-Check -Name "reporting sales report" -ServiceId "reporting-service" -Group "backend" -Path "/api/v1/reporting/reports/sales?date_from=2026-09-01&date_to=2026-09-30" -Auth "identity-token"
  Add-Check -Name "audit events list" -ServiceId "audit-service" -Group "backend" -Path "/api/v1/audit/audit-events?page=1&page_size=1" -Auth "identity-token"
}

$CheckRows = New-Object System.Collections.Generic.List[object]

foreach ($Check in $script:Checks) {
  $BaseUrl = [string]$ServiceUrls[$Check.service_id]
  $Url = Join-Url -BaseUrl $BaseUrl -Path $Check.path
  $Headers = @{}
  if ($Check.auth -eq "identity-token") {
    $Headers = $AuthHeaders
  }

  $CheckRows.Add((Invoke-HttpCheck `
    -Name $Check.name `
    -ServiceId $Check.service_id `
    -Group $Check.group `
    -Url $Url `
    -ExpectedStatus $Check.expected_status `
    -Headers $Headers)) | Out-Null
}

$ServiceArray = @($ServiceRows.ToArray())
$CheckArray = @($CheckRows.ToArray())
$FailedServices = @($ServiceArray | Where-Object { -not $_.ready })
$FailedChecks = @($CheckArray | Where-Object { -not $_.passed })
$ReadyServices = @($ServiceArray | Where-Object { $_.ready })
$PassedChecks = @($CheckArray | Where-Object { $_.passed })

$Result = [pscustomobject]@{
  generated_at = (Get-Date).ToString("o")
  project_id = $ProjectId
  region = $Region
  config_path = $ResolvedConfigPath.Path
  gcloud_path = $script:ResolvedGcloudPath
  summary = [pscustomobject]@{
    services_total = $ServiceArray.Count
    services_ready = $ReadyServices.Count
    checks_total = $CheckArray.Count
    checks_passed = $PassedChecks.Count
    checks_failed = $FailedChecks.Count
  }
  services = $ServiceArray
  checks = $CheckArray
}

$OutputPath = Join-Path -Path $ResolvedOutputDir -ChildPath "verify-cloudrun-dev-stack.result.json"
$Result | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $OutputPath -Encoding UTF8

Write-Host "Cloud Run dev services"
$ServiceRows |
  Select-Object service_id, group, ready, revision, url |
  Format-Table -AutoSize

Write-Host "Cloud Run dev checks"
$CheckRows |
  Select-Object name, service_id, status_code, passed, elapsed_ms |
  Format-Table -AutoSize

Write-Host "Resultado JSON: $OutputPath"

if ($FailedServices.Count -gt 0 -or $FailedChecks.Count -gt 0) {
  $Details = @()
  foreach ($Service in $FailedServices) {
    $Details += "$($Service.service_id): service not Ready. $($Service.error)"
  }
  foreach ($Check in $FailedChecks) {
    $Details += "$($Check.name): HTTP $($Check.status_code), expected $($Check.expected_status). $($Check.error)"
  }

  throw "Verificacion Cloud Run dev fallida: $($Details -join ' | ')"
}

Write-Host "Verificacion Cloud Run dev OK: $($Result.summary.checks_passed)/$($Result.summary.checks_total) checks."
