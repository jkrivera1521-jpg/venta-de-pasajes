param(
  [string]$ConfigPath = "infra\cloudrun\dev-services.json",
  [string]$ProjectId = "",
  [string]$Region = "",
  [string]$Repository = "",
  [string]$ImageTag = "",
  [string]$CloudSqlConnectionName = "",
  [string]$GcloudPath = "",
  [string]$CloudSdkPython = "",
  [string]$OutputPath = "logs\cloudrun-dev\deploy-cloudrun-dev.commands.ps1",
  [switch]$BackendOnly,
  [switch]$FrontendOnly,
  [switch]$Execute,
  [switch]$AllowUnresolved,
  [switch]$SkipImageCheck
)

$ErrorActionPreference = "Stop"

$ProjectRoot = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")
$ProjectRoot = $ProjectRoot.Path
Set-Location $ProjectRoot

function Read-JsonFile {
  param([string]$Path)

  if (-not (Test-Path -LiteralPath $Path)) {
    throw "No existe el archivo de configuracion: $Path"
  }

  return Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json
}

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
    $env:CLOUDSDK_PYTHON = $PythonPath
    return $PythonPath
  }

  return $env:CLOUDSDK_PYTHON
}

function Initialize-GcloudPath {
  param([string]$ConfiguredGcloud)

  $Candidate = First-Value @($ConfiguredGcloud, $env:GCLOUD_PATH)
  if (-not [string]::IsNullOrWhiteSpace($Candidate)) {
    if ($Candidate.EndsWith(".ps1", [System.StringComparison]::OrdinalIgnoreCase)) {
      $CmdSibling = [System.IO.Path]::ChangeExtension($Candidate, ".cmd")
      if (Test-Path -LiteralPath $CmdSibling) {
        return $CmdSibling
      }
    }

    return $Candidate
  }

  $KnownChocolateyPath = "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd"
  if (Test-Path -LiteralPath $KnownChocolateyPath) {
    return $KnownChocolateyPath
  }

  return "gcloud.cmd"
}

function Invoke-NativeCommand {
  param(
    [Parameter(Mandatory = $true)][string]$FilePath,
    [Parameter(Mandatory = $true)][string[]]$Arguments
  )

  $PreviousErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    $Output = & $FilePath @Arguments 2>&1
    $ExitCode = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $PreviousErrorActionPreference
  }

  return [pscustomobject]@{
    ExitCode = $ExitCode
    Output = @($Output)
  }
}

function Quote-Argument {
  param([string]$Value)

  if ($null -eq $Value) {
    return '""'
  }

  $Escaped = $Value.Replace('"', '\"')
  if ($Escaped -match '[\s`"$&|<>]') {
    return '"' + $Escaped + '"'
  }

  return $Escaped
}

function Format-CommandLine {
  param(
    [string]$Executable,
    [string[]]$Arguments
  )

  $Parts = @("&", (Quote-Argument $Executable))
  foreach ($Argument in $Arguments) {
    $Parts += Quote-Argument $Argument
  }
  return $Parts -join " "
}

function Resolve-Template {
  param(
    [string]$Value,
    [hashtable]$Context,
    [hashtable]$ServiceUrls
  )

  $Result = $Value

  foreach ($Key in $Context.Keys) {
    $Result = $Result.Replace('${' + $Key + '}', [string]$Context[$Key])
  }

  $Result = [regex]::Replace($Result, '\$\{ENV:([^}]+)\}', {
    param($Match)
    $EnvName = $Match.Groups[1].Value
    $EnvValue = [Environment]::GetEnvironmentVariable($EnvName)
    if ([string]::IsNullOrWhiteSpace($EnvValue)) {
      return "<$EnvName>"
    }
    return $EnvValue
  })

  $Result = [regex]::Replace($Result, '\$\{SERVICE_URL:([^}]+)\}', {
    param($Match)
    $ServiceId = $Match.Groups[1].Value
    if ($ServiceUrls.ContainsKey($ServiceId)) {
      return [string]$ServiceUrls[$ServiceId]
    }
    return "<$ServiceId-url>"
  })

  return $Result
}

function Test-Unresolved {
  param([string]$Value)

  if ([string]::IsNullOrWhiteSpace($Value)) {
    return $false
  }

  return $Value.Contains("<") -or $Value.Contains('${')
}

function Convert-EnvObjectToPairs {
  param(
    $EnvObject,
    [hashtable]$Context,
    [hashtable]$ServiceUrls
  )

  $Pairs = @()
  if ($null -eq $EnvObject) {
    return $Pairs
  }

  foreach ($Property in $EnvObject.PSObject.Properties) {
    $ResolvedValue = Resolve-Template -Value ([string]$Property.Value) -Context $Context -ServiceUrls $ServiceUrls
    $Pairs += "$($Property.Name)=$ResolvedValue"
  }

  return $Pairs
}

