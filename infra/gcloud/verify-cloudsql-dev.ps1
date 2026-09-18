param(
    [string]$ProjectId = $env:GOOGLE_CLOUD_PROJECT,
    [string]$ConfigPath = $(Join-Path $PSScriptRoot "cloudsql-dev.json"),
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

function Convert-ServiceAccountToCloudSqlIamUser {
    param([string]$ServiceAccountEmail)
    return $ServiceAccountEmail -replace "\.gserviceaccount\.com$", ""
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

$GcloudCommand = Resolve-GcloudCommand -PreferredPath $GcloudPath
Set-GcloudPython

if (!(Test-Path -LiteralPath $ConfigPath)) {
    throw "Cloud SQL config was not found: $ConfigPath"
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

$Instance = $Config.instance
$InstanceName = $Instance.name

$InstanceJson = & $GcloudCommand sql instances describe $InstanceName "--project=$ProjectId" "--format=json"
if ($LASTEXITCODE -ne 0) {
    throw "Cloud SQL instance was not found or cannot be accessed: $InstanceName"
}

$InstanceState = $InstanceJson | ConvertFrom-Json

$ActualFlags = @{}
foreach ($Flag in @($InstanceState.settings.databaseFlags)) {
    $ActualFlags[$Flag.name] = $Flag.value
}

$MissingFlags = @()
foreach ($ExpectedFlag in @($Instance.database_flags)) {
    $Parts = $ExpectedFlag -split "=", 2
    $FlagName = $Parts[0]
    $FlagValue = if ($Parts.Count -gt 1) { $Parts[1] } else { "" }

    if (-not $ActualFlags.ContainsKey($FlagName) -or $ActualFlags[$FlagName] -ne $FlagValue) {
        $MissingFlags += $ExpectedFlag
    }
}

$DatabaseNames = @(& $GcloudCommand sql databases list "--instance=$InstanceName" "--project=$ProjectId" "--format=value(name)")
if ($LASTEXITCODE -ne 0) {
    throw "Could not list databases for instance: $InstanceName"
}

$ExpectedDatabases = @($Config.databases | ForEach-Object { $_.name })
$MissingDatabases = @($ExpectedDatabases | Where-Object { $_ -notin $DatabaseNames })

$UserNames = @(& $GcloudCommand sql users list "--instance=$InstanceName" "--project=$ProjectId" "--format=value(name)")
if ($LASTEXITCODE -ne 0) {
    throw "Could not list database users for instance: $InstanceName"
}

$ExpectedIamUsers = @($Config.iam_database_users | ForEach-Object {
    if ($_.cloud_sql_username) {
        $_.cloud_sql_username
    }
    else {
        Convert-ServiceAccountToCloudSqlIamUser -ServiceAccountEmail $_.service_account
    }
})
$MissingIamUsers = @($ExpectedIamUsers | Where-Object { $_ -notin $UserNames })

$PolicyJson = & $GcloudCommand projects get-iam-policy $ProjectId "--format=json"
if ($LASTEXITCODE -ne 0) {
    throw "Could not read IAM policy for project: $ProjectId"
}

$ProjectPolicy = $PolicyJson | ConvertFrom-Json
$MissingInstanceUserBindings = @()

foreach ($User in @($Config.iam_database_users)) {
    $Member = "serviceAccount:$($User.service_account)"
    if (-not (Test-PolicyBinding -Policy $ProjectPolicy -Role "roles/cloudsql.instanceUser" -Member $Member)) {
        $MissingInstanceUserBindings += [pscustomobject]@{
            service = $User.service
            member = $Member
            role = "roles/cloudsql.instanceUser"
        }
    }
}

$ConnectionName = "$ProjectId`:$($Instance.region)`:$InstanceName"

[pscustomobject]@{
    project_id = $ProjectId
    instance_name = $InstanceName
    connection_name = $ConnectionName
    state = $InstanceState.state
    database_version = $InstanceState.databaseVersion
    region = $InstanceState.region
    tier = $InstanceState.settings.tier
    edition = $InstanceState.settings.edition
    availability_type = $InstanceState.settings.availabilityType
    deletion_protection = $InstanceState.settings.deletionProtectionEnabled
    backup_enabled = $InstanceState.settings.backupConfiguration.enabled
    backup_start_time = $InstanceState.settings.backupConfiguration.startTime
    expected_databases = @($ExpectedDatabases).Count
    missing_databases = $MissingDatabases
    expected_iam_database_users = @($ExpectedIamUsers).Count
    missing_iam_database_users = $MissingIamUsers
    missing_database_flags = $MissingFlags
    missing_instance_user_bindings = $MissingInstanceUserBindings
    privilege_strategy = $Config.privilege_strategy.schema_privileges
    ready = (
        $InstanceState.state -eq "RUNNABLE" -and
        @($MissingDatabases).Count -eq 0 -and
        @($MissingIamUsers).Count -eq 0 -and
        @($MissingFlags).Count -eq 0 -and
        @($MissingInstanceUserBindings).Count -eq 0
    )
} | ConvertTo-Json -Depth 8 -Compress
