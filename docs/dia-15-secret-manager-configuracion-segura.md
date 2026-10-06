# Dia 15 - Secret Manager y configuracion segura

Fecha: 2026-09-02

## Objetivo

Crear secretos de desarrollo en Google Secret Manager, asignar acceso por service account y retirar secretos reales de archivos locales.

## Resultado ejecutivo

Dia 15 completado y verificado en Google Cloud dev.

Se crearon 15 secretos en Secret Manager con versiones iniciales. Cada secreto quedo con `roles/secretmanager.secretAccessor` asignado solo a la service account propietaria. Tambien se creo la service account `frontend-shell-run` para que el secreto de sesion del frontend tenga identidad runtime propia.

Comando que genero la verificacion final de Secret Manager:

```powershell
cd C:\VENTA-DE-PASAJES
$env:CLOUDSDK_PYTHON = "C:\Python312\python.exe"

powershell -NoProfile -ExecutionPolicy Bypass -File .\infra\gcloud\verify-secrets-dev.ps1 `
  -ProjectId "project-fbb34cd7-0b82-43e1-867" `
  -ConfigPath ".\infra\gcloud\secrets-dev.json" `
  -GcloudPath "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd"
```

El script `verify-secrets-dev.ps1` obtiene el resultado asi:

| Campo                             | De donde sale                                                                                                                   |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `project_id`                      | Parametro `-ProjectId`, variable `GOOGLE_CLOUD_PROJECT`, configuracion activa de `gcloud` o `project_id` de `secrets-dev.json`. |
| `config_path`                     | Ruta del catalogo declarativo `secrets-dev.json`.                                                                               |
| `secrets_expected`                | Cantidad de entradas en `secrets-dev.json`.                                                                                     |
| `secrets_found`                   | Conteo de secretos que responden OK a `gcloud secrets describe`.                                                                |
| `missing_secrets`                 | Secretos del JSON que no existen en Secret Manager.                                                                             |
| `secrets_without_enabled_version` | Secretos sin versiones habilitadas segun `gcloud secrets versions list --filter=state=enabled`.                                 |
| `missing_accessor_bindings`       | Bindings faltantes de `roles/secretmanager.secretAccessor` segun `gcloud secrets get-iam-policy`.                               |
| `local_secret_findings`           | Hallazgos sensibles locales revisados en `NOTAS.txt`, como token `gcloud` o password anotada.                                   |
| `ready`                           | `true` solo si no faltan secretos, versiones habilitadas, bindings IAM ni hallazgos locales sensibles.                          |

El script no imprime valores secretos. Solo valida existencia, versiones e IAM.

Verificacion final de Secret Manager:

```json
{
	"project_id": "project-fbb34cd7-0b82-43e1-867",
	"config_path": "C:\\VENTA-DE-PASAJES\\infra\\gcloud\\secrets-dev.json",
	"secrets_expected": 15,
	"secrets_found": 15,
	"missing_secrets": [],
	"secrets_without_enabled_version": [],
	"missing_accessor_bindings": [],
	"local_secret_findings": {},
	"ready": true
}
```

Comando que genero la verificacion IAM posterior:

```powershell
cd C:\VENTA-DE-PASAJES
$env:CLOUDSDK_PYTHON = "C:\Python312\python.exe"

powershell -NoProfile -ExecutionPolicy Bypass -File .\infra\gcloud\verify-iam-dev.ps1 `
  -ProjectId "project-fbb34cd7-0b82-43e1-867" `
  -MatrixPath ".\infra\gcloud\iam-dev.json" `
  -GcloudPath "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd"
```

El script `verify-iam-dev.ps1` obtiene el resultado asi:

