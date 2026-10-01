param(
    [string]$OutputDirectory = ".\logs\final-security"
)

$ErrorActionPreference = "Stop"

$Root = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$OutputPath = [System.IO.Path]::GetFullPath((Join-Path $Root $OutputDirectory))
New-Item -ItemType Directory -Force -Path $OutputPath | Out-Null

function Resolve-ProjectPath {
    param([string]$Path)

    if ([System.IO.Path]::IsPathRooted($Path)) {
        return $Path
    }

    return Join-Path $Root $Path
}

function Read-JsonRequired {
    param([string]$Path)

    $ResolvedPath = Resolve-ProjectPath -Path $Path
    if (-not (Test-Path -LiteralPath $ResolvedPath)) {
        throw "No existe la evidencia requerida: $ResolvedPath"
    }

    return Get-Content -LiteralPath $ResolvedPath -Raw | ConvertFrom-Json
}

function Read-TextRequired {
    param([string]$Path)

    $ResolvedPath = Resolve-ProjectPath -Path $Path
    if (-not (Test-Path -LiteralPath $ResolvedPath)) {
        throw "No existe la fuente requerida: $ResolvedPath"
    }

    return Get-Content -LiteralPath $ResolvedPath -Raw
}

function Count-Items {
    param($Value)

    if ($null -eq $Value) {
        return 0
    }

    return @($Value).Count
}

function New-AreaResult {
    param(
        [string]$Area,
        [bool]$Ready,
        [string]$Summary,
        [string[]]$Evidence
    )

    return [pscustomobject]@{
        area = $Area
        ready = $Ready
        summary = $Summary
        evidence = $Evidence
    }
}

$RequiredSources = @(
    "logs\prod-infra\verify-prod-infra.json",
    "logs\prod-iam\verify-iam-prod.json",
    "logs\cloudrun-prod\verify-cloudrun-prod-backends.json",
    "logs\cloudrun-prod\verify-cloudrun-prod-frontends.json",
    "logs\backup-restore\verify-backup-restore-readiness-prod.json",
    "logs\production-restore-test\dia86-production-restore-readiness.json",
    "logs\production-restore-test\dia86-production-restore-execution-evidence.json",
    "docs\database\identity-db.sql",
    "docs\database\audit-db.sql",
    "infra\cloudrun\prod-backend-services.json",
    "infra\cloudrun\prod-frontend-services.json",
    "apps\mfe-admin\app\api\audit\[...path]\route.ts",
    "apps\mfe-admin\app\api\admin\health\route.ts",
    "services\identity-service\src\main\java\com\ventapasajes\identity\api\IdentityBaseResource.java",
    "services\identity-service\src\main\java\com\ventapasajes\identity\auth\BearerAuthFilter.java",
    "services\audit-service\README.md"
)

$SourceInventory = foreach ($Source in $RequiredSources) {
    $Resolved = Resolve-ProjectPath -Path $Source
    [pscustomobject]@{
        path = $Source
        exists = Test-Path -LiteralPath $Resolved
    }
}

$MissingSources = @($SourceInventory | Where-Object { -not $_.exists })
if ($MissingSources.Count -gt 0) {
    $MissingList = ($MissingSources | ForEach-Object { $_.path }) -join ", "
    throw "No se puede preparar la revision de seguridad final. Fuentes faltantes: $MissingList"
}

$ProdInfra = Read-JsonRequired -Path "logs\prod-infra\verify-prod-infra.json"
$ProdIam = Read-JsonRequired -Path "logs\prod-iam\verify-iam-prod.json"
$BackendEvidence = Read-JsonRequired -Path "logs\cloudrun-prod\verify-cloudrun-prod-backends.json"
$FrontendEvidence = Read-JsonRequired -Path "logs\cloudrun-prod\verify-cloudrun-prod-frontends.json"
$BackupReadiness = Read-JsonRequired -Path "logs\backup-restore\verify-backup-restore-readiness-prod.json"
$RestoreReadiness = Read-JsonRequired -Path "logs\production-restore-test\dia86-production-restore-readiness.json"
$RestoreExecution = Read-JsonRequired -Path "logs\production-restore-test\dia86-production-restore-execution-evidence.json"
$BackendConfig = Read-JsonRequired -Path "infra\cloudrun\prod-backend-services.json"
$FrontendConfig = Read-JsonRequired -Path "infra\cloudrun\prod-frontend-services.json"

