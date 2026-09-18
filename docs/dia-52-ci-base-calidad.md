# Dia 52 - CI base de calidad

Fecha de ejecucion: 2026-09-18

## Objetivo

Agregar un pipeline base de CI para que el repositorio valide automaticamente frontends, servicios backend y archivos criticos del workspace antes de integrar cambios.

Alcance del dia:

```text
Crear workflow GitHub Actions.
Validar typecheck y build de frontends.
Validar pruebas Maven por servicio backend principal.
Agregar guardrails de archivos criticos.
Actualizar README raiz.
Confirmar que production-readiness detecte CI/CD.
Validar comandos locales representativos.
```

## Resultado logrado

```text
Se creo .github/workflows/ci.yml.
El workflow tiene jobs frontend-quality, backend-tests y workspace-guardrails.
frontend-quality ejecuta npm ci, npm run typecheck:frontend y npm run build:frontend.
backend-tests ejecuta mvn -B test -DskipITs por servicio backend principal.
workspace-guardrails valida rutas criticas del monorepo.
La matriz de produccion detecta Pipeline CI/CD.
El score de preparacion subio de 58% a 62%.
El estado global paso de missing a warning.
```

## Archivo creado

```text
C:\VENTA-DE-PASAJES\.github\workflows\ci.yml
```

## Archivos modificados

```text
C:\VENTA-DE-PASAJES\README.md
C:\VENTA-DE-PASAJES\docs\dia-52-ci-base-calidad.md
C:\VENTA-DE-PASAJES\vitacora.md
```

## Jobs del workflow

```text
frontend-quality:
  npm ci
  npm run typecheck:frontend
  npm run build:frontend

backend-tests:
  matrix por servicio:
    audit-service
    dispatch-service
    document-service
    identity-service
    reporting-service
    ticketing-service
  mvn -B test -DskipITs

workspace-guardrails:
  verifica archivos criticos del proyecto.
```

## Reversa primero

Esta seccion sirve para deshacer el Dia 52 sin afectar el codigo funcional del aplicativo.

### Paso 1 - Ir al proyecto

```powershell
$ProjectRoot = "C:\VENTA-DE-PASAJES"
Set-Location $ProjectRoot
```

### Paso 2 - Eliminar workflow

```powershell
Remove-Item -Path "$ProjectRoot\.github\workflows\ci.yml" -Force
```

Si la carpeta queda vacia y tambien se desea retirarla:

```powershell
Remove-Item -Path "$ProjectRoot\.github\workflows" -Recurse -Force
Remove-Item -Path "$ProjectRoot\.github" -Recurse -Force
```

### Paso 3 - Revertir README

En:

```text
C:\VENTA-DE-PASAJES\README.md
```

Volver:

```text
Dias 1 a 52 documentados en docs.
```

a:

```text
Dias 1 a 51 documentados en docs.
```

Y retirar:

```text
CI base agregado en .github/workflows/ci.yml para frontends, servicios backend y guardrails del workspace.
```

### Paso 4 - Validar reversa

```powershell
Test-Path -Path "$ProjectRoot\.github\workflows\ci.yml"
```

Resultado esperado:

```text
False
```

Luego, si `mfe-admin` esta corriendo:

```powershell
$Readiness = curl.exe -s "http://localhost:3005/api/admin/production-readiness" | ConvertFrom-Json
$Readiness.items | Where-Object id -eq "ci-cd" | Select-Object id,status,title
```

Resultado esperado despues de reversar:

```text
ci-cd missing CI/CD
```

## Guia manual desde cero

> Importante: ejecutar estos comandos desde PowerShell. Si la consola esta en `C:\Windows\system32`, primero ejecutar el Paso 1.

### Paso 1 - Ubicarse en el proyecto

```powershell
$ProjectRoot = "C:\VENTA-DE-PASAJES"
Set-Location $ProjectRoot
```

### Paso 2 - Verificar workflow

```powershell
Test-Path -Path "$ProjectRoot\.github\workflows\ci.yml"
```

Debe responder:

```text
True
```

Confirmar jobs clave:

```powershell
Select-String -Path "$ProjectRoot\.github\workflows\ci.yml" -Pattern "frontend-quality|backend-tests|workspace-guardrails|npm run typecheck:frontend|mvn -B test"
```

