# Dia 86 - Prueba de restauracion en produccion controlada

## Objetivo

Validar que el sistema puede recuperarse ante desastre usando un backup productivo en un ambiente temporal, sin modificar la instancia productiva original.

## Resultado

Se preparo el paquete de restauracion productiva controlada:

- Verificacion de solo lectura de Cloud SQL produccion, backups y bucket documental.
- Script de preparacion de evidencia y procedimiento.
- Script generado para ejecutar restauracion real en instancia temporal.
- Evidencia de RPO productivo desde el ultimo backup exitoso.
- RTO base tomado de la restauracion real de staging del Dia 68.

La ejecucion real de restauracion productiva queda protegida por una compuerta `-Execute` para evitar crear recursos de Google Cloud por accidente.

## Archivos creados o modificados

- `scripts/prepare-production-restore-test.ps1`
- `docs/dia-86-prueba-restauracion-produccion-controlada.md`
- `docs/evidencia-restauracion-produccion-controlada.md`
- `docs/procedimiento-restauracion-produccion.md`
- `logs/backup-restore/verify-backup-restore-readiness-prod.json`
- `logs/production-restore-test/dia86-production-restore-readiness.json`
- `logs/production-restore-test/dia86-production-restore-plan.json`
- `logs/production-restore-test/dia86-production-restore-commands.ps1`
- `README.md`
- `infra/README.md`
- `vitacora.md`

## Reversa primero

### Reversa de archivos locales

```powershell
Remove-Item -LiteralPath .\docs\dia-86-prueba-restauracion-produccion-controlada.md -Force
Remove-Item -LiteralPath .\docs\evidencia-restauracion-produccion-controlada.md -Force
Remove-Item -LiteralPath .\docs\procedimiento-restauracion-produccion.md -Force
Remove-Item -LiteralPath .\scripts\prepare-production-restore-test.ps1 -Force
Remove-Item -LiteralPath .\logs\production-restore-test -Recurse -Force
Remove-Item -LiteralPath .\logs\backup-restore\verify-backup-restore-readiness-prod.json -Force
```

Si tambien se quiere revertir los indices, retirar manualmente las entradas del Dia 86 de:

```text
README.md
infra/README.md
vitacora.md
```

### Reversa de recursos temporales en Google Cloud

Ejecutar solo si una restauracion real dejo recursos temporales vivos:

```powershell
gcloud storage rm --recursive gs://venta-pasajes-prod-restore-test-<timestamp> `
  --project project-fbb34cd7-0b82-43e1-867 `
  --quiet

gcloud sql instances delete venta-pasajes-prod-restore-test `
  --project project-fbb34cd7-0b82-43e1-867 `
  --quiet
```

No eliminar `venta-pasajes-prod-sql` ni `gs://venta-pasajes-prod-documents`; esos son recursos productivos.

## Guia manual desde cero

### Paso 1 - Verificar el dia en el plan

```powershell
Select-String -Path .\tareas.md -Pattern "Dia 86" -Context 0,14
```

Debe mostrar:

```text
Dia 86 - Prueba de restauracion en produccion controlada
```

### Paso 2 - Verificar precondiciones productivas de solo lectura

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-backup-restore-readiness.ps1 `
  -Environment prod `
  -CloudSqlInstanceName venta-pasajes-prod-sql `
  -DocumentBucketName venta-pasajes-prod-documents `
  -RestoreInstanceName venta-pasajes-prod-restore-test
```

Resultado esperado:

```text
Cloud SQL source instance exists: True
Cloud SQL backup enabled: True
Cloud SQL successful backups: 1 o mas
Cloud SQL restore target free: True
Storage document bucket exists: True
Overall ready for restore test: True
```

### Paso 3 - Generar paquete de restauracion

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\prepare-production-restore-test.ps1
```

Resultado esperado antes de ejecutar la restauracion real:

```text
Paquete restauracion produccion listo: True
Restauracion controlada ejecutada: False
Criterio completo: False
```

### Paso 4 - Ejecutar restauracion temporal real

Advertencia: este paso crea recursos temporales en Google Cloud. Ejecutar solo dentro de una ventana aprobada.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\logs\production-restore-test\dia86-production-restore-commands.ps1 -Execute
```

### Paso 5 - Regenerar evidencia final

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\prepare-production-restore-test.ps1
```

Al cierre real debe mostrar:

```text
Restauracion controlada ejecutada: True
Criterio completo: True
```

## Pruebas y validaciones

Validar sintaxis:

```powershell
$Errors = $null
$Tokens = $null
[System.Management.Automation.Language.Parser]::ParseFile(
  ".\scripts\prepare-production-restore-test.ps1",
  [ref]$Tokens,
  [ref]$Errors
) | Out-Null

$Errors.Count
```

Validar evidencia:

```powershell
$Result = Get-Content -LiteralPath .\logs\production-restore-test\dia86-production-restore-readiness.json -Raw |
  ConvertFrom-Json

$Result | Select-Object ready_for_controlled_restore, controlled_restore_executed, criteria_met, measured_rpo_hours, measured_prod_rto_minutes
```

## Peticiones HTTP/HTTPS listas para copiar con curl.exe

Este dia no requiere llamadas HTTP obligatorias. La prueba se centra en Cloud SQL y Cloud Storage.

Despues de una restauracion real se pueden validar servicios productivos, si existen URLs productivas disponibles:

```powershell
curl.exe -s "<url-productiva-shell>/api/health"
```

## Publicacion o despliegue

No aplica despliegue de aplicacion. La prueba crea, valida y elimina recursos temporales de recuperacion.

## Verificacion en consola web o por comandos

Consola Google Cloud:

```text
Cloud SQL > venta-pasajes-prod-sql > Backups
Cloud SQL > venta-pasajes-prod-restore-test
Cloud Storage > venta-pasajes-prod-documents
Cloud Storage > venta-pasajes-prod-restore-test-<timestamp>
```

Comandos:

```powershell
gcloud sql instances describe venta-pasajes-prod-sql `
  --project project-fbb34cd7-0b82-43e1-867

gcloud sql backups list `
  --instance venta-pasajes-prod-sql `
  --project project-fbb34cd7-0b82-43e1-867
```

## Problemas encontrados y soluciones

- Se separo verificacion de solo lectura y ejecucion real para evitar crear recursos productivos temporales por accidente.
- La restauracion real queda detras de `-Execute`.
- El script de ejecucion elimina recursos temporales al finalizar, salvo que se use `-KeepTemporaryResources`.

## Estado final y siguiente paso natural

Estado final esperado con restauracion ejecutada:

```text
Se sabe recuperar Cloud SQL produccion en una instancia temporal.
Se conoce el RPO desde el ultimo backup exitoso.
Se conoce el RTO total medido durante la prueba.
El procedimiento queda actualizado y versionado.
```

Siguiente paso natural:

```text
Dia 87 - Revision de seguridad final.
```
