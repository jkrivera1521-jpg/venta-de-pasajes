param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern("^mfe-[a-z][a-z0-9-]*$")]
    [string]$MfeName,

    [ValidatePattern("^[a-z][a-z0-9-]*$")]
    [string]$PackageSegment,

    [string]$Title,
    [int]$LocalPort = 3006,
    [int]$BackendPort = 8080,
    [string]$BackendApiUrl,
    [switch]$DryRun,
    [switch]$Force
)

$ErrorActionPreference = "Stop"

function ConvertTo-PascalCase {
    param([string]$Value)

    $Parts = @($Value -split "[^a-zA-Z0-9]+" | Where-Object { $_ })
    return (($Parts | ForEach-Object {
        $_.Substring(0, 1).ToUpperInvariant() + $_.Substring(1).ToLowerInvariant()
    }) -join "")
}

$Root = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$AppsRoot = Join-Path $Root "apps"
$TemplateRoot = Join-Path $Root "templates\next-mfe\files"
$TargetRoot = Join-Path $AppsRoot $MfeName

if (-not (Test-Path -LiteralPath $TemplateRoot)) {
    throw "Template was not found: $TemplateRoot"
}

$DomainName = $MfeName -replace "^mfe-", ""

if (-not $PackageSegment) {
    $PackageSegment = $DomainName
}

if (-not $Title) {
    $Title = ConvertTo-PascalCase -Value $PackageSegment
}

if (-not $BackendApiUrl) {
    $BackendApiUrl = "http://localhost:$BackendPort/api/v1/$PackageSegment"
}

$PascalName = ConvertTo-PascalCase -Value $PackageSegment
$ApiEnvPrefix = $PackageSegment.ToUpperInvariant().Replace("-", "_")
$WorkspaceName = "@venta-pasajes/$MfeName"
$WorkspacePath = "apps/$MfeName"
$DevScriptName = "dev:$MfeName"

$TargetExists = Test-Path -LiteralPath $TargetRoot
$OnlyGitkeep = $false
$TargetItemCount = 0

if ($TargetExists) {
    $Items = @(Get-ChildItem -LiteralPath $TargetRoot -Force)
    $TargetItemCount = @($Items).Count
    $OnlyGitkeep = @($Items).Count -eq 1 -and $Items[0].Name -eq ".gitkeep"
}

if ($DryRun) {
    [pscustomobject]@{
        mfe_name = $MfeName
        workspace_name = $WorkspaceName
        package_segment = $PackageSegment
        title = $Title
        local_port = $LocalPort
        backend_api_url = $BackendApiUrl
        target_root = $TargetRoot
        workspace_path = $WorkspacePath
        suggested_dev_script = $DevScriptName
        target_exists = $TargetExists
        only_gitkeep = $OnlyGitkeep
        target_item_count = $TargetItemCount
        dry_run = $true
    } | ConvertTo-Json -Depth 5 -Compress
    return
}

if ($TargetExists -and $TargetItemCount -gt 0 -and -not $OnlyGitkeep -and -not $Force) {
    throw "Target MFE is not empty. Use -Force to overwrite generated files: $TargetRoot"
}

New-Item -ItemType Directory -Force -Path $TargetRoot | Out-Null

if ($OnlyGitkeep) {
    Remove-Item -LiteralPath (Join-Path $TargetRoot ".gitkeep") -Force
}

Get-ChildItem -LiteralPath $TemplateRoot -Force | ForEach-Object {
    Copy-Item -LiteralPath $_.FullName -Destination $TargetRoot -Recurse -Force
}

Get-ChildItem -LiteralPath $TargetRoot -Recurse -Directory -Force |
    Where-Object { $_.Name -eq "__PACKAGE_SEGMENT__" } |
    Sort-Object FullName -Descending |
    ForEach-Object {
        Rename-Item -LiteralPath $_.FullName -NewName $PackageSegment
    }

$Replacements = [ordered]@{
    "__MFE_NAME__" = $MfeName
    "__PACKAGE_SEGMENT__" = $PackageSegment
    "__PASCAL_NAME__" = $PascalName
    "__TITLE__" = $Title
    "__LOCAL_PORT__" = [string]$LocalPort
    "__BACKEND_DEFAULT_URL__" = $BackendApiUrl
    "__API_ENV_PREFIX__" = $ApiEnvPrefix
}

$TextExtensions = @(".ts", ".tsx", ".json", ".css", ".example", ".md", ".js", ".mjs")
$Utf8NoBom = [System.Text.UTF8Encoding]::new($false)

Get-ChildItem -LiteralPath $TargetRoot -Recurse -File -Force | Where-Object {
    $TextExtensions -contains $_.Extension.ToLowerInvariant()
} | ForEach-Object {
    $Content = Get-Content -LiteralPath $_.FullName -Raw

    foreach ($Entry in $Replacements.GetEnumerator()) {
        $Content = $Content.Replace($Entry.Key, $Entry.Value)
    }

    [System.IO.File]::WriteAllText($_.FullName, $Content, $Utf8NoBom)
}

[pscustomobject]@{
    mfe_name = $MfeName
    workspace_name = $WorkspaceName
    package_segment = $PackageSegment
    title = $Title
    local_port = $LocalPort
    backend_api_url = $BackendApiUrl
    target_root = $TargetRoot
    workspace_path = $WorkspacePath
    suggested_dev_script = $DevScriptName
    dry_run = $false
} | ConvertTo-Json -Depth 5 -Compress
