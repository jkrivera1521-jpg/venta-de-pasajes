param(
    [int]$DatabasePort = 55454,
    [int]$HttpPort = 18098,
    [int]$TimeoutSeconds = 120,
    [switch]$SkipPackage
)

$ErrorActionPreference = "Stop"

$Root = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")
$ServiceRoot = Join-Path $Root "services\reporting-service"
$JarPath = Join-Path $ServiceRoot "target\quarkus-app\quarkus-run.jar"
$TargetDir = Join-Path $Root "logs\dia-39"
$StdOutPath = Join-Path $TargetDir "reporting-service.out.log"
$StdErrPath = Join-Path $TargetDir "reporting-service.err.log"
$ContainerName = "venta-pasajes-d39-reporting-pg-$PID"
$DatabaseName = "reporting_db"
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
        throw "Docker engine is not available. Start Docker Desktop and wait until docker info succeeds."
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

function ConvertTo-Array {
    param($Value)

    if ($null -eq $Value) {
        return @()
    }
    if ($Value -is [System.Array]) {
        return $Value
    }
    return @($Value)
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
    "APP_REPORTING_TIME_ZONE",
    "APP_LOG_CONSOLE_JSON",
    "QUARKUS_PROFILE",
    "QUARKUS_HTTP_PORT",
    "QUARKUS_FLYWAY_MIGRATE_AT_START"
)
$PreviousEnv = @{}

