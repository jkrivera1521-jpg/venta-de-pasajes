# Venta de Pasajes

Migracion del sistema legacy de venta de pasajes en Visual Basic 6 y Access hacia una plataforma moderna con microservicios Quarkus, microfrontends Next.js y despliegue objetivo en Google Cloud, manteniendo soporte para ejecucion on-premise/offline.

## Estado actual

Fecha de inicio: 2026-09-01

Avance documentado:

- Dias 1 a 90 documentados en `docs`.
- Monorepo base preparado para desarrollo multi-modulo.
- Toolchain backend Quarkus validada con servicio demo JVM y nativo.
- Toolchain frontend Next.js/MFE validada con shell y MFE Identity demo.
- Bootstrap Google Cloud dev preparado; ejecucion real pendiente de `gcloud`, autenticacion y billing.
- CI base agregado en `.github/workflows/ci.yml` para frontends, servicios backend y guardrails del workspace.
- Pipeline de artefactos frontend agregado en `.github/workflows/frontend-artifacts.yml`.
- Plan de despliegue Cloud Run dev agregado en `infra/cloudrun/dev-services.json` y `scripts/deploy-cloudrun-dev.ps1`.
- Promocion controlada de tags Artifact Registry agregada en `scripts/promote-artifact-image-tags.ps1`.
- Ruta de compilacion nativa de `document-service` agregada en `scripts/build-document-service-native.ps1`.
- `document-service` desplegado en Cloud Run dev con health autenticado validado.
- Ruta de compilacion nativa de `reporting-service` agregada en `scripts/build-reporting-service-native.ps1`.
- Imagen local nativa de `reporting-service` validada con health de contenedor.
- `reporting-service` desplegado en Cloud Run dev con health autenticado validado.
- Ruta de compilacion nativa de `audit-service` agregada en `scripts/build-audit-service-native.ps1`.
- Imagen local nativa de `audit-service` validada con health de contenedor.
- `audit-service` desplegado en Cloud Run dev con health autenticado validado.
- Ruta de imagenes Docker frontend agregada en `scripts/build-frontend-images.ps1`.
- Seis imagenes frontend Next.js publicadas en Artifact Registry con tag `0.1.0-frontend`.
- Frontends desplegados en Cloud Run dev con health, manifiestos MFE y rutas embedded validadas.
- `frontend-shell` actualizado para resolver manifiestos MFE en runtime y no servir URLs `localhost` en Cloud Run.
- MFEs actualizados para invocar backends privados de Cloud Run con identity token service-to-service.
- Ruta JVM backend agregada para Cloud Run dev con imagenes `0.1.1-jvm`.
- Cloud SQL dev preparado con grants de esquema por microservicio y migraciones Flyway activas.
- Backends JVM desplegados en Cloud Run dev con health y consultas funcionales validadas.
- Correcciones UAT verificadas con chequeo integral de Cloud Run dev.
- Staging base creado con Cloud SQL, bucket documental, prueba real de restauracion y RTO inicial documentado.
- Produccion base creada con Cloud SQL, bases por servicio, bucket documental, secretos y Pub/Sub separados de staging.
- IAM produccion endurecido con service accounts productivas, bindings minimos por recurso y verificacion automatica.
- Entrada productiva preparada para dominio, TLS y Load Balancer; URL final pendiente de dominio real y frontend productivo.
- Backends productivos desplegados en Cloud Run como servicios `*-prod`, privados y validados con smoke tests autenticados.
- Frontends productivos desplegados en Cloud Run como servicios `*-prod`; shell, manifests, rutas embedded y admin agregado validados.
- Ensayo de migracion final ejecutado desde Access hacia SQL por microservicio y validado en PostgreSQL temporal desde cero.
- Plan de corte y rollback productivo definido con verificacion automatica y ejecucion real bloqueada hasta aprobacion explicita.
- Paquete de capacitacion operativa creado con manual de usuario, FAQ, registro de capacitacion y verificacion automatica.
- Paquete de migracion final de datos preparado con SQL final, comandos productivos bloqueados por aprobacion y acta pendiente de firma.
- Paquete de prueba productiva controlada preparado con comandos, acta y bloqueo hasta que la migracion final este aplicada y aprobada.
- Paquete de puesta en marcha preparado con acta, registro de incidencias iniciales, monitoreo y bloqueo hasta cierre de Dia 77/Dia 78.
- Paquete de soporte intensivo dia 1 preparado con reporte post-arranque, revision de errores, ventas, reportes y consumo Cloud SQL.
- Paquete de soporte intensivo dia 2 preparado con feedback de boleteria, permisos, impresion, anulaciones y correcciones menores.
- Paquete de soporte intensivo dia 3 preparado con estabilidad, latencia, costos preliminares, seguridad y cierre de incidencias.
- Paquete de optimizacion de costos preparado con reporte mensual estimado, plan de ajustes, presupuesto y alertas.
- Documentacion tecnica final generada con manual tecnico, inventario de servicios, bases, eventos, pipelines y diagramas finales.
- Documentacion operativa final generada con manual operativo, guia rapida de boleteria y evidencia de fuentes verificadas.
- Prueba de restauracion productiva controlada ejecutada en recursos temporales con RTO 17.43 min y RPO 8.43 h.
- Revision de seguridad final cerrada con 6/6 areas listas, backends privados y 0 riesgos criticos abiertos.
- Guia de crecimiento modular creada con plantillas reutilizables para nuevos microservicios Quarkus y nuevos MFEs Next.js.
- Backlog futuro priorizado creado para facturacion electronica, caja avanzada, pagos online, encomiendas y venta web publica.
- Cierre tecnico/documental del proyecto preparado; plataforma tecnica productiva funciona en Google Cloud, pero el cierre funcional 100% queda pendiente por migracion final, prueba controlada, go-live y soporte real.
- Pendiente tecnico identificado: recompilacion nativa backend con Cloud SQL Socket Factory y GraalVM/Mandrel.
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
- `docs/dia-57-despliegue-cloud-run-document-service.md`: despliegue Cloud Run dev de `document-service`.
- `docs/dia-58-compilacion-nativa-reporting-service.md`: compilacion nativa local de `reporting-service`.
- `docs/dia-59-despliegue-cloud-run-reporting-service.md`: publicacion y despliegue Cloud Run dev de `reporting-service`.
- `docs/dia-60-compilacion-nativa-audit-service.md`: compilacion nativa local de `audit-service`.
- `docs/dia-61-despliegue-cloud-run-audit-service.md`: publicacion y despliegue Cloud Run dev de `audit-service`.
- `docs/dia-62-imagenes-docker-frontends.md`: construccion, validacion local y publicacion de imagenes Docker frontend.
- `docs/dia-63-despliegue-cloud-run-frontends.md`: promocion a `dev` y despliegue Cloud Run dev de frontends.
- `docs/dia-64-runtime-config-shell-cloud-run.md`: runtime config del shell y validacion publica sin URLs `localhost`.
- `docs/dia-65-cloud-run-mfe-backend-auth.md`: autenticacion de MFEs hacia backends privados en Cloud Run.
- `docs/dia-66-backends-jvm-cloud-run-flyway.md`: backends JVM en Cloud Run, grants Cloud SQL y migraciones Flyway.
- `docs/dia-67-correcciones-uat.md`: correcciones UAT y verificacion integral del release candidate en Cloud Run dev.
- `docs/dia-68-backups-restauracion-staging.md`: backups, restauracion real staging, RTO inicial y reversa.
- `docs/dia-69-infraestructura-produccion.md`: infraestructura produccion, separacion staging/prod, validacion y reversa.
- `docs/dia-70-iam-produccion-seguridad-final.md`: IAM produccion, seguridad final, validacion y reversa.
- `docs/dia-71-dominio-tls-entrada-productiva.md`: dominio, TLS, entrada productiva, validacion y reversa.
- `docs/dia-72-despliegue-productivo-backend.md`: despliegue productivo de backends Cloud Run, smoke tests y reversa.
- `docs/dia-73-despliegue-productivo-frontend.md`: despliegue productivo de frontend shell y MFEs, validacion y reversa.
- `docs/dia-74-ensayo-migracion-final.md`: copia Access, SQL por microservicio, conteos, tiempo de corte y reversa.
- `docs/dia-75-plan-corte-rollback.md`: plan de corte, rollback, freeze, respaldo final, comunicacion y reversa.
- `docs/dia-76-capacitacion-operativa.md`: capacitacion operativa, manual, FAQ, registro y reversa.
- `docs/manual-usuario-operativo.md`: manual rapido para boleteria, administracion, reportes y soporte.
- `docs/faq-operativa.md`: preguntas frecuentes de operacion.
- `docs/registro-capacitacion-operativa.md`: registro de sesiones, asistencia y firmas.
- `docs/dia-77-migracion-final-datos.md`: migracion final de datos, SQL final, comandos productivos y reversa.
- `docs/acta-validacion-migracion-final.md`: acta para aprobacion de datos migrados.
- `docs/dia-78-prueba-productiva-controlada.md`: prueba productiva controlada, comandos, acta y reversa.
- `docs/acta-prueba-productiva-controlada.md`: acta para salida controlada, venta, PDF, anulacion, reportes y logs.
- `docs/dia-79-puesta-en-marcha.md`: puesta en marcha, accesos reales, monitoreo, incidencias y reversa.
- `docs/acta-puesta-en-marcha.md`: acta para apertura productiva y decision de inicio.
- `docs/registro-incidencias-iniciales.md`: registro operativo de incidencias del arranque.
- `docs/dia-80-soporte-intensivo-dia-1.md`: soporte intensivo dia 1, revision operativa y reversa.
- `docs/reporte-post-arranque-dia-1.md`: reporte post-arranque con errores, ventas, reportes, Cloud SQL y ajustes urgentes.
- `docs/dia-81-soporte-intensivo-dia-2.md`: soporte intensivo dia 2, feedback, permisos, impresion, anulaciones y reversa.
- `docs/reporte-post-arranque-dia-2.md`: reporte post-arranque dia 2 con estabilizacion operativa.
- `docs/dia-82-soporte-intensivo-dia-3.md`: soporte intensivo dia 3, estabilidad, latencia, costos, seguridad y reversa.
- `docs/reporte-post-arranque-dia-3.md`: reporte post-arranque dia 3 y decision de paso a soporte normal.
- `docs/dia-83-optimizacion-costos.md`: optimizacion de costos, min instances, CPU/RAM, almacenamiento, logs, presupuesto y alertas.
- `docs/reporte-costo-mensual-estimado.md`: reporte de costo mensual estimado y plan de ajustes de configuracion.
- `docs/dia-84-documentacion-tecnica-final.md`: documentacion tecnica final, manual, diagramas, inventario y reversa.
- `docs/manual-tecnico.md`: manual tecnico consolidado para mantenimiento del sistema.
- `docs/diagramas-finales.md`: diagramas finales Mermaid de arquitectura, bases, eventos y despliegue.
- `docs/dia-85-documentacion-operativa-final.md`: documentacion operativa final, manual, guia rapida y evidencia.
- `docs/manual-operativo-final.md`: manual operativo consolidado para usuarios, supervisores y soporte.
- `docs/guia-rapida-boleteria.md`: guia corta para venta, anulacion, reimpresion y cierre de turno.
- `docs/dia-86-prueba-restauracion-produccion-controlada.md`: restauracion productiva controlada, RTO/RPO, validacion y reversa.
- `docs/evidencia-restauracion-produccion-controlada.md`: evidencia de restauracion productiva temporal y metricas medidas.
- `docs/procedimiento-restauracion-produccion.md`: procedimiento operativo para repetir la restauracion controlada.
- `docs/dia-87-revision-seguridad-final.md`: revision final de roles, IAM, secretos, APIs, auditoria, backups y reversa.
- `docs/informe-seguridad-final.md`: informe ejecutivo de seguridad final con 0 riesgos criticos abiertos.
- `docs/dia-88-preparacion-crecimiento-modular.md`: preparacion de crecimiento modular, plantillas, generadores y reversa.
- `docs/guia-crecimiento-modular.md`: guia para crear nuevos servicios Quarkus y nuevos MFEs Next.js.
- `docs/dia-89-backlog-siguientes-modulos.md`: backlog de siguientes modulos, estimaciones iniciales y reversa.
- `docs/backlog-futuro-priorizado.md`: orden recomendado de modulos futuros y MVP por modulo.
- `docs/estimaciones-modulos-futuros.md`: esfuerzo inicial, tamano, score y supuestos por modulo futuro.
- `docs/dia-90-cierre-proyecto.md`: cierre del proyecto, criterios, evidencias, acta y reversa.
- `docs/acta-cierre-proyecto.md`: acta de cierre tecnico/documental condicionado y pendientes para cierre funcional.
- `docs/plataforma-funcionando-google-cloud.md`: evidencia de plataforma tecnica productiva funcionando en Google Cloud.
- `docs/backlog-evolucion.md`: resumen ejecutivo del backlog de evolucion posterior.
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

- Ejecutar y aprobar migracion final, prueba productiva controlada, puesta en marcha y soporte post-arranque real para firmar cierre funcional 100%.
- Conectar la entrada TLS con dominio real sobre `frontend-shell-prod`.
- Integrar emision de boleto con generacion/descarga de comprobante.
- Conectar outbox de eventos a Pub/Sub.
