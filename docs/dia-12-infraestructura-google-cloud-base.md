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

Nota: Terraform se reviso solo como herramienta disponible para una posible estrategia futura de infraestructura como codigo. En el Dia 12 no se uso Terraform para crear recursos. La ruta implementada y validada fue con scripts PowerShell que ejecutan `gcloud`.

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

| API | Servicio Google Cloud | Uso concreto en Venta de Pasajes |
| --- | --- | --- |
| `cloudresourcemanager.googleapis.com` | Cloud Resource Manager | Permite crear, describir y administrar el proyecto Google Cloud donde vive el sistema. El bootstrap lo necesita para crear o validar el proyecto dev/prod y obtener datos como `projectId` y `projectNumber`. |
| `serviceusage.googleapis.com` | Service Usage | Permite habilitar las demas APIs del proyecto. Sin esta API, el script no podria activar Cloud Run, Cloud SQL, Artifact Registry, Secret Manager, etc. |
| `cloudbilling.googleapis.com` | Cloud Billing | Permite vincular el proyecto con una cuenta de facturacion. Es necesario porque servicios como Cloud Run, Cloud SQL, Artifact Registry y Cloud Storage requieren billing activo. |
| `billingbudgets.googleapis.com` | Cloud Billing Budgets | Permite crear y consultar presupuestos y alertas de gasto. En el proyecto se usa para el presupuesto mensual inicial y umbrales de alerta 50%, 75%, 90% y 100%. |
| `run.googleapis.com` | Cloud Run | Plataforma donde se despliegan los backends Quarkus y los frontends Next.js/MFEs. Es esencial para ejecutar `identity-service`, `dispatch-service`, `ticketing-service`, `reporting-service`, `audit-service`, `document-service`, `frontend-shell` y los MFEs. |
| `sqladmin.googleapis.com` | Cloud SQL Admin API | Permite crear, configurar, consultar y administrar instancias Cloud SQL PostgreSQL. Se usa para preparar la instancia PostgreSQL y las bases separadas por microservicio. |
| `cloudbuild.googleapis.com` | Cloud Build | Permite automatizar builds y pasos CI/CD dentro de Google Cloud. Sirve para construir imagenes, ejecutar pipelines y preparar despliegues cuando se use Cloud Build. |
| `artifactregistry.googleapis.com` | Artifact Registry | Repositorio privado de imagenes Docker. Se usa para publicar y versionar imagenes de backends, shell y MFEs antes de desplegarlas en Cloud Run. |
| `secretmanager.googleapis.com` | Secret Manager | Almacena secretos fuera del repositorio: peppers, claves, credenciales, secretos de JWT, configuracion sensible y valores productivos que no deben quedar en archivos `.env`. |
| `storage.googleapis.com` | Cloud Storage | Almacenamiento de objetos. En el proyecto se usa para documentos, respaldos, evidencias, posibles exportaciones y buckets documentales por ambiente. |
| `pubsub.googleapis.com` | Pub/Sub | Mensajeria asincrona entre dominios. Se usa como base para eventos, outbox, integracion entre microservicios y comunicacion desacoplada. |
| `logging.googleapis.com` | Cloud Logging | Centraliza logs de Cloud Run, Cloud SQL y otros servicios. Sirve para diagnostico operativo, trazabilidad, auditoria tecnica y soporte. |
| `monitoring.googleapis.com` | Cloud Monitoring | Permite metricas, paneles y alertas sobre servicios Cloud Run, base de datos, consumo y salud de la plataforma. |
| `iam.googleapis.com` | IAM | Permite crear y administrar permisos, roles y service accounts. Se usa para separar identidades por servicio y controlar quien puede invocar o administrar recursos. |
| `iamcredentials.googleapis.com` | IAM Service Account Credentials | Permite emitir credenciales/tokens para service accounts. Es necesaria para flujos de identidad servicio-a-servicio, invocacion privada entre Cloud Run y operaciones que requieren tokens de cuenta de servicio. |

Resumen practico:

| Grupo | APIs incluidas | Para que se usan |
| --- | --- | --- |
| Gobierno del proyecto | `cloudresourcemanager`, `serviceusage`, `cloudbilling`, `billingbudgets` | Crear/validar proyecto, activar servicios, vincular billing y controlar gasto. |
| Ejecucion de la aplicacion | `run`, `sqladmin`, `artifactregistry`, `secretmanager`, `storage` | Ejecutar servicios, guardar imagenes, manejar base de datos, secretos y archivos. |
| Integracion y operacion | `pubsub`, `logging`, `monitoring` | Eventos, logs, metricas y soporte operativo. |
| Seguridad e identidad cloud | `iam`, `iamcredentials` | Service accounts, permisos e invocacion segura entre servicios. |

