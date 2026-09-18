param(
    [string]$ProjectId = $env:GOOGLE_CLOUD_PROJECT,
    [string]$MatrixPath = $(Join-Path $PSScriptRoot "iam-dev.json"),
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

function Get-ServiceAccountEmail {
    param([string]$AccountId, [string]$ResolvedProjectId)
    return "$AccountId@$ResolvedProjectId.iam.gserviceaccount.com"
}

$script:GcloudCommand = Resolve-GcloudCommand -PreferredPath $GcloudPath
Set-GcloudPython

if (!(Test-Path -LiteralPath $MatrixPath)) {
    throw "IAM matrix was not found: $MatrixPath"
}

$Matrix = Get-Content -LiteralPath $MatrixPath -Raw | ConvertFrom-Json

if (-not $ProjectId) {
    $ProjectId = (& $script:GcloudCommand config get-value project 2>$null).Trim()
}

if (-not $ProjectId -or $ProjectId -eq "(unset)") {
    $ProjectId = $Matrix.project_id
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

$CreatedAccounts = @()
$ExistingAccounts = @()
$ProjectRoleBindings = @()
$ServiceAccountPolicyBindings = @()

foreach ($Account in @($Matrix.service_accounts)) {
    $AccountId = $Account.account_id
    $Email = Get-ServiceAccountEmail -AccountId $AccountId -ResolvedProjectId $ProjectId

    if ($AccountId.Length -gt 30) {
        throw "Service account id is longer than 30 characters: $AccountId"
    }

    $Exists = $false
    if (-not $DryRun) {
        $PreviousErrorActionPreference = $ErrorActionPreference
        $ErrorActionPreference = "Continue"
        & $script:GcloudCommand iam service-accounts describe $Email "--project=$ProjectId" "--format=value(email)" 1>$null 2>$null
        $DescribeExitCode = $LASTEXITCODE
        $ErrorActionPreference = $PreviousErrorActionPreference
        $Exists = $DescribeExitCode -eq 0
    }

    if ($Exists) {
        Write-Host "Service account already exists: $Email"
        $ExistingAccounts += $Email
    }
    else {
        Invoke-Gcloud -Arguments @(
            "iam",
            "service-accounts",
            "create",
            $AccountId,
            "--project=$ProjectId",
            "--display-name=$($Account.display_name)",
            "--description=$($Account.description)"
        )
        $CreatedAccounts += $Email
    }

    foreach ($Role in @($Account.project_roles)) {
        Invoke-Gcloud -Arguments @(
            "projects",
            "add-iam-policy-binding",
            $ProjectId,
            "--member=serviceAccount:$Email",
            "--role=$Role",
            "--condition=None",
            "--quiet"
        )

        $ProjectRoleBindings += [pscustomobject]@{
            member = "serviceAccount:$Email"
            role = $Role
        }
    }
}

foreach ($Binding in @($Matrix.service_account_bindings)) {
    $TargetEmail = Get-ServiceAccountEmail -AccountId $Binding.target_account_id -ResolvedProjectId $ProjectId
    $MemberEmail = Get-ServiceAccountEmail -AccountId $Binding.member_account_id -ResolvedProjectId $ProjectId

    Invoke-Gcloud -Arguments @(
        "iam",
        "service-accounts",
        "add-iam-policy-binding",
        $TargetEmail,
        "--project=$ProjectId",
        "--member=serviceAccount:$MemberEmail",
        "--role=$($Binding.role)",
        "--quiet"
    )

    $ServiceAccountPolicyBindings += [pscustomobject]@{
        target = $TargetEmail
        member = "serviceAccount:$MemberEmail"
        role = $Binding.role
    }
}

[pscustomobject]@{
    project_id = $ProjectId
    matrix_path = $MatrixPath
    service_accounts_expected = @($Matrix.service_accounts).Count
    service_accounts_created = $CreatedAccounts
    service_accounts_existing = $ExistingAccounts
    project_role_bindings_applied = @($ProjectRoleBindings).Count
    service_account_policy_bindings_applied = @($ServiceAccountPolicyBindings).Count
    dry_run = [bool]$DryRun
} | ConvertTo-Json -Depth 8 -Compress
