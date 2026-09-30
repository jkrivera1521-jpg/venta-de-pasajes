# Dia 84 - Documentacion tecnica final

Fecha: 2026-09-29

## Objetivo

Alinear el Dia 84 con `C:\VENTA-DE-PASAJES\tareas.md`: documentar arquitectura, microservicios, bases de datos, eventos, pipelines y despliegues.

El objetivo practico es dejar un manual tecnico y diagramas finales suficientes para que otro tecnico pueda mantener el sistema sin depender de Codex.

## Resultado alcanzado

Se creo el paquete de documentacion tecnica final:

```text
C:\VENTA-DE-PASAJES\scripts\prepare-technical-documentation.ps1
C:\VENTA-DE-PASAJES\docs\dia-84-documentacion-tecnica-final.md
C:\VENTA-DE-PASAJES\docs\manual-tecnico.md
C:\VENTA-DE-PASAJES\docs\diagramas-finales.md
```

Al ejecutar el preparador se generan archivos locales ignorados por Git:

```text
C:\VENTA-DE-PASAJES\logs\technical-documentation\dia84-technical-documentation-readiness.json
C:\VENTA-DE-PASAJES\logs\technical-documentation\dia84-technical-documentation-inventory.json
```

Estado esperado:

```text
Documentacion tecnica lista: True
Manual tecnico generado: True
Diagramas finales generados: True
```

## Cambios realizados

```text
scripts/prepare-technical-documentation.ps1
docs/dia-84-documentacion-tecnica-final.md
docs/manual-tecnico.md
docs/diagramas-finales.md
README.md
infra/README.md
vitacora.md
```

## Reversa primero

### Reversa si solo se preparo el paquete

Esta reversa elimina solo archivos locales de documentacion del Dia 84. No modifica Cloud Run, Cloud SQL, Pub/Sub, GitHub Actions ni recursos productivos.

```powershell
cd C:\VENTA-DE-PASAJES

Remove-Item -LiteralPath .\logs\technical-documentation -Recurse -Force
Remove-Item -LiteralPath .\scripts\prepare-technical-documentation.ps1 -Force
Remove-Item -LiteralPath .\docs\dia-84-documentacion-tecnica-final.md -Force
Remove-Item -LiteralPath .\docs\manual-tecnico.md -Force
Remove-Item -LiteralPath .\docs\diagramas-finales.md -Force
```

### Reversa si el manual fue publicado fuera del repo

Si una copia del manual fue compartida por correo, Drive, Wiki o herramienta externa, marcar esa copia como obsoleta antes de eliminar los archivos locales:

```text
Estado: Obsoleto
Motivo: Reversa del Dia 84
Fuente vigente: C:\VENTA-DE-PASAJES
```

No borrar documentos externos sin confirmar con el responsable del proyecto.

## Guia manual desde cero

### Paso 1 - Abrir PowerShell en el workspace

```powershell
cd C:\VENTA-DE-PASAJES
```

### Paso 2 - Confirmar insumos reales

```powershell
Test-Path -LiteralPath .\infra\cloudrun\prod-backend-services.json
Test-Path -LiteralPath .\infra\cloudrun\prod-frontend-services.json
Test-Path -LiteralPath .\infra\gcloud\cloudsql-prod.json
Test-Path -LiteralPath .\infra\gcloud\pubsub-prod.json
Test-Path -LiteralPath .\docs\database
Test-Path -LiteralPath .\docs\openapi
Test-Path -LiteralPath .\docs\events\catalogo-eventos.md
Test-Path -LiteralPath .\.github\workflows
```

Resultado esperado:

```text
True
True
True
True
True
True
True
True
```

### Paso 3 - Generar manual tecnico y diagramas

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\prepare-technical-documentation.ps1
```

Resultado esperado:

```text
Documentacion tecnica lista: True
Manual tecnico generado: True
Diagramas finales generados: True
Servicios inventariados: 12
Bases inventariadas: 6
OpenAPI inventariados: 6
Pipelines inventariados: 2
Bloqueos tecnicos: 0
```

### Paso 4 - Revisar readiness

```powershell
$Result = Get-Content -LiteralPath .\logs\technical-documentation\dia84-technical-documentation-readiness.json -Raw |
  ConvertFrom-Json

$Result | Select-Object `
  ready_for_technical_documentation, `
  manual_generated, `
  diagrams_generated, `
  services_count, `
  database_files_count, `
  openapi_files_count, `
  events_count, `
  workflows_count
