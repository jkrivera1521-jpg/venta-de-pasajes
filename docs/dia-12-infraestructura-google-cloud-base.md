# Dia 12 - Infraestructura Google Cloud base

Fecha: 2026-09-01

## Objetivo

Preparar el bootstrap del proyecto Google Cloud de desarrollo para recibir la plataforma: proyecto dev, APIs base, presupuesto de costo y convencion de region/nombres.

## Resultado ejecutivo

La preparacion en repositorio quedo lista y validada con `-DryRun`.

La preparacion inicial quedo lista y luego se cerro con datos reales de la cuenta Google Cloud.

Se confirmo acceso a `gcloud`, cuenta activa, proyecto seleccionado, facturacion vinculada, APIs base habilitadas y presupuesto disponible. La verificacion final de Dia 12 regreso `ready=true`.

## Tareas ejecutadas

- Se verifico si Google Cloud CLI esta disponible.
- Se verifico si Terraform esta disponible.
- Se verificaron gestores de instalacion disponibles en Windows.
- Se definio region principal inicial para dev.
- Se definio proyecto dev sugerido.
- Se definio presupuesto mensual inicial sugerido.
- Se creo lista controlada de APIs base.
- Se creo script de bootstrap de proyecto dev.
- Se creo script de verificacion post-bootstrap.
- Se actualizo plantilla de variables Google Cloud.
- Se actualizo documentacion de infraestructura.
- Se actualizo estandar de nombres.
- Se valido la sintaxis de los scripts PowerShell.
- Se ejecuto `-DryRun` del bootstrap para verificar comandos generados.

## Estado local detectado

| Componente | Estado |
| --- | --- |
| `gcloud` | No instalado en PATH |
| `terraform` | No instalado en PATH |
| Chocolatey | Disponible, version `2.5.0` |
| Winget | Disponible, version `v1.29.280` |
| Google Cloud SDK en Chocolatey | `gcloudsdk 582.0.0` disponible |
| Google Cloud SDK en Winget | `Google.CloudSDK 582.0.0` disponible |
| Terraform en Chocolatey | `terraform 1.16.0` disponible |
| Terraform en Winget | `Hashicorp.Terraform 1.15.8` disponible |

## Estado Google Cloud actualizado

| Elemento | Estado |
| --- | --- |
| Cuenta activa `gcloud` | `jkrivera1521@gmail.com` |
| Proyecto seleccionado | `project-fbb34cd7-0b82-43e1-867` |
| Project number | `230270000840` |
| Billing account | `012A58-73A3EE-D43B8D` |
| Billing vinculado al proyecto | Si |
| APIs requeridas | 15 |
| APIs habilitadas detectadas | 34 |
| APIs requeridas faltantes | 0 |
| Presupuesto | Verificado |
| Estado verificacion | `ready=true` |

## Convenciones definidas

| Concepto | Valor inicial |
| --- | --- |
| Ambiente | `dev` |
| Project ID sugerido | `venta-pasajes-dev` |
| Nombre de proyecto | `Venta de Pasajes Dev` |
| Region principal inicial | `us-central1` |
| Artifact Registry | `venta-pasajes-dev` |
| Presupuesto mensual inicial | `50USD` |
| Nombre presupuesto | `venta-pasajes-dev-monthly-budget` |

Nota: `venta-pasajes-dev` puede estar ocupado globalmente en Google Cloud. Si Google rechaza ese Project ID, se debe ejecutar el bootstrap con un ID unico, por ejemplo `venta-pasajes-dev-<sufijo>`.

## APIs base definidas

Archivo:

```text
C:\VENTA-DE-PASAJES\infra\gcloud\dev-apis.txt
```

APIs:

| API | Proposito |
| --- | --- |
| `cloudresourcemanager.googleapis.com` | Creacion y gestion de proyectos. |
| `serviceusage.googleapis.com` | Activacion de APIs. |
| `cloudbilling.googleapis.com` | Vinculacion de proyecto con billing. |
| `billingbudgets.googleapis.com` | Presupuestos y alertas. |
| `run.googleapis.com` | Cloud Run. |
| `sqladmin.googleapis.com` | Cloud SQL. |
| `cloudbuild.googleapis.com` | Cloud Build. |
| `artifactregistry.googleapis.com` | Artifact Registry. |
| `secretmanager.googleapis.com` | Secret Manager. |
| `storage.googleapis.com` | Cloud Storage. |
| `pubsub.googleapis.com` | Pub/Sub. |
| `logging.googleapis.com` | Cloud Logging. |
| `monitoring.googleapis.com` | Cloud Monitoring. |
| `iam.googleapis.com` | IAM. |
| `iamcredentials.googleapis.com` | Credenciales de service accounts. |

## Scripts creados

