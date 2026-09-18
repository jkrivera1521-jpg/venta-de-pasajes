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

## Reversa primero

> Estandarizacion documental agregada el 2026-09-16 para que este dia tambien tenga una ruta segura de limpieza antes de repetir la practica.

Este dia pertenece a la etapa inicial del proyecto. Antes de ejecutar una reversa, revisar si el archivo contiene recursos externos reales, como Google Cloud, Docker, bases de datos o imagenes publicadas. No ejecutar comandos destructivos si no estas seguro de que el recurso no esta siendo usado.

### Paso R1 - Ubicarse en el workspace

```powershell
cd C:\VENTA-DE-PASAJES
```

### Paso R2 - Revisar recursos o archivos mencionados

```powershell
Select-String -Path .\docs\dia-01-inicio-alcance-resguardo.md -Pattern "C:\\VENTA-DE-PASAJES|docker|gcloud|mvn|npm|Remove-Item|delete|rm|Cloud SQL|Artifact Registry|Secret Manager" -Context 0,2
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
Select-String -Path .\docs\dia-01-inicio-alcance-resguardo.md -Pattern "Archivo|Archivos|C:\\VENTA-DE-PASAJES" -Context 0,4
```

Si aun asi necesitas retirar solo este documento de la practica, hacer primero una copia:

```powershell
New-Item -ItemType Directory -Force -Path .\backups | Out-Null
Copy-Item -LiteralPath .\docs\dia-01-inicio-alcance-resguardo.md -Destination .\backups\dia-01-inicio-alcance-resguardo-manual-backup.md -Force
```

Despues de respaldar, se podria eliminar manualmente el documento con:

```powershell
Remove-Item -LiteralPath .\docs\dia-01-inicio-alcance-resguardo.md -Force
```

## Guia manual desde cero

> Estandarizacion documental agregada el 2026-09-16. Esta guia permite repetir el dia sin depender de Codex, usando el documento como fuente de verdad.

### Paso 1 - Ubicarse en el proyecto

```powershell
cd C:\VENTA-DE-PASAJES
```

### Paso 2 - Leer el alcance del dia en el backlog

```powershell
Select-String -Path .\tareas.md -Pattern "Dia 1|Dia 01" -Context 0,40
```

### Paso 3 - Leer la documentacion del dia

```powershell
Get-Content -LiteralPath .\docs\dia-01-inicio-alcance-resguardo.md
```

### Paso 4 - Verificar archivos y rutas mencionadas

```powershell
Select-String -Path .\docs\dia-01-inicio-alcance-resguardo.md -Pattern "C:\\VENTA-DE-PASAJES" -AllMatches
```

Para cada ruta importante que aparezca en el documento:

```powershell
Test-Path -LiteralPath "<ruta-copiada-del-documento>"
```

### Paso 5 - Ejecutar comandos documentados

Buscar bloques de comandos del documento y ejecutarlos en orden, validando el resultado de cada bloque antes de continuar:

```powershell
Select-String -Path .\docs\dia-01-inicio-alcance-resguardo.md -Pattern "```powershell|```text|mvn |npm |docker |gcloud |curl.exe|powershell " -Context 0,6
```

### Paso 6 - Registrar la repeticion en bitacora

```powershell
Add-Content -LiteralPath .\vitacora.md -Value "`nReplica manual Dia 1 - <fecha>: comandos ejecutados y resultado."
```

### Paso 7 - Validar criterio de avance

Revisar la seccion de criterio de avance, resultado, estado final o pendientes del documento:

```powershell
Select-String -Path .\docs\dia-01-inicio-alcance-resguardo.md -Pattern "Criterio de avance|Resultado|Estado final|Pendiente|Pendientes" -Context 0,8
```
