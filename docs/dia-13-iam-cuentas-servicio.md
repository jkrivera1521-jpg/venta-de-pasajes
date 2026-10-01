# Dia 13 - IAM y cuentas de servicio

Fecha: 2026-09-02

## Objetivo

Crear identidades cloud separadas por componente, preparar una identidad dedicada para Cloud Build y asignar permisos minimos iniciales para desarrollo.

## Resultado ejecutivo

Dia 13 completado y verificado en Google Cloud dev.

Se crearon inicialmente 7 service accounts, se aplicaron los bindings IAM base de proyecto y se configuraron permisos de impersonacion para que Cloud Build pueda desplegar servicios Cloud Run usando la identidad runtime correcta.

Nota: durante Dia 14 se agrego `roles/cloudsql.instanceUser` a los runtime service accounts para soportar autenticacion IAM de base de datos. La matriz IAM actual ya refleja ese ajuste.

Nota: durante Dia 15 se agrego `frontend-shell-run` para que el shell frontend tenga identidad runtime propia y pueda acceder a su secreto de sesion.

Verificacion final:

Comando ejecutado para obtener este resultado:

```powershell
cd C:\VENTA-DE-PASAJES
$env:CLOUDSDK_PYTHON = "C:\Python312\python.exe"

powershell -NoProfile -ExecutionPolicy Bypass -File .\infra\gcloud\verify-iam-dev.ps1 `
  -ProjectId "project-fbb34cd7-0b82-43e1-867" `
  -GcloudPath "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd"
```

Resultado obtenido:

```json
{"project_id":"project-fbb34cd7-0b82-43e1-867","project_number":"230270000840","matrix_path":"C:\\VENTA-DE-PASAJES\\infra\\gcloud\\iam-dev.json","service_accounts_expected":8,"service_accounts_found":8,"missing_accounts":[],"missing_project_bindings":[],"missing_service_account_bindings":[],"admin_groups_status":"defined_pending_google_workspace_or_cloud_identity","mfa_status":"manual_control_pending_or_external_to_project_iam","ready":true}
```

## Proyecto verificado

| Elemento | Valor |
| --- | --- |
| Project ID | `project-fbb34cd7-0b82-43e1-867` |
| Project number | `230270000840` |
| Cuenta ejecutora | `jkrivera1521@gmail.com` |
| Region dev | `us-central1` |
| Estado IAM | `ready=true` |

## Matriz IAM dev

Archivo fuente:

```text
C:\VENTA-DE-PASAJES\infra\gcloud\iam-dev.json
```

| Componente | Service account | Roles de proyecto aplicados | Roles aplazados por recurso |
| --- | --- | --- | --- |
| `identity-service` | `identity-service-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com` | `roles/cloudsql.client`, `roles/cloudsql.instanceUser`, `roles/logging.logWriter`, `roles/monitoring.metricWriter` | Secret Manager por secreto, Pub/Sub por topic |
| `dispatch-service` | `dispatch-service-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com` | `roles/cloudsql.client`, `roles/cloudsql.instanceUser`, `roles/logging.logWriter`, `roles/monitoring.metricWriter` | Secret Manager por secreto, Pub/Sub por topic |
| `ticketing-service` | `ticketing-service-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com` | `roles/cloudsql.client`, `roles/cloudsql.instanceUser`, `roles/logging.logWriter`, `roles/monitoring.metricWriter` | Secret Manager por secreto, Pub/Sub por topic |
| `document-service` | `document-service-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com` | `roles/cloudsql.client`, `roles/cloudsql.instanceUser`, `roles/logging.logWriter`, `roles/monitoring.metricWriter` | Secret Manager por secreto, Pub/Sub por topic, Storage por bucket |
| `reporting-service` | `reporting-service-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com` | `roles/cloudsql.client`, `roles/cloudsql.instanceUser`, `roles/logging.logWriter`, `roles/monitoring.metricWriter` | Secret Manager por secreto, Pub/Sub por suscripcion |
| `audit-service` | `audit-service-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com` | `roles/cloudsql.client`, `roles/cloudsql.instanceUser`, `roles/logging.logWriter`, `roles/monitoring.metricWriter` | Secret Manager por secreto, Pub/Sub por topic/suscripcion |
| `frontend-shell` | `frontend-shell-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com` | `roles/logging.logWriter`, `roles/monitoring.metricWriter` | Secret Manager para secreto de sesion |
| Cloud Build | `cloudbuild-deployer@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com` | `roles/artifactregistry.writer`, `roles/cloudbuild.builds.editor`, `roles/logging.logWriter`, `roles/run.admin`, `roles/storage.admin` | Secret Manager solo para secretos de pipeline |

