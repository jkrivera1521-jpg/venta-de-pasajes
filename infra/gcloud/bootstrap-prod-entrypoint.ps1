param(
    [string]$ProjectId = $env:GOOGLE_CLOUD_PROJECT,
    [string]$ConfigPath = $(Join-Path $PSScriptRoot "entrypoint-prod.json"),
    [string]$DomainName = "",
    [string]$GcloudPath = $env:GCLOUD_PATH,
    [string]$CloudSdkPython = $env:CLOUDSDK_PYTHON,
    [string]$OutputDir = "logs\prod-entrypoint",
    [switch]$Execute,
    [switch]$SkipServiceReadinessCheck
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

function Test-GcloudResource {
    param([string[]]$DescribeArguments)

    $Result = Invoke-Gcloud -Arguments $DescribeArguments -IgnoreErrors
    return $Result.exit_code -eq 0
}

function Add-PlanItem {
    param(
        [string]$Id,
        [string]$Description,
        [string[]]$Command,
        [bool]$AlreadyExists
    )

    $Action = if ($AlreadyExists) { "exists" } elseif ($Execute) { "execute" } else { "planned" }
    $script:Plan += [pscustomobject]@{
        id = $Id
        action = $Action
        description = $Description
        command = @($Command)
    }

    if ($Execute -and -not $AlreadyExists) {
        Invoke-Gcloud -Arguments $Command | Out-Null
    }
}

function Get-CloudRunService {
    param(
        [string]$ServiceName,
        [string]$Region,
        [string]$ProjectId
    )

    $Result = Invoke-Gcloud -Arguments @(
        "run", "services", "describe", $ServiceName,
        "--project", $ProjectId,
        "--region", $Region,
        "--format=json"
    ) -IgnoreErrors

    if ($Result.exit_code -ne 0) {
        return $null
    }

    return ($Result.output -join [Environment]::NewLine) | ConvertFrom-Json
}

function Get-EnvValue {
    param(
        $Service,
        [string]$Name
    )

    $Container = @($Service.spec.template.spec.containers)[0]
    $Env = @($Container.env | Where-Object { $_.name -eq $Name } | Select-Object -First 1)
    if ($Env.Count -eq 0) {
        return ""
    }

    return [string]$Env[0].value
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

if ([string]::IsNullOrWhiteSpace($ProjectId)) {
    throw "ProjectId no puede estar vacio."
}

if ([string]::IsNullOrWhiteSpace($DomainName) -or $DomainName -match "<|>|example\.com$") {
    throw "Defina un dominio productivo real con -DomainName. No se configura TLS/LB con placeholders."
}

$Frontend = $Config.frontend
$LoadBalancer = $Config.load_balancer
$Service = Get-CloudRunService -ServiceName ([string]$Frontend.service_name) -Region $Region -ProjectId $ProjectId
$ServiceExists = $null -ne $Service
$ActualAppEnv = if ($ServiceExists) { Get-EnvValue -Service $Service -Name "NEXT_PUBLIC_APP_ENV" } else { "" }
$ActualServiceAccount = if ($ServiceExists) { [string]$Service.spec.template.spec.serviceAccountName } else { "" }
$ServiceReadyForProd = $ServiceExists -and
    $ActualAppEnv -eq [string]$Frontend.expected_app_env -and
    $ActualServiceAccount -eq [string]$Frontend.expected_service_account

if ($Execute -and -not $SkipServiceReadinessCheck -and -not $ServiceReadyForProd) {
    throw "El servicio $($Frontend.service_name) no esta listo para produccion. APP_ENV=$ActualAppEnv, serviceAccount=$ActualServiceAccount."
}

$script:Plan = @()

$AddressExists = Test-GcloudResource -DescribeArguments @(
    "compute", "addresses", "describe", [string]$LoadBalancer.global_ip_name,
    "--project", $ProjectId,
    "--global",
    "--format=json"
)
Add-PlanItem -Id "global-ip" -Description "Reservar IP global para la entrada productiva." -AlreadyExists $AddressExists -Command @(
    "compute", "addresses", "create", [string]$LoadBalancer.global_ip_name,
    "--project", $ProjectId,
    "--global",
    "--ip-version=IPV4"
)

$CertificateExists = Test-GcloudResource -DescribeArguments @(
    "compute", "ssl-certificates", "describe", [string]$LoadBalancer.managed_certificate_name,
    "--project", $ProjectId,
    "--global",
    "--format=json"
)
Add-PlanItem -Id "managed-certificate" -Description "Crear certificado TLS administrado por Google." -AlreadyExists $CertificateExists -Command @(
    "compute", "ssl-certificates", "create", [string]$LoadBalancer.managed_certificate_name,
    "--project", $ProjectId,
    "--global",
    "--domains=$DomainName"
)

$NegExists = Test-GcloudResource -DescribeArguments @(
    "compute", "network-endpoint-groups", "describe", [string]$LoadBalancer.serverless_neg_name,
    "--project", $ProjectId,
    "--region", $Region,
    "--format=json"
)
Add-PlanItem -Id "serverless-neg" -Description "Crear serverless NEG hacia frontend-shell productivo." -AlreadyExists $NegExists -Command @(
    "compute", "network-endpoint-groups", "create", [string]$LoadBalancer.serverless_neg_name,
    "--project", $ProjectId,
    "--region", $Region,
    "--network-endpoint-type=serverless",
    "--cloud-run-service=$($Frontend.service_name)"
)

$BackendExists = Test-GcloudResource -DescribeArguments @(
    "compute", "backend-services", "describe", [string]$LoadBalancer.backend_service_name,
    "--project", $ProjectId,
    "--global",
    "--format=json"
)
Add-PlanItem -Id "backend-service" -Description "Crear backend service global para la entrada HTTPS." -AlreadyExists $BackendExists -Command @(
    "compute", "backend-services", "create", [string]$LoadBalancer.backend_service_name,
    "--project", $ProjectId,
    "--global",
    "--load-balancing-scheme=EXTERNAL_MANAGED",
    "--protocol=HTTP",
    "--port-name=http"
)

$BackendNegBindingExists = $false
if ($BackendExists) {
    $BackendResult = Invoke-Gcloud -Arguments @(
        "compute", "backend-services", "describe", [string]$LoadBalancer.backend_service_name,
        "--project", $ProjectId,
        "--global",
        "--format=json"
    ) -IgnoreErrors

    if ($BackendResult.exit_code -eq 0) {
        $BackendDetails = ($BackendResult.output -join [Environment]::NewLine) | ConvertFrom-Json
        $ExpectedNegSuffix = "/regions/$Region/networkEndpointGroups/$($LoadBalancer.serverless_neg_name)"
        $BackendNegBindingExists = @(
            @($BackendDetails.backends) |
                Where-Object { [string]$_.group -like "*$ExpectedNegSuffix" }
        ).Count -gt 0
    }
}

$BackendWithNegCommand = @(
    "compute", "backend-services", "add-backend", [string]$LoadBalancer.backend_service_name,
    "--project", $ProjectId,
    "--global",
    "--network-endpoint-group=$($LoadBalancer.serverless_neg_name)",
    "--network-endpoint-group-region=$Region"
)
$script:Plan += [pscustomobject]@{
    id = "backend-neg-binding"
    action = if ($BackendNegBindingExists) { "exists" } elseif ($Execute) { "execute" } else { "planned" }
    description = "Asociar el serverless NEG al backend service."
    command = $BackendWithNegCommand
}
if ($Execute -and -not $BackendNegBindingExists) {
    Invoke-Gcloud -Arguments $BackendWithNegCommand | Out-Null
}

$UrlMapExists = Test-GcloudResource -DescribeArguments @(
    "compute", "url-maps", "describe", [string]$LoadBalancer.url_map_name,
    "--project", $ProjectId,
    "--global",
    "--format=json"
)
Add-PlanItem -Id "url-map" -Description "Crear URL map productivo." -AlreadyExists $UrlMapExists -Command @(
    "compute", "url-maps", "create", [string]$LoadBalancer.url_map_name,
    "--project", $ProjectId,
    "--default-service=$($LoadBalancer.backend_service_name)"
)

$ProxyExists = Test-GcloudResource -DescribeArguments @(
    "compute", "target-https-proxies", "describe", [string]$LoadBalancer.https_proxy_name,
    "--project", $ProjectId,
    "--global",
    "--format=json"
)
Add-PlanItem -Id "https-proxy" -Description "Crear proxy HTTPS con certificado administrado." -AlreadyExists $ProxyExists -Command @(
    "compute", "target-https-proxies", "create", [string]$LoadBalancer.https_proxy_name,
    "--project", $ProjectId,
    "--ssl-certificates=$($LoadBalancer.managed_certificate_name)",
    "--url-map=$($LoadBalancer.url_map_name)"
)

$ForwardingRuleExists = Test-GcloudResource -DescribeArguments @(
    "compute", "forwarding-rules", "describe", [string]$LoadBalancer.forwarding_rule_name,
    "--project", $ProjectId,
    "--global",
    "--format=json"
)
Add-PlanItem -Id "forwarding-rule" -Description "Crear forwarding rule HTTPS global." -AlreadyExists $ForwardingRuleExists -Command @(
    "compute", "forwarding-rules", "create", [string]$LoadBalancer.forwarding_rule_name,
    "--project", $ProjectId,
    "--global",
    "--load-balancing-scheme=EXTERNAL_MANAGED",
    "--address=$($LoadBalancer.global_ip_name)",
    "--target-https-proxy=$($LoadBalancer.https_proxy_name)",
    "--ports=$($LoadBalancer.port)"
)

$ResolvedOutputDir = Join-Path -Path (Resolve-Path -LiteralPath ".").Path -ChildPath $OutputDir
New-Item -ItemType Directory -Force -Path $ResolvedOutputDir | Out-Null
$OutputPath = Join-Path -Path $ResolvedOutputDir -ChildPath "bootstrap-prod-entrypoint-plan.json"

$Result = [pscustomobject]@{
    project_id = $ProjectId
    region = $Region
    domain_name = $DomainName
    final_url = "https://$DomainName"
    execute = [bool]$Execute
    service_ready_for_prod = $ServiceReadyForProd
    service = [pscustomobject]@{
        name = [string]$Frontend.service_name
        exists = $ServiceExists
        expected_app_env = [string]$Frontend.expected_app_env
        actual_app_env = $ActualAppEnv
        expected_service_account = [string]$Frontend.expected_service_account
        actual_service_account = $ActualServiceAccount
    }
    dns_instruction = "Crear/actualizar registro A de $DomainName hacia la IP global $($LoadBalancer.global_ip_name)."
    plan = $script:Plan
}

$Result | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $OutputPath -Encoding UTF8
$Result | ConvertTo-Json -Depth 12