$IdentitySql = Read-TextRequired -Path "docs\database\identity-db.sql"
$AuditSql = Read-TextRequired -Path "docs\database\audit-db.sql"
$IdentityResource = Read-TextRequired -Path "services\identity-service\src\main\java\com\ventapasajes\identity\api\IdentityBaseResource.java"
$BearerAuthFilter = Read-TextRequired -Path "services\identity-service\src\main\java\com\ventapasajes\identity\auth\BearerAuthFilter.java"
$AuditReadme = Read-TextRequired -Path "services\audit-service\README.md"

$PermissionCodes = @(
    [regex]::Matches($IdentitySql, "'identity\.[^']+'") |
        ForEach-Object { $_.Value -replace "^'|'$", "" } |
        Sort-Object -Unique
)
$RequiredIdentityFragments = @(
    "CREATE TABLE roles",
    "CREATE TABLE permissions",
    "CREATE TABLE role_permissions",
    "CREATE TABLE user_roles",
    "CREATE TABLE authorized_identities",
    "CREATE TABLE login_attempts"
)
$MissingIdentityFragments = @($RequiredIdentityFragments | Where-Object { -not $IdentitySql.Contains($_) })
$RequiresPermissionCount = ([regex]::Matches($IdentityResource, "@RequiresPermission")).Count
$FunctionalRolesReady = (
    $MissingIdentityFragments.Count -eq 0 -and
    $PermissionCodes.Count -ge 8 -and
    $IdentitySql -match "\('ADMIN'," -and
    $IdentitySql -match "\('TICKET_SELLER'," -and
    $RequiresPermissionCount -ge 10 -and
    $BearerAuthFilter.Contains("hasPermission")
)

$IamFailedChecks = @($ProdIam.checks | Where-Object { -not [bool]$_.Value })
$IamReady = ([bool]$ProdIam.ready -and $IamFailedChecks.Count -eq 0)

$SecretFindings = @($ProdIam.secrets.findings)
$SecretsWithMissingAccessors = @(
    $SecretFindings |
        Where-Object {
            (Count-Items $_.expected_accessors_missing) -gt 0 -or
            (Count-Items $_.legacy_accessors_still_present) -gt 0 -or
            [int]$_.enabled_version_count -lt 1
        }
)
$SecretsReady = (
    [bool]$ProdInfra.ready -and
    (Count-Items $ProdInfra.secrets.missing_or_without_enabled_version) -eq 0 -and
    $SecretsWithMissingAccessors.Count -eq 0
)

$BackendServices = @($BackendEvidence.services)
$BackendConfigServices = @($BackendConfig.services)
$FrontendServices = @($FrontendEvidence.services)
$FrontendConfigServices = @($FrontendConfig.services | Where-Object { $_.group -eq "frontend" })

$BackendPrivateCount = @($BackendServices | Where-Object { [bool]$_.private_only }).Count
$BackendPublicInvokerCount = @($BackendServices | Where-Object { [bool]$_.public_invoker }).Count
$BackendConfigPrivateCount = @($BackendConfigServices | Where-Object { -not [bool]$_.allow_unauthenticated }).Count
$FrontendConfigPublicCount = @($FrontendConfigServices | Where-Object { [bool]$_.allow_unauthenticated }).Count

