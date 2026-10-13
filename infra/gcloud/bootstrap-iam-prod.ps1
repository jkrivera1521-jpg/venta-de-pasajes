param(
    [string]$ProjectId = $env:GOOGLE_CLOUD_PROJECT,
    [string]$IamConfigPath = $(Join-Path $PSScriptRoot "iam-prod.json"),
    [string]$CloudSqlConfigPath = $(Join-Path $PSScriptRoot "cloudsql-prod.json"),
    [string]$SecretsConfigPath = $(Join-Path $PSScriptRoot "secrets-prod.json"),
    [string]$PubSubConfigPath = $(Join-Path $PSScriptRoot "pubsub-prod.json"),
    [string]$GcloudPath = $env:GCLOUD_PATH,
    [switch]$RemoveLegacyBindings,
    [switch]$VerboseCommands,
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

function First-Value {
    param([string[]]$Values)

    foreach ($Value in $Values) {
        if (-not [string]::IsNullOrWhiteSpace($Value)) {
            return $Value
        }
    }

    return ""
}

function Initialize-CloudSdkPython {
    $PythonPath = First-Value @(
        $env:CLOUDSDK_PYTHON,
        "C:\Python312\python.exe",
        "C:\Python313\python.exe",
        "C:\Python311\python.exe"
    )

    if ($PythonPath -and (Test-Path -LiteralPath $PythonPath)) {
        $env:CLOUDSDK_PYTHON = (Resolve-Path -LiteralPath $PythonPath).Path
    }
}

function Resolve-GcloudCommand {
    param([string]$PreferredPath)

    if ($PreferredPath -and (Test-Path -LiteralPath $PreferredPath)) {
        return (Resolve-Path -LiteralPath $PreferredPath).Path
    }

    $Candidates = @(
        "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd",
        "$env:ProgramFiles\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd",
        "${env:ProgramFiles(x86)}\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd"
    )

    foreach ($Candidate in $Candidates) {
        if ($Candidate -and (Test-Path -LiteralPath $Candidate)) {
            return (Resolve-Path -LiteralPath $Candidate).Path
        }
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

function Invoke-Gcloud {
    param(
        [string[]]$Arguments,
        [switch]$IgnoreErrors
    )

    $CommandLine = "gcloud " + ($Arguments -join " ")
    $script:ExecutedCommands += $CommandLine

    if ($DryRun) {
        Write-Host "[dry-run] $CommandLine"
        return $true
    }

    if ($VerboseCommands) {
        Write-Host "[gcloud] $($Arguments -join ' ')"
    }

    $MaxAttempts = if ($IgnoreErrors) { 1 } else { 3 }
    $ExitCode = 1

    for ($Attempt = 1; $Attempt -le $MaxAttempts; $Attempt++) {
        $PreviousErrorActionPreference = $ErrorActionPreference
        $ErrorActionPreference = "Continue"
        try {
            & $script:GcloudCommand @Arguments 1>$null 2>$null
            $ExitCode = $LASTEXITCODE
        } finally {
            $ErrorActionPreference = $PreviousErrorActionPreference
        }

        if ($ExitCode -eq 0) {
            break
        }

        if ($Attempt -lt $MaxAttempts) {
            Start-Sleep -Seconds 5
        }
    }

    if ($ExitCode -ne 0 -and -not $IgnoreErrors) {
        throw "gcloud failed: $CommandLine"
    }

    return $ExitCode -eq 0
}

function Test-GcloudCommand {
    param([string[]]$Arguments)

    if ($DryRun) {
        return $false
    }

    $PreviousErrorActionPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        & $script:GcloudCommand @Arguments 1>$null 2>$null
        $ExitCode = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $PreviousErrorActionPreference
    }

    return $ExitCode -eq 0
}

function Get-ServiceAccountEmail {
    param([string]$AccountId)
    return "$AccountId@$ProjectId.iam.gserviceaccount.com"
}

function Test-CloudSqlUser {
    param([string]$InstanceName, [string]$UserName)

    if ($DryRun) {
        return $false
    }

    $PreviousErrorActionPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        $Matches = @(& $script:GcloudCommand sql users list "--instance=$InstanceName" "--project=$ProjectId" "--filter=name=$UserName" "--format=value(name)" 2>$null)
        $ExitCode = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $PreviousErrorActionPreference
    }

    return $ExitCode -eq 0 -and @($Matches | Where-Object { $_.Trim() -eq $UserName }).Count -gt 0
}

Initialize-CloudSdkPython
$script:GcloudCommand = Resolve-GcloudCommand -PreferredPath $GcloudPath
$script:ExecutedCommands = @()

foreach ($Path in @($IamConfigPath, $CloudSqlConfigPath, $SecretsConfigPath, $PubSubConfigPath)) {
    if (-not (Test-Path -LiteralPath $Path)) {
        throw "Required config file was not found: $Path"
    }
}

$IamConfig = Get-Content -LiteralPath $IamConfigPath -Raw | ConvertFrom-Json
$CloudSqlConfig = Get-Content -LiteralPath $CloudSqlConfigPath -Raw | ConvertFrom-Json
$SecretsConfig = Get-Content -LiteralPath $SecretsConfigPath -Raw | ConvertFrom-Json
$PubSubConfig = Get-Content -LiteralPath $PubSubConfigPath -Raw | ConvertFrom-Json

if (-not $ProjectId) {
    $ProjectId = (& $script:GcloudCommand config get-value project 2>$null).Trim()
}

if (-not $ProjectId -or $ProjectId -eq "(unset)") {
    $ProjectId = $IamConfig.project_id
}

if (-not $ProjectId) {
    throw "ProjectId is required. Set GOOGLE_CLOUD_PROJECT, pass -ProjectId, or configure gcloud project."
}

if (-not $DryRun) {
    Invoke-Gcloud -Arguments @("projects", "describe", $ProjectId, "--format=value(projectId)") | Out-Null
}

$CreatedAccounts = @()
$ExistingAccounts = @()
$ProjectRoleBindings = @()
$ServiceAccountUserBindings = @()
$CreatedCloudSqlUsers = @()
$ExistingCloudSqlUsers = @()
$RemovedLegacyCloudSqlUsers = @()
$SecretBindings = @()
$RemovedLegacySecretBindings = @()
$StorageBindings = @()
$RemovedLegacyStorageBindings = @()
$PubSubBindings = @()
$RemovedLegacyPubSubBindings = @()

foreach ($Account in @($IamConfig.service_accounts)) {
    $AccountId = [string]$Account.account_id
    $Email = Get-ServiceAccountEmail -AccountId $AccountId

    if ($AccountId.Length -gt 30) {
        throw "Service account id is longer than 30 characters: $AccountId"
    }

    $Exists = Test-GcloudCommand -Arguments @("iam", "service-accounts", "describe", $Email, "--project=$ProjectId", "--format=value(email)")

    if ($Exists) {
        Write-Host "Service account already exists: $Email"
        $ExistingAccounts += $Email
    } else {
        Invoke-Gcloud -Arguments @(
            "iam",
            "service-accounts",
            "create",
            $AccountId,
            "--project=$ProjectId",
            "--display-name=$($Account.display_name)",
            "--description=$($Account.description)"
        ) | Out-Null
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
        ) | Out-Null

        $ProjectRoleBindings += [pscustomobject]@{
            member = "serviceAccount:$Email"
            role = $Role
        }
    }
}

