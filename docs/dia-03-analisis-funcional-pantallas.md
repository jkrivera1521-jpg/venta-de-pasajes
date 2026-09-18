# Dia 3 - Analisis funcional de pantallas

Fecha: 2026-09-01
Fuente analizada: formularios VB6 en `C:\VENTA-DE-PASAJES\legacy\sistema\WindowsForm`

## Objetivo

Documentar el comportamiento funcional actual de cada pantalla VB6 y definir su equivalente en la plataforma objetivo con microfrontends y microservicios.

## Mapa de pantallas legacy a plataforma objetivo

| Pantalla VB6 | Funcion actual | Microfrontend destino | Servicios principales |
| --- | --- | --- | --- |
| `LoginForm` | Ingreso por usuario y contrasena local. | `frontend-shell` + `mfe-identity` | `identity-service` |
| `MDIFormPrincipal` | Menu principal y apertura de modulos. | `frontend-shell` | `identity-service` para permisos |
| `CrearUsuariosForm` | Alta de usuarios locales. | `mfe-identity` | `identity-service`, `audit-service` |
| `ModificarUsuarioForm` | Modificacion de usuarios locales. | `mfe-identity` | `identity-service`, `audit-service` |
| `MantenimientoBusesForm` | CRUD de buses. | `mfe-dispatch` | `dispatch-service`, `audit-service` |
| `GestordeTerminalesForm` | CRUD de terminales. | `mfe-dispatch` | `dispatch-service`, `audit-service` |
| `GestordeBoletosForm` | CRUD de salidas y entrada hacia venta. | `mfe-dispatch` + `mfe-ticketing` | `dispatch-service`, `ticketing-service` |
| `AsientosForm` | Seleccion de asiento, venta y comprobante. | `mfe-ticketing` | `ticketing-service`, `document-service`, `audit-service` |
| `ClientesForm` | Consulta e impresion de pasajeros/clientes. | `mfe-reporting` | `reporting-service`, `ticketing-service` |
| `DrClientes` | Reporte de clientes. | `mfe-reporting` | `reporting-service`, `document-service` |
| `DrFacturacion` | Comprobante de boleto. | `mfe-ticketing` | `document-service`, `ticketing-service` |

## Flujo de login

### Comportamiento actual

- El usuario ingresa `Usuario` y `Contrasena`.
- `LoginForm` busca el valor en `Usuarios.Login`.
- La contrasena se compara contra `Usuarios.Password`.
- Si coincide, se abre `MDIFormPrincipal`.
- No se detectan roles, permisos, bloqueo por intentos ni auditoria de acceso.

### Equivalente objetivo

- El `frontend-shell` mostrara dos opciones: Sign in with Google y login local.
- `identity-service` validara tokens Google OIDC.
- `identity-service` validara usuario local con hash seguro de contrasena.
- Se registraran eventos/auditoria para accesos exitosos, fallidos, bloqueos y cambios de credenciales.
- El menu se construira segun roles y permisos internos.

## Flujo de usuarios, perfiles, roles y permisos

### Comportamiento actual

- `CrearUsuariosForm` permite crear usuarios con login, password, nombres, apellidos, direccion, telefono y fecha.
- `ModificarUsuarioForm` permite editar los mismos datos.
- `MDIFormPrincipal` permite buscar y eliminar usuarios desde el menu.
- No se detectan perfiles, roles ni permisos funcionales.
- Password se guarda y se muestra como texto editable.

### Equivalente objetivo

- `mfe-identity` debe administrar usuarios locales, usuarios Google vinculados, estados, roles y permisos.
- `identity-service` debe separar credenciales, perfil operativo y asignaciones de rol.
- Las contrasenas historicas no deben migrarse como credenciales validas.
- La migracion debe crear usuarios en estado que obligue activacion/cambio de contrasena.

## Flujo de buses

### Comportamiento actual

- `MantenimientoBusesForm` crea, modifica, busca y elimina buses.
- Campos usados: asientos, destino, descripcion, ID de bus, matricula, tipo, fecha y terminal.
- El tipo se resuelve contra `Tipobus`.
- La terminal se resuelve contra `Terminales`.

### Equivalente objetivo

- `mfe-dispatch` debe ofrecer mantenimiento de buses.
- `dispatch-service` debe exponer APIs para buses, tipos de bus, terminales y layouts de asiento.
- El numero de asientos debe dejar de ser solo un campo y convertirse en layout verificable.

