param(
    [int]$ShellPort = 3000,
    [int]$MfeIdentityPort = 3001,
    [int]$MfeDispatchPort = 3002,
    [int]$MfeTicketingPort = 3003,
    [int]$MfeReportingPort = 3004,
    [int]$MfeAdminPort = 3005,
    [string]$IdentityApiUrl = "http://localhost:8081/api/v1/identity",
    [string]$DispatchApiUrl = "http://localhost:8082/api/v1/dispatch",
    [string]$TicketingApiUrl = "http://localhost:8083/api/v1/ticketing",
    [string]$DocumentApiUrl = "http://localhost:8084/api/v1/document",
    [string]$ReportingApiUrl = "http://localhost:8085/api/v1/reporting",
    [string]$AuditApiUrl = "http://localhost:8086/api/v1/audit"
)

$ErrorActionPreference = "Stop"

$Root = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")
$LogsDir = Join-Path $Root "logs"
New-Item -ItemType Directory -Force -Path $LogsDir | Out-Null

function Assert-PortAvailable {
    param([int]$Port)

    $Connection = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
    if ($Connection) {
        throw "Port $Port is already in use."
    }
}

function Join-UrlPath {
    param(
        [string]$BaseUrl,
        [string]$Path
    )

    return "$($BaseUrl.TrimEnd('/'))/$($Path.TrimStart('/'))"
}

function Start-NextApp {
    param(
        [string]$Name,
        [string]$WorkingDirectory,
        [int]$Port,
        [hashtable]$Environment
    )

    $ResolvedWorkingDirectory = Resolve-Path -LiteralPath $WorkingDirectory -ErrorAction SilentlyContinue
    if (-not $ResolvedWorkingDirectory) {
        throw "$Name working directory was not found: $WorkingDirectory. Create the app files first or remove this app from scripts/start-frontend-dev.ps1."
    }
    $WorkingDirectory = $ResolvedWorkingDirectory.Path

    $OriginalEnvironment = @{}

    foreach ($Key in $Environment.Keys) {
        $OriginalEnvironment[$Key] = [Environment]::GetEnvironmentVariable($Key, "Process")
        [Environment]::SetEnvironmentVariable($Key, $Environment[$Key], "Process")
    }

    $StdOutPath = Join-Path $LogsDir "$Name.dev.log"
    $StdErrPath = Join-Path $LogsDir "$Name.dev.err.log"

    try {
        $Process = Start-Process `
            -FilePath "npm.cmd" `
            -ArgumentList @("run", "dev", "--", "--hostname", "127.0.0.1", "-p", "$Port") `
            -WorkingDirectory $WorkingDirectory `
            -WindowStyle Hidden `
            -RedirectStandardOutput $StdOutPath `
            -RedirectStandardError $StdErrPath `
            -PassThru

        Start-Sleep -Seconds 2
        if ($Process.HasExited) {
            $ErrorPreview = ""
            if (Test-Path -LiteralPath $StdErrPath) {
                $ErrorPreview = (Get-Content -LiteralPath $StdErrPath -Tail 20) -join "`n"
            }

            throw "$Name dev server did not stay running on port $Port. Recent stderr:`n$ErrorPreview"
        }

        $Process.Id | Set-Content -Encoding ASCII -Path (Join-Path $LogsDir "$Name.pid")
        return $Process
    }
    finally {
        foreach ($Key in $Environment.Keys) {
            [Environment]::SetEnvironmentVariable($Key, $OriginalEnvironment[$Key], "Process")
        }
    }
}

Assert-PortAvailable -Port $ShellPort
Assert-PortAvailable -Port $MfeIdentityPort
Assert-PortAvailable -Port $MfeDispatchPort
Assert-PortAvailable -Port $MfeTicketingPort
Assert-PortAvailable -Port $MfeReportingPort
Assert-PortAvailable -Port $MfeAdminPort

$MfeIdentityUrl = "http://localhost:$MfeIdentityPort"
$MfeDispatchUrl = "http://localhost:$MfeDispatchPort"
$MfeTicketingUrl = "http://localhost:$MfeTicketingPort"
$MfeReportingUrl = "http://localhost:$MfeReportingPort"
$MfeAdminUrl = "http://localhost:$MfeAdminPort"
$ShellUrl = "http://localhost:$ShellPort"

$MfeIdentityProcess = Start-NextApp `
    -Name "mfe-identity" `
    -WorkingDirectory (Join-Path $Root "apps/mfe-identity") `
    -Port $MfeIdentityPort `
    -Environment @{
        NEXT_PUBLIC_MFE_PUBLIC_URL = $MfeIdentityUrl
        IDENTITY_API_URL = $IdentityApiUrl
        NEXT_PUBLIC_IDENTITY_API_URL = $IdentityApiUrl
    }

