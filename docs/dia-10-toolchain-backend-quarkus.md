# Dia 10 - Toolchain backend Quarkus

Fecha: 2026-09-01

## Objetivo

Validar que el entorno local puede construir un microservicio Quarkus con Java LTS, Maven, Quarkus CLI y compilacion nativa basada en Mandrel/GraalVM.

## Tareas ejecutadas

- Se verifico Java LTS.
- Se verifico Maven.
- Se verifico Quarkus CLI.
- Se verifico Docker Desktop y Docker Engine.
- Se verifico que `native-image` no esta instalado como binario local.
- Se eligio compilacion nativa en contenedor con Mandrel para evitar dependencia global de GraalVM.
- Se creo el servicio demo `C:\VENTA-DE-PASAJES\services\toolchain-demo-service`.
- Se agrego un endpoint REST de salud de toolchain.
- Se agrego prueba automatizada con `@QuarkusTest` y REST Assured.
- Se ejecuto compilacion y pruebas JVM.
- Se ejecuto compilacion nativa en Docker con imagen Mandrel.
- Se ejecuto smoke test del binario nativo dentro de Docker.

## Versiones detectadas

| Componente | Version / detalle |
| --- | --- |
| Java | `21.0.8` LTS, Oracle JDK, ruta `C:\tools\jdk\jdk-21.0.8` |
| Maven | `Apache Maven 3.9.6`, ruta `C:\tools\apache-maven-3.9.6-bin\apache-maven-3.9.6` |
| Quarkus CLI | `3.25.2`, ruta `C:\ProgramData\chocolatey\bin\quarkus.exe` |
| Docker client | `28.3.2` |
| Docker Desktop | `4.44.3 (202357)` |
| Docker engine | `28.3.2`, contexto `desktop-linux` |
| native-image local | No instalado en PATH |
| Builder nativo | `quay.io/quarkus/ubi9-quarkus-mandrel-builder-image:jdk-21` |
| Mandrel dentro del builder | `Mandrel-23.1.12.1-Final`, JDK `21.0.12.1+1-LTS` |

## Servicio demo

Ubicacion:

```text
C:\VENTA-DE-PASAJES\services\toolchain-demo-service
```

Coordenadas Maven:

```text
com.ventapasajes:toolchain-demo-service:0.1.0-SNAPSHOT
```

Extensiones Quarkus:

- `quarkus-rest-jackson`
- `quarkus-smallrye-openapi`
- `quarkus-arc`

Endpoint validado:

```text
GET /api/v1/toolchain/health
```

Respuesta:

```json
{"status":"ok","service":"toolchain-demo-service","runtime":"quarkus"}
```

## Comandos ejecutados

Verificacion JVM:

```powershell
mvn -f .\services\toolchain-demo-service\pom.xml test
```

Resultado:

```text
Tests run: 1, Failures: 0, Errors: 0, Skipped: 0
BUILD SUCCESS
Total time: 53.562 s
```

Build nativo:

```powershell
mvn -f .\services\toolchain-demo-service\pom.xml package "-Dnative" "-DskipTests" "-Dquarkus.native.container-build=true" "-Dquarkus.native.builder-image=quay.io/quarkus/ubi9-quarkus-mandrel-builder-image:jdk-21"
```

Resultado:

```text
Running Quarkus native-image plugin on MANDREL 23.1.12.1 JDK 21.0.12.1+1-LTS
Produced artifacts:
  /project/toolchain-demo-service-0.1.0-SNAPSHOT-runner (executable)
BUILD SUCCESS
Total time: 01:56 min
```

Smoke test nativo:

```text
Respuesta HTTP: {"status":"ok","service":"toolchain-demo-service","runtime":"quarkus"}
```

## Artefactos generados

| Artefacto | Detalle |
| --- | --- |
| `C:\VENTA-DE-PASAJES\services\toolchain-demo-service\pom.xml` | Proyecto Maven Quarkus 3.25.2 con Java 21. |
| `C:\VENTA-DE-PASAJES\services\toolchain-demo-service\src\main\java\com\ventapasajes\toolchain\ToolchainResource.java` | Endpoint REST de validacion. |
| `C:\VENTA-DE-PASAJES\services\toolchain-demo-service\src\test\java\com\ventapasajes\toolchain\ToolchainResourceTest.java` | Prueba automatizada JVM. |
| `C:\VENTA-DE-PASAJES\services\toolchain-demo-service\target\toolchain-demo-service-0.1.0-SNAPSHOT-runner` | Binario nativo Linux generado por Mandrel en Docker. |

Tamano del binario nativo:

```text
63,414,480 bytes
```

## Observaciones

