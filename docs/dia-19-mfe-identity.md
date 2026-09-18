# Dia 19 - mfe-identity

Fecha: 2026-09-03

## Objetivo

Crear el microfrontend `mfe-identity`, integrarlo con `identity-service` y permitir administrar usuarios locales, perfiles autorizados, roles y permisos desde el frontend.

## Resultado ejecutivo

Dia 19 completado.

`mfe-identity` paso de pantalla demo estatica a consola operativa integrada con `identity-service`.

Funciones implementadas:

- Login local contra `POST /auth/local/login`.
- Boton `Sign in with Google` usando Google Identity Services cuando existe `NEXT_PUBLIC_GOOGLE_CLIENT_ID`.
- Intercambio manual de ID token Google contra `POST /auth/google/exchange`.
- Sesion en `sessionStorage` con JWT interno.
- Lectura de `/me`, `/users`, `/roles`, `/permissions` y `/authorized-identities`.
- Pantalla de usuarios con creacion local/Google/hibrida, asignacion de roles y acciones de activar/suspender.
- Pantalla de identidades autorizadas por correo, dominio o subject Google.
- Flujo de correo Google operativo con rol inicial `TICKET_SELLER`.
- Pantalla de roles con creacion de rol y asignacion de permisos.
- Pantalla de permisos.
- Flujo de recuperacion y cambio de contrasena local.
- Proxy Next.js `/api/identity/*` para evitar CORS entre el navegador y `identity-service`.
- Manifest MFE actualizado con capacidades reales.

## Archivos principales

| Archivo | Proposito |
| --- | --- |
| `C:\VENTA-DE-PASAJES\apps\mfe-identity\app\identity\embedded\page.tsx` | Vista cliente completa del MFE Identity. |
| `C:\VENTA-DE-PASAJES\apps\mfe-identity\app\api\identity\[...path]\route.ts` | Proxy HTTP hacia `identity-service`. |
| `C:\VENTA-DE-PASAJES\apps\mfe-identity\app\globals.css` | Estilos operativos del MFE. |
| `C:\VENTA-DE-PASAJES\apps\mfe-identity\app\mfe\manifest\route.ts` | Manifest remoto con capacidades actualizadas. |
| `C:\VENTA-DE-PASAJES\scripts\start-frontend-dev.ps1` | Arranque local del shell y MFE con `IDENTITY_API_URL`. |
| `C:\VENTA-DE-PASAJES\scripts\verify-mfe-identity-local.ps1` | Verificacion del MFE, manifest, pagina embebida y proxy contra backend temporal. |
| `C:\VENTA-DE-PASAJES\infra\env\frontend-app.env.example` | Variables frontend dev. |
| `C:\VENTA-DE-PASAJES\infra\env\frontend-app.onprem.env.example` | Variables frontend on-premise. |
| `C:\VENTA-DE-PASAJES\apps\README.md` | Guia de composicion frontend actualizada. |

## Rutas del frontend

| Recurso | URL local |
| --- | --- |
| Shell | `http://localhost:3000/` |
| MFE Identity | `http://localhost:3001/identity/embedded` |
| Manifest MFE | `http://localhost:3001/mfe/manifest` |
| Health MFE | `http://localhost:3001/api/health` |
| Proxy Identity | `http://localhost:3001/api/identity/*` |

## Variables

```text
NEXT_PUBLIC_MFE_PUBLIC_URL=http://localhost:3001
NEXT_PUBLIC_MFE_IDENTITY_MANIFEST_URL=http://localhost:3001/mfe/manifest
IDENTITY_API_URL=http://localhost:8081/api/v1/identity
NEXT_PUBLIC_IDENTITY_API_URL=http://localhost:8081/api/v1/identity
NEXT_PUBLIC_GOOGLE_CLIENT_ID=<google-oauth-client-id>
```

`NEXT_PUBLIC_GOOGLE_CLIENT_ID` puede quedar vacio en on-premise/offline si solo se usara login local.

## Arranque local

```powershell
npm run dev:frontend
```

Con puertos explicitos:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-frontend-dev.ps1 `
  -ShellPort 3000 `
  -MfeIdentityPort 3001 `
  -IdentityApiUrl http://localhost:8081/api/v1/identity
```

Si `identity-service` ya esta levantado en `8081`, el MFE puede operar contra ese backend. Para pruebas automatizadas, usar `verify-mfe-identity-local.ps1`.

## Detener shell y MFE

Si el arranque falla con `Port 3000 is already in use` o `Port 3001 is already in use`, primero detener los procesos frontend iniciados por el script:

```powershell
npm run stop:frontend
```

