param(
  [string]$ConfigPath = "infra\cloudrun\dev-services.json",
  [string]$ProjectId = "",
  [string]$Region = "",
  [string]$Repository = "",
  [string[]]$ServiceIds = @(
    "identity-service",
    "dispatch-service",
    "ticketing-service",
    "document-service",
    "reporting-service",
    "audit-service"
  ),
  [string]$ImageTag = "0.1.1-jvm",
  [string]$DockerfilePath = "infra\docker\Dockerfile.quarkus-jvm",
  [string]$GcloudPath = $(if ($env:GCLOUD_PATH) { $env:GCLOUD_PATH } else { "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd" }),
  [switch]$UseCleanWorkspace,
  [switch]$SkipPackage,
  [switch]$SkipDockerBuild,
  [switch]$Push,
  [switch]$CreateRepository,
  [switch]$PlanOnly
)

$ErrorActionPreference = "Stop"

$Root = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
Set-Location $Root

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

function Normalize-ServiceIds {
  param([string[]]$Values)

  $Normalized = @(
    $Values |
      ForEach-Object { $_ -split "," } |
      ForEach-Object { $_.Trim() } |
      Where-Object { $_ }
  )

  if ($Normalized.Count -eq 0) {
    throw "ServiceIds no puede estar vacio."
  }

  return $Normalized
}

function Invoke-CommandChecked {
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

  $GcloudBinDir = Split-Path -Parent $GcloudPath
  if ($env:PATH -notlike "*$GcloudBinDir*") {
    $env:PATH = "$GcloudBinDir;$env:PATH"
  }

  Invoke-CommandChecked -Name "gcloud" -FilePath $GcloudPath -Arguments $Arguments | Out-Null
}

function Copy-ServiceToCleanWorkspace {
  param(
    [string]$ServiceRoot,
    [string]$ServiceId
  )

  $BuildWorkspace = Join-Path -Path ([System.IO.Path]::GetTempPath()) -ChildPath "venta-pasajes-$ServiceId-jvm-$PID"
  $EffectiveServiceRoot = Join-Path -Path $BuildWorkspace -ChildPath $ServiceId
  New-Item -ItemType Directory -Force -Path $EffectiveServiceRoot | Out-Null

  $ItemsToCopy = Get-ChildItem -LiteralPath $ServiceRoot -Force |
    Where-Object { $_.Name -notin @("target", ".git", ".idea", ".vscode") }

  foreach ($Item in $ItemsToCopy) {
    Copy-Item -LiteralPath $Item.FullName -Destination $EffectiveServiceRoot -Recurse -Force
  }

  return [pscustomobject]@{
    build_workspace = $BuildWorkspace
    effective_service_root = $EffectiveServiceRoot
  }
}

$Config = Read-JsonFile -Path $ConfigPath
$ProjectId = First-Value @($ProjectId, $env:GOOGLE_CLOUD_PROJECT, [string]$Config.default_project_id)
$Region = First-Value @($Region, $env:GOOGLE_CLOUD_REGION, [string]$Config.default_region)
$Repository = First-Value @($Repository, $env:ARTIFACT_REGISTRY_REPOSITORY, [string]$Config.default_repository)
$ResolvedDockerfilePath = if ([System.IO.Path]::IsPathRooted($DockerfilePath)) { $DockerfilePath } else { Join-Path $Root $DockerfilePath }
$ResolvedServiceIds = Normalize-ServiceIds -Values $ServiceIds

if ([string]::IsNullOrWhiteSpace($ProjectId)) { throw "ProjectId es requerido." }
if ([string]::IsNullOrWhiteSpace($Region)) { throw "Region es requerida." }
if ([string]::IsNullOrWhiteSpace($Repository)) { throw "Repository es requerido." }
if ([string]::IsNullOrWhiteSpace($ImageTag)) { throw "ImageTag es requerido." }
if (-not (Test-Path -LiteralPath $ResolvedDockerfilePath)) { throw "Dockerfile JVM no existe: $ResolvedDockerfilePath" }

$Backends = @($Config.services | Where-Object { $_.group -eq "backend" })
$Known = @($Backends | ForEach-Object { [string]$_.id })
$Unknown = @($ResolvedServiceIds | Where-Object { $Known -notcontains $_ })
if ($Unknown.Count -gt 0) {
  throw "ServiceIds backend no encontrados: $($Unknown -join ', ')"
}

$SelectedServices = @($Backends | Where-Object { $ResolvedServiceIds -contains [string]$_.id })
$Results = New-Object System.Collections.Generic.List[object]

if ($Push -and -not (Test-Path -LiteralPath $GcloudPath)) {
  throw "gcloud was not found at $GcloudPath."
}

