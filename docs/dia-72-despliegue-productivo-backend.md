# Dia 72 - Despliegue productivo de backend

Fecha: 2026-09-24

## Objetivo

Desplegar los seis backends productivos en Cloud Run usando servicios separados con sufijo `-prod`, imagen JVM validada, Cloud SQL productivo, service accounts productivas y acceso privado.

Servicios desplegados:

```text
identity-service-prod
dispatch-service-prod
ticketing-service-prod
document-service-prod
reporting-service-prod
audit-service-prod
```

## Reversa primero

Esta reversa elimina solo los servicios Cloud Run productivos creados en este dia. No elimina Cloud SQL, buckets, secretos ni Pub/Sub productivos.

### Paso R1 - Ubicarse en el workspace

```powershell
cd C:\VENTA-DE-PASAJES
$env:CLOUDSDK_PYTHON = "C:\Python312\python.exe"
$ProjectId = "project-fbb34cd7-0b82-43e1-867"
$Region = "us-central1"
$Gcloud = "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd"
```

### Paso R2 - Revisar servicios productivos existentes

```powershell
& $Gcloud run services list `
  --project $ProjectId `
  --region $Region `
  --filter 'metadata.name~"-prod$"' `
  --format "table(metadata.name,status.conditions[0].type,status.conditions[0].status,status.url)"
```

### Paso R3 - Eliminar servicios Cloud Run productivos de backend

```powershell
$Services = @(
  "identity-service-prod",
  "dispatch-service-prod",
  "ticketing-service-prod",
  "document-service-prod",
  "reporting-service-prod",
  "audit-service-prod"
)

foreach ($Service in $Services) {
  & $Gcloud run services delete $Service `
    --project $ProjectId `
    --region $Region `
    --quiet
}
```

### Paso R4 - Opcional: eliminar tag productivo de Artifact Registry

Ejecutar este paso solo si se quiere retirar el alias `prod-backend-0.1.1-jvm`. No borra el digest base ni el tag `0.1.1-jvm`.

```powershell
$Images = @(
  "identity-service",
  "dispatch-service",
  "ticketing-service",
  "document-service",
  "reporting-service",
  "audit-service"
)

