[CmdletBinding()]
param(
  [string]$Root
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($Root)) {
  $ScriptRoot = if (-not [string]::IsNullOrWhiteSpace($PSScriptRoot)) {
    $PSScriptRoot
  } else {
    Split-Path -Parent $MyInvocation.MyCommand.Path
  }

  $Root = (Resolve-Path (Join-Path $ScriptRoot "..")).Path
}

function Read-JsonFile {
  param([Parameter(Mandatory = $true)][string]$RelativePath)

  $Path = Join-Path $Root $RelativePath
  if (-not (Test-Path -LiteralPath $Path)) {
    throw "No existe la evidencia requerida: $RelativePath"
  }

  return Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json
}

function Add-UniqueText {
  param(
    [Parameter(Mandatory = $true)]$List,
    [string]$Value
  )

  if ([string]::IsNullOrWhiteSpace($Value)) {
    return
  }

  if (-not $List.Contains($Value)) {
    [void]$List.Add($Value)
  }
}

function Add-UniqueTexts {
  param(
    [Parameter(Mandatory = $true)]$List,
    $Values
  )

  if ($null -eq $Values) {
    return
  }

  foreach ($Value in @($Values)) {
    Add-UniqueText -List $List -Value ([string]$Value)
  }
}

function Format-BooleanStatus {
  param([bool]$Value)

  if ($Value) {
    return "OK"
  }

  return "PENDIENTE"
}

function Escape-Md {
  param([string]$Value)

  if ($null -eq $Value) {
    return ""
  }

  return ($Value -replace "\|", "\|")
}

function New-Check {
  param(
    [string]$Area,
    [bool]$Ready,
    [string]$Detail,
    [string]$Evidence
  )

  return [pscustomobject]@{
    area = $Area
    ready = $Ready
    status = Format-BooleanStatus -Value $Ready
    detail = $Detail
    evidence = $Evidence
  }
}

$DocsDir = Join-Path $Root "docs"
$LogDir = Join-Path $Root "logs\project-closure"
New-Item -ItemType Directory -Force -Path $DocsDir, $LogDir | Out-Null

$ProdInfra = Read-JsonFile "logs\prod-infra\verify-prod-infra.json"
$ProdBackends = Read-JsonFile "logs\cloudrun-prod\verify-cloudrun-prod-backends.json"
$ProdFrontends = Read-JsonFile "logs\cloudrun-prod\verify-cloudrun-prod-frontends.json"
$Restore = Read-JsonFile "logs\production-restore-test\dia86-production-restore-readiness.json"
$Security = Read-JsonFile "logs\final-security\dia87-final-security-readiness.json"
$TechnicalDocs = Read-JsonFile "logs\technical-documentation\dia84-technical-documentation-readiness.json"
$OperationalDocs = Read-JsonFile "logs\operational-documentation\dia85-operational-documentation-readiness.json"
$FutureBacklog = Read-JsonFile "logs\future-modules-backlog\dia89-future-modules-backlog-readiness.json"
$Migration = Read-JsonFile "logs\migration\dia77-final-prod\final-data-migration-prod-readiness.json"
$ControlledTest = Read-JsonFile "logs\prod-controlled-test\dia78-controlled-prod-test-readiness.json"
$GoLive = Read-JsonFile "logs\go-live\dia79-go-live-readiness.json"
$PostStartDay1 = Read-JsonFile "logs\post-start-day1\dia80-post-start-day1-readiness.json"

$BackendReady = [bool]$ProdBackends.ready -and
  ([int]$ProdBackends.summary.services_ready -eq [int]$ProdBackends.summary.services_total) -and
  ([int]$ProdBackends.summary.smoke_tests_passed -eq [int]$ProdBackends.summary.services_total)

$FrontendReady = ([int]$ProdFrontends.summary.services_ready -eq [int]$ProdFrontends.summary.services_total) -and
  ([int]$ProdFrontends.summary.checks_failed -eq 0)

$InfraReady = [bool]$ProdInfra.ready
$RestoreReady = [bool]$Restore.criteria_met
$SecurityReady = [bool]$Security.ready_for_security_close -and ([int]$Security.critical_risk_count -eq 0)
$TechnicalDocsReady = [bool]$TechnicalDocs.ready_for_technical_documentation
$OperationalDocsReady = [bool]$OperationalDocs.ready_for_operational_documentation
$BacklogReady = [bool]$FutureBacklog.ready_for_future_backlog