| Campo                              | De donde sale                                                                                                               |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `project_id`                       | Parametro `-ProjectId`, variable `GOOGLE_CLOUD_PROJECT`, configuracion activa de `gcloud` o `project_id` de `iam-dev.json`. |
| `project_number`                   | `gcloud projects describe <project_id> --format=value(projectNumber)`.                                                      |
| `matrix_path`                      | Ruta de la matriz IAM `iam-dev.json`.                                                                                       |
| `service_accounts_expected`        | Cantidad de cuentas definidas en `iam-dev.json`.                                                                            |
| `service_accounts_found`           | Conteo de cuentas que existen segun `gcloud iam service-accounts describe`.                                                 |
| `missing_accounts`                 | Cuentas de servicio definidas en la matriz que no existen en Google Cloud.                                                  |
| `missing_project_bindings`         | Roles de proyecto definidos en la matriz pero ausentes en `gcloud projects get-iam-policy`.                                 |
| `missing_service_account_bindings` | Permisos sobre cuentas de servicio, por ejemplo impersonacion, ausentes en `gcloud iam service-accounts get-iam-policy`.    |
| `admin_groups_status`              | Estado documental: grupos definidos pero pendientes de Google Workspace o Cloud Identity.                                   |
| `mfa_status`                       | Estado documental: MFA depende de control externo al IAM del proyecto.                                                      |
| `ready`                            | `true` solo si no faltan cuentas, roles de proyecto ni bindings sobre service accounts.                                     |

Verificacion IAM posterior:

