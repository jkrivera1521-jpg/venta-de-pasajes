# Google Cloud Bootstrap

Scripts para preparar el proyecto Google Cloud de desarrollo.

## Prerrequisitos

- Instalar Google Cloud CLI.
- Ejecutar `gcloud init`.
- Ejecutar `gcloud auth login`.
- Tener Python disponible para `gcloud`; en redes con inspeccion TLS corporativa se recomienda Python 3.12 o 3.13.
- Tener permisos para crear proyectos o usar un proyecto existente.
- Tener un Cloud Billing account activo y permisos para vincular proyectos.
- Tener permisos para crear presupuestos de billing.

Instalacion posible en Windows:

```powershell
choco install gcloudsdk -y
winget install --id Google.CloudSDK --exact
```

Terraform no es obligatorio para Dia 12, pero se usara en dias posteriores:

```powershell
choco install terraform -y
winget install --id Hashicorp.Terraform --exact
```

## Variables esperadas

```powershell
$env:GCLOUD_PATH = "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd"
$env:CLOUDSDK_PYTHON = "C:\Python312\python.exe"
$env:GOOGLE_CLOUD_PROJECT = "venta-pasajes-dev"
$env:GOOGLE_CLOUD_PROJECT_NAME = "Venta de Pasajes Dev"
$env:GOOGLE_CLOUD_REGION = "us-central1"
$env:GOOGLE_BILLING_ACCOUNT_ID = "000000-000000-000000"
$env:GOOGLE_BUDGET_AMOUNT = "50"
$env:GOOGLE_BUDGET_CURRENCY = "USD"
```

Si el proyecto debe vivir dentro de una organizacion o carpeta, configurar solo una:

```powershell
$env:GOOGLE_CLOUD_ORGANIZATION_ID = "1234567890"
$env:GOOGLE_CLOUD_FOLDER_ID = "1234567890"
```

## Dry run

```powershell
.\infra\gcloud\bootstrap-dev.ps1 -DryRun
```

## Ejecucion real

```powershell
.\infra\gcloud\bootstrap-dev.ps1
```

## Verificacion

```powershell
.\infra\gcloud\verify-dev.ps1
```

Si `gcloud` esta instalado pero no aparece en `PATH`, pasar la ruta:

```powershell
.\infra\gcloud\verify-dev.ps1 -GcloudPath "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd"
```

## IAM dev

La matriz IAM vive en:

```text
C:\VENTA-DE-PASAJES\infra\gcloud\iam-dev.json
```

Dry-run:

```powershell
.\infra\gcloud\bootstrap-iam-dev.ps1 -DryRun
```

Ejecucion real:

```powershell
.\infra\gcloud\bootstrap-iam-dev.ps1
```

Verificacion:

```powershell
.\infra\gcloud\verify-iam-dev.ps1
```

Si `gcloud` no esta en `PATH`:

```powershell
$env:CLOUDSDK_PYTHON = "C:\Python312\python.exe"

.\infra\gcloud\bootstrap-iam-dev.ps1 `
  -ProjectId "project-fbb34cd7-0b82-43e1-867" `
  -GcloudPath "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd"

.\infra\gcloud\verify-iam-dev.ps1 `
  -ProjectId "project-fbb34cd7-0b82-43e1-867" `
  -GcloudPath "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd"
```

## Cloud SQL dev

La configuracion Cloud SQL vive en:

```text
C:\VENTA-DE-PASAJES\infra\gcloud\cloudsql-dev.json
```

Dry-run:

```powershell
.\infra\gcloud\bootstrap-cloudsql-dev.ps1 -DryRun
```

Ejecucion real:

```powershell
.\infra\gcloud\bootstrap-cloudsql-dev.ps1
```

Verificacion:

```powershell
.\infra\gcloud\verify-cloudsql-dev.ps1
```

Si `gcloud` no esta en `PATH`:

