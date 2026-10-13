# Dia 47 - parametros operativos en mfe-admin

Fecha de ejecucion: 2026-09-17

## Objetivo

Agregar al `mfe-admin` una vista de parametros operativos para ver URLs, timeouts y variables efectivas sin revisar manualmente archivos `.env`.

Alcance del dia:

```text
Crear API administrativa /api/admin/runtime-config.
Mostrar valores efectivos de variables operativas.
Indicar si cada valor viene de env o del default.
Agregar comandos copiables para revisar o configurar variables.
Hacer que ADMIN_HEALTH_TIMEOUT_MS controle realmente el timeout del visor de salud.
Agregar pestana Parametros en mfe-admin.
Actualizar manifest, README y .env.example.
Validar typecheck, build y HTTP.
```

## Resultado logrado

```text
mfe-admin expone GET /api/admin/runtime-config.
La pantalla admin tiene pestanas Salud, Arranque, Runbook, Parametros y Auditoria.
Parametros muestra 16 variables: URLs publicas, proxy audit, health URLs y timeout.
Cada variable muestra valor efectivo, default, origen, documentos y comandos.
El visor de salud usa ADMIN_HEALTH_TIMEOUT_MS con default 2500.
El manifest de mfe-admin declara la capacidad parametros-operativos.
```

## Archivos creados

```text
C:\VENTA-DE-PASAJES\apps\mfe-admin\app\api\admin\runtime-config\route.ts
C:\VENTA-DE-PASAJES\docs\dia-47-parametros-operativos-admin.md
```

## Archivos modificados

```text
C:\VENTA-DE-PASAJES\apps\mfe-admin\.env.example
C:\VENTA-DE-PASAJES\apps\mfe-admin\app\api\admin\health\route.ts
C:\VENTA-DE-PASAJES\apps\mfe-admin\app\admin\embedded\page.tsx
C:\VENTA-DE-PASAJES\apps\mfe-admin\app\globals.css
C:\VENTA-DE-PASAJES\apps\mfe-admin\app\mfe\manifest\route.ts
C:\VENTA-DE-PASAJES\apps\README.md
C:\VENTA-DE-PASAJES\vitacora.md
```

## Endpoint agregado

```text
GET /api/admin/runtime-config
```

Respuesta resumida:

```json
{
  "summary": {
    "total_items": 16,
    "from_env": 0,
    "defaults": 16
  },
  "items": [
    {
      "env_key": "ADMIN_HEALTH_TIMEOUT_MS",
      "value": "2500",
      "source": "default"
    }
  ]
}
```

## Reversa primero

Esta seccion sirve para deshacer el Dia 47 sin afectar Salud, Arranque, Runbook ni Auditoria.

### Paso 1 - Eliminar endpoint

Eliminar:

```text
C:\VENTA-DE-PASAJES\apps\mfe-admin\app\api\admin\runtime-config\route.ts
```

Y si queda vacia, eliminar:

```text
C:\VENTA-DE-PASAJES\apps\mfe-admin\app\api\admin\runtime-config
```

### Paso 2 - Revertir timeout configurable

En `apps\mfe-admin\app\api\admin\health\route.ts`, volver a timeout fijo:

```text
defaultTimeoutMs = 2500.
probeTarget sin parametro timeoutMs.
GET devolviendo timeout_ms fijo.
```

En `apps\mfe-admin\.env.example`, quitar:

```text
ADMIN_HEALTH_TIMEOUT_MS=2500
```

### Paso 3 - Revertir pantalla admin

En `apps\mfe-admin\app\admin\embedded\page.tsx` quitar:

```text
AdminView config.
Tipos RuntimeConfigGroup, RuntimeConfigItem y RuntimeConfigResponse.
Funcion runtimeGroupLabel.
Componente RuntimeConfigPanel.
Query admin/runtime-config.
Pestana Parametros.
Tarjetas Parametros, Desde env, Default y Reinicio.
Render del panel Parametros operativos.
```

### Paso 4 - Revertir estilos

En `apps\mfe-admin\app\globals.css` quitar:

```text
config-grid
config-card
config-card-header
config-source
config-source-env
config-source-default
```

### Paso 5 - Revertir manifest y README

En `apps\mfe-admin\app\mfe\manifest\route.ts`, quitar:

```text
parametros-operativos
```

En `apps\README.md`, quitar:

```text
/api/admin/runtime-config
```

### Paso 6 - Validar reversa

