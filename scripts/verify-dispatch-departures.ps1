param(
    [int]$DatabasePort = 55439,
    [int]$HttpPort = 18087,
    [string]$PostgresImage = "postgres:16-alpine",
    [string]$ContainerName = "venta-pasajes-dispatch-departures-pg-$PID",
    [string]$JarPath = ""
)

$ErrorActionPreference = "Stop"

$Root = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")
$ServiceRoot = Join-Path $Root "services\dispatch-service"
$TargetDir = Join-Path $ServiceRoot "target"
$StdOutPath = Join-Path $TargetDir "dispatch-service-departures.out.log"
$StdErrPath = Join-Path $TargetDir "dispatch-service-departures.err.log"
$AppProcess = $null
$ContainerStarted = $false
$PostgresPassword = [Convert]::ToBase64String(([guid]::NewGuid()).ToByteArray()).TrimEnd("=")

function Resolve-DispatchJar {
    if ($JarPath -and $JarPath.Trim()) {
        return (Resolve-Path -LiteralPath $JarPath).Path
    }

    $Candidates = @(
        (Join-Path $TargetDir "quarkus-app-day24\quarkus-run.jar"),
        (Join-Path $TargetDir "quarkus-app-day23\quarkus-run.jar"),
        (Join-Path $TargetDir "quarkus-app\quarkus-run.jar")
    ) | Where-Object { Test-Path -LiteralPath $_ } |
        ForEach-Object { Get-Item -LiteralPath $_ } |
        Sort-Object LastWriteTime -Descending

    if ($Candidates.Count -gt 0) {
        return $Candidates[0].FullName
    }

    throw "Quarkus JVM artifact was not found. Run: mvn -f .\services\dispatch-service\pom.xml package -DskipTests `"-Dquarkus.package.output-directory=quarkus-app-day24`""
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
    param(
        [string]$Method,
        [string]$Path,
        [object]$Body = $null,
        [hashtable]$Headers = @{}
    )

    $Parameters = @{
        Uri = "http://localhost:$HttpPort/api/v1/dispatch$Path"
        Method = $Method
        TimeoutSec = 10
        Headers = $Headers
    }

    if ($null -ne $Body) {
        $Parameters.ContentType = "application/json"
        $Parameters.Body = ($Body | ConvertTo-Json -Depth 12)
    }

    Invoke-RestMethod @Parameters
}

function Invoke-ExpectHttpError {
    param(
        [string]$Method,
        [string]$Path,
        [int]$ExpectedStatusCode,
        [object]$Body = $null,
        [hashtable]$Headers = @{}
    )

    try {
        Invoke-DispatchJson -Method $Method -Path $Path -Body $Body -Headers $Headers | Out-Null
        throw "Expected HTTP $ExpectedStatusCode for $Method $Path, but request succeeded."
    } catch {
        $Response = $_.Exception.Response
        if ($null -eq $Response) {
            throw
        }

        $ActualStatusCode = [int]$Response.StatusCode
        if ($ActualStatusCode -ne $ExpectedStatusCode) {
            throw "Expected HTTP $ExpectedStatusCode for $Method $Path, but received HTTP $ActualStatusCode."
        }
    }
}

$ResolvedJarPath = Resolve-DispatchJar
$AuditHeaders = @{
    "X-Actor-User-Id" = "00000000-0000-0000-0000-000000000024"
    "X-Correlation-Id" = ([guid]::NewGuid()).ToString()
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
        throw "dispatch-service did not become ready. Recent stderr:`n$ErrorPreview"
    }

    $SeedPage = Invoke-DispatchJson -Method Get -Path "/seat-layouts?q=Legacy%2025%20asientos&active=true&page=1&page_size=10"
    Assert-Condition -Condition (@($SeedPage.data).Count -eq 1) -Message "Expected the legacy 25-seat layout seed."
    $SeedLayoutId = $SeedPage.data[0].id

    $Origin = Invoke-DispatchJson -Method Post -Path "/terminals" -Headers $AuditHeaders -Body @{
        legacy_id = 2401
        local_code = "D24O"
        name = "Terminal Origen Dia 24"
        manager_name = "Operador Origen"
        address = "Av. Origen"
        phone = "022400001"
        email = "origen24@example.local"
    }

    $Destination = Invoke-DispatchJson -Method Post -Path "/terminals" -Headers $AuditHeaders -Body @{
        legacy_id = 2402
        local_code = "D24D"
        name = "Terminal Destino Dia 24"
        manager_name = "Operador Destino"
        address = "Av. Destino"
        phone = "022400002"
        email = "destino24@example.local"
    }

    $Route = Invoke-DispatchJson -Method Post -Path "/routes" -Headers $AuditHeaders -Body @{
        origin_terminal_id = $Origin.id
        destination_terminal_id = $Destination.id
        name = "Ruta Dia 24"
    }

    $BusType = Invoke-DispatchJson -Method Post -Path "/bus-types" -Headers $AuditHeaders -Body @{
        legacy_id = 2401
        name = "Tipo Dia 24"
        description = "Tipo para validar salidas"
    }

    $Bus = Invoke-DispatchJson -Method Post -Path "/buses" -Headers $AuditHeaders -Body @{
        legacy_id = 2401
        code = "BUS-D24-001"
        plate = "PBD-2401"
        description = "Unidad para salidas Dia 24"
        default_destination = "Destino Dia 24"
        bus_type_id = $BusType.id
        terminal_id = $Origin.id
        seat_layout_id = $SeedLayoutId
    }

    $DepartureAt = (Get-Date).ToUniversalTime().AddDays(2).ToString("yyyy-MM-ddTHH:mm:ssZ")
    $UpdatedDepartureAt = (Get-Date).ToUniversalTime().AddDays(3).ToString("yyyy-MM-ddTHH:mm:ssZ")
    $SecondDepartureAt = (Get-Date).ToUniversalTime().AddDays(4).ToString("yyyy-MM-ddTHH:mm:ssZ")
    $PastDepartureAt = (Get-Date).ToUniversalTime().AddDays(-1).ToString("yyyy-MM-ddTHH:mm:ssZ")
    $DateFrom = (Get-Date).AddDays(1).ToString("yyyy-MM-dd")
    $DateTo = (Get-Date).AddDays(5).ToString("yyyy-MM-dd")

    $Departure = Invoke-DispatchJson -Method Post -Path "/departures" -Headers $AuditHeaders -Body @{
        legacy_id = 2401
        bus_id = $Bus.id
        route_id = $Route.id
        departure_at = $DepartureAt
        notes = "Salida validada Dia 24"
    }
    Assert-Condition -Condition ($Departure.status -eq "SCHEDULED") -Message "Expected departure status SCHEDULED."
    Assert-Condition -Condition ($Departure.bus_id -eq $Bus.id) -Message "Expected departure to reference the created bus."

    Invoke-ExpectHttpError -Method Post -Path "/departures" -ExpectedStatusCode 409 -Headers $AuditHeaders -Body @{
        legacy_id = 2402
        bus_id = $Bus.id
        route_id = $Route.id
        departure_at = $DepartureAt
        notes = "Conflicto mismo bus y horario"
    }

    Invoke-ExpectHttpError -Method Post -Path "/departures" -ExpectedStatusCode 400 -Headers $AuditHeaders -Body @{
        legacy_id = 2403
        bus_id = $Bus.id
        route_id = $Route.id
        departure_at = $PastDepartureAt
        notes = "Fecha pasada"
    }

    $DeparturePage = Invoke-DispatchJson -Method Get -Path "/departures?bus_id=$($Bus.id)&status=SCHEDULED&date_from=$DateFrom&date_to=$DateTo&page=1&page_size=10"
    Assert-Condition -Condition (@($DeparturePage.data).Count -eq 1) -Message "Expected one scheduled departure for the bus and date range."

    $UpdatedDeparture = Invoke-DispatchJson -Method Patch -Path "/departures/$($Departure.id)" -Headers $AuditHeaders -Body @{
        departure_at = $UpdatedDepartureAt
        notes = "Salida actualizada Dia 24"
    }
    Assert-Condition -Condition ($UpdatedDeparture.notes -eq "Salida actualizada Dia 24") -Message "Expected updated departure notes."

    Invoke-ExpectHttpError -Method Post -Path "/departures" -ExpectedStatusCode 409 -Headers $AuditHeaders -Body @{
        legacy_id = 2404
        bus_id = $Bus.id
        route_id = $Route.id
        departure_at = $UpdatedDepartureAt
        notes = "Conflicto luego de actualizar horario"
    }

    $CancelledDeparture = Invoke-DispatchJson -Method Post -Path "/departures/$($Departure.id)/cancel" -Headers $AuditHeaders -Body @{
        reason = "Cancelacion validada Dia 24"
    }
    Assert-Condition -Condition ($CancelledDeparture.status -eq "CANCELLED") -Message "Expected departure status CANCELLED."
    Assert-Condition -Condition ($CancelledDeparture.cancellation_reason -eq "Cancelacion validada Dia 24") -Message "Expected cancellation reason."

    $SecondDeparture = Invoke-DispatchJson -Method Post -Path "/departures" -Headers $AuditHeaders -Body @{
        legacy_id = 2405
        bus_id = $Bus.id
        route_id = $Route.id
        departure_at = $SecondDepartureAt
        notes = "Salida para cancelar con DELETE"
    }
    Invoke-DispatchJson -Method Delete -Path "/departures/$($SecondDeparture.id)" -Headers $AuditHeaders | Out-Null
    $DeletedDeparture = Invoke-DispatchJson -Method Get -Path "/departures/$($SecondDeparture.id)"
    Assert-Condition -Condition ($DeletedDeparture.status -eq "CANCELLED") -Message "Expected DELETE to cancel the departure."

    $CancelledPage = Invoke-DispatchJson -Method Get -Path "/departures?status=CANCELLED&page=1&page_size=10"
    Assert-Condition -Condition (@($CancelledPage.data).Count -eq 2) -Message "Expected two cancelled departures."

    $AuditSql = "select count(*) from outbox_events where event_type in ('DepartureScheduled','DEPARTURE_UPDATED','DEPARTURE_CANCELLED');"
    $AuditCountText = & docker exec -e "PGPASSWORD=$PostgresPassword" $ContainerName `
        psql -U postgres -d dispatch_db -tAc $AuditSql
    Assert-ExitCode -ExitCode $LASTEXITCODE -Message "Could not query outbox departure events."
    $AuditCount = [int](($AuditCountText | Select-Object -First 1).Trim())
    Assert-Condition -Condition ($AuditCount -ge 5) -Message "Expected at least 5 departure events, but found $AuditCount."

    $ScheduledEventText = & docker exec -e "PGPASSWORD=$PostgresPassword" $ContainerName `
        psql -U postgres -d dispatch_db -tAc "select count(*) from outbox_events where event_type = 'DepartureScheduled';"
    Assert-ExitCode -ExitCode $LASTEXITCODE -Message "Could not query DepartureScheduled events."
    $ScheduledEventCount = [int](($ScheduledEventText | Select-Object -First 1).Trim())
    Assert-Condition -Condition ($ScheduledEventCount -eq 2) -Message "Expected two DepartureScheduled events, but found $ScheduledEventCount."

    $DepartureCountText = & docker exec -e "PGPASSWORD=$PostgresPassword" $ContainerName `
        psql -U postgres -d dispatch_db -tAc "select count(*) from departures;"
    Assert-ExitCode -ExitCode $LASTEXITCODE -Message "Could not query departure count."
    $DepartureCount = [int](($DepartureCountText | Select-Object -First 1).Trim())

    [pscustomobject]@{
        service = "dispatch-service"
        validation = "departures-crud"
        quarkus_profile = "onprem"
        secrets_provider = "env"
        database = "dispatch_db"
        database_port = $DatabasePort
        http_port = $HttpPort
        jar = $ResolvedJarPath
        created_departures = $DepartureCount
        cancelled_departures = @($CancelledPage.data).Count
        departure_scheduled_events = $ScheduledEventCount
        departure_events = $AuditCount
        duplicate_schedule_status = 409
        past_departure_status = 400
        delete_cancels = $true
        ready = $true
    } | ConvertTo-Json -Depth 5 -Compress
} finally {
    if ($AppProcess -and !$AppProcess.HasExited) {
        try {
            Stop-Process -Id $AppProcess.Id -Force
        } catch {
            Write-Warning "Could not stop dispatch-service process $($AppProcess.Id): $($_.Exception.Message)"
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
        "APP_LOG_CONSOLE_JSON"
    )) {
        Remove-Item -LiteralPath "Env:\$Name" -ErrorAction SilentlyContinue
    }
}