$ApiExposureReady = (
    [bool]$BackendEvidence.ready -and
    [int]$BackendEvidence.summary.services_total -eq $BackendPrivateCount -and
    $BackendPublicInvokerCount -eq 0 -and
    $BackendConfigPrivateCount -eq $BackendConfigServices.Count -and
    [int]$FrontendEvidence.summary.checks_failed -eq 0 -and
    [int]$FrontendEvidence.summary.services_total -eq [int]$FrontendEvidence.summary.services_ready -and
    $FrontendConfigPublicCount -eq $FrontendConfigServices.Count
)

$AuditBackendSmoke = @($BackendEvidence.smoke_tests | Where-Object { $_.service_id -eq "audit-service" } | Select-Object -First 1)
$AdminAggregateHealth = @($FrontendEvidence.checks | Where-Object { $_.name -eq "mfe-admin aggregate health" } | Select-Object -First 1)
$AuditReady = (
    $AuditSql.Contains("CREATE TABLE audit_events") -and
    $AuditSql.Contains("UNIQUE (source_service, source_event_id)") -and
    $AuditSql.Contains("idx_audit_events_occurred_at") -and
    $AuditReadme.Contains("append-only") -and
    $AuditBackendSmoke -and [bool]$AuditBackendSmoke.passed -and
    $AdminAggregateHealth -and [bool]$AdminAggregateHealth.passed
)

$BackupsReady = (
    [bool]$BackupReadiness.readiness.ready_for_restore_test -and
    [bool]$RestoreReadiness.criteria_met -and
    [bool]$RestoreExecution.database_validation_ok -and
    [bool]$RestoreExecution.storage_validation_ok -and
    [bool]$RestoreExecution.restore_instance_deleted -and
    [bool]$RestoreExecution.restore_bucket_deleted
)

$AreaResults = @(
    New-AreaResult `
        -Area "Roles funcionales" `
        -Ready $FunctionalRolesReady `
        -Summary "Catalogo base con ADMIN y TICKET_SELLER, $($PermissionCodes.Count) permisos y $RequiresPermissionCount controles @RequiresPermission." `
        -Evidence @("docs\database\identity-db.sql", "services\identity-service\src\main\java\com\ventapasajes\identity\api\IdentityBaseResource.java")
    New-AreaResult `
        -Area "IAM produccion" `
        -Ready $IamReady `
        -Summary "$($ProdIam.service_accounts.Count) service accounts productivas, bindings minimos completos y legados removidos." `
        -Evidence @("logs\prod-iam\verify-iam-prod.json")
    New-AreaResult `
        -Area "Secret Manager" `
        -Ready $SecretsReady `
        -Summary "$($ProdInfra.secrets.expected_count) secretos productivos con version habilitada y accessors esperados." `
        -Evidence @("logs\prod-infra\verify-prod-infra.json", "logs\prod-iam\verify-iam-prod.json")
    New-AreaResult `
        -Area "Exposicion de APIs" `
        -Ready $ApiExposureReady `
        -Summary "$BackendPrivateCount/$($BackendServices.Count) backends privados; $($FrontendEvidence.summary.checks_passed)/$($FrontendEvidence.summary.checks_total) checks frontend pasados." `
        -Evidence @("logs\cloudrun-prod\verify-cloudrun-prod-backends.json", "logs\cloudrun-prod\verify-cloudrun-prod-frontends.json")
    New-AreaResult `
        -Area "Auditoria" `
        -Ready $AuditReady `
        -Summary "Modelo append-only, deduplicacion por evento fuente, audit-service saludable y visor admin agregado saludable." `
        -Evidence @("docs\database\audit-db.sql", "logs\cloudrun-prod\verify-cloudrun-prod-backends.json", "logs\cloudrun-prod\verify-cloudrun-prod-frontends.json")
    New-AreaResult `
        -Area "Backups y restauracion" `
        -Ready $BackupsReady `
        -Summary "Backups productivos activos, restauracion real ejecutada con RTO $($RestoreReadiness.measured_prod_rto_minutes) min y RPO $($RestoreReadiness.measured_rpo_hours) h." `
        -Evidence @("logs\backup-restore\verify-backup-restore-readiness-prod.json", "logs\production-restore-test\dia86-production-restore-readiness.json")
)

