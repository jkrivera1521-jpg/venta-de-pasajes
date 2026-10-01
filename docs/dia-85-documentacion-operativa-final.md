# Dia 85 - Documentacion operativa final

## Objetivo

Crear la documentacion operativa final para que usuarios de boleteria, supervisores, administradores operativos y soporte tengan material de apoyo para operar el sistema.

## Resultado

Se preparo un paquete documental con:

- Manual operativo final.
- Guia rapida de boleteria.
- Evidencia automatizada de fuentes verificadas y secciones cubiertas.

El dia queda alineado con `tareas.md`: login hibrido, ventas, anulaciones, reportes, administracion de buses/salidas y soporte basico.

## Archivos creados o modificados

- `scripts/prepare-operational-documentation.ps1`
- `docs/dia-85-documentacion-operativa-final.md`
- `docs/manual-operativo-final.md`
- `docs/guia-rapida-boleteria.md`
- `logs/operational-documentation/dia85-operational-documentation-readiness.json`
- `logs/operational-documentation/dia85-operational-documentation-inventory.json`
- `README.md`
- `infra/README.md`
- `vitacora.md`

## Reversa primero

Este dia solo genera documentacion y evidencia local. No modifica bases de datos, Cloud Run, Artifact Registry, Secret Manager, Cloud SQL ni servicios en ejecucion.

Para limpiar solo los archivos generados por este dia:

```powershell
Remove-Item -LiteralPath .\docs\manual-operativo-final.md -Force
Remove-Item -LiteralPath .\docs\guia-rapida-boleteria.md -Force
Remove-Item -LiteralPath .\docs\dia-85-documentacion-operativa-final.md -Force
Remove-Item -LiteralPath .\scripts\prepare-operational-documentation.ps1 -Force
Remove-Item -LiteralPath .\logs\operational-documentation\dia85-operational-documentation-readiness.json -Force
Remove-Item -LiteralPath .\logs\operational-documentation\dia85-operational-documentation-inventory.json -Force
```

Si tambien se quiere revertir los indices, retirar manualmente las entradas Dia 85 de:

```text
README.md
infra/README.md
vitacora.md
```

## Guia manual desde cero

### Paso 1 - Verificar el dia en el plan

```powershell
Select-String -Path .\tareas.md -Pattern "Dia 85" -Context 0,12
```

Debe mostrar:

```text
Dia 85 - Documentacion operativa final
```

### Paso 2 - Verificar fuentes operativas

```powershell
$Sources = @(
  ".\docs\manual-usuario-operativo.md",
  ".\docs\faq-operativa.md",
  ".\docs\registro-capacitacion-operativa.md",
  ".\apps\mfe-identity\app\identity\embedded\page.tsx",
  ".\apps\mfe-ticketing\app\ticketing\embedded\page.tsx",
  ".\apps\mfe-reporting\app\reporting\embedded\page.tsx",
  ".\apps\mfe-dispatch\app\dispatch\embedded\page.tsx",
  ".\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\api\TicketingTicketResource.java",
  ".\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\service\TicketingSaleService.java"
)

$Sources | ForEach-Object {
  [pscustomobject]@{
    Path = $_
    Exists = Test-Path -LiteralPath $_
  }
} | Format-Table -AutoSize
```

Todas las rutas deben devolver `True`.

### Paso 3 - Generar manuales y evidencia

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\prepare-operational-documentation.ps1
```

Salida esperada:

```text
Documentacion operativa lista: True
Manual operativo generado: True
Guia rapida generada: True
Fuentes verificadas: 9
Bloqueos: 0
```

### Paso 4 - Revisar entregables

```powershell
Test-Path -LiteralPath .\docs\manual-operativo-final.md
Test-Path -LiteralPath .\docs\guia-rapida-boleteria.md
Test-Path -LiteralPath .\logs\operational-documentation\dia85-operational-documentation-readiness.json
```

### Paso 5 - Confirmar cobertura del criterio

```powershell
$Result = Get-Content -LiteralPath .\logs\operational-documentation\dia85-operational-documentation-readiness.json -Raw |
  ConvertFrom-Json

$Result | Select-Object ready_for_operational_documentation, manual_generated, quick_guide_generated
```

## Pruebas y validaciones

Validar sintaxis del script:

```powershell
$Errors = $null
$Tokens = $null
[System.Management.Automation.Language.Parser]::ParseFile(
  ".\scripts\prepare-operational-documentation.ps1",
  [ref]$Tokens,
  [ref]$Errors
) | Out-Null

$Errors.Count
```

Validar secciones principales del manual:

```powershell
Select-String -Path .\docs\manual-operativo-final.md -Pattern "Login hibrido|Venta de boletos|Anulaciones|Reportes|Administracion de buses y salidas|Soporte basico"
```

Validar secciones principales de la guia rapida:

```powershell
Select-String -Path .\docs\guia-rapida-boleteria.md -Pattern "Antes de vender|Venta en 8 pasos|Si aparece conflicto 409|Cierre de turno"
```

## Peticiones HTTP/HTTPS listas para copiar con curl.exe

Este dia no requiere ejecutar peticiones HTTP obligatorias porque no publica servicios ni modifica datos.

Opcionalmente, si los frontends estan levantados, se puede revisar salud local:

```powershell
curl.exe -s http://localhost:3001/api/health
curl.exe -s http://localhost:3002/api/health
curl.exe -s http://localhost:3003/api/health
curl.exe -s http://localhost:3004/api/health
curl.exe -s http://localhost:3005/api/health
```

## Publicacion o despliegue

No aplica despliegue. Los entregables quedan versionados en el repositorio.

## Verificacion final

Comandos ejecutados:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\prepare-operational-documentation.ps1

$Result = Get-Content -LiteralPath .\logs\operational-documentation\dia85-operational-documentation-readiness.json -Raw |
  ConvertFrom-Json

$Result | Select-Object ready_for_operational_documentation, manual_generated, quick_guide_generated
```

Resultado esperado:

```text
ready_for_operational_documentation : True
manual_generated                    : True
quick_guide_generated               : True
```

## Problemas encontrados y soluciones

- Se evito crear instrucciones sobre rutas no verificadas. El script falla si falta alguna fuente base.
- Se documento la anulacion como flujo controlado porque el backend expone cancelacion, pero la operacion debe ejecutarla solo con autorizacion o soporte si la pantalla no expone el boton final.

## Estado final y siguiente paso natural

Estado final:

```text
Los usuarios tienen material de apoyo operativo.
El manual operativo final y la guia rapida de boleteria quedan generados.
La evidencia JSON permite validar que las secciones principales existen.
```

Siguiente paso natural:

```text
Dia 86 - Prueba de restauracion en produccion controlada.
```
