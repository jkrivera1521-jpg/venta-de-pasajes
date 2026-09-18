# Dia 7 - Diseno de eventos y mensajeria

Fecha: 2026-09-01
Fuentes: `tareas.md`, limites de dominio del Dia 5 y contratos API del Dia 6.

## Objetivo

Gobernar la comunicacion asincrona desde el inicio: eventos, payload minimo, topicos Pub/Sub, `correlation_id` e idempotencia.

## Entregables creados

| Entregable | Archivo |
| --- | --- |
| Catalogo de eventos | `C:\VENTA-DE-PASAJES\docs\events\catalogo-eventos.md` |
| Diseno Pub/Sub | `C:\VENTA-DE-PASAJES\docs\events\diseno-pubsub.md` |
| Esquema JSON del sobre de evento | `C:\VENTA-DE-PASAJES\docs\events\event-envelope.schema.json` |

## Eventos iniciales definidos

- `UserCreated`
- `UserRoleChanged`
- `TerminalCreated`
- `BusCreated`
- `SeatLayoutUpdated`
- `DepartureScheduled`
- `DepartureCancelled`
- `SeatReserved`
- `SeatReservationExpired`
- `TicketSold`
- `TicketCancelled`
- `TicketPrinted`
- `DocumentGenerated`
- `AuditEventCreated`

## Topicos Pub/Sub definidos

- `venta-pasajes-{env}-identity-events`
- `venta-pasajes-{env}-dispatch-events`
- `venta-pasajes-{env}-ticketing-events`
- `venta-pasajes-{env}-document-events`
- `venta-pasajes-{env}-audit-events`

Ambientes validos para `{env}`:

- `dev`
- `test`
- `staging`
- `prod`

## Convencion de correlation_id

- Toda operacion HTTP acepta `X-Correlation-Id`.
- Si no se recibe, el gateway o primer servicio genera un UUID.
- El mismo valor se propaga a logs, llamadas REST internas, eventos Pub/Sub y respuestas HTTP.
- `correlation_id` agrupa la operacion completa.
- `event_id` identifica un evento unico.
- `causation_id` enlaza eventos causados por otro evento o comando.

## Politica de idempotencia

Productores:

- Usan outbox transaccional.
- Reintentan publicacion conservando el mismo `event_id`.
- Publican solo despues de confirmar el cambio local.

Consumidores:

- Mantienen tabla `processed_events`.
- La clave unica recomendada es `source_service + event_id + consumer_name`.
- Ignoran eventos ya procesados sin repetir efectos.
- En payload no soportado o invalido, envian a DLQ y generan alerta.

Operaciones criticas:

- Venta, anulacion, generacion de documentos y exportaciones usan `Idempotency-Key`.
- Doble venta se evita en la base de `ticketing-service`, no por orden de mensajes.

## Decisiones registradas

- Pub/Sub transporta hechos, no comandos obligatorios para completar una venta.
- `ticketing-service` sigue siendo responsable transaccional de disponibilidad y venta.
- `reporting-service` puede ser eventualmente consistente.
- `audit-service` consume eventos de todos los dominios para auditoria funcional.
- No se publican contrasenas, hashes, tokens, secretos ni documentos completos.
- Los datos personales en eventos se minimizan.

## Criterio de avance

Cumplido:

- Eventos iniciales definidos.
- Payload minimo por evento definido.
- Topicos Pub/Sub definidos.
- Suscripciones iniciales definidas.
- Convencion de `correlation_id` definida.
- Politica de idempotencia definida.
- Dead-letter topics y alertas iniciales definidos.

Pendiente recomendado:

- Dia 8: disenar modelo PostgreSQL por servicio, incluyendo outbox y processed_events.

## Reversa primero

> Estandarizacion documental agregada el 2026-09-16 para que este dia tambien tenga una ruta segura de limpieza antes de repetir la practica.

Este dia pertenece a la etapa inicial del proyecto. Antes de ejecutar una reversa, revisar si el archivo contiene recursos externos reales, como Google Cloud, Docker, bases de datos o imagenes publicadas. No ejecutar comandos destructivos si no estas seguro de que el recurso no esta siendo usado.

### Paso R1 - Ubicarse en el workspace

```powershell
cd C:\VENTA-DE-PASAJES
```

### Paso R2 - Revisar recursos o archivos mencionados

```powershell
Select-String -Path .\docs\dia-07-diseno-eventos-mensajeria.md -Pattern "C:\\VENTA-DE-PASAJES|docker|gcloud|mvn|npm|Remove-Item|delete|rm|Cloud SQL|Artifact Registry|Secret Manager" -Context 0,2
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
Select-String -Path .\docs\dia-07-diseno-eventos-mensajeria.md -Pattern "Archivo|Archivos|C:\\VENTA-DE-PASAJES" -Context 0,4
```

Si aun asi necesitas retirar solo este documento de la practica, hacer primero una copia:

```powershell
New-Item -ItemType Directory -Force -Path .\backups | Out-Null
Copy-Item -LiteralPath .\docs\dia-07-diseno-eventos-mensajeria.md -Destination .\backups\dia-07-diseno-eventos-mensajeria-manual-backup.md -Force
```

Despues de respaldar, se podria eliminar manualmente el documento con:

```powershell
Remove-Item -LiteralPath .\docs\dia-07-diseno-eventos-mensajeria.md -Force
```

## Guia manual desde cero

> Estandarizacion documental agregada el 2026-09-16. Esta guia permite repetir el dia sin depender de Codex, usando el documento como fuente de verdad.

### Paso 1 - Ubicarse en el proyecto

```powershell
cd C:\VENTA-DE-PASAJES
```

### Paso 2 - Leer el alcance del dia en el backlog

```powershell
Select-String -Path .\tareas.md -Pattern "Dia 7|Dia 07" -Context 0,40
```

### Paso 3 - Leer la documentacion del dia

```powershell
Get-Content -LiteralPath .\docs\dia-07-diseno-eventos-mensajeria.md
```

### Paso 4 - Verificar archivos y rutas mencionadas

```powershell
Select-String -Path .\docs\dia-07-diseno-eventos-mensajeria.md -Pattern "C:\\VENTA-DE-PASAJES" -AllMatches
```

Para cada ruta importante que aparezca en el documento:

```powershell
Test-Path -LiteralPath "<ruta-copiada-del-documento>"
```

### Paso 5 - Ejecutar comandos documentados

Buscar bloques de comandos del documento y ejecutarlos en orden, validando el resultado de cada bloque antes de continuar:

```powershell
Select-String -Path .\docs\dia-07-diseno-eventos-mensajeria.md -Pattern "```powershell|```text|mvn |npm |docker |gcloud |curl.exe|powershell " -Context 0,6
```

### Paso 6 - Registrar la repeticion en bitacora

```powershell
Add-Content -LiteralPath .\vitacora.md -Value "`nReplica manual Dia 7 - <fecha>: comandos ejecutados y resultado."
```

### Paso 7 - Validar criterio de avance

Revisar la seccion de criterio de avance, resultado, estado final o pendientes del documento:

```powershell
Select-String -Path .\docs\dia-07-diseno-eventos-mensajeria.md -Pattern "Criterio de avance|Resultado|Estado final|Pendiente|Pendientes" -Context 0,8
```
