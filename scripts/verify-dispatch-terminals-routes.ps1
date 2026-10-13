param(
    [int]$DatabasePort = 55437,
    [int]$HttpPort = 18085,
    [string]$PostgresImage = "postgres:16-alpine",
    [string]$ContainerName = "venta-pasajes-dispatch-crud-pg-$PID",
    [string]$JarPath = ""
)

$ErrorActionPreference = "Stop"

$Root = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")
$ServiceRoot = Join-Path $Root "services\dispatch-service"
$TargetDir = Join-Path $ServiceRoot "target"
$StdOutPath = Join-Path $TargetDir "dispatch-service-terminals-routes.out.log"
$StdErrPath = Join-Path $TargetDir "dispatch-service-terminals-routes.err.log"
$AppProcess = $null
$ContainerStarted = $false
$PostgresPassword = [Convert]::ToBase64String(([guid]::NewGuid()).ToByteArray()).TrimEnd("=")

function Resolve-DispatchJar {
    if ($JarPath -and $JarPath.Trim()) {
        return (Resolve-Path -LiteralPath $JarPath).Path
    }

    $Candidates = @(
        (Join-Path $TargetDir "quarkus-app\quarkus-run.jar"),
        (Join-Path $TargetDir "quarkus-app-day22\quarkus-run.jar")
    ) | Where-Object { Test-Path -LiteralPath $_ } |
        ForEach-Object { Get-Item -LiteralPath $_ } |
        Sort-Object LastWriteTime -Descending

    if ($Candidates.Count -gt 0) {
        return $Candidates[0].FullName
    }

    throw "Quarkus JVM artifact was not found. Run: mvn -f .\services\dispatch-service\pom.xml package -DskipTests. If Windows blocks target\quarkus-app, run: mvn -f .\services\dispatch-service\pom.xml package -DskipTests `"-Dquarkus.package.output-directory=quarkus-app-day22`""
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
        $Parameters.Body = ($Body | ConvertTo-Json -Depth 10)
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
    "X-Actor-User-Id" = "00000000-0000-0000-0000-000000000022"
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

    $Origin = Invoke-DispatchJson -Method Post -Path "/terminals" -Headers $AuditHeaders -Body @{
        legacy_id = 2201
        local_code = "UIO"
        name = "Terminal Quitumbe"
        manager_name = "Operador Norte"
        address = "Av. Quitumbe"
        phone = "022000001"
        email = "quitumbe@example.local"
    }

    $Destination = Invoke-DispatchJson -Method Post -Path "/terminals" -Headers $AuditHeaders -Body @{
        legacy_id = 2202
        local_code = "GYE"
        name = "Terminal Guayaquil"
        manager_name = "Operador Costa"
        address = "Av. Terminal"
        phone = "042000001"
        email = "guayaquil@example.local"
    }

    Invoke-ExpectHttpError -Method Post -Path "/terminals" -ExpectedStatusCode 409 -Headers $AuditHeaders -Body @{
        local_code = "UIO-2"
        name = "terminal quitumbe"
    }

    $TerminalPage = Invoke-DispatchJson -Method Get -Path "/terminals?q=quitumbe&active=true&page=1&page_size=10"
    Assert-Condition -Condition (@($TerminalPage.data).Count -eq 1) -Message "Expected one active terminal matching q=quitumbe."
    Assert-Condition -Condition ($TerminalPage.data[0].name -eq "Terminal Quitumbe") -Message "Unexpected terminal search result."

    $UpdatedOrigin = Invoke-DispatchJson -Method Patch -Path "/terminals/$($Origin.id)" -Headers $AuditHeaders -Body @{
        manager_name = "Operador Sierra"
        phone = "022000099"
    }
    Assert-Condition -Condition ($UpdatedOrigin.manager_name -eq "Operador Sierra") -Message "Terminal update was not applied."

    Invoke-ExpectHttpError -Method Post -Path "/routes" -ExpectedStatusCode 400 -Headers $AuditHeaders -Body @{
        origin_terminal_id = $Origin.id
        destination_terminal_id = $Origin.id
    }

    $Route = Invoke-DispatchJson -Method Post -Path "/routes" -Headers $AuditHeaders -Body @{
        origin_terminal_id = $Origin.id
        destination_terminal_id = $Destination.id
    }
    Assert-Condition -Condition ($Route.name -eq "Terminal Quitumbe - Terminal Guayaquil") -Message "Default route name was not generated."

    Invoke-ExpectHttpError -Method Post -Path "/routes" -ExpectedStatusCode 409 -Headers $AuditHeaders -Body @{
        origin_terminal_id = $Origin.id
        destination_terminal_id = $Destination.id
        name = "Duplicada"
    }

    $RoutePage = Invoke-DispatchJson -Method Get -Path "/routes?origin_terminal_id=$($Origin.id)&active=true&page=1&page_size=10"
    Assert-Condition -Condition (@($RoutePage.data).Count -eq 1) -Message "Expected one active route for the origin terminal."

    $UpdatedRoute = Invoke-DispatchJson -Method Patch -Path "/routes/$($Route.id)" -Headers $AuditHeaders -Body @{
        name = "Quito - Guayaquil Express"
    }
    Assert-Condition -Condition ($UpdatedRoute.name -eq "Quito - Guayaquil Express") -Message "Route update was not applied."

    Invoke-DispatchJson -Method Delete -Path "/routes/$($Route.id)" -Headers $AuditHeaders | Out-Null
    $InactiveRoutePage = Invoke-DispatchJson -Method Get -Path "/routes?active=false&page=1&page_size=10"
    Assert-Condition -Condition (@($InactiveRoutePage.data).Count -eq 1) -Message "Expected one inactive route after deletion."

    Invoke-DispatchJson -Method Delete -Path "/terminals/$($Origin.id)" -Headers $AuditHeaders | Out-Null
    Invoke-DispatchJson -Method Delete -Path "/terminals/$($Destination.id)" -Headers $AuditHeaders | Out-Null
    $InactiveTerminalPage = Invoke-DispatchJson -Method Get -Path "/terminals?active=false&page=1&page_size=10"
    Assert-Condition -Condition (@($InactiveTerminalPage.data).Count -eq 2) -Message "Expected two inactive terminals after deletion."

    $AuditSql = "select count(*) from outbox_events where event_type in ('TERMINAL_CREATED','TERMINAL_UPDATED','TERMINAL_DEACTIVATED','ROUTE_CREATED','ROUTE_UPDATED','ROUTE_DEACTIVATED');"
    $AuditCountText = & docker exec -e "PGPASSWORD=$PostgresPassword" $ContainerName `
        psql -U postgres -d dispatch_db -tAc $AuditSql
    Assert-ExitCode -ExitCode $LASTEXITCODE -Message "Could not query outbox audit events."
    $AuditCount = [int](($AuditCountText | Select-Object -First 1).Trim())
    Assert-Condition -Condition ($AuditCount -ge 8) -Message "Expected at least 8 audit events, but found $AuditCount."

    $TerminalCountText = & docker exec -e "PGPASSWORD=$PostgresPassword" $ContainerName `
        psql -U postgres -d dispatch_db -tAc "select count(*) from terminals;"
    Assert-ExitCode -ExitCode $LASTEXITCODE -Message "Could not query terminal count."
    $TerminalCount = [int](($TerminalCountText | Select-Object -First 1).Trim())

    $RouteCountText = & docker exec -e "PGPASSWORD=$PostgresPassword" $ContainerName `
        psql -U postgres -d dispatch_db -tAc "select count(*) from routes;"
    Assert-ExitCode -ExitCode $LASTEXITCODE -Message "Could not query route count."
    $RouteCount = [int](($RouteCountText | Select-Object -First 1).Trim())

    [pscustomobject]@{
        service = "dispatch-service"
        validation = "terminals-routes-crud"
        quarkus_profile = "onprem"
        secrets_provider = "env"
        database = "dispatch_db"
        database_port = $DatabasePort
        http_port = $HttpPort
        jar = $ResolvedJarPath
        created_terminals = $TerminalCount
        created_routes = $RouteCount
        inactive_terminals = @($InactiveTerminalPage.data).Count
        inactive_routes = @($InactiveRoutePage.data).Count
        audit_events = $AuditCount
        duplicate_terminal_status = 409
        duplicate_route_status = 409
        invalid_route_status = 400
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
