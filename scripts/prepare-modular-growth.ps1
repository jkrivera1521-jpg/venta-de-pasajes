param(
    [string]$OutputDirectory = ".\logs\modular-growth"
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

function Invoke-JsonCommand {
    param([string[]]$Command)

    $Output = & $Command[0] $Command[1..($Command.Count - 1)] 2>&1
    if ($LASTEXITCODE -ne 0) {
        $Text = ($Output | ForEach-Object { $_.ToString() }) -join [Environment]::NewLine
        throw "Comando fallo: $Text"
    }

    $JsonText = ($Output | ForEach-Object { $_.ToString() }) -join [Environment]::NewLine
    return $JsonText | ConvertFrom-Json
}

$RequiredSources = @(
    "scripts\new-quarkus-service.ps1",
    "scripts\new-next-mfe.ps1",
    "services\quarkus-service-template\pom.xml",
    "services\quarkus-service-template\README.md",
    "templates\README.md",
    "templates\quarkus-service\README.md",
    "templates\quarkus-service\template.json",
    "templates\quarkus-service\checklist.md",
    "templates\next-mfe\README.md",
    "templates\next-mfe\template.json",
    "templates\next-mfe\checklist.md",
    "templates\next-mfe\files\package.json",
    "templates\next-mfe\files\app\mfe\manifest\route.ts",
    "templates\next-mfe\files\app\api\health\route.ts",
    "templates\next-mfe\files\app\api\__PACKAGE_SEGMENT__\[...path]\route.ts",
    "templates\next-mfe\files\app\__PACKAGE_SEGMENT__\embedded\page.tsx"
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
    throw "No se puede preparar crecimiento modular. Fuentes faltantes: $MissingList"
}

$QuarkusDryRun = Invoke-JsonCommand -Command @(
    "powershell",
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    (Resolve-ProjectPath -Path "scripts\new-quarkus-service.ps1"),
    "-ServiceName",
    "catalog-service",
    "-PackageSegment",
    "catalog",
    "-DatabaseName",
    "catalog_db",
    "-HttpPort",
    "8087",
    "-DryRun"
)

$MfeDryRun = Invoke-JsonCommand -Command @(
    "powershell",
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    (Resolve-ProjectPath -Path "scripts\new-next-mfe.ps1"),
    "-MfeName",
    "mfe-catalog",
    "-PackageSegment",
    "catalog",
    "-Title",
    "Catalogos",
    "-LocalPort",
    "3006",
    "-BackendPort",
    "8087",
    "-DryRun"
)

$RequiredGuideSections = @(
    "## Cuando crear un modulo nuevo",
    "## Crear un microservicio Quarkus",
    "## Crear un MFE Next.js",
    "## Integrar el modulo al monorepo",
    "## Checklist para nuevos modulos",
    "## Validaciones minimas"
)

$GuidePath = Join-Path $Root "docs\guia-crecimiento-modular.md"
$ReadinessPath = Join-Path $OutputPath "dia88-modular-growth-readiness.json"
$InventoryPath = Join-Path $OutputPath "dia88-modular-growth-inventory.json"

$Guide = @"
# Guia de crecimiento modular

## Objetivo

Esta guia explica como agregar modulos nuevos al sistema Venta de Pasajes sin romper las convenciones de microservicios, microfrontends, seguridad, despliegue y operacion.

## Cuando crear un modulo nuevo

Crear un modulo nuevo solo cuando exista una responsabilidad de negocio clara y separable, por ejemplo pagos, facturacion electronica, encomiendas o caja avanzada.

Antes de crear codigo, validar:

- El modulo tiene datos propios o reglas propias.
- No necesita escribir directamente en bases de otros servicios.
- Puede exponer una API propia.
- Puede integrarse al shell como MFE independiente.
- Tiene responsable funcional y criterio de prueba.

## Crear un microservicio Quarkus

Validar primero con modo seco:

~~~powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\new-quarkus-service.ps1 ``
  -ServiceName catalog-service ``
  -PackageSegment catalog ``
  -DatabaseName catalog_db ``
  -HttpPort 8087 ``
  -DryRun
~~~

Resultado observado:

~~~text
service_name: $($QuarkusDryRun.service_name)
package: $($QuarkusDryRun.package)
database_name: $($QuarkusDryRun.database_name)
api_base_path: $($QuarkusDryRun.api_base_path)
target_exists: $($QuarkusDryRun.target_exists)
dry_run: $($QuarkusDryRun.dry_run)
~~~

Crear el servicio solo si el target no existe o esta vacio:

~~~powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\new-quarkus-service.ps1 ``
  -ServiceName catalog-service ``
  -PackageSegment catalog ``
  -DatabaseName catalog_db ``
  -HttpPort 8087
~~~

Despues de crear:

- Agregar migracion Flyway real.
- Agregar endpoints de dominio.
- Agregar OpenAPI en `docs/openapi`.
- Agregar configuracion Cloud Run dev/prod.
- Agregar secretos necesarios sin valores reales.
- Ejecutar tests Maven del servicio.

## Crear un MFE Next.js

Validar primero con modo seco:

~~~powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\new-next-mfe.ps1 ``
  -MfeName mfe-catalog ``
  -PackageSegment catalog ``
  -Title "Catalogos" ``
  -LocalPort 3006 ``
  -BackendPort 8087 ``
  -DryRun
~~~

Resultado observado:

~~~text
mfe_name: $($MfeDryRun.mfe_name)
workspace_name: $($MfeDryRun.workspace_name)
package_segment: $($MfeDryRun.package_segment)
backend_api_url: $($MfeDryRun.backend_api_url)
workspace_path: $($MfeDryRun.workspace_path)
dry_run: $($MfeDryRun.dry_run)
~~~

Crear el MFE solo si el target no existe o esta vacio:

~~~powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\new-next-mfe.ps1 ``
  -MfeName mfe-catalog ``
  -PackageSegment catalog ``
  -Title "Catalogos" ``
  -LocalPort 3006 ``
  -BackendPort 8087
~~~

Despues de crear:

- Agregar apps/mfe-catalog al arreglo workspaces en package.json.
- Agregar script dev:mfe-catalog.
- Agregar el manifest al shell.
- Configurar NEXT_PUBLIC_MFE_PUBLIC_URL.
- Configurar CATALOG_API_URL y NEXT_PUBLIC_CATALOG_API_URL.
- Ejecutar typecheck del workspace.

## Integrar el modulo al monorepo

Backend:

- Registrar el servicio en services/README.md.
- Agregar docs/openapi/<service>.openapi.yaml.
- Agregar DDL o migracion conceptual en docs/database.
- Agregar config en infra/cloudrun/dev-services.json.
- Agregar config en infra/cloudrun/prod-backend-services.json.
- Agregar secretos en el inventario del ambiente correspondiente.

Frontend:

- Registrar app en package.json.
- Registrar manifest en frontend-shell.
- Agregar config en infra/cloudrun/dev-services.json.
- Agregar config en infra/cloudrun/prod-frontend-services.json.
- Agregar health y embedded al checklist de despliegue.

## Checklist para nuevos modulos

- Dominio y limite documentado.
- Base propia definida si el backend persiste datos.
- API propia documentada.
- No hay escritura directa sobre bases ajenas.
- Eventos definidos si hay integracion asincrona.
- Secretos declarados sin valores reales.
- Health y OpenAPI disponibles.
- MFE con manifest y ruta embedded.
- Shell actualizado.
- Cloud Run dev/prod actualizado.
- Tests minimos definidos.
- Reversa documentada antes de ejecutar cambios reales.

## Validaciones minimas

Backend:

~~~powershell
mvn -f .\services\catalog-service\pom.xml test
~~~

Frontend:

~~~powershell
npm install
npm run typecheck -w @venta-pasajes/mfe-catalog
~~~

Workspace:

~~~powershell
git diff --check
~~~

## Plantillas disponibles

~~~text
templates/quarkus-service
templates/next-mfe
services/quarkus-service-template
scripts/new-quarkus-service.ps1
scripts/new-next-mfe.ps1
~~~
"@

Set-Content -LiteralPath $GuidePath -Value $Guide -Encoding utf8

$GuideContent = Get-Content -LiteralPath $GuidePath -Raw
$MissingGuideSections = @($RequiredGuideSections | Where-Object { -not $GuideContent.Contains($_) })

$Readiness = [pscustomobject]@{
    generated_at = (Get-Date).ToString("o")
    day = 88
    objective = "Preparacion de crecimiento modular"
    ready_for_modular_growth = ($MissingGuideSections.Count -eq 0)
    reusable_templates_ready = $true
    quarkus_dry_run = $QuarkusDryRun
    mfe_dry_run = $MfeDryRun
    guide_path = $GuidePath
    source_files = $SourceInventory
    missing_guide_sections = @($MissingGuideSections)
}

$Inventory = [pscustomobject]@{
    generated_at = $Readiness.generated_at
    templates = @(
        "templates\quarkus-service",
        "templates\next-mfe",
        "services\quarkus-service-template"
    )
    generators = @(
        "scripts\new-quarkus-service.ps1",
        "scripts\new-next-mfe.ps1"
    )
    deliverables = @(
        "docs\guia-crecimiento-modular.md",
        "templates\README.md"
    )
}

$Readiness | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $ReadinessPath -Encoding utf8
$Inventory | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $InventoryPath -Encoding utf8

Write-Host "Crecimiento modular listo: $($Readiness.ready_for_modular_growth)"
Write-Host "Plantillas reutilizables listas: $($Readiness.reusable_templates_ready)"
Write-Host "DryRun Quarkus OK: $($QuarkusDryRun.dry_run)"
Write-Host "DryRun MFE OK: $($MfeDryRun.dry_run)"
Write-Host "Secciones guia faltantes: $($MissingGuideSections.Count)"
Write-Host "Guia: $GuidePath"
