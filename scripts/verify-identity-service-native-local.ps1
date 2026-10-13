param(
    [string]$ImageTag = "identity-service:0.1.0-native",
    [int]$HttpPort = 18083,
    [int]$DatabasePort = 55435,
    [int]$TimeoutSeconds = 120
)

$ErrorActionPreference = "Stop"

$NetworkName = "venta-pasajes-identity-native-$PID"
$PostgresContainer = "venta-pasajes-identity-native-pg-$PID"
$ServiceContainer = "venta-pasajes-identity-native-app-$PID"
$DatabaseName = "identity_db"
$DatabaseUser = "postgres"
$DatabasePassword = [Guid]::NewGuid().ToString("N")
$AdminPassword = "Adm1n-" + [Guid]::NewGuid().ToString("N")
$JwtSecret = "native-local-jwt-" + [Guid]::NewGuid().ToString("N") + [Guid]::NewGuid().ToString("N")
$PasswordPepper = "native-local-password-pepper-" + [Guid]::NewGuid().ToString("N")
$RecoveryPepper = "native-local-recovery-pepper-" + [Guid]::NewGuid().ToString("N")

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
        "${HttpPort}:8081",
        "-e",
        "APP_ENV=onprem",
        "-e",
        "APP_RUNTIME_TARGET=onprem",
        "-e",
        "APP_SECRETS_PROVIDER=env",
        "-e",
        "QUARKUS_PROFILE=onprem",
        "-e",
        "QUARKUS_HTTP_PORT=8081",
        "-e",
        "QUARKUS_FLYWAY_MIGRATE_AT_START=true",
        "-e",
        "APP_DB_NAME=$DatabaseName",
        "-e",
        "APP_DB_JDBC_URL=jdbc:postgresql://${PostgresContainer}:5432/$DatabaseName",
        "-e",
        "APP_DB_USERNAME=$DatabaseUser",
        "-e",
        "APP_DB_PASSWORD=$DatabasePassword",
        "-e",
        "APP_JWT_SIGNING_SECRET=$JwtSecret",
        "-e",
        "APP_PASSWORD_PEPPER=$PasswordPepper",
        "-e",
        "APP_RECOVERY_TOKEN_PEPPER=$RecoveryPepper",
        "-e",
        "APP_GOOGLE_CLIENT_IDS=local-google-client-placeholder",
        "-e",
        "APP_BOOTSTRAP_ADMIN_ENABLED=true",
        "-e",
        "APP_BOOTSTRAP_ADMIN_LOGIN=admin",
        "-e",
        "APP_BOOTSTRAP_ADMIN_EMAIL=admin@example.local",
        "-e",
        "APP_BOOTSTRAP_ADMIN_DISPLAY_NAME=Administrador",
        "-e",
        "APP_BOOTSTRAP_ADMIN_PASSWORD=$AdminPassword",
        "-d",
        $ImageTag
    )

    Wait-Until -Seconds $TimeoutSeconds -FailureMessage "identity-service native container was not ready." -Condition {
        $Health = Invoke-RestMethod -Uri "http://localhost:$HttpPort/q/health/ready" -Method Get -TimeoutSec 2
        return $Health.status -eq "UP"
    }

    $StartupWatch.Stop()
    $StartupMilliseconds = $StartupWatch.ElapsedMilliseconds

    $LoginBody = @{
        login = "admin"
        password = $AdminPassword
    } | ConvertTo-Json -Compress

    $LoginResponse = Invoke-RestMethod -Uri "http://localhost:$HttpPort/api/v1/identity/auth/local/login" `
        -Method Post `
        -ContentType "application/json" `
        -Body $LoginBody

    $MeResponse = Invoke-RestMethod -Uri "http://localhost:$HttpPort/api/v1/identity/me" `
        -Method Get `
        -Headers @{ Authorization = "Bearer $($LoginResponse.access_token)" }

    [pscustomobject]@{
        service = "identity-service"
        runtime = "native-container"
        image = $ImageTag
        quarkus_profile = "onprem"
        database = $DatabaseName
        migration_tool = "flyway"
        http_port = $HttpPort
        database_port = $DatabasePort
        startup_ms = $StartupMilliseconds
        health_ready = "UP"
        bootstrap_admin_login = "admin"
        token_returned = [bool]$LoginResponse.access_token
        current_user = $MeResponse.login
        network = $NetworkName
        ready = $true
    } | ConvertTo-Json -Depth 5 -Compress
} catch {
    if ($StartupWatch -and $StartupWatch.IsRunning) {
        $StartupWatch.Stop()
    }

    if (Test-DockerContainerExists -Name $ServiceContainer) {
        $ServiceLogs = & docker logs $ServiceContainer 2>&1 | Select-Object -Last 80
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
