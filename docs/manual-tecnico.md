# Manual tecnico

Fecha base: 2026-09-29

## Proposito

Este manual consolida la arquitectura tecnica del sistema Venta de Pasajes para que otro tecnico pueda mantener el monorepo, entender los limites de cada modulo, validar bases de datos, revisar eventos, ejecutar pipelines y desplegar en Google Cloud.

## Stack principal

| Capa | Tecnologia | Version / regla |
| --- | --- | --- |
| Frontend | Next.js App Router | 16.3.4 |
| Frontend | React | 19.2.8 |
| Frontend | TanStack Query | ^5.103.1 |
| Frontend | TanStack Table | ^8.21.3 en mfe-admin |
| Frontend | TypeScript | 7.0.2, modo strict |
| Backend | Quarkus | 3.25.2 |
| Backend | Java | 21 |
| Backend | Persistencia | Hibernate ORM Panache, JDBC PostgreSQL, Flyway |
| Infra | Google Cloud | Cloud Run, Cloud SQL PostgreSQL 16, Artifact Registry, Secret Manager, Pub/Sub, Cloud Storage |
| CI | GitHub Actions | windows-latest, Node 24, Java 21 |

## Arquitectura general

El sistema es un monorepo con frontends Next.js y backends Quarkus. La entrada principal es frontend-shell. Cada MFE se despliega como un servicio Cloud Run independiente y expone un manifiesto en /mfe/manifest. Los backends productivos son privados y se invocan mediante identidad de servicio cuando el trafico sale desde los MFEs.

Cada microservicio backend conserva su propia base de datos. No hay llaves foraneas entre bases de distintos servicios. La sincronizacion entre dominios se realiza con eventos, outbox, modelos de lectura y snapshots.

## Modulos frontend

| Aplicacion | Servicio Cloud Run | Puerto | Rol |
| --- | --- | --- | --- |
| frontend-shell | frontend-shell-prod | 3000 | Entrada principal, layout, sesion y carga de microfrontends por manifiesto. |
| mfe-admin | mfe-admin-prod | 3005 | Interfaz de administracion, salud, runbook, diagnostico y readiness. |
| mfe-dispatch | mfe-dispatch-prod | 3002 | Interfaz de terminales, rutas, buses, layouts y salidas. |
| mfe-identity | mfe-identity-prod | 3001 | Interfaz de usuarios, roles, permisos e identidades. |
| mfe-reporting | mfe-reporting-prod | 3004 | Interfaz de reportes operativos. |
| mfe-ticketing | mfe-ticketing-prod | 3003 | Interfaz de venta, reserva, mapa de asientos, anulacion y reimpresion. |

## Microservicios backend

| Servicio | Cloud Run | Puerto | Base | Rol |
| --- | --- | --- | --- | --- |
| audit-service | audit-service-prod | 8086 | audit_db | Auditoria funcional inmutable y consulta de eventos auditables. |
| dispatch-service | dispatch-service-prod | 8082 | dispatch_db | Terminales, rutas, tipos de bus, buses, layouts y salidas programadas. |
| document-service | document-service-prod | 8084 | documents_db | Plantillas, generacion de PDF de boleto y almacenamiento documental. |
| identity-service | identity-service-prod | 8081 | identity_db | Autenticacion, usuarios, roles, permisos e identidades autorizadas. |
| reporting-service | reporting-service-prod | 8085 | reporting_db | Modelo de lectura para ventas, pasajeros, usuarios, buses, reportes y exportaciones. |
| ticketing-service | ticketing-service-prod | 8083 | ticketing_db | Disponibilidad, reservas, pasajeros, boletos, anulaciones y referencias documentales. |

## Bases de datos

Instancia productiva: venta-pasajes-prod-sql, region us-central1, version POSTGRES_16, tier db-f1-micro, storage 10GB SSD.

| Archivo | Base logica | Tablas principales | Indices definidos |
| --- | --- | --- | --- |
| docs/database/audit-db.sql | audit-db | audit_events, processed_events, outbox_events | 6 |
| docs/database/dispatch-db.sql | dispatch-db | terminals, routes, bus_types, seat_layouts, seat_layout_seats, buses, departures, outbox_events | 5 |
| docs/database/documents-db.sql | documents-db | document_templates, documents, document_generation_attempts, idempotency_keys, processed_events, outbox_events | 6 |
| docs/database/identity-db.sql | identity-db | users, local_credentials, google_identities, internal_profiles, roles, permissions, role_permissions, user_roles, authorized_identities, password_reset_tokens, login_attempts, outbox_events | 8 |
| docs/database/reporting-db.sql | reporting-db | dim_users, dim_terminals, dim_routes, dim_buses, dim_departures, fact_ticket_sales, fact_documents, report_export_jobs, idempotency_keys, processed_events, outbox_events | 12 |
| docs/database/ticketing-db.sql | ticketing-db | dispatch_departure_snapshots, departure_seats, passengers, passenger_legacy_mappings, seat_allocations, reservations, tickets, ticket_document_refs, idempotency_keys, processed_events, outbox_events | 12 |

## APIs

Las especificaciones viven en docs/openapi. Los paths se documentan sin el prefijo productivo /api/v1/{dominio} cuando el archivo OpenAPI ya representa el dominio.

