# Dia 69 - Infraestructura produccion

Fecha de ejecucion: 2026-09-23

Este dia se alinea con el plan maestro de `C:\VENTA-DE-PASAJES\tareas.md`, donde el Dia 69 corresponde a **Infraestructura produccion**.

## Objetivo

Crear la base de infraestructura de produccion en Google Cloud, separada de staging y dev:

- Cloud SQL produccion.
- Bases por microservicio.
- Bucket documental produccion.
- Secretos produccion.
- Pub/Sub produccion.

## Resultado real

Infraestructura creada y verificada en el proyecto:

```text
project-fbb34cd7-0b82-43e1-867
```

Recursos creados:

| Area | Recurso |
| --- | --- |
| Cloud SQL | `venta-pasajes-prod-sql` |
| Cloud Storage | `gs://venta-pasajes-prod-documents` |
| Secret Manager | 15 secretos con sufijo/nombre `prod` |
| Pub/Sub | 10 topicos y 10 suscripciones con prefijo `venta-pasajes-prod-` |

Separacion confirmada:

| Ambiente | Cloud SQL | Bucket documental |
| --- | --- | --- |
| staging | `venta-pasajes-staging-sql` | `gs://venta-pasajes-staging-documents` |
| prod | `venta-pasajes-prod-sql` | `gs://venta-pasajes-prod-documents` |

## Archivos creados o actualizados

```text
C:\VENTA-DE-PASAJES\infra\gcloud\cloudsql-prod.json
C:\VENTA-DE-PASAJES\infra\gcloud\secrets-prod.json
C:\VENTA-DE-PASAJES\infra\gcloud\pubsub-prod.json
C:\VENTA-DE-PASAJES\infra\gcloud\bootstrap-pubsub.ps1
C:\VENTA-DE-PASAJES\infra\gcloud\verify-prod-infra.ps1
C:\VENTA-DE-PASAJES\docs\dia-69-infraestructura-produccion.md
C:\VENTA-DE-PASAJES\logs\prod-infra\verify-prod-infra.json
```

## Reversa primero

Advertencia: esta reversa elimina recursos reales de produccion. Ejecutarla solo si se decide destruir la base de produccion creada en este dia.

### Reversa de Pub/Sub

```powershell
cd C:\VENTA-DE-PASAJES

$ProjectId = "project-fbb34cd7-0b82-43e1-867"
$PubSubConfig = Get-Content -LiteralPath .\infra\gcloud\pubsub-prod.json -Raw | ConvertFrom-Json

$PubSubConfig.subscriptions | ForEach-Object {
  gcloud pubsub subscriptions delete $_.name --project $ProjectId --quiet
}

$PubSubConfig.topics | ForEach-Object {
  gcloud pubsub topics delete $_.name --project $ProjectId --quiet
}
```

### Reversa de secretos

```powershell
cd C:\VENTA-DE-PASAJES

$ProjectId = "project-fbb34cd7-0b82-43e1-867"
$SecretsConfig = Get-Content -LiteralPath .\infra\gcloud\secrets-prod.json -Raw | ConvertFrom-Json

$SecretsConfig.secrets | ForEach-Object {
  gcloud secrets delete $_.id --project $ProjectId --quiet
}
```

### Reversa de bucket documental

```powershell
cd C:\VENTA-DE-PASAJES

$ProjectId = "project-fbb34cd7-0b82-43e1-867"

gcloud storage rm --recursive gs://venta-pasajes-prod-documents `
  --project $ProjectId `
  --quiet
```

Si el bucket estuviera vacio pero no se elimina con el comando anterior:

```powershell
gcloud storage buckets delete gs://venta-pasajes-prod-documents `
  --project $ProjectId `
  --quiet
```

### Reversa de Cloud SQL produccion

La instancia tiene proteccion contra eliminacion. Primero hay que desactivar esa proteccion:

```powershell
cd C:\VENTA-DE-PASAJES

$ProjectId = "project-fbb34cd7-0b82-43e1-867"

gcloud sql instances patch venta-pasajes-prod-sql `
  --project $ProjectId `
  --no-deletion-protection `
  --quiet

gcloud sql instances delete venta-pasajes-prod-sql `
  --project $ProjectId `
  --quiet
```

### Reversa de archivos locales de este dia

Esta reversa solo aplica si se quiere eliminar la documentacion y scripts de este dia del repositorio local.

```powershell
cd C:\VENTA-DE-PASAJES

