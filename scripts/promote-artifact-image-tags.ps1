param(
    [string]$ProjectId = $(if ($env:GOOGLE_CLOUD_PROJECT) { $env:GOOGLE_CLOUD_PROJECT } else { "project-fbb34cd7-0b82-43e1-867" }),
    [string]$Region = $(if ($env:GOOGLE_CLOUD_REGION) { $env:GOOGLE_CLOUD_REGION } else { "us-central1" }),
    [string]$Repository = $(if ($env:ARTIFACT_REGISTRY_REPOSITORY) { $env:ARTIFACT_REGISTRY_REPOSITORY } else { "venta-pasajes-dev" }),
    [string]$SourceTag = "0.1.0-native",
    [string]$TargetTag = "dev",
    [string[]]$ServiceIds = @("identity-service", "dispatch-service", "ticketing-service"),
    [string]$GcloudPath = $(if ($env:GCLOUD_PATH) { $env:GCLOUD_PATH } else { "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd" }),
    [string]$CloudSdkPython = $(if ($env:CLOUDSDK_PYTHON) { $env:CLOUDSDK_PYTHON } else { "" }),
    [string]$OutputDir = "logs\artifact-registry",
    [switch]$Execute,
    [switch]$AllowMissing
)

$ErrorActionPreference = "Stop"

$Root = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$ResolvedOutputDir = Join-Path -Path $Root -ChildPath $OutputDir
$CommandsPath = Join-Path -Path $ResolvedOutputDir -ChildPath "promote-artifact-image-tags.commands.ps1"
$PlanPath = Join-Path -Path $ResolvedOutputDir -ChildPath "promote-artifact-image-tags.plan.json"

