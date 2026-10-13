# Backlog de evolucion

Generado: 2026-09-30T10:56:33.1930512-05:00

Este backlog resume la evolucion recomendada despues del cierre tecnico/documental. La fuente detallada es docs\backlog-futuro-priorizado.md y docs\estimaciones-modulos-futuros.md.

## Orden recomendado

| Prioridad | Modulo | Backend sugerido | MFE sugerido | Tamano | Semanas calendario | Persona-semanas |
|---|---|---|---|---|---|---|
| P1 | Facturacion electronica | billing-service | mfe-billing | XL | 8-12 | 28 |
| P2 | Caja avanzada | cash-service | mfe-cash | M | 5-8 | 16 |
| P3 | Pagos online | payments-service | mfe-payments | L | 6-10 | 22 |
| P4 | Encomiendas | cargo-service | mfe-cargo | L | 8-12 | 26 |
| P5 | Venta web publica | public-sales-service | public-sales-mfe | XL | 10-14 | 34 |

## Reglas para iniciar un modulo nuevo

- Confirmar alcance MVP y reglas de negocio antes de crear codigo.
- Crear base propia por microservicio y evitar dependencias directas entre bases.
- Usar las plantillas de templates\quarkus-service y templates\next-mfe.
- Agregar eventos, auditoria, health checks, OpenAPI, pruebas y documentacion desde el primer dia.
- No mezclar pendientes de estabilizacion productiva con alcance de evolucion.

## Primer siguiente modulo sugerido

Facturacion electronica queda como prioridad 1 por impacto regulatorio y administrativo. Antes de construirlo se debe validar normativa vigente, flujo de autorizacion, contingencia, certificados, anulaciones y conservacion documental.