## Roles predefinidos principales

Estos roles no son roles personalizados del proyecto. Son roles predefinidos de Google Cloud; por eso no aparecen al ejecutar `gcloud iam roles list --project <PROJECT_ID>`, ya que ese comando lista solamente roles personalizados creados dentro del proyecto.

| Rol | Donde se usa | Descripcion |
| --- | --- | --- |
| `roles/cloudsql.client` | Runtime service accounts de backends | Permite que los servicios desplegados en Cloud Run puedan conectarse a Cloud SQL. Es necesario para que los microservicios accedan a PostgreSQL usando la infraestructura administrada de Google Cloud. |
| `roles/cloudsql.instanceUser` | Runtime service accounts de backends | Permite usar autenticacion IAM contra Cloud SQL. Se agrego para soportar acceso a base de datos sin depender de contrasenas planas dentro del codigo o del repositorio. |
| `roles/logging.logWriter` | Backends, frontend shell y Cloud Build deployer | Permite escribir logs en Cloud Logging. Sin este rol, los servicios podrian ejecutarse, pero quedaria limitada la trazabilidad operativa y el diagnostico. |
| `roles/monitoring.metricWriter` | Backends y frontend shell | Permite publicar metricas en Cloud Monitoring. Sirve para monitoreo, alertas y visibilidad del comportamiento de los servicios. |
| `roles/run.admin` | `cloudbuild-deployer` | Permite administrar y desplegar servicios Cloud Run. Se asigna a la identidad de despliegue, no a cada microservicio, para separar ejecucion runtime de capacidades de administracion. |
| `roles/artifactregistry.writer` | `cloudbuild-deployer` | Permite publicar imagenes Docker en Artifact Registry. Es necesario para que el pipeline pueda subir imagenes versionadas antes de desplegarlas en Cloud Run. |

## Impersonacion Cloud Build

Cloud Build deployer puede adjuntar estas identidades runtime a Cloud Run mediante `roles/iam.serviceAccountUser` aplicado en cada service account runtime:

```text
identity-service-run
dispatch-service-run
ticketing-service-run
document-service-run
reporting-service-run
audit-service-run
frontend-shell-run
```

Esto permite que el pipeline despliegue cada servicio sin ejecutar todos los contenedores con una misma identidad global.

## Decisiones de minimo privilegio

- No se crearon llaves JSON de service accounts.
- No se asigno `roles/owner`, `roles/editor` ni `roles/viewer` a service accounts.
- No se otorgo Secret Manager a nivel proyecto; desde Dia 15 se aplica por secreto.
- No se otorgo Pub/Sub a nivel proyecto; se aplicara por topic y suscripcion en Dia 55.
- No se otorgo Storage a `document-service` todavia; se aplicara al bucket de documentos en Dia 56.
- `roles/storage.admin` quedo solo para `cloudbuild-deployer` porque el flujo Cloud Build para despliegues Cloud Run puede requerir lectura/escritura de artefactos/logs de build.
- `roles/cloudsql.instanceUser` se agrego a los runtime service accounts durante Dia 14 para permitir autenticacion IAM de base de datos sin contrasenas.

## Grupos administradores

Definidos en matriz, pendientes de crear hasta confirmar Google Workspace o Cloud Identity:

| Grupo logico | Estado | Proposito |
| --- | --- | --- |
| `gcp-venta-pasajes-admins` | Pendiente | Administradores del proyecto con MFA obligatorio |
| `gcp-venta-pasajes-developers` | Pendiente | Desarrolladores con acceso limitado a dev |
| `gcp-venta-pasajes-auditors` | Pendiente | Lectura de auditoria y revision de costos |

En este momento el proyecto usa una cuenta Google personal. Google Cloud IAM no fuerza MFA por proyecto; ese control se aplica en la cuenta Google o desde Google Workspace/Cloud Identity.

## MFA

Control definido:

- Cuentas administrativas con verificacion en 2 pasos habilitada.
- Sin cuentas compartidas.
- Accesos por usuarios nominales.
- Cuando exista Workspace/Cloud Identity, mover permisos humanos a grupos y aplicar politicas MFA desde el proveedor de identidad.

