# Dia 68 - Backups y restauracion staging

## Objetivo

Este dia se alinea con el plan maestro de `C:\VENTA-DE-PASAJES\tareas.md`, donde el Dia 68 corresponde a **Backups y restauracion staging**.

Objetivo del plan:

- Validar backups Cloud SQL.
- Ejecutar restauracion en instancia temporal.
- Probar restauracion de Storage.
- Documentar RTO y RPO inicial.
- Validar permisos de respaldo.

## Resultado real de esta ejecucion

El bloqueo inicial fue solventado: el ambiente staging y su bucket documental ya existen en Google Cloud, y la prueba real de restauracion fue ejecutada.

Acciones reales ejecutadas:

- Se creo la configuracion staging en `C:\VENTA-DE-PASAJES\infra\gcloud\cloudsql-staging.json`.
- Se creo Cloud SQL staging `venta-pasajes-staging-sql`.
- Se crearon las bases `identity_db`, `dispatch_db`, `ticketing_db`, `documents_db`, `reporting_db` y `audit_db`.
- Se crearon usuarios IAM de base para los seis microservicios.
- Se creo el bucket documental `gs://venta-pasajes-staging-documents`.
- Se otorgo permiso `roles/storage.objectAdmin` al runtime de `document-service`.
- Se subio un marcador documental a `gs://venta-pasajes-staging-documents/_restore-tests/dia68-marker.txt`.
- Se creo un backup on demand de Cloud SQL staging.
- Se restauro ese backup en la instancia temporal `venta-pasajes-staging-restore-test`.
- Se valido que la instancia restaurada tenia las bases y usuarios esperados.
- Se copio el marcador documental a un bucket temporal de restauracion.
- Se eliminaron los recursos temporales de prueba.

## Evidencia

Cloud SQL staging:

```text
Instancia fuente: venta-pasajes-staging-sql
Estado final: RUNNABLE
Version: POSTGRES_16
Tier: db-f1-micro
Backups: habilitados
Backup start time: 09:00
Backups retenidos: 7
Deletion protection: habilitado
```

Backup usado para la prueba:

```text
Backup ID: 1790111529323
Tipo: ON_DEMAND
Estado: SUCCESSFUL
Inicio: 2026-09-22T21:12:09.329Z
Fin: 2026-09-22T21:13:20.354Z
Descripcion: dia68-staging-restore-test
```

Restauracion Cloud SQL:

```text
Instancia temporal: venta-pasajes-staging-restore-test
Resultado: restauracion exitosa
RTO medido: 1047.06 segundos
RTO medido: 17.45 minutos
Bases restauradas: postgres, identity_db, dispatch_db, ticketing_db, documents_db, reporting_db, audit_db
Usuarios IAM restaurados: 6
Estado final de la instancia temporal: eliminada
```

Restauracion Storage:

```text
Bucket fuente: gs://venta-pasajes-staging-documents
Objeto fuente: gs://venta-pasajes-staging-documents/_restore-tests/dia68-marker.txt
Bucket temporal: gs://venta-pasajes-staging-documents-restore-test
Objeto restaurado: gs://venta-pasajes-staging-documents-restore-test/_restore-tests/dia68-marker.txt
Estado final del bucket temporal: eliminado
```

Archivos de evidencia local:

```text
C:\VENTA-DE-PASAJES\logs\backup-restore\dia68-restore-evidence.json
C:\VENTA-DE-PASAJES\logs\backup-restore\verify-backup-restore-readiness-staging.json
```

Resultado final del verificador:

```text
Cloud SQL source instance exists: True
Cloud SQL backup enabled:         True
Cloud SQL successful backups:     1 o mas
Cloud SQL restore target free:    True
Storage document bucket exists:   True
Overall ready for restore test:   True
```

## Reversa primero

### Reversa de recursos temporales de prueba

Estos recursos ya fueron eliminados al cierre de la practica. Si se vuelven a crear, se eliminan asi:

```powershell
cd C:\VENTA-DE-PASAJES

gcloud storage rm --recursive gs://venta-pasajes-staging-documents-restore-test `
  --project project-fbb34cd7-0b82-43e1-867 `
  --quiet

gcloud sql instances delete venta-pasajes-staging-restore-test `
  --project project-fbb34cd7-0b82-43e1-867 `
  --quiet
```

### Reversa del marcador documental

Esto elimina solo el archivo de prueba, no el bucket staging:

