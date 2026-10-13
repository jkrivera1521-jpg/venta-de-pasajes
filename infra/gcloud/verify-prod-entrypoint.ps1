param(
    [string]$ProjectId = $env:GOOGLE_CLOUD_PROJECT,
    [string]$ConfigPath = $(Join-Path $PSScriptRoot "entrypoint-prod.json"),
    [string]$DomainName = "",
    [string]$GcloudPath = $env:GCLOUD_PATH,
    [string]$CloudSdkPython = $env:CLOUDSDK_PYTHON,
    [string]$OutputDir = "logs\prod-entrypoint",
    [switch]$FailOnNotReady
)

$ErrorActionPreference = "Stop"

function First-Value {
    param([string[]]$Values)

    foreach ($Value in $Values) {
        if (-not [string]::IsNullOrWhiteSpace($Value)) {
            return $Value
        }
    }

    return ""
}

function Initialize-CloudSdkPython {
    param([string]$PreferredPath)

    $PythonPath = First-Value @(
        $PreferredPath,
        $env:CLOUDSDK_PYTHON,
        "C:\Python312\python.exe",
        "C:\Python313\python.exe",
        "C:\Python311\python.exe"
    )

    if ($PythonPath -and (Test-Path -LiteralPath $PythonPath)) {
        $env:CLOUDSDK_PYTHON = (Resolve-Path -LiteralPath $PythonPath).Path
    }
}

function Resolve-GcloudCommand {
    param([string]$PreferredPath)

    if ($PreferredPath -and (Test-Path -LiteralPath $PreferredPath)) {
        return (Resolve-Path -LiteralPath $PreferredPath).Path
    }

    $Candidates = @(
        "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd",
        "$env:ProgramFiles\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd",
        "${env:ProgramFiles(x86)}\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd"
    )

    foreach ($Candidate in $Candidates) {
        if ($Candidate -and (Test-Path -LiteralPath $Candidate)) {
            return (Resolve-Path -LiteralPath $Candidate).Path
        }
    }

    $Command = Get-Command gcloud.cmd -ErrorAction SilentlyContinue
    if ($Command) {
        return $Command.Source
    }

    $Command = Get-Command gcloud -ErrorAction SilentlyContinue
    if ($Command) {
        return $Command.Source
    }

    throw "No se encontro gcloud. Defina -GcloudPath con la ruta real de gcloud.cmd."
}

function Invoke-Gcloud {
    param(
        [string[]]$Arguments,
        [switch]$IgnoreErrors
    )

    $PreviousErrorActionPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    $Output = & $script:GcloudCommand @Arguments 2>&1
    $ExitCode = $LASTEXITCODE
    $ErrorActionPreference = $PreviousErrorActionPreference

    if ($ExitCode -ne 0 -and -not $IgnoreErrors) {
        throw "Fallo gcloud $($Arguments -join ' '): $($Output -join [Environment]::NewLine)"
    }

    return [pscustomobject]@{
        exit_code = $ExitCode
        output = @($Output)
    }
}

function Get-GcloudJson {
    param([string[]]$Arguments)

    $Result = Invoke-Gcloud -Arguments ($Arguments + @("--format=json")) -IgnoreErrors
    if ($Result.exit_code -ne 0) {
        return $null
    }

    $Text = ($Result.output -join [Environment]::NewLine).Trim()
    if ([string]::IsNullOrWhiteSpace($Text)) {
        return $null
    }

    return $Text | ConvertFrom-Json
}

function Get-EnvValue {
    param(
        $Service,
        [string]$Name
    )

    if (-not $Service) {
        return ""
    }

    $Container = @($Service.spec.template.spec.containers)[0]
    $Env = @($Container.env | Where-Object { $_.name -eq $Name } | Select-Object -First 1)
    if ($Env.Count -eq 0) {
        return ""
    }

    return [string]$Env[0].value
}

function Resolve-DomainARecords {
    param([string]$Name)

    if ([string]::IsNullOrWhiteSpace($Name)) {
        return @()
    }

    try {
        return @(Resolve-DnsName -Name $Name -Type A -ErrorAction Stop | Where-Object { $_.IPAddress } | ForEach-Object { $_.IPAddress })
    } catch {
        return @()
    }
}