function Build-DeployArguments {
  param(
    $Service,
    [hashtable]$Context,
    [hashtable]$ServiceUrls
  )

  $ServiceName = Resolve-Template -Value ([string]$Service.service_name) -Context $Context -ServiceUrls $ServiceUrls
  $ImageName = Resolve-Template -Value ([string]$Service.image_name) -Context $Context -ServiceUrls $ServiceUrls
  $ImageUri = "$($Context.REGION)-docker.pkg.dev/$($Context.PROJECT_ID)/$($Context.REPOSITORY)/$ImageName`:$($Context.IMAGE_TAG)"
  $ServiceAccount = Resolve-Template -Value ([string]$Service.service_account) -Context $Context -ServiceUrls $ServiceUrls
  $EnvPairs = Convert-EnvObjectToPairs -EnvObject $Service.env -Context $Context -ServiceUrls $ServiceUrls

  $Arguments = @(
    "run",
    "deploy",
    $ServiceName,
    "--project",
    $Context.PROJECT_ID,
    "--region",
    $Context.REGION,
    "--platform",
    "managed",
    "--image",
    $ImageUri,
    "--port",
    ([string]$Service.port),
    "--service-account",
    $ServiceAccount,
    "--cpu",
    ([string]$Service.cpu),
    "--memory",
    ([string]$Service.memory),
    "--min-instances",
    ([string]$Service.min_instances),
    "--max-instances",
    ([string]$Service.max_instances)
  )

  if ([bool]$Service.allow_unauthenticated) {
    $Arguments += "--allow-unauthenticated"
  } else {
    $Arguments += "--no-allow-unauthenticated"
  }

  if ([bool]$Service.cloud_sql) {
    $Arguments += @("--add-cloudsql-instances", $Context.CLOUD_SQL_CONNECTION_NAME)
  }

  if ($EnvPairs.Count -gt 0) {
    $Arguments += @("--set-env-vars", ($EnvPairs -join ","))
  }

  return [pscustomobject]@{
    Id = [string]$Service.id
    Group = [string]$Service.group
    ServiceName = $ServiceName
    ImageUri = $ImageUri
    HealthUrl = "<$($Service.id)-url>$($Service.health_path)"
    Arguments = $Arguments
    EnvPairs = $EnvPairs
  }
}

function Assert-ArtifactImageExists {
  param(
    [string]$ImageUri,
    [string]$ServiceId
  )

  $ImageDescribeArguments = [string[]]@(
    "artifacts",
    "docker",
    "images",
    "describe",
    $ImageUri,
    "--project",
    $ProjectId,
    "--format",
    "value(image_summary.fully_qualified_digest)"
  )

  $Result = Invoke-NativeCommand -FilePath $GcloudPath -Arguments $ImageDescribeArguments
  if ($Result.ExitCode -ne 0) {
    throw "No existe la imagen requerida para $ServiceId`: $ImageUri. Publique la imagen en Artifact Registry o use un -ImageTag existente. Detalle: $($Result.Output -join ' ')"
  }
}

$ConfigFullPath = if ([System.IO.Path]::IsPathRooted($ConfigPath)) { $ConfigPath } else { Join-Path $ProjectRoot $ConfigPath }
$Config = Read-JsonFile -Path $ConfigFullPath

$ProjectId = First-Value @($ProjectId, $env:GOOGLE_CLOUD_PROJECT, [string]$Config.default_project_id)
$Region = First-Value @($Region, $env:GOOGLE_CLOUD_REGION, [string]$Config.default_region)
$Repository = First-Value @($Repository, $env:ARTIFACT_REGISTRY_REPOSITORY, [string]$Config.default_repository)
$ImageTag = First-Value @($ImageTag, $env:IMAGE_TAG, $env:GITHUB_SHA, [string]$Config.default_image_tag)
$CloudSqlConnectionName = First-Value @($CloudSqlConnectionName, $env:CLOUD_SQL_CONNECTION_NAME, [string]$Config.default_cloud_sql_connection_name)
$GcloudPath = Initialize-GcloudPath -ConfiguredGcloud $GcloudPath
$ResolvedCloudSdkPython = Initialize-CloudSdkPython -ConfiguredPython $CloudSdkPython

if ([string]::IsNullOrWhiteSpace($ProjectId)) { throw "ProjectId es requerido." }
if ([string]::IsNullOrWhiteSpace($Region)) { throw "Region es requerida." }
if ([string]::IsNullOrWhiteSpace($Repository)) { throw "Repository es requerido." }
if ([string]::IsNullOrWhiteSpace($ImageTag)) { throw "ImageTag es requerido." }
if ([string]::IsNullOrWhiteSpace($CloudSqlConnectionName)) { throw "CloudSqlConnectionName es requerido." }

