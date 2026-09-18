# Dia 11 - Toolchain frontend Next.js MFE

Fecha: 2026-09-01

## Objetivo

Validar la toolchain frontend con Node.js LTS, npm workspaces, Next.js, React, TypeScript y una primera composicion de microfrontend.

## Tareas ejecutadas

- Se verifico Node.js instalado.
- Se verifico npm instalado.
- Se verifico Corepack instalado.
- Se verifico que `pnpm` y `yarn` no estan instalados en PATH.
- Se eligio npm workspaces porque ya esta disponible y evita instalar un gestor adicional.
- Se consultaron versiones de paquetes desde npm registry.
- Se creo `package.json` raiz con workspaces.
- Se creo `tsconfig.base.json`.
- Se creo el paquete compartido `C:\VENTA-DE-PASAJES\packages\shared-types`.
- Se creo `frontend-shell` como app Next.js + React + TypeScript.
- Se creo `mfe-identity` como primer microfrontend Next.js + React + TypeScript.
- Se implemento composicion inicial por manifest remoto e iframe aislado.
- Se agregaron plantillas `.env.example` para shell y MFE.
- Se actualizaron plantillas de ambiente frontend.
- Se agregaron scripts para iniciar y detener frontend local.
- Se instalaron dependencias con `npm install`.
- Se ejecuto typecheck de todos los workspaces frontend.
- Se ejecuto build productivo de shell y MFE.
- Se levantaron servidores locales y se validaron endpoints HTTP.

## Versiones detectadas

| Componente | Version / detalle |
| --- | --- |
| Node.js | `v24.13.0`, LTS `Krypton` |
| npm | `11.6.2` |
| Corepack | `0.34.5` |
| pnpm | No instalado en PATH |
| yarn | No instalado en PATH |
| Next.js | `16.3.4` |
| React | `19.2.8` |
| TypeScript | `7.0.2` |
| lucide-react | `1.39.0` |

## Workspaces creados

| Workspace | Ruta | Proposito |
| --- | --- | --- |
| `@venta-pasajes/frontend-shell` | `C:\VENTA-DE-PASAJES\apps\frontend-shell` | Shell principal, navegacion y carga de MFEs. |
| `@venta-pasajes/mfe-identity` | `C:\VENTA-DE-PASAJES\apps\mfe-identity` | Primer MFE demo para identidad, usuarios, roles y permisos. |
| `@venta-pasajes/shared-types` | `C:\VENTA-DE-PASAJES\packages\shared-types` | Tipos compartidos, incluyendo contrato de manifest MFE. |

## Composicion MFE validada

El shell lee el manifest remoto desde:

```text
NEXT_PUBLIC_MFE_IDENTITY_MANIFEST_URL=http://localhost:3001/mfe/manifest
```

El MFE Identity expone:

```text
GET /mfe/manifest
GET /api/health
GET /identity/embedded
```

Manifest validado:

```json
{
  "name": "mfe-identity",
  "title": "Identidad y accesos",
  "version": "0.1.0",
  "status": "online",
  "mount_path": "/identity",
  "entry_url": "http://localhost:3001/identity/embedded",
  "health_url": "http://localhost:3001/api/health",
  "capabilities": ["usuarios-locales", "roles", "permisos", "google-oidc"]
}
```

## Comandos validados

Instalacion:

```powershell
npm install
```

Resultado:

```text
added 34 packages, and audited 38 packages
found 0 vulnerabilities
```

Typecheck:

```powershell
npm run typecheck:frontend
```

Resultado:

```text
@venta-pasajes/shared-types typecheck OK
@venta-pasajes/mfe-identity typecheck OK
@venta-pasajes/frontend-shell typecheck OK
```

Build:

```powershell
npm run build:frontend
```

Resultado:

```text
mfe-identity compiled successfully
frontend-shell compiled successfully
```

Arranque local:

```powershell
npm run dev:frontend
```

Detencion local:

```powershell
npm run stop:frontend
```

## Rutas locales activas

| App | URL |
| --- | --- |
| `frontend-shell` | `http://localhost:3000` |
| `mfe-identity` | `http://localhost:3001` |
| Manifest MFE Identity | `http://localhost:3001/mfe/manifest` |
| Pantalla embebida MFE Identity | `http://localhost:3001/identity/embedded` |

## Validacion HTTP

| Ruta | Resultado |
| --- | --- |
| `http://localhost:3001/api/health` | `{"status":"ok","service":"mfe-identity"}` |
| `http://localhost:3001/mfe/manifest` | HTTP 200, manifest valido |
| `http://localhost:3001/identity/embedded` | HTTP 200 |
| `http://localhost:3000` | HTTP 200 |

## Archivos principales creados

| Archivo | Proposito |
| --- | --- |
| `C:\VENTA-DE-PASAJES\package.json` | Workspaces y scripts frontend. |
| `C:\VENTA-DE-PASAJES\package-lock.json` | Lockfile npm reproducible. |
| `C:\VENTA-DE-PASAJES\tsconfig.base.json` | Configuracion TypeScript compartida. |
| `C:\VENTA-DE-PASAJES\apps\frontend-shell\app\page.tsx` | Vista inicial del shell operativo. |
| `C:\VENTA-DE-PASAJES\apps\frontend-shell\app\components\RemoteMfeFrame.tsx` | Carga de manifest remoto y render embebido. |
| `C:\VENTA-DE-PASAJES\apps\mfe-identity\app\mfe\manifest\route.ts` | Manifest remoto del MFE Identity. |
| `C:\VENTA-DE-PASAJES\apps\mfe-identity\app\identity\embedded\page.tsx` | Pantalla embebible del MFE Identity. |
| `C:\VENTA-DE-PASAJES\scripts\start-frontend-dev.ps1` | Arranque local de shell + MFE. |
| `C:\VENTA-DE-PASAJES\scripts\stop-frontend-dev.ps1` | Detencion local de shell + MFE. |