```

### Paso 5 - Abrir manual tecnico

```powershell
notepad .\docs\manual-tecnico.md
```

Secciones minimas:

```text
Arquitectura general
Modulos frontend
Microservicios backend
Bases de datos
APIs
Eventos y mensajeria
Pipelines
Despliegues
Operacion y mantenimiento
```

### Paso 6 - Abrir diagramas finales

```powershell
notepad .\docs\diagramas-finales.md
```

Diagramas minimos:

```text
Vista general
Microservicios y bases
Eventos principales
Despliegue productivo
```

### Paso 7 - Validar sintaxis del preparador

```powershell
$Errors = $null
[void][System.Management.Automation.PSParser]::Tokenize(
  (Get-Content -LiteralPath .\scripts\prepare-technical-documentation.ps1 -Raw),
  [ref]$Errors
)

$Errors
```

Resultado esperado:

```text
Sin errores.
```

## Pruebas y validaciones

### Validar existencia de entregables

```powershell
Test-Path -LiteralPath .\docs\manual-tecnico.md
Test-Path -LiteralPath .\docs\diagramas-finales.md
Test-Path -LiteralPath .\logs\technical-documentation\dia84-technical-documentation-readiness.json
Test-Path -LiteralPath .\logs\technical-documentation\dia84-technical-documentation-inventory.json
```

Resultado esperado:

```text
True
True
True
True
```

### Validar secciones del manual

```powershell
Select-String -Path .\docs\manual-tecnico.md -Pattern `
  "^## Arquitectura general|^## Modulos frontend|^## Microservicios backend|^## Bases de datos|^## APIs|^## Eventos y mensajeria|^## Pipelines|^## Despliegues"
```

### Validar diagramas Mermaid

```powershell
Select-String -Path .\docs\diagramas-finales.md -Pattern "```mermaid"
```

Resultado esperado:

```text
4 bloques Mermaid.
```

## Peticiones HTTP/HTTPS listas para copiar

El Dia 84 no crea endpoints nuevos. Para validar que la documentacion apunta a servicios productivos reales, se pueden revisar health checks.

Shell productivo:

```powershell
$env:CLOUDSDK_PYTHON = "C:\Python312\python.exe"
$GcloudPath = "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd"
$ProjectId = "project-fbb34cd7-0b82-43e1-867"
$Region = "us-central1"

$ShellUrl = (& $GcloudPath run services describe frontend-shell-prod --project $ProjectId --region $Region --format "value(status.url)").Trim()

curl.exe -s "$ShellUrl/api/health"
```

Backend privado con identity token:

```powershell
$Token = (& $GcloudPath auth print-identity-token).Trim()
$IdentityUrl = (& $GcloudPath run services describe identity-service-prod --project $ProjectId --region $Region --format "value(status.url)").Trim()

curl.exe -s -H "Authorization: Bearer $Token" "$IdentityUrl/api/v1/identity/health"
```

## Publicacion o despliegue

No aplica despliegue de aplicacion. La publicacion del Dia 84 es documental dentro del repositorio.

Archivos finales:

```text
docs\manual-tecnico.md
docs\diagramas-finales.md
```

## Verificacion en consola web o por comandos

Verificar que los nombres documentados correspondan a recursos reales:

```powershell
$Backend = Get-Content -LiteralPath .\infra\cloudrun\prod-backend-services.json -Raw | ConvertFrom-Json
$Frontend = Get-Content -LiteralPath .\infra\cloudrun\prod-frontend-services.json -Raw | ConvertFrom-Json

@($Backend.services + ($Frontend.services | Where-Object group -eq "frontend")) |
  Select-Object id, service_name, port, min_instances, max_instances |
  Format-Table -AutoSize
```

## Problemas encontrados y soluciones

Problema:

```text
No existe pom.xml raiz Maven.
```

Solucion:

```text
El manual documenta que las pruebas backend se ejecutan por servicio o por matriz CI.
```

Problema:

```text
Las rutas productivas estan separadas entre backends y frontends.
```

Solucion:

```text
El preparador usa los archivos reales:
infra\cloudrun\prod-backend-services.json
infra\cloudrun\prod-frontend-services.json
```

## Estado final

Estado del Dia 84:

```text
Manual tecnico generado.
Diagramas finales generados.
Inventario tecnico generado.
No se modificaron recursos de Google Cloud.
```

Siguiente paso natural:

```text
Dia 85 - Documentacion operativa final.
```
