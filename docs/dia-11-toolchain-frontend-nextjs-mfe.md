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
- Se actualizo Next.js a `16.3.8` despues de que `npm audit` detectara una vulnerabilidad critica en versiones `16.2.0` a `16.3.5`.
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
| Next.js | `16.3.8` |
| React | `19.2.8` |
| TypeScript | `7.0.2` |
| lucide-react | `1.39.0` |

## Ubicacion para ejecutar los comandos

Todos los comandos de este dia se ejecutan desde la raiz del monorepo:

```powershell
cd C:\VENTA-DE-PASAJES
```

El prompt deberia quedar parecido a:

```text
PS C:\VENTA-DE-PASAJES>
```

Desde ahi se ejecutan `npm install`, `npm run typecheck:frontend`, `npm run build:frontend`, `npm run dev:frontend` y `npm run stop:frontend`.

### Detalle de comandos principales

| Comando | Que hace | Cuando usarlo | Resultado esperado |
| --- | --- | --- | --- |
| `npm install` | Lee el `package.json` raiz y los `package.json` de cada workspace registrado. Instala las dependencias necesarias en `node_modules` y actualiza o respeta `package-lock.json` segun corresponda. | Usarlo despues de clonar el proyecto, despues de cambiar dependencias, despues de actualizar versiones como Next.js, o cuando falte `node_modules`. | Debe terminar sin errores. En el estado actual esperado debe mostrar `found 0 vulnerabilities`. Si muestra vulnerabilidades, revisar con `npm audit` antes de continuar. |
| `npm run typecheck:frontend` | Ejecuta la validacion TypeScript de todos los workspaces frontend registrados en el `package.json` raiz. No genera archivos productivos; solo revisa tipos, imports, rutas y errores de compilacion TypeScript. | Usarlo antes de compilar, despues de tocar codigo `.ts` o `.tsx`, y cada vez que se agregue o modifique un MFE. | Debe ejecutar el `typecheck` de `shared-types`, cada MFE y `frontend-shell` sin errores. Si falla, corregir el primer error reportado antes de seguir. |
| `npm run build:frontend` | Ejecuta el build productivo de los workspaces frontend. Primero valida/construye el paquete compartido y luego compila los MFEs y el shell con Next.js. Genera carpetas `.next` dentro de cada app Next.js. | Usarlo despues de que `typecheck:frontend` pase correctamente, antes de crear imagenes Docker, antes de desplegar o antes de cerrar una tarea frontend. | Cada app debe compilar correctamente. Next.js muestra rutas estaticas y dinamicas generadas. Si falla en un MFE, revisar ese workspace puntual. |
| `npm run dev:frontend` | Ejecuta `scripts\start-frontend-dev.ps1`. Levanta servidores locales de desarrollo para el shell y los MFEs registrados, usando puertos locales. Tambien inyecta variables de entorno necesarias para que el shell encuentre los manifests de los MFEs. | Usarlo cuando quieras probar visualmente el frontend completo en navegador. En el estado actual levanta shell y MFEs en puertos 3000 a 3005. | Debe devolver un resumen JSON con URLs y PIDs. Despues puedes abrir `http://localhost:3000` para el shell. |
| `npm run stop:frontend` | Ejecuta `scripts\stop-frontend-dev.ps1`. Detiene los procesos locales iniciados por `dev:frontend`, usando archivos `.pid` y/o puertos conocidos. | Usarlo cuando termines las pruebas locales, antes de volver a ejecutar `dev:frontend`, o si algun puerto queda ocupado. | Debe devolver un resumen JSON indicando procesos detenidos y puertos restantes. Lo normal es que no queden listeners en 3000 a 3005. |

No ejecutar estos comandos desde `apps\frontend-shell`, `apps\mfe-identity` ni `packages\shared-types`, porque los scripts usan npm workspaces y rutas relativas desde la raiz.

## Workspaces creados en este dia