Estado: pendiente de confirmacion manual por fuera de IAM del proyecto.

## Scripts creados

| Archivo | Proposito |
| --- | --- |
| `C:\VENTA-DE-PASAJES\infra\gcloud\iam-dev.json` | Matriz IAM dev. |
| `C:\VENTA-DE-PASAJES\infra\gcloud\bootstrap-iam-dev.ps1` | Crea service accounts y aplica bindings IAM. |
| `C:\VENTA-DE-PASAJES\infra\gcloud\verify-iam-dev.ps1` | Verifica service accounts y bindings requeridos. |

## Alternativa desde la consola grafica de Google Cloud

Esta ruta permite realizar manualmente, desde el navegador, lo mismo que automatiza `bootstrap-iam-dev.ps1`: crear las cuentas de servicio, asignar roles IAM de proyecto y permitir que `cloudbuild-deployer` adjunte las identidades runtime al desplegar servicios Cloud Run.

Importante: desde la consola grafica no hay modo `-DryRun`. Si se presiona `Crear`, `Conceder acceso`, `Guardar` o `Actualizar`, el cambio se aplica realmente sobre Google Cloud.

### Datos base

| Dato | Valor |
| --- | --- |
| Proyecto | `project-fbb34cd7-0b82-43e1-867` |
| Region de referencia | `us-central1` |
| Matriz local | `C:\VENTA-DE-PASAJES\infra\gcloud\iam-dev.json` |
| Cuenta deployer | `cloudbuild-deployer@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com` |

### Paso G1 - Abrir IAM y seleccionar el proyecto

Abrir Google Cloud Console y confirmar que el proyecto activo sea:

```text
project-fbb34cd7-0b82-43e1-867
```

Ruta en consola:

```text
Menu principal > IAM y administracion
```

Si la consola esta en ingles, la ruta equivalente suele aparecer como:

```text
IAM & Admin
```

### Paso G2 - Crear las cuentas de servicio

Ruta en consola:

```text
IAM y administracion > Cuentas de servicio
```

En ingles:

```text
IAM & Admin > Service Accounts
```

Por cada fila de esta tabla, usar `Crear cuenta de servicio`:

| Account ID | Nombre visible | Descripcion |
| --- | --- | --- |
| `identity-service-run` | `identity-service runtime` | Runtime identity for identity-service in Cloud Run dev. |
| `dispatch-service-run` | `dispatch-service runtime` | Runtime identity for dispatch-service in Cloud Run dev. |
| `ticketing-service-run` | `ticketing-service runtime` | Runtime identity for ticketing-service in Cloud Run dev. |
| `document-service-run` | `document-service runtime` | Runtime identity for document-service in Cloud Run dev. |
| `reporting-service-run` | `reporting-service runtime` | Runtime identity for reporting-service in Cloud Run dev. |
| `audit-service-run` | `audit-service runtime` | Runtime identity for audit-service in Cloud Run dev. |
| `frontend-shell-run` | `frontend-shell runtime` | Runtime identity for frontend-shell in Cloud Run dev. |
| `cloudbuild-deployer` | `Cloud Build deployer` | Custom Cloud Build service account for build and Cloud Run deployment in dev. |

Resultado esperado:

```text
8 cuentas de servicio creadas.
```

Los correos completos quedan con esta forma:

```text
<account-id>@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com
```

Ejemplo:

```text
identity-service-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com
```

### Paso G3 - Asignar roles de proyecto a los runtimes backend

Ruta en consola:

```text
IAM y administracion > IAM
```

Accion:

1. Clic en `Conceder acceso`.
2. En `Nuevos principales`, pegar el correo de la cuenta de servicio.
3. Agregar los roles correspondientes.
4. Guardar.

Asignar estos roles a cada backend runtime:

