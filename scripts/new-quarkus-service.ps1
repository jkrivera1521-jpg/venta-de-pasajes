param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern("^[a-z][a-z0-9-]*-service$")]
    [string]$ServiceName,

    [ValidatePattern("^[a-z][a-z0-9]*$")]
    [string]$PackageSegment,

    [string]$DatabaseName,
    [int]$HttpPort = 8080,
    [string]$ProjectId = "project-fbb34cd7-0b82-43e1-867",
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

$Root = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")
$ServicesRoot = Join-Path $Root "services"
$TemplateRoot = Join-Path $ServicesRoot "quarkus-service-template"
$TargetRoot = Join-Path $ServicesRoot $ServiceName

if (!(Test-Path -LiteralPath $TemplateRoot)) {
    throw "Template was not found: $TemplateRoot"
}

$DomainName = $ServiceName -replace "-service$", ""

if (-not $PackageSegment) {
    $PackageSegment = ($DomainName -replace "[^a-z0-9]", "")
}

if (-not $DatabaseName) {
    $DatabaseName = ($PackageSegment + "_db")
}

$PascalName = ConvertTo-PascalCase -Value $DomainName
$RunServiceAccountId = $ServiceName -replace "-service$", "-service-run"
$RunDatabaseUser = "$RunServiceAccountId@$ProjectId.iam"
$LocalDatabaseUser = $PackageSegment + "_user"
$SecretName = "$ServiceName`__db-connection"
$ApiBasePath = "/api/v1/$DomainName"

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
        service_name = $ServiceName
        package = "com.ventapasajes.$PackageSegment"
        database_name = $DatabaseName
        http_port = $HttpPort
        target_root = $TargetRoot
        cloud_sql_iam_user = $RunDatabaseUser
        local_database_user = $LocalDatabaseUser
        secret_name = $SecretName
        api_base_path = $ApiBasePath
        target_exists = $TargetExists
        only_gitkeep = $OnlyGitkeep
        target_item_count = $TargetItemCount
        dry_run = $true
    } | ConvertTo-Json -Depth 5 -Compress
    return
}

if ($TargetExists -and $TargetItemCount -gt 0 -and -not $OnlyGitkeep -and -not $Force) {
    throw "Target service is not empty. Use -Force to overwrite generated files: $TargetRoot"
}

New-Item -ItemType Directory -Force -Path $TargetRoot | Out-Null

if ($OnlyGitkeep) {
    Remove-Item -LiteralPath (Join-Path $TargetRoot ".gitkeep") -Force
}

Get-ChildItem -LiteralPath $TemplateRoot -Force | Where-Object {
    $_.Name -notin @("target", ".gitkeep")
} | ForEach-Object {
    Copy-Item -LiteralPath $_.FullName -Destination $TargetRoot -Recurse -Force
}

foreach ($RelativePackageRoot in @(
    "src\main\java\com\ventapasajes",
    "src\test\java\com\ventapasajes"
)) {
    $SourcePackageRoot = Join-Path $TargetRoot (Join-Path $RelativePackageRoot "template")
    $TargetPackageRoot = Join-Path $TargetRoot (Join-Path $RelativePackageRoot $PackageSegment)

    if (Test-Path -LiteralPath $SourcePackageRoot) {
        Move-Item -LiteralPath $SourcePackageRoot -Destination $TargetPackageRoot -Force
    }
}

$Replacements = [ordered]@{
    "quarkus-service-template" = $ServiceName
    "template_db" = $DatabaseName
    "template_user" = $LocalDatabaseUser
    "template-service-run@project-fbb34cd7-0b82-43e1-867.iam" = $RunDatabaseUser
    "template-service__db-connection" = $SecretName
    "/api/v1/template" = $ApiBasePath
    "QUARKUS_HTTP_PORT:8080" = "QUARKUS_HTTP_PORT:$HttpPort"
    "com.ventapasajes.template" = "com.ventapasajes.$PackageSegment"
    "Template" = $PascalName
}

$TextExtensions = @(".java", ".xml", ".properties", ".md", ".sql", ".yml", ".yaml")
$Utf8NoBom = [System.Text.UTF8Encoding]::new($false)

Get-ChildItem -LiteralPath $TargetRoot -Recurse -File | Where-Object {
    $TextExtensions -contains $_.Extension.ToLowerInvariant()
} | ForEach-Object {
    $Content = Get-Content -LiteralPath $_.FullName -Raw

    foreach ($Entry in $Replacements.GetEnumerator()) {
        $Content = $Content.Replace($Entry.Key, $Entry.Value)
    }

    [System.IO.File]::WriteAllText($_.FullName, $Content, $Utf8NoBom)
}

Get-ChildItem -LiteralPath $TargetRoot -Recurse -File | Where-Object {
    $_.Name -like "*Template*"
} | Sort-Object FullName -Descending | ForEach-Object {
    Rename-Item -LiteralPath $_.FullName -NewName ($_.Name.Replace("Template", $PascalName))
}

[pscustomobject]@{
    service_name = $ServiceName
    package = "com.ventapasajes.$PackageSegment"
    database_name = $DatabaseName
    http_port = $HttpPort
    target_root = $TargetRoot
    cloud_sql_iam_user = $RunDatabaseUser
    local_database_user = $LocalDatabaseUser
    secret_name = $SecretName
    api_base_path = $ApiBasePath
    dry_run = $false
} | ConvertTo-Json -Depth 5 -Compress
