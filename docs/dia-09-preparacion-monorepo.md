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

## Reversa primero

> Estandarizacion documental agregada el 2026-09-16 para que este dia tambien tenga una ruta segura de limpieza antes de repetir la practica.

Este dia pertenece a la etapa inicial del proyecto. Antes de ejecutar una reversa, revisar si el archivo contiene recursos externos reales, como Google Cloud, Docker, bases de datos o imagenes publicadas. No ejecutar comandos destructivos si no estas seguro de que el recurso no esta siendo usado.

### Paso R1 - Ubicarse en el workspace

```powershell
cd C:\VENTA-DE-PASAJES
```

### Paso R2 - Revisar recursos o archivos mencionados

```powershell
Select-String -Path .\docs\dia-09-preparacion-monorepo.md -Pattern "C:\\VENTA-DE-PASAJES|docker|gcloud|mvn|npm|Remove-Item|delete|rm|Cloud SQL|Artifact Registry|Secret Manager" -Context 0,2
```

### Paso R3 - Detener procesos locales si este dia levanto herramientas

```powershell
Get-NetTCPConnection -LocalPort 3000,3001,3002,3003,8081,8082,8083,18083,18089,18096 -ErrorAction SilentlyContinue |
  Select-Object LocalAddress,LocalPort,State,OwningProcess |
  Format-Table -AutoSize

Get-CimInstance Win32_Process -Filter "name = 'java.exe' or name = 'node.exe'" |
  Select-Object ProcessId,CommandLine |
  Format-List
```

Si identificas un proceso propio de la practica, detenerlo:

```powershell
Stop-Process -Id <process-id> -Force
```

### Paso R4 - Revisar contenedores temporales

```powershell
docker ps -a --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}" |
  Select-String -Pattern "venta-pasajes|identity|dispatch|ticketing|native|postgres"
```

Si el contenedor fue creado solo para repetir este dia y no se usa en otra practica:

```powershell
docker rm -f <container-name>
```

### Paso R5 - Reversa de archivos locales

La reversa de archivos debe hacerse con control de cambios o backup. Este workspace inicio sin Git en los primeros dias, por eso no se recomienda borrar archivos a ciegas.

```powershell
Select-String -Path .\docs\dia-09-preparacion-monorepo.md -Pattern "Archivo|Archivos|C:\\VENTA-DE-PASAJES" -Context 0,4
```

Si aun asi necesitas retirar solo este documento de la practica, hacer primero una copia:

```powershell
New-Item -ItemType Directory -Force -Path .\backups | Out-Null
Copy-Item -LiteralPath .\docs\dia-09-preparacion-monorepo.md -Destination .\backups\dia-09-preparacion-monorepo-manual-backup.md -Force
```

Despues de respaldar, se podria eliminar manualmente el documento con:

```powershell
Remove-Item -LiteralPath .\docs\dia-09-preparacion-monorepo.md -Force
```

## Guia manual desde cero

> Estandarizacion documental agregada el 2026-09-16. Esta guia permite repetir el dia sin depender de Codex, usando el documento como fuente de verdad.

### Paso 1 - Ubicarse en el proyecto

```powershell
cd C:\VENTA-DE-PASAJES
```

### Paso 2 - Leer el alcance del dia en el backlog

```powershell
Select-String -Path .\tareas.md -Pattern "Dia 9|Dia 09" -Context 0,40
```

### Paso 3 - Leer la documentacion del dia

```powershell
Get-Content -LiteralPath .\docs\dia-09-preparacion-monorepo.md
```

### Paso 4 - Verificar archivos y rutas mencionadas

```powershell
Select-String -Path .\docs\dia-09-preparacion-monorepo.md -Pattern "C:\\VENTA-DE-PASAJES" -AllMatches
```

Para cada ruta importante que aparezca en el documento:

```powershell
Test-Path -LiteralPath "<ruta-copiada-del-documento>"
```

### Paso 5 - Ejecutar comandos documentados

Buscar bloques de comandos del documento y ejecutarlos en orden, validando el resultado de cada bloque antes de continuar:

```powershell
Select-String -Path .\docs\dia-09-preparacion-monorepo.md -Pattern "```powershell|```text|mvn |npm |docker |gcloud |curl.exe|powershell " -Context 0,6
```

### Paso 6 - Registrar la repeticion en bitacora

```powershell
Add-Content -LiteralPath .\vitacora.md -Value "`nReplica manual Dia 9 - <fecha>: comandos ejecutados y resultado."
```

### Paso 7 - Validar criterio de avance

Revisar la seccion de criterio de avance, resultado, estado final o pendientes del documento:

```powershell
Select-String -Path .\docs\dia-09-preparacion-monorepo.md -Pattern "Criterio de avance|Resultado|Estado final|Pendiente|Pendientes" -Context 0,8
```
