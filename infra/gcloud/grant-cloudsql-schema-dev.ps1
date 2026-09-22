param(
    [string]$ProjectId = $env:GOOGLE_CLOUD_PROJECT,
    [string]$ConfigPath = $(Join-Path $PSScriptRoot "cloudsql-dev.json"),
    [string]$GcloudPath = $env:GCLOUD_PATH,
    [string]$DockerImage = "postgres:16-alpine",
    [string]$ProxyImage = "gcr.io/cloud-sql-connectors/cloud-sql-proxy:2.18.3",
    [ValidateSet("import", "proxy", "public-ip")]
    [string]$ConnectionMode = "import",
    [string]$ImportBucket = $env:CLOUDSQL_IMPORT_BUCKET,
    [string]$AdminUser = "postgres",
    [string]$AdminPassword = $env:PGPASSWORD,
    [switch]$Execute,
    [switch]$KeepImportObjects,
    [switch]$KeepAuthorizedNetwork
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

function Quote-PgIdentifier {
    param([string]$Value)
    return '"' + ($Value -replace '"', '""') + '"'
}

function New-RandomPassword {
    $Bytes = New-Object byte[] 32
    $Generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try {
        $Generator.GetBytes($Bytes)
    }
    finally {
        $Generator.Dispose()
    }
    return ([Convert]::ToBase64String($Bytes) -replace '[+/=]', 'A').Substring(0, 32)
}

function Invoke-Gcloud {
    param([string[]]$Arguments)

    $RedactedArguments = @($Arguments | ForEach-Object {
        if ($_ -like "--password=*") {
            "--password=<redacted>"
        }
        else {
            $_
        }
    })

    Write-Host "[gcloud] $($RedactedArguments -join ' ')"
    & $script:GcloudCommand @Arguments | Out-Null

    if ($LASTEXITCODE -ne 0) {
        throw "gcloud failed: gcloud $($RedactedArguments -join ' ')"
    }
}

function Invoke-Psql {
    param(
        [string]$HostAddress,
        [string]$DatabaseName,
        [string]$Sql
    )

    $DockerCommand = Get-Command "docker" -ErrorAction SilentlyContinue
    if (-not $DockerCommand) {
        throw "docker was not found. Docker is required because psql is executed from the $DockerImage image."
    }

    $Arguments = @(
        "run",
        "--rm",
        "-i",
        "-e",
        "PGPASSWORD=$script:ResolvedAdminPassword",
        $DockerImage,
        "psql",
        "-h",
        $HostAddress,
        "-p",
        "5432",
        "-U",
        $AdminUser,
        "-d",
        $DatabaseName,
        "-v",
        "ON_ERROR_STOP=1",
        "-f",
        "-"
    )

    if ($script:ConnectionMode -eq "proxy") {
        $Arguments = @(
            "run",
            "--rm",
            "-i",
            "--network",
            $script:DockerNetworkName,
            "-e",
            "PGPASSWORD=$script:ResolvedAdminPassword",
            $DockerImage,
            "psql",
            "-h",
            $script:ProxyContainerName,
            "-p",
            "5432",
            "-U",
            $AdminUser,
            "-d",
            $DatabaseName,
            "-v",
            "ON_ERROR_STOP=1",
            "-f",
            "-"
        )
    }

    Write-Host "[psql] Applying schema grants on $DatabaseName"
    $Sql | & $DockerCommand.Source @Arguments

    if ($LASTEXITCODE -ne 0) {
        throw "psql failed for database: $DatabaseName"
    }
}

function Start-CloudSqlProxy {
    $DockerCommand = Get-Command "docker" -ErrorAction SilentlyContinue
    if (-not $DockerCommand) {
        throw "docker was not found. Docker is required to run Cloud SQL Auth Proxy."
    }

    $script:DockerNetworkName = "venta-pasajes-cloudsql-grants"
    $script:ProxyContainerName = "venta-pasajes-cloudsql-proxy-dev"

    $PreviousErrorActionPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    & $DockerCommand.Source network inspect $script:DockerNetworkName 1>$null 2>$null
    $NetworkInspectExitCode = $LASTEXITCODE
    $ErrorActionPreference = $PreviousErrorActionPreference

    if ($NetworkInspectExitCode -ne 0) {
        & $DockerCommand.Source network create $script:DockerNetworkName | Out-Null
        if ($LASTEXITCODE -ne 0) {
            throw "Could not create Docker network: $script:DockerNetworkName"
        }
    }

    $PreviousErrorActionPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    & $DockerCommand.Source rm -f $script:ProxyContainerName 1>$null 2>$null
    $ErrorActionPreference = $PreviousErrorActionPreference

    $AccessToken = (& $script:GcloudCommand auth print-access-token).Trim()
    if ($LASTEXITCODE -ne 0 -or -not $AccessToken) {
        throw "Could not obtain gcloud access token for Cloud SQL Auth Proxy."
    }

    $ProxyArgs = @(
        "run",
        "-d",
        "--name",
        $script:ProxyContainerName,
        "--network",
        $script:DockerNetworkName,
        $ProxyImage,
        "--address",
        "0.0.0.0",
        "--port",
        "5432",
        "--token",
        $AccessToken,
        "--quiet",
        $script:ConnectionName
    )

    Write-Host "[docker] starting Cloud SQL Auth Proxy container"
    & $DockerCommand.Source @ProxyArgs | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Could not start Cloud SQL Auth Proxy container."
    }

    Start-Sleep -Seconds 6
    $RunningContainer = & $DockerCommand.Source ps --filter "name=$script:ProxyContainerName" --filter "status=running" --format "{{.Names}}" |
        Where-Object { $_ -eq $script:ProxyContainerName } |
        Select-Object -First 1
    if ($RunningContainer -eq $script:ProxyContainerName) {
        return
    }

    $ProxyLogs = & $DockerCommand.Source logs $script:ProxyContainerName 2>&1
    throw "Cloud SQL Auth Proxy container is not running. Logs: $ProxyLogs"
}

