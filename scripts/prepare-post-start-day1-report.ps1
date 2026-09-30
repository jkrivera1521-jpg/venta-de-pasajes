param(
  [string]$OutputDir = "logs\post-start-day1",
  [string]$ProdBackendEvidencePath = "logs\cloudrun-prod\verify-cloudrun-prod-backends.json",
  [string]$ProdFrontendEvidencePath = "logs\cloudrun-prod\verify-cloudrun-prod-frontends.json",
  [string]$GoLiveEvidencePath = "logs\go-live\dia79-go-live-readiness.json",
  [string]$GoLiveMonitoringEvidencePath = "logs\go-live\dia79-go-live-monitoring-evidence.json",
  [string]$CloudSqlProdConfigPath = "infra\gcloud\cloudsql-prod.json",
  [string]$IncidentRegisterPath = "docs\registro-incidencias-iniciales.md",
  [string]$ReportPath = "docs\reporte-post-arranque-dia-1.md",
  [switch]$ConfirmGoLiveStarted,
  [switch]$ConfirmBusinessOpen,
  [switch]$RecordSupportReview,
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

function Get-ServiceUrl {
  param(
    [object]$Evidence,
    [string]$ServiceId
  )

  $Service = @($Evidence.services | Where-Object { [string]$_.service_id -eq $ServiceId } | Select-Object -First 1)
  if ($Service.Count -eq 0) {
    return ""
  }

  return ([string]$Service[0].url).Trim()
}

function Format-PowerShellStringAssignment {
  param(
    [string]$Name,
    [string]$Value
  )

  $CleanValue = ""
  if ($null -ne $Value) {
    $CleanValue = $Value.Trim().Replace('`', '``').Replace('"', '`"')
  }

  return '$' + $Name + ' = "' + $CleanValue + '"'
}

function Write-Day1SupportCommands {
  param(
    [string]$Path,
    [string]$ProjectId,
    [string]$Region,
    [string]$CloudSqlInstance,
    [string]$DispatchUrl,
    [string]$TicketingUrl,
    [string]$DocumentUrl,
    [string]$ReportingUrl,
    [string]$AuditUrl,
    [string]$ShellUrl
  )

  $Lines = @(
    "# Dia 80 - soporte intensivo dia 1",
    "# Ejecutar solo despues de apertura real del Dia 79.",
    "# Este archivo recolecta evidencia; no ajusta configuracion automaticamente.",
    "",
    (Format-PowerShellStringAssignment -Name "ProjectId" -Value $ProjectId),
    (Format-PowerShellStringAssignment -Name "Region" -Value $Region),
    (Format-PowerShellStringAssignment -Name "CloudSqlInstance" -Value $CloudSqlInstance),
    (Format-PowerShellStringAssignment -Name "DispatchUrl" -Value $DispatchUrl),
    (Format-PowerShellStringAssignment -Name "TicketingUrl" -Value $TicketingUrl),
    (Format-PowerShellStringAssignment -Name "DocumentUrl" -Value $DocumentUrl),
    (Format-PowerShellStringAssignment -Name "ReportingUrl" -Value $ReportingUrl),
    (Format-PowerShellStringAssignment -Name "AuditUrl" -Value $AuditUrl),
    (Format-PowerShellStringAssignment -Name "ShellUrl" -Value $ShellUrl),
    '$OutputDir = "logs\post-start-day1"',
    'New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null',
    "",
    '$Token = gcloud auth print-identity-token',
    '$Headers = @{ Authorization = "Bearer $Token" }',
    '$Today = (Get-Date).ToString("yyyy-MM-dd")',
    "",
    'curl.exe -s "$ShellUrl/api/health" > "$OutputDir\dia80-shell-health.txt"',
    'Invoke-RestMethod -Method GET -Uri "$DispatchUrl/api/v1/dispatch/health" -Headers $Headers | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath "$OutputDir\dia80-dispatch-health.json" -Encoding UTF8',
    'Invoke-RestMethod -Method GET -Uri "$TicketingUrl/api/v1/ticketing/health" -Headers $Headers | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath "$OutputDir\dia80-ticketing-health.json" -Encoding UTF8',
    'Invoke-RestMethod -Method GET -Uri "$DocumentUrl/api/v1/document/health" -Headers $Headers | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath "$OutputDir\dia80-document-health.json" -Encoding UTF8',
    'Invoke-RestMethod -Method GET -Uri "$ReportingUrl/api/v1/reporting/health" -Headers $Headers | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath "$OutputDir\dia80-reporting-health.json" -Encoding UTF8',
    'Invoke-RestMethod -Method GET -Uri "$AuditUrl/api/v1/audit/health" -Headers $Headers | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath "$OutputDir\dia80-audit-health.json" -Encoding UTF8',
    "",
    'gcloud logging read "resource.type=cloud_run_revision AND severity>=ERROR" --project $ProjectId --limit 200 > "$OutputDir\dia80-cloudrun-errors.txt"',
    '$Services = @("identity-service-prod","dispatch-service-prod","ticketing-service-prod","document-service-prod","reporting-service-prod","audit-service-prod","frontend-shell-prod","mfe-identity-prod","mfe-dispatch-prod","mfe-ticketing-prod","mfe-reporting-prod","mfe-admin-prod")',
    'foreach ($Service in $Services) {',
    '  gcloud run services logs read $Service --project $ProjectId --region $Region --limit 80 > "$OutputDir\dia80-$Service-logs.txt"',
    '}',
    "",
    '$SalesReport = Invoke-RestMethod -Method GET -Uri "$ReportingUrl/api/v1/reporting/reports/sales?date_from=$Today&date_to=$Today" -Headers $Headers',
    '$PassengerReport = Invoke-RestMethod -Method GET -Uri "$ReportingUrl/api/v1/reporting/reports/passengers?date_from=$Today&date_to=$Today" -Headers $Headers',
    '$SalesByUser = Invoke-RestMethod -Method GET -Uri "$ReportingUrl/api/v1/reporting/reports/sales/by-user?date_from=$Today&date_to=$Today" -Headers $Headers',
    '$SalesByBus = Invoke-RestMethod -Method GET -Uri "$ReportingUrl/api/v1/reporting/reports/sales/by-bus?date_from=$Today&date_to=$Today" -Headers $Headers',
    '$SalesReport | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath "$OutputDir\dia80-sales-report.json" -Encoding UTF8',
    '$PassengerReport | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath "$OutputDir\dia80-passenger-report.json" -Encoding UTF8',
    '$SalesByUser | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath "$OutputDir\dia80-sales-by-user.json" -Encoding UTF8',
    '$SalesByBus | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath "$OutputDir\dia80-sales-by-bus.json" -Encoding UTF8',
    "",
    'gcloud sql instances describe $CloudSqlInstance --project $ProjectId --format json > "$OutputDir\dia80-cloudsql-describe.json"',
    'gcloud sql operations list --instance $CloudSqlInstance --project $ProjectId --limit 30 > "$OutputDir\dia80-cloudsql-operations.txt"',
    '$Start = (Get-Date).AddHours(-8).ToUniversalTime().ToString("o")',
    '$End = (Get-Date).ToUniversalTime().ToString("o")',
    '$CloudSqlDatabaseId = "$ProjectId`:$CloudSqlInstance"',
    '$MonitoringToken = gcloud auth print-access-token',
    '$MonitoringHeaders = @{ Authorization = "Bearer $MonitoringToken" }',
    'function Get-MonitoringTimeSeries {',
    '  param([string]$MetricType)',
    '  $Filter = ''metric.type="'' + $MetricType + ''" AND resource.labels.database_id="'' + $CloudSqlDatabaseId + ''"''',
    '  $Uri = "https://monitoring.googleapis.com/v3/projects/$ProjectId/timeSeries?filter=$([System.Uri]::EscapeDataString($Filter))&interval.startTime=$([System.Uri]::EscapeDataString($Start))&interval.endTime=$([System.Uri]::EscapeDataString($End))"',
    '  Invoke-RestMethod -Method GET -Uri $Uri -Headers $MonitoringHeaders',
    '}',
    'Get-MonitoringTimeSeries -MetricType "cloudsql.googleapis.com/database/cpu/utilization" | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath "$OutputDir\dia80-cloudsql-cpu.json" -Encoding UTF8',
    'Get-MonitoringTimeSeries -MetricType "cloudsql.googleapis.com/database/disk/utilization" | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath "$OutputDir\dia80-cloudsql-disk.json" -Encoding UTF8',
    "",
    '$UrgentConfigReview = @(',
    '  "# Revision de configuracion urgente - Dia 80",',
    '  "",',
    '  "Registrar aqui cualquier ajuste propuesto durante soporte intensivo.",',
    '  "",',
    '  "| Area | Hallazgo | Ajuste propuesto | Aprobado por | Estado |",',
    '  "| --- | --- | --- | --- | --- |",',
    '  "| Cloud Run | Pendiente | Pendiente | Pendiente | Pendiente |",',
    '  "| Cloud SQL | Pendiente | Pendiente | Pendiente | Pendiente |",',
    '  "| Permisos | Pendiente | Pendiente | Pendiente | Pendiente |"',
    ')',
    '$UrgentConfigReview | Set-Content -LiteralPath "$OutputDir\dia80-urgent-config-review.md" -Encoding UTF8',
    "",
    '$Evidence = @{',
    '  generated_at = (Get-Date).ToString("o")',
    '  date = $Today',
    '  files = Get-ChildItem -LiteralPath $OutputDir -File | Select-Object Name, Length',
    '}',
    '$Evidence | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath "$OutputDir\dia80-post-start-day1-evidence.json" -Encoding UTF8'
  )

  Set-Content -LiteralPath $Path -Value $Lines -Encoding UTF8
}

function Write-Day1Report {
  param(
    [string]$Path,
    [string]$RunId,
    [string]$CommandPath,
    [bool]$GoLiveStarted
  )

  $State = if ($GoLiveStarted) { "PENDIENTE_EJECUCION_MONITOREO" } else { "PENDIENTE_APERTURA_PRODUCTIVA" }

  $Lines = @(
    "# Reporte post-arranque dia 1",
    "",
    "Fecha base: 2026-09-28",
    "",
    "Estado: $State",
    "",
    "Run ID: $RunId",
    "",
    "## Resumen ejecutivo",
    "",
    "El paquete de soporte intensivo dia 1 queda preparado. La revision real de ventas, reportes, errores y consumo Cloud SQL se ejecuta despues de confirmar apertura productiva.",
    "",
    "## Comando de recoleccion preparado",
    "",
    '```text',
    $CommandPath,
    '```',
    "",
    "## Checklist dia 1",
    "",
    "| Revision | Estado | Evidencia | Observacion |",
    "| --- | --- | --- | --- |",
    "| Errores por servicio | Pendiente | logs/post-start-day1 | Ejecutar comando de recoleccion |",
    "| Ventas del dia | Pendiente | dia80-sales-report.json | Requiere operacion real |",
    "| Reportes | Pendiente | dia80-sales-by-user.json / dia80-sales-by-bus.json | Requiere operacion real |",
    "| Consumo Cloud SQL | Pendiente | dia80-cloudsql-*.json | Requiere consulta Monitoring |",
    "| Configuracion urgente | Pendiente | dia80-urgent-config-review.md | Ajustes solo con aprobacion |",
    "",
    "## Incidencias criticas",
    "",
    "| ID | Severidad | Estado | Decision |",
    "| --- | --- | --- | --- |",
    "| Pendiente | Pendiente | Pendiente | Pendiente |",
    "",
    "## Criterio de avance",
    "",
    "No existen bloqueos criticos abiertos.",
    "",
    "## Decision",
    "",
    "| Rol | Nombre | Decision | Firma | Fecha |",
    "| --- | --- | --- | --- | --- |",
    "| Responsable negocio | <nombre> | Pendiente | <firma> | <fecha> |",
    "| Responsable tecnico | <nombre> | Pendiente | <firma> | <fecha> |"
  )

  Set-Content -LiteralPath $Path -Value $Lines -Encoding UTF8
}

$RunId = Get-Date -Format "yyyyMMdd-HHmmss"

$ResolvedOutputDir = Resolve-ProjectPath -Path $OutputDir
$ResolvedBackendEvidencePath = Resolve-ProjectPath -Path $ProdBackendEvidencePath
$ResolvedFrontendEvidencePath = Resolve-ProjectPath -Path $ProdFrontendEvidencePath
$ResolvedGoLiveEvidencePath = Resolve-ProjectPath -Path $GoLiveEvidencePath
$ResolvedGoLiveMonitoringEvidencePath = Resolve-ProjectPath -Path $GoLiveMonitoringEvidencePath
$ResolvedCloudSqlProdConfigPath = Resolve-ProjectPath -Path $CloudSqlProdConfigPath
$ResolvedIncidentRegisterPath = Resolve-ProjectPath -Path $IncidentRegisterPath
$ResolvedReportPath = Resolve-ProjectPath -Path $ReportPath
$CommandsPath = Join-Path $ResolvedOutputDir "dia80-post-start-day1-commands.ps1"
$ResultPath = Join-Path $ResolvedOutputDir "dia80-post-start-day1-readiness.json"

New-Item -ItemType Directory -Force -Path $ResolvedOutputDir | Out-Null

$Checks = [System.Collections.Generic.List[object]]::new()
$TechnicalBlockers = [System.Collections.Generic.List[string]]::new()
$BusinessBlockers = [System.Collections.Generic.List[string]]::new()
$Warnings = [System.Collections.Generic.List[string]]::new()

$RequiredFiles = [ordered]@{
  prod_backends = $ResolvedBackendEvidencePath
  prod_frontends = $ResolvedFrontendEvidencePath
  go_live_readiness = $ResolvedGoLiveEvidencePath
  cloudsql_prod_config = $ResolvedCloudSqlProdConfigPath
  incident_register = $ResolvedIncidentRegisterPath
}

foreach ($Key in $RequiredFiles.Keys) {
  $Exists = Test-Path -LiteralPath $RequiredFiles[$Key]
  Add-Check -Checks $Checks -Area "files" -Name $Key -Passed $Exists -Detail $RequiredFiles[$Key]
  if (-not $Exists) {
    $TechnicalBlockers.Add("Falta archivo requerido: $Key -> $($RequiredFiles[$Key])")
  }
}

$Backend = Read-JsonFile -Path $ResolvedBackendEvidencePath
$Frontend = Read-JsonFile -Path $ResolvedFrontendEvidencePath
$GoLive = Read-JsonFile -Path $ResolvedGoLiveEvidencePath
$CloudSqlConfig = Read-JsonFile -Path $ResolvedCloudSqlProdConfigPath

$BackendReady = $false
if ($Backend) {
  $BackendReady = [bool]$Backend.ready -and ([int]$Backend.summary.services_ready -eq 6) -and ([int]$Backend.summary.smoke_tests_passed -eq 6)
}
Add-Check -Checks $Checks -Area "prod" -Name "backend ready" -Passed $BackendReady -Detail "services_ready=$($Backend.summary.services_ready); smoke=$($Backend.summary.smoke_tests_passed)"
if (-not $BackendReady) {
  $TechnicalBlockers.Add("Backends productivos no estan listos 6/6.")
}

$FrontendReady = $false
if ($Frontend) {
  $FrontendReady = ([int]$Frontend.summary.services_ready -eq 6) -and ([int]$Frontend.summary.checks_failed -eq 0)
}
Add-Check -Checks $Checks -Area "prod" -Name "frontend ready" -Passed $FrontendReady -Detail "services_ready=$($Frontend.summary.services_ready); failed=$($Frontend.summary.checks_failed)"
if (-not $FrontendReady) {
  $TechnicalBlockers.Add("Frontends productivos no estan listos 6/6.")
}

$GoLiveStarted = $false
$GoLiveReady = $false
if ($GoLive) {
  $GoLiveStarted = [bool]$GoLive.go_live_started
  $GoLiveReady = [bool]$GoLive.ready_for_real_go_live
}
Add-Check -Checks $Checks -Area "precondition" -Name "go live ready" -Passed $GoLiveReady -Detail $ResolvedGoLiveEvidencePath
Add-Check -Checks $Checks -Area "precondition" -Name "go live started" -Passed $GoLiveStarted -Detail $ResolvedGoLiveEvidencePath

if (-not $GoLiveStarted) {
  $BusinessBlockers.Add("La operacion real del Dia 79 no esta iniciada.")
}
if (-not (Test-Path -LiteralPath $ResolvedGoLiveMonitoringEvidencePath)) {
  $BusinessBlockers.Add("No existe evidencia de monitoreo de apertura Dia 79.")
}
if (-not [bool]$ConfirmGoLiveStarted) {
  $BusinessBlockers.Add("No se confirmo apertura real con -ConfirmGoLiveStarted.")
}
if (-not [bool]$ConfirmBusinessOpen) {
  $BusinessBlockers.Add("No se confirmo negocio abierto con -ConfirmBusinessOpen.")
}

$DispatchUrl = Get-ServiceUrl -Evidence $Backend -ServiceId "dispatch-service"
$TicketingUrl = Get-ServiceUrl -Evidence $Backend -ServiceId "ticketing-service"
$DocumentUrl = Get-ServiceUrl -Evidence $Backend -ServiceId "document-service"
$ReportingUrl = Get-ServiceUrl -Evidence $Backend -ServiceId "reporting-service"
$AuditUrl = Get-ServiceUrl -Evidence $Backend -ServiceId "audit-service"
$ShellUrl = Get-ServiceUrl -Evidence $Frontend -ServiceId "frontend-shell"

$RequiredUrls = [ordered]@{
  dispatch = $DispatchUrl
  ticketing = $TicketingUrl
  document = $DocumentUrl
  reporting = $ReportingUrl
  audit = $AuditUrl
  shell = $ShellUrl
}

foreach ($Key in $RequiredUrls.Keys) {
  $HasUrl = -not [string]::IsNullOrWhiteSpace($RequiredUrls[$Key])
  Add-Check -Checks $Checks -Area "urls" -Name $Key -Passed $HasUrl -Detail $RequiredUrls[$Key]
  if (-not $HasUrl) {
    $TechnicalBlockers.Add("No se pudo resolver URL productiva: $Key")
  }
}

$ProjectId = if ($Backend) { [string]$Backend.project_id } elseif ($CloudSqlConfig) { [string]$CloudSqlConfig.project_id } else { "" }
$Region = if ($Backend) { [string]$Backend.region } elseif ($CloudSqlConfig) { [string]$CloudSqlConfig.instance.region } else { "" }
$CloudSqlInstance = if ($CloudSqlConfig) { [string]$CloudSqlConfig.instance.name } else { "venta-pasajes-prod-sql" }

Write-Day1SupportCommands `
  -Path $CommandsPath `
  -ProjectId $ProjectId `
  -Region $Region `
  -CloudSqlInstance $CloudSqlInstance `
  -DispatchUrl $DispatchUrl `
  -TicketingUrl $TicketingUrl `
  -DocumentUrl $DocumentUrl `
  -ReportingUrl $ReportingUrl `
  -AuditUrl $AuditUrl `
  -ShellUrl $ShellUrl

Write-Day1Report -Path $ResolvedReportPath -RunId $RunId -CommandPath $CommandsPath -GoLiveStarted $GoLiveStarted

$ReadyForSupportPackage = $TechnicalBlockers.Count -eq 0
$ReadyForRealSupportReview = $ReadyForSupportPackage -and $BusinessBlockers.Count -eq 0
$SupportEvidencePath = Join-Path $ResolvedOutputDir "dia80-post-start-day1-evidence.json"
$SupportEvidenceExists = Test-Path -LiteralPath $SupportEvidencePath

if ([bool]$RecordSupportReview -and -not $SupportEvidenceExists) {
  $BusinessBlockers.Add("No existe evidencia de soporte post-arranque Dia 80: $SupportEvidencePath")
}

$SupportReviewExecuted = [bool]$RecordSupportReview -and $ReadyForRealSupportReview -and $SupportEvidenceExists

if (-not $ReadyForRealSupportReview) {
  $Warnings.Add("Soporte intensivo real bloqueado hasta confirmar apertura productiva y monitoreo Dia 79.")
}

$Result = [pscustomobject]@{
  generated_at = (Get-Date).ToString("o")
  run_id = $RunId
  ready_for_support_package = $ReadyForSupportPackage
  ready_for_real_support_review = ($ReadyForSupportPackage -and $BusinessBlockers.Count -eq 0)
  support_review_executed = $SupportReviewExecuted
  project_id = $ProjectId
  region = $Region
  cloud_sql_instance = $CloudSqlInstance
  paths = [pscustomobject]@{
    commands = $CommandsPath
    result = $ResultPath
    report = $ResolvedReportPath
    incident_register = $ResolvedIncidentRegisterPath
    support_evidence = $SupportEvidencePath
  }
  urls = [pscustomobject]$RequiredUrls
  checks = @($Checks)
  technical_blockers = @($TechnicalBlockers)
  business_blockers = @($BusinessBlockers)
  warnings = @($Warnings)
}

$Result | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $ResultPath -Encoding UTF8

@($Checks) |
  Select-Object area, name, passed, detail |
  Format-Table -AutoSize

Write-Host "Resultado JSON: $ResultPath"
Write-Host "Comandos soporte dia 1: $CommandsPath"
Write-Host "Reporte: $ResolvedReportPath"
Write-Host "Paquete soporte listo: $ReadyForSupportPackage"
Write-Host "Revision real autorizada: $($ReadyForSupportPackage -and $BusinessBlockers.Count -eq 0)"
Write-Host "Revision real ejecutada: $SupportReviewExecuted"

if ($Warnings.Count -gt 0) {
  Write-Host "Advertencias:"
  foreach ($Warning in $Warnings) {
    Write-Host "- $Warning"
  }
}

if ($BusinessBlockers.Count -gt 0) {
  Write-Host "Bloqueos de negocio:"
  foreach ($Blocker in $BusinessBlockers) {
    Write-Host "- $Blocker"
  }
}

if ($TechnicalBlockers.Count -gt 0) {
  Write-Host "Bloqueos tecnicos:"
  foreach ($Blocker in $TechnicalBlockers) {
    Write-Host "- $Blocker"
  }
}

if ($FailOnBlocker -and ($TechnicalBlockers.Count -gt 0 -or $BusinessBlockers.Count -gt 0)) {
  throw "El soporte intensivo dia 1 tiene bloqueos."
}
