# Dia 4 - Analisis de base Access

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