function Stop-CloudSqlProxy {
    $DockerCommand = Get-Command "docker" -ErrorAction SilentlyContinue
    if (-not $DockerCommand) {
        return
    }

    if ($script:ProxyContainerName) {
        & $DockerCommand.Source rm -f $script:ProxyContainerName 1>$null 2>$null
    }

    if ($script:DockerNetworkName) {
        & $DockerCommand.Source network rm $script:DockerNetworkName 1>$null 2>$null
    }
}

function Get-PublicIpCidr {
    $PublicIp = (Invoke-RestMethod -Uri "https://api.ipify.org" -TimeoutSec 30).Trim()
    if (-not $PublicIp) {
        throw "Could not resolve current public IP."
    }
    return "$PublicIp/32"
}

function Set-AuthorizedNetworks {
    param([string[]]$Networks)

    if (@($Networks).Count -eq 0) {
        Invoke-Gcloud -Arguments @(
            "sql",
            "instances",
            "patch",
            $script:InstanceName,
            "--project=$ProjectId",
            "--clear-authorized-networks",
            "--quiet"
        )
        return
    }

    Invoke-Gcloud -Arguments @(
        "sql",
        "instances",
        "patch",
        $script:InstanceName,
        "--project=$ProjectId",
        "--authorized-networks=$(@($Networks) -join ',')",
        "--quiet"
    )
}

function Ensure-ImportBucket {
    param(
        [string]$BucketName,
        [string]$Location,
        [string]$CloudSqlServiceAccount
    )

    $BucketUri = "gs://$BucketName"

    $PreviousErrorActionPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    & $script:GcloudCommand storage buckets describe $BucketUri "--project=$ProjectId" 1>$null 2>$null
    $BucketDescribeExitCode = $LASTEXITCODE
    $ErrorActionPreference = $PreviousErrorActionPreference

    if ($BucketDescribeExitCode -ne 0) {
        Invoke-Gcloud -Arguments @(
            "storage",
            "buckets",
            "create",
            $BucketUri,
            "--project=$ProjectId",
            "--location=$Location",
            "--uniform-bucket-level-access"
        )
    }

    Invoke-Gcloud -Arguments @(
        "storage",
        "buckets",
        "add-iam-policy-binding",
        $BucketUri,
        "--member=serviceAccount:$CloudSqlServiceAccount",
        "--role=roles/storage.objectViewer",
        "--quiet"
    )
}

