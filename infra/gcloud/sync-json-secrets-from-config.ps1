param(
  [string]$ProjectId = "",
  [string]$ConfigPath = $(Join-Path $PSScriptRoot "secrets-prod.json"),
  [string]$GcloudPath = "",
  [string]$CloudSdkPython = "",
  [string]$OutputDir = "logs\secrets-sync",
  [switch]$Execute
)

$ErrorActionPreference = "Stop"

$ProjectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..\..")).Path
Set-Location $ProjectRoot

function First-Value {
  param([string[]]$Values)

  foreach ($Value in $Values) {
    if (-not [string]::IsNullOrWhiteSpace($Value)) {
      return $Value
    }
  }

  return ""
}

function Initialize-CloudSdkPython {
  param([string]$ConfiguredPython)

  $PythonPath = First-Value @(
    $ConfiguredPython,
    $env:CLOUDSDK_PYTHON,
    "C:\Python312\python.exe",
    "C:\Python313\python.exe",
    "C:\Program Files\Python312\python.exe",
    "C:\Program Files\Python313\python.exe"
  )

  if ($PythonPath -and (Test-Path -LiteralPath $PythonPath)) {
    $env:CLOUDSDK_PYTHON = (Resolve-Path -LiteralPath $PythonPath).Path
  }
}

function Resolve-GcloudPath {
  param([string]$ConfiguredGcloud)

  $Candidate = First-Value @($ConfiguredGcloud, $env:GCLOUD_PATH)
  if ($Candidate) {
    if ($Candidate.EndsWith(".ps1", [System.StringComparison]::OrdinalIgnoreCase)) {
      $CmdSibling = [System.IO.Path]::ChangeExtension($Candidate, ".cmd")
      if (Test-Path -LiteralPath $CmdSibling) {
        return (Resolve-Path -LiteralPath $CmdSibling).Path
      }
    }

    if (Test-Path -LiteralPath $Candidate) {
      return (Resolve-Path -LiteralPath $Candidate).Path
    }
  }

  $KnownChocolateyPath = "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd"
  if (Test-Path -LiteralPath $KnownChocolateyPath) {
    return $KnownChocolateyPath
  }

  $Command = Get-Command gcloud.cmd -ErrorAction SilentlyContinue
  if ($Command) {
    return $Command.Source
  }

  $Command = Get-Command gcloud -ErrorAction SilentlyContinue
  if ($Command) {
    return $Command.Source
  }

  throw "No se encontro gcloud. Defina -GcloudPath con la ruta real de gcloud.cmd."
}

function Invoke-GcloudCapture {
  param(
    [string[]]$Arguments,
    [switch]$AllowFailure
  )

  $PreviousErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    $Output = & $script:GcloudPath @Arguments 2>&1
    $ExitCode = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $PreviousErrorActionPreference
  }

  $Text = ($Output | ForEach-Object { $_.ToString() }) -join [Environment]::NewLine
  if ($ExitCode -ne 0 -and -not $AllowFailure) {
    throw "gcloud fallo con codigo ${ExitCode}: $($Arguments -join ' '). Detalle: $Text"
  }

  [pscustomobject]@{
    exit_code = $ExitCode
    output = $Text
  }
}

function ConvertTo-ConfigPayload {
  param($Secret)

  return ($Secret.payload | ConvertTo-Json -Depth 10 -Compress)
}

function Get-MismatchedKeys {
  param(
    $ExpectedPayload,
    $ActualPayload
  )

  $Mismatches = New-Object System.Collections.Generic.List[string]
  foreach ($Property in $ExpectedPayload.PSObject.Properties) {
    $ActualProperty = $ActualPayload.PSObject.Properties[$Property.Name]
    if ($null -eq $ActualProperty -or ([string]$ActualProperty.Value) -ne ([string]$Property.Value)) {
      $Mismatches.Add($Property.Name) | Out-Null
    }
  }

  return $Mismatches.ToArray()
}