```json
{
	"project_id": "project-fbb34cd7-0b82-43e1-867",
	"project_number": "230270000840",
	"matrix_path": "C:\\VENTA-DE-PASAJES\\infra\\gcloud\\iam-dev.json",
	"service_accounts_expected": 8,
	"service_accounts_found": 8,
	"missing_accounts": [],
	"missing_project_bindings": [],
	"missing_service_account_bindings": [],
	"admin_groups_status": "defined_pending_google_workspace_or_cloud_identity",
	"mfa_status": "manual_control_pending_or_external_to_project_iam",
	"ready": true
}
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

Los placeholders de integracion deben reemplazarse con una nueva versión del secreto cuando se elija el proveedor real. No se deben escribir en archivos locales.

PLACEHOLDERS = : es como dejar creado el casillero seguro donde luego irá la llave real.
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

| Archivo                                                      | Proposito                                                                    |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| `C:\VENTA-DE-PASAJES\infra\gcloud\secrets-dev.json`          | Catalogo declarativo de secretos dev.                                        |
| `C:\VENTA-DE-PASAJES\infra\gcloud\bootstrap-secrets-dev.ps1` | Crea secretos, agrega version inicial y aplica IAM por secreto.              |
| `C:\VENTA-DE-PASAJES\infra\gcloud\verify-secrets-dev.ps1`    | Verifica secretos, versiones, IAM y hallazgos locales sensibles.             |
| `C:\VENTA-DE-PASAJES\infra\gcloud\iam-dev.json`              | Agrega `frontend-shell-run` a la matriz IAM.                                 |
| `C:\VENTA-DE-PASAJES\infra\env\backend-service.env.example`  | Retira password placeholder y agrega referencias a Secret Manager.           |
| `C:\VENTA-DE-PASAJES\infra\env\frontend-app.env.example`     | Retira `AUTH_SESSION_SECRET=change-me` y agrega referencia a Secret Manager. |
| `C:\VENTA-DE-PASAJES\NOTAS.txt`                              | Redacta token gcloud y password local previamente anotados.                  |

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


## Alternativa desde la consola web de Google Cloud

> Esta seccion documenta como repetir manualmente desde la interfaz web lo que los scripts hicieron con `gcloud`. No fue ejecutada por Codex.

### Paso W1 - Seleccionar el proyecto correcto

1. Abrir Google Cloud Console.
2. En el selector superior de proyecto, elegir:

```text
project-fbb34cd7-0b82-43e1-867
```

3. Confirmar que estas trabajando en el ambiente `dev`.

### Paso W2 - Habilitar o revisar Secret Manager API

1. Ir a `APIs y servicios`.
2. Entrar a `Biblioteca`.
3. Buscar `Secret Manager API`.
4. Si aparece deshabilitada, seleccionar `Habilitar`.
5. Si ya aparece habilitada, no hacer cambios.

### Paso W3 - Crear la service account del frontend shell

Este paso replica la parte IAM del dia donde se agrego `frontend-shell-run`.

1. Ir a `IAM y administracion`.
2. Entrar a `Cuentas de servicio`.
3. Seleccionar `Crear cuenta de servicio`.
4. Completar:

| Campo | Valor |
| --- | --- |
| Nombre de cuenta de servicio | `frontend-shell runtime` |
| ID de cuenta de servicio | `frontend-shell-run` |
| Descripcion | `Runtime identity for frontend-shell in Cloud Run dev.` |

5. En permisos de proyecto, asignar:

| Rol | Proposito |
| --- | --- |
| `Logging > Logs Writer` | Permite escribir logs de runtime. |
| `Monitoring > Monitoring Metric Writer` | Permite publicar metricas de runtime. |

6. No crear llaves JSON para esta cuenta.

### Paso W4 - Permitir impersonacion desde Cloud Build

Este paso equivale al binding `roles/iam.serviceAccountUser` sobre `frontend-shell-run`.

1. Ir a `IAM y administracion > Cuentas de servicio`.
2. Abrir:

```text
frontend-shell-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com
```

3. Entrar a la pestana `Permisos`.
4. Seleccionar `Conceder acceso`.
5. En `Principales nuevos`, agregar:

```text
cloudbuild-deployer@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com
```

6. Asignar el rol:

```text
Service Accounts > Service Account User
```

7. Guardar.

### Paso W5 - Crear los secretos desde Secret Manager

Para cada secreto:

1. Ir a `Seguridad > Secret Manager`.
2. Seleccionar `Crear secreto`.
3. En `Nombre`, copiar exactamente el nombre del secreto.
4. En `Valor del secreto`, pegar el valor correspondiente.
5. En replicacion, usar `Automatic`.
6. En etiquetas, agregar:

| Etiqueta | Valor |
| --- | --- |
| `app` | `venta-pasajes` |
| `env` | `dev` |
| `category` | Valor de la columna `Categoria`. |
| `owner` | Valor de la columna `Owner`. |

7. Crear el secreto.

Catalogo completo:

| Secreto | Categoria | Owner | Valor inicial |
| --- | --- | --- | --- |
| `identity-service__db-connection` | `database` | `identity-service` | JSON de conexion para `identity_db`. |
| `dispatch-service__db-connection` | `database` | `dispatch-service` | JSON de conexion para `dispatch_db`. |
| `ticketing-service__db-connection` | `database` | `ticketing-service` | JSON de conexion para `ticketing_db`. |
| `document-service__db-connection` | `database` | `document-service` | JSON de conexion para `documents_db`. |
| `reporting-service__db-connection` | `database` | `reporting-service` | JSON de conexion para `reporting_db`. |
| `audit-service__db-connection` | `database` | `audit-service` | JSON de conexion para `audit_db`. |
| `identity-service__jwt-signing-secret` | `session` | `identity-service` | Valor aleatorio base64url de 64 bytes. |
| `identity-service__refresh-token-pepper` | `session` | `identity-service` | Valor aleatorio base64url de 64 bytes. |
| `identity-service__password-pepper` | `session` | `identity-service` | Valor aleatorio base64url de 64 bytes. |
| `identity-service__recovery-token-pepper` | `session` | `identity-service` | Valor aleatorio base64url de 64 bytes. |
| `frontend-shell__session-secret` | `session` | `frontend-shell` | Valor aleatorio base64url de 64 bytes. |
| `identity-service__google-oauth-client-secret` | `integration` | `identity-service` | Placeholder seguro base64url de 48 bytes hasta elegir proveedor real. |
| `identity-service__email-provider-api-key` | `integration` | `identity-service` | Placeholder seguro base64url de 48 bytes hasta elegir proveedor real. |
| `ticketing-service__payment-provider-api-key` | `integration` | `ticketing-service` | Placeholder seguro base64url de 48 bytes hasta elegir proveedor real. |
| `document-service__document-signing-secret` | `integration` | `document-service` | Valor aleatorio base64url de 64 bytes. |

No guardar los valores aleatorios en el repositorio ni en este documento. Generarlos con un gestor de contrasenas o herramienta segura, pegarlos una sola vez en la consola y conservarlos solo en Secret Manager.

### Paso W6 - Payload JSON para secretos de base de datos

Los secretos `*_db-connection` no guardan passwords. Guardan configuracion de conexion a Cloud SQL con IAM DB authentication.

Usar esta plantilla, cambiando solo `database_name`, `database_user` y el nombre de base dentro de `jdbc_url`:

```json
{
  "app_env": "dev",
  "engine": "postgresql",
  "database_name": "<database_name>",
  "cloud_sql_instance": "venta-pasajes-dev-sql",
  "cloud_sql_connection_name": "project-fbb34cd7-0b82-43e1-867:us-central1:venta-pasajes-dev-sql",
  "cloud_sql_iam_authentication": true,
  "database_user": "<database_user>",
  "jdbc_url": "jdbc:postgresql:///<database_name>?cloudSqlInstance=project-fbb34cd7-0b82-43e1-867:us-central1:venta-pasajes-dev-sql&socketFactory=com.google.cloud.sql.postgres.SocketFactory&enableIamAuth=true&sslmode=disable",
  "password_required": false
}
```

Valores por servicio:

| Secreto | `database_name` | `database_user` |
| --- | --- | --- |
| `identity-service__db-connection` | `identity_db` | `identity-service-run@project-fbb34cd7-0b82-43e1-867.iam` |
| `dispatch-service__db-connection` | `dispatch_db` | `dispatch-service-run@project-fbb34cd7-0b82-43e1-867.iam` |
| `ticketing-service__db-connection` | `ticketing_db` | `ticketing-service-run@project-fbb34cd7-0b82-43e1-867.iam` |
| `document-service__db-connection` | `documents_db` | `document-service-run@project-fbb34cd7-0b82-43e1-867.iam` |
| `reporting-service__db-connection` | `reporting_db` | `reporting-service-run@project-fbb34cd7-0b82-43e1-867.iam` |
| `audit-service__db-connection` | `audit_db` | `audit-service-run@project-fbb34cd7-0b82-43e1-867.iam` |

### Paso W7 - Conceder acceso por secreto

Para cada secreto creado:

1. Abrir el secreto en Secret Manager.
2. Ir a la pestana `Permisos`.
3. Seleccionar `Conceder acceso`.
4. En `Principales nuevos`, agregar la cuenta de servicio correspondiente.
5. En `Rol`, seleccionar:

```text
Secret Manager > Secret Manager Secret Accessor
```

6. Guardar.

Matriz de acceso:

| Secreto | Principal con acceso |
| --- | --- |
| `identity-service__db-connection` | `identity-service-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com` |
| `dispatch-service__db-connection` | `dispatch-service-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com` |
| `ticketing-service__db-connection` | `ticketing-service-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com` |
| `document-service__db-connection` | `document-service-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com` |
| `reporting-service__db-connection` | `reporting-service-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com` |
| `audit-service__db-connection` | `audit-service-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com` |
| `identity-service__jwt-signing-secret` | `identity-service-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com` |
| `identity-service__refresh-token-pepper` | `identity-service-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com` |
| `identity-service__password-pepper` | `identity-service-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com` |
| `identity-service__recovery-token-pepper` | `identity-service-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com` |
| `frontend-shell__session-secret` | `frontend-shell-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com` |
| `identity-service__google-oauth-client-secret` | `identity-service-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com` |
| `identity-service__email-provider-api-key` | `identity-service-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com` |
| `ticketing-service__payment-provider-api-key` | `ticketing-service-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com` |
| `document-service__document-signing-secret` | `document-service-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com` |

### Paso W8 - Revisar versiones habilitadas

1. Abrir cada secreto.
2. Entrar a la seccion de versiones.
3. Confirmar que existe al menos una version habilitada.
4. Si el valor inicial fue incorrecto, no editar el valor anterior. Crear una nueva version del secreto con el valor correcto y, si aplica, deshabilitar la version equivocada.

### Paso W9 - Validacion visual esperada

Al finalizar, desde la consola web deben cumplirse estas condiciones:

| Recurso | Resultado esperado |
| --- | --- |
| Secret Manager | 15 secretos creados. |
| Versiones | Cada secreto tiene al menos una version habilitada. |
| Permisos por secreto | Cada secreto tiene `roles/secretmanager.secretAccessor` solo para su service account propietaria. |
| Service account frontend | `frontend-shell-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com` existe. |
| Roles de frontend shell | `roles/logging.logWriter` y `roles/monitoring.metricWriter`. |
| Impersonacion Cloud Build | `cloudbuild-deployer@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com` tiene `roles/iam.serviceAccountUser` sobre `frontend-shell-run`. |

Despues de hacer la configuracion por consola web, se recomienda ejecutar `verify-secrets-dev.ps1` y `verify-iam-dev.ps1` para tener una validacion reproducible en JSON.
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


### Reversa efectiva de Secret Manager dev 
> Advertencia: esta reversa elimina secretos reales de Google Secret Manager en el proyecto dev. No ejecutarla si Cloud Run, pipelines, pruebas o usuarios dependen de estos secretos. La eliminacion de un secreto tambien elimina sus versiones y sus bindings IAM asociados al secreto.

Esta reversa cubre los secretos creados desde:

```text
C:\VENTA-DE-PASAJES\infra\gcloud\secrets-dev.json
C:\VENTA-DE-PASAJES\infra\gcloud\bootstrap-secrets-dev.ps1
C:\VENTA-DE-PASAJES\infra\gcloud\verify-secrets-dev.ps1
```

No borra cuentas de servicio, no revierte `iam-dev.json`, no elimina archivos locales y no toca Cloud SQL. Su alcance es solo Secret Manager dev.

#### Paso SR1 - Preparar variables

```powershell
cd C:\VENTA-DE-PASAJES

