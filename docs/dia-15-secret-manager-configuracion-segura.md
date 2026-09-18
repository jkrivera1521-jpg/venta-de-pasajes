# Dia 15 - Secret Manager y configuracion segura

Fecha: 2026-09-02

## Objetivo

Crear secretos de desarrollo en Google Secret Manager, asignar acceso por service account y retirar secretos reales de archivos locales.

## Resultado ejecutivo

Dia 15 completado y verificado en Google Cloud dev.

Se crearon 15 secretos en Secret Manager con versiones iniciales. Cada secreto quedo con `roles/secretmanager.secretAccessor` asignado solo a la service account propietaria. Tambien se creo la service account `frontend-shell-run` para que el secreto de sesion del frontend tenga identidad runtime propia.

Verificacion final de Secret Manager:

```json
{"project_id":"project-fbb34cd7-0b82-43e1-867","config_path":"C:\\VENTA-DE-PASAJES\\infra\\gcloud\\secrets-dev.json","secrets_expected":15,"secrets_found":15,"missing_secrets":[],"secrets_without_enabled_version":[],"missing_accessor_bindings":[],"local_secret_findings":{},"ready":true}
```

Verificacion IAM posterior:

```json
{"project_id":"project-fbb34cd7-0b82-43e1-867","project_number":"230270000840","matrix_path":"C:\\VENTA-DE-PASAJES\\infra\\gcloud\\iam-dev.json","service_accounts_expected":8,"service_accounts_found":8,"missing_accounts":[],"missing_project_bindings":[],"missing_service_account_bindings":[],"admin_groups_status":"defined_pending_google_workspace_or_cloud_identity","mfa_status":"manual_control_pending_or_external_to_project_iam","ready":true}
```

## Secretos creados

Secretos de conexion a base:

| Secreto | Service account con acceso |
| --- | --- |
| `identity-service__db-connection` | `identity-service-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com` |
| `dispatch-service__db-connection` | `dispatch-service-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com` |
| `ticketing-service__db-connection` | `ticketing-service-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com` |
| `document-service__db-connection` | `document-service-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com` |
| `reporting-service__db-connection` | `reporting-service-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com` |
| `audit-service__db-connection` | `audit-service-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com` |

Estos secretos contienen configuracion JSON para Cloud SQL con IAM DB authentication. No contienen password de base.

Secretos de sesion y seguridad:

| Secreto | Service account con acceso |
| --- | --- |
| `identity-service__jwt-signing-secret` | `identity-service-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com` |
| `identity-service__refresh-token-pepper` | `identity-service-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com` |
| `identity-service__password-pepper` | `identity-service-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com` |
| `identity-service__recovery-token-pepper` | `identity-service-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com` |
| `frontend-shell__session-secret` | `frontend-shell-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com` |

Secretos de integracion:

| Secreto | Estado | Service account con acceso |
| --- | --- | --- |
| `identity-service__google-oauth-client-secret` | Placeholder generado | `identity-service-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com` |
| `identity-service__email-provider-api-key` | Placeholder generado | `identity-service-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com` |
| `ticketing-service__payment-provider-api-key` | Placeholder generado | `ticketing-service-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com` |
| `document-service__document-signing-secret` | Generado | `document-service-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com` |

Los placeholders de integracion deben reemplazarse con una nueva version del secreto cuando se elija el proveedor real. No se deben escribir en archivos locales.

## Complemento IAM

Se agrego la service account:

```text
frontend-shell-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com
```

Roles de proyecto:

```text
roles/logging.logWriter
roles/monitoring.metricWriter
```

Cloud Build deployer recibio `roles/iam.serviceAccountUser` sobre `frontend-shell-run` para futuros despliegues Cloud Run.

## Archivos creados o actualizados

