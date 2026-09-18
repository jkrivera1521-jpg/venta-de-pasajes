# Dia 4 - Analisis de base Access

Fecha: 2026-09-01
Base analizada: `C:\VENTA-DE-PASAJES\legacy\sistema\Proyect\usuario.mdb`
Proveedor usado para lectura: `Microsoft.ACE.OLEDB.16.0`

## Resultado de extraccion

La base Access pudo abrirse correctamente con ACE OLEDB 16.0. El proveedor Jet OLEDB 4.0 no esta registrado en este equipo, aunque es el proveedor usado por el sistema VB6.

## Conteos por tabla

| Tabla | Registros |
| --- | ---: |
| `Usuarios` | 1 |
| `Buses` | 1 |
| `Tipobus` | 3 |
| `Terminales` | 1 |
| `Salidas` | 1 |
| `Clientes` | 3 |

## Diccionario de datos extraido

### Usuarios

| Columna | Tipo Access/OLEDB | Longitud | Nullable |
| --- | --- | ---: | --- |
| `Id_usuario` | Integer |  | No |
| `Login` | WChar | 255 | Si |
| `Password` | WChar | 255 | Si |
| `Nombres` | WChar | 255 | Si |
| `Apellidos` | WChar | 255 | Si |
| `Direccion` | WChar | 255 | Si |
| `Telefono` | WChar | 255 | Si |
| `Fecha` | Date |  | Si |

### Buses

| Columna | Tipo Access/OLEDB | Longitud | Nullable |
| --- | --- | ---: | --- |
| `Id` | Integer |  | No |
| `Asientos` | Integer |  | Si |
| `Destino` | WChar | 255 | Si |
| `Descripcion` | WChar | 255 | Si |
| `Id_Bus` | WChar | 255 | Si |
| `Matricula` | WChar | 255 | Si |
| `Tipo` | Integer |  | Si |
| `Fecha` | Date |  | Si |
| `terminal` | Integer |  | Si |

### Tipobus

| Columna | Tipo Access/OLEDB | Longitud | Nullable |
| --- | --- | ---: | --- |
| `Id` | Integer |  | No |
| `Tipo` | WChar | 255 | Si |

### Terminales

| Columna | Tipo Access/OLEDB | Longitud | Nullable |
| --- | --- | ---: | --- |
| `Id` | Integer |  | No |
| `Nombre` | WChar | 255 | Si |
| `Administrador` | WChar | 255 | Si |
| `Direccion` | WChar | 255 | Si |
| `Telefono` | WChar | 255 | Si |
| `Email` | WChar | 255 | Si |
| `ID_local` | WChar | 255 | Si |
| `Fecha` | Date |  | Si |

### Salidas

| Columna | Tipo Access/OLEDB | Longitud | Nullable |
| --- | --- | ---: | --- |
| `Id` | Integer |  | No |
| `Buses` | WChar | 255 | Si |
| `Terminal` | WChar | 255 | Si |
| `Destino` | WChar | 255 | Si |
| `Hora_salida` | Date |  | Si |
| `Fecha_salida` | Date |  | Si |
| `Tipo` | WChar | 255 | Si |

### Clientes

| Columna | Tipo Access/OLEDB | Longitud | Nullable |
| --- | --- | ---: | --- |
| `Id` | Integer |  | No |
| `Nombre` | WChar | 255 | Si |
| `Apellido` | WChar | 255 | Si |
| `DNI` | WChar | 255 | Si |
| `Precio` | WChar | 255 | Si |
| `Bus` | WChar | 255 | Si |
| `Tipo` | WChar | 255 | Si |
| `Origen` | WChar | 255 | Si |
| `Destino` | WChar | 255 | Si |
| `H_salida` | WChar | 255 | Si |
| `F_salida` | WChar | 255 | Si |
| `H_registro` | WChar | 255 | Si |
| `F_registro` | WChar | 255 | Si |
| `N_asiento` | Integer |  | Si |
| `Ubicacion` | WChar | 255 | Si |

## Indices y relaciones detectadas

Indices:

- `Usuarios.PrimaryKey` sobre `Id_usuario`, unico.
- `Buses.PrimaryKey` sobre `Id`, unico.
- `Buses.Id_Bus` sobre `Id_Bus`, no unico.
- `Buses.TerminalesBuses` sobre `terminal`, no unico.
- `Buses.TipobusBuses` sobre `Tipo`, no unico.
- `Tipobus.PrimaryKey` sobre `Id`, unico.
- `Tipobus.TipobusTipo` sobre `Tipo`, no unico.
- `Terminales.PrimaryKey` sobre `Id`, unico.
- `Terminales.ID` sobre `ID_local`, no unico.
- `Salidas.PrimaryKey` sobre `Id`, unico.
- `Clientes.Id` sobre `Id`, unico.

Relaciones Access detectadas:

- `Terminales.Id` -> `Buses.terminal`
- `Tipobus.Id` -> `Buses.Tipo`

No se detecto relacion formal para:

- `Salidas.Buses` -> `Buses.Id_Bus`
- `Clientes.Bus` -> `Buses.Id_Bus`
- `Clientes.N_asiento` -> disponibilidad de asientos

## Calidad de datos

Campos revisados por nulos o vacios:

| Tabla | Campo | Nulos/vacios |
| --- | --- | ---: |
| `Usuarios` | `Login` | 0 |
| `Usuarios` | `Password` | 0 |
| `Buses` | `Id_Bus` | 0 |
| `Buses` | `Matricula` | 0 |
| `Buses` | `Asientos` | 0 |
| `Buses` | `Tipo` | 0 |
| `Buses` | `terminal` | 0 |
| `Terminales` | `Nombre` | 0 |
| `Terminales` | `Email` | 0 |
| `Salidas` | `Buses` | 0 |
| `Salidas` | `Terminal` | 0 |
| `Salidas` | `Destino` | 0 |
| `Salidas` | `Hora_salida` | 0 |
| `Salidas` | `Fecha_salida` | 0 |
| `Clientes` | `Nombre` | 0 |
| `Clientes` | `Apellido` | 0 |
| `Clientes` | `DNI` | 0 |
| `Clientes` | `Precio` | 0 |
| `Clientes` | `Bus` | 0 |
| `Clientes` | `N_asiento` | 0 |

Duplicados revisados:

| Tabla | Campo | Grupos duplicados |
| --- | --- | ---: |
| `Usuarios` | `Login` | 0 |
| `Buses` | `Id_Bus` | 0 |
| `Buses` | `Matricula` | 0 |
| `Terminales` | `Nombre` | 0 |
| `Clientes` | `DNI` | 0 |
| `Clientes` | `Bus` | 1 |
| `Clientes` | `N_asiento` | 0 |

Integridad referencial inferida:

| Regla revisada | Incumplimientos |
| --- | ---: |
| `Buses.Tipo` existe en `Tipobus.Id` | 0 |
| `Buses.terminal` existe en `Terminales.Id` | 0 |
| `Salidas.Buses` existe en `Buses.Id_Bus` | 0 |

Validacion de formatos guardados como texto:

| Campo | Resultado |
| --- | ---: |
| `Clientes.Precio` no numerico | 0 |
| `Clientes.F_salida` no convertible a fecha | 0 |
| `Clientes.H_salida` no convertible a fecha | 3 |
| `Clientes.F_registro` no convertible a fecha | 0 |
| `Clientes.H_registro` no convertible a fecha | 3 |

## Transformaciones necesarias hacia PostgreSQL

- `Usuarios.Password` no debe migrarse como password activo. Debe migrarse a flujo de activacion o reseteo seguro.
- `Clientes` debe separarse en al menos pasajero/cliente, boleto o ticket, salida/asiento y datos de venta.
- `Clientes.Precio` debe migrarse desde texto a numeric/decimal.
- `Clientes.H_salida` y `Clientes.H_registro` requieren normalizacion a `time` o `timestamp`; los registros actuales no pasan conversion directa `IsDate`.
- `Salidas.Hora_salida` y `Salidas.Fecha_salida` deben normalizarse a `timestamp with time zone` o a fecha + hora separadas segun decision del dominio.
- `Buses.Id_Bus` y `Buses.Matricula` requieren reglas de unicidad explicitas en PostgreSQL.
- Se debe crear restriccion unica en ticketing para impedir doble venta: salida + asiento + estado activo.
- Las relaciones informales `Salidas.Buses` y `Clientes.Bus` deben convertirse a claves externas o referencias por identificador estable.