$ProjectId = "project-fbb34cd7-0b82-43e1-867"
$ConfigPath = ".\infra\gcloud\secrets-dev.json"
$GcloudPath = "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd"
$env:CLOUDSDK_PYTHON = "C:\Python312\python.exe"

Test-Path -LiteralPath $ConfigPath
Test-Path -LiteralPath $GcloudPath
```

#### Paso SR2 - Listar los secretos que se eliminarian

```powershell
$Config = Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json
$SecretIds = @($Config.secrets | ForEach-Object { [string]$_.id })

$SecretIds |
  ForEach-Object {
    [pscustomobject]@{
      Secret = $_
      Exists = (& $GcloudPath secrets describe $_ --project=$ProjectId --format="value(name)" 2>$null) -ne $null
    }
  } |
  Format-Table -AutoSize
```

Resultado esperado antes de borrar: 15 filas y `Exists=True` en los secretos que todavia existen.

#### Paso SR3 - Guardar evidencia no sensible antes de borrar

Este paso no descarga valores secretos. Solo guarda metadatos, versiones e IAM policy de cada secreto para auditoria.

```powershell
$EvidenceDir = ".\logs\reversa-dia15-secret-manager-dev"
New-Item -ItemType Directory -Force -Path $EvidenceDir | Out-Null

