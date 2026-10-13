param(
    [string]$ProjectId = $env:GOOGLE_CLOUD_PROJECT,
    [string]$ConfigPath = $(Join-Path $PSScriptRoot "secrets-dev.json"),
    [string]$GcloudPath = $env:GCLOUD_PATH,
    [switch]$DryRun
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

function Invoke-Gcloud {
    param(
        [string[]]$Arguments,
        [string]$DisplayCommand
    )

    $CommandLine = "gcloud " + ($Arguments -join " ")
    $Display = if ($DisplayCommand) { $DisplayCommand } else { $Arguments -join " " }
    $RecordedCommand = if ($Display -like "gcloud *") { $Display } else { "gcloud $Display" }
    $script:ExecutedGcloudCommands += $RecordedCommand

    if ($DryRun) {
        Write-Host "[dry-run] $RecordedCommand"
        return
    }

    Write-Host "[gcloud] $Display"
    & $script:GcloudCommand @Arguments | Out-Null

    if ($LASTEXITCODE -ne 0) {
        throw "gcloud failed: $CommandLine"
    }
}

function Test-GcloudCommand {
    param([string[]]$Arguments)

    if ($DryRun) {
        return $false
    }

    $PreviousErrorActionPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    & $script:GcloudCommand @Arguments 1>$null 2>$null
    $ExitCode = $LASTEXITCODE
    $ErrorActionPreference = $PreviousErrorActionPreference

    return $ExitCode -eq 0
}

function ConvertTo-SecretLabelValue {
    param([string]$Value)

    $Normalized = $Value.ToLowerInvariant() -replace "[^a-z0-9_-]", "-"
    $Normalized = $Normalized.Trim("-_")
    if ($Normalized.Length -gt 63) {
        return $Normalized.Substring(0, 63).Trim("-_")
    }

    return $Normalized
}

function Get-LabelsArgument {
    param([object]$Config, [object]$Secret)

    $Pairs = [ordered]@{
        app = "venta-pasajes"
        env = $Config.environment
        category = $Secret.category
        owner = $Secret.owner_component
    }

    return (($Pairs.GetEnumerator() | ForEach-Object {
        "$($_.Key)=$(ConvertTo-SecretLabelValue -Value $_.Value)"
    }) -join ",")
}

function New-GeneratedSecretValue {
    param([int]$ByteCount)

    if ($ByteCount -lt 32) {
        throw "Generated secrets must use at least 32 random bytes."
    }

    $Bytes = [byte[]]::new($ByteCount)
    $Rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try {
        $Rng.GetBytes($Bytes)
    }
    finally {
        $Rng.Dispose()
    }

    return [Convert]::ToBase64String($Bytes).TrimEnd("=") -replace "\+", "-" -replace "/", "_"
}

function ConvertTo-SecretPayload {
    param([object]$Secret)

    switch ($Secret.payload_type) {
        "json" {
            return ($Secret.payload | ConvertTo-Json -Depth 10 -Compress)
        }
        "generated_base64url" {
            return New-GeneratedSecretValue -ByteCount ([int]$Secret.generated_bytes)
        }
        default {
            throw "Unsupported payload_type for secret $($Secret.id): $($Secret.payload_type)"
        }
    }
}

function Get-EnabledSecretVersionCount {
    param([string]$SecretId)

    if ($DryRun) {
        return 0
    }

    $PreviousErrorActionPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    $Versions = @(& $script:GcloudCommand secrets versions list $SecretId "--project=$ProjectId" "--filter=state=enabled" "--format=value(name)" 2>$null)
    $ExitCode = $LASTEXITCODE
    $ErrorActionPreference = $PreviousErrorActionPreference

    if ($ExitCode -ne 0) {
        return 0
    }

    return @($Versions | Where-Object { $_ -and $_.Trim() }).Count
}

function Add-SecretVersion {
    param([string]$SecretId, [string]$Payload)

    $Display = "gcloud secrets versions add $SecretId --project=$ProjectId --data-file=<redacted-payload-file>"

    if ($DryRun) {
        Invoke-Gcloud -Arguments @(
            "secrets",
            "versions",
            "add",
            $SecretId,
            "--project=$ProjectId",
            "--data-file=<redacted-payload-file>"
        ) -DisplayCommand $Display
        return
    }

    $TempPath = Join-Path ([System.IO.Path]::GetTempPath()) ("venta-pasajes-secret-" + [guid]::NewGuid().ToString("N") + ".txt")
    try {
        $Utf8NoBom = [System.Text.UTF8Encoding]::new($false)
        [System.IO.File]::WriteAllText($TempPath, $Payload, $Utf8NoBom)
        Invoke-Gcloud -Arguments @(
            "secrets",
            "versions",
            "add",
            $SecretId,
            "--project=$ProjectId",
            "--data-file=$TempPath"
        ) -DisplayCommand $Display
    }
    finally {
        if (Test-Path -LiteralPath $TempPath) {
            Remove-Item -LiteralPath $TempPath -Force -ErrorAction SilentlyContinue
        }
    }
}

$script:GcloudCommand = Resolve-GcloudCommand -PreferredPath $GcloudPath
$script:ExecutedGcloudCommands = @()
Set-GcloudPython

if (!(Test-Path -LiteralPath $ConfigPath)) {
    throw "Secret Manager config was not found: $ConfigPath"
}

$Config = Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json

if (-not $ProjectId) {
    $ProjectId = (& $script:GcloudCommand config get-value project 2>$null).Trim()
}

if (-not $ProjectId -or $ProjectId -eq "(unset)") {
    $ProjectId = $Config.project_id
}

if (-not $ProjectId) {
    throw "ProjectId is required. Set GOOGLE_CLOUD_PROJECT, pass -ProjectId, or configure gcloud project."
}

if (-not $DryRun) {
    & $script:GcloudCommand projects describe $ProjectId "--format=value(projectId)" | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Project was not found or cannot be accessed: $ProjectId"
    }
}

