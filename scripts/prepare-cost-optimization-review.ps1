param(
  [string]$OutputDir = "logs\cost-optimization",
  [string]$BackendConfigPath = "infra\cloudrun\prod-backend-services.json",
  [string]$FrontendConfigPath = "infra\cloudrun\prod-frontend-services.json",
  [string]$CloudSqlConfigPath = "infra\gcloud\cloudsql-prod.json",
  [string]$Day3ReadinessPath = "logs\post-start-day3\dia82-post-start-day3-readiness.json",
  [string]$Day3EvidencePath = "logs\post-start-day3\dia82-post-start-day3-evidence.json",
  [string]$ReportPath = "docs\reporte-costo-mensual-estimado.md",
  [decimal]$BudgetAmountUsd = 150,
  [switch]$ConfirmProductionStable,
  [switch]$FailOnBlocker
)

$ErrorActionPreference = "Stop"

$ProjectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
Set-Location $ProjectRoot

function Resolve-ProjectPath {
  param([string]$Path)

  if ([System.IO.Path]::IsPathRooted($Path)) {
    return [System.IO.Path]::GetFullPath($Path)
  }

  return [System.IO.Path]::GetFullPath((Join-Path $ProjectRoot $Path))
}

function Read-JsonFile {
  param([string]$Path)

  if (-not (Test-Path -LiteralPath $Path)) {
    return $null
  }

  return Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json
}

function Add-Check {
  param(
    [System.Collections.Generic.List[object]]$Checks,
    [string]$Area,
    [string]$Name,
    [bool]$Passed,
    [string]$Detail = ""
  )

  $Checks.Add([pscustomobject]@{
    area = $Area
    name = $Name
    passed = $Passed
    detail = $Detail
  })
}

function Get-ServiceCatalog {
  param(
    [object]$BackendConfig,
    [object]$FrontendConfig
  )

  $ByName = [ordered]@{}

  foreach ($Service in @($BackendConfig.services)) {
    $Name = [string]$Service.service_name
    if (-not [string]::IsNullOrWhiteSpace($Name) -and -not $ByName.Contains($Name)) {
      $ByName[$Name] = $Service
    }
  }

  foreach ($Service in @($FrontendConfig.services | Where-Object { [string]$_.group -eq "frontend" })) {
    $Name = [string]$Service.service_name
    if (-not [string]::IsNullOrWhiteSpace($Name) -and -not $ByName.Contains($Name)) {
      $ByName[$Name] = $Service
    }
  }

  return @($ByName.Values)
}

function Get-ServiceCostPosture {
  param([object[]]$Services)

  return @($Services | ForEach-Object {
    $MinInstances = [int]$_.min_instances
    $MaxInstances = [int]$_.max_instances
    $Cpu = [string]$_.cpu
    $Memory = [string]$_.memory

    $Action = "Mantener y validar con metricas reales"
    $Risk = "Controlado"

    if ($MinInstances -gt 0) {
      $Action = "Revisar si puede bajar min_instances a 0 fuera de horario critico"
      $Risk = "Costo fijo"
    } elseif ($MaxInstances -gt 2) {
      $Action = "Revisar limite max_instances segun demanda real"
      $Risk = "Escalamiento amplio"
    }

    [pscustomobject]@{
      id = [string]$_.id
      group = [string]$_.group
      service_name = [string]$_.service_name
      cpu = $Cpu
      memory = $Memory
      min_instances = $MinInstances
      max_instances = $MaxInstances
      fixed_idle_cost_posture = if ($MinInstances -eq 0) { "Sin costo fijo por instancias minimas" } else { "Tiene costo fijo por instancias minimas" }
      risk = $Risk
      recommended_action = $Action
    }
  })
}

