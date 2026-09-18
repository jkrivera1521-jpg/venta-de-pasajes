# Dia 35 - Flujo completo de venta en frontend

Fecha de ejecucion: 2026-09-15

## Objetivo

Cerrar el flujo operativo de venta desde `mfe-ticketing`, conectando seleccion de salida, asiento, pasajero, confirmacion, errores claros y refresco de disponibilidad despues de emitir un boleto.

Alcance del dia:

```text
Integrar busqueda de salida.
Integrar seleccion de asiento.
Integrar pasajero.
Integrar confirmacion.
Mostrar errores claros.
Refrescar disponibilidad despues de venta.
```

## Resultado logrado

```text
El panel de venta ahora muestra salida, asiento y estado del asiento seleccionado.
Se agrego un progreso visual de venta: Salida, Asiento, Pasajero y Confirmacion.
El boton Emitir boleto solo se habilita cuando hay salida, asiento libre, pasajero completo y tarifa valida.
El frontend valida asiento libre antes del POST de venta.
Los datos de pasajero se envian saneados con trim y la moneda se normaliza a mayusculas.
Despues de una venta exitosa se refresca la salida seleccionada y el mapa de asientos.
Cuando hay conflicto o asiento no disponible se refresca el mapa y se muestra un error accionable.
El verificador integrado valida venta completa, asiento SOLD, disponibilidad refrescada y duplicado HTTP 409.
```

## Archivos creados

```text
C:\VENTA-DE-PASAJES\docs\dia-35-flujo-completo-venta-frontend.md
```

## Archivos modificados

```text
C:\VENTA-DE-PASAJES\apps\mfe-ticketing\app\ticketing\embedded\page.tsx
C:\VENTA-DE-PASAJES\apps\mfe-ticketing\app\globals.css
C:\VENTA-DE-PASAJES\scripts\verify-mfe-ticketing.ps1
C:\VENTA-DE-PASAJES\scripts\verify-mfe-ticketing-stack.ps1
C:\VENTA-DE-PASAJES\vitacora.md
```

## Valores usados

```text
Shell dev: http://localhost:3000
MFE identity dev: http://localhost:3001
MFE dispatch dev: http://localhost:3002
MFE ticketing dev: http://localhost:3003

Shell validacion: http://localhost:3010
MFE ticketing validacion: http://localhost:3013

ticketing-service manual: http://localhost:8083/api/v1/ticketing
ticketing-service validacion: http://localhost:18095/api/v1/ticketing
PostgreSQL validacion: localhost:55451
Base temporal: ticketing_db

Jar usado en la validacion:
C:\VENTA-DE-PASAJES\services\ticketing-service\target\quarkus-app-day32\quarkus-run.jar
```

## Reversa primero

Esta seccion sirve para limpiar el ambiente antes de repetir la practica desde cero.

### Paso R1 - Detener frontend dev

Si se levanto el frontend con `npm run dev:frontend`, detenerlo asi:

```powershell
cd C:\VENTA-DE-PASAJES

npm run stop:frontend
```

Si se usaron puertos alternos de validacion:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\stop-frontend-dev.ps1 `
  -Ports @(3000,3001,3002,3003,3010,3013)
```

Verificar:

```powershell
Get-NetTCPConnection -LocalPort 3000,3001,3002,3003,3010,3013 -ErrorAction SilentlyContinue |
  Select-Object LocalAddress,LocalPort,State,OwningProcess |
  Format-Table -AutoSize
```

### Paso R2 - Detener backend manual o de validacion

Revisar procesos escuchando en los puertos de `ticketing-service`:

```powershell
Get-NetTCPConnection -LocalPort 8083,18095 -ErrorAction SilentlyContinue |
  Select-Object LocalAddress,LocalPort,State,OwningProcess |
  Format-Table -AutoSize
```

Si el proceso corresponde a esta practica, detenerlo:

```powershell
Stop-Process -Id <process-id> -Force
```

Revisar procesos Java:

```powershell
Get-CimInstance Win32_Process -Filter "name = 'java.exe'" |
  Select-Object ProcessId,CommandLine |
  Format-List
```

### Paso R3 - Detener PostgreSQL temporal

El script integrado usa contenedores con nombre `venta-pasajes-mfe-ticketing-pg-<pid>` y los limpia al finalizar. Si quedo alguno:

```powershell
docker ps -a --filter "name=venta-pasajes-mfe-ticketing-pg" --format "{{.Names}}" |
  ForEach-Object { docker rm -f $_ }
```

Si se levanto una base manual para ticketing:

```powershell
docker ps -a --filter "name=venta-pasajes-ticketing" --format "{{.Names}}" |
  ForEach-Object { docker rm -f $_ }
```

Verificar:

```powershell
docker ps -a --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}" |
  Select-String -Pattern "ticketing|mfe-ticketing"
```

### Paso R4 - Liberar puertos de base y backend

```powershell
Get-NetTCPConnection -LocalPort 55451,8083,18095 -ErrorAction SilentlyContinue |
  Select-Object LocalAddress,LocalPort,State,OwningProcess |
  Format-Table -AutoSize
```

