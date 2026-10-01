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

## Dia 61 audit-service Cloud Run dev

Publish the native image to Artifact Registry:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-audit-service-native.ps1 -SkipNativeBuild -SkipDockerBuild -Push
```

Promote `audit-service:0.1.0-native` to `audit-service:dev`:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\promote-artifact-image-tags.ps1 -ServiceIds audit-service -SourceTag 0.1.0-native -TargetTag dev
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\promote-artifact-image-tags.ps1 -ServiceIds audit-service -SourceTag 0.1.0-native -TargetTag dev -Execute
```

Validate the `audit-service` dev image before deployment:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\deploy-cloudrun-dev.ps1 -ImageTag dev -ServiceIds audit-service -CheckImagesOnly
```

Deploy only `audit-service` to Cloud Run dev:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\deploy-cloudrun-dev.ps1 -ImageTag dev -ServiceIds audit-service -Execute
```

Validate the private health endpoint with an identity token:

```powershell
$env:CLOUDSDK_PYTHON = "C:\Python312\python.exe"
$GcloudPath = "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd"
$Url = (& $GcloudPath run services describe audit-service --project project-fbb34cd7-0b82-43e1-867 --region us-central1 --format "value(status.url)").Trim()
$Token = (& $GcloudPath auth print-identity-token).Trim()
curl.exe --ssl-no-revoke -i -sS -H "Authorization: Bearer $Token" "$Url/api/v1/audit/health"
```

## Dia 62 frontend Docker images

Validate the frontend image plan without building:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-frontend-images.ps1 -PlanOnly
```

Build the six local Next.js standalone images:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-frontend-images.ps1 -ImageTag 0.1.0-frontend
```

Validate all local frontend containers:

```powershell
$Checks = @(
  @{ App = "frontend-shell"; Image = "frontend-shell:0.1.0-frontend"; ContainerPort = 3000; HostPort = 13000 },
  @{ App = "mfe-identity"; Image = "mfe-identity:0.1.0-frontend"; ContainerPort = 3001; HostPort = 13001 },
  @{ App = "mfe-dispatch"; Image = "mfe-dispatch:0.1.0-frontend"; ContainerPort = 3002; HostPort = 13002 },
  @{ App = "mfe-ticketing"; Image = "mfe-ticketing:0.1.0-frontend"; ContainerPort = 3003; HostPort = 13003 },
  @{ App = "mfe-reporting"; Image = "mfe-reporting:0.1.0-frontend"; ContainerPort = 3004; HostPort = 13004 },
  @{ App = "mfe-admin"; Image = "mfe-admin:0.1.0-frontend"; ContainerPort = 3005; HostPort = 13005 }
)

$Checks | ForEach-Object {
  $ContainerName = "venta-pasajes-$($_.App)-frontend-test"
  $Existing = docker ps -a --filter "name=$ContainerName" --format "{{.Names}}"
  if ($Existing -contains $ContainerName) { docker rm -f $ContainerName | Out-Null }
  docker run -d --name $ContainerName -p "$($_.HostPort):$($_.ContainerPort)" $_.Image | Out-Null
  try {
    Start-Sleep -Seconds 3
    curl.exe -s -o NUL -w "$($_.App) %{http_code}`n" "http://localhost:$($_.HostPort)/api/health"
  }
  finally {
    docker rm -f $ContainerName | Out-Null
  }
}
```

Publish the already-built images to Artifact Registry:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-frontend-images.ps1 `
  -ImageTag 0.1.0-frontend `
  -SkipNextBuild `
  -SkipDockerBuild `
  -Push
```

Validate one remote image:

```powershell
$env:CLOUDSDK_PYTHON = "C:\Python312\python.exe"
$GcloudPath = "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd"
& $GcloudPath artifacts docker images describe `
  "us-central1-docker.pkg.dev/project-fbb34cd7-0b82-43e1-867/venta-pasajes-dev/frontend-shell:0.1.0-frontend" `
  --project "project-fbb34cd7-0b82-43e1-867" `
  --format "value(image_summary.fully_qualified_digest)"
```

## Dia 63 frontend Cloud Run dev

Promote frontend images from `0.1.0-frontend` to `dev`:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\promote-artifact-image-tags.ps1 `
  -ServiceIds frontend-shell,mfe-identity,mfe-dispatch,mfe-ticketing,mfe-reporting,mfe-admin `
  -SourceTag 0.1.0-frontend `
  -TargetTag dev `
  -Execute
```

Preflight frontend images before deployment:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\deploy-cloudrun-dev.ps1 `
  -ImageTag dev `
  -FrontendOnly `
  -ResolveExistingServiceUrls `
  -CheckImagesOnly
```

Bootstrap frontend services when they do not exist yet:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\deploy-cloudrun-dev.ps1 `
  -ImageTag dev `
  -FrontendOnly `
  -ResolveExistingServiceUrls `
  -Execute `
  -AllowUnresolved
```

Run the definitive deployment after Cloud Run assigned frontend URLs:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\deploy-cloudrun-dev.ps1 `
  -ImageTag dev `
  -FrontendOnly `
  -ResolveExistingServiceUrls `
  -Execute
```

Validate public health endpoints:

