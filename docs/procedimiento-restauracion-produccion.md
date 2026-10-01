# Procedimiento de restauracion produccion

## Objetivo

Recuperar una copia controlada de produccion en recursos temporales sin modificar la instancia productiva original.

## Precondiciones

- Cloud SQL produccion debe existir y estar RUNNABLE.
- Backups Cloud SQL produccion deben estar habilitados.
- Debe existir al menos un backup exitoso.
- El bucket documental productivo debe existir.
- El nombre temporal `venta-pasajes-prod-restore-test` debe estar libre.
- La ventana debe estar aprobada por responsable tecnico y responsable de datos.

## Verificacion previa de solo lectura

```powershell
cd C:\VENTA-DE-PASAJES

powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-backup-restore-readiness.ps1 `
  -Environment prod `
  -CloudSqlInstanceName venta-pasajes-prod-sql `
  -DocumentBucketName venta-pasajes-prod-documents `
  -RestoreInstanceName venta-pasajes-prod-restore-test
```

Resultado esperado:

```text
Overall ready for restore test: True
```

## Ejecucion controlada

Ejecutar solo dentro de una ventana aprobada:

```powershell
cd C:\VENTA-DE-PASAJES

powershell -NoProfile -ExecutionPolicy Bypass -File .\logs\production-restore-test\dia86-production-restore-commands.ps1 -Execute
```

Para conservar recursos temporales para inspeccion manual:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\logs\production-restore-test\dia86-production-restore-commands.ps1 -Execute -KeepTemporaryResources
```

## Limpieza manual si se conservan recursos

```powershell
gcloud storage rm --recursive gs://venta-pasajes-prod-restore-test-<timestamp> `
  --project project-fbb34cd7-0b82-43e1-867 `
  --quiet

gcloud sql instances delete venta-pasajes-prod-restore-test `
  --project project-fbb34cd7-0b82-43e1-867 `
  --quiet
```

## Cierre del procedimiento

Despues de ejecutar la prueba real:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\prepare-production-restore-test.ps1
```

El cierre queda completo cuando `criteria_met` sea `True` en:

```text
C:\VENTA-DE-PASAJES\.\logs\production-restore-test\dia86-production-restore-readiness.json
```