foreach ($Image in $Images) {
  & $Gcloud artifacts docker tags delete `
    "us-central1-docker.pkg.dev/$ProjectId/venta-pasajes-dev/${Image}:prod-backend-0.1.1-jvm" `
    --project $ProjectId `
    --quiet
}
```

### Paso R5 - Validar reversa

```powershell
& $Gcloud run services list `
  --project $ProjectId `
  --region $Region `
  --filter 'metadata.name~"-prod$"' `
  --format "table(metadata.name,status.url)"
```

## Cambios realizados

Archivos creados o actualizados:

```text
C:\VENTA-DE-PASAJES\infra\cloudrun\prod-backend-services.json
C:\VENTA-DE-PASAJES\infra\gcloud\sync-json-secrets-from-config.ps1
C:\VENTA-DE-PASAJES\scripts\verify-cloudrun-prod-backends.ps1
C:\VENTA-DE-PASAJES\scripts\deploy-cloudrun-dev.ps1
C:\VENTA-DE-PASAJES\infra\gcloud\cloudsql-prod.json
C:\VENTA-DE-PASAJES\docs\dia-72-despliegue-productivo-backend.md
```

Recursos reales modificados:

```text
Artifact Registry: tags prod-backend-0.1.1-jvm para seis imagenes backend.
Secret Manager: nuevas versiones JSON para seis secretos prod__db-connection.
Cloud SQL: grants de esquema para seis usuarios IAM productivos.
Cloud Run: seis servicios backend productivos privados.
```

## Decisiones tecnicas

- Se usaron servicios con sufijo `-prod` para no sobrescribir los servicios dev existentes.
- Se uso la imagen JVM `0.1.1-jvm` promovida a `prod-backend-0.1.1-jvm`.
- No existe todavia un repositorio Artifact Registry productivo separado; por eso el tag productivo vive en `venta-pasajes-dev`, con alias controlado.
- Se paso `APP_DB_JDBC_URL` explicitamente en Cloud Run para evitar que el default compilado apunte a Cloud SQL dev.
- `deploy-cloudrun-dev.ps1` ahora genera `--env-vars-file` para evitar que Windows rompa valores con `&` en URLs JDBC.
- Algunos scripts conservan el sufijo `dev` por historia del proyecto, pero son parametrizados. En este dia apuntan a produccion porque usan `prod-backend-services.json` y `cloudsql-prod.json`.
- Los health checks se ejecutaron contra servicios privados usando identity token.

## Guia manual desde cero

### Paso 1 - Preparar terminal

```powershell
cd C:\VENTA-DE-PASAJES
$env:CLOUDSDK_PYTHON = "C:\Python312\python.exe"
$ProjectId = "project-fbb34cd7-0b82-43e1-867"
$Region = "us-central1"
$ImageTag = "prod-backend-0.1.1-jvm"
$Gcloud = "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd"
```

### Paso 2 - Validar archivos base

```powershell
Test-Path -LiteralPath .\infra\cloudrun\prod-backend-services.json
Test-Path -LiteralPath .\infra\gcloud\secrets-prod.json
Test-Path -LiteralPath .\infra\gcloud\cloudsql-prod.json
Test-Path -LiteralPath .\scripts\deploy-cloudrun-dev.ps1
Test-Path -LiteralPath .\scripts\verify-cloudrun-prod-backends.ps1

Get-Content -LiteralPath .\infra\cloudrun\prod-backend-services.json -Raw | ConvertFrom-Json | Out-Null
```

### Paso 3 - Confirmar que Cloud SQL y bucket productivos existen

```powershell
& $Gcloud sql instances describe venta-pasajes-prod-sql `
  --project $ProjectId `
  --format "value(name,state,connectionName)"

& $Gcloud storage buckets describe gs://venta-pasajes-prod-documents `
  --project $ProjectId `
  --format "value(name,location)"
```

### Paso 4 - Sincronizar secretos JSON productivos

Primero plan:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\infra\gcloud\sync-json-secrets-from-config.ps1 `
  -ConfigPath .\infra\gcloud\secrets-prod.json
```

Aplicar solo si el plan muestra diferencias:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\infra\gcloud\sync-json-secrets-from-config.ps1 `
  -ConfigPath .\infra\gcloud\secrets-prod.json `
  -Execute
```

### Paso 5 - Aplicar grants de esquema en Cloud SQL prod

Plan:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\infra\gcloud\grant-cloudsql-schema-dev.ps1 `
  -ConfigPath .\infra\gcloud\cloudsql-prod.json `
  -ProjectId $ProjectId `
  -ConnectionMode import
```

Ejecucion:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\infra\gcloud\grant-cloudsql-schema-dev.ps1 `
  -ConfigPath .\infra\gcloud\cloudsql-prod.json `
  -ProjectId $ProjectId `
  -ConnectionMode import `
  -Execute
```

### Paso 6 - Promover imagenes JVM a tag productivo backend

Plan:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\promote-artifact-image-tags.ps1 `
  -ServiceIds identity-service,dispatch-service,ticketing-service,document-service,reporting-service,audit-service `
  -SourceTag 0.1.1-jvm `
  -TargetTag $ImageTag
```

Ejecucion:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\promote-artifact-image-tags.ps1 `
  -ServiceIds identity-service,dispatch-service,ticketing-service,document-service,reporting-service,audit-service `
  -SourceTag 0.1.1-jvm `
  -TargetTag $ImageTag `
  -Execute
```

### Paso 7 - Validar imagenes antes de desplegar

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\deploy-cloudrun-dev.ps1 `
  -ConfigPath .\infra\cloudrun\prod-backend-services.json `
  -ImageTag $ImageTag `
  -BackendOnly `
  -CheckImagesOnly `
  -OutputPath logs\cloudrun-prod\deploy-cloudrun-prod.commands.ps1
```

### Paso 8 - Generar plan de despliegue

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\deploy-cloudrun-dev.ps1 `
  -ConfigPath .\infra\cloudrun\prod-backend-services.json `
  -ImageTag $ImageTag `
  -BackendOnly `
  -OutputPath logs\cloudrun-prod\deploy-cloudrun-prod.commands.ps1

Get-Content -LiteralPath .\logs\cloudrun-prod\deploy-cloudrun-prod.commands.plan.json -Raw
```

Validar que `unresolved` este vacio para todos los servicios.

### Paso 9 - Ejecutar despliegue real

Este paso modifica Cloud Run.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\deploy-cloudrun-dev.ps1 `
  -ConfigPath .\infra\cloudrun\prod-backend-services.json `
  -ImageTag $ImageTag `
  -BackendOnly `
  -Execute `
  -OutputPath logs\cloudrun-prod\deploy-cloudrun-prod.commands.ps1
```

### Paso 10 - Ejecutar smoke tests productivos

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-cloudrun-prod-backends.ps1 `
  -FailOnNotReady
```

Resultado esperado:

```text
identity-service-prod: ready=True, health_passed=True
dispatch-service-prod: ready=True, health_passed=True
ticketing-service-prod: ready=True, health_passed=True
document-service-prod: ready=True, health_passed=True
reporting-service-prod: ready=True, health_passed=True
audit-service-prod: ready=True, health_passed=True
Backend productivo listo: True
```

### Paso 11 - Consultar servicios productivos

```powershell
& $Gcloud run services list `
  --project $ProjectId `
  --region $Region `
  --filter 'metadata.name~"-prod$"' `
  --format "table(metadata.name,status.conditions[0].type,status.conditions[0].status,status.url)"
```

## Evidencia de ejecucion

Archivos:

```text
C:\VENTA-DE-PASAJES\logs\artifact-registry\promote-artifact-image-tags.plan.json
C:\VENTA-DE-PASAJES\logs\secrets-sync\sync-json-secrets-from-config.json
C:\VENTA-DE-PASAJES\logs\cloudsql-dev\grant-cloudsql-schema-dev.plan.json
C:\VENTA-DE-PASAJES\logs\cloudrun-prod\deploy-cloudrun-prod.commands.plan.json
C:\VENTA-DE-PASAJES\logs\cloudrun-prod\verify-cloudrun-prod-backends.json
```

Resumen final observado:

```text
Servicios totales: 6
Servicios Ready: 6
Servicios con APP_ENV=prod: 6
Servicios con Cloud SQL prod: 6
Servicios con service account productiva: 6
Servicios privados: 6
Smoke tests pasados: 6
Backend productivo listo: True
```

URLs Cloud Run productivas:

```text
https://identity-service-prod-io7kxgn6yq-uc.a.run.app
https://dispatch-service-prod-io7kxgn6yq-uc.a.run.app
https://ticketing-service-prod-io7kxgn6yq-uc.a.run.app
https://document-service-prod-io7kxgn6yq-uc.a.run.app
https://reporting-service-prod-io7kxgn6yq-uc.a.run.app
https://audit-service-prod-io7kxgn6yq-uc.a.run.app
```

## Problemas encontrados y solucionados

### Secreto JSON productivo con usuario antiguo

Los secretos `*-prod__db-connection` existian, pero las versiones publicadas tenian `database_user` legacy. Se creo `sync-json-secrets-from-config.ps1` para detectar y publicar nuevas versiones solo de secretos JSON.

### `APP_DB_JDBC_URL` con `&` en Windows

El valor JDBC contiene `&socketFactory=...&enableIamAuth=...`. Pasarlo con `--set-env-vars` provocaba que Windows intentara ejecutar fragmentos como comandos. Se corrigio `deploy-cloudrun-dev.ps1` para generar archivos `*.env.yaml` y usar `--env-vars-file`.

### Flyway sin permisos en schema `public`

Cloud Run conectaba a Cloud SQL prod, pero Flyway no podia crear `flyway_schema_history`. Se aplicaron grants minimos por base y usuario IAM productivo.

### Verificador interpretaba mal `Ready=True`

PowerShell desenvolvia el objeto de condiciones de Cloud Run y `.Count` quedaba vacio. Se corrigio `verify-cloudrun-prod-backends.ps1` para normalizar `status.conditions` como arreglo explicito.

## Estado final

```text
Backend productivo desplegado.
APIs productivas responden correctamente mediante health checks autenticados.
Los servicios permanecen privados y separados de dev.
La entrada publica final queda pendiente del frontend productivo, dominio y TLS.
```
