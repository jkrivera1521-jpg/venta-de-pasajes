# Dia 65 - Autenticacion MFE hacia backends privados en Cloud Run

Fecha de ejecucion: 2026-09-22

## Objetivo

Permitir que el `frontend-shell` publico y los MFEs desplegados en Cloud Run consuman backends privados sin abrir los backends a internet.

Alcance del dia:

```text
Validar el shell publico y los manifiestos MFE.
Confirmar que los backends privados responden solo con identity token.
Otorgar roles/run.invoker a la cuenta de ejecucion frontend sobre los backends.
Agregar token Cloud Run service-to-service en los proxies server-side de los MFEs.
Publicar y desplegar los MFEs afectados.
Validar que ya no aparecen errores Forbidden por backend privado.
Separar el pendiente real de backend nativo Cloud SQL.
Documentar reversa y guia manual desde cero.
```

## Problema encontrado

Los backends estaban correctamente privados en Cloud Run. Una llamada sin token devolvia:

```text
HTTP 403
```

Una llamada con identity token devolvia:

```text
HTTP 200
```

El problema no era CORS ni el navegador directamente. El flujo real era:

```text
Navegador -> frontend-shell publico -> MFE publico -> proxy API del MFE -> backend privado
```

El proxy API del MFE corria dentro de Cloud Run, pero no estaba enviando un identity token para el backend privado. Ademas, la cuenta de servicio frontend necesitaba permiso `roles/run.invoker` sobre cada backend.

## Resultado logrado

```text
Se creo scripts\grant-cloudrun-invoker.ps1.
Se otorgo roles/run.invoker a frontend-shell-run sobre los seis backends privados.
Se agrego helper cloudRunAuth.ts en cinco MFEs.
Los proxies de identity, dispatch, ticketing, reporting y admin agregan identity token solo cuando corren en Cloud Run y el destino es *.run.app.
Si llega Authorization del usuario, se conserva como x-forwarded-authorization antes de reemplazar Authorization por el token service-to-service.
Se validaron typecheck y build de los MFEs afectados.
Se publicaron imagenes frontend con tag 0.1.2-frontend.
Se promovieron esas imagenes a dev.
Se desplegaron los cinco MFEs afectados en Cloud Run dev.
Admin quedo operativo: frontends 6/6, backends 6/6, 12 activos / 12 total.
El error Forbidden desaparecio de los MFEs.
```

Cuenta autorizada para invocar backends:

```text
frontend-shell-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com
```

Backends privados autorizados:

```text
identity-service
dispatch-service
ticketing-service
document-service
reporting-service
audit-service
```

## Pendiente detectado fuera del proxy MFE

Despues de corregir permisos y token service-to-service, algunas pantallas dejaron de fallar con `403`, pero algunas consultas funcionales devolvieron `HTTP 500`.

El log de `dispatch-service` mostro:

```text
org.hibernate.exception.JDBCConnectionException
The SocketFactory class provided com.google.cloud.sql.postgres.SocketFactory could not be instantiated.
Caused by: java.lang.ClassNotFoundException: com.google.cloud.sql.postgres.SocketFactory
```

Esto es otro problema: la imagen nativa de backend no contiene el conector Cloud SQL PostgreSQL.

Se agrego la dependencia `com.google.cloud.sql:postgres-socket-factory:1.24.2` a los `pom.xml` de backends y plantilla. La compilacion JVM con esa dependencia resolvio correctamente, pero la compilacion nativa de `dispatch-service` todavia falla en GraalVM/Mandrel por clases `jnr` usadas por el conector Cloud SQL Unix Socket.

Estado honesto:

```text
Dia 65 queda cerrado para autenticacion MFE -> backend privado.
El pendiente para el siguiente dia es resolver la compatibilidad native image de Cloud SQL Socket Factory o definir una imagen JVM backend para Cloud Run.
No se desplegaron nuevos backends nativos con la dependencia porque la prueba nativa real fallo.
```

## Archivos creados

