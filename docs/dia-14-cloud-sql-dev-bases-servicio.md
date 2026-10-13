# Dia 14 - Cloud SQL dev y bases por servicio

Fecha: 2026-09-02

## Objetivo

Crear la instancia Cloud SQL PostgreSQL de desarrollo, separar las bases por dominio y crear usuarios de base separados por microservicio.

## Resultado ejecutivo

Dia 14 completado y verificado en Google Cloud dev.

Se creo la instancia `venta-pasajes-dev-sql`, se crearon 6 bases de datos por dominio y se crearon 6 usuarios IAM de base de datos, uno por service account runtime.

Verificacion final:

```json
{
	"project_id": "project-fbb34cd7-0b82-43e1-867",
	"instance_name": "venta-pasajes-dev-sql",
	"connection_name": "project-fbb34cd7-0b82-43e1-867:us-central1:venta-pasajes-dev-sql",
	"state": "RUNNABLE",
	"database_version": "POSTGRES_16",
	"region": "us-central1",
	"tier": "db-f1-micro",
	"edition": "ENTERPRISE",
	"availability_type": "ZONAL",
	"deletion_protection": true,
	"backup_enabled": true,
	"backup_start_time": "08:00",
	"expected_databases": 6,
	"missing_databases": [],
	"expected_iam_database_users": 6,
	"missing_iam_database_users": [],
	"missing_database_flags": [],
	"missing_instance_user_bindings": [],
	"privilege_strategy": "deferred_to_service_migrations",
	"ready": true
}
```

## Instancia Cloud SQL

| Elemento | Valor |
| --- | --- |
| Project ID | `project-fbb34cd7-0b82-43e1-867` |
| Instance ID | `venta-pasajes-dev-sql` |
| Connection name | `project-fbb34cd7-0b82-43e1-867:us-central1:venta-pasajes-dev-sql` |
| Motor | PostgreSQL |
| Version | `POSTGRES_16` |
| Edition | `ENTERPRISE` |
| Tier | `db-f1-micro` |
| Region | `us-central1` |
| Alta disponibilidad | `ZONAL` |
| Storage | `SSD`, 10 GB, auto-increase habilitado |
| Backups | Habilitados, 08:00 UTC, 7 respaldos retenidos |
| Deletion protection | Habilitado |
| IAM DB authentication | Habilitado con `cloudsql.iam_authentication=on` |

Nota de costo: Cloud SQL cobra mientras la instancia esta encendida. Se eligio `db-f1-micro` por ser el tier minimo de prueba disponible en `us-central1`.

## Bases de datos creadas

| Base | Servicio dueno | DDL de referencia |
| --- | --- | --- |
| `identity_db` | `identity-service` | `C:\VENTA-DE-PASAJES\docs\database\identity-db.sql` |
| `dispatch_db` | `dispatch-service` | `C:\VENTA-DE-PASAJES\docs\database\dispatch-db.sql` |
| `ticketing_db` | `ticketing-service` | `C:\VENTA-DE-PASAJES\docs\database\ticketing-db.sql` |
| `documents_db` | `document-service` | `C:\VENTA-DE-PASAJES\docs\database\documents-db.sql` |
| `reporting_db` | `reporting-service` | `C:\VENTA-DE-PASAJES\docs\database\reporting-db.sql` |
| `audit_db` | `audit-service` | `C:\VENTA-DE-PASAJES\docs\database\audit-db.sql` |

Aunque `reporting_db` no estaba en la lista corta del Dia 14 en `tareas.md`, se creo por coherencia con el diseno del Dia 8 y con el microservicio `reporting-service`.

## Usuarios IAM de base de datos

| Servicio | Cloud SQL IAM database user |
| --- | --- |
| `identity-service` | `identity-service-run@project-fbb34cd7-0b82-43e1-867.iam` |
| `dispatch-service` | `dispatch-service-run@project-fbb34cd7-0b82-43e1-867.iam` |
| `ticketing-service` | `ticketing-service-run@project-fbb34cd7-0b82-43e1-867.iam` |
| `document-service` | `document-service-run@project-fbb34cd7-0b82-43e1-867.iam` |
| `reporting-service` | `reporting-service-run@project-fbb34cd7-0b82-43e1-867.iam` |
| `audit-service` | `audit-service-run@project-fbb34cd7-0b82-43e1-867.iam` |

