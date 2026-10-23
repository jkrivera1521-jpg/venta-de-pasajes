param(
  [string]$ImageTag = "0.1.0-native",
  [switch]$PlanOnly,
  [switch]$SkipNativeBuild,
  [switch]$SkipDockerBuild,
  [switch]$Push
)

$ErrorActionPreference = "Stop"
$Root = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$ServiceRoot = Join-Path $Root "services\report-service"
$Pom = Join-Path $ServiceRoot "pom.xml"
$Dockerfile = Join-Path $ServiceRoot "src\main\docker\Dockerfile.native"

if (-not (Test-Path $Pom)) { throw "No existe $Pom" }
if (-not (Test-Path $Dockerfile)) { throw "No existe $Dockerfile" }
if ($PlanOnly) {
  [pscustomobject]@{ service = "report-service"; pom = $Pom; dockerfile = $Dockerfile; image_tag = $ImageTag; ready = $true } | ConvertTo-Json -Compress
  return
}
if (-not $SkipNativeBuild) { mvn -f $Pom package -Dnative -DskipTests -Dquarkus.native.container-build=true }
if (-not $SkipDockerBuild) { docker build -f $Dockerfile -t "report-service:$ImageTag" $ServiceRoot }
if ($Push) { Write-Error "El push requiere configurar el repositorio Artifact Registry y la cuenta de despliegue." }
