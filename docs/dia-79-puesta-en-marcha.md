# Dia 79 - Puesta en marcha

Fecha: 2026-09-28

## Objetivo

Alinear el Dia 79 con `C:\VENTA-DE-PASAJES\tareas.md`: habilitar correos Google reales, asignar roles operativos, iniciar operacion en boleteria, monitorear servicios, acompanar el arranque y registrar incidencias.

Este dia prepara la apertura productiva real. No declara el sistema abierto mientras la migracion final del Dia 77 y la prueba productiva controlada del Dia 78 sigan pendientes de ejecucion y aprobacion.

## Resultado alcanzado

Se creo el paquete de puesta en marcha:

```text
C:\VENTA-DE-PASAJES\scripts\prepare-go-live-prod.ps1
C:\VENTA-DE-PASAJES\docs\dia-79-puesta-en-marcha.md
C:\VENTA-DE-PASAJES\docs\acta-puesta-en-marcha.md
C:\VENTA-DE-PASAJES\docs\registro-incidencias-iniciales.md
```

Al ejecutar el preparador se generan archivos locales ignorados por Git:

```text
C:\VENTA-DE-PASAJES\logs\go-live\dia79-go-live-readiness.json
C:\VENTA-DE-PASAJES\logs\go-live\dia79-go-live-commands.ps1
```

Estado esperado mientras Dia 77 y Dia 78 no esten aprobados:

```text
Paquete de puesta en marcha listo: True
Puesta en marcha real autorizada: False
Operacion real iniciada: False
```

## Reversa primero

### Reversa si solo se preparo el paquete

Esta reversa elimina solo archivos locales del Dia 79. No modifica Cloud Run, Cloud SQL, Storage ni usuarios reales.

```powershell
cd C:\VENTA-DE-PASAJES

Remove-Item -LiteralPath .\logs\go-live -Recurse -Force
Remove-Item -LiteralPath .\scripts\prepare-go-live-prod.ps1 -Force
Remove-Item -LiteralPath .\docs\dia-79-puesta-en-marcha.md -Force
Remove-Item -LiteralPath .\docs\acta-puesta-en-marcha.md -Force
Remove-Item -LiteralPath .\docs\registro-incidencias-iniciales.md -Force
```

### Reversa si ya se inicio operacion real

Ejecutar solo si negocio ya autorizo apertura y se inicio operacion:

```powershell
cd C:\VENTA-DE-PASAJES

Get-Content -LiteralPath .\logs\go-live\dia79-go-live-monitoring-evidence.json -Raw |
  ConvertFrom-Json
```

Aplicar el plan formal de rollback del Dia 75:

```powershell
Get-Content -LiteralPath .\infra\cutover\prod-cutover-plan.json -Raw |
  ConvertFrom-Json |
  Select-Object -ExpandProperty rollback_plan
```

Acciones manuales de reversa operativa:

```text
1. Cerrar la atencion en boleteria.
2. Registrar la decision en docs\registro-incidencias-iniciales.md.
3. Detener nuevas ventas desde el canal operativo.
4. Notificar a negocio y soporte.
5. Revisar logs de Cloud Run y reportes de ventas.
6. Si se asignaron accesos reales por error, revocarlos desde Identidad/Admin.
```

No borrar evidencias ni reportes de la primera jornada; sirven para auditoria.

## Cambios realizados

```text
scripts/prepare-go-live-prod.ps1
docs/dia-79-puesta-en-marcha.md
docs/acta-puesta-en-marcha.md
docs/registro-incidencias-iniciales.md
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
Test-Path -LiteralPath .\logs\migration\dia77-final-prod\final-data-migration-prod-readiness.json
Test-Path -LiteralPath .\logs\prod-controlled-test\dia78-controlled-prod-test-readiness.json
```

Resultado esperado:

```text
True
True
True
True
```

### Paso 3 - Preparar paquete sin abrir produccion

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\prepare-go-live-prod.ps1
```

Resultado esperado si aun faltan aprobaciones:

```text
Paquete de puesta en marcha listo: True
Puesta en marcha real autorizada: False
Operacion real iniciada: False
```

### Paso 4 - Revisar bloqueos

```powershell
$Result = Get-Content -LiteralPath .\logs\go-live\dia79-go-live-readiness.json -Raw |
  ConvertFrom-Json

$Result.business_blockers
$Result.technical_blockers
```

Resultado esperado actual:

```text
La migracion final no esta ejecutada en produccion.
Los datos productivos migrados no estan aprobados.
La prueba productiva controlada del Dia 78 no esta ejecutada y aprobada.
No se informaron correos reales de boleteria con -OperatorEmails.
No se informaron correos reales de supervisores con -SupervisorEmails.
No se confirmo migracion aplicada con -ConfirmMigrationApplied.
No se confirmo prueba controlada aprobada con -ConfirmControlledTestApproved.
No se confirmo apertura de negocio con -ConfirmBusinessOpen.
```

### Paso 5 - Preparar con correos reales cuando negocio autorice

Reemplazar los correos de ejemplo por los correos Google reales:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\prepare-go-live-prod.ps1 `
  -OperatorEmails "boleteria1@empresa.com","boleteria2@empresa.com" `
  -SupervisorEmails "supervisor@empresa.com" `
  -ConfirmMigrationApplied `
  -ConfirmControlledTestApproved `
  -ConfirmBusinessOpen