| Archivo | Proposito |
| --- | --- |
| `C:\VENTA-DE-PASAJES\infra\gcloud\secrets-dev.json` | Catalogo declarativo de secretos dev. |
| `C:\VENTA-DE-PASAJES\infra\gcloud\bootstrap-secrets-dev.ps1` | Crea secretos, agrega version inicial y aplica IAM por secreto. |
| `C:\VENTA-DE-PASAJES\infra\gcloud\verify-secrets-dev.ps1` | Verifica secretos, versiones, IAM y hallazgos locales sensibles. |
| `C:\VENTA-DE-PASAJES\infra\gcloud\iam-dev.json` | Agrega `frontend-shell-run` a la matriz IAM. |
| `C:\VENTA-DE-PASAJES\infra\env\backend-service.env.example` | Retira password placeholder y agrega referencias a Secret Manager. |
| `C:\VENTA-DE-PASAJES\infra\env\frontend-app.env.example` | Retira `AUTH_SESSION_SECRET=change-me` y agrega referencia a Secret Manager. |
| `C:\VENTA-DE-PASAJES\NOTAS.txt` | Redacta token gcloud y password local previamente anotados. |

## Limpieza de secretos locales

Se encontro informacion sensible en `C:\VENTA-DE-PASAJES\NOTAS.txt`:

- Token temporal de `gcloud`.
- Password anotada para el usuario `postgres`.

Accion tomada:

- Se reemplazo el archivo completo por una version saneada.
- Se mantuvieron los comandos utiles.
- No se conserva el token ni la password.

Validacion:

```powershell
rg -n -i "ya29\.|PONER PASSWORD.*\(" NOTAS.txt
rg -n -i "AUTH_SESSION_SECRET=change-me|QUARKUS_DATASOURCE_PASSWORD=change-me" infra\env
```

Resultado: sin coincidencias.

## Comandos ejecutados

Validaciones locales:

```powershell
Get-Content -LiteralPath .\infra\gcloud\secrets-dev.json -Raw | ConvertFrom-Json

$Errors = $null
[System.Management.Automation.Language.Parser]::ParseFile((Resolve-Path .\infra\gcloud\bootstrap-secrets-dev.ps1), [ref]$null, [ref]$Errors)
[System.Management.Automation.Language.Parser]::ParseFile((Resolve-Path .\infra\gcloud\verify-secrets-dev.ps1), [ref]$null, [ref]$Errors)
```

Bootstrap IAM para agregar `frontend-shell-run`:

```powershell
$env:CLOUDSDK_PYTHON = "C:\Python312\python.exe"

powershell -NoProfile -ExecutionPolicy Bypass -File .\infra\gcloud\bootstrap-iam-dev.ps1 `
  -ProjectId "project-fbb34cd7-0b82-43e1-867" `
  -GcloudPath "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd"

powershell -NoProfile -ExecutionPolicy Bypass -File .\infra\gcloud\verify-iam-dev.ps1 `
  -ProjectId "project-fbb34cd7-0b82-43e1-867" `
  -GcloudPath "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd"
```

Comandos `gcloud` nuevos ejecutados para `frontend-shell-run`:

```powershell
gcloud iam service-accounts create frontend-shell-run --project=project-fbb34cd7-0b82-43e1-867 --display-name=frontend-shell runtime --description=Runtime identity for frontend-shell in Cloud Run dev.
gcloud projects add-iam-policy-binding project-fbb34cd7-0b82-43e1-867 --member=serviceAccount:frontend-shell-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com --role=roles/logging.logWriter --condition=None --quiet
gcloud projects add-iam-policy-binding project-fbb34cd7-0b82-43e1-867 --member=serviceAccount:frontend-shell-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com --role=roles/monitoring.metricWriter --condition=None --quiet
gcloud iam service-accounts add-iam-policy-binding frontend-shell-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com --project=project-fbb34cd7-0b82-43e1-867 --member=serviceAccount:cloudbuild-deployer@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com --role=roles/iam.serviceAccountUser --quiet
```

Bootstrap y verificacion de Secret Manager:

```powershell
$env:CLOUDSDK_PYTHON = "C:\Python312\python.exe"

powershell -NoProfile -ExecutionPolicy Bypass -File .\infra\gcloud\bootstrap-secrets-dev.ps1 `
  -DryRun `
  -ProjectId "project-fbb34cd7-0b82-43e1-867" `
  -GcloudPath "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd"

