param(
    [int]$DatabasePort = 55433,
    [int]$HttpPort = 18082,
    [string]$PostgresImage = "postgres:16-alpine",
    [string]$ContainerName = "venta-pasajes-identity-auth-pg-$PID"
)

$ErrorActionPreference = "Stop"

$Root = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")
$ServiceRoot = Join-Path $Root "services\identity-service"
$JarPath = Join-Path $ServiceRoot "target\quarkus-app\quarkus-run.jar"
$TargetDir = Join-Path $ServiceRoot "target"
$StdOutPath = Join-Path $TargetDir "identity-service-auth-local.out.log"
$StdErrPath = Join-Path $TargetDir "identity-service-auth-local.err.log"

$AppProcess = $null
$ContainerStarted = $false
$PostgresPassword = [Convert]::ToBase64String(([guid]::NewGuid()).ToByteArray()).TrimEnd("=")
$AdminPassword = "Adm1n-" + [Convert]::ToBase64String(([guid]::NewGuid()).ToByteArray()).TrimEnd("=") + "-Pass"
$NewAdminPassword = "Adm1n-" + [Convert]::ToBase64String(([guid]::NewGuid()).ToByteArray()).TrimEnd("=") + "-Reset"
$JwtSecret = "jwt-" + [Convert]::ToBase64String(([guid]::NewGuid()).ToByteArray()) + [Convert]::ToBase64String(([guid]::NewGuid()).ToByteArray())
$PasswordPepper = "pepper-" + [Convert]::ToBase64String(([guid]::NewGuid()).ToByteArray())
$RecoveryPepper = "recovery-" + [Convert]::ToBase64String(([guid]::NewGuid()).ToByteArray())

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

function Invoke-IdentityJson {
    param(
        [string]$Path,
        [string]$Method,
        [object]$Body,
        [hashtable]$Headers
    )

    $Arguments = @{
        Uri = "http://localhost:$HttpPort/api/v1/identity$Path"
        Method = $Method
        ContentType = "application/json"
        TimeoutSec = 10
    }

    if ($Body) {
        $Arguments.Body = ($Body | ConvertTo-Json -Depth 8)
    }

    if ($Headers) {
        $Arguments.Headers = $Headers
    }

    Invoke-RestMethod @Arguments
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
    $env:APP_JWT_SIGNING_SECRET = $JwtSecret
    $env:APP_PASSWORD_PEPPER = $PasswordPepper
    $env:APP_RECOVERY_TOKEN_PEPPER = $RecoveryPepper
    $env:APP_AUTH_PASSWORD_PBKDF2_ITERATIONS = "10000"
    $env:APP_AUTH_RECOVERY_RETURN_TOKEN_ENABLED = "true"
    $env:APP_BOOTSTRAP_ADMIN_ENABLED = "true"
    $env:APP_BOOTSTRAP_ADMIN_LOGIN = "admin"
    $env:APP_BOOTSTRAP_ADMIN_EMAIL = "admin@onprem.local"
    $env:APP_BOOTSTRAP_ADMIN_DISPLAY_NAME = "Administrador Local"
    $env:APP_BOOTSTRAP_ADMIN_PASSWORD = $AdminPassword
    $env:QUARKUS_FLYWAY_MIGRATE_AT_START = "true"
    $env:APP_LOG_CONSOLE_JSON = "false"

    $AppProcess = Start-Process `
        -FilePath "java" `
        -ArgumentList @("-jar", $JarPath) `
        -RedirectStandardOutput $StdOutPath `
        -RedirectStandardError $StdErrPath `
        -WindowStyle Hidden `
        -PassThru

    if (!(Wait-ServiceReady)) {
        $ErrorPreview = ""
        if (Test-Path -LiteralPath $StdErrPath) {
            $ErrorPreview = (Get-Content -LiteralPath $StdErrPath -Tail 60) -join "`n"
        }
        throw "identity-service did not become ready. Recent stderr:`n$ErrorPreview"
    }

    $Login = Invoke-IdentityJson -Path "/auth/local/login" -Method "Post" -Body @{
        login = "admin"
        password = $AdminPassword
    }
    if ([string]::IsNullOrWhiteSpace($Login.access_token)) {
        throw "Local login did not return an access token."
    }

    $Headers = @{ Authorization = "Bearer $($Login.access_token)" }
    $Me = Invoke-IdentityJson -Path "/me" -Method "Get" -Headers $Headers
    $Permissions = Invoke-IdentityJson -Path "/permissions" -Method "Get" -Headers $Headers
    $Roles = Invoke-IdentityJson -Path "/roles" -Method "Get" -Headers $Headers
    $Users = Invoke-IdentityJson -Path "/users" -Method "Get" -Headers $Headers

    $Forgot = Invoke-IdentityJson -Path "/password/forgot" -Method "Post" -Body @{
        login_or_email = "admin"
    }
    if ([string]::IsNullOrWhiteSpace($Forgot.recovery_token)) {
        throw "Password recovery did not return a test recovery token."
    }

    Invoke-IdentityJson -Path "/password/reset" -Method "Post" -Body @{
        token = $Forgot.recovery_token
        new_password = $NewAdminPassword
    } | Out-Null

    $SecondLogin = Invoke-IdentityJson -Path "/auth/local/login" -Method "Post" -Body @{
        login = "admin"
        password = $NewAdminPassword
    }
    if ([string]::IsNullOrWhiteSpace($SecondLogin.access_token)) {
        throw "Local login after password reset did not return an access token."
    }

    [pscustomobject]@{
        service = "identity-service"
        quarkus_profile = "onprem"
        secrets_provider = "env"
        database = "identity_db"
        migration_tool = "flyway"
        database_port = $DatabasePort
        http_port = $HttpPort
        bootstrap_admin_login = $Me.login
        token_returned = $true
        roles_count = @($Roles).Count
        permissions_count = @($Permissions).Count
        users_count = @($Users).Count
        password_recovery_verified = $true
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
        "APP_JWT_SIGNING_SECRET",
        "APP_PASSWORD_PEPPER",
        "APP_RECOVERY_TOKEN_PEPPER",
        "APP_AUTH_PASSWORD_PBKDF2_ITERATIONS",
        "APP_AUTH_RECOVERY_RETURN_TOKEN_ENABLED",
        "APP_BOOTSTRAP_ADMIN_ENABLED",
        "APP_BOOTSTRAP_ADMIN_LOGIN",
        "APP_BOOTSTRAP_ADMIN_EMAIL",
        "APP_BOOTSTRAP_ADMIN_DISPLAY_NAME",
        "APP_BOOTSTRAP_ADMIN_PASSWORD",
        "QUARKUS_FLYWAY_MIGRATE_AT_START",
        "APP_LOG_CONSOLE_JSON"
    )) {
        Remove-Item -LiteralPath "Env:\$Name" -ErrorAction SilentlyContinue
    }
}
