# Dia 74 - Ensayo de migracion final

Fecha: 2026-09-25

## Objetivo

Alinear el Dia 74 con `C:\VENTA-DE-PASAJES\tareas.md`: tomar una copia reciente de Access, generar una carga trazable hacia PostgreSQL por microservicio, medir el tiempo del ensayo, comparar conteos y dejar un procedimiento repetible antes del corte real.

Alcance del ensayo:

```text
Origen legacy: C:\VENTA-DE-PASAJES\legacy\sistema\Proyect\usuario.mdb
Tablas Access leidas: Buses, Clientes, Salidas, Terminales, Tipobus, Usuarios
Destinos PostgreSQL: identity_db, dispatch_db, ticketing_db
Validacion ejecutada: PostgreSQL temporal local desde cero con Docker
Staging Cloud SQL: procedimiento listo, ejecucion protegida para ventana controlada
```

## Resultado alcanzado

Se creo `C:\VENTA-DE-PASAJES\scripts\run-final-migration-rehearsal.ps1`.

El script:

- Copia `usuario.mdb` a `C:\VENTA-DE-PASAJES\backups\final-migration-rehearsal\<timestamp>\usuario.mdb`.
- Verifica hash SHA256 de origen y copia.
- Lee Access con `Microsoft.ACE.OLEDB.16.0`.
- Genera SQL separado para `identity_db`, `dispatch_db` y `ticketing_db`.
- Valida desde cero en PostgreSQL temporal aplicando las migraciones reales de los servicios.
- Compara conteos esperados contra conteos cargados.
- Calcula tiempo medido del ensayo y una estimacion inicial de corte.

Evidencia final:

```text
C:\VENTA-DE-PASAJES\logs\migration\dia74-final-rehearsal\final-migration-rehearsal.json
C:\VENTA-DE-PASAJES\logs\migration\dia74-final-rehearsal\identity_db-dia74.sql
C:\VENTA-DE-PASAJES\logs\migration\dia74-final-rehearsal\dispatch_db-dia74.sql
C:\VENTA-DE-PASAJES\logs\migration\dia74-final-rehearsal\ticketing_db-dia74.sql
C:\VENTA-DE-PASAJES\backups\final-migration-rehearsal\20260925-080816\usuario.mdb
```

Resumen observado:

```text
Access Buses: 1
Access Clientes: 3
Access Salidas: 1
Access Terminales: 1
Access Tipobus: 3
Access Usuarios: 1

identity users: 1
dispatch terminals: 2
dispatch bus_types: 3
dispatch buses: 1
dispatch routes: 1
dispatch departures: 1
ticketing passengers: 3
ticketing synced_departures: 1
ticketing departure_seats: 25
ticketing tickets: 3

Tiempo total medido: 7.191 segundos
Estimacion inicial de corte: 17.57 minutos
Bloqueos: ninguno
```

## Reversa primero

Esta reversa elimina solo evidencia local del ensayo Dia 74. No elimina Cloud SQL staging, buckets, Cloud Run ni datos productivos.

### Paso R1 - Ubicarse en el workspace

```powershell
cd C:\VENTA-DE-PASAJES
```

### Paso R2 - Detener contenedor temporal si quedo vivo

El script elimina el contenedor al finalizar. Ejecutar esto solo si una prueba se interrumpio.

```powershell
docker rm -f venta-pasajes-dia74-migration
```

### Paso R3 - Eliminar evidencia local generada

Advertencia: esto elimina copias locales de ensayo y reportes. No elimina el Access fuente en `legacy`.

```powershell
Remove-Item -LiteralPath .\logs\migration\dia74-final-rehearsal -Recurse -Force
Remove-Item -LiteralPath .\backups\final-migration-rehearsal -Recurse -Force
```

### Paso R4 - Eliminar el script del ensayo, solo si se quiere deshacer el dia

```powershell
Remove-Item -LiteralPath .\scripts\run-final-migration-rehearsal.ps1 -Force
Remove-Item -LiteralPath .\docs\dia-74-ensayo-migracion-final.md -Force
```

### Paso R5 - Reversa si se aplico manualmente en staging

Ejecutar solo si se importaron los SQL generados en una base staging de prueba y se necesita limpiar los datos legacy del ensayo.