```text
C:\VENTA-DE-PASAJES\scripts\grant-cloudrun-invoker.ps1
C:\VENTA-DE-PASAJES\apps\mfe-identity\app\api\_lib\cloudRunAuth.ts
C:\VENTA-DE-PASAJES\apps\mfe-dispatch\app\api\_lib\cloudRunAuth.ts
C:\VENTA-DE-PASAJES\apps\mfe-ticketing\app\api\_lib\cloudRunAuth.ts
C:\VENTA-DE-PASAJES\apps\mfe-reporting\app\api\_lib\cloudRunAuth.ts
C:\VENTA-DE-PASAJES\apps\mfe-admin\app\api\_lib\cloudRunAuth.ts
C:\VENTA-DE-PASAJES\docs\dia-65-cloud-run-mfe-backend-auth.md
```

## Archivos modificados

```text
C:\VENTA-DE-PASAJES\apps\mfe-identity\app\api\identity\[...path]\route.ts
C:\VENTA-DE-PASAJES\apps\mfe-dispatch\app\api\dispatch\[...path]\route.ts
C:\VENTA-DE-PASAJES\apps\mfe-ticketing\app\api\ticketing\[...path]\route.ts
C:\VENTA-DE-PASAJES\apps\mfe-reporting\app\api\reporting\[...path]\route.ts
C:\VENTA-DE-PASAJES\apps\mfe-admin\app\api\audit\[...path]\route.ts
C:\VENTA-DE-PASAJES\apps\mfe-admin\app\api\admin\health\route.ts
C:\VENTA-DE-PASAJES\services\identity-service\pom.xml
C:\VENTA-DE-PASAJES\services\dispatch-service\pom.xml
C:\VENTA-DE-PASAJES\services\ticketing-service\pom.xml
C:\VENTA-DE-PASAJES\services\document-service\pom.xml
C:\VENTA-DE-PASAJES\services\reporting-service\pom.xml
C:\VENTA-DE-PASAJES\services\audit-service\pom.xml
C:\VENTA-DE-PASAJES\services\quarkus-service-template\pom.xml
C:\VENTA-DE-PASAJES\README.md
C:\VENTA-DE-PASAJES\infra\README.md
C:\VENTA-DE-PASAJES\vitacora.md
```

## Reversa primero

Esta reversa deshace el cambio operativo del dia 65. Ejecutarla solo si se necesita volver al estado anterior.

### Paso 1 - Ubicarse en el proyecto

```powershell
$ProjectRoot = "C:\VENTA-DE-PASAJES"
Set-Location $ProjectRoot
```

### Paso 2 - Configurar gcloud para Windows

```powershell
$env:CLOUDSDK_PYTHON = "C:\Python312\python.exe"
$GcloudPath = "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd"
$ProjectId = "project-fbb34cd7-0b82-43e1-867"
$Region = "us-central1"
$CallerServiceAccount = "frontend-shell-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com"
```

### Paso 3 - Promover las imagenes MFE anteriores

Primero validar que existen:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\promote-artifact-image-tags.ps1 `
  -ServiceIds mfe-identity,mfe-dispatch,mfe-ticketing,mfe-reporting,mfe-admin `
  -SourceTag 0.1.0-frontend `
  -TargetTag dev
```

Si el plan muestra las cinco imagenes, ejecutar:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\promote-artifact-image-tags.ps1 `
  -ServiceIds mfe-identity,mfe-dispatch,mfe-ticketing,mfe-reporting,mfe-admin `
  -SourceTag 0.1.0-frontend `
  -TargetTag dev `
  -Execute
```

### Paso 4 - Redesplegar solo los MFEs

Validar imagenes:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\deploy-cloudrun-dev.ps1 `
  -ImageTag dev `
  -ServiceIds mfe-identity,mfe-dispatch,mfe-ticketing,mfe-reporting,mfe-admin `
  -ResolveExistingServiceUrls `
  -CheckImagesOnly
```

