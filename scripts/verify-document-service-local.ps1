param(
    [int]$HttpPort = 18097,
    [int]$DatabasePort = 55453,
    [int]$TimeoutSeconds = 120,
    [switch]$SkipPackage
)

$ErrorActionPreference = "Stop"

$Root = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")
$ServiceRoot = Join-Path $Root "services\document-service"
$JarPath = Join-Path $ServiceRoot "target\quarkus-app\quarkus-run.jar"
$StorageDir = Join-Path $ServiceRoot "target\document-storage-verify-$PID"
$DownloadedPdf = Join-Path $ServiceRoot "target\document-service-verify-$PID.pdf"
$OutLog = Join-Path $ServiceRoot "target\document-service-verify-$PID.out.log"
$ErrLog = Join-Path $ServiceRoot "target\document-service-verify-$PID.err.log"

$PostgresContainer = "venta-pasajes-document-pg-$PID"
$DatabaseName = "documents_db"
$DatabaseUser = "postgres"
$DatabasePassword = [Guid]::NewGuid().ToString("N")
$JavaProcess = $null
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

    return [pscustomobject]@{
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

        throw "Docker engine is not available. $Reason Start Docker Desktop and wait until docker info succeeds. Suggested PowerShell: Start-Service -Name com.docker.service -ErrorAction SilentlyContinue; Start-Process -FilePath 'C:\Program Files\Docker\Docker\Docker Desktop.exe' -WindowStyle Hidden"
    }

    $script:DockerAvailable = $true
}

function Test-DockerContainerExists {
    param([string]$Name)

    $Result = Invoke-NativeCommand -FilePath "docker" -Arguments @("ps", "-aq", "--filter", "name=^/$Name$")
    return $Result.ExitCode -eq 0 -and [bool]($Result.Output -join "")
}

function Remove-DockerContainerIfExists {
    param([string]$Name)

    if (!$DockerAvailable) {
        return
    }

    if (Test-DockerContainerExists -Name $Name) {
        Invoke-NativeCommand -FilePath "docker" -Arguments @("rm", "-f", $Name) | Out-Null
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
        $Owners = @($Connection | Select-Object -ExpandProperty OwningProcess -Unique)
        $Details = @()
        foreach ($Owner in $Owners) {
            $Process = Get-CimInstance Win32_Process -Filter "ProcessId = $Owner" -ErrorAction SilentlyContinue
            if ($Process) {
                $CommandLine = if ([string]::IsNullOrWhiteSpace($Process.CommandLine)) { $Process.Name } else { $Process.CommandLine }
                $Details += "pid=$Owner name=$($Process.Name) command=$CommandLine"
            } else {
                $Details += "pid=$Owner"
            }
        }

        throw "Port $Port is already in use. Stop the process/container first or run this script with another port. Owners: $($Details -join '; ')"
    }
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
                throw "Port $Port is reserved by Windows excluded port range ${StartPort}-${EndPort}. Run this script with another port, for example -DatabasePort 15453."
            }
        }
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
    "APP_LOG_CONSOLE_JSON",
    "QUARKUS_PROFILE",
    "QUARKUS_HTTP_PORT",
    "QUARKUS_FLYWAY_MIGRATE_AT_START"
)
$PreviousEnv = @{}

