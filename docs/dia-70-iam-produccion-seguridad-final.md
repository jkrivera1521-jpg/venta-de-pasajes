# Dia 70 - IAM produccion y seguridad final

## Objetivo

Alinear el Dia 70 con `C:\VENTA-DE-PASAJES\tareas.md`: proteger produccion antes del despliegue real, separando identidades productivas, aplicando permisos minimos sobre recursos productivos y dejando una verificacion reproducible.

## Resultado

Se creo y aplico la matriz IAM productiva:

```text
C:\VENTA-DE-PASAJES\infra\gcloud\iam-prod.json
```

Tambien se crearon los scripts:

```text
C:\VENTA-DE-PASAJES\infra\gcloud\bootstrap-iam-prod.ps1
C:\VENTA-DE-PASAJES\infra\gcloud\verify-iam-prod.ps1
```

Resultado aplicado en Google Cloud:

```text
Service accounts productivas esperadas: 13
Service account user bindings esperados: 12
Secretos productivos protegidos: 15
Topicos Pub/Sub productivos: 10
Suscripciones Pub/Sub productivas: 10
Bucket documental productivo: gs://venta-pasajes-prod-documents
Politica Cloud Run produccion: deferred_until_services_exist
```

La politica de invocacion Cloud Run queda en estado `deferred_until_services_exist` porque los servicios productivos todavia no existen. Cuando se desplieguen, el criterio sera:

```text
Publico: frontend-shell
Privados: backends y MFEs internos
Invocadores planeados: frontend-prod-run y cuentas mfe-*-prod-run
```

## Reversa primero

Usar esta reversa solo si se necesita volver al esquema anterior de identidades compartidas `*-service-run` en produccion.

No borrar cuentas `*-prod-run` automaticamente. Primero confirmar que ningun servicio productivo las este usando:

```powershell
cd C:\VENTA-DE-PASAJES

gcloud run services list `
  --project project-fbb34cd7-0b82-43e1-867 `
  --region us-central1
```

Si se requiere restaurar las configuraciones previas del Dia 69 desde Git:

```powershell
cd C:\VENTA-DE-PASAJES

git restore --source=HEAD~1 -- `
  .\infra\gcloud\cloudsql-prod.json `
  .\infra\gcloud\secrets-prod.json `
  .\infra\gcloud\pubsub-prod.json
```

Reaplicar usuarios IAM de Cloud SQL segun la configuracion restaurada:

```powershell
cd C:\VENTA-DE-PASAJES

$env:CLOUDSDK_PYTHON = "C:\Python312\python.exe"

powershell -NoProfile -ExecutionPolicy Bypass -File .\infra\gcloud\bootstrap-cloudsql-dev.ps1 `
  -ConfigPath .\infra\gcloud\cloudsql-prod.json `
  -ProjectId project-fbb34cd7-0b82-43e1-867
```

Reaplicar accesos Secret Manager segun la configuracion restaurada:

```powershell
cd C:\VENTA-DE-PASAJES

$env:CLOUDSDK_PYTHON = "C:\Python312\python.exe"

powershell -NoProfile -ExecutionPolicy Bypass -File .\infra\gcloud\bootstrap-secrets-dev.ps1 `
  -ConfigPath .\infra\gcloud\secrets-prod.json `
  -ProjectId project-fbb34cd7-0b82-43e1-867
```

Reaplicar Pub/Sub segun la configuracion restaurada:

```powershell
cd C:\VENTA-DE-PASAJES

$env:CLOUDSDK_PYTHON = "C:\Python312\python.exe"

powershell -NoProfile -ExecutionPolicy Bypass -File .\infra\gcloud\bootstrap-pubsub.ps1 `
  -ConfigPath .\infra\gcloud\pubsub-prod.json `
  -ProjectId project-fbb34cd7-0b82-43e1-867
```

Restaurar el binding anterior del bucket documental si el servicio anterior debe operar:

```powershell
gcloud storage buckets add-iam-policy-binding gs://venta-pasajes-prod-documents `
  --project project-fbb34cd7-0b82-43e1-867 `
  --member serviceAccount:document-service-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com `
  --role roles/storage.objectAdmin
```

Validar que la reversa no dejo recursos sin acceso:

```powershell
cd C:\VENTA-DE-PASAJES

powershell -NoProfile -ExecutionPolicy Bypass -File .\infra\gcloud\verify-prod-infra.ps1 `
  -FailOnNotReady
```

Si se decide eliminar cuentas productivas, hacerlo solo despues de confirmar que ningun Cloud Run, Cloud Build o pipeline las usa:

```powershell
gcloud iam service-accounts delete `
  identity-prod-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com `
  --project project-fbb34cd7-0b82-43e1-867 `
  --quiet