$SecretIds | Set-Content -LiteralPath (Join-Path $EvidenceDir "secret-ids.txt")

foreach ($SecretId in $SecretIds) {
  & $GcloudPath secrets describe $SecretId `
    --project=$ProjectId `
    --format=json |
    Set-Content -LiteralPath (Join-Path $EvidenceDir "$SecretId.describe.json")

  & $GcloudPath secrets versions list $SecretId `
    --project=$ProjectId `
    --format=json |
    Set-Content -LiteralPath (Join-Path $EvidenceDir "$SecretId.versions.json")

  & $GcloudPath secrets get-iam-policy $SecretId `
    --project=$ProjectId `
    --format=json |
    Set-Content -LiteralPath (Join-Path $EvidenceDir "$SecretId.iam-policy.json")
}
```

#### Paso SR4 - Eliminar todos los secretos del Dia 15

Ejecutar solo cuando estes seguro de revertir Secret Manager dev.

```powershell
foreach ($SecretId in $SecretIds) {
  Write-Host "Deleting Secret Manager secret: $SecretId"
  & $GcloudPath secrets delete $SecretId `
    --project=$ProjectId `
    --quiet

  if ($LASTEXITCODE -ne 0) {
    throw "No se pudo eliminar el secreto: $SecretId"
  }
}
```

Secretos cubiertos por esta reversa:

| Secreto | Categoria |
| --- | --- |
| `identity-service__db-connection` | Base de datos |
| `dispatch-service__db-connection` | Base de datos |
| `ticketing-service__db-connection` | Base de datos |
| `document-service__db-connection` | Base de datos |
| `reporting-service__db-connection` | Base de datos |
| `audit-service__db-connection` | Base de datos |
| `identity-service__jwt-signing-secret` | Seguridad/sesion |
| `identity-service__refresh-token-pepper` | Seguridad/sesion |
| `identity-service__password-pepper` | Seguridad/sesion |
| `identity-service__recovery-token-pepper` | Seguridad/sesion |
| `frontend-shell__session-secret` | Seguridad/sesion |
| `identity-service__google-oauth-client-secret` | Integracion placeholder |
| `identity-service__email-provider-api-key` | Integracion placeholder |
| `ticketing-service__payment-provider-api-key` | Integracion placeholder |
| `document-service__document-signing-secret` | Integracion/documentos |

#### Paso SR5 - Validar que ya no existan

```powershell
$Validation = foreach ($SecretId in $SecretIds) {
  & $GcloudPath secrets describe $SecretId --project=$ProjectId --format="value(name)" 1>$null 2>$null

  [pscustomobject]@{
    Secret = $SecretId
    Deleted = ($LASTEXITCODE -ne 0)
  }
}

