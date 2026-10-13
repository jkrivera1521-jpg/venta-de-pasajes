# Dia 78 - Prueba productiva controlada

Fecha: 2026-09-25

## Objetivo

Alinear el Dia 78 con `C:\VENTA-DE-PASAJES\tareas.md`: crear una salida controlada, vender boletos de prueba, generar PDFs, anular un boleto de prueba, revisar reportes y revisar logs.

Este dia prepara la prueba productiva controlada. No ejecuta ventas reales mientras la migracion final del Dia 77 siga pendiente de aplicacion y aprobacion.

## Resultado alcanzado

Se creo el paquete de prueba productiva controlada:

```text
C:\VENTA-DE-PASAJES\scripts\prepare-controlled-prod-test.ps1
C:\VENTA-DE-PASAJES\docs\acta-prueba-productiva-controlada.md
C:\VENTA-DE-PASAJES\docs\dia-78-prueba-productiva-controlada.md
```

Al ejecutar el verificador se generan archivos locales ignorados por Git:

```text
C:\VENTA-DE-PASAJES\logs\prod-controlled-test\dia78-controlled-prod-test-readiness.json
C:\VENTA-DE-PASAJES\logs\prod-controlled-test\dia78-controlled-prod-test.commands.ps1
```

Estado esperado antes de aplicar y aprobar Dia 77:

```text
Paquete de prueba listo: True
Prueba real autorizada: False
Prueba real ejecutada: False
```

## Reversa primero

### Reversa si solo se preparo el paquete

Esta reversa elimina solo archivos locales del Dia 78. No modifica Cloud Run, Cloud SQL, Storage ni datos.

```powershell
cd C:\VENTA-DE-PASAJES

Remove-Item -LiteralPath .\logs\prod-controlled-test -Recurse -Force
Remove-Item -LiteralPath .\scripts\prepare-controlled-prod-test.ps1 -Force
Remove-Item -LiteralPath .\docs\acta-prueba-productiva-controlada.md -Force
Remove-Item -LiteralPath .\docs\dia-78-prueba-productiva-controlada.md -Force
```

### Reversa si ya se ejecuto la prueba real

Ejecutar solo si la prueba productiva controlada ya fue ejecutada:

```powershell
cd C:\VENTA-DE-PASAJES

$Evidence = Get-Content -LiteralPath .\logs\prod-controlled-test\dia78-real-execution-evidence.json -Raw | ConvertFrom-Json
$Evidence
```

La prueba generada ya incluye:

```text
1. Anulacion del boleto de prueba con liberacion de asiento.
2. Cancelacion de la salida controlada.
3. Evidencia local de PDF, reportes, auditoria y logs.
```

No borrar el PDF ni los documentos generados por defecto; sirven como evidencia del ensayo productivo. Si negocio exige limpieza documental, definir un paso manual separado con aprobacion formal.

## Cambios realizados

```text
scripts/prepare-controlled-prod-test.ps1
docs/acta-prueba-productiva-controlada.md
docs/dia-78-prueba-productiva-controlada.md
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
Test-Path -LiteralPath .\infra\cloudrun\prod-backend-services.json
```

Resultado esperado:

```text
True
True
True
True
```

### Paso 3 - Preparar paquete sin ejecutar produccion

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\prepare-controlled-prod-test.ps1
```

Resultado esperado mientras Dia 77 siga pendiente:

```text
Paquete de prueba listo: True
Prueba real autorizada: False
Prueba real ejecutada: False
```

### Paso 4 - Revisar bloqueos

```powershell
$Result = Get-Content -LiteralPath .\logs\prod-controlled-test\dia78-controlled-prod-test-readiness.json -Raw | ConvertFrom-Json
$Result.execution_blockers
$Result.warnings
```

Bloqueos esperados antes del corte real:

```text
La migracion final a produccion no esta ejecutada.
Los datos productivos migrados no estan aprobados.
No se confirmo migracion aplicada.
No se confirmo GO/NO-GO de negocio.
```

### Paso 5 - Revisar comandos productivos generados

```powershell
Get-Content -LiteralPath .\logs\prod-controlled-test\dia78-controlled-prod-test.commands.ps1
```

El archivo contiene pasos para:

```text
1. Validar health de shell, dispatch, ticketing, document, reporting y audit.
2. Tomar un bus y ruta activos.
3. Crear una salida controlada marcada con DIA78.
4. Sincronizar disponibilidad en ticketing.
5. Vender un boleto de prueba.
6. Generar PDF con document-service.
7. Anular el boleto de prueba y liberar asiento.
8. Revisar reportes.
9. Revisar auditoria y logs.
10. Cancelar la salida controlada.
```

### Paso 6 - Ejecutar prueba real solo con aprobacion

Ejecutar solo despues de:

```text
Dia 77 aplicado en produccion.
Datos migrados aprobados.
GO/NO-GO de negocio confirmado.
Backup productivo vigente.
```

Preparar paquete autorizado:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\prepare-controlled-prod-test.ps1 `
  -ConfirmMigrationApplied `
  -ConfirmBusinessGoNoGo
```

Ejecutar prueba real:

```powershell
.\logs\prod-controlled-test\dia78-controlled-prod-test.commands.ps1
```

### Paso 7 - Completar acta

Editar:

```text
C:\VENTA-DE-PASAJES\docs\acta-prueba-productiva-controlada.md
```

Completar:

```text
Estado de cada paso.
Ruta de evidencias.
Firmas.
Decision de apertura o no apertura.
```

## Pruebas y validaciones

Validar sintaxis:

```powershell
$Errors = $null
[System.Management.Automation.PSParser]::Tokenize(
  (Get-Content -LiteralPath .\scripts\prepare-controlled-prod-test.ps1 -Raw),
  [ref]$Errors
) | Out-Null
if ($Errors.Count -gt 0) { $Errors } else { "parse-ok" }
```

Validar comandos generados:

```powershell
$Errors = $null
[System.Management.Automation.PSParser]::Tokenize(
  (Get-Content -LiteralPath .\logs\prod-controlled-test\dia78-controlled-prod-test.commands.ps1 -Raw),
  [ref]$Errors
) | Out-Null
if ($Errors.Count -gt 0) { $Errors } else { "commands-parse-ok" }
```

Validar documento:

```powershell
Select-String -Path .\docs\dia-78-prueba-productiva-controlada.md `
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

## Problemas encontrados y soluciones

### Dia 77 no esta aplicado en produccion

Solucion: el paquete se genera, pero la prueba real queda bloqueada.

### PDF automatico desde ticketing no esta habilitado

En `ticketing-service-prod`, `APP_DOCUMENT_INTEGRATION_ENABLED` no esta en `true`. Para la prueba controlada se prepara generacion directa via `document-service`, sin acoplar microservicios.

### La prueba real modifica produccion

Solucion: el script generado requiere ejecucion manual separada y queda marcado con advertencia.

## Estado final

Paquete de prueba productiva controlada creado.

Comandos productivos generados pero no ejecutados.

Acta de prueba productiva controlada creada.

Produccion no fue modificada.

La prueba real queda bloqueada hasta que Dia 77 este aplicado y aprobado.

Siguiente paso natural: Dia 79 - Puesta en marcha.