| API | Version | Paths principales |
| --- | --- | --- |
| Audit Service API | 0.1.0 | /audit, /audit/resources, /audit/health, /audit/audit-events, /audit/audit-events/{eventId} |
| Dispatch Service API | 0.1.0 | /health, /terminals, /terminals/{terminalId}, /routes, /routes/{routeId}, /bus-types, /bus-types/{busTypeId}, /seat-layouts, /seat-layouts/{seatLayoutId}, /buses, /buses/{busId}, /departures, /departures/{departureId}, /departures/{departureId}/cancel |
| Document Service API | 0.1.0 | /health, /templates, /documents/tickets/{ticketId}, /documents, /documents/{documentId}, /documents/{documentId}/download, /documents/{documentId}/signed-url |
| Identity Service API | 0.1.0 | /health, /auth/local/login, /auth/google/exchange, /auth/logout, /me, /users, /users/{userId}, /users/{userId}/roles, /users/{userId}/activate, /users/{userId}/suspend, /roles, /permissions, /authorized-identities, /password/forgot, /password/reset |
| Reporting Service API | 0.1.0 | /health, /reports/sales, /reports/passengers, /reports/sales/by-user, /reports/sales/by-bus, /events/ticket-sold, /events/ticket-cancelled, /exports, /exports/{exportId} |
| Ticketing Service API | 0.1.0 | /health, /departures, /departures/{departureId}/seats, /passengers, /reservations, /reservations/{reservationId}, /tickets, /tickets/{ticketId}, /tickets/{ticketId}/cancel, /tickets/{ticketId}/document, /tickets/{ticketId}/document/reprint, /documents/process-pending |

## Eventos y mensajeria

Los eventos usan el sobre comun documentado en docs/events/event-envelope.schema.json. Pub/Sub productivo esta descrito en infra/gcloud/pubsub-prod.json.

| Evento | Origen | Topic logico |
| --- | --- | --- |
| UserCreated | identity-service | venta-pasajes-{env}-identity-events |
| UserRoleChanged | identity-service | venta-pasajes-{env}-identity-events |
| TerminalCreated | dispatch-service | venta-pasajes-{env}-dispatch-events |
| BusCreated | dispatch-service | venta-pasajes-{env}-dispatch-events |
| SeatLayoutUpdated | dispatch-service | venta-pasajes-{env}-dispatch-events |
| DepartureScheduled | dispatch-service | venta-pasajes-{env}-dispatch-events |
| DepartureCancelled | dispatch-service | venta-pasajes-{env}-dispatch-events |
| SeatReserved | ticketing-service | venta-pasajes-{env}-ticketing-events |
| SeatReservationExpired | ticketing-service | venta-pasajes-{env}-ticketing-events |
| TicketSold | ticketing-service | venta-pasajes-{env}-ticketing-events |
| TicketCancelled | ticketing-service | venta-pasajes-{env}-ticketing-events |
| TicketPrinted | ticketing-service | venta-pasajes-{env}-ticketing-events |
| DocumentGenerated | document-service | venta-pasajes-{env}-document-events |
| AuditEventCreated | audit-service | venta-pasajes-{env}-audit-events |

### Topics productivos

| Topic | Publicador |
| --- | --- |
| venta-pasajes-prod-audit-events | audit-prod-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com |
| venta-pasajes-prod-audit-events-dlq |  |
| venta-pasajes-prod-dispatch-events | dispatch-prod-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com |
| venta-pasajes-prod-dispatch-events-dlq |  |
| venta-pasajes-prod-document-events | document-prod-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com |
| venta-pasajes-prod-document-events-dlq |  |
| venta-pasajes-prod-identity-events | identity-prod-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com |
| venta-pasajes-prod-identity-events-dlq |  |
| venta-pasajes-prod-ticketing-events | ticketing-prod-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com |
| venta-pasajes-prod-ticketing-events-dlq |  |

## Pipelines

| Workflow | Archivo | Jobs |
| --- | --- | --- |
| venta-pasajes-ci | .github/workflows/ci.yml | frontend-quality, backend-tests, workspace-guardrails |
| venta-pasajes-frontend-artifacts | .github/workflows/frontend-artifacts.yml | frontend-artifact |

## Despliegues

Ambientes principales:

- dev: definido en infra/cloudrun/dev-services.json.
- staging: infraestructura y restauracion base documentadas desde Dia 68.
- prod: backends en infra/cloudrun/prod-backend-services.json, frontends en infra/cloudrun/prod-frontend-services.json, IAM en infra/gcloud/iam-prod.json, secretos en infra/gcloud/secrets-prod.json, Pub/Sub en infra/gcloud/pubsub-prod.json.

Reglas de despliegue:

- Los backends productivos deben permanecer privados.
- Los frontends productivos pueden ser publicos cuando actuan como entrada de usuario.
- Secretos reales no se guardan en el repositorio.
- Cloud SQL usa una base por microservicio y usuarios IAM dedicados.
- Los cambios destructivos o productivos requieren confirmacion explicita y evidencia previa.

## Operacion y mantenimiento

Comandos utiles:

```powershell
cd C:\VENTA-DE-PASAJES
npm run typecheck:frontend
npm run build:frontend
mvn -f .\services\identity-service\pom.xml test
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-cloudrun-prod-backends.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-cloudrun-prod-frontends.ps1
```

No existe pom.xml raiz Maven. Las pruebas backend se ejecutan por servicio o por matriz CI.

## Rutas de referencia

- docs/api-conventions.md
- docs/naming-standards.md
- docs/branching-and-commits.md
- docs/events/catalogo-eventos.md
- docs/events/diseno-pubsub.md
- docs/database
- docs/openapi
- infra/README.md
- docs/onpremise-offline-runbook.md