$CreatedSecrets = @()
$ExistingSecrets = @()
$VersionsAdded = @()
$VersionsExisting = @()
$AccessBindingsApplied = @()

foreach ($Secret in @($Config.secrets)) {
    $SecretExists = Test-GcloudCommand -Arguments @(
        "secrets",
        "describe",
        $Secret.id,
        "--project=$ProjectId",
        "--format=value(name)"
    )

    if ($SecretExists) {
        Write-Host "Secret already exists: $($Secret.id)"
        $ExistingSecrets += $Secret.id
    }
    else {
        $Labels = Get-LabelsArgument -Config $Config -Secret $Secret
        Invoke-Gcloud -Arguments @(
            "secrets",
            "create",
            $Secret.id,
            "--project=$ProjectId",
            "--replication-policy=$($Config.replication_policy)",
            "--labels=$Labels"
        )
        $CreatedSecrets += $Secret.id
    }

    $EnabledVersionCount = Get-EnabledSecretVersionCount -SecretId $Secret.id
    if ($EnabledVersionCount -gt 0) {
        Write-Host "Enabled secret version already exists: $($Secret.id)"
        $VersionsExisting += $Secret.id
    }
    else {
        $Payload = ConvertTo-SecretPayload -Secret $Secret
        Add-SecretVersion -SecretId $Secret.id -Payload $Payload
        $VersionsAdded += $Secret.id
    }

    foreach ($Accessor in @($Secret.accessors)) {
        Invoke-Gcloud -Arguments @(
            "secrets",
            "add-iam-policy-binding",
            $Secret.id,
            "--project=$ProjectId",
            "--member=serviceAccount:$Accessor",
            "--role=roles/secretmanager.secretAccessor",
            "--quiet"
        )

        $AccessBindingsApplied += [pscustomobject]@{
            secret = $Secret.id
            member = "serviceAccount:$Accessor"
            role = "roles/secretmanager.secretAccessor"
        }
    }
}

[pscustomobject]@{
    project_id = $ProjectId
    config_path = $ConfigPath
    secrets_expected = @($Config.secrets).Count
    secrets_created = $CreatedSecrets
    secrets_existing = $ExistingSecrets
    initial_versions_added = $VersionsAdded
    initial_versions_existing = $VersionsExisting
    secret_accessor_bindings_applied = @($AccessBindingsApplied).Count
    dry_run = [bool]$DryRun
    gcloud_commands_executed = $script:ExecutedGcloudCommands
} | ConvertTo-Json -Depth 8 -Compress