```powershell
$CleanupIdentity = @"
BEGIN;
DELETE FROM user_roles WHERE user_id IN (SELECT id FROM users WHERE legacy_id IS NOT NULL);
DELETE FROM internal_profiles WHERE user_id IN (SELECT id FROM users WHERE legacy_id IS NOT NULL);
DELETE FROM local_credentials WHERE user_id IN (SELECT id FROM users WHERE legacy_id IS NOT NULL);
DELETE FROM users WHERE legacy_id IS NOT NULL;
COMMIT;
"@

$CleanupDispatch = @"
BEGIN;
DELETE FROM departures WHERE legacy_id IS NOT NULL;
DELETE FROM buses WHERE legacy_id IS NOT NULL;
DELETE FROM routes WHERE name = 'Arequipa - Juliaca';
DELETE FROM seat_layout_seats WHERE seat_layout_id IN (SELECT id FROM seat_layouts WHERE name LIKE 'Legacy Access %');
DELETE FROM seat_layouts WHERE name LIKE 'Legacy Access %';
DELETE FROM bus_types WHERE legacy_id IS NOT NULL;
DELETE FROM terminals WHERE legacy_id IS NOT NULL OR name = 'Juliaca';
COMMIT;
"@

$CleanupTicketing = @"
BEGIN;
DELETE FROM ticket_document_refs WHERE ticket_id IN (SELECT id FROM tickets WHERE legacy_id IS NOT NULL);
DELETE FROM tickets WHERE legacy_id IS NOT NULL;
DELETE FROM reservations WHERE passenger_id IN (SELECT id FROM passengers WHERE legacy_id IS NOT NULL);
DELETE FROM departure_seats WHERE dispatch_departure_id IN (SELECT dispatch_departure_id FROM synced_departures WHERE legacy_id IS NOT NULL);
DELETE FROM synced_departures WHERE legacy_id IS NOT NULL;
DELETE FROM passengers WHERE legacy_id IS NOT NULL;
COMMIT;
"@
```

Aplicar esos bloques con el metodo de conexion que se use para staging.

## Cambios realizados

```text
scripts/run-final-migration-rehearsal.ps1
docs/dia-74-ensayo-migracion-final.md
logs/migration/dia74-final-rehearsal/final-migration-rehearsal.json
logs/migration/dia74-final-rehearsal/identity_db-dia74.sql
logs/migration/dia74-final-rehearsal/dispatch_db-dia74.sql
logs/migration/dia74-final-rehearsal/ticketing_db-dia74.sql
backups/final-migration-rehearsal/20260925-080816/usuario.mdb
```

## Mapeo aplicado

```text
Usuarios -> identity_db.users, local_credentials, internal_profiles, user_roles
Terminales -> dispatch_db.terminals
Tipobus -> dispatch_db.bus_types
Buses -> dispatch_db.buses y seat_layouts dinamicos por cantidad de asientos
Salidas -> dispatch_db.routes y dispatch_db.departures
Clientes -> ticketing_db.passengers, departure_seats y tickets
Salidas + Buses -> ticketing_db.synced_departures
```

Notas importantes:

- El destino `Juliaca` no existe como terminal en la tabla Access `Terminales`; el ensayo lo crea como terminal derivada para completar la ruta `Arequipa - Juliaca`.
- Las contrasenas legacy no se migran como hash valido. El usuario queda con `password_hash = NULL`, `temporary_password = true` y `must_change_password = true`; antes de operacion real debe pasar por recuperacion o asignacion segura de clave.
- Los identificadores UUID se generan de forma deterministica a partir de `legacy_id`, lo que permite repetir el ensayo sin cambiar referencias entre bases.

## Guia manual desde cero

### Paso 1 - Preparar terminal

```powershell
cd C:\VENTA-DE-PASAJES
```

### Paso 2 - Confirmar prerequisitos

```powershell
Test-Path -LiteralPath .\legacy\sistema\Proyect\usuario.mdb
Test-Path -LiteralPath .\scripts\run-final-migration-rehearsal.ps1
docker version
```

Resultado esperado:

```text
True
True
Docker debe responder cliente y servidor.
```

Si Access no abre, instalar Microsoft Access Database Engine ACE OLEDB 16 o 12.

### Paso 3 - Ejecutar ensayo completo validado localmente

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\run-final-migration-rehearsal.ps1 `
  -ValidateLocal `
  -FailOnBlocked