powershell -NoProfile -ExecutionPolicy Bypass -File .\infra\gcloud\bootstrap-secrets-dev.ps1 `
  -ProjectId "project-fbb34cd7-0b82-43e1-867" `
  -GcloudPath "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd"

powershell -NoProfile -ExecutionPolicy Bypass -File .\infra\gcloud\verify-secrets-dev.ps1 `
  -ProjectId "project-fbb34cd7-0b82-43e1-867" `
  -GcloudPath "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd"
```

Comandos `gcloud` ejecutados por `bootstrap-secrets-dev.ps1`:

```powershell
gcloud secrets create identity-service__db-connection --project=project-fbb34cd7-0b82-43e1-867 --replication-policy=automatic --labels=app=venta-pasajes,env=dev,category=database,owner=identity-service
gcloud secrets versions add identity-service__db-connection --project=project-fbb34cd7-0b82-43e1-867 --data-file=<redacted-payload-file>
gcloud secrets add-iam-policy-binding identity-service__db-connection --project=project-fbb34cd7-0b82-43e1-867 --member=serviceAccount:identity-service-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com --role=roles/secretmanager.secretAccessor --quiet

gcloud secrets create dispatch-service__db-connection --project=project-fbb34cd7-0b82-43e1-867 --replication-policy=automatic --labels=app=venta-pasajes,env=dev,category=database,owner=dispatch-service
gcloud secrets versions add dispatch-service__db-connection --project=project-fbb34cd7-0b82-43e1-867 --data-file=<redacted-payload-file>
gcloud secrets add-iam-policy-binding dispatch-service__db-connection --project=project-fbb34cd7-0b82-43e1-867 --member=serviceAccount:dispatch-service-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com --role=roles/secretmanager.secretAccessor --quiet

gcloud secrets create ticketing-service__db-connection --project=project-fbb34cd7-0b82-43e1-867 --replication-policy=automatic --labels=app=venta-pasajes,env=dev,category=database,owner=ticketing-service
gcloud secrets versions add ticketing-service__db-connection --project=project-fbb34cd7-0b82-43e1-867 --data-file=<redacted-payload-file>
gcloud secrets add-iam-policy-binding ticketing-service__db-connection --project=project-fbb34cd7-0b82-43e1-867 --member=serviceAccount:ticketing-service-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com --role=roles/secretmanager.secretAccessor --quiet

gcloud secrets create document-service__db-connection --project=project-fbb34cd7-0b82-43e1-867 --replication-policy=automatic --labels=app=venta-pasajes,env=dev,category=database,owner=document-service
gcloud secrets versions add document-service__db-connection --project=project-fbb34cd7-0b82-43e1-867 --data-file=<redacted-payload-file>
gcloud secrets add-iam-policy-binding document-service__db-connection --project=project-fbb34cd7-0b82-43e1-867 --member=serviceAccount:document-service-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com --role=roles/secretmanager.secretAccessor --quiet

gcloud secrets create reporting-service__db-connection --project=project-fbb34cd7-0b82-43e1-867 --replication-policy=automatic --labels=app=venta-pasajes,env=dev,category=database,owner=reporting-service
gcloud secrets versions add reporting-service__db-connection --project=project-fbb34cd7-0b82-43e1-867 --data-file=<redacted-payload-file>
gcloud secrets add-iam-policy-binding reporting-service__db-connection --project=project-fbb34cd7-0b82-43e1-867 --member=serviceAccount:reporting-service-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com --role=roles/secretmanager.secretAccessor --quiet

gcloud secrets create audit-service__db-connection --project=project-fbb34cd7-0b82-43e1-867 --replication-policy=automatic --labels=app=venta-pasajes,env=dev,category=database,owner=audit-service
gcloud secrets versions add audit-service__db-connection --project=project-fbb34cd7-0b82-43e1-867 --data-file=<redacted-payload-file>
gcloud secrets add-iam-policy-binding audit-service__db-connection --project=project-fbb34cd7-0b82-43e1-867 --member=serviceAccount:audit-service-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com --role=roles/secretmanager.secretAccessor --quiet