- El registro de extensiones de Quarkus no estuvo disponible al primer intento de generacion con CLI.
- Se fijo explicitamente el BOM `io.quarkus.platform:quarkus-bom:3.25.2` para evitar depender del catalogo dinamico.
- `native-image` local no esta instalado; no bloquea el desarrollo porque el build nativo por contenedor fue exitoso.
- El binario nativo generado desde Windows es Linux por usar Docker como builder; para smoke test local se ejecuto dentro de Docker.
- La salida de Docker incluyo advertencia `DOCKER_INSECURE_NO_IPTABLES_RAW is set`; no bloqueo compilacion ni ejecucion.
- Los artefactos en `target` quedan ignorados por `.gitignore`.

## Resultado

La toolchain backend queda validada. Se puede construir un microservicio Quarkus en JVM y tambien compilarlo nativamente con Mandrel mediante Docker.

## Pendientes

- Convertir esta referencia en una plantilla reutilizable para los microservicios reales cuando inicie la implementacion backend.
- Decidir si el equipo quiere instalar GraalVM/Mandrel local o mantener exclusivamente build nativo por contenedor.
- Definir una version fija de builder image para CI/CD cuando se construyan imagenes productivas.

## Reversa primero

> Estandarizacion documental agregada el 2026-09-16 para que este dia tambien tenga una ruta segura de limpieza antes de repetir la practica.

Este dia pertenece a la etapa inicial del proyecto. Antes de ejecutar una reversa, revisar si el archivo contiene recursos externos reales, como Google Cloud, Docker, bases de datos o imagenes publicadas. No ejecutar comandos destructivos si no estas seguro de que el recurso no esta siendo usado.

### Paso R1 - Ubicarse en el workspace

```powershell
cd C:\VENTA-DE-PASAJES
```

### Paso R2 - Revisar recursos o archivos mencionados

```powershell
Select-String -Path .\docs\dia-10-toolchain-backend-quarkus.md -Pattern "C:\\VENTA-DE-PASAJES|docker|gcloud|mvn|npm|Remove-Item|delete|rm|Cloud SQL|Artifact Registry|Secret Manager" -Context 0,2
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
Select-String -Path .\docs\dia-10-toolchain-backend-quarkus.md -Pattern "Archivo|Archivos|C:\\VENTA-DE-PASAJES" -Context 0,4
```

Si aun asi necesitas retirar solo este documento de la practica, hacer primero una copia:

```powershell
New-Item -ItemType Directory -Force -Path .\backups | Out-Null
Copy-Item -LiteralPath .\docs\dia-10-toolchain-backend-quarkus.md -Destination .\backups\dia-10-toolchain-backend-quarkus-manual-backup.md -Force
```

Despues de respaldar, se podria eliminar manualmente el documento con:

```powershell
Remove-Item -LiteralPath .\docs\dia-10-toolchain-backend-quarkus.md -Force
```

## Guia manual desde cero

> Estandarizacion documental agregada el 2026-09-16. Esta guia permite repetir el dia sin depender de Codex, usando el documento como fuente de verdad.

### Paso 1 - Ubicarse en el proyecto

```powershell
cd C:\VENTA-DE-PASAJES
```

### Paso 2 - Leer el alcance del dia en el backlog

```powershell
Select-String -Path .\tareas.md -Pattern "Dia 10|Dia 10" -Context 0,40
```

### Paso 3 - Leer la documentacion del dia

```powershell
Get-Content -LiteralPath .\docs\dia-10-toolchain-backend-quarkus.md
```

### Paso 4 - Verificar archivos y rutas mencionadas

```powershell
Select-String -Path .\docs\dia-10-toolchain-backend-quarkus.md -Pattern "C:\\VENTA-DE-PASAJES" -AllMatches
```

Para cada ruta importante que aparezca en el documento:

```powershell
Test-Path -LiteralPath "<ruta-copiada-del-documento>"
```

### Paso 5 - Ejecutar comandos documentados

Buscar bloques de comandos del documento y ejecutarlos en orden, validando el resultado de cada bloque antes de continuar:

```powershell
Select-String -Path .\docs\dia-10-toolchain-backend-quarkus.md -Pattern "```powershell|```text|mvn |npm |docker |gcloud |curl.exe|powershell " -Context 0,6
```

### Paso 6 - Registrar la repeticion en bitacora

```powershell
Add-Content -LiteralPath .\vitacora.md -Value "`nReplica manual Dia 10 - <fecha>: comandos ejecutados y resultado."
```

### Paso 7 - Validar criterio de avance

Revisar la seccion de criterio de avance, resultado, estado final o pendientes del documento:

```powershell
Select-String -Path .\docs\dia-10-toolchain-backend-quarkus.md -Pattern "Criterio de avance|Resultado|Estado final|Pendiente|Pendientes" -Context 0,8
```
