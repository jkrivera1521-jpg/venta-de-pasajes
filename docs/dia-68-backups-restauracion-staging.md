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

Se creo un verificador de preparacion:

```text
C:\VENTA-DE-PASAJES\scripts\verify-backup-restore-readiness.ps1
```

El verificador no crea recursos, no restaura bases y no borra nada. Solo revisa:

- Si existe la instancia Cloud SQL del ambiente.
- Si los backups Cloud SQL estan habilitados.
- Si existen backups exitosos.
- Si el nombre de instancia temporal de restauracion esta libre.
- Si existe el bucket documental del ambiente.
- Si el ambiente esta listo para ejecutar una prueba real de restauracion.

Resultado contra `staging`:

```text
Cloud SQL source instance exists: False
Cloud SQL backup enabled:         False
Cloud SQL successful backups:     0
Cloud SQL restore target free:    True
Storage document bucket exists:   False
Overall ready for restore test:   False
```

Bloqueos reales:

```text
Cloud SQL source instance does not exist: venta-pasajes-staging-sql
Document bucket does not exist: gs://venta-pasajes-staging-documents
```

Resultado contra `dev` como control tecnico:

```text
Cloud SQL source instance exists: True
Cloud SQL backup enabled:         True
Cloud SQL successful backups:     7
Cloud SQL restore target free:    True
Storage document bucket exists:   False
Overall ready for restore test:   False
```

El backup Cloud SQL `dev` mas reciente observado:

```text
Backup ID: 1790064000000
Fin:       2026-09-22T10:12:08.727Z
RPO aproximado al momento de validacion: 10.5 horas
```

La prueba real de restauracion **no se ejecuto** porque el ambiente `staging` todavia no existe en Google Cloud y tampoco existe su bucket documental.

## Reversa primero

Esta practica solo agrega documentacion y un verificador local de solo lectura. No hay reversa de infraestructura porque no se crearon, restauraron ni eliminaron recursos cloud.

Para retirar los cambios locales de este dia:

```powershell
cd C:\VENTA-DE-PASAJES

git restore -- README.md infra\README.md vitacora.md

Remove-Item -LiteralPath .\scripts\verify-backup-restore-readiness.ps1 -Force
Remove-Item -LiteralPath .\docs\dia-68-backups-restauracion-staging.md -Force
```

Para borrar los resultados JSON locales:

```powershell
cd C:\VENTA-DE-PASAJES

Remove-Item -LiteralPath .\logs\backup-restore\verify-backup-restore-readiness-staging.json -Force
Remove-Item -LiteralPath .\logs\backup-restore\verify-backup-restore-readiness-dev.json -Force
```

Si en el futuro se crea una instancia temporal de restauracion, la reversa de esa prueba seria:

```powershell
gcloud sql instances delete venta-pasajes-staging-restore-test `
  --project project-fbb34cd7-0b82-43e1-867 `
  --quiet
```

Nunca ejecutar ese comando contra la instancia fuente `venta-pasajes-staging-sql`.

## Guia manual desde cero

### Paso 1 - Ir a la raiz del proyecto

```powershell
cd C:\VENTA-DE-PASAJES
```

### Paso 2 - Validar que el script existe

```powershell
Test-Path -LiteralPath .\scripts\verify-backup-restore-readiness.ps1
```

Debe devolver:

```text
True
```

### Paso 3 - Verificar staging

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-backup-restore-readiness.ps1 `
  -Environment staging
```

Resultado actual:

```text
ready for restore test: False
```

Bloqueos actuales:

```text
Cloud SQL source instance does not exist: venta-pasajes-staging-sql
Document bucket does not exist: gs://venta-pasajes-staging-documents
```

El resultado se guarda en:

```text
C:\VENTA-DE-PASAJES\logs\backup-restore\verify-backup-restore-readiness-staging.json
```

### Paso 4 - Verificar dev como control tecnico

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-backup-restore-readiness.ps1 `
  -Environment dev
```

Resultado actual:

```text
Cloud SQL dev tiene backups habilitados y 7 backups exitosos.
El bucket gs://venta-pasajes-dev-documents no existe.
```

El resultado se guarda en:

```text
C:\VENTA-DE-PASAJES\logs\backup-restore\verify-backup-restore-readiness-dev.json
```

### Paso 5 - Revisar el resumen JSON

```powershell
$Result = Get-Content -LiteralPath .\logs\backup-restore\verify-backup-restore-readiness-staging.json -Raw | ConvertFrom-Json
$Result.readiness
```

