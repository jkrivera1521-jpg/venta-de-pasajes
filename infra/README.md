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

## Dia 54 Cloud Run dev

Cloud Run dev service descriptors:

```text
C:\VENTA-DE-PASAJES\infra\cloudrun\dev-services.json
```

Generate deploy commands without changing Google Cloud:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\deploy-cloudrun-dev.ps1 -ImageTag dev
```

Generated files:

```text
C:\VENTA-DE-PASAJES\logs\cloudrun-dev\deploy-cloudrun-dev.commands.ps1
C:\VENTA-DE-PASAJES\logs\cloudrun-dev\deploy-cloudrun-dev.commands.plan.json
```

Execute real deployment only after confirming the referenced images exist in Artifact Registry:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\deploy-cloudrun-dev.ps1 -ImageTag <tag> -Execute
```
