# Dia 6 - Diseno de contratos API

Fecha: 2026-09-01
Fuentes: limites de dominio del Dia 5 y analisis funcional/base Access de dias previos.

## Objetivo

Definir contratos OpenAPI iniciales para que frontend y backend puedan trabajar en paralelo con un lenguaje comun de recursos, payloads, errores, paginacion y filtros.

## Contratos generados

| Servicio | Archivo OpenAPI | Alcance inicial |
| --- | --- | --- |
| `identity-service` | `C:\VENTA-DE-PASAJES\docs\openapi\identity-service.openapi.yaml` | Login local, intercambio Google, usuario actual, usuarios, roles, permisos, identidades autorizadas y recuperacion de contrasena. |
| `dispatch-service` | `C:\VENTA-DE-PASAJES\docs\openapi\dispatch-service.openapi.yaml` | Terminales, rutas, tipos de bus, buses, layouts de asientos y salidas programadas. |
| `ticketing-service` | `C:\VENTA-DE-PASAJES\docs\openapi\ticketing-service.openapi.yaml` | Busqueda de salidas vendibles, mapa de asientos, pasajeros, reservas, venta, anulacion y reimpresion. |
| `document-service` | `C:\VENTA-DE-PASAJES\docs\openapi\document-service.openapi.yaml` | Plantillas, generacion de PDF de boleto, documentos y URL firmada. |
| `reporting-service` | `C:\VENTA-DE-PASAJES\docs\openapi\reporting-service.openapi.yaml` | Reporte de ventas, pasajeros, ventas por usuario, ventas por bus/ruta/terminal y exportaciones. |
| `audit-service` | `C:\VENTA-DE-PASAJES\docs\openapi\audit-service.openapi.yaml` | Consulta de auditoria y registro interno/idempotente de eventos auditables. |

Aunque el Dia 6 del plan lista cinco contratos de servicio, se agrego `audit-service` porque en el Dia 5 quedo definido como microservicio propio y necesitara API de consulta para administracion y soporte.

## Guia de convenciones

Archivo creado:

`C:\VENTA-DE-PASAJES\docs\api-conventions.md`

Incluye:

- Versionado bajo `/api/v1`.
- Uso de JSON con `snake_case`.
- IDs internos UUID y `legacy_id` solo para trazabilidad.
- Seguridad con Bearer JWT.
- Headers comunes: `Authorization`, `X-Correlation-Id`, `Idempotency-Key`.
- Estructura comun de errores.
- Codigos HTTP estandar.
- Paginacion con `page` y `page_size`.
- Filtros por `q`, rangos de fecha y estados.
- Ordenamiento con `sort`.
- Idempotencia para operaciones criticas.
- Reglas de concurrencia para venta de asientos.
- Trazabilidad por eventos.
- Seguridad de datos personales y credenciales.

## Decisiones de contrato registradas

- Todos los servicios exponen `/health` sin autenticacion.
- Todos los servicios usan Bearer JWT salvo endpoints publicos de autenticacion y salud.
- Las operaciones criticas de ticketing, documents, reporting exports y audit interno usan `Idempotency-Key`.
- `ticketing-service` expone el mapa de asientos por salida mediante `/departures/{departureId}/seats`.
- La venta se realiza con `POST /tickets` y debe ser transaccional.
- La anulacion se realiza con `POST /tickets/{ticketId}/cancel`.
- `dispatch-service` modela layouts de asiento como recursos, no como botones fijos.
- `document-service` no decide validez de boletos; solo genera documentos desde datos recibidos.
- `reporting-service` trabaja con modelos de lectura y no modifica datos transaccionales.
- `audit-service` es append-only a nivel funcional.

## Riesgos y pendientes

- Los contratos son iniciales y deberan ajustarse cuando se disene el modelo PostgreSQL del Dia 8.
- Falta decidir si `ticketing-service` consultara `dispatch-service` en tiempo real o por read model/eventos.
- Falta definir permisos exactos por endpoint.
- Falta definir codigos finales de roles funcionales con usuarios clave.
- Falta validar los OpenAPI con el generador elegido por Quarkus cuando existan los proyectos.