```powershell
$FrontendUrls = @(
  "https://mfe-identity-io7kxgn6yq-uc.a.run.app/api/health",
  "https://mfe-dispatch-io7kxgn6yq-uc.a.run.app/api/health",
  "https://mfe-ticketing-io7kxgn6yq-uc.a.run.app/api/health",
  "https://mfe-reporting-io7kxgn6yq-uc.a.run.app/api/health",
  "https://mfe-admin-io7kxgn6yq-uc.a.run.app/api/health",
  "https://frontend-shell-io7kxgn6yq-uc.a.run.app/api/health"
)

$FrontendUrls | ForEach-Object {
  curl.exe --ssl-no-revoke -s -o NUL -w "$_ %{http_code}`n" $_
}
```

## Dia 64 frontend-shell runtime config

Build and publish only the updated `frontend-shell` image:

```powershell
npm run typecheck -w @venta-pasajes/frontend-shell
npm run build -w @venta-pasajes/frontend-shell

powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-frontend-images.ps1 `
  -Apps frontend-shell `
  -ImageTag 0.1.1-frontend `
  -SkipSharedTypesBuild

powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-frontend-images.ps1 `
  -Apps frontend-shell `
  -ImageTag 0.1.1-frontend `
  -SkipNextBuild `
  -SkipDockerBuild `
  -Push
```

Promote and deploy only `frontend-shell`:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\promote-artifact-image-tags.ps1 `
  -ServiceIds frontend-shell `
  -SourceTag 0.1.1-frontend `
  -TargetTag dev `
  -Execute

powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\deploy-cloudrun-dev.ps1 `
  -ImageTag dev `
  -ServiceIds frontend-shell `
  -ResolveExistingServiceUrls `
  -Execute
```

Validate the public runtime config and ensure browser bundles do not contain `localhost`:

```powershell
$ShellUrl = "https://frontend-shell-io7kxgn6yq-uc.a.run.app"
curl.exe --ssl-no-revoke -s "$ShellUrl/api/shell/runtime-config"

$Html = curl.exe --ssl-no-revoke -s "$ShellUrl/"
$Scripts = [regex]::Matches($Html, 'src="([^"]+\.js[^"]*)"') |
  ForEach-Object { $_.Groups[1].Value } |
  Sort-Object -Unique

$Results = foreach ($Script in $Scripts) {
  $ScriptUrl = if ($Script.StartsWith("http")) { $Script } else { "$ShellUrl$Script" }
  $Body = curl.exe --ssl-no-revoke -s $ScriptUrl
  [pscustomobject]@{
    Script = $Script
    ContainsLocalhost = $Body.Contains("localhost:")
    ContainsRuntimeConfig = $Body.Contains("/api/shell/runtime-config")
  }
}

$Results | Format-Table -AutoSize
```

## Dia 65 MFE to private backend auth

Grant Cloud Run invoker from the frontend runtime service account to private backends.

Generate and review the plan:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\grant-cloudrun-invoker.ps1
Get-Content -LiteralPath .\logs\cloudrun-dev\grant-cloudrun-invoker.plan.json -Raw
```

Execute only after reviewing the plan:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\grant-cloudrun-invoker.ps1 -Execute
```

Build and publish the MFE images that include Cloud Run service-to-service auth:

```powershell
npm run typecheck -w @venta-pasajes/mfe-identity
npm run typecheck -w @venta-pasajes/mfe-dispatch
npm run typecheck -w @venta-pasajes/mfe-ticketing
npm run typecheck -w @venta-pasajes/mfe-reporting
npm run typecheck -w @venta-pasajes/mfe-admin

powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-frontend-images.ps1 `
  -Apps mfe-identity,mfe-dispatch,mfe-ticketing,mfe-reporting,mfe-admin `
  -ImageTag 0.1.2-frontend `
  -SkipSharedTypesBuild

powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-frontend-images.ps1 `
  -Apps mfe-identity,mfe-dispatch,mfe-ticketing,mfe-reporting,mfe-admin `
  -ImageTag 0.1.2-frontend `
  -SkipNextBuild `
  -SkipDockerBuild `
  -Push
```

Promote and deploy:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\promote-artifact-image-tags.ps1 `
  -ServiceIds mfe-identity,mfe-dispatch,mfe-ticketing,mfe-reporting,mfe-admin `
  -SourceTag 0.1.2-frontend `
  -TargetTag dev `
  -Execute

powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\deploy-cloudrun-dev.ps1 `
  -ImageTag dev `
  -ServiceIds mfe-identity,mfe-dispatch,mfe-ticketing,mfe-reporting,mfe-admin `
  -ResolveExistingServiceUrls `
  -Execute
```

Important backend note:

```text
Dia 65 solved MFE -> private backend authentication.
Some functional backend queries can still return HTTP 500 until native backend images include a Cloud SQL Socket Factory solution compatible with GraalVM/Mandrel.
```

## Dia 66 Backend JVM Cloud Run and Flyway

Build, publish and deploy JVM backend images for Cloud Run dev:

```powershell
cd C:\VENTA-DE-PASAJES

powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-backend-jvm-images.ps1 `
  -ImageTag 0.1.1-jvm `
  -PlanOnly

powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-backend-jvm-images.ps1 `
  -ImageTag 0.1.1-jvm

powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-backend-jvm-images.ps1 `
  -ImageTag 0.1.1-jvm `
  -SkipPackage `
  -SkipDockerBuild `
  -Push

powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\deploy-cloudrun-dev.ps1 `
  -ImageTag 0.1.1-jvm `
  -BackendOnly `
  -CheckImagesOnly
```

Apply Cloud SQL schema grants before enabling Flyway migrations:

```powershell
cd C:\VENTA-DE-PASAJES

powershell -NoProfile -ExecutionPolicy Bypass -File .\infra\gcloud\grant-cloudsql-schema-dev.ps1

