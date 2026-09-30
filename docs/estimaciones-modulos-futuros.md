# Estimaciones iniciales de modulos futuros

## Supuestos

- Estimaciones iniciales, no compromiso cerrado de fecha.
- Equipo base supuesto: 1 backend, 1 frontend y apoyo parcial funcional/QA.
- La duracion real depende de disponibilidad de responsables, proveedores externos y reglas finales.
- Cada modulo debe pasar por discovery, diseno, implementacion, pruebas, despliegue y capacitacion.

## Tabla resumen

| Prioridad | Modulo | Tamano | Semanas calendario | Persona-semanas | Score |
| --- | --- | --- | --- | --- | --- |
| P1 | Facturacion electronica | XL | 8-12 | 28 | 95 |
| P2 | Caja avanzada | M | 5-8 | 16 | 88 |
| P3 | Pagos online | L | 6-10 | 22 | 84 |
| P4 | Encomiendas | L | 8-12 | 26 | 76 |
| P5 | Venta web publica | XL | 10-14 | 34 | 70 |

## Detalle

## P1 - Facturacion electronica

| Campo | Valor |
| --- | --- |
| Backend | billing-service |
| Frontend | mfe-billing |
| Tamano | XL |
| Calendario inicial | 8-12 semanas |
| Esfuerzo inicial | 28 persona-semanas |
| Impacto | 5 |
| Urgencia | 5 |
| Preparacion tecnica | 3 |
| Complejidad | 5 |
| Riesgo | 5 |
| Score | 95 |

Alcance MVP:

Emitir comprobante electronico desde una venta confirmada, registrar estado, conservar XML/PDF y permitir consulta/reintento.
## P2 - Caja avanzada

| Campo | Valor |
| --- | --- |
| Backend | cash-service |
| Frontend | mfe-cash |
| Tamano | M |
| Calendario inicial | 5-8 semanas |
| Esfuerzo inicial | 16 persona-semanas |
| Impacto | 5 |
| Urgencia | 4 |
| Preparacion tecnica | 4 |
| Complejidad | 3 |
| Riesgo | 3 |
| Score | 88 |

Alcance MVP:

Apertura/cierre de caja por usuario, resumen de ventas/anulaciones, registro de diferencias y reporte de cierre.
## P3 - Pagos online

| Campo | Valor |
| --- | --- |
| Backend | payments-service |
| Frontend | mfe-payments |
| Tamano | L |
| Calendario inicial | 6-10 semanas |
| Esfuerzo inicial | 22 persona-semanas |
| Impacto | 5 |
| Urgencia | 4 |
| Preparacion tecnica | 3 |
| Complejidad | 4 |
| Riesgo | 4 |
| Score | 84 |

Alcance MVP:

Crear intento de pago, recibir webhook, reconciliar estado, enlazar pago con boleto y registrar auditoria.
## P4 - Encomiendas

| Campo | Valor |
| --- | --- |
| Backend | cargo-service |
| Frontend | mfe-cargo |
| Tamano | L |
| Calendario inicial | 8-12 semanas |
| Esfuerzo inicial | 26 persona-semanas |
| Impacto | 4 |
| Urgencia | 3 |
| Preparacion tecnica | 3 |
| Complejidad | 4 |
| Riesgo | 4 |
| Score | 76 |

Alcance MVP:

Registrar encomienda, origen/destino, remitente/destinatario, estado, cobro basico y comprobante.
## P5 - Venta web publica

| Campo | Valor |
| --- | --- |
| Backend | public-sales-service |
| Frontend | public-sales-mfe |
| Tamano | XL |
| Calendario inicial | 10-14 semanas |
| Esfuerzo inicial | 34 persona-semanas |
| Impacto | 5 |
| Urgencia | 3 |
| Preparacion tecnica | 2 |
| Complejidad | 5 |
| Riesgo | 5 |
| Score | 70 |

Alcance MVP:

Busqueda publica de salidas, seleccion de asiento, captura de pasajero, pago online y confirmacion de boleto.

## Reglas para ajustar estimaciones

- Si aparece integracion externa nueva, sumar discovery tecnico y pruebas de certificacion.
- Si el modulo toca dinero o impuestos, agregar pruebas de conciliacion, auditoria y reversa.
- Si el modulo es publico en internet, agregar hardening, abuso de reservas, monitoreo y soporte.
- Si el modulo comparte flujos con boleteria, ejecutar regresion de ticketing antes de liberar.
