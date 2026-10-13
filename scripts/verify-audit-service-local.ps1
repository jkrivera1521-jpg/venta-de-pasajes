param(
    [int]$DatabasePort = 55455,
    [int]$HttpPort = 18099,
    [int]$TimeoutSeconds = 120,
    [switch]$SkipPackage
)

$ErrorActionPreference = "Stop"

$Root = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")
$ServiceRoot = Join-Path $Root "services\audit-service"
$JarPath = Join-Path $ServiceRoot "target\quarkus-app\quarkus-run.jar"
$TargetDir = Join-Path $Root "logs\dia-42"
$StdOutPath = Join-Path $TargetDir "audit-service.out.log"
$StdErrPath = Join-Path $TargetDir "audit-service.err.log"
$ContainerName = "venta-pasajes-d42-audit-pg-$PID"
$DatabaseName = "audit_db"
$DatabaseUser = "postgres"
$DatabasePassword = [Guid]::NewGuid().ToString("N")
$AppProcess = $null
$DockerAvailable = $false

function Invoke-NativeCommand {
    param(
        [string]$FilePath,
        [string[]]$Arguments
    )

    $PreviousErrorActionPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        $Output = & $FilePath @Arguments 2>&1
        $ExitCode = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $PreviousErrorActionPreference
    }

    [pscustomobject]@{
        ExitCode = $ExitCode
        Output = @($Output)
    }
}

function Invoke-Docker {
    param([string[]]$Arguments)

    $Result = Invoke-NativeCommand -FilePath "docker" -Arguments $Arguments
    if ($Result.ExitCode -ne 0) {
        throw "docker failed with exit code $($Result.ExitCode): $($Arguments -join ' '). Output: $($Result.Output -join [Environment]::NewLine)"
    }
}

function Assert-DockerAvailable {
    $Result = Invoke-NativeCommand -FilePath "docker" -Arguments @("info")
    if ($Result.ExitCode -ne 0) {
        $OutputText = $Result.Output -join [Environment]::NewLine
        $Reason = if ($OutputText -match "dockerDesktopLinuxEngine") {
            "Docker Desktop Linux engine pipe is not available."
        } else {
            (($Result.Output | Select-Object -Last 8) -join [Environment]::NewLine)
        }

        throw "Docker engine is not available. $Reason Start Docker Desktop and wait until docker info succeeds."
    }

    $script:DockerAvailable = $true
}

function Assert-PortAvailable {
    param(
        [int]$Port,
        [string]$Purpose
    )

    $Connection = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
    if ($Connection) {
        $Owners = @($Connection | Select-Object -ExpandProperty OwningProcess -Unique)
        throw "Port $Port for $Purpose is already in use. Owners: $($Owners -join ', ')"
    }
}

function Assert-Condition {
    param(
        [bool]$Condition,
        [string]$Message
    )

    if (!$Condition) {
        throw $Message
    }
}

function Wait-Until {
    param(
        [scriptblock]$Condition,
        [int]$Seconds,
        [string]$FailureMessage
    )

    $Deadline = (Get-Date).AddSeconds($Seconds)
    while ((Get-Date) -lt $Deadline) {
        try {
            if (& $Condition) {
                return
            }
        } catch {
            Start-Sleep -Milliseconds 500
        }

        Start-Sleep -Milliseconds 500
    }

    throw $FailureMessage
}

function Remove-DockerContainerIfExists {
    param([string]$Name)

    if (!$DockerAvailable) {
        return
    }

    $Result = Invoke-NativeCommand -FilePath "docker" -Arguments @("ps", "-aq", "--filter", "name=^/$Name$")
    if ($Result.ExitCode -eq 0 -and ($Result.Output -join "")) {
        Invoke-NativeCommand -FilePath "docker" -Arguments @("rm", "-f", $Name) | Out-Null
    }
}

$EnvNames = @(
    "APP_ENV",
    "APP_RUNTIME_TARGET",
    "APP_SECRETS_PROVIDER",
    "APP_DB_NAME",
    "APP_DB_JDBC_URL",
    "APP_DB_USERNAME",
    "APP_DB_PASSWORD",
    "APP_LOG_CONSOLE_JSON",
    "QUARKUS_PROFILE",
    "QUARKUS_HTTP_PORT",
    "QUARKUS_FLYWAY_MIGRATE_AT_START"
)
$PreviousEnv = @{}

