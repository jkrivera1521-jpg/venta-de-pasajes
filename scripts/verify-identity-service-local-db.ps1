param(
    [int]$DatabasePort = 55432,
    [int]$HttpPort = 18081,
    [string]$PostgresImage = "postgres:16-alpine",
    [string]$ContainerName = "venta-pasajes-identity-pg-$PID"
)

$ErrorActionPreference = "Stop"

$Root = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")
$ServiceRoot = Join-Path $Root "services\identity-service"
$JarPath = Join-Path $ServiceRoot "target\quarkus-app\quarkus-run.jar"
$TargetDir = Join-Path $ServiceRoot "target"
$StdOutPath = Join-Path $TargetDir "identity-service-local-db.out.log"
$StdErrPath = Join-Path $TargetDir "identity-service-local-db.err.log"

$AppProcess = $null
$ContainerStarted = $false
$Ready = $false
$PostgresPassword = [Convert]::ToBase64String(([guid]::NewGuid()).ToByteArray()).TrimEnd("=")

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
        & docker exec $ContainerName pg_isready -U postgres -d identity_db | Out-Null
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
        }
        catch {
            Start-Sleep -Seconds 2
        }
    }

    return $false
}

if (!(Test-Path -LiteralPath $JarPath)) {
    throw "Quarkus JVM artifact was not found. Run: mvn -f .\services\identity-service\pom.xml package -DskipTests"
}

try {
    & docker run --rm --name $ContainerName `
        -e POSTGRES_DB=identity_db `
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
    $env:APP_DB_NAME = "identity_db"
    $env:APP_DB_JDBC_URL = "jdbc:postgresql://localhost:$DatabasePort/identity_db"
    $env:APP_DB_USERNAME = "postgres"
    $env:APP_DB_PASSWORD = $PostgresPassword
    $env:QUARKUS_FLYWAY_MIGRATE_AT_START = "true"
    $env:APP_LOG_CONSOLE_JSON = "false"

    $AppProcess = Start-Process `
        -FilePath "java" `
        -ArgumentList @("-jar", $JarPath) `
        -RedirectStandardOutput $StdOutPath `
        -RedirectStandardError $StdErrPath `
        -WindowStyle Hidden `
        -PassThru

    $Ready = Wait-ServiceReady

    if (!$Ready) {
        $ErrorPreview = ""
        if (Test-Path -LiteralPath $StdErrPath) {
            $ErrorPreview = (Get-Content -LiteralPath $StdErrPath -Tail 40) -join "`n"
        }
        throw "identity-service did not become ready. Recent stderr:`n$ErrorPreview"
    }

    [pscustomobject]@{
        service = "identity-service"
        quarkus_profile = "onprem"
        secrets_provider = "env"
        database = "identity_db"
        migration_tool = "flyway"
        database_port = $DatabasePort
        http_port = $HttpPort
        health_ready = "UP"
        container = $ContainerName
        ready = $true
    } | ConvertTo-Json -Depth 5 -Compress
}
finally {
    if ($AppProcess -and !$AppProcess.HasExited) {
        Stop-Process -Id $AppProcess.Id -Force
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
