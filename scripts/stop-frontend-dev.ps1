param(
    [int[]]$Ports = @(3000, 3001, 3002, 3003, 3004, 3005),
    [switch]$PidOnly
)

$ErrorActionPreference = "Continue"

$Root = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$LogsDir = Join-Path -Path $Root -ChildPath "logs"
$PidFiles = @(
    (Join-Path -Path $LogsDir -ChildPath "frontend-shell.pid"),
    (Join-Path -Path $LogsDir -ChildPath "mfe-identity.pid"),
    (Join-Path -Path $LogsDir -ChildPath "mfe-dispatch.pid"),
    (Join-Path -Path $LogsDir -ChildPath "mfe-ticketing.pid"),
    (Join-Path -Path $LogsDir -ChildPath "mfe-reporting.pid"),
    (Join-Path -Path $LogsDir -ChildPath "mfe-admin.pid")
)

$StopRequests = New-Object System.Collections.Generic.List[object]
$StoppedProcesses = New-Object System.Collections.Generic.List[object]
$Warnings = New-Object System.Collections.Generic.List[string]

foreach ($PidFile in $PidFiles) {
    if (Test-Path -LiteralPath $PidFile) {
        $ProcessIds = Get-Content -LiteralPath $PidFile -ErrorAction SilentlyContinue
        foreach ($ProcessIdValue in $ProcessIds) {
            $ParsedProcessId = 0
            if ([int]::TryParse($ProcessIdValue, [ref]$ParsedProcessId)) {
                $StopRequests.Add([pscustomobject]@{
                    process_id = $ParsedProcessId
                    reason = "pid-file"
                    source = $PidFile
                })
            }
        }
    }
}

if (-not $PidOnly) {
    $PortProcesses = Get-NetTCPConnection -LocalPort $Ports -ErrorAction SilentlyContinue |
        Where-Object { $_.State -eq "Listen" } |
        Select-Object -Property LocalPort, OwningProcess -Unique

    foreach ($PortProcess in $PortProcesses) {
        $StopRequests.Add([pscustomobject]@{
            process_id = [int]$PortProcess.OwningProcess
            reason = "listening-port"
            source = "port:$($PortProcess.LocalPort)"
        })
    }
}

$UniqueRequests = $StopRequests |
    Where-Object { $_.process_id -gt 0 -and $_.process_id -ne $PID } |
    Sort-Object -Property process_id -Unique

foreach ($Request in $UniqueRequests) {
    $Process = Get-Process -Id $Request.process_id -ErrorAction SilentlyContinue
    if ($null -eq $Process) {
        continue
    }

    try {
        $StoppedProcesses.Add([pscustomobject]@{
            process_id = $Process.Id
            process_name = $Process.ProcessName
            path = $Process.Path
            reason = $Request.reason
            source = $Request.source
        })

        Stop-Process -Id $Process.Id -Force -ErrorAction Stop
    } catch {
        $Warnings.Add("Could not stop process $($Process.Id): $($_.Exception.Message)")
    }
}

foreach ($PidFile in $PidFiles) {
    if (Test-Path -LiteralPath $PidFile) {
        Remove-Item -LiteralPath $PidFile -Force -ErrorAction SilentlyContinue
    }
}

Start-Sleep -Milliseconds 500

$RemainingListeners = Get-NetTCPConnection -LocalPort $Ports -ErrorAction SilentlyContinue |
    Where-Object { $_.State -eq "Listen" } |
    Select-Object -Property LocalAddress, LocalPort, State, OwningProcess

[pscustomobject]@{
    stopped = $true
    ports = $Ports
    pid_files = $PidFiles
    stopped_processes = $StoppedProcesses
    remaining_listeners = @($RemainingListeners)
    warnings = $Warnings
} | ConvertTo-Json -Compress