Esta tabla conserva el estado historico del Dia 11. En ese momento el frontend todavia estaba iniciando y solo existian el shell, el primer MFE y el paquete compartido.

| Workspace | Ruta | Proposito |
| --- | --- | --- |
| `@venta-pasajes/frontend-shell` | `C:\VENTA-DE-PASAJES\apps\frontend-shell` | Shell principal, navegacion y carga de MFEs. |
| `@venta-pasajes/mfe-identity` | `C:\VENTA-DE-PASAJES\apps\mfe-identity` | Primer MFE demo para identidad, usuarios, roles y permisos. |
| `@venta-pasajes/shared-types` | `C:\VENTA-DE-PASAJES\packages\shared-types` | Tipos compartidos, incluyendo contrato de manifest MFE. |

## Workspaces actuales del monorepo

Si repites este dia con el proyecto completo actual, es normal que npm muestre mas workspaces que los 3 originales. El `package.json` raiz actualmente registra:

| Workspace | Ruta | Proposito |
| --- | --- | --- |
| `@venta-pasajes/frontend-shell` | `C:\VENTA-DE-PASAJES\apps\frontend-shell` | Shell principal que compone los MFEs. |
| `@venta-pasajes/mfe-admin` | `C:\VENTA-DE-PASAJES\apps\mfe-admin` | MFE administrativo para salud, diagnosticos, runbooks y controles operativos. |
| `@venta-pasajes/mfe-dispatch` | `C:\VENTA-DE-PASAJES\apps\mfe-dispatch` | MFE de despacho, rutas, salidas y operacion de buses. |
| `@venta-pasajes/mfe-identity` | `C:\VENTA-DE-PASAJES\apps\mfe-identity` | MFE de identidad, usuarios, roles y permisos. |
| `@venta-pasajes/mfe-reporting` | `C:\VENTA-DE-PASAJES\apps\mfe-reporting` | MFE de reportes e indicadores. |
| `@venta-pasajes/mfe-ticketing` | `C:\VENTA-DE-PASAJES\apps\mfe-ticketing` | MFE de venta de boletos y mapa de asientos. |
| `@venta-pasajes/shared-types` | `C:\VENTA-DE-PASAJES\packages\shared-types` | Tipos compartidos entre shell y MFEs. |

Para revisar la lista real en cualquier momento:

```powershell
node -e "const p=require('./package.json'); console.log(p.workspaces.join('\n'))"
```

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

Antes de ejecutar cualquiera de estos bloques, confirmar que estas ubicado en:

```powershell
cd C:\VENTA-DE-PASAJES
```

Instalacion:

```powershell
npm install
```

Resultado:

```text
up to date, audited 50 packages
found 0 vulnerabilities
```

El numero de paquetes puede variar con el tiempo. Lo importante es que el comando termine sin error y que no reporte vulnerabilidades.

Typecheck:

```powershell
npm run typecheck:frontend
```

Resultado:

```text
Resultado historico Dia 11:
@venta-pasajes/shared-types typecheck OK
@venta-pasajes/mfe-identity typecheck OK
@venta-pasajes/frontend-shell typecheck OK

Resultado esperado con el monorepo actual:
@venta-pasajes/shared-types typecheck OK
@venta-pasajes/mfe-identity typecheck OK
@venta-pasajes/mfe-dispatch typecheck OK
@venta-pasajes/mfe-ticketing typecheck OK
@venta-pasajes/mfe-reporting typecheck OK
@venta-pasajes/mfe-admin typecheck OK
@venta-pasajes/frontend-shell typecheck OK
```

Build:

```powershell
npm run build:frontend
```

Resultado:

```text
Resultado historico Dia 11:
mfe-identity compiled successfully
frontend-shell compiled successfully

Resultado esperado con el monorepo actual:
mfe-identity compiled successfully
mfe-dispatch compiled successfully
mfe-ticketing compiled successfully
mfe-reporting compiled successfully
mfe-admin compiled successfully
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

| Archivo | Tipo | Descripcion |
| --- | --- | --- |
| `C:\VENTA-DE-PASAJES\package.json` | Configuracion raiz npm | Declara el monorepo, los workspaces frontend y los scripts principales. Desde aqui salen `npm run dev:frontend`, `npm run stop:frontend`, `npm run typecheck:frontend` y `npm run build:frontend`. En dias posteriores este archivo puede tener mas MFEs registrados. |
| `C:\VENTA-DE-PASAJES\package-lock.json` | Lockfile npm | Congela las versiones instaladas por npm para que otra instalacion use las mismas dependencias base. |
| `C:\VENTA-DE-PASAJES\tsconfig.base.json` | TypeScript compartido | Centraliza reglas TypeScript comunes para apps y paquetes frontend. Cada workspace hereda o replica estas reglas segun su `tsconfig.json`. |
| `C:\VENTA-DE-PASAJES\.env.example` | Plantilla de ambiente raiz | Sirve como referencia general de variables de entorno del proyecto. No debe contener secretos reales. |
| `C:\VENTA-DE-PASAJES\packages\shared-types\package.json` | Paquete compartido | Define `@venta-pasajes/shared-types`, paquete usado por shell y MFEs para compartir contratos TypeScript. |
| `C:\VENTA-DE-PASAJES\packages\shared-types\src\index.ts` | Contratos TypeScript | Define `MicrofrontendManifest` y `MicrofrontendStatus`, el contrato que el shell espera leer desde cada MFE. |
| `C:\VENTA-DE-PASAJES\packages\shared-types\tsconfig.json` | TypeScript del paquete | Configura la validacion TypeScript del paquete compartido. |
| `C:\VENTA-DE-PASAJES\apps\frontend-shell\package.json` | Workspace Next.js | Define el shell como app Next.js y sus scripts locales `dev`, `build`, `start` y `typecheck`. |
| `C:\VENTA-DE-PASAJES\apps\frontend-shell\next.config.ts` | Configuracion Next.js | Configura Next.js para el shell. En este proyecto tambien evita comportamiento autogenerado no deseado mediante `agentRules: false`. |
| `C:\VENTA-DE-PASAJES\apps\frontend-shell\tsconfig.json` | TypeScript del shell | Configura la validacion TypeScript del shell. |
| `C:\VENTA-DE-PASAJES\apps\frontend-shell\.env.example` | Variables del shell | Define las URLs de manifest que el shell debe consultar, por ejemplo `NEXT_PUBLIC_MFE_IDENTITY_MANIFEST_URL`. |
| `C:\VENTA-DE-PASAJES\apps\frontend-shell\app\layout.tsx` | Layout Next.js | Estructura raiz visual del shell. |
| `C:\VENTA-DE-PASAJES\apps\frontend-shell\app\page.tsx` | Pantalla principal | Vista inicial del shell operativo desde donde se presenta o carga la composicion MFE. |
| `C:\VENTA-DE-PASAJES\apps\frontend-shell\app\globals.css` | Estilos globales | Estilos base del shell. |
| `C:\VENTA-DE-PASAJES\apps\frontend-shell\app\components\RemoteMfeFrame.tsx` | Componente de composicion | Consulta el manifest remoto del MFE y renderiza la entrada embebida por iframe. |
| `C:\VENTA-DE-PASAJES\apps\mfe-identity\package.json` | Workspace Next.js | Define el MFE Identity como app Next.js independiente con scripts `dev`, `build`, `start` y `typecheck`. |
| `C:\VENTA-DE-PASAJES\apps\mfe-identity\next.config.ts` | Configuracion Next.js | Configura Next.js para el MFE Identity. |
| `C:\VENTA-DE-PASAJES\apps\mfe-identity\tsconfig.json` | TypeScript del MFE | Configura la validacion TypeScript del MFE Identity. |
| `C:\VENTA-DE-PASAJES\apps\mfe-identity\.env.example` | Variables del MFE | Define la URL publica local del MFE, por ejemplo `NEXT_PUBLIC_MFE_PUBLIC_URL=http://localhost:3001`. |
| `C:\VENTA-DE-PASAJES\apps\mfe-identity\app\layout.tsx` | Layout Next.js | Estructura raiz visual del MFE Identity. |
| `C:\VENTA-DE-PASAJES\apps\mfe-identity\app\page.tsx` | Pagina standalone | Permite abrir el MFE Identity directamente, sin pasar por el shell. |
| `C:\VENTA-DE-PASAJES\apps\mfe-identity\app\globals.css` | Estilos globales | Estilos base del MFE Identity. |
| `C:\VENTA-DE-PASAJES\apps\mfe-identity\app\api\health\route.ts` | Endpoint local | Expone `GET /api/health` para validar que el MFE esta vivo. |
| `C:\VENTA-DE-PASAJES\apps\mfe-identity\app\mfe\manifest\route.ts` | Manifest MFE | Expone `GET /mfe/manifest`, con nombre, version, estado, URL embebida, health URL y capacidades del MFE. |
| `C:\VENTA-DE-PASAJES\apps\mfe-identity\app\identity\embedded\page.tsx` | Entrada embebida | Pantalla que el shell carga dentro del iframe. |
| `C:\VENTA-DE-PASAJES\scripts\start-frontend-dev.ps1` | Script PowerShell de arranque | Arranca los servidores Next.js locales con puertos definidos, valida que los puertos esten libres, inyecta variables de entorno, guarda logs en `C:\VENTA-DE-PASAJES\logs` y registra archivos `.pid` para poder detenerlos luego. En el Dia 11 nacio para shell + identity; en el estado actual del repo tambien arranca los MFEs agregados despues. |
| `C:\VENTA-DE-PASAJES\scripts\stop-frontend-dev.ps1` | Script PowerShell de detencion | Detiene procesos frontend usando los `.pid` generados y, si hace falta, los puertos 3000 a 3005. Luego limpia los archivos `.pid` y devuelve un resumen JSON con procesos detenidos y puertos restantes. |

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

