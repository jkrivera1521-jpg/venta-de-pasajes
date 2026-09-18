# Venta de Pasajes

Migracion del sistema legacy de venta de pasajes en Visual Basic 6 y Access hacia una plataforma moderna con microservicios Quarkus, microfrontends Next.js y despliegue objetivo en Google Cloud, manteniendo soporte para ejecucion on-premise/offline.

## Estado actual

Fecha de inicio: 2026-09-01

Avance documentado:

- Dias 1 a 55 documentados en `docs`.
- Monorepo base preparado para desarrollo multi-modulo.
- Toolchain backend Quarkus validada con servicio demo JVM y nativo.
- Toolchain frontend Next.js/MFE validada con shell y MFE Identity demo.
- Bootstrap Google Cloud dev preparado; ejecucion real pendiente de `gcloud`, autenticacion y billing.
- CI base agregado en `.github/workflows/ci.yml` para frontends, servicios backend y guardrails del workspace.
- Pipeline de artefactos frontend agregado en `.github/workflows/frontend-artifacts.yml`.
- Plan de despliegue Cloud Run dev agregado en `infra/cloudrun/dev-services.json` y `scripts/deploy-cloudrun-dev.ps1`.
- Promocion controlada de tags Artifact Registry agregada en `scripts/promote-artifact-image-tags.ps1`.
- El sistema legacy se conserva en `legacy`.
- Los respaldos iniciales se guardan en `backups`.
- La bitacora operativa vive en `vitacora.md`.

## Estructura

```text
apps/
  frontend-shell/
  mfe-identity/
  mfe-dispatch/
  mfe-ticketing/
  mfe-reporting/
  mfe-admin/
services/
  identity-service/
  dispatch-service/
  ticketing-service/
  document-service/
  reporting-service/
  audit-service/
packages/
  ui/
  auth-client/
  api-client/
  shared-types/
infra/
  terraform/
  cloudbuild/
  cloudrun/
  env/
migration/
  access-to-postgres/
docs/
legacy/
backups/
```

## Aplicaciones frontend

- `frontend-shell`: entrada principal, sesion, layout, menu y carga de microfrontends.
- `mfe-identity`: usuarios, identidades Google/locales, roles y permisos.
- `mfe-dispatch`: terminales, rutas, tipos de bus, buses, layouts y salidas.
- `mfe-ticketing`: busqueda de salidas, mapa de asientos, venta, anulacion y reimpresion.
- `mfe-reporting`: reportes operativos y exportaciones.
- `mfe-admin`: parametros, auditoria, salud y administracion complementaria.

## Servicios backend

- `identity-service`: autenticacion, usuarios, roles, permisos e identidades autorizadas.
- `dispatch-service`: terminales, rutas, buses, layouts y salidas.
- `ticketing-service`: pasajeros, disponibilidad, reservas, boletos y anulaciones.
- `document-service`: plantillas, PDFs y almacenamiento documental.
- `reporting-service`: modelos de lectura y reportes.
- `audit-service`: auditoria funcional inmutable.

## Documentacion principal

- `vitacora.md`: registro de trabajo ejecutado.
- `docs/dia-05-definicion-dominios-microservicios.md`: limites de dominio.
- `docs/dia-06-diseno-contratos-api.md`: contratos API.
- `docs/dia-07-diseno-eventos-mensajeria.md`: eventos y Pub/Sub.
- `docs/dia-08-diseno-modelo-postgresql.md`: modelo PostgreSQL por servicio.
- `docs/dia-09-preparacion-monorepo.md`: estructura inicial de monorepo.
- `docs/dia-10-toolchain-backend-quarkus.md`: validacion Java, Maven, Quarkus y build nativo.
- `docs/dia-11-toolchain-frontend-nextjs-mfe.md`: validacion Node, npm, Next.js y composicion MFE.
- `docs/dia-12-infraestructura-google-cloud-base.md`: bootstrap Google Cloud dev, APIs y presupuesto.
- `docs/dia-37-document-service.md`: generacion de PDF de boleto, storage y evento `DocumentGenerated`.
- `docs/onpremise-offline-runbook.md`: guia para correr servicios sin dependencia de Google Cloud.
- `docs/api-conventions.md`: convenciones REST.
- `docs/naming-standards.md`: estandar de nombres.
- `docs/branching-and-commits.md`: ramas y commits.

## Reglas de trabajo

- No guardar secretos reales en el repositorio.
- Usar Secret Manager en Google Cloud y variables/archivo local seguro fuera del repo en on-premise.
- Mantener una base por microservicio.
- No crear claves foraneas entre bases de distintos servicios.
- Conservar `legacy_id` solo para trazabilidad de migracion.
- Registrar cada avance relevante en `vitacora.md`.
- Convertir los DDL de `docs/database` en migraciones versionadas cuando se creen los servicios.

## Proximos pasos

- Integrar emision de boleto con generacion/descarga de comprobante.
- Conectar outbox de eventos a Pub/Sub.
- Crear imagenes faltantes para servicios/documentos/reportes/auditoria y frontends antes del despliegue Cloud Run completo.
