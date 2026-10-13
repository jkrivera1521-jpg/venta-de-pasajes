# Estandar de nombres

Fecha: 2026-09-01

## Objetivo

Definir nombres consistentes para modulos, servicios, bases, variables, eventos e infraestructura.

## Carpetas

- Apps frontend: `apps/<nombre>`.
- Microfrontends: `apps/mfe-<dominio>`.
- Shell: `apps/frontend-shell`.
- Servicios: `services/<dominio>-service`.
- Paquetes compartidos: `packages/<nombre>`.
- Infraestructura: `infra/<proveedor-o-recurso>`.
- Migracion: `migration/access-to-postgres`.
- Documentacion: `docs/<tema>.md`.

## Servicios

| Dominio | Servicio | Base |
| --- | --- | --- |
| Identidad | `identity-service` | `identity_db` |
| Despacho | `dispatch-service` | `dispatch_db` |
| Boleteria | `ticketing-service` | `ticketing_db` |
| Documentos | `document-service` | `documents_db` |
| Reportes | `reporting-service` | `reporting_db` |
| Auditoria | `audit-service` | `audit_db` |

## Frontend

- Shell principal: `frontend-shell`.
- Microfrontends: prefijo `mfe-`.
- Rutas internas sugeridas:
  - `/identity`
  - `/dispatch`
  - `/ticketing`
  - `/reporting`
  - `/admin`

## APIs

- Base path: `/api/v1`.
- Recursos REST en plural: `/users`, `/buses`, `/tickets`.
- Acciones de cambio de estado como subrecurso: `/tickets/{ticketId}/cancel`.
- Propiedades JSON en `snake_case`.
- Parametros de query en `snake_case`.
- IDs internos: UUID.
- IDs legacy: `legacy_id`.

## Bases de datos

- Nombres de tablas en plural y `snake_case`.
- Claves primarias: `id`.
- Claves externas locales: `<recurso>_id`.
- Timestamps:
  - `created_at`
  - `updated_at`
  - `deleted_at` solo si existe borrado logico.
- Estados como `text` con `CHECK` inicial; se puede migrar a enum PostgreSQL si conviene.

## Eventos

- Nombre de evento en PascalCase: `TicketSold`.
- Topic por dominio: `venta-pasajes-{env}-<domain>-events`.
- DLQ por dominio: `venta-pasajes-{env}-<domain>-events-dlq`.
- Suscripcion: `venta-pasajes-{env}-<consumer>-<domain>-events-sub`.
- Payload JSON en `snake_case`.

## Google Cloud

- Proyecto: `venta-pasajes-<env>`.
- Region principal inicial: `us-central1` para `dev`, hasta confirmar region final de operacion.
- Service account runtime: `<service>-run`.
- Service account CI/CD: `cloudbuild-deployer`.
- Artifact Registry: `venta-pasajes-<env>`.
- Cloud Run: mismo nombre que el servicio.
- Buckets: `venta-pasajes-<env>-<proposito>`.
- Secret Manager: `<service>__<secret_name>`.
- Secret Manager por entorno real: `<component>__<purpose>` con labels `app`, `env`, `category` y `owner`.
- Presupuesto dev: `venta-pasajes-dev-monthly-budget`.

## Variables de ambiente

- Mayusculas y guion bajo: `QUARKUS_HTTP_PORT`.
- Prefijo `NEXT_PUBLIC_` solo para valores seguros que deban llegar al navegador.
- Secretos reales nunca se guardan en `.env.example`.
