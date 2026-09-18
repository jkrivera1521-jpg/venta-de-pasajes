# Dia 33 - mfe-ticketing base

Fecha de ejecucion: 2026-09-15

## Objetivo

Crear el microfrontend `mfe-ticketing` para iniciar una venta desde frontend: busqueda de salidas, mapa visual de asientos, formulario de pasajero y confirmacion de boleto emitido.

Alcance del dia:

```text
Crear MFE de boleteria.
Crear buscador de salidas.
Crear mapa visual de asientos.
Crear formulario de pasajero.
Crear confirmacion de venta.
Integrar con shell.
```

## Resultado logrado

```text
Se creo apps\mfe-ticketing como aplicacion Next.js independiente.
El MFE expone manifiesto remoto en /mfe/manifest.
El MFE expone pantalla embebible en /ticketing/embedded.
El MFE usa proxy local /api/ticketing/* hacia ticketing-service.
Se implemento buscador/listado de salidas por fecha y texto.
Se implemento mapa visual inicial de asientos con estados.
Se implemento formulario de pasajero y tarifa.
Se implemento emision de boleto con POST /tickets.
Se implemento confirmacion de venta con numero de boleto.
Se agrego accion para sincronizar una salida demo con availability/sync/departures.
El shell ahora habilita Boleteria y la carga desde el manifiesto de mfe-ticketing.
Los scripts de frontend levantan y detienen mfe-ticketing.
Se agregaron verificadores aislado e integrado para mfe-ticketing.
```

## Arquitectura del dia

```text
frontend-shell
  puerto local: 3000
  lee manifiesto: http://localhost:3003/mfe/manifest
  embebe iframe: http://localhost:3003/ticketing/embedded

mfe-ticketing
  puerto local: 3003
  proxy frontend: /api/ticketing/*
  backend destino: http://localhost:8083/api/v1/ticketing

ticketing-service
  puerto local default: 8083
  endpoints reales: /api/v1/ticketing/*
```

En ambiente local, el navegador llama al MFE:

```text
http://localhost:3003/api/ticketing/availability/departures
```

Luego el proxy del MFE reenvia hacia:

```text
http://localhost:8083/api/v1/ticketing/availability/departures
```

## Archivos creados

```text
C:\VENTA-DE-PASAJES\apps\mfe-ticketing\package.json
C:\VENTA-DE-PASAJES\apps\mfe-ticketing\tsconfig.json
C:\VENTA-DE-PASAJES\apps\mfe-ticketing\next-env.d.ts
C:\VENTA-DE-PASAJES\apps\mfe-ticketing\next.config.ts
C:\VENTA-DE-PASAJES\apps\mfe-ticketing\.env.example
C:\VENTA-DE-PASAJES\apps\mfe-ticketing\app\layout.tsx
C:\VENTA-DE-PASAJES\apps\mfe-ticketing\app\page.tsx
C:\VENTA-DE-PASAJES\apps\mfe-ticketing\app\globals.css
C:\VENTA-DE-PASAJES\apps\mfe-ticketing\app\api\health\route.ts
C:\VENTA-DE-PASAJES\apps\mfe-ticketing\app\api\ticketing\[...path]\route.ts
C:\VENTA-DE-PASAJES\apps\mfe-ticketing\app\ticketing\embedded\page.tsx
C:\VENTA-DE-PASAJES\apps\mfe-ticketing\app\mfe\manifest\route.ts
C:\VENTA-DE-PASAJES\scripts\verify-mfe-ticketing.ps1
C:\VENTA-DE-PASAJES\scripts\verify-mfe-ticketing-stack.ps1
C:\VENTA-DE-PASAJES\docs\dia-33-mfe-ticketing-base.md
```

## Archivos modificados

```text
C:\VENTA-DE-PASAJES\package.json
C:\VENTA-DE-PASAJES\package-lock.json
C:\VENTA-DE-PASAJES\apps\frontend-shell\.env.example
C:\VENTA-DE-PASAJES\apps\frontend-shell\app\page.tsx
C:\VENTA-DE-PASAJES\apps\README.md
C:\VENTA-DE-PASAJES\scripts\start-frontend-dev.ps1
C:\VENTA-DE-PASAJES\scripts\stop-frontend-dev.ps1
C:\VENTA-DE-PASAJES\vitacora.md
```

## Flujo implementado

```text
1. Cargar salidas disponibles desde /availability/departures.
2. Seleccionar una salida.
3. Cargar mapa de asientos desde /availability/departures/{id}/seats.
4. Seleccionar un asiento AVAILABLE.
5. Capturar documento, nombres, contacto y tarifa.
6. Emitir boleto con POST /tickets.
7. Mostrar numero de boleto, asiento y monto.
8. Refrescar mapa para reflejar asiento SOLD.
```

## Reversa primero

### Paso 1 - Detener frontend local

```powershell
cd C:\VENTA-DE-PASAJES
npm run stop:frontend
```

### Paso 2 - Verificar puertos de frontend

```powershell
Get-NetTCPConnection -LocalPort 3000,3001,3002,3003 -ErrorAction SilentlyContinue |
  Select-Object LocalAddress,LocalPort,State,OwningProcess |
  Format-Table -AutoSize
```