function Add-SecretVersion {
  param(
    [string]$SecretId,
    [string]$Payload
  )

  $TempPath = Join-Path ([System.IO.Path]::GetTempPath()) ("venta-pasajes-json-secret-" + [guid]::NewGuid().ToString("N") + ".json")
  try {
    $Utf8NoBom = [System.Text.UTF8Encoding]::new($false)
    [System.IO.File]::WriteAllText($TempPath, $Payload, $Utf8NoBom)
    Invoke-GcloudCapture -Arguments @(
      "secrets",
      "versions",
      "add",
      $SecretId,
      "--project",
      $ProjectId,
      "--data-file=$TempPath"
    ) | Out-Null
  } finally {
    if (Test-Path -LiteralPath $TempPath) {
      Remove-Item -LiteralPath $TempPath -Force -ErrorAction SilentlyContinue
    }
  }
}

Initialize-CloudSdkPython -ConfiguredPython $CloudSdkPython
$script:GcloudPath = Resolve-GcloudPath -ConfiguredGcloud $GcloudPath

$ResolvedConfigPath = Resolve-Path -LiteralPath $ConfigPath
$Config = Get-Content -LiteralPath $ResolvedConfigPath.Path -Raw | ConvertFrom-Json
$ProjectId = First-Value @($ProjectId, [string]$Config.project_id, $env:GOOGLE_CLOUD_PROJECT)
if (-not $ProjectId) {
  throw "ProjectId no pudo resolverse."
}

$ResolvedOutputDir = Join-Path -Path $ProjectRoot -ChildPath $OutputDir
New-Item -ItemType Directory -Force -Path $ResolvedOutputDir | Out-Null

$Rows = New-Object System.Collections.Generic.List[object]

foreach ($Secret in @($Config.secrets | Where-Object { $_.payload_type -eq "json" })) {
  $ExpectedPayloadText = ConvertTo-ConfigPayload -Secret $Secret
  $Describe = Invoke-GcloudCapture -Arguments @(
    "secrets",
    "describe",
    [string]$Secret.id,
    "--project",
    $ProjectId,
    "--format=value(name)"
  ) -AllowFailure

  $Exists = $Describe.exit_code -eq 0
  $MismatchedKeys = @()
  $HasEnabledVersion = $false
  $VersionAdded = $false

  if ($Exists) {
    $Access = Invoke-GcloudCapture -Arguments @(
      "secrets",
      "versions",
      "access",
      "latest",
      "--secret",
      [string]$Secret.id,
      "--project",
      $ProjectId
    ) -AllowFailure

    if ($Access.exit_code -eq 0 -and -not [string]::IsNullOrWhiteSpace($Access.output)) {
      $HasEnabledVersion = $true
      try {
        $ActualPayload = $Access.output | ConvertFrom-Json
        $MismatchedKeys = @(Get-MismatchedKeys -ExpectedPayload $Secret.payload -ActualPayload $ActualPayload)
      } catch {
        $MismatchedKeys = @("invalid_json_payload")
      }
    } else {
      $MismatchedKeys = @("missing_enabled_version")
    }

    if ($Execute -and $MismatchedKeys.Count -gt 0) {
      Add-SecretVersion -SecretId ([string]$Secret.id) -Payload $ExpectedPayloadText
      $VersionAdded = $true
      $HasEnabledVersion = $true
      $MismatchedKeys = @()
    }
  }

  $Rows.Add([pscustomobject]@{
    secret_id = [string]$Secret.id
    exists = $Exists
    has_enabled_version = $HasEnabledVersion
    matches_config = $Exists -and $HasEnabledVersion -and $MismatchedKeys.Count -eq 0
    mismatched_keys = $MismatchedKeys
    version_added = $VersionAdded
  }) | Out-Null
}

$RowsArray = @($Rows.ToArray())
$Ready = @($RowsArray | Where-Object { -not $_.matches_config }).Count -eq 0

$Result = [pscustomobject]@{
  generated_at = (Get-Date).ToString("o")
  project_id = $ProjectId
  config_path = $ResolvedConfigPath.Path
  execute = [bool]$Execute
  ready = $Ready
  json_secrets = $RowsArray
}

$OutputPath = Join-Path -Path $ResolvedOutputDir -ChildPath "sync-json-secrets-from-config.json"
$Result | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $OutputPath -Encoding UTF8

$RowsArray | Format-Table secret_id,exists,has_enabled_version,matches_config,version_added -AutoSize
Write-Host "Secretos JSON sincronizados: $Ready"
Write-Host "Resultado JSON: $OutputPath"

if (-not $Ready) {
  exit 1
}