### Paso 3 - Validar frontend localmente

```powershell
npm run typecheck:frontend
npm run build:frontend
```

### Paso 4 - Validar una prueba backend representativa

```powershell
Set-Location "$ProjectRoot\services\identity-service"
mvn -B test -DskipITs
Set-Location $ProjectRoot
```

> El workflow ejecuta este mismo comando por cada servicio backend principal.

### Paso 5 - Levantar mfe-admin si no esta activo

```powershell
npm run dev:mfe-admin
```

En otra consola:

```powershell
$ProjectRoot = "C:\VENTA-DE-PASAJES"
Set-Location $ProjectRoot
```

### Paso 6 - Validar matriz de produccion

```powershell
$Readiness = curl.exe -s "http://localhost:3005/api/admin/production-readiness" | ConvertFrom-Json
[pscustomobject]@{
  Score = $Readiness.score_percent
  Status = $Readiness.status
  Ready = $Readiness.totals.ready
  Warning = $Readiness.totals.warning
  Missing = $Readiness.totals.missing
  Total = $Readiness.totals.total
} | Format-List
```

Resultado observado:

```text
Score=62
Status=warning
Ready=6
Warning=4
Missing=3
Total=13
```

Validar item CI/CD:

```powershell
$Readiness.items |
  Where-Object id -eq "ci-cd" |
  Select-Object id,status,title,evidence,missing |
  Format-List
```

Resultado observado:

```text
id=ci-cd
status=warning
title=CI/CD
evidence=Pipeline CI/CD detectado
missing={}
```

### Paso 7 - Validar diagnostico consolidado

```powershell
$Diagnostic = curl.exe -s "http://localhost:3005/api/admin/diagnostic-export" | ConvertFrom-Json
[pscustomobject]@{
  Sections = $Diagnostic.summary.total_sections
  Ok = $Diagnostic.summary.ok_sections
  Failed = $Diagnostic.summary.failed_sections
  ProductionScore = $Diagnostic.summary.production_readiness_score
  ProductionMissing = $Diagnostic.summary.production_readiness_missing
} | Format-List
```

Resultado observado:

```text
Sections=6
Ok=6
Failed=0
ProductionScore=62
ProductionMissing=3
```

## Comandos de validacion ejecutados

```powershell
Test-Path -Path .\.github\workflows\ci.yml
Select-String -Path .\.github\workflows\ci.yml -Pattern "frontend-quality|backend-tests|workspace-guardrails|npm run typecheck:frontend|mvn -B test"
npm run typecheck:frontend
mvn -B test -DskipITs
npm run build:frontend
curl.exe -s http://localhost:3005/api/admin/production-readiness
curl.exe -s http://localhost:3005/api/admin/diagnostic-export
```

Resultados observados:

```text
ci.yml existe.
workflow contiene frontend-quality, backend-tests y workspace-guardrails.
typecheck:frontend OK.
identity-service mvn test OK: 14 tests, 0 failures, 0 errors.
build:frontend OK.
production-readiness respondio score_percent=62.
CI/CD paso a status=warning con evidencia Pipeline CI/CD detectado.
diagnostic-export production_readiness_score=62.
```

## Lectura ejecutiva

```text
El proyecto ya tiene una puerta automatica de calidad base.
Todavia no es despliegue continuo: el pipeline valida, pero no publica imagenes ni despliega a Cloud Run.
La siguiente brecha productiva fuerte sigue siendo despliegue reproducible, backups de base de datos y pruebas frontend/E2E.
```

## Troubleshooting

### GitHub Actions falla en backend-tests

Revisar el servicio puntual que falla en la matriz y ejecutar localmente:

```powershell
Set-Location C:\VENTA-DE-PASAJES\services\<servicio>
mvn -B test -DskipITs
```

### GitHub Actions falla en frontend-quality

Ejecutar localmente:

```powershell
Set-Location C:\VENTA-DE-PASAJES
npm ci
npm run typecheck:frontend
npm run build:frontend
```

### production-readiness no cambia

Confirmar que existe el archivo:

```powershell
Test-Path -Path C:\VENTA-DE-PASAJES\.github\workflows\ci.yml
```