## Flujo de terminales

### Comportamiento actual

- `GestordeTerminalesForm` crea, modifica, busca y elimina terminales.
- Campos usados: nombre, administrador, direccion, telefono, email, ID local y fecha.

### Equivalente objetivo

- `mfe-dispatch` debe administrar terminales.
- `dispatch-service` debe validar unicidad funcional de terminal/ID local segun decision del negocio.
- Cambios criticos deben producir auditoria.

## Flujo de salidas

### Comportamiento actual

- `GestordeBoletosForm` crea, modifica, busca y elimina salidas.
- Campos usados: bus, terminal/origen, destino, hora de salida, fecha de salida y tipo.
- La seleccion de bus autocompleta destino, terminal/origen y tipo.
- Desde esta pantalla se abre `AsientosForm`.

### Equivalente objetivo

- `mfe-dispatch` debe programar salidas.
- `dispatch-service` debe ser propietario de salidas, buses, rutas y terminales.
- `ticketing-service` debe recibir o consultar salidas publicadas para disponibilidad de venta.
- Cambios de salida deben generar eventos como `DepartureScheduled` o `DepartureCancelled`.

## Flujo de venta de boletos

### Comportamiento actual

- `AsientosForm` carga salidas y clientes.
- La persona selecciona un bus/salida y luego un asiento.
- Al grabar, se inserta un registro en `Clientes`.
- El registro de `Clientes` mezcla datos de pasajero, venta, bus, salida, precio y asiento.
- Luego se llena `DrFacturacion` como comprobante.

### Equivalente objetivo

- `mfe-ticketing` debe separar busqueda de salidas, mapa de asientos, datos de pasajero, cobro/confirmacion y comprobante.
- `ticketing-service` debe crear reservas/ventas con transaccion y restriccion unica por salida/asiento activo.
- `document-service` debe generar PDF o comprobante imprimible.
- `audit-service` debe registrar venta, anulacion y reimpresion.

## Flujo de asientos

### Comportamiento actual

- El mapa esta fijo a 25 asientos.
- Asientos impares suelen ser `Ventana` y pares `Pasadizo`; el asiento 25 esta como `Pasadizo`.
- Seleccionar un asiento oculta el boton libre.
- Liberar un asiento vuelve visible el boton libre.
- `Vaciar BUS` vuelve visibles todos los asientos.
- No se detecta persistencia independiente de disponibilidad por salida/asiento.

### Equivalente objetivo

- `dispatch-service` debe administrar layouts de asiento por tipo de bus o bus.
- `ticketing-service` debe administrar disponibilidad por salida.
- El estado visual del asiento debe derivarse de datos persistentes, no al reves.
- Se requiere control de concurrencia para evitar doble venta.

## Reglas actuales detectadas

- Login y password son obligatorios en acceso local.
- Usuario requiere login, clave, nombres, apellidos, direccion y telefono.
- Bus requiere asientos, destino, descripcion, ID, matricula y tipo.
- Terminal requiere nombre, administrador, direccion, telefono, email e ID local.
- Salida requiere bus, origen y destino.
- Venta requiere nombre, apellido, DNI, precio, bus, tipo, origen, destino, hora/fecha de salida, hora/fecha de registro, asiento y ubicacion.
- Busquedas legacy se hacen por login, matricula, nombre de terminal, ID de bus, nombre/DNI/apellido de cliente.

## Criterio de avance

Cumplido:

- Flujo de login documentado.
- Flujo de usuarios documentado.
- Flujo de buses documentado.
- Flujo de terminales documentado.
- Flujo de salidas documentado.
- Flujo de venta de boletos documentado.
- Flujo de asientos documentado.
- Equivalencias entre pantallas legacy, MFEs y servicios documentadas.

## Reversa primero

> Estandarizacion documental agregada el 2026-09-16 para que este dia tambien tenga una ruta segura de limpieza antes de repetir la practica.

Este dia pertenece a la etapa inicial del proyecto. Antes de ejecutar una reversa, revisar si el archivo contiene recursos externos reales, como Google Cloud, Docker, bases de datos o imagenes publicadas. No ejecutar comandos destructivos si no estas seguro de que el recurso no esta siendo usado.

### Paso R1 - Ubicarse en el workspace