function Test-HealthEndpoint {
    param([string]$Url)

    if ([string]::IsNullOrWhiteSpace($Url)) {
        return $false
    }

    try {
        $Response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 15 -ErrorAction Stop
        return [int]$Response.StatusCode -eq 200
    } catch {
        return $false
    }
}

if (-not (Test-Path -LiteralPath $ConfigPath)) {
    throw "No existe el archivo de configuracion: $ConfigPath"
}

Initialize-CloudSdkPython -PreferredPath $CloudSdkPython
$script:GcloudCommand = Resolve-GcloudCommand -PreferredPath $GcloudPath

$Config = Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json
$ProjectId = First-Value @($ProjectId, [string]$Config.project_id)
$Region = [string]$Config.region
$DomainName = First-Value @($DomainName, [string]$Config.domain_name)
$Frontend = $Config.frontend
$LoadBalancer = $Config.load_balancer
$OfficeEvidencePath = Join-Path -Path (Resolve-Path -LiteralPath ".").Path -ChildPath ([string]$Config.office_validation.evidence_file)

if ([string]::IsNullOrWhiteSpace($ProjectId)) {
    throw "ProjectId no puede estar vacio."
}

$DomainConfigured = -not [string]::IsNullOrWhiteSpace($DomainName) -and $DomainName -notmatch "<|>|example\.com$"

$Service = Get-GcloudJson -Arguments @(
    "run", "services", "describe", [string]$Frontend.service_name,
    "--project", $ProjectId,
    "--region", $Region
)
$ServiceExists = $null -ne $Service
$ActualAppEnv = Get-EnvValue -Service $Service -Name "NEXT_PUBLIC_APP_ENV"
$ActualServiceAccount = if ($ServiceExists) { [string]$Service.spec.template.spec.serviceAccountName } else { "" }
$ServiceUsesProdEnv = $ActualAppEnv -eq [string]$Frontend.expected_app_env
$ServiceUsesProdAccount = $ActualServiceAccount -eq [string]$Frontend.expected_service_account

$Address = Get-GcloudJson -Arguments @(
    "compute", "addresses", "describe", [string]$LoadBalancer.global_ip_name,
    "--project", $ProjectId,
    "--global"
)
$GlobalIp = if ($Address) { [string]$Address.address } else { "" }

$Certificate = Get-GcloudJson -Arguments @(
    "compute", "ssl-certificates", "describe", [string]$LoadBalancer.managed_certificate_name,
    "--project", $ProjectId,
    "--global"
)
$CertificateExists = $null -ne $Certificate
$CertificateStatus = if ($Certificate -and $Certificate.managed) { [string]$Certificate.managed.status } else { "" }

$Neg = Get-GcloudJson -Arguments @(
    "compute", "network-endpoint-groups", "describe", [string]$LoadBalancer.serverless_neg_name,
    "--project", $ProjectId,
    "--region", $Region
)
$Backend = Get-GcloudJson -Arguments @(
    "compute", "backend-services", "describe", [string]$LoadBalancer.backend_service_name,
    "--project", $ProjectId,
    "--global"
)
$UrlMap = Get-GcloudJson -Arguments @(
    "compute", "url-maps", "describe", [string]$LoadBalancer.url_map_name,
    "--project", $ProjectId,
    "--global"
)
$Proxy = Get-GcloudJson -Arguments @(
    "compute", "target-https-proxies", "describe", [string]$LoadBalancer.https_proxy_name,
    "--project", $ProjectId,
    "--global"
)
$ForwardingRule = Get-GcloudJson -Arguments @(
    "compute", "forwarding-rules", "describe", [string]$LoadBalancer.forwarding_rule_name,
    "--project", $ProjectId,
    "--global"
)

$DnsARecords = Resolve-DomainARecords -Name $DomainName
$DnsPointsToGlobalIp = $DomainConfigured -and $GlobalIp -and @($DnsARecords | Where-Object { $_ -eq $GlobalIp }).Count -gt 0
$HealthUrl = if ($DomainConfigured) { "https://$DomainName$($Frontend.health_path)" } else { "" }
$HealthOk = if ($DnsPointsToGlobalIp) { Test-HealthEndpoint -Url $HealthUrl } else { $false }
$OfficeEvidenceExists = Test-Path -LiteralPath $OfficeEvidencePath
$OfficeEvidenceOk = $false

