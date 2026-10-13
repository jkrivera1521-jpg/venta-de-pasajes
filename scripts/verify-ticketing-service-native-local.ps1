param(
    [string]$ImageTag = "ticketing-service:0.1.0-native",
    [int]$HttpPort = 18096,
    [int]$DatabasePort = 55452,
    [int]$TimeoutSeconds = 120
)

$ErrorActionPreference = "Stop"

$NetworkName = "venta-pasajes-ticketing-native-$PID"
$PostgresContainer = "venta-pasajes-ticketing-native-pg-$PID"
$ServiceContainer = "venta-pasajes-ticketing-native-app-$PID"
$DatabaseName = "ticketing_db"
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

function Assert-Condition {
    param(
        [bool]$Condition,
        [string]$Message
    )

    if (!$Condition) {
        throw $Message
    }
}

function Assert-PortAvailable {
    param([int]$Port)

    $Connection = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
    if ($Connection) {
        throw "Port $Port is already in use."
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
    Assert-PortAvailable -Port $HttpPort
    Assert-PortAvailable -Port $DatabasePort

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
        "${HttpPort}:8083",
        "-e",
        "APP_ENV=onprem",
        "-e",
        "APP_RUNTIME_TARGET=onprem",
        "-e",
        "APP_SECRETS_PROVIDER=env",
        "-e",
        "QUARKUS_PROFILE=onprem",
        "-e",
        "QUARKUS_HTTP_PORT=8083",
        "-e",
        "QUARKUS_FLYWAY_MIGRATE_AT_START=true",
        "-e",
        "APP_RESERVATION_EXPIRATION_JOB_ENABLED=false",
        "-e",
        "APP_DOCUMENT_INTEGRATION_ENABLED=false",
        "-e",
        "APP_DOCUMENT_WORKER_ENABLED=false",
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

    Wait-Until -Seconds $TimeoutSeconds -FailureMessage "ticketing-service native container was not ready." -Condition {
        $Health = Invoke-RestMethod -Uri "http://localhost:$HttpPort/q/health/ready" -Method Get -TimeoutSec 2
        return $Health.status -eq "UP"
    }

    $StartupWatch.Stop()
    $StartupMilliseconds = $StartupWatch.ElapsedMilliseconds

    $HealthResponse = Invoke-RestMethod -Uri "http://localhost:$HttpPort/api/v1/ticketing/health" -Method Get -TimeoutSec 5
    $OverviewResponse = Invoke-RestMethod -Uri "http://localhost:$HttpPort/api/v1/ticketing" -Method Get -TimeoutSec 5
    $ResourcesResponse = Invoke-RestMethod -Uri "http://localhost:$HttpPort/api/v1/ticketing/resources" -Method Get -TimeoutSec 5
    $SeatStatuses = Invoke-RestMethod -Uri "http://localhost:$HttpPort/api/v1/ticketing/seat-statuses" -Method Get -TimeoutSec 5
    $ReservationStatuses = Invoke-RestMethod -Uri "http://localhost:$HttpPort/api/v1/ticketing/reservation-statuses" -Method Get -TimeoutSec 5
    $TicketStatuses = Invoke-RestMethod -Uri "http://localhost:$HttpPort/api/v1/ticketing/ticket-statuses" -Method Get -TimeoutSec 5

    $RunId = (Get-Date).ToUniversalTime().ToString("yyyyMMddHHmmssfff")
    $PassengerPayload = @{
        document_type = "CEDULA"
        document_number = $RunId.Substring($RunId.Length - 10)
        first_name = "Native"
        last_name = "Ticketing"
        email = "native.ticketing.$RunId@example.local"
        phone = "0999999999"
    } | ConvertTo-Json -Depth 8 -Compress

    $Passenger = Invoke-RestMethod `
        -Uri "http://localhost:$HttpPort/api/v1/ticketing/passengers" `
        -Method Post `
        -ContentType "application/json" `
        -Body $PassengerPayload `
        -TimeoutSec 5
    Assert-Condition -Condition ($Passenger.status -eq "ACTIVE") -Message "Expected passenger status ACTIVE, but got $($Passenger.status)."

    $DispatchDepartureId = [guid]::NewGuid().ToString()
    $SyncPayload = @{
        dispatch_departure_id = $DispatchDepartureId
        legacy_id = 3601
        bus_id = [guid]::NewGuid().ToString()
        bus_code = "BUS-D36"
        bus_plate = "PBT-3601"
        route_id = [guid]::NewGuid().ToString()
        route_name = "Quito - Cuenca"
        origin_terminal_id = [guid]::NewGuid().ToString()
        origin_terminal_name = "Terminal Quito"
        destination_terminal_id = [guid]::NewGuid().ToString()
        destination_terminal_name = "Terminal Cuenca"
        departure_at = (Get-Date).ToUniversalTime().AddDays(1).ToString("o")
        status = "SCHEDULED"
        seats = @(
            @{ seat_number = "1"; status = "AVAILABLE" },
            @{ seat_number = "2"; status = "AVAILABLE" },
            @{ seat_number = "3"; status = "RESERVED" },
            @{ seat_number = "4"; status = "SOLD" }
        )
        source_updated_at = (Get-Date).ToUniversalTime().ToString("o")
    } | ConvertTo-Json -Depth 8 -Compress

    $SyncResponse = Invoke-RestMethod `
        -Uri "http://localhost:$HttpPort/api/v1/ticketing/availability/sync/departures" `
        -Method Post `
        -ContentType "application/json" `
        -Body $SyncPayload `
        -TimeoutSec 5

    $SeatMap = Invoke-RestMethod `
        -Uri "http://localhost:$HttpPort/api/v1/ticketing/availability/departures/$DispatchDepartureId/seats" `
        -TimeoutSec 5
    Assert-Condition -Condition ($SyncResponse.total_seats -eq 4) -Message "Expected 4 synced seats, but got $($SyncResponse.total_seats)."
    Assert-Condition -Condition ($SeatMap.available_seats -eq 2) -Message "Expected 2 available seats, but got $($SeatMap.available_seats)."

    $ReservationPayload = @{
        dispatch_departure_id = $DispatchDepartureId
        seat_number = "2"
        hold_minutes = 15
        passenger = @{
            document_type = "CEDULA"
            document_number = "3600000002"
            first_name = "Reserva"
            last_name = "Native"
            email = "reserva.native.$RunId@example.local"
            phone = "0936000002"
        }
    } | ConvertTo-Json -Depth 8 -Compress

    $Reservation = Invoke-RestMethod `
        -Uri "http://localhost:$HttpPort/api/v1/ticketing/reservations" `
        -Method Post `
        -ContentType "application/json" `
        -Body $ReservationPayload `
        -TimeoutSec 5
    Assert-Condition -Condition ($Reservation.status -eq "PENDING") -Message "Expected reservation status PENDING, but got $($Reservation.status)."

    $ExpirePayload = @{
        expired_before = (Get-Date).ToUniversalTime().AddHours(2).ToString("o")
    } | ConvertTo-Json -Depth 4 -Compress

    $Expiration = Invoke-RestMethod `
        -Uri "http://localhost:$HttpPort/api/v1/ticketing/reservations/expire" `
        -Method Post `
        -ContentType "application/json" `
        -Body $ExpirePayload `
        -TimeoutSec 5
    Assert-Condition -Condition ($Expiration.expired_reservations -eq 1) -Message "Expected 1 expired reservation, but got $($Expiration.expired_reservations)."

    $TicketPayload = @{
        dispatch_departure_id = $DispatchDepartureId
        seat_number = "1"
        fare_amount = 25.50
        currency = "USD"
        passenger = @{
            document_type = "CEDULA"
            document_number = "3600000001"
            first_name = "Venta"
            last_name = "Native"
            email = "venta.native.$RunId@example.local"
            phone = "0936000001"
        }
    } | ConvertTo-Json -Depth 8 -Compress

    $Ticket = Invoke-RestMethod `
        -Uri "http://localhost:$HttpPort/api/v1/ticketing/tickets" `
        -Method Post `
        -ContentType "application/json" `
        -Body $TicketPayload `
        -TimeoutSec 5
    Assert-Condition -Condition ($Ticket.status -eq "ISSUED") -Message "Expected ticket status ISSUED, but got $($Ticket.status)."

    $DuplicateTicketStatusCode = $null
    try {
        Invoke-RestMethod `
            -Uri "http://localhost:$HttpPort/api/v1/ticketing/tickets" `
            -Method Post `
            -ContentType "application/json" `
            -Body $TicketPayload `
            -TimeoutSec 5 | Out-Null

        throw "Expected second ticket sale for the same seat to fail with HTTP 409."
    } catch {
        if ($_.Exception.Response) {
            $DuplicateTicketStatusCode = [int]$_.Exception.Response.StatusCode
        } else {
            throw
        }
    }
    Assert-Condition -Condition ($DuplicateTicketStatusCode -eq 409) -Message "Expected duplicate ticket sale to return HTTP 409, but got $DuplicateTicketStatusCode."

    $SeatMapAfterTicket = Invoke-RestMethod `
        -Uri "http://localhost:$HttpPort/api/v1/ticketing/availability/departures/$DispatchDepartureId/seats" `
        -TimeoutSec 5
    $SoldSeat = @($SeatMapAfterTicket.seats | Where-Object { $_.seat_number -eq "1" })[0]
    Assert-Condition -Condition ($SoldSeat.status -eq "SOLD") -Message "Expected seat 1 to be SOLD, but got $($SoldSeat.status)."

    $CancelTicketPayload = @{
        reason = "Validacion nativa Dia 36"
        cancelled_by = "native-check"
        release_seat = $true
    } | ConvertTo-Json -Depth 4 -Compress

    $CancelledTicket = Invoke-RestMethod `
        -Uri "http://localhost:$HttpPort/api/v1/ticketing/tickets/$($Ticket.ticket_id)/cancel" `
        -Method Post `
        -ContentType "application/json" `
        -Body $CancelTicketPayload `
        -TimeoutSec 5
    Assert-Condition -Condition ($CancelledTicket.status -eq "VOIDED") -Message "Expected cancelled ticket status VOIDED, but got $($CancelledTicket.status)."

    $StatsJson = & docker stats $ServiceContainer --no-stream --format "{{json .}}"
    $Stats = $null
    if ($LASTEXITCODE -eq 0 -and $StatsJson) {
        $Stats = $StatsJson | ConvertFrom-Json
    }

    [pscustomobject]@{
        service = "ticketing-service"
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
        seat_statuses = @($SeatStatuses).Count
        reservation_statuses = @($ReservationStatuses).Count
        ticket_statuses = @($TicketStatuses).Count
        passenger_status = $Passenger.status
        synced_total_seats = $SyncResponse.total_seats
        reservation_status = $Reservation.status
        expired_reservations = $Expiration.expired_reservations
        ticket_status = $Ticket.status
        ticket_number = $Ticket.ticket_number
        sold_seat_status = $SoldSeat.status
        duplicate_ticket_http_status = $DuplicateTicketStatusCode
        cancelled_ticket_status = $CancelledTicket.status
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
        $ServiceLogs = & docker logs $ServiceContainer 2>&1 | Select-Object -Last 160
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
