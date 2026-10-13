param(
  [string]$ProjectId = "project-fbb34cd7-0b82-43e1-867",
  [string]$CloudSqlConfigPath = $(Join-Path $PSScriptRoot "cloudsql-prod.json"),
  [string]$SecretsConfigPath = $(Join-Path $PSScriptRoot "secrets-prod.json"),
  [string]$PubSubConfigPath = $(Join-Path $PSScriptRoot "pubsub-prod.json"),
  [string]$DocumentBucketName = "venta-pasajes-prod-documents",
  [string]$GcloudPath = $env:GCLOUD_PATH,
  [string]$OutputDir = "logs\prod-infra",
  [switch]$FailOnNotReady
)

$ErrorActionPreference = "Stop"

$ProjectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..\..")).Path
Set-Location $ProjectRoot

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
  param([string]$ConfiguredGcloud)

  if ($ConfiguredGcloud -and (Test-Path -LiteralPath $ConfiguredGcloud)) {
    return (Resolve-Path -LiteralPath $ConfiguredGcloud).Path
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

Initialize-CloudSdkPython
$script:GcloudCommand = Resolve-GcloudCommand -ConfiguredGcloud $GcloudPath

foreach ($Path in @($CloudSqlConfigPath, $SecretsConfigPath, $PubSubConfigPath)) {
  if (-not (Test-Path -LiteralPath $Path)) {
    throw "Required config file was not found: $Path"
  }
}

$CloudSqlConfig = Get-Content -LiteralPath $CloudSqlConfigPath -Raw | ConvertFrom-Json
$SecretsConfig = Get-Content -LiteralPath $SecretsConfigPath -Raw | ConvertFrom-Json
$PubSubConfig = Get-Content -LiteralPath $PubSubConfigPath -Raw | ConvertFrom-Json

$ResolvedOutputDir = Join-Path -Path $ProjectRoot -ChildPath $OutputDir
New-Item -ItemType Directory -Force -Path $ResolvedOutputDir | Out-Null

Write-Host "Validando Cloud SQL produccion..."
$InstanceName = $CloudSqlConfig.instance.name
$InstanceResult = Invoke-Gcloud -Arguments @("sql", "instances", "describe", $InstanceName, "--project=$ProjectId", "--format=json")
$Instance = if ($InstanceResult.exit_code -eq 0) { Convert-JsonOutput -Text $InstanceResult.output } else { $null }

$DatabaseNames = @()
if ($Instance) {
  $DatabasesResult = Invoke-Gcloud -Arguments @("sql", "databases", "list", "--instance=$InstanceName", "--project=$ProjectId", "--format=json")
  if ($DatabasesResult.exit_code -eq 0) {
    $DatabaseNames = @((Convert-JsonOutput -Text $DatabasesResult.output) | ForEach-Object { $_.name })
  }
}

$UserNames = @()
if ($Instance) {
  $UsersResult = Invoke-Gcloud -Arguments @("sql", "users", "list", "--instance=$InstanceName", "--project=$ProjectId", "--format=json")
  if ($UsersResult.exit_code -eq 0) {
    $UserNames = @((Convert-JsonOutput -Text $UsersResult.output) | ForEach-Object { $_.name })
  }
}

Write-Host "Validando bucket documental produccion..."
$BucketResult = Invoke-Gcloud -Arguments @("storage", "buckets", "describe", "gs://$DocumentBucketName", "--project=$ProjectId", "--format=json")
$Bucket = if ($BucketResult.exit_code -eq 0) { Convert-JsonOutput -Text $BucketResult.output } else { $null }

Write-Host "Validando secretos produccion..."
$TokenResult = Invoke-Gcloud -Arguments @("auth", "print-access-token")
if ($TokenResult.exit_code -ne 0 -or [string]::IsNullOrWhiteSpace($TokenResult.output)) {
  throw "No se pudo obtener access token para validar versiones de secretos. Detalle: $($TokenResult.output)"
}

$AccessToken = $TokenResult.output.Trim()
$SecretFindings = foreach ($Secret in @($SecretsConfig.secrets)) {
  $VersionsUri = "https://secretmanager.googleapis.com/v1/projects/$ProjectId/secrets/$($Secret.id)/versions"

  try {
    $Versions = Invoke-RestMethod -Method Get -Uri $VersionsUri -Headers @{ Authorization = "Bearer $AccessToken" }
    $EnabledVersions = @($Versions.versions | Where-Object { $_.state -eq "ENABLED" })

    [pscustomobject]@{
      id = $Secret.id
      exists = $true
      enabled_version_count = $EnabledVersions.Count
    }
  } catch {
    [pscustomobject]@{
      id = $Secret.id
      exists = $false
      enabled_version_count = 0
    }
  }
}

Write-Host "Validando Pub/Sub produccion..."
$TopicsResult = Invoke-Gcloud -Arguments @("pubsub", "topics", "list", "--project=$ProjectId", "--format=json")
$ExistingTopicNames = if ($TopicsResult.exit_code -eq 0) {
  @((Convert-JsonOutput -Text $TopicsResult.output) | ForEach-Object { ([string]$_.name) -replace "^.*/topics/", "" })
} else {
  @()
}

$TopicFindings = foreach ($Topic in @($PubSubConfig.topics)) {
  [pscustomobject]@{
    name = $Topic.name
    exists = $ExistingTopicNames -contains $Topic.name
  }
}

$SubscriptionsResult = Invoke-Gcloud -Arguments @("pubsub", "subscriptions", "list", "--project=$ProjectId", "--format=json")
$ExistingSubscriptionNames = if ($SubscriptionsResult.exit_code -eq 0) {
  @((Convert-JsonOutput -Text $SubscriptionsResult.output) | ForEach-Object { ([string]$_.name) -replace "^.*/subscriptions/", "" })
} else {
  @()
}

$SubscriptionFindings = foreach ($Subscription in @($PubSubConfig.subscriptions)) {
  [pscustomobject]@{
    name = $Subscription.name
    topic = $Subscription.topic
    exists = $ExistingSubscriptionNames -contains $Subscription.name
  }
}

$ExpectedDatabaseNames = @($CloudSqlConfig.databases | ForEach-Object { $_.name })
$ExpectedUserNames = @($CloudSqlConfig.iam_database_users | ForEach-Object { $_.cloud_sql_username })

$MissingDatabases = @($ExpectedDatabaseNames | Where-Object { $DatabaseNames -notcontains $_ })
$MissingUsers = @($ExpectedUserNames | Where-Object { $UserNames -notcontains $_ })
$MissingSecrets = @($SecretFindings | Where-Object { -not $_.exists -or $_.enabled_version_count -lt 1 })
$MissingTopics = @($TopicFindings | Where-Object { -not $_.exists })
$MissingSubscriptions = @($SubscriptionFindings | Where-Object { -not $_.exists })

$Ready = (
  ($null -ne $Instance) -and
  ([string]$Instance.state -eq "RUNNABLE") -and
  ([bool]$Instance.settings.backupConfiguration.enabled) -and
  ($MissingDatabases.Count -eq 0) -and
  ($MissingUsers.Count -eq 0) -and
  ($null -ne $Bucket) -and
  ($MissingSecrets.Count -eq 0) -and
  ($MissingTopics.Count -eq 0) -and
  ($MissingSubscriptions.Count -eq 0)
)

$Result = [pscustomobject]@{
  generated_at = (Get-Date).ToString("o")
  project_id = $ProjectId
  environment = "prod"
  cloud_sql = [pscustomobject]@{
    instance_name = $InstanceName
    exists = $null -ne $Instance
    state = if ($Instance) { [string]$Instance.state } else { $null }
    database_version = if ($Instance) { [string]$Instance.databaseVersion } else { $null }
    backup_enabled = if ($Instance) { [bool]$Instance.settings.backupConfiguration.enabled } else { $false }
    deletion_protection = if ($Instance) { [bool]$Instance.settings.deletionProtectionEnabled } else { $false }
    expected_database_count = $ExpectedDatabaseNames.Count
    missing_databases = $MissingDatabases
    expected_iam_user_count = $ExpectedUserNames.Count
    missing_iam_users = $MissingUsers
  }
  storage = [pscustomobject]@{
    document_bucket_name = $DocumentBucketName
    exists = $null -ne $Bucket
    location = if ($Bucket) { [string]$Bucket.location } else { $null }
    uniform_bucket_level_access = if ($Bucket) { [bool]$Bucket.uniform_bucket_level_access } else { $false }
    public_access_prevention = if ($Bucket) { [string]$Bucket.public_access_prevention } else { $null }
  }
  secrets = [pscustomobject]@{
    expected_count = @($SecretsConfig.secrets).Count
    missing_or_without_enabled_version = @($MissingSecrets | ForEach-Object { $_.id })
  }
  pubsub = [pscustomobject]@{
    expected_topic_count = @($PubSubConfig.topics).Count
    missing_topics = @($MissingTopics | ForEach-Object { $_.name })
    expected_subscription_count = @($PubSubConfig.subscriptions).Count
    missing_subscriptions = @($MissingSubscriptions | ForEach-Object { $_.name })
  }
  ready = $Ready
}

$OutputPath = Join-Path -Path $ResolvedOutputDir -ChildPath "verify-prod-infra.json"
$Result | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $OutputPath -Encoding UTF8

@(
  [pscustomobject]@{ Area = "Cloud SQL"; Check = "prod instance RUNNABLE"; Value = (($null -ne $Instance) -and ([string]$Instance.state -eq "RUNNABLE")) },
  [pscustomobject]@{ Area = "Cloud SQL"; Check = "backups enabled"; Value = if ($Instance) { [bool]$Instance.settings.backupConfiguration.enabled } else { $false } },
  [pscustomobject]@{ Area = "Cloud SQL"; Check = "databases complete"; Value = ($MissingDatabases.Count -eq 0) },
  [pscustomobject]@{ Area = "Cloud SQL"; Check = "IAM DB users complete"; Value = ($MissingUsers.Count -eq 0) },
  [pscustomobject]@{ Area = "Storage"; Check = "prod document bucket exists"; Value = ($null -ne $Bucket) },
  [pscustomobject]@{ Area = "Secrets"; Check = "prod secrets ready"; Value = ($MissingSecrets.Count -eq 0) },
  [pscustomobject]@{ Area = "Pub/Sub"; Check = "prod topics ready"; Value = ($MissingTopics.Count -eq 0) },
  [pscustomobject]@{ Area = "Pub/Sub"; Check = "prod subscriptions ready"; Value = ($MissingSubscriptions.Count -eq 0) },
  [pscustomobject]@{ Area = "Overall"; Check = "prod infra ready"; Value = $Ready }
) | Format-Table -AutoSize

Write-Host "Resultado JSON: $OutputPath"

if ($FailOnNotReady -and -not $Ready) {
  exit 2
}