## Scripts creados

| Archivo | Proposito |
| --- | --- |
| `C:\VENTA-DE-PASAJES\infra\gcloud\bootstrap-dev.ps1` | Crea o selecciona proyecto dev, vincula billing, activa APIs, fija region Cloud Run y crea presupuesto. |
| `C:\VENTA-DE-PASAJES\infra\gcloud\verify-dev.ps1` | Verifica proyecto, billing, APIs habilitadas y presupuesto. |
| `C:\VENTA-DE-PASAJES\infra\gcloud\README.md` | Instrucciones de prerrequisitos, dry-run, ejecucion y verificacion. |
| `C:\VENTA-DE-PASAJES\infra\gcloud\dev-apis.txt` | Lista de APIs requeridas para dev. |

### Detalle de scripts PowerShell creados

#### `bootstrap-dev.ps1`

Archivo:

```text
C:\VENTA-DE-PASAJES\infra\gcloud\bootstrap-dev.ps1
```

Objetivo:

Preparar el proyecto Google Cloud de desarrollo. Es el script que arma o aplica el bootstrap inicial de infraestructura base.

Parametros principales:

| Parametro | Para que sirve |
| --- | --- |
| `ProjectId` | ID del proyecto Google Cloud. Si no se envia, toma `GOOGLE_CLOUD_PROJECT`; si no existe, usa `venta-pasajes-dev`. |
| `ProjectName` | Nombre visible del proyecto. Por defecto usa `Venta de Pasajes Dev`. |
| `Region` | Region principal para Cloud Run. Por defecto `us-central1`. |
| `BillingAccountId` | Cuenta de facturacion que se vincula al proyecto. Es obligatoria en ejecucion real. |
| `OrganizationId` | Organizacion Google Cloud padre, si aplica. No se usa junto con `FolderId`. |
| `FolderId` | Carpeta Google Cloud padre, si aplica. No se usa junto con `OrganizationId`. |
| `BudgetAmount` | Monto del presupuesto mensual. Por defecto `50`. |
| `BudgetCurrency` | Moneda del presupuesto. Por defecto `USD`. |
| `BudgetDisplayName` | Nombre del presupuesto. Por defecto `venta-pasajes-dev-monthly-budget`. |
| `GcloudPath` | Ruta manual a `gcloud.cmd` si no esta en PATH. |
| `DryRun` | Modo seguro: imprime los comandos `gcloud` que ejecutaria, pero no modifica Google Cloud. |

Flujo interno:

1. Valida que no se envien `OrganizationId` y `FolderId` al mismo tiempo.
2. En modo `DryRun`, si no hay cuenta de billing, usa `000000-000000-000000` como placeholder.
3. En ejecucion real, exige `BillingAccountId`.
4. Busca `gcloud` en PATH o en rutas comunes de Chocolatey, Google Cloud SDK y perfil local.
5. Busca Python compatible para `gcloud` y configura `CLOUDSDK_PYTHON` si hace falta.
6. Verifica que exista una cuenta activa con `gcloud auth list`.
7. Revisa si el proyecto existe.
8. Si el proyecto existe, ejecuta `gcloud config set project`.
9. Si el proyecto no existe, ejecuta `gcloud projects create`.
10. Vincula billing con `gcloud billing projects link`.
11. Lee `infra\gcloud\dev-apis.txt`.
12. Habilita las APIs con `gcloud services enable`.
13. Configura la region de Cloud Run con `gcloud config set run/region`.
14. Revisa si el presupuesto ya existe.
15. Si no existe, crea el presupuesto con reglas de alerta al 50%, 75%, 90% y 100%.
16. Devuelve un resumen JSON con proyecto, region, billing, presupuesto, cantidad de APIs y si fue `dry_run`.

Uso seguro recomendado:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\infra\gcloud\bootstrap-dev.ps1 `
  -DryRun `
  -BillingAccountId 000000-000000-000000
```

Uso real, solo cuando ya se valido el plan:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\infra\gcloud\bootstrap-dev.ps1 `
  -ProjectId "project-fbb34cd7-0b82-43e1-867" `
  -BillingAccountId "012A58-73A3EE-D43B8D" `
  -GcloudPath "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd"