```

## Guia manual desde cero

Ejecutar desde la raiz real del proyecto:

```powershell
cd C:\VENTA-DE-PASAJES
```

Fijar Python 3.12 para `gcloud`. Esto evita el error SSL observado con Python 3.14:

```powershell
$env:CLOUDSDK_PYTHON = "C:\Python312\python.exe"
```

Validar que los archivos existen:

```powershell
Test-Path -LiteralPath .\infra\gcloud\iam-prod.json
Test-Path -LiteralPath .\infra\gcloud\bootstrap-iam-prod.ps1
Test-Path -LiteralPath .\infra\gcloud\verify-iam-prod.ps1
Test-Path -LiteralPath .\infra\gcloud\cloudsql-prod.json
Test-Path -LiteralPath .\infra\gcloud\secrets-prod.json
Test-Path -LiteralPath .\infra\gcloud\pubsub-prod.json
```

Validar que los JSON cargan correctamente:

```powershell
$JsonFiles = @(
  ".\infra\gcloud\iam-prod.json",
  ".\infra\gcloud\cloudsql-prod.json",
  ".\infra\gcloud\secrets-prod.json",
  ".\infra\gcloud\pubsub-prod.json"
)

foreach ($File in $JsonFiles) {
  Get-Content -LiteralPath $File -Raw | ConvertFrom-Json | Out-Null
  "$File OK"
}
```

Validar sintaxis PowerShell:

```powershell
$PsFiles = @(
  ".\infra\gcloud\bootstrap-iam-prod.ps1",
  ".\infra\gcloud\verify-iam-prod.ps1"
)

foreach ($File in $PsFiles) {
  $Tokens = $null
  $Errors = $null
  [System.Management.Automation.Language.Parser]::ParseFile((Resolve-Path $File), [ref]$Tokens, [ref]$Errors) | Out-Null
  if ($Errors.Count -gt 0) { $Errors; throw "Error de sintaxis en $File" }
  "$File OK"
}
```

Ejecutar primero en modo plan, sin modificar Google Cloud:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\infra\gcloud\bootstrap-iam-prod.ps1 `
  -ProjectId project-fbb34cd7-0b82-43e1-867 `
  -DryRun `
  -RemoveLegacyBindings
```

Ejecutar aplicacion real:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\infra\gcloud\bootstrap-iam-prod.ps1 `
  -ProjectId project-fbb34cd7-0b82-43e1-867 `
  -RemoveLegacyBindings
```

Validar IAM productivo:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\infra\gcloud\verify-iam-prod.ps1 `
  -FailOnNotReady
```

Validar que la infraestructura productiva sigue completa:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\infra\gcloud\verify-prod-infra.ps1 `
  -FailOnNotReady
```

## Matriz IAM produccion

La matriz esta en:

```text
C:\VENTA-DE-PASAJES\infra\gcloud\iam-prod.json
```

Resumen:

```text
Backends Cloud Run: cuentas dedicadas *-prod-run.
Frontends Cloud Run: frontend-prod-run y mfe-*-prod-run.
Deployer productivo: cloudbuild-prod-deploy.
Cloud SQL: usuarios IAM productivos por microservicio.
Secret Manager: accesos a nivel de secreto, no acceso global.
Storage: document-prod-run con roles/storage.objectAdmin sobre el bucket documental productivo.
Pub/Sub: publishers/subscribers productivos segun topicos y suscripciones de produccion.
```

## Checklist de seguridad productiva

```text
[x] No se crearon llaves de service account.
[x] Produccion usa identidades separadas de dev/staging.
[x] Secret Manager usa bindings de recurso para secretos productivos.
[x] Cloud SQL tiene usuarios IAM productivos por microservicio.
[x] Bucket documental productivo usa binding de recurso.
[x] Pub/Sub productivo usa bindings por topico y suscripcion.
[x] Accesos legacy productivos fueron removidos de Cloud SQL, secretos, Storage y Pub/Sub.
[x] Cloud Run produccion queda con politica de invocacion planeada para aplicarse cuando existan servicios.
[ ] Antes de trafico real, revisar Owner/Editor humanos con el responsable de seguridad.
[ ] Antes de trafico real, reemplazar accesos personales por grupos si existe Google Workspace o Cloud Identity.
[ ] Antes de trafico real, exigir MFA a administradores humanos.
```

Nota: `gcloud sql instances add-iam-policy-binding` no esta disponible en el entorno actual. Por eso `roles/cloudsql.client` y `roles/cloudsql.instanceUser` se aplican a nivel de proyecto, mientras que el acceso efectivo a cada base queda controlado con usuarios IAM de Cloud SQL y grants por base.

## Evidencia

Verificador IAM productivo:

```text
C:\VENTA-DE-PASAJES\logs\prod-iam\verify-iam-prod.json
```

Verificador infraestructura productiva:

```text
C:\VENTA-DE-PASAJES\logs\prod-infra\verify-prod-infra.json
```

Estado esperado:

```text
IAM prod service accounts exist: True
IAM project roles complete: True
IAM deployer can attach prod runtimes: True
Cloud SQL prod IAM DB users complete: True
Cloud SQL legacy prod IAM DB users removed: True
Secrets prod secret accessors complete: True
Secrets legacy secret accessors removed: True
Storage prod bucket binding complete: True
Storage legacy bucket binding removed: True
Pub/Sub prod publisher bindings complete: True
Pub/Sub legacy publisher bindings removed: True
Pub/Sub prod subscriber bindings complete: True
Pub/Sub legacy subscriber bindings removed: True
Overall prod IAM ready: True
```

## Lectura ejecutiva

Produccion ya tiene identidades dedicadas y permisos productivos separados de los ambientes previos. El ambiente queda protegido antes del despliegue, con una salvedad: las politicas de invocacion de Cloud Run se aplicaran cuando existan los servicios productivos.