function Invoke-SqlImportGrants {
    param(
        [object[]]$Grants,
        [string]$BucketName,
        [string]$CloudSqlServiceAccount
    )

    Ensure-ImportBucket -BucketName $BucketName -Location $Config.instance.region -CloudSqlServiceAccount $CloudSqlServiceAccount

    $Timestamp = Get-Date -Format "yyyyMMddHHmmss"
    $Imported = @()

    foreach ($Grant in $Grants) {
        $Sql = @"
GRANT CONNECT ON DATABASE $(Quote-PgIdentifier $Grant.database) TO $(Quote-PgIdentifier $Grant.grantee);
GRANT USAGE, CREATE ON SCHEMA public TO $(Quote-PgIdentifier $Grant.grantee);
"@
        $SafeDatabaseName = $Grant.database -replace '[^A-Za-z0-9_-]', '-'
        $LocalSqlPath = Join-Path $LogDir "grant-$SafeDatabaseName-$Timestamp.sql"
        $ObjectUri = "gs://$BucketName/cloudsql-grants/grant-$SafeDatabaseName-$Timestamp.sql"

        $Sql | Set-Content -LiteralPath $LocalSqlPath -Encoding UTF8

        Invoke-Gcloud -Arguments @(
            "storage",
            "cp",
            $LocalSqlPath,
            $ObjectUri
        )

        Invoke-Gcloud -Arguments @(
            "sql",
            "import",
            "sql",
            $script:InstanceName,
            $ObjectUri,
            "--project=$ProjectId",
            "--database=$($Grant.database)",
            "--quiet"
        )

        if (-not $KeepImportObjects) {
            Invoke-Gcloud -Arguments @(
                "storage",
                "rm",
                $ObjectUri,
                "--quiet"
            )
        }

        $Imported += [pscustomobject]@{
            database = $Grant.database
            grantee = $Grant.grantee
            object_uri = $ObjectUri
            local_sql = $LocalSqlPath
        }
    }

    return $Imported
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

$script:InstanceName = $Config.instance.name
$InstanceJson = & $script:GcloudCommand sql instances describe $script:InstanceName "--project=$ProjectId" "--format=json"
if ($LASTEXITCODE -ne 0) {
    throw "Cloud SQL instance was not found or cannot be accessed: $script:InstanceName"
}

$InstanceState = $InstanceJson | ConvertFrom-Json
$script:ConnectionName = "$ProjectId`:$($Config.instance.region)`:$script:InstanceName"
$ProjectNumber = (& $script:GcloudCommand projects describe $ProjectId "--format=value(projectNumber)").Trim()
if (-not $ProjectNumber) {
    throw "Could not resolve project number for project: $ProjectId"
}

if (-not $ImportBucket) {
    $ImportBucket = "venta-pasajes-dev-sql-imports-$ProjectNumber"
}
$ImportBucket = $ImportBucket -replace '^gs://', ''

$CloudSqlServiceAccount = $InstanceState.serviceAccountEmailAddress
if (-not $CloudSqlServiceAccount) {
    throw "Could not resolve Cloud SQL service account for instance: $script:InstanceName"
}

$PrimaryIp = @($InstanceState.ipAddresses | Where-Object type -eq "PRIMARY" | Select-Object -First 1).ipAddress
if ($ConnectionMode -eq "public-ip" -and -not $PrimaryIp) {
    throw "Cloud SQL instance does not have a public PRIMARY IP. Use Cloud SQL Auth Proxy instead."
}

$ExistingAuthorizedNetworks = @($InstanceState.settings.ipConfiguration.authorizedNetworks | ForEach-Object { $_.value } | Where-Object { $_ })
$CurrentIpCidr = if ($ConnectionMode -eq "public-ip") { Get-PublicIpCidr } else { $null }
$GrantPlan = @()

foreach ($Database in @($Config.databases)) {
    $User = if ($Database.iam_database_user) {
        $Database.iam_database_user
    }
    else {
        @($Config.iam_database_users | Where-Object database -eq $Database.name | Select-Object -First 1).cloud_sql_username
    }

    if (-not $User) {
        throw "No IAM database user found for database: $($Database.name)"
    }

    $GrantPlan += [pscustomobject]@{
        database = $Database.name
        schema = "public"
        grantee = $User
        sql = "GRANT CONNECT ON DATABASE $(Quote-PgIdentifier $Database.name) TO $(Quote-PgIdentifier $User); GRANT USAGE, CREATE ON SCHEMA public TO $(Quote-PgIdentifier $User);"
    }
}

$LogDir = Join-Path (Split-Path $PSScriptRoot -Parent) "..\logs\cloudsql-dev"
$LogDir = [System.IO.Path]::GetFullPath($LogDir)
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

$Result = [ordered]@{
    project_id = $ProjectId
    instance_name = $script:InstanceName
    connection_name = $script:ConnectionName
    connection_mode = $ConnectionMode
    import_bucket = $ImportBucket
    cloud_sql_service_account = $CloudSqlServiceAccount
    primary_ip = $PrimaryIp
    current_authorized_network = $CurrentIpCidr
    existing_authorized_networks = $ExistingAuthorizedNetworks
    execute = [bool]$Execute
    grants = $GrantPlan
}

if ($Execute) {
    if ($ConnectionMode -eq "import") {
        $Imported = Invoke-SqlImportGrants -Grants $GrantPlan -BucketName $ImportBucket -CloudSqlServiceAccount $CloudSqlServiceAccount
        $Result.imports = $Imported
        $Result.import_objects_removed = -not [bool]$KeepImportObjects
    }
    else {
        $AuthorizedNetworkApplied = $false
        $ProxyStarted = $false
        $script:ResolvedAdminPassword = $AdminPassword
        $PasswordRotated = $false

        if (-not $script:ResolvedAdminPassword) {
            $script:ResolvedAdminPassword = New-RandomPassword
            $PasswordRotated = $true
            Invoke-Gcloud -Arguments @(
                "sql",
                "users",
                "set-password",
                $AdminUser,
                "--instance=$script:InstanceName",
                "--project=$ProjectId",
                "--password=$script:ResolvedAdminPassword"
            )
        }

        try {
            if ($ConnectionMode -eq "proxy") {
                $script:ConnectionMode = "proxy"
                Start-CloudSqlProxy
                $ProxyStarted = $true
            }
            else {
                $script:ConnectionMode = "public-ip"
                $NetworksForExecution = @($ExistingAuthorizedNetworks + $CurrentIpCidr | Select-Object -Unique)
                Set-AuthorizedNetworks -Networks $NetworksForExecution
                $AuthorizedNetworkApplied = $true
            }

            foreach ($Grant in $GrantPlan) {
                $Sql = @"
\set ON_ERROR_STOP on
GRANT CONNECT ON DATABASE $(Quote-PgIdentifier $Grant.database) TO $(Quote-PgIdentifier $Grant.grantee);
GRANT USAGE, CREATE ON SCHEMA public TO $(Quote-PgIdentifier $Grant.grantee);
"@
                Invoke-Psql -HostAddress $PrimaryIp -DatabaseName $Grant.database -Sql $Sql
            }
        }
        finally {
            if ($AuthorizedNetworkApplied -and -not $KeepAuthorizedNetwork) {
                Set-AuthorizedNetworks -Networks $ExistingAuthorizedNetworks
            }

            if ($ProxyStarted) {
                Stop-CloudSqlProxy
            }
        }

        $Result.postgres_password_rotated = $PasswordRotated
        $Result.authorized_network_restored = if ($ConnectionMode -eq "public-ip") { -not [bool]$KeepAuthorizedNetwork } else { $null }
        $Result.proxy_used = $ConnectionMode -eq "proxy"
    }
}

$PlanPath = Join-Path $LogDir "grant-cloudsql-schema-dev.plan.json"
$Result | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $PlanPath -Encoding UTF8

Write-Host "Cloud SQL schema grant plan generated."
Write-Host "Plan: $PlanPath"
$GrantPlan | Select-Object database, schema, grantee | Format-Table -AutoSize