foreach ($Binding in @($IamConfig.service_account_bindings)) {
    $TargetEmail = Get-ServiceAccountEmail -AccountId ([string]$Binding.target_account_id)
    $MemberEmail = Get-ServiceAccountEmail -AccountId ([string]$Binding.member_account_id)

    Invoke-Gcloud -Arguments @(
        "iam",
        "service-accounts",
        "add-iam-policy-binding",
        $TargetEmail,
        "--project=$ProjectId",
        "--member=serviceAccount:$MemberEmail",
        "--role=$($Binding.role)",
        "--quiet"
    ) | Out-Null

    $ServiceAccountUserBindings += [pscustomobject]@{
        target = $TargetEmail
        member = "serviceAccount:$MemberEmail"
        role = $Binding.role
    }
}

$InstanceName = [string]$CloudSqlConfig.instance.name
foreach ($User in @($CloudSqlConfig.iam_database_users)) {
    $UserName = [string]$User.cloud_sql_username

    if (Test-CloudSqlUser -InstanceName $InstanceName -UserName $UserName) {
        Write-Host "Cloud SQL IAM database user already exists: $UserName"
        $ExistingCloudSqlUsers += $UserName
    } else {
        Invoke-Gcloud -Arguments @(
            "sql",
            "users",
            "create",
            $UserName,
            "--instance=$InstanceName",
            "--project=$ProjectId",
            "--type=cloud_iam_service_account"
        ) | Out-Null
        $CreatedCloudSqlUsers += $UserName
    }
}

