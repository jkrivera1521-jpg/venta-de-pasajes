# Dia 1 - Inicio, alcance y resguardo del sistema VB6

Fecha: 2026-09-01
Workspace: `C:\VENTA-DE-PASAJES`

## Alcance MVP registrado

Se toma como alcance inicial el MVP descrito en `C:\VENTA-DE-PASAJES\tareas.md` para recrear el sistema VB6 de venta de pasajes ubicado en `C:\VENTA-DE-PASAJES\legacy\sistema`.

Modulos incluidos en el MVP:

- Inicio de sesion con identidad hibrida: Google y usuario local.
- Administracion de usuarios locales.
- Perfiles internos, roles y permisos.
- Terminales.
- Tipos de bus.
- Buses.
- Salidas.
- Seleccion de asientos.
- Venta de boletos.
- Registro de clientes o pasajeros.
- Consulta y reporte de clientes.
- Comprobante o PDF de boleto.
- Auditoria funcional minima para operaciones criticas.

Modulos explicitamente fuera del MVP inicial:

- Encomiendas.
- Facturacion electronica SRI completa.
- Pagos online.
- Contabilidad completa.
- Venta publica por internet para pasajeros.
- App movil nativa.

## Ubicaciones confirmadas

- Plan de tareas: `C:\VENTA-DE-PASAJES\tareas.md`
- Sistema legado: `C:\VENTA-DE-PASAJES\legacy\sistema`
- Proyecto VB6: `C:\VENTA-DE-PASAJES\legacy\sistema\Proyect\Dennis(Sistema de venta de pasajes).vbp`
- Base Access original: `C:\VENTA-DE-PASAJES\legacy\sistema\Proyect\usuario.mdb`
- Formularios VB6: `C:\VENTA-DE-PASAJES\legacy\sistema\WindowsForm`
- Reportes VB6 DataReport: `C:\VENTA-DE-PASAJES\legacy\sistema\WindowsReport`
- Modulos VB6: `C:\VENTA-DE-PASAJES\legacy\sistema\Modules`
- Imagenes y recursos: `C:\VENTA-DE-PASAJES\legacy\sistema\Imagenes`

## Resguardo realizado

Carpeta de respaldo creada:

`C:\VENTA-DE-PASAJES\backups\backup-20260901-123336`

Archivos generados:

| Archivo | Tamano | SHA256 |
| --- | ---: | --- |
| `legacy-sistema.zip` | 36,131,766 bytes | `FBF738B03D8725D3C5D02EC9D0351EB3A161E897E3F2BBDE5A90F8D88DA2A82A` |
| `usuario.mdb` | 823,296 bytes | `156DB4D36B48F43C70840FCBB1110B51E2FBCC52AA4C31AE1EFA67B922BA1F6B` |

## Estado del repositorio

La carpeta `C:\VENTA-DE-PASAJES` no tiene un repositorio Git inicializado al momento de iniciar estos trabajos. No se ejecuto `git init` porque no forma parte del Dia 1 y sera una decision del Dia 9 o de la estrategia de repositorio.

## Responsables pendientes de confirmar

Responsable funcional: pendiente de asignacion.

Responsable tecnico: pendiente de asignacion.

Responsable de infraestructura Google Cloud: pendiente de asignacion.

Responsable de validacion de datos migrados: pendiente de asignacion.

## Criterio de avance

Cumplido parcialmente:

- Sistema original respaldado.
- Base Access respaldada de forma independiente.
- Ubicacion de proyecto, base, formularios, reportes, modulos y recursos registrada.
- Alcance MVP registrado segun `tareas.md`.

Pendiente:

- Confirmacion humana de responsables funcionales y tecnicos.

## Reversa 

### Paso R1 - Ubicarse en el workspace

```powershell
cd C:\VENTA-DE-PASAJES
```


### Paso R2 - Detener procesos locales si este dia levanto herramientas

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
Stop-Process -Id 9999 -Force
```

### Paso R3 - Revisar contenedores temporales

```powershell
docker ps -a --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}" |
  Select-String -Pattern "venta-pasajes|identity|dispatch|ticketing|native|postgres"
```

Si el contenedor fue creado solo para repetir este dia y no se usa en otra practica:

```powershell
docker rm -f <container-name>
```

### Eliminar carpetas.


```powershell
Remove-Item -LiteralPath .\services\toolchain-demo-service\target -Recurse -Force
```