gcloud secrets create identity-service__jwt-signing-secret --project=project-fbb34cd7-0b82-43e1-867 --replication-policy=automatic --labels=app=venta-pasajes,env=dev,category=session,owner=identity-service
gcloud secrets versions add identity-service__jwt-signing-secret --project=project-fbb34cd7-0b82-43e1-867 --data-file=<redacted-payload-file>
gcloud secrets add-iam-policy-binding identity-service__jwt-signing-secret --project=project-fbb34cd7-0b82-43e1-867 --member=serviceAccount:identity-service-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com --role=roles/secretmanager.secretAccessor --quiet

gcloud secrets create identity-service__refresh-token-pepper --project=project-fbb34cd7-0b82-43e1-867 --replication-policy=automatic --labels=app=venta-pasajes,env=dev,category=session,owner=identity-service
gcloud secrets versions add identity-service__refresh-token-pepper --project=project-fbb34cd7-0b82-43e1-867 --data-file=<redacted-payload-file>
gcloud secrets add-iam-policy-binding identity-service__refresh-token-pepper --project=project-fbb34cd7-0b82-43e1-867 --member=serviceAccount:identity-service-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com --role=roles/secretmanager.secretAccessor --quiet

gcloud secrets create identity-service__password-pepper --project=project-fbb34cd7-0b82-43e1-867 --replication-policy=automatic --labels=app=venta-pasajes,env=dev,category=session,owner=identity-service
gcloud secrets versions add identity-service__password-pepper --project=project-fbb34cd7-0b82-43e1-867 --data-file=<redacted-payload-file>
gcloud secrets add-iam-policy-binding identity-service__password-pepper --project=project-fbb34cd7-0b82-43e1-867 --member=serviceAccount:identity-service-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com --role=roles/secretmanager.secretAccessor --quiet

gcloud secrets create identity-service__recovery-token-pepper --project=project-fbb34cd7-0b82-43e1-867 --replication-policy=automatic --labels=app=venta-pasajes,env=dev,category=session,owner=identity-service
gcloud secrets versions add identity-service__recovery-token-pepper --project=project-fbb34cd7-0b82-43e1-867 --data-file=<redacted-payload-file>
gcloud secrets add-iam-policy-binding identity-service__recovery-token-pepper --project=project-fbb34cd7-0b82-43e1-867 --member=serviceAccount:identity-service-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com --role=roles/secretmanager.secretAccessor --quiet

gcloud secrets create frontend-shell__session-secret --project=project-fbb34cd7-0b82-43e1-867 --replication-policy=automatic --labels=app=venta-pasajes,env=dev,category=session,owner=frontend-shell
gcloud secrets versions add frontend-shell__session-secret --project=project-fbb34cd7-0b82-43e1-867 --data-file=<redacted-payload-file>
gcloud secrets add-iam-policy-binding frontend-shell__session-secret --project=project-fbb34cd7-0b82-43e1-867 --member=serviceAccount:frontend-shell-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com --role=roles/secretmanager.secretAccessor --quiet

gcloud secrets create identity-service__google-oauth-client-secret --project=project-fbb34cd7-0b82-43e1-867 --replication-policy=automatic --labels=app=venta-pasajes,env=dev,category=integration,owner=identity-service
gcloud secrets versions add identity-service__google-oauth-client-secret --project=project-fbb34cd7-0b82-43e1-867 --data-file=<redacted-payload-file>
gcloud secrets add-iam-policy-binding identity-service__google-oauth-client-secret --project=project-fbb34cd7-0b82-43e1-867 --member=serviceAccount:identity-service-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com --role=roles/secretmanager.secretAccessor --quiet

gcloud secrets create identity-service__email-provider-api-key --project=project-fbb34cd7-0b82-43e1-867 --replication-policy=automatic --labels=app=venta-pasajes,env=dev,category=integration,owner=identity-service
gcloud secrets versions add identity-service__email-provider-api-key --project=project-fbb34cd7-0b82-43e1-867 --data-file=<redacted-payload-file>
gcloud secrets add-iam-policy-binding identity-service__email-provider-api-key --project=project-fbb34cd7-0b82-43e1-867 --member=serviceAccount:identity-service-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com --role=roles/secretmanager.secretAccessor --quiet

