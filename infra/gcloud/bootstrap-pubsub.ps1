param(
    [string]$ProjectId = $env:GOOGLE_CLOUD_PROJECT,
    [string]$ConfigPath = $(Join-Path $PSScriptRoot "pubsub-prod.json"),
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
    $script:ExecutedCommands += $CommandLine

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

$script:GcloudCommand = Resolve-GcloudCommand -PreferredPath $GcloudPath
$script:ExecutedCommands = @()
Set-GcloudPython

if (!(Test-Path -LiteralPath $ConfigPath)) {
    throw "Pub/Sub config was not found: $ConfigPath"
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

$CreatedTopics = @()
$ExistingTopics = @()
$CreatedSubscriptions = @()
$ExistingSubscriptions = @()
$IamBindingsApplied = @()

foreach ($Topic in @($Config.topics)) {
    $TopicExists = Test-GcloudCommand -Arguments @(
        "pubsub",
        "topics",
        "describe",
        $Topic.name,
        "--project=$ProjectId",
        "--format=value(name)"
    )

    if ($TopicExists) {
        Write-Host "Topic already exists: $($Topic.name)"
        $ExistingTopics += $Topic.name
    }
    else {
        Invoke-Gcloud -Arguments @(
            "pubsub",
            "topics",
            "create",
            $Topic.name,
            "--project=$ProjectId",
            "--labels=app=venta-pasajes,env=$($Config.environment)"
        )
        $CreatedTopics += $Topic.name
    }

    foreach ($Publisher in @($Topic.publisher_service_accounts)) {
        Invoke-Gcloud -Arguments @(
            "pubsub",
            "topics",
            "add-iam-policy-binding",
            $Topic.name,
            "--project=$ProjectId",
            "--member=serviceAccount:$Publisher",
            "--role=roles/pubsub.publisher",
            "--quiet"
        )

        $IamBindingsApplied += [pscustomobject]@{
            resource = $Topic.name
            member = "serviceAccount:$Publisher"
            role = "roles/pubsub.publisher"
        }
    }
}

foreach ($Subscription in @($Config.subscriptions)) {
    $SubscriptionExists = Test-GcloudCommand -Arguments @(
        "pubsub",
        "subscriptions",
        "describe",
        $Subscription.name,
        "--project=$ProjectId",
        "--format=value(name)"
    )

    if ($SubscriptionExists) {
        Write-Host "Subscription already exists: $($Subscription.name)"
        $ExistingSubscriptions += $Subscription.name
    }
    else {
        $CreateArgs = @(
            "pubsub",
            "subscriptions",
            "create",
            $Subscription.name,
            "--project=$ProjectId",
            "--topic=$($Subscription.topic)",
            "--ack-deadline=$($Subscription.ack_deadline_seconds)",
            "--message-retention-duration=$($Subscription.message_retention_duration)",
            "--labels=app=venta-pasajes,env=$($Config.environment)"
        )

        if ($Subscription.enable_dead_letter_policy -and $Subscription.dead_letter_topic) {
            $CreateArgs += "--dead-letter-topic=$($Subscription.dead_letter_topic)"
            $CreateArgs += "--max-delivery-attempts=$($Subscription.max_delivery_attempts)"
        }

        Invoke-Gcloud -Arguments $CreateArgs
        $CreatedSubscriptions += $Subscription.name
    }

    foreach ($Subscriber in @($Subscription.subscriber_service_accounts)) {
        Invoke-Gcloud -Arguments @(
            "pubsub",
            "subscriptions",
            "add-iam-policy-binding",
            $Subscription.name,
            "--project=$ProjectId",
            "--member=serviceAccount:$Subscriber",
            "--role=roles/pubsub.subscriber",
            "--quiet"
        )

        $IamBindingsApplied += [pscustomobject]@{
            resource = $Subscription.name
            member = "serviceAccount:$Subscriber"
            role = "roles/pubsub.subscriber"
        }
    }
}

[pscustomobject]@{
    project_id = $ProjectId
    environment = $Config.environment
    config_path = $ConfigPath
    topics_expected = @($Config.topics).Count
    topics_created = $CreatedTopics
    topics_existing = $ExistingTopics
    subscriptions_expected = @($Config.subscriptions).Count
    subscriptions_created = $CreatedSubscriptions
    subscriptions_existing = $ExistingSubscriptions
    iam_bindings_applied = @($IamBindingsApplied).Count
    dry_run = [bool]$DryRun
    gcloud_commands_executed = $script:ExecutedCommands
} | ConvertTo-Json -Depth 8 -Compress