Comando equivalente directo:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\stop-frontend-dev.ps1
```

El script intenta detener procesos por archivos `.pid` y, si hace falta, tambien libera los procesos que esten escuchando en los puertos `3000` y `3001`. Esto es necesario porque Next.js puede iniciar procesos hijos `node.exe`; en ese caso el PID guardado por el script de arranque no siempre coincide con el proceso final que queda escuchando el puerto.

Verificar si los puertos siguen ocupados:

```powershell
Get-NetTCPConnection -LocalPort 3000,3001 -ErrorAction SilentlyContinue
```

Si quieres revisar que procesos estan usando los puertos antes de detenerlos manualmente:

```powershell
$frontendPorts = @(3000, 3001)
$frontendProcessIds = Get-NetTCPConnection -LocalPort $frontendPorts -ErrorAction SilentlyContinue |
  Select-Object -ExpandProperty OwningProcess -Unique

$frontendProcessIds |
  ForEach-Object {
    Get-Process -Id $_ -ErrorAction SilentlyContinue |
      Select-Object Id, ProcessName, Path
  }
```

Si confirmas que esos procesos corresponden a `frontend-shell` y `mfe-identity`, detenerlos manualmente:

```powershell
$frontendProcessIds |
  ForEach-Object {
    Stop-Process -Id $_ -Force
  }
```

Volver a validar que los puertos quedaron libres:

```powershell
Get-NetTCPConnection -LocalPort 3000,3001 -ErrorAction SilentlyContinue
```

Si el shell o el MFE se levantaron en una terminal interactiva con `npm run dev:shell` o `npm run dev:mfe-identity`, tambien se pueden detener desde esa misma terminal con `Ctrl+C`.

## Comandos curl

Health del MFE:

```powershell
curl.exe -s "http://localhost:3001/api/health"
```

Manifest:

```powershell
curl.exe -s "http://localhost:3001/mfe/manifest"
```

Pagina embebida:

```powershell
curl.exe -s -o NUL -w "%{http_code}" "http://localhost:3001/identity/embedded"
```

Shell:

```powershell
curl.exe -s -o NUL -w "%{http_code}" "http://localhost:3000/"
```

Login local mediante proxy del MFE:

```powershell
$loginResponse = curl.exe -s -X POST "http://localhost:3001/api/identity/auth/local/login" `
  -H "Content-Type: application/json" `
  -d '{"login":"admin","password":"<redacted>"}' | ConvertFrom-Json

$accessToken = $loginResponse.access_token
```

Usuario actual mediante proxy:

```powershell
curl.exe -X GET "http://localhost:3001/api/identity/me" `
  -H "Authorization: Bearer $accessToken"
```

Usuarios:

```powershell
curl.exe -X GET "http://localhost:3001/api/identity/users" `
  -H "Authorization: Bearer $accessToken"
```

Roles:

```powershell
curl.exe -X GET "http://localhost:3001/api/identity/roles" `
  -H "Authorization: Bearer $accessToken"
```

Permisos:

```powershell
curl.exe -X GET "http://localhost:3001/api/identity/permissions" `
  -H "Authorization: Bearer $accessToken"
```

Identidades autorizadas:

```powershell
curl.exe -X GET "http://localhost:3001/api/identity/authorized-identities" `
  -H "Authorization: Bearer $accessToken"
```

Crear usuario local:

```powershell
$newUserBody = @{
  identity_type = "LOCAL"
  login = "boleteria.norte"
  email = "boleteria.norte@example.local"
  display_name = "Boleteria Norte"
  temporary_password = "<redacted>"
  role_ids = @("<role-uuid>")
} | ConvertTo-Json -Compress

curl.exe -X POST "http://localhost:3001/api/identity/users" `
  -H "Content-Type: application/json" `
  -H "Authorization: Bearer $accessToken" `
  -d $newUserBody
```

Autorizar correo Google:

```powershell
curl.exe -X POST "http://localhost:3001/api/identity/authorized-identities" `
  -H "Content-Type: application/json" `
  -H "Authorization: Bearer $accessToken" `
  -d '{"type":"EMAIL","value":"usuario@example.com"}'
```

Solicitar recuperacion:

```powershell
curl.exe -X POST "http://localhost:3001/api/identity/password/forgot" `
  -H "Content-Type: application/json" `
  -d '{"login_or_email":"admin"}'
```

## Verificacion automatica

El script requiere que el MFE este sirviendo en `http://localhost:3001`. Luego levanta `identity-service` temporalmente en `8081`, crea un admin bootstrap con secretos generados al vuelo, prueba el proxy y apaga el backend temporal.

```powershell
mvn -f .\services\identity-service\pom.xml package -DskipTests
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-mfe-identity-local.ps1 `
  -MfeIdentityUrl http://localhost:3001 `
  -IdentityHttpPort 8081 `
  -DatabasePort 55434
```

Resultado:

```json
{"service":"mfe-identity","mfe_url":"http://localhost:3001","manifest":"ok","embedded_page_status":200,"identity_proxy":"ok","identity_backend_port":8081,"bootstrap_admin_login":"admin","token_returned":true,"users_count":1,"roles_count":2,"permissions_count":8,"authorized_identities_count":0,"ready":true}
```

## Comandos ejecutados

Revision e inspeccion:

```powershell
$lines = Get-Content -Path tareas.md; $lines[858..910]
rg --files services frontend apps docs infra scripts | sort
Get-Content -Path apps/mfe-identity/package.json
Get-Content -Path apps/mfe-identity/app/page.tsx
Get-Content -Path apps/mfe-identity/app/identity/embedded/page.tsx
Get-Content -Path apps/mfe-identity/app/globals.css
Get-Content -Path apps/frontend-shell/app/page.tsx
Get-Content -Path apps/frontend-shell/app/components/RemoteMfeFrame.tsx
Get-Content -Path apps/mfe-identity/app/mfe/manifest/route.ts
Get-Content -Path apps/mfe-identity/app/layout.tsx
Get-Content -Path apps/mfe-identity/app/api/health/route.ts
Get-Content -Path apps/frontend-shell/package.json
Get-Content -Path package.json
Get-Content -Path tsconfig.base.json
Get-Content -Path apps/README.md
```

Preparacion y verificacion:

```powershell
New-Item -ItemType Directory -Force -Path apps/mfe-identity/app/api/identity/[...path]

npm run typecheck -w @venta-pasajes/mfe-identity
npm run build -w @venta-pasajes/mfe-identity
npm run typecheck -w @venta-pasajes/frontend-shell
npm run build -w @venta-pasajes/frontend-shell

Get-NetTCPConnection -LocalPort 3000,3001 -ErrorAction SilentlyContinue
Get-NetTCPConnection -LocalPort 3010,3011 -ErrorAction SilentlyContinue

powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-frontend-dev.ps1 -ShellPort 3010 -MfeIdentityPort 3011 -IdentityApiUrl http://localhost:8081/api/v1/identity

curl.exe -s "http://localhost:3001/mfe/manifest"
curl.exe -s -o NUL -w "%{http_code}" "http://localhost:3001/identity/embedded"
curl.exe -s -o NUL -w "%{http_code}" "http://localhost:3000/"
curl.exe -s -o NUL -w "%{http_code}" "http://localhost:3001/api/health"

$Errors=$null
[System.Management.Automation.Language.Parser]::ParseFile((Resolve-Path .\scripts\verify-mfe-identity-local.ps1), [ref]$null, [ref]$Errors)

powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-mfe-identity-local.ps1 -MfeIdentityUrl http://localhost:3001 -IdentityHttpPort 8081 -DatabasePort 55434

npm run typecheck:frontend
npm run build:frontend

docker ps --filter "name=venta-pasajes-mfe-identity" --format "table {{.Names}}\t{{.Status}}"
```

Comandos internos relevantes ejecutados por `verify-mfe-identity-local.ps1`:

```powershell
curl.exe -s -o NUL -w "%{http_code}" http://localhost:3001/api/health
curl.exe -s -o NUL -w "%{http_code}" http://localhost:3001/identity/embedded
docker run --rm --name venta-pasajes-mfe-identity-pg-<pid> -e POSTGRES_DB=identity_db -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=<temporary-local-password> -p 55434:5432 -d postgres:16-alpine
docker exec venta-pasajes-mfe-identity-pg-<pid> pg_isready -U postgres -d identity_db
java -jar C:\VENTA-DE-PASAJES\services\identity-service\target\quarkus-app\quarkus-run.jar
Invoke-RestMethod -Uri http://localhost:8081/q/health/ready
Invoke-RestMethod -Uri http://localhost:3001/api/identity/auth/local/login -Method POST -Body <redacted-json>
Invoke-RestMethod -Uri http://localhost:3001/api/identity/me -Headers @{Authorization="Bearer <redacted-token>"}
Invoke-RestMethod -Uri http://localhost:3001/api/identity/users -Headers @{Authorization="Bearer <redacted-token>"}
Invoke-RestMethod -Uri http://localhost:3001/api/identity/roles -Headers @{Authorization="Bearer <redacted-token>"}
Invoke-RestMethod -Uri http://localhost:3001/api/identity/permissions -Headers @{Authorization="Bearer <redacted-token>"}
Invoke-RestMethod -Uri http://localhost:3001/api/identity/authorized-identities -Headers @{Authorization="Bearer <redacted-token>"}
docker stop venta-pasajes-mfe-identity-pg-<pid>
```

## Resultados

```text
@venta-pasajes/mfe-identity typecheck OK
@venta-pasajes/mfe-identity build OK
@venta-pasajes/frontend-shell typecheck OK
@venta-pasajes/frontend-shell build OK
typecheck:frontend OK
build:frontend OK
```

