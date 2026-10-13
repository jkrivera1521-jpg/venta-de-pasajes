param(
    [string]$ProjectId = $env:GOOGLE_CLOUD_PROJECT,
    [string]$IamConfigPath = $(Join-Path $PSScriptRoot "iam-prod.json"),
    [string]$CloudSqlConfigPath = $(Join-Path $PSScriptRoot "cloudsql-prod.json"),
    [string]$SecretsConfigPath = $(Join-Path $PSScriptRoot "secrets-prod.json"),
    [string]$PubSubConfigPath = $(Join-Path $PSScriptRoot "pubsub-prod.json"),
    [string]$GcloudPath = $env:GCLOUD_PATH,
    [string]$OutputDir = "logs\prod-iam",
    [switch]$FailOnNotReady
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
    param([string[]]$Arguments)

    $PreviousErrorActionPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        $Output = & $script:GcloudCommand @Arguments 2>&1
        $ExitCode = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $PreviousErrorActionPreference
    }

    [pscustomobject]@{
        exit_code = $ExitCode
        output = ($Output | ForEach-Object { $_.ToString() }) -join [Environment]::NewLine
    }
}

function Convert-JsonOutput {
    param([string]$Text)

    if ([string]::IsNullOrWhiteSpace($Text)) {
        return $null
    }

    return $Text | ConvertFrom-Json
}

function Get-ServiceAccountEmail {
    param([string]$AccountId)
    return "$AccountId@$ProjectId.iam.gserviceaccount.com"
}

function Test-PolicyBinding {
    param([object]$Policy, [string]$Role, [string]$Member)

    if (-not $Policy -or -not $Policy.bindings) {
        return $false
    }

    return @($Policy.bindings | Where-Object {
        $_.role -eq $Role -and @($_.members) -contains $Member
    }).Count -gt 0
}

function Get-EnabledSecretVersionCount {
    param([string]$SecretId)

    $VersionsResult = Invoke-Gcloud -Arguments @(
        "secrets",
        "versions",
        "list",
        $SecretId,
        "--project=$ProjectId",
        "--filter=state=enabled",
        "--format=value(name)"
    )

    if ($VersionsResult.exit_code -ne 0 -or [string]::IsNullOrWhiteSpace($VersionsResult.output)) {
        return 0
    }

    return @($VersionsResult.output -split [Environment]::NewLine | Where-Object { $_.Trim() }).Count
}

Initialize-CloudSdkPython
$script:GcloudCommand = Resolve-GcloudCommand -PreferredPath $GcloudPath

$ProjectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..\..")).Path
Set-Location $ProjectRoot

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

$ResolvedOutputDir = Join-Path -Path $ProjectRoot -ChildPath $OutputDir
New-Item -ItemType Directory -Force -Path $ResolvedOutputDir | Out-Null

Write-Host "Validando service accounts productivas..."
$ServiceAccountFindings = foreach ($Account in @($IamConfig.service_accounts)) {
    $Email = Get-ServiceAccountEmail -AccountId ([string]$Account.account_id)
    $Describe = Invoke-Gcloud -Arguments @("iam", "service-accounts", "describe", $Email, "--project=$ProjectId", "--format=value(email)")

    [pscustomobject]@{
        account_id = $Account.account_id
        email = $Email
        exists = $Describe.exit_code -eq 0
    }
}

Write-Host "Validando roles de proyecto..."
$ProjectPolicyResult = Invoke-Gcloud -Arguments @("projects", "get-iam-policy", $ProjectId, "--format=json")
$ProjectPolicy = if ($ProjectPolicyResult.exit_code -eq 0) { Convert-JsonOutput -Text $ProjectPolicyResult.output } else { $null }

$ProjectRoleFindings = foreach ($Account in @($IamConfig.service_accounts)) {
    $Email = Get-ServiceAccountEmail -AccountId ([string]$Account.account_id)
    foreach ($Role in @($Account.project_roles)) {
        $Member = "serviceAccount:$Email"
        [pscustomobject]@{
            member = $Member
            role = $Role
            exists = Test-PolicyBinding -Policy $ProjectPolicy -Role $Role -Member $Member
        }
    }
}

