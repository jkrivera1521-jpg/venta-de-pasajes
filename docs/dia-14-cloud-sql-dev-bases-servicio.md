# Dia 14 - Cloud SQL dev y bases por servicio

Fecha: 2026-09-02

## Objetivo

Crear la instancia Cloud SQL PostgreSQL de desarrollo, separar las bases por dominio y crear usuarios de base separados por microservicio.

## Resultado ejecutivo

Dia 14 completado y verificado en Google Cloud dev.

Se creo la instancia `venta-pasajes-dev-sql`, se crearon 6 bases de datos por dominio y se crearon 6 usuarios IAM de base de datos, uno por service account runtime.

Verificacion final:

```json
{"project_id":"project-fbb34cd7-0b82-43e1-867","instance_name":"venta-pasajes-dev-sql","connection_name":"project-fbb34cd7-0b82-43e1-867:us-central1:venta-pasajes-dev-sql","state":"RUNNABLE","database_version":"POSTGRES_16","region":"us-central1","tier":"db-f1-micro","edition":"ENTERPRISE","availability_type":"ZONAL","deletion_protection":true,"backup_enabled":true,"backup_start_time":"08:00","expected_databases":6,"missing_databases":[],"expected_iam_database_users":6,"missing_iam_database_users":[],"missing_database_flags":[],"missing_instance_user_bindings":[],"privilege_strategy":"deferred_to_service_migrations","ready":true}
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

`roles/cloudsql.client` permite conectar mediante conectores/proxy de Cloud SQL. `roles/cloudsql.instanceUser` permite login con autenticacion IAM de base de datos.

## Privilegios de esquema

Estado actual:

```text
schema_privileges=deferred_to_service_migrations
```

Los usuarios IAM ya existen en Cloud SQL, pero los privilegios finos sobre esquemas/tablas se aplicaran cuando las migraciones por servicio sean ejecutables.

Decision:

- No otorgar `cloudsqlsuperuser` a los servicios.
- No usar un unico usuario compartido.
- Aplicar grants por base/esquema cuando cada servicio tenga migraciones versionadas.
- Mantener trazabilidad por usuario IAM de base.

## Scripts creados

| Archivo | Proposito |
| --- | --- |
| `C:\VENTA-DE-PASAJES\infra\gcloud\cloudsql-dev.json` | Configuracion declarativa de Cloud SQL dev. |
| `C:\VENTA-DE-PASAJES\infra\gcloud\bootstrap-cloudsql-dev.ps1` | Crea instancia, bases, usuarios IAM y bindings requeridos. |
| `C:\VENTA-DE-PASAJES\infra\gcloud\verify-cloudsql-dev.ps1` | Verifica instancia, bases, usuarios IAM, flags y bindings. |

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

> Estandarizacion documental agregada el 2026-09-16 para que este dia tambien tenga una ruta segura de limpieza antes de repetir la practica.

Este dia pertenece a la etapa inicial del proyecto. Antes de ejecutar una reversa, revisar si el archivo contiene recursos externos reales, como Google Cloud, Docker, bases de datos o imagenes publicadas. No ejecutar comandos destructivos si no estas seguro de que el recurso no esta siendo usado.

### Paso R1 - Ubicarse en el workspace

```powershell
cd C:\VENTA-DE-PASAJES
```

### Paso R2 - Revisar recursos o archivos mencionados

```powershell
Select-String -Path .\docs\dia-14-cloud-sql-dev-bases-servicio.md -Pattern "C:\\VENTA-DE-PASAJES|docker|gcloud|mvn|npm|Remove-Item|delete|rm|Cloud SQL|Artifact Registry|Secret Manager" -Context 0,2
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
Select-String -Path .\docs\dia-14-cloud-sql-dev-bases-servicio.md -Pattern "Archivo|Archivos|C:\\VENTA-DE-PASAJES" -Context 0,4
```

Si aun asi necesitas retirar solo este documento de la practica, hacer primero una copia:

```powershell
New-Item -ItemType Directory -Force -Path .\backups | Out-Null
Copy-Item -LiteralPath .\docs\dia-14-cloud-sql-dev-bases-servicio.md -Destination .\backups\dia-14-cloud-sql-dev-bases-servicio-manual-backup.md -Force
```

Despues de respaldar, se podria eliminar manualmente el documento con:

```powershell
Remove-Item -LiteralPath .\docs\dia-14-cloud-sql-dev-bases-servicio.md -Force
```

## Guia manual desde cero

> Estandarizacion documental agregada el 2026-09-16. Esta guia permite repetir el dia sin depender de Codex, usando el documento como fuente de verdad.

### Paso 1 - Ubicarse en el proyecto

```powershell
cd C:\VENTA-DE-PASAJES
```

### Paso 2 - Leer el alcance del dia en el backlog

```powershell
Select-String -Path .\tareas.md -Pattern "Dia 14|Dia 14" -Context 0,40
```

### Paso 3 - Leer la documentacion del dia

```powershell
Get-Content -LiteralPath .\docs\dia-14-cloud-sql-dev-bases-servicio.md
```

### Paso 4 - Verificar archivos y rutas mencionadas

```powershell
Select-String -Path .\docs\dia-14-cloud-sql-dev-bases-servicio.md -Pattern "C:\\VENTA-DE-PASAJES" -AllMatches
```

Para cada ruta importante que aparezca en el documento:

```powershell
Test-Path -LiteralPath "<ruta-copiada-del-documento>"
```

### Paso 5 - Ejecutar comandos documentados

Buscar bloques de comandos del documento y ejecutarlos en orden, validando el resultado de cada bloque antes de continuar:

```powershell
Select-String -Path .\docs\dia-14-cloud-sql-dev-bases-servicio.md -Pattern "```powershell|```text|mvn |npm |docker |gcloud |curl.exe|powershell " -Context 0,6
```

### Paso 6 - Registrar la repeticion en bitacora

```powershell
Add-Content -LiteralPath .\vitacora.md -Value "`nReplica manual Dia 14 - <fecha>: comandos ejecutados y resultado."
```

### Paso 7 - Validar criterio de avance

Revisar la seccion de criterio de avance, resultado, estado final o pendientes del documento:

```powershell
Select-String -Path .\docs\dia-14-cloud-sql-dev-bases-servicio.md -Pattern "Criterio de avance|Resultado|Estado final|Pendiente|Pendientes" -Context 0,8
```
