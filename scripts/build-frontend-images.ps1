param(
  [string[]]$Apps = @(
    "frontend-shell",
    "mfe-identity",
    "mfe-dispatch",
    "mfe-ticketing",
    "mfe-reporting",
    "mfe-admin"
  ),
  [string]$ImageTag = "0.1.0-frontend",
  [string]$ConfigPath = "infra\cloudrun\dev-services.json",
  [string]$ProjectId = "",
  [string]$Region = "",
  [string]$Repository = "",
  [string]$GcloudPath = $(if ($env:GCLOUD_PATH) { $env:GCLOUD_PATH } else { "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd" }),
  [switch]$SkipNextBuild,
  [switch]$SkipSharedTypesBuild,
  [switch]$SkipDockerBuild,
  [switch]$Push,
  [switch]$CreateRepository,
  [switch]$PlanOnly
)

$ErrorActionPreference = "Stop"

$ProjectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
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

function Invoke-NativeCommand {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][string]$FilePath,
    [Parameter(Mandatory = $true)][string[]]$Arguments
  )

  $Stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
  $PreviousErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  & $FilePath @Arguments | ForEach-Object { Write-Host $_ }
  $ExitCode = $LASTEXITCODE
  $ErrorActionPreference = $PreviousErrorActionPreference
  $Stopwatch.Stop()

  if ($ExitCode -ne 0) {
    throw "$Name failed with exit code $ExitCode."
  }

  return [pscustomobject]@{
    name = $Name
    elapsed_ms = $Stopwatch.ElapsedMilliseconds
  }
}

function Invoke-Gcloud {
  param([string[]]$Arguments)

  if (-not (Test-Path -LiteralPath $GcloudPath)) {
    throw "gcloud was not found at $GcloudPath."
  }

  if (-not $env:CLOUDSDK_PYTHON -and (Test-Path -LiteralPath "C:\Python312\python.exe")) {
    $env:CLOUDSDK_PYTHON = "C:\Python312\python.exe"
  }

  $PreviousErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  & $GcloudPath @Arguments | ForEach-Object { Write-Host $_ }
  $ExitCode = $LASTEXITCODE
  $ErrorActionPreference = $PreviousErrorActionPreference

  if ($ExitCode -ne 0) {
    throw "gcloud failed with exit code ${ExitCode}: $($Arguments -join ' ')"
  }
}

function Assert-DockerAvailable {
  $PreviousErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  & docker info > $null 2> $null
  $DockerExitCode = $LASTEXITCODE
  $ErrorActionPreference = $PreviousErrorActionPreference

  if ($DockerExitCode -ne 0) {
    throw "Docker Desktop no esta corriendo o no responde. Abra Docker Desktop y espere a que indique Running antes de ejecutar este script."
  }
}

function Assert-Path {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][string]$Message
  )

  if (-not (Test-Path -LiteralPath $Path)) {
    throw $Message
  }
}

$ConfigFullPath = if ([System.IO.Path]::IsPathRooted($ConfigPath)) { $ConfigPath } else { Join-Path $ProjectRoot $ConfigPath }
$Config = Read-JsonFile -Path $ConfigFullPath

$ProjectId = First-Value @($ProjectId, $env:GOOGLE_CLOUD_PROJECT, [string]$Config.default_project_id)
$Region = First-Value @($Region, $env:GOOGLE_CLOUD_REGION, [string]$Config.default_region)
$Repository = First-Value @($Repository, $env:ARTIFACT_REGISTRY_REPOSITORY, [string]$Config.default_repository)

if ([string]::IsNullOrWhiteSpace($ProjectId)) { throw "ProjectId es requerido." }
if ([string]::IsNullOrWhiteSpace($Region)) { throw "Region es requerida." }
if ([string]::IsNullOrWhiteSpace($Repository)) { throw "Repository es requerido." }
if ([string]::IsNullOrWhiteSpace($ImageTag)) { throw "ImageTag es requerido." }

