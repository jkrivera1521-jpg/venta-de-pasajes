# Acta de validacion de migracion final

Fecha base: 2026-09-25

Estado: PENDIENTE_EJECUCION_PRODUCTIVA_Y_FIRMA

## Objetivo

Registrar la aprobacion funcional y tecnica de la migracion final de datos hacia produccion.

Esta acta no debe marcarse como aprobada hasta que:

1. El sistema legacy este congelado.
2. Exista backup final de Access.
3. Exista backup on-demand de Cloud SQL produccion.
4. Los SQL finales hayan sido importados en Cloud SQL produccion.
5. Los conteos reales de produccion coincidan con la evidencia esperada.
6. Las muestras funcionales hayan sido validadas por negocio.

## Evidencia esperada

```text
C:\VENTA-DE-PASAJES\logs\migration\dia77-final-prod\final-data-migration-prod-readiness.json
C:\VENTA-DE-PASAJES\logs\migration\dia77-final-prod\acta-validacion-migracion-final-borrador.md
C:\VENTA-DE-PASAJES\logs\migration\dia77-final-prod\apply-prod-migration.commands.ps1
```

## Conteos a validar

| Area | Control | Resultado esperado | Resultado produccion | Estado |
| --- | --- | ---: | ---: | --- |
| Identity | users legacy | 1 | Pendiente | Pendiente |
| Identity | internal_profiles | 1 | Pendiente | Pendiente |
| Dispatch | terminals | 2 | Pendiente | Pendiente |
| Dispatch | bus_types | 3 | Pendiente | Pendiente |
| Dispatch | buses | 1 | Pendiente | Pendiente |
| Dispatch | routes | 1 | Pendiente | Pendiente |
| Dispatch | departures | 1 | Pendiente | Pendiente |
| Ticketing | passengers legacy | 3 | Pendiente | Pendiente |
| Ticketing | synced_departures | 1 | Pendiente | Pendiente |
| Ticketing | departure_seats | 25 | Pendiente | Pendiente |
| Ticketing | tickets legacy | 3 | Pendiente | Pendiente |

## Muestras funcionales a revisar

| Muestra | Revision | Estado |
| --- | --- | --- |
| Usuario migrado | Existe, esta activo y requiere activacion/recuperacion segura de clave | Pendiente |
| Bus migrado | Placa, codigo, tipo y layout correctos | Pendiente |
| Salida migrada | Ruta, origen, destino, bus, fecha y hora correctos | Pendiente |
| Boletos migrados | Numero, pasajero, asiento, tarifa y estado correctos | Pendiente |
| Mapa de asientos | Vendidos y disponibles coinciden con boletos | Pendiente |

## Firmas

| Rol | Nombre | Decision | Firma | Fecha |
| --- | --- | --- | --- | --- |
| Responsable de datos | <nombre> | Pendiente | <firma> | <fecha> |
| Responsable de negocio | <nombre> | Pendiente | <firma> | <fecha> |
| Responsable tecnico | <nombre> | Pendiente | <firma> | <fecha> |

## Cierre

Resultado final:

```text
PENDIENTE
```

Observaciones:

```text
Completar despues de la importacion real en produccion.
```

