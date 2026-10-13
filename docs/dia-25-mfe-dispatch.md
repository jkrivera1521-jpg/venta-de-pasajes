# Dia 25 - mfe-dispatch

Fecha de ejecucion: 2026-09-10

## Objetivo

Crear el microfrontend `mfe-dispatch` para administrar desde navegador los recursos operativos del dominio de despacho:

```text
terminales
rutas
tipos de bus
buses
layouts de asientos
salidas programadas
```

## Resultado logrado

```text
Se creo `apps/mfe-dispatch` como aplicacion Next.js independiente.
El MFE expone manifiesto remoto en `/mfe/manifest`.
El MFE expone pantalla embebible en `/dispatch/embedded`.
El MFE usa proxy local `/api/dispatch/*` hacia `dispatch-service`.
El shell puede navegar entre `mfe-identity` y `mfe-dispatch`.
Los scripts `npm run dev:frontend`, `npm run build:frontend` y `npm run typecheck:frontend` incluyen `mfe-dispatch`.
```

## Arquitectura del dia

```text
frontend-shell
  puerto local: 3000
  lee manifiesto: http://localhost:3002/mfe/manifest
  embebe iframe: http://localhost:3002/dispatch/embedded

mfe-dispatch
  puerto local: 3002
  proxy frontend: /api/dispatch/*
  backend destino: http://localhost:8082/api/v1/dispatch

dispatch-service
  puerto local default: 8082
  endpoints reales: /api/v1/dispatch/*
```

En ambiente local, el navegador no llama directamente a `dispatch-service`.
El navegador llama al MFE:

```text
http://localhost:3002/api/dispatch/terminals
```

Luego el proxy del MFE reenvia la peticion al backend:

```text
http://localhost:8082/api/v1/dispatch/terminals
```

## Archivos creados

```text
C:\VENTA-DE-PASAJES\apps\mfe-dispatch\package.json
C:\VENTA-DE-PASAJES\apps\mfe-dispatch\tsconfig.json
C:\VENTA-DE-PASAJES\apps\mfe-dispatch\next-env.d.ts
C:\VENTA-DE-PASAJES\apps\mfe-dispatch\next.config.ts
C:\VENTA-DE-PASAJES\apps\mfe-dispatch\.env.example
C:\VENTA-DE-PASAJES\apps\mfe-dispatch\app\layout.tsx
C:\VENTA-DE-PASAJES\apps\mfe-dispatch\app\page.tsx
C:\VENTA-DE-PASAJES\apps\mfe-dispatch\app\globals.css
C:\VENTA-DE-PASAJES\apps\mfe-dispatch\app\api\health\route.ts
C:\VENTA-DE-PASAJES\apps\mfe-dispatch\app\api\dispatch\[...path]\route.ts
C:\VENTA-DE-PASAJES\apps\mfe-dispatch\app\dispatch\embedded\page.tsx
C:\VENTA-DE-PASAJES\apps\mfe-dispatch\app\mfe\manifest\route.ts
C:\VENTA-DE-PASAJES\scripts\verify-mfe-dispatch.ps1
C:\VENTA-DE-PASAJES\scripts\verify-mfe-dispatch-stack.ps1
C:\VENTA-DE-PASAJES\docs\dia-25-mfe-dispatch.md
```

## Archivos modificados

```text
C:\VENTA-DE-PASAJES\package.json
C:\VENTA-DE-PASAJES\package-lock.json
C:\VENTA-DE-PASAJES\scripts\start-frontend-dev.ps1
C:\VENTA-DE-PASAJES\scripts\stop-frontend-dev.ps1
C:\VENTA-DE-PASAJES\apps\frontend-shell\.env.example
C:\VENTA-DE-PASAJES\apps\frontend-shell\app\page.tsx
C:\VENTA-DE-PASAJES\apps\frontend-shell\app\components\RemoteMfeFrame.tsx
C:\VENTA-DE-PASAJES\apps\frontend-shell\app\globals.css
C:\VENTA-DE-PASAJES\apps\README.md
C:\VENTA-DE-PASAJES\vitacora.md
```

## Reversa primero

### Paso 1 - Detener frontend local

```powershell
cd C:\VENTA-DE-PASAJES
npm run stop:frontend
```

### Paso 2 - Verificar puertos de frontend

```powershell
Get-NetTCPConnection -LocalPort 3000,3001,3002 -ErrorAction SilentlyContinue |
  Select-Object LocalAddress,LocalPort,State,OwningProcess |
  Format-Table -AutoSize
```

Si el comando no retorna filas, esos puertos estan libres.

### Paso 3 - Detener puertos temporales de validacion

```powershell
Get-NetTCPConnection -LocalPort 3010,3012,18088,55440 -ErrorAction SilentlyContinue |
  Where-Object { $_.State -eq "Listen" } |
  Select-Object -ExpandProperty OwningProcess -Unique |
  ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }
```

### Paso 4 - Eliminar contenedor temporal de validacion

```powershell
docker ps -a --filter "name=venta-pasajes-mfe-dispatch" --format "{{.Names}}"
docker stop venta-pasajes-mfe-dispatch-pg-<pid>
```

El nombre real termina con el PID del proceso que ejecuto el script.

### Paso 5 - Limpiar artefactos de build

```powershell
Remove-Item -LiteralPath .\apps\mfe-dispatch\.next -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath .\apps\frontend-shell\.next -Recurse -Force -ErrorAction SilentlyContinue
```

### Paso 6 - Reversa de codigo

Si se quiere revertir el Dia 25 manualmente, eliminar o restaurar estos cambios:

```text
Eliminar carpeta: C:\VENTA-DE-PASAJES\apps\mfe-dispatch
Eliminar scripts: verify-mfe-dispatch.ps1 y verify-mfe-dispatch-stack.ps1
Quitar workspace: apps/mfe-dispatch de package.json
Quitar scripts: dev:mfe-dispatch y referencias en build/typecheck
Restaurar start-frontend-dev.ps1 para levantar solo shell e identity
Restaurar stop-frontend-dev.ps1 para detener solo 3000 y 3001
Restaurar frontend-shell para usar solo NEXT_PUBLIC_MFE_IDENTITY_MANIFEST_URL
Ejecutar npm install para regenerar package-lock.json
```

## Guia manual desde cero

### Paso 1 - Revisar la tarea

```powershell
cd C:\VENTA-DE-PASAJES
Select-String -Path .\tareas.md -Pattern "Dia 25|mfe-dispatch" -Context 0,28
```

### Paso 2 - Crear carpetas del MFE

```powershell
New-Item -ItemType Directory -Force -Path `
  .\apps\mfe-dispatch\app\api\dispatch\[...path], `
  .\apps\mfe-dispatch\app\api\health, `
  .\apps\mfe-dispatch\app\dispatch\embedded, `
  .\apps\mfe-dispatch\app\mfe\manifest
```

### Paso 3 - Crear configuracion de Next.js

Crear:

```text
C:\VENTA-DE-PASAJES\apps\mfe-dispatch\package.json
C:\VENTA-DE-PASAJES\apps\mfe-dispatch\tsconfig.json
C:\VENTA-DE-PASAJES\apps\mfe-dispatch\next-env.d.ts
C:\VENTA-DE-PASAJES\apps\mfe-dispatch\next.config.ts
C:\VENTA-DE-PASAJES\apps\mfe-dispatch\.env.example
```

Validar:

```powershell
Get-Content .\apps\mfe-dispatch\package.json
Get-Content .\apps\mfe-dispatch\next.config.ts
Get-Content .\apps\mfe-dispatch\.env.example
```

### Paso 4 - Crear el manifiesto remoto

Archivo:

```text
C:\VENTA-DE-PASAJES\apps\mfe-dispatch\app\mfe\manifest\route.ts
```

El manifiesto debe devolver:

```text
name: mfe-dispatch
title: Despacho operativo
mount_path: /dispatch
entry_url: http://localhost:3002/dispatch/embedded
health_url: http://localhost:3002/api/health
```

Importante:

```text
Este endpoint existe solo cuando el servidor Next de `mfe-dispatch` esta levantado.
Si todavia no ejecutaste `npm run dev:mfe-dispatch` o `npm run dev:frontend`, el puerto 3002 estara cerrado y curl mostrara "Could not connect to server".
```

Para probarlo inmediatamente en este punto, abrir una segunda consola y levantar solo el MFE:

```powershell
cd C:\VENTA-DE-PASAJES
npm run dev:mfe-dispatch
```

Dejar esa consola abierta. Luego, desde otra consola, validar con:

```powershell
curl.exe -sS "http://localhost:3002/mfe/manifest"
```

Cuando termines la prueba, detener la consola de `npm run dev:mfe-dispatch` con `Ctrl + C`.

Si prefieres seguir la guia sin levantar servidores todavia, omitir esta validacion y continuar con el Paso 5.

### Paso 5 - Crear el proxy del MFE

Archivo:

```text
C:\VENTA-DE-PASAJES\apps\mfe-dispatch\app\api\dispatch\[...path]\route.ts
```

Responsabilidad:

```text
Recibir /api/dispatch/*
Agregar X-Actor-User-Id y X-Correlation-Id
Reenviar hacia DISPATCH_API_URL
Responder al navegador con el status y body del backend
```

Variables usadas:

```text
DISPATCH_API_URL=http://localhost:8082/api/v1/dispatch
NEXT_PUBLIC_DISPATCH_API_URL=http://localhost:8082/api/v1/dispatch
```

### Paso 6 - Crear la pantalla embebible

Archivo:

```text
C:\VENTA-DE-PASAJES\apps\mfe-dispatch\app\dispatch\embedded\page.tsx
```

Vistas implementadas:

```text
Terminales: formulario + tabla + desactivacion.
Rutas: formulario + tabla + desactivacion.
Tipos: formulario + tabla + desactivacion.
Buses: formulario + tabla + desactivacion.
Layouts: formulario + tabla + vista de asientos.
Salidas: formulario + tabla + cancelacion.
```

### Paso 7 - Crear estilos del MFE

Archivo:

```text
C:\VENTA-DE-PASAJES\apps\mfe-dispatch\app\globals.css
```

Validar que no haya texto desbordado:

```powershell
npm run build -w @venta-pasajes/mfe-dispatch
```

### Paso 8 - Registrar workspace npm

Editar `C:\VENTA-DE-PASAJES\package.json`:

```json
"workspaces": [
  "apps/frontend-shell",
  "apps/mfe-dispatch",
  "apps/mfe-identity",
  "packages/shared-types"
]
```

Agregar scripts:

```json
"dev:mfe-dispatch": "npm run dev -w @venta-pasajes/mfe-dispatch -- --hostname 127.0.0.1 -p 3002"
```

Actualizar build y typecheck:

```json
"build:frontend": "npm run build -w @venta-pasajes/shared-types && npm run build -w @venta-pasajes/mfe-identity && npm run build -w @venta-pasajes/mfe-dispatch && npm run build -w @venta-pasajes/frontend-shell",
"typecheck:frontend": "npm run typecheck -w @venta-pasajes/shared-types && npm run typecheck -w @venta-pasajes/mfe-identity && npm run typecheck -w @venta-pasajes/mfe-dispatch && npm run typecheck -w @venta-pasajes/frontend-shell"
```

Regenerar lockfile:

```powershell
npm install
```

### Paso 9 - Integrar con shell

Archivos:

```text
C:\VENTA-DE-PASAJES\apps\frontend-shell\app\page.tsx
C:\VENTA-DE-PASAJES\apps\frontend-shell\app\components\RemoteMfeFrame.tsx
C:\VENTA-DE-PASAJES\apps\frontend-shell\.env.example
```

Variable nueva:

```text
NEXT_PUBLIC_MFE_DISPATCH_MANIFEST_URL=http://localhost:3002/mfe/manifest
```

El shell debe permitir alternar:

```text
Identidad -> http://localhost:3001/mfe/manifest
Despachos -> http://localhost:3002/mfe/manifest
```

### Paso 10 - Actualizar scripts de arranque y parada

Arranque:

```text
C:\VENTA-DE-PASAJES\scripts\start-frontend-dev.ps1
```

Debe aceptar:

```powershell
[int]$MfeDispatchPort = 3002
[string]$DispatchApiUrl = "http://localhost:8082/api/v1/dispatch"
```

Parada:

```text
C:\VENTA-DE-PASAJES\scripts\stop-frontend-dev.ps1
```

Debe detener:

```powershell
[int[]]$Ports = @(3000, 3001, 3002)
```

### Paso 11 - Typecheck

```powershell
npm run typecheck:frontend
```

Resultado esperado:

```text
shared-types OK
mfe-identity OK
mfe-dispatch OK
frontend-shell OK
```

### Paso 12 - Build

```powershell
npm run build:frontend
```

Resultado esperado:

```text
mfe-identity build OK
mfe-dispatch build OK
frontend-shell build OK
```

Rutas esperadas de `mfe-dispatch`:

```text
/
/api/dispatch/[...path]
/api/health
/dispatch/embedded
/mfe/manifest
```

### Paso 13 - Validacion aislada de frontend

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-mfe-dispatch.ps1 `
  -ShellPort 3010 `
  -MfeDispatchPort 3012
```

Resultado esperado:

```json
{
  "service": "mfe-dispatch",
  "validation": "manifest-shell-embedded",
  "shell_status": 200,
  "mfe_dispatch_health": "ok",
  "manifest_name": "mfe-dispatch",
  "embedded_status": 200,
  "backend_proxy_status": 502,
  "ready": true
}
```

`backend_proxy_status=502` es esperado si `dispatch-service` no esta levantado.

### Paso 14 - Validacion integrada con backend temporal

Primero asegurarse de que exista el artefacto JVM del Dia 24:

```powershell
Test-Path .\services\dispatch-service\target\quarkus-app-day24\quarkus-run.jar
```

Si no existe:

```powershell
mvn -f .\services\dispatch-service\pom.xml package -DskipTests "-Dquarkus.package.output-directory=quarkus-app-day24"
```

Ejecutar validacion integrada:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-mfe-dispatch-stack.ps1 `
  -DatabasePort 55440 `
  -DispatchHttpPort 18088 `
  -ShellPort 3010 `
  -MfeDispatchPort 3012
```

Resultado esperado:

```json
{
  "service": "mfe-dispatch",
  "validation": "frontend-backend-stack",
  "database": "dispatch_db",
  "database_port": 55440,
  "dispatch_http_port": 18088,
  "shell_status": 200,
  "mfe_dispatch_health": "ok",
  "manifest_name": "mfe-dispatch",
  "embedded_status": 200,
  "backend_proxy_status": 200,
  "ready": true
}
```

### Paso 15 - Levantar frontend para uso manual

```powershell
npm run dev:frontend
```

Salida esperada:

```json
{
  "shell_url": "http://localhost:3000",
  "mfe_identity_url": "http://localhost:3001",
  "mfe_dispatch_url": "http://localhost:3002"
}
```

Abrir:

```text
http://localhost:3000
```

### Paso 16 - Detener frontend manual

```powershell
npm run stop:frontend
```

Verificar:

```powershell
Get-NetTCPConnection -LocalPort 3000,3001,3002 -ErrorAction SilentlyContinue |
  Select-Object LocalAddress,LocalPort,State,OwningProcess |
  Format-Table -AutoSize
```

## Peticiones HTTP/HTTPS listas con curl.exe

### Antes de ejecutar estas peticiones

Estas peticiones pasan por el MFE:

```text
navegador o curl -> http://localhost:3002/api/dispatch/* -> dispatch-service -> PostgreSQL
```

Por eso deben estar vivos:

```text
mfe-dispatch en 3002
dispatch-service en 8082
PostgreSQL de dispatch_db en el puerto configurado
```

Validar puertos:

```powershell
Get-NetTCPConnection -LocalPort 3002,8082,5432,55437 -ErrorAction SilentlyContinue |
  Select-Object LocalAddress,LocalPort,State,OwningProcess |
  Format-Table -AutoSize
```

Validar el MFE:

```powershell
curl.exe -i -S "http://localhost:3002/api/health"
```

Validar el backend:

```powershell
curl.exe -i -S "http://localhost:8082/q/health/ready"
```

Si el backend responde `503` con un mensaje parecido a:

```text
Connection to localhost:5432 refused
```

significa que `dispatch-service` esta levantado, pero esta buscando PostgreSQL en `localhost:5432` y tu base esta en otro puerto o apagada.

Ejemplo: si tu contenedor PostgreSQL se llama `venta-pasajes-dispatch-crud-manual` y esta publicado en `55437`, reinicia `dispatch-service` asi:

```powershell
cd C:\VENTA-DE-PASAJES

Get-NetTCPConnection -LocalPort 8082 -ErrorAction SilentlyContinue |
  Where-Object { $_.State -eq "Listen" } |
  Select-Object -ExpandProperty OwningProcess -Unique |
  ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }

$env:QUARKUS_PROFILE = "onprem"
$env:QUARKUS_HTTP_PORT = "8082"
$env:APP_ENV = "local"
$env:APP_RUNTIME_TARGET = "onprem"
$env:APP_SECRETS_PROVIDER = "env"
$env:APP_DB_NAME = "dispatch_db"
$env:APP_DB_JDBC_URL = "jdbc:postgresql://localhost:55437/dispatch_db"
$env:APP_DB_USERNAME = "postgres"
$env:APP_DB_PASSWORD = (docker exec venta-pasajes-dispatch-crud-manual printenv POSTGRES_PASSWORD).Trim()
$env:QUARKUS_FLYWAY_MIGRATE_AT_START = "true"
$env:APP_LOG_CONSOLE_JSON = "false"

mvn -f .\services\dispatch-service\pom.xml quarkus:dev
```

Deja esa consola abierta. En otra consola valida:

```powershell
curl.exe -i -S "http://localhost:8082/q/health/ready"
curl.exe -i -S "http://localhost:3002/api/dispatch/health"
```

Cuando ambas devuelvan `200`, continua con las peticiones siguientes.

### Variables

```powershell
$mfeDispatchUrl = "http://localhost:3002"
$shellUrl = "http://localhost:3000"
$baseUrl = "$mfeDispatchUrl/api/dispatch"
$actorId = "00000000-0000-0000-0000-000000000025"
$correlationId = [guid]::NewGuid().ToString()
```

### Health del MFE

```powershell
curl.exe -i -S "$mfeDispatchUrl/api/health"
```

### Manifiesto del MFE

```powershell
curl.exe -sS "$mfeDispatchUrl/mfe/manifest"
```

### Pantalla embebible del MFE

```powershell
curl.exe -i -S "$mfeDispatchUrl/dispatch/embedded"
```

### Shell

```powershell
curl.exe -i -S "$shellUrl/"
```

### Proxy hacia dispatch-service

```powershell
curl.exe -i -S "$baseUrl/health"
```

Si `dispatch-service` esta apagado, este comando devuelve `502`.
Si `dispatch-service` esta levantado, debe devolver `200`.

### Listar terminales

```powershell
curl.exe -sS "$baseUrl/terminals?page=1&page_size=10"
```

### Crear terminal origen desde el MFE proxy

```powershell
$originBody = @{
  legacy_id = 2501
  local_code = "D25O"
  name = "Terminal Origen Dia 25"
  manager_name = "Operador Origen"
  address = "Av. Origen Dia 25"
  phone = "022500001"
  email = "origen25@example.local"
} | ConvertTo-Json -Compress

$originBodyPath = Join-Path $env:TEMP "dispatch-mfe-origin-terminal.json"
$originBody | Set-Content -LiteralPath $originBodyPath -Encoding ascii

$origin = curl.exe -sS -X POST "$baseUrl/terminals" `
  -H "Content-Type: application/json" `
  -H "X-Actor-User-Id: $actorId" `
  -H "X-Correlation-Id: $correlationId" `
  --data-binary "@$originBodyPath" |
  ConvertFrom-Json

$origin
```

### Crear terminal destino desde el MFE proxy

```powershell
$destinationBody = @{
  legacy_id = 2502
  local_code = "D25D"
  name = "Terminal Destino Dia 25"
  manager_name = "Operador Destino"
  address = "Av. Destino Dia 25"
  phone = "022500002"
  email = "destino25@example.local"
} | ConvertTo-Json -Compress

$destinationBodyPath = Join-Path $env:TEMP "dispatch-mfe-destination-terminal.json"
$destinationBody | Set-Content -LiteralPath $destinationBodyPath -Encoding ascii

$destination = curl.exe -sS -X POST "$baseUrl/terminals" `
  -H "Content-Type: application/json" `
  -H "X-Actor-User-Id: $actorId" `
  -H "X-Correlation-Id: $correlationId" `
  --data-binary "@$destinationBodyPath" |
  ConvertFrom-Json

$destination
```

### Crear ruta

```powershell
$routeBody = @{
  origin_terminal_id = $origin.id
  destination_terminal_id = $destination.id
  name = "Ruta Dia 25"
} | ConvertTo-Json -Compress

$routeBodyPath = Join-Path $env:TEMP "dispatch-mfe-route.json"
$routeBody | Set-Content -LiteralPath $routeBodyPath -Encoding ascii

$route = curl.exe -sS -X POST "$baseUrl/routes" `
  -H "Content-Type: application/json" `
  -H "X-Actor-User-Id: $actorId" `
  -H "X-Correlation-Id: $correlationId" `
  --data-binary "@$routeBodyPath" |
  ConvertFrom-Json

$route
```

### Crear tipo de bus

```powershell
$busTypeBody = @{
  legacy_id = 2501
  name = "Tipo Dia 25"
  description = "Tipo creado desde mfe-dispatch"
} | ConvertTo-Json -Compress

$busTypeBodyPath = Join-Path $env:TEMP "dispatch-mfe-bus-type.json"
$busTypeBody | Set-Content -LiteralPath $busTypeBodyPath -Encoding ascii

$busType = curl.exe -sS -X POST "$baseUrl/bus-types" `
  -H "Content-Type: application/json" `
  -H "X-Actor-User-Id: $actorId" `
  -H "X-Correlation-Id: $correlationId" `
  --data-binary "@$busTypeBodyPath" |
  ConvertFrom-Json

$busType
```

### Obtener layout seed de 25 asientos

```powershell
$seedLayoutPage = curl.exe -sS "$baseUrl/seat-layouts?q=Legacy%2025%20asientos&active=true&page=1&page_size=10" |
  ConvertFrom-Json

$seedLayout = $seedLayoutPage.data[0]
$seedLayout
```

### Crear bus

```powershell
$busBody = @{
  legacy_id = 2501
  code = "BUS-D25"
  plate = "PBD-2501"
  description = "Bus creado desde mfe-dispatch"
  default_destination = "Ruta Dia 25"
  bus_type_id = $busType.id
  terminal_id = $origin.id
  seat_layout_id = $seedLayout.id
} | ConvertTo-Json -Compress

$busBodyPath = Join-Path $env:TEMP "dispatch-mfe-bus.json"
$busBody | Set-Content -LiteralPath $busBodyPath -Encoding ascii

$bus = curl.exe -sS -X POST "$baseUrl/buses" `
  -H "Content-Type: application/json" `
  -H "X-Actor-User-Id: $actorId" `
  -H "X-Correlation-Id: $correlationId" `
  --data-binary "@$busBodyPath" |
  ConvertFrom-Json

$bus
```

### Programar salida

```powershell
$departureAt = (Get-Date).AddDays(1).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")

$departureBody = @{
  legacy_id = 2501
  bus_id = $bus.id
  route_id = $route.id
  departure_at = $departureAt
  notes = "Salida creada desde mfe-dispatch"
} | ConvertTo-Json -Compress

$departureBodyPath = Join-Path $env:TEMP "dispatch-mfe-departure.json"
$departureBody | Set-Content -LiteralPath $departureBodyPath -Encoding ascii

$departure = curl.exe -sS -X POST "$baseUrl/departures" `
  -H "Content-Type: application/json" `
  -H "X-Actor-User-Id: $actorId" `
  -H "X-Correlation-Id: $correlationId" `
  --data-binary "@$departureBodyPath" |
  ConvertFrom-Json

$departure
```

### Listar salidas

```powershell
curl.exe -sS "$baseUrl/departures?page=1&page_size=10" |
  ConvertFrom-Json
```

### Cancelar salida

```powershell
$cancelBody = @{
  reason = "Cancelada desde curl por prueba Dia 25"
} | ConvertTo-Json -Compress

$cancelBodyPath = Join-Path $env:TEMP "dispatch-mfe-cancel-departure.json"
$cancelBody | Set-Content -LiteralPath $cancelBodyPath -Encoding ascii

curl.exe -sS -X POST "$baseUrl/departures/$($departure.id)/cancel" `
  -H "Content-Type: application/json" `
  -H "X-Actor-User-Id: $actorId" `
  -H "X-Correlation-Id: $correlationId" `
  --data-binary "@$cancelBodyPath" |
  ConvertFrom-Json
```

## Comandos ejecutados durante la practica

```powershell
Select-String -Path .\tareas.md -Pattern "Dia 25|Dia 25" -Context 0,28
Get-ChildItem -Recurse -Depth 3 .\apps
Get-Content .\apps\frontend-shell\app\page.tsx
Get-Content .\apps\frontend-shell\app\components\RemoteMfeFrame.tsx
Get-Content .\apps\mfe-identity\app\mfe\manifest\route.ts
Get-Content -LiteralPath '.\apps\mfe-identity\app\api\identity\[...path]\route.ts'
Get-Content .\services\dispatch-service\src\main\resources\application.properties
New-Item -ItemType Directory -Force -Path .\apps\mfe-dispatch\app\api\dispatch\[...path], .\apps\mfe-dispatch\app\api\health, .\apps\mfe-dispatch\app\dispatch\embedded, .\apps\mfe-dispatch\app\mfe\manifest
npm install
npm run typecheck:frontend
npm run build:frontend
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-mfe-dispatch.ps1 -ShellPort 3010 -MfeDispatchPort 3012
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-mfe-dispatch-stack.ps1 -DatabasePort 55440 -DispatchHttpPort 18088 -ShellPort 3010 -MfeDispatchPort 3012
Get-NetTCPConnection -LocalPort 3010,3012,18088,55440 -ErrorAction SilentlyContinue | Select-Object LocalAddress,LocalPort,State,OwningProcess | Format-Table -AutoSize
docker ps -a --filter "name=venta-pasajes-mfe-dispatch" --format "{{.Names}}"
```

Comandos internos relevantes de `verify-mfe-dispatch-stack.ps1`:

```powershell
docker run --rm --name venta-pasajes-mfe-dispatch-pg-<pid> -e POSTGRES_DB=dispatch_db -e POSTGRES_USER=postgres -e "POSTGRES_PASSWORD=<temporary-local-password>" -p "55440:5432" -d postgres:16-alpine
docker exec venta-pasajes-mfe-dispatch-pg-<pid> pg_isready -U postgres -d dispatch_db
Start-Process -FilePath "java" -ArgumentList @("-jar", "C:\VENTA-DE-PASAJES\services\dispatch-service\target\quarkus-app-day24\quarkus-run.jar") -WindowStyle Hidden -PassThru
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-mfe-dispatch.ps1 -ShellPort 3010 -MfeDispatchPort 3012 -DispatchApiUrl "http://localhost:18088/api/v1/dispatch"
curl.exe -i -S "http://localhost:3012/api/health"
curl.exe -sS "http://localhost:3012/mfe/manifest"
curl.exe -i -S "http://localhost:3012/dispatch/embedded"
curl.exe -i -S "http://localhost:3010/"
curl.exe -i -S "http://localhost:3012/api/dispatch/health"
Stop-Process -Id <java-process-id> -Force
docker stop venta-pasajes-mfe-dispatch-pg-<pid>
```

## Problemas encontrados y soluciones

### Problema 1 - El shell solo cargaba Identity

Antes del Dia 25, `RemoteMfeFrame` usaba una URL fija:

```text
NEXT_PUBLIC_MFE_IDENTITY_MANIFEST_URL
```

Solucion:

```text
RemoteMfeFrame ahora recibe manifestUrl como propiedad.
El shell mantiene el modulo activo en estado local.
El menu permite alternar entre Identidad y Despachos.
```

### Problema 2 - `npm run dev:frontend` levantaba solo dos aplicaciones

Antes:

```text
frontend-shell -> 3000
mfe-identity -> 3001
```

Ahora:

```text
frontend-shell -> 3000
mfe-identity -> 3001
mfe-dispatch -> 3002
```

### Problema 3 - Validar MFE sin backend

Si `dispatch-service` esta apagado:

```text
El MFE carga.
El manifiesto carga.
La pantalla carga.
El proxy devuelve 502.
```

Solucion:

```text
Se creo verify-mfe-dispatch-stack.ps1 para levantar PostgreSQL y dispatch-service temporales.
Con backend temporal el proxy devuelve 200.
```

### Problema 4 - Nombres de campos

`dispatch-service` usa:

```properties
quarkus.jackson.property-naming-strategy=SNAKE_CASE
```

Por eso el MFE envia:

```text
legacy_id
local_code
bus_type_id
seat_layout_id
departure_at
```

## Resultado de validaciones

Typecheck:

```text
shared-types OK
mfe-identity OK
mfe-dispatch OK
frontend-shell OK
```

Build:

```text
mfe-identity: BUILD OK
mfe-dispatch: BUILD OK
frontend-shell: BUILD OK
```

Validacion aislada:

```json
{
  "service": "mfe-dispatch",
  "validation": "manifest-shell-embedded",
  "shell_status": 200,
  "mfe_dispatch_health": "ok",
  "manifest_name": "mfe-dispatch",
  "embedded_status": 200,
  "backend_proxy_status": 502,
  "ready": true
}
```

Validacion integrada:

```json
{
  "service": "mfe-dispatch",
  "validation": "frontend-backend-stack",
  "database": "dispatch_db",
  "database_port": 55440,
  "dispatch_http_port": 18088,
  "shell_status": 200,
  "mfe_dispatch_health": "ok",
  "manifest_name": "mfe-dispatch",
  "embedded_status": 200,
  "backend_proxy_status": 200,
  "ready": true
}
```

Limpieza:

```text
No quedaron listeners en 3010, 3012, 18088 ni 55440.
No quedo contenedor temporal venta-pasajes-mfe-dispatch.
```

## Estado final

```text
Dia 25 completado.
mfe-dispatch existe como MFE Next.js independiente.
El shell lo carga desde su manifiesto remoto.
El MFE se comunica con dispatch-service por proxy.
La administracion operativa base ya funciona desde frontend.
```

Siguiente paso natural:

```text
Dia 26 - Compilacion nativa de dispatch-service.
```