function Write-CostCollectionCommands {
  param(
    [string]$Path,
    [string]$ProjectId,
    [string]$Region,
    [string[]]$ServiceNames,
    [string]$CloudSqlInstanceName
  )

  $ServiceLiteral = '@("' + (($ServiceNames | Sort-Object) -join '","') + '")'
  $Lines = @(
    "# Dia 83 - optimizacion de costos",
    "# Recoleccion de evidencia. No cambia Cloud Run, Cloud SQL, Logging ni Billing.",
    "",
    '$ProjectId = "' + $ProjectId + '"',
    '$Region = "' + $Region + '"',
    '$CloudSqlInstanceName = "' + $CloudSqlInstanceName + '"',
    '$OutputDir = "logs\cost-optimization"',
    'New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null',
    "",
    '$PythonPath = "C:\Python312\python.exe"',
    'if (Test-Path -LiteralPath $PythonPath) { $env:CLOUDSDK_PYTHON = $PythonPath }',
    '$GcloudPath = "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd"',
    'if (-not (Test-Path -LiteralPath $GcloudPath)) { $GcloudPath = (Get-Command gcloud.cmd -ErrorAction Stop).Source }',
    '$Start = (Get-Date).AddDays(-30).ToUniversalTime().ToString("o")',
    '$End = (Get-Date).ToUniversalTime().ToString("o")',
    '$Services = ' + $ServiceLiteral,
    "",
    'foreach ($Service in $Services) {',
    '  & $GcloudPath run services describe $Service --project $ProjectId --region $Region --format json > "$OutputDir\dia83-$Service-describe.json"',
    '  & $GcloudPath run services logs read $Service --project $ProjectId --region $Region --limit 300 > "$OutputDir\dia83-$Service-logs.txt"',
    '}',
    "",
    '& $GcloudPath run services list --project $ProjectId --region $Region --format json > "$OutputDir\dia83-cloudrun-services.json"',
    '& $GcloudPath logging read "resource.type=cloud_run_revision" --project $ProjectId --freshness=30d --limit=1000 --format json > "$OutputDir\dia83-cloudrun-log-sample.json"',
    '& $GcloudPath logging buckets list --project $ProjectId --format json > "$OutputDir\dia83-logging-buckets.json"',
    '& $GcloudPath logging metrics list --project $ProjectId --format json > "$OutputDir\dia83-logging-metrics.json"',
    "",
    '& $GcloudPath monitoring time-series list --project $ProjectId --filter "metric.type=`"run.googleapis.com/request_count`"" --interval "start=$Start,end=$End" --format json > "$OutputDir\dia83-cloudrun-request-count.json"',
    '& $GcloudPath monitoring time-series list --project $ProjectId --filter "metric.type=`"run.googleapis.com/request_latencies`"" --interval "start=$Start,end=$End" --format json > "$OutputDir\dia83-cloudrun-latency.json"',
    '& $GcloudPath monitoring time-series list --project $ProjectId --filter "metric.type=`"cloudsql.googleapis.com/database/cpu/utilization`"" --interval "start=$Start,end=$End" --format json > "$OutputDir\dia83-cloudsql-cpu.json"',
    '& $GcloudPath monitoring time-series list --project $ProjectId --filter "metric.type=`"cloudsql.googleapis.com/database/disk/bytes_used`"" --interval "start=$Start,end=$End" --format json > "$OutputDir\dia83-cloudsql-disk-bytes-used.json"',
    "",
    '& $GcloudPath sql instances describe $CloudSqlInstanceName --project $ProjectId --format json > "$OutputDir\dia83-cloudsql-instance.json"',
    '& $GcloudPath billing projects describe $ProjectId > "$OutputDir\dia83-billing-project.txt"',
    '& $GcloudPath billing accounts list > "$OutputDir\dia83-billing-accounts.txt"',
    "",
    '$Evidence = @{',
    '  generated_at = (Get-Date).ToString("o")',
    '  project_id = $ProjectId',
    '  region = $Region',
    '  files = Get-ChildItem -LiteralPath $OutputDir -File | Select-Object Name, Length',
    '}',
    '$Evidence | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath "$OutputDir\dia83-cost-evidence.json" -Encoding UTF8'
  )

  Set-Content -LiteralPath $Path -Value $Lines -Encoding UTF8
}