| Cuenta de servicio | Roles |
| --- | --- |
| `identity-service-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com` | `Cloud SQL Client`, `Cloud SQL Instance User`, `Logs Writer`, `Monitoring Metric Writer` |
| `dispatch-service-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com` | `Cloud SQL Client`, `Cloud SQL Instance User`, `Logs Writer`, `Monitoring Metric Writer` |
| `ticketing-service-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com` | `Cloud SQL Client`, `Cloud SQL Instance User`, `Logs Writer`, `Monitoring Metric Writer` |
| `document-service-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com` | `Cloud SQL Client`, `Cloud SQL Instance User`, `Logs Writer`, `Monitoring Metric Writer` |
| `reporting-service-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com` | `Cloud SQL Client`, `Cloud SQL Instance User`, `Logs Writer`, `Monitoring Metric Writer` |
| `audit-service-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com` | `Cloud SQL Client`, `Cloud SQL Instance User`, `Logs Writer`, `Monitoring Metric Writer` |

Equivalencia tecnica de roles:

| Nombre en consola | ID del rol |
| --- | --- |
| `Cloud SQL Client` | `roles/cloudsql.client` |
| `Cloud SQL Instance User` | `roles/cloudsql.instanceUser` |
| `Logs Writer` | `roles/logging.logWriter` |
| `Monitoring Metric Writer` | `roles/monitoring.metricWriter` |

### Paso G4 - Asignar roles de proyecto al frontend shell

En `IAM y administracion > IAM`, conceder acceso a:

```text
frontend-shell-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com
```

Roles:

| Nombre en consola | ID del rol |
| --- | --- |
| `Logs Writer` | `roles/logging.logWriter` |
| `Monitoring Metric Writer` | `roles/monitoring.metricWriter` |

### Paso G5 - Asignar roles de proyecto al deployer de Cloud Build

En `IAM y administracion > IAM`, conceder acceso a:

```text
cloudbuild-deployer@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com
```

Roles:

| Nombre en consola | ID del rol | Uso |
| --- | --- | --- |
| `Artifact Registry Writer` | `roles/artifactregistry.writer` | Publicar imagenes Docker en Artifact Registry. |
| `Cloud Build Editor` | `roles/cloudbuild.builds.editor` | Administrar/ejecutar builds del pipeline. |
| `Logs Writer` | `roles/logging.logWriter` | Escribir logs de build y despliegue. |
| `Cloud Run Admin` | `roles/run.admin` | Crear y actualizar servicios Cloud Run. |
| `Storage Admin` | `roles/storage.admin` | Manejar artefactos/logs usados por el flujo de build. |

### Paso G6 - Configurar impersonacion Cloud Build sobre cuentas runtime

Este paso permite que `cloudbuild-deployer` pueda adjuntar una cuenta runtime a Cloud Run al desplegar un servicio.

Ruta en consola:

```text
IAM y administracion > Cuentas de servicio
```

Para cada cuenta runtime de esta tabla:

1. Abrir la cuenta de servicio.
2. Entrar a `Permisos` o `Permissions`.
3. Clic en `Conceder acceso` o `Grant access`.
4. Principal:

```text
cloudbuild-deployer@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com
```

5. Rol:

```text
Service Account User
```

Equivalencia tecnica:

```text
roles/iam.serviceAccountUser
```

Cuentas runtime donde se concede este acceso:

| Cuenta destino | Principal que recibe acceso | Rol |
| --- | --- | --- |
| `identity-service-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com` | `cloudbuild-deployer@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com` | `Service Account User` |
| `dispatch-service-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com` | `cloudbuild-deployer@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com` | `Service Account User` |
| `ticketing-service-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com` | `cloudbuild-deployer@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com` | `Service Account User` |
| `document-service-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com` | `cloudbuild-deployer@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com` | `Service Account User` |
| `reporting-service-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com` | `cloudbuild-deployer@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com` | `Service Account User` |
| `audit-service-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com` | `cloudbuild-deployer@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com` | `Service Account User` |
| `frontend-shell-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com` | `cloudbuild-deployer@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com` | `Service Account User` |

### Paso G7 - No crear llaves JSON

En las cuentas de servicio no crear claves JSON.

Control esperado:

```text
Keys / Claves: sin claves creadas
```

Razon: el proyecto usa identidades administradas por Google Cloud. Las llaves JSON aumentan el riesgo porque pueden copiarse, filtrarse o quedar guardadas en equipos locales.

### Paso G8 - Grupos administradores y MFA

En la matriz existen grupos planificados:

| Grupo logico | Estado | Proposito |
| --- | --- | --- |
| `gcp-venta-pasajes-admins` | Pendiente | Administradores del proyecto con MFA obligatorio. |
| `gcp-venta-pasajes-developers` | Pendiente | Desarrolladores con acceso limitado a dev. |
| `gcp-venta-pasajes-auditors` | Pendiente | Lectura de auditoria y revision de costos. |