try {
    New-Item -ItemType Directory -Force -Path $TargetDir | Out-Null

    Assert-DockerAvailable
    Assert-PortAvailable -Port $DatabasePort -Purpose "audit PostgreSQL"
    Assert-PortAvailable -Port $HttpPort -Purpose "audit-service HTTP"

    if (!$SkipPackage -or !(Test-Path -LiteralPath $JarPath)) {
        & mvn -f (Join-Path $ServiceRoot "pom.xml") -DskipTests clean package
        if ($LASTEXITCODE -ne 0) {
            throw "audit-service package failed with exit code $LASTEXITCODE."
        }
    }

    foreach ($Name in $EnvNames) {
        $PreviousEnv[$Name] = [Environment]::GetEnvironmentVariable($Name, "Process")
    }

    Invoke-Docker -Arguments @(
        "run",
        "--name",
        $ContainerName,
        "-e",
        "POSTGRES_DB=$DatabaseName",
        "-e",
        "POSTGRES_USER=$DatabaseUser",
        "-e",
        "POSTGRES_PASSWORD=$DatabasePassword",
        "-p",
        "${DatabasePort}:5432",
        "-d",
        "postgres:16-alpine"
    )

    Wait-Until -Seconds $TimeoutSeconds -FailureMessage "audit PostgreSQL was not ready." -Condition {
        & docker exec $ContainerName pg_isready -h localhost -p 5432 -U $DatabaseUser -d $DatabaseName | Out-Null
        return $LASTEXITCODE -eq 0
    }

    $env:APP_ENV = "onprem"
    $env:APP_RUNTIME_TARGET = "onprem"
    $env:APP_SECRETS_PROVIDER = "env"
    $env:APP_DB_NAME = $DatabaseName
    $env:APP_DB_JDBC_URL = "jdbc:postgresql://localhost:$DatabasePort/$DatabaseName"
    $env:APP_DB_USERNAME = $DatabaseUser
    $env:APP_DB_PASSWORD = $DatabasePassword
    $env:APP_LOG_CONSOLE_JSON = "false"
    $env:QUARKUS_PROFILE = "onprem"
    $env:QUARKUS_HTTP_PORT = "$HttpPort"
    $env:QUARKUS_FLYWAY_MIGRATE_AT_START = "true"

    $AppProcess = Start-Process `
        -FilePath "java" `
        -ArgumentList @("-jar", $JarPath) `
        -WorkingDirectory $ServiceRoot `
        -RedirectStandardOutput $StdOutPath `
        -RedirectStandardError $StdErrPath `
        -PassThru `
        -WindowStyle Hidden

    Wait-Until -Seconds $TimeoutSeconds -FailureMessage "audit-service was not ready." -Condition {
        $Health = Invoke-RestMethod -Uri "http://localhost:$HttpPort/q/health/ready" -TimeoutSec 2
        return $Health.status -eq "UP"
    }

    $HealthResponse = Invoke-RestMethod -Uri "http://localhost:$HttpPort/api/v1/audit/health" -TimeoutSec 5
    $OverviewResponse = Invoke-RestMethod -Uri "http://localhost:$HttpPort/api/v1/audit" -TimeoutSec 5
    $ResourcesResponse = Invoke-RestMethod -Uri "http://localhost:$HttpPort/api/v1/audit/resources" -TimeoutSec 5

    $Now = (Get-Date).ToUniversalTime()
    $EventId = [guid]::NewGuid().ToString()
    $CorrelationId = [guid]::NewGuid().ToString()
    $ActorUserId = [guid]::NewGuid().ToString()
    $ResourceId = [guid]::NewGuid().ToString()
    $IdempotencyKey = "audit-d42-$EventId"

    $Payload = @{
        event_id = $EventId
        event_type = "TicketCancelled"
        schema_version = 1
        occurred_at = $Now.ToString("o")
        source_service = "ticketing-service"
        correlation_id = $CorrelationId
        actor_user_id = $ActorUserId
        action = "ticket.cancelled"
        resource_type = "ticket"
        resource_id = $ResourceId
        payload = @{
            ticket_number = "AUD-$($Now.ToString("yyyyMMddHHmmss"))"
            reason = "Validacion Dia 42"
            amount = 25.50
            currency = "USD"
        }
    } | ConvertTo-Json -Depth 8 -Compress

    $Headers = @{
        "Idempotency-Key" = $IdempotencyKey
    }

    $Created = Invoke-RestMethod `
        -Uri "http://localhost:$HttpPort/api/v1/audit/audit-events" `
        -Method Post `
        -Headers $Headers `
        -ContentType "application/json" `
        -Body $Payload `
        -TimeoutSec 10

    $Duplicate = Invoke-RestMethod `
        -Uri "http://localhost:$HttpPort/api/v1/audit/audit-events" `
        -Method Post `
        -Headers $Headers `
        -ContentType "application/json" `
        -Body $Payload `
        -TimeoutSec 10

    Assert-Condition -Condition ($Created.processed -eq $true) -Message "Expected first audit event to be processed."
    Assert-Condition -Condition ($Duplicate.processed -eq $false) -Message "Expected duplicate audit event to be ignored."

    $Found = Invoke-RestMethod -Uri "http://localhost:$HttpPort/api/v1/audit/audit-events/$EventId" -TimeoutSec 10
    Assert-Condition -Condition ($Found.event_id -eq $EventId) -Message "Expected event lookup by id."
    Assert-Condition -Condition ($Found.action -eq "ticket.cancelled") -Message "Expected action ticket.cancelled."

    $Search = Invoke-RestMethod `
        -Uri "http://localhost:$HttpPort/api/v1/audit/audit-events?action=ticket.cancelled&resource_type=ticket&page=1&page_size=10" `
        -TimeoutSec 10
    Assert-Condition -Condition ($Search.meta.total_items -ge 1) -Message "Expected at least one searched audit event."

    $AuditRowsRaw = & docker exec $ContainerName psql -U $DatabaseUser -d $DatabaseName -tAc "select count(*) from audit_events;"
    $ProcessedRowsRaw = & docker exec $ContainerName psql -U $DatabaseUser -d $DatabaseName -tAc "select count(*) from processed_events;"
    $OutboxRowsRaw = & docker exec $ContainerName psql -U $DatabaseUser -d $DatabaseName -tAc "select count(*) from outbox_events where event_type = 'AuditEventCreated';"

    $AuditRows = [int]($AuditRowsRaw.Trim())
    $ProcessedRows = [int]($ProcessedRowsRaw.Trim())
    $OutboxRows = [int]($OutboxRowsRaw.Trim())

    Assert-Condition -Condition ($AuditRows -eq 1) -Message "Expected one audit_events row."
    Assert-Condition -Condition ($ProcessedRows -eq 1) -Message "Expected one processed_events row because duplicate is ignored idempotently."
    Assert-Condition -Condition ($OutboxRows -eq 1) -Message "Expected one AuditEventCreated outbox row."

    [pscustomobject]@{
        service = "audit-service"
        runtime = "jvm"
        quarkus_profile = "onprem"
        database = $DatabaseName
        migration_tool = "flyway"
        http_port = $HttpPort
        database_port = $DatabasePort
        health_status = $HealthResponse.status
        overview_service = $OverviewResponse.service
        resources_count = @($ResourcesResponse).Count
        event_id = $EventId
        action = $Found.action
        first_event_processed = $Created.processed
        duplicate_event_processed = $Duplicate.processed
        audit_events = $AuditRows
        processed_events = $ProcessedRows
        outbox_audit_event_created = $OutboxRows
        search_total_items = $Search.meta.total_items
        ready = $true
    } | ConvertTo-Json -Depth 5 -Compress
} catch {
    foreach ($LogFile in @($StdErrPath, $StdOutPath)) {
        $Preview = Get-Content -LiteralPath $LogFile -ErrorAction SilentlyContinue | Select-Object -Last 120
        if ($Preview) {
            Write-Host ($Preview -join [Environment]::NewLine)
        }
    }
    throw
} finally {
    if ($AppProcess -and !$AppProcess.HasExited) {
        Stop-Process -Id $AppProcess.Id -Force
    }

    Remove-DockerContainerIfExists -Name $ContainerName

    foreach ($Name in $EnvNames) {
        if ($PreviousEnv.ContainsKey($Name) -and $null -ne $PreviousEnv[$Name]) {
            [Environment]::SetEnvironmentVariable($Name, $PreviousEnv[$Name], "Process")
        } else {
            [Environment]::SetEnvironmentVariable($Name, $null, "Process")
        }
    }
}
