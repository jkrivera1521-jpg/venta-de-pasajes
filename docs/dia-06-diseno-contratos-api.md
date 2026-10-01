# Dia 6 - Diseno de contratos API

Fecha: 2026-09-01
Fuentes: limites de dominio del Dia 5 y analisis funcional/base Access de dias previos.

## Objetivo

Definir contratos OpenAPI iniciales para que frontend y backend puedan trabajar en paralelo con un lenguaje comun de recursos, payloads, errores, paginacion y filtros.

## Contratos generados

| Servicio | Archivo OpenAPI | Alcance inicial |
| --- | --- | --- |
| `identity-service` | `C:\VENTA-DE-PASAJES\docs\openapi\identity-service.openapi.yaml` | Login local, intercambio Google, usuario actual, usuarios, roles, permisos, identidades autorizadas y recuperacion de contrasena. |
| `dispatch-service` | `C:\VENTA-DE-PASAJES\docs\openapi\dispatch-service.openapi.yaml` | Terminales, rutas, tipos de bus, buses, layouts de asientos y salidas programadas. |
| `ticketing-service` | `C:\VENTA-DE-PASAJES\docs\openapi\ticketing-service.openapi.yaml` | Busqueda de salidas vendibles, mapa de asientos, pasajeros, reservas, venta, anulacion y reimpresion. |
| `document-service` | `C:\VENTA-DE-PASAJES\docs\openapi\document-service.openapi.yaml` | Plantillas, generacion de PDF de boleto, documentos y URL firmada. |
| `reporting-service` | `C:\VENTA-DE-PASAJES\docs\openapi\reporting-service.openapi.yaml` | Reporte de ventas, pasajeros, ventas por usuario, ventas por bus/ruta/terminal y exportaciones. |
| `audit-service` | `C:\VENTA-DE-PASAJES\docs\openapi\audit-service.openapi.yaml` | Consulta de auditoria y registro interno/idempotente de eventos auditables. |

Aunque el Dia 6 del plan lista cinco contratos de servicio, se agrego `audit-service` porque en el Dia 5 quedo definido como microservicio propio y necesitara API de consulta para administracion y soporte.

## Guia de convenciones

Archivo creado:

`C:\VENTA-DE-PASAJES\docs\api-conventions.md`

Incluye:

- Versionado bajo `/api/v1`.
- Uso de JSON con `snake_case`.
- IDs internos UUID y `legacy_id` solo para trazabilidad.
- Seguridad con Bearer JWT.
- Headers comunes: `Authorization`, `X-Correlation-Id`, `Idempotency-Key`.
- Estructura comun de errores.
- Codigos HTTP estandar.
- Paginacion con `page` y `page_size`.
- Filtros por `q`, rangos de fecha y estados.
- Ordenamiento con `sort`.
- Idempotencia para operaciones criticas.
- Reglas de concurrencia para venta de asientos.
- Trazabilidad por eventos.
- Seguridad de datos personales y credenciales.

## Decisiones de contrato registradas

- Todos los servicios exponen `/health` sin autenticacion.
- Todos los servicios usan Bearer JWT salvo endpoints publicos de autenticacion y salud.
- Las operaciones criticas de ticketing, documents, reporting exports y audit interno usan `Idempotency-Key`.
- `ticketing-service` expone el mapa de asientos por salida mediante `/departures/{departureId}/seats`.
- La venta se realiza con `POST /tickets` y debe ser transaccional.
- La anulacion se realiza con `POST /tickets/{ticketId}/cancel`.
- `dispatch-service` modela layouts de asiento como recursos, no como botones fijos.
- `document-service` no decide validez de boletos; solo genera documentos desde datos recibidos.
- `reporting-service` trabaja con modelos de lectura y no modifica datos transaccionales.
- `audit-service` es append-only a nivel funcional.

## Riesgos y pendientes

- Los contratos son iniciales y deberan ajustarse cuando se disene el modelo PostgreSQL del Dia 8.
- Falta decidir si `ticketing-service` consultara `dispatch-service` en tiempo real o por read model/eventos.
- Falta definir permisos exactos por endpoint.
- Falta definir codigos finales de roles funcionales con usuarios clave.
- Falta validar los OpenAPI con el generador elegido por Quarkus cuando existan los proyectos.

## Criterio de avance

Cumplido:

- OpenAPI inicial para identity.
- OpenAPI inicial para dispatch.
- OpenAPI inicial para ticketing.
- OpenAPI inicial para documents.
- OpenAPI inicial para reporting.
- OpenAPI inicial complementario para audit.
- Convenciones de errores, paginacion y filtros definidas.
- Frontend y backend ya pueden trabajar contra contratos base.