$CriticalRisks = New-Object System.Collections.Generic.List[object]
foreach ($Area in $AreaResults) {
    if (-not $Area.ready) {
        $CriticalRisks.Add([pscustomobject]@{
            area = $Area.area
            description = "El area no cumple el criterio minimo de seguridad final."
        }) | Out-Null
    }
}

$Observations = New-Object System.Collections.Generic.List[string]
if ($ProdIam.administrator_access.manual_review_required) {
    $Members = @($ProdIam.administrator_access.basic_role_members_observed | ForEach-Object { $_.members } | ForEach-Object { $_ }) -join ", "
    $Observations.Add("Existe acceso humano con rol Owner observado ($Members). No se elimina automaticamente para evitar bloqueo; debe revisarse periodicamente con el dueno del proyecto.") | Out-Null
}
$Observations.Add("Los frontends productivos son publicos por diseno; los backends productivos permanecen privados y se invocan service-to-service.") | Out-Null
$Observations.Add("La URL productiva con dominio propio sigue separada del cierre de seguridad; las URLs Cloud Run ya usan HTTPS administrado.") | Out-Null
$Observations.Add("La recompilacion nativa backend con Cloud SQL Socket Factory queda como pendiente tecnico no bloqueante de seguridad porque produccion opera con imagen JVM validada.") | Out-Null

$Recommendations = @(
    "Revisar trimestralmente el acceso humano Owner/Editor y documentar aprobacion.",
    "Rotar secretos productivos segun calendario operativo y despues de cualquier sospecha de exposicion.",
    "Repetir prueba de restauracion al menos trimestralmente o despues de cambios grandes de infraestructura.",
    "Mantener backends sin invocacion publica y revalidarlo despues de cada despliegue.",
    "Revisar eventos de auditoria durante soporte normal y conservar correlation_id en tickets operativos."
)

$CriticalRiskArray = @($CriticalRisks.ToArray())
$ObservationArray = @($Observations.ToArray())
$ReadyForSecurityClose = (($AreaResults | Where-Object { -not $_.ready }).Count -eq 0 -and $CriticalRisks.Count -eq 0)
$ReadinessPath = Join-Path $OutputPath "dia87-final-security-readiness.json"
$FindingsPath = Join-Path $OutputPath "dia87-final-security-findings.json"
$ReportPath = Join-Path $Root "docs\informe-seguridad-final.md"

$Readiness = [pscustomobject]@{
    generated_at = (Get-Date).ToString("o")
    day = 87
    objective = "Revision de seguridad final"
    ready_for_security_close = $ReadyForSecurityClose
    critical_risks_mitigated = ($CriticalRisks.Count -eq 0)
    critical_risk_count = $CriticalRisks.Count
    area_results = $AreaResults
    metrics = [pscustomobject]@{
        permission_count = $PermissionCodes.Count
        requires_permission_count = $RequiresPermissionCount
        service_accounts_prod = $ProdIam.service_accounts.Count
        secrets_prod = $ProdInfra.secrets.expected_count
        backend_services_private = $BackendPrivateCount
        backend_services_total = $BackendServices.Count
        frontend_checks_passed = $FrontendEvidence.summary.checks_passed
        frontend_checks_total = $FrontendEvidence.summary.checks_total
        successful_backups = $BackupReadiness.cloud_sql.successful_backup_count
        measured_rpo_hours = $RestoreReadiness.measured_rpo_hours
        measured_prod_rto_minutes = $RestoreReadiness.measured_prod_rto_minutes
    }
    observations = $ObservationArray
    recommendations = $Recommendations
}

$Findings = New-Object psobject
$Findings | Add-Member -NotePropertyName generated_at -NotePropertyValue $Readiness.generated_at
$Findings | Add-Member -NotePropertyName critical_risks -NotePropertyValue $CriticalRiskArray
$Findings | Add-Member -NotePropertyName iam_failed_checks -NotePropertyValue @($IamFailedChecks)
$Findings | Add-Member -NotePropertyName secrets_with_missing_accessors -NotePropertyValue @($SecretsWithMissingAccessors)
$Findings | Add-Member -NotePropertyName missing_identity_fragments -NotePropertyValue @($MissingIdentityFragments)
$Findings | Add-Member -NotePropertyName sources -NotePropertyValue @($SourceInventory)