gcloud secrets create ticketing-service__payment-provider-api-key --project=project-fbb34cd7-0b82-43e1-867 --replication-policy=automatic --labels=app=venta-pasajes,env=dev,category=integration,owner=ticketing-service
gcloud secrets versions add ticketing-service__payment-provider-api-key --project=project-fbb34cd7-0b82-43e1-867 --data-file=<redacted-payload-file>
gcloud secrets add-iam-policy-binding ticketing-service__payment-provider-api-key --project=project-fbb34cd7-0b82-43e1-867 --member=serviceAccount:ticketing-service-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com --role=roles/secretmanager.secretAccessor --quiet

gcloud secrets create document-service__document-signing-secret --project=project-fbb34cd7-0b82-43e1-867 --replication-policy=automatic --labels=app=venta-pasajes,env=dev,category=integration,owner=document-service
gcloud secrets versions add document-service__document-signing-secret --project=project-fbb34cd7-0b82-43e1-867 --data-file=<redacted-payload-file>
gcloud secrets add-iam-policy-binding document-service__document-signing-secret --project=project-fbb34cd7-0b82-43e1-867 --member=serviceAccount:document-service-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com --role=roles/secretmanager.secretAccessor --quiet
```

## Validacion

- JSON de secretos: OK.
- Sintaxis PowerShell: OK.
- Service accounts esperadas: 8.
- Service accounts encontradas: 8.
- Secretos esperados: 15.
- Secretos encontrados: 15.
- Secretos sin version habilitada: 0.
- Bindings `secretAccessor` faltantes: 0.
- Hallazgos locales sensibles en `NOTAS.txt`: 0.
- Estado final: `ready=true`.

## Revision en consola

Secret Manager:

```text
https://console.cloud.google.com/security/secret-manager?project=project-fbb34cd7-0b82-43e1-867
```

Service accounts:

```text
https://console.cloud.google.com/iam-admin/serviceaccounts?project=project-fbb34cd7-0b82-43e1-867
```

## Pendientes para dias posteriores

- Dia 16: crear plantilla estandar de microservicio Quarkus usando referencias a secretos.
- Dia 17: conectar `identity-service` a `identity_db` usando IAM DB authentication.
- Dia 18: reemplazar/rotar placeholders de Google OAuth o email si se adopta un flujo que los requiera.
- Dia 52: otorgar a Cloud Build acceso puntual solo a secretos necesarios para pipelines.
- Produccion: usar secretos nuevos por entorno; no reutilizar valores de dev.
- On-premise/offline: usar proveedor de secretos alternativo fuera de Google Cloud, documentado en `C:\VENTA-DE-PASAJES\docs\onpremise-offline-runbook.md`.

## Referencias oficiales

- Secret Manager: https://docs.cloud.google.com/secret-manager/docs
- Crear secretos: https://docs.cloud.google.com/secret-manager/docs/creating-and-accessing-secrets
- Control de acceso a secretos: https://docs.cloud.google.com/secret-manager/docs/access-control

## Reversa primero

> Estandarizacion documental agregada el 2026-09-16 para que este dia tambien tenga una ruta segura de limpieza antes de repetir la practica.

Este dia pertenece a la etapa inicial del proyecto. Antes de ejecutar una reversa, revisar si el archivo contiene recursos externos reales, como Google Cloud, Docker, bases de datos o imagenes publicadas. No ejecutar comandos destructivos si no estas seguro de que el recurso no esta siendo usado.

### Paso R1 - Ubicarse en el workspace

```powershell
cd C:\VENTA-DE-PASAJES
```

### Paso R2 - Revisar recursos o archivos mencionados

```powershell
Select-String -Path .\docs\dia-15-secret-manager-configuracion-segura.md -Pattern "C:\\VENTA-DE-PASAJES|docker|gcloud|mvn|npm|Remove-Item|delete|rm|Cloud SQL|Artifact Registry|Secret Manager" -Context 0,2
```

### Paso R3 - Detener procesos locales si este dia levanto herramientas

```powershell
Get-NetTCPConnection -LocalPort 3000,3001,3002,3003,8081,8082,8083,18083,18089,18096 -ErrorAction SilentlyContinue |
  Select-Object LocalAddress,LocalPort,State,OwningProcess |
  Format-Table -AutoSize

