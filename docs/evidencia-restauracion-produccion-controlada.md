# Evidencia de restauracion produccion controlada

## Estado

| Campo | Valor |
| --- | --- |
| Ambiente | prod |
| Instancia fuente | venta-pasajes-prod-sql |
| Bucket documental | gs://venta-pasajes-prod-documents |
| Backup mas reciente | 1790668800000 |
| Fin del backup mas reciente | 2026-09-29T08:40:51.656Z |
| RPO medido de solo lectura | 8.43 horas |
| RTO base medido Dia 68 | 17.45 minutos |
| Restauracion productiva temporal ejecutada | True |
| RTO productivo medido | 17.43 minutos |
| Validacion de bases restauradas | True |
| Validacion documental | True |
| Criterio completo | True |

## Lectura ejecutiva

La verificacion de solo lectura confirma que produccion tiene Cloud SQL RUNNABLE, backups activos, bucket documental existente y un nombre de instancia temporal libre para prueba de restauracion.

La restauracion real productiva queda controlada por el script:

`powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\logs\production-restore-test\dia86-production-restore-commands.ps1 -Execute
`

Ese script crea recursos temporales, mide RTO/RPO y limpia al finalizar si no se usa -KeepTemporaryResources.

## Evidencia JSON

`	ext
C:\VENTA-DE-PASAJES\.\logs\production-restore-test\dia86-production-restore-readiness.json
C:\VENTA-DE-PASAJES\.\logs\production-restore-test\dia86-production-restore-plan.json
C:\VENTA-DE-PASAJES\.\logs\production-restore-test\dia86-production-restore-execution-evidence.json
`

## Bloqueos

- Sin bloqueos.
