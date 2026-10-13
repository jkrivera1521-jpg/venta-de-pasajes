param(
  [string]$OutputDir = "logs\go-live",
  [string]$ProdBackendEvidencePath = "logs\cloudrun-prod\verify-cloudrun-prod-backends.json",
  [string]$ProdFrontendEvidencePath = "logs\cloudrun-prod\verify-cloudrun-prod-frontends.json",
  [string]$FinalMigrationEvidencePath = "logs\migration\dia77-final-prod\final-data-migration-prod-readiness.json",
  [string]$ControlledTestEvidencePath = "logs\prod-controlled-test\dia78-controlled-prod-test-readiness.json",
  [string]$IncidentRegisterPath = "docs\registro-incidencias-iniciales.md",
  [string]$GoLiveActPath = "docs\acta-puesta-en-marcha.md",
  [string[]]$OperatorEmails = @(),
  [string[]]$SupervisorEmails = @(),
  [switch]$ConfirmMigrationApplied,
  [switch]$ConfirmControlledTestApproved,
  [switch]$ConfirmBusinessOpen,
  [switch]$RecordGoLiveStarted,
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

function Write-GoLiveCommands {
  param(
    [string]$Path,
    [string]$ProjectId,
    [string]$Region,
    [string]$RunId,
    [string]$DispatchUrl,
    [string]$TicketingUrl,
    [string]$DocumentUrl,
    [string]$ReportingUrl,
    [string]$AuditUrl,
    [string]$ShellUrl
  )

  $Lines = @(
    "# Dia 79 - puesta en marcha",
    "# Ejecutar solo despues de migracion final aplicada, prueba controlada aprobada y decision de apertura firmada.",
    "# Este archivo inicia el monitoreo operativo, no crea ventas de prueba.",
    "",
    (Format-PowerShellStringAssignment -Name "ProjectId" -Value $ProjectId),
    (Format-PowerShellStringAssignment -Name "Region" -Value $Region),
    (Format-PowerShellStringAssignment -Name "RunId" -Value $RunId),
    (Format-PowerShellStringAssignment -Name "DispatchUrl" -Value $DispatchUrl),
    (Format-PowerShellStringAssignment -Name "TicketingUrl" -Value $TicketingUrl),
    (Format-PowerShellStringAssignment -Name "DocumentUrl" -Value $DocumentUrl),
    (Format-PowerShellStringAssignment -Name "ReportingUrl" -Value $ReportingUrl),
    (Format-PowerShellStringAssignment -Name "AuditUrl" -Value $AuditUrl),
    (Format-PowerShellStringAssignment -Name "ShellUrl" -Value $ShellUrl),
    '$OutputDir = "logs\go-live"',
    'New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null',
    "",
    '$Token = gcloud auth print-identity-token',
    '$Headers = @{ Authorization = "Bearer $Token" }',
    "",
    'curl.exe -s "$ShellUrl/api/health"',
    'Invoke-RestMethod -Method GET -Uri "$DispatchUrl/api/v1/dispatch/health" -Headers $Headers',
    'Invoke-RestMethod -Method GET -Uri "$TicketingUrl/api/v1/ticketing/health" -Headers $Headers',
    'Invoke-RestMethod -Method GET -Uri "$DocumentUrl/api/v1/document/health" -Headers $Headers',
    'Invoke-RestMethod -Method GET -Uri "$ReportingUrl/api/v1/reporting/health" -Headers $Headers',
    'Invoke-RestMethod -Method GET -Uri "$AuditUrl/api/v1/audit/health" -Headers $Headers',
    "",
    'gcloud run services list --project $ProjectId --region $Region --filter="metadata.name~-prod" > "$OutputDir\dia79-cloudrun-services.txt"',
    'gcloud logging read "resource.type=cloud_run_revision" --project $ProjectId --limit 100 > "$OutputDir\dia79-cloudrun-logs.txt"',
    "",
    '$Today = (Get-Date).ToString("yyyy-MM-dd")',
    '$SalesReport = Invoke-RestMethod -Method GET -Uri "$ReportingUrl/api/v1/reporting/reports/sales?date_from=$Today&date_to=$Today" -Headers $Headers',
    '$PassengerReport = Invoke-RestMethod -Method GET -Uri "$ReportingUrl/api/v1/reporting/reports/passengers?date_from=$Today&date_to=$Today" -Headers $Headers',
    '$AuditEvents = Invoke-RestMethod -Method GET -Uri "$AuditUrl/api/v1/audit/audit-events?page=1&page_size=20" -Headers $Headers',
    '$SalesReport | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath "$OutputDir\dia79-sales-report.json" -Encoding UTF8',
    '$PassengerReport | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath "$OutputDir\dia79-passenger-report.json" -Encoding UTF8',
    '$AuditEvents | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath "$OutputDir\dia79-audit-events.json" -Encoding UTF8',
    "",
    '$Evidence = @{',
    '  generated_at = (Get-Date).ToString("o")',
    '  run_id = $RunId',
    '  shell_url = $ShellUrl',
    '  monitoring_files = Get-ChildItem -LiteralPath $OutputDir -File | Select-Object Name, Length',
    '}',
    '$Evidence | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath "$OutputDir\dia79-go-live-monitoring-evidence.json" -Encoding UTF8'
  )

  Set-Content -LiteralPath $Path -Value $Lines -Encoding UTF8
}

function Write-IncidentRegister {
  param(
    [string]$Path,
    [string]$RunId
  )

  $Lines = @(
    "# Registro de incidencias iniciales",
    "",
    "Fecha base: 2026-09-28",
    "",
    "Run ID: $RunId",
    "",
    "Estado: PENDIENTE_APERTURA_PRODUCTIVA",
    "",
    "## Uso",
    "",
    "Registrar aqui toda incidencia detectada durante la puesta en marcha y las primeras horas de operacion.",
    "",
    "## Incidencias",
    "",
    "| ID | Fecha/hora | Canal | Modulo | Severidad | Descripcion | Responsable | Estado | Resolucion |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    "| INC-0001 | <fecha-hora> | Boleteria | <modulo> | Baja/Media/Alta/Critica | <detalle> | <nombre> | Abierta | <acciones> |",
    "",
    "## Cierre de primera jornada",
    "",
    "| Indicador | Valor | Observacion |",
    "| --- | --- | --- |",
    "| Incidencias criticas abiertas | Pendiente | Pendiente |",
    "| Incidencias altas abiertas | Pendiente | Pendiente |",
    "| Ventas reales verificadas | Pendiente | Pendiente |",
    "| Reportes revisados | Pendiente | Pendiente |",
    "| Logs revisados | Pendiente | Pendiente |"
  )

  Set-Content -LiteralPath $Path -Value $Lines -Encoding UTF8
}

function Write-GoLiveAct {
  param(
    [string]$Path,
    [string]$RunId,
    [string]$CommandPath,
    [string[]]$OperatorEmails,
    [string[]]$SupervisorEmails
  )

  $Operators = if ($OperatorEmails.Count -gt 0) { $OperatorEmails -join ", " } else { "Pendiente" }
  $Supervisors = if ($SupervisorEmails.Count -gt 0) { $SupervisorEmails -join ", " } else { "Pendiente" }

  $Lines = @(
    "# Acta de puesta en marcha",
    "",
    "Fecha base: 2026-09-28",
    "",
    "Estado: PENDIENTE_APERTURA_PRODUCTIVA_Y_FIRMA",
    "",
    "Run ID: $RunId",
    "",
    "## Objetivo",
    "",
    "Formalizar el inicio de operacion real con monitoreo activo, roles operativos asignados y registro de incidencias.",
    "",
    "## Accesos operativos",
    "",
    "| Grupo | Correos | Estado |",
    "| --- | --- | --- |",
    "| Boleteria | $Operators | Pendiente |",
    "| Supervisores | $Supervisors | Pendiente |",
    "",
    "## Comando de monitoreo preparado",
    "",
    '```text',
    $CommandPath,
    '```',
    "",
    "## Checklist de apertura",
    "",
    "| Paso | Resultado esperado | Estado | Evidencia |",
    "| --- | --- | --- | --- |",
    "| Migracion final aplicada | Datos productivos aprobados | Pendiente | Dia 77 |",
    "| Prueba controlada aprobada | Venta, PDF, anulacion, reportes y logs aprobados | Pendiente | Dia 78 |",
    "| Correos Google reales habilitados | Usuarios pueden ingresar | Pendiente | Identity/Admin |",
    "| Roles operativos asignados | Boleteria y supervisores con permisos correctos | Pendiente | Identity/Admin |",
    "| Operacion iniciada en boleteria | Primera venta real supervisada | Pendiente | Evidencia operativa |",
    "| Monitoreo activo | Logs y health checks revisados | Pendiente | logs/go-live |",
    "| Incidencias registradas | Registro actualizado | Pendiente | docs/registro-incidencias-iniciales.md |",
    "",
    "## Decision",
    "",
    "| Rol | Nombre | Decision | Firma | Fecha |",
    "| --- | --- | --- | --- | --- |",
    "| Responsable negocio | <nombre> | Pendiente | <firma> | <fecha> |",
    "| Responsable boleteria | <nombre> | Pendiente | <firma> | <fecha> |",
    "| Responsable tecnico | <nombre> | Pendiente | <firma> | <fecha> |"
  )

  Set-Content -LiteralPath $Path -Value $Lines -Encoding UTF8
}

$RunId = Get-Date -Format "yyyyMMdd-HHmmss"

$ResolvedOutputDir = Resolve-ProjectPath -Path $OutputDir
$ResolvedBackendEvidencePath = Resolve-ProjectPath -Path $ProdBackendEvidencePath
$ResolvedFrontendEvidencePath = Resolve-ProjectPath -Path $ProdFrontendEvidencePath
$ResolvedMigrationEvidencePath = Resolve-ProjectPath -Path $FinalMigrationEvidencePath
$ResolvedControlledTestEvidencePath = Resolve-ProjectPath -Path $ControlledTestEvidencePath
$ResolvedIncidentRegisterPath = Resolve-ProjectPath -Path $IncidentRegisterPath
$ResolvedGoLiveActPath = Resolve-ProjectPath -Path $GoLiveActPath
$CommandsPath = Join-Path $ResolvedOutputDir "dia79-go-live-commands.ps1"
$ResultPath = Join-Path $ResolvedOutputDir "dia79-go-live-readiness.json"

New-Item -ItemType Directory -Force -Path $ResolvedOutputDir | Out-Null

$Checks = [System.Collections.Generic.List[object]]::new()
$TechnicalBlockers = [System.Collections.Generic.List[string]]::new()
$BusinessBlockers = [System.Collections.Generic.List[string]]::new()
$Warnings = [System.Collections.Generic.List[string]]::new()

$RequiredFiles = [ordered]@{
  prod_backends = $ResolvedBackendEvidencePath
  prod_frontends = $ResolvedFrontendEvidencePath
  final_migration = $ResolvedMigrationEvidencePath
  controlled_test = $ResolvedControlledTestEvidencePath
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
$Migration = Read-JsonFile -Path $ResolvedMigrationEvidencePath
$ControlledTest = Read-JsonFile -Path $ResolvedControlledTestEvidencePath

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

$MigrationExecuted = $false
$DataApproved = $false
if ($Migration) {
  $MigrationExecuted = [bool]$Migration.production_migration_executed
  $DataApproved = [bool]$Migration.data_validation_approved
}
Add-Check -Checks $Checks -Area "precondition" -Name "final migration executed" -Passed $MigrationExecuted -Detail $ResolvedMigrationEvidencePath
Add-Check -Checks $Checks -Area "precondition" -Name "final data approved" -Passed $DataApproved -Detail $ResolvedMigrationEvidencePath
if (-not $MigrationExecuted) {
  $BusinessBlockers.Add("La migracion final no esta ejecutada en produccion.")
}
if (-not $DataApproved) {
  $BusinessBlockers.Add("Los datos productivos migrados no estan aprobados.")
}

$ControlledRealExecuted = $false
if ($ControlledTest) {
  $ControlledRealExecuted = [bool]$ControlledTest.real_test_executed
}
Add-Check -Checks $Checks -Area "precondition" -Name "controlled test executed" -Passed $ControlledRealExecuted -Detail $ResolvedControlledTestEvidencePath
if (-not $ControlledRealExecuted) {
  $BusinessBlockers.Add("La prueba productiva controlada del Dia 78 no esta ejecutada y aprobada.")
}

if ($OperatorEmails.Count -eq 0) {
  $BusinessBlockers.Add("No se informaron correos reales de boleteria con -OperatorEmails.")
}
if ($SupervisorEmails.Count -eq 0) {
  $BusinessBlockers.Add("No se informaron correos reales de supervisores con -SupervisorEmails.")
}
if (-not [bool]$ConfirmMigrationApplied) {
  $BusinessBlockers.Add("No se confirmo migracion aplicada con -ConfirmMigrationApplied.")
}
if (-not [bool]$ConfirmControlledTestApproved) {
  $BusinessBlockers.Add("No se confirmo prueba controlada aprobada con -ConfirmControlledTestApproved.")
}
if (-not [bool]$ConfirmBusinessOpen) {
  $BusinessBlockers.Add("No se confirmo apertura de negocio con -ConfirmBusinessOpen.")
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

$ProjectId = if ($Backend) { [string]$Backend.project_id } else { "" }
$Region = if ($Backend) { [string]$Backend.region } else { "" }

Write-GoLiveCommands `
  -Path $CommandsPath `
  -ProjectId $ProjectId `
  -Region $Region `
  -RunId $RunId `
  -DispatchUrl $DispatchUrl `
  -TicketingUrl $TicketingUrl `
  -DocumentUrl $DocumentUrl `
  -ReportingUrl $ReportingUrl `
  -AuditUrl $AuditUrl `
  -ShellUrl $ShellUrl

Write-IncidentRegister -Path $ResolvedIncidentRegisterPath -RunId $RunId
Write-GoLiveAct -Path $ResolvedGoLiveActPath -RunId $RunId -CommandPath $CommandsPath -OperatorEmails $OperatorEmails -SupervisorEmails $SupervisorEmails

$ReadyForGoLivePackage = $TechnicalBlockers.Count -eq 0
$ReadyForRealGoLive = $ReadyForGoLivePackage -and $BusinessBlockers.Count -eq 0
$GoLiveMonitoringEvidencePath = Join-Path $ResolvedOutputDir "dia79-go-live-monitoring-evidence.json"
$GoLiveMonitoringEvidenceExists = Test-Path -LiteralPath $GoLiveMonitoringEvidencePath

if ([bool]$RecordGoLiveStarted -and -not $GoLiveMonitoringEvidenceExists) {
  $BusinessBlockers.Add("No existe evidencia de monitoreo de puesta en marcha: $GoLiveMonitoringEvidencePath")
}

$GoLiveStarted = [bool]$RecordGoLiveStarted -and $ReadyForRealGoLive -and $GoLiveMonitoringEvidenceExists

if (-not $ReadyForRealGoLive) {
  $Warnings.Add("Puesta en marcha real bloqueada hasta cerrar precondiciones y aprobaciones.")
}

$Result = [pscustomobject]@{
  generated_at = (Get-Date).ToString("o")
  run_id = $RunId
  ready_for_go_live_package = $ReadyForGoLivePackage
  ready_for_real_go_live = ($ReadyForGoLivePackage -and $BusinessBlockers.Count -eq 0)
  go_live_started = $GoLiveStarted
  project_id = $ProjectId
  region = $Region
  operator_emails = @($OperatorEmails)
  supervisor_emails = @($SupervisorEmails)
  paths = [pscustomobject]@{
    commands = $CommandsPath
    result = $ResultPath
    incident_register = $ResolvedIncidentRegisterPath
    act = $ResolvedGoLiveActPath
    monitoring_evidence = $GoLiveMonitoringEvidencePath
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
Write-Host "Comandos go-live: $CommandsPath"
Write-Host "Acta: $ResolvedGoLiveActPath"
Write-Host "Registro incidencias: $ResolvedIncidentRegisterPath"
Write-Host "Paquete de puesta en marcha listo: $ReadyForGoLivePackage"
Write-Host "Puesta en marcha real autorizada: $($ReadyForGoLivePackage -and $BusinessBlockers.Count -eq 0)"
Write-Host "Operacion real iniciada: $GoLiveStarted"

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
  throw "La puesta en marcha tiene bloqueos."
}
