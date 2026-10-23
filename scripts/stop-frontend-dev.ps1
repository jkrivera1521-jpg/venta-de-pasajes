param(
    [int[]]$Ports = @(3000, 3001, 3002, 3003, 3004, 3005, 3006, 3007, 3008),
    [switch]$PidOnly
)

$ErrorActionPreference = "Continue"

$Root = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$LogsDir = Join-Path -Path $Root -ChildPath "logs"

function Get-ListeningPortProcesses {
    param([int[]]$Ports)

    netstat -ano -p tcp | Select-String "LISTENING" | ForEach-Object {
        if ($_.Line -match '^\s*TCP\s+\S+:(\d+)\s+\S+\s+LISTENING\s+(\d+)\s*$') {
            $PortNumber = [int]$Matches[1]
            if ($Ports -contains $PortNumber) {
                [pscustomobject]@{
                    LocalPort = $PortNumber
                    OwningProcess = [int]$Matches[2]
                }
            }
        }
    }
}

$PidFiles = @(
    (Join-Path -Path $LogsDir -ChildPath "frontend-shell.pid"),
    (Join-Path -Path $LogsDir -ChildPath "mfe-identity.pid"),
    (Join-Path -Path $LogsDir -ChildPath "mfe-dispatch.pid"),
    (Join-Path -Path $LogsDir -ChildPath "mfe-ticketing.pid"),
    (Join-Path -Path $LogsDir -ChildPath "mfe-reporting.pid"),
    (Join-Path -Path $LogsDir -ChildPath "mfe-admin.pid"),
    (Join-Path -Path $LogsDir -ChildPath "mfe-aviatorscript.pid"),
    (Join-Path -Path $LogsDir -ChildPath "mfe-formula-runtime.pid"),
    (Join-Path -Path $LogsDir -ChildPath "mfe-report-runtime.pid")
)

$StopRequests = New-Object System.Collections.Generic.List[object]
$StoppedProcesses = New-Object System.Collections.Generic.List[object]
$Warnings = New-Object System.Collections.Generic.List[string]

function Stop-ProcessTree {
    param([int]$ProcessId)

    if ($ProcessId -le 0 -or $ProcessId -eq $PID) {
        return
    }

    & taskkill.exe /PID $ProcessId /T /F *> $null
    if ($LASTEXITCODE -ne 0) {
        Stop-Process -Id $ProcessId -Force -ErrorAction SilentlyContinue
    }
}

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
    $PortProcesses = @(
        Get-NetTCPConnection -LocalPort $Ports -State Listen -ErrorAction SilentlyContinue |
            Select-Object -Property LocalPort, OwningProcess -Unique
        Get-ListeningPortProcesses -Ports $Ports
    ) | Select-Object -Property LocalPort, OwningProcess -Unique

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

        Stop-ProcessTree -ProcessId $Process.Id
    } catch {
        $Warnings.Add("Could not stop process $($Process.Id): $($_.Exception.Message)")
    }
}

foreach ($PidFile in $PidFiles) {
    if (Test-Path -LiteralPath $PidFile) {
        Remove-Item -LiteralPath $PidFile -Force -ErrorAction SilentlyContinue
    }
}

for ($Attempt = 0; $Attempt -lt 5; $Attempt++) {
    $RemainingListeners = @(
        Get-NetTCPConnection -LocalPort $Ports -State Listen -ErrorAction SilentlyContinue |
            Select-Object -Property LocalAddress, LocalPort, State, OwningProcess -Unique
        Get-ListeningPortProcesses -Ports $Ports | ForEach-Object {
            [pscustomobject]@{
                LocalAddress = "127.0.0.1"
                LocalPort = $_.LocalPort
                State = "Listen"
                OwningProcess = $_.OwningProcess
            }
        }
    ) | Select-Object -Property LocalAddress, LocalPort, State, OwningProcess -Unique

    if (-not $RemainingListeners) {
        break
    }

    foreach ($Listener in $RemainingListeners) {
        $Process = Get-Process -Id $Listener.OwningProcess -ErrorAction SilentlyContinue
        if ($Process) {
            $StoppedProcesses.Add([pscustomobject]@{
                process_id = $Process.Id
                process_name = $Process.ProcessName
                path = $Process.Path
                reason = "remaining-listening-port"
                source = "port:$($Listener.LocalPort)"
            })
            Stop-ProcessTree -ProcessId $Process.Id
        }
    }

    Start-Sleep -Milliseconds 300
}

$RemainingListeners = @(
    Get-NetTCPConnection -LocalPort $Ports -State Listen -ErrorAction SilentlyContinue |
        Select-Object -Property LocalAddress, LocalPort, State, OwningProcess -Unique
    Get-ListeningPortProcesses -Ports $Ports | ForEach-Object {
        [pscustomobject]@{
            LocalAddress = "127.0.0.1"
            LocalPort = $_.LocalPort
            State = "Listen"
            OwningProcess = $_.OwningProcess
        }
    }
) | Select-Object -Property LocalAddress, LocalPort, State, OwningProcess -Unique

[pscustomobject]@{
    stopped = $true
    ports = $Ports
    pid_files = $PidFiles
    stopped_processes = $StoppedProcesses
    remaining_listeners = @($RemainingListeners)
    warnings = $Warnings
} | ConvertTo-Json -Compress
