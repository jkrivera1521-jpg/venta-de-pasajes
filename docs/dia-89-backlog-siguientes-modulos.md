# Dia 89 - Backlog de siguientes modulos

## Objetivo

Priorizar los siguientes modulos de crecimiento del sistema y dejar una estimacion inicial para planificar la evolucion posterior al cierre del proyecto base.

## Resultado

Se preparo un backlog futuro priorizado para:

- Pagos online.
- Facturacion electronica.
- Encomiendas.
- Venta web publica.
- Caja avanzada.

Tambien se genero una estimacion inicial por modulo, con tamano, semanas calendario, persona-semanas, dependencias, riesgos y alcance MVP.

## Archivos creados o modificados

- `scripts/prepare-future-modules-backlog.ps1`
- `docs/dia-89-backlog-siguientes-modulos.md`
- `docs/backlog-futuro-priorizado.md`
- `docs/estimaciones-modulos-futuros.md`
- `logs/future-modules-backlog/dia89-future-modules-backlog-readiness.json`
- `logs/future-modules-backlog/dia89-future-modules-backlog-inventory.json`
- `README.md`
- `infra/README.md`
- `vitacora.md`

## Reversa primero

### Reversa de archivos locales

```powershell
Remove-Item -LiteralPath .\docs\dia-89-backlog-siguientes-modulos.md -Force
Remove-Item -LiteralPath .\docs\backlog-futuro-priorizado.md -Force
Remove-Item -LiteralPath .\docs\estimaciones-modulos-futuros.md -Force
Remove-Item -LiteralPath .\scripts\prepare-future-modules-backlog.ps1 -Force
Remove-Item -LiteralPath .\logs\future-modules-backlog -Recurse -Force
```

Si tambien se quiere revertir los indices, retirar manualmente las entradas del Dia 89 en:

```text
README.md
infra/README.md
vitacora.md
```

### Reversa de Google Cloud

No aplica. Este dia no crea recursos cloud, bases, servicios ni frontends.

## Guia manual desde cero

### Paso 1 - Verificar el dia en el plan

```powershell
Select-String -Path .\tareas.md -Pattern "Dia 89" -Context 0,14
```

Debe mostrar:

```text
Dia 89 - Backlog de siguientes modulos
```

### Paso 2 - Verificar rutas requeridas

```powershell
$RequiredPaths = @(
  ".\tareas.md",
  ".\docs\guia-crecimiento-modular.md",
  ".\templates\quarkus-service\template.json",
  ".\templates\next-mfe\template.json",
  ".\scripts\new-quarkus-service.ps1",
  ".\scripts\new-next-mfe.ps1",
  ".\scripts\prepare-future-modules-backlog.ps1",
  ".\docs\manual-tecnico.md",
  ".\docs\manual-operativo-final.md"
)

$RequiredPaths |
  ForEach-Object {
    [pscustomobject]@{
      Path = $_
      Exists = Test-Path -LiteralPath $_
    }
  } |
  Format-Table -AutoSize
```

Todos deben aparecer en `True`.

### Paso 3 - Validar sintaxis del script

```powershell
$Errors = $null
$Tokens = $null
[System.Management.Automation.Language.Parser]::ParseFile(
  ".\scripts\prepare-future-modules-backlog.ps1",
  [ref]$Tokens,
  [ref]$Errors
) | Out-Null

$Errors.Count
```

Debe devolver:

```text
0
```

### Paso 4 - Generar backlog y estimaciones

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\prepare-future-modules-backlog.ps1
```

Resultado esperado:

```text
Backlog futuro listo: True
Modulos priorizados: 5
Prioridad 1: Facturacion electronica
Secciones backlog faltantes: 0
Secciones estimaciones faltantes: 0
```

### Paso 5 - Validar evidencia JSON

```powershell
$Result = Get-Content -LiteralPath .\logs\future-modules-backlog\dia89-future-modules-backlog-readiness.json -Raw |
  ConvertFrom-Json

$Result |
  Select-Object ready_for_future_backlog, modules_prioritized, highest_priority

$Result.modules |
  Select-Object priority, module, effort_size, estimated_calendar_weeks, estimated_person_weeks |
  Format-Table -AutoSize
```

Resultado esperado:

```text
ready_for_future_backlog modules_prioritized highest_priority
------------------------ ------------------- -----------------------
                    True                   5 Facturacion electronica
```

### Paso 6 - Revisar entregables

```powershell
Get-Content -LiteralPath .\docs\backlog-futuro-priorizado.md -Raw
Get-Content -LiteralPath .\docs\estimaciones-modulos-futuros.md -Raw
```

Los documentos deben incluir:

```text
Facturacion electronica
Pagos online
Encomiendas
Venta web publica
Caja avanzada
```

## Pruebas y validaciones

Validar existencia:

```powershell
Test-Path -LiteralPath .\docs\backlog-futuro-priorizado.md
Test-Path -LiteralPath .\docs\estimaciones-modulos-futuros.md
Test-Path -LiteralPath .\logs\future-modules-backlog\dia89-future-modules-backlog-readiness.json
```

Validar formato:

```powershell
git diff --check
```

## Peticiones HTTP/HTTPS listas para copiar con curl.exe

Este dia no requiere llamadas HTTP porque solo genera backlog y estimaciones. Cuando se cree un modulo real, usar los health checks definidos por las plantillas del Dia 88.

## Publicacion o despliegue

No aplica despliegue.

## Verificacion en consola web o por comandos

No aplica consola Google Cloud.

Comando local recomendado:

```powershell
$Result = Get-Content -LiteralPath .\logs\future-modules-backlog\dia89-future-modules-backlog-readiness.json -Raw |
  ConvertFrom-Json

$Result.modules |
  Sort-Object priority |
  Select-Object priority, module, backend, frontend, effort_size
```

## Problemas encontrados y soluciones

- Las estimaciones son iniciales y no deben tratarse como fechas comprometidas.
- Facturacion electronica queda como prioridad 1 por impacto regulatorio y administrativo, pero debe iniciar con validacion funcional y normativa vigente.
- Venta web publica queda despues de pagos online porque depende de cobros, antifraude, disponibilidad publica y soporte a pasajeros externos.

## Estado final y siguiente paso natural

Estado final esperado:

```text
Backlog futuro listo: True
Modulos priorizados: 5
Prioridad 1: Facturacion electronica
Secciones backlog faltantes: 0
Secciones estimaciones faltantes: 0
```

Siguiente paso natural:

```text
Dia 90 - Cierre del proyecto.
```
