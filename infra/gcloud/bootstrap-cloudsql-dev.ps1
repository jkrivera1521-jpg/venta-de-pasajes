param(
    [string]$ProjectId = $env:GOOGLE_CLOUD_PROJECT,
    [string]$ConfigPath = $(Join-Path $PSScriptRoot "cloudsql-dev.json"),
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
    param([string[]]$Arguments)

    $CommandLine = "gcloud " + ($Arguments -join " ")

    if ($DryRun) {
        Write-Host "[dry-run] $CommandLine"
        return
    }

    Write-Host "[gcloud] $($Arguments -join ' ')"
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

function Convert-ServiceAccountToCloudSqlIamUser {
    param([string]$ServiceAccountEmail)
    return $ServiceAccountEmail -replace "\.gserviceaccount\.com$", ""
}

$script:GcloudCommand = Resolve-GcloudCommand -PreferredPath $GcloudPath
Set-GcloudPython

if (!(Test-Path -LiteralPath $ConfigPath)) {
    throw "Cloud SQL config was not found: $ConfigPath"
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

$Instance = $Config.instance
$InstanceName = $Instance.name
$CreatedDatabases = @()
$ExistingDatabases = @()
$CreatedUsers = @()
$ExistingUsers = @()
$InstanceCreated = $false
$InstanceExisted = $false
$IamBindingsApplied = @()

if (-not $DryRun) {
    & $script:GcloudCommand projects describe $ProjectId "--format=value(projectId)" | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Project was not found or cannot be accessed: $ProjectId"
    }
}

$InstanceExists = Test-GcloudCommand -Arguments @(
    "sql",
    "instances",
    "describe",
    $InstanceName,
    "--project=$ProjectId",
    "--format=value(name)"
)

if ($InstanceExists) {
    Write-Host "Cloud SQL instance already exists: $InstanceName"
    $InstanceExisted = $true
}
else {
    $CreateArgs = @(
        "sql",
        "instances",
        "create",
        $InstanceName,
        "--project=$ProjectId",
        "--database-version=$($Instance.database_version)",
        "--edition=$($Instance.edition)",
        "--tier=$($Instance.tier)",
        "--region=$($Instance.region)",
        "--availability-type=$($Instance.availability_type)",
        "--storage-type=$($Instance.storage_type)",
        "--storage-size=$($Instance.storage_size_gb)",
        "--backup-start-time=$($Instance.backup_start_time)",
        "--retained-backups-count=$($Instance.retained_backups_count)"
    )

    if ($Instance.storage_auto_increase) {
        $CreateArgs += "--storage-auto-increase"
    }
    else {
        $CreateArgs += "--no-storage-auto-increase"
    }

    if ($Instance.deletion_protection) {
        $CreateArgs += "--deletion-protection"
    }
    else {
        $CreateArgs += "--no-deletion-protection"
    }

    $DatabaseFlags = @($Instance.database_flags) -join ","
    if ($DatabaseFlags) {
        $CreateArgs += "--database-flags=$DatabaseFlags"
    }

    Invoke-Gcloud -Arguments $CreateArgs
    $InstanceCreated = $true
}

foreach ($User in @($Config.iam_database_users)) {
    Invoke-Gcloud -Arguments @(
        "projects",
        "add-iam-policy-binding",
        $ProjectId,
        "--member=serviceAccount:$($User.service_account)",
        "--role=roles/cloudsql.instanceUser",
        "--condition=None",
        "--quiet"
    )

    $IamBindingsApplied += [pscustomobject]@{
        member = "serviceAccount:$($User.service_account)"
        role = "roles/cloudsql.instanceUser"
    }
}

foreach ($Database in @($Config.databases)) {
    $DatabaseExists = Test-GcloudCommand -Arguments @(
        "sql",
        "databases",
        "describe",
        $Database.name,
        "--instance=$InstanceName",
        "--project=$ProjectId",
        "--format=value(name)"
    )

    if ($DatabaseExists) {
        Write-Host "Database already exists: $($Database.name)"
        $ExistingDatabases += $Database.name
    }
    else {
        Invoke-Gcloud -Arguments @(
            "sql",
            "databases",
            "create",
            $Database.name,
            "--instance=$InstanceName",
            "--project=$ProjectId"
        )
        $CreatedDatabases += $Database.name
    }
}

foreach ($User in @($Config.iam_database_users)) {
    $CloudSqlUsername = if ($User.cloud_sql_username) {
        $User.cloud_sql_username
    }
    else {
        Convert-ServiceAccountToCloudSqlIamUser -ServiceAccountEmail $User.service_account
    }

    $PreviousErrorActionPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    $ExistingUserNames = @(& $script:GcloudCommand sql users list "--instance=$InstanceName" "--project=$ProjectId" "--filter=name=$CloudSqlUsername" "--format=value(name)" 2>$null)
    $ListUsersExitCode = $LASTEXITCODE
    $ErrorActionPreference = $PreviousErrorActionPreference
    $UserExists = $ListUsersExitCode -eq 0 -and @($ExistingUserNames | Where-Object { $_.Trim() -eq $CloudSqlUsername }).Count -gt 0

    if ($UserExists) {
        Write-Host "IAM database user already exists: $CloudSqlUsername"
        $ExistingUsers += $CloudSqlUsername
    }
    else {
        Invoke-Gcloud -Arguments @(
            "sql",
            "users",
            "create",
            $CloudSqlUsername,
            "--instance=$InstanceName",
            "--project=$ProjectId",
            "--type=cloud_iam_service_account"
        )
        $CreatedUsers += $CloudSqlUsername
    }
}

$ConnectionName = "$ProjectId`:$($Instance.region)`:$InstanceName"

[pscustomobject]@{
    project_id = $ProjectId
    instance_name = $InstanceName
    connection_name = $ConnectionName
    database_version = $Instance.database_version
    edition = $Instance.edition
    tier = $Instance.tier
    instance_created = $InstanceCreated
    instance_existed = $InstanceExisted
    databases_expected = @($Config.databases).Count
    databases_created = $CreatedDatabases
    databases_existing = $ExistingDatabases
    iam_database_users_expected = @($Config.iam_database_users).Count
    iam_database_users_created = $CreatedUsers
    iam_database_users_existing = $ExistingUsers
    cloudsql_instance_user_bindings_applied = @($IamBindingsApplied).Count
    dry_run = [bool]$DryRun
} | ConvertTo-Json -Depth 8 -Compress
