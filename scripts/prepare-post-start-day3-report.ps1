param(
  [string]$OutputDir = "logs\post-start-day3",
  [string]$ProdBackendEvidencePath = "logs\cloudrun-prod\verify-cloudrun-prod-backends.json",
  [string]$ProdFrontendEvidencePath = "logs\cloudrun-prod\verify-cloudrun-prod-frontends.json",
  [string]$GoLiveEvidencePath = "logs\go-live\dia79-go-live-readiness.json",
  [string]$Day2ReadinessPath = "logs\post-start-day2\dia81-post-start-day2-readiness.json",
  [string]$Day2EvidencePath = "logs\post-start-day2\dia81-post-start-day2-evidence.json",
  [string]$IncidentRegisterPath = "docs\registro-incidencias-iniciales.md",
  [string]$Day2ReportPath = "docs\reporte-post-arranque-dia-2.md",
  [string]$ReportPath = "docs\reporte-post-arranque-dia-3.md",
  [switch]$ConfirmDay2Closed,
  [switch]$ConfirmBusinessStable,
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

  return [string]$Service[0].url
}

function Write-Day3SupportCommands {
  param(
    [string]$Path,
    [string]$ProjectId,
    [string]$Region,
    [string]$IdentityUrl,
    [string]$DispatchUrl,
    [string]$TicketingUrl,
    [string]$DocumentUrl,
    [string]$ReportingUrl,
    [string]$AuditUrl,
    [string]$ShellUrl
  )

  $Lines = @(
    "# Dia 82 - soporte intensivo dia 3",
    "# Ejecutar solo despues de cerrar soporte dia 2 y confirmar estabilidad operativa.",
    "# Este archivo recolecta evidencia; no cierra incidencias ni cambia configuracion automaticamente.",
    "",
    '$ProjectId = "' + $ProjectId + '"',
    '$Region = "' + $Region + '"',
    '$IdentityUrl = "' + $IdentityUrl + '"',
    '$DispatchUrl = "' + $DispatchUrl + '"',
    '$TicketingUrl = "' + $TicketingUrl + '"',
    '$DocumentUrl = "' + $DocumentUrl + '"',
    '$ReportingUrl = "' + $ReportingUrl + '"',
    '$AuditUrl = "' + $AuditUrl + '"',
    '$ShellUrl = "' + $ShellUrl + '"',
    '$OutputDir = "logs\post-start-day3"',
    'New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null',
    "",
    '$Token = gcloud auth print-identity-token',
    '$Headers = @{ Authorization = "Bearer $Token" }',
    '$Today = (Get-Date).ToString("yyyy-MM-dd")',
    '$Start = (Get-Date).AddHours(-24).ToUniversalTime().ToString("o")',
    '$End = (Get-Date).ToUniversalTime().ToString("o")',
    "",
    'curl.exe -s "$ShellUrl/api/health" > "$OutputDir\dia82-shell-health.txt"',
    'Invoke-RestMethod -Method GET -Uri "$IdentityUrl/api/v1/identity/health" -Headers $Headers | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath "$OutputDir\dia82-identity-health.json" -Encoding UTF8',
    'Invoke-RestMethod -Method GET -Uri "$DispatchUrl/api/v1/dispatch/health" -Headers $Headers | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath "$OutputDir\dia82-dispatch-health.json" -Encoding UTF8',
    'Invoke-RestMethod -Method GET -Uri "$TicketingUrl/api/v1/ticketing/health" -Headers $Headers | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath "$OutputDir\dia82-ticketing-health.json" -Encoding UTF8',
    'Invoke-RestMethod -Method GET -Uri "$DocumentUrl/api/v1/document/health" -Headers $Headers | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath "$OutputDir\dia82-document-health.json" -Encoding UTF8',
    'Invoke-RestMethod -Method GET -Uri "$ReportingUrl/api/v1/reporting/health" -Headers $Headers | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath "$OutputDir\dia82-reporting-health.json" -Encoding UTF8',
    'Invoke-RestMethod -Method GET -Uri "$AuditUrl/api/v1/audit/health" -Headers $Headers | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath "$OutputDir\dia82-audit-health.json" -Encoding UTF8',
    "",
    '$Services = @("identity-service-prod","dispatch-service-prod","ticketing-service-prod","document-service-prod","reporting-service-prod","audit-service-prod","frontend-shell-prod","mfe-identity-prod","mfe-dispatch-prod","mfe-ticketing-prod","mfe-reporting-prod","mfe-admin-prod")',
    'foreach ($Service in $Services) {',
    '  gcloud run services describe $Service --project $ProjectId --region $Region --format json > "$OutputDir\dia82-$Service-describe.json"',
    '  gcloud run services logs read $Service --project $ProjectId --region $Region --limit 120 > "$OutputDir\dia82-$Service-logs.txt"',
    '}',
    "",
    'gcloud logging read "resource.type=cloud_run_revision AND severity>=ERROR" --project $ProjectId --limit 300 > "$OutputDir\dia82-cloudrun-errors.txt"',
    '$LatencyFilter = "metric.type=`"run.googleapis.com/request_latencies`""',
    'gcloud monitoring time-series list --project $ProjectId --filter $LatencyFilter --interval "start=$Start,end=$End" --format json > "$OutputDir\dia82-cloudrun-latency.json"',
    '$RequestFilter = "metric.type=`"run.googleapis.com/request_count`""',
    'gcloud monitoring time-series list --project $ProjectId --filter $RequestFilter --interval "start=$Start,end=$End" --format json > "$OutputDir\dia82-cloudrun-request-count.json"',
    "",
    'gcloud billing projects describe $ProjectId > "$OutputDir\dia82-billing-project.txt"',
    '$CostReview = @(',
    '  "# Costos preliminares - Dia 82",',
    '  "",',
    '  "Revision preliminar. El analisis fino se realiza en Dia 83 - Optimizacion de costos.",',
    '  "",',
    '  "| Recurso | Senal revisada | Riesgo | Accion propuesta | Estado |",',
    '  "| --- | --- | --- | --- | --- |",',
    '  "| Cloud Run | Request count / latencia | Pendiente | Revisar min instances en Dia 83 | Pendiente |",',
    '  "| Cloud SQL | Instancia prod | Pendiente | Revisar tier/storage en Dia 83 | Pendiente |",',
    '  "| Logging | Volumen de logs | Pendiente | Revisar retencion/filtros en Dia 83 | Pendiente |"',
    ')',
    '$CostReview | Set-Content -LiteralPath "$OutputDir\dia82-preliminary-cost-review.md" -Encoding UTF8',
    "",
    'gcloud logging read "logName:cloudaudit.googleapis.com" --project $ProjectId --limit 200 > "$OutputDir\dia82-security-audit-logs.txt"',
    'Invoke-RestMethod -Method GET -Uri "$AuditUrl/api/v1/audit/audit-events?page=1&page_size=100" -Headers $Headers | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath "$OutputDir\dia82-functional-audit-events.json" -Encoding UTF8',
    "",
    '$SalesReport = Invoke-RestMethod -Method GET -Uri "$ReportingUrl/api/v1/reporting/reports/sales?date_from=$Today&date_to=$Today" -Headers $Headers',
    '$SalesByBus = Invoke-RestMethod -Method GET -Uri "$ReportingUrl/api/v1/reporting/reports/sales/by-bus?date_from=$Today&date_to=$Today" -Headers $Headers',
    '$SalesReport | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath "$OutputDir\dia82-sales-report.json" -Encoding UTF8',
    '$SalesByBus | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath "$OutputDir\dia82-sales-by-bus.json" -Encoding UTF8',
    "",
    '$IncidentClosure = @(',
    '  "# Cierre de incidencias abiertas - Dia 82",',
    '  "",',
    '  "No cerrar incidencias sin validacion de negocio y soporte tecnico.",',
    '  "",',
    '  "| Incidencia | Severidad | Evidencia de solucion | Responsable negocio | Responsable tecnico | Estado final |",',
    '  "| --- | --- | --- | --- | --- | --- |",',
    '  "| INC-0001 | <severidad> | <evidencia> | <nombre> | <nombre> | Pendiente |"',
    ')',
    '$IncidentClosure | Set-Content -LiteralPath "$OutputDir\dia82-incident-closure.md" -Encoding UTF8',
    "",
    '$NormalSupport = @(',
    '  "# Transicion a soporte normal - Dia 82",',
    '  "",',
    '  "| Criterio | Estado | Evidencia |",',
    '  "| --- | --- | --- |",',
    '  "| Sin bloqueos criticos | Pendiente | registro-incidencias-iniciales.md |",',
    '  "| Servicios estables | Pendiente | dia82-*-health.json |",',
    '  "| Latencia aceptable | Pendiente | dia82-cloudrun-latency.json |",',
    '  "| Costos preliminares revisados | Pendiente | dia82-preliminary-cost-review.md |",',
    '  "| Logs de seguridad revisados | Pendiente | dia82-security-audit-logs.txt |"',
    ')',
    '$NormalSupport | Set-Content -LiteralPath "$OutputDir\dia82-normal-support-transition.md" -Encoding UTF8',
    "",
    '$Evidence = @{',
    '  generated_at = (Get-Date).ToString("o")',
    '  date = $Today',
    '  files = Get-ChildItem -LiteralPath $OutputDir -File | Select-Object Name, Length',
    '}',
    '$Evidence | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath "$OutputDir\dia82-post-start-day3-evidence.json" -Encoding UTF8'
  )

  Set-Content -LiteralPath $Path -Value $Lines -Encoding UTF8
}