$DockerfilePath = Join-Path $ProjectRoot "infra\docker\Dockerfile.next-standalone"
$ArtifactScriptPath = Join-Path $ProjectRoot "scripts\build-frontend-artifacts.ps1"
$ArtifactVersionRoot = Join-Path $ProjectRoot (Join-Path "artifacts\frontend" $ImageTag)
$LogRoot = Join-Path $ProjectRoot "logs\frontend-images"
$SummaryPath = Join-Path $LogRoot "build-frontend-images.$ImageTag.json"

Assert-Path -Path $DockerfilePath -Message "No existe Dockerfile frontend: $DockerfilePath"
Assert-Path -Path $ArtifactScriptPath -Message "No existe script de artefactos frontend: $ArtifactScriptPath"

$FrontendServices = @($Config.services | Where-Object { $_.group -eq "frontend" })
$ServiceById = @{}
foreach ($Service in $FrontendServices) {
  $ServiceById[[string]$Service.id] = $Service
}

$RequestedApps = @($Apps | ForEach-Object { $_ -split "," } | ForEach-Object { $_.Trim() } | Where-Object { $_ })
$UnknownApps = @($RequestedApps | Where-Object { -not $ServiceById.ContainsKey($_) })
if ($UnknownApps.Count -gt 0) {
  throw "Apps frontend no soportadas por $ConfigPath`: $($UnknownApps -join ', ')"
}

$PlanItems = @()
foreach ($App in $RequestedApps) {
  $Service = $ServiceById[$App]
  $ImageName = [string]$Service.image_name
  $Port = [int]$Service.port
  $StageRoot = Join-Path $ArtifactVersionRoot $App
  $ServerPath = Join-Path $StageRoot (Join-Path "standalone" (Join-Path "apps\$App" "server.js"))
  $LocalImage = "${ImageName}:${ImageTag}"
  $ArtifactImage = "$Region-docker.pkg.dev/$ProjectId/$Repository/${ImageName}:${ImageTag}"

  $PlanItems += [pscustomobject]@{
    app = $App
    service_name = [string]$Service.service_name
    image_name = $ImageName
    port = $Port
    local_image = $LocalImage
    artifact_image = $ArtifactImage
    stage_root = $StageRoot
    stage_exists = Test-Path -LiteralPath $StageRoot
    server_exists = Test-Path -LiteralPath $ServerPath
  }
}

if ($PlanOnly) {
  [pscustomobject]@{
    mode = "plan"
    dockerfile = $DockerfilePath
    artifact_script = $ArtifactScriptPath
    image_tag = $ImageTag
    project_id = $ProjectId
    region = $Region
    repository = $Repository
    skip_next_build = [bool]$SkipNextBuild
    skip_docker_build = [bool]$SkipDockerBuild
    push = [bool]$Push
    apps = $PlanItems
    ready = $true
  } | ConvertTo-Json -Depth 6 -Compress
  return
}

if (-not $SkipDockerBuild -or $Push) {
  Assert-DockerAvailable
}

if (-not $SkipNextBuild) {
  if ($SkipSharedTypesBuild) {
    & $ArtifactScriptPath -Apps $RequestedApps -Version $ImageTag -SkipSharedTypesBuild
  } else {
    & $ArtifactScriptPath -Apps $RequestedApps -Version $ImageTag
  }
  if ($LASTEXITCODE -ne 0) {
    throw "build-frontend-artifacts.ps1 fallo con codigo $LASTEXITCODE."
  }
}

if ($Push) {
  $GcloudBinDir = Split-Path -Parent $GcloudPath
  if ($env:PATH -notlike "*$GcloudBinDir*") {
    $env:PATH = "$GcloudBinDir;$env:PATH"
  }

  if ($CreateRepository) {
    $PreviousErrorActionPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    & $GcloudPath @(
      "artifacts",
      "repositories",
      "describe",
      $Repository,
      "--project=$ProjectId",
      "--location=$Region",
      "--format=value(name)"
    ) > $null 2> $null
    $DescribeExitCode = $LASTEXITCODE
    $ErrorActionPreference = $PreviousErrorActionPreference

    if ($DescribeExitCode -ne 0) {
      Invoke-Gcloud -Arguments @(
        "artifacts",
        "repositories",
        "create",
        $Repository,
        "--project=$ProjectId",
        "--location=$Region",
        "--repository-format=docker",
        "--description=Venta de Pasajes development Docker images"
      )
    }
  }

  Invoke-Gcloud -Arguments @(
    "auth",
    "configure-docker",
    "$Region-docker.pkg.dev",
    "--quiet"
  )
}