Estos grupos no se crean desde IAM del proyecto si no existe Google Workspace o Cloud Identity. Mientras se use una cuenta Google personal, MFA se controla en la cuenta Google de cada usuario.

Control manual esperado:

```text
La cuenta administradora debe tener verificacion en 2 pasos activa.
No usar cuentas compartidas.
No entregar roles Owner/Editor/Viewer a service accounts.
```

### Paso G9 - Verificacion desde la consola grafica

Validar en:

```text
IAM y administracion > Cuentas de servicio
```

Resultado esperado:

```text
8 service accounts visibles.
```

Validar en:

```text
IAM y administracion > IAM
```

Resultado esperado:

- Cada backend runtime tiene `Cloud SQL Client`, `Cloud SQL Instance User`, `Logs Writer` y `Monitoring Metric Writer`.
- `frontend-shell-run` tiene `Logs Writer` y `Monitoring Metric Writer`.
- `cloudbuild-deployer` tiene `Artifact Registry Writer`, `Cloud Build Editor`, `Logs Writer`, `Cloud Run Admin` y `Storage Admin`.

Validar en cada cuenta runtime:

```text
Cuentas de servicio > <cuenta runtime> > Permisos
```

Resultado esperado:

```text
cloudbuild-deployer tiene Service Account User sobre cada cuenta runtime.
```

### Paso G10 - Confirmacion tecnica opcional

Si despues de la revision grafica se quiere validar con el script del repositorio:

```powershell
cd C:\VENTA-DE-PASAJES
$env:CLOUDSDK_PYTHON = "C:\Python312\python.exe"

powershell -NoProfile -ExecutionPolicy Bypass -File .\infra\gcloud\verify-iam-dev.ps1 `
  -ProjectId "project-fbb34cd7-0b82-43e1-867" `
  -GcloudPath "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd"
```

El resultado correcto debe terminar con:

```json
"ready":true
```

## Comandos ejecutados

Validacion local:

```powershell
Get-Content -LiteralPath .\infra\gcloud\iam-dev.json -Raw | ConvertFrom-Json
```

Dry-run:

```powershell
$env:CLOUDSDK_PYTHON = "C:\Python312\python.exe"

powershell -NoProfile -ExecutionPolicy Bypass -File .\infra\gcloud\bootstrap-iam-dev.ps1 `
  -DryRun `
  -ProjectId "project-fbb34cd7-0b82-43e1-867" `
  -GcloudPath "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd"
```

Bootstrap real:

```powershell
$env:CLOUDSDK_PYTHON = "C:\Python312\python.exe"

powershell -NoProfile -ExecutionPolicy Bypass -File .\infra\gcloud\bootstrap-iam-dev.ps1 `
  -ProjectId "project-fbb34cd7-0b82-43e1-867" `
  -GcloudPath "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd"
```

Verificacion:

```powershell
$env:CLOUDSDK_PYTHON = "C:\Python312\python.exe"

powershell -NoProfile -ExecutionPolicy Bypass -File .\infra\gcloud\verify-iam-dev.ps1 `
  -ProjectId "project-fbb34cd7-0b82-43e1-867" `
  -GcloudPath "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd"
