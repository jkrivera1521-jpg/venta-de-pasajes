# Dia 87 - Revision de seguridad final

## Objetivo

Consolidar una revision final de seguridad antes del cierre del proyecto, usando evidencias reales ya generadas para roles funcionales, IAM, Secret Manager, exposicion de APIs, auditoria y backups.

## Resultado

Se preparo un paquete de revision final de seguridad que:

- Verifica el catalogo funcional de roles y permisos.
- Valida IAM productivo y accessors de Secret Manager.
- Confirma que los backends productivos no tienen invocacion publica.
- Confirma que los frontends productivos estan saludables y sin variables sin resolver.
- Verifica auditoria funcional con modelo append-only y health productivo.
- Consolida backups y restauracion productiva controlada del Dia 86.
- Genera un informe de seguridad final con riesgos criticos y observaciones.

## Archivos creados o modificados

- `scripts/prepare-final-security-review.ps1`
- `docs/dia-87-revision-seguridad-final.md`
- `docs/informe-seguridad-final.md`
- `logs/final-security/dia87-final-security-readiness.json`
- `logs/final-security/dia87-final-security-findings.json`
- `README.md`
- `infra/README.md`
- `vitacora.md`

## Reversa primero

### Reversa de archivos locales

```powershell
Remove-Item -LiteralPath .\docs\dia-87-revision-seguridad-final.md -Force
Remove-Item -LiteralPath .\docs\informe-seguridad-final.md -Force
Remove-Item -LiteralPath .\scripts\prepare-final-security-review.ps1 -Force
Remove-Item -LiteralPath .\logs\final-security -Recurse -Force
```

Si tambien se quiere revertir los indices, retirar manualmente las entradas del Dia 87 en:

```text
README.md
infra/README.md
vitacora.md
```

### Reversa de Google Cloud

No aplica. Este dia no crea ni modifica recursos cloud. Solo lee evidencias existentes y genera documentacion local.

## Guia manual desde cero

### Paso 1 - Verificar el dia en el plan

```powershell
Select-String -Path .\tareas.md -Pattern "Dia 87" -Context 0,12
```

Debe mostrar:

```text
Dia 87 - Revision de seguridad final
```

### Paso 2 - Verificar rutas requeridas

```powershell
$RequiredPaths = @(
  ".\logs\prod-infra\verify-prod-infra.json",
  ".\logs\prod-iam\verify-iam-prod.json",
  ".\logs\cloudrun-prod\verify-cloudrun-prod-backends.json",
  ".\logs\cloudrun-prod\verify-cloudrun-prod-frontends.json",
  ".\logs\backup-restore\verify-backup-restore-readiness-prod.json",
  ".\logs\production-restore-test\dia86-production-restore-readiness.json",
  ".\logs\production-restore-test\dia86-production-restore-execution-evidence.json",
  ".\docs\database\identity-db.sql",
  ".\docs\database\audit-db.sql",
  ".\infra\cloudrun\prod-backend-services.json",
  ".\infra\cloudrun\prod-frontend-services.json",
  ".\apps\mfe-admin\app\api\audit\[...path]\route.ts",
  ".\apps\mfe-admin\app\api\admin\health\route.ts",
  ".\services\identity-service\src\main\java\com\ventapasajes\identity\api\IdentityBaseResource.java",
  ".\services\identity-service\src\main\java\com\ventapasajes\identity\auth\BearerAuthFilter.java",
  ".\services\audit-service\README.md"
)

$RequiredPaths |
  ForEach-Object {
    [pscustomobject]@{
      Path = $_
      Exists = Test-Path -LiteralPath $_
    }
  } |
  Format-Table -AutoSize
```

Todos deben aparecer en `True`.

### Paso 3 - Refrescar evidencias productivas

Estos comandos son de verificacion. No crean ni eliminan recursos.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\infra\gcloud\verify-prod-infra.ps1 `
  -ProjectId project-fbb34cd7-0b82-43e1-867

powershell -NoProfile -ExecutionPolicy Bypass -File .\infra\gcloud\verify-iam-prod.ps1 `
  -ProjectId project-fbb34cd7-0b82-43e1-867

powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-cloudrun-prod-backends.ps1

powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-cloudrun-prod-frontends.ps1

powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-backup-restore-readiness.ps1 `
  -Environment prod `
  -CloudSqlInstanceName venta-pasajes-prod-sql `
  -DocumentBucketName venta-pasajes-prod-documents `
  -RestoreInstanceName venta-pasajes-prod-restore-test