```

Si no hay bloqueos, el resultado esperado es:

```text
Paquete de puesta en marcha listo: True
Puesta en marcha real autorizada: True
Operacion real iniciada: False
```

### Paso 6 - Habilitar correos Google reales y roles operativos

Ejecutar desde el shell productivo o el MFE de Identidad/Admin:

```text
1. Abrir frontend-shell-prod.
2. Ingresar a Identidad/Admin.
3. Registrar correos Google reales de boleteria.
4. Asignar rol operativo de boleteria.
5. Registrar correos Google reales de supervisores.
6. Asignar rol de supervisor o administrador operativo.
7. Probar ingreso con cada usuario.
8. Registrar evidencia en docs\acta-puesta-en-marcha.md.
```

### Paso 7 - Iniciar operacion en boleteria

La primera venta real debe ejecutarse con acompanamiento:

```text
1. Seleccionar salida real.
2. Verificar disponibilidad.
3. Emitir boleto real.
4. Confirmar PDF.
5. Confirmar reporte de ventas.
6. Confirmar evento de auditoria.
7. Registrar cualquier incidencia.
```

### Paso 8 - Ejecutar monitoreo de apertura

Ejecutar solo si el Paso 5 quedo sin bloqueos y negocio aprobo apertura:

```powershell
.\logs\go-live\dia79-go-live-commands.ps1
```

Evidencia esperada:

```text
logs\go-live\dia79-cloudrun-services.txt
logs\go-live\dia79-cloudrun-logs.txt
logs\go-live\dia79-sales-report.json
logs\go-live\dia79-passenger-report.json
logs\go-live\dia79-audit-events.json
logs\go-live\dia79-go-live-monitoring-evidence.json
```

### Paso 9 - Completar acta e incidencias

```powershell
notepad .\docs\acta-puesta-en-marcha.md
notepad .\docs\registro-incidencias-iniciales.md
```

Completar firmas, decision de apertura, primera venta real e incidencias detectadas.

## Pruebas y validaciones

Validar sintaxis:

```powershell
$Errors = $null
[System.Management.Automation.PSParser]::Tokenize(
  (Get-Content -LiteralPath .\scripts\prepare-go-live-prod.ps1 -Raw),
  [ref]$Errors
) | Out-Null
if ($Errors.Count -gt 0) { $Errors } else { "parse-ok" }
```

Validar comandos generados:

```powershell
$Errors = $null
[System.Management.Automation.PSParser]::Tokenize(
  (Get-Content -LiteralPath .\logs\go-live\dia79-go-live-commands.ps1 -Raw),
  [ref]$Errors
) | Out-Null
if ($Errors.Count -gt 0) { $Errors } else { "commands-parse-ok" }
```

Validar documento:

```powershell
Select-String -Path .\docs\dia-79-puesta-en-marcha.md `
  -Pattern "Reversa primero|Guia manual desde cero|Estado final"
```

## Peticiones HTTP/HTTPS listas para copiar

Health publico del shell:

```powershell
curl.exe -s "https://frontend-shell-prod-io7kxgn6yq-uc.a.run.app/api/health"
```

Los backends productivos son privados; usar token:

```powershell
$Token = gcloud auth print-identity-token
$Headers = @{ Authorization = "Bearer $Token" }

Invoke-RestMethod -Method GET `
  -Uri "https://ticketing-service-prod-io7kxgn6yq-uc.a.run.app/api/v1/ticketing/health" `
  -Headers $Headers
```

## Publicacion o despliegue

No se despliega codigo nuevo en este dia. La puesta en marcha usa los servicios productivos ya desplegados y validados en los Dias 72 y 73.

## Verificacion en consola web o por comandos

Ver servicios Cloud Run productivos:

```powershell
gcloud run services list `
  --project project-fbb34cd7-0b82-43e1-867 `
  --region us-central1 `
  --filter "metadata.name~-prod"
```

Ver logs recientes:

```powershell
gcloud logging read "resource.type=cloud_run_revision" `
  --project project-fbb34cd7-0b82-43e1-867 `
  --limit 50
```

## Problemas encontrados y soluciones

### Dia 77 no esta aplicado en produccion

Solucion: bloquear la apertura real hasta que la migracion final quede ejecutada y aprobada.

### Dia 78 no esta ejecutado ni aprobado

Solucion: bloquear la apertura real hasta completar la prueba controlada con venta, PDF, anulacion, reportes y logs.

### Faltan correos Google reales

Solucion: ejecutar el preparador con `-OperatorEmails` y `-SupervisorEmails` usando correos reales, no placeholders.

### La puesta en marcha no debe automatizar roles sin aprobacion

Solucion: el paquete genera acta y checklist. La asignacion se realiza en Identidad/Admin con responsables presentes y se registra evidencia.

## Estado final

Paquete de puesta en marcha creado.

Acta de puesta en marcha creada.

Registro de incidencias iniciales creado.

Comandos de monitoreo generados pero no ejecutados.

Produccion no fue abierta por este paso.

La puesta en marcha real queda bloqueada hasta cerrar Dia 77, Dia 78, correos reales y aprobacion de negocio.

Siguiente paso natural: Dia 80 - Soporte intensivo dia 1.
