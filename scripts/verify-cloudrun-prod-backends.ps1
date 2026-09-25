param(
  [string]$ConfigPath = "infra\cloudrun\prod-backend-services.json",
  [string]$ProjectId = "",
  [string]$Region = "",
  [string]$ImageTag = "",
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
  param(
    [string[]]$Arguments,
    [switch]$AllowFailure
  )

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
    if ($AllowFailure) {
      return $null
    }

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

  return $BaseUrl.TrimEnd("/") + "/" + $Path.TrimStart("/")
}

function Get-EnvValue {
  param(
    $ServiceDescription,
    [string]$Name
  )

  if (-not $ServiceDescription) {
    return ""
  }

  $Container = @($ServiceDescription.spec.template.spec.containers)[0]
  $Env = @($Container.env | Where-Object { $_.name -eq $Name } | Select-Object -First 1)
  if ($Env.Count -eq 0) {
    return ""
  }

  return [string]$Env[0].value
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
    [string]$ServiceId,
    [string]$ServiceName,
    [string]$Url,
    [hashtable]$Headers
  )

  $Stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
  try {
    $Response = Invoke-WebRequest -Uri $Url -Headers $Headers -Method GET -UseBasicParsing -TimeoutSec $TimeoutSec -ErrorAction Stop
    $Stopwatch.Stop()
    return [pscustomobject]@{
      service_id = $ServiceId
      service_name = $ServiceName
      url = $Url
      status_code = [int]$Response.StatusCode
      passed = [int]$Response.StatusCode -eq 200
      elapsed_ms = [int]$Stopwatch.ElapsedMilliseconds
      error = ""
    }
  } catch {
    $Stopwatch.Stop()
    $StatusCode = Get-StatusCode -ErrorRecord $_
    return [pscustomobject]@{
      service_id = $ServiceId
      service_name = $ServiceName
      url = $Url
      status_code = $StatusCode
      passed = $StatusCode -eq 200
      elapsed_ms = [int]$Stopwatch.ElapsedMilliseconds
      error = $_.Exception.Message
    }
  }
}

function Has-PublicInvoker {
  param($Policy)

  if (-not $Policy) {
    return $false
  }

  return @(
    @($Policy.bindings) |
      Where-Object { $_.role -eq "roles/run.invoker" } |
      ForEach-Object { $_.members } |
      Where-Object { $_ -eq "allUsers" -or $_ -eq "allAuthenticatedUsers" }
  ).Count -gt 0
}

$ResolvedConfigPath = Resolve-Path -LiteralPath $ConfigPath
$Config = Get-Content -LiteralPath $ResolvedConfigPath.Path -Raw | ConvertFrom-Json

$ProjectId = First-Value @($ProjectId, [string]$Config.default_project_id, $env:GOOGLE_CLOUD_PROJECT)
$Region = First-Value @($Region, [string]$Config.default_region, $env:GOOGLE_CLOUD_REGION)
$ImageTag = First-Value @($ImageTag, [string]$Config.default_image_tag, $env:IMAGE_TAG)

if ([string]::IsNullOrWhiteSpace($ProjectId)) { throw "ProjectId no pudo resolverse." }
if ([string]::IsNullOrWhiteSpace($Region)) { throw "Region no pudo resolverse." }
if ([string]::IsNullOrWhiteSpace($ImageTag)) { throw "ImageTag no pudo resolverse." }

Initialize-CloudSdkPython -ConfiguredPython $CloudSdkPython
$script:ResolvedGcloudPath = Resolve-GcloudPath -ConfiguredGcloud $GcloudPath

$ResolvedOutputDir = Join-Path -Path $ProjectRoot -ChildPath $OutputDir
New-Item -ItemType Directory -Force -Path $ResolvedOutputDir | Out-Null

$ServiceRows = New-Object System.Collections.Generic.List[object]
$HealthRows = New-Object System.Collections.Generic.List[object]
$IdentityToken = Invoke-GcloudText -Arguments @("auth", "print-identity-token")
$AuthHeaders = @{ Authorization = "Bearer $IdentityToken" }