No se generaron contrasenas ni llaves JSON. La autenticacion de los servicios se apoyara en IAM DB authentication y conectores de Cloud SQL.

## IAM aplicado para acceso a Cloud SQL

Cada runtime service account tiene:

```text
roles/cloudsql.client
roles/cloudsql.instanceUser
```

`roles/cloudsql.client` permite conectar mediante **conectores/proxy** de Cloud SQL. `roles/cloudsql.instanceUser` permite login con autenticacion IAM de base de datos.

# Consideraciones de red para bases de datos

### Los conectores de Cloud SQL 
permiten que una aplicación se conecte de forma segura a MySQL, PostgreSQL o SQL Server sin administrar certificados TLS manualmente ni autorizar direcciones IP públicas.

La idea general es:

```
Aplicación
   │ protocolo normal de PostgreSQL/MySQL/SQL Server
   ▼
Auth Proxy o Language Connector
   │ túnel TLS autenticado con IAM
   ▼
Cloud SQL
```

## Cloud SQL Auth Proxy

Es un programa independiente que se ejecuta junto a tu aplicación.

Por ejemplo, el proxy escucha localmente:

```
127.0.0.1:5432
```

Tu aplicación cree que está hablando con una base PostgreSQL local:

```
host=127.0.0.1
port=5432
```

Pero el proxy:

1. Obtiene credenciales de Google mediante Application Default Credentials o una cuenta de servicio.
2. Comprueba que esa identidad tenga permiso `cloudsql.instances.connect`, normalmente incluido en `roles/cloudsql.client`.
3. Solicita un certificado efímero a la API de Cloud SQL.
4. Crea un túnel TLS 1.3 hacia Cloud SQL.
5. Envía por ese túnel el protocolo normal de la base de datos.

Los certificados efímeros duran aproximadamente una hora y el proxy los renueva automáticamente.

## Privilegios de esquema

Estado actual:

```text
schema_privileges=deferred_to_service_migrations
```

Los usuarios IAM ya existen en Cloud SQL, pero los privilegios finos sobre esquemas/tablas se aplicaran cuando las migraciones por servicio sean ejecutables.

Decisión:

- No otorgar `cloudsqlsuperuser` a los servicios.
- No usar un único usuario compartido.
- Aplicar grants por base/esquema cuando cada servicio tenga migraciones versionadas.
- Mantener trazabilidad por usuario IAM de base.

## Scripts creados

| Archivo                                                       | Proposito                                                  |
| ------------------------------------------------------------- | ---------------------------------------------------------- |
| `C:\VENTA-DE-PASAJES\infra\gcloud\cloudsql-dev.json`          | Configuracion declarativa de Cloud SQL dev.                |
| `C:\VENTA-DE-PASAJES\infra\gcloud\bootstrap-cloudsql-dev.ps1` | Crea instancia, bases, usuarios IAM y bindings requeridos. |
| `C:\VENTA-DE-PASAJES\infra\gcloud\verify-cloudsql-dev.ps1`    | Verifica instancia, bases, usuarios IAM, flags y bindings. |

## Comandos ejecutados

```powershell
$env:CLOUDSDK_PYTHON = "C:\Python312\python.exe"

powershell -NoProfile -ExecutionPolicy Bypass -File .\infra\gcloud\bootstrap-cloudsql-dev.ps1 `
  -ProjectId "project-fbb34cd7-0b82-43e1-867" `
  -GcloudPath "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd"

powershell -NoProfile -ExecutionPolicy Bypass -File .\infra\gcloud\verify-cloudsql-dev.ps1 `
  -ProjectId "project-fbb34cd7-0b82-43e1-867" `
  -GcloudPath "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd"
```

## Validacion

