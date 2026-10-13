# Dia 88 - Preparacion de crecimiento modular

## Objetivo

Dejar una ruta repetible para crear nuevos microservicios Quarkus y nuevos microfrontends Next.js sin rehacer decisiones de arquitectura, seguridad, estructura y despliegue.

## Resultado

Se preparo el paquete de crecimiento modular:

- Punto de entrada `templates`.
- Plantilla de servicio Quarkus documentada y conectada al generador existente.
- Plantilla de MFE Next.js con archivos reutilizables.
- Generador `scripts/new-next-mfe.ps1`.
- Script de consolidacion `scripts/prepare-modular-growth.ps1`.
- Guia `docs/guia-crecimiento-modular.md`.
- Evidencia JSON de readiness.

## Archivos creados o modificados

- `scripts/new-next-mfe.ps1`
- `scripts/prepare-modular-growth.ps1`
- `docs/dia-88-preparacion-crecimiento-modular.md`
- `docs/guia-crecimiento-modular.md`
- `templates/README.md`
- `templates/quarkus-service/README.md`
- `templates/quarkus-service/template.json`
- `templates/quarkus-service/checklist.md`
- `templates/next-mfe/README.md`
- `templates/next-mfe/template.json`
- `templates/next-mfe/checklist.md`
- `templates/next-mfe/files/*`
- `logs/modular-growth/dia88-modular-growth-readiness.json`
- `logs/modular-growth/dia88-modular-growth-inventory.json`
- `README.md`
- `infra/README.md`
- `vitacora.md`

## Reversa primero

### Reversa de archivos locales

```powershell
Remove-Item -LiteralPath .\docs\dia-88-preparacion-crecimiento-modular.md -Force
Remove-Item -LiteralPath .\docs\guia-crecimiento-modular.md -Force
Remove-Item -LiteralPath .\scripts\new-next-mfe.ps1 -Force
Remove-Item -LiteralPath .\scripts\prepare-modular-growth.ps1 -Force
Remove-Item -LiteralPath .\templates -Recurse -Force
Remove-Item -LiteralPath .\logs\modular-growth -Recurse -Force
```

Si tambien se quiere revertir los indices, retirar manualmente las entradas del Dia 88 en:

```text
README.md
infra/README.md
vitacora.md
```

### Reversa de Google Cloud

No aplica. Este dia no crea recursos en Google Cloud ni despliega servicios.

## Guia manual desde cero

### Paso 1 - Verificar el dia en el plan

```powershell
Select-String -Path .\tareas.md -Pattern "Dia 88" -Context 0,14
```

Debe mostrar:

```text
Dia 88 - Preparacion de crecimiento modular
```

### Paso 2 - Verificar rutas requeridas

```powershell
$RequiredPaths = @(
  ".\scripts\new-quarkus-service.ps1",
  ".\scripts\new-next-mfe.ps1",
  ".\scripts\prepare-modular-growth.ps1",
  ".\services\quarkus-service-template\pom.xml",
  ".\templates\README.md",
  ".\templates\quarkus-service\template.json",
  ".\templates\next-mfe\template.json",
  ".\templates\next-mfe\files\package.json",
  ".\templates\next-mfe\files\app\mfe\manifest\route.ts"
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

### Paso 3 - Validar sintaxis de scripts

```powershell
@(
  ".\scripts\new-quarkus-service.ps1",
  ".\scripts\new-next-mfe.ps1",
  ".\scripts\prepare-modular-growth.ps1"
) |
  ForEach-Object {
    $Errors = $null
    $Tokens = $null
    [System.Management.Automation.Language.Parser]::ParseFile(
      $_,
      [ref]$Tokens,
      [ref]$Errors
    ) | Out-Null

    [pscustomobject]@{
      Path = $_
      Errors = $Errors.Count
    }
  } |
  Format-Table -AutoSize
```

Todos deben tener `Errors = 0`.

### Paso 4 - Ejecutar generadores en modo seco

Backend:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\new-quarkus-service.ps1 `
  -ServiceName catalog-service `
  -PackageSegment catalog `
  -DatabaseName catalog_db `
  -HttpPort 8087 `
  -DryRun
```

MFE:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\new-next-mfe.ps1 `
  -MfeName mfe-catalog `
  -PackageSegment catalog `
  -Title "Catalogos" `
  -LocalPort 3006 `
  -BackendPort 8087 `
  -DryRun
```

Ambos deben devolver JSON con:

```text
dry_run: true
```

### Paso 5 - Generar guia y evidencia

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\prepare-modular-growth.ps1
```

Resultado esperado:

```text
Crecimiento modular listo: True
Plantillas reutilizables listas: True
DryRun Quarkus OK: True
DryRun MFE OK: True
Secciones guia faltantes: 0
```

### Paso 6 - Validar evidencia JSON

```powershell
$Result = Get-Content -LiteralPath .\logs\modular-growth\dia88-modular-growth-readiness.json -Raw |
  ConvertFrom-Json

$Result |
  Select-Object ready_for_modular_growth, reusable_templates_ready
```

Resultado esperado:

```text
ready_for_modular_growth reusable_templates_ready
------------------------ ------------------------
                    True                     True
```

### Paso 7 - Revisar guia modular

```powershell
Get-Content -LiteralPath .\docs\guia-crecimiento-modular.md -Raw
```

Debe contener:

```text
Crear un microservicio Quarkus
Crear un MFE Next.js
Checklist para nuevos modulos
Validaciones minimas
```

## Pruebas y validaciones

Validar que los artefactos existen:

```powershell
Test-Path -LiteralPath .\docs\guia-crecimiento-modular.md
Test-Path -LiteralPath .\logs\modular-growth\dia88-modular-growth-readiness.json
Test-Path -LiteralPath .\templates\quarkus-service\checklist.md
Test-Path -LiteralPath .\templates\next-mfe\checklist.md
```

Validar formato Git:

```powershell
git diff --check
```

## Peticiones HTTP/HTTPS listas para copiar con curl.exe

Este dia no requiere llamadas HTTP porque no se crea ningun modulo real. Si luego se crea `mfe-catalog`, validar su health local con:

```powershell
curl.exe -s http://localhost:3006/api/health
```

Y validar el manifest local con:

```powershell
curl.exe -s http://localhost:3006/mfe/manifest
```

## Publicacion o despliegue

No aplica despliegue. Las plantillas preparan la creacion futura de modulos.

## Verificacion en consola web o por comandos

No aplica consola Google Cloud. Verificacion local:

```powershell
Get-ChildItem -LiteralPath .\templates -Recurse -File |
  Select-Object FullName
```

## Problemas encontrados y soluciones

- Ya existia una plantilla Quarkus probada en `services/quarkus-service-template`; no se duplico codigo y se documento como plantilla oficial.
- No existia plantilla MFE formal; se creo `templates/next-mfe` con manifest, health, embedded y proxy server-side.
- Los generadores se validan primero con `-DryRun` para evitar crear carpetas por accidente.

## Estado final y siguiente paso natural

Estado final esperado:

```text
Crecimiento modular listo: True
Plantillas reutilizables listas: True
DryRun Quarkus OK: True
DryRun MFE OK: True
Secciones guia faltantes: 0
```

Siguiente paso natural:

```text
Dia 89 - Backlog de siguientes modulos.
```