foreach ($Service in @($Config.services)) {
  $Description = Invoke-GcloudJson -Arguments @(
    "run",
    "services",
    "describe",
    [string]$Service.service_name,
    "--project",
    $ProjectId,
    "--region",
    $Region,
    "--format=json"
  ) -AllowFailure

  $Policy = Invoke-GcloudJson -Arguments @(
    "run",
    "services",
    "get-iam-policy",
    [string]$Service.service_name,
    "--project",
    $ProjectId,
    "--region",
    $Region,
    "--format=json"
  ) -AllowFailure

  $Exists = $null -ne $Description
  $AllConditions = @()
  if ($Exists -and $Description.status -and $Description.status.conditions) {
    $AllConditions = @($Description.status.conditions)
  }

  $ReadyCondition = @($AllConditions | Where-Object { [string]$_.type -eq "Ready" } | Select-Object -First 1)
  $ReadyStatus = if ($ReadyCondition.Count -gt 0) { $ReadyCondition[0].status } else { $null }
  $Ready = (($ReadyCondition.Count -gt 0) -and (($ReadyStatus -eq $true) -or ([string]$ReadyStatus -eq "True")))
  $Url = if ($Exists) { [string]$Description.status.url } else { "" }
  $ActualServiceAccount = if ($Exists) { [string]$Description.spec.template.spec.serviceAccountName } else { "" }
  $ExpectedServiceAccount = [string]$Service.service_account
  $ExpectedServiceAccount = $ExpectedServiceAccount.Replace('${PROJECT_ID}', $ProjectId)
  $ActualAppEnv = Get-EnvValue -ServiceDescription $Description -Name "APP_ENV"
  $ActualJdbcUrl = Get-EnvValue -ServiceDescription $Description -Name "APP_DB_JDBC_URL"
  $ExpectedCloudSqlConnection = [string]$Config.default_cloud_sql_connection_name
  $JdbcUrlUsesProdSql = -not [string]::IsNullOrWhiteSpace($ActualJdbcUrl) -and $ActualJdbcUrl.Contains($ExpectedCloudSqlConnection)
  $ActualImage = if ($Exists) { [string]$Description.spec.template.spec.containers[0].image } else { "" }
  $PublicInvoker = Has-PublicInvoker -Policy $Policy
  $HealthUrl = Join-Url -BaseUrl $Url -Path ([string]$Service.health_path)
  $Health = if ($Exists -and $Ready) {
    Invoke-HttpCheck -ServiceId ([string]$Service.id) -ServiceName ([string]$Service.service_name) -Url $HealthUrl -Headers $AuthHeaders
  } else {
    [pscustomobject]@{
      service_id = [string]$Service.id
      service_name = [string]$Service.service_name
      url = $HealthUrl
      status_code = 0
      passed = $false
      elapsed_ms = 0
      error = "Service not ready."
    }
  }

  $HealthRows.Add($Health) | Out-Null
  $ServiceRows.Add([pscustomobject]@{
    service_id = [string]$Service.id
    service_name = [string]$Service.service_name
    exists = $Exists
    ready = $Ready
    ready_condition_count = $ReadyCondition.Count
    ready_status = [string]$ReadyStatus
    url = $Url
    latest_ready_revision = if ($Exists) { [string]$Description.status.latestReadyRevisionName } else { "" }
    image = $ActualImage
    image_tag_expected = $ImageTag
    image_tag_matches = $ActualImage -like "*:$ImageTag" -or $ActualImage -like "*@$ImageTag"
    app_env = $ActualAppEnv
    app_env_is_prod = $ActualAppEnv -eq "prod"
    jdbc_url_uses_prod_sql = $JdbcUrlUsesProdSql
    service_account = $ActualServiceAccount
    expected_service_account = $ExpectedServiceAccount
    service_account_matches = $ActualServiceAccount -eq $ExpectedServiceAccount
    public_invoker = $PublicInvoker
    private_only = -not $PublicInvoker
    health_status = $Health.status_code
    health_passed = $Health.passed
  }) | Out-Null
}

$ServiceArray = @($ServiceRows.ToArray())
$HealthArray = @($HealthRows.ToArray())
$Ready = (@(
  $ServiceArray | Where-Object {
    -not $_.exists -or
    -not $_.ready -or
    -not $_.app_env_is_prod -or
    -not $_.jdbc_url_uses_prod_sql -or
    -not $_.service_account_matches -or
    -not $_.private_only -or
    -not $_.health_passed
  }
).Count -eq 0)

$Result = [pscustomobject]@{
  generated_at = (Get-Date).ToString("o")
  ready = $Ready
  project_id = $ProjectId
  region = $Region
  config_path = $ResolvedConfigPath.Path
  image_tag = $ImageTag
  services = $ServiceArray
  smoke_tests = $HealthArray
  summary = [pscustomobject]@{
    services_total = $ServiceArray.Count
    services_ready = @($ServiceArray | Where-Object { $_.ready }).Count
    services_prod_env = @($ServiceArray | Where-Object { $_.app_env_is_prod }).Count
    services_prod_account = @($ServiceArray | Where-Object { $_.service_account_matches }).Count
    services_prod_sql = @($ServiceArray | Where-Object { $_.jdbc_url_uses_prod_sql }).Count
    services_private = @($ServiceArray | Where-Object { $_.private_only }).Count
    smoke_tests_passed = @($HealthArray | Where-Object { $_.passed }).Count
  }
}

$OutputPath = Join-Path -Path $ResolvedOutputDir -ChildPath "verify-cloudrun-prod-backends.json"
$Result | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $OutputPath -Encoding UTF8

$ServiceArray | Format-Table service_id,service_name,ready,app_env_is_prod,jdbc_url_uses_prod_sql,service_account_matches,private_only,health_passed -AutoSize
Write-Host "Backend productivo listo: $Ready"
Write-Host "Resultado JSON: $OutputPath"

if ($FailOnNotReady -and -not $Ready) {
  throw "Backends productivos no estan listos."
}