$MfeDispatchProcess = Start-NextApp `
    -Name "mfe-dispatch" `
    -WorkingDirectory (Join-Path $Root "apps/mfe-dispatch") `
    -Port $MfeDispatchPort `
    -Environment @{
        NEXT_PUBLIC_MFE_PUBLIC_URL = $MfeDispatchUrl
        DISPATCH_API_URL = $DispatchApiUrl
        NEXT_PUBLIC_DISPATCH_API_URL = $DispatchApiUrl
    }

$MfeTicketingProcess = Start-NextApp `
    -Name "mfe-ticketing" `
    -WorkingDirectory (Join-Path $Root "apps/mfe-ticketing") `
    -Port $MfeTicketingPort `
    -Environment @{
        NEXT_PUBLIC_MFE_PUBLIC_URL = $MfeTicketingUrl
        TICKETING_API_URL = $TicketingApiUrl
        NEXT_PUBLIC_TICKETING_API_URL = $TicketingApiUrl
    }

$MfeReportingProcess = Start-NextApp `
    -Name "mfe-reporting" `
    -WorkingDirectory (Join-Path $Root "apps/mfe-reporting") `
    -Port $MfeReportingPort `
    -Environment @{
        NEXT_PUBLIC_MFE_PUBLIC_URL = $MfeReportingUrl
        REPORTING_API_URL = $ReportingApiUrl
        NEXT_PUBLIC_REPORTING_API_URL = $ReportingApiUrl
    }

$MfeAdminProcess = Start-NextApp `
    -Name "mfe-admin" `
    -WorkingDirectory (Join-Path $Root "apps/mfe-admin") `
    -Port $MfeAdminPort `
    -Environment @{
        ADMIN_AUDIT_HEALTH_URL = (Join-UrlPath -BaseUrl $AuditApiUrl -Path "health")
        ADMIN_DISPATCH_HEALTH_URL = (Join-UrlPath -BaseUrl $DispatchApiUrl -Path "health")
        ADMIN_DOCUMENT_HEALTH_URL = (Join-UrlPath -BaseUrl $DocumentApiUrl -Path "health")
        ADMIN_IDENTITY_HEALTH_URL = (Join-UrlPath -BaseUrl $IdentityApiUrl -Path "health")
        ADMIN_MFE_ADMIN_HEALTH_URL = "$MfeAdminUrl/api/health"
        ADMIN_MFE_DISPATCH_HEALTH_URL = "$MfeDispatchUrl/api/health"
        ADMIN_MFE_IDENTITY_HEALTH_URL = "$MfeIdentityUrl/api/health"
        ADMIN_MFE_REPORTING_HEALTH_URL = "$MfeReportingUrl/api/health"
        ADMIN_MFE_TICKETING_HEALTH_URL = "$MfeTicketingUrl/api/health"
        ADMIN_REPORTING_HEALTH_URL = (Join-UrlPath -BaseUrl $ReportingApiUrl -Path "health")
        ADMIN_SHELL_HEALTH_URL = "$ShellUrl/api/health"
        ADMIN_TICKETING_HEALTH_URL = (Join-UrlPath -BaseUrl $TicketingApiUrl -Path "health")
        NEXT_PUBLIC_MFE_PUBLIC_URL = $MfeAdminUrl
        AUDIT_API_URL = $AuditApiUrl
        NEXT_PUBLIC_AUDIT_API_URL = $AuditApiUrl
    }

$ShellProcess = Start-NextApp `
    -Name "frontend-shell" `
    -WorkingDirectory (Join-Path $Root "apps/frontend-shell") `
    -Port $ShellPort `
    -Environment @{
        NEXT_PUBLIC_MFE_IDENTITY_MANIFEST_URL = "$MfeIdentityUrl/mfe/manifest"
        NEXT_PUBLIC_MFE_DISPATCH_MANIFEST_URL = "$MfeDispatchUrl/mfe/manifest"
        NEXT_PUBLIC_MFE_TICKETING_MANIFEST_URL = "$MfeTicketingUrl/mfe/manifest"
        NEXT_PUBLIC_MFE_REPORTING_MANIFEST_URL = "$MfeReportingUrl/mfe/manifest"
        NEXT_PUBLIC_MFE_ADMIN_MANIFEST_URL = "$MfeAdminUrl/mfe/manifest"
    }

[pscustomobject]@{
    shell_url = $ShellUrl
    shell_pid = $ShellProcess.Id
    mfe_identity_url = $MfeIdentityUrl
    mfe_identity_pid = $MfeIdentityProcess.Id
    mfe_dispatch_url = $MfeDispatchUrl
    mfe_dispatch_pid = $MfeDispatchProcess.Id
    mfe_ticketing_url = $MfeTicketingUrl
    mfe_ticketing_pid = $MfeTicketingProcess.Id
    mfe_reporting_url = $MfeReportingUrl
    mfe_reporting_pid = $MfeReportingProcess.Id
    mfe_admin_url = $MfeAdminUrl
    mfe_admin_pid = $MfeAdminProcess.Id
} | ConvertTo-Json -Compress