## Decisiones registradas

- npm workspaces queda como gestor inicial por disponibilidad local y simplicidad.
- La composicion inicial usa manifest remoto + iframe aislado; mas adelante puede evolucionar a module federation si el equipo lo necesita.
- `@venta-pasajes/shared-types` define el contrato de `MicrofrontendManifest`.
- `agentRules: false` se agrego a `next.config.ts` para evitar archivos autogenerados por Next en cada app.
- `*.tsbuildinfo` se agrego a `.gitignore` como artefacto de TypeScript.
- Las URLs de MFE quedan por variable de entorno, no hardcodeadas para cloud.

## Resultado

La toolchain frontend queda validada. El shell Next.js puede arrancar localmente, consultar el manifest del MFE Identity y componerlo como modulo remoto.

## Pendientes

- Definir si la composicion definitiva se mantendra con iframe/manifest o si se migrara a module federation.
- Convertir el patron de `mfe-identity` en plantilla para los demas MFEs.
- Integrar autenticacion real cuando `identity-service` este disponible.

## Reversa primero

> Estandarizacion documental agregada el 2026-09-16 para que este dia tambien tenga una ruta segura de limpieza antes de repetir la practica.

Este dia pertenece a la etapa inicial del proyecto. Antes de ejecutar una reversa, revisar si el archivo contiene recursos externos reales, como Google Cloud, Docker, bases de datos o imagenes publicadas. No ejecutar comandos destructivos si no estas seguro de que el recurso no esta siendo usado.

### Paso R1 - Ubicarse en el workspace

```powershell
cd C:\VENTA-DE-PASAJES
```

### Paso R2 - Revisar recursos o archivos mencionados

```powershell
Select-String -Path .\docs\dia-11-toolchain-frontend-nextjs-mfe.md -Pattern "C:\\VENTA-DE-PASAJES|docker|gcloud|mvn|npm|Remove-Item|delete|rm|Cloud SQL|Artifact Registry|Secret Manager" -Context 0,2
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
Select-String -Path .\docs\dia-11-toolchain-frontend-nextjs-mfe.md -Pattern "Archivo|Archivos|C:\\VENTA-DE-PASAJES" -Context 0,4
```

Si aun asi necesitas retirar solo este documento de la practica, hacer primero una copia:

```powershell
New-Item -ItemType Directory -Force -Path .\backups | Out-Null
Copy-Item -LiteralPath .\docs\dia-11-toolchain-frontend-nextjs-mfe.md -Destination .\backups\dia-11-toolchain-frontend-nextjs-mfe-manual-backup.md -Force
```

Despues de respaldar, se podria eliminar manualmente el documento con:

```powershell
Remove-Item -LiteralPath .\docs\dia-11-toolchain-frontend-nextjs-mfe.md -Force
```

## Guia manual desde cero

> Estandarizacion documental agregada el 2026-09-16. Esta guia permite repetir el dia sin depender de Codex, usando el documento como fuente de verdad.

### Paso 1 - Ubicarse en el proyecto

```powershell
cd C:\VENTA-DE-PASAJES
```

### Paso 2 - Leer el alcance del dia en el backlog

```powershell
Select-String -Path .\tareas.md -Pattern "Dia 11|Dia 11" -Context 0,40
```

### Paso 3 - Leer la documentacion del dia

```powershell
Get-Content -LiteralPath .\docs\dia-11-toolchain-frontend-nextjs-mfe.md
```

### Paso 4 - Verificar archivos y rutas mencionadas

```powershell
Select-String -Path .\docs\dia-11-toolchain-frontend-nextjs-mfe.md -Pattern "C:\\VENTA-DE-PASAJES" -AllMatches
```

Para cada ruta importante que aparezca en el documento:

```powershell
Test-Path -LiteralPath "<ruta-copiada-del-documento>"
```

### Paso 5 - Ejecutar comandos documentados

Buscar bloques de comandos del documento y ejecutarlos en orden, validando el resultado de cada bloque antes de continuar:

```powershell
Select-String -Path .\docs\dia-11-toolchain-frontend-nextjs-mfe.md -Pattern "```powershell|```text|mvn |npm |docker |gcloud |curl.exe|powershell " -Context 0,6
```

### Paso 6 - Registrar la repeticion en bitacora

```powershell
Add-Content -LiteralPath .\vitacora.md -Value "`nReplica manual Dia 11 - <fecha>: comandos ejecutados y resultado."
```

### Paso 7 - Validar criterio de avance

Revisar la seccion de criterio de avance, resultado, estado final o pendientes del documento:

```powershell
Select-String -Path .\docs\dia-11-toolchain-frontend-nextjs-mfe.md -Pattern "Criterio de avance|Resultado|Estado final|Pendiente|Pendientes" -Context 0,8
```