$FinalMigrationExecuted = [bool]$Migration.production_migration_executed
$DataApproved = [bool]$Migration.data_validation_approved
$ControlledTestExecuted = [bool]$ControlledTest.real_test_executed
$GoLiveStarted = [bool]$GoLive.go_live_started
$SupportReviewExecuted = [bool]$PostStartDay1.support_review_executed

$PlatformFunctioningInGoogleCloud = $InfraReady -and $BackendReady -and $FrontendReady
$TechnicalPlatformReady = $PlatformFunctioningInGoogleCloud -and $RestoreReady -and $SecurityReady -and $TechnicalDocsReady -and $OperationalDocsReady -and $BacklogReady
$BusinessOperationalReady = $FinalMigrationExecuted -and $DataApproved -and $ControlledTestExecuted -and $GoLiveStarted -and $SupportReviewExecuted
$FullOperational = $TechnicalPlatformReady -and $BusinessOperationalReady

$ClosureStatus = if ($FullOperational) {
  "Cierre funcional y tecnico aprobado"
} else {
  "Cierre tecnico/documental condicionado"
}

$PendingBlockers = [System.Collections.Generic.List[string]]::new()
Add-UniqueTexts -List $PendingBlockers -Values $Migration.production_execution_blockers
Add-UniqueTexts -List $PendingBlockers -Values $ControlledTest.execution_blockers
Add-UniqueTexts -List $PendingBlockers -Values $GoLive.business_blockers
Add-UniqueTexts -List $PendingBlockers -Values $PostStartDay1.business_blockers
if (-not $FinalMigrationExecuted) {
  Add-UniqueText -List $PendingBlockers -Value "Ejecutar la migracion final de datos en produccion."
}
if (-not $DataApproved) {
  Add-UniqueText -List $PendingBlockers -Value "Aprobar los datos productivos migrados."
}
if (-not $ControlledTestExecuted) {
  Add-UniqueText -List $PendingBlockers -Value "Ejecutar y aprobar la prueba productiva controlada."
}
if (-not $GoLiveStarted) {
  Add-UniqueText -List $PendingBlockers -Value "Confirmar la apertura real de negocio y puesta en marcha."
}
if (-not $SupportReviewExecuted) {
  Add-UniqueText -List $PendingBlockers -Value "Ejecutar soporte post-arranque con operacion real."
}

$Checks = @(
  New-Check -Area "Infraestructura prod" -Ready $InfraReady -Detail "Cloud SQL RUNNABLE, backups, bucket, secretos y Pub/Sub listos." -Evidence "logs\prod-infra\verify-prod-infra.json"
  New-Check -Area "Backends Cloud Run prod" -Ready $BackendReady -Detail "$($ProdBackends.summary.services_ready)/$($ProdBackends.summary.services_total) servicios listos; $($ProdBackends.summary.smoke_tests_passed) smoke tests OK." -Evidence "logs\cloudrun-prod\verify-cloudrun-prod-backends.json"
  New-Check -Area "Frontends Cloud Run prod" -Ready $FrontendReady -Detail "$($ProdFrontends.summary.services_ready)/$($ProdFrontends.summary.services_total) servicios listos; $($ProdFrontends.summary.checks_failed) checks fallidos." -Evidence "logs\cloudrun-prod\verify-cloudrun-prod-frontends.json"
  New-Check -Area "Restauracion produccion" -Ready $RestoreReady -Detail "RTO $($Restore.measured_prod_rto_minutes) min; RPO $($Restore.measured_rpo_hours) h." -Evidence "logs\production-restore-test\dia86-production-restore-readiness.json"
  New-Check -Area "Seguridad final" -Ready $SecurityReady -Detail "$($Security.critical_risk_count) riesgos criticos abiertos." -Evidence "logs\final-security\dia87-final-security-readiness.json"
  New-Check -Area "Documentacion tecnica" -Ready $TechnicalDocsReady -Detail "Manual tecnico y diagramas finales generados." -Evidence "docs\manual-tecnico.md"
  New-Check -Area "Documentacion operativa" -Ready $OperationalDocsReady -Detail "Manual operativo y guia rapida generados." -Evidence "docs\manual-operativo-final.md"
  New-Check -Area "Backlog evolucion" -Ready $BacklogReady -Detail "$($FutureBacklog.modules_prioritized) modulos priorizados." -Evidence "docs\backlog-futuro-priorizado.md"
  New-Check -Area "Migracion final prod" -Ready ($FinalMigrationExecuted -and $DataApproved) -Detail "Ejecutada=$FinalMigrationExecuted; datos_aprobados=$DataApproved." -Evidence "logs\migration\dia77-final-prod\final-data-migration-prod-readiness.json"
  New-Check -Area "Prueba controlada prod" -Ready $ControlledTestExecuted -Detail "Ejecutada=$ControlledTestExecuted." -Evidence "logs\prod-controlled-test\dia78-controlled-prod-test-readiness.json"
  New-Check -Area "Puesta en marcha real" -Ready $GoLiveStarted -Detail "Iniciada=$GoLiveStarted." -Evidence "logs\go-live\dia79-go-live-readiness.json"
  New-Check -Area "Soporte post-arranque" -Ready $SupportReviewExecuted -Detail "Revision ejecutada=$SupportReviewExecuted." -Evidence "logs\post-start-day1\dia80-post-start-day1-readiness.json"
)