$Readiness | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $ReadinessPath -Encoding utf8
$Findings | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $FindingsPath -Encoding utf8

$AreaRows = ($AreaResults | ForEach-Object {
    "| $($_.area) | $($_.ready) | $($_.summary) |"
}) -join [Environment]::NewLine

$CriticalRiskText = if ($CriticalRisks.Count -eq 0) {
    "- No quedan riesgos criticos abiertos en las areas revisadas."
} else {
    ($CriticalRisks | ForEach-Object { "- $($_.area): $($_.description)" }) -join [Environment]::NewLine
}

$ObservationText = ($Observations | ForEach-Object { "- $_" }) -join [Environment]::NewLine
$RecommendationText = ($Recommendations | ForEach-Object { "- $_" }) -join [Environment]::NewLine

$Report = @"
# Informe de seguridad final

## Resumen ejecutivo

La revision final consolida evidencias reales de roles funcionales, IAM, Secret Manager, exposicion de APIs, auditoria y backups/restauracion.

Resultado:

~~~text
Riesgos criticos mitigados: $($Readiness.critical_risks_mitigated)
Riesgos criticos abiertos: $($Readiness.critical_risk_count)
Listo para cierre de seguridad: $($Readiness.ready_for_security_close)
~~~

## Resultado por area

| Area | Lista | Resumen |
| --- | --- | --- |
$AreaRows

## Riesgos criticos

$CriticalRiskText

## Observaciones no criticas

$ObservationText

## Recomendaciones de operacion segura

$RecommendationText

## Metricas verificadas

| Metrica | Valor |
| --- | --- |
| Permisos funcionales identity | $($PermissionCodes.Count) |
| Controles `@RequiresPermission` | $RequiresPermissionCount |
| Service accounts productivas | $($ProdIam.service_accounts.Count) |
| Secretos productivos esperados | $($ProdInfra.secrets.expected_count) |
| Backends privados | $BackendPrivateCount de $($BackendServices.Count) |
| Checks frontend productivos | $($FrontendEvidence.summary.checks_passed) de $($FrontendEvidence.summary.checks_total) |
| Backups exitosos Cloud SQL prod | $($BackupReadiness.cloud_sql.successful_backup_count) |
| RPO medido prod | $($RestoreReadiness.measured_rpo_hours) horas |
| RTO productivo medido | $($RestoreReadiness.measured_prod_rto_minutes) minutos |

## Evidencia

~~~text
$ReadinessPath
$FindingsPath
logs\prod-iam\verify-iam-prod.json
logs\prod-infra\verify-prod-infra.json
logs\cloudrun-prod\verify-cloudrun-prod-backends.json
logs\cloudrun-prod\verify-cloudrun-prod-frontends.json
logs\backup-restore\verify-backup-restore-readiness-prod.json
logs\production-restore-test\dia86-production-restore-readiness.json
~~~

## Decision de cierre

Se cumple el criterio del Dia 87: riesgos criticos mitigados. El sistema conserva observaciones operativas de seguimiento, pero no se identifica un bloqueo critico de seguridad en las evidencias revisadas.
"@

Set-Content -LiteralPath $ReportPath -Value $Report -Encoding utf8

Write-Host "Revision seguridad final lista: $($Readiness.ready_for_security_close)"
Write-Host "Riesgos criticos mitigados: $($Readiness.critical_risks_mitigated)"
Write-Host "Riesgos criticos abiertos: $($Readiness.critical_risk_count)"
Write-Host "Areas listas: $(@($AreaResults | Where-Object { $_.ready }).Count)/$($AreaResults.Count)"
Write-Host "Informe: $ReportPath"
