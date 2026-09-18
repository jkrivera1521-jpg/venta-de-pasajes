param(
    [string]$ImageTag = "dispatch-service:0.1.0-native",
    [int]$HttpPort = 18089,
    [int]$DatabasePort = 55441,
    [int]$TimeoutSeconds = 120
)

$ErrorActionPreference = "Stop"

$NetworkName = "venta-pasajes-dispatch-native-$PID"
$PostgresContainer = "venta-pasajes-dispatch-native-pg-$PID"
$ServiceContainer = "venta-pasajes-dispatch-native-app-$PID"
$DatabaseName = "dispatch_db"
$DatabaseUser = "postgres"
$DatabasePassword = [Guid]::NewGuid().ToString("N")

function Invoke-Docker {
    param([string[]]$Arguments)

    & docker @Arguments *> $null
    $ExitCode = $LASTEXITCODE
    if ($ExitCode -ne 0) {
        throw "docker failed with exit code ${ExitCode}: $($Arguments -join ' ')"
    }
}

function Test-DockerContainerExists {
    param([string]$Name)

    $ContainerId = & docker ps -aq --filter "name=^/$Name$"
    return [bool]$ContainerId
}

function Remove-DockerContainerIfExists {
    param([string]$Name)

    if (Test-DockerContainerExists -Name $Name) {
        & docker rm -f $Name 2>$null | Out-Null
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

$StartupWatch = $null
$StartupMilliseconds = $null

try {
    Invoke-Docker -Arguments @("network", "create", $NetworkName)

    Invoke-Docker -Arguments @(
        "run",
        "--name",
        $PostgresContainer,
        "--network",
        $NetworkName,
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

    Wait-Until -Seconds $TimeoutSeconds -FailureMessage "PostgreSQL container was not ready." -Condition {
        & docker run --rm --network $NetworkName postgres:16-alpine pg_isready -h $PostgresContainer -p 5432 -U $DatabaseUser -d $DatabaseName | Out-Null
        return $LASTEXITCODE -eq 0
    }

    $StartupWatch = [System.Diagnostics.Stopwatch]::StartNew()

    Invoke-Docker -Arguments @(
        "run",
        "--name",
        $ServiceContainer,
        "--network",
        $NetworkName,
        "-p",
        "${HttpPort}:8082",
        "-e",
        "APP_ENV=onprem",
        "-e",
        "APP_RUNTIME_TARGET=onprem",
        "-e",
        "APP_SECRETS_PROVIDER=env",
        "-e",
        "QUARKUS_PROFILE=onprem",
        "-e",
        "QUARKUS_HTTP_PORT=8082",
        "-e",
        "QUARKUS_FLYWAY_MIGRATE_AT_START=true",
        "-e",
        "APP_DB_NAME=$DatabaseName",
        "-e",
        "APP_DB_JDBC_URL=jdbc:postgresql://${PostgresContainer}:5432/$DatabaseName",
        "-e",
        "APP_DB_USERNAME=$DatabaseUser",
        "-e",
        "APP_DB_PASSWORD=$DatabasePassword",
        "-e",
        "APP_LOG_CONSOLE_JSON=false",
        "-d",
        $ImageTag
    )

    Wait-Until -Seconds $TimeoutSeconds -FailureMessage "dispatch-service native container was not ready." -Condition {
        $Health = Invoke-RestMethod -Uri "http://localhost:$HttpPort/q/health/ready" -Method Get -TimeoutSec 2
        return $Health.status -eq "UP"
    }

    $StartupWatch.Stop()
    $StartupMilliseconds = $StartupWatch.ElapsedMilliseconds

    $HealthResponse = Invoke-RestMethod -Uri "http://localhost:$HttpPort/api/v1/dispatch/health" -Method Get -TimeoutSec 5
    $OverviewResponse = Invoke-RestMethod -Uri "http://localhost:$HttpPort/api/v1/dispatch" -Method Get -TimeoutSec 5
    $ResourcesResponse = Invoke-RestMethod -Uri "http://localhost:$HttpPort/api/v1/dispatch/resources" -Method Get -TimeoutSec 5
    $SeatLayoutPage = Invoke-RestMethod -Uri "http://localhost:$HttpPort/api/v1/dispatch/seat-layouts?q=Legacy%2025%20asientos&active=true&page=1&page_size=10" -Method Get -TimeoutSec 5

    $ActorId = "00000000-0000-0000-0000-000000000026"
    $CorrelationId = ([Guid]::NewGuid()).ToString()
    $TerminalBody = @{
        legacy_id = 2601
        local_code = "D26"
        name = "Terminal Native Dia 26"
        manager_name = "Operador Native"
        address = "Av. Native Dia 26"
        phone = "022600001"
        email = "native26@example.local"
    } | ConvertTo-Json -Compress

    $TerminalResponse = Invoke-RestMethod -Uri "http://localhost:$HttpPort/api/v1/dispatch/terminals" `
        -Method Post `
        -ContentType "application/json" `
        -Headers @{
            "X-Actor-User-Id" = $ActorId
            "X-Correlation-Id" = $CorrelationId
        } `
        -Body $TerminalBody `
        -TimeoutSec 5

    $StatsJson = & docker stats $ServiceContainer --no-stream --format "{{json .}}"
    $Stats = $null
    if ($LASTEXITCODE -eq 0 -and $StatsJson) {
        $Stats = $StatsJson | ConvertFrom-Json
    }

    [pscustomobject]@{
        service = "dispatch-service"
        runtime = "native-container"
        image = $ImageTag
        quarkus_profile = "onprem"
        database = $DatabaseName
        migration_tool = "flyway"
        http_port = $HttpPort
        database_port = $DatabasePort
        startup_ms = $StartupMilliseconds
        health_status = $HealthResponse.status
        overview_service = $OverviewResponse.service
        resources_count = @($ResourcesResponse).Count
        seed_layout_count = @($SeatLayoutPage.data).Count
        created_terminal_id = $TerminalResponse.id
        memory_usage = $(if ($Stats) { $Stats.MemUsage } else { $null })
        cpu_percent = $(if ($Stats) { $Stats.CPUPerc } else { $null })
        network = $NetworkName
        ready = $true
    } | ConvertTo-Json -Depth 5 -Compress
} catch {
    if ($StartupWatch -and $StartupWatch.IsRunning) {
        $StartupWatch.Stop()
    }

    if (Test-DockerContainerExists -Name $ServiceContainer) {
        $ServiceLogs = & docker logs $ServiceContainer 2>&1 | Select-Object -Last 120
        if ($ServiceLogs) {
            Write-Host ($ServiceLogs -join [Environment]::NewLine)
        }
    }

    throw
} finally {
    Remove-DockerContainerIfExists -Name $ServiceContainer
    Remove-DockerContainerIfExists -Name $PostgresContainer
    & docker network rm $NetworkName 2>$null | Out-Null
}
