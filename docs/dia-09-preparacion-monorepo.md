# Dia 9 - Preparacion de repositorio monorepo

Fecha: 2026-09-01

## Objetivo

Preparar la estructura base del monorepo para desarrollar en paralelo microfrontends, microservicios, paquetes compartidos, infraestructura y migracion de datos.

## Tareas ejecutadas

- Se creo la estructura raiz `apps`, `services`, `packages`, `infra`, `migration` y se reutilizo `docs`.
- Se definio el estandar de nombres en `C:\VENTA-DE-PASAJES\docs\naming-standards.md`.
- Se agrego README principal en `C:\VENTA-DE-PASAJES\README.md`.
- Se agregaron convenciones de ramas, commits, pull requests y versionado en `C:\VENTA-DE-PASAJES\docs\branching-and-commits.md`.
- Se agregaron plantillas de variables de ambiente para desarrollo local, servicios backend, frontend, Google Cloud y migracion Access a PostgreSQL.
- Se agregaron README por area para orientar la futura implementacion.
- Se agregaron `.gitkeep` en carpetas vacias para conservar la estructura al inicializar Git.

## Estructura creada

```text
C:\VENTA-DE-PASAJES
  apps
    frontend-shell
    mfe-identity
    mfe-dispatch
    mfe-ticketing
    mfe-reporting
    mfe-admin
  services
    identity-service
    dispatch-service
    ticketing-service
    document-service
    reporting-service
    audit-service
  packages
    ui
    auth-client
    api-client
    shared-types
  infra
    terraform
    cloudbuild
    cloudrun
    env
  migration
    access-to-postgres
  docs
```

## Archivos base

| Archivo | Proposito |
| --- | --- |
| `C:\VENTA-DE-PASAJES\README.md` | Descripcion principal del proyecto, estructura y reglas de trabajo. |
| `C:\VENTA-DE-PASAJES\.gitignore` | Exclusiones iniciales para Node, Java, Quarkus, Terraform, logs, builds y secretos locales. |
| `C:\VENTA-DE-PASAJES\.editorconfig` | Convenciones minimas de formato para editores. |
| `C:\VENTA-DE-PASAJES\.env.example` | Variables comunes para desarrollo local. |
| `C:\VENTA-DE-PASAJES\apps\README.md` | Alcance de shell y microfrontends. |
| `C:\VENTA-DE-PASAJES\services\README.md` | Alcance de microservicios Quarkus. |
| `C:\VENTA-DE-PASAJES\packages\README.md` | Alcance de paquetes compartidos. |
| `C:\VENTA-DE-PASAJES\infra\README.md` | Alcance de infraestructura como codigo y despliegue. |
| `C:\VENTA-DE-PASAJES\migration\README.md` | Alcance de migracion desde Access a PostgreSQL. |

## Plantillas de ambiente

| Archivo | Uso |
| --- | --- |
| `C:\VENTA-DE-PASAJES\.env.example` | Valores comunes no sensibles para desarrollo local. |
| `C:\VENTA-DE-PASAJES\infra\env\backend-service.env.example` | Variables esperadas por microservicios Quarkus. |
| `C:\VENTA-DE-PASAJES\infra\env\frontend-app.env.example` | Variables esperadas por shell y MFEs Next.js. |
| `C:\VENTA-DE-PASAJES\infra\env\google-cloud.env.example` | Variables de proyecto, region y recursos Google Cloud. |
| `C:\VENTA-DE-PASAJES\migration\access-to-postgres\.env.example` | Variables para ejecuciones locales de migracion. |

## Estandar aplicado

- Microfrontends bajo `apps/mfe-<dominio>`.
- Shell principal bajo `apps/frontend-shell`.
- Microservicios bajo `services/<dominio>-service`.
- Paquetes compartidos bajo `packages/<nombre>`.
- Infraestructura bajo `infra/<proveedor-o-recurso>`.
- Migraciones bajo `migration/<origen>-to-<destino>`.
- Bases de datos por servicio con sufijo `_db`.
- APIs bajo `/api/v1`, recursos en plural, JSON en `snake_case` e IDs UUID.
- Eventos en PascalCase y topics `venta-pasajes-{env}-<domain>-events`.

## Decisiones registradas

- Se mantiene monorepo porque el proyecto requiere evolucionar servicios, MFEs, contratos e infraestructura de forma coordinada.
- No se inicializo Git durante este dia porque el workspace original no lo tenia y no se solicito crear repositorio local/remoto.
- Las carpetas de servicios y aplicaciones quedan preparadas pero todavia sin scaffolding tecnico; esa validacion inicia en Dia 10 y Dia 11.
- Las plantillas `.env.example` solo contienen valores ficticios o no sensibles.
- Los contratos OpenAPI, DDL y catalogo de eventos creados en dias anteriores siguen como fuente de verdad inicial para la implementacion.

## Validacion

- Se verifico que la estructura base existe en disco.
- Se verifico que hay README y archivos de convenciones en las areas principales.
- Se verifico que las plantillas de variables de ambiente existen.
- Se verifico que las carpetas vacias relevantes tienen `.gitkeep`.

## Resultado

El proyecto queda listo para desarrollo multi-modulo. El siguiente paso es validar la toolchain backend Quarkus y crear un servicio demo compilable en JVM y nativo.

## Pendientes

- Inicializar Git cuando el equipo confirme estrategia de repositorio.
- Confirmar responsables funcionales y tecnicos.
- Definir valores reales de proyecto Google Cloud, region final y dominios antes de usar ambientes compartidos.