powershell -NoProfile -ExecutionPolicy Bypass -File .\infra\gcloud\grant-cloudsql-schema-dev.ps1 `
  -Execute
```

Deploy backends and validate:

```powershell
cd C:\VENTA-DE-PASAJES

powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\deploy-cloudrun-dev.ps1 `
  -ImageTag 0.1.1-jvm `
  -BackendOnly `
  -Execute
```

Important note:

```text
The JVM path is the validated Cloud Run dev backend path.
Native backend images with Cloud SQL Socket Factory remain a separate technical pending item.
```

## Dia 67 UAT corrections and release candidate verification

Run the read-only full stack verifier used to repeat the affected UAT checks:

```powershell
cd C:\VENTA-DE-PASAJES

powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-cloudrun-dev-stack.ps1
```

The expected result is:

```text
Verificacion Cloud Run dev OK: 34/34 checks.
```

To run only health, manifests, runtime config and embedded pages:

```powershell
cd C:\VENTA-DE-PASAJES

powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-cloudrun-dev-stack.ps1 -SkipFunctionalChecks
```

The JSON result is written to:

```text
C:\VENTA-DE-PASAJES\logs\cloudrun-dev\verify-cloudrun-dev-stack.result.json
```

## Dia 68 staging backup and restore

Staging Cloud SQL and the staging document bucket now exist:

```powershell
cd C:\VENTA-DE-PASAJES

gcloud sql instances describe venta-pasajes-staging-sql `
  --project project-fbb34cd7-0b82-43e1-867 `
  --format="table(name,state,databaseVersion,region,settings.tier)"

gcloud storage buckets describe gs://venta-pasajes-staging-documents `
  --project project-fbb34cd7-0b82-43e1-867
```

Run the backup/restore readiness verifier for staging:

```powershell
cd C:\VENTA-DE-PASAJES

powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-backup-restore-readiness.ps1 `
  -Environment staging
```

Expected final state:

```text
Cloud SQL source instance exists: True
Cloud SQL backup enabled: True
Cloud SQL successful backups: 1 or more
Cloud SQL restore target free: True
Storage document bucket exists: True
Overall ready for restore test: True
```

The first real restore test used backup `1790111529323` and measured an initial Cloud SQL RTO of `17.45` minutes.

Temporary restore resources were removed after validation:

```powershell
cd C:\VENTA-DE-PASAJES

gcloud storage rm --recursive gs://venta-pasajes-staging-documents-restore-test `
  --project project-fbb34cd7-0b82-43e1-867 `
  --quiet

gcloud sql instances delete venta-pasajes-staging-restore-test `
  --project project-fbb34cd7-0b82-43e1-867 `
  --quiet
```

Evidence:

```text
C:\VENTA-DE-PASAJES\docs\dia-68-backups-restauracion-staging.md
C:\VENTA-DE-PASAJES\logs\backup-restore\dia68-restore-evidence.json
C:\VENTA-DE-PASAJES\logs\backup-restore\verify-backup-restore-readiness-staging.json
```

## Dia 69 production infrastructure

Production base resources now exist and are separated from staging:

```text
Cloud SQL: venta-pasajes-prod-sql
Document bucket: gs://venta-pasajes-prod-documents
Secrets catalog: C:\VENTA-DE-PASAJES\infra\gcloud\secrets-prod.json
Pub/Sub catalog: C:\VENTA-DE-PASAJES\infra\gcloud\pubsub-prod.json
```

Run the production infrastructure verifier:

```powershell
cd C:\VENTA-DE-PASAJES

$env:CLOUDSDK_PYTHON = "C:\Python312\python.exe"

powershell -NoProfile -ExecutionPolicy Bypass -File .\infra\gcloud\verify-prod-infra.ps1 `
  -FailOnNotReady
```

Expected final state:

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

Evidence:

```text
C:\VENTA-DE-PASAJES\docs\dia-69-infraestructura-produccion.md
C:\VENTA-DE-PASAJES\logs\prod-infra\verify-prod-infra.json
```

## Dia 70 production IAM and final security

Production IAM now uses dedicated production service accounts and resource-level bindings:

```text
IAM matrix: C:\VENTA-DE-PASAJES\infra\gcloud\iam-prod.json
Bootstrap:  C:\VENTA-DE-PASAJES\infra\gcloud\bootstrap-iam-prod.ps1
Verifier:   C:\VENTA-DE-PASAJES\infra\gcloud\verify-iam-prod.ps1
```

Run from the repository root:

```powershell
cd C:\VENTA-DE-PASAJES

$env:CLOUDSDK_PYTHON = "C:\Python312\python.exe"

powershell -NoProfile -ExecutionPolicy Bypass -File .\infra\gcloud\bootstrap-iam-prod.ps1 `
  -ProjectId project-fbb34cd7-0b82-43e1-867 `
  -DryRun `
  -RemoveLegacyBindings
```

Apply the real IAM change:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\infra\gcloud\bootstrap-iam-prod.ps1 `
  -ProjectId project-fbb34cd7-0b82-43e1-867 `
  -RemoveLegacyBindings
```

Verify:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\infra\gcloud\verify-iam-prod.ps1 `
  -FailOnNotReady

powershell -NoProfile -ExecutionPolicy Bypass -File .\infra\gcloud\verify-prod-infra.ps1 `
  -FailOnNotReady
```

Expected final state:

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

Evidence:

```text
C:\VENTA-DE-PASAJES\docs\dia-70-iam-produccion-seguridad-final.md
C:\VENTA-DE-PASAJES\logs\prod-iam\verify-iam-prod.json
```

