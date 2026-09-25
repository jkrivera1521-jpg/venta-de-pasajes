param(
  [string]$DayDocPath = "docs\dia-76-capacitacion-operativa.md",
  [string]$ManualPath = "docs\manual-usuario-operativo.md",
  [string]$FaqPath = "docs\faq-operativa.md",
  [string]$TrainingRegisterPath = "docs\registro-capacitacion-operativa.md",
  [string]$OutputPath = "logs\training\dia76-operational-training-readiness.json",
  [switch]$RequireSignedAttendance,
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

function Read-TextFile {
  param([string]$Path)

  if (-not (Test-Path -LiteralPath $Path)) {
    return ""
  }

  return Get-Content -LiteralPath $Path -Raw
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

$Files = [ordered]@{
  day_doc = Resolve-ProjectPath -Path $DayDocPath
  manual = Resolve-ProjectPath -Path $ManualPath
  faq = Resolve-ProjectPath -Path $FaqPath
  training_register = Resolve-ProjectPath -Path $TrainingRegisterPath
  frontend_shell = Resolve-ProjectPath -Path "apps\frontend-shell\app\page.tsx"
  mfe_ticketing = Resolve-ProjectPath -Path "apps\mfe-ticketing\app\ticketing\embedded\page.tsx"
  mfe_admin = Resolve-ProjectPath -Path "apps\mfe-admin\app\admin\embedded\page.tsx"
  mfe_reporting = Resolve-ProjectPath -Path "apps\mfe-reporting\app\reporting\embedded\page.tsx"
}

$Checks = [System.Collections.Generic.List[object]]::new()
$Warnings = [System.Collections.Generic.List[string]]::new()
$Blockers = [System.Collections.Generic.List[string]]::new()

foreach ($Key in $Files.Keys) {
  $Exists = Test-Path -LiteralPath $Files[$Key]
  Add-Check -Checks $Checks -Area "files" -Name $Key -Passed $Exists -Detail $Files[$Key]
  if (-not $Exists) {
    $Blockers.Add("Falta archivo requerido: $Key -> $($Files[$Key])")
  }
}

$DayDoc = Read-TextFile -Path $Files.day_doc
$Manual = Read-TextFile -Path $Files.manual
$Faq = Read-TextFile -Path $Files.faq
$Register = Read-TextFile -Path $Files.training_register

$DayDocHasReverse = $DayDoc -match "(?m)^## Reversa primero"
$DayDocHasGuide = $DayDoc -match "(?m)^## Guia manual desde cero"
Add-Check -Checks $Checks -Area "day-doc" -Name "reversa primero" -Passed $DayDocHasReverse -Detail $DayDocPath
Add-Check -Checks $Checks -Area "day-doc" -Name "guia manual desde cero" -Passed $DayDocHasGuide -Detail $DayDocPath
if (-not $DayDocHasReverse) { $Blockers.Add("El documento del Dia 76 no tiene seccion Reversa primero.") }
if (-not $DayDocHasGuide) { $Blockers.Add("El documento del Dia 76 no tiene Guia manual desde cero.") }

$ManualSections = @("Boleteria", "Despachos", "Identidad", "Reportes", "Admin", "Soporte")
foreach ($Section in $ManualSections) {
  $Found = $Manual -match "(?m)^## $([regex]::Escape($Section))"
  Add-Check -Checks $Checks -Area "manual" -Name $Section -Passed $Found -Detail $ManualPath
  if (-not $Found) {
    $Blockers.Add("El manual no contiene la seccion requerida: $Section")
  }
}

$FaqQuestionCount = ([regex]::Matches($Faq, "(?m)^### P\d+")).Count
$FaqReady = $FaqQuestionCount -ge 12
Add-Check -Checks $Checks -Area "faq" -Name "minimum questions" -Passed $FaqReady -Detail "$FaqQuestionCount preguntas"
if (-not $FaqReady) {
  $Blockers.Add("La FAQ debe tener al menos 12 preguntas frecuentes.")
}

$TrainingAudiences = @("Boleteria operativa", "Administrador", "Soporte")
foreach ($Audience in $TrainingAudiences) {
  $Found = $Register -match [regex]::Escape($Audience)
  Add-Check -Checks $Checks -Area "training-register" -Name $Audience -Passed $Found -Detail $TrainingRegisterPath
  if (-not $Found) {
    $Blockers.Add("El registro de capacitacion no contiene la sesion: $Audience")
  }
}

$HasSignatureColumn = $Register -match "(?m)\|\s*Fecha\s*\|\s*Sesion\s*\|\s*Nombre\s*\|\s*Rol\s*\|\s*Firma\s*\|"
Add-Check -Checks $Checks -Area "training-register" -Name "signature table" -Passed $HasSignatureColumn -Detail "Lista de asistencia con firma"
if (-not $HasSignatureColumn) {
  $Blockers.Add("El registro de capacitacion no contiene tabla de asistencia con firma.")
}

$PendingRealSignature = $Register -match "PENDIENTE_FIRMA_REAL"
$RealTrainingCompleted = -not $PendingRealSignature
Add-Check -Checks $Checks -Area "training-register" -Name "real signatures completed" -Passed $RealTrainingCompleted -Detail "RequireSignedAttendance=$RequireSignedAttendance"

if ($PendingRealSignature) {
  $Warnings.Add("El paquete esta listo, pero la capacitacion real todavia requiere firmas de asistencia.")
}

if ($RequireSignedAttendance -and $PendingRealSignature) {
  $Blockers.Add("Se solicito RequireSignedAttendance, pero el registro sigue con PENDIENTE_FIRMA_REAL.")
}

$TicketingSource = Read-TextFile -Path $Files.mfe_ticketing
$SeatFlagsReady = $TicketingSource -match "DISABILITY" -and $TicketingSource -match "CHILD" -and $TicketingSource -match "OLDER_ADULT"
Add-Check -Checks $Checks -Area "source-reference" -Name "ticketing passenger flags" -Passed $SeatFlagsReady -Detail "DISABILITY/CHILD/OLDER_ADULT"
if (-not $SeatFlagsReady) {
  $Warnings.Add("No se detectaron las tres banderas de pasajero en mfe-ticketing.")
}

$ReadyForTrainingExecution = $Blockers.Count -eq 0

$Result = [pscustomobject]@{
  generated_at = (Get-Date).ToString("o")
  ready_for_training_execution = $ReadyForTrainingExecution
  real_training_completed = $RealTrainingCompleted
  require_signed_attendance = [bool]$RequireSignedAttendance
  files = $Files
  summary = [pscustomobject]@{
    checks_total = $Checks.Count
    checks_passed = @($Checks | Where-Object { $_.passed }).Count
    checks_failed = @($Checks | Where-Object { -not $_.passed }).Count
    faq_questions = $FaqQuestionCount
    training_audiences = $TrainingAudiences.Count
  }
  checks = @($Checks)
  blockers = @($Blockers)
  warnings = @($Warnings)
}

$ResolvedOutputPath = Resolve-ProjectPath -Path $OutputPath
$OutputDir = Split-Path -Parent $ResolvedOutputPath
New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
$Result | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $ResolvedOutputPath -Encoding UTF8

@($Checks) |
  Select-Object area, name, passed, detail |
  Format-Table -AutoSize

Write-Host "Resultado JSON: $ResolvedOutputPath"
Write-Host "Paquete de capacitacion listo: $ReadyForTrainingExecution"
Write-Host "Capacitacion real firmada: $RealTrainingCompleted"

if ($Warnings.Count -gt 0) {
  Write-Host "Advertencias:"
  foreach ($Warning in $Warnings) {
    Write-Host "- $Warning"
  }
}

if ($Blockers.Count -gt 0) {
  Write-Host "Bloqueos:"
  foreach ($Blocker in $Blockers) {
    Write-Host "- $Blocker"
  }
}

if ($FailOnBlocker -and $Blockers.Count -gt 0) {
  throw "La capacitacion operativa tiene bloqueos."
}