$Context = @{
  PROJECT_ID = $ProjectId
  REGION = $Region
  REPOSITORY = $Repository
  IMAGE_TAG = $ImageTag
  CLOUD_SQL_CONNECTION_NAME = $CloudSqlConnectionName
}

$Services = @($Config.services)
if ($BackendOnly -and $FrontendOnly) {
  throw "Usar BackendOnly o FrontendOnly, no ambos."
}
if ($BackendOnly) {
  $Services = $Services | Where-Object { $_.group -eq "backend" }
}
if ($FrontendOnly) {
  $Services = $Services | Where-Object { $_.group -eq "frontend" }
}

$ServiceUrls = @{}
$Deployments = New-Object System.Collections.Generic.List[object]
$Commands = New-Object System.Collections.Generic.List[string]

$OutputFullPath = if ([System.IO.Path]::IsPathRooted($OutputPath)) { $OutputPath } else { Join-Path $ProjectRoot $OutputPath }
$OutputDir = Split-Path -Parent $OutputFullPath
New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

foreach ($Service in $Services) {
  $SourcePath = Join-Path $ProjectRoot ([string]$Service.source_path)
  if (-not (Test-Path -LiteralPath $SourcePath)) {
    throw "No existe source_path para $($Service.id): $SourcePath"
  }

  $Deployment = Build-DeployArguments -Service $Service -Context $Context -ServiceUrls $ServiceUrls

  $Unresolved = @()
  foreach ($Argument in $Deployment.Arguments) {
    if (Test-Unresolved -Value $Argument) {
      $Unresolved += $Argument
    }
  }

  if ($Execute -and $Unresolved.Count -gt 0 -and -not $AllowUnresolved) {
    throw "El servicio $($Deployment.Id) tiene valores no resueltos. Ejecute en modo plan o defina las URLs necesarias: $($Unresolved -join '; ')"
  }

  $CommandLine = Format-CommandLine -Executable $GcloudPath -Arguments $Deployment.Arguments
  $Commands.Add($CommandLine) | Out-Null

  if ($Execute) {
    if (-not $SkipImageCheck) {
      Assert-ArtifactImageExists -ImageUri $Deployment.ImageUri -ServiceId $Deployment.Id
    }

    $DeploymentArguments = [string[]]@($Deployment.Arguments)
    $DeployResult = Invoke-NativeCommand -FilePath $GcloudPath -Arguments $DeploymentArguments
    if ($DeployResult.ExitCode -ne 0) {
      throw "Fallo gcloud run deploy para $($Deployment.Id). Detalle: $($DeployResult.Output -join ' ')"
    }

    $DescribeArguments = [string[]]@(
      "run",
      "services",
      "describe",
      $Deployment.ServiceName,
      "--project",
      $ProjectId,
      "--region",
      $Region,
      "--format",
      "value(status.url)"
    )
    $DescribeResult = Invoke-NativeCommand -FilePath $GcloudPath -Arguments $DescribeArguments
    $Url = ($DescribeResult.Output -join [Environment]::NewLine).Trim()
    if ($DescribeResult.ExitCode -eq 0 -and -not [string]::IsNullOrWhiteSpace($Url)) {
      $ServiceUrls[$Deployment.Id] = $Url
      $Deployment.HealthUrl = "$Url$($Service.health_path)"
    }
  }

  $Deployments.Add([pscustomobject]@{
    id = $Deployment.Id
    group = $Deployment.Group
    service_name = $Deployment.ServiceName
    image = $Deployment.ImageUri
    port = [int]$Service.port
    allow_unauthenticated = [bool]$Service.allow_unauthenticated
    cloud_sql = [bool]$Service.cloud_sql
    health_url = $Deployment.HealthUrl
    unresolved = $Unresolved
  }) | Out-Null
}

$Header = @(
  "# Generated by scripts\deploy-cloudrun-dev.ps1",
  "# Project: $ProjectId",
  "# Region: $Region",
  "# Image tag: $ImageTag",
  "# Execute manually after confirming images exist in Artifact Registry.",
  ""
)

($Header + $Commands) | Set-Content -LiteralPath $OutputFullPath -Encoding UTF8

$PlanPath = [System.IO.Path]::ChangeExtension($OutputFullPath, ".plan.json")
$Plan = [ordered]@{
  generated_at = (Get-Date).ToUniversalTime().ToString("o")
  execute = [bool]$Execute
  project_id = $ProjectId
  region = $Region
  repository = $Repository
  image_tag = $ImageTag
  cloud_sdk_python = $ResolvedCloudSdkPython
  cloud_sql_connection_name = $CloudSqlConnectionName
  command_file = $OutputFullPath
  services = $Deployments
}
$Plan | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $PlanPath -Encoding UTF8

Write-Host "Cloud Run dev plan generated."
Write-Host "Commands: $OutputFullPath"
Write-Host "Plan: $PlanPath"
$Deployments | Format-Table id,group,service_name,port,allow_unauthenticated,cloud_sql -AutoSize