```

#### `verify-dev.ps1`

Archivo:

```text
C:\VENTA-DE-PASAJES\infra\gcloud\verify-dev.ps1
```

Objetivo:

Verificar que la infraestructura base de desarrollo quedo lista. Este script no crea el proyecto; valida el estado real contra lo esperado.

Parametros principales:

| Parametro | Para que sirve |
| --- | --- |
| `ProjectId` | Proyecto Google Cloud a verificar. Si no se envia, toma `GOOGLE_CLOUD_PROJECT` o `venta-pasajes-dev`. |
| `BillingAccountId` | Cuenta de facturacion usada para validar presupuesto. |
| `BudgetDisplayName` | Nombre del presupuesto que debe existir. |
| `GcloudPath` | Ruta manual a `gcloud.cmd` si no esta en PATH. |

Flujo interno:

1. Busca `gcloud` en PATH o en rutas comunes de instalacion.
2. Busca Python compatible para `gcloud` y configura `CLOUDSDK_PYTHON` si hace falta.
3. Verifica cuenta activa con `gcloud auth list`.
4. Lee el proyecto con `gcloud projects describe`.
5. Lee el estado de billing con `gcloud billing projects describe`.
6. Lee las APIs requeridas desde `infra\gcloud\dev-apis.txt`.
7. Lista APIs habilitadas con `gcloud services list --enabled`.
8. Calcula APIs faltantes comparando requeridas contra habilitadas.
9. Si se envio `BillingAccountId`, intenta listar presupuestos con `gcloud beta billing budgets list`.
10. Verifica si existe el presupuesto esperado.
11. Devuelve un JSON con cuenta activa, project number, billing, APIs habilitadas, APIs faltantes, presupuesto y `ready`.

Uso recomendado:

```powershell
$env:CLOUDSDK_PYTHON = "C:\Python312\python.exe"

powershell -NoProfile -ExecutionPolicy Bypass -File .\infra\gcloud\verify-dev.ps1 `
  -ProjectId "project-fbb34cd7-0b82-43e1-867" `
  -BillingAccountId "012A58-73A3EE-D43B8D" `
  -GcloudPath "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd"
```

Interpretacion del resultado:

| Campo | Significado |
| --- | --- |
| `billing_enabled=true` | El proyecto tiene facturacion activa. |
| `missing_apis=[]` | No faltan APIs requeridas. |
| `budget_found=true` | Existe el presupuesto esperado. |
| `ready=true` | El proyecto cumple las condiciones base del Dia 12. |

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

La presencia de `terraform -version` en este bloque no significa que Terraform forme parte de la ejecucion del Dia 12. Se incluyo como inventario de toolchain de infraestructura. Los recursos de Google Cloud de este dia se preparan mediante `infra\gcloud\bootstrap-dev.ps1` y se verifican con `infra\gcloud\verify-dev.ps1`.

Validacion sintactica de scripts:

Comando usado para generar el resultado:

```powershell
$Scripts = @(
  ".\infra\gcloud\bootstrap-dev.ps1",
  ".\infra\gcloud\verify-dev.ps1"
)

foreach ($Script in $Scripts) {
  $ResolvedScript = (Resolve-Path -LiteralPath $Script).Path
  $Tokens = $null
  $Errors = $null
  [System.Management.Automation.Language.Parser]::ParseFile($ResolvedScript, [ref]$Tokens, [ref]$Errors) | Out-Null

  if (@($Errors).Count -gt 0) {
    Write-Host "ERROR $Script"
    $Errors | Format-List
    exit 1
  }

  Write-Host "OK $Script"
}
```

Que valida:

- Que PowerShell pueda leer y parsear el archivo.
- Que no haya errores de sintaxis como llaves sin cerrar, parametros mal formados o bloques incompletos.
- No valida credenciales, permisos ni existencia de recursos en Google Cloud.

Resultado:

```text
OK .\infra\gcloud\bootstrap-dev.ps1
OK .\infra\gcloud\verify-dev.ps1
```

Validacion de APIs:

Comando usado para generar el resultado:

```powershell
$Apis = Get-Content -LiteralPath ".\infra\gcloud\dev-apis.txt" |
  ForEach-Object { $_.Trim() } |
  Where-Object { $_ -and -not $_.StartsWith("#") }

$DuplicateApis = $Apis | Group-Object | Where-Object { $_.Count -gt 1 }

if (@($DuplicateApis).Count -gt 0) {
  Write-Host "ERROR duplicate APIs found"
  $DuplicateApis | Format-Table Name, Count -AutoSize
  exit 1
}

Write-Host "OK: $(@($Apis).Count) APIs, no duplicates"
```

Que valida:

- Lee `C:\VENTA-DE-PASAJES\infra\gcloud\dev-apis.txt`.
- Ignora lineas vacias.
- Ignora comentarios que empiezan con `#`.
- Cuenta las APIs reales requeridas.
- Verifica que no haya APIs repetidas.

Resultado:

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

## Alternativa desde la consola web de Google Cloud

Esta ruta sirve para hacer manualmente, desde el navegador, lo mismo que prepara `bootstrap-dev.ps1`: proyecto, billing, APIs base, region operativa y presupuesto.

Importante: desde la interfaz web de Google Cloud no existe un modo `-DryRun`. Si se presiona `Crear`, `Vincular`, `Habilitar` o `Guardar`, el cambio se aplica realmente sobre Google Cloud. Para simular primero, usar el dry-run documentado en la seccion anterior.

### Datos que se deben tener a mano

| Dato | Valor usado en este proyecto |
| --- | --- |
| Proyecto real dev | `project-fbb34cd7-0b82-43e1-867` |
| Nombre visible | `My First Project` en la consola actual; el nombre sugerido del estandar era `Venta de Pasajes Dev` |
| Numero de proyecto | `230270000840` |
| Billing account | `012A58-73A3EE-D43B8D` |
| Region estandar del proyecto | `us-central1` |
| Presupuesto esperado | `venta-pasajes-dev-monthly-budget` |
| Monto de presupuesto | `50 USD` |

### Paso W1 - Entrar y seleccionar el proyecto

1. Abrir Google Cloud Console:

```text
https://console.cloud.google.com/
```

2. En el selector de proyecto, elegir:

```text
project-fbb34cd7-0b82-43e1-867
```

3. Confirmar en la pantalla de bienvenida o panel principal:

```text
ID del proyecto: project-fbb34cd7-0b82-43e1-867
Numero de proyecto: 230270000840
```

Si se esta creando un ambiente dev desde cero y el proyecto aun no existe:

1. Abrir el selector de proyecto.
2. Seleccionar `Nuevo proyecto`.
3. Usar un nombre como `Venta de Pasajes Dev`.
4. Usar un Project ID unico. El ID sugerido `venta-pasajes-dev` puede estar ocupado globalmente, por eso en esta cuenta se termino usando `project-fbb34cd7-0b82-43e1-867`.
5. Elegir organizacion o carpeta solo si la cuenta Google Cloud lo requiere.
6. Crear el proyecto y seleccionarlo antes de seguir.

### Paso W2 - Vincular facturacion

Ruta en consola:

```text
Menu principal > Facturacion
```

Acciones:

1. Verificar que el proyecto seleccionado sea `project-fbb34cd7-0b82-43e1-867`.
2. Entrar a la seccion de proyectos vinculados o administracion de facturacion.
3. Vincular el proyecto con la cuenta de facturacion:

```text
012A58-73A3EE-D43B8D
```

Validacion esperada:

```text
Facturacion: habilitada para el proyecto
```

Equivalente por comando, solo si se usa Cloud Shell dentro de la consola web:

```bash
PROJECT_ID="project-fbb34cd7-0b82-43e1-867"
BILLING_ACCOUNT_ID="012A58-73A3EE-D43B8D"

gcloud config set project "$PROJECT_ID"
gcloud billing projects link "$PROJECT_ID" --billing-account="$BILLING_ACCOUNT_ID"
gcloud billing projects describe "$PROJECT_ID"
```

### Paso W3 - Habilitar APIs base

Ruta en consola:

```text
Menu principal > APIs y servicios > Biblioteca
```

Accion:

Buscar y habilitar una por una las 15 APIs definidas en:

```text
C:\VENTA-DE-PASAJES\infra\gcloud\dev-apis.txt
```

Lista a habilitar:

```text
cloudresourcemanager.googleapis.com
serviceusage.googleapis.com
cloudbilling.googleapis.com
billingbudgets.googleapis.com
run.googleapis.com
sqladmin.googleapis.com
cloudbuild.googleapis.com
artifactregistry.googleapis.com
secretmanager.googleapis.com
storage.googleapis.com
pubsub.googleapis.com
logging.googleapis.com
monitoring.googleapis.com
iam.googleapis.com
iamcredentials.googleapis.com
```

Validacion esperada en:

```text
Menu principal > APIs y servicios > APIs y servicios habilitados
```

Debe verse cada API como habilitada para el proyecto.

Equivalente por comando, solo si se usa Cloud Shell dentro de la consola web:

```bash
PROJECT_ID="project-fbb34cd7-0b82-43e1-867"

gcloud services enable \
  cloudresourcemanager.googleapis.com \
  serviceusage.googleapis.com \
  cloudbilling.googleapis.com \
  billingbudgets.googleapis.com \
  run.googleapis.com \
  sqladmin.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  storage.googleapis.com \
  pubsub.googleapis.com \
  logging.googleapis.com \
  monitoring.googleapis.com \
  iam.googleapis.com \
  iamcredentials.googleapis.com \
  --project="$PROJECT_ID"

gcloud services list --enabled --project="$PROJECT_ID" --format="value(config.name)" | sort
```

### Paso W4 - Fijar la region operativa

En la interfaz web no hay un boton global equivalente a `gcloud config set run/region us-central1`. La region se elige al crear recursos regionales como Cloud Run, Cloud SQL, Artifact Registry o buckets.

Para este proyecto, cuando la consola pregunte por region, usar:

```text
us-central1
```

Equivalente por comando, solo si se usa Cloud Shell dentro de la consola web:

```bash
gcloud config set run/region us-central1
```

### Paso W5 - Crear presupuesto y alertas

Ruta en consola:

```text
Menu principal > Facturacion > Presupuestos y alertas
```

Acciones:

1. Crear un presupuesto nuevo.
2. Nombre del presupuesto:

```text
venta-pasajes-dev-monthly-budget
```

3. Alcance: seleccionar solo el proyecto:

```text
project-fbb34cd7-0b82-43e1-867
```

4. Periodo: mensual.
5. Monto: `50 USD`.
6. Reglas de alerta:

| Porcentaje | Base |
| --- | --- |
| 50% | Gasto actual |
| 75% | Gasto actual |
| 90% | Gasto previsto |
| 100% | Gasto actual |

Validacion esperada:

```text
Presupuesto venta-pasajes-dev-monthly-budget creado y asociado al proyecto dev.
```

Equivalente por comando, solo si se usa Cloud Shell dentro de la consola web:

```bash
PROJECT_ID="project-fbb34cd7-0b82-43e1-867"
BILLING_ACCOUNT_ID="012A58-73A3EE-D43B8D"

gcloud beta billing budgets create \
  --billing-account="$BILLING_ACCOUNT_ID" \
  --display-name="venta-pasajes-dev-monthly-budget" \
  --budget-amount=50USD \
  --filter-projects="projects/$PROJECT_ID" \
  --calendar-period=month \
  --threshold-rule=percent=0.50,basis=current-spend \
  --threshold-rule=percent=0.75,basis=current-spend \
  --threshold-rule=percent=0.90,basis=forecasted-spend \
  --threshold-rule=percent=1.00,basis=current-spend
```

### Paso W6 - Verificar desde la consola web

Revisar estos puntos antes de considerar cerrado el Dia 12:

| Validacion | Ruta en consola | Resultado esperado |
| --- | --- | --- |
| Proyecto seleccionado | Bienvenida o selector de proyecto | `project-fbb34cd7-0b82-43e1-867` |
| Billing | `Facturacion` | Proyecto vinculado a billing |
| APIs | `APIs y servicios > APIs y servicios habilitados` | Las 15 APIs requeridas estan habilitadas |
| Presupuesto | `Facturacion > Presupuestos y alertas` | Existe `venta-pasajes-dev-monthly-budget` |
| Region | Formularios de recursos regionales | Usar siempre `us-central1` |

Validacion rapida por Cloud Shell:

```bash
PROJECT_ID="project-fbb34cd7-0b82-43e1-867"
BILLING_ACCOUNT_ID="012A58-73A3EE-D43B8D"

gcloud projects describe "$PROJECT_ID" --format="table(projectId,projectNumber,lifecycleState)"
gcloud billing projects describe "$PROJECT_ID" --format="table(billingEnabled,billingAccountName)"
gcloud services list --enabled --project="$PROJECT_ID" --format="value(config.name)" | sort
gcloud beta billing budgets list --billing-account="$BILLING_ACCOUNT_ID" --filter='displayName=venta-pasajes-dev-monthly-budget' --format="table(displayName)"
```

### Paso W7 - Registrar el resultado en el repositorio

Despues de hacerlo desde la consola web, registrar la evidencia localmente:

```powershell
cd C:\VENTA-DE-PASAJES
Add-Content -LiteralPath .\vitacora.md -Value "`nDia 12 - Validacion por consola web Google Cloud: proyecto, billing, APIs y presupuesto verificados."
```

Si se desea validar desde Windows con el script del repositorio, usar la seccion `Ejecucion real`.

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