## Dia 71 production domain, TLS and entrypoint

Production entrypoint configuration and verification are prepared here:

```text
Config:    C:\VENTA-DE-PASAJES\infra\gcloud\entrypoint-prod.json
Bootstrap: C:\VENTA-DE-PASAJES\infra\gcloud\bootstrap-prod-entrypoint.ps1
Verifier:  C:\VENTA-DE-PASAJES\infra\gcloud\verify-prod-entrypoint.ps1
```

The real URL is intentionally pending until a real domain is confirmed and `frontend-shell` runs as production:

```text
Expected app env: prod
Expected runtime: frontend-prod-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com
```

Verify current status:

```powershell
cd C:\VENTA-DE-PASAJES

$env:CLOUDSDK_PYTHON = "C:\Python312\python.exe"

powershell -NoProfile -ExecutionPolicy Bypass -File .\infra\gcloud\verify-prod-entrypoint.ps1
```

Plan with a real domain:

```powershell
$DomainName = Read-Host "Ingrese el dominio productivo real"

powershell -NoProfile -ExecutionPolicy Bypass -File .\infra\gcloud\bootstrap-prod-entrypoint.ps1 `
  -DomainName $DomainName
```

Apply only after the production frontend is deployed:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\infra\gcloud\bootstrap-prod-entrypoint.ps1 `
  -DomainName $DomainName `
  -Execute
```

Final verification:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\infra\gcloud\verify-prod-entrypoint.ps1 `
  -DomainName $DomainName `
  -FailOnNotReady
```

Evidence:

```text
C:\VENTA-DE-PASAJES\docs\dia-71-dominio-tls-entrada-productiva.md
C:\VENTA-DE-PASAJES\logs\prod-entrypoint\verify-prod-entrypoint.json
```

## Dia 72 production backend Cloud Run

Production backend Cloud Run descriptors:

```text
C:\VENTA-DE-PASAJES\infra\cloudrun\prod-backend-services.json
```

Note: some reusable scripts still have `dev` in the filename, but this day runs them with production configuration files. The effective target is defined by `prod-backend-services.json` and `cloudsql-prod.json`.

Synchronize JSON connection secrets when `secrets-prod.json` changes:

```powershell
cd C:\VENTA-DE-PASAJES

powershell -NoProfile -ExecutionPolicy Bypass -File .\infra\gcloud\sync-json-secrets-from-config.ps1 `
  -ConfigPath .\infra\gcloud\secrets-prod.json

powershell -NoProfile -ExecutionPolicy Bypass -File .\infra\gcloud\sync-json-secrets-from-config.ps1 `
  -ConfigPath .\infra\gcloud\secrets-prod.json `
  -Execute
```

Apply production schema grants before running Flyway migrations:

```powershell
cd C:\VENTA-DE-PASAJES

powershell -NoProfile -ExecutionPolicy Bypass -File .\infra\gcloud\grant-cloudsql-schema-dev.ps1 `
  -ConfigPath .\infra\gcloud\cloudsql-prod.json `
  -ProjectId project-fbb34cd7-0b82-43e1-867 `
  -ConnectionMode import `
  -Execute
```

Promote validated JVM images to the backend production tag:

```powershell
cd C:\VENTA-DE-PASAJES

powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\promote-artifact-image-tags.ps1 `
  -ServiceIds identity-service,dispatch-service,ticketing-service,document-service,reporting-service,audit-service `
  -SourceTag 0.1.1-jvm `
  -TargetTag prod-backend-0.1.1-jvm `
  -Execute
```

Deploy private backend production services:

```powershell
cd C:\VENTA-DE-PASAJES

powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\deploy-cloudrun-dev.ps1 `
  -ConfigPath .\infra\cloudrun\prod-backend-services.json `
  -ImageTag prod-backend-0.1.1-jvm `
  -BackendOnly `
  -Execute `
  -OutputPath logs\cloudrun-prod\deploy-cloudrun-prod.commands.ps1
```

Verify:

```powershell
cd C:\VENTA-DE-PASAJES

powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-cloudrun-prod-backends.ps1 `
  -FailOnNotReady
```

Expected final state:

```text
identity-service-prod Ready: True
dispatch-service-prod Ready: True
ticketing-service-prod Ready: True
document-service-prod Ready: True
reporting-service-prod Ready: True
audit-service-prod Ready: True
Backend productivo listo: True
```

Evidence:

```text
C:\VENTA-DE-PASAJES\docs\dia-72-despliegue-productivo-backend.md
C:\VENTA-DE-PASAJES\logs\cloudrun-prod\verify-cloudrun-prod-backends.json
```

## Dia 73 production frontend Cloud Run

Production frontend Cloud Run descriptors:

```text
C:\VENTA-DE-PASAJES\infra\cloudrun\prod-frontend-services.json
```

Promote validated frontend images from `dev` to the production frontend tag:

```powershell
cd C:\VENTA-DE-PASAJES

powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\promote-artifact-image-tags.ps1 `
  -ServiceIds frontend-shell,mfe-identity,mfe-dispatch,mfe-ticketing,mfe-reporting,mfe-admin `
  -SourceTag dev `
  -TargetTag prod-frontend-20260924 `
  -Execute
```

Grant frontend production runtimes permission to invoke private production backends:

```powershell
cd C:\VENTA-DE-PASAJES

powershell -NoProfile -ExecutionPolicy Bypass -File .\infra\gcloud\grant-prod-frontend-backend-invokers.ps1 `
  -Execute