function Write-BudgetTemplate {
  param(
    [string]$Path,
    [string]$ProjectId,
    [decimal]$BudgetAmountUsd
  )

  $Lines = @(
    "param(",
    "  [Parameter(Mandatory = `$true)]",
    "  [string]`$BillingAccountId,",
    "  [decimal]`$BudgetAmountUsd = $BudgetAmountUsd",
    ")",
    "",
    "`$ErrorActionPreference = `"Stop`"",
    "`$ProjectId = `"$ProjectId`"",
    "`$PythonPath = `"C:\Python312\python.exe`"",
    "if (Test-Path -LiteralPath `$PythonPath) { `$env:CLOUDSDK_PYTHON = `$PythonPath }",
    "`$GcloudPath = `"C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd`"",
    "if (-not (Test-Path -LiteralPath `$GcloudPath)) { `$GcloudPath = (Get-Command gcloud.cmd -ErrorAction Stop).Source }",
    "",
    "`$ProjectNumber = (& `$GcloudPath projects describe `$ProjectId --format `"value(projectNumber)`").Trim()",
    "if ([string]::IsNullOrWhiteSpace(`$ProjectNumber)) { throw `"No se pudo resolver el numero del proyecto `$ProjectId.`" }",
    "",
    "& `$GcloudPath billing budgets create ``",
    "  --billing-account=`$BillingAccountId ``",
    "  --display-name=`"Venta Pasajes Prod mensual`" ``",
    "  --budget-amount=`"`$($BudgetAmountUsd)USD`" ``",
    "  --filter-projects=`"projects/`$ProjectNumber`" ``",
    "  --threshold-rule=percent=0.50 ``",
    "  --threshold-rule=percent=0.75,basis=forecasted-spend ``",
    "  --threshold-rule=percent=0.90 ``",
    "  --threshold-rule=percent=1.00"
  )

  Set-Content -LiteralPath $Path -Value $Lines -Encoding UTF8
}

function Write-AdjustmentPlan {
  param(
    [string]$Path,
    [object[]]$ServicePosture,
    [object]$CloudSqlInstance,
    [decimal]$BudgetAmountUsd
  )

  $CloudRunActions = @($ServicePosture | ForEach-Object {
    [pscustomobject]@{
      service_name = $_.service_name
      current_min_instances = $_.min_instances
      current_max_instances = $_.max_instances
      current_cpu = $_.cpu
      current_memory = $_.memory
      recommendation = $_.recommended_action
      automatic_change = $false
    }
  })

  $Plan = [pscustomobject]@{
    generated_at = (Get-Date).ToString("o")
    cloud_run = [pscustomobject]@{
      summary = "No se proponen cambios automaticos. La configuracion actual ya usa min_instances 0 y max_instances 2."
      actions = $CloudRunActions
    }
    cloud_sql = [pscustomobject]@{
      instance = [string]$CloudSqlInstance.name
      tier = [string]$CloudSqlInstance.tier
      storage_type = [string]$CloudSqlInstance.storage_type
      storage_size_gb = [int]$CloudSqlInstance.storage_size_gb
      storage_auto_increase = [bool]$CloudSqlInstance.storage_auto_increase
      recommendation = "Mantener configuracion inicial y validar CPU, disco y backups con evidencia de 30 dias antes de subir tier o HA."
      automatic_change = $false
    }
    logging = [pscustomobject]@{
      recommendation = "Medir volumen real. Crear exclusiones solo para logs ruidosos no auditables y conservar errores, auditoria y seguridad."
      automatic_change = $false
    }
    budget = [pscustomobject]@{
      recommended_monthly_budget_usd = $BudgetAmountUsd
      recommendation = "Crear presupuesto mensual con alertas al 50%, 75% forecast, 90% y 100%."
      automatic_change = $false
    }
  }

  $Plan | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $Path -Encoding UTF8
}

