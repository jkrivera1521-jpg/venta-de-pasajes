param(
  [string[]]$Apps = @(
    "frontend-shell",
    "mfe-identity",
    "mfe-dispatch",
    "mfe-ticketing",
    "mfe-reporting",
    "mfe-admin"
  ),
  [string]$Version = "",
  [string]$OutputRoot = "artifacts\frontend",
  [switch]$SkipBuild,
  [switch]$SkipSharedTypesBuild
)

$ErrorActionPreference = "Stop"

$ProjectRoot = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")
$ProjectRoot = $ProjectRoot.Path
Set-Location $ProjectRoot

if ([string]::IsNullOrWhiteSpace($Version)) {
  if (-not [string]::IsNullOrWhiteSpace($env:GITHUB_SHA)) {
    $Version = $env:GITHUB_SHA
  } else {
    $Version = (Get-Date).ToUniversalTime().ToString("yyyyMMddHHmmss")
  }
}

$WorkspaceByApp = @{
  "frontend-shell" = "@venta-pasajes/frontend-shell"
  "mfe-admin" = "@venta-pasajes/mfe-admin"
  "mfe-dispatch" = "@venta-pasajes/mfe-dispatch"
  "mfe-identity" = "@venta-pasajes/mfe-identity"
  "mfe-reporting" = "@venta-pasajes/mfe-reporting"
  "mfe-ticketing" = "@venta-pasajes/mfe-ticketing"
}

function Assert-Path {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][string]$Message
  )

  if (-not (Test-Path -LiteralPath $Path)) {
    throw $Message
  }
}

Assert-Path -Path (Join-Path $ProjectRoot "package.json") -Message "No se encontro package.json en $ProjectRoot."

$UnknownApps = $Apps | Where-Object { -not $WorkspaceByApp.ContainsKey($_) }
if ($UnknownApps.Count -gt 0) {
  throw "Apps no soportadas: $($UnknownApps -join ', ')"
}

if (-not $SkipBuild -and -not $SkipSharedTypesBuild) {
  Write-Host "Building shared types..."
  npm run build -w "@venta-pasajes/shared-types"
}

$VersionRoot = Join-Path $ProjectRoot (Join-Path $OutputRoot $Version)
New-Item -ItemType Directory -Force -Path $VersionRoot | Out-Null

$Artifacts = New-Object System.Collections.Generic.List[object]

foreach ($App in $Apps) {
  $Workspace = $WorkspaceByApp[$App]
  $AppRoot = Join-Path $ProjectRoot (Join-Path "apps" $App)
  $NextRoot = Join-Path $AppRoot ".next"
  $StandaloneRoot = Join-Path $NextRoot "standalone"
  $StaticRoot = Join-Path $NextRoot "static"
  $BuildIdPath = Join-Path $NextRoot "BUILD_ID"

  Assert-Path -Path $AppRoot -Message "No existe el directorio del app: $AppRoot"
  Assert-Path -Path (Join-Path $AppRoot "package.json") -Message "No existe package.json para $App."
  Assert-Path -Path (Join-Path $AppRoot "next.config.ts") -Message "No existe next.config.ts para $App."

  if (-not $SkipBuild) {
    Write-Host "Typechecking $Workspace..."
    npm run typecheck -w $Workspace

    Write-Host "Building $Workspace..."
    npm run build -w $Workspace
  }

  Assert-Path -Path $StandaloneRoot -Message "No existe salida standalone para $App. Ejecutar build antes de empaquetar."
  Assert-Path -Path $StaticRoot -Message "No existe salida static para $App. Ejecutar build antes de empaquetar."
  Assert-Path -Path $BuildIdPath -Message "No existe BUILD_ID para $App. Ejecutar build antes de empaquetar."

  $StageRoot = Join-Path $VersionRoot $App
  $ZipPath = Join-Path $VersionRoot "$App-$Version.zip"
  if (Test-Path -LiteralPath $StageRoot) {
    Remove-Item -LiteralPath $StageRoot -Recurse -Force
  }
  if (Test-Path -LiteralPath $ZipPath) {
    Remove-Item -LiteralPath $ZipPath -Force
  }

  New-Item -ItemType Directory -Force -Path $StageRoot | Out-Null
  Copy-Item -LiteralPath $StandaloneRoot -Destination (Join-Path $StageRoot "standalone") -Recurse -Force

  $StandaloneAppRoot = Join-Path $StageRoot (Join-Path "standalone" (Join-Path "apps" $App))
  $StandaloneStaticRoot = Join-Path $StandaloneAppRoot (Join-Path ".next" "static")
  New-Item -ItemType Directory -Force -Path $StandaloneStaticRoot | Out-Null
  Copy-Item -LiteralPath (Join-Path $StaticRoot "*") -Destination $StandaloneStaticRoot -Recurse -Force

  $PublicRoot = Join-Path $AppRoot "public"
  if (Test-Path -LiteralPath $PublicRoot) {
    Copy-Item -LiteralPath $PublicRoot -Destination (Join-Path $StandaloneAppRoot "public") -Recurse -Force
  }

  $EnvExample = Join-Path $AppRoot ".env.example"
  if (Test-Path -LiteralPath $EnvExample) {
    Copy-Item -LiteralPath $EnvExample -Destination (Join-Path $StageRoot ".env.example") -Force
  }

  $BuildId = (Get-Content -LiteralPath $BuildIdPath -Raw).Trim()
  $Manifest = [ordered]@{
    app = $App
    workspace = $Workspace
    version = $Version
    build_id = $BuildId
    generated_at = (Get-Date).ToUniversalTime().ToString("o")
    artifact = (Split-Path -Leaf $ZipPath)
    entrypoint = "standalone\apps\$App\server.js"
    start_command = "node standalone\apps\$App\server.js"
  }

  $Manifest | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $StageRoot "artifact-manifest.json") -Encoding UTF8

  & tar.exe -a -cf $ZipPath -C $StageRoot .
  if ($LASTEXITCODE -ne 0) {
    throw "No se pudo crear el artefacto zip para $App en $ZipPath."
  }

  $Zip = Get-Item -LiteralPath $ZipPath

  $Artifacts.Add([pscustomobject]@{
    app = $App
    workspace = $Workspace
    version = $Version
    zip = $Zip.FullName
    size_bytes = $Zip.Length
    build_id = $BuildId
  }) | Out-Null
}

$SummaryPath = Join-Path $VersionRoot "frontend-artifacts-summary.json"
$Summary = [ordered]@{
  version = $Version
  generated_at = (Get-Date).ToUniversalTime().ToString("o")
  total = $Artifacts.Count
  artifacts = $Artifacts
}
$Summary | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $SummaryPath -Encoding UTF8

Write-Host "Frontend artifacts generated:"
$Artifacts | Format-Table -AutoSize
Write-Host "Summary: $SummaryPath"
