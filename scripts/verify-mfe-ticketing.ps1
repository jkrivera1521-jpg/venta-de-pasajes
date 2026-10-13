param(
    [int]$ShellPort = 3010,
    [int]$MfeTicketingPort = 3013,
    [string]$TicketingApiUrl = "http://localhost:8083/api/v1/ticketing"
)

$ErrorActionPreference = "Stop"

$Root = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$LogsDir = Join-Path -Path $Root -ChildPath "logs"
New-Item -ItemType Directory -Force -Path $LogsDir | Out-Null

function Assert-PortAvailable {
    param([int]$Port)

    $Connection = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue |
        Where-Object { $_.State -eq "Listen" }

    if ($Connection) {
        throw "Port $Port is already in use."
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

function Start-NextApp {
    param(
        [string]$Name,
        [string]$WorkingDirectory,
        [int]$Port,
        [hashtable]$Environment
    )

    $OriginalEnvironment = @{}

    foreach ($Key in $Environment.Keys) {
        $OriginalEnvironment[$Key] = [Environment]::GetEnvironmentVariable($Key, "Process")
        [Environment]::SetEnvironmentVariable($Key, $Environment[$Key], "Process")
    }

    $StdOutPath = Join-Path -Path $LogsDir -ChildPath "$Name.verify.log"
    $StdErrPath = Join-Path -Path $LogsDir -ChildPath "$Name.verify.err.log"

    try {
        $Process = Start-Process `
            -FilePath "npm.cmd" `
            -ArgumentList @("run", "start", "--", "--hostname", "127.0.0.1", "-p", "$Port") `
            -WorkingDirectory $WorkingDirectory `
            -WindowStyle Hidden `
            -RedirectStandardOutput $StdOutPath `
            -RedirectStandardError $StdErrPath `
            -PassThru

        Start-Sleep -Seconds 2

        if ($Process.HasExited) {
            $ErrorPreview = ""
            if (Test-Path -LiteralPath $StdErrPath) {
                $ErrorPreview = (Get-Content -LiteralPath $StdErrPath -Tail 30) -join "`n"
            }

            throw "$Name server did not stay running on port $Port. Recent stderr:`n$ErrorPreview"
        }

        return $Process
    }
    finally {
        foreach ($Key in $Environment.Keys) {
            [Environment]::SetEnvironmentVariable($Key, $OriginalEnvironment[$Key], "Process")
        }
    }
}

function Build-NextApp {
    param(
        [string]$Name,
        [string]$WorkingDirectory,
        [hashtable]$Environment
    )

    $OriginalEnvironment = @{}

    foreach ($Key in $Environment.Keys) {
        $OriginalEnvironment[$Key] = [Environment]::GetEnvironmentVariable($Key, "Process")
        [Environment]::SetEnvironmentVariable($Key, $Environment[$Key], "Process")
    }

    $StdOutPath = Join-Path -Path $LogsDir -ChildPath "$Name.build.verify.log"
    $StdErrPath = Join-Path -Path $LogsDir -ChildPath "$Name.build.verify.err.log"

    try {
        $Process = Start-Process `
            -FilePath "npm.cmd" `
            -ArgumentList @("run", "build") `
            -WorkingDirectory $WorkingDirectory `
            -WindowStyle Hidden `
            -RedirectStandardOutput $StdOutPath `
            -RedirectStandardError $StdErrPath `
            -Wait `
            -PassThru

        if ($Process.ExitCode -ne 0) {
            $ErrorPreview = ""
            if (Test-Path -LiteralPath $StdErrPath) {
                $ErrorPreview = (Get-Content -LiteralPath $StdErrPath -Tail 60) -join "`n"
            }

            throw "$Name build failed. Recent stderr:`n$ErrorPreview"
        }
    }
    finally {
        foreach ($Key in $Environment.Keys) {
            [Environment]::SetEnvironmentVariable($Key, $OriginalEnvironment[$Key], "Process")
        }
    }
}

function Wait-HttpOk {
    param(
        [string]$Url,
        [int]$TimeoutSeconds = 45
    )

    $Deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    $LastError = $null

    while ((Get-Date) -lt $Deadline) {
        try {
            $Response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5
            if ($Response.StatusCode -ge 200 -and $Response.StatusCode -lt 400) {
                return $Response
            }
        } catch {
            $LastError = $_
        }

        Start-Sleep -Milliseconds 800
    }

    if ($LastError) {
        throw $LastError
    }

    throw "Timeout waiting for $Url"
}

Assert-PortAvailable -Port $ShellPort
Assert-PortAvailable -Port $MfeTicketingPort

