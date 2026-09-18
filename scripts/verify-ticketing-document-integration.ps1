param(
    [int]$TicketingHttpPort = 18138,
    [int]$DocumentHttpPort = 18139,
    [int]$TicketingDatabasePort = 15438,
    [int]$DocumentDatabasePort = 15439,
    [int]$TimeoutSeconds = 120,
    [switch]$SkipPackage
)

$ErrorActionPreference = "Stop"

$Root = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")
$TicketingRoot = Join-Path $Root "services\ticketing-service"
$DocumentRoot = Join-Path $Root "services\document-service"
$TicketingJar = Join-Path $TicketingRoot "target\quarkus-app\quarkus-run.jar"
$DocumentJar = Join-Path $DocumentRoot "target\quarkus-app\quarkus-run.jar"
$TargetDir = Join-Path $Root "logs\dia-38"
$DocumentStorageDir = Join-Path $DocumentRoot "target\document-storage-dia38-$PID"
$DownloadedPdf = Join-Path $DocumentRoot "target\dia38-reprint-$PID.pdf"

$TicketingDbContainer = "venta-pasajes-d38-ticketing-pg-$PID"
$DocumentDbContainer = "venta-pasajes-d38-document-pg-$PID"
$TicketingDbName = "ticketing_db"
$DocumentDbName = "documents_db"
$DbUser = "postgres"
$TicketingDbPassword = [Guid]::NewGuid().ToString("N")
$DocumentDbPassword = [Guid]::NewGuid().ToString("N")
$TicketingProcess = $null
$DocumentProcess = $null
$DockerAvailable = $false
$LastTicket = $null
$LastProcessResponse = $null

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

function Assert-PortNotExcludedByWindows {
    param([int]$Port)

    if ($env:OS -ne "Windows_NT") {
        return
    }

    $Ranges = & netsh interface ipv4 show excludedportrange protocol=tcp 2>$null
    if ($LASTEXITCODE -ne 0 -or !$Ranges) {
        return
    }

    foreach ($Line in $Ranges) {
        if ($Line -match "^\s*(\d+)\s+(\d+)") {
            $StartPort = [int]$Matches[1]
            $EndPort = [int]$Matches[2]
            if ($Port -ge $StartPort -and $Port -le $EndPort) {
                throw "Port $Port is reserved by Windows excluded port range ${StartPort}-${EndPort}. Use another port."
            }
        }
    }
}