### Paso 3 - Detener puertos temporales de validacion

```powershell
Get-NetTCPConnection -LocalPort 3010,3013,18094,55449 -ErrorAction SilentlyContinue |
  Where-Object { $_.State -eq "Listen" } |
  Select-Object -ExpandProperty OwningProcess -Unique |
  ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }
```

### Paso 4 - Eliminar contenedor temporal de validacion

```powershell
docker ps -a --filter "name=venta-pasajes-mfe-ticketing" --format "{{.Names}}"
docker stop venta-pasajes-mfe-ticketing-pg-<pid>
```

## Guia manual desde cero

### Paso 1 - Revisar la tarea

```powershell
cd C:\VENTA-DE-PASAJES
Select-String -Path .\tareas.md -Pattern "### Dia 33|Dia 33" -Context 0,45
```

### Paso 2 - Typecheck

```powershell
npm run typecheck:frontend
```

Resultado real:

```text
shared-types OK
mfe-identity OK
mfe-dispatch OK
mfe-ticketing OK
frontend-shell OK
```

Revalidacion final del MFE tras el ajuste de seleccion de salida demo:

```text
npm run typecheck -w @venta-pasajes/mfe-ticketing: OK
```

### Paso 3 - Build

```powershell
npm run build:frontend
```

Rutas generadas por `mfe-ticketing`:

```text
/
/api/health
/api/ticketing/[...path]
/mfe/manifest
/ticketing/embedded
```

Revalidacion final:

```text
npm run build -w @venta-pasajes/mfe-ticketing: OK
```

### Paso 4 - Validacion aislada

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-mfe-ticketing.ps1 `
  -ShellPort 3010 `
  -MfeTicketingPort 3013
```

Resultado real:

```json
{
  "service": "mfe-ticketing",
  "validation": "manifest-shell-embedded",
  "shell_status": 200,
  "mfe_ticketing_health": "ok",
  "manifest_name": "mfe-ticketing",
  "embedded_status": 200,
  "backend_proxy_status": 502,
  "ready": true
}
```

`backend_proxy_status=502` es esperado cuando `ticketing-service` no esta levantado.

### Paso 5 - Validacion integrada

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-mfe-ticketing-stack.ps1 `
  -DatabasePort 55449 `
  -TicketingHttpPort 18094 `
  -ShellPort 3010 `
  -MfeTicketingPort 3013 `
  -JarPath .\services\ticketing-service\target\quarkus-app-day32\quarkus-run.jar
```

Resultado real:

```json
{
  "service": "mfe-ticketing",
  "validation": "frontend-backend-stack",
  "database": "ticketing_db",
  "database_port": 55449,
  "ticketing_http_port": 18094,
  "shell_status": 200,
  "mfe_ticketing_health": "ok",
  "manifest_name": "mfe-ticketing",
  "embedded_status": 200,
  "backend_proxy_status": 200,
  "ticket_status": "ISSUED",
  "ticket_number": "TKT-0E8F6AE6D83C",
  "seats_available_after_ticket": 1,
  "ready": true
}
```

### Paso 6 - Levantar frontend local

```powershell
npm run dev:frontend
```

Resultado real:

```json
{
  "shell_url": "http://localhost:3000",
  "mfe_identity_url": "http://localhost:3001",
  "mfe_dispatch_url": "http://localhost:3002",
  "mfe_ticketing_url": "http://localhost:3003"
}
```

Abrir:

```text
http://localhost:3000
```

## Peticiones utiles

```powershell
curl.exe -s "http://localhost:3003/api/health"
curl.exe -s "http://localhost:3003/mfe/manifest"
curl.exe -s -o NUL -w "%{http_code}" "http://localhost:3003/ticketing/embedded"
curl.exe -s -o NUL -w "%{http_code}" "http://localhost:3000/"
```

Proxy hacia backend:

```powershell
curl.exe -i -S "http://localhost:3003/api/ticketing/health"
```

## Problemas encontrados y soluciones

| Problema | Causa probable | Solucion |
| --- | --- | --- |
| `backend_proxy_status=502` | `ticketing-service` esta apagado o no escucha en el URL configurado. | Levantar backend o pasar `-TicketingApiUrl` al script de frontend. |
| Docker fallo con puerto `55448`. | Windows tenia el puerto en estado `Bound`. | Se uso `55449` y se ajusto el script integrado para detectar cualquier uso del puerto. |
| No hay salidas disponibles. | La base temporal esta vacia. | Usar la accion `Salida demo`, que llama a `availability/sync/departures`. |
| La emision devuelve `409`. | El asiento ya no esta `AVAILABLE`. | Refrescar mapa y elegir otro asiento libre. |

## Estado final

```text
Dia 33 completado.
mfe-ticketing existe como MFE Next.js independiente.
El shell carga Boleteria desde el manifiesto remoto.
El MFE se comunica con ticketing-service por proxy.
El flujo inicial permite iniciar una venta desde frontend.
La validacion integrada emitio un boleto ISSUED.
El frontend local quedo corriendo en http://localhost:3000.
```

Siguiente paso natural: Dia 34, mapa visual de asientos avanzado.