Get-CimInstance Win32_Process -Filter "name = 'java.exe' or name = 'node.exe'" |
  Select-Object ProcessId,CommandLine |
  Format-List
```

Si identificas un proceso propio de la practica, detenerlo:

```powershell
Stop-Process -Id <process-id> -Force
```

### Paso R4 - Revisar contenedores temporales

```powershell
docker ps -a --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}" |
  Select-String -Pattern "venta-pasajes|identity|dispatch|ticketing|native|postgres"
```

Si el contenedor fue creado solo para repetir este dia y no se usa en otra practica:

```powershell
docker rm -f <container-name>
```

### Paso R5 - Reversa de archivos locales

La reversa de archivos debe hacerse con control de cambios o backup. Este workspace inicio sin Git en los primeros dias, por eso no se recomienda borrar archivos a ciegas.

```powershell
Select-String -Path .\docs\dia-15-secret-manager-configuracion-segura.md -Pattern "Archivo|Archivos|C:\\VENTA-DE-PASAJES" -Context 0,4
```

Si aun asi necesitas retirar solo este documento de la practica, hacer primero una copia:

```powershell
New-Item -ItemType Directory -Force -Path .\backups | Out-Null
Copy-Item -LiteralPath .\docs\dia-15-secret-manager-configuracion-segura.md -Destination .\backups\dia-15-secret-manager-configuracion-segura-manual-backup.md -Force
```

Despues de respaldar, se podria eliminar manualmente el documento con:

```powershell
Remove-Item -LiteralPath .\docs\dia-15-secret-manager-configuracion-segura.md -Force
```

## Guia manual desde cero

> Estandarizacion documental agregada el 2026-09-16. Esta guia permite repetir el dia sin depender de Codex, usando el documento como fuente de verdad.

### Paso 1 - Ubicarse en el proyecto

```powershell
cd C:\VENTA-DE-PASAJES
```

### Paso 2 - Leer el alcance del dia en el backlog

```powershell
Select-String -Path .\tareas.md -Pattern "Dia 15|Dia 15" -Context 0,40
```

### Paso 3 - Leer la documentacion del dia

```powershell
Get-Content -LiteralPath .\docs\dia-15-secret-manager-configuracion-segura.md
```

### Paso 4 - Verificar archivos y rutas mencionadas

```powershell
Select-String -Path .\docs\dia-15-secret-manager-configuracion-segura.md -Pattern "C:\\VENTA-DE-PASAJES" -AllMatches
```

Para cada ruta importante que aparezca en el documento:

```powershell
Test-Path -LiteralPath "<ruta-copiada-del-documento>"
```

### Paso 5 - Ejecutar comandos documentados

Buscar bloques de comandos del documento y ejecutarlos en orden, validando el resultado de cada bloque antes de continuar:

```powershell
Select-String -Path .\docs\dia-15-secret-manager-configuracion-segura.md -Pattern "```powershell|```text|mvn |npm |docker |gcloud |curl.exe|powershell " -Context 0,6
```

### Paso 6 - Registrar la repeticion en bitacora

```powershell
Add-Content -LiteralPath .\vitacora.md -Value "`nReplica manual Dia 15 - <fecha>: comandos ejecutados y resultado."
```

### Paso 7 - Validar criterio de avance

Revisar la seccion de criterio de avance, resultado, estado final o pendientes del documento:

```powershell
Select-String -Path .\docs\dia-15-secret-manager-configuracion-segura.md -Pattern "Criterio de avance|Resultado|Estado final|Pendiente|Pendientes" -Context 0,8
```
