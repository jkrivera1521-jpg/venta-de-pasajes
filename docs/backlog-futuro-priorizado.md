# Backlog futuro priorizado

## Resumen

Este backlog ordena los siguientes modulos del sistema despues del cierre funcional base. La priorizacion equilibra impacto de negocio, urgencia, preparacion tecnica, complejidad y riesgo.

## Orden recomendado

| Prioridad | Modulo | Backend sugerido | MFE sugerido | Razon |
| --- | --- | --- | --- | --- |
| P1 | Facturacion electronica | billing-service | mfe-billing | Modulo con mayor impacto regulatorio y administrativo; debe resolver emision, autorizacion, contingencia y trazabilidad fiscal. |
| P2 | Caja avanzada | cash-service | mfe-cash | Cierra controles operativos diarios: turnos, arqueos, diferencias, anulaciones, cierres y reportes de caja. |
| P3 | Pagos online | payments-service | mfe-payments | Habilita cobros no presenciales y es prerequisito natural para venta web publica. |
| P4 | Encomiendas | cargo-service | mfe-cargo | Nueva linea de negocio que reutiliza rutas, salidas, buses, documentos y reportes, pero requiere dominio propio. |
| P5 | Venta web publica | public-sales-service | public-sales-mfe | Canal de crecimiento comercial, pero conviene hacerlo despues de estabilizar pagos online, caja y reglas operativas. |

## Detalle por modulo

## P1 - Facturacion electronica

MVP inicial:

Emitir comprobante electronico desde una venta confirmada, registrar estado, conservar XML/PDF y permitir consulta/reintento.

Dependencias:

- ticketing-service
- document-service
- audit-service
- identidad y roles administrativos
- validacion normativa SRI vigente antes de implementar

Riesgos principales:

- Cambios regulatorios
- Firma y certificados
- Ambiente de pruebas SRI
- Manejo de contingencia y anulaciones
## P2 - Caja avanzada

MVP inicial:

Apertura/cierre de caja por usuario, resumen de ventas/anulaciones, registro de diferencias y reporte de cierre.

Dependencias:

- ticketing-service
- reporting-service
- audit-service
- roles de supervisor

Riesgos principales:

- Reglas operativas incompletas
- Diferencias entre reporte y caja fisica
- Permisos de supervisor
## P3 - Pagos online

MVP inicial:

Crear intento de pago, recibir webhook, reconciliar estado, enlazar pago con boleto y registrar auditoria.

Dependencias:

- ticketing-service
- audit-service
- proveedor de pagos seleccionado
- politica de reintentos e idempotencia

Riesgos principales:

- Webhooks duplicados
- Contracargos
- Conciliacion bancaria
- Manejo de boletos pendientes de pago
## P4 - Encomiendas

MVP inicial:

Registrar encomienda, origen/destino, remitente/destinatario, estado, cobro basico y comprobante.

Dependencias:

- dispatch-service
- document-service
- reporting-service
- audit-service

Riesgos principales:

- Estados logisticos
- Responsabilidad por paquetes
- Tarifas por peso/volumen
- Operativa de entrega
## P5 - Venta web publica

MVP inicial:

Busqueda publica de salidas, seleccion de asiento, captura de pasajero, pago online y confirmacion de boleto.

Dependencias:

- payments-service
- ticketing-service
- document-service
- frontend-shell o portal publico
- politicas antifraude

Riesgos principales:

- Exposicion publica
- Abuso de reservas
- Soporte a pasajeros externos
- SEO y disponibilidad

## Decision de secuencia

La secuencia recomendada es:

1. Facturacion electronica.
2. Caja avanzada.
3. Pagos online.
4. Encomiendas.
5. Venta web publica.

Se recomienda iniciar descubrimiento funcional de facturacion electronica y pagos online en paralelo, pero construir primero el modulo que tenga requisitos externos y responsables confirmados.