## Criterio de avance

Cumplido:

- OpenAPI inicial para identity.
- OpenAPI inicial para dispatch.
- OpenAPI inicial para ticketing.
- OpenAPI inicial para documents.
- OpenAPI inicial para reporting.
- OpenAPI inicial complementario para audit.
- Convenciones de errores, paginacion y filtros definidas.
- Frontend y backend ya pueden trabajar contra contratos base.

## Reversa primero

> Estandarizacion documental agregada el 2026-09-16 para que este dia tambien tenga una ruta segura de limpieza antes de repetir la practica.

Este dia pertenece a la etapa inicial del proyecto. Antes de ejecutar una reversa, revisar si el archivo contiene recursos externos reales, como Google Cloud, Docker, bases de datos o imagenes publicadas. No ejecutar comandos destructivos si no estas seguro de que el recurso no esta siendo usado.

### Paso R1 - Ubicarse en el workspace

```powershell
cd C:\VENTA-DE-PASAJES
```

### Paso R2 - Revisar recursos o archivos mencionados

```powershell
Select-String -Path .\docs\dia-06-diseno-contratos-api.md -Pattern "C:\\VENTA-DE-PASAJES|docker|gcloud|mvn|npm|Remove-Item|delete|rm|Cloud SQL|Artifact Registry|Secret Manager" -Context 0,2
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
Select-String -Path .\docs\dia-06-diseno-contratos-api.md -Pattern "Archivo|Archivos|C:\\VENTA-DE-PASAJES" -Context 0,4
```

Si aun asi necesitas retirar solo este documento de la practica, hacer primero una copia:

```powershell
New-Item -ItemType Directory -Force -Path .\backups | Out-Null
Copy-Item -LiteralPath .\docs\dia-06-diseno-contratos-api.md -Destination .\backups\dia-06-diseno-contratos-api-manual-backup.md -Force
```

Despues de respaldar, se podria eliminar manualmente el documento con:

```powershell
Remove-Item -LiteralPath .\docs\dia-06-diseno-contratos-api.md -Force
```

## Guia manual desde cero

> Estandarizacion documental agregada el 2026-09-16. Esta guia permite repetir el dia sin depender de Codex, usando el documento como fuente de verdad.

### Paso 1 - Ubicarse en el proyecto

```powershell
cd C:\VENTA-DE-PASAJES
```

### Paso 2 - Leer el alcance del dia en el backlog

```powershell
Select-String -Path .\tareas.md -Pattern "Dia 6|Dia 06" -Context 0,40
```

### Paso 3 - Leer la documentacion del dia

```powershell
Get-Content -LiteralPath .\docs\dia-06-diseno-contratos-api.md
```

### Paso 4 - Verificar archivos y rutas mencionadas

```powershell
Select-String -Path .\docs\dia-06-diseno-contratos-api.md -Pattern "C:\\VENTA-DE-PASAJES" -AllMatches
```

Para cada ruta importante que aparezca en el documento:

```powershell
Test-Path -LiteralPath "<ruta-copiada-del-documento>"
```

### Paso 5 - Ejecutar comandos documentados

Buscar bloques de comandos del documento y ejecutarlos en orden, validando el resultado de cada bloque antes de continuar:

```powershell
Select-String -Path .\docs\dia-06-diseno-contratos-api.md -Pattern "```powershell|```text|mvn |npm |docker |gcloud |curl.exe|powershell " -Context 0,6
```

### Paso 6 - Registrar la repeticion en bitacora

```powershell
Add-Content -LiteralPath .\vitacora.md -Value "`nReplica manual Dia 6 - <fecha>: comandos ejecutados y resultado."
```

### Paso 7 - Validar criterio de avance

Revisar la seccion de criterio de avance, resultado, estado final o pendientes del documento:

```powershell
Select-String -Path .\docs\dia-06-diseno-contratos-api.md -Pattern "Criterio de avance|Resultado|Estado final|Pendiente|Pendientes" -Context 0,8
```