## Criterio de avance

Cumplido:

- Estructura de tablas extraida.
- Conteos de registros extraidos.
- Tipos de datos revisados.
- Campos de fechas, horas y precios guardados como texto identificados.
- Duplicados e incompletos revisados.
- Relaciones formales e inferidas documentadas.

Pendiente recomendado:

- Exportar datos a CSV/JSON controlado para pruebas de migracion.
- Definir esquema PostgreSQL destino por servicio.
- Implementar script reproducible de migracion Access -> PostgreSQL.

## Reversa primero

> Estandarizacion documental agregada el 2026-09-16 para que este dia tambien tenga una ruta segura de limpieza antes de repetir la practica.

Este dia pertenece a la etapa inicial del proyecto. Antes de ejecutar una reversa, revisar si el archivo contiene recursos externos reales, como Google Cloud, Docker, bases de datos o imagenes publicadas. No ejecutar comandos destructivos si no estas seguro de que el recurso no esta siendo usado.

### Paso R1 - Ubicarse en el workspace

```powershell
cd C:\VENTA-DE-PASAJES
```

### Paso R2 - Revisar recursos o archivos mencionados

```powershell
Select-String -Path .\docs\dia-04-analisis-base-access.md -Pattern "C:\\VENTA-DE-PASAJES|docker|gcloud|mvn|npm|Remove-Item|delete|rm|Cloud SQL|Artifact Registry|Secret Manager" -Context 0,2
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
Select-String -Path .\docs\dia-04-analisis-base-access.md -Pattern "Archivo|Archivos|C:\\VENTA-DE-PASAJES" -Context 0,4
```

Si aun asi necesitas retirar solo este documento de la practica, hacer primero una copia:

```powershell
New-Item -ItemType Directory -Force -Path .\backups | Out-Null
Copy-Item -LiteralPath .\docs\dia-04-analisis-base-access.md -Destination .\backups\dia-04-analisis-base-access-manual-backup.md -Force
```

Despues de respaldar, se podria eliminar manualmente el documento con:

```powershell
Remove-Item -LiteralPath .\docs\dia-04-analisis-base-access.md -Force
```

## Guia manual desde cero

> Estandarizacion documental agregada el 2026-09-16. Esta guia permite repetir el dia sin depender de Codex, usando el documento como fuente de verdad.

### Paso 1 - Ubicarse en el proyecto

```powershell
cd C:\VENTA-DE-PASAJES
```

### Paso 2 - Leer el alcance del dia en el backlog

```powershell
Select-String -Path .\tareas.md -Pattern "Dia 4|Dia 04" -Context 0,40
```

### Paso 3 - Leer la documentacion del dia

```powershell
Get-Content -LiteralPath .\docs\dia-04-analisis-base-access.md
```

### Paso 4 - Verificar archivos y rutas mencionadas

```powershell
Select-String -Path .\docs\dia-04-analisis-base-access.md -Pattern "C:\\VENTA-DE-PASAJES" -AllMatches
```

Para cada ruta importante que aparezca en el documento:

```powershell
Test-Path -LiteralPath "<ruta-copiada-del-documento>"
```

### Paso 5 - Ejecutar comandos documentados

Buscar bloques de comandos del documento y ejecutarlos en orden, validando el resultado de cada bloque antes de continuar:

```powershell
Select-String -Path .\docs\dia-04-analisis-base-access.md -Pattern "```powershell|```text|mvn |npm |docker |gcloud |curl.exe|powershell " -Context 0,6
```

### Paso 6 - Registrar la repeticion en bitacora

```powershell
Add-Content -LiteralPath .\vitacora.md -Value "`nReplica manual Dia 4 - <fecha>: comandos ejecutados y resultado."
```

### Paso 7 - Validar criterio de avance

Revisar la seccion de criterio de avance, resultado, estado final o pendientes del documento:

```powershell
Select-String -Path .\docs\dia-04-analisis-base-access.md -Pattern "Criterio de avance|Resultado|Estado final|Pendiente|Pendientes" -Context 0,8
```
