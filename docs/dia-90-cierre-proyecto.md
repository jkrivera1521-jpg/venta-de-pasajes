# Dia 90 - Cierre del proyecto

Objetivo: revisar criterios de exito, confirmar operacion estable, entregar accesos administrados, entregar documentacion, registrar pendientes y preparar el acta de cierre funcional y tecnico.

Este dia no debe forzar una declaracion artificial de 100% operativo. Si las evidencias muestran que Cloud Run y la infraestructura estan saludables, pero la migracion final, la prueba controlada o la apertura real de negocio siguen pendientes, el cierre debe quedar condicionado.

## Reversa primero

Este dia solo crea documentos y evidencias locales. No modifica recursos de Google Cloud.

Para retirar los artefactos generados por este dia:

```powershell
Remove-Item -LiteralPath .\docs\acta-cierre-proyecto.md -Force
Remove-Item -LiteralPath .\docs\plataforma-funcionando-google-cloud.md -Force
Remove-Item -LiteralPath .\docs\backlog-evolucion.md -Force
Remove-Item -LiteralPath .\logs\project-closure -Recurse -Force
Remove-Item -LiteralPath .\scripts\prepare-project-closure.ps1 -Force
Remove-Item -LiteralPath .\docs\dia-90-cierre-proyecto.md -Force
```

## Prerrequisitos verificados

Antes de ejecutar el cierre deben existir estas evidencias:

```powershell
Test-Path -LiteralPath .\logs\prod-infra\verify-prod-infra.json
Test-Path -LiteralPath .\logs\cloudrun-prod\verify-cloudrun-prod-backends.json
Test-Path -LiteralPath .\logs\cloudrun-prod\verify-cloudrun-prod-frontends.json
Test-Path -LiteralPath .\logs\production-restore-test\dia86-production-restore-readiness.json
Test-Path -LiteralPath .\logs\final-security\dia87-final-security-readiness.json
Test-Path -LiteralPath .\logs\technical-documentation\dia84-technical-documentation-readiness.json
Test-Path -LiteralPath .\logs\operational-documentation\dia85-operational-documentation-readiness.json
Test-Path -LiteralPath .\logs\future-modules-backlog\dia89-future-modules-backlog-readiness.json
Test-Path -LiteralPath .\logs\migration\dia77-final-prod\final-data-migration-prod-readiness.json
Test-Path -LiteralPath .\logs\prod-controlled-test\dia78-controlled-prod-test-readiness.json
Test-Path -LiteralPath .\logs\go-live\dia79-go-live-readiness.json
Test-Path -LiteralPath .\logs\post-start-day1\dia80-post-start-day1-readiness.json
```

Todos deben devolver `True`.

## Paso 1 - Generar paquete de cierre

Ejecutar:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\prepare-project-closure.ps1
```

El script consolida:

- infraestructura productiva;
- backends productivos;
- frontends productivos;
- restauracion controlada;
- seguridad final;
- documentacion tecnica y operativa;
- backlog futuro;
- bloqueos reales de migracion, prueba controlada, go-live y soporte post-arranque.

## Paso 2 - Revisar resultado

```powershell
$Result = Get-Content -LiteralPath .\logs\project-closure\dia90-project-closure-readiness.json -Raw |
  ConvertFrom-Json

$Result |
  Select-Object closure_status,
    platform_functioning_in_google_cloud,
    technical_platform_ready,
    business_operational_ready,
    full_100_percent_operational,
    criterion_100_percent_operational_met
```

Lectura esperada con el estado actual:

```text
closure_status: Cierre tecnico/documental condicionado
platform_functioning_in_google_cloud: True
technical_platform_ready: True
business_operational_ready: False
full_100_percent_operational: False
criterion_100_percent_operational_met: False
```

## Paso 3 - Revisar acta

Abrir:

```powershell
notepad .\docs\acta-cierre-proyecto.md
```

El acta debe mostrar:

- estado de cierre;
- criterio del Dia 90;
- resumen de evidencias;
- pendientes bloqueantes;
- entregables;
- espacio de firma.

## Paso 4 - Revisar plataforma funcionando en Google Cloud

Abrir:

```powershell
notepad .\docs\plataforma-funcionando-google-cloud.md
```

Este documento confirma que la plataforma tecnica esta desplegada y saludable en Google Cloud. No reemplaza el go-live real del negocio.

## Paso 5 - Revisar backlog de evolucion

Abrir:

```powershell
notepad .\docs\backlog-evolucion.md
```

Debe resumir los modulos futuros priorizados del Dia 89.

## Paso 6 - Firmar solo si corresponde

Si `full_100_percent_operational` es `False`, no firmar cierre funcional total.

Se puede firmar cierre tecnico/documental condicionado si el equipo acepta que:

- Google Cloud esta funcionando;
- la documentacion esta entregada;
- la seguridad final no tiene riesgos criticos abiertos;
- la restauracion controlada fue probada;
- los pendientes funcionales quedan registrados y asignados.

## Entregables

- `docs\acta-cierre-proyecto.md`
- `docs\plataforma-funcionando-google-cloud.md`
- `docs\backlog-evolucion.md`
- `logs\project-closure\dia90-project-closure-readiness.json`
- `logs\project-closure\dia90-project-closure-inventory.json`

## Criterio de avance

El plan original pide que el sistema quede operativo al 100% en Google Cloud.

Con las evidencias actuales, el resultado correcto es:

```text
Plataforma tecnica en Google Cloud: lista.
Cierre tecnico/documental: listo.
Cierre funcional 100%: pendiente hasta ejecutar y aprobar migracion final, prueba productiva controlada, apertura real y soporte post-arranque.
```
