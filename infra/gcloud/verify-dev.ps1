param(
    [string]$ProjectId = $(if ($env:GOOGLE_CLOUD_PROJECT) { $env:GOOGLE_CLOUD_PROJECT } else { "venta-pasajes-dev" }),
    [string]$BillingAccountId = $env:GOOGLE_BILLING_ACCOUNT_ID,
    [string]$BudgetDisplayName = $(if ($env:GOOGLE_BUDGET_DISPLAY_NAME) { $env:GOOGLE_BUDGET_DISPLAY_NAME } else { "venta-pasajes-dev-monthly-budget" }),
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

        if ($PythonCommand -like "*Python314*") {
            Write-Warning "Only Python 3.14 was detected. If corporate TLS inspection breaks gcloud, install Python 3.12 or 3.13 and rerun this script."
        }
    }
}

$GcloudCommand = Resolve-GcloudCommand -PreferredPath $GcloudPath

Set-GcloudPython

$ActiveAccount = (& $GcloudCommand auth list "--filter=status:ACTIVE" "--format=value(account)").Trim()
if (-not $ActiveAccount) {
    throw "No active gcloud account found. Run gcloud auth login."
}

$ProjectJson = & $GcloudCommand projects describe $ProjectId "--format=json"
if ($LASTEXITCODE -ne 0) {
    throw "Project was not found or cannot be accessed: $ProjectId"
}

$Project = $ProjectJson | ConvertFrom-Json

$BillingJson = & $GcloudCommand billing projects describe $ProjectId "--format=json"
if ($LASTEXITCODE -ne 0) {
    throw "Could not read billing status for project: $ProjectId"
}

$Billing = $BillingJson | ConvertFrom-Json

$RequiredApis = Get-Content -LiteralPath (Join-Path $PSScriptRoot "dev-apis.txt") |
    ForEach-Object { $_.Trim() } |
    Where-Object { $_ -and -not $_.StartsWith("#") }

$EnabledApis = & $GcloudCommand services list "--enabled" "--project=$ProjectId" "--format=value(config.name)"
if ($LASTEXITCODE -ne 0) {
    throw "Could not list enabled services for project: $ProjectId"
}

$MissingApis = @($RequiredApis | Where-Object { $_ -notin $EnabledApis })

$BudgetFound = $null
$BudgetChecked = $false
$BudgetCheckError = $null

if ($BillingAccountId) {
    $BudgetsJson = & $GcloudCommand beta billing budgets list "--billing-account=$BillingAccountId" "--format=json" 2>&1
    if ($LASTEXITCODE -eq 0 -and $BudgetsJson) {
        $Budgets = $BudgetsJson | ConvertFrom-Json
        $BudgetFound = @($Budgets | Where-Object { $_.displayName -eq $BudgetDisplayName }).Count -gt 0
        $BudgetChecked = $true
    }
    elseif ($LASTEXITCODE -ne 0) {
        $BudgetCheckError = "Could not list billing budgets. Install the gcloud beta component or verify the budget manually."
    }
}

[pscustomobject]@{
    project_id = $Project.projectId
    project_number = $Project.projectNumber
    active_account = $ActiveAccount
    billing_enabled = $Billing.billingEnabled
    billing_account_name = $Billing.billingAccountName
    enabled_api_count = @($EnabledApis).Count
    required_api_count = @($RequiredApis).Count
    missing_apis = $MissingApis
    budget_checked = $BudgetChecked
    budget_found = $BudgetFound
    budget_check_error = $BudgetCheckError
    ready = ($Billing.billingEnabled -and @($MissingApis).Count -eq 0 -and (($BudgetFound -eq $true) -or -not $BillingAccountId))
} | ConvertTo-Json -Compress