Write-Host "Validando permisos serviceAccountUser del deployer..."
$ServiceAccountUserFindings = foreach ($Binding in @($IamConfig.service_account_bindings)) {
    $TargetEmail = Get-ServiceAccountEmail -AccountId ([string]$Binding.target_account_id)
    $MemberEmail = Get-ServiceAccountEmail -AccountId ([string]$Binding.member_account_id)
    $PolicyResult = Invoke-Gcloud -Arguments @("iam", "service-accounts", "get-iam-policy", $TargetEmail, "--project=$ProjectId", "--format=json")
    $Policy = if ($PolicyResult.exit_code -eq 0) { Convert-JsonOutput -Text $PolicyResult.output } else { $null }
    $Member = "serviceAccount:$MemberEmail"

    [pscustomobject]@{
        target = $TargetEmail
        member = $Member
        role = $Binding.role
        exists = Test-PolicyBinding -Policy $Policy -Role ([string]$Binding.role) -Member $Member
    }
}

Write-Host "Validando Cloud SQL IAM users produccion..."
$InstanceName = [string]$CloudSqlConfig.instance.name
$UsersResult = Invoke-Gcloud -Arguments @("sql", "users", "list", "--instance=$InstanceName", "--project=$ProjectId", "--format=json")
$CloudSqlUsers = if ($UsersResult.exit_code -eq 0) { @((Convert-JsonOutput -Text $UsersResult.output) | ForEach-Object { $_.name }) } else { @() }
$ExpectedCloudSqlUsers = @($CloudSqlConfig.iam_database_users | ForEach-Object { $_.cloud_sql_username })
$LegacyCloudSqlUsers = @($IamConfig.legacy_resource_access_to_remove.cloud_sql_iam_database_users)

Write-Host "Validando secretos produccion..."
$SecretFindings = foreach ($Secret in @($SecretsConfig.secrets)) {
    $PolicyResult = Invoke-Gcloud -Arguments @("secrets", "get-iam-policy", $Secret.id, "--project=$ProjectId", "--format=json")
    $Policy = if ($PolicyResult.exit_code -eq 0) { Convert-JsonOutput -Text $PolicyResult.output } else { $null }
    $EnabledVersions = Get-EnabledSecretVersionCount -SecretId ([string]$Secret.id)
    $ExpectedMembers = @($Secret.accessors | ForEach-Object { "serviceAccount:$_" })
    $LegacyMembers = @($IamConfig.legacy_resource_access_to_remove.secret_accessors | ForEach-Object { "serviceAccount:$_" })

    [pscustomobject]@{
        id = $Secret.id
        enabled_version_count = $EnabledVersions
        expected_accessors_missing = @($ExpectedMembers | Where-Object { -not (Test-PolicyBinding -Policy $Policy -Role "roles/secretmanager.secretAccessor" -Member $_) })
        legacy_accessors_still_present = @($LegacyMembers | Where-Object { Test-PolicyBinding -Policy $Policy -Role "roles/secretmanager.secretAccessor" -Member $_ })
    }
}

Write-Host "Validando Storage produccion..."
$StorageFindings = foreach ($Binding in @($IamConfig.storage_bindings)) {
    $PolicyResult = Invoke-Gcloud -Arguments @("storage", "buckets", "get-iam-policy", "gs://$($Binding.bucket)", "--project", $ProjectId, "--format=json")
    $Policy = if ($PolicyResult.exit_code -eq 0) { Convert-JsonOutput -Text $PolicyResult.output } else { $null }
    $LegacyBindings = @($IamConfig.legacy_resource_access_to_remove.storage_bindings | Where-Object { $_.bucket -eq $Binding.bucket })

    [pscustomobject]@{
        bucket = $Binding.bucket
        expected_binding_exists = Test-PolicyBinding -Policy $Policy -Role ([string]$Binding.role) -Member ([string]$Binding.member)
        legacy_bindings_still_present = @($LegacyBindings | Where-Object { Test-PolicyBinding -Policy $Policy -Role ([string]$_.role) -Member ([string]$_.member) })
    }
}

