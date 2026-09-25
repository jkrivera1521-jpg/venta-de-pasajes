param(
  [string]$ConfigPath = "infra\cloudrun\prod-frontend-services.json",
  [string]$ProjectId = "",
  [string]$Region = "",
  [string]$GcloudPath = "",
  [string]$CloudSdkPython = "",
  [string]$OutputDir = "logs\cloudrun-prod",
  [int]$TimeoutSec = 60,
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
    "C:\Python313\python.exe"
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

  return $Text | ConvertFrom-Json
}

function Get-EnvValue {
  param(
    $ServiceDescription,
    [string]$Name
  )

  $Env = @($ServiceDescription.spec.template.spec.containers[0].env)
  $Match = $Env | Where-Object { $_.name -eq $Name } | Select-Object -First 1
  if ($Match) {
    return [string]$Match.value
  }

  return ""
}

function Get-Ready {
  param($Description)

  $Conditions = @($Description.status.conditions)
  $Ready = $Conditions | Where-Object { $_.type -eq "Ready" } | Select-Object -First 1
  return $null -ne $Ready -and $Ready.status -eq "True"
}

function Join-Url {
  param(
    [string]$BaseUrl,
    [string]$Path
  )

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
    [string]$Url,
    [int]$ExpectedStatus = 200,
    [string]$ExpectedJsonStatus = ""
  )

  $Stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
  try {
    $Response = Invoke-WebRequest -Uri $Url -Method GET -UseBasicParsing -TimeoutSec $TimeoutSec -ErrorAction Stop
    $Stopwatch.Stop()
    $Content = if ($null -ne $Response.Content) { [string]$Response.Content } else { "" }
    $JsonStatus = ""

    if (-not [string]::IsNullOrWhiteSpace($ExpectedJsonStatus) -and -not [string]::IsNullOrWhiteSpace($Content)) {
      try {
        $JsonStatus = [string](($Content | ConvertFrom-Json).status)
      } catch {
        $JsonStatus = ""
      }
    }

    $StatusPassed = [int]$Response.StatusCode -eq $ExpectedStatus
    $JsonStatusPassed = [string]::IsNullOrWhiteSpace($ExpectedJsonStatus) -or $JsonStatus -eq $ExpectedJsonStatus

    return [pscustomobject]@{
      name = $Name
      service_id = $ServiceId
      url = $Url
      expected_status = $ExpectedStatus
      expected_json_status = $ExpectedJsonStatus
      status_code = [int]$Response.StatusCode
      json_status = $JsonStatus
      passed = $StatusPassed -and $JsonStatusPassed
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
      url = $Url
      expected_status = $ExpectedStatus
      expected_json_status = $ExpectedJsonStatus
      status_code = $StatusCode
      json_status = ""
      passed = $StatusCode -eq $ExpectedStatus
      elapsed_ms = [int]$Stopwatch.ElapsedMilliseconds
      bytes = 0
      error = $_.Exception.Message
    }
  }
}

function Has-UnresolvedEnv {
  param($ServiceDescription)

  $Env = @($ServiceDescription.spec.template.spec.containers[0].env)
  $Text = ($Env | ForEach-Object { "$($_.name)=$($_.value)" }) -join "`n"
  return $Text.Contains("UNRESOLVED_") -or $Text.Contains('${')
}

Initialize-CloudSdkPython -ConfiguredPython $CloudSdkPython
$script:Gcloud = Resolve-GcloudPath -ConfiguredGcloud $GcloudPath

$ResolvedConfigPath = Resolve-Path -LiteralPath $ConfigPath
$Config = Get-Content -LiteralPath $ResolvedConfigPath.Path -Raw | ConvertFrom-Json
$ProjectId = First-Value @($ProjectId, [string]$Config.default_project_id, $env:GOOGLE_CLOUD_PROJECT)
$Region = First-Value @($Region, [string]$Config.default_region, $env:GOOGLE_CLOUD_REGION)

$ResolvedOutputDir = Join-Path -Path $ProjectRoot -ChildPath $OutputDir
New-Item -ItemType Directory -Force -Path $ResolvedOutputDir | Out-Null

$FrontendServices = @($Config.services | Where-Object { $_.group -eq "frontend" })
$ServiceRows = New-Object System.Collections.Generic.List[object]
$Checks = New-Object System.Collections.Generic.List[object]

foreach ($Service in $FrontendServices) {
  $Description = Invoke-GcloudJson -Arguments @(
    "run", "services", "describe", $Service.service_name,
    "--project", $ProjectId,
    "--region", $Region,
    "--format", "json"
  )

  $Url = [string]$Description.status.url
  $ServiceAccountName = [string]$Description.spec.template.spec.serviceAccountName
  $ExpectedServiceAccount = [string]$Service.service_account
  $ExpectedServiceAccount = $ExpectedServiceAccount.Replace('${PROJECT_ID}', $ProjectId)
  $AppEnv = Get-EnvValue -ServiceDescription $Description -Name "NEXT_PUBLIC_APP_ENV"

  $ServiceRows.Add([pscustomobject]@{
    service_id = [string]$Service.id
    service_name = [string]$Service.service_name
    ready = Get-Ready -Description $Description
    url = $Url
    revision = [string]$Description.status.latestReadyRevisionName
    app_env_is_prod = $AppEnv -eq "prod"
    service_account_matches = $ServiceAccountName -eq $ExpectedServiceAccount
    public_health_passed = $false
    has_unresolved_env = Has-UnresolvedEnv -ServiceDescription $Description
  }) | Out-Null

  $Checks.Add((Invoke-HttpCheck -Name "$($Service.id) health" -ServiceId $Service.id -Url (Join-Url -BaseUrl $Url -Path $Service.health_path))) | Out-Null
}