function Write-CostReport {
  param(
    [string]$Path,
    [string]$RunId,
    [object[]]$ServicePosture,
    [object]$CloudSqlInstance,
    [decimal]$BudgetAmountUsd,
    [bool]$ReadyForRealReview
  )

  $State = if ($ReadyForRealReview) { "PENDIENTE_RECOLECCION_REAL" } else { "PENDIENTE_OPERACION_REAL_ESTABLE" }
  $SqlName = [string]$CloudSqlInstance.name
  $SqlTier = [string]$CloudSqlInstance.tier
  $SqlStorageType = [string]$CloudSqlInstance.storage_type
  $SqlStorageGb = [int]$CloudSqlInstance.storage_size_gb
  $SqlAvailabilityType = [string]$CloudSqlInstance.availability_type
  $SqlRetainedBackups = [int]$CloudSqlInstance.retained_backups_count
  $BudgetAmountText = $BudgetAmountUsd.ToString("0.##", [System.Globalization.CultureInfo]::InvariantCulture)
  $ServiceRows = @($ServicePosture | Sort-Object group, service_name | ForEach-Object {
    "| $($_.service_name) | $($_.group) | $($_.cpu) | $($_.memory) | $($_.min_instances) | $($_.max_instances) | $($_.fixed_idle_cost_posture) |"
  })

  $Lines = @(
    "# Reporte de costo mensual estimado",
    "",
    "Fecha base: 2026-09-28",
    "",
    "Estado: $State",
    "",
    "Run ID: $RunId",
    "",
    "## Resumen ejecutivo",
    "",
    "La configuracion productiva actual esta orientada a controlar costos iniciales: todos los servicios Cloud Run tienen min_instances=0, max_instances=2, cpu=1 y memory=512Mi. Esto evita costo fijo por instancias minimas y limita el crecimiento automatico mientras se confirma demanda real.",
    "",
    "El costo real mensual no queda validado todavia porque requiere operacion productiva estable, metricas de 30 dias y lectura de Billing. Por eso el estado permanece pendiente hasta cerrar el soporte intensivo y ejecutar la recoleccion real.",
    "",
    "## Estimacion por configuracion",
    "",
    "| Componente | Lectura de costo | Estado |",
    "| --- | --- | --- |",
    "| Cloud Run | Piso fijo bajo porque min_instances=0 en todos los servicios; costo variable depende de trafico real. | Controlado por configuracion |",
    "| Cloud SQL | Instancia $SqlName en tier $SqlTier, storage ${SqlStorageGb}GB $SqlStorageType, backups retenidos $SqlRetainedBackups. | Bajo para arranque, validar con metricas |",
    "| Logging | Volumen real pendiente de medir con dia83-cloudrun-log-sample.json, buckets y metricas. | Pendiente de evidencia |",
    "| Presupuesto | Presupuesto mensual sugerido: $BudgetAmountText USD, con alertas 50%, 75% forecast, 90% y 100%. | Plantilla preparada |",
    "",
    "## Cloud Run",
    "",
    "| Servicio | Grupo | CPU | Memoria | Min | Max | Lectura |",
    "| --- | --- | --- | --- | --- | --- | --- |"
  )

  $Lines += $ServiceRows
  $Lines += @(
    "",
    "## Cloud SQL",
    "",
    "| Campo | Valor | Lectura |",
    "| --- | --- | --- |",
    "| Instancia | $SqlName | Base productiva compartida por bases separadas de microservicio |",
    "| Tier | $SqlTier | Costo bajo para arranque; revisar si CPU o conexiones se saturan |",
    "| Storage | ${SqlStorageGb}GB $SqlStorageType | Mantener con auto incremento y alertas |",
    "| Alta disponibilidad | $SqlAvailabilityType | Zonal controla costo; HA aumenta resiliencia y costo |",
    "| Backups retenidos | $SqlRetainedBackups | Correcto para recuperacion inicial; vigilar crecimiento |",
    "",
    "## Ajustes recomendados",
    "",
    "| Area | Ajuste | Ejecutar ahora |",
    "| --- | --- | --- |",
    "| Cloud Run min instances | Mantener 0 en todos los servicios hasta tener demanda real sostenida. | No |",
    "| Cloud Run CPU/RAM | Mantener 1 CPU / 512Mi y revisar con metricas antes de reducir o subir. | No |",
    "| Cloud Run max instances | Mantener 2 para limitar costo de arranque. | No |",
    "| Cloud SQL | Mantener db-f1-micro, 10GB SSD y auto incremento; revisar tras 30 dias. | No |",
    "| Logging | Medir volumen real antes de excluir logs; no excluir auditoria, errores ni seguridad. | No |",
    "| Budget | Crear presupuesto mensual con el ID real de billing. | Si, con aprobacion |",
    "",
    "## Evidencia requerida para cerrar",
    "",
    "- `logs\cost-optimization\dia83-cost-evidence.json`.",
    "- `logs\cost-optimization\dia83-cloudrun-services.json`.",
    "- `logs\cost-optimization\dia83-cloudsql-instance.json`.",
    "- `logs\cost-optimization\dia83-cloudrun-request-count.json`.",
    "- `logs\cost-optimization\dia83-cloudrun-latency.json`.",
    "- `logs\cost-optimization\dia83-cloudsql-cpu.json`.",
    "- `logs\cost-optimization\dia83-cloudsql-disk-bytes-used.json`.",
    "- `logs\cost-optimization\dia83-billing-project.txt`.",
    "- Confirmacion de presupuesto creado o decision documentada de no crearlo todavia.",
    "",
    "## Decision",
    "",
    "El costo queda controlado por configuracion, pero no queda certificado por gasto real hasta ejecutar la recoleccion con produccion estable y revisar Billing."
  )

  Set-Content -LiteralPath $Path -Value $Lines -Encoding UTF8
}

