# Infra

Infrastructure workspace for Google Cloud resources.

## Folders

- `terraform`: infrastructure as code.
- `cloudbuild`: Cloud Build pipelines.
- `cloudrun`: Cloud Run service descriptors.
- `env`: environment variable templates for GCP and on-premise runtimes.
- `gcloud`: bootstrap and verification scripts for Google Cloud projects.

Secrets must never live in this repository.

- Google Cloud runtimes use Secret Manager.
- On-premise/offline runtimes use environment variables or local secret files outside the repository.

Current dev Cloud SQL connection name:

```text
project-fbb34cd7-0b82-43e1-867:us-central1:venta-pasajes-dev-sql
```

Current dev Secret Manager catalog:

```text
C:\VENTA-DE-PASAJES\infra\gcloud\secrets-dev.json
```

On-premise/offline guide:

```text
C:\VENTA-DE-PASAJES\docs\onpremise-offline-runbook.md
```

## Dia 12 bootstrap

Google Cloud CLI is required before creating cloud resources:

```powershell
.\infra\gcloud\bootstrap-dev.ps1 -DryRun
.\infra\gcloud\bootstrap-dev.ps1
.\infra\gcloud\verify-dev.ps1
```
