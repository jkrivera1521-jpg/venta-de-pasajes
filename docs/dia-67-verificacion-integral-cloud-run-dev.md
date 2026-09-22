# Dia 67 - Verificacion integral Cloud Run dev

## Objetivo

Crear una verificacion automatica y de solo lectura para confirmar que el entorno `dev` de Cloud Run esta operativo de punta a punta:

- Backends privados desplegados y en estado Ready.
- Frontends publicos desplegados y en estado Ready.
- Health checks de los doce servicios.
- Manifiestos `/mfe/manifest` de los cinco MFEs.
- Rutas embebidas del shell y de cada MFE.
- Consultas funcionales de lectura contra los backends principales.

Este dia no despliega servicios, no modifica Cloud Run, no escribe datos en las bases y no cambia permisos.

## Resultado

Se creo:

```text
C:\VENTA-DE-PASAJES\scripts\verify-cloudrun-dev-stack.ps1
```

El script lee la configuracion real desde:

```text
C:\VENTA-DE-PASAJES\infra\cloudrun\dev-services.json
```

Y genera el resultado en:

```text
C:\VENTA-DE-PASAJES\logs\cloudrun-dev\verify-cloudrun-dev-stack.result.json
```

Resultado observado:

```text
Servicios Ready: 12/12
Checks HTTP OK: 34/34
```

Servicios validados:

```text
identity-service
dispatch-service
document-service
reporting-service
audit-service
ticketing-service
mfe-identity
mfe-dispatch
mfe-ticketing
mfe-reporting
mfe-admin
frontend-shell
```

Revisiones Cloud Run observadas:

```text
identity-service   identity-service-00009-lwr
dispatch-service   dispatch-service-00006-sr5
document-service   document-service-00008-zqv
reporting-service  reporting-service-00005-k8d
audit-service      audit-service-00006-z6g
ticketing-service  ticketing-service-00004-nwg
mfe-identity       mfe-identity-00004-sqb
mfe-dispatch       mfe-dispatch-00004-k4l
mfe-ticketing      mfe-ticketing-00004-5mq
mfe-reporting      mfe-reporting-00004-tv9
mfe-admin          mfe-admin-00004-lxk
frontend-shell     frontend-shell-00004-567
```

## Reversa primero

Esta practica solo agrega una herramienta local de verificacion y documentacion. No hay reversa de infraestructura porque Cloud Run, Cloud SQL, Artifact Registry, IAM y Secret Manager no se modifican.

Si se necesita retirar lo agregado por este dia:

```powershell
cd C:\VENTA-DE-PASAJES

git restore -- README.md infra\README.md vitacora.md

Remove-Item -LiteralPath .\scripts\verify-cloudrun-dev-stack.ps1 -Force
Remove-Item -LiteralPath .\docs\dia-67-verificacion-integral-cloud-run-dev.md -Force
```

Si solo se quiere eliminar el resultado local generado:

```powershell
cd C:\VENTA-DE-PASAJES

Remove-Item -LiteralPath .\logs\cloudrun-dev\verify-cloudrun-dev-stack.result.json -Force
```

## Guia manual desde cero

### Paso 1 - Ir a la raiz del proyecto

```powershell
cd C:\VENTA-DE-PASAJES
```

### Paso 2 - Confirmar que la configuracion existe

```powershell
Test-Path -LiteralPath .\infra\cloudrun\dev-services.json
Test-Path -LiteralPath .\scripts\verify-cloudrun-dev-stack.ps1
```

Ambos comandos deben devolver:

```text
True
```

### Paso 3 - Confirmar que gcloud esta autenticado

```powershell
gcloud auth list
gcloud config get-value project
```

El proyecto activo esperado es:

```text
project-fbb34cd7-0b82-43e1-867
```

Si `gcloud` falla por Python en Windows, definir Python antes de ejecutar:

```powershell
$env:CLOUDSDK_PYTHON = "C:\Python312\python.exe"
```

### Paso 4 - Ejecutar la verificacion integral

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-cloudrun-dev-stack.ps1
```

El comando debe terminar con:

```text
Verificacion Cloud Run dev OK: 34/34 checks.
```

### Paso 5 - Revisar el resultado JSON

```powershell
Get-Content -LiteralPath .\logs\cloudrun-dev\verify-cloudrun-dev-stack.result.json -Raw
```

Para ver solo el resumen:

```powershell
$Result = Get-Content -LiteralPath .\logs\cloudrun-dev\verify-cloudrun-dev-stack.result.json -Raw | ConvertFrom-Json
$Result.summary
```

Resultado esperado:

```text
services_total : 12
services_ready : 12
checks_total   : 34
checks_passed  : 34
checks_failed  : 0
```

### Paso 6 - Ejecutar solo verificacion basica

Si se quiere validar solo salud, manifiestos, runtime config y pantallas embebidas, sin consultas funcionales de backend:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-cloudrun-dev-stack.ps1 -SkipFunctionalChecks
```

## Que valida el script

Checks publicos sin token:

```text
/api/health en frontend-shell y cinco MFEs
/mfe/manifest en cinco MFEs
/identity/embedded
/dispatch/embedded
/ticketing/embedded
/reporting/embedded
/admin/embedded
/api/shell/runtime-config
```

Checks privados con token de identidad de Google:

```text
/api/v1/identity/health
/api/v1/dispatch/health
/api/v1/document/health
/api/v1/reporting/health
/api/v1/audit/health
/api/v1/ticketing/health
```

Consultas funcionales de lectura:

```text
/api/v1/dispatch/terminals?page=1&page_size=1
/api/v1/dispatch/departures?page=1&page_size=1
/api/v1/document/resources
/api/v1/reporting/resources
/api/v1/audit/resources
/api/v1/ticketing/resources
/api/v1/ticketing/passengers
/api/v1/ticketing/availability/departures?date_from=2026-09-01&date_to=2026-09-30
/api/v1/reporting/reports/sales?date_from=2026-09-01&date_to=2026-09-30
/api/v1/audit/audit-events?page=1&page_size=1
```

## Diagnostico si falla

Si falla un servicio con `service not Ready`, revisar Cloud Run:

```powershell
gcloud run services describe identity-service --project project-fbb34cd7-0b82-43e1-867 --region us-central1
```

Cambiar `identity-service` por el servicio fallido.

Si falla un backend privado con `401` o `403`, revisar la sesion de `gcloud`:

```powershell
gcloud auth login
gcloud auth print-identity-token
```

Si falla un endpoint funcional con `500`, revisar logs del servicio:

```powershell
gcloud run services logs read ticketing-service --project project-fbb34cd7-0b82-43e1-867 --region us-central1 --limit 50
```

Cambiar `ticketing-service` por el servicio fallido.

## Comandos ejecutados

```powershell
cd C:\VENTA-DE-PASAJES

powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-cloudrun-dev-stack.ps1
```

Validaciones finales:

```text
12 servicios Ready.
34 checks HTTP respondieron 200.
Resultado JSON generado correctamente.
```