Remove-Item -LiteralPath .\infra\gcloud\cloudsql-prod.json -Force
Remove-Item -LiteralPath .\infra\gcloud\secrets-prod.json -Force
Remove-Item -LiteralPath .\infra\gcloud\pubsub-prod.json -Force
Remove-Item -LiteralPath .\infra\gcloud\bootstrap-pubsub.ps1 -Force
Remove-Item -LiteralPath .\infra\gcloud\verify-prod-infra.ps1 -Force
Remove-Item -LiteralPath .\docs\dia-69-infraestructura-produccion.md -Force
Remove-Item -LiteralPath .\logs\prod-infra\verify-prod-infra.json -Force -ErrorAction SilentlyContinue
```

## Guia manual desde cero

### Paso 1 - Entrar al workspace y fijar Python del Cloud SDK

```powershell
cd C:\VENTA-DE-PASAJES

$env:CLOUDSDK_PYTHON = "C:\Python312\python.exe"
gcloud config set project project-fbb34cd7-0b82-43e1-867
gcloud auth list
```

Nota: en esta maquina, Python 3.12 fue validado con `gcloud`. Python 3.14 produjo error SSL al consultar APIs de Google Cloud.

### Paso 2 - Validar archivos de configuracion

```powershell
cd C:\VENTA-DE-PASAJES

Get-Content -LiteralPath .\infra\gcloud\cloudsql-prod.json -Raw | ConvertFrom-Json | Out-Null
Get-Content -LiteralPath .\infra\gcloud\secrets-prod.json -Raw | ConvertFrom-Json | Out-Null
Get-Content -LiteralPath .\infra\gcloud\pubsub-prod.json -Raw | ConvertFrom-Json | Out-Null
```

### Paso 3 - Ejecutar plan Cloud SQL sin modificar Google Cloud

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\infra\gcloud\bootstrap-cloudsql-dev.ps1 `
  -ConfigPath .\infra\gcloud\cloudsql-prod.json `
  -ProjectId project-fbb34cd7-0b82-43e1-867 `
  -DryRun
```

### Paso 4 - Crear Cloud SQL produccion y bases por servicio

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\infra\gcloud\bootstrap-cloudsql-dev.ps1 `
  -ConfigPath .\infra\gcloud\cloudsql-prod.json `
  -ProjectId project-fbb34cd7-0b82-43e1-867
```

Resultado esperado:

```text
instance_name: venta-pasajes-prod-sql
state: RUNNABLE
database_version: POSTGRES_16
databases_created or databases_existing: 6
iam_database_users_created or iam_database_users_existing: 6
```

Bases esperadas:

```text
identity_db
dispatch_db
ticketing_db
documents_db
reporting_db
audit_db
```

### Paso 5 - Crear bucket documental produccion

```powershell
gcloud storage buckets create gs://venta-pasajes-prod-documents `
  --project project-fbb34cd7-0b82-43e1-867 `
  --location us-central1 `
  --uniform-bucket-level-access `
  --public-access-prevention `
  --default-storage-class STANDARD
```

Otorgar acceso al runtime de `document-service`:

```powershell
gcloud storage buckets add-iam-policy-binding gs://venta-pasajes-prod-documents `
  --project project-fbb34cd7-0b82-43e1-867 `
  --member serviceAccount:document-service-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com `
  --role roles/storage.objectAdmin
```

### Paso 6 - Crear secretos produccion

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\infra\gcloud\bootstrap-secrets-dev.ps1 `
  -ConfigPath .\infra\gcloud\secrets-prod.json `
  -ProjectId project-fbb34cd7-0b82-43e1-867
```

Resultado esperado:

```text
secrets_expected: 15
secret_accessor_bindings_applied: 15
dry_run: false
```

Los secretos de integracion marcados como placeholder se crearon para reservar el contrato operacional. Antes de trafico real deben reemplazarse con valores reales por rotacion controlada en Secret Manager.

### Paso 7 - Ejecutar plan Pub/Sub sin modificar Google Cloud

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\infra\gcloud\bootstrap-pubsub.ps1 `
  -ConfigPath .\infra\gcloud\pubsub-prod.json `
  -ProjectId project-fbb34cd7-0b82-43e1-867 `
  -DryRun
```

### Paso 8 - Crear Pub/Sub produccion

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\infra\gcloud\bootstrap-pubsub.ps1 `
  -ConfigPath .\infra\gcloud\pubsub-prod.json `
  -ProjectId project-fbb34cd7-0b82-43e1-867