function Write-Day3Report {
  param(
    [string]$Path,
    [string]$RunId,
    [string]$CommandPath,
    [bool]$Day2Executed
  )

  $State = if ($Day2Executed) { "PENDIENTE_EJECUCION_SOPORTE_DIA_3" } else { "PENDIENTE_SOPORTE_DIA_2" }

  $Lines = @(
    "# Reporte post-arranque dia 3",
    "",
    "Fecha base: 2026-09-28",
    "",
    "Estado: $State",
    "",
    "Run ID: $RunId",
    "",
    "## Resumen ejecutivo",
    "",
    "El paquete de soporte intensivo dia 3 queda preparado. La revision real de estabilidad, latencia, costos preliminares, logs de seguridad y cierre de incidencias se ejecuta despues de cerrar el soporte dia 2.",
    "",
    "## Comando de recoleccion preparado",
    "",
    '```text',
    $CommandPath,
    '```',
    "",
    "## Checklist dia 3",
    "",
    "| Revision | Estado | Evidencia | Observacion |",
    "| --- | --- | --- | --- |",
    "| Estabilidad de servicios | Pendiente | dia82-*-health.json / dia82-*-describe.json | Requiere operacion real |",
    "| Latencia | Pendiente | dia82-cloudrun-latency.json | Requiere Monitoring |",
    "| Costos preliminares | Pendiente | dia82-preliminary-cost-review.md | Analisis detallado en Dia 83 |",
    "| Logs de seguridad | Pendiente | dia82-security-audit-logs.txt | Revisar accesos sospechosos |",
    "| Cierre de incidencias | Pendiente | dia82-incident-closure.md | No cerrar sin aprobacion |",
    "",
    "## Criterio de avance",
    "",
    "El sistema puede pasar a soporte normal.",
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
$ResolvedDay2ReadinessPath = Resolve-ProjectPath -Path $Day2ReadinessPath
$ResolvedDay2EvidencePath = Resolve-ProjectPath -Path $Day2EvidencePath
$ResolvedIncidentRegisterPath = Resolve-ProjectPath -Path $IncidentRegisterPath
$ResolvedDay2ReportPath = Resolve-ProjectPath -Path $Day2ReportPath
$ResolvedReportPath = Resolve-ProjectPath -Path $ReportPath
$CommandsPath = Join-Path $ResolvedOutputDir "dia82-post-start-day3-commands.ps1"
$ResultPath = Join-Path $ResolvedOutputDir "dia82-post-start-day3-readiness.json"

New-Item -ItemType Directory -Force -Path $ResolvedOutputDir | Out-Null

$Checks = [System.Collections.Generic.List[object]]::new()
$TechnicalBlockers = [System.Collections.Generic.List[string]]::new()
$BusinessBlockers = [System.Collections.Generic.List[string]]::new()
$Warnings = [System.Collections.Generic.List[string]]::new()

$RequiredFiles = [ordered]@{
  prod_backends = $ResolvedBackendEvidencePath
  prod_frontends = $ResolvedFrontendEvidencePath
  go_live_readiness = $ResolvedGoLiveEvidencePath
  day2_readiness = $ResolvedDay2ReadinessPath
  incident_register = $ResolvedIncidentRegisterPath
  day2_report = $ResolvedDay2ReportPath
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
$Day2 = Read-JsonFile -Path $ResolvedDay2ReadinessPath

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
if ($GoLive) {
  $GoLiveStarted = [bool]$GoLive.go_live_started
}
Add-Check -Checks $Checks -Area "precondition" -Name "go live started" -Passed $GoLiveStarted -Detail $ResolvedGoLiveEvidencePath

$Day2Executed = $false
$Day2ReadyForReview = $false
if ($Day2) {
  $Day2Executed = [bool]$Day2.day2_review_executed
  $Day2ReadyForReview = [bool]$Day2.ready_for_real_day2_review
}
Add-Check -Checks $Checks -Area "precondition" -Name "day 2 support ready" -Passed $Day2ReadyForReview -Detail $ResolvedDay2ReadinessPath
Add-Check -Checks $Checks -Area "precondition" -Name "day 2 support executed" -Passed $Day2Executed -Detail $ResolvedDay2ReadinessPath

if (-not $GoLiveStarted) {
  $BusinessBlockers.Add("La operacion real del Dia 79 no esta iniciada.")
}
if (-not $Day2Executed) {
  $BusinessBlockers.Add("El soporte intensivo Dia 81 no esta ejecutado ni cerrado.")
}
if (-not (Test-Path -LiteralPath $ResolvedDay2EvidencePath)) {
  $BusinessBlockers.Add("No existe evidencia de soporte real Dia 81.")
}
if (-not [bool]$ConfirmDay2Closed) {
  $BusinessBlockers.Add("No se confirmo cierre de Dia 81 con -ConfirmDay2Closed.")
}
if (-not [bool]$ConfirmBusinessStable) {
  $BusinessBlockers.Add("No se confirmo estabilidad de negocio con -ConfirmBusinessStable.")
}

$IdentityUrl = Get-ServiceUrl -Evidence $Backend -ServiceId "identity-service"
$DispatchUrl = Get-ServiceUrl -Evidence $Backend -ServiceId "dispatch-service"
$TicketingUrl = Get-ServiceUrl -Evidence $Backend -ServiceId "ticketing-service"
$DocumentUrl = Get-ServiceUrl -Evidence $Backend -ServiceId "document-service"
$ReportingUrl = Get-ServiceUrl -Evidence $Backend -ServiceId "reporting-service"
$AuditUrl = Get-ServiceUrl -Evidence $Backend -ServiceId "audit-service"
$ShellUrl = Get-ServiceUrl -Evidence $Frontend -ServiceId "frontend-shell"

$RequiredUrls = [ordered]@{
  identity = $IdentityUrl
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

$ProjectId = if ($Backend) { [string]$Backend.project_id } else { "" }
$Region = if ($Backend) { [string]$Backend.region } else { "" }

Write-Day3SupportCommands `
  -Path $CommandsPath `
  -ProjectId $ProjectId `
  -Region $Region `
  -IdentityUrl $IdentityUrl `
  -DispatchUrl $DispatchUrl `
  -TicketingUrl $TicketingUrl `
  -DocumentUrl $DocumentUrl `
  -ReportingUrl $ReportingUrl `
  -AuditUrl $AuditUrl `
  -ShellUrl $ShellUrl

Write-Day3Report -Path $ResolvedReportPath -RunId $RunId -CommandPath $CommandsPath -Day2Executed $Day2Executed

$ReadyForDay3Package = $TechnicalBlockers.Count -eq 0
$ReadyForNormalSupportDecision = $ReadyForDay3Package -and $BusinessBlockers.Count -eq 0

if (-not $ReadyForNormalSupportDecision) {
  $Warnings.Add("Decision de soporte normal bloqueada hasta cerrar Dia 81 y confirmar estabilidad.")
}

$Result = [pscustomobject]@{
  generated_at = (Get-Date).ToString("o")
  run_id = $RunId
  ready_for_day3_package = $ReadyForDay3Package
  ready_for_normal_support_decision = $ReadyForNormalSupportDecision
  day3_review_executed = $false
  project_id = $ProjectId
  region = $Region
  paths = [pscustomobject]@{
    commands = $CommandsPath
    result = $ResultPath
    report = $ResolvedReportPath
    incident_register = $ResolvedIncidentRegisterPath
    day2_report = $ResolvedDay2ReportPath
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
Write-Host "Comandos soporte dia 3: $CommandsPath"
Write-Host "Reporte: $ResolvedReportPath"
Write-Host "Paquete soporte dia 3 listo: $ReadyForDay3Package"
Write-Host "Decision soporte normal autorizada: $ReadyForNormalSupportDecision"
Write-Host "Revision real dia 3 ejecutada: False"

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
  throw "El soporte intensivo dia 3 tiene bloqueos."
}
