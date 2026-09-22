param(
  [string]$ProjectId = "project-fbb34cd7-0b82-43e1-867",
  [string]$Region = "us-central1",
  [string]$CallerServiceAccount = "frontend-shell-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com",
  [string[]]$ServiceIds = @(
    "identity-service",
    "dispatch-service",
    "ticketing-service",
    "document-service",
    "reporting-service",
    "audit-service"
  ),
  [switch]$Execute
)

$ErrorActionPreference = "Stop"

function Resolve-GcloudPath {
  $configured = $env:GCLOUD_PATH
  if ($configured -and (Test-Path -LiteralPath $configured)) {
    return $configured
  }

  $command = Get-Command gcloud.cmd -ErrorAction SilentlyContinue
  if ($command) {
    return $command.Source
  }

  $chocolateyPath = "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd"
  if (Test-Path -LiteralPath $chocolateyPath) {
    return $chocolateyPath
  }

  throw "No se encontro gcloud.cmd. Configure GCLOUD_PATH o instale Google Cloud SDK."
}

function Normalize-ServiceIds {
  param([string[]]$Values)

  $normalized = @($Values | ForEach-Object { $_ -split "," } | ForEach-Object { $_.Trim() } | Where-Object { $_ })
  if ($normalized.Count -eq 0) {
    throw "ServiceIds no puede estar vacio."
  }

  return $normalized
}

function Get-Policy {
  param(
    [string]$GcloudPath,
    [string]$ServiceId
  )

  $json = & $GcloudPath run services get-iam-policy $ServiceId `
    --project $ProjectId `
    --region $Region `
    --format json

  if ($LASTEXITCODE -ne 0) {
    throw "No se pudo leer IAM policy de $ServiceId."
  }

  return $json | ConvertFrom-Json
}

function Has-InvokerBinding {
  param(
    $Policy,
    [string]$Member
  )

  return @(
    $Policy.bindings |
      Where-Object { $_.role -eq "roles/run.invoker" } |
      ForEach-Object { $_.members } |
      Where-Object { $_ -eq $Member }
  ).Count -gt 0
}

$GcloudPath = Resolve-GcloudPath
$ResolvedServiceIds = Normalize-ServiceIds -Values $ServiceIds
$Member = "serviceAccount:$CallerServiceAccount"
$Plan = @()

foreach ($ServiceId in $ResolvedServiceIds) {
  $Policy = Get-Policy -GcloudPath $GcloudPath -ServiceId $ServiceId
  $ExistsBefore = Has-InvokerBinding -Policy $Policy -Member $Member
  $Action = if ($ExistsBefore) { "exists" } elseif ($Execute) { "grant" } else { "planned" }

  if ($Execute -and -not $ExistsBefore) {
    & $GcloudPath run services add-iam-policy-binding $ServiceId `
      --project $ProjectId `
      --region $Region `
      --member $Member `
      --role "roles/run.invoker" `
      --quiet | Out-Null

    if ($LASTEXITCODE -ne 0) {
      throw "No se pudo otorgar roles/run.invoker en $ServiceId."
    }
  }

  $PolicyAfter = Get-Policy -GcloudPath $GcloudPath -ServiceId $ServiceId
  $ExistsAfter = Has-InvokerBinding -Policy $PolicyAfter -Member $Member

  $Plan += [pscustomobject]@{
    service_id = $ServiceId
    member = $Member
    invoker_before = $ExistsBefore
    invoker_after = $ExistsAfter
    action = $Action
  }
}

$LogDir = Join-Path (Get-Location) "logs\cloudrun-dev"
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
$PlanPath = Join-Path $LogDir "grant-cloudrun-invoker.plan.json"
$Plan | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $PlanPath -Encoding UTF8

Write-Host "Cloud Run invoker grant plan generated."
Write-Host "Plan: $PlanPath"
$Plan | Format-Table -AutoSize