$GeneratedAt = (Get-Date).ToString("o")
$ActPath = Join-Path $DocsDir "acta-cierre-proyecto.md"
$PlatformPath = Join-Path $DocsDir "plataforma-funcionando-google-cloud.md"
$EvolutionBacklogPath = Join-Path $DocsDir "backlog-evolucion.md"
$ResultPath = Join-Path $LogDir "dia90-project-closure-readiness.json"
$InventoryPath = Join-Path $LogDir "dia90-project-closure-inventory.json"

$CheckRows = ($Checks | ForEach-Object {
  "| $(Escape-Md $_.area) | $($_.status) | $(Escape-Md $_.detail) | $(Escape-Md $_.evidence) |"
}) -join [Environment]::NewLine

$BackendRows = ($ProdBackends.services | ForEach-Object {
  "| $(Escape-Md $_.service_id) | $(Escape-Md $_.service_name) | $(Format-BooleanStatus -Value ([bool]$_.ready)) | $(Escape-Md $_.url) | $($_.health_status) |"
}) -join [Environment]::NewLine

$FrontendRows = ($ProdFrontends.services | ForEach-Object {
  "| $(Escape-Md $_.service_id) | $(Escape-Md $_.service_name) | $(Format-BooleanStatus -Value ([bool]$_.ready)) | $(Escape-Md $_.url) |"
}) -join [Environment]::NewLine

$PendingRows = if ($PendingBlockers.Count -gt 0) {
  ($PendingBlockers | ForEach-Object { "- $_" }) -join [Environment]::NewLine
} else {
  "- Sin pendientes bloqueantes."
}

$ModuleRows = ($FutureBacklog.modules | ForEach-Object {
  "| P$($_.priority) | $(Escape-Md $_.module) | $(Escape-Md $_.backend) | $(Escape-Md $_.frontend) | $(Escape-Md $_.effort_size) | $(Escape-Md $_.estimated_calendar_weeks) | $($_.estimated_person_weeks) |"
}) -join [Environment]::NewLine

$DecisionText = if ($FullOperational) {
  "Se aprueba el cierre funcional y tecnico porque la plataforma tecnica esta lista y la operacion real esta confirmada."
} else {
  "Se deja aprobado el cierre tecnico/documental condicionado. La plataforma tecnica esta funcionando en Google Cloud, pero el cierre funcional 100% queda pendiente hasta ejecutar y aprobar migracion final, prueba controlada, puesta en marcha y soporte post-arranque real."
}

$CriterionText = if ($FullOperational) {
  "Cumplido: el sistema queda operativo al 100% en Google Cloud."
} else {
  "No cumplido todavia: Google Cloud esta funcionando, pero la operacion de negocio al 100% sigue pendiente por bloqueos de aprobacion y ejecucion real."
}

$ActContent = @"
# Acta de cierre del proyecto

Generado: $GeneratedAt

Estado de cierre: $ClosureStatus

## Decision

$DecisionText

## Criterio del Dia 90

$CriterionText

## Resumen de verificacion

| Area | Estado | Detalle | Evidencia |
|---|---|---|---|
$CheckRows

## Pendientes para cierre funcional al 100%

$PendingRows

## Entregables entregados

- Plataforma funcionando en Google Cloud: docs\plataforma-funcionando-google-cloud.md
- Backlog de evolucion: docs\backlog-evolucion.md
- Manual tecnico: docs\manual-tecnico.md
- Manual operativo: docs\manual-operativo-final.md
- Informe de seguridad final: docs\informe-seguridad-final.md
- Procedimiento de restauracion: docs\procedimiento-restauracion-produccion.md

## Accesos administrados

