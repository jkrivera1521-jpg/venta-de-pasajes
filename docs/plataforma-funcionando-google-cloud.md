# Plataforma funcionando en Google Cloud

Generado: 2026-09-30T10:56:33.1930512-05:00

Esta evidencia confirma la plataforma tecnica desplegada y saludable en Google Cloud. No reemplaza la aprobacion de negocio de migracion final, prueba productiva controlada ni puesta en marcha real.

## Estado ejecutivo

| Indicador | Estado |
|---|---|
| Infraestructura prod | OK |
| Backends prod Cloud Run | OK |
| Frontends prod Cloud Run | OK |
| Plataforma tecnica funcionando en Google Cloud | OK |
| Plataforma tecnica lista | OK |
| Operacion funcional 100% | OK |

## Backends productivos

| Servicio | Cloud Run | Estado | URL | Health |
|---|---|---|---|---|
| identity-service | identity-service-prod | OK | https://identity-service-prod-io7kxgn6yq-uc.a.run.app | 200 |
| dispatch-service | dispatch-service-prod | OK | https://dispatch-service-prod-io7kxgn6yq-uc.a.run.app | 200 |
| ticketing-service | ticketing-service-prod | OK | https://ticketing-service-prod-io7kxgn6yq-uc.a.run.app | 200 |
| document-service | document-service-prod | OK | https://document-service-prod-io7kxgn6yq-uc.a.run.app | 200 |
| reporting-service | reporting-service-prod | OK | https://reporting-service-prod-io7kxgn6yq-uc.a.run.app | 200 |
| audit-service | audit-service-prod | OK | https://audit-service-prod-io7kxgn6yq-uc.a.run.app | 200 |

## Frontends productivos

| MFE | Cloud Run | Estado | URL |
|---|---|---|---|
| mfe-identity | mfe-identity-prod | OK | https://mfe-identity-prod-io7kxgn6yq-uc.a.run.app |
| mfe-dispatch | mfe-dispatch-prod | OK | https://mfe-dispatch-prod-io7kxgn6yq-uc.a.run.app |
| mfe-ticketing | mfe-ticketing-prod | OK | https://mfe-ticketing-prod-io7kxgn6yq-uc.a.run.app |
| mfe-reporting | mfe-reporting-prod | OK | https://mfe-reporting-prod-io7kxgn6yq-uc.a.run.app |
| mfe-admin | mfe-admin-prod | OK | https://mfe-admin-prod-io7kxgn6yq-uc.a.run.app |
| frontend-shell | frontend-shell-prod | OK | https://frontend-shell-prod-io7kxgn6yq-uc.a.run.app |

## Evidencia de resiliencia y seguridad

- Cloud SQL prod: venta-pasajes-prod-sql, estado RUNNABLE, backups activos True.
- Bucket documental prod: venta-pasajes-prod-documents, acceso publico prevenido enforced.
- Restauracion controlada: RTO 17.43 minutos, RPO 8.43 horas.
- Seguridad final: 0 riesgos criticos abiertos.
- Smoke tests backend: 6/6.
- Checks frontend: 19/19.

## Lectura correcta

La plataforma tecnica ya esta funcionando en Google Cloud. Para declarar operacion funcional al 100%, primero deben cerrarse los pendientes listados en docs\acta-cierre-proyecto.md.
