# Dia 46 - arranque guiado en mfe-admin

Fecha de ejecucion: 2026-09-17

## Objetivo

Agregar al `mfe-admin` una vista de arranque guiado para levantar y verificar el sistema por pasos, usando el health consolidado como fuente de estado.

Alcance del dia:

```text
Crear API administrativa /api/admin/startup-checklist.
Agregar pestana Arranque en mfe-admin.
Mostrar pasos preflight, backends y frontends.
Conectar cada paso verificable con /api/admin/health.
Mostrar comandos copiables para ejecutar y validar.
Actualizar manifest y README de apps.
Validar typecheck, build y HTTP.
```

## Resultado logrado

```text
mfe-admin expone GET /api/admin/startup-checklist.
La pantalla admin tiene pestanas Salud, Arranque, Runbook y Auditoria.
Arranque muestra 14 pasos: 2 preflight, 6 backends y 6 frontends.
Los pasos con target_id toman estado automatico desde /api/admin/health.
El manifest de mfe-admin declara la capacidad arranque-guiado.
```

## Archivos creados

```text
C:\VENTA-DE-PASAJES\apps\mfe-admin\app\api\admin\startup-checklist\route.ts
C:\VENTA-DE-PASAJES\docs\dia-46-arranque-guiado-admin.md
```

## Archivos modificados

```text
C:\VENTA-DE-PASAJES\apps\mfe-admin\app\admin\embedded\page.tsx
C:\VENTA-DE-PASAJES\apps\mfe-admin\app\globals.css
C:\VENTA-DE-PASAJES\apps\mfe-admin\app\mfe\manifest\route.ts
C:\VENTA-DE-PASAJES\apps\README.md
C:\VENTA-DE-PASAJES\vitacora.md
```

## Endpoint agregado

```text
GET /api/admin/startup-checklist
```

Respuesta resumida:

```json
{
  "total_steps": 14,
  "steps": [
    {
      "id": "start-mfe-admin",
      "group": "frontend",
      "target_id": "mfe-admin",
      "commands": [],
      "verify_commands": []
    }
  ]
}
```

## Reversa primero

Esta seccion sirve para deshacer el Dia 46 sin afectar Salud, Runbook ni Auditoria.

### Paso 1 - Eliminar endpoint

Eliminar:

```text
C:\VENTA-DE-PASAJES\apps\mfe-admin\app\api\admin\startup-checklist\route.ts
```

Y si queda vacia, eliminar la carpeta:

```text
C:\VENTA-DE-PASAJES\apps\mfe-admin\app\api\admin\startup-checklist
```

### Paso 2 - Revertir pantalla admin

En `apps\mfe-admin\app\admin\embedded\page.tsx` quitar:

```text
AdminView startup.
Tipos StartupGroup, StartupStep, StartupChecklistResponse y StartupState.
Funciones startupGroupLabel, startupState, startupStateLabel.
Componente StartupPanel.
Query admin/startup-checklist.
Pestana Arranque.
Tarjetas de Pasos, Listos, Pendientes y Actualizado.
Render del panel Arranque guiado.
```

### Paso 3 - Revertir estilos

En `apps\mfe-admin\app\globals.css` quitar:

```text
startup-list
startup-step
startup-step-ready
startup-step-pending
startup-step-manual
startup-step-unknown
startup-step-order
startup-step-body
startup-step-header
startup-state
startup-state-ready
startup-state-pending
startup-state-manual
startup-state-unknown
```

### Paso 4 - Revertir manifest y README

En `apps\mfe-admin\app\mfe\manifest\route.ts`, quitar:

```text
arranque-guiado
```

En `apps\README.md`, quitar:

```text
/api/admin/startup-checklist
```

### Paso 5 - Validar reversa

```powershell
npm run typecheck -w @venta-pasajes/mfe-admin
npm run build -w @venta-pasajes/mfe-admin
```

Resultado esperado:

```text
typecheck OK.
build OK.
/api/admin/startup-checklist ya no aparece en el listado de rutas del build.
```

## Guia manual desde cero

Esta guia no significa que los archivos deban crearse otra vez en este workspace. El Dia 46 ya esta implementado. Los pasos siguientes sirven para una maquina limpia, una reversa aplicada previamente o una practica donde se quiera rehacer el cambio desde cero.

Importante: si PowerShell muestra `PS C:\Windows\system32>`, primero moverse al proyecto. Cualquier comando que empiece con `.\apps` solo funciona desde `C:\VENTA-DE-PASAJES`.

```powershell
cd C:\VENTA-DE-PASAJES
```

Para confirmar el estado actual:

```powershell
$ProjectRoot = "C:\VENTA-DE-PASAJES"
Set-Location $ProjectRoot

Test-Path -LiteralPath "$ProjectRoot\apps\mfe-admin\app\api\admin\startup-checklist\route.ts"
Select-String -Path "$ProjectRoot\apps\mfe-admin\app\mfe\manifest\route.ts" -Pattern "arranque-guiado"
```