```powershell
cd C:\VENTA-DE-PASAJES

gcloud storage rm gs://venta-pasajes-staging-documents/_restore-tests/dia68-marker.txt `
  --project project-fbb34cd7-0b82-43e1-867 `
  --quiet
```

### Reversa completa del ambiente staging creado en este dia

Ejecutar solo si se decide destruir staging completo. Este bloque elimina infraestructura real y puede afectar futuras practicas:

```powershell
cd C:\VENTA-DE-PASAJES

gcloud storage rm --recursive gs://venta-pasajes-staging-documents `
  --project project-fbb34cd7-0b82-43e1-867 `
  --quiet

gcloud sql instances patch venta-pasajes-staging-sql `
  --project project-fbb34cd7-0b82-43e1-867 `
  --no-deletion-protection `
  --quiet

gcloud sql instances delete venta-pasajes-staging-sql `
  --project project-fbb34cd7-0b82-43e1-867 `
  --quiet
```

### Reversa de cambios locales del repositorio

```powershell
cd C:\VENTA-DE-PASAJES

git restore -- README.md infra\README.md vitacora.md scripts\verify-backup-restore-readiness.ps1

Remove-Item -LiteralPath .\infra\gcloud\cloudsql-staging.json -Force
Remove-Item -LiteralPath .\docs\dia-68-backups-restauracion-staging.md -Force
Remove-Item -LiteralPath .\logs\backup-restore\verify-backup-restore-readiness-staging.json -Force
Remove-Item -LiteralPath .\logs\backup-restore\dia68-restore-evidence.json -Force
```

## Guia manual desde cero

### Paso 1 - Ir a la raiz del proyecto

```powershell
cd C:\VENTA-DE-PASAJES
```

### Paso 2 - Validar archivos requeridos

```powershell
Test-Path -LiteralPath .\infra\gcloud\cloudsql-staging.json
Test-Path -LiteralPath .\infra\gcloud\bootstrap-cloudsql-dev.ps1
Test-Path -LiteralPath .\scripts\verify-backup-restore-readiness.ps1
```

Los tres comandos deben devolver:

```text
True
```

### Paso 3 - Crear Cloud SQL staging

El script se llama `bootstrap-cloudsql-dev.ps1` por origen historico, pero aqui se usa con configuracion staging:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\infra\gcloud\bootstrap-cloudsql-dev.ps1 `
  -ConfigPath .\infra\gcloud\cloudsql-staging.json `
  -ProjectId project-fbb34cd7-0b82-43e1-867
```

Validar:

```powershell
gcloud sql instances describe venta-pasajes-staging-sql `
  --project project-fbb34cd7-0b82-43e1-867 `
  --format="table(name,state,databaseVersion,region,settings.tier)"

gcloud sql databases list `
  --instance venta-pasajes-staging-sql `
  --project project-fbb34cd7-0b82-43e1-867
```

### Paso 4 - Crear bucket documental staging

```powershell
gcloud storage buckets create gs://venta-pasajes-staging-documents `
  --project project-fbb34cd7-0b82-43e1-867 `
  --location us-central1 `
  --uniform-bucket-level-access `
  --public-access-prevention `
  --default-storage-class STANDARD
```

Dar permisos al runtime de `document-service`:

```powershell
gcloud storage buckets add-iam-policy-binding gs://venta-pasajes-staging-documents `
  --project project-fbb34cd7-0b82-43e1-867 `
  --member serviceAccount:document-service-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com `
  --role roles/storage.objectAdmin
```

### Paso 5 - Crear marcador documental de prueba

```powershell
New-Item -ItemType Directory -Force -Path .\logs\backup-restore | Out-Null

"dia68 storage restore marker $(Get-Date -Format o)" |
  Set-Content -LiteralPath .\logs\backup-restore\dia68-storage-restore-marker.txt -Encoding ASCII

gcloud storage cp `
  .\logs\backup-restore\dia68-storage-restore-marker.txt `
  gs://venta-pasajes-staging-documents/_restore-tests/dia68-marker.txt `
  --project project-fbb34cd7-0b82-43e1-867

gcloud storage ls gs://venta-pasajes-staging-documents/_restore-tests/ `
  --project project-fbb34cd7-0b82-43e1-867
```

### Paso 6 - Crear backup on demand

```powershell
gcloud sql backups create `
  --instance venta-pasajes-staging-sql `
  --project project-fbb34cd7-0b82-43e1-867 `
  --description dia68-staging-restore-test
```

Validar el backup:

```powershell
gcloud sql backups list `
  --instance venta-pasajes-staging-sql `
  --project project-fbb34cd7-0b82-43e1-867 `
  --format="table(id,status,type,startTime,endTime,description)" `
  --limit=5
```

### Paso 7 - Verificar preparacion de restore

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-backup-restore-readiness.ps1 `
  -Environment staging
```

Debe devolver:

```text
Overall ready for restore test: True
```

### Paso 8 - Crear instancia temporal de restore

Obtener el ultimo backup exitoso desde el JSON del verificador:

```powershell
$Result = Get-Content -LiteralPath .\logs\backup-restore\verify-backup-restore-readiness-staging.json -Raw | ConvertFrom-Json
$BackupId = $Result.cloud_sql.latest_successful_backup_id
$BackupId
```

Crear la instancia temporal:

```powershell
gcloud sql instances create venta-pasajes-staging-restore-test `
  --project=project-fbb34cd7-0b82-43e1-867 `
  --database-version=POSTGRES_16 `
  --tier=db-f1-micro `
  --region=us-central1 `
  --availability-type=ZONAL `
  --storage-type=SSD `
  --storage-size=10 `
  --no-backup `
  --no-deletion-protection `
  --storage-auto-increase `
  --database-flags=cloudsql.iam_authentication=on
```

### Paso 9 - Restaurar el backup Cloud SQL

```powershell
$RestoreStart = Get-Date

gcloud sql backups restore $BackupId `
  --backup-instance=venta-pasajes-staging-sql `
  --restore-instance=venta-pasajes-staging-restore-test `
  --project=project-fbb34cd7-0b82-43e1-867 `
  --quiet

$RestoreEnd = Get-Date
$RestoreDuration = $RestoreEnd - $RestoreStart
$RestoreDuration.TotalSeconds
$RestoreDuration.TotalMinutes
```

Validar instancia restaurada:

```powershell
gcloud sql databases list `
  --instance venta-pasajes-staging-restore-test `
  --project project-fbb34cd7-0b82-43e1-867

gcloud sql users list `
  --instance venta-pasajes-staging-restore-test `
  --project project-fbb34cd7-0b82-43e1-867
```

### Paso 10 - Probar restauracion de Storage

```powershell
gcloud storage buckets create gs://venta-pasajes-staging-documents-restore-test `
  --project project-fbb34cd7-0b82-43e1-867 `
  --location us-central1 `
  --uniform-bucket-level-access `
  --public-access-prevention `
  --default-storage-class STANDARD

gcloud storage cp -r `
  gs://venta-pasajes-staging-documents/_restore-tests `
  gs://venta-pasajes-staging-documents-restore-test/ `
  --project project-fbb34cd7-0b82-43e1-867

gcloud storage ls gs://venta-pasajes-staging-documents-restore-test/_restore-tests/ `
  --project project-fbb34cd7-0b82-43e1-867
```

Debe mostrarse:

```text
gs://venta-pasajes-staging-documents-restore-test/_restore-tests/dia68-marker.txt
```

### Paso 11 - Guardar evidencia local

```powershell
$Evidence = [ordered]@{
  generated_at = (Get-Date).ToString("o")
  cloud_sql_source = "venta-pasajes-staging-sql"
  cloud_sql_backup_id = $BackupId
  cloud_sql_restore_instance = "venta-pasajes-staging-restore-test"
  cloud_sql_restore_duration_seconds = [Math]::Round($RestoreDuration.TotalSeconds, 2)
  cloud_sql_restore_duration_minutes = [Math]::Round($RestoreDuration.TotalMinutes, 2)
  storage_source_bucket = "gs://venta-pasajes-staging-documents"
  storage_restore_bucket = "gs://venta-pasajes-staging-documents-restore-test"
  storage_restored_object = "gs://venta-pasajes-staging-documents-restore-test/_restore-tests/dia68-marker.txt"
}

$Evidence |
  ConvertTo-Json -Depth 8 |
  Set-Content -LiteralPath .\logs\backup-restore\dia68-restore-evidence.json -Encoding UTF8
```

### Paso 12 - Eliminar recursos temporales

No dejar activos los recursos temporales de restore:

```powershell
gcloud storage rm --recursive gs://venta-pasajes-staging-documents-restore-test `
  --project project-fbb34cd7-0b82-43e1-867 `
  --quiet

gcloud sql instances delete venta-pasajes-staging-restore-test `
  --project project-fbb34cd7-0b82-43e1-867 `
  --quiet
```

### Paso 13 - Verificacion final

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-backup-restore-readiness.ps1 `
  -Environment staging
```