New-Item -ItemType Directory -Force -Path $LogRoot | Out-Null
$Results = New-Object System.Collections.Generic.List[object]

foreach ($PlanItem in $PlanItems) {
  $App = $PlanItem.app
  $StageRoot = $PlanItem.stage_root
  $ServerPath = Join-Path $StageRoot (Join-Path "standalone" (Join-Path "apps\$App" "server.js"))
  $ManifestPath = Join-Path $StageRoot "artifact-manifest.json"

  Assert-Path -Path $StageRoot -Message "No existe el artefacto preparado para $App`: $StageRoot. Ejecute sin -SkipNextBuild primero."
  Assert-Path -Path $ServerPath -Message "No existe server.js standalone para $App`: $ServerPath"
  Assert-Path -Path $ManifestPath -Message "No existe artifact-manifest.json para $App`: $ManifestPath"

  $Timings = New-Object System.Collections.Generic.List[object]

  if (-not $SkipDockerBuild) {
    $DockerArgs = @(
      "build",
      "--pull",
      "-f",
      $DockerfilePath,
      "--build-arg",
      "APP=$App",
      "--build-arg",
      "PORT=$($PlanItem.port)",
      "-t",
      $PlanItem.local_image,
      "-t",
      $PlanItem.artifact_image,
      $StageRoot
    )

    $Timings.Add((Invoke-NativeCommand -Name "docker-build-$App" -FilePath "docker" -Arguments $DockerArgs)) | Out-Null
  }

  if ($Push) {
    if ($SkipDockerBuild) {
      $ArtifactImageExists = $false
      & docker image inspect $PlanItem.artifact_image > $null 2> $null
      $ArtifactImageExists = $LASTEXITCODE -eq 0
      if (-not $ArtifactImageExists) {
        & docker image inspect $PlanItem.local_image > $null 2> $null
        if ($LASTEXITCODE -ne 0) {
          throw "No existe imagen local para publicar $($PlanItem.artifact_image). Ejecute sin -SkipDockerBuild primero."
        }

        & docker tag $PlanItem.local_image $PlanItem.artifact_image
        if ($LASTEXITCODE -ne 0) {
          throw "docker tag fallo para $($PlanItem.artifact_image)."
        }
      }
    }

    $Timings.Add((Invoke-NativeCommand -Name "docker-push-$App" -FilePath "docker" -Arguments @("push", $PlanItem.artifact_image))) | Out-Null
  }

  $ImageInspect = $null
  & docker image inspect $PlanItem.local_image > $null 2> $null
  if ($LASTEXITCODE -eq 0) {
    $ImageJson = & docker image inspect $PlanItem.local_image
    $ImageInspect = $ImageJson | ConvertFrom-Json | Select-Object -First 1
  }

  $Results.Add([pscustomobject]@{
    app = $App
    local_image = $PlanItem.local_image
    artifact_image = $PlanItem.artifact_image
    port = $PlanItem.port
    stage_root = $StageRoot
    pushed = [bool]$Push
    image_id = $(if ($ImageInspect) { $ImageInspect.Id } else { $null })
    image_size_bytes = $(if ($ImageInspect) { $ImageInspect.Size } else { $null })
    timings = $Timings
  }) | Out-Null
}

$Summary = [ordered]@{
  generated_at = (Get-Date).ToUniversalTime().ToString("o")
  image_tag = $ImageTag
  project_id = $ProjectId
  region = $Region
  repository = $Repository
  dockerfile = $DockerfilePath
  pushed = [bool]$Push
  apps = $Results
  ready = $true
}

$Summary | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $SummaryPath -Encoding UTF8

Write-Host "Frontend images generated:"
$Results | Format-Table app,local_image,artifact_image,port,pushed,image_size_bytes -AutoSize
Write-Host "Summary: $SummaryPath"

$Summary | ConvertTo-Json -Depth 8 -Compress