$MfeTicketingUrl = "http://localhost:$MfeTicketingPort"
$ShellUrl = "http://localhost:$ShellPort"
$Processes = New-Object System.Collections.Generic.List[System.Diagnostics.Process]
$MfeTicketingEnvironment = @{
    NEXT_PUBLIC_MFE_PUBLIC_URL = $MfeTicketingUrl
    TICKETING_API_URL = $TicketingApiUrl
    NEXT_PUBLIC_TICKETING_API_URL = $TicketingApiUrl
}
$ShellEnvironment = @{
    NEXT_PUBLIC_MFE_DISPATCH_MANIFEST_URL = "http://localhost:3002/mfe/manifest"
    NEXT_PUBLIC_MFE_IDENTITY_MANIFEST_URL = "http://localhost:3001/mfe/manifest"
    NEXT_PUBLIC_MFE_TICKETING_MANIFEST_URL = "$MfeTicketingUrl/mfe/manifest"
}
$MfeTicketingRoot = Join-Path -Path $Root -ChildPath "apps/mfe-ticketing"
$ShellRoot = Join-Path -Path $Root -ChildPath "apps/frontend-shell"

try {
    Build-NextApp `
        -Name "mfe-ticketing" `
        -WorkingDirectory $MfeTicketingRoot `
        -Environment $MfeTicketingEnvironment

    Build-NextApp `
        -Name "frontend-shell" `
        -WorkingDirectory $ShellRoot `
        -Environment $ShellEnvironment

    $MfeTicketingProcess = Start-NextApp `
        -Name "mfe-ticketing" `
        -WorkingDirectory $MfeTicketingRoot `
        -Port $MfeTicketingPort `
        -Environment $MfeTicketingEnvironment
    $Processes.Add($MfeTicketingProcess)

    $ShellProcess = Start-NextApp `
        -Name "frontend-shell" `
        -WorkingDirectory $ShellRoot `
        -Port $ShellPort `
        -Environment $ShellEnvironment
    $Processes.Add($ShellProcess)

    $Health = Invoke-RestMethod -Uri "$MfeTicketingUrl/api/health" -TimeoutSec 10
    $Manifest = Invoke-RestMethod -Uri "$MfeTicketingUrl/mfe/manifest" -TimeoutSec 10
    $Embedded = Wait-HttpOk -Url "$MfeTicketingUrl/ticketing/embedded"
    $Shell = Wait-HttpOk -Url "$ShellUrl/"

    $BackendProxyStatus = $null
    try {
        $BackendProxy = Invoke-WebRequest -Uri "$MfeTicketingUrl/api/ticketing/health" -UseBasicParsing -TimeoutSec 5
        $BackendProxyStatus = $BackendProxy.StatusCode
    } catch {
        if ($_.Exception.Response) {
            $BackendProxyStatus = [int]$_.Exception.Response.StatusCode
        } else {
            $BackendProxyStatus = "unavailable"
        }
    }

    $TicketStatus = $null
    $TicketNumber = $null
    $SeatMapAvailableSeats = $null
    $SeatMapSoldSeats = $null
    $SoldSeatStatus = $null
    $DuplicateTicketStatusCode = $null
    $AvailabilityRefreshedAfterTicket = $null

    if ($BackendProxyStatus -eq 200) {
        $DispatchDepartureId = [guid]::NewGuid().ToString()
        $PassengerRunId = (Get-Date).ToUniversalTime().ToString("yyyyMMddHHmmssfff")
        $SyncPayload = @{
            dispatch_departure_id = $DispatchDepartureId
            legacy_id = 3301
            bus_id = [guid]::NewGuid().ToString()
            bus_code = "BUS-D33"
            bus_plate = "PBT-3301"
            route_id = [guid]::NewGuid().ToString()
            route_name = "Quito - Guayaquil"
            origin_terminal_id = [guid]::NewGuid().ToString()
            origin_terminal_name = "Terminal Quito"
            destination_terminal_id = [guid]::NewGuid().ToString()
            destination_terminal_name = "Terminal Guayaquil"
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

        $SeatMap = Invoke-RestMethod `
            -Uri "$MfeTicketingUrl/api/ticketing/availability/sync/departures" `
            -Method Post `
            -ContentType "application/json" `
            -Body $SyncPayload `
            -TimeoutSec 10
        Assert-Condition -Condition ($SeatMap.available_seats -eq 2) -Message "Expected 2 available seats after sync."

        $TicketPayload = @{
            dispatch_departure_id = $DispatchDepartureId
            seat_number = "1"
            fare_amount = 25.50
            currency = "USD"
            passenger = @{
                document_type = "CEDULA"
                document_number = $PassengerRunId.Substring($PassengerRunId.Length - 10)
                first_name = "Venta"
                last_name = "Frontend"
                email = "venta.frontend.$PassengerRunId@example.com"
                phone = "0933333333"
            }
        } | ConvertTo-Json -Depth 8 -Compress

        $Ticket = Invoke-RestMethod `
            -Uri "$MfeTicketingUrl/api/ticketing/tickets" `
            -Method Post `
            -ContentType "application/json" `
            -Body $TicketPayload `
            -TimeoutSec 10
        Assert-Condition -Condition ($Ticket.status -eq "ISSUED") -Message "Expected issued ticket through MFE proxy."
        Assert-Condition -Condition ($Ticket.seat_number -eq "1") -Message "Expected ticket seat 1, but got $($Ticket.seat_number)."

        try {
            Invoke-RestMethod `
                -Uri "$MfeTicketingUrl/api/ticketing/tickets" `
                -Method Post `
                -ContentType "application/json" `
                -Body $TicketPayload `
                -TimeoutSec 10 | Out-Null

            throw "Expected duplicate ticket sale for the same seat to fail with HTTP 409."
        } catch {
            if ($_.Exception.Response) {
                $DuplicateTicketStatusCode = [int]$_.Exception.Response.StatusCode
            } else {
                throw
            }
        }
        Assert-Condition -Condition ($DuplicateTicketStatusCode -eq 409) -Message "Expected duplicate ticket sale to return HTTP 409, but got $DuplicateTicketStatusCode."

        $SeatMapAfterTicket = Invoke-RestMethod `
            -Uri "$MfeTicketingUrl/api/ticketing/availability/departures/$DispatchDepartureId/seats" `
            -TimeoutSec 10
        $SoldSeat = @($SeatMapAfterTicket.seats | Where-Object { $_.seat_number -eq "1" })[0]
        Assert-Condition -Condition ($null -ne $SoldSeat) -Message "Expected seat 1 to exist after ticket sale."
        Assert-Condition -Condition ($SoldSeat.status -eq "SOLD") -Message "Expected seat 1 to be SOLD, but got $($SoldSeat.status)."
        Assert-Condition -Condition ($SeatMapAfterTicket.available_seats -eq 1) -Message "Expected 1 available seat after ticket sale, but got $($SeatMapAfterTicket.available_seats)."
        Assert-Condition -Condition ($SeatMapAfterTicket.sold_seats -eq 2) -Message "Expected 2 sold seats after ticket sale, but got $($SeatMapAfterTicket.sold_seats)."

        $TicketStatus = $Ticket.status
        $TicketNumber = $Ticket.ticket_number
        $SeatMapAvailableSeats = $SeatMapAfterTicket.available_seats
        $SeatMapSoldSeats = $SeatMapAfterTicket.sold_seats
        $SoldSeatStatus = $SoldSeat.status
        $AvailabilityRefreshedAfterTicket = ($SeatMapAfterTicket.available_seats -eq 1 -and $SoldSeat.status -eq "SOLD")
    }

    [pscustomobject]@{
        service = "mfe-ticketing"
        validation = "manifest-shell-embedded"
        shell_url = $ShellUrl
        shell_status = $Shell.StatusCode
        mfe_ticketing_url = $MfeTicketingUrl
        mfe_ticketing_health = $Health.status
        manifest_name = $Manifest.name
        manifest_entry_url = $Manifest.entry_url
        embedded_status = $Embedded.StatusCode
        backend_proxy_status = $BackendProxyStatus
        ticket_status = $TicketStatus
        ticket_number = $TicketNumber
        seats_available_after_ticket = $SeatMapAvailableSeats
        seats_sold_after_ticket = $SeatMapSoldSeats
        sold_seat_status = $SoldSeatStatus
        duplicate_ticket_http_status = $DuplicateTicketStatusCode
        availability_refreshed_after_ticket = $AvailabilityRefreshedAfterTicket
        ready = $true
    } | ConvertTo-Json -Compress
}
finally {
    foreach ($Process in $Processes) {
        if ($Process -and -not $Process.HasExited) {
            Stop-Process -Id $Process.Id -Force -ErrorAction SilentlyContinue
        }
    }

    Get-NetTCPConnection -LocalPort $ShellPort,$MfeTicketingPort -ErrorAction SilentlyContinue |
        Where-Object { $_.State -eq "Listen" } |
        Select-Object -ExpandProperty OwningProcess -Unique |
        Where-Object { $_ -gt 0 -and $_ -ne $PID } |
        ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }
}
