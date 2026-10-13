param(
    [string]$OutputDirectory = ".\logs\future-modules-backlog"
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

function New-ModuleBacklogItem {
    param(
        [int]$Priority,
        [string]$Module,
        [string]$Backend,
        [string]$Frontend,
        [string]$Reason,
        [string]$Mvp,
        [string[]]$Dependencies,
        [string[]]$Risks,
        [string]$EffortSize,
        [int]$MinWeeks,
        [int]$MaxWeeks,
        [int]$PersonWeeks,
        [int]$Impact,
        [int]$Urgency,
        [int]$Readiness,
        [int]$Complexity,
        [int]$Risk,
        [int]$DecisionScore
    )

    return [pscustomobject]@{
        priority = $Priority
        module = $Module
        backend = $Backend
        frontend = $Frontend
        reason = $Reason
        mvp_scope = $Mvp
        dependencies = $Dependencies
        risks = $Risks
        effort_size = $EffortSize
        estimated_calendar_weeks = "$MinWeeks-$MaxWeeks"
        estimated_person_weeks = $PersonWeeks
        scoring = [pscustomobject]@{
            impact = $Impact
            urgency = $Urgency
            readiness = $Readiness
            complexity = $Complexity
            risk = $Risk
            score = $DecisionScore
        }
    }
}

$RequiredSources = @(
    "tareas.md",
    "docs\guia-crecimiento-modular.md",
    "templates\quarkus-service\template.json",
    "templates\next-mfe\template.json",
    "scripts\new-quarkus-service.ps1",
    "scripts\new-next-mfe.ps1",
    "docs\manual-tecnico.md",
    "docs\manual-operativo-final.md"
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
    throw "No se puede preparar el backlog futuro. Fuentes faltantes: $MissingList"
}

$Modules = @(
    New-ModuleBacklogItem `
        -Priority 1 `
        -Module "Facturacion electronica" `
        -Backend "billing-service" `
        -Frontend "mfe-billing" `
        -Reason "Modulo con mayor impacto regulatorio y administrativo; debe resolver emision, autorizacion, contingencia y trazabilidad fiscal." `
        -Mvp "Emitir comprobante electronico desde una venta confirmada, registrar estado, conservar XML/PDF y permitir consulta/reintento." `
        -Dependencies @("ticketing-service", "document-service", "audit-service", "identidad y roles administrativos", "validacion normativa SRI vigente antes de implementar") `
        -Risks @("Cambios regulatorios", "Firma y certificados", "Ambiente de pruebas SRI", "Manejo de contingencia y anulaciones") `
        -EffortSize "XL" `
        -MinWeeks 8 `
        -MaxWeeks 12 `
        -PersonWeeks 28 `
        -Impact 5 `
        -Urgency 5 `
        -Readiness 3 `
        -Complexity 5 `
        -Risk 5 `
        -DecisionScore 95
    New-ModuleBacklogItem `
        -Priority 2 `
        -Module "Caja avanzada" `
        -Backend "cash-service" `
        -Frontend "mfe-cash" `
        -Reason "Cierra controles operativos diarios: turnos, arqueos, diferencias, anulaciones, cierres y reportes de caja." `
        -Mvp "Apertura/cierre de caja por usuario, resumen de ventas/anulaciones, registro de diferencias y reporte de cierre." `
        -Dependencies @("ticketing-service", "reporting-service", "audit-service", "roles de supervisor") `
        -Risks @("Reglas operativas incompletas", "Diferencias entre reporte y caja fisica", "Permisos de supervisor") `
        -EffortSize "M" `
        -MinWeeks 5 `
        -MaxWeeks 8 `
        -PersonWeeks 16 `
        -Impact 5 `
        -Urgency 4 `
        -Readiness 4 `
        -Complexity 3 `
        -Risk 3 `
        -DecisionScore 88
    New-ModuleBacklogItem `
        -Priority 3 `
        -Module "Pagos online" `
        -Backend "payments-service" `
        -Frontend "mfe-payments" `
        -Reason "Habilita cobros no presenciales y es prerequisito natural para venta web publica." `
        -Mvp "Crear intento de pago, recibir webhook, reconciliar estado, enlazar pago con boleto y registrar auditoria." `
        -Dependencies @("ticketing-service", "audit-service", "proveedor de pagos seleccionado", "politica de reintentos e idempotencia") `
        -Risks @("Webhooks duplicados", "Contracargos", "Conciliacion bancaria", "Manejo de boletos pendientes de pago") `
        -EffortSize "L" `
        -MinWeeks 6 `
        -MaxWeeks 10 `
        -PersonWeeks 22 `
        -Impact 5 `
        -Urgency 4 `
        -Readiness 3 `
        -Complexity 4 `
        -Risk 4 `
        -DecisionScore 84
    New-ModuleBacklogItem `
        -Priority 4 `
        -Module "Encomiendas" `
        -Backend "cargo-service" `
        -Frontend "mfe-cargo" `
        -Reason "Nueva linea de negocio que reutiliza rutas, salidas, buses, documentos y reportes, pero requiere dominio propio." `
        -Mvp "Registrar encomienda, origen/destino, remitente/destinatario, estado, cobro basico y comprobante." `
        -Dependencies @("dispatch-service", "document-service", "reporting-service", "audit-service") `
        -Risks @("Estados logisticos", "Responsabilidad por paquetes", "Tarifas por peso/volumen", "Operativa de entrega") `
        -EffortSize "L" `
        -MinWeeks 8 `
        -MaxWeeks 12 `
        -PersonWeeks 26 `
        -Impact 4 `
        -Urgency 3 `
        -Readiness 3 `
        -Complexity 4 `
        -Risk 4 `
        -DecisionScore 76
    New-ModuleBacklogItem `
        -Priority 5 `
        -Module "Venta web publica" `
        -Backend "public-sales-service" `
        -Frontend "public-sales-mfe" `
        -Reason "Canal de crecimiento comercial, pero conviene hacerlo despues de estabilizar pagos online, caja y reglas operativas." `
        -Mvp "Busqueda publica de salidas, seleccion de asiento, captura de pasajero, pago online y confirmacion de boleto." `
        -Dependencies @("payments-service", "ticketing-service", "document-service", "frontend-shell o portal publico", "politicas antifraude") `
        -Risks @("Exposicion publica", "Abuso de reservas", "Soporte a pasajeros externos", "SEO y disponibilidad") `
        -EffortSize "XL" `
        -MinWeeks 10 `
        -MaxWeeks 14 `
        -PersonWeeks 34 `
        -Impact 5 `
        -Urgency 3 `
        -Readiness 2 `
        -Complexity 5 `
        -Risk 5 `
        -DecisionScore 70
)

$BacklogPath = Join-Path $Root "docs\backlog-futuro-priorizado.md"
$EstimatesPath = Join-Path $Root "docs\estimaciones-modulos-futuros.md"
$ReadinessPath = Join-Path $OutputPath "dia89-future-modules-backlog-readiness.json"
$InventoryPath = Join-Path $OutputPath "dia89-future-modules-backlog-inventory.json"

$BacklogRows = ($Modules | Sort-Object priority | ForEach-Object {
    "| P$($_.priority) | $($_.module) | $($_.backend) | $($_.frontend) | $($_.reason) |"
}) -join [Environment]::NewLine

$DependencySections = ($Modules | Sort-Object priority | ForEach-Object {
    $Dependencies = ($_.dependencies | ForEach-Object { "- $_" }) -join [Environment]::NewLine
    $Risks = ($_.risks | ForEach-Object { "- $_" }) -join [Environment]::NewLine
@"
## P$($_.priority) - $($_.module)

MVP inicial:

$($_.mvp_scope)

Dependencias:

$Dependencies

Riesgos principales:

$Risks
"@
}) -join [Environment]::NewLine

$BacklogDoc = @"
# Backlog futuro priorizado

## Resumen

Este backlog ordena los siguientes modulos del sistema despues del cierre funcional base. La priorizacion equilibra impacto de negocio, urgencia, preparacion tecnica, complejidad y riesgo.

## Orden recomendado

| Prioridad | Modulo | Backend sugerido | MFE sugerido | Razon |
| --- | --- | --- | --- | --- |
$BacklogRows

## Detalle por modulo

$DependencySections

## Decision de secuencia

La secuencia recomendada es:

1. Facturacion electronica.
2. Caja avanzada.
3. Pagos online.
4. Encomiendas.
5. Venta web publica.

Se recomienda iniciar descubrimiento funcional de facturacion electronica y pagos online en paralelo, pero construir primero el modulo que tenga requisitos externos y responsables confirmados.
"@

$EstimateRows = ($Modules | Sort-Object priority | ForEach-Object {
    "| P$($_.priority) | $($_.module) | $($_.effort_size) | $($_.estimated_calendar_weeks) | $($_.estimated_person_weeks) | $($_.scoring.score) |"
}) -join [Environment]::NewLine

$EstimateSections = ($Modules | Sort-Object priority | ForEach-Object {
@"
## P$($_.priority) - $($_.module)

| Campo | Valor |
| --- | --- |
| Backend | $($_.backend) |
| Frontend | $($_.frontend) |
| Tamano | $($_.effort_size) |
| Calendario inicial | $($_.estimated_calendar_weeks) semanas |
| Esfuerzo inicial | $($_.estimated_person_weeks) persona-semanas |
| Impacto | $($_.scoring.impact) |
| Urgencia | $($_.scoring.urgency) |
| Preparacion tecnica | $($_.scoring.readiness) |
| Complejidad | $($_.scoring.complexity) |
| Riesgo | $($_.scoring.risk) |
| Score | $($_.scoring.score) |

Alcance MVP:

$($_.mvp_scope)
"@
}) -join [Environment]::NewLine

$EstimatesDoc = @"
# Estimaciones iniciales de modulos futuros

## Supuestos

- Estimaciones iniciales, no compromiso cerrado de fecha.
- Equipo base supuesto: 1 backend, 1 frontend y apoyo parcial funcional/QA.
- La duracion real depende de disponibilidad de responsables, proveedores externos y reglas finales.
- Cada modulo debe pasar por discovery, diseno, implementacion, pruebas, despliegue y capacitacion.

## Tabla resumen

| Prioridad | Modulo | Tamano | Semanas calendario | Persona-semanas | Score |
| --- | --- | --- | --- | --- | --- |
$EstimateRows

## Detalle

$EstimateSections

## Reglas para ajustar estimaciones

- Si aparece integracion externa nueva, sumar discovery tecnico y pruebas de certificacion.
- Si el modulo toca dinero o impuestos, agregar pruebas de conciliacion, auditoria y reversa.
- Si el modulo es publico en internet, agregar hardening, abuso de reservas, monitoreo y soporte.
- Si el modulo comparte flujos con boleteria, ejecutar regresion de ticketing antes de liberar.
"@

Set-Content -LiteralPath $BacklogPath -Value $BacklogDoc -Encoding utf8
Set-Content -LiteralPath $EstimatesPath -Value $EstimatesDoc -Encoding utf8

$RequiredBacklogSections = @(
    "## Orden recomendado",
    "Facturacion electronica",
    "Pagos online",
    "Encomiendas",
    "Venta web publica",
    "Caja avanzada"
)

$RequiredEstimateSections = @(
    "## Supuestos",
    "## Tabla resumen",
    "persona-semanas",
    "Score"
)

$BacklogContent = Get-Content -LiteralPath $BacklogPath -Raw
$EstimatesContent = Get-Content -LiteralPath $EstimatesPath -Raw
$MissingBacklogSections = @($RequiredBacklogSections | Where-Object { -not $BacklogContent.Contains($_) })
$MissingEstimateSections = @($RequiredEstimateSections | Where-Object { -not $EstimatesContent.Contains($_) })

$Readiness = [pscustomobject]@{
    generated_at = (Get-Date).ToString("o")
    day = 89
    objective = "Backlog de siguientes modulos"
    ready_for_future_backlog = (($MissingBacklogSections.Count -eq 0) -and ($MissingEstimateSections.Count -eq 0))
    modules_prioritized = $Modules.Count
    highest_priority = ($Modules | Sort-Object priority | Select-Object -First 1).module
    backlog_path = $BacklogPath
    estimates_path = $EstimatesPath
    modules = $Modules
    missing_backlog_sections = @($MissingBacklogSections)
    missing_estimate_sections = @($MissingEstimateSections)
    source_files = $SourceInventory
}

$Inventory = [pscustomobject]@{
    generated_at = $Readiness.generated_at
    deliverables = @(
        "docs\backlog-futuro-priorizado.md",
        "docs\estimaciones-modulos-futuros.md"
    )
    modules = @($Modules | Select-Object priority, module, backend, frontend, effort_size, estimated_calendar_weeks, estimated_person_weeks)
}

$Readiness | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $ReadinessPath -Encoding utf8
$Inventory | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $InventoryPath -Encoding utf8

Write-Host "Backlog futuro listo: $($Readiness.ready_for_future_backlog)"
Write-Host "Modulos priorizados: $($Readiness.modules_prioritized)"
Write-Host "Prioridad 1: $($Readiness.highest_priority)"
Write-Host "Secciones backlog faltantes: $($MissingBacklogSections.Count)"
Write-Host "Secciones estimaciones faltantes: $($MissingEstimateSections.Count)"
Write-Host "Backlog: $BacklogPath"
Write-Host "Estimaciones: $EstimatesPath"