$RunId = Get-Date -Format "yyyyMMdd-HHmmss"
$OutputPath = Resolve-ProjectPath -Path $OutputDir
$BackendConfigFullPath = Resolve-ProjectPath -Path $BackendConfigPath
$FrontendConfigFullPath = Resolve-ProjectPath -Path $FrontendConfigPath
$CloudSqlConfigFullPath = Resolve-ProjectPath -Path $CloudSqlConfigPath
$Day3ReadinessFullPath = Resolve-ProjectPath -Path $Day3ReadinessPath
$Day3EvidenceFullPath = Resolve-ProjectPath -Path $Day3EvidencePath
$ReportFullPath = Resolve-ProjectPath -Path $ReportPath

New-Item -ItemType Directory -Force -Path $OutputPath | Out-Null

$Checks = [System.Collections.Generic.List[object]]::new()
$TechnicalBlockers = [System.Collections.Generic.List[string]]::new()
$BusinessBlockers = [System.Collections.Generic.List[string]]::new()
$Warnings = [System.Collections.Generic.List[string]]::new()

foreach ($RequiredPath in @($BackendConfigFullPath, $FrontendConfigFullPath, $CloudSqlConfigFullPath)) {
  $Exists = Test-Path -LiteralPath $RequiredPath
  Add-Check -Checks $Checks -Area "input" -Name $RequiredPath -Passed $Exists
  if (-not $Exists) {
    $TechnicalBlockers.Add("No existe archivo requerido: $RequiredPath")
  }
}

$BackendConfig = Read-JsonFile -Path $BackendConfigFullPath
$FrontendConfig = Read-JsonFile -Path $FrontendConfigFullPath
$CloudSqlConfig = Read-JsonFile -Path $CloudSqlConfigFullPath
$Day3Readiness = Read-JsonFile -Path $Day3ReadinessFullPath