### Paso 6 - Ejecutar restauracion real solo cuando staging exista

No ejecutar este paso hasta que el verificador devuelva:

```text
ready_for_restore_test: True
```

Cuando staging exista y tenga al menos un backup exitoso:

```powershell
$Result = Get-Content -LiteralPath .\logs\backup-restore\verify-backup-restore-readiness-staging.json -Raw | ConvertFrom-Json
$BackupId = $Result.cloud_sql.latest_successful_backup_id

gcloud sql backups restore $BackupId `
  --backup-instance=venta-pasajes-staging-sql `
  --restore-instance=venta-pasajes-staging-restore-test `
  --project=project-fbb34cd7-0b82-43e1-867 `
  --region=us-central1 `
  --database-version=POSTGRES_16 `
  --tier=db-f1-micro `
  --storage-size=10 `
  --storage-type=PD_SSD `
  --availability-type=zonal `
  --no-deletion-protection `
  --quiet
```

Validar la instancia restaurada:

```powershell
gcloud sql instances describe venta-pasajes-staging-restore-test `
  --project project-fbb34cd7-0b82-43e1-867 `
  --format="table(name,state,databaseVersion,region)"

gcloud sql databases list `
  --instance venta-pasajes-staging-restore-test `
  --project project-fbb34cd7-0b82-43e1-867
```

### Paso 7 - Probar restauracion de Storage cuando exista bucket staging

No ejecutar hasta que exista:

```text
gs://venta-pasajes-staging-documents
```

Crear bucket temporal:

```powershell
gcloud storage buckets create gs://venta-pasajes-staging-documents-restore-test `
  --project project-fbb34cd7-0b82-43e1-867 `
  --location us-central1 `
  --uniform-bucket-level-access `
  --public-access-prevention
```

Copiar objetos para prueba:

```powershell
gcloud storage cp -r `
  gs://venta-pasajes-staging-documents/** `
  gs://venta-pasajes-staging-documents-restore-test/
```

Validar objetos restaurados:

```powershell
gcloud storage ls gs://venta-pasajes-staging-documents-restore-test --recursive
```

Eliminar bucket temporal despues de la prueba:

```powershell
gcloud storage rm -r gs://venta-pasajes-staging-documents-restore-test/**

gcloud storage buckets delete gs://venta-pasajes-staging-documents-restore-test `
  --quiet
```

## RTO y RPO inicial

Definicion operativa:

```text
RPO: cuanto dato se podria perder. Para backups diarios, el RPO maximo esperado es cercano a 24 horas.
RTO: cuanto tarda volver a levantar una copia util del sistema despues de restaurar.
```

Estado actual:

```text
Staging: no medible todavia porque no existe instancia ni bucket.
Dev Cloud SQL: backups automaticos activos; ultimo backup exitoso observado el 2026-09-22T10:12:08.727Z.
Dev Storage documental: bucket esperado no existe, por tanto la restauracion documental no es medible todavia.
```

## Comandos ejecutados

```powershell
gcloud sql instances list --project project-fbb34cd7-0b82-43e1-867 --format="table(name,region,state,databaseVersion,settings.backupConfiguration.enabled)"

gcloud sql backups list --instance venta-pasajes-dev-sql --project project-fbb34cd7-0b82-43e1-867 --format="table(id,status,type,startTime,endTime)" --limit=10

gcloud storage buckets list --project project-fbb34cd7-0b82-43e1-867 --format="table(name,location,storageClass,uniformBucketLevelAccess.enabled)"

gcloud sql instances describe venta-pasajes-staging-sql --project project-fbb34cd7-0b82-43e1-867 --format=json

gcloud storage buckets describe gs://venta-pasajes-staging-documents --project project-fbb34cd7-0b82-43e1-867 --format=json

powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-backup-restore-readiness.ps1 -Environment staging

powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-backup-restore-readiness.ps1 -Environment dev
```

## Cierre del dia

El procedimiento de backup/restore queda preparado y verificable.

La ejecucion real de restauracion staging queda bloqueada por prerequisitos faltantes:

```text
1. Crear Cloud SQL staging: venta-pasajes-staging-sql.
2. Crear bucket documental staging: gs://venta-pasajes-staging-documents.
3. Generar al menos un backup exitoso en staging.
4. Reejecutar verify-backup-restore-readiness.ps1 -Environment staging.
5. Ejecutar restauracion temporal y medir RTO real.
```