function Assert-PortAvailable {
    param(
        [int]$Port,
        [string]$Purpose
    )

    $Connection = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
    if ($Connection) {
        $Owners = @($Connection | Select-Object -ExpandProperty OwningProcess -Unique)
        $Details = @()
        foreach ($Owner in $Owners) {
            $Process = Get-CimInstance Win32_Process -Filter "ProcessId = $Owner" -ErrorAction SilentlyContinue
            $Details += if ($Process) { "pid=$Owner name=$($Process.Name)" } else { "pid=$Owner" }
        }
        throw "Port $Port for $Purpose is already in use. Owners: $($Details -join '; ')"
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
    "APP_DOCUMENT_STORAGE_PROVIDER",
    "APP_DOCUMENT_LOCAL_DIR",
    "APP_DOCUMENT_SERVICE_BASE_URL",
    "APP_DOCUMENT_INTEGRATION_ENABLED",
    "APP_DOCUMENT_WORKER_ENABLED",
    "APP_RESERVATION_EXPIRATION_JOB_ENABLED",
    "APP_LOG_CONSOLE_JSON",
    "QUARKUS_PROFILE",
    "QUARKUS_HTTP_PORT",
    "QUARKUS_FLYWAY_MIGRATE_AT_START"
)
$PreviousEnv = @{}

try {
    New-Item -ItemType Directory -Force -Path $TargetDir | Out-Null

    Assert-DockerAvailable

    foreach ($Port in @($TicketingHttpPort, $DocumentHttpPort, $TicketingDatabasePort, $DocumentDatabasePort)) {
        Assert-PortNotExcludedByWindows -Port $Port
    }
    Assert-PortAvailable -Port $TicketingHttpPort -Purpose "ticketing-service HTTP"
    Assert-PortAvailable -Port $DocumentHttpPort -Purpose "document-service HTTP"
    Assert-PortAvailable -Port $TicketingDatabasePort -Purpose "ticketing PostgreSQL"
    Assert-PortAvailable -Port $DocumentDatabasePort -Purpose "document PostgreSQL"

    if (!$SkipPackage -or !(Test-Path -LiteralPath $TicketingJar) -or !(Test-Path -LiteralPath $DocumentJar)) {
        & mvn -f (Join-Path $DocumentRoot "pom.xml") -DskipTests clean package
        if ($LASTEXITCODE -ne 0) {
            throw "document-service package failed with exit code $LASTEXITCODE."
        }

        & mvn -f (Join-Path $TicketingRoot "pom.xml") -DskipTests clean package
        if ($LASTEXITCODE -ne 0) {
            throw "ticketing-service package failed with exit code $LASTEXITCODE."
        }
    }

    foreach ($Name in $EnvNames) {
        $PreviousEnv[$Name] = [Environment]::GetEnvironmentVariable($Name, "Process")
    }

    Invoke-Docker -Arguments @(
        "run",
        "--name",
        $DocumentDbContainer,
        "-e",
        "POSTGRES_DB=$DocumentDbName",
        "-e",
        "POSTGRES_USER=$DbUser",
        "-e",
        "POSTGRES_PASSWORD=$DocumentDbPassword",
        "-p",
        "${DocumentDatabasePort}:5432",
        "-d",
        "postgres:16-alpine"
    )

    Invoke-Docker -Arguments @(
        "run",
        "--name",
        $TicketingDbContainer,
        "-e",
        "POSTGRES_DB=$TicketingDbName",
        "-e",
        "POSTGRES_USER=$DbUser",
        "-e",
        "POSTGRES_PASSWORD=$TicketingDbPassword",
        "-p",
        "${TicketingDatabasePort}:5432",
        "-d",
        "postgres:16-alpine"
    )

    Wait-Until -Seconds $TimeoutSeconds -FailureMessage "document PostgreSQL was not ready." -Condition {
        & docker exec $DocumentDbContainer pg_isready -h localhost -p 5432 -U $DbUser -d $DocumentDbName | Out-Null
        return $LASTEXITCODE -eq 0
    }

    Wait-Until -Seconds $TimeoutSeconds -FailureMessage "ticketing PostgreSQL was not ready." -Condition {
        & docker exec $TicketingDbContainer pg_isready -h localhost -p 5432 -U $DbUser -d $TicketingDbName | Out-Null
        return $LASTEXITCODE -eq 0
    }

    New-Item -ItemType Directory -Force -Path $DocumentStorageDir | Out-Null

    $env:APP_ENV = "onprem"
    $env:APP_RUNTIME_TARGET = "onprem"
    $env:APP_SECRETS_PROVIDER = "env"
    $env:APP_DB_NAME = $DocumentDbName
    $env:APP_DB_JDBC_URL = "jdbc:postgresql://localhost:$DocumentDatabasePort/$DocumentDbName"
    $env:APP_DB_USERNAME = $DbUser
    $env:APP_DB_PASSWORD = $DocumentDbPassword
    $env:APP_DOCUMENT_STORAGE_PROVIDER = "local"
    $env:APP_DOCUMENT_LOCAL_DIR = $DocumentStorageDir
    $env:APP_LOG_CONSOLE_JSON = "false"
    $env:QUARKUS_PROFILE = "onprem"
    $env:QUARKUS_HTTP_PORT = "$DocumentHttpPort"
    $env:QUARKUS_FLYWAY_MIGRATE_AT_START = "true"

    $DocumentProcess = Start-Process `
        -FilePath "java" `
        -ArgumentList @("-jar", $DocumentJar) `
        -WorkingDirectory $DocumentRoot `
        -RedirectStandardOutput (Join-Path $TargetDir "document-service.out.log") `
        -RedirectStandardError (Join-Path $TargetDir "document-service.err.log") `
        -PassThru `
        -WindowStyle Hidden

    Wait-Until -Seconds $TimeoutSeconds -FailureMessage "document-service was not ready." -Condition {
        $Health = Invoke-RestMethod -Uri "http://localhost:$DocumentHttpPort/q/health/ready" -TimeoutSec 2
        return $Health.status -eq "UP"
    }

    $env:APP_ENV = "onprem"
    $env:APP_RUNTIME_TARGET = "onprem"
    $env:APP_SECRETS_PROVIDER = "env"
    $env:APP_DB_NAME = $TicketingDbName
    $env:APP_DB_JDBC_URL = "jdbc:postgresql://localhost:$TicketingDatabasePort/$TicketingDbName"
    $env:APP_DB_USERNAME = $DbUser
    $env:APP_DB_PASSWORD = $TicketingDbPassword
    $env:APP_DOCUMENT_SERVICE_BASE_URL = "http://localhost:$DocumentHttpPort/api/v1/document"
    $env:APP_DOCUMENT_INTEGRATION_ENABLED = "true"
    $env:APP_DOCUMENT_WORKER_ENABLED = "false"
    $env:APP_RESERVATION_EXPIRATION_JOB_ENABLED = "false"
    $env:APP_LOG_CONSOLE_JSON = "false"
    $env:QUARKUS_PROFILE = "onprem"
    $env:QUARKUS_HTTP_PORT = "$TicketingHttpPort"
    $env:QUARKUS_FLYWAY_MIGRATE_AT_START = "true"

    $TicketingProcess = Start-Process `
        -FilePath "java" `
        -ArgumentList @("-jar", $TicketingJar) `
        -WorkingDirectory $TicketingRoot `
        -RedirectStandardOutput (Join-Path $TargetDir "ticketing-service.out.log") `
        -RedirectStandardError (Join-Path $TargetDir "ticketing-service.err.log") `
        -PassThru `
        -WindowStyle Hidden

    Wait-Until -Seconds $TimeoutSeconds -FailureMessage "ticketing-service was not ready." -Condition {
        $Health = Invoke-RestMethod -Uri "http://localhost:$TicketingHttpPort/q/health/ready" -TimeoutSec 2
        return $Health.status -eq "UP"
    }

    $DispatchDepartureId = [guid]::NewGuid().ToString()
    $RunId = (Get-Date).ToUniversalTime().ToString("yyyyMMddHHmmssfff")
    $SyncPayload = @{
        dispatch_departure_id = $DispatchDepartureId
        legacy_id = 3801
        bus_id = [guid]::NewGuid().ToString()
        bus_code = "BUS-D38"
        bus_plate = "PBT-3801"
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
            @{ seat_number = "2"; status = "AVAILABLE" }
        )
        source_updated_at = (Get-Date).ToUniversalTime().ToString("o")
    } | ConvertTo-Json -Depth 8 -Compress

    $SyncResponse = Invoke-RestMethod `
        -Uri "http://localhost:$TicketingHttpPort/api/v1/ticketing/availability/sync/departures" `
        -Method Post `
        -ContentType "application/json" `
        -Body $SyncPayload `
        -TimeoutSec 10
    Assert-Condition -Condition ($SyncResponse.total_seats -eq 2) -Message "Expected 2 synced seats."

    $TicketPayload = @{
        dispatch_departure_id = $DispatchDepartureId
        seat_number = "1"
        fare_amount = 25.50
        currency = "USD"
        passenger = @{
            document_type = "CEDULA"
            document_number = "3800000001"
            first_name = "Dia38"
            last_name = "Documento"
            email = "dia38.documento.$RunId@example.local"
            phone = "0938000001"
        }
    } | ConvertTo-Json -Depth 8 -Compress

    $Ticket = Invoke-RestMethod `
        -Uri "http://localhost:$TicketingHttpPort/api/v1/ticketing/tickets" `
        -Method Post `
        -ContentType "application/json" `
        -Body $TicketPayload `
        -TimeoutSec 10
    $LastTicket = $Ticket
    Assert-Condition -Condition ($Ticket.status -eq "ISSUED") -Message "Expected ticket status ISSUED."
    Assert-Condition -Condition ([bool]$Ticket.ticket_id) -Message "Ticket response did not include ticket_id."

    $ProcessResponse = Invoke-RestMethod `
        -Uri "http://localhost:$TicketingHttpPort/api/v1/ticketing/documents/process-pending?limit=10" `
        -Method Post `
        -TimeoutSec 20
    $LastProcessResponse = $ProcessResponse
    Assert-Condition -Condition ($ProcessResponse.generated_documents -eq 1) -Message "Expected one generated document."

    $DocumentRef = Invoke-RestMethod `
        -Uri "http://localhost:$TicketingHttpPort/api/v1/ticketing/tickets/$($Ticket.ticket_id)/document" `
        -TimeoutSec 10
    Assert-Condition -Condition ($DocumentRef.status -eq "GENERATED") -Message "Expected ticket document status GENERATED."
    Assert-Condition -Condition ([bool]$DocumentRef.document_id) -Message "Expected document id."

    $ReprintRef = Invoke-RestMethod `
        -Uri "http://localhost:$TicketingHttpPort/api/v1/ticketing/tickets/$($Ticket.ticket_id)/document/reprint" `
        -Method Post `
        -TimeoutSec 10
    Assert-Condition -Condition ($ReprintRef.document_id -eq $DocumentRef.document_id) -Message "Expected reprint to reuse generated document."

    $PdfResponse = Invoke-WebRequest `
        -Uri $ReprintRef.download_url `
        -Method Get `
        -UseBasicParsing `
        -TimeoutSec 10

    $PdfStream = $PdfResponse.RawContentStream
    $PdfStream.Position = 0
    $PdfBytes = New-Object byte[] $PdfStream.Length
    $PdfStream.Read($PdfBytes, 0, $PdfBytes.Length) | Out-Null
    [System.IO.File]::WriteAllBytes($DownloadedPdf, $PdfBytes)
    $PdfHeader = [System.Text.Encoding]::ASCII.GetString($PdfBytes, 0, 4)
    Assert-Condition -Condition ($PdfHeader -eq "%PDF") -Message "Downloaded reprint is not a PDF."

    $TicketDocumentRefsRaw = & docker exec $TicketingDbContainer psql -U $DbUser -d $TicketingDbName -tAc "select count(*) from ticket_document_refs where status = 'GENERATED';"
    $DocumentEventsRaw = & docker exec $DocumentDbContainer psql -U $DbUser -d $DocumentDbName -tAc "select count(*) from outbox_events where event_type = 'DocumentGenerated';"
    $TicketDocumentRefs = [int]($TicketDocumentRefsRaw.Trim())
    $DocumentEvents = [int]($DocumentEventsRaw.Trim())
    Assert-Condition -Condition ($TicketDocumentRefs -eq 1) -Message "Expected one generated ticket_document_refs row."
    Assert-Condition -Condition ($DocumentEvents -eq 1) -Message "Expected one DocumentGenerated event."

    [pscustomobject]@{
        service = "ticketing-document-integration"
        runtime = "jvm"
        ticketing_http_port = $TicketingHttpPort
        document_http_port = $DocumentHttpPort
        ticketing_database_port = $TicketingDatabasePort
        document_database_port = $DocumentDatabasePort
        ticket_id = $Ticket.ticket_id
        ticket_number = $Ticket.ticket_number
        ticket_status = $Ticket.status
        document_id = $DocumentRef.document_id
        document_status = $DocumentRef.status
        document_storage_uri = $DocumentRef.storage_uri
        reprint_url = $ReprintRef.download_url
        downloaded_pdf = $DownloadedPdf
        downloaded_pdf_bytes = $PdfBytes.Length
        generated_document_refs = $TicketDocumentRefs
        document_generated_events = $DocumentEvents
        ready = $true
    } | ConvertTo-Json -Depth 5 -Compress
} catch {
    if ($LastTicket) {
        Write-Host ("Last ticket response: " + ($LastTicket | ConvertTo-Json -Depth 8 -Compress))
    }
    if ($LastProcessResponse) {
        Write-Host ("Last process response: " + ($LastProcessResponse | ConvertTo-Json -Depth 8 -Compress))
    }
    if ($DockerAvailable) {
        $Refs = Invoke-NativeCommand -FilePath "docker" -Arguments @(
            "exec",
            $TicketingDbContainer,
            "psql",
            "-U",
            $DbUser,
            "-d",
            $TicketingDbName,
            "-c",
            "select ticket_id, ticket_number, source_event_id, document_id, status, attempts, failure_reason from ticket_document_refs;"
        )
        if ($Refs.Output) {
            Write-Host ($Refs.Output -join [Environment]::NewLine)
        }
    }

    $DiagnosticLogs = @(
        (Join-Path $TargetDir "ticketing-service.err.log"),
        (Join-Path $TargetDir "document-service.err.log")
    )

    foreach ($LogFile in $DiagnosticLogs) {
        $Preview = Get-Content -LiteralPath $LogFile -ErrorAction SilentlyContinue | Select-Object -Last 120
        if ($Preview) {
            Write-Host ($Preview -join [Environment]::NewLine)
        }
    }
    throw
} finally {
    if ($TicketingProcess -and !$TicketingProcess.HasExited) {
        Stop-Process -Id $TicketingProcess.Id -Force
    }
    if ($DocumentProcess -and !$DocumentProcess.HasExited) {
        Stop-Process -Id $DocumentProcess.Id -Force
    }

    Remove-DockerContainerIfExists -Name $TicketingDbContainer
    Remove-DockerContainerIfExists -Name $DocumentDbContainer

    foreach ($Name in $EnvNames) {
        if ($PreviousEnv.ContainsKey($Name) -and $null -ne $PreviousEnv[$Name]) {
            [Environment]::SetEnvironmentVariable($Name, $PreviousEnv[$Name], "Process")
        } else {
            [Environment]::SetEnvironmentVariable($Name, $null, "Process")
        }
    }
}