### Paso R5 - Limpiar artefactos generados por build frontend

Este paso elimina archivos generados por `npm run build:frontend` y por validaciones TypeScript. No borra codigo fuente, `package.json`, `package-lock.json` ni archivos `.env.example`.

Artefactos que se pueden eliminar con seguridad:

| Artefacto | Motivo |
| --- | --- |
| `C:\VENTA-DE-PASAJES\apps\*\.next` | Build local generado por Next.js. Puede ocupar bastante espacio y se regenera con `npm run build:frontend` o `npm run dev:frontend`. |
| `C:\VENTA-DE-PASAJES\apps\*\tsconfig.tsbuildinfo` | Cache incremental de TypeScript. Se regenera al ejecutar typecheck o build. |
| `C:\VENTA-DE-PASAJES\packages\*\tsconfig.tsbuildinfo` | Cache incremental de TypeScript en paquetes compartidos. |
| `C:\VENTA-DE-PASAJES\logs\*.dev.log`, `*.dev.err.log`, `*.pid` | Logs y archivos de proceso generados por los scripts de arranque local. |

Primero revisar que se esta en la raiz correcta:

```powershell
cd C:\VENTA-DE-PASAJES
```

Listar los artefactos antes de borrarlos:

```powershell
$ProjectRoot = (Resolve-Path -LiteralPath "C:\VENTA-DE-PASAJES").Path

$GeneratedTargets = @()
$GeneratedTargets += Get-ChildItem -LiteralPath (Join-Path $ProjectRoot "apps") -Directory -Recurse -Force -Filter ".next" -ErrorAction SilentlyContinue
$GeneratedTargets += Get-ChildItem -LiteralPath (Join-Path $ProjectRoot "apps") -File -Recurse -Force -Filter "*.tsbuildinfo" -ErrorAction SilentlyContinue
$GeneratedTargets += Get-ChildItem -LiteralPath (Join-Path $ProjectRoot "packages") -File -Recurse -Force -Filter "*.tsbuildinfo" -ErrorAction SilentlyContinue

$GeneratedTargets |
  Select-Object FullName |
  Format-Table -AutoSize
```