if ($OfficeEvidenceExists) {
    try {
        $OfficeEvidence = Get-Content -LiteralPath $OfficeEvidencePath -Raw | ConvertFrom-Json
        $OfficeEvidenceOk = [bool]$OfficeEvidence.ready
    } catch {
        $OfficeEvidenceOk = $false
    }
}

$Checks = @(
    [pscustomobject]@{ Area = "Domain"; Check = "real production domain configured"; Value = $DomainConfigured },
    [pscustomobject]@{ Area = "Cloud Run"; Check = "frontend service exists"; Value = $ServiceExists },
    [pscustomobject]@{ Area = "Cloud Run"; Check = "frontend uses prod env"; Value = $ServiceUsesProdEnv },
    [pscustomobject]@{ Area = "Cloud Run"; Check = "frontend uses prod service account"; Value = $ServiceUsesProdAccount },
    [pscustomobject]@{ Area = "Load Balancer"; Check = "global IP exists"; Value = $null -ne $Address },
    [pscustomobject]@{ Area = "TLS"; Check = "managed certificate exists"; Value = $CertificateExists },
    [pscustomobject]@{ Area = "TLS"; Check = "managed certificate active"; Value = $CertificateStatus -eq "ACTIVE" },
    [pscustomobject]@{ Area = "Load Balancer"; Check = "serverless NEG exists"; Value = $null -ne $Neg },
    [pscustomobject]@{ Area = "Load Balancer"; Check = "backend service exists"; Value = $null -ne $Backend },
    [pscustomobject]@{ Area = "Load Balancer"; Check = "URL map exists"; Value = $null -ne $UrlMap },
    [pscustomobject]@{ Area = "Load Balancer"; Check = "HTTPS proxy exists"; Value = $null -ne $Proxy },
    [pscustomobject]@{ Area = "Load Balancer"; Check = "forwarding rule exists"; Value = $null -ne $ForwardingRule },
    [pscustomobject]@{ Area = "DNS"; Check = "A record points to global IP"; Value = $DnsPointsToGlobalIp },
    [pscustomobject]@{ Area = "Access"; Check = "health endpoint returns 200"; Value = $HealthOk },
    [pscustomobject]@{ Area = "Office"; Check = "office validation evidence ready"; Value = $OfficeEvidenceOk }
)

$Ready = @($Checks | Where-Object { -not $_.Value }).Count -eq 0
$ResolvedOutputDir = Join-Path -Path (Resolve-Path -LiteralPath ".").Path -ChildPath $OutputDir
New-Item -ItemType Directory -Force -Path $ResolvedOutputDir | Out-Null
$OutputPath = Join-Path -Path $ResolvedOutputDir -ChildPath "verify-prod-entrypoint.json"

$Result = [pscustomobject]@{
    generated_at = (Get-Date).ToString("o")
    ready = $Ready
    project_id = $ProjectId
    region = $Region
    domain_name = $DomainName
    final_url = if ($DomainConfigured) { "https://$DomainName" } else { "" }
    global_ip = $GlobalIp
    checks = $Checks
    observed = [pscustomobject]@{
        frontend_service = [pscustomobject]@{
            name = [string]$Frontend.service_name
            exists = $ServiceExists
            status_url = if ($ServiceExists) { [string]$Service.status.url } else { "" }
            actual_app_env = $ActualAppEnv
            expected_app_env = [string]$Frontend.expected_app_env
            actual_service_account = $ActualServiceAccount
            expected_service_account = [string]$Frontend.expected_service_account
        }
        certificate_status = $CertificateStatus
        dns_a_records = @($DnsARecords)
        health_url = $HealthUrl
        office_evidence_file = $OfficeEvidencePath
    }
}

$Result | ConvertTo-Json -Depth 15 | Set-Content -LiteralPath $OutputPath -Encoding UTF8
$Checks + [pscustomobject]@{ Area = "Overall"; Check = "prod entrypoint ready"; Value = $Ready } | Format-Table -AutoSize
Write-Host "Resultado JSON: $OutputPath"

if ($FailOnNotReady -and -not $Ready) {
    throw "La entrada productiva no esta lista."
}