```

Resultado esperado:

```text
Ensayo de migracion Dia 74 generado.
Tiempo total medido: aproximadamente 7 segundos
Corte estimado inicial: aproximadamente 17.57 minutos
identity_users: 1
dispatch_terminals: 2
ticketing_tickets: 3
```

### Paso 4 - Revisar evidencia JSON

```powershell
$Result = Get-Content -LiteralPath .\logs\migration\dia74-final-rehearsal\final-migration-rehearsal.json -Raw | ConvertFrom-Json
$Result.ready_for_staging_execution
$Result.counts.access_tables
$Result.local_validation.target_counts
$Result.estimated_cutover
```

Resultado esperado:

```text
ready_for_staging_execution: True
blockers: vacio
```

### Paso 5 - Revisar SQL generado antes de tocar staging

```powershell
Get-Content -LiteralPath .\logs\migration\dia74-final-rehearsal\identity_db-dia74.sql -TotalCount 20
Get-Content -LiteralPath .\logs\migration\dia74-final-rehearsal\dispatch_db-dia74.sql -TotalCount 40
Get-Content -LiteralPath .\logs\migration\dia74-final-rehearsal\ticketing_db-dia74.sql -TotalCount 40
```

### Paso 6 - Preparar staging desde cero

Ejecutar este bloque solo dentro de una ventana controlada. Si las bases staging ya contienen datos utiles, no aplicar esquema desde cero; hacer primero backup y definir si se limpia o si se carga idempotente sobre tablas existentes.

Variables:

```powershell
$env:CLOUDSDK_PYTHON = "C:\Python312\python.exe"
$ProjectId = "project-fbb34cd7-0b82-43e1-867"
$Region = "us-central1"
$Instance = "venta-pasajes-staging-sql"
$Gcloud = "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd"
```

Validar que staging existe:

```powershell
& $Gcloud sql instances describe $Instance `
  --project $ProjectId `
  --format "value(state)"

& $Gcloud sql databases list `
  --instance $Instance `
  --project $ProjectId `
  --format "table(name)"
```

### Paso 7 - Importar esquemas si la base staging esta vacia

Este paso usa Cloud SQL Import. No requiere exponer IP publica ni guardar password de `postgres` en el repo.

```powershell
$ProjectNumber = (& $Gcloud projects describe $ProjectId --format "value(projectNumber)").Trim()
$InstanceJson = & $Gcloud sql instances describe $Instance --project $ProjectId --format json | ConvertFrom-Json
$CloudSqlServiceAccount = $InstanceJson.serviceAccountEmailAddress
$ImportBucket = "venta-pasajes-staging-sql-imports-$ProjectNumber"

& $Gcloud storage buckets create "gs://$ImportBucket" `
  --project $ProjectId `
  --location $Region `
  --uniform-bucket-level-access

& $Gcloud storage buckets add-iam-policy-binding "gs://$ImportBucket" `
  --member "serviceAccount:$CloudSqlServiceAccount" `
  --role "roles/storage.objectViewer" `
  --quiet
```

Subir e importar esquemas:

```powershell
& $Gcloud storage cp .\services\identity-service\src\main\resources\db\migration\V1__identity_schema.sql "gs://$ImportBucket/dia74/schema/identity/V1__identity_schema.sql"
& $Gcloud sql import sql $Instance "gs://$ImportBucket/dia74/schema/identity/V1__identity_schema.sql" --project $ProjectId --database identity_db --quiet

& $Gcloud storage cp .\services\dispatch-service\src\main\resources\db\migration\V1__dispatch_schema.sql "gs://$ImportBucket/dia74/schema/dispatch/V1__dispatch_schema.sql"
& $Gcloud storage cp .\services\dispatch-service\src\main\resources\db\migration\V2__dispatch_seed_legacy_25_seat_layout.sql "gs://$ImportBucket/dia74/schema/dispatch/V2__dispatch_seed_legacy_25_seat_layout.sql"
& $Gcloud sql import sql $Instance "gs://$ImportBucket/dia74/schema/dispatch/V1__dispatch_schema.sql" --project $ProjectId --database dispatch_db --quiet
& $Gcloud sql import sql $Instance "gs://$ImportBucket/dia74/schema/dispatch/V2__dispatch_seed_legacy_25_seat_layout.sql" --project $ProjectId --database dispatch_db --quiet

Get-ChildItem -LiteralPath .\services\ticketing-service\src\main\resources\db\migration -Filter "V*.sql" |
  Sort-Object Name |
  ForEach-Object {
    $Object = "gs://$ImportBucket/dia74/schema/ticketing/$($_.Name)"
    & $Gcloud storage cp $_.FullName $Object
    & $Gcloud sql import sql $Instance $Object --project $ProjectId --database ticketing_db --quiet
  }
```

