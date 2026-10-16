$ErrorActionPreference = "Stop"

$Root = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$ComposeFile = Join-Path $Root "services\aviatorscript-service\docker-compose.yml"

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw "Docker no esta instalado o no esta disponible en PATH."
}

docker compose -f $ComposeFile down
if ($LASTEXITCODE -ne 0) {
  throw "No se pudo detener PostgreSQL para aviatorscript-service."
}