```powershell
cd C:\VENTA-DE-PASAJES
npm run typecheck -w @venta-pasajes/mfe-admin
npm run build -w @venta-pasajes/mfe-admin
```

Resultado esperado:

```text
typecheck OK.
build OK.
/api/admin/runtime-config ya no aparece en el listado de rutas del build.
```

## Guia manual desde cero

Esta guia no significa que los archivos deban crearse otra vez en este workspace. El Dia 47 ya esta implementado. Los pasos siguientes sirven para una maquina limpia, una reversa aplicada previamente o una practica donde se quiera rehacer el cambio desde cero.

Importante: si PowerShell muestra `PS C:\Windows\system32>`, primero moverse al proyecto.

```powershell
cd C:\VENTA-DE-PASAJES
```

Para confirmar el estado actual desde cualquier carpeta:

```powershell
$ProjectRoot = "C:\VENTA-DE-PASAJES"
Set-Location $ProjectRoot

Test-Path -LiteralPath "$ProjectRoot\apps\mfe-admin\app\api\admin\runtime-config\route.ts"
Select-String -Path "$ProjectRoot\apps\mfe-admin\app\mfe\manifest\route.ts" -Pattern "parametros-operativos"
```

Resultado esperado:

```text
True
Linea del manifest con parametros-operativos.
```

### Paso 1 - Confirmar prerequisitos

```powershell
$ProjectRoot = "C:\VENTA-DE-PASAJES"
Set-Location $ProjectRoot

Test-Path -LiteralPath "$ProjectRoot\apps\mfe-admin\app\api\admin\health\route.ts"
Test-Path -LiteralPath "$ProjectRoot\apps\mfe-admin\app\api\admin\startup-checklist\route.ts"
Test-Path -LiteralPath "$ProjectRoot\docs\dia-46-arranque-guiado-admin.md"
```

Resultado esperado:

```text
True
True
True
```

### Paso 2 - Crear carpeta del endpoint, solo si no existe

```powershell
$ProjectRoot = "C:\VENTA-DE-PASAJES"
[System.IO.Directory]::CreateDirectory("$ProjectRoot\apps\mfe-admin\app\api\admin\runtime-config") | Out-Null
```

### Paso 3 - Crear route.ts de runtime-config, solo si no existe

Archivo:

```text
apps\mfe-admin\app\api\admin\runtime-config\route.ts
```

El endpoint debe devolver:

```text
generated_at
items
summary
```

Cada item debe tener:

```text
id
group
env_key
value
default_value
source
description
docs
restart_required
commands
```

Validar existencia:

```powershell
$ProjectRoot = "C:\VENTA-DE-PASAJES"
Test-Path -LiteralPath "$ProjectRoot\apps\mfe-admin\app\api\admin\runtime-config\route.ts"
```

### Paso 4 - Hacer configurable el timeout de salud

En `apps\mfe-admin\app\api\admin\health\route.ts`:

```text
Agregar ADMIN_HEALTH_TIMEOUT_MS.
Parsear como numero positivo.
Usar fallback 2500.
Pasar timeoutMs a probeTarget.
Responder timeout_ms con el valor efectivo.
```

En `apps\mfe-admin\.env.example`, agregar:

```text
ADMIN_HEALTH_TIMEOUT_MS=2500
```

### Paso 5 - Actualizar pantalla admin

En `apps\mfe-admin\app\admin\embedded\page.tsx` agregar:

```text
Pestana Parametros.
Query a /api/admin/runtime-config.
Tarjetas de total, desde env, default y reinicio.
Panel con variables operativas.
Boton Copiar para comandos.
```

La pantalla debe mantener:

```text
Salud.
Arranque.
Runbook.
Parametros.
Auditoria.
```

### Paso 6 - Actualizar estilos

En `apps\mfe-admin\app\globals.css` agregar estilos para:

```text
config-grid
config-card
config-source
```

### Paso 7 - Actualizar contrato del MFE

En `apps\mfe-admin\app\mfe\manifest\route.ts`, agregar capacidad:

```text
parametros-operativos
```

Validar:

```powershell
$ProjectRoot = "C:\VENTA-DE-PASAJES"
Select-String -Path "$ProjectRoot\apps\mfe-admin\app\mfe\manifest\route.ts" -Pattern "parametros-operativos"
```

### Paso 8 - Actualizar README de apps

En `apps\README.md`, agregar:

```text
curl.exe -s "http://localhost:3005/api/admin/runtime-config"
```

