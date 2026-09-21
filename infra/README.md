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
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\deploy-cloudrun-dev.ps1 -ImageTag 0.1.0-native -ServiceIds identity-service,dispatch-service,ticketing-service
```

Generated files:

```text
C:\VENTA-DE-PASAJES\logs\cloudrun-dev\deploy-cloudrun-dev.commands.ps1
C:\VENTA-DE-PASAJES\logs\cloudrun-dev\deploy-cloudrun-dev.commands.plan.json
```

Execute real deployment only after confirming the referenced images exist in Artifact Registry:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\deploy-cloudrun-dev.ps1 -ImageTag 0.1.0-native -ServiceIds identity-service,dispatch-service,ticketing-service -Execute
```

`ticketing-service` can be deployed with this same group when its image tag exists. In Cloud Run dev, document integration is disabled by default so the service does not require `document-service` to start:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\deploy-cloudrun-dev.ps1 -ImageTag dev -ServiceIds identity-service,dispatch-service,ticketing-service -Execute
```

## Dia 55 Artifact Registry tags

Promote already published backend images from `0.1.0-native` to `dev`:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\promote-artifact-image-tags.ps1 -SourceTag 0.1.0-native -TargetTag dev
```

The command above is plan-only. Execute the real tag promotion only after reviewing the generated plan:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\promote-artifact-image-tags.ps1 -SourceTag 0.1.0-native -TargetTag dev -Execute
```

## Dia 56 document-service native image

Validate the `document-service` native image plan without compiling:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-document-service-native.ps1 -PlanOnly
```

Build and tag the local native image:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-document-service-native.ps1 -UseCleanWorkspace
```

Publish after the local image exists:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-document-service-native.ps1 -SkipNativeBuild -SkipDockerBuild -Push
```

## Dia 57 document-service Cloud Run dev

Validate the `document-service` dev image before deployment:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\deploy-cloudrun-dev.ps1 -ImageTag dev -ServiceIds document-service -CheckImagesOnly
```

Deploy only `document-service` to Cloud Run dev:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\deploy-cloudrun-dev.ps1 -ImageTag dev -ServiceIds document-service -Execute
```

Validate the private health endpoint with an identity token:

```powershell
$env:CLOUDSDK_PYTHON = "C:\Python312\python.exe"
$GcloudPath = "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd"
$Url = (& $GcloudPath run services describe document-service --project project-fbb34cd7-0b82-43e1-867 --region us-central1 --format "value(status.url)").Trim()
$Token = (& $GcloudPath auth print-identity-token).Trim()
curl.exe --ssl-no-revoke -i -sS -H "Authorization: Bearer $Token" "$Url/api/v1/document/health"
```

## Dia 58 reporting-service native image

Validate the `reporting-service` native image plan without compiling:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-reporting-service-native.ps1 -PlanOnly
```

Run JVM tests before native compilation:

```powershell
mvn -f .\services\reporting-service\pom.xml test
```

Docker Desktop must be running before compiling the native image:

```powershell
docker info
```

Build and tag the local native image:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-reporting-service-native.ps1 -UseCleanWorkspace
```

Inspect the local image:

```powershell
docker image inspect reporting-service:0.1.0-native --format "{{.Id}} {{.Size}} {{.Architecture}}/{{.Os}}"
```

Run a temporary local health validation:

```powershell
$ContainerName = "venta-pasajes-reporting-native-test"
$Port = 18085
$Existing = docker ps -a --filter "name=$ContainerName" --format "{{.Names}}"
if ($Existing -contains $ContainerName) { docker rm -f $ContainerName | Out-Null }
$ContainerId = docker run -d --name $ContainerName -p ${Port}:8085 -e QUARKUS_DATASOURCE_HEALTH_ENABLED=false reporting-service:0.1.0-native
try {
  Start-Sleep -Seconds 3
  curl.exe -s -i "http://localhost:$Port/api/v1/reporting/health"
}
finally {
  docker rm -f $ContainerName | Out-Null
}
```

Publish after the local image exists:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-reporting-service-native.ps1 -SkipNativeBuild -SkipDockerBuild -Push
```

## Dia 59 reporting-service Cloud Run dev

Publish the native image to Artifact Registry:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-reporting-service-native.ps1 -SkipNativeBuild -SkipDockerBuild -Push
```

Promote `reporting-service:0.1.0-native` to `reporting-service:dev`:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\promote-artifact-image-tags.ps1 -ServiceIds reporting-service -SourceTag 0.1.0-native -TargetTag dev
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\promote-artifact-image-tags.ps1 -ServiceIds reporting-service -SourceTag 0.1.0-native -TargetTag dev -Execute
```

Validate the `reporting-service` dev image before deployment:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\deploy-cloudrun-dev.ps1 -ImageTag dev -ServiceIds reporting-service -CheckImagesOnly
```

Deploy only `reporting-service` to Cloud Run dev:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\deploy-cloudrun-dev.ps1 -ImageTag dev -ServiceIds reporting-service -Execute
```

Validate the private health endpoint with an identity token:

```powershell
$env:CLOUDSDK_PYTHON = "C:\Python312\python.exe"
$GcloudPath = "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd"
$Url = (& $GcloudPath run services describe reporting-service --project project-fbb34cd7-0b82-43e1-867 --region us-central1 --format "value(status.url)").Trim()
$Token = (& $GcloudPath auth print-identity-token).Trim()
curl.exe --ssl-no-revoke -i -sS -H "Authorization: Bearer $Token" "$Url/api/v1/reporting/health"
```

## Dia 60 audit-service native image

Validate the `audit-service` native image plan without compiling:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-audit-service-native.ps1 -PlanOnly
```

Run JVM tests before native compilation:

```powershell
mvn -f .\services\audit-service\pom.xml test
```

Docker Desktop must be running before compiling the native image:

```powershell
docker info
```

Build and tag the local native image:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-audit-service-native.ps1 -UseCleanWorkspace
```

Inspect the local image:

```powershell
docker image inspect audit-service:0.1.0-native --format "{{.Id}} {{.Size}} {{.Architecture}}/{{.Os}}"
```

Run a temporary local health validation:

```powershell
$ContainerName = "venta-pasajes-audit-native-test"
$Port = 18086
$Existing = docker ps -a --filter "name=$ContainerName" --format "{{.Names}}"
if ($Existing -contains $ContainerName) { docker rm -f $ContainerName | Out-Null }
$ContainerId = docker run -d --name $ContainerName -p ${Port}:8086 -e QUARKUS_DATASOURCE_HEALTH_ENABLED=false audit-service:0.1.0-native
try {
  Start-Sleep -Seconds 3
  curl.exe -s -i "http://localhost:$Port/api/v1/audit/health"
}
finally {
  docker rm -f $ContainerName | Out-Null
}
```

Publish after the local image exists:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-audit-service-native.ps1 -SkipNativeBuild -SkipDockerBuild -Push
```