| Archivo | Proposito |
| --- | --- |
| `C:\VENTA-DE-PASAJES\infra\gcloud\bootstrap-dev.ps1` | Crea o selecciona proyecto dev, vincula billing, activa APIs, fija region Cloud Run y crea presupuesto. |
| `C:\VENTA-DE-PASAJES\infra\gcloud\verify-dev.ps1` | Verifica proyecto, billing, APIs habilitadas y presupuesto. |
| `C:\VENTA-DE-PASAJES\infra\gcloud\README.md` | Instrucciones de prerrequisitos, dry-run, ejecucion y verificacion. |
| `C:\VENTA-DE-PASAJES\infra\gcloud\dev-apis.txt` | Lista de APIs requeridas para dev. |

## Variables de entorno actualizadas

Archivo:

```text
C:\VENTA-DE-PASAJES\infra\env\google-cloud.env.example
```

Variables nuevas o reforzadas:

```text
GOOGLE_CLOUD_PROJECT=venta-pasajes-dev
GOOGLE_CLOUD_PROJECT_NAME=Venta de Pasajes Dev
GOOGLE_CLOUD_REGION=us-central1
GOOGLE_CLOUD_ORGANIZATION_ID=
GOOGLE_CLOUD_FOLDER_ID=
GOOGLE_BILLING_ACCOUNT_ID=000000-000000-000000
GOOGLE_BUDGET_AMOUNT=50
GOOGLE_BUDGET_CURRENCY=USD
GOOGLE_BUDGET_DISPLAY_NAME=venta-pasajes-dev-monthly-budget
```

## Comandos validados

Verificacion de herramientas:

```powershell
gcloud --version
terraform -version
choco --version
winget --version
```

Resultado:

```text
gcloud no instalado
terraform no instalado
choco 2.5.0 disponible
winget v1.29.280 disponible
```

Validacion sintactica de scripts:

```text
OK .\infra\gcloud\bootstrap-dev.ps1
OK .\infra\gcloud\verify-dev.ps1
```

Validacion de APIs:

```text
OK: 15 APIs, no duplicates
```

Dry-run del bootstrap:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\infra\gcloud\bootstrap-dev.ps1 -DryRun -BillingAccountId 000000-000000-000000
```

Comandos generados por el dry-run:

```text
gcloud projects create venta-pasajes-dev --name=Venta de Pasajes Dev --labels=app=venta-pasajes,env=dev,managed_by=codex --set-as-default
gcloud billing projects link venta-pasajes-dev --billing-account=000000-000000-000000
gcloud services enable cloudresourcemanager.googleapis.com serviceusage.googleapis.com cloudbilling.googleapis.com billingbudgets.googleapis.com run.googleapis.com sqladmin.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com storage.googleapis.com pubsub.googleapis.com logging.googleapis.com monitoring.googleapis.com iam.googleapis.com iamcredentials.googleapis.com --project=venta-pasajes-dev
gcloud config set run/region us-central1
gcloud beta billing budgets create --billing-account=000000-000000-000000 --display-name=venta-pasajes-dev-monthly-budget --budget-amount=50USD --filter-projects=projects/venta-pasajes-dev --calendar-period=month --threshold-rule=percent=0.50,basis=current-spend --threshold-rule=percent=0.75,basis=current-spend --threshold-rule=percent=0.90,basis=forecasted-spend --threshold-rule=percent=1.00,basis=current-spend
```

## Ejecucion real

La ejecucion real quedo verificada con:

```powershell
$env:CLOUDSDK_PYTHON = "C:\Python312\python.exe"

powershell -NoProfile -ExecutionPolicy Bypass -File .\infra\gcloud\verify-dev.ps1 `
  -ProjectId "project-fbb34cd7-0b82-43e1-867" `
  -BillingAccountId "012A58-73A3EE-D43B8D" `
  -GcloudPath "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd"
```

Resultado:

```json
{"project_id":"project-fbb34cd7-0b82-43e1-867","project_number":"230270000840","active_account":"jkrivera1521@gmail.com","billing_enabled":true,"billing_account_name":"billingAccounts/012A58-73A3EE-D43B8D","enabled_api_count":34,"required_api_count":15,"missing_apis":[],"budget_checked":true,"budget_found":true,"budget_check_error":null,"ready":true}
```

Instalacion posible en Windows:

```powershell
choco install gcloudsdk -y
winget install --id Google.CloudSDK --exact
```

Instalacion sugerida si se replica este entorno en otra maquina:

```powershell
choco install python312 -y
gcloud components install beta
```

## Riesgos y controles

- El Project ID es global; puede requerir sufijo unico.
- El presupuesto genera alertas, no detiene automaticamente el gasto.
- El billing account no debe registrarse con credenciales ni informacion sensible en el repositorio.
- `auth/disable_ssl_validation=true` permite diagnostico, pero no debe quedar activado para trabajo normal.
- IAM fino queda para Dia 13.
- Cloud SQL fisico y bases por servicio quedan para Dia 14.
- Secretos reales quedan para Dia 15 y deben vivir en Secret Manager.

