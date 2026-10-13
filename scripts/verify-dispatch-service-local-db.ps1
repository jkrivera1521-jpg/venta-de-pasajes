param(
    [int]$DatabasePort = 55436,
    [int]$HttpPort = 18084,
    [string]$PostgresImage = "postgres:16-alpine",
    [string]$ContainerName = "venta-pasajes-dispatch-pg-$PID"
)

$ErrorActionPreference = "Stop"

$Root = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")
$ServiceRoot = Join-Path $Root "services\dispatch-service"
$JarPath = Join-Path $ServiceRoot "target\quarkus-app\quarkus-run.jar"
$TargetDir = Join-Path $ServiceRoot "target"
$StdOutPath = Join-Path $TargetDir "dispatch-service-local-db.out.log"
$StdErrPath = Join-Path $TargetDir "dispatch-service-local-db.err.log"

$AppProcess = $null
$ContainerStarted = $false
$PostgresPassword = [Convert]::ToBase64String(([guid]::NewGuid()).ToByteArray()).TrimEnd("=")

function Assert-ExitCode {
    param(
        [int]$ExitCode,
        [string]$Message
    )

    if ($ExitCode -ne 0) {
        throw $Message
    }
}

function Wait-Postgres {
    for ($Attempt = 1; $Attempt -le 45; $Attempt++) {
        & docker exec $ContainerName pg_isready -U postgres -d dispatch_db | Out-Null
        if ($LASTEXITCODE -eq 0) {
            return
        }

        Start-Sleep -Seconds 2
    }

    throw "PostgreSQL container did not become ready."
}

function Wait-ServiceReady {
    $ReadyUri = "http://localhost:$HttpPort/q/health/ready"

    for ($Attempt = 1; $Attempt -le 45; $Attempt++) {
        try {
            $Response = Invoke-RestMethod -Uri $ReadyUri -TimeoutSec 3
            if ($Response.status -eq "UP") {
                return $true
            }
        } catch {
            Start-Sleep -Seconds 2
        }
    }

    return $false
}

function Invoke-DispatchJson {
    param([string]$Path)

    Invoke-RestMethod -Uri "http://localhost:$HttpPort/api/v1/dispatch$Path" `
        -Method Get `
        -TimeoutSec 10
}

if (!(Test-Path -LiteralPath $JarPath)) {
    throw "Quarkus JVM artifact was not found. Run: mvn -f .\services\dispatch-service\pom.xml package -DskipTests"
}

try {
    & docker run --rm --name $ContainerName `
        -e POSTGRES_DB=dispatch_db `
        -e POSTGRES_USER=postgres `
        -e "POSTGRES_PASSWORD=$PostgresPassword" `
        -p "$DatabasePort`:5432" `
        -d $PostgresImage | Out-Null
    Assert-ExitCode -ExitCode $LASTEXITCODE -Message "Could not start PostgreSQL container."
    $ContainerStarted = $true

    Wait-Postgres

    $env:QUARKUS_PROFILE = "onprem"
    $env:QUARKUS_HTTP_PORT = [string]$HttpPort
    $env:APP_ENV = "local"
    $env:APP_RUNTIME_TARGET = "onprem"
    $env:APP_SECRETS_PROVIDER = "env"
    $env:APP_DB_NAME = "dispatch_db"
    $env:APP_DB_JDBC_URL = "jdbc:postgresql://localhost:$DatabasePort/dispatch_db"
    $env:APP_DB_USERNAME = "postgres"
    $env:APP_DB_PASSWORD = $PostgresPassword
    $env:QUARKUS_FLYWAY_MIGRATE_AT_START = "true"
    $env:APP_LOG_CONSOLE_JSON = "false"

    $AppProcess = Start-Process `
        -FilePath "java" `
        -ArgumentList @("-jar", $JarPath) `
        -RedirectStandardOutput $StdOutPath `
        -RedirectStandardError $StdErrPath `
        -WindowStyle Hidden `
        -PassThru

    if (!(Wait-ServiceReady)) {
        $ErrorPreview = ""
        if (Test-Path -LiteralPath $StdErrPath) {
            $ErrorPreview = (Get-Content -LiteralPath $StdErrPath -Tail 60) -join "`n"
        }
        throw "dispatch-service did not become ready. Recent stderr:`n$ErrorPreview"
    }

    $Health = Invoke-DispatchJson -Path "/health"
    $Overview = Invoke-DispatchJson -Path ""
    $Resources = Invoke-DispatchJson -Path "/resources"
    $DepartureStatuses = Invoke-DispatchJson -Path "/departure-statuses"
    $SeatPositions = Invoke-DispatchJson -Path "/seat-positions"
    $OpenApi = Invoke-RestMethod -Uri "http://localhost:$HttpPort/q/openapi" -Method Get -TimeoutSec 10

    $TableSql = "select count(*) from information_schema.tables where table_schema = 'public' and table_name in ('terminals','routes','bus_types','seat_layouts','seat_layout_seats','buses','departures','outbox_events');"
    $TableCountText = & docker exec -e "PGPASSWORD=$PostgresPassword" $ContainerName `
        psql -U postgres -d dispatch_db -tAc $TableSql
    Assert-ExitCode -ExitCode $LASTEXITCODE -Message "Could not query dispatch_db tables."

    $TableCount = [int](($TableCountText | Select-Object -First 1).Trim())
    if ($TableCount -ne 8) {
        throw "Expected 8 dispatch tables, but found $TableCount."
    }

    if ($Health.service -ne "dispatch-service") {
        throw "Unexpected health service value."
    }

    if ($Overview.database -ne "dispatch_db") {
        throw "Unexpected overview database value."
    }

    if (@($Resources).Count -lt 6) {
        throw "Expected at least 6 dispatch resources."
    }

    if (@($DepartureStatuses).Count -ne 4) {
        throw "Expected 4 departure statuses."
    }

    if (@($SeatPositions).Count -ne 5) {
        throw "Expected 5 seat positions."
    }

    if ([string]$OpenApi -notlike "*Dispatch Service API*") {
        throw "OpenAPI document did not contain expected title."
    }

    [pscustomobject]@{
        service = "dispatch-service"
        quarkus_profile = "onprem"
        secrets_provider = "env"
        database = "dispatch_db"
        migration_tool = "flyway"
        database_port = $DatabasePort
        http_port = $HttpPort
        health_ready = "UP"
        dispatch_tables = $TableCount
        resources_count = @($Resources).Count
        departure_statuses_count = @($DepartureStatuses).Count
        seat_positions_count = @($SeatPositions).Count
        openapi_title = "Dispatch Service API"
        container = $ContainerName
        ready = $true
    } | ConvertTo-Json -Depth 5 -Compress
} finally {
    if ($AppProcess -and !$AppProcess.HasExited) {
        Stop-Process -Id $AppProcess.Id -Force
    }

    if ($ContainerStarted) {
        & docker stop $ContainerName | Out-Null
    }

    foreach ($Name in @(
        "QUARKUS_PROFILE",
        "QUARKUS_HTTP_PORT",
        "APP_ENV",
        "APP_RUNTIME_TARGET",
        "APP_SECRETS_PROVIDER",
        "APP_DB_NAME",
        "APP_DB_JDBC_URL",
        "APP_DB_USERNAME",
        "APP_DB_PASSWORD",
        "QUARKUS_FLYWAY_MIGRATE_AT_START",
        "APP_LOG_CONSOLE_JSON"
    )) {
        Remove-Item -LiteralPath "Env:\$Name" -ErrorAction SilentlyContinue
    }
}
