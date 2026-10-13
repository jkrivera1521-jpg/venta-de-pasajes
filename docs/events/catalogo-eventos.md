# Catalogo de eventos

Fecha: 2026-09-01
Aplicacion: Sistema de Venta de Pasajes

## Objetivo

Definir los eventos iniciales que gobernaran la comunicacion asincrona entre microservicios. Los eventos no reemplazan las APIs transaccionales; comunican hechos ya ocurridos.

## Sobre comun de evento

Todos los eventos usan el mismo sobre:

```json
{
  "event_id": "00000000-0000-0000-0000-000000000000",
  "event_type": "TicketSold",
  "schema_version": 1,
  "occurred_at": "2026-09-01T10:00:00Z",
  "source_service": "ticketing-service",
  "correlation_id": "00000000-0000-0000-0000-000000000000",
  "causation_id": "00000000-0000-0000-0000-000000000000",
  "actor_user_id": "00000000-0000-0000-0000-000000000000",
  "idempotency_key": "optional-client-key",
  "resource_type": "ticket",
  "resource_id": "00000000-0000-0000-0000-000000000000",
  "payload": {}
}
```

Campos obligatorios:

- `event_id`: UUID unico del evento.
- `event_type`: nombre del hecho de dominio.
- `schema_version`: version del payload.
- `occurred_at`: fecha/hora UTC en que ocurrio el hecho.
- `source_service`: servicio que origina el evento.
- `correlation_id`: UUID de trazabilidad de la operacion completa.
- `payload`: datos minimos del evento.

Campos opcionales recomendados:

- `causation_id`: evento o comando que origino este evento.
- `actor_user_id`: usuario interno que ejecuto la accion, si aplica.
- `idempotency_key`: clave de idempotencia recibida en la API, si aplica.
- `resource_type` y `resource_id`: recurso principal afectado.

El esquema JSON del sobre queda en:

`C:\VENTA-DE-PASAJES\docs\events\event-envelope.schema.json`

## Eventos iniciales

| Evento | Servicio origen | Topic | Disparador | Consumidores iniciales | Payload minimo |
| --- | --- | --- | --- | --- | --- |
| `UserCreated` | `identity-service` | `venta-pasajes-{env}-identity-events` | Creacion de usuario interno. | `audit-service`, `reporting-service` | `user_id`, `identity_type`, `login`, `email`, `display_name`, `status`, `legacy_id`. |
| `UserRoleChanged` | `identity-service` | `venta-pasajes-{env}-identity-events` | Cambio de roles/permisos. | `audit-service` | `user_id`, `previous_role_ids`, `new_role_ids`, `changed_by_user_id`. |
| `TerminalCreated` | `dispatch-service` | `venta-pasajes-{env}-dispatch-events` | Creacion de terminal. | `audit-service`, `reporting-service`, `ticketing-service` | `terminal_id`, `name`, `local_code`, `legacy_id`, `active`. |
| `BusCreated` | `dispatch-service` | `venta-pasajes-{env}-dispatch-events` | Creacion de bus. | `audit-service`, `reporting-service`, `ticketing-service` | `bus_id`, `code`, `plate`, `bus_type_id`, `terminal_id`, `seat_layout_id`, `legacy_id`. |
| `SeatLayoutUpdated` | `dispatch-service` | `venta-pasajes-{env}-dispatch-events` | Creacion o cambio de layout de asientos. | `audit-service`, `ticketing-service` | `seat_layout_id`, `name`, `seat_count`, `changed_seats`. |
| `DepartureScheduled` | `dispatch-service` | `venta-pasajes-{env}-dispatch-events` | Programacion de salida. | `audit-service`, `reporting-service`, `ticketing-service` | `departure_id`, `bus_id`, `route_id`, `origin_terminal_id`, `destination_terminal_id`, `departure_at`, `seat_layout_id`, `legacy_id`. |
| `DepartureCancelled` | `dispatch-service` | `venta-pasajes-{env}-dispatch-events` | Cancelacion de salida. | `audit-service`, `reporting-service`, `ticketing-service` | `departure_id`, `cancelled_at`, `reason`, `cancelled_by_user_id`. |
| `SeatReserved` | `ticketing-service` | `venta-pasajes-{env}-ticketing-events` | Reserva temporal de asiento. | `audit-service`, `reporting-service` | `reservation_id`, `departure_id`, `seat_number`, `expires_at`, `reserved_by_user_id`. |
| `SeatReservationExpired` | `ticketing-service` | `venta-pasajes-{env}-ticketing-events` | Expiracion automatica de reserva. | `audit-service`, `reporting-service` | `reservation_id`, `departure_id`, `seat_number`, `expired_at`. |
| `TicketSold` | `ticketing-service` | `venta-pasajes-{env}-ticketing-events` | Venta confirmada. | `audit-service`, `reporting-service`, `document-service` | `ticket_id`, `ticket_number`, `departure_id`, `seat_number`, `passenger_id`, `price`, `currency`, `sold_at`, `sold_by_user_id`, `departure_snapshot`. |
| `TicketCancelled` | `ticketing-service` | `venta-pasajes-{env}-ticketing-events` | Anulacion confirmada. | `audit-service`, `reporting-service`, `document-service` | `ticket_id`, `ticket_number`, `departure_id`, `seat_number`, `cancelled_at`, `cancelled_by_user_id`, `reason`, `refund_amount`. |
| `TicketPrinted` | `ticketing-service` | `venta-pasajes-{env}-ticketing-events` | Reimpresion o impresion registrada. | `audit-service`, `reporting-service` | `ticket_id`, `ticket_number`, `printed_at`, `printed_by_user_id`, `document_id`. |
| `DocumentGenerated` | `document-service` | `venta-pasajes-{env}-document-events` | PDF generado y guardado. | `audit-service`, `reporting-service`, `ticketing-service` | `document_id`, `owner_type`, `owner_id`, `template_code`, `storage_uri`, `content_type`, `generated_at`. |
| `AuditEventCreated` | `audit-service` | `venta-pasajes-{env}-audit-events` | Registro interno de auditoria creado. | `reporting-service` si se requiere tablero de auditoria | `audit_event_id`, `source_event_id`, `action`, `resource_type`, `resource_id`, `occurred_at`. |

