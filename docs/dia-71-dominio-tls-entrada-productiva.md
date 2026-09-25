# Dia 71 - Dominio, TLS y entrada productiva

## Objetivo

Alinear el Dia 71 con `C:\VENTA-DE-PASAJES\tareas.md`: definir la entrada productiva segura, preparar dominio/TLS/Load Balancer y dejar una validacion clara antes de entregar una URL final a usuarios.

## Resultado real

Se preparo la configuracion de entrada productiva:

```text
C:\VENTA-DE-PASAJES\infra\gcloud\entrypoint-prod.json
```

Se crearon los scripts:

```text
C:\VENTA-DE-PASAJES\infra\gcloud\bootstrap-prod-entrypoint.ps1
C:\VENTA-DE-PASAJES\infra\gcloud\verify-prod-entrypoint.ps1
```

Arquitectura seleccionada:

```text
Usuario -> DNS -> Global HTTPS Load Balancer -> Serverless NEG -> Cloud Run frontend-shell-prod
```

La URL productiva queda definida como:

```text
https://<dominio-productivo-confirmado>
```

No se ejecuto configuracion real del Load Balancer porque faltan dos condiciones obligatorias:

```text
Dominio productivo real confirmado: pendiente.
frontend-shell-prod con APP_ENV=prod y frontend-prod-run: pendiente.
```

Esto evita apuntar una URL productiva al `frontend-shell` actual, que hoy corresponde a dev.

Evidencia observada:

```text
Cloud Run frontend-shell existe: True
NEXT_PUBLIC_APP_ENV actual: dev
Service account actual: frontend-shell-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com
Service account esperada produccion: frontend-prod-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com
```

## Reversa primero

Usar esta reversa solo si se ejecuto `bootstrap-prod-entrypoint.ps1 -Execute` y se necesita retirar la entrada productiva.

No elimina Cloud Run, bases, secretos ni Pub/Sub. Solo retira los recursos de entrada HTTPS.

```powershell
cd C:\VENTA-DE-PASAJES

$ProjectId = "project-fbb34cd7-0b82-43e1-867"
$Region = "us-central1"

$Config = Get-Content -LiteralPath .\infra\gcloud\entrypoint-prod.json -Raw | ConvertFrom-Json
$Lb = $Config.load_balancer

gcloud compute forwarding-rules delete $Lb.forwarding_rule_name `
  --project $ProjectId `
  --global `
  --quiet

gcloud compute target-https-proxies delete $Lb.https_proxy_name `
  --project $ProjectId `
  --global `
  --quiet

gcloud compute url-maps delete $Lb.url_map_name `
  --project $ProjectId `
  --global `
  --quiet

gcloud compute backend-services delete $Lb.backend_service_name `
  --project $ProjectId `
  --global `
  --quiet

gcloud compute network-endpoint-groups delete $Lb.serverless_neg_name `
  --project $ProjectId `
  --region $Region `
  --quiet

gcloud compute ssl-certificates delete $Lb.managed_certificate_name `
  --project $ProjectId `
  --global `
  --quiet

gcloud compute addresses delete $Lb.global_ip_name `
  --project $ProjectId `
  --global `
  --quiet
```

Tambien retirar el registro DNS `A` en el proveedor de dominio. Ese paso no se puede automatizar aqui porque depende de donde se administre el dominio.

Validar la reversa:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\infra\gcloud\verify-prod-entrypoint.ps1
```

El resultado esperado despues de reversa es `prod entrypoint ready = False`, porque la entrada productiva fue retirada.

## Guia manual desde cero

Entrar a la raiz real:

```powershell
cd C:\VENTA-DE-PASAJES
```

Fijar Python 3.12 para `gcloud`:

```powershell
$env:CLOUDSDK_PYTHON = "C:\Python312\python.exe"
```

Validar archivos:

```powershell
Test-Path -LiteralPath .\infra\gcloud\entrypoint-prod.json
Test-Path -LiteralPath .\infra\gcloud\bootstrap-prod-entrypoint.ps1
Test-Path -LiteralPath .\infra\gcloud\verify-prod-entrypoint.ps1
```

Validar JSON:

