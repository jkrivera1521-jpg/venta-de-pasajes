# Dia 2 - Inventario tecnico del sistema actual

Fecha: 2026-09-01
Sistema legado: `C:\VENTA-DE-PASAJES\legacy\sistema`

## Proyecto VB6

Archivo principal:

`C:\VENTA-DE-PASAJES\legacy\sistema\Proyect\Dennis(Sistema de venta de pasajes).vbp`

Configuracion detectada:

- Tipo de proyecto: `Exe`
- Startup: `Sub Main`
- Formulario de icono: `LoginForm`
- Nombre de proyecto: `Proyecto1`
- Compania/version: `UANCV`
- Modelo de datos: Access `usuario.mdb` via Jet OLEDB 4.0

## Dependencias y controles obsoletos

Referencias:

- `stdole2.tlb` - OLE Automation.
- `msado21.tlb` - Microsoft ActiveX Data Objects 2.1.
- `dao350.dll` - Microsoft DAO 3.51 Object Library.
- `MSSTDFMT.DLL` - Microsoft Data Formatting Object Library.
- `MSDBRPTR.DLL` - Microsoft Data Report Designer v6.0.

Controles ActiveX/OCX:

- `MSADODC.OCX`
- `MSCOMCT2.OCX`
- `MSCOMCTL.OCX`
- `MSDATGRD.OCX`
- `MSDATLST.OCX`
- `AcroPDF.dll`
- `Vtext.dll`
- `ImageThumbnailCP.ocx`

Estas dependencias no deben migrarse como componentes runtime. Deben reinterpretarse como funcionalidad web moderna, APIs y reportes/PDF generados desde servicios.

## Inventario por extension

| Extension | Cantidad |
| --- | ---: |
| `.png` | 147 |
| `.jpg` | 31 |
| `.gif` | 10 |
| `.frm` | 9 |
| `.frx` | 9 |
| `.pdf` | 4 |
| `.psd` | 4 |
| `.ico` | 3 |
| `.FPT` | 2 |
| `.Dsr` | 2 |
| `.DCA` | 2 |
| `.bas` | 2 |
| `.DBF` | 2 |
| `.dsx` | 2 |
| `.tmp` | 1 |
| `.vbp` | 1 |
| `.vbw` | 1 |
| `.mdb` | 1 |

## Formularios inventariados

| Archivo | Clase | Pantalla | Lineas |
| --- | --- | --- | ---: |
| `AsientosForm.frm` | `AsientosForm` | Gestor de Asientos | 2959 |
| `ClientesForm.frm` | `ClientesForm` | Consulta de Clientes | 964 |
| `CrearUsuariosForm.frm` | `CrearUsuariosForm` | Crear Nuevas Cuentas de Usuarios | 439 |
| `GestordeBoletosForm.frm` | `GestordeBoletosForm` | Gestor de buses y Boletos | 753 |
| `GestordeTerminalesForm.frm` | `GestordeTerminalesForm` | Gestor de Terminales | 694 |
| `LoginForm.frm` | `LoginForm` | BIENVENIDO AL SISTEMA | 160 |
| `MantenimientoBusesForm.frm` | `MantenimientoBusesForm` | Mantenimiento de Buses | 807 |
| `MDIFormPrincipal.frm` | `MDIFormPrincipal` | Sistema | 324 |
| `ModificarUsuarioForm.frm` | `ModificarUsuarioForm` | Modificar Usuario | 481 |

## Reportes inventariados

| Archivo | Clase | Pantalla | Uso detectado |
| --- | --- | --- | --- |
| `DrClientes.Dsr` | `DrClientes` | Reportes de Clientes | Reporte/listado de clientes o pasajeros. |
| `DrFacturacion.Dsr` | `DrFacturacion` | Detalles del Cliente | Comprobante de venta de boleto. |

## Modulos inventariados

