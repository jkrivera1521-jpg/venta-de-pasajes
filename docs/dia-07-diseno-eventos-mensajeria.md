# Dia 7 - Diseno de eventos y mensajeria

Fecha: 2026-09-01
Fuentes: `tareas.md`, limites de dominio del Dia 5 y contratos API del Dia 6.

## Objetivo

Gobernar la comunicacion asincrona desde el inicio: eventos, payload minimo, topicos Pub/Sub, `correlation_id` e idempotencia.

## Entregables creados

| Entregable | Archivo |
| --- | --- |
| Catalogo de eventos | `C:\VENTA-DE-PASAJES\docs\events\catalogo-eventos.md` |
| Diseno Pub/Sub | `C:\VENTA-DE-PASAJES\docs\events\diseno-pubsub.md` |
| Esquema JSON del sobre de evento | `C:\VENTA-DE-PASAJES\docs\events\event-envelope.schema.json` |

## Eventos iniciales definidos

- `UserCreated`
- `UserRoleChanged`
- `TerminalCreated`
- `BusCreated`
- `SeatLayoutUpdated`
- `DepartureScheduled`
- `DepartureCancelled`
- `SeatReserved`
- `SeatReservationExpired`
- `TicketSold`
- `TicketCancelled`
- `TicketPrinted`
- `DocumentGenerated`
- `AuditEventCreated`

## Topicos Pub/Sub definidos

- `venta-pasajes-{env}-identity-events`
- `venta-pasajes-{env}-dispatch-events`
- `venta-pasajes-{env}-ticketing-events`
- `venta-pasajes-{env}-document-events`
- `venta-pasajes-{env}-audit-events`

Ambientes validos para `{env}`:

- `dev`
- `test`
- `staging`
- `prod`

## Convencion de correlation_id

- Toda operacion HTTP acepta `X-Correlation-Id`.
- Si no se recibe, el gateway o primer servicio genera un UUID.
- El mismo valor se propaga a logs, llamadas REST internas, eventos Pub/Sub y respuestas HTTP.
- `correlation_id` agrupa la operacion completa.
- `event_id` identifica un evento unico.
- `causation_id` enlaza eventos causados por otro evento o comando.

## Politica de idempotencia

Productores:

- Usan outbox transaccional.
- Reintentan publicacion conservando el mismo `event_id`.
- Publican solo despues de confirmar el cambio local.

Consumidores:

- Mantienen tabla `processed_events`.
- La clave unica recomendada es `source_service + event_id + consumer_name`.
- Ignoran eventos ya procesados sin repetir efectos.
- En payload no soportado o invalido, envian a DLQ y generan alerta.

Operaciones criticas:

- Venta, anulacion, generacion de documentos y exportaciones usan `Idempotency-Key`.
- Doble venta se evita en la base de `ticketing-service`, no por orden de mensajes.

## Decisiones registradas

- Pub/Sub transporta hechos, no comandos obligatorios para completar una venta.
- `ticketing-service` sigue siendo responsable transaccional de disponibilidad y venta.
- `reporting-service` puede ser eventualmente consistente.
- `audit-service` consume eventos de todos los dominios para auditoria funcional.
- No se publican contrasenas, hashes, tokens, secretos ni documentos completos.
- Los datos personales en eventos se minimizan.

## Criterio de avance

Cumplido:

- Eventos iniciales definidos.
- Payload minimo por evento definido.
- Topicos Pub/Sub definidos.
- Suscripciones iniciales definidas.
- Convencion de `correlation_id` definida.
- Politica de idempotencia definida.
- Dead-letter topics y alertas iniciales definidos.

Pendiente recomendado:

- Dia 8: disenar modelo PostgreSQL por servicio, incluyendo outbox y processed_events.