```

Deploy production frontends. Run a bootstrap pass only when services do not exist yet:

```powershell
cd C:\VENTA-DE-PASAJES

powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\deploy-cloudrun-dev.ps1 `
  -ConfigPath .\infra\cloudrun\prod-frontend-services.json `
  -ImageTag prod-frontend-20260924 `
  -FrontendOnly `
  -ResolveExistingServiceUrls `
  -AllowUnresolved `
  -Execute `
  -OutputPath logs\cloudrun-prod\deploy-cloudrun-prod-frontends.commands.ps1
```

Then run the definitive pass without unresolved values:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\deploy-cloudrun-dev.ps1 `
  -ConfigPath .\infra\cloudrun\prod-frontend-services.json `
  -ImageTag prod-frontend-20260924 `
  -FrontendOnly `
  -ResolveExistingServiceUrls `
  -Execute `
  -OutputPath logs\cloudrun-prod\deploy-cloudrun-prod-frontends.commands.ps1
```

Verify:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-cloudrun-prod-frontends.ps1 `
  -FailOnNotReady
```

Expected final state:

```text
frontend-shell-prod Ready: True
mfe-identity-prod Ready: True
mfe-dispatch-prod Ready: True
mfe-ticketing-prod Ready: True
mfe-reporting-prod Ready: True
mfe-admin-prod Ready: True
Frontend productivo listo: True
```

Evidence:

```text
C:\VENTA-DE-PASAJES\docs\dia-73-despliegue-productivo-frontend.md
C:\VENTA-DE-PASAJES\logs\cloudrun-prod\verify-cloudrun-prod-frontends.json
```

## Dia 74 final migration rehearsal

The final migration rehearsal reads the legacy Access file and generates SQL loads for the service-owned PostgreSQL databases:

```text
C:\VENTA-DE-PASAJES\legacy\sistema\Proyect\usuario.mdb
C:\VENTA-DE-PASAJES\scripts\run-final-migration-rehearsal.ps1
```

Run the rehearsal and local from-scratch PostgreSQL validation:

```powershell
cd C:\VENTA-DE-PASAJES

powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\run-final-migration-rehearsal.ps1 `
  -ValidateLocal `
  -FailOnBlocked
```

Expected final state:

```text
Access copy hash matches source: True
identity users: 1
dispatch terminals: 2
dispatch buses: 1
dispatch departures: 1
ticketing passengers: 3
ticketing departure_seats: 25
ticketing tickets: 3
ready_for_staging_execution: True
estimated cutover: 17.57 minutes
```

Evidence:

```text
C:\VENTA-DE-PASAJES\docs\dia-74-ensayo-migracion-final.md
C:\VENTA-DE-PASAJES\logs\migration\dia74-final-rehearsal\final-migration-rehearsal.json
```

## Dia 75 cutover and rollback plan

The production cutover plan is local documentation plus validation evidence. It does not execute Cloud Run, Cloud SQL or traffic changes by itself:

```text
C:\VENTA-DE-PASAJES\infra\cutover\prod-cutover-plan.json
C:\VENTA-DE-PASAJES\scripts\verify-cutover-rollback-plan.ps1
```

Validate the plan:

```powershell
cd C:\VENTA-DE-PASAJES

powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-cutover-rollback-plan.ps1 `
  -FailOnBlocker
```

Expected state:

```text
Plan de corte controlado listo: True
Ejecucion real autorizada: False
```

The real execution remains blocked until business approval changes the plan status to `approved_for_execution`.

Evidence:

```text
C:\VENTA-DE-PASAJES\docs\dia-75-plan-corte-rollback.md
C:\VENTA-DE-PASAJES\logs\cutover\dia75-cutover-readiness.json
```

## Dia 76 operational training package

Operational training is documentation and readiness validation. It does not modify infrastructure:

```text
C:\VENTA-DE-PASAJES\docs\manual-usuario-operativo.md
C:\VENTA-DE-PASAJES\docs\faq-operativa.md
C:\VENTA-DE-PASAJES\docs\registro-capacitacion-operativa.md
C:\VENTA-DE-PASAJES\scripts\verify-operational-training.ps1
```

Validate the package:

```powershell
cd C:\VENTA-DE-PASAJES

powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-operational-training.ps1 `
  -FailOnBlocker
```

Expected state:

```text
Paquete de capacitacion listo: True
Capacitacion real firmada: False
```

After real attendance and signatures are recorded, validate the closure:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-operational-training.ps1 `
  -RequireSignedAttendance `
  -FailOnBlocker
```

Evidence:

```text
C:\VENTA-DE-PASAJES\docs\dia-76-capacitacion-operativa.md
C:\VENTA-DE-PASAJES\logs\training\dia76-operational-training-readiness.json
```

## Dia 77 final data migration package

The Day 77 package prepares production SQL imports but does not modify Cloud SQL until the cutover plan is explicitly approved:

```text
C:\VENTA-DE-PASAJES\scripts\run-final-data-migration-prod.ps1
```

Prepare and validate locally:

```powershell
cd C:\VENTA-DE-PASAJES

powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\run-final-data-migration-prod.ps1
```

Expected protected state:

```text
Paquete de migracion listo: True
Ejecucion productiva autorizada: False
Migracion productiva ejecutada: False
Datos productivos aprobados: False
```

When the cutover plan is approved and legacy is frozen, regenerate the package with confirmations:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\run-final-data-migration-prod.ps1 `
  -ConfirmLegacyFreeze `
  -ConfirmBusinessGoNoGo