Resultado esperado:

```text
Cloud SQL source instance exists: True
Cloud SQL backup enabled:         True
Cloud SQL successful backups:     1 o mas
Cloud SQL restore target free:    True
Storage document bucket exists:   True
Overall ready for restore test:   True
```

## RTO y RPO inicial

RTO:

```text
Tiempo medido de restauracion Cloud SQL a instancia temporal: 17.45 minutos.
```

RPO:

```text
Backup on demand usado: 1790111529323.
Fin del backup: 2026-09-22T21:13:20.354Z.
Para este ensayo, el punto de recuperacion fue el backup on demand.
Con backups automaticos diarios, el RPO operativo maximo esperado se acerca a 24 horas si no se agregan backups on demand o PITR.
```

Storage:

```text
La prueba documental valido copia de objeto desde bucket staging hacia bucket temporal de restauracion.
Este ensayo valida la ruta basica, no reemplaza una politica formal de versionado, retencion o DR multi-region.
```

## Comandos ejecutados

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\infra\gcloud\bootstrap-cloudsql-dev.ps1 -ConfigPath .\infra\gcloud\cloudsql-staging.json -ProjectId project-fbb34cd7-0b82-43e1-867

gcloud storage buckets create gs://venta-pasajes-staging-documents --project project-fbb34cd7-0b82-43e1-867 --location us-central1 --uniform-bucket-level-access --public-access-prevention --default-storage-class STANDARD

gcloud storage buckets add-iam-policy-binding gs://venta-pasajes-staging-documents --project project-fbb34cd7-0b82-43e1-867 --member serviceAccount:document-service-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com --role roles/storage.objectAdmin

gcloud storage cp .\logs\backup-restore\dia68-storage-restore-marker.txt gs://venta-pasajes-staging-documents/_restore-tests/dia68-marker.txt --project project-fbb34cd7-0b82-43e1-867

gcloud sql backups create --instance venta-pasajes-staging-sql --project project-fbb34cd7-0b82-43e1-867 --description dia68-staging-restore-test

powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-backup-restore-readiness.ps1 -Environment staging

gcloud sql instances create venta-pasajes-staging-restore-test --project=project-fbb34cd7-0b82-43e1-867 --database-version=POSTGRES_16 --tier=db-f1-micro --region=us-central1 --availability-type=ZONAL --storage-type=SSD --storage-size=10 --no-backup --no-deletion-protection --storage-auto-increase --database-flags=cloudsql.iam_authentication=on

gcloud sql backups restore 1790111529323 --backup-instance=venta-pasajes-staging-sql --restore-instance=venta-pasajes-staging-restore-test --project=project-fbb34cd7-0b82-43e1-867 --quiet

gcloud sql databases list --instance venta-pasajes-staging-restore-test --project project-fbb34cd7-0b82-43e1-867

gcloud sql users list --instance venta-pasajes-staging-restore-test --project project-fbb34cd7-0b82-43e1-867

gcloud storage buckets create gs://venta-pasajes-staging-documents-restore-test --project project-fbb34cd7-0b82-43e1-867 --location us-central1 --uniform-bucket-level-access --public-access-prevention --default-storage-class STANDARD

gcloud storage cp -r gs://venta-pasajes-staging-documents/_restore-tests gs://venta-pasajes-staging-documents-restore-test/ --project project-fbb34cd7-0b82-43e1-867

gcloud storage ls gs://venta-pasajes-staging-documents-restore-test/_restore-tests/ --project project-fbb34cd7-0b82-43e1-867

gcloud storage rm --recursive gs://venta-pasajes-staging-documents-restore-test --project project-fbb34cd7-0b82-43e1-867 --quiet

gcloud sql instances delete venta-pasajes-staging-restore-test --project project-fbb34cd7-0b82-43e1-867 --quiet

powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-backup-restore-readiness.ps1 -Environment staging
```

## Cierre del dia

Dia 68 queda ejecutado con prueba real.

Estado final:

```text
Staging Cloud SQL existe y esta RUNNABLE.
Bucket documental staging existe.
Backup on demand existe y fue restaurado.
RTO inicial documentado: 17.45 minutos.
Prueba de Storage ejecutada y validada.
Recursos temporales eliminados.
Verificador final listo: True.
```

Nota operativa:

```text
La instancia venta-pasajes-staging-sql y el bucket gs://venta-pasajes-staging-documents son recursos reales de Google Cloud y pueden generar costo.
```
