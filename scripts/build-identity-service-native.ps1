param(
    [string]$ProjectId = $(if ($env:GOOGLE_CLOUD_PROJECT) { $env:GOOGLE_CLOUD_PROJECT } else { "project-fbb34cd7-0b82-43e1-867" }),
    [string]$Region = $(if ($env:GOOGLE_CLOUD_REGION) { $env:GOOGLE_CLOUD_REGION } else { "us-central1" }),
    [string]$Repository = $(if ($env:ARTIFACT_REGISTRY_REPOSITORY) { $env:ARTIFACT_REGISTRY_REPOSITORY } else { "venta-pasajes-dev" }),
    [string]$ImageName = "identity-service",
    [string]$ImageTag = "0.1.0-native",
    [string]$BuilderImage = "quay.io/quarkus/ubi9-quarkus-mandrel-builder-image:jdk-21",
    [string]$GcloudPath = $(if ($env:GCLOUD_PATH) { $env:GCLOUD_PATH } else { "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd" }),
    [switch]$UseCleanWorkspace,
    [switch]$SkipNativeBuild,
    [switch]$SkipDockerBuild,
    [switch]$Push,
    [switch]$CreateRepository
)

$ErrorActionPreference = "Stop"

$Root = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$ServiceRoot = Join-Path -Path $Root -ChildPath "services\identity-service"
$BuildWorkspace = $null
$EffectiveServiceRoot = $ServiceRoot

if ($UseCleanWorkspace) {
    $BuildWorkspace = Join-Path -Path ([System.IO.Path]::GetTempPath()) -ChildPath "venta-pasajes-identity-native-$PID"
    $EffectiveServiceRoot = Join-Path -Path $BuildWorkspace -ChildPath "identity-service"
    New-Item -ItemType Directory -Force -Path $EffectiveServiceRoot | Out-Null

    $ItemsToCopy = Get-ChildItem -LiteralPath $ServiceRoot -Force |
        Where-Object { $_.Name -notin @("target", ".git", ".idea", ".vscode") }

    foreach ($Item in $ItemsToCopy) {
        Copy-Item -LiteralPath $Item.FullName -Destination $EffectiveServiceRoot -Recurse -Force
    }
}

$PomPath = Join-Path -Path $EffectiveServiceRoot -ChildPath "pom.xml"
$DockerfilePath = Join-Path -Path $EffectiveServiceRoot -ChildPath "src\main\docker\Dockerfile.native"
$TargetDir = Join-Path -Path $EffectiveServiceRoot -ChildPath "target"
$LocalImage = "${ImageName}:${ImageTag}"
$ArtifactImage = "$Region-docker.pkg.dev/$ProjectId/$Repository/${ImageName}:${ImageTag}"

function Invoke-NativeCommand {
    param(
        [string]$Name,
        [string]$FilePath,
        [string[]]$Arguments
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

if (-not (Test-Path -LiteralPath $PomPath)) {
    throw "identity-service pom.xml was not found: $PomPath"
}

if (-not (Test-Path -LiteralPath $DockerfilePath)) {
    throw "Native Dockerfile was not found: $DockerfilePath"
}

$Timings = New-Object System.Collections.Generic.List[object]

if (-not $SkipNativeBuild) {
    $NativeArgs = @(
        "-f",
        $PomPath,
        "package",
        "-Dnative",
        "-DskipTests",
        "-Dquarkus.native.container-build=true",
        "-Dquarkus.native.builder-image=$BuilderImage"
    )

    $Timings.Add((Invoke-NativeCommand -Name "maven-native-build" -FilePath "mvn" -Arguments $NativeArgs))
}

$NativeRunner = Get-ChildItem -LiteralPath $TargetDir -File -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -like "*-runner" -and $_.Name -notlike "*.jar" } |
    Sort-Object -Property LastWriteTimeUtc -Descending |
    Select-Object -First 1

if ($null -eq $NativeRunner) {
    throw "Native runner was not found under $TargetDir. Run the native build first."
}

if (-not $SkipDockerBuild) {
    $DockerBuildArgs = @(
        "build",
        "--pull",
        "-f",
        $DockerfilePath,
        "-t",
        $LocalImage,
        $EffectiveServiceRoot
    )

    $Timings.Add((Invoke-NativeCommand -Name "docker-build" -FilePath "docker" -Arguments $DockerBuildArgs))

    & docker tag $LocalImage $ArtifactImage
    if ($LASTEXITCODE -ne 0) {
        throw "docker tag failed for $ArtifactImage."
    }
}

if ($Push) {
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

    if ($CreateRepository) {
        $DescribeArgs = @(
            "artifacts",
            "repositories",
            "describe",
            $Repository,
            "--project=$ProjectId",
            "--location=$Region",
            "--format=value(name)"
        )

        $PreviousErrorActionPreference = $ErrorActionPreference
        $ErrorActionPreference = "Continue"
        & $GcloudPath @DescribeArgs > $null 2> $null
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

    $Timings.Add((Invoke-NativeCommand -Name "docker-push" -FilePath "docker" -Arguments @("push", $ArtifactImage)))
}

$ImageInspect = $null
if (-not $SkipDockerBuild) {
    $ImageJson = & docker image inspect $LocalImage
    if ($LASTEXITCODE -eq 0 -and $ImageJson) {
        $ImageInspect = $ImageJson | ConvertFrom-Json | Select-Object -First 1
    }
}

[pscustomobject]@{
    service = "identity-service"
    native_runner = $NativeRunner.FullName
    native_runner_bytes = $NativeRunner.Length
    build_workspace = $BuildWorkspace
    local_image = $LocalImage
    artifact_image = $ArtifactImage
    pushed = [bool]$Push
    timings = $Timings
    image_id = $(if ($ImageInspect) { $ImageInspect.Id } else { $null })
    image_size_bytes = $(if ($ImageInspect) { $ImageInspect.Size } else { $null })
    ready = $true
} | ConvertTo-Json -Depth 6 -Compress
