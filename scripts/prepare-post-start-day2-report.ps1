param(
  [string]$OutputDir = "logs\post-start-day2",
  [string]$ProdBackendEvidencePath = "logs\cloudrun-prod\verify-cloudrun-prod-backends.json",
  [string]$ProdFrontendEvidencePath = "logs\cloudrun-prod\verify-cloudrun-prod-frontends.json",
  [string]$GoLiveEvidencePath = "logs\go-live\dia79-go-live-readiness.json",
  [string]$Day1ReadinessPath = "logs\post-start-day1\dia80-post-start-day1-readiness.json",
  [string]$Day1EvidencePath = "logs\post-start-day1\dia80-post-start-day1-evidence.json",
  [string]$IncidentRegisterPath = "docs\registro-incidencias-iniciales.md",
  [string]$Day1ReportPath = "docs\reporte-post-arranque-dia-1.md",
  [string]$ReportPath = "docs\reporte-post-arranque-dia-2.md",
  [switch]$ConfirmDay1Closed,
  [switch]$ConfirmBusinessOpen,
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

function Write-Day2SupportCommands {
  param(
    [string]$Path,
    [string]$ProjectId,
    [string]$Region,
    [string]$IdentityUrl,
    [string]$TicketingUrl,
    [string]$DocumentUrl,
    [string]$ReportingUrl,
    [string]$AuditUrl,
    [string]$ShellUrl
  )

  $Lines = @(
    "# Dia 81 - soporte intensivo dia 2",
    "# Ejecutar solo despues de cerrar soporte dia 1 y confirmar operacion real.",
    "# Este archivo recolecta evidencia y plantillas; no cambia permisos ni anula boletos automaticamente.",
    "",
    '$ProjectId = "' + $ProjectId + '"',
    '$Region = "' + $Region + '"',
    '$IdentityUrl = "' + $IdentityUrl + '"',
    '$TicketingUrl = "' + $TicketingUrl + '"',
    '$DocumentUrl = "' + $DocumentUrl + '"',
    '$ReportingUrl = "' + $ReportingUrl + '"',
    '$AuditUrl = "' + $AuditUrl + '"',
    '$ShellUrl = "' + $ShellUrl + '"',
    '$OutputDir = "logs\post-start-day2"',
    'New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null',
    "",
    '$Token = gcloud auth print-identity-token',
    '$Headers = @{ Authorization = "Bearer $Token" }',
    '$Today = (Get-Date).ToString("yyyy-MM-dd")',
    "",
    'curl.exe -s "$ShellUrl/api/health" > "$OutputDir\dia81-shell-health.txt"',
    'Invoke-RestMethod -Method GET -Uri "$IdentityUrl/api/v1/identity/health" -Headers $Headers | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath "$OutputDir\dia81-identity-health.json" -Encoding UTF8',
    'Invoke-RestMethod -Method GET -Uri "$TicketingUrl/api/v1/ticketing/health" -Headers $Headers | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath "$OutputDir\dia81-ticketing-health.json" -Encoding UTF8',
    'Invoke-RestMethod -Method GET -Uri "$DocumentUrl/api/v1/document/health" -Headers $Headers | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath "$OutputDir\dia81-document-health.json" -Encoding UTF8',
    'Invoke-RestMethod -Method GET -Uri "$ReportingUrl/api/v1/reporting/health" -Headers $Headers | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath "$OutputDir\dia81-reporting-health.json" -Encoding UTF8',
    'Invoke-RestMethod -Method GET -Uri "$AuditUrl/api/v1/audit/health" -Headers $Headers | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath "$OutputDir\dia81-audit-health.json" -Encoding UTF8',
    "",
    '$Feedback = @(',
    '  "# Feedback de boleteria - Dia 81",',
    '  "",',
    '  "| Fecha/hora | Usuario | Punto de venta | Feedback | Severidad | Accion | Estado |",',
    '  "| --- | --- | --- | --- | --- | --- | --- |",',
    '  "| <fecha-hora> | <usuario> | <punto> | <detalle> | Baja/Media/Alta | <accion> | Abierta |"',
    ')',
    '$Feedback | Set-Content -LiteralPath "$OutputDir\dia81-feedback-boleteria.md" -Encoding UTF8',
    "",
    '$MinorFixes = @(',
    '  "# Correcciones menores - Dia 81",',
    '  "",',
    '  "| ID | Hallazgo | Tipo | Archivo/configuracion | Reversa | Aprobado por | Estado |",',
    '  "| --- | --- | --- | --- | --- | --- | --- |",',
    '  "| FIX-001 | <detalle> | UI/API/Config | <ruta> | <reversa> | <nombre> | Pendiente |"',
    ')',
    '$MinorFixes | Set-Content -LiteralPath "$OutputDir\dia81-correcciones-menores.md" -Encoding UTF8',
    "",
    'Invoke-RestMethod -Method GET -Uri "$IdentityUrl/api/v1/identity/roles" -Headers $Headers | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath "$OutputDir\dia81-identity-roles.json" -Encoding UTF8',
    'Invoke-RestMethod -Method GET -Uri "$IdentityUrl/api/v1/identity/permissions" -Headers $Headers | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath "$OutputDir\dia81-identity-permissions.json" -Encoding UTF8',
    'Invoke-RestMethod -Method GET -Uri "$IdentityUrl/api/v1/identity/authorized-identities" -Headers $Headers | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath "$OutputDir\dia81-authorized-identities.json" -Encoding UTF8',
    '$PermissionAdjustments = @(',
    '  "# Ajustes de permisos - Dia 81",',
    '  "",',
    '  "No ejecutar cambios de permisos sin aprobacion. Registrar aqui cada solicitud antes de aplicar en Identidad/Admin.",',
    '  "",',
    '  "| Solicitud | Usuario/correo | Rol actual | Rol solicitado | Justificacion | Aprobado por | Estado |",',
    '  "| --- | --- | --- | --- | --- | --- | --- |",',
    '  "| PERM-001 | <correo> | <rol> | <rol> | <motivo> | <nombre> | Pendiente |"',
    ')',
    '$PermissionAdjustments | Set-Content -LiteralPath "$OutputDir\dia81-permission-adjustments.md" -Encoding UTF8',
    "",
    '$SalesReport = Invoke-RestMethod -Method GET -Uri "$ReportingUrl/api/v1/reporting/reports/sales?date_from=$Today&date_to=$Today" -Headers $Headers',
    '$SalesByUser = Invoke-RestMethod -Method GET -Uri "$ReportingUrl/api/v1/reporting/reports/sales/by-user?date_from=$Today&date_to=$Today" -Headers $Headers',
    '$SalesReport | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath "$OutputDir\dia81-sales-report.json" -Encoding UTF8',
    '$SalesByUser | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath "$OutputDir\dia81-sales-by-user.json" -Encoding UTF8',
    "",
    '$TicketStatuses = Invoke-RestMethod -Method GET -Uri "$TicketingUrl/api/v1/ticketing/ticket-statuses" -Headers $Headers',
    '$TicketStatuses | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath "$OutputDir\dia81-ticket-statuses.json" -Encoding UTF8',
    '$AuditEvents = Invoke-RestMethod -Method GET -Uri "$AuditUrl/api/v1/audit/audit-events?page=1&page_size=50" -Headers $Headers',
    '$AuditEvents | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath "$OutputDir\dia81-audit-events.json" -Encoding UTF8',
    "",
    'if ($env:DIA81_CANCELLED_TICKET_ID) {',
    '  Invoke-RestMethod -Method GET -Uri "$TicketingUrl/api/v1/ticketing/tickets/$env:DIA81_CANCELLED_TICKET_ID" -Headers $Headers | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath "$OutputDir\dia81-cancelled-ticket-validation.json" -Encoding UTF8',
    '} else {',
    '  "Definir variable DIA81_CANCELLED_TICKET_ID para validar una anulacion especifica." | Set-Content -LiteralPath "$OutputDir\dia81-cancelled-ticket-validation.txt" -Encoding UTF8',
    '}',
    "",
    'if ($env:DIA81_DOCUMENT_ID) {',
    '  Invoke-WebRequest -Method GET -Uri "$DocumentUrl/api/v1/document/documents/$env:DIA81_DOCUMENT_ID/download" -Headers $Headers -OutFile "$OutputDir\dia81-print-validation.pdf"',
    '} else {',
    '  "Definir variable DIA81_DOCUMENT_ID para descargar un PDF y validar impresion." | Set-Content -LiteralPath "$OutputDir\dia81-print-validation.txt" -Encoding UTF8',
    '}',
    "",
    'gcloud logging read "resource.type=cloud_run_revision AND severity>=ERROR" --project $ProjectId --limit 200 > "$OutputDir\dia81-cloudrun-errors.txt"',
    'gcloud run services list --project $ProjectId --region $Region --filter="metadata.name~-prod" > "$OutputDir\dia81-cloudrun-services.txt"',
    "",
    '$Evidence = @{',
    '  generated_at = (Get-Date).ToString("o")',
    '  date = $Today',
    '  files = Get-ChildItem -LiteralPath $OutputDir -File | Select-Object Name, Length',
    '}',
    '$Evidence | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath "$OutputDir\dia81-post-start-day2-evidence.json" -Encoding UTF8'
  )

  Set-Content -LiteralPath $Path -Value $Lines -Encoding UTF8
}

function Write-Day2Report {
  param(
    [string]$Path,
    [string]$RunId,
    [string]$CommandPath,
    [bool]$Day1Executed
  )

  $State = if ($Day1Executed) { "PENDIENTE_EJECUCION_SOPORTE_DIA_2" } else { "PENDIENTE_SOPORTE_DIA_1" }

  $Lines = @(
    "# Reporte post-arranque dia 2",
    "",
    "Fecha base: 2026-09-28",
    "",
    "Estado: $State",
    "",
    "Run ID: $RunId",
    "",
    "## Resumen ejecutivo",
    "",
    "El paquete de soporte intensivo dia 2 queda preparado. La revision real de feedback, permisos, impresion y anulaciones se ejecuta despues de cerrar el soporte dia 1.",
    "",
    "## Comando de recoleccion preparado",
    "",
    '```text',
    $CommandPath,
    '```',
    "",
    "## Checklist dia 2",
    "",
    "| Revision | Estado | Evidencia | Observacion |",
    "| --- | --- | --- | --- |",
    "| Feedback de boleteria | Pendiente | dia81-feedback-boleteria.md | Requiere operacion real |",
    "| Correcciones menores | Pendiente | dia81-correcciones-menores.md | Cambios solo con reversa |",
    "| Permisos | Pendiente | dia81-identity-*.json / dia81-permission-adjustments.md | Ajustes manuales aprobados |",
    "| Impresion | Pendiente | dia81-print-validation.* | Requiere DIA81_DOCUMENT_ID |",
    "| Anulaciones | Pendiente | dia81-cancelled-ticket-validation.* | Requiere DIA81_CANCELLED_TICKET_ID |",
    "",
    "## Incidencias y decisiones",
    "",
    "| Area | Hallazgo | Severidad | Decision | Responsable | Estado |",
    "| --- | --- | --- | --- | --- | --- |",
    "| Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |",
    "",
    "## Criterio de avance",
    "",
    "La operacion se estabiliza.",
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
$ResolvedDay1ReadinessPath = Resolve-ProjectPath -Path $Day1ReadinessPath
$ResolvedDay1EvidencePath = Resolve-ProjectPath -Path $Day1EvidencePath
$ResolvedIncidentRegisterPath = Resolve-ProjectPath -Path $IncidentRegisterPath
$ResolvedDay1ReportPath = Resolve-ProjectPath -Path $Day1ReportPath
$ResolvedReportPath = Resolve-ProjectPath -Path $ReportPath
$CommandsPath = Join-Path $ResolvedOutputDir "dia81-post-start-day2-commands.ps1"
$ResultPath = Join-Path $ResolvedOutputDir "dia81-post-start-day2-readiness.json"

New-Item -ItemType Directory -Force -Path $ResolvedOutputDir | Out-Null

$Checks = [System.Collections.Generic.List[object]]::new()
$TechnicalBlockers = [System.Collections.Generic.List[string]]::new()
$BusinessBlockers = [System.Collections.Generic.List[string]]::new()
$Warnings = [System.Collections.Generic.List[string]]::new()

$RequiredFiles = [ordered]@{
  prod_backends = $ResolvedBackendEvidencePath
  prod_frontends = $ResolvedFrontendEvidencePath
  go_live_readiness = $ResolvedGoLiveEvidencePath
  day1_readiness = $ResolvedDay1ReadinessPath
  incident_register = $ResolvedIncidentRegisterPath
  day1_report = $ResolvedDay1ReportPath
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
$Day1 = Read-JsonFile -Path $ResolvedDay1ReadinessPath

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

$Day1Executed = $false
$Day1ReadyForReview = $false
if ($Day1) {
  $Day1Executed = [bool]$Day1.support_review_executed
  $Day1ReadyForReview = [bool]$Day1.ready_for_real_support_review
}
Add-Check -Checks $Checks -Area "precondition" -Name "day 1 support ready" -Passed $Day1ReadyForReview -Detail $ResolvedDay1ReadinessPath
Add-Check -Checks $Checks -Area "precondition" -Name "day 1 support executed" -Passed $Day1Executed -Detail $ResolvedDay1ReadinessPath

if (-not $GoLiveStarted) {
  $BusinessBlockers.Add("La operacion real del Dia 79 no esta iniciada.")
}
if (-not $Day1Executed) {
  $BusinessBlockers.Add("El soporte intensivo Dia 80 no esta ejecutado ni cerrado.")
}
if (-not (Test-Path -LiteralPath $ResolvedDay1EvidencePath)) {
  $BusinessBlockers.Add("No existe evidencia de soporte real Dia 80.")
}
if (-not [bool]$ConfirmDay1Closed) {
  $BusinessBlockers.Add("No se confirmo cierre de Dia 80 con -ConfirmDay1Closed.")
}
if (-not [bool]$ConfirmBusinessOpen) {
  $BusinessBlockers.Add("No se confirmo negocio abierto con -ConfirmBusinessOpen.")
}

$IdentityUrl = Get-ServiceUrl -Evidence $Backend -ServiceId "identity-service"
$TicketingUrl = Get-ServiceUrl -Evidence $Backend -ServiceId "ticketing-service"
$DocumentUrl = Get-ServiceUrl -Evidence $Backend -ServiceId "document-service"
$ReportingUrl = Get-ServiceUrl -Evidence $Backend -ServiceId "reporting-service"
$AuditUrl = Get-ServiceUrl -Evidence $Backend -ServiceId "audit-service"
$ShellUrl = Get-ServiceUrl -Evidence $Frontend -ServiceId "frontend-shell"

$RequiredUrls = [ordered]@{
  identity = $IdentityUrl
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

Write-Day2SupportCommands `
  -Path $CommandsPath `
  -ProjectId $ProjectId `
  -Region $Region `
  -IdentityUrl $IdentityUrl `
  -TicketingUrl $TicketingUrl `
  -DocumentUrl $DocumentUrl `
  -ReportingUrl $ReportingUrl `
  -AuditUrl $AuditUrl `
  -ShellUrl $ShellUrl

Write-Day2Report -Path $ResolvedReportPath -RunId $RunId -CommandPath $CommandsPath -Day1Executed $Day1Executed

$ReadyForDay2Package = $TechnicalBlockers.Count -eq 0
$ReadyForRealDay2Review = $ReadyForDay2Package -and $BusinessBlockers.Count -eq 0

if (-not $ReadyForRealDay2Review) {
  $Warnings.Add("Soporte intensivo dia 2 bloqueado hasta cerrar Dia 80 y confirmar operacion real.")
}

$Result = [pscustomobject]@{
  generated_at = (Get-Date).ToString("o")
  run_id = $RunId
  ready_for_day2_package = $ReadyForDay2Package
  ready_for_real_day2_review = $ReadyForRealDay2Review
  day2_review_executed = $false
  project_id = $ProjectId
  region = $Region
  paths = [pscustomobject]@{
    commands = $CommandsPath
    result = $ResultPath
    report = $ResolvedReportPath
    incident_register = $ResolvedIncidentRegisterPath
    day1_report = $ResolvedDay1ReportPath
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
Write-Host "Comandos soporte dia 2: $CommandsPath"
Write-Host "Reporte: $ResolvedReportPath"
Write-Host "Paquete soporte dia 2 listo: $ReadyForDay2Package"
Write-Host "Revision real dia 2 autorizada: $ReadyForRealDay2Review"
Write-Host "Revision real dia 2 ejecutada: False"

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
  throw "El soporte intensivo dia 2 tiene bloqueos."
}