```text
http://localhost:3001/identity/embedded -> 200
http://localhost:3000/ -> 200
http://localhost:3001/api/health -> 200
```

```json
{"service":"mfe-identity","mfe_url":"http://localhost:3001","manifest":"ok","embedded_page_status":200,"identity_proxy":"ok","identity_backend_port":8081,"bootstrap_admin_login":"admin","token_returned":true,"users_count":1,"roles_count":2,"permissions_count":8,"authorized_identities_count":0,"ready":true}
```

## Observaciones

- Los puertos `3000` y `3001` ya estaban ocupados por dev servers existentes de `frontend-shell` y `mfe-identity`; se usaron para validar la carga.
- Un intento de iniciar otros dev servers en `3010/3011` detecto que Next ya tenia dev servers activos para esas mismas apps. Se ajusto `start-frontend-dev.ps1` para no guardar PIDs de procesos que salen inmediatamente.
- No se registraron contrasenas reales, tokens JWT ni peppers.

## Estado

- Criterio de avance del Dia 19 cumplido.
- El shell carga el MFE por manifest.
- `mfe-identity` administra usuarios locales, identidades autorizadas, roles y permisos desde frontend.
- Siguiente paso natural: Dia 20, compilacion nativa de `identity-service`.

## Reversa primero

> Estandarizacion documental agregada el 2026-09-16 para que este dia tambien tenga una ruta segura de limpieza antes de repetir la practica.

Este dia pertenece a la etapa inicial del proyecto. Antes de ejecutar una reversa, revisar si el archivo contiene recursos externos reales, como Google Cloud, Docker, bases de datos o imagenes publicadas. No ejecutar comandos destructivos si no estas seguro de que el recurso no esta siendo usado.

### Paso R1 - Ubicarse en el workspace

```powershell
cd C:\VENTA-DE-PASAJES
```

### Paso R2 - Revisar recursos o archivos mencionados

```powershell
Select-String -Path .\docs\dia-19-mfe-identity.md -Pattern "C:\\VENTA-DE-PASAJES|docker|gcloud|mvn|npm|Remove-Item|delete|rm|Cloud SQL|Artifact Registry|Secret Manager" -Context 0,2
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
Select-String -Path .\docs\dia-19-mfe-identity.md -Pattern "Archivo|Archivos|C:\\VENTA-DE-PASAJES" -Context 0,4
```

Si aun asi necesitas retirar solo este documento de la practica, hacer primero una copia:

```powershell
New-Item -ItemType Directory -Force -Path .\backups | Out-Null
Copy-Item -LiteralPath .\docs\dia-19-mfe-identity.md -Destination .\backups\dia-19-mfe-identity-manual-backup.md -Force
```

Despues de respaldar, se podria eliminar manualmente el documento con:

```powershell
Remove-Item -LiteralPath .\docs\dia-19-mfe-identity.md -Force
```

## Guia manual desde cero

> Estandarizacion documental agregada el 2026-09-16. Esta guia permite repetir el dia sin depender de Codex, usando el documento como fuente de verdad.

### Paso 1 - Ubicarse en el proyecto

```powershell
cd C:\VENTA-DE-PASAJES
```

### Paso 2 - Leer el alcance del dia en el backlog

```powershell
Select-String -Path .\tareas.md -Pattern "Dia 19|Dia 19" -Context 0,40
```

### Paso 3 - Leer la documentacion del dia

```powershell
Get-Content -LiteralPath .\docs\dia-19-mfe-identity.md
```

### Paso 4 - Verificar archivos y rutas mencionadas

```powershell
Select-String -Path .\docs\dia-19-mfe-identity.md -Pattern "C:\\VENTA-DE-PASAJES" -AllMatches
```

Para cada ruta importante que aparezca en el documento:

```powershell
Test-Path -LiteralPath "<ruta-copiada-del-documento>"
```

### Paso 5 - Ejecutar comandos documentados

Buscar bloques de comandos del documento y ejecutarlos en orden, validando el resultado de cada bloque antes de continuar:

```powershell
Select-String -Path .\docs\dia-19-mfe-identity.md -Pattern "```powershell|```text|mvn |npm |docker |gcloud |curl.exe|powershell " -Context 0,6
```

### Paso 6 - Registrar la repeticion en bitacora

```powershell
Add-Content -LiteralPath .\vitacora.md -Value "`nReplica manual Dia 19 - <fecha>: comandos ejecutados y resultado."
```

### Paso 7 - Validar criterio de avance

Revisar la seccion de criterio de avance, resultado, estado final o pendientes del documento:

```powershell
Select-String -Path .\docs\dia-19-mfe-identity.md -Pattern "Criterio de avance|Resultado|Estado final|Pendiente|Pendientes" -Context 0,8
```