- JSON de configuracion: OK.
- Sintaxis PowerShell: OK.
- Tier `db-f1-micro` disponible en `us-central1`: OK.
- Instancia Cloud SQL: `RUNNABLE`.
- Bases esperadas: 6.
- Bases faltantes: 0.
- Usuarios IAM esperados: 6.
- Usuarios IAM faltantes: 0.
- Flag `cloudsql.iam_authentication=on`: OK.
- `roles/cloudsql.instanceUser`: OK.
- Estado final: `ready=true`.
- `psql` local: no instalado en PATH; se requerira para pruebas SQL locales o migraciones manuales.

## Revision en consola

Instancia:

```text
https://console.cloud.google.com/sql/instances/venta-pasajes-dev-sql/overview?project=project-fbb34cd7-0b82-43e1-867
```

Bases:

```text
https://console.cloud.google.com/sql/instances/venta-pasajes-dev-sql/databases?project=project-fbb34cd7-0b82-43e1-867
```

Usuarios:

```text
https://console.cloud.google.com/sql/instances/venta-pasajes-dev-sql/users?project=project-fbb34cd7-0b82-43e1-867
```

## Pendientes para dias posteriores

- Dia 15: crear secretos y configuracion segura para cadenas de conexion y parametros.
- Dia 16 en adelante: convertir DDL en migraciones versionadas por servicio.
- Otorgar privilegios finos sobre esquemas/tablas al ejecutar migraciones.
- Instalar cliente PostgreSQL o definir runner de migraciones antes de aplicar DDL real.
- Evaluar Private IP/VPC Connector antes de produccion.
- Revisar sizing antes de pruebas de carga; `db-f1-micro` es solo para dev inicial.

## Referencias oficiales usadas

- Crear instancias Cloud SQL PostgreSQL: https://docs.cloud.google.com/sql/docs/postgres/create-instance
- Referencia `gcloud sql instances create`: https://docs.cloud.google.com/sdk/gcloud/reference/sql/instances/create
- Cloud SQL IAM database authentication: https://docs.cloud.google.com/sql/docs/postgres/iam-authentication
- Usuarios IAM de Cloud SQL PostgreSQL: https://docs.cloud.google.com/sql/docs/postgres/add-manage-iam-users
- Login con IAM database authentication: https://docs.cloud.google.com/sql/docs/postgres/iam-logins
- Cloud SQL PostgreSQL FAQ/costos: https://docs.cloud.google.com/sql/docs/postgres/faq

## Reversa primero

## Reversa real de Cloud SQL dev

> No ejecutar esta seccion sobre el proyecto activo al 100%. Estos comandos eliminan recursos reales de Google Cloud y dejan sin base de datos a los microservicios dev.

Esta reversa cubre lo creado o verificado por:

| Archivo |
| --- |
| `C:\VENTA-DE-PASAJES\infra\gcloud\cloudsql-dev.json` |
| `C:\VENTA-DE-PASAJES\infra\gcloud\bootstrap-cloudsql-dev.ps1` |
| `C:\VENTA-DE-PASAJES\infra\gcloud\verify-cloudsql-dev.ps1` |

Recursos cubiertos:

| Recurso | Accion de reversa |
| --- | --- |
| Instancia Cloud SQL `venta-pasajes-dev-sql` | Desactivar deletion protection y eliminar instancia. |
| Bases `identity_db`, `dispatch_db`, `ticketing_db`, `documents_db`, `reporting_db`, `audit_db` | Eliminar bases individualmente si se quiere reversa parcial. |
| Usuarios IAM de base | Eliminar usuarios Cloud SQL IAM database user. |
| IAM `roles/cloudsql.instanceUser` | Revocar rol aplicado por `bootstrap-cloudsql-dev.ps1`. |
| IAM `roles/cloudsql.client` | Revocacion opcional; este rol viene de Dia 13, no estrictamente de Dia 14. |
| Cloud SQL Auth Proxy | Limpiar procesos/contenedores locales solo si alguien los levanto para pruebas. Los tres archivos de Dia 14 no crean reglas permanentes del proxy. |

### Paso RR1 - Preparar variables

Ejecutar solo cuando se haya decidido destruir el ambiente Cloud SQL dev.