## Estado de avance

- Preparacion local y scripts: completado.
- Proyecto Google Cloud dev real: completado.
- APIs activas en cloud: completado.
- Presupuesto real: completado.

El criterio completo de Dia 12 fue alcanzado cuando `verify-dev.ps1` confirmo proyecto, billing, APIs y presupuesto en la cuenta Google Cloud real.

## Referencias oficiales usadas

- Google Cloud CLI: https://cloud.google.com/sdk
- `gcloud projects create`: https://docs.cloud.google.com/sdk/gcloud/reference/projects/create
- `gcloud billing projects link`: https://docs.cloud.google.com/sdk/gcloud/reference/billing/projects/link
- `gcloud services enable`: https://docs.cloud.google.com/sdk/gcloud/reference/services/enable
- `gcloud beta billing budgets create`: https://docs.cloud.google.com/sdk/gcloud/reference/beta/billing/budgets/create

## Reversa primero

> Estandarizacion documental agregada el 2026-09-16 para que este dia tambien tenga una ruta segura de limpieza antes de repetir la practica.

Este dia pertenece a la etapa inicial del proyecto. Antes de ejecutar una reversa, revisar si el archivo contiene recursos externos reales, como Google Cloud, Docker, bases de datos o imagenes publicadas. No ejecutar comandos destructivos si no estas seguro de que el recurso no esta siendo usado.

### Paso R1 - Ubicarse en el workspace

```powershell
cd C:\VENTA-DE-PASAJES
```

### Paso R2 - Revisar recursos o archivos mencionados

```powershell
Select-String -Path .\docs\dia-12-infraestructura-google-cloud-base.md -Pattern "C:\\VENTA-DE-PASAJES|docker|gcloud|mvn|npm|Remove-Item|delete|rm|Cloud SQL|Artifact Registry|Secret Manager" -Context 0,2
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
Select-String -Path .\docs\dia-12-infraestructura-google-cloud-base.md -Pattern "Archivo|Archivos|C:\\VENTA-DE-PASAJES" -Context 0,4
```

Si aun asi necesitas retirar solo este documento de la practica, hacer primero una copia:

```powershell
New-Item -ItemType Directory -Force -Path .\backups | Out-Null
Copy-Item -LiteralPath .\docs\dia-12-infraestructura-google-cloud-base.md -Destination .\backups\dia-12-infraestructura-google-cloud-base-manual-backup.md -Force
```

Despues de respaldar, se podria eliminar manualmente el documento con:

```powershell
Remove-Item -LiteralPath .\docs\dia-12-infraestructura-google-cloud-base.md -Force
```

## Guia manual desde cero

> Estandarizacion documental agregada el 2026-09-16. Esta guia permite repetir el dia sin depender de Codex, usando el documento como fuente de verdad.

### Paso 1 - Ubicarse en el proyecto

```powershell
cd C:\VENTA-DE-PASAJES
```

### Paso 2 - Leer el alcance del dia en el backlog

```powershell
Select-String -Path .\tareas.md -Pattern "Dia 12|Dia 12" -Context 0,40
```

### Paso 3 - Leer la documentacion del dia

```powershell
Get-Content -LiteralPath .\docs\dia-12-infraestructura-google-cloud-base.md
```

### Paso 4 - Verificar archivos y rutas mencionadas

```powershell
Select-String -Path .\docs\dia-12-infraestructura-google-cloud-base.md -Pattern "C:\\VENTA-DE-PASAJES" -AllMatches
```

Para cada ruta importante que aparezca en el documento:

```powershell
Test-Path -LiteralPath "<ruta-copiada-del-documento>"
```

### Paso 5 - Ejecutar comandos documentados

Buscar bloques de comandos del documento y ejecutarlos en orden, validando el resultado de cada bloque antes de continuar:

```powershell
Select-String -Path .\docs\dia-12-infraestructura-google-cloud-base.md -Pattern "```powershell|```text|mvn |npm |docker |gcloud |curl.exe|powershell " -Context 0,6
```

### Paso 6 - Registrar la repeticion en bitacora

```powershell
Add-Content -LiteralPath .\vitacora.md -Value "`nReplica manual Dia 12 - <fecha>: comandos ejecutados y resultado."
```

### Paso 7 - Validar criterio de avance

Revisar la seccion de criterio de avance, resultado, estado final o pendientes del documento:

```powershell
Select-String -Path .\docs\dia-12-infraestructura-google-cloud-base.md -Pattern "Criterio de avance|Resultado|Estado final|Pendiente|Pendientes" -Context 0,8
```
