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
