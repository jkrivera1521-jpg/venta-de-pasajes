# Dia 81 - Soporte intensivo dia 2

Fecha: 2026-09-28

## Objetivo

Alinear el Dia 81 con `C:\VENTA-DE-PASAJES\tareas.md`: revisar feedback de boleteria, corregir errores menores, ajustar permisos, revisar impresion y validar anulaciones.

Este dia prepara el segundo dia de soporte intensivo. No ejecuta revision real mientras el Dia 80 no este ejecutado y cerrado.

## Resultado alcanzado

Se creo el paquete de soporte dia 2:

```text
C:\VENTA-DE-PASAJES\scripts\prepare-post-start-day2-report.ps1
C:\VENTA-DE-PASAJES\docs\dia-81-soporte-intensivo-dia-2.md
C:\VENTA-DE-PASAJES\docs\reporte-post-arranque-dia-2.md
```

Al ejecutar el preparador se generan archivos locales ignorados por Git:

```text
C:\VENTA-DE-PASAJES\logs\post-start-day2\dia81-post-start-day2-readiness.json
C:\VENTA-DE-PASAJES\logs\post-start-day2\dia81-post-start-day2-commands.ps1
```

Estado esperado mientras Dia 80 no este cerrado:

```text
Paquete soporte dia 2 listo: True
Revision real dia 2 autorizada: False
Revision real dia 2 ejecutada: False
```

## Reversa primero

### Reversa si solo se preparo el paquete

Esta reversa elimina solo archivos locales del Dia 81. No modifica Cloud Run, Cloud SQL, permisos, documentos ni boletos.

```powershell
cd C:\VENTA-DE-PASAJES

Remove-Item -LiteralPath .\logs\post-start-day2 -Recurse -Force
Remove-Item -LiteralPath .\scripts\prepare-post-start-day2-report.ps1 -Force
Remove-Item -LiteralPath .\docs\dia-81-soporte-intensivo-dia-2.md -Force
Remove-Item -LiteralPath .\docs\reporte-post-arranque-dia-2.md -Force
```

### Reversa si ya se ejecuto la revision real

La revision real del Dia 81 recolecta evidencia y crea plantillas de decisiones. No cambia permisos ni anula boletos automaticamente.

```powershell
cd C:\VENTA-DE-PASAJES

Get-Content -LiteralPath .\logs\post-start-day2\dia81-post-start-day2-evidence.json -Raw |
  ConvertFrom-Json
```

Si se aprobo un ajuste menor o de permisos, reversar usando la fila correspondiente de:

```text
C:\VENTA-DE-PASAJES\logs\post-start-day2\dia81-correcciones-menores.md
C:\VENTA-DE-PASAJES\logs\post-start-day2\dia81-permission-adjustments.md
C:\VENTA-DE-PASAJES\docs\registro-incidencias-iniciales.md
```

No aplicar cambios directos sin responsable, aprobacion y reversa documentada.

## Cambios realizados

```text
scripts/prepare-post-start-day2-report.ps1
docs/dia-81-soporte-intensivo-dia-2.md
docs/reporte-post-arranque-dia-2.md
README.md
infra/README.md
vitacora.md
```

## Guia manual desde cero

### Paso 1 - Abrir PowerShell en el workspace

```powershell
cd C:\VENTA-DE-PASAJES
```

### Paso 2 - Confirmar insumos

```powershell
Test-Path -LiteralPath .\logs\cloudrun-prod\verify-cloudrun-prod-backends.json
Test-Path -LiteralPath .\logs\cloudrun-prod\verify-cloudrun-prod-frontends.json
Test-Path -LiteralPath .\logs\go-live\dia79-go-live-readiness.json
Test-Path -LiteralPath .\logs\post-start-day1\dia80-post-start-day1-readiness.json
Test-Path -LiteralPath .\docs\reporte-post-arranque-dia-1.md
Test-Path -LiteralPath .\docs\registro-incidencias-iniciales.md
```

Resultado esperado:

```text
True
True
True
True
True
True
```

### Paso 3 - Preparar paquete sin ejecutar revision real

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\prepare-post-start-day2-report.ps1
```

Resultado esperado si Dia 80 sigue sin cierre:

```text
Paquete soporte dia 2 listo: True
Revision real dia 2 autorizada: False
Revision real dia 2 ejecutada: False
```

### Paso 4 - Revisar bloqueos

```powershell
$Result = Get-Content -LiteralPath .\logs\post-start-day2\dia81-post-start-day2-readiness.json -Raw |
  ConvertFrom-Json

$Result.business_blockers
$Result.technical_blockers
```

Resultado esperado actual:

```text
La operacion real del Dia 79 no esta iniciada.
El soporte intensivo Dia 80 no esta ejecutado ni cerrado.
No existe evidencia de soporte real Dia 80.
No se confirmo cierre de Dia 80 con -ConfirmDay1Closed.
No se confirmo negocio abierto con -ConfirmBusinessOpen.
```

### Paso 5 - Preparar revision real cuando Dia 80 este cerrado

Ejecutar solo despues de cerrar el reporte post-arranque dia 1:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\prepare-post-start-day2-report.ps1 `
  -ConfirmDay1Closed `
  -ConfirmBusinessOpen
```

Resultado esperado sin bloqueos:

```text
Paquete soporte dia 2 listo: True
Revision real dia 2 autorizada: True
Revision real dia 2 ejecutada: False
```

### Paso 6 - Ejecutar recoleccion de soporte dia 2

Ejecutar solo si el Paso 5 queda autorizado:

```powershell
.\logs\post-start-day2\dia81-post-start-day2-commands.ps1
```

Evidencia esperada:

```text
logs\post-start-day2\dia81-feedback-boleteria.md
logs\post-start-day2\dia81-correcciones-menores.md
logs\post-start-day2\dia81-identity-roles.json
logs\post-start-day2\dia81-identity-permissions.json
logs\post-start-day2\dia81-authorized-identities.json
logs\post-start-day2\dia81-permission-adjustments.md
logs\post-start-day2\dia81-print-validation.*
logs\post-start-day2\dia81-cancelled-ticket-validation.*
logs\post-start-day2\dia81-audit-events.json
logs\post-start-day2\dia81-cloudrun-errors.txt
logs\post-start-day2\dia81-post-start-day2-evidence.json
```

### Paso 7 - Validar impresion con PDF real

Definir el ID de documento real antes de ejecutar el comando:

```powershell
$env:DIA81_DOCUMENT_ID = "<document-id-real>"
.\logs\post-start-day2\dia81-post-start-day2-commands.ps1
```

Validar que se genere:

```text
logs\post-start-day2\dia81-print-validation.pdf
```

### Paso 8 - Validar anulaciones con boleto real

Definir el ID de un boleto ya anulado:

```powershell
$env:DIA81_CANCELLED_TICKET_ID = "<ticket-id-anulado>"
.\logs\post-start-day2\dia81-post-start-day2-commands.ps1
```

Validar que `dia81-cancelled-ticket-validation.json` muestre estado anulado/cancelado y datos de trazabilidad.

### Paso 9 - Completar reporte post-arranque dia 2

```powershell
notepad .\docs\reporte-post-arranque-dia-2.md
notepad .\docs\registro-incidencias-iniciales.md
```

Completar feedback, correcciones menores, permisos, impresion, anulaciones y decision de estabilizacion.

## Pruebas y validaciones

Validar sintaxis:

```powershell
$Errors = $null
[System.Management.Automation.PSParser]::Tokenize(
  (Get-Content -LiteralPath .\scripts\prepare-post-start-day2-report.ps1 -Raw),
  [ref]$Errors
) | Out-Null
if ($Errors.Count -gt 0) { $Errors } else { "parse-ok" }
```

Validar comandos generados:

```powershell
$Errors = $null
[System.Management.Automation.PSParser]::Tokenize(
  (Get-Content -LiteralPath .\logs\post-start-day2\dia81-post-start-day2-commands.ps1 -Raw),
  [ref]$Errors
) | Out-Null
if ($Errors.Count -gt 0) { $Errors } else { "commands-parse-ok" }
```

Validar documento:

```powershell
Select-String -Path .\docs\dia-81-soporte-intensivo-dia-2.md `
  -Pattern "Reversa primero|Guia manual desde cero|Estado final"
```

## Peticiones HTTP/HTTPS listas para copiar

Health publico del shell:

```powershell
curl.exe -s "https://frontend-shell-prod-io7kxgn6yq-uc.a.run.app/api/health"
```

Roles y permisos:

```powershell
$Token = gcloud auth print-identity-token
$Headers = @{ Authorization = "Bearer $Token" }

Invoke-RestMethod -Method GET `
  -Uri "https://identity-service-prod-io7kxgn6yq-uc.a.run.app/api/v1/identity/roles" `
  -Headers $Headers

Invoke-RestMethod -Method GET `
  -Uri "https://identity-service-prod-io7kxgn6yq-uc.a.run.app/api/v1/identity/permissions" `
  -Headers $Headers
```

Validar boleto anulado:

```powershell
$TicketId = "<ticket-id-anulado>"

Invoke-RestMethod -Method GET `
  -Uri "https://ticketing-service-prod-io7kxgn6yq-uc.a.run.app/api/v1/ticketing/tickets/$TicketId" `
  -Headers $Headers
```

Descargar PDF para impresion:

```powershell
$DocumentId = "<document-id-real>"

Invoke-WebRequest -Method GET `
  -Uri "https://document-service-prod-io7kxgn6yq-uc.a.run.app/api/v1/document/documents/$DocumentId/download" `
  -Headers $Headers `
  -OutFile ".\logs\post-start-day2\dia81-print-validation.pdf"
```

## Publicacion o despliegue

No se despliega codigo nuevo en este dia. Correcciones menores y permisos se ejecutan solo si quedan aprobados y con reversa registrada.

## Verificacion en consola web o por comandos

Errores recientes:

```powershell
gcloud logging read "resource.type=cloud_run_revision AND severity>=ERROR" `
  --project project-fbb34cd7-0b82-43e1-867 `
  --limit 200
```

Servicios productivos:

```powershell
gcloud run services list `
  --project project-fbb34cd7-0b82-43e1-867 `
  --region us-central1 `
  --filter "metadata.name~-prod"
```

## Problemas encontrados y soluciones

### Dia 80 no esta cerrado

Solucion: preparar el paquete y bloquear la revision real hasta ejecutar y cerrar el soporte dia 1.

### No hay documento real para probar impresion

Solucion: usar `DIA81_DOCUMENT_ID` con un documento real generado despues de la apertura.

### No hay boleto anulado real para validar

Solucion: usar `DIA81_CANCELLED_TICKET_ID` con un boleto anulado real. No generar anulaciones artificiales desde este paquete.

### Permisos no se ajustan automaticamente

Solucion: registrar solicitud, aprobacion y reversa en `dia81-permission-adjustments.md`; aplicar desde Identidad/Admin.

## Estado final

Paquete de soporte intensivo dia 2 creado.

Reporte post-arranque dia 2 creado.

Comandos de recoleccion generados pero no ejecutados.

No se reviso feedback real porque Dia 80 no esta cerrado.

No se ajustaron permisos.

No se validaron impresion ni anulaciones reales.

El soporte real dia 2 queda bloqueado hasta cierre del Dia 80.

Siguiente paso natural: Dia 82 - Soporte intensivo dia 3.