try {
    Assert-DockerAvailable
    Assert-PortNotExcludedByWindows -Port $HttpPort
    Assert-PortNotExcludedByWindows -Port $DatabasePort
    Assert-PortAvailable -Port $HttpPort
    Assert-PortAvailable -Port $DatabasePort

    if (!$SkipPackage -or !(Test-Path -LiteralPath $JarPath)) {
        & mvn -f (Join-Path $ServiceRoot "pom.xml") -DskipTests clean package
        if ($LASTEXITCODE -ne 0) {
            throw "mvn package failed with exit code $LASTEXITCODE."
        }
    }

    New-Item -ItemType Directory -Force -Path $StorageDir | Out-Null

    Invoke-Docker -Arguments @(
        "run",
        "--name",
        $PostgresContainer,
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
        & docker exec $PostgresContainer pg_isready -h localhost -p 5432 -U $DatabaseUser -d $DatabaseName | Out-Null
        return $LASTEXITCODE -eq 0
    }

    foreach ($Name in $EnvNames) {
        $PreviousEnv[$Name] = [Environment]::GetEnvironmentVariable($Name, "Process")
    }

    $env:APP_ENV = "onprem"
    $env:APP_RUNTIME_TARGET = "onprem"
    $env:APP_SECRETS_PROVIDER = "env"
    $env:APP_DB_NAME = $DatabaseName
    $env:APP_DB_JDBC_URL = "jdbc:postgresql://localhost:$DatabasePort/$DatabaseName"
    $env:APP_DB_USERNAME = $DatabaseUser
    $env:APP_DB_PASSWORD = $DatabasePassword
    $env:APP_DOCUMENT_STORAGE_PROVIDER = "local"
    $env:APP_DOCUMENT_LOCAL_DIR = $StorageDir
    $env:APP_LOG_CONSOLE_JSON = "false"
    $env:QUARKUS_PROFILE = "onprem"
    $env:QUARKUS_HTTP_PORT = "$HttpPort"
    $env:QUARKUS_FLYWAY_MIGRATE_AT_START = "true"

    $JavaProcess = Start-Process `
        -FilePath "java" `
        -ArgumentList @("-jar", $JarPath) `
        -WorkingDirectory $ServiceRoot `
        -RedirectStandardOutput $OutLog `
        -RedirectStandardError $ErrLog `
        -PassThru `
        -WindowStyle Hidden

    Wait-Until -Seconds $TimeoutSeconds -FailureMessage "document-service was not ready." -Condition {
        $Health = Invoke-RestMethod -Uri "http://localhost:$HttpPort/q/health/ready" -Method Get -TimeoutSec 2
        return $Health.status -eq "UP"
    }

    $HealthResponse = Invoke-RestMethod -Uri "http://localhost:$HttpPort/api/v1/document/health" -Method Get -TimeoutSec 5
    $OverviewResponse = Invoke-RestMethod -Uri "http://localhost:$HttpPort/api/v1/document" -Method Get -TimeoutSec 5
    $ResourcesResponse = Invoke-RestMethod -Uri "http://localhost:$HttpPort/api/v1/document/resources" -Method Get -TimeoutSec 5

    $RunId = (Get-Date).ToUniversalTime().ToString("yyyyMMddHHmmssfff")
    $TicketId = [Guid]::NewGuid().ToString()
    $TicketNumber = "D37-$RunId"
    $Payload = @{
        template_code = "DEFAULT_TICKET"
        requested_by_user_id = [Guid]::NewGuid().ToString()
        correlation_id = [Guid]::NewGuid().ToString()
        ticket = @{
            ticket_number = $TicketNumber
            passenger_name = "Marta Cliente"
            document_type = "CEDULA"
            document_number = "1919191919"
            price = 25.50
            currency = "USD"
            bus_code = "BUS-D37"
            bus_type = "Doble piso"
            origin = "Quito"
            destination = "Cuenca"
            departure_at = (Get-Date).ToUniversalTime().AddDays(1).ToString("o")
            seat_number = "P2-30"
            seat_position = "Piso 2 zona VIP"
            sold_at = (Get-Date).ToUniversalTime().ToString("o")
        }
    } | ConvertTo-Json -Depth 8 -Compress

    $Document = Invoke-RestMethod `
        -Uri "http://localhost:$HttpPort/api/v1/document/documents/tickets/$TicketId" `
        -Method Post `
        -ContentType "application/json" `
        -Body $Payload `
        -TimeoutSec 10

    Assert-Condition -Condition ($Document.status -eq "GENERATED") -Message "Expected document status GENERATED, but got $($Document.status)."
    Assert-Condition -Condition ($Document.ticket_number -eq $TicketNumber) -Message "Expected ticket number $TicketNumber, but got $($Document.ticket_number)."
    Assert-Condition -Condition ($Document.storage_provider -eq "local") -Message "Expected local storage provider, but got $($Document.storage_provider)."
    Assert-Condition -Condition ($Document.storage_uri -like "local://tickets/*") -Message "Unexpected storage URI: $($Document.storage_uri)."

    $Metadata = Invoke-RestMethod `
        -Uri "http://localhost:$HttpPort/api/v1/document/documents/$($Document.document_id)" `
        -Method Get `
        -TimeoutSec 5
    Assert-Condition -Condition ($Metadata.checksum_sha256.Length -eq 64) -Message "Expected SHA-256 checksum in metadata."

    $PdfResponse = Invoke-WebRequest `
        -Uri "http://localhost:$HttpPort/api/v1/document/documents/$($Document.document_id)/download" `
        -Method Get `
        -UseBasicParsing `
        -TimeoutSec 10
    Assert-Condition -Condition ($PdfResponse.StatusCode -eq 200) -Message "Expected PDF download HTTP 200, but got $($PdfResponse.StatusCode)."

    $PdfStream = $PdfResponse.RawContentStream
    $PdfStream.Position = 0
    $PdfBytes = New-Object byte[] $PdfStream.Length
    $PdfStream.Read($PdfBytes, 0, $PdfBytes.Length) | Out-Null
    [System.IO.File]::WriteAllBytes($DownloadedPdf, $PdfBytes)
    $PdfHeader = [System.Text.Encoding]::ASCII.GetString($PdfBytes, 0, 4)
    Assert-Condition -Condition ($PdfHeader -eq "%PDF") -Message "Downloaded file is not a PDF."

    $OutboxCountRaw = & docker exec $PostgresContainer psql -U $DatabaseUser -d $DatabaseName -tAc "select count(*) from outbox_events where event_type = 'DocumentGenerated';"
    if ($LASTEXITCODE -ne 0) {
        throw "Could not query outbox_events."
    }
    $OutboxCount = [int]($OutboxCountRaw.Trim())
    Assert-Condition -Condition ($OutboxCount -ge 1) -Message "Expected at least one DocumentGenerated event."

    [pscustomobject]@{
        service = "document-service"
        runtime = "jvm"
        quarkus_profile = "onprem"
        database = $DatabaseName
        migration_tool = "flyway"
        http_port = $HttpPort
        database_port = $DatabasePort
        health_status = $HealthResponse.status
        overview_service = $OverviewResponse.service
        resources_count = @($ResourcesResponse).Count
        ticket_id = $TicketId
        ticket_number = $Document.ticket_number
        document_id = $Document.document_id
        document_status = $Document.status
        storage_provider = $Document.storage_provider
        storage_uri = $Document.storage_uri
        downloaded_pdf = $DownloadedPdf
        downloaded_pdf_bytes = $PdfBytes.Length
        checksum_sha256 = $Metadata.checksum_sha256
        outbox_document_generated_events = $OutboxCount
        storage_dir = $StorageDir
        ready = $true
    } | ConvertTo-Json -Depth 5 -Compress
} catch {
    if ($JavaProcess -and !$JavaProcess.HasExited) {
        $Logs = Get-Content -LiteralPath $OutLog -ErrorAction SilentlyContinue | Select-Object -Last 120
        $Errors = Get-Content -LiteralPath $ErrLog -ErrorAction SilentlyContinue | Select-Object -Last 120
        if ($Logs) {
            Write-Host ($Logs -join [Environment]::NewLine)
        }
        if ($Errors) {
            Write-Host ($Errors -join [Environment]::NewLine)
        }
    }

    throw
} finally {
    if ($JavaProcess -and !$JavaProcess.HasExited) {
        Stop-Process -Id $JavaProcess.Id -Force
    }

    Remove-DockerContainerIfExists -Name $PostgresContainer

    foreach ($Name in $EnvNames) {
        if ($PreviousEnv.ContainsKey($Name) -and $null -ne $PreviousEnv[$Name]) {
            [Environment]::SetEnvironmentVariable($Name, $PreviousEnv[$Name], "Process")
        } else {
            [Environment]::SetEnvironmentVariable($Name, $null, "Process")
        }
    }
}