```powershell
Get-Content -LiteralPath .\infra\gcloud\entrypoint-prod.json -Raw | ConvertFrom-Json | Out-Null
```

Validar sintaxis PowerShell:

```powershell
$PsFiles = @(
  ".\infra\gcloud\bootstrap-prod-entrypoint.ps1",
  ".\infra\gcloud\verify-prod-entrypoint.ps1"
)

foreach ($File in $PsFiles) {
  $Tokens = $null
  $Errors = $null
  [System.Management.Automation.Language.Parser]::ParseFile((Resolve-Path $File), [ref]$Tokens, [ref]$Errors) | Out-Null
  if ($Errors.Count -gt 0) { $Errors; throw "Error de sintaxis en $File" }
  "$File OK"
}
```

Verificar estado actual:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\infra\gcloud\verify-prod-entrypoint.ps1
```

Antes de aplicar, definir el dominio real:

```powershell
$DomainName = Read-Host "Ingrese el dominio productivo real"
if ([string]::IsNullOrWhiteSpace($DomainName)) {
  throw "Debe ingresar un dominio productivo real."
}
```

Ejecutar primero en modo plan. Este comando no modifica Google Cloud:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\infra\gcloud\bootstrap-prod-entrypoint.ps1 `
  -DomainName $DomainName
```

Aplicar solo cuando `frontend-shell-prod` ya este desplegado con:

```text
NEXT_PUBLIC_APP_ENV=prod
Service account: frontend-prod-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com
```

Comando real:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\infra\gcloud\bootstrap-prod-entrypoint.ps1 `
  -DomainName $DomainName `
  -Execute
```

Obtener la IP global creada:

```powershell
gcloud compute addresses describe venta-pasajes-prod-ip `
  --project project-fbb34cd7-0b82-43e1-867 `
  --global `
  --format "value(address)"
```

En el proveedor DNS del dominio, crear o actualizar:

```text
Tipo: A
Nombre: <dominio-productivo-confirmado>
Valor: <IP-global-venta-pasajes-prod-ip>
TTL: 300 o valor estandar del proveedor
```

Esperar a que el certificado quede activo:

```powershell
gcloud compute ssl-certificates describe venta-pasajes-prod-managed-cert `
  --project project-fbb34cd7-0b82-43e1-867 `
  --global `
  --format "value(managed.status)"
```

Crear evidencia de validacion desde oficinas cuando se pruebe desde red administrativa y terminal:

```powershell
New-Item -ItemType Directory -Force -Path .\logs\prod-entrypoint | Out-Null

@{
  ready = $true
  validated_at = (Get-Date).ToString("o")
  validated_by = "<responsable>"
  domain = $DomainName
  checks = @(
    "open_final_url_from_admin_office",
    "open_final_url_from_terminal_office",
    "health_endpoint_returns_200",
    "login_page_loads_over_https"
  )
} | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath .\logs\prod-entrypoint\office-validation-prod.json -Encoding UTF8
```

Validar todo:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\infra\gcloud\verify-prod-entrypoint.ps1 `
  -DomainName $DomainName `
  -FailOnNotReady
```

## Validacion ejecutada en este dia

Se ejecuto el verificador sin `-FailOnNotReady`:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\infra\gcloud\verify-prod-entrypoint.ps1
```

Resultado observado:

```text
Domain real production domain configured: False
Cloud Run frontend service exists: True
Cloud Run frontend uses prod env: False
Cloud Run frontend uses prod service account: False
Load Balancer global IP exists: False
TLS managed certificate exists: False
DNS A record points to global IP: False
Access health endpoint returns 200: False
Office validation evidence ready: False
Overall prod entrypoint ready: False
```

Tambien se probo que el bootstrap se bloquee sin dominio real:

```text
Defina un dominio productivo real con -DomainName. No se configura TLS/LB con placeholders.
```

## Evidencia

```text
C:\VENTA-DE-PASAJES\logs\prod-entrypoint\verify-prod-entrypoint.json
```

## Lectura ejecutiva

El Dia 71 deja lista la ruta segura de entrada productiva, pero no publica una URL final todavia. La publicacion real debe esperar a que se confirme el dominio y a que `frontend-shell-prod` este desplegado como produccion.
