param(
  [string]$OutputDir = "logs\technical-documentation",
  [string]$ManualPath = "docs\manual-tecnico.md",
  [string]$DiagramsPath = "docs\diagramas-finales.md",
  [string]$BackendConfigPath = "infra\cloudrun\prod-backend-services.json",
  [string]$FrontendConfigPath = "infra\cloudrun\prod-frontend-services.json",
  [string]$CloudSqlConfigPath = "infra\gcloud\cloudsql-prod.json",
  [string]$PubSubConfigPath = "infra\gcloud\pubsub-prod.json",
  [string]$PackageJsonPath = "package.json",
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

function Get-ServiceRole {
  param([string]$Id)

  $Roles = @{
    "identity-service" = "Autenticacion, usuarios, roles, permisos e identidades autorizadas."
    "dispatch-service" = "Terminales, rutas, tipos de bus, buses, layouts y salidas programadas."
    "ticketing-service" = "Disponibilidad, reservas, pasajeros, boletos, anulaciones y referencias documentales."
    "document-service" = "Plantillas, generacion de PDF de boleto y almacenamiento documental."
    "reporting-service" = "Modelo de lectura para ventas, pasajeros, usuarios, buses, reportes y exportaciones."
    "audit-service" = "Auditoria funcional inmutable y consulta de eventos auditables."
    "frontend-shell" = "Entrada principal, layout, sesion y carga de microfrontends por manifiesto."
    "mfe-identity" = "Interfaz de usuarios, roles, permisos e identidades."
    "mfe-dispatch" = "Interfaz de terminales, rutas, buses, layouts y salidas."
    "mfe-ticketing" = "Interfaz de venta, reserva, mapa de asientos, anulacion y reimpresion."
    "mfe-reporting" = "Interfaz de reportes operativos."
    "mfe-admin" = "Interfaz de administracion, salud, runbook, diagnostico y readiness."
  }

  if ($Roles.ContainsKey($Id)) {
    return $Roles[$Id]
  }

  return "Modulo tecnico del monorepo."
}

function Get-DatabaseInventory {
  param([string]$DatabaseDir)

  return @(Get-ChildItem -LiteralPath $DatabaseDir -Filter "*.sql" -File | Sort-Object Name | ForEach-Object {
    $Content = Get-Content -LiteralPath $_.FullName -Raw
    $Tables = [regex]::Matches($Content, "(?im)^CREATE TABLE\s+([a-zA-Z0-9_]+)") | ForEach-Object { $_.Groups[1].Value }
    $Indexes = [regex]::Matches($Content, "(?im)^CREATE INDEX\s+([a-zA-Z0-9_]+)") | ForEach-Object { $_.Groups[1].Value }
    [pscustomobject]@{
      file = $_.Name
      database = [System.IO.Path]::GetFileNameWithoutExtension($_.Name)
      tables = @($Tables)
      indexes = @($Indexes)
    }
  })
}

function Get-OpenApiInventory {
  param([string]$OpenApiDir)

  return @(Get-ChildItem -LiteralPath $OpenApiDir -Filter "*.yaml" -File | Sort-Object Name | ForEach-Object {
    $Content = Get-Content -LiteralPath $_.FullName -Raw
    $TitleMatch = [regex]::Match($Content, "(?m)^  title:\s*(.+)$")
    $VersionMatch = [regex]::Match($Content, "(?m)^  version:\s*(.+)$")
    $Paths = [regex]::Matches($Content, "(?m)^  (/[^:]+):") | ForEach-Object { $_.Groups[1].Value }
    [pscustomobject]@{
      file = $_.Name
      title = if ($TitleMatch.Success) { $TitleMatch.Groups[1].Value.Trim() } else { $_.BaseName }
      version = if ($VersionMatch.Success) { $VersionMatch.Groups[1].Value.Trim() } else { "" }
      paths = @($Paths)
    }
  })
}

function Get-EventInventory {
  param([string]$CatalogPath)

  if (-not (Test-Path -LiteralPath $CatalogPath)) {
    return @()
  }

  $Lines = Get-Content -LiteralPath $CatalogPath
  return @($Lines | ForEach-Object {
    $Match = [regex]::Match($_, '^\|\s*`([^`]+)`\s*\|\s*`([^`]+)`\s*\|\s*`([^`]+)`\s*\|')
    if ($Match.Success) {
      [pscustomobject]@{
        event = $Match.Groups[1].Value
        source_service = $Match.Groups[2].Value
        topic = $Match.Groups[3].Value
      }
    }
  })
}

function Get-WorkflowInventory {
  param([string]$WorkflowDir)

  return @(Get-ChildItem -LiteralPath $WorkflowDir -Filter "*.yml" -File | Sort-Object Name | ForEach-Object {
    $Content = Get-Content -LiteralPath $_.FullName -Raw
    $Lines = Get-Content -LiteralPath $_.FullName
    $NameMatch = [regex]::Match($Content, "(?m)^name:\s*(.+)$")
    $Jobs = [System.Collections.Generic.List[string]]::new()
    $InJobs = $false
    foreach ($Line in $Lines) {
      if ($Line -match "^jobs:\s*$") {
        $InJobs = $true
        continue
      }

      if ($InJobs -and $Line -match "^  ([a-zA-Z0-9_-]+):\s*$") {
        $Jobs.Add($Matches[1])
      }
    }

    [pscustomobject]@{
      file = $_.Name
      name = if ($NameMatch.Success) { $NameMatch.Groups[1].Value.Trim() } else { $_.BaseName }
      jobs = @($Jobs)
    }
  })
}

function Write-Manual {
  param(
    [string]$Path,
    [object]$PackageJson,
    [object[]]$Services,
    [object]$CloudSqlConfig,
    [object]$PubSubConfig,
    [object[]]$Databases,
    [object[]]$OpenApis,
    [object[]]$Events,
    [object[]]$Workflows
  )

  $FrontendPackage = Read-JsonFile -Path (Resolve-ProjectPath "apps\frontend-shell\package.json")
  $AdminPackage = Read-JsonFile -Path (Resolve-ProjectPath "apps\mfe-admin\package.json")
  $QuarkusVersion = ""
  $JavaVersion = ""
  $PomPath = Resolve-ProjectPath "services\identity-service\pom.xml"
  if (Test-Path -LiteralPath $PomPath) {
    $Pom = [xml](Get-Content -LiteralPath $PomPath -Raw)
    $QuarkusVersion = [string]$Pom.project.properties.'quarkus.platform.version'
    $JavaVersion = [string]$Pom.project.properties.'maven.compiler.release'
  }

  $Lines = @(
    "# Manual tecnico",
    "",
    "Fecha base: 2026-09-29",
    "",
    "## Proposito",
    "",
    "Este manual consolida la arquitectura tecnica del sistema Venta de Pasajes para que otro tecnico pueda mantener el monorepo, entender los limites de cada modulo, validar bases de datos, revisar eventos, ejecutar pipelines y desplegar en Google Cloud.",
    "",
    "## Stack principal",
    "",
    "| Capa | Tecnologia | Version / regla |",
    "| --- | --- | --- |",
    "| Frontend | Next.js App Router | $($FrontendPackage.dependencies.next) |",
    "| Frontend | React | $($FrontendPackage.dependencies.react) |",
    "| Frontend | TanStack Query | $($FrontendPackage.dependencies.'@tanstack/react-query') |",
    "| Frontend | TanStack Table | $($AdminPackage.dependencies.'@tanstack/react-table') en mfe-admin |",
    "| Frontend | TypeScript | $($PackageJson.devDependencies.typescript), modo strict |",
    "| Backend | Quarkus | $QuarkusVersion |",
    "| Backend | Java | $JavaVersion |",
    "| Backend | Persistencia | Hibernate ORM Panache, JDBC PostgreSQL, Flyway |",
    "| Infra | Google Cloud | Cloud Run, Cloud SQL PostgreSQL 16, Artifact Registry, Secret Manager, Pub/Sub, Cloud Storage |",
    "| CI | GitHub Actions | windows-latest, Node 24, Java 21 |",
    "",
    "## Arquitectura general",
    "",
    "El sistema es un monorepo con frontends Next.js y backends Quarkus. La entrada principal es frontend-shell. Cada MFE se despliega como un servicio Cloud Run independiente y expone un manifiesto en /mfe/manifest. Los backends productivos son privados y se invocan mediante identidad de servicio cuando el trafico sale desde los MFEs.",
    "",
    "Cada microservicio backend conserva su propia base de datos. No hay llaves foraneas entre bases de distintos servicios. La sincronizacion entre dominios se realiza con eventos, outbox, modelos de lectura y snapshots.",
    "",
    "## Modulos frontend",
    "",
    "| Aplicacion | Servicio Cloud Run | Puerto | Rol |",
    "| --- | --- | --- | --- |"
  )

  foreach ($Service in @($Services | Where-Object { [string]$_.group -eq "frontend" } | Sort-Object id)) {
    $Lines += "| $($Service.id) | $($Service.service_name) | $($Service.port) | $(Get-ServiceRole -Id $Service.id) |"
  }

  $Lines += @(
    "",
    "## Microservicios backend",
    "",
    "| Servicio | Cloud Run | Puerto | Base | Rol |",
    "| --- | --- | --- | --- | --- |"
  )

  foreach ($Service in @($Services | Where-Object { [string]$_.group -eq "backend" } | Sort-Object id)) {
    $Db = @($CloudSqlConfig.databases | Where-Object { [string]$_.owner_service -eq [string]$Service.id } | Select-Object -First 1)
    $DbName = if ($Db.Count -gt 0) { [string]$Db[0].name } else { "" }
    $Lines += "| $($Service.id) | $($Service.service_name) | $($Service.port) | $DbName | $(Get-ServiceRole -Id $Service.id) |"
  }

  $Lines += @(
    "",
    "## Bases de datos",
    "",
    "Instancia productiva: $($CloudSqlConfig.instance.name), region $($CloudSqlConfig.instance.region), version $($CloudSqlConfig.instance.database_version), tier $($CloudSqlConfig.instance.tier), storage $($CloudSqlConfig.instance.storage_size_gb)GB $($CloudSqlConfig.instance.storage_type).",
    "",
    "| Archivo | Base logica | Tablas principales | Indices definidos |",
    "| --- | --- | --- | --- |"
  )

  foreach ($Db in $Databases) {
    $TableList = ($Db.tables -join ", ")
    $IndexCount = @($Db.indexes).Count
    $Lines += "| docs/database/$($Db.file) | $($Db.database) | $TableList | $IndexCount |"
  }

  $Lines += @(
    "",
    "## APIs",
    "",
    "Las especificaciones viven en docs/openapi. Los paths se documentan sin el prefijo productivo /api/v1/{dominio} cuando el archivo OpenAPI ya representa el dominio.",
    "",
    "| API | Version | Paths principales |",
    "| --- | --- | --- |"
  )

  foreach ($Api in $OpenApis) {
    $PathList = ($Api.paths -join ", ")
    $Lines += "| $($Api.title) | $($Api.version) | $PathList |"
  }

  $Lines += @(
    "",
    "## Eventos y mensajeria",
    "",
    "Los eventos usan el sobre comun documentado en docs/events/event-envelope.schema.json. Pub/Sub productivo esta descrito en infra/gcloud/pubsub-prod.json.",
    "",
    "| Evento | Origen | Topic logico |",
    "| --- | --- | --- |"
  )

  foreach ($Event in $Events) {
    $Lines += "| $($Event.event) | $($Event.source_service) | $($Event.topic) |"
  }

  $Lines += @(
    "",
    "### Topics productivos",
    "",
    "| Topic | Publicador |",
    "| --- | --- |"
  )

  foreach ($Topic in @($PubSubConfig.topics | Sort-Object name)) {
    $Publishers = @($Topic.publisher_service_accounts) -join ", "
    $Lines += "| $($Topic.name) | $Publishers |"
  }

  $Lines += @(
    "",
    "## Pipelines",
    "",
    "| Workflow | Archivo | Jobs |",
    "| --- | --- | --- |"
  )

  foreach ($Workflow in $Workflows) {
    $Lines += "| $($Workflow.name) | .github/workflows/$($Workflow.file) | $($Workflow.jobs -join ', ') |"
  }

  $Lines += @(
    "",
    "## Despliegues",
    "",
    "Ambientes principales:",
    "",
    "- dev: definido en infra/cloudrun/dev-services.json.",
    "- staging: infraestructura y restauracion base documentadas desde Dia 68.",
    "- prod: backends en infra/cloudrun/prod-backend-services.json, frontends en infra/cloudrun/prod-frontend-services.json, IAM en infra/gcloud/iam-prod.json, secretos en infra/gcloud/secrets-prod.json, Pub/Sub en infra/gcloud/pubsub-prod.json.",
    "",
    "Reglas de despliegue:",
    "",
    "- Los backends productivos deben permanecer privados.",
    "- Los frontends productivos pueden ser publicos cuando actuan como entrada de usuario.",
    "- Secretos reales no se guardan en el repositorio.",
    "- Cloud SQL usa una base por microservicio y usuarios IAM dedicados.",
    "- Los cambios destructivos o productivos requieren confirmacion explicita y evidencia previa.",
    "",
    "## Operacion y mantenimiento",
    "",
    "Comandos utiles:",
    "",
    '```powershell',
    "cd C:\VENTA-DE-PASAJES",
    "npm run typecheck:frontend",
    "npm run build:frontend",
    "mvn -f .\services\identity-service\pom.xml test",
    "powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-cloudrun-prod-backends.ps1",
    "powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-cloudrun-prod-frontends.ps1",
    '```',
    "",
    "No existe pom.xml raiz Maven. Las pruebas backend se ejecutan por servicio o por matriz CI.",
    "",
    "## Rutas de referencia",
    "",
    "- docs/api-conventions.md",
    "- docs/naming-standards.md",
    "- docs/branching-and-commits.md",
    "- docs/events/catalogo-eventos.md",
    "- docs/events/diseno-pubsub.md",
    "- docs/database",
    "- docs/openapi",
    "- infra/README.md",
    "- docs/onpremise-offline-runbook.md"
  )

  Set-Content -LiteralPath $Path -Value $Lines -Encoding UTF8
}

function Write-Diagrams {
  param(
    [string]$Path,
    [object[]]$Services,
    [object]$CloudSqlConfig,
    [object]$PubSubConfig
  )

  $Lines = @(
    "# Diagramas finales",
    "",
    "Fecha base: 2026-09-29",
    "",
    "Los diagramas estan en Mermaid para poder versionarlos en Git y actualizarlos junto con el codigo.",
    "",
    "## Vista general",
    "",
    '```mermaid',
    "flowchart LR",
    "  Usuario[Usuario operativo] --> Shell[frontend-shell-prod]",
    "  Shell --> MFEID[mfe-identity-prod]",
    "  Shell --> MFEDIS[mfe-dispatch-prod]",
    "  Shell --> MFETIC[mfe-ticketing-prod]",
    "  Shell --> MFERPT[mfe-reporting-prod]",
    "  Shell --> MFEADM[mfe-admin-prod]",
    "  MFEID --> ID[identity-service-prod]",
    "  MFEDIS --> DIS[dispatch-service-prod]",
    "  MFETIC --> TIC[ticketing-service-prod]",
    "  MFERPT --> RPT[reporting-service-prod]",
    "  MFEADM --> AUD[audit-service-prod]",
    "  MFETIC --> DOC[document-service-prod]",
    "  ID --> SQL[(Cloud SQL prod)]",
    "  DIS --> SQL",
    "  TIC --> SQL",
    "  DOC --> SQL",
    "  RPT --> SQL",
    "  AUD --> SQL",
    "  DOC --> GCS[(Cloud Storage documentos)]",
    "  ID --> PUB[(Pub/Sub)]",
    "  DIS --> PUB",
    "  TIC --> PUB",
    "  DOC --> PUB",
    "  AUD --> PUB",
    "  PUB --> RPT",
    "  PUB --> AUD",
    '```',
    "",
    "## Microservicios y bases",
    "",
    '```mermaid',
    "flowchart TB"
  )

  foreach ($Service in @($Services | Where-Object { [string]$_.group -eq "backend" } | Sort-Object id)) {
    $SafeService = ([string]$Service.id).Replace("-", "_")
    $Db = @($CloudSqlConfig.databases | Where-Object { [string]$_.owner_service -eq [string]$Service.id } | Select-Object -First 1)
    $DbName = if ($Db.Count -gt 0) { [string]$Db[0].name } else { "database" }
    $SafeDb = $DbName.Replace("-", "_")
    $Lines += "  $SafeService[$($Service.id)] --> $SafeDb[($DbName)]"
  }

  $Lines += @(
    '```',
    "",
    "## Eventos principales",
    "",
    '```mermaid',
    "flowchart LR",
    "  identity[identity-service] --> identityTopic[identity-events]",
    "  dispatch[dispatch-service] --> dispatchTopic[dispatch-events]",
    "  ticketing[ticketing-service] --> ticketingTopic[ticketing-events]",
    "  document[document-service] --> documentTopic[document-events]",
    "  audit[audit-service] --> auditTopic[audit-events]",
    "  identityTopic --> audit",
    "  identityTopic --> reporting[reporting-service]",
    "  dispatchTopic --> audit",
    "  dispatchTopic --> reporting",
    "  dispatchTopic --> ticketing",
    "  ticketingTopic --> audit",
    "  ticketingTopic --> reporting",
    "  ticketingTopic --> document",
    "  documentTopic --> audit",
    "  documentTopic --> reporting",
    "  auditTopic --> reporting",
    '```',
    "",
    "## Despliegue productivo",
    "",
    '```mermaid',
    "flowchart TB",
    "  GitHub[GitHub main/develop] --> CI[GitHub Actions]",
    "  CI --> Artifact[Artifact Registry]",
    "  Artifact --> CloudRun[Cloud Run prod]",
    "  CloudRun --> SecretManager[Secret Manager]",
    "  CloudRun --> CloudSql[(Cloud SQL prod)]",
    "  CloudRun --> PubSub[(Pub/Sub prod)]",
    "  CloudRun --> Storage[(Bucket documentos)]",
    "  HTTPS[Load Balancer HTTPS] --> Shell[frontend-shell-prod]",
    "  Shell --> MFE[MFEs prod]",
    "  MFE --> Backend[Backends privados]",
    '```'
  )

  Set-Content -LiteralPath $Path -Value $Lines -Encoding UTF8
}

$RunId = Get-Date -Format "yyyyMMdd-HHmmss"
$OutputPath = Resolve-ProjectPath -Path $OutputDir
$ManualFullPath = Resolve-ProjectPath -Path $ManualPath
$DiagramsFullPath = Resolve-ProjectPath -Path $DiagramsPath
$BackendConfigFullPath = Resolve-ProjectPath -Path $BackendConfigPath
$FrontendConfigFullPath = Resolve-ProjectPath -Path $FrontendConfigPath
$CloudSqlConfigFullPath = Resolve-ProjectPath -Path $CloudSqlConfigPath
$PubSubConfigFullPath = Resolve-ProjectPath -Path $PubSubConfigPath
$PackageJsonFullPath = Resolve-ProjectPath -Path $PackageJsonPath

New-Item -ItemType Directory -Force -Path $OutputPath | Out-Null

$Checks = [System.Collections.Generic.List[object]]::new()
$TechnicalBlockers = [System.Collections.Generic.List[string]]::new()

$RequiredPaths = @(
  $BackendConfigFullPath,
  $FrontendConfigFullPath,
  $CloudSqlConfigFullPath,
  $PubSubConfigFullPath,
  $PackageJsonFullPath,
  (Resolve-ProjectPath "docs\database"),
  (Resolve-ProjectPath "docs\openapi"),
  (Resolve-ProjectPath "docs\events\catalogo-eventos.md"),
  (Resolve-ProjectPath ".github\workflows")
)

foreach ($RequiredPath in $RequiredPaths) {
  $Exists = Test-Path -LiteralPath $RequiredPath
  Add-Check -Checks $Checks -Area "input" -Name $RequiredPath -Passed $Exists
  if (-not $Exists) {
    $TechnicalBlockers.Add("No existe insumo requerido: $RequiredPath")
  }
}

$BackendConfig = Read-JsonFile -Path $BackendConfigFullPath
$FrontendConfig = Read-JsonFile -Path $FrontendConfigFullPath
$CloudSqlConfig = Read-JsonFile -Path $CloudSqlConfigFullPath
$PubSubConfig = Read-JsonFile -Path $PubSubConfigFullPath
$PackageJson = Read-JsonFile -Path $PackageJsonFullPath

$Services = @()
if ($BackendConfig -and $FrontendConfig) {
  $Services = @($BackendConfig.services + ($FrontendConfig.services | Where-Object { [string]$_.group -eq "frontend" }))
}

$Databases = @(Get-DatabaseInventory -DatabaseDir (Resolve-ProjectPath "docs\database"))
$OpenApis = @(Get-OpenApiInventory -OpenApiDir (Resolve-ProjectPath "docs\openapi"))
$Events = @(Get-EventInventory -CatalogPath (Resolve-ProjectPath "docs\events\catalogo-eventos.md"))
$Workflows = @(Get-WorkflowInventory -WorkflowDir (Resolve-ProjectPath ".github\workflows"))

if ($Services.Count -lt 12) {
  $TechnicalBlockers.Add("El inventario esperado debe incluir 12 servicios productivos; encontrados: $($Services.Count).")
}

if ($Databases.Count -lt 6) {
  $TechnicalBlockers.Add("El inventario esperado debe incluir 6 archivos de base de datos; encontrados: $($Databases.Count).")
}

if ($OpenApis.Count -lt 6) {
  $TechnicalBlockers.Add("El inventario esperado debe incluir 6 especificaciones OpenAPI; encontrados: $($OpenApis.Count).")
}

if ($TechnicalBlockers.Count -eq 0) {
  Write-Manual `
    -Path $ManualFullPath `
    -PackageJson $PackageJson `
    -Services $Services `
    -CloudSqlConfig $CloudSqlConfig `
    -PubSubConfig $PubSubConfig `
    -Databases $Databases `
    -OpenApis $OpenApis `
    -Events $Events `
    -Workflows $Workflows

  Write-Diagrams `
    -Path $DiagramsFullPath `
    -Services $Services `
    -CloudSqlConfig $CloudSqlConfig `
    -PubSubConfig $PubSubConfig
}

$Inventory = [pscustomobject]@{
  generated_at = (Get-Date).ToString("o")
  services = @($Services | Select-Object id, group, service_name, source_path, port, allow_unauthenticated, cloud_sql, cpu, memory, min_instances, max_instances, health_path)
  databases = $Databases
  openapi = $OpenApis
  events = $Events
  workflows = $Workflows
}

$InventoryPath = Join-Path $OutputPath "dia84-technical-documentation-inventory.json"
$ReadinessPath = Join-Path $OutputPath "dia84-technical-documentation-readiness.json"
$Inventory | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $InventoryPath -Encoding UTF8

$RequiredSections = @(
  "# Manual tecnico",
  "## Arquitectura general",
  "## Modulos frontend",
  "## Microservicios backend",
  "## Bases de datos",
  "## APIs",
  "## Eventos y mensajeria",
  "## Pipelines",
  "## Despliegues"
)

$ManualText = if (Test-Path -LiteralPath $ManualFullPath) { Get-Content -LiteralPath $ManualFullPath -Raw } else { "" }
$DiagramsText = if (Test-Path -LiteralPath $DiagramsFullPath) { Get-Content -LiteralPath $DiagramsFullPath -Raw } else { "" }

foreach ($Section in $RequiredSections) {
  Add-Check -Checks $Checks -Area "manual" -Name $Section -Passed ($ManualText.Contains($Section))
}

$DiagramCount = ([regex]::Matches($DiagramsText, '```mermaid')).Count
Add-Check -Checks $Checks -Area "diagramas" -Name "Diagramas Mermaid generados" -Passed ($DiagramCount -ge 4) -Detail "diagram_count=$DiagramCount"

$Result = [pscustomobject]@{
  generated_at = (Get-Date).ToString("o")
  run_id = $RunId
  ready_for_technical_documentation = $TechnicalBlockers.Count -eq 0
  manual_generated = Test-Path -LiteralPath $ManualFullPath
  diagrams_generated = Test-Path -LiteralPath $DiagramsFullPath
  services_count = $Services.Count
  database_files_count = $Databases.Count
  openapi_files_count = $OpenApis.Count
  events_count = $Events.Count
  workflows_count = $Workflows.Count
  manual_path = $ManualFullPath
  diagrams_path = $DiagramsFullPath
  inventory_path = $InventoryPath
  checks = @($Checks)
  technical_blockers = @($TechnicalBlockers)
}

$Result | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $ReadinessPath -Encoding UTF8

Write-Host "Documentacion tecnica lista: $($Result.ready_for_technical_documentation)"
Write-Host "Manual tecnico generado: $($Result.manual_generated)"
Write-Host "Diagramas finales generados: $($Result.diagrams_generated)"
Write-Host "Servicios inventariados: $($Result.services_count)"
Write-Host "Bases inventariadas: $($Result.database_files_count)"
Write-Host "OpenAPI inventariados: $($Result.openapi_files_count)"
Write-Host "Eventos inventariados: $($Result.events_count)"
Write-Host "Pipelines inventariados: $($Result.workflows_count)"
Write-Host "Bloqueos tecnicos: $($TechnicalBlockers.Count)"

if ($FailOnBlocker -and $TechnicalBlockers.Count -gt 0) {
  throw "Dia 84 tiene bloqueos. Revise $ReadinessPath."
}