Ejecutar despliegue:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\deploy-cloudrun-dev.ps1 `
  -ImageTag dev `
  -ServiceIds mfe-identity,mfe-dispatch,mfe-ticketing,mfe-reporting,mfe-admin `
  -ResolveExistingServiceUrls `
  -Execute
```

### Paso 5 - Quitar invoker a la cuenta frontend

Ejecutar solo despues de regresar los MFEs anteriores:

```powershell
$Backends = @(
  "identity-service",
  "dispatch-service",
  "ticketing-service",
  "document-service",
  "reporting-service",
  "audit-service"
)

foreach ($ServiceId in $Backends) {
  & $GcloudPath run services remove-iam-policy-binding $ServiceId `
    --project $ProjectId `
    --region $Region `
    --member "serviceAccount:$CallerServiceAccount" `
    --role "roles/run.invoker" `
    --quiet
}
```

### Paso 6 - Reversa local del codigo

Si el dia 65 ya fue confirmado en Git:

```powershell
git log --oneline -- docs/dia-65-cloud-run-mfe-backend-auth.md
$CommitDia65 = "PEGAR_HASH_DEL_COMMIT_DIA_65"
git revert $CommitDia65
```

Si todavia no fue confirmado en Git, revisar primero:

```powershell
git status --short
git diff --stat
```

Luego revertir manualmente solo los archivos del dia 65.

## Guia manual desde cero

### Paso 1 - Ubicarse en el proyecto

```powershell
$ProjectRoot = "C:\VENTA-DE-PASAJES"
Set-Location $ProjectRoot
```

### Paso 2 - Configurar gcloud para Windows

```powershell
$env:CLOUDSDK_PYTHON = "C:\Python312\python.exe"
$GcloudPath = "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd"
$ProjectId = "project-fbb34cd7-0b82-43e1-867"
$Region = "us-central1"
```

Validar:

```powershell
& $GcloudPath config get-value project
& $GcloudPath run services list --project $ProjectId --region $Region
```

### Paso 3 - Confirmar que backends son privados y sanos con token

```powershell
$BackendHealth = @{
  "identity-service" = "/api/v1/identity/health"
  "dispatch-service" = "/api/v1/dispatch/health"
  "ticketing-service" = "/api/v1/ticketing/health"
  "document-service" = "/api/v1/document/health"
  "reporting-service" = "/api/v1/reporting/health"
  "audit-service" = "/api/v1/audit/health"
}

foreach ($ServiceId in $BackendHealth.Keys) {
  $Url = (& $GcloudPath run services describe $ServiceId --project $ProjectId --region $Region --format "value(status.url)").Trim()
  $Path = $BackendHealth[$ServiceId]
  $CodeWithoutToken = curl.exe --ssl-no-revoke -s -o NUL -w "%{http_code}" "$Url$Path"
  $Token = (& $GcloudPath auth print-identity-token).Trim()
  $CodeWithToken = curl.exe --ssl-no-revoke -s -o NUL -w "%{http_code}" -H "Authorization: Bearer $Token" "$Url$Path"
  [pscustomobject]@{
    service = $ServiceId
    unauthenticated = $CodeWithoutToken
    authenticated = $CodeWithToken
  }
}
```

Resultado esperado:

```text
unauthenticated = 403
authenticated = 200
```

### Paso 4 - Otorgar invoker a la cuenta frontend

Generar plan:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\grant-cloudrun-invoker.ps1
```

Revisar:

```powershell
Get-Content -LiteralPath .\logs\cloudrun-dev\grant-cloudrun-invoker.plan.json -Raw
```

Ejecutar:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\grant-cloudrun-invoker.ps1 -Execute
```

Resultado esperado en el plan:

```text
invoker_after = true
```

### Paso 5 - Validar que el helper existe en los MFEs

No crear estos archivos manualmente. Ya deben existir en el repositorio.

```powershell
Test-Path -LiteralPath .\apps\mfe-identity\app\api\_lib\cloudRunAuth.ts
Test-Path -LiteralPath .\apps\mfe-dispatch\app\api\_lib\cloudRunAuth.ts
Test-Path -LiteralPath .\apps\mfe-ticketing\app\api\_lib\cloudRunAuth.ts
Test-Path -LiteralPath .\apps\mfe-reporting\app\api\_lib\cloudRunAuth.ts
Test-Path -LiteralPath .\apps\mfe-admin\app\api\_lib\cloudRunAuth.ts
```

Resultado esperado:

```text
True
True
True
True
True
```

### Paso 6 - Validar typecheck y build frontend

```powershell
npm run typecheck -w @venta-pasajes/mfe-identity
npm run typecheck -w @venta-pasajes/mfe-dispatch
npm run typecheck -w @venta-pasajes/mfe-ticketing
npm run typecheck -w @venta-pasajes/mfe-reporting
npm run typecheck -w @venta-pasajes/mfe-admin
```

```powershell
npm run build -w @venta-pasajes/mfe-identity
npm run build -w @venta-pasajes/mfe-dispatch
npm run build -w @venta-pasajes/mfe-ticketing
npm run build -w @venta-pasajes/mfe-reporting
npm run build -w @venta-pasajes/mfe-admin
```

### Paso 7 - Construir y publicar imagenes MFE

Construir imagenes locales:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-frontend-images.ps1 `
  -Apps mfe-identity,mfe-dispatch,mfe-ticketing,mfe-reporting,mfe-admin `
  -ImageTag 0.1.2-frontend `
  -SkipSharedTypesBuild
```

Publicar imagenes ya construidas:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-frontend-images.ps1 `
  -Apps mfe-identity,mfe-dispatch,mfe-ticketing,mfe-reporting,mfe-admin `
  -ImageTag 0.1.2-frontend `
  -SkipNextBuild `
  -SkipDockerBuild `
  -Push
```

### Paso 8 - Promover tag a dev

Plan:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\promote-artifact-image-tags.ps1 `
  -ServiceIds mfe-identity,mfe-dispatch,mfe-ticketing,mfe-reporting,mfe-admin `
  -SourceTag 0.1.2-frontend `
  -TargetTag dev
```

Ejecucion real:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\promote-artifact-image-tags.ps1 `
  -ServiceIds mfe-identity,mfe-dispatch,mfe-ticketing,mfe-reporting,mfe-admin `
  -SourceTag 0.1.2-frontend `
  -TargetTag dev `
  -Execute
```

### Paso 9 - Desplegar MFEs en Cloud Run

Validar imagenes:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\deploy-cloudrun-dev.ps1 `
  -ImageTag dev `
  -ServiceIds mfe-identity,mfe-dispatch,mfe-ticketing,mfe-reporting,mfe-admin `
  -ResolveExistingServiceUrls `
  -CheckImagesOnly
```

Ejecutar despliegue:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\deploy-cloudrun-dev.ps1 `
  -ImageTag dev `
  -ServiceIds mfe-identity,mfe-dispatch,mfe-ticketing,mfe-reporting,mfe-admin `
  -ResolveExistingServiceUrls `
  -Execute
```

### Paso 10 - Validar proxies MFE contra backends privados

```powershell
$MfeHealth = @{
  "mfe-identity" = "/api/identity/health"
  "mfe-dispatch" = "/api/dispatch/health"
  "mfe-ticketing" = "/api/ticketing/health"
  "mfe-reporting" = "/api/reporting/health"
  "mfe-admin" = "/api/admin/health"
}

foreach ($ServiceId in $MfeHealth.Keys) {
  $Url = (& $GcloudPath run services describe $ServiceId --project $ProjectId --region $Region --format "value(status.url)").Trim()
  $Path = $MfeHealth[$ServiceId]
  $Code = curl.exe --ssl-no-revoke -s -o NUL -w "%{http_code}" "$Url$Path"
  [pscustomobject]@{
    service = $ServiceId
    path = $Path
    http_code = $Code
  }
}
```

Resultado esperado:

```text
http_code = 200
```

### Paso 11 - Validar desde el shell publico

```powershell
$ShellUrl = (& $GcloudPath run services describe frontend-shell --project $ProjectId --region $Region --format "value(status.url)").Trim()
curl.exe --ssl-no-revoke -s -o NUL -w "%{http_code}" "$ShellUrl/api/health"
curl.exe --ssl-no-revoke -s -o NUL -w "%{http_code}" "$ShellUrl"
```

Resultado esperado:

```text
200
200
```

Luego abrir:

```text
https://frontend-shell-io7kxgn6yq-uc.a.run.app
```

Validar visualmente:

```text
Identidad carga sin Forbidden.
Despachos carga sin Forbidden.
Boleteria carga sin Forbidden.
Reportes carga sin Forbidden.
Admin muestra frontends y backends operativos.
```

### Paso 12 - Diagnosticar HTTP 500 funcional si aparece

Si una pantalla ya no muestra `Forbidden`, pero una consulta devuelve `HTTP 500`, revisar logs del backend. Ejemplo para `dispatch-service`:

```powershell
& $GcloudPath logging read `
  "resource.type=cloud_run_revision AND resource.labels.service_name=dispatch-service AND severity>=ERROR" `
  --project $ProjectId `
  --limit 20 `
  --format "value(timestamp,textPayload)"
```

Si aparece `ClassNotFoundException: com.google.cloud.sql.postgres.SocketFactory`, el problema corresponde al backend nativo y no al proxy MFE.

### Paso 13 - Validar compilacion JVM backend con dependencia Cloud SQL

```powershell
$BackendDirs = @(
  "identity-service",
  "dispatch-service",
  "ticketing-service",
  "document-service",
  "reporting-service",
  "audit-service"
)

foreach ($ServiceId in $BackendDirs) {
  mvn -q -f ".\services\$ServiceId\pom.xml" -DskipTests package
  if ($LASTEXITCODE -ne 0) {
    throw "Fallo package JVM para $ServiceId"
  }
}
```

Resultado observado:

```text
Los seis packages JVM resolvieron correctamente con postgres-socket-factory 1.24.2.
```

### Paso 14 - No desplegar backend nativo hasta resolver GraalVM

Este comando fue probado y fallo:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-dispatch-service-native.ps1 `
  -ImageTag 0.1.1-cloudsql-test `
  -UseCleanWorkspace `
  -SkipDockerBuild
```

Resultado observado:

```text
maven-native-build failed with exit code 1.
GraalVM/Mandrel reporto objetos e hilos jnr en image heap al usar Cloud SQL Socket Factory.
```

No ejecutar publicacion ni despliegue de nuevos backends nativos hasta cerrar ese punto.

## Validaciones ejecutadas

```text
Backends privados: sin token 403, con identity token 200.
grant-cloudrun-invoker.ps1: plan generado y ejecucion real aplicada.
grant-cloudrun-invoker.plan.json: invoker_after=true en los seis backends.
typecheck de cinco MFEs afectados: OK.
build de cinco MFEs afectados: OK.
Imagenes 0.1.2-frontend publicadas para cinco MFEs.
Tags dev promovidos para cinco MFEs.
Despliegue Cloud Run dev de cinco MFEs completado.
Health proxy MFE: HTTP 200.
Admin: frontends 6/6, backends 6/6.
Validacion visual: ya no aparece Forbidden por backend privado.
Package JVM backends con postgres-socket-factory 1.24.2: OK.
Native build dispatch-service con Cloud SQL Socket Factory: falla en GraalVM/Mandrel, pendiente.
```

## Lectura ejecutiva

```text
El dia 65 resolvio la autenticacion service-to-service entre MFEs y backends privados.
Los backends siguen privados.
El navegador no recibe credenciales internas de Cloud Run.
El proxy MFE obtiene identity token desde metadata server solo dentro de Cloud Run.
Los errores Forbidden ya no corresponden al diseno de seguridad.
El siguiente bloqueo esta en las imagenes nativas backend con Cloud SQL Socket Factory.
```