$Services = @()
if ($BackendConfig -and $FrontendConfig) {
  $Services = @(Get-ServiceCatalog -BackendConfig $BackendConfig -FrontendConfig $FrontendConfig)
}

if ($Services.Count -eq 0) {
  $TechnicalBlockers.Add("No se pudo resolver el catalogo productivo de servicios Cloud Run.")
}

if (-not $CloudSqlConfig -or -not $CloudSqlConfig.instance) {
  $TechnicalBlockers.Add("No se pudo resolver la configuracion productiva de Cloud SQL.")
}

$ProjectId = ""
$Region = ""
if ($BackendConfig) {
  $ProjectId = [string]$BackendConfig.default_project_id
  $Region = [string]$BackendConfig.default_region
}

if ([string]::IsNullOrWhiteSpace($ProjectId)) {
  $TechnicalBlockers.Add("No se pudo resolver default_project_id desde $BackendConfigPath.")
}

if ([string]::IsNullOrWhiteSpace($Region)) {
  $TechnicalBlockers.Add("No se pudo resolver default_region desde $BackendConfigPath.")
}

$ServicePosture = @(Get-ServiceCostPosture -Services $Services)
$AllMinZero = @($ServicePosture | Where-Object { $_.min_instances -ne 0 }).Count -eq 0
$AllMaxBounded = @($ServicePosture | Where-Object { $_.max_instances -gt 2 }).Count -eq 0
$AllSmallRuntime = @($ServicePosture | Where-Object { $_.cpu -ne "1" -or $_.memory -ne "512Mi" }).Count -eq 0
$CloudSqlSmallStart = $false
if ($CloudSqlConfig -and $CloudSqlConfig.instance) {
  $CloudSqlSmallStart = [string]$CloudSqlConfig.instance.tier -eq "db-f1-micro" -and [int]$CloudSqlConfig.instance.storage_size_gb -le 10
}

Add-Check -Checks $Checks -Area "cloudrun" -Name "Todos los servicios usan min_instances 0" -Passed $AllMinZero
Add-Check -Checks $Checks -Area "cloudrun" -Name "Todos los servicios limitan max_instances a 2 o menos" -Passed $AllMaxBounded
Add-Check -Checks $Checks -Area "cloudrun" -Name "Todos los servicios usan runtime pequeno 1 CPU / 512Mi" -Passed $AllSmallRuntime
Add-Check -Checks $Checks -Area "cloudsql" -Name "Cloud SQL arranca en tier pequeno y 10GB o menos" -Passed $CloudSqlSmallStart

if (-not $AllMinZero) {
  $Warnings.Add("Existen servicios con min_instances mayor a 0; revisar costo fijo.")
}

if (-not $AllMaxBounded) {
  $Warnings.Add("Existen servicios con max_instances mayor a 2; revisar limite de escalamiento.")
}

if (-not $AllSmallRuntime) {
  $Warnings.Add("Existen servicios con CPU/RAM distinta de 1 CPU / 512Mi; revisar costo por instancia.")
}

if (-not $CloudSqlSmallStart) {
  $Warnings.Add("Cloud SQL no esta en configuracion pequena inicial; revisar costo base.")
}

$Day3AllowsNormalSupport = $false
if ($Day3Readiness -and $Day3Readiness.ready_for_normal_support_decision -eq $true) {
  $Day3AllowsNormalSupport = $true
}

if (-not $Day3Readiness) {
  $BusinessBlockers.Add("No existe readiness del Dia 82; ejecutar primero soporte intensivo dia 3.")
} elseif (-not $Day3AllowsNormalSupport) {
  $BusinessBlockers.Add("Dia 82 no autorizo paso a soporte normal; no se certifica costo real aun.")
}