Write-Host "Validando Pub/Sub produccion..."
$TopicFindings = foreach ($Topic in @($PubSubConfig.topics)) {
    $PolicyResult = Invoke-Gcloud -Arguments @("pubsub", "topics", "get-iam-policy", $Topic.name, "--project=$ProjectId", "--format=json")
    $Policy = if ($PolicyResult.exit_code -eq 0) { Convert-JsonOutput -Text $PolicyResult.output } else { $null }
    $ExpectedMembers = @($Topic.publisher_service_accounts | ForEach-Object { "serviceAccount:$_" })
    $LegacyMembers = @($IamConfig.legacy_resource_access_to_remove.pubsub_principals | ForEach-Object { "serviceAccount:$_" })

    [pscustomobject]@{
        name = $Topic.name
        expected_publishers_missing = @($ExpectedMembers | Where-Object { -not (Test-PolicyBinding -Policy $Policy -Role "roles/pubsub.publisher" -Member $_) })
        legacy_publishers_still_present = @($LegacyMembers | Where-Object { Test-PolicyBinding -Policy $Policy -Role "roles/pubsub.publisher" -Member $_ })
    }
}

$SubscriptionFindings = foreach ($Subscription in @($PubSubConfig.subscriptions)) {
    $PolicyResult = Invoke-Gcloud -Arguments @("pubsub", "subscriptions", "get-iam-policy", $Subscription.name, "--project=$ProjectId", "--format=json")
    $Policy = if ($PolicyResult.exit_code -eq 0) { Convert-JsonOutput -Text $PolicyResult.output } else { $null }
    $ExpectedMembers = @($Subscription.subscriber_service_accounts | ForEach-Object { "serviceAccount:$_" })
    $LegacyMembers = @($IamConfig.legacy_resource_access_to_remove.pubsub_principals | ForEach-Object { "serviceAccount:$_" })

    [pscustomobject]@{
        name = $Subscription.name
        expected_subscribers_missing = @($ExpectedMembers | Where-Object { -not (Test-PolicyBinding -Policy $Policy -Role "roles/pubsub.subscriber" -Member $_) })
        legacy_subscribers_still_present = @($LegacyMembers | Where-Object { Test-PolicyBinding -Policy $Policy -Role "roles/pubsub.subscriber" -Member $_ })
    }
}

$BasicRoleMembers = @($ProjectPolicy.bindings | Where-Object { $_.role -in @("roles/owner", "roles/editor") } | ForEach-Object {
    [pscustomobject]@{
        role = $_.role
        members = @($_.members)
    }
})

