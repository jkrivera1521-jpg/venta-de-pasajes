# Dia 53 - CI/CD frontend y artefactos versionados

Fecha de ejecucion: 2026-09-18

## Objetivo

Crear una ruta repetible para construir artefactos versionados del `frontend-shell` y de cada MFE, tanto localmente como desde GitHub Actions.

Alcance del dia:

```text
Crear script local de empaquetado frontend.
Crear workflow GitHub Actions dedicado a artefactos frontend.
Construir por matriz: shell, identity, dispatch, ticketing, reporting y admin.
Publicar artefactos zip como artifacts de GitHub Actions.
Actualizar la matriz de produccion del mfe-admin para detectar el pipeline frontend.
Documentar reversa y guia manual desde cero.
```

## Resultado logrado

```text
Se creo scripts\build-frontend-artifacts.ps1.
Se creo .github\workflows\frontend-artifacts.yml.
Se agrego npm run build:frontend-artifacts.
El workflow construye un artefacto por frontend usando matrix.app.
Cada artefacto empaqueta la salida Next.js standalone, static assets, .env.example y artifact-manifest.json.
mfe-admin ahora detecta el pipeline de artefactos frontend como evidencia CI/CD.
```

## Archivos creados

```text
C:\VENTA-DE-PASAJES\scripts\build-frontend-artifacts.ps1
C:\VENTA-DE-PASAJES\.github\workflows\frontend-artifacts.yml
C:\VENTA-DE-PASAJES\docs\dia-53-ci-cd-frontend.md
```

## Archivos modificados

```text
C:\VENTA-DE-PASAJES\package.json
C:\VENTA-DE-PASAJES\.gitignore
C:\VENTA-DE-PASAJES\apps\mfe-admin\app\api\admin\production-readiness\route.ts
C:\VENTA-DE-PASAJES\README.md
C:\VENTA-DE-PASAJES\vitacora.md
```

## Reversa primero

Esta seccion sirve para retirar lo construido en el Dia 53 sin tocar el codigo funcional de los frontends.

### Paso 1 - Ubicarse en el proyecto

```powershell
$ProjectRoot = "C:\VENTA-DE-PASAJES"
Set-Location $ProjectRoot
```

### Paso 2 - Eliminar artefactos locales generados

```powershell
Remove-Item -LiteralPath "$ProjectRoot\artifacts\frontend" -Recurse -Force -ErrorAction SilentlyContinue
```

Validar:

```powershell
Test-Path -LiteralPath "$ProjectRoot\artifacts\frontend"
```

Resultado esperado:

```text
False
```

### Paso 3 - Retirar workflow y script

```powershell
Remove-Item -LiteralPath "$ProjectRoot\.github\workflows\frontend-artifacts.yml" -Force
Remove-Item -LiteralPath "$ProjectRoot\scripts\build-frontend-artifacts.ps1" -Force
```

### Paso 4 - Revertir package.json

En:

```text
C:\VENTA-DE-PASAJES\package.json
```

Eliminar el script:

```json
"build:frontend-artifacts": "powershell -NoProfile -ExecutionPolicy Bypass -File ./scripts/build-frontend-artifacts.ps1"
```

### Paso 5 - Revertir production-readiness

En:

```text
C:\VENTA-DE-PASAJES\apps\mfe-admin\app\api\admin\production-readiness\route.ts
```

Retirar las referencias a:

```text
frontendArtifactWorkflow
frontendArtifactScript
Pipeline de artefactos frontend detectado
Script de artefactos frontend disponible
Artefactos frontend versionados
```

### Paso 6 - Validar reversa

```powershell
Test-Path -LiteralPath "$ProjectRoot\.github\workflows\frontend-artifacts.yml"
Test-Path -LiteralPath "$ProjectRoot\scripts\build-frontend-artifacts.ps1"
Select-String -Path "$ProjectRoot\package.json" -Pattern "build:frontend-artifacts"
```

Resultado esperado:

```text
False
False
Sin coincidencias para build:frontend-artifacts
```

## Guia manual desde cero

> Importante: ejecutar desde PowerShell. Si la consola esta en `C:\Windows\system32`, primero ejecutar el Paso 1.

### Paso 1 - Ubicarse en el proyecto

```powershell
$ProjectRoot = "C:\VENTA-DE-PASAJES"
Set-Location $ProjectRoot
```

### Paso 2 - Verificar archivos del Dia 53

```powershell
Test-Path -LiteralPath "$ProjectRoot\scripts\build-frontend-artifacts.ps1"
Test-Path -LiteralPath "$ProjectRoot\.github\workflows\frontend-artifacts.yml"
Select-String -Path "$ProjectRoot\package.json" -Pattern "build:frontend-artifacts"
```