```powershell
cd C:\VENTA-DE-PASAJES

$ProjectId = "project-fbb34cd7-0b82-43e1-867"
$InstanceName = "venta-pasajes-dev-sql"
$Gcloud = "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd"
$ConfigPath = ".\infra\gcloud\cloudsql-dev.json"
$env:CLOUDSDK_PYTHON = "C:\Python312\python.exe"

$Confirm = "NO_EJECUTAR"
if ($Confirm -ne "REVERSAR_DIA14_CLOUDSQL_DEV") {
  throw "Proteccion activa. Cambia `$Confirm a REVERSAR_DIA14_CLOUDSQL_DEV solo si realmente vas a eliminar Cloud SQL dev."
}
```

### Paso RR2 - Inventariar antes de borrar

Estos comandos son de lectura. Sirven para confirmar que se esta apuntando al proyecto e instancia correctos.

```powershell
& $Gcloud config set project $ProjectId

& $Gcloud sql instances describe $InstanceName `
  --project=$ProjectId `
  --format="table(name,state,region,databaseVersion,settings.tier,settings.deletionProtectionEnabled)"

& $Gcloud sql databases list `
  --instance=$InstanceName `
  --project=$ProjectId `
  --format="table(name,charset,collation)"

& $Gcloud sql users list `
  --instance=$InstanceName `
  --project=$ProjectId `
  --format="table(name,type)"

& $Gcloud projects get-iam-policy $ProjectId `
  --flatten="bindings[].members" `
  --filter="bindings.role:roles/cloudsql.instanceUser OR bindings.role:roles/cloudsql.client" `
  --format="table(bindings.role,bindings.members)"
```

### Paso RR3 - Detener consumidores antes de borrar

Antes de borrar bases o instancia, detener servicios Cloud Run o procesos locales que sigan conectados a Cloud SQL.

Consulta de servicios Cloud Run que pueden estar usando la instancia:

```powershell
& $Gcloud run services list `
  --project=$ProjectId `
  --region=us-central1 `
  --format="table(metadata.name,status.url)"
```

Si se necesita dejar un servicio sin trafico o apagarlo operativamente, hacerlo desde Cloud Run antes de continuar. No borrar Cloud SQL mientras backends o migraciones sigan apuntando a `venta-pasajes-dev-sql`.

### Paso RR4 - Limpiar Cloud SQL Auth Proxy local si existe

Los archivos de Dia 14 no crean reglas permanentes de Cloud SQL Auth Proxy. Aun asi, si durante pruebas se levanto un proxy local o contenedor, limpiarlo antes de borrar la instancia.

Contenedor usado por scripts posteriores de grants, si existiera:

```powershell
docker ps -a --filter "name=venta-pasajes-cloudsql-proxy-dev" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

docker rm -f venta-pasajes-cloudsql-proxy-dev
```

Red Docker usada por scripts posteriores de grants, si existiera:

```powershell
docker network ls --filter "name=venta-pasajes-cloudsql-grants"

docker network rm venta-pasajes-cloudsql-grants
```

Proceso local de proxy, si alguien lo ejecuto manualmente:

```powershell
Get-CimInstance Win32_Process |
  Where-Object { $_.CommandLine -match "cloud-sql-proxy|cloud_sql_proxy|venta-pasajes-dev-sql" } |
  Select-Object ProcessId,CommandLine |
  Format-List

Stop-Process -Id <process-id> -Force
```

Reglas locales de firewall de Windows, solo si alguien las creo manualmente para el proxy:

```powershell
Get-NetFirewallRule |
  Where-Object { $_.DisplayName -match "Cloud SQL|cloud-sql-proxy|venta-pasajes" } |
  Select-Object DisplayName,Enabled,Direction,Action |
  Format-Table -AutoSize

Remove-NetFirewallRule -DisplayName "<nombre-exacto-de-la-regla>"
```

### Paso RR5 - Revocar IAM aplicado para acceso Cloud SQL

`bootstrap-cloudsql-dev.ps1` aplica `roles/cloudsql.instanceUser` a los runtime service accounts. Esa es la revocacion estricta del Dia 14.

```powershell
$Config = Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json