```powershell
$env:CLOUDSDK_PYTHON = "C:\Python312\python.exe"

.\infra\gcloud\bootstrap-cloudsql-dev.ps1 `
  -ProjectId "project-fbb34cd7-0b82-43e1-867" `
  -GcloudPath "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd"

.\infra\gcloud\verify-cloudsql-dev.ps1 `
  -ProjectId "project-fbb34cd7-0b82-43e1-867" `
  -GcloudPath "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd"
```

La instancia dev actual es:

```text
project-fbb34cd7-0b82-43e1-867:us-central1:venta-pasajes-dev-sql
```

Se usa IAM database authentication para evitar contrasenas de base por servicio en repositorio.

## Secret Manager dev

El catalogo de secretos dev vive en:

```text
C:\VENTA-DE-PASAJES\infra\gcloud\secrets-dev.json
```

Dry-run:

```powershell
.\infra\gcloud\bootstrap-secrets-dev.ps1 -DryRun
```

Ejecucion real:

```powershell
.\infra\gcloud\bootstrap-secrets-dev.ps1
```

Verificacion:

```powershell
.\infra\gcloud\verify-secrets-dev.ps1
```

Si `gcloud` no esta en `PATH`:

```powershell
$env:CLOUDSDK_PYTHON = "C:\Python312\python.exe"

.\infra\gcloud\bootstrap-secrets-dev.ps1 `
  -ProjectId "project-fbb34cd7-0b82-43e1-867" `
  -GcloudPath "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd"

.\infra\gcloud\verify-secrets-dev.ps1 `
  -ProjectId "project-fbb34cd7-0b82-43e1-867" `
  -GcloudPath "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd"
```

Los valores de secretos no se imprimen ni se guardan en el repositorio. Las versiones se cargan mediante archivo temporal redacted y eliminado al finalizar el comando.

## Certificados corporativos

Si `gcloud` falla con `CERTIFICATE_VERIFY_FAILED`, exportar la CA corporativa a PEM y configurar un bundle que incluya el `cacert.pem` de `gcloud` mas esa CA:

```powershell
gcloud config set core/custom_ca_certs_file "C:\VENTA-DE-PASAJES\certs\gcloud-custom-ca-bundle.pem"
```

Evitar dejar `auth/disable_ssl_validation` en `true`; solo debe usarse para diagnostico temporal.

Si aparece `Missing Authority Key Identifier`, usar Python 3.12 o 3.13 con:

```powershell
$env:CLOUDSDK_PYTHON = "C:\Python312\python.exe"
```

## APIs base

La lista de APIs vive en:

```text
C:\VENTA-DE-PASAJES\infra\gcloud\dev-apis.txt
```

Incluye Cloud Run, Cloud SQL Admin, Cloud Build, Artifact Registry, Secret Manager, Cloud Storage, Pub/Sub, Logging, Monitoring, IAM, Cloud Billing, Billing Budgets, Cloud Resource Manager y Service Usage.

## Presupuesto

El bootstrap crea un presupuesto mensual inicial para el proyecto dev, con alertas al 50%, 75%, 90% forecasted y 100% del gasto configurado.

El presupuesto genera alertas. No es un limite duro de gasto ni apaga recursos automaticamente.

## Fuentes oficiales

- `gcloud projects create`: https://docs.cloud.google.com/sdk/gcloud/reference/projects/create
- `gcloud billing projects link`: https://docs.cloud.google.com/sdk/gcloud/reference/billing/projects/link
- `gcloud services enable`: https://docs.cloud.google.com/sdk/gcloud/reference/services/enable
- `gcloud beta billing budgets create`: https://docs.cloud.google.com/sdk/gcloud/reference/beta/billing/budgets/create
- Secret Manager: https://docs.cloud.google.com/secret-manager/docs
- `gcloud secrets create`: https://docs.cloud.google.com/sdk/gcloud/reference/secrets/create
- `gcloud secrets add-iam-policy-binding`: https://docs.cloud.google.com/sdk/gcloud/reference/secrets/add-iam-policy-binding
- Google Cloud SDK: https://cloud.google.com/sdk