$Validation | Format-Table -AutoSize

if (($Validation | Where-Object { -not $_.Deleted }).Count -gt 0) {
  throw "Uno o mas secretos siguen existiendo en Secret Manager."
}
```

#### Paso SR6 - Registrar la reversa en bitacora

```powershell
Add-Content -LiteralPath .\vitacora.md -Value "`nReversa Dia 15 Secret Manager dev - $(Get-Date -Format s): secretos dev eliminados desde secrets-dev.json. Evidencia no sensible en logs\reversa-dia15-secret-manager-dev."
```

#### Paso SR7 - Como reconstruir despues de la reversa

Si necesitas recrear los secretos despues de eliminarlos:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\infra\gcloud\bootstrap-secrets-dev.ps1

powershell -NoProfile -ExecutionPolicy Bypass -File .\infra\gcloud\verify-secrets-dev.ps1
```




PROMPT: EXISTE EN google skills algún lab que me ayude mejorar o reforzar lo aplicado en el día 15 de este proyecto?

En **Google Cloud Skills Boost** hay labs que encajan muy bien con lo aplicado en el **Día 15 - Secret Manager y configuración segura**.

El más directo es:

1. **Configuring and Using Credentials with Secret Manager**  -> OK 
    Es el lab que más se parece al Día 15. Practica activar la API de Secret Manager, crear secretos, usar versiones, deshabilitar versiones anteriores y restaurar una versión previa. Esto refuerza justo la parte de creación, rotación y reversa de secretos que documentamos. [Ver lab](https://www.cloudskillsboost.google/catalog_lab/2887)
    
2. **Developer Essentials: Creating Secrets with Secret Manager**   -> Error no existe
    Es más básico y corto. Sirve si quieres reforzar desde cero: crear un secreto, agregar una versión y acceder al valor desde Cloud Shell. [Ver lab](https://www.cloudskillsboost.google/catalog_lab/32467)
    
3. **Service Accounts and Roles: Fundamentals**    -> OK
    Recomendado porque en el Día 15 no solo creamos secretos, también asignamos acceso a cuentas de servicio como `identity-service-run`, `ticketing-service-run`, etc. Este lab explica cuentas de servicio y roles IAM. [Ver lab](https://www.cloudskillsboost.google/paths/76/course_templates/770/labs/558281)
    
4. **Configuring IAM Permissions with gcloud**    -> Error no existe
    Útil para entender mejor los bindings IAM, permisos, roles y uso de `gcloud`, especialmente cuando asignamos `roles/secretmanager.secretAccessor`. [Ver lab](https://www.cloudskillsboost.google/course_templates/702/labs/562137?locale=es)
    
5. **Developing Applications on Google Cloud: Deploying and Maintaining Your Application**  
    Este no es solo Secret Manager, pero tiene una parte importante donde una aplicación usa secretos y una cuenta de servicio con permisos mínimos. Es bueno para conectar lo del Día 15 con uso real desde una app. [Ver lab](https://www.cloudskillsboost.google/paths/19/course_templates/874/labs/541142?locale=pl)   Error no existe
    