if (-not (Test-Path -LiteralPath $Day3EvidenceFullPath)) {
  $BusinessBlockers.Add("No existe evidencia real del Dia 82: $Day3EvidencePath.")
}

if (-not $ConfirmProductionStable) {
  $BusinessBlockers.Add("No se confirmo produccion estable con -ConfirmProductionStable.")
}

$CommandPath = Join-Path $OutputPath "dia83-cost-optimization-commands.ps1"
$BudgetTemplatePath = Join-Path $OutputPath "dia83-budget-alert-template.ps1"
$AdjustmentPlanPath = Join-Path $OutputPath "dia83-cost-adjustments-plan.json"
$ReadinessPath = Join-Path $OutputPath "dia83-cost-optimization-readiness.json"

if ($TechnicalBlockers.Count -eq 0) {
  Write-CostCollectionCommands `
    -Path $CommandPath `
    -ProjectId $ProjectId `
    -Region $Region `
    -ServiceNames @($Services | ForEach-Object { [string]$_.service_name }) `
    -CloudSqlInstanceName ([string]$CloudSqlConfig.instance.name)

  Write-BudgetTemplate `
    -Path $BudgetTemplatePath `
    -ProjectId $ProjectId `
    -BudgetAmountUsd $BudgetAmountUsd

  Write-AdjustmentPlan `
    -Path $AdjustmentPlanPath `
    -ServicePosture $ServicePosture `
    -CloudSqlInstance $CloudSqlConfig.instance `
    -BudgetAmountUsd $BudgetAmountUsd

  Write-CostReport `
    -Path $ReportFullPath `
    -RunId $RunId `
    -ServicePosture $ServicePosture `
    -CloudSqlInstance $CloudSqlConfig.instance `
    -BudgetAmountUsd $BudgetAmountUsd `
    -ReadyForRealReview ($BusinessBlockers.Count -eq 0)
}

$Result = [pscustomobject]@{
  generated_at = (Get-Date).ToString("o")
  run_id = $RunId
  ready_for_cost_package = $TechnicalBlockers.Count -eq 0
  ready_for_real_cost_review = $TechnicalBlockers.Count -eq 0 -and $BusinessBlockers.Count -eq 0
  configuration_cost_guardrails_ok = $AllMinZero -and $AllMaxBounded -and $AllSmallRuntime -and $CloudSqlSmallStart
  actual_monthly_cost_validated = $false
  cost_under_control = $false
  project_id = $ProjectId
  region = $Region
  services_count = $Services.Count
  budget_amount_usd = $BudgetAmountUsd
  command_path = $CommandPath
  budget_template_path = $BudgetTemplatePath
  adjustment_plan_path = $AdjustmentPlanPath
  report_path = $ReportFullPath
  checks = @($Checks)
  warnings = @($Warnings)
  technical_blockers = @($TechnicalBlockers)
  business_blockers = @($BusinessBlockers)
}

$Result | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $ReadinessPath -Encoding UTF8

Write-Host "Paquete optimizacion costos listo: $($Result.ready_for_cost_package)"
Write-Host "Revision real costos autorizada: $($Result.ready_for_real_cost_review)"
Write-Host "Guardrails de configuracion OK: $($Result.configuration_cost_guardrails_ok)"
Write-Host "Costo real mensual validado: $($Result.actual_monthly_cost_validated)"
Write-Host "Bloqueos tecnicos: $($TechnicalBlockers.Count)"
Write-Host "Bloqueos de negocio: $($BusinessBlockers.Count)"

if ($Warnings.Count -gt 0) {
  Write-Warning ($Warnings -join " | ")
}

if ($BusinessBlockers.Count -gt 0) {
  Write-Warning ($BusinessBlockers -join " | ")
}

if ($FailOnBlocker -and ($TechnicalBlockers.Count -gt 0 -or $BusinessBlockers.Count -gt 0)) {
  throw "Dia 83 tiene bloqueos. Revise $ReadinessPath."
}
