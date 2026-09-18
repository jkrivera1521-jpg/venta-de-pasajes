param(
    [string]$ProjectId = $(if ($env:GOOGLE_CLOUD_PROJECT) { $env:GOOGLE_CLOUD_PROJECT } else { "venta-pasajes-dev" }),
    [string]$ProjectName = $(if ($env:GOOGLE_CLOUD_PROJECT_NAME) { $env:GOOGLE_CLOUD_PROJECT_NAME } else { "Venta de Pasajes Dev" }),
    [string]$Region = $(if ($env:GOOGLE_CLOUD_REGION) { $env:GOOGLE_CLOUD_REGION } else { "us-central1" }),
    [string]$BillingAccountId = $env:GOOGLE_BILLING_ACCOUNT_ID,
    [string]$OrganizationId = $env:GOOGLE_CLOUD_ORGANIZATION_ID,
    [string]$FolderId = $env:GOOGLE_CLOUD_FOLDER_ID,
    [decimal]$BudgetAmount = $(if ($env:GOOGLE_BUDGET_AMOUNT) { [decimal]::Parse($env:GOOGLE_BUDGET_AMOUNT, [System.Globalization.CultureInfo]::InvariantCulture) } else { 50 }),
    [string]$BudgetCurrency = $(if ($env:GOOGLE_BUDGET_CURRENCY) { $env:GOOGLE_BUDGET_CURRENCY } else { "USD" }),
    [string]$BudgetDisplayName = $(if ($env:GOOGLE_BUDGET_DISPLAY_NAME) { $env:GOOGLE_BUDGET_DISPLAY_NAME } else { "venta-pasajes-dev-monthly-budget" }),
    [string]$GcloudPath = $env:GCLOUD_PATH,
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

if ($OrganizationId -and $FolderId) {
    throw "Use only one parent: OrganizationId or FolderId."
}

if (-not $BillingAccountId -and $DryRun) {
    $BillingAccountId = "000000-000000-000000"
}

if (-not $BillingAccountId) {
    throw "BillingAccountId is required. Set GOOGLE_BILLING_ACCOUNT_ID or pass -BillingAccountId."
}

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

function Invoke-Gcloud {
    param([string[]]$Arguments)

    $CommandLine = "gcloud " + ($Arguments -join " ")

    if ($DryRun) {
        Write-Host "[dry-run] $CommandLine"
        return
    }

    Write-Host "[gcloud] $($Arguments -join ' ')"
    & $script:GcloudCommand @Arguments

    if ($LASTEXITCODE -ne 0) {
        throw "gcloud failed: $CommandLine"
    }
}

$script:GcloudCommand = "gcloud"

if (-not $DryRun) {
    $script:GcloudCommand = Resolve-GcloudCommand -PreferredPath $GcloudPath

    Set-GcloudPython

    $ActiveAccount = (& $script:GcloudCommand auth list "--filter=status:ACTIVE" "--format=value(account)").Trim()
    if (-not $ActiveAccount) {
        throw "No active gcloud account found. Run gcloud auth login."
    }
}

$ProjectExists = $false

if (-not $DryRun) {
    & $script:GcloudCommand projects describe $ProjectId "--format=value(projectId)" *> $null
    $ProjectExists = $LASTEXITCODE -eq 0
}

if ($ProjectExists) {
    Invoke-Gcloud -Arguments @("config", "set", "project", $ProjectId)
}
else {
    $CreateProjectArgs = @(
        "projects",
        "create",
        $ProjectId,
        "--name=$ProjectName",
        "--labels=app=venta-pasajes,env=dev,managed_by=codex",
        "--set-as-default"
    )

    if ($FolderId) {
        $CreateProjectArgs += "--folder=$FolderId"
    }
    elseif ($OrganizationId) {
        $CreateProjectArgs += "--organization=$OrganizationId"
    }

    Invoke-Gcloud -Arguments $CreateProjectArgs
}

Invoke-Gcloud -Arguments @("billing", "projects", "link", $ProjectId, "--billing-account=$BillingAccountId")

$ApisFile = Join-Path $PSScriptRoot "dev-apis.txt"
$Apis = Get-Content -LiteralPath $ApisFile |
    ForEach-Object { $_.Trim() } |
    Where-Object { $_ -and -not $_.StartsWith("#") }

Invoke-Gcloud -Arguments (@("services", "enable") + $Apis + @("--project=$ProjectId"))
Invoke-Gcloud -Arguments @("config", "set", "run/region", $Region)

$BudgetExists = $false

if (-not $DryRun) {
    $BudgetsJson = & $script:GcloudCommand beta billing budgets list "--billing-account=$BillingAccountId" "--format=json"
    if ($LASTEXITCODE -eq 0 -and $BudgetsJson) {
        $Budgets = $BudgetsJson | ConvertFrom-Json
        $BudgetExists = @($Budgets | Where-Object { $_.displayName -eq $BudgetDisplayName }).Count -gt 0
    }
}

if ($BudgetExists) {
    Write-Host "Budget already exists: $BudgetDisplayName"
}
else {
    $BudgetAmountText = [string]::Format([System.Globalization.CultureInfo]::InvariantCulture, "{0:0.##}", $BudgetAmount)
    $BudgetValue = "$BudgetAmountText$BudgetCurrency"

    Invoke-Gcloud -Arguments @(
        "beta",
        "billing",
        "budgets",
        "create",
        "--billing-account=$BillingAccountId",
        "--display-name=$BudgetDisplayName",
        "--budget-amount=$BudgetValue",
        "--filter-projects=projects/$ProjectId",
        "--calendar-period=month",
        "--threshold-rule=percent=0.50,basis=current-spend",
        "--threshold-rule=percent=0.75,basis=current-spend",
        "--threshold-rule=percent=0.90,basis=forecasted-spend",
        "--threshold-rule=percent=1.00,basis=current-spend"
    )
}

[pscustomobject]@{
    project_id = $ProjectId
    project_name = $ProjectName
    region = $Region
    billing_account_id = $BillingAccountId
    budget_display_name = $BudgetDisplayName
    budget_amount = "$BudgetAmount$BudgetCurrency"
    api_count = @($Apis).Count
    dry_run = [bool]$DryRun
} | ConvertTo-Json -Compress