| Archivo | Responsabilidad |
| --- | --- |
| `ModuleDeclare.bas` | Variables globales de conexion, recordsets por tabla y variables globales de facturacion. |
| `ModuleSentences.bas` | Inicio del sistema, apertura de `usuario.mdb` y carga de recordsets para `Usuarios`, `Buses`, `Tipobus`, `Terminales`, `Salidas` y `Clientes`. |

## Tablas usadas por codigo VB6

El codigo abre recordsets globales para:

- `Usuarios`
- `Buses`
- `Tipobus`
- `Terminales`
- `Salidas`
- `Clientes`

La conexion principal se abre con:

`Provider=Microsoft.Jet.OLEDB.4.0;Data Source=<App.Path>\usuario.mdb;Persist Security Info=False`

## Flujo funcional detectado desde codigo

Login:

- `LoginForm` busca `Usuarios.Login`.
- Compara `Usuarios.Password` con el texto ingresado.
- Si coincide, abre `MDIFormPrincipal`.
- Riesgo: la contrasena historica esta almacenada y comparada en texto plano.

Menu principal:

- `MDIFormPrincipal` abre pantallas de usuarios, buses, terminales, gestor de boletos, venta de pasaje y consultas.
- Tambien permite buscar y eliminar usuarios directamente desde menus.

Usuarios:

- `CrearUsuariosForm` agrega registros en `Usuarios`.
- `ModificarUsuarioForm` actualiza datos en `Usuarios`.
- No se detectan roles ni permisos en el codigo legado.

Buses:

- `MantenimientoBusesForm` crea, modifica, busca y elimina registros en `Buses`.
- Relaciona bus con `Tipobus` y `Terminales` mediante busquedas en recordsets.

Terminales:

- `GestordeTerminalesForm` crea, modifica, busca y elimina registros en `Terminales`.
- Campos visibles: nombre, administrador, direccion, telefono, email, ID local y fecha.

Salidas:

- `GestordeBoletosForm` crea, modifica, busca y elimina registros en `Salidas`.
- Toma bus, terminal/origen, destino, hora de salida, fecha de salida y tipo.
- Desde esta pantalla se abre `AsientosForm` para vender.

Venta/asientos:

- `AsientosForm` maneja un mapa fijo de 25 asientos.
- Cada asiento asigna numero y ubicacion `Ventana` o `Pasadizo`.
- La ocupacion se representa ocultando el boton visual del asiento libre.
- `Vaciar BUS` vuelve visibles todos los botones de asientos.
- Al grabar, se crea o actualiza un registro en `Clientes` con datos de pasajero, bus, tipo, origen, destino, fecha/hora de salida, fecha/hora de registro, numero de asiento y ubicacion.
- Luego se carga `DrFacturacion` con variables globales para mostrar el comprobante.
- Riesgo critico: no hay bloqueo transaccional persistente contra doble venta del mismo asiento.

Consultas:

- `ClientesForm` consulta `Clientes` por nombre, DNI o apellido.
- Puede imprimir el reporte `DrClientes`.

## Riesgos tecnicos identificados

- Dependencia de VB6, Jet OLEDB 4.0, ADO/DAO y OCX no aptos para Cloud Run.
- Uso de recordsets globales mutables.
- Autenticacion con contrasenas en texto plano.
- Operaciones CRUD directas desde formularios, sin capa de dominio.
- Busquedas mediante concatenacion de texto, con riesgo de inyeccion o errores por caracteres especiales.
- Asientos modelados como estado visual temporal, no como disponibilidad transaccional persistente.
- Boleto mezclado con la tabla `Clientes`; sera necesario separar pasajero, boleto, salida y asiento en PostgreSQL.
- Reportes DataReport acoplados al cliente VB6; deben recrearse como PDF/HTML/CSV.

## Criterio de avance

Cumplido:

