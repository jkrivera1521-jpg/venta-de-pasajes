param(
    [int]$DatabasePort = 55443,
    [int]$HttpPort = 18090,
    [string]$PostgresImage = "postgres:16-alpine",
    [string]$ContainerName = "venta-pasajes-ticketing-base-pg-$PID",
    [string]$JarPath = ""
)

$ErrorActionPreference = "Stop"

$Root = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")
$ServiceRoot = Join-Path $Root "services\ticketing-service"
$TargetDir = Join-Path $ServiceRoot "target"
$StdOutPath = Join-Path $TargetDir "ticketing-service-base.out.log"
$StdErrPath = Join-Path $TargetDir "ticketing-service-base.err.log"
$AppProcess = $null
$ContainerStarted = $false
$PostgresPassword = [Convert]::ToBase64String(([guid]::NewGuid()).ToByteArray()).TrimEnd("=")

function Resolve-TicketingJar {
    if ($JarPath -and $JarPath.Trim()) {
        return (Resolve-Path -LiteralPath $JarPath).Path
    }

    $Candidates = @(
        (Join-Path $TargetDir "quarkus-app-day32\quarkus-run.jar"),
        (Join-Path $TargetDir "quarkus-app-day31\quarkus-run.jar"),
        (Join-Path $TargetDir "quarkus-app-day30\quarkus-run.jar"),
        (Join-Path $TargetDir "quarkus-app-day29\quarkus-run.jar"),
        (Join-Path $TargetDir "quarkus-app-day28\quarkus-run.jar"),
        (Join-Path $TargetDir "quarkus-app-day27\quarkus-run.jar"),
        (Join-Path $TargetDir "quarkus-app\quarkus-run.jar")
    ) | Where-Object { Test-Path -LiteralPath $_ } |
        ForEach-Object { Get-Item -LiteralPath $_ } |
        Sort-Object LastWriteTime -Descending

    if ($Candidates.Count -gt 0) {
        return $Candidates[0].FullName
    }

    throw "Quarkus JVM artifact was not found. Run: mvn -f .\services\ticketing-service\pom.xml package -DskipTests"
}