$Checks = @(
    [pscustomobject]@{ Area = "IAM"; Check = "prod service accounts exist"; Value = (@($ServiceAccountFindings | Where-Object { -not $_.exists }).Count -eq 0) },
    [pscustomobject]@{ Area = "IAM"; Check = "project roles complete"; Value = (@($ProjectRoleFindings | Where-Object { -not $_.exists }).Count -eq 0) },
    [pscustomobject]@{ Area = "IAM"; Check = "deployer can attach prod runtimes"; Value = (@($ServiceAccountUserFindings | Where-Object { -not $_.exists }).Count -eq 0) },
    [pscustomobject]@{ Area = "Cloud SQL"; Check = "prod IAM DB users complete"; Value = (@($ExpectedCloudSqlUsers | Where-Object { $CloudSqlUsers -notcontains $_ }).Count -eq 0) },
    [pscustomobject]@{ Area = "Cloud SQL"; Check = "legacy prod IAM DB users removed"; Value = (@($LegacyCloudSqlUsers | Where-Object { $CloudSqlUsers -contains $_ }).Count -eq 0) },
    [pscustomobject]@{ Area = "Secrets"; Check = "prod secret accessors complete"; Value = (@($SecretFindings | Where-Object { @($_.expected_accessors_missing).Count -gt 0 -or $_.enabled_version_count -lt 1 }).Count -eq 0) },
    [pscustomobject]@{ Area = "Secrets"; Check = "legacy secret accessors removed"; Value = (@($SecretFindings | Where-Object { @($_.legacy_accessors_still_present).Count -gt 0 }).Count -eq 0) },
    [pscustomobject]@{ Area = "Storage"; Check = "prod bucket binding complete"; Value = (@($StorageFindings | Where-Object { -not $_.expected_binding_exists }).Count -eq 0) },
    [pscustomobject]@{ Area = "Storage"; Check = "legacy bucket binding removed"; Value = (@($StorageFindings | Where-Object { @($_.legacy_bindings_still_present).Count -gt 0 }).Count -eq 0) },
    [pscustomobject]@{ Area = "Pub/Sub"; Check = "prod publisher bindings complete"; Value = (@($TopicFindings | Where-Object { @($_.expected_publishers_missing).Count -gt 0 }).Count -eq 0) },
    [pscustomobject]@{ Area = "Pub/Sub"; Check = "legacy publisher bindings removed"; Value = (@($TopicFindings | Where-Object { @($_.legacy_publishers_still_present).Count -gt 0 }).Count -eq 0) },
    [pscustomobject]@{ Area = "Pub/Sub"; Check = "prod subscriber bindings complete"; Value = (@($SubscriptionFindings | Where-Object { @($_.expected_subscribers_missing).Count -gt 0 }).Count -eq 0) },
    [pscustomobject]@{ Area = "Pub/Sub"; Check = "legacy subscriber bindings removed"; Value = (@($SubscriptionFindings | Where-Object { @($_.legacy_subscribers_still_present).Count -gt 0 }).Count -eq 0) }
)

$Ready = @($Checks | Where-Object { -not $_.Value }).Count -eq 0

$Result = [pscustomobject]@{
    generated_at = (Get-Date).ToString("o")
    project_id = $ProjectId
    environment = "prod"
    checks = $Checks
    service_accounts = $ServiceAccountFindings
    missing_project_role_bindings = @($ProjectRoleFindings | Where-Object { -not $_.exists })
    missing_service_account_user_bindings = @($ServiceAccountUserFindings | Where-Object { -not $_.exists })
    cloud_sql = [pscustomobject]@{
        expected_iam_users = $ExpectedCloudSqlUsers
        missing_iam_users = @($ExpectedCloudSqlUsers | Where-Object { $CloudSqlUsers -notcontains $_ })
        legacy_iam_users_still_present = @($LegacyCloudSqlUsers | Where-Object { $CloudSqlUsers -contains $_ })
    }
    secrets = [pscustomobject]@{
        findings = $SecretFindings
    }
    storage = [pscustomobject]@{
        findings = $StorageFindings
    }
    pubsub = [pscustomobject]@{
        topics = $TopicFindings
        subscriptions = $SubscriptionFindings
    }
    cloud_run_invocation_policy = $IamConfig.cloud_run_invocation_policy
    administrator_access = [pscustomobject]@{
        basic_role_members_observed = $BasicRoleMembers
        manual_review_required = $true
        note = "Do not remove human Owner/Editor bindings automatically from this script; review with the project owner to avoid lockout."
    }
    ready = $Ready
}

$OutputPath = Join-Path -Path $ResolvedOutputDir -ChildPath "verify-iam-prod.json"
$Result | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $OutputPath -Encoding UTF8

$Checks + [pscustomobject]@{ Area = "Overall"; Check = "prod IAM ready"; Value = $Ready } | Format-Table -AutoSize
Write-Host "Resultado JSON: $OutputPath"

if ($FailOnNotReady -and -not $Ready) {
    exit 2
}
