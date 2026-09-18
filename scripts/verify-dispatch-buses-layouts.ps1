param(
    [int]$DatabasePort = 55438,
    [int]$HttpPort = 18086,
    [string]$PostgresImage = "postgres:16-alpine",
    [string]$ContainerName = "venta-pasajes-dispatch-buses-layouts-pg-$PID",
    [string]$JarPath = ""
)

$ErrorActionPreference = "Stop"

$Root = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")
$ServiceRoot = Join-Path $Root "services\dispatch-service"
$TargetDir = Join-Path $ServiceRoot "target"
$StdOutPath = Join-Path $TargetDir "dispatch-service-buses-layouts.out.log"
$StdErrPath = Join-Path $TargetDir "dispatch-service-buses-layouts.err.log"
$AppProcess = $null
$ContainerStarted = $false
$PostgresPassword = [Convert]::ToBase64String(([guid]::NewGuid()).ToByteArray()).TrimEnd("=")

function Resolve-DispatchJar {
    if ($JarPath -and $JarPath.Trim()) {
        return (Resolve-Path -LiteralPath $JarPath).Path
    }

    $Candidates = @(
        (Join-Path $TargetDir "quarkus-app-day23\quarkus-run.jar"),
        (Join-Path $TargetDir "quarkus-app\quarkus-run.jar"),
        (Join-Path $TargetDir "quarkus-app-day22\quarkus-run.jar")
    ) | Where-Object { Test-Path -LiteralPath $_ } |
        ForEach-Object { Get-Item -LiteralPath $_ } |
        Sort-Object LastWriteTime -Descending

    if ($Candidates.Count -gt 0) {
        return $Candidates[0].FullName
    }

    throw "Quarkus JVM artifact was not found. Run: mvn -f .\services\dispatch-service\pom.xml package -DskipTests `"-Dquarkus.package.output-directory=quarkus-app-day23`""
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
    "X-Actor-User-Id" = "00000000-0000-0000-0000-000000000023"
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
    Assert-Condition -Condition ($SeedPage.data[0].seat_count -eq 25) -Message "Expected seed seat count to be 25."
    $SeedLayout = Invoke-DispatchJson -Method Get -Path "/seat-layouts/$($SeedPage.data[0].id)"
    Assert-Condition -Condition (@($SeedLayout.seats).Count -eq 25) -Message "Expected 25 seat definitions in the seed layout."
    Assert-Condition -Condition ($SeedLayout.seats[24].seat_number -eq 25) -Message "Expected seat 25 in the seed layout."

    Invoke-ExpectHttpError -Method Post -Path "/seat-layouts" -ExpectedStatusCode 400 -Headers $AuditHeaders -Body @{
        name = "Layout incompleto"
        seats = @(
            @{ seat_number = 1; label = "1"; row_number = 1; column_number = 1; position = "WINDOW" },
            @{ seat_number = 3; label = "3"; row_number = 1; column_number = 2; position = "AISLE" }
        )
    }

    $CustomLayout = Invoke-DispatchJson -Method Post -Path "/seat-layouts" -Headers $AuditHeaders -Body @{
        name = "Manual 4 asientos"
        seats = @(
            @{ seat_number = 1; label = "1"; row_number = 1; column_number = 1; position = "WINDOW" },
            @{ seat_number = 2; label = "2"; row_number = 1; column_number = 2; position = "AISLE" },
            @{ seat_number = 3; label = "3"; row_number = 1; column_number = 4; position = "AISLE" },
            @{ seat_number = 4; label = "4"; row_number = 1; column_number = 5; position = "WINDOW" }
        )
    }
    Assert-Condition -Condition ($CustomLayout.seat_count -eq 4) -Message "Expected custom layout with 4 seats."

    $CustomLayout = Invoke-DispatchJson -Method Patch -Path "/seat-layouts/$($CustomLayout.id)" -Headers $AuditHeaders -Body @{
        name = "Manual 5 asientos"
        seats = @(
            @{ seat_number = 1; label = "1"; row_number = 1; column_number = 1; position = "WINDOW" },
            @{ seat_number = 2; label = "2"; row_number = 1; column_number = 2; position = "AISLE" },
            @{ seat_number = 3; label = "3"; row_number = 1; column_number = 3; position = "MIDDLE" },
            @{ seat_number = 4; label = "4"; row_number = 1; column_number = 4; position = "AISLE" },
            @{ seat_number = 5; label = "5"; row_number = 1; column_number = 5; position = "WINDOW" }
        )
    }
    Assert-Condition -Condition ($CustomLayout.seat_count -eq 5) -Message "Expected custom layout update with 5 seats."
    Invoke-DispatchJson -Method Delete -Path "/seat-layouts/$($CustomLayout.id)" -Headers $AuditHeaders | Out-Null

    $BusType = Invoke-DispatchJson -Method Post -Path "/bus-types" -Headers $AuditHeaders -Body @{
        legacy_id = 2301
        name = "Interprovincial"
        description = "Bus para rutas interprovinciales"
    }

    Invoke-ExpectHttpError -Method Post -Path "/bus-types" -ExpectedStatusCode 409 -Headers $AuditHeaders -Body @{
        legacy_id = 2302
        name = "interprovincial"
    }

    $BusType = Invoke-DispatchJson -Method Patch -Path "/bus-types/$($BusType.id)" -Headers $AuditHeaders -Body @{
        description = "Bus interprovincial validado"
    }

    $Terminal = Invoke-DispatchJson -Method Post -Path "/terminals" -Headers $AuditHeaders -Body @{
        legacy_id = 2301
        local_code = "DAY23"
        name = "Terminal Dia 23"
        manager_name = "Operador Dia 23"
        address = "Av. Dia 23"
        phone = "022300001"
        email = "day23@example.local"
    }

    $Bus = Invoke-DispatchJson -Method Post -Path "/buses" -Headers $AuditHeaders -Body @{
        legacy_id = 2301
        code = "BUS-D23-001"
        plate = "PBD-2301"
        description = "Unidad validada Dia 23"
        default_destination = "Guayaquil"
        bus_type_id = $BusType.id
        terminal_id = $Terminal.id
        seat_layout_id = $SeedLayout.id
    }
    Assert-Condition -Condition ($Bus.seat_count -eq 25) -Message "Expected bus to inherit the 25-seat layout."

    Invoke-ExpectHttpError -Method Post -Path "/buses" -ExpectedStatusCode 409 -Headers $AuditHeaders -Body @{
        legacy_id = 2302
        code = "bus-d23-001"
        plate = "PBD-2302"
        bus_type_id = $BusType.id
        terminal_id = $Terminal.id
        seat_layout_id = $SeedLayout.id
    }

    $BusPage = Invoke-DispatchJson -Method Get -Path "/buses?q=PBD-2301&active=true&page=1&page_size=10"
    Assert-Condition -Condition (@($BusPage.data).Count -eq 1) -Message "Expected one active bus matching PBD-2301."

    $UpdatedBus = Invoke-DispatchJson -Method Patch -Path "/buses/$($Bus.id)" -Headers $AuditHeaders -Body @{
        default_destination = "Cuenca"
        description = "Unidad actualizada Dia 23"
    }
    Assert-Condition -Condition ($UpdatedBus.default_destination -eq "Cuenca") -Message "Expected bus default destination update."

    Invoke-ExpectHttpError -Method Patch -Path "/seat-layouts/$($SeedLayout.id)" -ExpectedStatusCode 409 -Headers $AuditHeaders -Body @{
        seats = @(
            @{ seat_number = 1; label = "1"; row_number = 1; column_number = 1; position = "WINDOW" }
        )
    }

    Invoke-ExpectHttpError -Method Delete -Path "/seat-layouts/$($SeedLayout.id)" -ExpectedStatusCode 409 -Headers $AuditHeaders

    Invoke-DispatchJson -Method Delete -Path "/buses/$($Bus.id)" -Headers $AuditHeaders | Out-Null
    Invoke-DispatchJson -Method Delete -Path "/bus-types/$($BusType.id)" -Headers $AuditHeaders | Out-Null
    Invoke-DispatchJson -Method Delete -Path "/terminals/$($Terminal.id)" -Headers $AuditHeaders | Out-Null

    $InactiveBusPage = Invoke-DispatchJson -Method Get -Path "/buses?active=false&page=1&page_size=10"
    Assert-Condition -Condition (@($InactiveBusPage.data).Count -eq 1) -Message "Expected one inactive bus after deletion."

    $AuditSql = "select count(*) from outbox_events where event_type in ('BUS_TYPE_CREATED','BUS_TYPE_UPDATED','BUS_TYPE_DEACTIVATED','SEAT_LAYOUT_CREATED','SEAT_LAYOUT_UPDATED','SEAT_LAYOUT_DEACTIVATED','BUS_CREATED','BUS_UPDATED','BUS_DEACTIVATED','TERMINAL_CREATED','TERMINAL_DEACTIVATED');"
    $AuditCountText = & docker exec -e "PGPASSWORD=$PostgresPassword" $ContainerName `
        psql -U postgres -d dispatch_db -tAc $AuditSql
    Assert-ExitCode -ExitCode $LASTEXITCODE -Message "Could not query outbox audit events."
    $AuditCount = [int](($AuditCountText | Select-Object -First 1).Trim())
    Assert-Condition -Condition ($AuditCount -ge 10) -Message "Expected at least 10 audit events, but found $AuditCount."

    [pscustomobject]@{
        service = "dispatch-service"
        validation = "buses-layouts-crud"
        quarkus_profile = "onprem"
        secrets_provider = "env"
        database = "dispatch_db"
        database_port = $DatabasePort
        http_port = $HttpPort
        jar = $ResolvedJarPath
        seed_layout = $SeedLayout.name
        seed_seats = @($SeedLayout.seats).Count
        created_bus_type = $BusType.id
        created_bus = $Bus.id
        inactive_buses = @($InactiveBusPage.data).Count
        audit_events = $AuditCount
        invalid_layout_status = 400
        duplicate_bus_type_status = 409
        duplicate_bus_status = 409
        layout_in_use_status = 409
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
