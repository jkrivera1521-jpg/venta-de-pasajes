param(
    [string]$EnvFile = "C:\VENTA-DE-PASAJES-RUNTIME\identity-service.env",
    [string]$JarPath,
    [int]$HttpPort = 8081,
    [switch]$MigrateAtStart,
    [switch]$AllowEmptyDbPassword
)

$ErrorActionPreference = "Stop"

$Root = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")
$ServiceRoot = Join-Path $Root "services\identity-service"

if (-not $JarPath) {
    $JarPath = Join-Path $ServiceRoot "target\quarkus-app\quarkus-run.jar"
}

function Set-DefaultEnv {
    param(
        [string]$Name,
        [string]$Value
    )

    if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($Name, "Process"))) {
        [Environment]::SetEnvironmentVariable($Name, $Value, "Process")
    }
}

function Import-EnvFile {
    param([string]$Path)

    if (!(Test-Path -LiteralPath $Path)) {
        throw "Env file was not found: $Path"
    }

    foreach ($Line in Get-Content -LiteralPath $Path) {
        $Trimmed = $Line.Trim()

        if (!$Trimmed -or $Trimmed.StartsWith("#")) {
            continue
        }

        if ($Trimmed -notmatch "^([A-Za-z_][A-Za-z0-9_]*)=(.*)$") {
            throw "Invalid env line in $Path`: $Line"
        }

        $Name = $Matches[1]
        $Value = $Matches[2]

        if (($Value.StartsWith('"') -and $Value.EndsWith('"')) -or ($Value.StartsWith("'") -and $Value.EndsWith("'"))) {
            $Value = $Value.Substring(1, $Value.Length - 2)
        }

        [Environment]::SetEnvironmentVariable($Name, $Value, "Process")
    }
}

Import-EnvFile -Path $EnvFile

Set-DefaultEnv -Name "QUARKUS_PROFILE" -Value "onprem"
Set-DefaultEnv -Name "APP_ENV" -Value "onprem"
Set-DefaultEnv -Name "APP_RUNTIME_TARGET" -Value "onprem"
Set-DefaultEnv -Name "APP_SECRETS_PROVIDER" -Value "env"
Set-DefaultEnv -Name "QUARKUS_HTTP_PORT" -Value ([string]$HttpPort)
Set-DefaultEnv -Name "APP_LOG_CONSOLE_JSON" -Value "false"

if ($MigrateAtStart) {
    [Environment]::SetEnvironmentVariable("QUARKUS_FLYWAY_MIGRATE_AT_START", "true", "Process")
}

if (!(Test-Path -LiteralPath $JarPath)) {
    throw "Quarkus JVM artifact was not found: $JarPath"
}

foreach ($RequiredName in @("APP_DB_JDBC_URL", "APP_DB_USERNAME")) {
    if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($RequiredName, "Process"))) {
        throw "$RequiredName is required for on-premise startup."
    }
}

if (!$AllowEmptyDbPassword -and [string]::IsNullOrEmpty([Environment]::GetEnvironmentVariable("APP_DB_PASSWORD", "Process"))) {
    throw "APP_DB_PASSWORD is empty. Pass -AllowEmptyDbPassword only when PostgreSQL authentication is configured without password."
}

[pscustomobject]@{
    service = "identity-service"
    quarkus_profile = [Environment]::GetEnvironmentVariable("QUARKUS_PROFILE", "Process")
    runtime_target = [Environment]::GetEnvironmentVariable("APP_RUNTIME_TARGET", "Process")
    secrets_provider = [Environment]::GetEnvironmentVariable("APP_SECRETS_PROVIDER", "Process")
    database_url_configured = -not [string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable("APP_DB_JDBC_URL", "Process"))
    database_user = [Environment]::GetEnvironmentVariable("APP_DB_USERNAME", "Process")
    database_password_configured = -not [string]::IsNullOrEmpty([Environment]::GetEnvironmentVariable("APP_DB_PASSWORD", "Process"))
    jar = $JarPath
} | ConvertTo-Json -Depth 5 -Compress

& java -jar $JarPath
