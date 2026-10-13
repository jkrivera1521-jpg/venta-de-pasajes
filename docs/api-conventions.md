# Guia de convenciones API

Fecha: 2026-09-01
Aplicacion: Sistema de Venta de Pasajes

## Objetivo

Definir convenciones compartidas para los contratos REST de los microservicios. Estas reglas aplican a `identity-service`, `dispatch-service`, `ticketing-service`, `document-service`, `reporting-service` y `audit-service`.

## Versionado

- Todas las APIs publicas exponen rutas bajo `/api/v1`.
- Cambios compatibles mantienen la misma version.
- Cambios incompatibles crean una nueva version mayor: `/api/v2`.
- El campo `info.version` del OpenAPI versiona el contrato del servicio, no necesariamente la version de despliegue.
- Los eventos asincronos llevan `schema_version` independiente del versionado REST.

## Nombres y formato

- JSON usa `snake_case` para propiedades.
- Rutas usan sustantivos en plural: `/users`, `/tickets`, `/departures`.
- Acciones de dominio se modelan como subrecursos cuando cambian estado: `/tickets/{ticketId}/cancel`.
- IDs internos usan UUID.
- IDs heredados desde Access se conservan como `legacy_id` solo para trazabilidad.
- Fechas y horas usan ISO 8601.
- Montos monetarios usan decimal/number con `currency`, inicialmente `PEN` por compatibilidad con los comprobantes legacy en soles.

## Autenticacion y autorizacion

- Todos los endpoints requieren `Authorization: Bearer <jwt>` salvo `/health`, login y recuperacion de contrasena.
- El JWT interno lo emite `identity-service` despues de validar Google OIDC o login local.
- Los servicios validan firma, expiracion, emisor y audiencia del JWT.
- Permisos se expresan como claims o se consultan de forma controlada segun implementacion final.
- Ningun servicio externo a identity accede a passwords, refresh tokens o secretos de identidad.

## Headers comunes

| Header | Direccion | Uso |
| --- | --- | --- |
| `Authorization` | Request | Token Bearer JWT. |
| `X-Correlation-Id` | Request/Response | Trazabilidad de una operacion completa. Si no llega, el gateway o servicio lo genera. |
| `Idempotency-Key` | Request | Obligatorio en operaciones no idempotentes criticas: venta, anulacion, generacion de documentos y exportaciones. |
| `Content-Type` | Request | `application/json` para payloads REST. |
| `Accept` | Request | `application/json` salvo descargas directas. |

## Respuestas exitosas

- `200 OK` para lectura o actualizacion con cuerpo.
- `201 Created` para creacion sincronica de recursos.
- `202 Accepted` para procesos asincronos aceptados.
- `204 No Content` para acciones exitosas sin cuerpo.
- Las listas paginadas responden con `{ "data": [], "meta": {} }`.

## Errores

Formato unico:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "La solicitud contiene datos invalidos.",
    "field_errors": [
      {
        "field": "seat_number",
        "message": "El asiento es obligatorio."
      }
    ],
    "correlation_id": "00000000-0000-0000-0000-000000000000"
  }
}
```

Codigos HTTP:

| HTTP | Uso |
| ---: | --- |
| `400` | Solicitud mal formada o parametros invalidos. |
| `401` | Falta autenticacion o token invalido. |
| `403` | Usuario autenticado sin permiso. |
| `404` | Recurso inexistente. |
| `409` | Conflicto de negocio, duplicado o asiento no disponible. |
| `422` | Reglas de negocio no cumplidas con payload valido. |
| `429` | Limite de intentos o tasa excedida. |
| `500` | Error inesperado. |
| `503` | Dependencia no disponible. |

Codigos funcionales iniciales:

- `VALIDATION_ERROR`
- `AUTHENTICATION_FAILED`
- `FORBIDDEN`
- `RESOURCE_NOT_FOUND`
- `DUPLICATE_RESOURCE`
- `SEAT_NOT_AVAILABLE`
- `RESERVATION_EXPIRED`
- `TICKET_ALREADY_CANCELLED`
- `DEPARTURE_CANCELLED`
- `DOCUMENT_GENERATION_FAILED`
- `IDEMPOTENCY_CONFLICT`

## Paginacion

Parametros:

- `page`: entero desde 1, default 1.
- `page_size`: entero entre 1 y 100, default 25.

Respuesta:

```json
{
  "data": [],
  "meta": {
    "page": 1,
    "page_size": 25,
    "total_items": 0,
    "total_pages": 0
  }
}
```

## Filtros

- Filtros simples se pasan como query params.
- Rangos de fecha usan `date_from` y `date_to`.
- Busquedas de texto usan `q`.
- Estados usan enums en mayusculas: `SCHEDULED`, `SOLD`, `CANCELLED`.
- Filtros por IDs usan nombres explicitos: `terminal_id`, `route_id`, `user_id`, `departure_id`.

## Ordenamiento

- Parametro `sort`.
- Ascendente: `sort=created_at`.
- Descendente: `sort=-created_at`.
- Multiples campos pueden separarse por coma si el servicio lo soporta: `sort=-departure_at,bus_code`.
- Cada servicio debe documentar los campos ordenables.

## Idempotencia

`Idempotency-Key` es obligatorio en operaciones que no deben ejecutarse dos veces por reintento:

- `POST /tickets`
- `POST /tickets/{ticketId}/cancel`
- `POST /documents/tickets/{ticketId}`
- `POST /exports`
- `POST /audit-events` cuando se use endpoint interno

Reglas:

- La misma clave con el mismo payload devuelve el mismo resultado o estado final.
- La misma clave con payload distinto devuelve `409 IDEMPOTENCY_CONFLICT`.
- Las claves deben persistirse el tiempo suficiente para cubrir reintentos y fallos temporales.

## Concurrencia

- `ticketing-service` debe impedir doble venta con restriccion de base de datos sobre `departure_id + seat_number + estado activo`.
- La validacion del frontend mejora experiencia, pero no cuenta como control de concurrencia.
- Las anulaciones deben ser transaccionales y auditables.

## Eventos y trazabilidad

- Toda operacion relevante debe tener `correlation_id`.
- Los eventos publicados deben incluir:
  - `event_id`
  - `event_type`
  - `schema_version`
  - `occurred_at`
  - `source_service`
  - `correlation_id`
  - `payload`
- Consumidores Pub/Sub deben ser idempotentes por `event_id`.

## Seguridad de datos

- Passwords nunca se devuelven en APIs.
- Datos personales de pasajeros se limitan a ticketing y reporting segun permisos.
- Documentos se descargan por URL firmada o endpoint autenticado.
- Los logs no deben incluir passwords, tokens ni documentos completos.
- Los servicios usan proveedor de secretos segun entorno: Google Secret Manager en GCP; variables de entorno, archivo local seguro o Vault equivalente en on-premise/offline.

## Salud y observabilidad

- Cada servicio expone `/health` sin autenticacion.
- Se agregara `/ready` cuando existan dependencias obligatorias como base de datos o Pub/Sub.
- Logs deben ser JSON estructurado.
- Cada request debe registrar `correlation_id`, servicio, ruta, estado HTTP y duracion.

## Compatibilidad con sistema legacy

- Los contratos incluyen `legacy_id` donde aplica para trazabilidad de migracion.
- Los nombres legacy no gobiernan el modelo nuevo; se conservan solo como referencia.
- `Clientes` se separa funcionalmente en pasajero y boleto.
- `Usuarios.Password` no se migra como credencial activa.