function Assert-ExitCode {
    param(
        [int]$ExitCode,
        [string]$Message
    )

    if ($ExitCode -ne 0) {
        throw $Message
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

function Wait-Postgres {
    for ($Attempt = 1; $Attempt -le 45; $Attempt++) {
        & docker exec $ContainerName pg_isready -U postgres -d ticketing_db | Out-Null
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

function Assert-LocalPortAvailable {
    param(
        [int]$Port,
        [string]$Purpose
    )

    $Connections = @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
    if ($Connections.Count -eq 0) {
        return
    }

    $OwnerLines = $Connections | ForEach-Object {
        $ProcessName = "unknown"
        $Process = Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue
        if ($Process) {
            $ProcessName = $Process.ProcessName
        }

        "local_address=$($_.LocalAddress) local_port=$($_.LocalPort) pid=$($_.OwningProcess) process=$ProcessName"
    }

    $DockerLines = @(& docker ps -a --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}" |
        Select-String -Pattern "$Port|ticketing" |
        ForEach-Object { $_.ToString() })

    $DockerHint = ""
    if ($DockerLines.Count -gt 0) {
        $DockerHint = "`nDocker containers related to this port:`n$($DockerLines -join "`n")"
    }

    throw @"
Port $Port is already in use for $Purpose.

Owners:
$($OwnerLines -join "`n")
$DockerHint

Options:
1. Stop the previous temporary container:
   docker stop venta-pasajes-ticketing-base-pg-script

2. Or run this validation with another free database port:
   powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-ticketing-service-local-db.ps1 -DatabasePort 55444 -HttpPort $HttpPort
"@
}

$ResolvedJarPath = Resolve-TicketingJar

try {
    Assert-LocalPortAvailable -Port $DatabasePort -Purpose "temporary PostgreSQL"
    Assert-LocalPortAvailable -Port $HttpPort -Purpose "ticketing-service HTTP"

    & docker run --rm --name $ContainerName `
        -e POSTGRES_DB=ticketing_db `
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
    $env:APP_DB_NAME = "ticketing_db"
    $env:APP_DB_JDBC_URL = "jdbc:postgresql://localhost:$DatabasePort/ticketing_db"
    $env:APP_DB_USERNAME = "postgres"
    $env:APP_DB_PASSWORD = $PostgresPassword
    $env:QUARKUS_FLYWAY_MIGRATE_AT_START = "true"
    $env:APP_LOG_CONSOLE_JSON = "false"
    $env:APP_DOCUMENT_INTEGRATION_ENABLED = "false"
    $env:APP_DOCUMENT_WORKER_ENABLED = "false"

    $AppProcess = Start-Process `
        -FilePath "java" `
        -ArgumentList @("-jar", $ResolvedJarPath) `
        -RedirectStandardOutput $StdOutPath `
        -RedirectStandardError $StdErrPath `
        -WindowStyle Hidden `
        -PassThru

    if (!(Wait-ServiceReady)) {
        $ErrorPreview = ""
        if (Test-Path -LiteralPath $StdErrPath) {
            $ErrorPreview = (Get-Content -LiteralPath $StdErrPath -Tail 80) -join "`n"
        }
        throw "ticketing-service did not become ready. Recent stderr:`n$ErrorPreview"
    }

    $Health = Invoke-RestMethod -Uri "http://localhost:$HttpPort/api/v1/ticketing/health" -TimeoutSec 5
    $Overview = Invoke-RestMethod -Uri "http://localhost:$HttpPort/api/v1/ticketing" -TimeoutSec 5
    $Resources = Invoke-RestMethod -Uri "http://localhost:$HttpPort/api/v1/ticketing/resources" -TimeoutSec 5
    $SeatStatuses = Invoke-RestMethod -Uri "http://localhost:$HttpPort/api/v1/ticketing/seat-statuses" -TimeoutSec 5
    $ReservationStatuses = Invoke-RestMethod -Uri "http://localhost:$HttpPort/api/v1/ticketing/reservation-statuses" -TimeoutSec 5
    $TicketStatuses = Invoke-RestMethod -Uri "http://localhost:$HttpPort/api/v1/ticketing/ticket-statuses" -TimeoutSec 5

    $PassengerPayload = @{
        document_type = "CEDULA"
        document_number = "1919191919"
        first_name = "Marta"
        last_name = "Cliente"
        email = "marta.cliente@example.com"
        phone = "0977777777"
    } | ConvertTo-Json -Depth 8 -Compress

    $Passenger = Invoke-RestMethod `
        -Uri "http://localhost:$HttpPort/api/v1/ticketing/passengers" `
        -Method Post `
        -ContentType "application/json" `
        -Body $PassengerPayload `
        -TimeoutSec 5

    Assert-Condition -Condition ($Passenger.status -eq "ACTIVE") -Message "Expected passenger status ACTIVE, but got $($Passenger.status)."
    Assert-Condition -Condition ($Passenger.document_number -eq "1919191919") -Message "Expected passenger document 1919191919, but got $($Passenger.document_number)."

    $DuplicatePassengerStatusCode = $null
    try {
        Invoke-RestMethod `
            -Uri "http://localhost:$HttpPort/api/v1/ticketing/passengers" `
            -Method Post `
            -ContentType "application/json" `
            -Body $PassengerPayload `
            -TimeoutSec 5 | Out-Null

        throw "Expected duplicate passenger to fail with HTTP 409."
    } catch {
        if ($_.Exception.Response) {
            $DuplicatePassengerStatusCode = [int]$_.Exception.Response.StatusCode
        } else {
            throw
        }
    }
    Assert-Condition -Condition ($DuplicatePassengerStatusCode -eq 409) -Message "Expected duplicate passenger to return HTTP 409, but got $DuplicatePassengerStatusCode."

    $PassengerSearchByDocument = @(Invoke-RestMethod `
        -Uri "http://localhost:$HttpPort/api/v1/ticketing/passengers?document_number=1919191919" `
        -TimeoutSec 5)
    Assert-Condition -Condition ($PassengerSearchByDocument.Count -ge 1) -Message "Expected passenger search by document to return at least one passenger."

    $PassengerSearchByName = @(Invoke-RestMethod `
        -Uri "http://localhost:$HttpPort/api/v1/ticketing/passengers?q=Marta" `
        -TimeoutSec 5)
    Assert-Condition -Condition ($PassengerSearchByName.Count -ge 1) -Message "Expected passenger search by name to return at least one passenger."

    $PassengerUpdatePayload = @{
        document_type = "CEDULA"
        document_number = "1919191919"
        first_name = "Marta"
        last_name = "Cliente Actualizada"
        email = "marta.actualizada@example.com"
        phone = "0966666666"
        status = "ACTIVE"
    } | ConvertTo-Json -Depth 8 -Compress

    $UpdatedPassenger = Invoke-RestMethod `
        -Uri "http://localhost:$HttpPort/api/v1/ticketing/passengers/$($Passenger.passenger_id)" `
        -Method Put `
        -ContentType "application/json" `
        -Body $PassengerUpdatePayload `
        -TimeoutSec 5

    Assert-Condition -Condition ($UpdatedPassenger.last_name -eq "Cliente Actualizada") -Message "Expected passenger last_name to be updated."

    $DuplicatePassengerEmailPayload = @{
        document_type = "CEDULA"
        document_number = "2020202020"
        first_name = "Marcela"
        last_name = "Duplicada"
        email = "marta.actualizada@example.com"
        phone = "0955555555"
    } | ConvertTo-Json -Depth 8 -Compress

    $DuplicatePassengerEmailStatusCode = $null
    try {
        Invoke-RestMethod `
            -Uri "http://localhost:$HttpPort/api/v1/ticketing/passengers" `
            -Method Post `
            -ContentType "application/json" `
            -Body $DuplicatePassengerEmailPayload `
            -TimeoutSec 5 | Out-Null

        throw "Expected duplicate passenger email to fail with HTTP 409."
    } catch {
        if ($_.Exception.Response) {
            $DuplicatePassengerEmailStatusCode = [int]$_.Exception.Response.StatusCode
        } else {
            throw
        }
    }
    Assert-Condition -Condition ($DuplicatePassengerEmailStatusCode -eq 409) -Message "Expected duplicate passenger email to return HTTP 409, but got $DuplicatePassengerEmailStatusCode."

    $DeactivatedPassenger = Invoke-RestMethod `
        -Uri "http://localhost:$HttpPort/api/v1/ticketing/passengers/$($Passenger.passenger_id)" `
        -Method Delete `
        -TimeoutSec 5

    Assert-Condition -Condition ($DeactivatedPassenger.status -eq "INACTIVE") -Message "Expected deactivated passenger status INACTIVE, but got $($DeactivatedPassenger.status)."

    $DispatchDepartureId = "00000000-0000-0000-0000-000000028001"
    $Tomorrow = (Get-Date).ToUniversalTime().AddDays(1).ToString("o")
    $Now = (Get-Date).ToUniversalTime().ToString("o")
    $SyncPayload = @{
        dispatch_departure_id = $DispatchDepartureId
        legacy_id = 2801
        bus_id = "00000000-0000-0000-0000-000000028101"
        bus_code = "BUS-D28"
        bus_plate = "PBA-2801"
        route_id = "00000000-0000-0000-0000-000000028201"
        route_name = "Quito - Guayaquil"
        origin_terminal_id = "00000000-0000-0000-0000-000000028301"
        origin_terminal_name = "Terminal Quito"
        destination_terminal_id = "00000000-0000-0000-0000-000000028302"
        destination_terminal_name = "Terminal Guayaquil"
        departure_at = $Tomorrow
        status = "SCHEDULED"
        seats = @(
            @{ seat_number = "1"; status = "AVAILABLE" },
            @{ seat_number = "2"; status = "RESERVED" },
            @{ seat_number = "3"; status = "SOLD" },
            @{ seat_number = "4"; status = "CANCELLED" }
        )
        source_updated_at = $Now
    } | ConvertTo-Json -Depth 8 -Compress

    $SyncResponse = Invoke-RestMethod `
        -Uri "http://localhost:$HttpPort/api/v1/ticketing/availability/sync/departures" `
        -Method Post `
        -ContentType "application/json" `
        -Body $SyncPayload `
        -TimeoutSec 5

    $AvailabilityDepartures = @(Invoke-RestMethod `
        -Uri "http://localhost:$HttpPort/api/v1/ticketing/availability/departures" `
        -TimeoutSec 5)

    $SeatMap = Invoke-RestMethod `
        -Uri "http://localhost:$HttpPort/api/v1/ticketing/availability/departures/$DispatchDepartureId/seats" `
        -TimeoutSec 5

    Assert-Condition -Condition ($SyncResponse.total_seats -eq 4) -Message "Expected 4 synced seats, but got $($SyncResponse.total_seats)."
    Assert-Condition -Condition ($SeatMap.available_seats -eq 1) -Message "Expected 1 available seat, but got $($SeatMap.available_seats)."
    Assert-Condition -Condition ($SeatMap.reserved_seats -eq 1) -Message "Expected 1 reserved seat, but got $($SeatMap.reserved_seats)."
    Assert-Condition -Condition ($SeatMap.sold_seats -eq 1) -Message "Expected 1 sold seat, but got $($SeatMap.sold_seats)."
    Assert-Condition -Condition ($SeatMap.cancelled_seats -eq 1) -Message "Expected 1 cancelled seat, but got $($SeatMap.cancelled_seats)."
    Assert-Condition -Condition ($AvailabilityDepartures.Count -ge 1) -Message "Expected at least one available departure."

    $ReservationPayload = @{
        dispatch_departure_id = $DispatchDepartureId
        seat_number = "1"
        hold_minutes = 15
        passenger = @{
            document_type = "CEDULA"
            document_number = "1717171717"
            first_name = "Ana"
            last_name = "Viajera"
            email = "ana.viajera@example.com"
            phone = "0999999999"
        }
    } | ConvertTo-Json -Depth 8 -Compress

    $Reservation = Invoke-RestMethod `
        -Uri "http://localhost:$HttpPort/api/v1/ticketing/reservations" `
        -Method Post `
        -ContentType "application/json" `
        -Body $ReservationPayload `
        -TimeoutSec 5

    Assert-Condition -Condition ($Reservation.status -eq "PENDING") -Message "Expected reservation status PENDING, but got $($Reservation.status)."
    Assert-Condition -Condition ($Reservation.seat_status -eq "RESERVED") -Message "Expected reserved seat status, but got $($Reservation.seat_status)."

    $ConflictStatusCode = $null
    try {
        Invoke-RestMethod `
            -Uri "http://localhost:$HttpPort/api/v1/ticketing/reservations" `
            -Method Post `
            -ContentType "application/json" `
            -Body $ReservationPayload `
            -TimeoutSec 5 | Out-Null

        throw "Expected second reservation for the same seat to fail with HTTP 409."
    } catch {
        if ($_.Exception.Response) {
            $ConflictStatusCode = [int]$_.Exception.Response.StatusCode
        } else {
            throw
        }
    }
    Assert-Condition -Condition ($ConflictStatusCode -eq 409) -Message "Expected duplicate reservation to return HTTP 409, but got $ConflictStatusCode."

    $SeatMapAfterReservation = Invoke-RestMethod `
        -Uri "http://localhost:$HttpPort/api/v1/ticketing/availability/departures/$DispatchDepartureId/seats" `
        -TimeoutSec 5

    Assert-Condition -Condition ($SeatMapAfterReservation.available_seats -eq 0) -Message "Expected 0 available seats after reservation, but got $($SeatMapAfterReservation.available_seats)."
    Assert-Condition -Condition ($SeatMapAfterReservation.reserved_seats -eq 2) -Message "Expected 2 reserved seats after reservation, but got $($SeatMapAfterReservation.reserved_seats)."

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

    $SeatMapAfterExpiration = Invoke-RestMethod `
        -Uri "http://localhost:$HttpPort/api/v1/ticketing/availability/departures/$DispatchDepartureId/seats" `
        -TimeoutSec 5

    Assert-Condition -Condition ($SeatMapAfterExpiration.available_seats -eq 1) -Message "Expected 1 available seat after expiration, but got $($SeatMapAfterExpiration.available_seats)."
    Assert-Condition -Condition ($SeatMapAfterExpiration.reserved_seats -eq 1) -Message "Expected 1 reserved seat after expiration, but got $($SeatMapAfterExpiration.reserved_seats)."

    $TicketPayload = @{
        dispatch_departure_id = $DispatchDepartureId
        seat_number = "1"
        fare_amount = 25.50
        currency = "USD"
        passenger = @{
            document_type = "CEDULA"
            document_number = "1818181818"
            first_name = "Luis"
            last_name = "Comprador"
            email = "luis.comprador@example.com"
            phone = "0988888888"
        }
    } | ConvertTo-Json -Depth 8 -Compress

    $Ticket = Invoke-RestMethod `
        -Uri "http://localhost:$HttpPort/api/v1/ticketing/tickets" `
        -Method Post `
        -ContentType "application/json" `
        -Body $TicketPayload `
        -TimeoutSec 5

    Assert-Condition -Condition ($Ticket.status -eq "ISSUED") -Message "Expected ticket status ISSUED, but got $($Ticket.status)."
    Assert-Condition -Condition ($Ticket.seat_number -eq "1") -Message "Expected ticket seat 1, but got $($Ticket.seat_number)."
    Assert-Condition -Condition ($Ticket.fare_amount -eq 25.50) -Message "Expected ticket fare 25.50, but got $($Ticket.fare_amount)."

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

    Assert-Condition -Condition ($SeatMapAfterTicket.available_seats -eq 0) -Message "Expected 0 available seats after ticket sale, but got $($SeatMapAfterTicket.available_seats)."
    Assert-Condition -Condition ($SeatMapAfterTicket.sold_seats -eq 2) -Message "Expected 2 sold seats after ticket sale, but got $($SeatMapAfterTicket.sold_seats)."

    $CancelTicketPayload = @{
        reason = "Solicitud del pasajero en validacion local"
        cancelled_by = "admin-local"
        release_seat = $true
    } | ConvertTo-Json -Depth 4 -Compress

    $CancelledTicket = Invoke-RestMethod `
        -Uri "http://localhost:$HttpPort/api/v1/ticketing/tickets/$($Ticket.ticket_id)/cancel" `
        -Method Post `
        -ContentType "application/json" `
        -Body $CancelTicketPayload `
        -TimeoutSec 5

    Assert-Condition -Condition ($CancelledTicket.status -eq "VOIDED") -Message "Expected cancelled ticket status VOIDED, but got $($CancelledTicket.status)."
    Assert-Condition -Condition ($CancelledTicket.cancellation_reason -eq "Solicitud del pasajero en validacion local") -Message "Expected cancellation reason to be stored."
    Assert-Condition -Condition ($CancelledTicket.cancelled_by -eq "admin-local") -Message "Expected cancelled_by admin-local, but got $($CancelledTicket.cancelled_by)."
    Assert-Condition -Condition ($null -ne $CancelledTicket.cancelled_at) -Message "Expected cancelled_at to be set."

    $DuplicateCancellationStatusCode = $null
    try {
        Invoke-RestMethod `
            -Uri "http://localhost:$HttpPort/api/v1/ticketing/tickets/$($Ticket.ticket_id)/cancel" `
            -Method Post `
            -ContentType "application/json" `
            -Body $CancelTicketPayload `
            -TimeoutSec 5 | Out-Null

        throw "Expected second cancellation for the same ticket to fail with HTTP 409."
    } catch {
        if ($_.Exception.Response) {
            $DuplicateCancellationStatusCode = [int]$_.Exception.Response.StatusCode
        } else {
            throw
        }
    }
    Assert-Condition -Condition ($DuplicateCancellationStatusCode -eq 409) -Message "Expected duplicate ticket cancellation to return HTTP 409, but got $DuplicateCancellationStatusCode."

    $SeatMapAfterCancellation = Invoke-RestMethod `
        -Uri "http://localhost:$HttpPort/api/v1/ticketing/availability/departures/$DispatchDepartureId/seats" `
        -TimeoutSec 5

    Assert-Condition -Condition ($SeatMapAfterCancellation.available_seats -eq 1) -Message "Expected 1 available seat after cancellation, but got $($SeatMapAfterCancellation.available_seats)."
    Assert-Condition -Condition ($SeatMapAfterCancellation.sold_seats -eq 1) -Message "Expected 1 sold seat after cancellation, but got $($SeatMapAfterCancellation.sold_seats)."

    $TicketPassengerHistory = @(Invoke-RestMethod `
        -Uri "http://localhost:$HttpPort/api/v1/ticketing/passengers/$($Ticket.passenger_id)/tickets" `
        -TimeoutSec 5)
    Assert-Condition -Condition ($TicketPassengerHistory.Count -ge 1) -Message "Expected ticket passenger history to contain at least one ticket."
    Assert-Condition -Condition ($TicketPassengerHistory[0].ticket_id -eq $Ticket.ticket_id) -Message "Expected passenger ticket history to include the issued ticket."
    Assert-Condition -Condition ($TicketPassengerHistory[0].status -eq "VOIDED") -Message "Expected passenger ticket history to reflect cancelled ticket status."

    $TableCountText = & docker exec -e "PGPASSWORD=$PostgresPassword" $ContainerName `
        psql -U postgres -d ticketing_db -tAc "select count(*) from information_schema.tables where table_schema='public' and table_name in ('passengers','departure_seats','reservations','tickets','outbox_events','synced_departures','flyway_schema_history');"
    Assert-ExitCode -ExitCode $LASTEXITCODE -Message "Could not count ticketing tables."
    $TableCount = [int](($TableCountText | Select-Object -First 1).Trim())
    Assert-Condition -Condition ($TableCount -eq 7) -Message "Expected 7 public tables including Flyway history, but found $TableCount."

    $UniqueCountText = & docker exec -e "PGPASSWORD=$PostgresPassword" $ContainerName `
        psql -U postgres -d ticketing_db -tAc "select count(*) from pg_indexes where schemaname='public' and (indexname in ('uq_passengers_email_not_null','uq_tickets_active_departure_seat','uq_synced_departures_legacy_id_not_null') or indexdef like '%UNIQUE%');"
    Assert-ExitCode -ExitCode $LASTEXITCODE -Message "Could not count ticketing unique indexes."
    $UniqueCount = [int](($UniqueCountText | Select-Object -First 1).Trim())
    Assert-Condition -Condition ($UniqueCount -ge 8) -Message "Expected at least 8 unique indexes or constraints, but found $UniqueCount."

    $FlywayVersion = & docker exec -e "PGPASSWORD=$PostgresPassword" $ContainerName `
        psql -U postgres -d ticketing_db -tAc "select version from flyway_schema_history where success = true order by installed_rank desc limit 1;"
    Assert-ExitCode -ExitCode $LASTEXITCODE -Message "Could not read Flyway version."
    $LatestFlywayVersion = (($FlywayVersion | Select-Object -First 1).Trim())
    Assert-Condition -Condition ($LatestFlywayVersion -eq "5") -Message "Expected Flyway version 5, but got $LatestFlywayVersion."

    $OutboxEventCountText = & docker exec -e "PGPASSWORD=$PostgresPassword" $ContainerName `
        psql -U postgres -d ticketing_db -tAc "select count(*) from outbox_events where event_type in ('SeatReserved','SeatReservationExpired');"
    Assert-ExitCode -ExitCode $LASTEXITCODE -Message "Could not count reservation outbox events."
    $OutboxEventCount = [int](($OutboxEventCountText | Select-Object -First 1).Trim())
    Assert-Condition -Condition ($OutboxEventCount -eq 2) -Message "Expected 2 reservation outbox events, but found $OutboxEventCount."

    $TicketOutboxEventCountText = & docker exec -e "PGPASSWORD=$PostgresPassword" $ContainerName `
        psql -U postgres -d ticketing_db -tAc "select count(*) from outbox_events where event_type = 'TicketSold';"
    Assert-ExitCode -ExitCode $LASTEXITCODE -Message "Could not count ticket outbox events."
    $TicketOutboxEventCount = [int](($TicketOutboxEventCountText | Select-Object -First 1).Trim())
    Assert-Condition -Condition ($TicketOutboxEventCount -eq 1) -Message "Expected 1 TicketSold outbox event, but found $TicketOutboxEventCount."

    $TicketCancellationOutboxEventCountText = & docker exec -e "PGPASSWORD=$PostgresPassword" $ContainerName `
        psql -U postgres -d ticketing_db -tAc "select count(*) from outbox_events where event_type = 'TicketCancelled';"
    Assert-ExitCode -ExitCode $LASTEXITCODE -Message "Could not count ticket cancellation outbox events."
    $TicketCancellationOutboxEventCount = [int](($TicketCancellationOutboxEventCountText | Select-Object -First 1).Trim())
    Assert-Condition -Condition ($TicketCancellationOutboxEventCount -eq 1) -Message "Expected 1 TicketCancelled outbox event, but found $TicketCancellationOutboxEventCount."

    $VoidedTicketCountText = & docker exec -e "PGPASSWORD=$PostgresPassword" $ContainerName `
        psql -U postgres -d ticketing_db -tAc "select count(*) from tickets where status = 'VOIDED' and cancellation_reason is not null and cancelled_by is not null and cancelled_at is not null;"
    Assert-ExitCode -ExitCode $LASTEXITCODE -Message "Could not count voided tickets."
    $VoidedTicketCount = [int](($VoidedTicketCountText | Select-Object -First 1).Trim())
    Assert-Condition -Condition ($VoidedTicketCount -eq 1) -Message "Expected 1 voided ticket with cancellation trace, but found $VoidedTicketCount."

    $PassengerCountText = & docker exec -e "PGPASSWORD=$PostgresPassword" $ContainerName `
        psql -U postgres -d ticketing_db -tAc "select count(*) from passengers;"
    Assert-ExitCode -ExitCode $LASTEXITCODE -Message "Could not count passengers."
    $PassengerCount = [int](($PassengerCountText | Select-Object -First 1).Trim())
    Assert-Condition -Condition ($PassengerCount -ge 3) -Message "Expected at least 3 passengers, but found $PassengerCount."

    [pscustomobject]@{
        service = "ticketing-service"
        validation = "local-postgresql-flyway"
        quarkus_profile = "onprem"
        secrets_provider = "env"
        database = "ticketing_db"
        database_port = $DatabasePort
        http_port = $HttpPort
        jar = $ResolvedJarPath
        health_status = $Health.status
        overview_service = $Overview.service
        resources_count = @($Resources).Count
        seat_statuses = @($SeatStatuses).Count
        reservation_statuses = @($ReservationStatuses).Count
        ticket_statuses = @($TicketStatuses).Count
        passenger_status = $Passenger.status
        passenger_document_number = $Passenger.document_number
        duplicate_passenger_http_status = $DuplicatePassengerStatusCode
        duplicate_passenger_email_http_status = $DuplicatePassengerEmailStatusCode
        passenger_search_by_document = $PassengerSearchByDocument.Count
        passenger_search_by_name = $PassengerSearchByName.Count
        updated_passenger_last_name = $UpdatedPassenger.last_name
        deactivated_passenger_status = $DeactivatedPassenger.status
        availability_departures = $AvailabilityDepartures.Count
        availability_total_seats = $SeatMap.total_seats
        availability_available_seats = $SeatMap.available_seats
        availability_reserved_seats = $SeatMap.reserved_seats
        availability_sold_seats = $SeatMap.sold_seats
        availability_cancelled_seats = $SeatMap.cancelled_seats
        reservation_status = $Reservation.status
        reservation_seat_status = $Reservation.seat_status
        duplicate_reservation_http_status = $ConflictStatusCode
        seats_available_after_reservation = $SeatMapAfterReservation.available_seats
        seats_reserved_after_reservation = $SeatMapAfterReservation.reserved_seats
        expired_reservations = $Expiration.expired_reservations
        seats_available_after_expiration = $SeatMapAfterExpiration.available_seats
        seats_reserved_after_expiration = $SeatMapAfterExpiration.reserved_seats
        ticket_status = $Ticket.status
        ticket_number = $Ticket.ticket_number
        duplicate_ticket_http_status = $DuplicateTicketStatusCode
        seats_available_after_ticket = $SeatMapAfterTicket.available_seats
        seats_sold_after_ticket = $SeatMapAfterTicket.sold_seats
        cancelled_ticket_status = $CancelledTicket.status
        cancellation_reason = $CancelledTicket.cancellation_reason
        cancelled_by = $CancelledTicket.cancelled_by
        duplicate_cancellation_http_status = $DuplicateCancellationStatusCode
        seats_available_after_cancellation = $SeatMapAfterCancellation.available_seats
        seats_sold_after_cancellation = $SeatMapAfterCancellation.sold_seats
        ticket_history_count = $TicketPassengerHistory.Count
        reservation_outbox_events = $OutboxEventCount
        ticket_outbox_events = $TicketOutboxEventCount
        ticket_cancellation_outbox_events = $TicketCancellationOutboxEventCount
        voided_tickets = $VoidedTicketCount
        passengers_count = $PassengerCount
        public_tables = $TableCount
        unique_constraints_or_indexes = $UniqueCount
        flyway_version = $LatestFlywayVersion
        ready = $true
    } | ConvertTo-Json -Depth 5 -Compress
} finally {
    if ($AppProcess -and !$AppProcess.HasExited) {
        try {
            Stop-Process -Id $AppProcess.Id -Force
        } catch {
            Write-Warning "Could not stop ticketing-service process $($AppProcess.Id): $($_.Exception.Message)"
        }
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
        "APP_LOG_CONSOLE_JSON",
        "APP_DOCUMENT_INTEGRATION_ENABLED",
        "APP_DOCUMENT_WORKER_ENABLED"
    )) {
        Remove-Item -LiteralPath "Env:\$Name" -ErrorAction SilentlyContinue
    }
}
