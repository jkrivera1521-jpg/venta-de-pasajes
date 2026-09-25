param(
  [string]$OutputDir = "logs\prod-controlled-test",
  [string]$ProdBackendEvidencePath = "logs\cloudrun-prod\verify-cloudrun-prod-backends.json",
  [string]$ProdFrontendEvidencePath = "logs\cloudrun-prod\verify-cloudrun-prod-frontends.json",
  [string]$FinalMigrationEvidencePath = "logs\migration\dia77-final-prod\final-data-migration-prod-readiness.json",
  [string]$ProdBackendConfigPath = "infra\cloudrun\prod-backend-services.json",
  [string]$ActPath = "docs\acta-prueba-productiva-controlada.md",
  [switch]$ConfirmMigrationApplied,
  [switch]$ConfirmBusinessGoNoGo,
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

function Write-ControlledTestCommands {
  param(
    [string]$Path,
    [string]$ProjectId,
    [string]$RunId,
    [string]$Marker,
    [string]$ActorUserId,
    [string]$TestDate,
    [string]$TestDepartureAt,
    [string]$DispatchUrl,
    [string]$TicketingUrl,
    [string]$DocumentUrl,
    [string]$ReportingUrl,
    [string]$AuditUrl,
    [string]$ShellUrl
  )

  $Lines = @(
    "# Dia 78 - prueba productiva controlada",
    "# Ejecutar solo despues de migracion final aprobada, GO/NO-GO de negocio y backup productivo.",
    "# Este archivo SI modifica produccion si se ejecuta.",
    "",
    '$ProjectId = "' + $ProjectId + '"',
    '$RunId = "' + $RunId + '"',
    '$Marker = "' + $Marker + '"',
    '$ActorUserId = "' + $ActorUserId + '"',
    '$TestDate = "' + $TestDate + '"',
    '$TestDepartureAt = "' + $TestDepartureAt + '"',
    '$DispatchUrl = "' + $DispatchUrl + '"',
    '$TicketingUrl = "' + $TicketingUrl + '"',
    '$DocumentUrl = "' + $DocumentUrl + '"',
    '$ReportingUrl = "' + $ReportingUrl + '"',
    '$AuditUrl = "' + $AuditUrl + '"',
    '$ShellUrl = "' + $ShellUrl + '"',
    '$OutputDir = "logs\prod-controlled-test"',
    'New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null',
    "",
    '$Token = gcloud auth print-identity-token',
    '$Headers = @{',
    '  Authorization = "Bearer $Token"',
    '  "Content-Type" = "application/json"',
    '  "X-Actor-User-Id" = $ActorUserId',
    '  "X-Correlation-Id" = [guid]::NewGuid().ToString()',
    '}',
    "",
    'curl.exe -s "$ShellUrl/api/health"',
    'Invoke-RestMethod -Method GET -Uri "$DispatchUrl/api/v1/dispatch/health" -Headers $Headers',
    'Invoke-RestMethod -Method GET -Uri "$TicketingUrl/api/v1/ticketing/health" -Headers $Headers',
    'Invoke-RestMethod -Method GET -Uri "$DocumentUrl/api/v1/document/health" -Headers $Headers',
    'Invoke-RestMethod -Method GET -Uri "$ReportingUrl/api/v1/reporting/health" -Headers $Headers',
    'Invoke-RestMethod -Method GET -Uri "$AuditUrl/api/v1/audit/health" -Headers $Headers',
    "",
    '$BusPage = Invoke-RestMethod -Method GET -Uri "$DispatchUrl/api/v1/dispatch/buses?page=1&page_size=1&active=true" -Headers $Headers',
    '$RoutePage = Invoke-RestMethod -Method GET -Uri "$DispatchUrl/api/v1/dispatch/routes?page=1&page_size=1&active=true" -Headers $Headers',
    '$Bus = @($BusPage.data)[0]',
    '$Route = @($RoutePage.data)[0]',
    'if (-not $Bus) { throw "No existe bus activo para prueba controlada." }',
    'if (-not $Route) { throw "No existe ruta activa para prueba controlada." }',
    "",
    '$DeparturePayload = @{',
    '  legacy_id = $null',
    '  bus_id = $Bus.id',
    '  route_id = $Route.id',
    '  departure_at = $TestDepartureAt',
    '  notes = "DIA78 prueba productiva controlada $Marker"',
    '} | ConvertTo-Json -Depth 8',
    '$Departure = Invoke-RestMethod -Method POST -Uri "$DispatchUrl/api/v1/dispatch/departures" -Headers $Headers -Body $DeparturePayload',
    '$Departure | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath "$OutputDir\dia78-departure-created.json" -Encoding UTF8',
    "",
    '$SeatCount = [int]$Bus.seat_count',
    '$Seats = 1..$SeatCount | ForEach-Object { @{ seat_number = [string]$_; status = "AVAILABLE" } }',
    '$SyncPayload = @{',
    '  dispatch_departure_id = $Departure.id',
    '  legacy_id = $null',
    '  bus_id = $Departure.bus_id',
    '  bus_code = $Departure.bus_code',
    '  bus_plate = $Departure.bus_plate',
    '  route_id = $Departure.route_id',
    '  route_name = $Departure.route_name',
    '  origin_terminal_id = $Departure.origin_terminal_id',
    '  origin_terminal_name = $Departure.origin_terminal_name',
    '  destination_terminal_id = $Departure.destination_terminal_id',
    '  destination_terminal_name = $Departure.destination_terminal_name',
    '  departure_at = $Departure.departure_at',
    '  status = "SCHEDULED"',
    '  seat_count = $SeatCount',
    '  seats = $Seats',
    '  source_updated_at = (Get-Date).ToString("o")',
    '} | ConvertTo-Json -Depth 12',
    '$SeatMap = Invoke-RestMethod -Method POST -Uri "$TicketingUrl/api/v1/ticketing/availability/sync/departures" -Headers $Headers -Body $SyncPayload',
    '$SeatMap | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath "$OutputDir\dia78-seatmap-synced.json" -Encoding UTF8',
    "",
    '$TicketPayload = @{',
    '  reservation_id = $null',
    '  dispatch_departure_id = $Departure.id',
    '  seat_number = "1"',
    '  fare_amount = 1.00',
    '  currency = "USD"',
    '  passenger = @{',
    '    document_type = "CEDULA"',
    '    document_number = "9999999901"',
    '    first_name = "Prueba"',
    '    last_name = "Controlada"',
    '    email = "dia78.controlada@example.com"',
    '    phone = "0999999999"',
    '  }',
    '} | ConvertTo-Json -Depth 12',
    '$Ticket = Invoke-RestMethod -Method POST -Uri "$TicketingUrl/api/v1/ticketing/tickets" -Headers $Headers -Body $TicketPayload',
    '$Ticket | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath "$OutputDir\dia78-ticket-issued.json" -Encoding UTF8',
    "",
    '$DocumentPayload = @{',
    '  template_code = "TICKET_DEFAULT"',
    '  requested_by_user_id = $ActorUserId',
    '  correlation_id = [guid]::NewGuid().ToString()',
    '  ticket = @{',
    '    ticket_number = $Ticket.ticket_number',
    '    passenger_name = "Prueba Controlada"',
    '    document_type = "CEDULA"',
    '    document_number = "9999999901"',
    '    price = $Ticket.fare_amount',
    '    currency = $Ticket.currency',
    '    bus_code = $Departure.bus_code',
    '    bus_type = "CONTROLADO"',
    '    origin = $Departure.origin_terminal_name',
    '    destination = $Departure.destination_terminal_name',
    '    departure_at = $Departure.departure_at',
    '    seat_number = $Ticket.seat_number',
    '    seat_position = "WINDOW"',
    '    sold_at = $Ticket.issued_at',
    '  }',
    '} | ConvertTo-Json -Depth 12',
    '$Document = Invoke-RestMethod -Method POST -Uri "$DocumentUrl/api/v1/document/documents/tickets/$($Ticket.ticket_id)" -Headers $Headers -Body $DocumentPayload',
    '$Document | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath "$OutputDir\dia78-document-generated.json" -Encoding UTF8',
    'Invoke-WebRequest -Method GET -Uri "$DocumentUrl/api/v1/document/documents/$($Document.document_id)/download" -Headers $Headers -OutFile "$OutputDir\dia78-ticket.pdf"',
    "",
    '$CancelPayload = @{',
    '  reason = "DIA78 prueba productiva controlada $Marker"',
    '  cancelled_by = $ActorUserId',
    '  release_seat = $true',
    '} | ConvertTo-Json -Depth 6',
    '$CancelledTicket = Invoke-RestMethod -Method POST -Uri "$TicketingUrl/api/v1/ticketing/tickets/$($Ticket.ticket_id)/cancel" -Headers $Headers -Body $CancelPayload',
    '$CancelledTicket | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath "$OutputDir\dia78-ticket-cancelled.json" -Encoding UTF8',
    "",
    '$SalesReport = Invoke-RestMethod -Method GET -Uri "$ReportingUrl/api/v1/reporting/reports/sales?date_from=$TestDate&date_to=$TestDate" -Headers $Headers',
    '$PassengerReport = Invoke-RestMethod -Method GET -Uri "$ReportingUrl/api/v1/reporting/reports/passengers?date_from=$TestDate&date_to=$TestDate&q=Controlada" -Headers $Headers',
    '$SalesReport | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath "$OutputDir\dia78-report-sales.json" -Encoding UTF8',
    '$PassengerReport | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath "$OutputDir\dia78-report-passengers.json" -Encoding UTF8',
    "",
    '$AuditEvents = Invoke-RestMethod -Method GET -Uri "$AuditUrl/api/v1/audit/audit-events?page=1&page_size=20" -Headers $Headers',
    '$AuditEvents | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath "$OutputDir\dia78-audit-events.json" -Encoding UTF8',
    'gcloud logging read "resource.type=cloud_run_revision" --project $ProjectId --limit 50 > "$OutputDir\dia78-cloudrun-logs.txt"',
    "",
    '$DepartureCancelPayload = @{ reason = "Cierre DIA78 prueba productiva controlada $Marker" } | ConvertTo-Json -Depth 4',
    '$CancelledDeparture = Invoke-RestMethod -Method POST -Uri "$DispatchUrl/api/v1/dispatch/departures/$($Departure.id)/cancel" -Headers $Headers -Body $DepartureCancelPayload',
    '$CancelledDeparture | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath "$OutputDir\dia78-departure-cancelled.json" -Encoding UTF8',
    "",
    '$Evidence = @{',
    '  generated_at = (Get-Date).ToString("o")',
    '  run_id = $RunId',
    '  marker = $Marker',
    '  departure_id = $Departure.id',
    '  ticket_id = $Ticket.ticket_id',
    '  ticket_number = $Ticket.ticket_number',
    '  document_id = $Document.document_id',
    '  ticket_status_after_cancel = $CancelledTicket.status',
    '  departure_status_after_cancel = $CancelledDeparture.status',
    '  files = Get-ChildItem -LiteralPath $OutputDir -File | Select-Object Name, Length',
    '}',
    '$Evidence | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath "$OutputDir\dia78-real-execution-evidence.json" -Encoding UTF8'
  )

  Set-Content -LiteralPath $Path -Value $Lines -Encoding UTF8
}

function Write-ControlledTestActDraft {
  param(
    [string]$Path,
    [string]$RunId,
    [string]$Marker,
    [string]$CommandPath
  )

  $Lines = @(
    "# Acta de prueba productiva controlada",
    "",
    "Fecha base: 2026-09-25",
    "",
    "Estado: PENDIENTE_EJECUCION_PRODUCTIVA_Y_FIRMA",
    "",
    "Run ID: $RunId",
    "",
    "Marcador: $Marker",
    "",
    "## Objetivo",
    "",
    "Validar que produccion funciona antes de abrir al uso general.",
    "",
    "## Comando preparado",
    "",
    '```text',
    $CommandPath,
    '```',
    "",
    "## Checklist",
    "",
    "| Paso | Resultado esperado | Estado | Evidencia |",
    "| --- | --- | --- | --- |",
    "| Crear salida controlada | Salida creada con marcador DIA78 | Pendiente | Pendiente |",
    "| Vender boleto de prueba | Boleto emitido | Pendiente | Pendiente |",
    "| Generar PDF | PDF descargable generado | Pendiente | Pendiente |",
    "| Anular boleto | Boleto anulado y asiento liberado | Pendiente | Pendiente |",
    "| Revisar reportes | Reportes consultados | Pendiente | Pendiente |",
    "| Revisar logs | Logs revisados sin errores criticos | Pendiente | Pendiente |",
    "| Cancelar salida controlada | Salida controlada cancelada | Pendiente | Pendiente |",
    "",
    "## Firmas",
    "",
    "| Rol | Nombre | Decision | Firma | Fecha |",
    "| --- | --- | --- | --- | --- |",
    "| Responsable negocio | <nombre> | Pendiente | <firma> | <fecha> |",
    "| Responsable boleteria | <nombre> | Pendiente | <firma> | <fecha> |",
    "| Responsable tecnico | <nombre> | Pendiente | <firma> | <fecha> |",
    "",
    "## Cierre",
    "",
    '```text',
    "PENDIENTE",
    '```'
  )

  Set-Content -LiteralPath $Path -Value $Lines -Encoding UTF8
}

$RunId = Get-Date -Format "yyyyMMdd-HHmmss"
$Marker = "DIA78-CONTROLLED-$RunId"
$ActorUserId = "00000000-0000-0000-0000-000000000078"
$TestDate = (Get-Date).Date.AddDays(4).ToString("yyyy-MM-dd")
$TestDepartureAt = (Get-Date).Date.AddDays(4).AddHours(10).AddMinutes(30).ToString("yyyy-MM-ddTHH:mm:ss-05:00")

$ResolvedOutputDir = Resolve-ProjectPath -Path $OutputDir
$ResolvedBackendEvidencePath = Resolve-ProjectPath -Path $ProdBackendEvidencePath
$ResolvedFrontendEvidencePath = Resolve-ProjectPath -Path $ProdFrontendEvidencePath
$ResolvedMigrationEvidencePath = Resolve-ProjectPath -Path $FinalMigrationEvidencePath
$ResolvedBackendConfigPath = Resolve-ProjectPath -Path $ProdBackendConfigPath
$ResolvedActPath = Resolve-ProjectPath -Path $ActPath
$CommandsPath = Join-Path $ResolvedOutputDir "dia78-controlled-prod-test.commands.ps1"
$ResultPath = Join-Path $ResolvedOutputDir "dia78-controlled-prod-test-readiness.json"

New-Item -ItemType Directory -Force -Path $ResolvedOutputDir | Out-Null

$Checks = [System.Collections.Generic.List[object]]::new()
$TechnicalBlockers = [System.Collections.Generic.List[string]]::new()
$ExecutionBlockers = [System.Collections.Generic.List[string]]::new()
$Warnings = [System.Collections.Generic.List[string]]::new()

$RequiredFiles = [ordered]@{
  prod_backends = $ResolvedBackendEvidencePath
  prod_frontends = $ResolvedFrontendEvidencePath
  final_migration = $ResolvedMigrationEvidencePath
  prod_backend_config = $ResolvedBackendConfigPath
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
$BackendConfig = Read-JsonFile -Path $ResolvedBackendConfigPath

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
  $TechnicalBlockers.Add("Frontends productivos no estan listos.")
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
  $ExecutionBlockers.Add("La migracion final a produccion no esta ejecutada.")
}
if (-not $DataApproved) {
  $ExecutionBlockers.Add("Los datos productivos migrados no estan aprobados.")
}
if (-not [bool]$ConfirmMigrationApplied) {
  $ExecutionBlockers.Add("No se confirmo migracion aplicada con -ConfirmMigrationApplied.")
}
if (-not [bool]$ConfirmBusinessGoNoGo) {
  $ExecutionBlockers.Add("No se confirmo GO/NO-GO de negocio con -ConfirmBusinessGoNoGo.")
}

$TicketingProdConfig = @($BackendConfig.services | Where-Object { [string]$_.id -eq "ticketing-service" } | Select-Object -First 1)
$TicketingDocumentIntegration = ""
if ($TicketingProdConfig.Count -gt 0) {
  $TicketingDocumentIntegration = [string]$TicketingProdConfig[0].env.APP_DOCUMENT_INTEGRATION_ENABLED
}
if ($TicketingDocumentIntegration -ne "true") {
  $Warnings.Add("APP_DOCUMENT_INTEGRATION_ENABLED no esta en true para ticketing-service prod. La prueba de PDF se prepara via document-service directo.")
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

Write-ControlledTestCommands `
  -Path $CommandsPath `
  -ProjectId $ProjectId `
  -RunId $RunId `
  -Marker $Marker `
  -ActorUserId $ActorUserId `
  -TestDate $TestDate `
  -TestDepartureAt $TestDepartureAt `
  -DispatchUrl $DispatchUrl `
  -TicketingUrl $TicketingUrl `
  -DocumentUrl $DocumentUrl `
  -ReportingUrl $ReportingUrl `
  -AuditUrl $AuditUrl `
  -ShellUrl $ShellUrl

Write-ControlledTestActDraft -Path $ResolvedActPath -RunId $RunId -Marker $Marker -CommandPath $CommandsPath

$ReadyForControlledTestPackage = $TechnicalBlockers.Count -eq 0
$ReadyForRealControlledTest = $ReadyForControlledTestPackage -and $ExecutionBlockers.Count -eq 0

$Result = [pscustomobject]@{
  generated_at = (Get-Date).ToString("o")
  run_id = $RunId
  marker = $Marker
  ready_for_controlled_test_package = $ReadyForControlledTestPackage
  ready_for_real_controlled_test = $ReadyForRealControlledTest
  real_test_executed = $false
  project_id = $ProjectId
  test_date = $TestDate
  test_departure_at = $TestDepartureAt
  paths = [pscustomobject]@{
    commands = $CommandsPath
    acta = $ResolvedActPath
    result = $ResultPath
  }
  urls = [pscustomobject]$RequiredUrls
  checks = @($Checks)
  technical_blockers = @($TechnicalBlockers)
  execution_blockers = @($ExecutionBlockers)
  warnings = @($Warnings)
}

$Result | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $ResultPath -Encoding UTF8

@($Checks) |
  Select-Object area, name, passed, detail |
  Format-Table -AutoSize

Write-Host "Resultado JSON: $ResultPath"
Write-Host "Comandos prueba controlada: $CommandsPath"
Write-Host "Acta: $ResolvedActPath"
Write-Host "Paquete de prueba listo: $ReadyForControlledTestPackage"
Write-Host "Prueba real autorizada: $ReadyForRealControlledTest"
Write-Host "Prueba real ejecutada: False"

if ($Warnings.Count -gt 0) {
  Write-Host "Advertencias:"
  foreach ($Warning in $Warnings) {
    Write-Host "- $Warning"
  }
}

if ($ExecutionBlockers.Count -gt 0) {
  Write-Host "Bloqueos de ejecucion:"
  foreach ($Blocker in $ExecutionBlockers) {
    Write-Host "- $Blocker"
  }
}

if ($TechnicalBlockers.Count -gt 0) {
  Write-Host "Bloqueos tecnicos:"
  foreach ($Blocker in $TechnicalBlockers) {
    Write-Host "- $Blocker"
  }
}

if ($FailOnBlocker -and ($TechnicalBlockers.Count -gt 0 -or $ExecutionBlockers.Count -gt 0)) {
  throw "La prueba productiva controlada tiene bloqueos."
}