Si aparece un proceso propio de la practica, detenerlo:

```powershell
Stop-Process -Id <process-id> -Force
```

### Paso R5 - Limpiar builds frontend opcional

Ejecutar solo si quieres forzar builds frescos. Detener primero cualquier `next dev` o `next start`.

```powershell
Remove-Item -LiteralPath .\apps\mfe-ticketing\.next -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath .\apps\frontend-shell\.next -Recurse -Force -ErrorAction SilentlyContinue
```

## Guia manual desde cero

### Paso 1 - Ubicarse en el proyecto

```powershell
cd C:\VENTA-DE-PASAJES
```

Validar herramientas:

```powershell
node -v
npm -v
java -version
mvn -version
docker version
```

Si faltan dependencias Node:

```powershell
npm install
```

### Paso 2 - Preparar `ticketing-service`

Ejecutar pruebas del backend:

```powershell
mvn -f .\services\ticketing-service\pom.xml test
```

Empaquetar el jar JVM usado por la validacion:

```powershell
mvn -f .\services\ticketing-service\pom.xml package `
  -DskipTests `
  "-Dquarkus.package.output-directory=quarkus-app-day32"
```

Verificar que existe:

```powershell
Test-Path .\services\ticketing-service\target\quarkus-app-day32\quarkus-run.jar
```

### Paso 3 - Validar frontend

```powershell
npm run typecheck:frontend
npm run build -w @venta-pasajes/mfe-ticketing
npm run build -w @venta-pasajes/frontend-shell
```

Resultado logrado en este dia:

```text
npm run typecheck:frontend: OK
npm run build -w @venta-pasajes/mfe-ticketing: OK
```

### Paso 4 - Ejecutar validacion integrada asistida

Este comando levanta PostgreSQL temporal, `ticketing-service`, shell y `mfe-ticketing`; luego prueba una venta completa por el proxy del MFE.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-mfe-ticketing-stack.ps1 `
  -DatabasePort 55451 `
  -TicketingHttpPort 18095 `
  -ShellPort 3010 `
  -MfeTicketingPort 3013 `
  -JarPath .\services\ticketing-service\target\quarkus-app-day32\quarkus-run.jar
```

Resultado logrado en este dia:

```json
{"service":"mfe-ticketing","validation":"frontend-backend-stack","database":"ticketing_db","database_port":55451,"ticketing_http_port":18095,"shell_url":"http://localhost:3010","shell_status":200,"mfe_ticketing_url":"http://localhost:3013","mfe_ticketing_health":"ok","manifest_name":"mfe-ticketing","embedded_status":200,"backend_proxy_status":200,"ticket_status":"ISSUED","ticket_number":"TKT-1554635BFCCC","seats_available_after_ticket":1,"seats_sold_after_ticket":2,"sold_seat_status":"SOLD","duplicate_ticket_http_status":409,"availability_refreshed_after_ticket":true,"ready":true}
```

### Paso 5 - Levantar backend manual para operar la pantalla

Crear PostgreSQL temporal:

```powershell
$DatabasePort = 55451
$TicketingHttpPort = 8083
$ContainerName = "venta-pasajes-ticketing-dev-pg-manual"
$PostgresPassword = "ticketing_dev_manual_123"

docker run --rm --name $ContainerName `
  -e POSTGRES_DB=ticketing_db `
  -e POSTGRES_USER=postgres `
  -e "POSTGRES_PASSWORD=$PostgresPassword" `
  -p "$DatabasePort`:5432" `
  -d postgres:16-alpine
```

Esperar PostgreSQL:

```powershell
docker exec $ContainerName pg_isready -U postgres -d ticketing_db
```

Configurar variables y levantar `ticketing-service`:

```powershell
$env:QUARKUS_PROFILE = "onprem"
$env:QUARKUS_HTTP_PORT = "$TicketingHttpPort"
$env:APP_ENV = "local"
$env:APP_RUNTIME_TARGET = "onprem"
$env:APP_SECRETS_PROVIDER = "env"
$env:APP_DB_NAME = "ticketing_db"
$env:APP_DB_JDBC_URL = "jdbc:postgresql://localhost:$DatabasePort/ticketing_db"
$env:APP_DB_USERNAME = "postgres"
$env:APP_DB_PASSWORD = $PostgresPassword
$env:QUARKUS_FLYWAY_MIGRATE_AT_START = "true"
$env:APP_LOG_CONSOLE_JSON = "false"

java -jar .\services\ticketing-service\target\quarkus-app-day32\quarkus-run.jar
```

En otra terminal, validar:

```powershell
curl.exe -sS "http://localhost:8083/q/health/ready"
curl.exe -sS "http://localhost:8083/api/v1/ticketing/health"
```

### Paso 6 - Levantar shell y MFEs en modo dev

En otra terminal:

```powershell
cd C:\VENTA-DE-PASAJES