function Resolve-GcloudPath {
    param([string]$Candidate)

    if ($Candidate -and (Test-Path -LiteralPath $Candidate)) {
        return (Resolve-Path -LiteralPath $Candidate).Path
    }

    $KnownPath = "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd"
    if (Test-Path -LiteralPath $KnownPath) {
        return $KnownPath
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

function Initialize-CloudSdkPython {
    param([string]$Candidate)

    if ($Candidate) {
        if (-not (Test-Path -LiteralPath $Candidate)) {
            throw "CloudSdkPython no existe: $Candidate"
        }

        $env:CLOUDSDK_PYTHON = (Resolve-Path -LiteralPath $Candidate).Path
        return
    }

    if (-not $env:CLOUDSDK_PYTHON -and (Test-Path -LiteralPath "C:\Python312\python.exe")) {
        $env:CLOUDSDK_PYTHON = "C:\Python312\python.exe"
    }
}

function Normalize-ServiceIds {
    param([string[]]$Values)

    $Normalized = New-Object System.Collections.Generic.List[string]
    foreach ($Value in $Values) {
        if ([string]::IsNullOrWhiteSpace($Value)) {
            continue
        }

        foreach ($Item in ($Value -split ",")) {
            $Trimmed = $Item.Trim()
            if ($Trimmed) {
                $Normalized.Add($Trimmed)
            }
        }
    }

    if ($Normalized.Count -eq 0) {
        throw "ServiceIds no puede estar vacio."
    }

    return $Normalized.ToArray()
}

function Invoke-GcloudCapture {
    param(
        [string[]]$Arguments,
        [switch]$AllowFailure
    )

    $PreviousErrorActionPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    $Output = & $script:ResolvedGcloudPath @Arguments 2>&1
    $ExitCode = $LASTEXITCODE
    $ErrorActionPreference = $PreviousErrorActionPreference

    $Text = ($Output | ForEach-Object { $_.ToString() }) -join [Environment]::NewLine

    if ($ExitCode -ne 0 -and -not $AllowFailure) {
        throw "gcloud fallo con codigo ${ExitCode}: $($Arguments -join ' '). Detalle: $Text"
    }

    [pscustomobject]@{
        exit_code = $ExitCode
        output = $Text
    }
}

function Get-ArtifactImageUri {
    param(
        [string]$ServiceId,
        [string]$Tag
    )

    return "$Region-docker.pkg.dev/$ProjectId/$Repository/${ServiceId}:$Tag"
}

function Test-ArtifactImage {
    param([string]$ImageUri)

    $Result = Invoke-GcloudCapture -Arguments @(
        "artifacts",
        "docker",
        "images",
        "describe",
        $ImageUri,
        "--project",
        $ProjectId,
        "--format=json"
    ) -AllowFailure

    if ($Result.exit_code -ne 0) {
        return [pscustomobject]@{
            exists = $false
            digest = $null
            detail = $Result.output
        }
    }

    $Digest = $null
    if ($Result.output) {
        try {
            $Parsed = $Result.output | ConvertFrom-Json
            $Digest = $Parsed.image_summary.digest
        } catch {
            $Digest = $null
        }
    }

    [pscustomobject]@{
        exists = $true
        digest = $Digest
        detail = ""
    }
}

New-Item -ItemType Directory -Force -Path $ResolvedOutputDir | Out-Null
$script:ResolvedGcloudPath = Resolve-GcloudPath -Candidate $GcloudPath
Initialize-CloudSdkPython -Candidate $CloudSdkPython
$ResolvedServiceIds = Normalize-ServiceIds -Values $ServiceIds

$Rows = New-Object System.Collections.Generic.List[object]

foreach ($ServiceId in $ResolvedServiceIds) {
    $SourceImage = Get-ArtifactImageUri -ServiceId $ServiceId -Tag $SourceTag
    $TargetImage = Get-ArtifactImageUri -ServiceId $ServiceId -Tag $TargetTag
    $SourceCheck = Test-ArtifactImage -ImageUri $SourceImage
    $TargetCheck = Test-ArtifactImage -ImageUri $TargetImage

    $Action = if ($SourceCheck.exists -and $Execute) {
        "tagged"
    } elseif ($SourceCheck.exists) {
        "planned"
    } else {
        "missing-source"
    }

    $Rows.Add([pscustomobject]@{
        service_id = $ServiceId
        source_image = $SourceImage
        source_exists = [bool]$SourceCheck.exists
        source_digest = $SourceCheck.digest
        target_image = $TargetImage
        target_exists_before = [bool]$TargetCheck.exists
        action = $Action
        target_exists_after = $null
    })
}

$MissingSources = @($Rows | Where-Object { -not $_.source_exists })
if ($MissingSources.Count -gt 0 -and -not $AllowMissing) {
    $MissingNames = ($MissingSources | Select-Object -ExpandProperty service_id) -join ", "
    throw "Faltan imagenes origen con tag ${SourceTag}: $MissingNames. Use -AllowMissing solo para generar un plan parcial."
}

$CommandLines = New-Object System.Collections.Generic.List[string]
$CommandLines.Add("# Generated by scripts\promote-artifact-image-tags.ps1")
$CommandLines.Add("# Source tag: $SourceTag")
$CommandLines.Add("# Target tag: $TargetTag")
$CommandLines.Add('$env:CLOUDSDK_PYTHON = "' + $env:CLOUDSDK_PYTHON + '"')
$CommandLines.Add('$GcloudPath = "' + $script:ResolvedGcloudPath + '"')
$CommandLines.Add("")

foreach ($Row in $Rows) {
    if (-not $Row.source_exists) {
        $CommandLines.Add("# Missing source image for $($Row.service_id): $($Row.source_image)")
        continue
    }

    $CommandLines.Add('& $GcloudPath artifacts docker tags add "' + $Row.source_image + '" "' + $Row.target_image + '" --project "' + $ProjectId + '" --quiet')
}

$CommandLines | Set-Content -LiteralPath $CommandsPath -Encoding UTF8

if ($Execute) {
    foreach ($Row in $Rows) {
        if (-not $Row.source_exists) {
            continue
        }

        Invoke-GcloudCapture -Arguments @(
            "artifacts",
            "docker",
            "tags",
            "add",
            $Row.source_image,
            $Row.target_image,
            "--project",
            $ProjectId,
            "--quiet"
        ) | Out-Null

        $AfterCheck = Test-ArtifactImage -ImageUri $Row.target_image
        $Row.target_exists_after = [bool]$AfterCheck.exists
    }
}

$Plan = [pscustomobject]@{
    generated_at = (Get-Date).ToString("s")
    project_id = $ProjectId
    region = $Region
    repository = $Repository
    source_tag = $SourceTag
    target_tag = $TargetTag
    execute = [bool]$Execute
    commands_path = $CommandsPath
    services = $Rows
}

$Plan | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $PlanPath -Encoding UTF8

Write-Host "Artifact Registry tag promotion plan generated."
Write-Host "Commands: $CommandsPath"
Write-Host "Plan: $PlanPath"

$Rows |
    Select-Object service_id, source_exists, target_exists_before, target_exists_after, action |
    Format-Table -AutoSize