Borrar solo si las rutas listadas estan dentro de `C:\VENTA-DE-PASAJES\apps` o `C:\VENTA-DE-PASAJES\packages`:

```powershell
$AllowedRoots = @(
  (Resolve-Path -LiteralPath (Join-Path $ProjectRoot "apps")).Path,
  (Resolve-Path -LiteralPath (Join-Path $ProjectRoot "packages")).Path
)

foreach ($Target in $GeneratedTargets) {
  if ($null -eq $Target) {
    continue
  }

  $FullName = $Target.FullName
  $IsAllowed = $false

  foreach ($AllowedRoot in $AllowedRoots) {
    if ($FullName.StartsWith($AllowedRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
      $IsAllowed = $true
    }
  }

  if (-not $IsAllowed) {
    throw "Ruta fuera del area permitida: $FullName"
  }

  if ($Target.PSIsContainer) {
    Remove-Item -LiteralPath $FullName -Recurse -Force
  } else {
    Remove-Item -LiteralPath $FullName -Force
  }
}
```

Limpiar logs locales generados por `npm run dev:frontend`:

```powershell
$LogsRootPath = Join-Path $ProjectRoot "logs"

if (Test-Path -LiteralPath $LogsRootPath) {
  $LogsRoot = (Resolve-Path -LiteralPath $LogsRootPath).Path
  $LogTargets = @()
  $LogTargets += Get-ChildItem -LiteralPath $LogsRoot -File -Force -Filter "*.dev.log" -ErrorAction SilentlyContinue
  $LogTargets += Get-ChildItem -LiteralPath $LogsRoot -File -Force -Filter "*.dev.err.log" -ErrorAction SilentlyContinue
  $LogTargets += Get-ChildItem -LiteralPath $LogsRoot -File -Force -Filter "*.pid" -ErrorAction SilentlyContinue

  foreach ($LogTarget in $LogTargets) {
    if ($null -eq $LogTarget) {
      continue
    }

    if (-not $LogTarget.FullName.StartsWith($LogsRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
      throw "Log fuera del area permitida: $($LogTarget.FullName)"
    }

    Remove-Item -LiteralPath $LogTarget.FullName -Force
  }
}
```

Validar que las carpetas `.next` ya no existen:

```powershell
Get-ChildItem -LiteralPath .\apps -Directory -Recurse -Force -Filter ".next" -ErrorAction SilentlyContinue
```

Si el comando no devuelve filas, la limpieza de builds Next.js quedo aplicada.

Opcionalmente, si tambien se quiere recuperar el espacio de dependencias instaladas por `npm install`, se puede borrar `node_modules`. Esto no es un artefacto de build, sino dependencias descargadas; despues habra que volver a ejecutar `npm install`.

```powershell
$NodeModulesPath = Join-Path $ProjectRoot "node_modules"

if (Test-Path -LiteralPath $NodeModulesPath) {
  $NodeModulesFullPath = (Resolve-Path -LiteralPath $NodeModulesPath).Path
  $ExpectedNodeModulesPath = Join-Path $ProjectRoot "node_modules"

  if (-not $NodeModulesFullPath.Equals($ExpectedNodeModulesPath, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Ruta node_modules inesperada: $NodeModulesFullPath"
  }

  Remove-Item -LiteralPath $NodeModulesFullPath -Recurse -Force
}
```

### Paso R6 - Reversa de archivos locales

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