Los accesos de ejecucion productiva estan representados por service accounts separadas por servicio y ambiente. La evidencia consolidada se encuentra en logs\final-security\dia87-final-security-readiness.json y logs\prod-infra\verify-prod-infra.json.

## Firma de cierre

| Rol | Nombre | Decision | Fecha | Firma |
|---|---|---|---|---|
| Responsable tecnico |  |  |  |  |
| Responsable funcional |  |  |  |  |
| Responsable operativo |  |  |  |  |
| Sponsor del proyecto |  |  |  |  |

## Nota de control

No firmar cierre funcional total mientras el campo full_100_percent_operational de logs\project-closure\dia90-project-closure-readiness.json sea false.
"@

Set-Content -LiteralPath $ActPath -Value $ActContent -Encoding UTF8

$PlatformContent = @"
# Plataforma funcionando en Google Cloud

Generado: $GeneratedAt

Esta evidencia confirma la plataforma tecnica desplegada y saludable en Google Cloud. No reemplaza la aprobacion de negocio de migracion final, prueba productiva controlada ni puesta en marcha real.

## Estado ejecutivo

| Indicador | Estado |
|---|---|
| Infraestructura prod | $(Format-BooleanStatus -Value $InfraReady) |
| Backends prod Cloud Run | $(Format-BooleanStatus -Value $BackendReady) |
| Frontends prod Cloud Run | $(Format-BooleanStatus -Value $FrontendReady) |
| Plataforma tecnica funcionando en Google Cloud | $(Format-BooleanStatus -Value $PlatformFunctioningInGoogleCloud) |
| Plataforma tecnica lista | $(Format-BooleanStatus -Value $TechnicalPlatformReady) |
| Operacion funcional 100% | $(Format-BooleanStatus -Value $FullOperational) |

## Backends productivos

| Servicio | Cloud Run | Estado | URL | Health |
|---|---|---|---|---|
$BackendRows

## Frontends productivos

| MFE | Cloud Run | Estado | URL |
|---|---|---|---|
$FrontendRows

## Evidencia de resiliencia y seguridad

- Cloud SQL prod: $($ProdInfra.cloud_sql.instance_name), estado $($ProdInfra.cloud_sql.state), backups activos $($ProdInfra.cloud_sql.backup_enabled).
- Bucket documental prod: $($ProdInfra.storage.document_bucket_name), acceso publico prevenido $($ProdInfra.storage.public_access_prevention).
- Restauracion controlada: RTO $($Restore.measured_prod_rto_minutes) minutos, RPO $($Restore.measured_rpo_hours) horas.
- Seguridad final: $($Security.critical_risk_count) riesgos criticos abiertos.
- Smoke tests backend: $($ProdBackends.summary.smoke_tests_passed)/$($ProdBackends.summary.services_total).
- Checks frontend: $($ProdFrontends.summary.checks_passed)/$($ProdFrontends.summary.checks_total).

## Lectura correcta

La plataforma tecnica ya esta funcionando en Google Cloud. Para declarar operacion funcional al 100%, primero deben cerrarse los pendientes listados en docs\acta-cierre-proyecto.md.
"@

Set-Content -LiteralPath $PlatformPath -Value $PlatformContent -Encoding UTF8

$EvolutionBacklogContent = @"
# Backlog de evolucion

Generado: $GeneratedAt

Este backlog resume la evolucion recomendada despues del cierre tecnico/documental. La fuente detallada es docs\backlog-futuro-priorizado.md y docs\estimaciones-modulos-futuros.md.

## Orden recomendado

| Prioridad | Modulo | Backend sugerido | MFE sugerido | Tamano | Semanas calendario | Persona-semanas |
|---|---|---|---|---|---|---|
$ModuleRows

## Reglas para iniciar un modulo nuevo

- Confirmar alcance MVP y reglas de negocio antes de crear codigo.
- Crear base propia por microservicio y evitar dependencias directas entre bases.
- Usar las plantillas de templates\quarkus-service y templates\next-mfe.
- Agregar eventos, auditoria, health checks, OpenAPI, pruebas y documentacion desde el primer dia.
- No mezclar pendientes de estabilizacion productiva con alcance de evolucion.

## Primer siguiente modulo sugerido

Facturacion electronica queda como prioridad 1 por impacto regulatorio y administrativo. Antes de construirlo se debe validar normativa vigente, flujo de autorizacion, contingencia, certificados, anulaciones y conservacion documental.
"@

Set-Content -LiteralPath $EvolutionBacklogPath -Value $EvolutionBacklogContent -Encoding UTF8