```

The generated command file is:

```text
C:\VENTA-DE-PASAJES\logs\migration\dia77-final-prod\apply-prod-migration.commands.ps1
```

Evidence:

```text
C:\VENTA-DE-PASAJES\docs\dia-77-migracion-final-datos.md
C:\VENTA-DE-PASAJES\logs\migration\dia77-final-prod\final-data-migration-prod-readiness.json
```

## Dia 78 controlled production test

The controlled production test package generates the real test command file but does not execute it:

```text
C:\VENTA-DE-PASAJES\scripts\prepare-controlled-prod-test.ps1
```

Prepare the package:

```powershell
cd C:\VENTA-DE-PASAJES

powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\prepare-controlled-prod-test.ps1
```

Expected state while Day 77 is not applied and approved:

```text
Paquete de prueba listo: True
Prueba real autorizada: False
Prueba real ejecutada: False
```

The generated command file is:

```text
C:\VENTA-DE-PASAJES\logs\prod-controlled-test\dia78-controlled-prod-test.commands.ps1
```

Evidence:

```text
C:\VENTA-DE-PASAJES\docs\dia-78-prueba-productiva-controlada.md
C:\VENTA-DE-PASAJES\logs\prod-controlled-test\dia78-controlled-prod-test-readiness.json
```

## Dia 79 go-live package

The go-live package prepares operational opening, access checklist and monitoring commands. It does not open production by itself:

```text
C:\VENTA-DE-PASAJES\scripts\prepare-go-live-prod.ps1
```

Prepare the package:

```powershell
cd C:\VENTA-DE-PASAJES

powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\prepare-go-live-prod.ps1
```

Expected protected state while Day 77 and Day 78 are not approved:

```text
Paquete de puesta en marcha listo: True
Puesta en marcha real autorizada: False
Operacion real iniciada: False
```

When migration, controlled test and business opening are approved, regenerate with real Google emails:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\prepare-go-live-prod.ps1 `
  -OperatorEmails "boleteria1@empresa.com","boleteria2@empresa.com" `
  -SupervisorEmails "supervisor@empresa.com" `
  -ConfirmMigrationApplied `
  -ConfirmControlledTestApproved `
  -ConfirmBusinessOpen
```

The generated monitoring command file is:

```text
C:\VENTA-DE-PASAJES\logs\go-live\dia79-go-live-commands.ps1
```

Evidence:

```text
C:\VENTA-DE-PASAJES\docs\dia-79-puesta-en-marcha.md
C:\VENTA-DE-PASAJES\docs\acta-puesta-en-marcha.md
C:\VENTA-DE-PASAJES\docs\registro-incidencias-iniciales.md
C:\VENTA-DE-PASAJES\logs\go-live\dia79-go-live-readiness.json
```

## Dia 80 post-start day 1 support

The Day 80 package prepares the first intensive support report and the evidence collection commands. It does not query real operation until Day 79 is opened:

```text
C:\VENTA-DE-PASAJES\scripts\prepare-post-start-day1-report.ps1
```

Prepare the package:

```powershell
cd C:\VENTA-DE-PASAJES

powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\prepare-post-start-day1-report.ps1
```

Expected protected state while Day 79 is not open:

```text
Paquete soporte listo: True
Revision real autorizada: False
Revision real ejecutada: False
```

When production is open and Day 79 monitoring evidence exists:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\prepare-post-start-day1-report.ps1 `
  -ConfirmGoLiveStarted `
  -ConfirmBusinessOpen

.\logs\post-start-day1\dia80-post-start-day1-commands.ps1
```

Evidence:

```text
C:\VENTA-DE-PASAJES\docs\dia-80-soporte-intensivo-dia-1.md
C:\VENTA-DE-PASAJES\docs\reporte-post-arranque-dia-1.md
C:\VENTA-DE-PASAJES\logs\post-start-day1\dia80-post-start-day1-readiness.json
```

## Dia 81 post-start day 2 support

The Day 81 package prepares the second intensive support report. It reviews ticket-office feedback, minor fixes, permissions, printing and cancellations. It does not change permissions or tickets automatically:

```text
C:\VENTA-DE-PASAJES\scripts\prepare-post-start-day2-report.ps1
```

Prepare the package:

```powershell
cd C:\VENTA-DE-PASAJES

powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\prepare-post-start-day2-report.ps1
```

Expected protected state while Day 80 is not closed:

```text
Paquete soporte dia 2 listo: True
Revision real dia 2 autorizada: False
Revision real dia 2 ejecutada: False
```

When Day 80 is closed and production remains open:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\prepare-post-start-day2-report.ps1 `
  -ConfirmDay1Closed `
  -ConfirmBusinessOpen

.\logs\post-start-day2\dia81-post-start-day2-commands.ps1
```

Optional validation variables:

```powershell
$env:DIA81_DOCUMENT_ID = "<document-id-real>"
$env:DIA81_CANCELLED_TICKET_ID = "<ticket-id-anulado>"
```

Evidence:

```text
C:\VENTA-DE-PASAJES\docs\dia-81-soporte-intensivo-dia-2.md
C:\VENTA-DE-PASAJES\docs\reporte-post-arranque-dia-2.md
C:\VENTA-DE-PASAJES\logs\post-start-day2\dia81-post-start-day2-readiness.json
```

## Dia 82 post-start day 3 support

The Day 82 package prepares the third intensive support report and the decision gate for moving to normal support. It reviews service stability, latency, preliminary costs, security logs and incident closure:

```text
C:\VENTA-DE-PASAJES\scripts\prepare-post-start-day3-report.ps1
```

Prepare the package:

```powershell
cd C:\VENTA-DE-PASAJES

powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\prepare-post-start-day3-report.ps1
```

Expected protected state while Day 81 is not closed:

```text
Paquete soporte dia 3 listo: True
Decision soporte normal autorizada: False
Revision real dia 3 ejecutada: False
```

When Day 81 is closed and business confirms stability:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\prepare-post-start-day3-report.ps1 `
  -ConfirmDay2Closed `
  -ConfirmBusinessStable

.\logs\post-start-day3\dia82-post-start-day3-commands.ps1
```

Evidence:

```text
C:\VENTA-DE-PASAJES\docs\dia-82-soporte-intensivo-dia-3.md
C:\VENTA-DE-PASAJES\docs\reporte-post-arranque-dia-3.md
C:\VENTA-DE-PASAJES\logs\post-start-day3\dia82-post-start-day3-readiness.json
```

## Dia 83 cost optimization

The Day 83 package prepares the production cost review. It checks Cloud Run min instances, CPU/RAM, Cloud SQL storage, log volume, and budget alerts. It does not apply Cloud Run, Cloud SQL, Logging or Billing changes automatically:

```text
C:\VENTA-DE-PASAJES\scripts\prepare-cost-optimization-review.ps1
```

Prepare the package:

```powershell
cd C:\VENTA-DE-PASAJES

powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\prepare-cost-optimization-review.ps1
```

Expected protected state while Day 82 is not closed with real evidence:

```text
Paquete optimizacion costos listo: True
Revision real costos autorizada: False
Guardrails de configuracion OK: True
Costo real mensual validado: False
```

When production is stable and Day 82 is closed:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\prepare-cost-optimization-review.ps1 `
  -ConfirmProductionStable

.\logs\cost-optimization\dia83-cost-optimization-commands.ps1
```

Create budget alerts only after confirming the real Billing account ID:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\logs\cost-optimization\dia83-budget-alert-template.ps1 `
  -BillingAccountId "<billing-account-id-real>" `
  -BudgetAmountUsd 150
```

Evidence:

```text
C:\VENTA-DE-PASAJES\docs\dia-83-optimizacion-costos.md
C:\VENTA-DE-PASAJES\docs\reporte-costo-mensual-estimado.md
C:\VENTA-DE-PASAJES\logs\cost-optimization\dia83-cost-optimization-readiness.json
```

## Dia 84 technical documentation

The Day 84 package generates the final technical manual and diagrams from repository inventory: Cloud Run descriptors, Cloud SQL configuration, Pub/Sub configuration, OpenAPI files, database SQL files, event catalog and GitHub workflows.

```text
C:\VENTA-DE-PASAJES\scripts\prepare-technical-documentation.ps1
```

Generate the package:

```powershell
cd C:\VENTA-DE-PASAJES

powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\prepare-technical-documentation.ps1
```

Expected state:

```text
Documentacion tecnica lista: True
Manual tecnico generado: True
Diagramas finales generados: True
Servicios inventariados: 12
Bases inventariadas: 6
OpenAPI inventariados: 6
Eventos inventariados: 14
Pipelines inventariados: 2
Bloqueos tecnicos: 0
```

Evidence:

```text
C:\VENTA-DE-PASAJES\docs\dia-84-documentacion-tecnica-final.md
C:\VENTA-DE-PASAJES\docs\manual-tecnico.md
C:\VENTA-DE-PASAJES\docs\diagramas-finales.md
C:\VENTA-DE-PASAJES\logs\technical-documentation\dia84-technical-documentation-readiness.json
```

## Dia 85 operational documentation

The Day 85 package generates the final operational documentation for ticket-office users, supervisors, operational administrators and basic support. It uses verified repository sources and does not change cloud resources or runtime data.

```text
C:\VENTA-DE-PASAJES\scripts\prepare-operational-documentation.ps1
```

Generate the package:

```powershell
cd C:\VENTA-DE-PASAJES

powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\prepare-operational-documentation.ps1
```

Expected state:

```text
Documentacion operativa lista: True
Manual operativo generado: True
Guia rapida generada: True
Fuentes verificadas: 9
Bloqueos: 0
```

Evidence:

```text
C:\VENTA-DE-PASAJES\docs\dia-85-documentacion-operativa-final.md
C:\VENTA-DE-PASAJES\docs\manual-operativo-final.md
C:\VENTA-DE-PASAJES\docs\guia-rapida-boleteria.md
C:\VENTA-DE-PASAJES\logs\operational-documentation\dia85-operational-documentation-readiness.json
```

## Dia 86 controlled production restore test

The Day 86 package executes a controlled production restore into temporary resources. It restores the latest successful Cloud SQL production backup into `venta-pasajes-prod-restore-test`, validates restored databases and IAM DB users, validates a temporary document bucket, measures RTO/RPO, and removes temporary resources.

```text
C:\VENTA-DE-PASAJES\scripts\prepare-production-restore-test.ps1
```

Read-only readiness check:

```powershell
cd C:\VENTA-DE-PASAJES

powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-backup-restore-readiness.ps1 `
  -Environment prod `
  -CloudSqlInstanceName venta-pasajes-prod-sql `
  -DocumentBucketName venta-pasajes-prod-documents `
  -RestoreInstanceName venta-pasajes-prod-restore-test
```

Generate and refresh evidence:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\prepare-production-restore-test.ps1
```