### Paso 9 - Validar typecheck y build

```powershell
cd C:\VENTA-DE-PASAJES
npm run typecheck -w @venta-pasajes/mfe-admin
npm run build -w @venta-pasajes/mfe-admin
```

Resultado esperado:

```text
typecheck OK.
build OK.
Next lista /api/admin/runtime-config.
```

### Paso 10 - Levantar mfe-admin si no esta activo

```powershell
Get-NetTCPConnection -LocalPort 3005 -ErrorAction SilentlyContinue |
  Select-Object LocalAddress,LocalPort,State,OwningProcess
```

Si no hay salida:

```powershell
npm run dev:mfe-admin
```

### Paso 11 - Validar HTTP

```powershell
curl.exe -s -o NUL -w "%{http_code}" http://localhost:3005/api/admin/runtime-config

$Config = curl.exe -s http://localhost:3005/api/admin/runtime-config | ConvertFrom-Json
[pscustomobject]@{
  total_items = $Config.summary.total_items
  from_env = $Config.summary.from_env
  defaults = $Config.summary.defaults
  has_timeout = [bool]($Config.items | Where-Object env_key -eq ADMIN_HEALTH_TIMEOUT_MS)
}
```

Resultado esperado:

```text
HTTP 200.
total_items=16.
has_timeout=True.
```

### Paso 12 - Validar timeout efectivo de health

```powershell
curl.exe -s http://localhost:3005/api/admin/health |
  ConvertFrom-Json |
  Select-Object timeout_ms,status
```

Resultado esperado:

```text
timeout_ms=2500 por default, salvo que ADMIN_HEALTH_TIMEOUT_MS este configurado.
```

### Paso 13 - Validar documentos referenciados

```powershell
$ProjectRoot = "C:\VENTA-DE-PASAJES"
$RoutePath = Join-Path $ProjectRoot "apps\mfe-admin\app\api\admin\runtime-config\route.ts"

if (-not (Test-Path -LiteralPath $RoutePath)) {
  throw "No existe el archivo: $RoutePath"
}

$Content = Get-Content -LiteralPath $RoutePath -Raw
$DocRefs = [regex]::Matches($Content, '"(docs\\\\dia-[^"]+\.md)"') |
  ForEach-Object { $_.Groups[1].Value.Replace("\\", "\") } |
  Sort-Object -Unique

$DocRefs |
  ForEach-Object {
    $FullPath = Join-Path $ProjectRoot $_
    [pscustomobject]@{
      Path = $_
      Exists = Test-Path -LiteralPath $FullPath
    }
  } |
  Format-Table -AutoSize
```

Resultado esperado:

```text
Todos los documentos referenciados existen.
```

## Troubleshooting

### curl no devuelve nada

Si se usa `curl.exe -s`, los errores de conexion pueden quedar ocultos. Verificar primero si el puerto 3005 esta activo:

```powershell
Get-NetTCPConnection -LocalPort 3005 -ErrorAction SilentlyContinue
```

Si no hay salida, levantar:

```powershell
npm run dev:mfe-admin
```

### Un valor aparece como default

Significa que la variable no esta configurada en el entorno del proceso `mfe-admin`.

Opciones:

```powershell
notepad .\apps\mfe-admin\.env.local
```

O configurar solo la sesion actual antes de levantar `mfe-admin`:

```powershell
$env:ADMIN_HEALTH_TIMEOUT_MS = "4000"
npm run dev:mfe-admin
```

### Cambie una variable pero no se refleja

La mayoria de variables se leen al arrancar el proceso. Reiniciar `mfe-admin`.

```powershell
npm run stop:frontend
npm run dev:mfe-admin
```

## Validacion final

```text
Test-Path runtime-config route.ts: True.
Select-String parametros-operativos: OK.
npm run typecheck -w @venta-pasajes/mfe-admin: OK.
npm run build -w @venta-pasajes/mfe-admin: OK.
Next listo /api/admin/runtime-config.
curl /api/admin/runtime-config: HTTP 200.
/api/admin/runtime-config: total_items=16, from_env=0, defaults=16, has_timeout=True.
/api/admin/health: timeout_ms=2500.
/admin/embedded: HTTP 200.
/mfe/manifest: contiene parametros-operativos y arranque-guiado.
Todos los documentos referenciados existen.
```

## Siguiente paso natural

```text
Agregar exportacion de diagnostico administrativo en JSON para adjuntar estado, parametros, runbook y health en un solo archivo.
```