Resultado esperado:

```text
True
True
build:frontend-artifacts
```

### Paso 3 - Instalar dependencias si es una maquina limpia

```powershell
npm ci
```

### Paso 4 - Construir todos los artefactos frontend

```powershell
npm run build:frontend-artifacts
```

Resultado esperado:

```text
Se ejecuta build de @venta-pasajes/shared-types.
Se ejecuta typecheck y build por cada frontend.
Se generan zip bajo artifacts\frontend\<version>.
```

### Paso 5 - Construir un solo frontend

Ejemplo con `mfe-admin`:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-frontend-artifacts.ps1 `
  -Apps mfe-admin `
  -Version local-admin-test
```

Validar:

```powershell
Test-Path -LiteralPath "$ProjectRoot\artifacts\frontend\local-admin-test\mfe-admin-local-admin-test.zip"
Get-Content -LiteralPath "$ProjectRoot\artifacts\frontend\local-admin-test\frontend-artifacts-summary.json" -Raw
```

### Paso 6 - Revisar workflow frontend

```powershell
Select-String -Path "$ProjectRoot\.github\workflows\frontend-artifacts.yml" `
  -Pattern "frontend-shell|mfe-identity|mfe-dispatch|mfe-ticketing|mfe-reporting|mfe-admin|upload-artifact"
```

Resultado esperado:

```text
El workflow contiene los seis frontends y usa actions/upload-artifact.
```

### Paso 7 - Validar matriz de produccion en mfe-admin

Levantar `mfe-admin` si no esta activo:

```powershell
npm run dev:mfe-admin
```

En otra consola:

```powershell
$Readiness = curl.exe -s "http://localhost:3005/api/admin/production-readiness" | ConvertFrom-Json
$Readiness.items |
  Where-Object id -in @("ci-cd","artifact-images") |
  Select-Object id,status,evidence,missing |
  Format-List
```

Resultado esperado:

```text
ci-cd muestra Pipeline de artefactos frontend detectado.
artifact-images muestra Script de artefactos frontend disponible.
```

## Comandos de validacion ejecutados

```powershell
Test-Path -LiteralPath .\scripts\build-frontend-artifacts.ps1
Test-Path -LiteralPath .\.github\workflows\frontend-artifacts.yml
Select-String -Path .\.github\workflows\frontend-artifacts.yml -Pattern "frontend-shell|mfe-admin|upload-artifact"
npm run typecheck:frontend
npm run build:frontend-artifacts -- -Apps mfe-admin -Version dia53-local-test
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-frontend-artifacts.ps1 -Apps mfe-admin -Version dia53-local-test -SkipBuild -SkipSharedTypesBuild
npm run build:frontend
```

Resultados observados:

```text
typecheck:frontend OK.
build:frontend-artifacts para mfe-admin OK.
Se genero artifacts\frontend\dia53-local-test\mfe-admin-dia53-local-test.zip.
El zip local pesa aproximadamente 8 MB.
frontend-artifacts-summary.json queda con version, generated_at, total y artifacts.
build:frontend OK para shared-types, los cinco MFEs y frontend-shell.
```

## Publicacion en GitHub Actions

Al hacer push a GitHub, el workflow genera artifacts descargables desde:

```text
GitHub repository > Actions > venta-pasajes-frontend-artifacts > Run > Artifacts
```

Cada artifact queda con nombre:

```text
frontend-<app>-<commit-sha>
```

Nota importante:

```text
Para subir este workflow al repositorio, el token de GitHub debe tener permiso workflow.
Si el push falla con "refusing to allow a Personal Access Token to create or update workflow", crear o autorizar un token con scope workflow.
```

## Troubleshooting

### PowerShell interpreta codigo como comando

Si una guia muestra contenido de archivo, no se pega directo en PowerShell. En este dia los comandos ejecutables son los bloques que empiezan con `npm`, `powershell`, `Test-Path`, `Select-String` o `curl.exe`.

### No se genera standalone

Verificar que el frontend tenga:

```powershell
Select-String -Path .\apps\mfe-admin\next.config.ts -Pattern "output: `"standalone`""
```

Si no aparece, agregar `output: "standalone"` y repetir el build.

### GitHub rechaza el push del workflow

Reautenticar GitHub con permiso `workflow`:

```powershell
@"
protocol=https
host=github.com

"@ | git credential-manager erase

git push -u origin main
```

En la ventana de GitHub, usar un token o login con permiso `workflow`.

## Estado final y siguiente paso natural

```text
El frontend ya tiene empaquetado reproducible por aplicacion.
El siguiente paso natural es avanzar hacia despliegue reproducible en Cloud Run dev o hacia pruebas frontend/E2E antes de automatizar despliegues productivos.
```