npm run dev:frontend
```

El script levanta:

```text
frontend-shell: http://localhost:3000
mfe-identity:   http://localhost:3001
mfe-dispatch:   http://localhost:3002
mfe-ticketing:  http://localhost:3003
```

Validar endpoints del MFE:

```powershell
curl.exe -sS "http://localhost:3003/api/health"
curl.exe -sS "http://localhost:3003/mfe/manifest"
curl.exe -i -S "http://localhost:3003/api/ticketing/health"
```

Abrir:

```text
http://localhost:3000
```

### Paso 7 - Ejecutar venta manual en la UI

```text
1. Entrar a Boleteria.
2. Presionar Actualizar o Sincronizar salida demo si no hay salidas.
3. Seleccionar una salida.
4. Seleccionar un asiento libre.
5. Verificar que el progreso muestre Salida, Asiento y Pasajero.
6. Completar documento, nombre, apellido, correo, telefono, monto y moneda.
7. Presionar Emitir boleto.
8. Confirmar que aparece numero de ticket.
9. Confirmar que el mapa se refresca y el asiento queda como Vendido/SOLD.
```

### Paso 8 - Detener ejecucion manual

Detener frontend:

```powershell
npm run stop:frontend
```

Detener backend Java con `Ctrl+C` en la terminal donde se ejecuto `java -jar`.

Detener PostgreSQL temporal:

```powershell
docker stop venta-pasajes-ticketing-dev-pg-manual
```

## Flujo operativo

```text
1. El operador filtra o actualiza salidas.
2. Selecciona una salida disponible.
3. Selecciona un asiento libre en el mapa visual.
4. Completa documento, nombre y apellido del pasajero.
5. Confirma monto y moneda.
6. Emite el boleto.
7. El sistema muestra confirmacion con numero de ticket, asiento y tarifa.
8. El mapa se refresca y el asiento vendido queda bloqueado visualmente como SOLD.
```

## Validaciones del formulario

```text
Salida: debe existir una salida seleccionada.
Asiento: debe existir un asiento seleccionado y disponible.
Pasajero: requiere documento, nombre y apellido.
Tarifa: requiere monto numerico mayor o igual a 0 y moneda de 3 letras.
```

Si el backend responde conflicto por asiento ocupado, el frontend muestra:

```text
<mensaje del backend>. Se refresco el mapa; seleccione otro asiento libre.
```

## Refresco de disponibilidad

Despues de emitir un boleto el MFE llama nuevamente a la carga de salidas con la salida vendida como preferida:

```text
loadDepartures(dispatchDepartureId)
```

Esto mantiene la seleccion en la misma salida y fuerza la recarga del mapa de asientos para que el operador vea la disponibilidad actualizada sin refrescar el navegador.

## Verificador actualizado

`scripts\verify-mfe-ticketing.ps1` quedo mas estricto:

```text
Construye los apps Next antes de arrancarlos.
Arranca MFE y shell con next start para evitar el lock de next dev.
Sincroniza una salida temporal de prueba.
Vende el asiento 1 por el proxy del MFE.
Intenta vender de nuevo el mismo asiento y espera HTTP 409.
Consulta el mapa de asientos despues de la venta.
Valida que el asiento 1 quede SOLD.
Valida que la disponibilidad baje a 1 asiento libre.
Valida que el total de vendidos suba a 2.
```

`scripts\verify-mfe-ticketing-stack.ps1` propaga esos criterios y solo marca `ready=true` si la venta completa y el refresco quedan correctos.

## Comandos ejecutados

```powershell
npm run typecheck -w @venta-pasajes/mfe-ticketing
npm run build -w @venta-pasajes/mfe-ticketing
npm run typecheck:frontend
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-mfe-ticketing-stack.ps1 -DatabasePort 55451 -TicketingHttpPort 18095 -ShellPort 3010 -MfeTicketingPort 3013 -JarPath .\services\ticketing-service\target\quarkus-app-day32\quarkus-run.jar
```

## Resultado de validacion

```text
npm run typecheck -w @venta-pasajes/mfe-ticketing: OK
npm run build -w @venta-pasajes/mfe-ticketing: OK
npm run typecheck:frontend: OK
```

Validacion integrada:

```json
{"service":"mfe-ticketing","validation":"frontend-backend-stack","database":"ticketing_db","database_port":55451,"ticketing_http_port":18095,"shell_url":"http://localhost:3010","shell_status":200,"mfe_ticketing_url":"http://localhost:3013","mfe_ticketing_health":"ok","manifest_name":"mfe-ticketing","embedded_status":200,"backend_proxy_status":200,"ticket_status":"ISSUED","ticket_number":"TKT-1554635BFCCC","seats_available_after_ticket":1,"seats_sold_after_ticket":2,"sold_seat_status":"SOLD","duplicate_ticket_http_status":409,"availability_refreshed_after_ticket":true,"ready":true}
```

## Limpieza

```text
Los puertos temporales 55451, 18095, 3010 y 3013 quedaron libres.
No quedaron contenedores temporales venta-pasajes-mfe-ticketing-pg activos.
```

## Criterio de avance

```text
Cumplido: el usuario puede vender de punta a punta desde mfe-ticketing.
```