- Proyecto `.vbp` revisado.
- Formularios `.frm` inventariados.
- Reportes VB6 inventariados.
- Dependencias `.ocx`, DLL y referencias identificadas.
- Imagenes y recursos reutilizables identificados a nivel de conteo y ubicacion.

Pendiente recomendado:

- Dia 3: documentar cada flujo funcional con equivalencia objetivo.
- Dia 4: extraer estructura real y conteos de `usuario.mdb`.

## Reversa primero

> Estandarizacion documental agregada el 2026-09-16 para que este dia tambien tenga una ruta segura de limpieza antes de repetir la practica.

Este dia pertenece a la etapa inicial del proyecto. Antes de ejecutar una reversa, revisar si el archivo contiene recursos externos reales, como Google Cloud, Docker, bases de datos o imagenes publicadas. No ejecutar comandos destructivos si no estas seguro de que el recurso no esta siendo usado.

### Paso R1 - Ubicarse en el workspace

```powershell
cd C:\VENTA-DE-PASAJES
```

### Paso R2 - Revisar recursos o archivos mencionados

```powershell
Select-String -Path .\docs\dia-02-inventario-tecnico.md -Pattern "C:\\VENTA-DE-PASAJES|docker|gcloud|mvn|npm|Remove-Item|delete|rm|Cloud SQL|Artifact Registry|Secret Manager" -Context 0,2
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
Select-String -Path .\docs\dia-02-inventario-tecnico.md -Pattern "Archivo|Archivos|C:\\VENTA-DE-PASAJES" -Context 0,4
```

Si aun asi necesitas retirar solo este documento de la practica, hacer primero una copia:

```powershell
New-Item -ItemType Directory -Force -Path .\backups | Out-Null
Copy-Item -LiteralPath .\docs\dia-02-inventario-tecnico.md -Destination .\backups\dia-02-inventario-tecnico-manual-backup.md -Force
```

Despues de respaldar, se podria eliminar manualmente el documento con:

```powershell
Remove-Item -LiteralPath .\docs\dia-02-inventario-tecnico.md -Force
```

## Guia manual desde cero

> Estandarizacion documental agregada el 2026-09-16. Esta guia permite repetir el dia sin depender de Codex, usando el documento como fuente de verdad.

### Paso 1 - Ubicarse en el proyecto

```powershell
cd C:\VENTA-DE-PASAJES
```

### Paso 2 - Leer el alcance del dia en el backlog

```powershell
Select-String -Path .\tareas.md -Pattern "Dia 2|Dia 02" -Context 0,40
```

### Paso 3 - Leer la documentacion del dia

```powershell
Get-Content -LiteralPath .\docs\dia-02-inventario-tecnico.md
```

### Paso 4 - Verificar archivos y rutas mencionadas

```powershell
Select-String -Path .\docs\dia-02-inventario-tecnico.md -Pattern "C:\\VENTA-DE-PASAJES" -AllMatches
```

Para cada ruta importante que aparezca en el documento:

```powershell
Test-Path -LiteralPath "<ruta-copiada-del-documento>"
```

### Paso 5 - Ejecutar comandos documentados

Buscar bloques de comandos del documento y ejecutarlos en orden, validando el resultado de cada bloque antes de continuar:

```powershell
Select-String -Path .\docs\dia-02-inventario-tecnico.md -Pattern "```powershell|```text|mvn |npm |docker |gcloud |curl.exe|powershell " -Context 0,6
```

### Paso 6 - Registrar la repeticion en bitacora

```powershell
Add-Content -LiteralPath .\vitacora.md -Value "`nReplica manual Dia 2 - <fecha>: comandos ejecutados y resultado."
```

### Paso 7 - Validar criterio de avance

Revisar la seccion de criterio de avance, resultado, estado final o pendientes del documento:

```powershell
Select-String -Path .\docs\dia-02-inventario-tecnico.md -Pattern "Criterio de avance|Resultado|Estado final|Pendiente|Pendientes" -Context 0,8
```