$MfePaths = @{
  "mfe-identity" = "/identity/embedded"
  "mfe-dispatch" = "/dispatch/embedded"
  "mfe-ticketing" = "/ticketing/embedded"
  "mfe-reporting" = "/reporting/embedded"
  "mfe-admin" = "/admin/embedded"
}

foreach ($Service in $FrontendServices | Where-Object { $_.id -ne "frontend-shell" }) {
  $Row = $ServiceRows | Where-Object { $_.service_id -eq $Service.id } | Select-Object -First 1
  $Checks.Add((Invoke-HttpCheck -Name "$($Service.id) manifest" -ServiceId $Service.id -Url (Join-Url -BaseUrl $Row.url -Path "/mfe/manifest"))) | Out-Null
  $Checks.Add((Invoke-HttpCheck -Name "$($Service.id) embedded" -ServiceId $Service.id -Url (Join-Url -BaseUrl $Row.url -Path $MfePaths[$Service.id]))) | Out-Null
}

$AdminRow = $ServiceRows | Where-Object { $_.service_id -eq "mfe-admin" } | Select-Object -First 1
if ($AdminRow) {
  $Checks.Add((Invoke-HttpCheck -Name "mfe-admin aggregate health" -ServiceId "mfe-admin" -Url (Join-Url -BaseUrl $AdminRow.url -Path "/api/admin/health") -ExpectedJsonStatus "up")) | Out-Null
}

$ShellRow = $ServiceRows | Where-Object { $_.service_id -eq "frontend-shell" } | Select-Object -First 1
if ($ShellRow) {
  $Checks.Add((Invoke-HttpCheck -Name "frontend-shell root" -ServiceId "frontend-shell" -Url (Join-Url -BaseUrl $ShellRow.url -Path "/"))) | Out-Null
  $Checks.Add((Invoke-HttpCheck -Name "frontend-shell runtime config" -ServiceId "frontend-shell" -Url (Join-Url -BaseUrl $ShellRow.url -Path "/api/shell/runtime-config"))) | Out-Null
}

$CheckArray = @($Checks.ToArray())
foreach ($Row in $ServiceRows) {
  $Health = $CheckArray | Where-Object { $_.name -eq "$($Row.service_id) health" } | Select-Object -First 1
  $Row.public_health_passed = $null -ne $Health -and $Health.passed
}

$ServiceArray = @($ServiceRows.ToArray())
$FailedServices = @($ServiceArray | Where-Object {
  -not $_.ready -or
  -not $_.app_env_is_prod -or
  -not $_.service_account_matches -or
  -not $_.public_health_passed -or
  $_.has_unresolved_env
})
$FailedChecks = @($CheckArray | Where-Object { -not $_.passed })

$Result = [pscustomobject]@{
  generated_at = (Get-Date).ToString("o")
  project_id = $ProjectId
  region = $Region
  config_path = $ResolvedConfigPath.Path
  summary = [pscustomobject]@{
    services_total = $ServiceArray.Count
    services_ready = @($ServiceArray | Where-Object { $_.ready }).Count
    services_prod_env = @($ServiceArray | Where-Object { $_.app_env_is_prod }).Count
    services_account_match = @($ServiceArray | Where-Object { $_.service_account_matches }).Count
    services_without_unresolved_env = @($ServiceArray | Where-Object { -not $_.has_unresolved_env }).Count
    checks_total = $CheckArray.Count
    checks_passed = @($CheckArray | Where-Object { $_.passed }).Count
    checks_failed = $FailedChecks.Count
  }
  services = $ServiceArray
  checks = $CheckArray
}

$OutputPath = Join-Path -Path $ResolvedOutputDir -ChildPath "verify-cloudrun-prod-frontends.json"
$Result | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $OutputPath -Encoding UTF8

Write-Host "Cloud Run prod frontend services"
$ServiceRows |
  Select-Object service_id, service_name, ready, app_env_is_prod, service_account_matches, public_health_passed, has_unresolved_env |
  Format-Table -AutoSize

Write-Host "Cloud Run prod frontend checks"
$Checks |
  Select-Object name, service_id, status_code, passed, elapsed_ms |
  Format-Table -AutoSize

Write-Host "Resultado JSON: $OutputPath"

if ($FailOnNotReady -and ($FailedServices.Count -gt 0 -or $FailedChecks.Count -gt 0)) {
  throw "Frontend productivo no listo. Servicios fallidos: $($FailedServices.service_id -join ', '). Checks fallidos: $($FailedChecks.name -join ', ')."
}

Write-Host "Frontend productivo listo: $($FailedServices.Count -eq 0 -and $FailedChecks.Count -eq 0)"