$Result = [ordered]@{
  generated_at = $GeneratedAt
  day = 90
  objective = "Cierre del proyecto"
  closure_status = $ClosureStatus
  platform_functioning_in_google_cloud = $PlatformFunctioningInGoogleCloud
  technical_platform_ready = $TechnicalPlatformReady
  business_operational_ready = $BusinessOperationalReady
  full_100_percent_operational = $FullOperational
  criterion_100_percent_operational_met = $FullOperational
  criterion_note = $CriterionText
  checks = $Checks
  pending_blockers = $PendingBlockers.ToArray()
  metrics = [ordered]@{
    backend_services_ready = [int]$ProdBackends.summary.services_ready
    backend_services_total = [int]$ProdBackends.summary.services_total
    backend_smoke_tests_passed = [int]$ProdBackends.summary.smoke_tests_passed
    frontend_services_ready = [int]$ProdFrontends.summary.services_ready
    frontend_services_total = [int]$ProdFrontends.summary.services_total
    frontend_checks_passed = [int]$ProdFrontends.summary.checks_passed
    frontend_checks_total = [int]$ProdFrontends.summary.checks_total
    restore_rto_minutes = [double]$Restore.measured_prod_rto_minutes
    restore_rpo_hours = [double]$Restore.measured_rpo_hours
    critical_security_risks = [int]$Security.critical_risk_count
    future_modules_prioritized = [int]$FutureBacklog.modules_prioritized
  }
  deliverables = [ordered]@{
    closure_act = $ActPath
    platform_evidence = $PlatformPath
    evolution_backlog = $EvolutionBacklogPath
    result = $ResultPath
    inventory = $InventoryPath
  }
}

$Result | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $ResultPath -Encoding UTF8

$SourceFiles = @(
  "logs\prod-infra\verify-prod-infra.json",
  "logs\cloudrun-prod\verify-cloudrun-prod-backends.json",
  "logs\cloudrun-prod\verify-cloudrun-prod-frontends.json",
  "logs\production-restore-test\dia86-production-restore-readiness.json",
  "logs\final-security\dia87-final-security-readiness.json",
  "logs\technical-documentation\dia84-technical-documentation-readiness.json",
  "logs\operational-documentation\dia85-operational-documentation-readiness.json",
  "logs\future-modules-backlog\dia89-future-modules-backlog-readiness.json",
  "logs\migration\dia77-final-prod\final-data-migration-prod-readiness.json",
  "logs\prod-controlled-test\dia78-controlled-prod-test-readiness.json",
  "logs\go-live\dia79-go-live-readiness.json",
  "logs\post-start-day1\dia80-post-start-day1-readiness.json",
  "docs\manual-tecnico.md",
  "docs\manual-operativo-final.md",
  "docs\backlog-futuro-priorizado.md",
  "docs\informe-seguridad-final.md"
)

$GeneratedFiles = @(
  "docs\acta-cierre-proyecto.md",
  "docs\plataforma-funcionando-google-cloud.md",
  "docs\backlog-evolucion.md",
  "logs\project-closure\dia90-project-closure-readiness.json",
  "logs\project-closure\dia90-project-closure-inventory.json"
)

$Inventory = [ordered]@{
  generated_at = $GeneratedAt
  source_files = $SourceFiles | ForEach-Object {
    [pscustomobject]@{
      path = $_
      exists = Test-Path -LiteralPath (Join-Path $Root $_)
    }
  }
  generated_files = $GeneratedFiles | ForEach-Object {
    [pscustomobject]@{
      path = $_
      exists = Test-Path -LiteralPath (Join-Path $Root $_)
    }
  }
  backend_services = $ProdBackends.services | Select-Object service_id, service_name, ready, url, private_only, health_status
  frontend_services = $ProdFrontends.services | Select-Object service_id, service_name, ready, url
}

$Inventory | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $InventoryPath -Encoding UTF8

Write-Host "Cierre tecnico/documental listo: $TechnicalPlatformReady"
Write-Host "Plataforma funcionando en Google Cloud: $PlatformFunctioningInGoogleCloud"
Write-Host "Operacion funcional 100%: $FullOperational"
Write-Host "Estado de cierre: $ClosureStatus"
Write-Host "Pendientes bloqueantes: $($PendingBlockers.Count)"
Write-Host "Acta: $ActPath"
Write-Host "Evidencia plataforma: $PlatformPath"
Write-Host "Backlog evolucion: $EvolutionBacklogPath"