### Paso 8 - Importar datos del ensayo en staging

```powershell
& $Gcloud storage cp .\logs\migration\dia74-final-rehearsal\identity_db-dia74.sql "gs://$ImportBucket/dia74/data/identity_db-dia74.sql"
& $Gcloud storage cp .\logs\migration\dia74-final-rehearsal\dispatch_db-dia74.sql "gs://$ImportBucket/dia74/data/dispatch_db-dia74.sql"
& $Gcloud storage cp .\logs\migration\dia74-final-rehearsal\ticketing_db-dia74.sql "gs://$ImportBucket/dia74/data/ticketing_db-dia74.sql"

& $Gcloud sql import sql $Instance "gs://$ImportBucket/dia74/data/identity_db-dia74.sql" --project $ProjectId --database identity_db --quiet
& $Gcloud sql import sql $Instance "gs://$ImportBucket/dia74/data/dispatch_db-dia74.sql" --project $ProjectId --database dispatch_db --quiet
& $Gcloud sql import sql $Instance "gs://$ImportBucket/dia74/data/ticketing_db-dia74.sql" --project $ProjectId --database ticketing_db --quiet
```

### Paso 9 - Validacion funcional con usuario

El usuario funcional debe revisar estos datos migrados:

```text
Usuario legacy: henry / Dennis Henry PUMA PANDIA
Terminal origen: Arequipa
Terminal destino derivado: Juliaca
Bus: 0001 / RTY-457 / Semi cama / 25 asientos
Salida: Arequipa - Juliaca / 2013-01-30 16:00
Tickets legacy: LEGACY-000001, LEGACY-000002, LEGACY-000003
Asientos vendidos: 1, 7, 11
```

La contrasena legacy no debe usarse directamente en produccion. El usuario debe activar o recuperar clave por el flujo seguro del sistema.

## Pruebas y validaciones ejecutadas

Comando ejecutado:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\run-final-migration-rehearsal.ps1 `
  -ValidateLocal `
  -FailOnBlocked
```

Resultado observado:

```text
identity_users: 1
identity_profiles: 1
dispatch_terminals: 2
dispatch_bus_types: 3
dispatch_buses: 1
dispatch_routes: 1
dispatch_departures: 1
ticketing_passengers: 3
ticketing_synced_departures: 1
ticketing_departure_seats: 25
ticketing_tickets: 3
ready_for_staging_execution: True
```

## Peticiones HTTP/HTTPS

No aplica en este dia. La tarea es batch/offline sobre Access y PostgreSQL.

## Problemas encontrados y soluciones

### No existia ETL Access a PostgreSQL

El workspace `migration/access-to-postgres` solo tenia `.env.example`. Se creo `run-final-migration-rehearsal.ps1` para convertir el ensayo en procedimiento repetible.

### PowerShell no acepta `$Variable:` dentro de strings

El primer borrador fallo con referencias como `$LayoutId:$Seat`. Se corrigio usando `${LayoutId}:$Seat`.

### Nullable int en helper de terminales

El helper inicial usaba `[Nullable[int]]` y no resolvia correctamente el `legacy_id` de terminal. Se cambio a conversion interna segura con `[object]`.

### Ruido de Docker dentro del JSON

La primera validacion mezclo salidas de Docker con conteos. Se corrigio `Invoke-Docker` para descartar salida operativa y dejar el JSON limpio.

## Estado final

```text
Ensayo de migracion final ejecutado localmente desde cero.
Copia reciente de Access tomada y verificada por hash.
SQL por microservicio generado.
Conteos comparados correctamente.
Tiempo de ensayo medido.
Tiempo inicial de corte estimado en 17.57 minutos usando RTO Dia 68.
Procedimiento de aplicacion en staging documentado y protegido para ventana controlada.
```

Siguiente paso natural: Dia 75 - Plan de corte y rollback.
