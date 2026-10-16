param(
  [switch]$SkipDatabase
)

$ErrorActionPreference = "Stop"

$Root = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$ServiceRoot = Join-Path $Root "services\aviatorscript-service"
$ComposeFile = Join-Path $ServiceRoot "docker-compose.yml"
$PomPath = Join-Path $ServiceRoot "pom.xml"

if (-not (Get-Command mvn -ErrorAction SilentlyContinue)) {
  throw "Maven no esta instalado o no esta disponible en PATH."
}

if (-not $SkipDatabase) {
  if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw "Docker no esta instalado o no esta disponible en PATH. Use -SkipDatabase si PostgreSQL ya esta levantado en localhost:5432."
  }

  docker compose -f $ComposeFile up -d
  if ($LASTEXITCODE -ne 0) {
    throw "No se pudo iniciar PostgreSQL para aviatorscript-service."
  }
}

mvn -f $PomPath quarkus:dev