Measured result:

```text
Paquete restauracion produccion listo: True
Restauracion controlada ejecutada: True
Criterio completo: True
RPO horas: 8.43
RTO productivo medido: 17.43 minutos
Validacion bases: True
Validacion documental: True
```

Evidence:

```text
C:\VENTA-DE-PASAJES\docs\dia-86-prueba-restauracion-produccion-controlada.md
C:\VENTA-DE-PASAJES\docs\evidencia-restauracion-produccion-controlada.md
C:\VENTA-DE-PASAJES\docs\procedimiento-restauracion-produccion.md
C:\VENTA-DE-PASAJES\logs\production-restore-test\dia86-production-restore-readiness.json
C:\VENTA-DE-PASAJES\logs\production-restore-test\dia86-production-restore-execution-evidence.json
```

## Dia 87 final security review

The Day 87 package consolidates the final security evidence for production: functional roles, IAM, Secret Manager, API exposure, audit and backups/restore. It does not modify Google Cloud resources.

```text
C:\VENTA-DE-PASAJES\scripts\prepare-final-security-review.ps1
```

Generate and refresh the final report:

```powershell
cd C:\VENTA-DE-PASAJES

powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\prepare-final-security-review.ps1
```

Measured result:

```text
Revision seguridad final lista: True
Riesgos criticos mitigados: True
Riesgos criticos abiertos: 0
Areas listas: 6/6
```

Evidence:

```text
C:\VENTA-DE-PASAJES\docs\dia-87-revision-seguridad-final.md
C:\VENTA-DE-PASAJES\docs\informe-seguridad-final.md
C:\VENTA-DE-PASAJES\logs\final-security\dia87-final-security-readiness.json
C:\VENTA-DE-PASAJES\logs\final-security\dia87-final-security-findings.json
```

## Dia 88 modular growth preparation

The Day 88 package prepares reusable paths for adding future modules. It validates the existing Quarkus service generator, adds a Next.js MFE generator, and creates reusable template entrypoints under `templates`.

```text
C:\VENTA-DE-PASAJES\scripts\prepare-modular-growth.ps1
```

Generate and refresh the modular growth guide:

```powershell
cd C:\VENTA-DE-PASAJES

powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\prepare-modular-growth.ps1
```

Measured result:

```text
Crecimiento modular listo: True
Plantillas reutilizables listas: True
DryRun Quarkus OK: True
DryRun MFE OK: True
Secciones guia faltantes: 0
```

Evidence:

```text
C:\VENTA-DE-PASAJES\docs\dia-88-preparacion-crecimiento-modular.md
C:\VENTA-DE-PASAJES\docs\guia-crecimiento-modular.md
C:\VENTA-DE-PASAJES\templates\README.md
C:\VENTA-DE-PASAJES\templates\quarkus-service\template.json
C:\VENTA-DE-PASAJES\templates\next-mfe\template.json
C:\VENTA-DE-PASAJES\logs\modular-growth\dia88-modular-growth-readiness.json
C:\VENTA-DE-PASAJES\logs\modular-growth\dia88-modular-growth-inventory.json
```

## Dia 89 future modules backlog

The Day 89 package defines the recommended order for future modules and initial effort estimates. It does not create modules or cloud resources.

```text
C:\VENTA-DE-PASAJES\scripts\prepare-future-modules-backlog.ps1
```

Generate and refresh the future backlog:

```powershell
cd C:\VENTA-DE-PASAJES

powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\prepare-future-modules-backlog.ps1
```

Measured result:

```text
Backlog futuro listo: True
Modulos priorizados: 5
Prioridad 1: Facturacion electronica
Secciones backlog faltantes: 0
Secciones estimaciones faltantes: 0
```

Evidence:

```text
C:\VENTA-DE-PASAJES\docs\dia-89-backlog-siguientes-modulos.md
C:\VENTA-DE-PASAJES\docs\backlog-futuro-priorizado.md
C:\VENTA-DE-PASAJES\docs\estimaciones-modulos-futuros.md
C:\VENTA-DE-PASAJES\logs\future-modules-backlog\dia89-future-modules-backlog-readiness.json
C:\VENTA-DE-PASAJES\logs\future-modules-backlog\dia89-future-modules-backlog-inventory.json
```

## Dia 90 project closure

The Day 90 package consolidates project closure evidence. It confirms that the technical platform is running in Google Cloud, while keeping the functional 100% closure blocked until final migration, controlled production test, go-live and real post-start support are executed and approved.

```text
C:\VENTA-DE-PASAJES\scripts\prepare-project-closure.ps1
```

Generate and refresh the closure package:

```powershell
cd C:\VENTA-DE-PASAJES

powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\prepare-project-closure.ps1
```

Measured result:

```text
Cierre tecnico/documental listo: True
Plataforma funcionando en Google Cloud: True
Operacion funcional 100%: False
Estado de cierre: Cierre tecnico/documental condicionado
Pendientes bloqueantes: 21
```

Evidence:

```text
C:\VENTA-DE-PASAJES\docs\dia-90-cierre-proyecto.md
C:\VENTA-DE-PASAJES\docs\acta-cierre-proyecto.md
C:\VENTA-DE-PASAJES\docs\plataforma-funcionando-google-cloud.md
C:\VENTA-DE-PASAJES\docs\backlog-evolucion.md
C:\VENTA-DE-PASAJES\logs\project-closure\dia90-project-closure-readiness.json
C:\VENTA-DE-PASAJES\logs\project-closure\dia90-project-closure-inventory.json
```