## Payloads por evento

### UserCreated

```json
{
  "user_id": "uuid",
  "legacy_id": 1,
  "identity_type": "LOCAL",
  "login": "admin",
  "email": "admin@example.com",
  "display_name": "Administrador",
  "status": "PENDING_ACTIVATION"
}
```

No incluir password historico, hash, token de recuperacion ni tokens Google.

### UserRoleChanged

```json
{
  "user_id": "uuid",
  "previous_role_ids": ["uuid"],
  "new_role_ids": ["uuid"],
  "changed_by_user_id": "uuid"
}
```

### TerminalCreated

```json
{
  "terminal_id": "uuid",
  "legacy_id": 1,
  "local_code": "T001",
  "name": "Terminal Central",
  "active": true
}
```

### BusCreated

```json
{
  "bus_id": "uuid",
  "legacy_id": 1,
  "code": "BUS-001",
  "plate": "ABC-123",
  "bus_type_id": "uuid",
  "terminal_id": "uuid",
  "seat_layout_id": "uuid"
}
```

### SeatLayoutUpdated

```json
{
  "seat_layout_id": "uuid",
  "name": "Layout legacy 25 asientos",
  "seat_count": 25,
  "changed_seats": [
    {
      "number": 1,
      "position": "WINDOW"
    }
  ]
}
```

### DepartureScheduled

```json
{
  "departure_id": "uuid",
  "legacy_id": 1,
  "bus_id": "uuid",
  "route_id": "uuid",
  "origin_terminal_id": "uuid",
  "destination_terminal_id": "uuid",
  "departure_at": "2026-09-01T15:00:00Z",
  "seat_layout_id": "uuid"
}
```

### DepartureCancelled

```json
{
  "departure_id": "uuid",
  "cancelled_at": "2026-09-01T12:00:00Z",
  "cancelled_by_user_id": "uuid",
  "reason": "Salida cancelada por mantenimiento"
}
```

### SeatReserved

```json
{
  "reservation_id": "uuid",
  "departure_id": "uuid",
  "seat_number": 12,
  "reserved_by_user_id": "uuid",
  "expires_at": "2026-09-01T12:10:00Z"
}
```

### SeatReservationExpired

```json
{
  "reservation_id": "uuid",
  "departure_id": "uuid",
  "seat_number": 12,
  "expired_at": "2026-09-01T12:10:00Z"
}
```

### TicketSold

```json
{
  "ticket_id": "uuid",
  "ticket_number": "000-000001",
  "departure_id": "uuid",
  "seat_number": 12,
  "seat_position": "AISLE",
  "passenger_id": "uuid",
  "passenger_document_number": "12345678",
  "price": 25.0,
  "currency": "PEN",
  "sold_at": "2026-09-01T12:00:00Z",
  "sold_by_user_id": "uuid",
  "departure_snapshot": {
    "bus_code": "BUS-001",
    "bus_type": "Normal",
    "origin": "Origen",
    "destination": "Destino",
    "departure_at": "2026-09-01T15:00:00Z"
  }
}
```

El documento del pasajero permite reportes operativos, pero se debe evitar enviar datos personales no necesarios.

### TicketCancelled

```json
{
  "ticket_id": "uuid",
  "ticket_number": "000-000001",
  "departure_id": "uuid",
  "seat_number": 12,
  "cancelled_at": "2026-09-01T12:30:00Z",
  "cancelled_by_user_id": "uuid",
  "reason": "Solicitud del pasajero",
  "refund_amount": 0
}
```

### TicketPrinted

```json
{
  "ticket_id": "uuid",
  "ticket_number": "000-000001",
  "document_id": "uuid",
  "printed_at": "2026-09-01T12:31:00Z",
  "printed_by_user_id": "uuid"
}
```

### DocumentGenerated

```json
{
  "document_id": "uuid",
  "owner_type": "TICKET",
  "owner_id": "uuid",
  "template_code": "DEFAULT_TICKET",
  "storage_uri": "gs://venta-pasajes-dev-documents/tickets/000-000001.pdf",
  "content_type": "application/pdf",
  "generated_at": "2026-09-01T12:00:05Z"
}
```

### AuditEventCreated

```json
{
  "audit_event_id": "uuid",
  "source_event_id": "uuid",
  "action": "ticket.sold",
  "resource_type": "ticket",
  "resource_id": "uuid",
  "occurred_at": "2026-09-01T12:00:00Z"
}
```

## Reglas de evolucion

- Agregar campos opcionales es compatible.
- Quitar o renombrar campos requiere aumentar `schema_version`.
- Cambiar significado funcional de un campo requiere nuevo evento o nueva version.
- Los consumidores deben ignorar campos desconocidos.
- Los productores no deben publicar datos sensibles solo porque existen en la base.
- Cada evento debe tener un dueno claro; no hay eventos anonimos ni genericos tipo `DataChanged`.