foreach ($User in @($Config.iam_database_users)) {
  $Member = "serviceAccount:$($User.service_account)"

  & $Gcloud projects remove-iam-policy-binding $ProjectId `
    --member=$Member `
    --role="roles/cloudsql.instanceUser" `
    --quiet
}
```

Revocacion opcional de `roles/cloudsql.client`:

```powershell
# ATENCION:
# roles/cloudsql.client viene de la matriz IAM del Dia 13.
# Revocarlo puede romper servicios que aun necesiten conectarse a Cloud SQL.

foreach ($User in @($Config.iam_database_users)) {
  $Member = "serviceAccount:$($User.service_account)"

  & $Gcloud projects remove-iam-policy-binding $ProjectId `
    --member=$Member `
    --role="roles/cloudsql.client" `
    --quiet
}
```

### Paso RR6 - Eliminar usuarios IAM de base de datos

Estos son los usuarios tipo `cloud_iam_service_account` creados dentro de Cloud SQL.

```powershell
$Config = Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json

foreach ($User in @($Config.iam_database_users)) {
  $CloudSqlUser = $User.cloud_sql_username

  & $Gcloud sql users delete $CloudSqlUser `
    --instance=$InstanceName `
    --project=$ProjectId `
    --quiet
}
```

Usuarios esperados a eliminar:

```text
identity-service-run@project-fbb34cd7-0b82-43e1-867.iam
dispatch-service-run@project-fbb34cd7-0b82-43e1-867.iam
ticketing-service-run@project-fbb34cd7-0b82-43e1-867.iam
document-service-run@project-fbb34cd7-0b82-43e1-867.iam
reporting-service-run@project-fbb34cd7-0b82-43e1-867.iam
audit-service-run@project-fbb34cd7-0b82-43e1-867.iam
```

### Paso RR7 - Eliminar bases de datos creadas

Usar este paso si se quiere reversa parcial, dejando viva la instancia pero eliminando las bases por servicio.

```powershell
$Config = Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json

foreach ($Database in @($Config.databases)) {
  & $Gcloud sql databases delete $Database.name `
    --instance=$InstanceName `
    --project=$ProjectId `
    --quiet
}
```

Bases esperadas a eliminar:

```text
identity_db
dispatch_db
ticketing_db
documents_db
reporting_db
audit_db
```

Nota: si se elimina la instancia completa en el siguiente paso, Google Cloud elimina tambien las bases y usuarios contenidos en ella. Aun asi, se documenta la eliminacion individual para reversas parciales.

### Paso RR8 - Desactivar deletion protection y eliminar instancia Cloud SQL

La instancia fue creada con deletion protection habilitado. Para eliminarla primero hay que desactivar esa proteccion.

```powershell
& $Gcloud sql instances patch $InstanceName `
  --project=$ProjectId `
  --no-deletion-protection `
  --quiet
```

Eliminar la instancia:

```powershell
& $Gcloud sql instances delete $InstanceName `
  --project=$ProjectId `
  --quiet
```

Esto elimina:

- Instancia `venta-pasajes-dev-sql`.
- Bases dentro de la instancia.
- Usuarios Cloud SQL dentro de la instancia.
- Configuracion de flags de esa instancia, incluido `cloudsql.iam_authentication=on`.

### Paso RR9 - Validar reversa

La instancia ya no debe existir:

```powershell
& $Gcloud sql instances describe $InstanceName `
  --project=$ProjectId `
  --format="value(name)"
```

Resultado esperado:

```text
ERROR: instance does not exist
```

Las asignaciones IAM del Dia 14 ya no deben aparecer:

```powershell
& $Gcloud projects get-iam-policy $ProjectId `
  --flatten="bindings[].members" `
  --filter="bindings.role:roles/cloudsql.instanceUser" `
  --format="table(bindings.role,bindings.members)"
```

Resultado esperado para las service accounts de este dia:

```text
sin miembros identity/dispatch/ticketing/document/reporting/audit con roles/cloudsql.instanceUser
```

### Paso RR10 - Registrar la reversa

```powershell
Add-Content -LiteralPath .\vitacora.md -Value "`nReversa real Dia 14 Cloud SQL dev - <fecha>: instancia, bases, usuarios IAM DB y bindings Cloud SQL revertidos."
```