```powershell
cd C:\VENTA-DE-PASAJES
```

### Paso R2 - Revisar recursos o archivos mencionados

```powershell
Select-String -Path .\docs\dia-03-analisis-funcional-pantallas.md -Pattern "C:\\VENTA-DE-PASAJES|docker|gcloud|mvn|npm|Remove-Item|delete|rm|Cloud SQL|Artifact Registry|Secret Manager" -Context 0,2
```

### Paso R3 - Detener procesos locales si este dia levanto herramientas

```powershell
Get-NetTCPConnection -LocalPort 3000,3001,3002,3003,8081,8082,8083,18083,18089,18096 -ErrorAction SilentlyContinue |
  Select-Object LocalAddress,LocalPort,State,OwningProcess |
  Format-Table -AutoSize

Get-CimInstance Win32_Process -Filter "name = 'java.exe' or name = 'node.exe'" |
  Select-Object ProcessId,CommandLine |
  Format-List
```

Si identificas un proceso propio de la practica, detenerlo:

```powershell
Stop-Process -Id <process-id> -Force
```

### Paso R4 - Revisar contenedores temporales

```powershell
docker ps -a --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}" |
  Select-String -Pattern "venta-pasajes|identity|dispatch|ticketing|native|postgres"
```

Si el contenedor fue creado solo para repetir este dia y no se usa en otra practica:

```powershell
docker rm -f <container-name>
```

### Paso R5 - Reversa de archivos locales

La reversa de archivos debe hacerse con control de cambios o backup. Este workspace inicio sin Git en los primeros dias, por eso no se recomienda borrar archivos a ciegas.

```powershell
Select-String -Path .\docs\dia-03-analisis-funcional-pantallas.md -Pattern "Archivo|Archivos|C:\\VENTA-DE-PASAJES" -Context 0,4
```

Si aun asi necesitas retirar solo este documento de la practica, hacer primero una copia:

```powershell
New-Item -ItemType Directory -Force -Path .\backups | Out-Null
Copy-Item -LiteralPath .\docs\dia-03-analisis-funcional-pantallas.md -Destination .\backups\dia-03-analisis-funcional-pantallas-manual-backup.md -Force
```

Despues de respaldar, se podria eliminar manualmente el documento con:

```powershell
Remove-Item -LiteralPath .\docs\dia-03-analisis-funcional-pantallas.md -Force
```

## Guia manual desde cero

> Estandarizacion documental agregada el 2026-09-16. Esta guia permite repetir el dia sin depender de Codex, usando el documento como fuente de verdad.

### Paso 1 - Ubicarse en el proyecto

```powershell
cd C:\VENTA-DE-PASAJES
```

### Paso 2 - Leer el alcance del dia en el backlog

```powershell
Select-String -Path .\tareas.md -Pattern "Dia 3|Dia 03" -Context 0,40
```

### Paso 3 - Leer la documentacion del dia

```powershell
Get-Content -LiteralPath .\docs\dia-03-analisis-funcional-pantallas.md
```

### Paso 4 - Verificar archivos y rutas mencionadas

```powershell
Select-String -Path .\docs\dia-03-analisis-funcional-pantallas.md -Pattern "C:\\VENTA-DE-PASAJES" -AllMatches
```

Para cada ruta importante que aparezca en el documento:

```powershell
Test-Path -LiteralPath "<ruta-copiada-del-documento>"
```

### Paso 5 - Ejecutar comandos documentados

Buscar bloques de comandos del documento y ejecutarlos en orden, validando el resultado de cada bloque antes de continuar:

```powershell
Select-String -Path .\docs\dia-03-analisis-funcional-pantallas.md -Pattern "```powershell|```text|mvn |npm |docker |gcloud |curl.exe|powershell " -Context 0,6
```

### Paso 6 - Registrar la repeticion en bitacora

```powershell
Add-Content -LiteralPath .\vitacora.md -Value "`nReplica manual Dia 3 - <fecha>: comandos ejecutados y resultado."
```

### Paso 7 - Validar criterio de avance

Revisar la seccion de criterio de avance, resultado, estado final o pendientes del documento:

```powershell
Select-String -Path .\docs\dia-03-analisis-funcional-pantallas.md -Pattern "Criterio de avance|Resultado|Estado final|Pendiente|Pendientes" -Context 0,8
```
