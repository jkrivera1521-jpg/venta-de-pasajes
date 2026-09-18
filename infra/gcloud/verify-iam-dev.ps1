param(
    [string]$ProjectId = $env:GOOGLE_CLOUD_PROJECT,
    [string]$MatrixPath = $(Join-Path $PSScriptRoot "iam-dev.json"),
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

function Get-ServiceAccountEmail {
    param([string]$AccountId, [string]$ResolvedProjectId)
    return "$AccountId@$ResolvedProjectId.iam.gserviceaccount.com"
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

if (!(Test-Path -LiteralPath $MatrixPath)) {
    throw "IAM matrix was not found: $MatrixPath"
}

$Matrix = Get-Content -LiteralPath $MatrixPath -Raw | ConvertFrom-Json

if (-not $ProjectId) {
    $ProjectId = (& $GcloudCommand config get-value project 2>$null).Trim()
}

if (-not $ProjectId -or $ProjectId -eq "(unset)") {
    $ProjectId = $Matrix.project_id
}

if (-not $ProjectId) {
    throw "ProjectId is required. Set GOOGLE_CLOUD_PROJECT, pass -ProjectId, or configure gcloud project."
}

$ProjectNumber = (& $GcloudCommand projects describe $ProjectId "--format=value(projectNumber)").Trim()
if ($LASTEXITCODE -ne 0 -or -not $ProjectNumber) {
    throw "Project was not found or cannot be accessed: $ProjectId"
}

$PolicyJson = & $GcloudCommand projects get-iam-policy $ProjectId "--format=json"
if ($LASTEXITCODE -ne 0) {
    throw "Could not read IAM policy for project: $ProjectId"
}

$ProjectPolicy = $PolicyJson | ConvertFrom-Json

$MissingAccounts = @()
$FoundAccounts = @()
$MissingProjectBindings = @()
$MissingServiceAccountBindings = @()

foreach ($Account in @($Matrix.service_accounts)) {
    $Email = Get-ServiceAccountEmail -AccountId $Account.account_id -ResolvedProjectId $ProjectId
    $Member = "serviceAccount:$Email"

    $AccountExists = $false
    $PreviousErrorActionPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    & $GcloudCommand iam service-accounts describe $Email "--project=$ProjectId" "--format=value(email)" 1>$null 2>$null
    $DescribeExitCode = $LASTEXITCODE
    $ErrorActionPreference = $PreviousErrorActionPreference
    $AccountExists = $DescribeExitCode -eq 0

    if ($AccountExists) {
        $FoundAccounts += $Email
    }
    else {
        $MissingAccounts += $Email
    }

    foreach ($Role in @($Account.project_roles)) {
        if (-not (Test-PolicyBinding -Policy $ProjectPolicy -Role $Role -Member $Member)) {
            $MissingProjectBindings += [pscustomobject]@{
                account_id = $Account.account_id
                member = $Member
                role = $Role
            }
        }
    }
}

foreach ($Binding in @($Matrix.service_account_bindings)) {
    $TargetEmail = Get-ServiceAccountEmail -AccountId $Binding.target_account_id -ResolvedProjectId $ProjectId
    $MemberEmail = Get-ServiceAccountEmail -AccountId $Binding.member_account_id -ResolvedProjectId $ProjectId
    $Member = "serviceAccount:$MemberEmail"

    $PreviousErrorActionPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    $SaPolicyJson = & $GcloudCommand iam service-accounts get-iam-policy $TargetEmail "--project=$ProjectId" "--format=json" 2>$null
    $SaPolicyExitCode = $LASTEXITCODE
    $ErrorActionPreference = $PreviousErrorActionPreference

    if ($SaPolicyExitCode -ne 0) {
        $MissingServiceAccountBindings += [pscustomobject]@{
            target_account_id = $Binding.target_account_id
            target = $TargetEmail
            member = $Member
            role = $Binding.role
            reason = "could_not_read_target_policy"
        }
        continue
    }

    $ServiceAccountPolicy = $SaPolicyJson | ConvertFrom-Json

    if (-not (Test-PolicyBinding -Policy $ServiceAccountPolicy -Role $Binding.role -Member $Member)) {
        $MissingServiceAccountBindings += [pscustomobject]@{
            target_account_id = $Binding.target_account_id
            target = $TargetEmail
            member = $Member
            role = $Binding.role
            reason = "binding_not_found"
        }
    }
}

[pscustomobject]@{
    project_id = $ProjectId
    project_number = $ProjectNumber
    matrix_path = $MatrixPath
    service_accounts_expected = @($Matrix.service_accounts).Count
    service_accounts_found = @($FoundAccounts).Count
    missing_accounts = $MissingAccounts
    missing_project_bindings = $MissingProjectBindings
    missing_service_account_bindings = $MissingServiceAccountBindings
    admin_groups_status = "defined_pending_google_workspace_or_cloud_identity"
    mfa_status = "manual_control_pending_or_external_to_project_iam"
    ready = (@($MissingAccounts).Count -eq 0 -and @($MissingProjectBindings).Count -eq 0 -and @($MissingServiceAccountBindings).Count -eq 0)
} | ConvertTo-Json -Depth 8 -Compress
