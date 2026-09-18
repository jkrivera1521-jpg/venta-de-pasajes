param(
    [string]$MfeIdentityUrl = "http://localhost:3001",
    [int]$IdentityHttpPort = 8081,
    [int]$DatabasePort = 55434,
    [string]$PostgresImage = "postgres:16-alpine",
    [string]$ContainerName = "venta-pasajes-mfe-identity-pg-$PID"
)

$ErrorActionPreference = "Stop"

$Root = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")
$ServiceRoot = Join-Path $Root "services\identity-service"
$JarPath = Join-Path $ServiceRoot "target\quarkus-app\quarkus-run.jar"
$TargetDir = Join-Path $ServiceRoot "target"
$StdOutPath = Join-Path $TargetDir "mfe-identity-backend.out.log"
$StdErrPath = Join-Path $TargetDir "mfe-identity-backend.err.log"

$AppProcess = $null
$ContainerStarted = $false
$PostgresPassword = [Convert]::ToBase64String(([guid]::NewGuid()).ToByteArray()).TrimEnd("=")
$AdminPassword = "Adm1n-" + [Convert]::ToBase64String(([guid]::NewGuid()).ToByteArray()).TrimEnd("=") + "-Pass"
$JwtSecret = "jwt-" + [Convert]::ToBase64String(([guid]::NewGuid()).ToByteArray()) + [Convert]::ToBase64String(([guid]::NewGuid()).ToByteArray())
$PasswordPepper = "pepper-" + [Convert]::ToBase64String(([guid]::NewGuid()).ToByteArray())
$RecoveryPepper = "recovery-" + [Convert]::ToBase64String(([guid]::NewGuid()).ToByteArray())

function Assert-PortAvailable {
    param([int]$Port)

    $Connection = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
    if ($Connection) {
        throw "Port $Port is already in use."
    }
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
        & docker exec $ContainerName pg_isready -U postgres -d identity_db | Out-Null
        if ($LASTEXITCODE -eq 0) {
            return
        }

        Start-Sleep -Seconds 2
    }

    throw "PostgreSQL container did not become ready."
}

function Wait-ServiceReady {
    $ReadyUri = "http://localhost:$IdentityHttpPort/q/health/ready"

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

function Invoke-Json {
    param(
        [string]$Uri,
        [string]$Method = "GET",
        [object]$Body,
        [hashtable]$Headers
    )

    $Arguments = @{
        Uri = $Uri
        Method = $Method
        TimeoutSec = 10
    }

    if ($Body) {
        $Arguments.ContentType = "application/json"
        $Arguments.Body = ($Body | ConvertTo-Json -Depth 8)
    }

    if ($Headers) {
        $Arguments.Headers = $Headers
    }

    Invoke-RestMethod @Arguments
}

function Assert-HttpOk {
    param([string]$Uri)

    $StatusCode = & curl.exe -s -o NUL -w "%{http_code}" $Uri
    if ($LASTEXITCODE -ne 0 -or $StatusCode -ne "200") {
        throw "Expected HTTP 200 from $Uri but received $StatusCode."
    }
}

if (!(Test-Path -LiteralPath $JarPath)) {
    throw "Quarkus JVM artifact was not found. Run: mvn -f .\services\identity-service\pom.xml package -DskipTests"
}

$Manifest = Invoke-Json -Uri "$MfeIdentityUrl/mfe/manifest"
if ($Manifest.name -ne "mfe-identity") {
    throw "MFE manifest did not identify mfe-identity."
}

Assert-HttpOk -Uri "$MfeIdentityUrl/api/health"
Assert-HttpOk -Uri "$MfeIdentityUrl/identity/embedded"
Assert-PortAvailable -Port $IdentityHttpPort
Assert-PortAvailable -Port $DatabasePort

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
    $env:QUARKUS_HTTP_PORT = [string]$IdentityHttpPort
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
    $env:APP_GOOGLE_CLIENT_IDS = "local-google-client-placeholder"
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

    $Login = Invoke-Json -Uri "$MfeIdentityUrl/api/identity/auth/local/login" -Method "POST" -Body @{
        login = "admin"
        password = $AdminPassword
    }
    if ([string]::IsNullOrWhiteSpace($Login.access_token)) {
        throw "MFE proxy login did not return an access token."
    }

    $Headers = @{ Authorization = "Bearer $($Login.access_token)" }
    $Me = Invoke-Json -Uri "$MfeIdentityUrl/api/identity/me" -Headers $Headers
    $Users = Invoke-Json -Uri "$MfeIdentityUrl/api/identity/users" -Headers $Headers
    $Roles = Invoke-Json -Uri "$MfeIdentityUrl/api/identity/roles" -Headers $Headers
    $Permissions = Invoke-Json -Uri "$MfeIdentityUrl/api/identity/permissions" -Headers $Headers
    $AuthorizedIdentities = Invoke-Json -Uri "$MfeIdentityUrl/api/identity/authorized-identities" -Headers $Headers

    [pscustomobject]@{
        service = "mfe-identity"
        mfe_url = $MfeIdentityUrl
        manifest = "ok"
        embedded_page_status = 200
        identity_proxy = "ok"
        identity_backend_port = $IdentityHttpPort
        bootstrap_admin_login = $Me.login
        token_returned = $true
        users_count = @($Users).Count
        roles_count = @($Roles).Count
        permissions_count = @($Permissions).Count
        authorized_identities_count = @($AuthorizedIdentities).Count
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
        "APP_GOOGLE_CLIENT_IDS",
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