if ($Push -and $CreateRepository) {
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

if ($Push) {
  Invoke-Gcloud -Arguments @("auth", "configure-docker", "$Region-docker.pkg.dev", "--quiet")
}

foreach ($Service in $SelectedServices) {
  $ServiceId = [string]$Service.id
  $SourcePath = [string]$Service.source_path
  $ImageName = [string]$Service.image_name
  $ServiceRoot = Join-Path -Path $Root -ChildPath $SourcePath
  $EffectiveServiceRoot = $ServiceRoot
  $BuildWorkspace = $null

  if (-not (Test-Path -LiteralPath $ServiceRoot)) {
    throw "No existe el directorio del servicio $ServiceId`: $ServiceRoot"
  }

  if ($UseCleanWorkspace) {
    $CopyResult = Copy-ServiceToCleanWorkspace -ServiceRoot $ServiceRoot -ServiceId $ServiceId
    $BuildWorkspace = $CopyResult.build_workspace
    $EffectiveServiceRoot = $CopyResult.effective_service_root
  }

  $PomPath = Join-Path -Path $EffectiveServiceRoot -ChildPath "pom.xml"
  $QuarkusRunJar = Join-Path -Path $EffectiveServiceRoot -ChildPath "target\quarkus-app\quarkus-run.jar"
  $QuarkusAppDir = Join-Path -Path $EffectiveServiceRoot -ChildPath "target\quarkus-app"
  $LocalImage = "${ImageName}:${ImageTag}"
  $ArtifactImage = "$Region-docker.pkg.dev/$ProjectId/$Repository/${ImageName}:${ImageTag}"
  $DockerContext = $null
  $Timings = New-Object System.Collections.Generic.List[object]

  if ($PlanOnly) {
    $Results.Add([pscustomobject]@{
      service_id = $ServiceId
      source_path = $SourcePath
      local_image = $LocalImage
      artifact_image = $ArtifactImage
      build_workspace = $BuildWorkspace
      plan_only = $true
    }) | Out-Null
    continue
  }

  if (-not $SkipPackage) {
    $Timings.Add((Invoke-CommandChecked -Name "$ServiceId-maven-package" -FilePath "mvn" -Arguments @(
      "-f",
      $PomPath,
      "package",
      "-DskipTests"
    )))
  }

  if (-not (Test-Path -LiteralPath $QuarkusRunJar)) {
    throw "No se encontro el artefacto JVM para $ServiceId`: $QuarkusRunJar. Ejecute package antes de construir la imagen."
  }

  if (-not $SkipDockerBuild) {
    $DockerContext = Join-Path -Path ([System.IO.Path]::GetTempPath()) -ChildPath "venta-pasajes-$ServiceId-jvm-docker-$PID"
    $DockerContextTarget = Join-Path -Path $DockerContext -ChildPath "target"
    $DockerContextQuarkusApp = Join-Path -Path $DockerContextTarget -ChildPath "quarkus-app"
    if (Test-Path -LiteralPath $DockerContext) {
      Remove-Item -LiteralPath $DockerContext -Recurse -Force
    }
    New-Item -ItemType Directory -Force -Path $DockerContextTarget | Out-Null
    Copy-Item -LiteralPath $QuarkusAppDir -Destination $DockerContextQuarkusApp -Recurse -Force

    $Timings.Add((Invoke-CommandChecked -Name "$ServiceId-docker-build" -FilePath "docker" -Arguments @(
      "build",
      "--pull",
      "-f",
      $ResolvedDockerfilePath,
      "-t",
      $LocalImage,
      $DockerContext
    )))

    Invoke-CommandChecked -Name "$ServiceId-docker-tag" -FilePath "docker" -Arguments @(
      "tag",
      $LocalImage,
      $ArtifactImage
    ) | Out-Null
  }

  if ($Push) {
    $Timings.Add((Invoke-CommandChecked -Name "$ServiceId-docker-push" -FilePath "docker" -Arguments @(
      "push",
      $ArtifactImage
    )))
  }

  $ImageInspect = $null
  if (-not $SkipDockerBuild) {
    $ImageJson = & docker image inspect $LocalImage
    if ($LASTEXITCODE -eq 0 -and $ImageJson) {
      $ImageInspect = $ImageJson | ConvertFrom-Json | Select-Object -First 1
    }
  }

  $Results.Add([pscustomobject]@{
    service_id = $ServiceId
    source_path = $SourcePath
    quarkus_run_jar = $QuarkusRunJar
    build_workspace = $BuildWorkspace
    docker_context = $DockerContext
    local_image = $LocalImage
    artifact_image = $ArtifactImage
    pushed = [bool]$Push
    timings = $Timings
    image_id = $(if ($ImageInspect) { $ImageInspect.Id } else { $null })
    image_size_bytes = $(if ($ImageInspect) { $ImageInspect.Size } else { $null })
    ready = $true
  }) | Out-Null
}

$LogDir = Join-Path $Root "logs\backend-jvm-images"
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
$PlanPath = Join-Path $LogDir "build-backend-jvm-images.plan.json"
$Results | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $PlanPath -Encoding UTF8

Write-Host "Backend JVM image plan generated."
Write-Host "Plan: $PlanPath"
$Results | Select-Object service_id, local_image, artifact_image, pushed, ready | Format-Table -AutoSize
