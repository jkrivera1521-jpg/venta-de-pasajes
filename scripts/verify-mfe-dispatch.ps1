param(
    [int]$ShellPort = 3010,
    [int]$MfeDispatchPort = 3012,
    [string]$DispatchApiUrl = "http://localhost:8082/api/v1/dispatch"
)

$ErrorActionPreference = "Stop"

$Root = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$LogsDir = Join-Path -Path $Root -ChildPath "logs"
New-Item -ItemType Directory -Force -Path $LogsDir | Out-Null

function Assert-PortAvailable {
    param([int]$Port)

    $Connection = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue |
        Where-Object { $_.State -eq "Listen" }

    if ($Connection) {
        throw "Port $Port is already in use."
    }
}

function Start-NextApp {
    param(
        [string]$Name,
        [string]$WorkingDirectory,
        [int]$Port,
        [hashtable]$Environment
    )

    $OriginalEnvironment = @{}

    foreach ($Key in $Environment.Keys) {
        $OriginalEnvironment[$Key] = [Environment]::GetEnvironmentVariable($Key, "Process")
        [Environment]::SetEnvironmentVariable($Key, $Environment[$Key], "Process")
    }

    $StdOutPath = Join-Path -Path $LogsDir -ChildPath "$Name.verify.log"
    $StdErrPath = Join-Path -Path $LogsDir -ChildPath "$Name.verify.err.log"

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
                $ErrorPreview = (Get-Content -LiteralPath $StdErrPath -Tail 30) -join "`n"
            }

            throw "$Name dev server did not stay running on port $Port. Recent stderr:`n$ErrorPreview"
        }

        return $Process
    }
    finally {
        foreach ($Key in $Environment.Keys) {
            [Environment]::SetEnvironmentVariable($Key, $OriginalEnvironment[$Key], "Process")
        }
    }
}

function Wait-HttpOk {
    param(
        [string]$Url,
        [int]$TimeoutSeconds = 45
    )

    $Deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    $LastError = $null

    while ((Get-Date) -lt $Deadline) {
        try {
            $Response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5
            if ($Response.StatusCode -ge 200 -and $Response.StatusCode -lt 400) {
                return $Response
            }
        } catch {
            $LastError = $_
        }

        Start-Sleep -Milliseconds 800
    }

    if ($LastError) {
        throw $LastError
    }

    throw "Timeout waiting for $Url"
}

Assert-PortAvailable -Port $ShellPort
Assert-PortAvailable -Port $MfeDispatchPort

$MfeDispatchUrl = "http://localhost:$MfeDispatchPort"
$ShellUrl = "http://localhost:$ShellPort"
$Processes = New-Object System.Collections.Generic.List[System.Diagnostics.Process]

try {
    $MfeDispatchProcess = Start-NextApp `
        -Name "mfe-dispatch" `
        -WorkingDirectory (Join-Path -Path $Root -ChildPath "apps/mfe-dispatch") `
        -Port $MfeDispatchPort `
        -Environment @{
            NEXT_PUBLIC_MFE_PUBLIC_URL = $MfeDispatchUrl
            DISPATCH_API_URL = $DispatchApiUrl
            NEXT_PUBLIC_DISPATCH_API_URL = $DispatchApiUrl
        }
    $Processes.Add($MfeDispatchProcess)

    $ShellProcess = Start-NextApp `
        -Name "frontend-shell" `
        -WorkingDirectory (Join-Path -Path $Root -ChildPath "apps/frontend-shell") `
        -Port $ShellPort `
        -Environment @{
            NEXT_PUBLIC_MFE_DISPATCH_MANIFEST_URL = "$MfeDispatchUrl/mfe/manifest"
            NEXT_PUBLIC_MFE_IDENTITY_MANIFEST_URL = "http://localhost:3001/mfe/manifest"
        }
    $Processes.Add($ShellProcess)

    $Health = Invoke-RestMethod -Uri "$MfeDispatchUrl/api/health" -TimeoutSec 10
    $Manifest = Invoke-RestMethod -Uri "$MfeDispatchUrl/mfe/manifest" -TimeoutSec 10
    $Embedded = Wait-HttpOk -Url "$MfeDispatchUrl/dispatch/embedded"
    $Shell = Wait-HttpOk -Url "$ShellUrl/"

    $BackendProxyStatus = $null
    try {
        $BackendProxy = Invoke-WebRequest -Uri "$MfeDispatchUrl/api/dispatch/health" -UseBasicParsing -TimeoutSec 5
        $BackendProxyStatus = $BackendProxy.StatusCode
    } catch {
        if ($_.Exception.Response) {
            $BackendProxyStatus = [int]$_.Exception.Response.StatusCode
        } else {
            $BackendProxyStatus = "unavailable"
        }
    }

    [pscustomobject]@{
        service = "mfe-dispatch"
        validation = "manifest-shell-embedded"
        shell_url = $ShellUrl
        shell_status = $Shell.StatusCode
        mfe_dispatch_url = $MfeDispatchUrl
        mfe_dispatch_health = $Health.status
        manifest_name = $Manifest.name
        manifest_entry_url = $Manifest.entry_url
        embedded_status = $Embedded.StatusCode
        backend_proxy_status = $BackendProxyStatus
        ready = $true
    } | ConvertTo-Json -Compress
}
finally {
    foreach ($Process in $Processes) {
        if ($Process -and -not $Process.HasExited) {
            Stop-Process -Id $Process.Id -Force -ErrorAction SilentlyContinue
        }
    }

    Get-NetTCPConnection -LocalPort $ShellPort,$MfeDispatchPort -ErrorAction SilentlyContinue |
        Where-Object { $_.State -eq "Listen" } |
        Select-Object -ExpandProperty OwningProcess -Unique |
        Where-Object { $_ -gt 0 -and $_ -ne $PID } |
        ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }
}