try {
    New-Item -ItemType Directory -Force -Path $TargetDir | Out-Null

    Assert-DockerAvailable
    Assert-PortAvailable -Port $DatabasePort -Purpose "reporting PostgreSQL"
    Assert-PortAvailable -Port $HttpPort -Purpose "reporting-service HTTP"

    if (!$SkipPackage -or !(Test-Path -LiteralPath $JarPath)) {
        & mvn -f (Join-Path $ServiceRoot "pom.xml") -DskipTests clean package
        if ($LASTEXITCODE -ne 0) {
            throw "reporting-service package failed with exit code $LASTEXITCODE."
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

    Wait-Until -Seconds $TimeoutSeconds -FailureMessage "reporting PostgreSQL was not ready." -Condition {
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
    $env:APP_REPORTING_TIME_ZONE = "America/Guayaquil"
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

    Wait-Until -Seconds $TimeoutSeconds -FailureMessage "reporting-service was not ready." -Condition {
        $Health = Invoke-RestMethod -Uri "http://localhost:$HttpPort/q/health/ready" -TimeoutSec 2
        return $Health.status -eq "UP"
    }

    $ReportDate = (Get-Date).ToString("yyyy-MM-dd")
    $Now = (Get-Date).ToUniversalTime()
    $RunId = $Now.ToString("yyyyMMddHHmmssfff")
    $TicketId1 = [guid]::NewGuid().ToString()
    $TicketId2 = [guid]::NewGuid().ToString()
    $DepartureId = [guid]::NewGuid().ToString()
    $RouteId = [guid]::NewGuid().ToString()
    $OriginTerminalId = [guid]::NewGuid().ToString()
    $DestinationTerminalId = [guid]::NewGuid().ToString()
    $SellerA = [guid]::NewGuid().ToString()
    $SellerB = [guid]::NewGuid().ToString()

    $Sale1Payload = @{
        event_id = [guid]::NewGuid().ToString()
        event_type = "TicketSold"
        schema_version = 1
        occurred_at = $Now.AddMinutes(-20).ToString("o")
        source_service = "ticketing-service"
        correlation_id = [guid]::NewGuid().ToString()
        ticket_id = $TicketId1
        ticket_number = "RPT-$RunId-A"
        dispatch_departure_id = $DepartureId
        route_id = $RouteId
        origin_terminal_id = $OriginTerminalId
        destination_terminal_id = $DestinationTerminalId
        passenger_id = [guid]::NewGuid().ToString()
        passenger_name = "Ana Reporte"
        passenger_document_type = "CEDULA"
        passenger_document_number = "3900000001"
        seat_number = "1"
        fare_amount = 25.50
        currency = "USD"
        payment_method = "CASH"
        sold_by_user_id = $SellerA
        seller_display_name = "Operador A"
        bus_code = "BUS-RPT-01"
        origin = "Terminal Quito"
        destination = "Terminal Guayaquil"
        departure_at = $Now.AddHours(4).ToString("o")
    } | ConvertTo-Json -Depth 8 -Compress

    $Sale2Payload = @{
        event_id = [guid]::NewGuid().ToString()
        event_type = "TicketSold"
        schema_version = 1
        occurred_at = $Now.AddMinutes(-10).ToString("o")
        source_service = "ticketing-service"
        correlation_id = [guid]::NewGuid().ToString()
        ticket_id = $TicketId2
        ticket_number = "RPT-$RunId-B"
        dispatch_departure_id = $DepartureId
        route_id = $RouteId
        origin_terminal_id = $OriginTerminalId
        destination_terminal_id = $DestinationTerminalId
        passenger_id = [guid]::NewGuid().ToString()
        passenger_name = "Luis Cancelado"
        passenger_document_type = "CEDULA"
        passenger_document_number = "3900000002"
        seat_number = "2"
        fare_amount = 10.00
        currency = "USD"
        payment_method = "CASH"
        sold_by_user_id = $SellerB
        seller_display_name = "Operador B"
        bus_code = "BUS-RPT-01"
        origin = "Terminal Quito"
        destination = "Terminal Guayaquil"
        departure_at = $Now.AddHours(4).ToString("o")
    } | ConvertTo-Json -Depth 8 -Compress

    $Sale1 = Invoke-RestMethod -Uri "http://localhost:$HttpPort/api/v1/reporting/events/ticket-sold" -Method Post -ContentType "application/json" -Body $Sale1Payload -TimeoutSec 10
    $DuplicateSale1 = Invoke-RestMethod -Uri "http://localhost:$HttpPort/api/v1/reporting/events/ticket-sold" -Method Post -ContentType "application/json" -Body $Sale1Payload -TimeoutSec 10
    $Sale2 = Invoke-RestMethod -Uri "http://localhost:$HttpPort/api/v1/reporting/events/ticket-sold" -Method Post -ContentType "application/json" -Body $Sale2Payload -TimeoutSec 10

    Assert-Condition -Condition ($Sale1.processed -eq $true) -Message "Expected first TicketSold to be processed."
    Assert-Condition -Condition ($DuplicateSale1.processed -eq $false) -Message "Expected duplicate TicketSold to be idempotent."
    Assert-Condition -Condition ($Sale2.processed -eq $true) -Message "Expected second TicketSold to be processed."

    $CancelPayload = @{
        event_id = [guid]::NewGuid().ToString()
        event_type = "TicketCancelled"
        schema_version = 1
        occurred_at = $Now.AddMinutes(-5).ToString("o")
        source_service = "ticketing-service"
        correlation_id = [guid]::NewGuid().ToString()
        ticket_id = $TicketId2
        ticket_number = "RPT-$RunId-B"
        cancelled_at = $Now.AddMinutes(-5).ToString("o")
        cancelled_by_user_id = $SellerB
        cancelled_by = "Operador B"
        reason = "Validacion Dia 39"
        refund_amount = 10.00
    } | ConvertTo-Json -Depth 8 -Compress

    $Cancellation = Invoke-RestMethod -Uri "http://localhost:$HttpPort/api/v1/reporting/events/ticket-cancelled" -Method Post -ContentType "application/json" -Body $CancelPayload -TimeoutSec 10
    Assert-Condition -Condition ($Cancellation.processed -eq $true) -Message "Expected TicketCancelled to be processed."

    $SalesReport = Invoke-RestMethod -Uri "http://localhost:$HttpPort/api/v1/reporting/reports/sales?date_from=$ReportDate&date_to=$ReportDate" -TimeoutSec 10
    $Passengers = @(ConvertTo-Array (Invoke-RestMethod -Uri "http://localhost:$HttpPort/api/v1/reporting/reports/passengers?date_from=$ReportDate&date_to=$ReportDate&q=Ana" -TimeoutSec 10))
    $ByUser = @(ConvertTo-Array (Invoke-RestMethod -Uri "http://localhost:$HttpPort/api/v1/reporting/reports/sales/by-user?date_from=$ReportDate&date_to=$ReportDate" -TimeoutSec 10))
    $ByBus = @(ConvertTo-Array (Invoke-RestMethod -Uri "http://localhost:$HttpPort/api/v1/reporting/reports/sales/by-bus?date_from=$ReportDate&date_to=$ReportDate&group_by=BUS" -TimeoutSec 10))

    Assert-Condition -Condition ($SalesReport.summary.tickets_sold -eq 1) -Message "Expected one active sold ticket."
    Assert-Condition -Condition ($SalesReport.summary.tickets_cancelled -eq 1) -Message "Expected one cancelled ticket."
    Assert-Condition -Condition ([decimal]$SalesReport.summary.gross_amount.amount -eq 35.50) -Message "Expected gross amount 35.50."
    Assert-Condition -Condition ([decimal]$SalesReport.summary.net_amount.amount -eq 25.50) -Message "Expected net amount 25.50."
    Assert-Condition -Condition ($Passengers.Count -eq 1) -Message "Expected one passenger row for Ana."
    Assert-Condition -Condition ($ByUser.Count -ge 1) -Message "Expected at least one sales-by-user row."
    Assert-Condition -Condition ($ByUser[0].tickets_sold -eq 1) -Message "Expected first sales-by-user row to include one active sold ticket."
    Assert-Condition -Condition ($ByBus.Count -ge 1) -Message "Expected sales grouped by bus."

    $FactRowsRaw = & docker exec $ContainerName psql -U $DatabaseUser -d $DatabaseName -tAc "select count(*) from fact_ticket_sales;"
    $ProcessedRowsRaw = & docker exec $ContainerName psql -U $DatabaseUser -d $DatabaseName -tAc "select count(*) from processed_events;"
    $CancelledRowsRaw = & docker exec $ContainerName psql -U $DatabaseUser -d $DatabaseName -tAc "select count(*) from fact_ticket_sales where status = 'CANCELLED';"
    $FactRows = [int]($FactRowsRaw.Trim())
    $ProcessedRows = [int]($ProcessedRowsRaw.Trim())
    $CancelledRows = [int]($CancelledRowsRaw.Trim())

    Assert-Condition -Condition ($FactRows -eq 2) -Message "Expected 2 fact_ticket_sales rows."
    Assert-Condition -Condition ($ProcessedRows -eq 3) -Message "Expected 3 processed_events rows."
    Assert-Condition -Condition ($CancelledRows -eq 1) -Message "Expected 1 cancelled fact row."

    [pscustomobject]@{
        service = "reporting-service"
        runtime = "jvm"
        quarkus_profile = "onprem"
        database = $DatabaseName
        migration_tool = "flyway"
        http_port = $HttpPort
        database_port = $DatabasePort
        health_status = "ok"
        report_date = $ReportDate
        ticket_sold_events_processed = 2
        ticket_cancelled_events_processed = 1
        duplicate_event_processed = $DuplicateSale1.processed
        fact_ticket_sales = $FactRows
        processed_events = $ProcessedRows
        tickets_sold = $SalesReport.summary.tickets_sold
        tickets_cancelled = $SalesReport.summary.tickets_cancelled
        gross_amount = $SalesReport.summary.gross_amount.amount
        net_amount = $SalesReport.summary.net_amount.amount
        passenger_rows = $Passengers.Count
        sales_by_user_rows = $ByUser.Count
        sales_by_bus_rows = $ByBus.Count
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