Resultado esperado:

```text
True
Linea del manifest con arranque-guiado.
```

### Paso 1 - Entrar al proyecto

```powershell
cd C:\VENTA-DE-PASAJES
```

### Paso 2 - Confirmar prerequisitos

```powershell
Test-Path -LiteralPath .\apps\mfe-admin\app\api\admin\health\route.ts
Test-Path -LiteralPath .\apps\mfe-admin\app\api\admin\runbook\route.ts
Test-Path -LiteralPath .\docs\dia-45-runbook-operativo-admin.md
```

Resultado esperado:

```text
True
True
True
```

### Paso 3 - Crear carpeta del endpoint, solo si no existe

```powershell
[System.IO.Directory]::CreateDirectory(".\apps\mfe-admin\app\api\admin\startup-checklist") | Out-Null
```

### Paso 4 - Crear route.ts del checklist, solo si no existe

Archivo:

```text
apps\mfe-admin\app\api\admin\startup-checklist\route.ts
```

El endpoint debe devolver:

```text
generated_at
steps
total_steps
```

Cada paso debe tener:

```text
id
order
title
description
group
target_id
docs
commands
verify_commands
```

Validar existencia:

```powershell
Test-Path -LiteralPath .\apps\mfe-admin\app\api\admin\startup-checklist\route.ts
```

### Paso 5 - Actualizar pantalla admin

En `apps\mfe-admin\app\admin\embedded\page.tsx` agregar:

```text
Pestana Arranque.
Query a /api/admin/startup-checklist.
Cruce de target_id contra /api/admin/health.
Tarjetas de pasos, listos, pendientes y actualizado.
Panel con pasos por orden.
Boton Copiar para comandos.
```

La pantalla debe mantener:

```text
Salud.
Arranque.
Runbook.
Auditoria.
```

### Paso 6 - Actualizar estilos

En `apps\mfe-admin\app\globals.css` agregar estilos para:

```text
startup-list
startup-step
startup-state
```

### Paso 7 - Actualizar contrato del MFE

En `apps\mfe-admin\app\mfe\manifest\route.ts`, agregar capacidad:

```text
arranque-guiado
```

Validar:

```powershell
Select-String -Path .\apps\mfe-admin\app\mfe\manifest\route.ts -Pattern "arranque-guiado"
```

### Paso 8 - Actualizar README de apps

En `apps\README.md`, agregar el endpoint:

```text
curl.exe -s "http://localhost:3005/api/admin/startup-checklist"
```

### Paso 9 - Validar typecheck y build

```powershell
npm run typecheck -w @venta-pasajes/mfe-admin
npm run build -w @venta-pasajes/mfe-admin
```

Resultado esperado:

```text
typecheck OK.
build OK.
Next lista /api/admin/startup-checklist.
```

### Paso 10 - Levantar mfe-admin si no esta activo

Validar puerto:

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
curl.exe -s -o NUL -w "%{http_code}" http://localhost:3005/api/admin/startup-checklist

$Checklist = curl.exe -s http://localhost:3005/api/admin/startup-checklist | ConvertFrom-Json
[pscustomobject]@{
  total_steps = $Checklist.total_steps
  preflight = @($Checklist.steps | Where-Object group -eq preflight).Count
  backends = @($Checklist.steps | Where-Object group -eq backend).Count
  frontends = @($Checklist.steps | Where-Object group -eq frontend).Count
}
```

Resultado esperado:

```text
HTTP 200.
total_steps=14.
preflight=2.
backends=6.
frontends=6.
```

### Paso 12 - Validar documentos referenciados

```powershell
$ProjectRoot = "C:\VENTA-DE-PASAJES"
$RoutePath = Join-Path $ProjectRoot "apps\mfe-admin\app\api\admin\startup-checklist\route.ts"

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

### El paso aparece como Pendiente

El estado automatico depende de `/api/admin/health`. Revisar el target correspondiente:

```powershell
curl.exe -s http://localhost:3005/api/admin/health
```

Si el backend o frontend no responde en su puerto, el paso se mantiene pendiente.

### El boton Copiar no copia

El boton usa `navigator.clipboard`. En `localhost` debe funcionar. Si el navegador lo bloquea, seleccionar el comando manualmente.

## Validacion final

```text
Test-Path startup-checklist route.ts: True.
Select-String arranque-guiado: OK.
npm run typecheck -w @venta-pasajes/mfe-admin: OK.
npm run build -w @venta-pasajes/mfe-admin: OK.
Next listo /api/admin/startup-checklist.
curl /api/admin/startup-checklist: HTTP 200.
/api/admin/startup-checklist: total_steps=14, preflight=2, backends=6, frontends=6.
/admin/embedded: HTTP 200.
/mfe/manifest: contiene arranque-guiado y runbook-operativo.
```

## Siguiente paso natural

```text
Agregar parametros administrativos editables para URLs, timeouts y puertos operativos sin recompilar el frontend.
```
