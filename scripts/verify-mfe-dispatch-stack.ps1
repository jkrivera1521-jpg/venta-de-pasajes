param(
    [int]$DatabasePort = 55440,
    [int]$DispatchHttpPort = 18088,
    [int]$ShellPort = 3010,
    [int]$MfeDispatchPort = 3012,
    [string]$PostgresImage = "postgres:16-alpine",
    [string]$ContainerName = "venta-pasajes-mfe-dispatch-pg-$PID",
    [string]$JarPath = ""
)

$ErrorActionPreference = "Stop"

$Root = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$ServiceRoot = Join-Path -Path $Root -ChildPath "services\dispatch-service"
$TargetDir = Join-Path -Path $ServiceRoot -ChildPath "target"
$StdOutPath = Join-Path -Path $TargetDir -ChildPath "dispatch-service-mfe-dispatch.out.log"
$StdErrPath = Join-Path -Path $TargetDir -ChildPath "dispatch-service-mfe-dispatch.err.log"
$AppProcess = $null
$ContainerStarted = $false
$PostgresPassword = [Convert]::ToBase64String(([guid]::NewGuid()).ToByteArray()).TrimEnd("=")

function Resolve-DispatchJar {
    if ($JarPath -and $JarPath.Trim()) {
        return (Resolve-Path -LiteralPath $JarPath).Path
    }

    $Candidates = @(
        (Join-Path -Path $TargetDir -ChildPath "quarkus-app-day24\quarkus-run.jar"),
        (Join-Path -Path $TargetDir -ChildPath "quarkus-app-day23\quarkus-run.jar"),
        (Join-Path -Path $TargetDir -ChildPath "quarkus-app\quarkus-run.jar")
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
    $ReadyUri = "http://localhost:$DispatchHttpPort/q/health/ready"

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

$ResolvedJarPath = Resolve-DispatchJar

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
    $env:QUARKUS_HTTP_PORT = [string]$DispatchHttpPort
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

    $MfeValidationRaw = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path -Path $Root -ChildPath "scripts\verify-mfe-dispatch.ps1") `
        -ShellPort $ShellPort `
        -MfeDispatchPort $MfeDispatchPort `
        -DispatchApiUrl "http://localhost:$DispatchHttpPort/api/v1/dispatch"

    $MfeValidation = $MfeValidationRaw | ConvertFrom-Json

    [pscustomobject]@{
        service = "mfe-dispatch"
        validation = "frontend-backend-stack"
        database = "dispatch_db"
        database_port = $DatabasePort
        dispatch_http_port = $DispatchHttpPort
        shell_url = $MfeValidation.shell_url
        shell_status = $MfeValidation.shell_status
        mfe_dispatch_url = $MfeValidation.mfe_dispatch_url
        mfe_dispatch_health = $MfeValidation.mfe_dispatch_health
        manifest_name = $MfeValidation.manifest_name
        embedded_status = $MfeValidation.embedded_status
        backend_proxy_status = $MfeValidation.backend_proxy_status
        ready = ($MfeValidation.ready -and $MfeValidation.backend_proxy_status -eq 200)
    } | ConvertTo-Json -Compress
}
finally {
    if ($AppProcess -and -not $AppProcess.HasExited) {
        Stop-Process -Id $AppProcess.Id -Force -ErrorAction SilentlyContinue
    }

    Get-NetTCPConnection -LocalPort $DispatchHttpPort -ErrorAction SilentlyContinue |
        Where-Object { $_.State -eq "Listen" } |
        Select-Object -ExpandProperty OwningProcess -Unique |
        Where-Object { $_ -gt 0 -and $_ -ne $PID } |
        ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }

    if ($ContainerStarted) {
        & docker stop $ContainerName | Out-Null
    }

    Remove-Item Env:QUARKUS_PROFILE,Env:QUARKUS_HTTP_PORT,Env:APP_ENV,Env:APP_RUNTIME_TARGET,Env:APP_SECRETS_PROVIDER,Env:APP_DB_NAME,Env:APP_DB_JDBC_URL,Env:APP_DB_USERNAME,Env:APP_DB_PASSWORD,Env:QUARKUS_FLYWAY_MIGRATE_AT_START,Env:APP_LOG_CONSOLE_JSON -ErrorAction SilentlyContinue
}