```

Resultado esperado:

```text
topics_expected: 10
subscriptions_expected: 10
iam_bindings_applied: 15
dry_run: false
```

### Paso 9 - Validar infraestructura produccion

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\infra\gcloud\verify-prod-infra.ps1 `
  -FailOnNotReady
```

Resultado esperado:

```text
Cloud SQL prod instance RUNNABLE       True
Cloud SQL backups enabled              True
Cloud SQL databases complete           True
Cloud SQL IAM DB users complete        True
Storage   prod document bucket exists  True
Secrets   prod secrets ready           True
Pub/Sub   prod topics ready            True
Pub/Sub   prod subscriptions ready     True
Overall   prod infra ready             True
```

La evidencia JSON se guarda en:

```text
C:\VENTA-DE-PASAJES\logs\prod-infra\verify-prod-infra.json
```

## Comandos ejecutados

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\infra\gcloud\bootstrap-pubsub.ps1 -ConfigPath .\infra\gcloud\pubsub-prod.json -ProjectId project-fbb34cd7-0b82-43e1-867 -DryRun

powershell -NoProfile -ExecutionPolicy Bypass -File .\infra\gcloud\bootstrap-cloudsql-dev.ps1 -ConfigPath .\infra\gcloud\cloudsql-prod.json -ProjectId project-fbb34cd7-0b82-43e1-867 -DryRun

powershell -NoProfile -ExecutionPolicy Bypass -File .\infra\gcloud\bootstrap-cloudsql-dev.ps1 -ConfigPath .\infra\gcloud\cloudsql-prod.json -ProjectId project-fbb34cd7-0b82-43e1-867

gcloud storage buckets create gs://venta-pasajes-prod-documents --project project-fbb34cd7-0b82-43e1-867 --location us-central1 --uniform-bucket-level-access --public-access-prevention --default-storage-class STANDARD

powershell -NoProfile -ExecutionPolicy Bypass -File .\infra\gcloud\bootstrap-secrets-dev.ps1 -ConfigPath .\infra\gcloud\secrets-prod.json -ProjectId project-fbb34cd7-0b82-43e1-867

gcloud storage buckets add-iam-policy-binding gs://venta-pasajes-prod-documents --project project-fbb34cd7-0b82-43e1-867 --member serviceAccount:document-service-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com --role roles/storage.objectAdmin

powershell -NoProfile -ExecutionPolicy Bypass -File .\infra\gcloud\bootstrap-pubsub.ps1 -ConfigPath .\infra\gcloud\pubsub-prod.json -ProjectId project-fbb34cd7-0b82-43e1-867

powershell -NoProfile -ExecutionPolicy Bypass -File .\infra\gcloud\verify-prod-infra.ps1 -FailOnNotReady
```

## Validaciones ejecutadas

Validacion final:

```text
Cloud SQL prod instance RUNNABLE: True
Cloud SQL backups enabled: True
Cloud SQL databases complete: True
Cloud SQL IAM DB users complete: True
Storage prod document bucket exists: True
Secrets prod secrets ready: True
Pub/Sub prod topics ready: True
Pub/Sub prod subscriptions ready: True
Overall prod infra ready: True
```

Datos de evidencia:

```text
generated_at: 2026-09-23T11:23:18.9614702-05:00
Cloud SQL: venta-pasajes-prod-sql
Cloud SQL version: POSTGRES_16
Cloud SQL deletion protection: True
Databases expected: 6
IAM DB users expected: 6
Bucket: venta-pasajes-prod-documents
Bucket location: US-CENTRAL1
Secrets expected: 15
Pub/Sub topics expected: 10
Pub/Sub subscriptions expected: 10
Ready: True
```

## Decisiones y pendientes

- La instancia de produccion queda con `deletion_protection=true`.
- La instancia inicial usa `db-f1-micro`, `ZONAL`, SSD de 10 GB y backups diarios con retencion de 14 backups.
- Produccion usa por ahora las cuentas runtime existentes `*-service-run`. El Dia 70 debe endurecer IAM y decidir si se crean cuentas dedicadas por ambiente.
- Los topicos DLQ existen, pero las politicas dead-letter quedaron desactivadas (`enable_dead_letter_policy=false`) hasta cerrar permisos de produccion en el Dia 70.
- Cloud Run produccion todavia no fue desplegado en este dia.
- Estos recursos son reales y pueden generar costo.

## Estado

Dia 69 completado.

Infraestructura produccion existe, esta separada de staging y fue verificada con `ready=True`.