```

## Validacion

- Sintaxis PowerShell: OK.
- JSON de matriz IAM: OK.
- Service accounts esperadas: 8.
- Service accounts encontradas: 8.
- Project bindings faltantes: 0.
- Service account bindings faltantes: 0.
- Estado final: `ready=true`.

## Revision en consola

Service accounts:

```text
https://console.cloud.google.com/iam-admin/serviceaccounts?project=project-fbb34cd7-0b82-43e1-867
```

IAM:

```text
https://console.cloud.google.com/iam-admin/iam?project=project-fbb34cd7-0b82-43e1-867
```

Cloud Build:

```text
https://console.cloud.google.com/cloud-build/settings/service-account?project=project-fbb34cd7-0b82-43e1-867
```

## Pendientes para dias posteriores

- Dia 14: crear Cloud SQL dev y bases por servicio.
- Dia 15: completado; secretos reales creados y `secretAccessor` asignado por secreto.
- Dia 52: usar `cloudbuild-deployer` en pipelines y triggers.
- Dia 55: crear Pub/Sub y asignar permisos por topic/suscripcion.
- Dia 56: crear bucket de documentos y asignar permisos a `document-service`.
- Cuando exista Workspace/Cloud Identity: crear grupos administradores y aplicar MFA centralizada.

## Referencias oficiales usadas

- Cloud Build service account: https://docs.cloud.google.com/build/docs/cloud-build-service-account
- Cloud Build service account impersonation: https://docs.cloud.google.com/build/docs/deploying-builds/cb-sa-imp
- User-specified service accounts in Cloud Build: https://docs.cloud.google.com/build/docs/securing-builds/configure-user-specified-service-accounts
- Deploying to Cloud Run using Cloud Build: https://docs.cloud.google.com/build/docs/deploying-builds/deploy-cloud-run

## Reversa primero

> Estandarizacion documental agregada el 2026-09-16 para que este dia tambien tenga una ruta segura de limpieza antes de repetir la practica.

Este dia pertenece a la etapa inicial del proyecto. Antes de ejecutar una reversa, revisar si el archivo contiene recursos externos reales, como Google Cloud, Docker, bases de datos o imagenes publicadas. No ejecutar comandos destructivos si no estas seguro de que el recurso no esta siendo usado.

### Paso R1 - Ubicarse en el workspace

```powershell
cd C:\VENTA-DE-PASAJES
```

### Paso R2 - Revisar recursos o archivos mencionados

```powershell
Select-String -Path .\docs\dia-13-iam-cuentas-servicio.md -Pattern "C:\\VENTA-DE-PASAJES|docker|gcloud|mvn|npm|Remove-Item|delete|rm|Cloud SQL|Artifact Registry|Secret Manager" -Context 0,2
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
Select-String -Path .\docs\dia-13-iam-cuentas-servicio.md -Pattern "Archivo|Archivos|C:\\VENTA-DE-PASAJES" -Context 0,4
```

Si aun asi necesitas retirar solo este documento de la practica, hacer primero una copia:

```powershell
New-Item -ItemType Directory -Force -Path .\backups | Out-Null
Copy-Item -LiteralPath .\docs\dia-13-iam-cuentas-servicio.md -Destination .\backups\dia-13-iam-cuentas-servicio-manual-backup.md -Force
```

Despues de respaldar, se podria eliminar manualmente el documento con:

```powershell
Remove-Item -LiteralPath .\docs\dia-13-iam-cuentas-servicio.md -Force
```

## Guia manual desde cero

> Estandarizacion documental agregada el 2026-09-16. Esta guia permite repetir el dia sin depender de Codex, usando el documento como fuente de verdad.

### Paso 1 - Ubicarse en el proyecto

```powershell
cd C:\VENTA-DE-PASAJES
```

### Paso 2 - Leer el alcance del dia en el backlog

```powershell
Select-String -Path .\tareas.md -Pattern "Dia 13|Dia 13" -Context 0,40
```

### Paso 3 - Leer la documentacion del dia

```powershell
Get-Content -LiteralPath .\docs\dia-13-iam-cuentas-servicio.md
```

### Paso 4 - Verificar archivos y rutas mencionadas

```powershell
Select-String -Path .\docs\dia-13-iam-cuentas-servicio.md -Pattern "C:\\VENTA-DE-PASAJES" -AllMatches
```

Para cada ruta importante que aparezca en el documento:

```powershell
Test-Path -LiteralPath "<ruta-copiada-del-documento>"
```

### Paso 5 - Ejecutar comandos documentados

Buscar bloques de comandos del documento y ejecutarlos en orden, validando el resultado de cada bloque antes de continuar:

```powershell
Select-String -Path .\docs\dia-13-iam-cuentas-servicio.md -Pattern "```powershell|```text|mvn |npm |docker |gcloud |curl.exe|powershell " -Context 0,6
```

### Paso 6 - Registrar la repeticion en bitacora

```powershell
Add-Content -LiteralPath .\vitacora.md -Value "`nReplica manual Dia 13 - <fecha>: comandos ejecutados y resultado."
```

### Paso 7 - Validar criterio de avance

Revisar la seccion de criterio de avance, resultado, estado final o pendientes del documento:

```powershell
Select-String -Path .\docs\dia-13-iam-cuentas-servicio.md -Pattern "Criterio de avance|Resultado|Estado final|Pendiente|Pendientes" -Context 0,8
```
