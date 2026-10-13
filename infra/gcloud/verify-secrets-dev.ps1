param(
    [string]$ProjectId = $env:GOOGLE_CLOUD_PROJECT,
    [string]$ConfigPath = $(Join-Path $PSScriptRoot "secrets-dev.json"),
    [string]$GcloudPath = $env:GCLOUD_PATH
)

$ErrorActionPreference = "Stop"

function Resolve-GcloudCommand {
    param([string]$PreferredPath)

    if ($PreferredPath -and (Test-Path -LiteralPath $PreferredPath)) {
        return (Resolve-Path -LiteralPath $PreferredPath).Path
    }

    $PathCommand = Get-Command "gcloud" -ErrorAction SilentlyContinue
    if ($PathCommand) {
        return $PathCommand.Source
    }

    $Candidates = @(
        "$env:ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd",
        "$env:ProgramFiles\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd",
        "${env:ProgramFiles(x86)}\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd",
        "$env:LOCALAPPDATA\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd"
    )

    foreach ($Candidate in $Candidates) {
        if ($Candidate -and (Test-Path -LiteralPath $Candidate)) {
            return (Resolve-Path -LiteralPath $Candidate).Path
        }
    }

    throw "gcloud was not found. Install Google Cloud CLI, then run gcloud init."
}

function Resolve-GcloudPython {
    $Candidates = @(
        "C:\Python313\python.exe",
        "C:\Python312\python.exe",
        "C:\Python311\python.exe",
        "C:\Python310\python.exe",
        "C:\Python39\python.exe",
        "C:\Python314\python.exe"
    )

    foreach ($Candidate in $Candidates) {
        if (Test-Path -LiteralPath $Candidate) {
            return (Resolve-Path -LiteralPath $Candidate).Path
        }
    }

    $PyLauncher = Get-Command "py" -ErrorAction SilentlyContinue
    if ($PyLauncher) {
        foreach ($Version in @("-3.13", "-3.12", "-3.11", "-3.10", "-3.9", "-3.14")) {
            $Executable = & py $Version -c "import sys; print(sys.executable)" 2>$null
            if ($LASTEXITCODE -eq 0 -and $Executable -and (Test-Path -LiteralPath $Executable.Trim())) {
                return $Executable.Trim()
            }
        }
    }

    return $null
}

function Set-GcloudPython {
    if ($env:CLOUDSDK_PYTHON) {
        return
    }

    $PythonCommand = Resolve-GcloudPython
    if ($PythonCommand) {
        $env:CLOUDSDK_PYTHON = $PythonCommand
    }
}

function Test-PolicyBinding {
    param(
        [object]$Policy,
        [string]$Role,
        [string]$Member
    )

    foreach ($Binding in @($Policy.bindings)) {
        if ($Binding.role -eq $Role -and @($Binding.members) -contains $Member) {
            return $true
        }
    }

    return $false
}

function Get-LocalSecretFindings {
    $Findings = @()
    $NotesPath = Join-Path (Get-Location) "NOTAS.txt"

    if (Test-Path -LiteralPath $NotesPath) {
        $Content = Get-Content -LiteralPath $NotesPath -Raw

        if ($Content -match "ya29\.[A-Za-z0-9._-]+") {
            $Findings += [pscustomobject]@{
                file = $NotesPath
                type = "gcloud_access_token"
            }
        }

        if ($Content -match "PONER PASSWORD[^\r\n]*\([^)]{3,}\)") {
            $Findings += [pscustomobject]@{
                file = $NotesPath
                type = "postgres_password_note"
            }
        }
    }

    return $Findings
}

$GcloudCommand = Resolve-GcloudCommand -PreferredPath $GcloudPath
Set-GcloudPython

if (!(Test-Path -LiteralPath $ConfigPath)) {
    throw "Secret Manager config was not found: $ConfigPath"
}

$Config = Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json

if (-not $ProjectId) {
    $ProjectId = (& $GcloudCommand config get-value project 2>$null).Trim()
}

if (-not $ProjectId -or $ProjectId -eq "(unset)") {
    $ProjectId = $Config.project_id
}

if (-not $ProjectId) {
    throw "ProjectId is required. Set GOOGLE_CLOUD_PROJECT, pass -ProjectId, or configure gcloud project."
}

$MissingSecrets = @()
$SecretsWithoutEnabledVersion = @()
$MissingAccessorBindings = @()
$FoundSecrets = @()

foreach ($Secret in @($Config.secrets)) {
    $PreviousErrorActionPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    & $GcloudCommand secrets describe $Secret.id "--project=$ProjectId" "--format=value(name)" 1>$null 2>$null
    $DescribeExitCode = $LASTEXITCODE
    $ErrorActionPreference = $PreviousErrorActionPreference

    if ($DescribeExitCode -ne 0) {
        $MissingSecrets += $Secret.id
        continue
    }

    $FoundSecrets += $Secret.id

    $Versions = @(& $GcloudCommand secrets versions list $Secret.id "--project=$ProjectId" "--filter=state=enabled" "--format=value(name)")
    if ($LASTEXITCODE -ne 0 -or @($Versions | Where-Object { $_ -and $_.Trim() }).Count -eq 0) {
        $SecretsWithoutEnabledVersion += $Secret.id
    }

    $PolicyJson = & $GcloudCommand secrets get-iam-policy $Secret.id "--project=$ProjectId" "--format=json"
    if ($LASTEXITCODE -ne 0) {
        foreach ($Accessor in @($Secret.accessors)) {
            $MissingAccessorBindings += [pscustomobject]@{
                secret = $Secret.id
                member = "serviceAccount:$Accessor"
                role = "roles/secretmanager.secretAccessor"
                reason = "could_not_read_secret_policy"
            }
        }
        continue
    }

    $Policy = $PolicyJson | ConvertFrom-Json
    foreach ($Accessor in @($Secret.accessors)) {
        $Member = "serviceAccount:$Accessor"
        if (-not (Test-PolicyBinding -Policy $Policy -Role "roles/secretmanager.secretAccessor" -Member $Member)) {
            $MissingAccessorBindings += [pscustomobject]@{
                secret = $Secret.id
                member = $Member
                role = "roles/secretmanager.secretAccessor"
                reason = "binding_not_found"
            }
        }
    }
}

$LocalSecretFindings = Get-LocalSecretFindings

[pscustomobject]@{
    project_id = $ProjectId
    config_path = $ConfigPath
    secrets_expected = @($Config.secrets).Count
    secrets_found = @($FoundSecrets).Count
    missing_secrets = $MissingSecrets
    secrets_without_enabled_version = $SecretsWithoutEnabledVersion
    missing_accessor_bindings = $MissingAccessorBindings
    local_secret_findings = $LocalSecretFindings
    ready = (
        @($MissingSecrets).Count -eq 0 -and
        @($SecretsWithoutEnabledVersion).Count -eq 0 -and
        @($MissingAccessorBindings).Count -eq 0 -and
        @($LocalSecretFindings).Count -eq 0
    )
} | ConvertTo-Json -Depth 8 -Compress