foreach ($Secret in @($SecretsConfig.secrets)) {
    foreach ($Accessor in @($Secret.accessors)) {
        Invoke-Gcloud -Arguments @(
            "secrets",
            "add-iam-policy-binding",
            $Secret.id,
            "--project=$ProjectId",
            "--member=serviceAccount:$Accessor",
            "--role=roles/secretmanager.secretAccessor",
            "--quiet"
        ) | Out-Null

        $SecretBindings += [pscustomobject]@{
            secret = $Secret.id
            member = "serviceAccount:$Accessor"
            role = "roles/secretmanager.secretAccessor"
        }
    }
}

foreach ($Binding in @($IamConfig.storage_bindings)) {
    Invoke-Gcloud -Arguments @(
        "storage",
        "buckets",
        "add-iam-policy-binding",
        "gs://$($Binding.bucket)",
        "--project",
        $ProjectId,
        "--member",
        $Binding.member,
        "--role",
        $Binding.role
    ) | Out-Null

    $StorageBindings += $Binding
}

foreach ($Topic in @($PubSubConfig.topics)) {
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
        ) | Out-Null

        $PubSubBindings += [pscustomobject]@{
            resource = $Topic.name
            member = "serviceAccount:$Publisher"
            role = "roles/pubsub.publisher"
        }
    }
}

foreach ($Subscription in @($PubSubConfig.subscriptions)) {
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
        ) | Out-Null

        $PubSubBindings += [pscustomobject]@{
            resource = $Subscription.name
            member = "serviceAccount:$Subscriber"
            role = "roles/pubsub.subscriber"
        }
    }
}