```

Resultados esperados:

```text
Overall prod infra ready: True
Overall prod IAM ready: True
Backend productivo listo: True
Frontend productivo listo: True
Overall ready for restore test: True
```

### Paso 4 - Generar informe final de seguridad

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\prepare-final-security-review.ps1
```

Resultado esperado:

```text
Revision seguridad final lista: True
Riesgos criticos mitigados: True
Riesgos criticos abiertos: 0
Areas listas: 6/6
```

### Paso 5 - Validar evidencia JSON

```powershell
$Result = Get-Content -LiteralPath .\logs\final-security\dia87-final-security-readiness.json -Raw |
  ConvertFrom-Json

$Result |
  Select-Object ready_for_security_close, critical_risks_mitigated, critical_risk_count

$Result.area_results |
  Select-Object area, ready, summary |
  Format-Table -AutoSize
```

Resultado esperado:

```text
ready_for_security_close critical_risks_mitigated critical_risk_count
------------------------ ------------------------ -------------------
                    True                     True                   0
```

### Paso 6 - Revisar informe final

```powershell
Get-Content -LiteralPath .\docs\informe-seguridad-final.md -Raw
```

El informe debe indicar:

```text
Riesgos criticos mitigados: True
Riesgos criticos abiertos: 0
Listo para cierre de seguridad: True
```

## Pruebas y validaciones

Validar sintaxis del script:

```powershell
$Errors = $null
$Tokens = $null
[System.Management.Automation.Language.Parser]::ParseFile(
  ".\scripts\prepare-final-security-review.ps1",
  [ref]$Tokens,
  [ref]$Errors
) | Out-Null

$Errors.Count
```

Debe devolver:

```text
0
```

Validar que el informe existe:

```powershell
Test-Path -LiteralPath .\docs\informe-seguridad-final.md
Test-Path -LiteralPath .\logs\final-security\dia87-final-security-readiness.json
Test-Path -LiteralPath .\logs\final-security\dia87-final-security-findings.json
```

Los tres deben devolver `True`.

## Peticiones HTTP/HTTPS listas para copiar con curl.exe

Validar salud publica de frontends:

```powershell
$FrontendEvidence = Get-Content -LiteralPath .\logs\cloudrun-prod\verify-cloudrun-prod-frontends.json -Raw |
  ConvertFrom-Json

$FrontendEvidence.services |
  ForEach-Object {
    curl.exe --ssl-no-revoke -sS "$($_.url)/api/health"
  }
```

Validar health agregado de admin:

```powershell
$AdminUrl = (
  Get-Content -LiteralPath .\logs\cloudrun-prod\verify-cloudrun-prod-frontends.json -Raw |
    ConvertFrom-Json
).services |
  Where-Object { $_.service_id -eq "mfe-admin" } |
  Select-Object -ExpandProperty url

curl.exe --ssl-no-revoke -sS "$AdminUrl/api/admin/health"
```

## Publicacion o despliegue

No aplica despliegue. Este dia genera informe y evidencias locales.

## Verificacion en consola web o por comandos

Consola Google Cloud:

```text
IAM > Service Accounts
Security > Secret Manager
Cloud Run > Servicios productivos
Cloud SQL > venta-pasajes-prod-sql > Backups
Cloud Storage > venta-pasajes-prod-documents
```

Comandos:

```powershell
gcloud run services list `
  --region us-central1 `
  --project project-fbb34cd7-0b82-43e1-867

gcloud secrets list `
  --project project-fbb34cd7-0b82-43e1-867

gcloud sql backups list `
  --instance venta-pasajes-prod-sql `
  --project project-fbb34cd7-0b82-43e1-867
```

## Problemas encontrados y soluciones

- La revision final no debe basarse en percepcion manual. Se creo `scripts/prepare-final-security-review.ps1` para consolidar fuentes verificables.
- El acceso humano Owner observado se deja como observacion no critica porque retirarlo automaticamente podria bloquear administracion del proyecto.
- Los frontends son publicos por diseno; el control importante es que los backends productivos queden privados.

## Estado final y siguiente paso natural

Estado final esperado:

```text
Revision seguridad final lista: True
Riesgos criticos mitigados: True
Riesgos criticos abiertos: 0
Areas listas: 6/6
```

Siguiente paso natural:

```text
Dia 88 - Preparacion de crecimiento modular.
```