if ($RemoveLegacyBindings) {
    foreach ($LegacyUser in @($IamConfig.legacy_resource_access_to_remove.cloud_sql_iam_database_users)) {
        $Removed = Invoke-Gcloud -Arguments @(
            "sql",
            "users",
            "delete",
            $LegacyUser,
            "--instance=$InstanceName",
            "--project=$ProjectId",
            "--quiet"
        ) -IgnoreErrors

        if ($Removed) {
            $RemovedLegacyCloudSqlUsers += $LegacyUser
        }
    }

    foreach ($Secret in @($SecretsConfig.secrets)) {
        foreach ($LegacyAccessor in @($IamConfig.legacy_resource_access_to_remove.secret_accessors)) {
            $Removed = Invoke-Gcloud -Arguments @(
                "secrets",
                "remove-iam-policy-binding",
                $Secret.id,
                "--project=$ProjectId",
                "--member=serviceAccount:$LegacyAccessor",
                "--role=roles/secretmanager.secretAccessor",
                "--quiet"
            ) -IgnoreErrors

            if ($Removed) {
                $RemovedLegacySecretBindings += [pscustomobject]@{
                    secret = $Secret.id
                    member = "serviceAccount:$LegacyAccessor"
                    role = "roles/secretmanager.secretAccessor"
                }
            }
        }
    }

    foreach ($Binding in @($IamConfig.legacy_resource_access_to_remove.storage_bindings)) {
        $Removed = Invoke-Gcloud -Arguments @(
            "storage",
            "buckets",
            "remove-iam-policy-binding",
            "gs://$($Binding.bucket)",
            "--project",
            $ProjectId,
            "--member",
            $Binding.member,
            "--role",
            $Binding.role
        ) -IgnoreErrors

        if ($Removed) {
            $RemovedLegacyStorageBindings += $Binding
        }
    }

    foreach ($Topic in @($PubSubConfig.topics)) {
        foreach ($LegacyPrincipal in @($IamConfig.legacy_resource_access_to_remove.pubsub_principals)) {
            $Removed = Invoke-Gcloud -Arguments @(
                "pubsub",
                "topics",
                "remove-iam-policy-binding",
                $Topic.name,
                "--project=$ProjectId",
                "--member=serviceAccount:$LegacyPrincipal",
                "--role=roles/pubsub.publisher",
                "--quiet"
            ) -IgnoreErrors

            if ($Removed) {
                $RemovedLegacyPubSubBindings += [pscustomobject]@{
                    resource = $Topic.name
                    member = "serviceAccount:$LegacyPrincipal"
                    role = "roles/pubsub.publisher"
                }
            }
        }
    }

    foreach ($Subscription in @($PubSubConfig.subscriptions)) {
        foreach ($LegacyPrincipal in @($IamConfig.legacy_resource_access_to_remove.pubsub_principals)) {
            $Removed = Invoke-Gcloud -Arguments @(
                "pubsub",
                "subscriptions",
                "remove-iam-policy-binding",
                $Subscription.name,
                "--project=$ProjectId",
                "--member=serviceAccount:$LegacyPrincipal",
                "--role=roles/pubsub.subscriber",
                "--quiet"
            ) -IgnoreErrors

            if ($Removed) {
                $RemovedLegacyPubSubBindings += [pscustomobject]@{
                    resource = $Subscription.name
                    member = "serviceAccount:$LegacyPrincipal"
                    role = "roles/pubsub.subscriber"
                }
            }
        }
    }
}

[pscustomobject]@{
    project_id = $ProjectId
    environment = $IamConfig.environment
    service_accounts_expected = @($IamConfig.service_accounts).Count
    service_accounts_created = $CreatedAccounts
    service_accounts_existing = $ExistingAccounts
    project_role_bindings_applied = @($ProjectRoleBindings).Count
    service_account_user_bindings_applied = @($ServiceAccountUserBindings).Count
    cloud_sql_iam_users_created = $CreatedCloudSqlUsers
    cloud_sql_iam_users_existing = $ExistingCloudSqlUsers
    secret_bindings_applied = @($SecretBindings).Count
    storage_bindings_applied = @($StorageBindings).Count
    pubsub_bindings_applied = @($PubSubBindings).Count
    remove_legacy_bindings = [bool]$RemoveLegacyBindings
    legacy_cloud_sql_users_removed = $RemovedLegacyCloudSqlUsers
    legacy_secret_bindings_removed = @($RemovedLegacySecretBindings).Count
    legacy_storage_bindings_removed = @($RemovedLegacyStorageBindings).Count
    legacy_pubsub_bindings_removed = @($RemovedLegacyPubSubBindings).Count
    cloud_run_invocation_policy = $IamConfig.cloud_run_invocation_policy.status
    dry_run = [bool]$DryRun
    gcloud_command_count = @($script:ExecutedCommands).Count
} | ConvertTo-Json -Depth 10 -Compress
