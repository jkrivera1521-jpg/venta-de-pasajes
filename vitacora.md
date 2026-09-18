# Vitacora de migracion

Proyecto: Sistema de Venta de Pasajes
Workspace: `C:\VENTA-DE-PASAJES`
Fecha de inicio: 2026-09-01

## Criterio de registro

- Cada dia debe registrar tareas realizadas, evidencias, validaciones y comandos ejecutados.
- Si una accion modifica Google Cloud, base de datos, archivos del repo o infraestructura, debe incluirse el comando directo o el script ejecutado.
- Si un script ejecuta varios comandos relevantes, la vitacora debe incluir tambien los comandos `gcloud`, `mvn`, `npm`, `psql` u otros comandos internos principales.
- No se deben registrar tokens, contrasenas, llaves privadas ni secretos reales. Cuando existan, se deben reemplazar por `<redacted>` o documentar solo el nombre del recurso.

## 2026-09-01

### Arranque de ejecucion

- Se leyo el plan de trabajo en `C:\VENTA-DE-PASAJES\tareas.md`.
- Se confirmo que el sistema legado disponible para migracion esta en `C:\VENTA-DE-PASAJES\legacy`.
- Se reviso la estructura inicial del workspace.
- Se verifico que `C:\VENTA-DE-PASAJES` no tiene repositorio Git inicializado.

### Dia 1 - Inicio, alcance y resguardo del sistema VB6

Realizado:

- Se registro el alcance MVP segun `tareas.md`.
- Se identifico la carpeta del sistema VB6: `C:\VENTA-DE-PASAJES\legacy\sistema`.
- Se identifico la base Access: `C:\VENTA-DE-PASAJES\legacy\sistema\Proyect\usuario.mdb`.
- Se creo la carpeta de respaldo `C:\VENTA-DE-PASAJES\backups\backup-20260901-123336`.
- Se genero el respaldo comprimido `legacy-sistema.zip`.
- Se copio `usuario.mdb` de forma independiente en el respaldo.
- Se calcularon hashes SHA256 de los respaldos.
- Se creo el entregable `C:\VENTA-DE-PASAJES\docs\dia-01-inicio-alcance-resguardo.md`.

Evidencia:

| Archivo | Tamano | SHA256 |
| --- | ---: | --- |
| `C:\VENTA-DE-PASAJES\backups\backup-20260901-123336\legacy-sistema.zip` | 36,131,766 bytes | `FBF738B03D8725D3C5D02EC9D0351EB3A161E897E3F2BBDE5A90F8D88DA2A82A` |
| `C:\VENTA-DE-PASAJES\backups\backup-20260901-123336\usuario.mdb` | 823,296 bytes | `156DB4D36B48F43C70840FCBB1110B51E2FBCC52AA4C31AE1EFA67B922BA1F6B` |

Estado:

- Completado tecnicamente.
- Pendiente de confirmacion humana: responsables funcionales, tecnicos, infraestructura y validacion de datos.

### Dia 2 - Inventario tecnico del sistema actual

Realizado:

- Se reviso el proyecto VB6 `Dennis(Sistema de venta de pasajes).vbp`.
- Se inventariaron 9 formularios `.frm`.
- Se inventariaron 2 reportes VB6 DataReport.
- Se identificaron 2 modulos `.bas`.
- Se identificaron dependencias ADO/DAO/DataReport y controles OCX/DLL.
- Se identificaron recursos reutilizables en `Imagenes`.
- Se revisaron rutinas principales de login, usuarios, buses, terminales, salidas, asientos, venta y reportes.
- Se creo el entregable `C:\VENTA-DE-PASAJES\docs\dia-02-inventario-tecnico.md`.

Hallazgos principales:

- El sistema usa `usuario.mdb` con Jet OLEDB 4.0.
- Las tablas usadas por codigo son `Usuarios`, `Buses`, `Tipobus`, `Terminales`, `Salidas` y `Clientes`.
- El login compara `Usuarios.Password` contra el texto ingresado, lo que confirma contrasenas historicas en texto plano.
- La venta de boleto se registra en `Clientes`; no existe entidad separada de boleto en el codigo legado.
- La ocupacion de asiento se maneja como estado visual del formulario `AsientosForm`, no como restriccion transaccional persistente.
- Los reportes existentes son `DrClientes` y `DrFacturacion`.

Estado:

- Completado.

### Pendientes inmediatos

- Confirmar responsables funcionales y tecnicos del proyecto.

### Dia 3 - Analisis funcional de pantallas

Realizado:

- Se documento el flujo funcional de `LoginForm`, `MDIFormPrincipal`, usuarios, buses, terminales, salidas, venta, asientos, consultas y reportes.
- Se mapeo cada pantalla VB6 al microfrontend destino.
- Se identificaron los servicios principales involucrados por flujo.
- Se creo el entregable `C:\VENTA-DE-PASAJES\docs\dia-03-analisis-funcional-pantallas.md`.

Hallazgos principales:

- El sistema legado no maneja roles ni permisos funcionales.
- El formulario `AsientosForm` concentra venta, asiento, pasajero y comprobante.
- El mapa de asientos esta fijo a 25 posiciones.
- La disponibilidad de asiento depende del estado visual del formulario, no de una tabla transaccional.

Estado:

- Completado.

### Dia 4 - Analisis de base Access

Realizado:

- Se probo lectura de `usuario.mdb` con Jet OLEDB 4.0; el proveedor no esta registrado localmente.
- Se leyo `usuario.mdb` con `Microsoft.ACE.OLEDB.16.0`.
- Se extrajeron tablas, columnas, tipos, conteos, indices y relaciones.
- Se revisaron nulos/vacios en campos principales.
- Se revisaron duplicados candidatos.
- Se reviso integridad referencial inferida.
- Se identificaron campos de precio, fecha y hora guardados como texto.
- Se creo el entregable `C:\VENTA-DE-PASAJES\docs\dia-04-analisis-base-access.md`.

Conteos:

| Tabla | Registros |
| --- | ---: |
| `Usuarios` | 1 |
| `Buses` | 1 |
| `Tipobus` | 3 |
| `Terminales` | 1 |
| `Salidas` | 1 |
| `Clientes` | 3 |

Hallazgos principales:

- Tablas Access detectadas: `Usuarios`, `Buses`, `Tipobus`, `Terminales`, `Salidas`, `Clientes`.
- Relaciones formales: `Terminales.Id` -> `Buses.terminal` y `Tipobus.Id` -> `Buses.Tipo`.
- `Clientes.Precio`, `Clientes.H_salida`, `Clientes.F_salida`, `Clientes.H_registro` y `Clientes.F_registro` estan almacenados como texto.
- `Clientes.H_salida` y `Clientes.H_registro` no pasan conversion directa de fecha/hora en los 3 registros actuales.
- No hay relacion formal ni indice unico para proteger salida + asiento.

Estado:

- Completado.

### Dia 5 - Definicion de dominios y limites de microservicios

Realizado:

- Se definieron limites de `identity-service`.
- Se definieron limites de `dispatch-service`.
- Se definieron limites de `ticketing-service`.
- Se definieron limites de `document-service`.
- Se definieron limites de `reporting-service`.
- Se definieron limites de `audit-service`.
- Se definieron reglas de propiedad de datos.
- Se creo el mapa de dominios.
- Se creo la matriz servicio-datos.
- Se creo la matriz de migracion desde tablas Access hacia dominios nuevos.
- Se creo el entregable `C:\VENTA-DE-PASAJES\docs\dia-05-definicion-dominios-microservicios.md`.

Decisiones registradas:

- `identity-service` sera dueno de usuarios internos, credenciales locales, identidades Google, roles y permisos.
- `dispatch-service` sera dueno de terminales, rutas, tipos de bus, buses, layouts y salidas.
- `ticketing-service` sera dueno de pasajeros, disponibilidad por salida/asiento, reservas, boletos y anulaciones.
- `document-service` sera dueno de plantillas, PDFs y metadata documental.
- `reporting-service` sera dueno de modelos de lectura y reportes.
- `audit-service` sera dueno de auditoria inmutable.
- La tabla legacy `Clientes` se separara en pasajero, boleto, asiento vendido, precio y snapshot de salida.
- La doble venta debe impedirse con restriccion transaccional en `ticketing-service`.

Estado:

- Completado.

### Dia 6 - Diseno de contratos API

Realizado:

- Se creo la carpeta `C:\VENTA-DE-PASAJES\docs\openapi`.
- Se definio OpenAPI inicial para `identity-service`.
- Se definio OpenAPI inicial para `dispatch-service`.
- Se definio OpenAPI inicial para `ticketing-service`.
- Se definio OpenAPI inicial para `document-service`.
- Se definio OpenAPI inicial para `reporting-service`.
- Se agrego OpenAPI inicial para `audit-service` por consistencia con los limites del Dia 5.
- Se definio la guia de convenciones API en `C:\VENTA-DE-PASAJES\docs\api-conventions.md`.
- Se creo el entregable `C:\VENTA-DE-PASAJES\docs\dia-06-diseno-contratos-api.md`.

Archivos de contrato:

| Servicio | Archivo |
| --- | --- |
| `identity-service` | `C:\VENTA-DE-PASAJES\docs\openapi\identity-service.openapi.yaml` |
| `dispatch-service` | `C:\VENTA-DE-PASAJES\docs\openapi\dispatch-service.openapi.yaml` |
| `ticketing-service` | `C:\VENTA-DE-PASAJES\docs\openapi\ticketing-service.openapi.yaml` |
| `document-service` | `C:\VENTA-DE-PASAJES\docs\openapi\document-service.openapi.yaml` |
| `reporting-service` | `C:\VENTA-DE-PASAJES\docs\openapi\reporting-service.openapi.yaml` |
| `audit-service` | `C:\VENTA-DE-PASAJES\docs\openapi\audit-service.openapi.yaml` |

Decisiones registradas:

- Todas las APIs se versionan bajo `/api/v1`.
- JSON usara `snake_case`.
- Los IDs internos usaran UUID; `legacy_id` queda solo para trazabilidad de migracion.
- Las APIs usan Bearer JWT salvo endpoints publicos de salud y autenticacion.
- Los errores usaran estructura comun `{ "error": { "code", "message", "field_errors", "correlation_id" } }`.
- Las listas paginadas usaran `{ "data": [], "meta": {} }`.
- Operaciones criticas usaran `Idempotency-Key`.
- La venta de boletos se define como `POST /tickets`.
- La anulacion se define como `POST /tickets/{ticketId}/cancel`.
- La disponibilidad de asientos se define como `GET /departures/{departureId}/seats`.

Estado:

- Completado.

Validacion:

- Se ejecuto `npx --yes @apidevtools/swagger-cli validate` sobre los seis contratos OpenAPI.
- Resultado: `identity-service`, `dispatch-service`, `ticketing-service`, `document-service`, `reporting-service` y `audit-service` validos.

### Dia 7 - Diseno de eventos y mensajeria

Realizado:

- Se creo la carpeta `C:\VENTA-DE-PASAJES\docs\events`.
- Se definio el catalogo inicial de eventos en `C:\VENTA-DE-PASAJES\docs\events\catalogo-eventos.md`.
- Se definio el diseno Pub/Sub en `C:\VENTA-DE-PASAJES\docs\events\diseno-pubsub.md`.
- Se creo el esquema JSON del sobre comun de evento en `C:\VENTA-DE-PASAJES\docs\events\event-envelope.schema.json`.
- Se creo el entregable resumen `C:\VENTA-DE-PASAJES\docs\dia-07-diseno-eventos-mensajeria.md`.

Eventos iniciales definidos:

- `UserCreated`
- `UserRoleChanged`
- `TerminalCreated`
- `BusCreated`
- `SeatLayoutUpdated`
- `DepartureScheduled`
- `DepartureCancelled`
- `SeatReserved`
- `SeatReservationExpired`
- `TicketSold`
- `TicketCancelled`
- `TicketPrinted`
- `DocumentGenerated`
- `AuditEventCreated`

Topicos Pub/Sub definidos:

| Topic | Productor |
| --- | --- |
| `venta-pasajes-{env}-identity-events` | `identity-service` |
| `venta-pasajes-{env}-dispatch-events` | `dispatch-service` |
| `venta-pasajes-{env}-ticketing-events` | `ticketing-service` |
| `venta-pasajes-{env}-document-events` | `document-service` |
| `venta-pasajes-{env}-audit-events` | `audit-service` |

Decisiones registradas:

- Los eventos son hechos ya ocurridos, no comandos transaccionales.
- Todos los eventos comparten sobre con `event_id`, `event_type`, `schema_version`, `occurred_at`, `source_service`, `correlation_id` y `payload`.
- `X-Correlation-Id` se propaga por HTTP, logs y Pub/Sub.
- Productores usaran outbox transaccional.
- Consumidores usaran `processed_events` con clave unica por `source_service + event_id + consumer_name`.
- Pub/Sub no sera el mecanismo para impedir doble venta; esa regla sigue en `ticketing-service` con transaccion y restriccion de base.
- Se definieron dead-letter topics por dominio y alertas iniciales.
- No se publican passwords, hashes, tokens, secretos ni documentos completos.

Estado:

- Completado.

Validacion:

- Se valido `C:\VENTA-DE-PASAJES\docs\events\event-envelope.schema.json` con `node` y `JSON.parse`.
- Resultado: JSON valido.

### Dia 8 - Diseno de modelo PostgreSQL por servicio

Realizado:

- Se creo la carpeta `C:\VENTA-DE-PASAJES\docs\database`.
- Se diseno `identity_db`.
- Se diseno `dispatch_db`.
- Se diseno `ticketing_db`.
- Se diseno `documents_db`.
- Se diseno `reporting_db` como modelo de lectura inicial.
- Se diseno `audit_db`.
- Se incluyo `outbox_events` para publicacion confiable de eventos.
- Se incluyo `processed_events` en servicios consumidores.
- Se documento el modelo de datos por servicio en `C:\VENTA-DE-PASAJES\docs\dia-08-diseno-modelo-postgresql.md`.

Archivos DDL:

| Base | Archivo |
| --- | --- |
| `identity_db` | `C:\VENTA-DE-PASAJES\docs\database\identity-db.sql` |
| `dispatch_db` | `C:\VENTA-DE-PASAJES\docs\database\dispatch-db.sql` |
| `ticketing_db` | `C:\VENTA-DE-PASAJES\docs\database\ticketing-db.sql` |
| `documents_db` | `C:\VENTA-DE-PASAJES\docs\database\documents-db.sql` |
| `reporting_db` | `C:\VENTA-DE-PASAJES\docs\database\reporting-db.sql` |
| `audit_db` | `C:\VENTA-DE-PASAJES\docs\database\audit-db.sql` |

Decisiones registradas:

- `identity_db.users` conserva `legacy_id`, pero las contrasenas de Access no se migran como credenciales activas.
- `dispatch_db` concentra terminales, rutas, tipos de bus, buses, layouts y salidas.
- `ticketing_db` separa pasajeros, reservas, asignaciones de asiento y boletos.
- `ticketing_db.seat_allocations` tiene indice unico parcial para impedir dos asignaciones activas del mismo `departure_id + seat_number`.
- `ticketing_db.tickets` conserva `departure_snapshot` para historia de boleto.
- `documents_db` guarda metadata y referencia a Cloud Storage, no el estado funcional de la venta.
- `reporting_db` es eventualmente consistente y no es fuente transaccional.
- `audit_db.audit_events` es append-only a nivel funcional y deduplica por `source_service + source_event_id`.

Validacion:

- No hay `psql` instalado localmente.
- Docker esta instalado, pero el daemon no esta disponible en este momento.
- Se ejecuto revision estatica con Node para detectar tablas, referencias locales, `outbox_events`, `processed_events` y el indice unico parcial de asientos.
- Resultado: revision estatica sin referencias locales faltantes.

Estado:

- Completado.

### Pendientes inmediatos actualizados

- Dia 10: validar toolchain backend Quarkus.
- Confirmar responsables funcionales y tecnicos del proyecto.

### Dia 9 - Preparacion de repositorio monorepo

Realizado:

- Se creo la estructura base `apps`, `services`, `packages`, `infra`, `migration` y se mantuvo `docs` como fuente documental.
- Se crearon carpetas para `frontend-shell`, `mfe-identity`, `mfe-dispatch`, `mfe-ticketing`, `mfe-reporting` y `mfe-admin`.
- Se crearon carpetas para `identity-service`, `dispatch-service`, `ticketing-service`, `document-service`, `reporting-service` y `audit-service`.
- Se crearon carpetas para paquetes compartidos `ui`, `auth-client`, `api-client` y `shared-types`.
- Se crearon carpetas de infraestructura `terraform`, `cloudbuild`, `cloudrun` y `env`.
- Se preparo `migration\access-to-postgres` para la futura migracion desde Access.
- Se agrego README principal en `C:\VENTA-DE-PASAJES\README.md`.
- Se agregaron README por area en `apps`, `services`, `packages`, `infra` y `migration`.
- Se agrego `C:\VENTA-DE-PASAJES\docs\naming-standards.md`.
- Se agrego `C:\VENTA-DE-PASAJES\docs\branching-and-commits.md`.
- Se agregaron plantillas de variables de ambiente:
  - `C:\VENTA-DE-PASAJES\.env.example`
  - `C:\VENTA-DE-PASAJES\infra\env\backend-service.env.example`
  - `C:\VENTA-DE-PASAJES\infra\env\frontend-app.env.example`
  - `C:\VENTA-DE-PASAJES\infra\env\google-cloud.env.example`
  - `C:\VENTA-DE-PASAJES\migration\access-to-postgres\.env.example`
- Se agregaron `.gitkeep` en carpetas vacias para conservar la estructura cuando se inicialice Git.
- Se creo el entregable `C:\VENTA-DE-PASAJES\docs\dia-09-preparacion-monorepo.md`.

Estructura base:

| Area | Carpetas |
| --- | --- |
| `apps` | `frontend-shell`, `mfe-identity`, `mfe-dispatch`, `mfe-ticketing`, `mfe-reporting`, `mfe-admin` |
| `services` | `identity-service`, `dispatch-service`, `ticketing-service`, `document-service`, `reporting-service`, `audit-service` |
| `packages` | `ui`, `auth-client`, `api-client`, `shared-types` |
| `infra` | `terraform`, `cloudbuild`, `cloudrun`, `env` |
| `migration` | `access-to-postgres` |

Decisiones registradas:

- Se mantiene monorepo para coordinar contratos, servicios, MFEs, infraestructura y migraciones.
- No se inicializo Git porque el workspace no lo tenia y no fue solicitado explicitamente.
- Las carpetas quedan preparadas con `.gitkeep`, pero el scaffolding tecnico de Quarkus y Next.js se aborda en dias posteriores.
- Las plantillas de entorno no contienen secretos reales.

Validacion:

- Se verifico la existencia de carpetas, README, convenciones y plantillas de ambiente.
- Resultado: estructura de monorepo lista para desarrollo multi-modulo.

Estado:

- Completado tecnicamente.
- Pendiente de confirmacion humana: aprobacion formal de la estructura base e inicializacion/conexion Git si aplica.

### Pendientes inmediatos actualizados

- Dia 10: validar toolchain backend Quarkus.
- Confirmar responsables funcionales y tecnicos del proyecto.

### Dia 10 - Toolchain backend Quarkus

Realizado:

- Se verifico Java LTS instalado.
- Se verifico Maven instalado.
- Se verifico Quarkus CLI instalado.
- Se verifico Docker Desktop y Docker Engine operativos.
- Se verifico que `native-image` no esta disponible como binario local en PATH.
- Se decidio usar build nativo por contenedor con Mandrel/GraalVM para evitar dependencia global local.
- Se creo el servicio demo `C:\VENTA-DE-PASAJES\services\toolchain-demo-service`.
- Se agrego endpoint `GET /api/v1/toolchain/health`.
- Se agrego prueba JVM con `@QuarkusTest` y REST Assured.
- Se ejecuto `mvn -f .\services\toolchain-demo-service\pom.xml test`.
- Se ejecuto build nativo con Docker y Mandrel:
  - `mvn -f .\services\toolchain-demo-service\pom.xml package "-Dnative" "-DskipTests" "-Dquarkus.native.container-build=true" "-Dquarkus.native.builder-image=quay.io/quarkus/ubi9-quarkus-mandrel-builder-image:jdk-21"`
- Se ejecuto smoke test del binario nativo dentro de Docker.
- Se creo el entregable `C:\VENTA-DE-PASAJES\docs\dia-10-toolchain-backend-quarkus.md`.

Versiones detectadas:

| Componente | Version / detalle |
| --- | --- |
| Java | `21.0.8` LTS, Oracle JDK |
| Maven | `Apache Maven 3.9.6` |
| Quarkus CLI | `3.25.2` |
| Docker client | `28.3.2` |
| Docker Desktop | `4.44.3 (202357)` |
| Docker engine | `28.3.2` |
| native-image local | No instalado |
| Builder nativo | `quay.io/quarkus/ubi9-quarkus-mandrel-builder-image:jdk-21` |
| Mandrel builder | `Mandrel-23.1.12.1-Final`, JDK `21.0.12.1+1-LTS` |

Validacion:

- Pruebas JVM: `Tests run: 1, Failures: 0, Errors: 0, Skipped: 0`.
- Build JVM/test: `BUILD SUCCESS`, tiempo `53.562 s`.
- Build nativo: `BUILD SUCCESS`, tiempo `01:56 min`.
- Binario nativo generado: `C:\VENTA-DE-PASAJES\services\toolchain-demo-service\target\toolchain-demo-service-0.1.0-SNAPSHOT-runner`.
- Tamano del binario nativo: `63,414,480 bytes`.
- Smoke test nativo: respuesta `{"status":"ok","service":"toolchain-demo-service","runtime":"quarkus"}`.

Observaciones:

- El registro dinamico de extensiones de Quarkus no respondio al intento inicial de generacion con CLI.
- Se fijo el BOM `io.quarkus.platform:quarkus-bom:3.25.2`.
- La compilacion nativa por contenedor queda como ruta recomendada inicial para desarrollo y CI/CD.
- Docker emitio advertencia `DOCKER_INSECURE_NO_IPTABLES_RAW is set`, sin bloquear build ni ejecucion.

Estado:

- Completado.

### Pendientes inmediatos actualizados

- Convertir el demo Quarkus en plantilla reutilizable cuando inicie la implementacion backend.
- Confirmar responsables funcionales y tecnicos del proyecto.

### Dia 11 - Toolchain frontend Next.js MFE

Realizado:

- Se verifico Node.js instalado y marcado como LTS `Krypton`.
- Se verifico npm instalado.
- Se verifico Corepack instalado.
- Se verifico que `pnpm` y `yarn` no estan disponibles en PATH.
- Se decidio usar npm workspaces como gestor inicial.
- Se consultaron versiones actuales desde npm registry para Next.js, React, TypeScript, lucide-react y tipos.
- Se creo `C:\VENTA-DE-PASAJES\package.json` con workspaces y scripts frontend.
- Se creo `C:\VENTA-DE-PASAJES\package-lock.json`.
- Se creo `C:\VENTA-DE-PASAJES\tsconfig.base.json`.
- Se creo el paquete `C:\VENTA-DE-PASAJES\packages\shared-types`.
- Se definio `MicrofrontendManifest` como contrato compartido.
- Se creo `C:\VENTA-DE-PASAJES\apps\frontend-shell` como app Next.js.
- Se creo `C:\VENTA-DE-PASAJES\apps\mfe-identity` como primer MFE demo.
- Se implemento en el shell la carga de manifest remoto desde `NEXT_PUBLIC_MFE_IDENTITY_MANIFEST_URL`.
- Se implemento en `mfe-identity` el endpoint `GET /mfe/manifest`.
- Se implemento en `mfe-identity` el endpoint `GET /api/health`.
- Se implemento en `mfe-identity` la pantalla embebible `GET /identity/embedded`.
- Se agregaron plantillas `.env.example` para shell y MFE.
- Se actualizaron `.env.example` raiz e `infra\env\frontend-app.env.example`.
- Se agregaron scripts `C:\VENTA-DE-PASAJES\scripts\start-frontend-dev.ps1` y `C:\VENTA-DE-PASAJES\scripts\stop-frontend-dev.ps1`.
- Se agrego `*.tsbuildinfo` a `.gitignore`.
- Se ejecuto `npm install`.
- Se ejecuto `npm run typecheck:frontend`.
- Se ejecuto `npm run build:frontend`.
- Se inicio el entorno local con `npm run dev:frontend`.
- Se validaron rutas HTTP de shell, MFE, manifest y health.
- Se creo el entregable `C:\VENTA-DE-PASAJES\docs\dia-11-toolchain-frontend-nextjs-mfe.md`.

Versiones detectadas:

| Componente | Version / detalle |
| --- | --- |
| Node.js | `v24.13.0`, LTS `Krypton` |
| npm | `11.6.2` |
| Corepack | `0.34.5` |
| pnpm | No instalado |
| yarn | No instalado |
| Next.js | `16.3.4` |
| React | `19.2.8` |
| TypeScript | `7.0.2` |
| lucide-react | `1.39.0` |

Validacion:

- `npm install`: `added 34 packages`, `audited 38 packages`, `found 0 vulnerabilities`.
- `npm run typecheck:frontend`: exitoso para `shared-types`, `mfe-identity` y `frontend-shell`.
- `npm run build:frontend`: exitoso para `mfe-identity` y `frontend-shell`.
- `http://localhost:3001/api/health`: respuesta `{"status":"ok","service":"mfe-identity"}`.
- `http://localhost:3001/mfe/manifest`: HTTP 200 con manifest valido.
- `http://localhost:3001/identity/embedded`: HTTP 200.
- `http://localhost:3000`: HTTP 200.

URLs locales:

| App | URL |
| --- | --- |
| `frontend-shell` | `http://localhost:3000` |
| `mfe-identity` | `http://localhost:3001` |
| Manifest MFE Identity | `http://localhost:3001/mfe/manifest` |
| Pantalla embebida MFE Identity | `http://localhost:3001/identity/embedded` |

Decisiones registradas:

- La composicion inicial de MFE usa manifest remoto + iframe aislado.
- Esta estrategia permite validar integracion remota sin introducir todavia una dependencia de module federation.
- `agentRules: false` se agrego en `next.config.ts` para evitar archivos autogenerados por Next dentro de las apps.
- Los servidores locales quedaron iniciados con `npm run dev:frontend`; pueden detenerse con `npm run stop:frontend`.

Estado:

- Completado.

### Pendientes inmediatos actualizados

- Dia 12: preparar infraestructura Google Cloud base.
- Convertir los patrones de demo Quarkus y MFE en plantillas reutilizables cuando inicie la implementacion.
- Confirmar responsables funcionales y tecnicos del proyecto.

### Dia 12 - Infraestructura Google Cloud base

Realizado:

- Se verifico `gcloud --version`; Google Cloud CLI no esta instalado en PATH.
- Se verifico `terraform -version`; Terraform no esta instalado en PATH.
- Se verifico Chocolatey: disponible, version `2.5.0`.
- Se verifico Winget: disponible, version `v1.29.280`.
- Se verifico que Chocolatey ofrece `gcloudsdk 582.0.0`.
- Se verifico que Winget ofrece `Google.CloudSDK 582.0.0`.
- Se verifico que Chocolatey ofrece `terraform 1.16.0`.
- Se verifico que Winget ofrece `Hashicorp.Terraform 1.15.8`.
- Se definio region principal inicial `us-central1` para `dev`.
- Se definio proyecto dev sugerido `venta-pasajes-dev`.
- Se definio presupuesto mensual inicial sugerido `venta-pasajes-dev-monthly-budget` por `50USD`.
- Se creo `C:\VENTA-DE-PASAJES\infra\gcloud\dev-apis.txt` con 15 APIs base.
- Se creo `C:\VENTA-DE-PASAJES\infra\gcloud\bootstrap-dev.ps1`.
- Se creo `C:\VENTA-DE-PASAJES\infra\gcloud\verify-dev.ps1`.
- Se creo `C:\VENTA-DE-PASAJES\infra\gcloud\README.md`.
- Se actualizo `C:\VENTA-DE-PASAJES\infra\env\google-cloud.env.example`.
- Se actualizo `C:\VENTA-DE-PASAJES\infra\README.md`.
- Se actualizo `C:\VENTA-DE-PASAJES\docs\naming-standards.md`.
- Se valido la sintaxis PowerShell de `bootstrap-dev.ps1` y `verify-dev.ps1`.
- Se valido que `dev-apis.txt` contiene 15 APIs sin duplicados.
- Se ejecuto dry-run del bootstrap con billing ficticio.
- Se ejecuto `verify-dev.ps1`; fallo de forma esperada porque `gcloud` no esta instalado.
- Se creo el entregable `C:\VENTA-DE-PASAJES\docs\dia-12-infraestructura-google-cloud-base.md`.

APIs base definidas:

| API | Proposito |
| --- | --- |
| `cloudresourcemanager.googleapis.com` | Gestion de proyectos |
| `serviceusage.googleapis.com` | Activacion de APIs |
| `cloudbilling.googleapis.com` | Billing |
| `billingbudgets.googleapis.com` | Presupuestos |
| `run.googleapis.com` | Cloud Run |
| `sqladmin.googleapis.com` | Cloud SQL |
| `cloudbuild.googleapis.com` | Cloud Build |
| `artifactregistry.googleapis.com` | Artifact Registry |
| `secretmanager.googleapis.com` | Secret Manager |
| `storage.googleapis.com` | Cloud Storage |
| `pubsub.googleapis.com` | Pub/Sub |
| `logging.googleapis.com` | Cloud Logging |
| `monitoring.googleapis.com` | Cloud Monitoring |
| `iam.googleapis.com` | IAM |
| `iamcredentials.googleapis.com` | Credenciales IAM |

Validacion:

- Sintaxis PowerShell: `OK .\infra\gcloud\bootstrap-dev.ps1` y `OK .\infra\gcloud\verify-dev.ps1`.
- APIs: `OK: 15 APIs, no duplicates`.
- Dry-run genero comandos para:
  - Crear proyecto `venta-pasajes-dev`.
  - Vincular billing account.
  - Activar APIs base.
  - Configurar region Cloud Run `us-central1`.
  - Crear presupuesto mensual con umbrales 50%, 75%, 90% forecasted y 100%.
- Verificacion real: no ejecutable por falta de Google Cloud CLI.

Estado:

- Preparacion local y scripts: completado.
- Proyecto Google Cloud dev real: pendiente.
- APIs activas en cloud: pendiente.
- Presupuesto real: pendiente.

Pendiente externo:

- Instalar Google Cloud CLI.
- Ejecutar `gcloud init`.
- Ejecutar `gcloud auth login`.
- Definir `GOOGLE_BILLING_ACCOUNT_ID` real.
- Confirmar si se usara organizacion o carpeta Google Cloud.
- Ejecutar `.\infra\gcloud\bootstrap-dev.ps1`.
- Ejecutar `.\infra\gcloud\verify-dev.ps1`.

### Pendientes inmediatos actualizados

- Ejecutar bootstrap real de Dia 12 cuando esten disponibles `gcloud`, cuenta autenticada y billing account.
- Dia 13: preparar IAM y cuentas de servicio.
- Confirmar responsables funcionales y tecnicos del proyecto.

### Soporte Dia 12 - Instalacion de gcloud y bloqueo SSL

Realizado:

- El usuario instalo Google Cloud CLI mediante Chocolatey.
- Se reviso desde esta sesion que `gcloud` aun no esta en PATH, pero existe en `C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd`.
- Se valido por ruta completa `Google Cloud SDK 582.0.0`.
- Se reviso que `core/custom_ca_certs_file` esta sin configurar.
- El usuario adjunto evidencia de error en `gcloud auth login`: `CERTIFICATE_VERIFY_FAILED` por certificado autofirmado en la cadena.

Diagnostico:

- El problema no es el Project ID ni el billing account; es la validacion TLS de `gcloud` contra `oauth2.googleapis.com`.
- Causa probable: proxy, firewall o antivirus corporativo que intercepta HTTPS con una CA interna que el navegador confia, pero `gcloud` no.

Accion recomendada:

- Obtener temporalmente `GOOGLE_BILLING_ACCOUNT_ID` desde la consola web de Google Cloud.
- Configurar en `gcloud` el certificado raiz corporativo mediante `gcloud config set core/custom_ca_certs_file <archivo-ca.pem>`.
- Evitar desactivar validacion SSL salvo diagnostico puntual y temporal.

### Soporte Dia 12 - Verificacion posterior de gcloud

Realizado:

- Se valido `gcloud` por ruta completa:
  `C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd`.
- Version detectada: `Google Cloud SDK 582.0.0`.
- Cuenta activa detectada: `jkrivera1521@gmail.com`.
- Project configurado en `gcloud`: `project-fbb34cd7-0b82-43e1-867`.
- Billing account confirmado: `012A58-73A3EE-D43B8D`.
- Billing vinculado al proyecto: `true`.
- Se genero bundle local de certificados para `gcloud`:
  `C:\VENTA-DE-PASAJES\certs\gcloud-custom-ca-bundle.pem`.
- Se configuro `core/custom_ca_certs_file` apuntando al bundle local.
- Se uso `auth/disable_ssl_validation=true` solo como diagnostico temporal para confirmar permisos y estado cloud.
- Se restauro `auth/disable_ssl_validation=false`.
- Se ajustaron `bootstrap-dev.ps1` y `verify-dev.ps1` para preferir Python 3.12/3.13 antes de Python 3.14.
- Se mejoro `verify-dev.ps1` para reportar cuando no puede verificar presupuestos por falta de `gcloud beta`.
- Se actualizo `infra\gcloud\README.md` y `docs\dia-12-infraestructura-google-cloud-base.md`.

Resultado de verificacion:

- El proyecto existe y es accesible.
- La facturacion esta vinculada.
- Faltan 11 APIs requeridas del Dia 12:
  - `cloudresourcemanager.googleapis.com`
  - `cloudbilling.googleapis.com`
  - `billingbudgets.googleapis.com`
  - `run.googleapis.com`
  - `sqladmin.googleapis.com`
  - `cloudbuild.googleapis.com`
  - `artifactregistry.googleapis.com`
  - `secretmanager.googleapis.com`
  - `pubsub.googleapis.com`
  - `iam.googleapis.com`
  - `iamcredentials.googleapis.com`
- Falta instalar el componente `gcloud beta` para verificar/crear presupuestos.
- Terraform sigue sin estar instalado en PATH.
- Python disponible actual: `3.14.0`; en esta red genera `Missing Authority Key Identifier` con la CA corporativa.

Pendiente inmediato:

- Instalar Python 3.12 o 3.13, o ejecutar `gcloud` desde una red/certificado que no dispare el error TLS.
- Instalar `gcloud beta` con permisos de administrador.
- Ejecutar el bootstrap real para habilitar APIs y crear presupuesto.
- Repetir `verify-dev.ps1` hasta obtener `ready=true`.

### Soporte Dia 12 - Revalidacion final de Google Cloud

Fecha: 2026-09-02

Realizado:

- Se confirmo instalacion de Python 3.12: `Python 3.12.10`.
- Se confirmo que `gcloud` incluye el componente `beta`.
- Se ejecuto `gcloud` con `CLOUDSDK_PYTHON=C:\Python312\python.exe`.
- Se confirmo que `auth/disable_ssl_validation=false`.
- Se confirmo que `core/custom_ca_certs_file` apunta a:
  `C:\VENTA-DE-PASAJES\certs\gcloud-custom-ca-bundle.pem`.
- Se confirmo cuenta activa: `jkrivera1521@gmail.com`.
- Se confirmo proyecto activo: `project-fbb34cd7-0b82-43e1-867`.
- Se confirmo region Cloud Run: `us-central1`.
- Se confirmo billing account abierto: `012A58-73A3EE-D43B8D`.
- Se confirmo billing vinculado al proyecto.
- Se ejecuto `verify-dev.ps1` con el proyecto y billing reales.
- Se actualizo `docs\dia-12-infraestructura-google-cloud-base.md` para dejar Dia 12 como verificado.

Resultado de `verify-dev.ps1`:

```json
{"project_id":"project-fbb34cd7-0b82-43e1-867","project_number":"230270000840","active_account":"jkrivera1521@gmail.com","billing_enabled":true,"billing_account_name":"billingAccounts/012A58-73A3EE-D43B8D","enabled_api_count":34,"required_api_count":15,"missing_apis":[],"budget_checked":true,"budget_found":true,"budget_check_error":null,"ready":true}
```

Estado:

- Dia 12 queda desbloqueado y verificado.
- Se puede continuar con Dia 13.
- Terraform sigue sin estar instalado en PATH; no bloquea Dia 13 si se trabaja con `gcloud`, pero sera necesario para automatizacion IaC posterior.

## Dia 13 - IAM y cuentas de servicio

Fecha: 2026-09-02

Objetivo:

- Crear service account por microservicio.
- Crear service account para Cloud Build.
- Crear permisos minimos.
- Definir grupos administradores.
- Activar o definir control MFA para cuentas administrativas.

Realizado:

- Se reviso el plan del Dia 13 en `tareas.md`.
- Se revisaron dominios y ownership desde `docs\dia-05-definicion-dominios-microservicios.md`.
- Se revisaron convenciones desde `docs\naming-standards.md`.
- Se reviso diseno Pub/Sub para no otorgar permisos globales de Pub/Sub antes de crear topics/suscripciones.
- Se creo matriz IAM dev:
  `C:\VENTA-DE-PASAJES\infra\gcloud\iam-dev.json`.
- Se creo script de bootstrap IAM:
  `C:\VENTA-DE-PASAJES\infra\gcloud\bootstrap-iam-dev.ps1`.
- Se creo script de verificacion IAM:
  `C:\VENTA-DE-PASAJES\infra\gcloud\verify-iam-dev.ps1`.
- Se actualizo `infra\gcloud\README.md`.
- Se actualizo `infra\env\google-cloud.env.example` con variables para `gcloud`, Python y service accounts.
- Se actualizo `docs\naming-standards.md` con convencion de service accounts.
- Se creo entregable:
  `C:\VENTA-DE-PASAJES\docs\dia-13-iam-cuentas-servicio.md`.

Comandos ejecutados:

```powershell
$env:CLOUDSDK_PYTHON = "C:\Python312\python.exe"

powershell -NoProfile -ExecutionPolicy Bypass -File .\infra\gcloud\bootstrap-iam-dev.ps1 `
  -DryRun `
  -ProjectId "project-fbb34cd7-0b82-43e1-867" `
  -GcloudPath "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd"

powershell -NoProfile -ExecutionPolicy Bypass -File .\infra\gcloud\bootstrap-iam-dev.ps1 `
  -ProjectId "project-fbb34cd7-0b82-43e1-867" `
  -GcloudPath "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd"

powershell -NoProfile -ExecutionPolicy Bypass -File .\infra\gcloud\verify-iam-dev.ps1 `
  -ProjectId "project-fbb34cd7-0b82-43e1-867" `
  -GcloudPath "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd"
```

Comandos `gcloud` ejecutados por `bootstrap-iam-dev.ps1`:

```powershell
gcloud iam service-accounts create identity-service-run --project=project-fbb34cd7-0b82-43e1-867 --display-name="identity-service runtime" --description="Runtime identity for identity-service in Cloud Run dev."
gcloud iam service-accounts create dispatch-service-run --project=project-fbb34cd7-0b82-43e1-867 --display-name="dispatch-service runtime" --description="Runtime identity for dispatch-service in Cloud Run dev."
gcloud iam service-accounts create ticketing-service-run --project=project-fbb34cd7-0b82-43e1-867 --display-name="ticketing-service runtime" --description="Runtime identity for ticketing-service in Cloud Run dev."
gcloud iam service-accounts create document-service-run --project=project-fbb34cd7-0b82-43e1-867 --display-name="document-service runtime" --description="Runtime identity for document-service in Cloud Run dev."
gcloud iam service-accounts create reporting-service-run --project=project-fbb34cd7-0b82-43e1-867 --display-name="reporting-service runtime" --description="Runtime identity for reporting-service in Cloud Run dev."
gcloud iam service-accounts create audit-service-run --project=project-fbb34cd7-0b82-43e1-867 --display-name="audit-service runtime" --description="Runtime identity for audit-service in Cloud Run dev."
gcloud iam service-accounts create cloudbuild-deployer --project=project-fbb34cd7-0b82-43e1-867 --display-name="Cloud Build deployer" --description="Custom Cloud Build service account for build and Cloud Run deployment in dev."

gcloud projects add-iam-policy-binding project-fbb34cd7-0b82-43e1-867 --member=serviceAccount:identity-service-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com --role=roles/cloudsql.client --condition=None --quiet
gcloud projects add-iam-policy-binding project-fbb34cd7-0b82-43e1-867 --member=serviceAccount:identity-service-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com --role=roles/logging.logWriter --condition=None --quiet
gcloud projects add-iam-policy-binding project-fbb34cd7-0b82-43e1-867 --member=serviceAccount:identity-service-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com --role=roles/monitoring.metricWriter --condition=None --quiet
gcloud projects add-iam-policy-binding project-fbb34cd7-0b82-43e1-867 --member=serviceAccount:dispatch-service-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com --role=roles/cloudsql.client --condition=None --quiet
gcloud projects add-iam-policy-binding project-fbb34cd7-0b82-43e1-867 --member=serviceAccount:dispatch-service-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com --role=roles/logging.logWriter --condition=None --quiet
gcloud projects add-iam-policy-binding project-fbb34cd7-0b82-43e1-867 --member=serviceAccount:dispatch-service-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com --role=roles/monitoring.metricWriter --condition=None --quiet
gcloud projects add-iam-policy-binding project-fbb34cd7-0b82-43e1-867 --member=serviceAccount:ticketing-service-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com --role=roles/cloudsql.client --condition=None --quiet
gcloud projects add-iam-policy-binding project-fbb34cd7-0b82-43e1-867 --member=serviceAccount:ticketing-service-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com --role=roles/logging.logWriter --condition=None --quiet
gcloud projects add-iam-policy-binding project-fbb34cd7-0b82-43e1-867 --member=serviceAccount:ticketing-service-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com --role=roles/monitoring.metricWriter --condition=None --quiet
gcloud projects add-iam-policy-binding project-fbb34cd7-0b82-43e1-867 --member=serviceAccount:document-service-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com --role=roles/cloudsql.client --condition=None --quiet
gcloud projects add-iam-policy-binding project-fbb34cd7-0b82-43e1-867 --member=serviceAccount:document-service-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com --role=roles/logging.logWriter --condition=None --quiet
gcloud projects add-iam-policy-binding project-fbb34cd7-0b82-43e1-867 --member=serviceAccount:document-service-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com --role=roles/monitoring.metricWriter --condition=None --quiet
gcloud projects add-iam-policy-binding project-fbb34cd7-0b82-43e1-867 --member=serviceAccount:reporting-service-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com --role=roles/cloudsql.client --condition=None --quiet
gcloud projects add-iam-policy-binding project-fbb34cd7-0b82-43e1-867 --member=serviceAccount:reporting-service-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com --role=roles/logging.logWriter --condition=None --quiet
gcloud projects add-iam-policy-binding project-fbb34cd7-0b82-43e1-867 --member=serviceAccount:reporting-service-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com --role=roles/monitoring.metricWriter --condition=None --quiet
gcloud projects add-iam-policy-binding project-fbb34cd7-0b82-43e1-867 --member=serviceAccount:audit-service-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com --role=roles/cloudsql.client --condition=None --quiet
gcloud projects add-iam-policy-binding project-fbb34cd7-0b82-43e1-867 --member=serviceAccount:audit-service-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com --role=roles/logging.logWriter --condition=None --quiet
gcloud projects add-iam-policy-binding project-fbb34cd7-0b82-43e1-867 --member=serviceAccount:audit-service-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com --role=roles/monitoring.metricWriter --condition=None --quiet
gcloud projects add-iam-policy-binding project-fbb34cd7-0b82-43e1-867 --member=serviceAccount:cloudbuild-deployer@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com --role=roles/artifactregistry.writer --condition=None --quiet
gcloud projects add-iam-policy-binding project-fbb34cd7-0b82-43e1-867 --member=serviceAccount:cloudbuild-deployer@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com --role=roles/cloudbuild.builds.editor --condition=None --quiet
gcloud projects add-iam-policy-binding project-fbb34cd7-0b82-43e1-867 --member=serviceAccount:cloudbuild-deployer@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com --role=roles/logging.logWriter --condition=None --quiet
gcloud projects add-iam-policy-binding project-fbb34cd7-0b82-43e1-867 --member=serviceAccount:cloudbuild-deployer@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com --role=roles/run.admin --condition=None --quiet
gcloud projects add-iam-policy-binding project-fbb34cd7-0b82-43e1-867 --member=serviceAccount:cloudbuild-deployer@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com --role=roles/storage.admin --condition=None --quiet

gcloud iam service-accounts add-iam-policy-binding identity-service-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com --project=project-fbb34cd7-0b82-43e1-867 --member=serviceAccount:cloudbuild-deployer@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com --role=roles/iam.serviceAccountUser --quiet
gcloud iam service-accounts add-iam-policy-binding dispatch-service-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com --project=project-fbb34cd7-0b82-43e1-867 --member=serviceAccount:cloudbuild-deployer@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com --role=roles/iam.serviceAccountUser --quiet
gcloud iam service-accounts add-iam-policy-binding ticketing-service-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com --project=project-fbb34cd7-0b82-43e1-867 --member=serviceAccount:cloudbuild-deployer@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com --role=roles/iam.serviceAccountUser --quiet
gcloud iam service-accounts add-iam-policy-binding document-service-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com --project=project-fbb34cd7-0b82-43e1-867 --member=serviceAccount:cloudbuild-deployer@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com --role=roles/iam.serviceAccountUser --quiet
gcloud iam service-accounts add-iam-policy-binding reporting-service-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com --project=project-fbb34cd7-0b82-43e1-867 --member=serviceAccount:cloudbuild-deployer@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com --role=roles/iam.serviceAccountUser --quiet
gcloud iam service-accounts add-iam-policy-binding audit-service-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com --project=project-fbb34cd7-0b82-43e1-867 --member=serviceAccount:cloudbuild-deployer@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com --role=roles/iam.serviceAccountUser --quiet
```

Correccion durante ejecucion:

- El primer intento real no creo recursos porque el script trataba `NOT_FOUND` de `gcloud iam service-accounts describe` como error fatal.
- Se ajusto `bootstrap-iam-dev.ps1` para interpretar `NOT_FOUND` como cuenta inexistente y continuar con la creacion.
- Se ajusto tambien `verify-iam-dev.ps1` para manejar la lectura de politicas de service accounts de forma controlada.
- Se revalido sintaxis PowerShell despues del ajuste.

Service accounts creadas:

| Componente | Service account |
| --- | --- |
| `identity-service` | `identity-service-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com` |
| `dispatch-service` | `dispatch-service-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com` |
| `ticketing-service` | `ticketing-service-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com` |
| `document-service` | `document-service-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com` |
| `reporting-service` | `reporting-service-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com` |
| `audit-service` | `audit-service-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com` |
| Cloud Build | `cloudbuild-deployer@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com` |

Roles aplicados:

- Runtime service accounts:
  - `roles/cloudsql.client`
  - `roles/logging.logWriter`
  - `roles/monitoring.metricWriter`
- `cloudbuild-deployer`:
  - `roles/artifactregistry.writer`
  - `roles/cloudbuild.builds.editor`
  - `roles/logging.logWriter`
  - `roles/run.admin`
  - `roles/storage.admin`
- Impersonacion:
  - `cloudbuild-deployer` recibio `roles/iam.serviceAccountUser` en cada service account runtime.

Permisos aplazados por minimo privilegio:

- Secret Manager se otorgara por secreto en Dia 15.
- Pub/Sub se otorgara por topic/suscripcion en Dia 55.
- Storage para `document-service` se otorgara por bucket en Dia 56.

Validacion:

- Sintaxis PowerShell: OK.
- JSON de matriz IAM: OK.
- Bootstrap real ejecutado contra `project-fbb34cd7-0b82-43e1-867`.
- Service accounts esperadas: 7.
- Service accounts encontradas: 7.
- Project bindings faltantes: 0.
- Service account bindings faltantes: 0.
- Estado final: `ready=true`.

Resultado de `verify-iam-dev.ps1`:

```json
{"project_id":"project-fbb34cd7-0b82-43e1-867","project_number":"230270000840","matrix_path":"C:\\VENTA-DE-PASAJES\\infra\\gcloud\\iam-dev.json","service_accounts_expected":7,"service_accounts_found":7,"missing_accounts":[],"missing_project_bindings":[],"missing_service_account_bindings":[],"admin_groups_status":"defined_pending_google_workspace_or_cloud_identity","mfa_status":"manual_control_pending_or_external_to_project_iam","ready":true}
```

Estado:

- Criterio tecnico del Dia 13 cumplido: cada componente tiene identidad cloud propia.
- Grupos administradores quedaron definidos pero pendientes de Google Workspace o Cloud Identity.
- MFA queda como control externo/manual: debe confirmarse en las cuentas Google administrativas o imponerse desde Workspace/Cloud Identity si se adopta.
- No se crearon llaves JSON de service accounts.

## Dia 14 - Cloud SQL dev y bases por servicio

Fecha: 2026-09-02

Objetivo:

- Crear instancia Cloud SQL PostgreSQL dev.
- Crear `identity_db`.
- Crear `dispatch_db`.
- Crear `ticketing_db`.
- Crear `documents_db`.
- Crear `audit_db`.
- Crear usuarios de base de datos separados por servicio.

Realizado:

- Se reviso el plan del Dia 14 en `tareas.md`.
- Se reviso el diseno PostgreSQL del Dia 8 y los DDL en `docs\database`.
- Se confirmo que no existia una instancia Cloud SQL previa en el proyecto.
- Se confirmo disponibilidad del tier `db-f1-micro` en `us-central1`.
- Se creo configuracion declarativa:
  `C:\VENTA-DE-PASAJES\infra\gcloud\cloudsql-dev.json`.
- Se creo script de bootstrap Cloud SQL:
  `C:\VENTA-DE-PASAJES\infra\gcloud\bootstrap-cloudsql-dev.ps1`.
- Se creo script de verificacion Cloud SQL:
  `C:\VENTA-DE-PASAJES\infra\gcloud\verify-cloudsql-dev.ps1`.
- Se ejecuto dry-run del bootstrap Cloud SQL.
- Se creo instancia Cloud SQL:
  `venta-pasajes-dev-sql`.
- Se habilito `cloudsql.iam_authentication=on`.
- Se aplico `roles/cloudsql.instanceUser` a los runtime service accounts.
- Se crearon bases separadas por dominio:
  - `identity_db`
  - `dispatch_db`
  - `ticketing_db`
  - `documents_db`
  - `reporting_db`
  - `audit_db`
- Se crearon usuarios IAM de base de datos:
  - `identity-service-run@project-fbb34cd7-0b82-43e1-867.iam`
  - `dispatch-service-run@project-fbb34cd7-0b82-43e1-867.iam`
  - `ticketing-service-run@project-fbb34cd7-0b82-43e1-867.iam`
  - `document-service-run@project-fbb34cd7-0b82-43e1-867.iam`
  - `reporting-service-run@project-fbb34cd7-0b82-43e1-867.iam`
  - `audit-service-run@project-fbb34cd7-0b82-43e1-867.iam`
- Se actualizo `infra\gcloud\README.md`.
- Se actualizo `infra\env\google-cloud.env.example`.
- Se actualizo `infra\README.md`.
- Se actualizo `infra\gcloud\iam-dev.json` y `docs\dia-13-iam-cuentas-servicio.md` para reflejar `roles/cloudsql.instanceUser`.
- Se creo entregable:
  `C:\VENTA-DE-PASAJES\docs\dia-14-cloud-sql-dev-bases-servicio.md`.

Comandos ejecutados:

```powershell
$env:CLOUDSDK_PYTHON = "C:\Python312\python.exe"

powershell -NoProfile -ExecutionPolicy Bypass -File .\infra\gcloud\bootstrap-cloudsql-dev.ps1 `
  -DryRun `
  -ProjectId "project-fbb34cd7-0b82-43e1-867" `
  -GcloudPath "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd"

powershell -NoProfile -ExecutionPolicy Bypass -File .\infra\gcloud\bootstrap-cloudsql-dev.ps1 `
  -ProjectId "project-fbb34cd7-0b82-43e1-867" `
  -GcloudPath "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd"

powershell -NoProfile -ExecutionPolicy Bypass -File .\infra\gcloud\verify-cloudsql-dev.ps1 `
  -ProjectId "project-fbb34cd7-0b82-43e1-867" `
  -GcloudPath "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd"

powershell -NoProfile -ExecutionPolicy Bypass -File .\infra\gcloud\verify-iam-dev.ps1 `
  -ProjectId "project-fbb34cd7-0b82-43e1-867" `
  -GcloudPath "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd"
```

Comandos `gcloud` ejecutados por `bootstrap-cloudsql-dev.ps1`:

```powershell
gcloud sql instances create venta-pasajes-dev-sql --project=project-fbb34cd7-0b82-43e1-867 --database-version=POSTGRES_16 --edition=enterprise --tier=db-f1-micro --region=us-central1 --availability-type=ZONAL --storage-type=SSD --storage-size=10 --backup-start-time=08:00 --retained-backups-count=7 --storage-auto-increase --deletion-protection --database-flags=cloudsql.iam_authentication=on

gcloud projects add-iam-policy-binding project-fbb34cd7-0b82-43e1-867 --member=serviceAccount:identity-service-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com --role=roles/cloudsql.instanceUser --condition=None --quiet
gcloud projects add-iam-policy-binding project-fbb34cd7-0b82-43e1-867 --member=serviceAccount:dispatch-service-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com --role=roles/cloudsql.instanceUser --condition=None --quiet
gcloud projects add-iam-policy-binding project-fbb34cd7-0b82-43e1-867 --member=serviceAccount:ticketing-service-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com --role=roles/cloudsql.instanceUser --condition=None --quiet
gcloud projects add-iam-policy-binding project-fbb34cd7-0b82-43e1-867 --member=serviceAccount:document-service-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com --role=roles/cloudsql.instanceUser --condition=None --quiet
gcloud projects add-iam-policy-binding project-fbb34cd7-0b82-43e1-867 --member=serviceAccount:reporting-service-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com --role=roles/cloudsql.instanceUser --condition=None --quiet
gcloud projects add-iam-policy-binding project-fbb34cd7-0b82-43e1-867 --member=serviceAccount:audit-service-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com --role=roles/cloudsql.instanceUser --condition=None --quiet

gcloud sql databases create identity_db --instance=venta-pasajes-dev-sql --project=project-fbb34cd7-0b82-43e1-867
gcloud sql databases create dispatch_db --instance=venta-pasajes-dev-sql --project=project-fbb34cd7-0b82-43e1-867
gcloud sql databases create ticketing_db --instance=venta-pasajes-dev-sql --project=project-fbb34cd7-0b82-43e1-867
gcloud sql databases create documents_db --instance=venta-pasajes-dev-sql --project=project-fbb34cd7-0b82-43e1-867
gcloud sql databases create reporting_db --instance=venta-pasajes-dev-sql --project=project-fbb34cd7-0b82-43e1-867
gcloud sql databases create audit_db --instance=venta-pasajes-dev-sql --project=project-fbb34cd7-0b82-43e1-867

gcloud sql users create identity-service-run@project-fbb34cd7-0b82-43e1-867.iam --instance=venta-pasajes-dev-sql --project=project-fbb34cd7-0b82-43e1-867 --type=cloud_iam_service_account
gcloud sql users create dispatch-service-run@project-fbb34cd7-0b82-43e1-867.iam --instance=venta-pasajes-dev-sql --project=project-fbb34cd7-0b82-43e1-867 --type=cloud_iam_service_account
gcloud sql users create ticketing-service-run@project-fbb34cd7-0b82-43e1-867.iam --instance=venta-pasajes-dev-sql --project=project-fbb34cd7-0b82-43e1-867 --type=cloud_iam_service_account
gcloud sql users create document-service-run@project-fbb34cd7-0b82-43e1-867.iam --instance=venta-pasajes-dev-sql --project=project-fbb34cd7-0b82-43e1-867 --type=cloud_iam_service_account
gcloud sql users create reporting-service-run@project-fbb34cd7-0b82-43e1-867.iam --instance=venta-pasajes-dev-sql --project=project-fbb34cd7-0b82-43e1-867 --type=cloud_iam_service_account
gcloud sql users create audit-service-run@project-fbb34cd7-0b82-43e1-867.iam --instance=venta-pasajes-dev-sql --project=project-fbb34cd7-0b82-43e1-867 --type=cloud_iam_service_account
```

Configuracion de instancia:

| Elemento | Valor |
| --- | --- |
| Project ID | `project-fbb34cd7-0b82-43e1-867` |
| Instance ID | `venta-pasajes-dev-sql` |
| Connection name | `project-fbb34cd7-0b82-43e1-867:us-central1:venta-pasajes-dev-sql` |
| Version | `POSTGRES_16` |
| Edition | `ENTERPRISE` |
| Tier | `db-f1-micro` |
| Region | `us-central1` |
| Availability | `ZONAL` |
| Storage | `SSD`, 10 GB, auto-increase |
| Backups | Habilitados, 08:00 UTC, 7 respaldos |
| Deletion protection | Habilitado |

Correccion durante ejecucion:

- El primer bootstrap creo instancia y bases, pero no creo usuarios IAM porque la deteccion de existencia revisaba solo el exit code de `gcloud sql users list`.
- Se corrigio `bootstrap-cloudsql-dev.ps1` para validar la salida real del listado de usuarios.
- Se relanzo el bootstrap y se crearon los 6 usuarios IAM faltantes.

Validacion:

- JSON de configuracion: OK.
- Sintaxis PowerShell: OK.
- Instancia Cloud SQL: `RUNNABLE`.
- Bases esperadas: 6.
- Bases faltantes: 0.
- Usuarios IAM esperados: 6.
- Usuarios IAM faltantes: 0.
- Flag `cloudsql.iam_authentication=on`: OK.
- `roles/cloudsql.instanceUser`: OK.
- Revalidacion IAM posterior: `ready=true`.
- `psql` local no esta instalado en PATH.

Resultado de `verify-cloudsql-dev.ps1`:

```json
{"project_id":"project-fbb34cd7-0b82-43e1-867","instance_name":"venta-pasajes-dev-sql","connection_name":"project-fbb34cd7-0b82-43e1-867:us-central1:venta-pasajes-dev-sql","state":"RUNNABLE","database_version":"POSTGRES_16","region":"us-central1","tier":"db-f1-micro","edition":"ENTERPRISE","availability_type":"ZONAL","deletion_protection":true,"backup_enabled":true,"backup_start_time":"08:00","expected_databases":6,"missing_databases":[],"expected_iam_database_users":6,"missing_iam_database_users":[],"missing_database_flags":[],"missing_instance_user_bindings":[],"privilege_strategy":"deferred_to_service_migrations","ready":true}
```

Estado:

- Criterio del Dia 14 cumplido: existe Cloud SQL dev, bases separadas por dominio y usuarios IAM por servicio.
- No se generaron contrasenas de base ni llaves JSON.
- Privilegios finos sobre esquemas/tablas quedan diferidos a las migraciones por servicio.
- Cliente PostgreSQL o runner de migraciones queda pendiente para aplicar DDL real.
- Cloud SQL genera costo mientras esta encendido; queda controlado por presupuesto del Dia 12 y configurado en el tier minimo de prueba.

## Dia 15 - Secret Manager y configuracion segura

Fecha: 2026-09-02

Objetivo:

- Crear secretos de conexion a base.
- Crear secretos de sesion.
- Crear secretos de integracion.
- Configurar acceso por service account.
- Eliminar secretos de archivos locales.

Realizado:

- Se reviso el alcance del Dia 15 en `tareas.md`.
- Se creo catalogo declarativo de secretos:
  `C:\VENTA-DE-PASAJES\infra\gcloud\secrets-dev.json`.
- Se creo script de bootstrap Secret Manager:
  `C:\VENTA-DE-PASAJES\infra\gcloud\bootstrap-secrets-dev.ps1`.
- Se creo script de verificacion Secret Manager:
  `C:\VENTA-DE-PASAJES\infra\gcloud\verify-secrets-dev.ps1`.
- Se agrego la service account `frontend-shell-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com`.
- Se actualizo `infra\gcloud\iam-dev.json` para incluir `frontend-shell-run`.
- Se reejecuto bootstrap IAM para crear `frontend-shell-run` y permitir impersonacion desde `cloudbuild-deployer`.
- Se verifico IAM actualizado con `ready=true`.
- Se crearon 15 secretos en Secret Manager.
- Se creo una version inicial para cada secreto.
- Se asigno `roles/secretmanager.secretAccessor` por secreto, no a nivel proyecto.
- Se actualizaron plantillas de entorno para referenciar Secret Manager y no valores reales:
  - `C:\VENTA-DE-PASAJES\infra\env\backend-service.env.example`
  - `C:\VENTA-DE-PASAJES\infra\env\frontend-app.env.example`
  - `C:\VENTA-DE-PASAJES\infra\env\google-cloud.env.example`
- Se detecto y saneo `C:\VENTA-DE-PASAJES\NOTAS.txt`, que tenia un token temporal de gcloud y una password local anotada.
- Se creo entregable:
  `C:\VENTA-DE-PASAJES\docs\dia-15-secret-manager-configuracion-segura.md`.

Comandos ejecutados:

```powershell
Get-Content -LiteralPath .\infra\gcloud\secrets-dev.json -Raw | ConvertFrom-Json

$Errors = $null; [System.Management.Automation.Language.Parser]::ParseFile((Resolve-Path .\infra\gcloud\bootstrap-secrets-dev.ps1), [ref]$null, [ref]$Errors)
$Errors = $null; [System.Management.Automation.Language.Parser]::ParseFile((Resolve-Path .\infra\gcloud\verify-secrets-dev.ps1), [ref]$null, [ref]$Errors)

rg -n -i "ya29\.|PONER PASSWORD.*\(" NOTAS.txt
rg -n -i "AUTH_SESSION_SECRET=change-me|QUARKUS_DATASOURCE_PASSWORD=change-me" infra\env

$env:CLOUDSDK_PYTHON = "C:\Python312\python.exe"

powershell -NoProfile -ExecutionPolicy Bypass -File .\infra\gcloud\bootstrap-iam-dev.ps1 -DryRun -ProjectId "project-fbb34cd7-0b82-43e1-867" -GcloudPath "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd"

powershell -NoProfile -ExecutionPolicy Bypass -File .\infra\gcloud\bootstrap-iam-dev.ps1 -ProjectId "project-fbb34cd7-0b82-43e1-867" -GcloudPath "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd"

powershell -NoProfile -ExecutionPolicy Bypass -File .\infra\gcloud\verify-iam-dev.ps1 -ProjectId "project-fbb34cd7-0b82-43e1-867" -GcloudPath "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd"

powershell -NoProfile -ExecutionPolicy Bypass -File .\infra\gcloud\bootstrap-secrets-dev.ps1 -DryRun -ProjectId "project-fbb34cd7-0b82-43e1-867" -GcloudPath "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd"

powershell -NoProfile -ExecutionPolicy Bypass -File .\infra\gcloud\bootstrap-secrets-dev.ps1 -ProjectId "project-fbb34cd7-0b82-43e1-867" -GcloudPath "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd"

powershell -NoProfile -ExecutionPolicy Bypass -File .\infra\gcloud\verify-secrets-dev.ps1 -ProjectId "project-fbb34cd7-0b82-43e1-867" -GcloudPath "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd"
```

Comandos `gcloud` nuevos ejecutados para `frontend-shell-run`:

```powershell
gcloud iam service-accounts create frontend-shell-run --project=project-fbb34cd7-0b82-43e1-867 --display-name=frontend-shell runtime --description=Runtime identity for frontend-shell in Cloud Run dev.
gcloud projects add-iam-policy-binding project-fbb34cd7-0b82-43e1-867 --member=serviceAccount:frontend-shell-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com --role=roles/logging.logWriter --condition=None --quiet
gcloud projects add-iam-policy-binding project-fbb34cd7-0b82-43e1-867 --member=serviceAccount:frontend-shell-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com --role=roles/monitoring.metricWriter --condition=None --quiet
gcloud iam service-accounts add-iam-policy-binding frontend-shell-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com --project=project-fbb34cd7-0b82-43e1-867 --member=serviceAccount:cloudbuild-deployer@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com --role=roles/iam.serviceAccountUser --quiet
```

Comandos `gcloud` ejecutados por `bootstrap-secrets-dev.ps1`:

```powershell
gcloud secrets create identity-service__db-connection --project=project-fbb34cd7-0b82-43e1-867 --replication-policy=automatic --labels=app=venta-pasajes,env=dev,category=database,owner=identity-service
gcloud secrets versions add identity-service__db-connection --project=project-fbb34cd7-0b82-43e1-867 --data-file=<redacted-payload-file>
gcloud secrets add-iam-policy-binding identity-service__db-connection --project=project-fbb34cd7-0b82-43e1-867 --member=serviceAccount:identity-service-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com --role=roles/secretmanager.secretAccessor --quiet

gcloud secrets create dispatch-service__db-connection --project=project-fbb34cd7-0b82-43e1-867 --replication-policy=automatic --labels=app=venta-pasajes,env=dev,category=database,owner=dispatch-service
gcloud secrets versions add dispatch-service__db-connection --project=project-fbb34cd7-0b82-43e1-867 --data-file=<redacted-payload-file>
gcloud secrets add-iam-policy-binding dispatch-service__db-connection --project=project-fbb34cd7-0b82-43e1-867 --member=serviceAccount:dispatch-service-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com --role=roles/secretmanager.secretAccessor --quiet

gcloud secrets create ticketing-service__db-connection --project=project-fbb34cd7-0b82-43e1-867 --replication-policy=automatic --labels=app=venta-pasajes,env=dev,category=database,owner=ticketing-service
gcloud secrets versions add ticketing-service__db-connection --project=project-fbb34cd7-0b82-43e1-867 --data-file=<redacted-payload-file>
gcloud secrets add-iam-policy-binding ticketing-service__db-connection --project=project-fbb34cd7-0b82-43e1-867 --member=serviceAccount:ticketing-service-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com --role=roles/secretmanager.secretAccessor --quiet

gcloud secrets create document-service__db-connection --project=project-fbb34cd7-0b82-43e1-867 --replication-policy=automatic --labels=app=venta-pasajes,env=dev,category=database,owner=document-service
gcloud secrets versions add document-service__db-connection --project=project-fbb34cd7-0b82-43e1-867 --data-file=<redacted-payload-file>
gcloud secrets add-iam-policy-binding document-service__db-connection --project=project-fbb34cd7-0b82-43e1-867 --member=serviceAccount:document-service-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com --role=roles/secretmanager.secretAccessor --quiet

gcloud secrets create reporting-service__db-connection --project=project-fbb34cd7-0b82-43e1-867 --replication-policy=automatic --labels=app=venta-pasajes,env=dev,category=database,owner=reporting-service
gcloud secrets versions add reporting-service__db-connection --project=project-fbb34cd7-0b82-43e1-867 --data-file=<redacted-payload-file>
gcloud secrets add-iam-policy-binding reporting-service__db-connection --project=project-fbb34cd7-0b82-43e1-867 --member=serviceAccount:reporting-service-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com --role=roles/secretmanager.secretAccessor --quiet

gcloud secrets create audit-service__db-connection --project=project-fbb34cd7-0b82-43e1-867 --replication-policy=automatic --labels=app=venta-pasajes,env=dev,category=database,owner=audit-service
gcloud secrets versions add audit-service__db-connection --project=project-fbb34cd7-0b82-43e1-867 --data-file=<redacted-payload-file>
gcloud secrets add-iam-policy-binding audit-service__db-connection --project=project-fbb34cd7-0b82-43e1-867 --member=serviceAccount:audit-service-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com --role=roles/secretmanager.secretAccessor --quiet

gcloud secrets create identity-service__jwt-signing-secret --project=project-fbb34cd7-0b82-43e1-867 --replication-policy=automatic --labels=app=venta-pasajes,env=dev,category=session,owner=identity-service
gcloud secrets versions add identity-service__jwt-signing-secret --project=project-fbb34cd7-0b82-43e1-867 --data-file=<redacted-payload-file>
gcloud secrets add-iam-policy-binding identity-service__jwt-signing-secret --project=project-fbb34cd7-0b82-43e1-867 --member=serviceAccount:identity-service-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com --role=roles/secretmanager.secretAccessor --quiet

gcloud secrets create identity-service__refresh-token-pepper --project=project-fbb34cd7-0b82-43e1-867 --replication-policy=automatic --labels=app=venta-pasajes,env=dev,category=session,owner=identity-service
gcloud secrets versions add identity-service__refresh-token-pepper --project=project-fbb34cd7-0b82-43e1-867 --data-file=<redacted-payload-file>
gcloud secrets add-iam-policy-binding identity-service__refresh-token-pepper --project=project-fbb34cd7-0b82-43e1-867 --member=serviceAccount:identity-service-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com --role=roles/secretmanager.secretAccessor --quiet

gcloud secrets create identity-service__password-pepper --project=project-fbb34cd7-0b82-43e1-867 --replication-policy=automatic --labels=app=venta-pasajes,env=dev,category=session,owner=identity-service
gcloud secrets versions add identity-service__password-pepper --project=project-fbb34cd7-0b82-43e1-867 --data-file=<redacted-payload-file>
gcloud secrets add-iam-policy-binding identity-service__password-pepper --project=project-fbb34cd7-0b82-43e1-867 --member=serviceAccount:identity-service-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com --role=roles/secretmanager.secretAccessor --quiet

gcloud secrets create identity-service__recovery-token-pepper --project=project-fbb34cd7-0b82-43e1-867 --replication-policy=automatic --labels=app=venta-pasajes,env=dev,category=session,owner=identity-service
gcloud secrets versions add identity-service__recovery-token-pepper --project=project-fbb34cd7-0b82-43e1-867 --data-file=<redacted-payload-file>
gcloud secrets add-iam-policy-binding identity-service__recovery-token-pepper --project=project-fbb34cd7-0b82-43e1-867 --member=serviceAccount:identity-service-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com --role=roles/secretmanager.secretAccessor --quiet

gcloud secrets create frontend-shell__session-secret --project=project-fbb34cd7-0b82-43e1-867 --replication-policy=automatic --labels=app=venta-pasajes,env=dev,category=session,owner=frontend-shell
gcloud secrets versions add frontend-shell__session-secret --project=project-fbb34cd7-0b82-43e1-867 --data-file=<redacted-payload-file>
gcloud secrets add-iam-policy-binding frontend-shell__session-secret --project=project-fbb34cd7-0b82-43e1-867 --member=serviceAccount:frontend-shell-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com --role=roles/secretmanager.secretAccessor --quiet

gcloud secrets create identity-service__google-oauth-client-secret --project=project-fbb34cd7-0b82-43e1-867 --replication-policy=automatic --labels=app=venta-pasajes,env=dev,category=integration,owner=identity-service
gcloud secrets versions add identity-service__google-oauth-client-secret --project=project-fbb34cd7-0b82-43e1-867 --data-file=<redacted-payload-file>
gcloud secrets add-iam-policy-binding identity-service__google-oauth-client-secret --project=project-fbb34cd7-0b82-43e1-867 --member=serviceAccount:identity-service-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com --role=roles/secretmanager.secretAccessor --quiet

gcloud secrets create identity-service__email-provider-api-key --project=project-fbb34cd7-0b82-43e1-867 --replication-policy=automatic --labels=app=venta-pasajes,env=dev,category=integration,owner=identity-service
gcloud secrets versions add identity-service__email-provider-api-key --project=project-fbb34cd7-0b82-43e1-867 --data-file=<redacted-payload-file>
gcloud secrets add-iam-policy-binding identity-service__email-provider-api-key --project=project-fbb34cd7-0b82-43e1-867 --member=serviceAccount:identity-service-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com --role=roles/secretmanager.secretAccessor --quiet

gcloud secrets create ticketing-service__payment-provider-api-key --project=project-fbb34cd7-0b82-43e1-867 --replication-policy=automatic --labels=app=venta-pasajes,env=dev,category=integration,owner=ticketing-service
gcloud secrets versions add ticketing-service__payment-provider-api-key --project=project-fbb34cd7-0b82-43e1-867 --data-file=<redacted-payload-file>
gcloud secrets add-iam-policy-binding ticketing-service__payment-provider-api-key --project=project-fbb34cd7-0b82-43e1-867 --member=serviceAccount:ticketing-service-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com --role=roles/secretmanager.secretAccessor --quiet

gcloud secrets create document-service__document-signing-secret --project=project-fbb34cd7-0b82-43e1-867 --replication-policy=automatic --labels=app=venta-pasajes,env=dev,category=integration,owner=document-service
gcloud secrets versions add document-service__document-signing-secret --project=project-fbb34cd7-0b82-43e1-867 --data-file=<redacted-payload-file>
gcloud secrets add-iam-policy-binding document-service__document-signing-secret --project=project-fbb34cd7-0b82-43e1-867 --member=serviceAccount:document-service-run@project-fbb34cd7-0b82-43e1-867.iam.gserviceaccount.com --role=roles/secretmanager.secretAccessor --quiet
```

Secretos creados:

- Conexion base: `identity-service__db-connection`, `dispatch-service__db-connection`, `ticketing-service__db-connection`, `document-service__db-connection`, `reporting-service__db-connection`, `audit-service__db-connection`.
- Sesion/seguridad: `identity-service__jwt-signing-secret`, `identity-service__refresh-token-pepper`, `identity-service__password-pepper`, `identity-service__recovery-token-pepper`, `frontend-shell__session-secret`.
- Integracion: `identity-service__google-oauth-client-secret`, `identity-service__email-provider-api-key`, `ticketing-service__payment-provider-api-key`, `document-service__document-signing-secret`.

Validacion:

- JSON de secretos: OK.
- Sintaxis PowerShell: OK.
- IAM actualizado: `ready=true`.
- Secretos esperados: 15.
- Secretos encontrados: 15.
- Secretos sin version habilitada: 0.
- Bindings `secretAccessor` faltantes: 0.
- Hallazgos locales sensibles: 0.

Resultado de `verify-secrets-dev.ps1`:

```json
{"project_id":"project-fbb34cd7-0b82-43e1-867","config_path":"C:\\VENTA-DE-PASAJES\\infra\\gcloud\\secrets-dev.json","secrets_expected":15,"secrets_found":15,"missing_secrets":[],"secrets_without_enabled_version":[],"missing_accessor_bindings":[],"local_secret_findings":{},"ready":true}
```

Estado:

- Criterio del Dia 15 cumplido: las credenciales y secretos runtime no viven en codigo fuente.
- Los servicios tienen acceso solo a sus secretos.
- Los secretos de integracion marcados como placeholder deben reemplazarse/rotarse cuando se elija el proveedor real.
- No se imprimieron valores secretos en consola ni se registraron payloads en bitacora.

## Dia 16 - Plantilla estandar de microservicio Quarkus

Fecha: 2026-09-02

Objetivo:

- Crear estructura base de servicio.
- Configurar REST, persistencia, migraciones, OpenAPI, health checks y logs JSON.
- Dejar una plantilla reutilizable para crear rapidamente nuevos microservicios.

Realizado:

- Se reviso el alcance del Dia 16 en `tareas.md`.
- Se creo la plantilla:
  `C:\VENTA-DE-PASAJES\services\quarkus-service-template`.
- Se configuro Quarkus `3.25.2` con Java 21.
- Se agrego REST con `quarkus-rest-jackson`.
- Se agrego Hibernate ORM Panache y PostgreSQL JDBC.
- Se agrego Flyway con migracion inicial `V1__init_template.sql`.
- Se agrego SmallRye OpenAPI y Swagger UI.
- Se agrego SmallRye Health con liveness/readiness.
- Se agrego logging JSON configurable por entorno.
- Se creo endpoint base:
  `GET /api/v1/template/health`.
- Se creo prueba base:
  `C:\VENTA-DE-PASAJES\services\quarkus-service-template\src\test\java\com\ventapasajes\template\api\TemplateHealthResourceTest.java`.
- Se creo generador reusable:
  `C:\VENTA-DE-PASAJES\scripts\new-quarkus-service.ps1`.
- Se actualizo:
  `C:\VENTA-DE-PASAJES\services\README.md`.
- Se creo entregable:
  `C:\VENTA-DE-PASAJES\docs\dia-16-plantilla-estandar-microservicio-quarkus.md`.

Comandos ejecutados:

```powershell
$lines = Get-Content -Path tareas.md; $lines[786..807]

Get-Content -Path services\toolchain-demo-service\pom.xml
Get-Content -Path services\toolchain-demo-service\src\main\resources\application.properties
Get-Content -Path docs\dia-10-toolchain-quarkus-java.md

rg -n "health|datasource|hibernate-orm|log.console.json" services/quarkus-service-template/src/main/resources/application.properties services/quarkus-service-template/src/test/java

$Errors = $null
[System.Management.Automation.Language.Parser]::ParseFile((Resolve-Path .\scripts\new-quarkus-service.ps1), [ref]$null, [ref]$Errors)

powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\new-quarkus-service.ps1 -DryRun -ServiceName identity-service -PackageSegment identity -DatabaseName identity_db -HttpPort 8081

mvn -f .\services\quarkus-service-template\pom.xml test
mvn -f .\services\quarkus-service-template\pom.xml package -DskipTests

git status --short
```

Comando exploratorio ejecutado, con salida no archivada por higiene de configuracion local:

```powershell
mvn -f .\services\quarkus-service-template\pom.xml help:effective-pom -DskipTests
```

Incidencia corregida:

- La primera ejecucion de `mvn test` fallo porque `/q/health/ready` incluia el health check automatico del datasource y trato de conectarse a `localhost:5432`.
- Se agrego `%test.quarkus.datasource.health.enabled=false` para que la plantilla pueda probarse sin PostgreSQL local.
- Se actualizaron propiedades obsoletas:
  - `quarkus.hibernate-orm.schema-management.strategy=none`
  - `quarkus.log.console.json.enabled=...`

Validacion:

- `mvn test`: OK, `Tests run: 3, Failures: 0, Errors: 0, Skipped: 0`.
- `mvn package -DskipTests`: OK, `BUILD SUCCESS`.
- Generador `new-quarkus-service.ps1 -DryRun`: OK.
- `git status --short`: no disponible porque `C:\VENTA-DE-PASAJES` no esta inicializado como repositorio Git.

Resultado:

- Criterio del Dia 16 cumplido: los nuevos microservicios Quarkus se pueden crear desde una plantilla estandar y validar rapidamente.
- Siguiente paso natural: Dia 17, crear `identity-service` base desde la plantilla y conectarlo a `identity_db`.

## Dia 17 - identity-service base

Fecha: 2026-09-02

Objetivo:

- Crear proyecto Quarkus `identity-service`.
- Configurar base `identity_db`.
- Crear migraciones iniciales de identidad.
- Crear endpoints base y pruebas.

Realizado:

- Se reviso el alcance del Dia 17 en `tareas.md`.
- Se genero `identity-service` desde la plantilla Quarkus.
- Se corrigio el generador `new-quarkus-service.ps1` para aplicar el puerto recibido en `-HttpPort`.
- Se configuro `identity-service` con puerto local `8081`.
- Se configuro datasource base para `identity_db`.
- Se agrego Flyway con migracion:
  `C:\VENTA-DE-PASAJES\services\identity-service\src\main\resources\db\migration\V1__identity_schema.sql`.
- Se creo el modelo inicial con tablas para:
  - usuarios locales/hibridos/Google,
  - credenciales locales,
  - identidades Google,
  - perfiles internos,
  - roles,
  - permisos,
  - asignaciones rol-permiso y usuario-rol,
  - correos/dominios/sujetos Google autorizados,
  - recuperacion de contrasena,
  - intentos de login,
  - outbox de eventos.
- Se agregaron columnas para hash de contrasena, estado de usuario, intentos fallidos, bloqueo y ultimo cambio de contrasena.
- Se agregaron entidades Panache base.
- Se agregaron endpoints base en `IdentityBaseResource`.
- Los endpoints funcionales devuelven `501 NOT_IMPLEMENTED` hasta implementar la logica del Dia 18.
- Se agregaron pruebas para health, endpoints base y contrato de migracion.
- Se creo script de verificacion local:
  `C:\VENTA-DE-PASAJES\scripts\verify-identity-service-local-db.ps1`.
- Se alineo `C:\VENTA-DE-PASAJES\docs\database\identity-db.sql` con la migracion ejecutable.
- Se actualizo `C:\VENTA-DE-PASAJES\docs\dia-08-diseno-modelo-postgresql.md` para incluir `internal_profiles`.
- Se creo entregable:
  `C:\VENTA-DE-PASAJES\docs\dia-17-identity-service-base.md`.

Comandos ejecutados:

```powershell
$lines = Get-Content -Path tareas.md; $lines[807..840]

Get-ChildItem -LiteralPath services\identity-service -Force
Get-Content -Path docs\database\identity-db.sql
Get-Content -Path docs\openapi\identity-service.openapi.yaml
Get-Content -Path infra\env\backend-service.env.example

powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\new-quarkus-service.ps1 -ServiceName identity-service -PackageSegment identity -DatabaseName identity_db -HttpPort 8081

rg --files services/identity-service | sort
rg -n "perfil|profile|Usuario|usuarios|roles|permis|identity" docs/dia-03-analisis-funcional-pantallas.md docs/dia-04-analisis-base-access.md docs/dia-05-definicion-dominios-microservicios.md docs/dia-08-diseno-modelo-postgresql.md docs/database/identity-db.sql
rg -n "identity_db|identity-service-run|identity-service__db-connection|QUARKUS_HTTP_PORT" services/identity-service/src/main/resources/application.properties scripts/new-quarkus-service.ps1 infra/gcloud/secrets-dev.json

$Errors = $null
[System.Management.Automation.Language.Parser]::ParseFile((Resolve-Path .\scripts\new-quarkus-service.ps1), [ref]$null, [ref]$Errors)
[System.Management.Automation.Language.Parser]::ParseFile((Resolve-Path .\scripts\verify-identity-service-local-db.ps1), [ref]$null, [ref]$Errors)

mvn -f .\services\identity-service\pom.xml test
mvn -f .\services\identity-service\pom.xml package -DskipTests
mvn -f .\services\quarkus-service-template\pom.xml test

docker --version
docker info --format '{{json .ServerVersion}}'

powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-identity-service-local-db.ps1

rg -n "deprecated|Migrating schema|Successfully applied|identity-service .* started|Database:" services/identity-service/target/identity-service-local-db.out.log services/identity-service/target/identity-service-local-db.err.log
docker ps --filter "name=venta-pasajes-identity-pg" --format "{{.Names}} {{.Status}}"
```

Comandos internos relevantes ejecutados por `verify-identity-service-local-db.ps1`:

```powershell
docker run --rm --name venta-pasajes-identity-pg-<pid> -e POSTGRES_DB=identity_db -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=<temporary-local-password> -p 55432:5432 -d postgres:16-alpine
docker exec venta-pasajes-identity-pg-<pid> pg_isready -U postgres -d identity_db
java -jar C:\VENTA-DE-PASAJES\services\identity-service\target\quarkus-app\quarkus-run.jar
Invoke-RestMethod -Uri http://localhost:18081/q/health/ready
docker stop venta-pasajes-identity-pg-<pid>
```

Comandos `gcloud` ejecutados para verificar recursos existentes:

```powershell
$env:CLOUDSDK_PYTHON = "C:\Python312\python.exe"

& "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd" sql databases describe identity_db --instance=venta-pasajes-dev-sql --project=project-fbb34cd7-0b82-43e1-867 --format=json

& "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd" sql users list --instance=venta-pasajes-dev-sql --project=project-fbb34cd7-0b82-43e1-867 --filter="name:identity-service-run" --format=json

& "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd" secrets describe identity-service__db-connection --project=project-fbb34cd7-0b82-43e1-867 --format=json
```

Resultados relevantes:

```json
{"service":"identity-service","database":"identity_db","migration_tool":"flyway","database_port":55432,"http_port":18081,"health_ready":"UP","container":"venta-pasajes-identity-pg-<pid>","ready":true}
```

```text
Tests run: 7, Failures: 0, Errors: 0, Skipped: 0
BUILD SUCCESS
```

## Dia 23 - Tipos de bus, buses y layouts

Fecha: 2026-09-09

Objetivo ejecutado:

```text
Implementar CRUD de tipos de bus, CRUD de buses, CRUD de layouts de asientos,
validar cantidad/numeracion de asientos y preparar layout base de 25 asientos
equivalente al sistema VB6.
```

Archivos creados:

```text
C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\service\BusFleetService.java
C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\resources\db\migration\V2__dispatch_seed_legacy_25_seat_layout.sql
C:\VENTA-DE-PASAJES\services\dispatch-service\src\test\java\com\ventapasajes\dispatch\service\BusFleetServiceTest.java
C:\VENTA-DE-PASAJES\scripts\verify-dispatch-buses-layouts.ps1
C:\VENTA-DE-PASAJES\docs\dia-23-buses-layouts.md
```

Archivos creados previamente en el inicio del Dia 23 y completados en esta ejecucion:

```text
C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\BusTypeResource.java
C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\SeatLayoutResource.java
C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\BusResource.java
C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\dto\BusTypeCreateRequest.java
C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\dto\BusTypeUpdateRequest.java
C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\dto\BusTypeResponse.java
C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\dto\SeatDefinitionRequest.java
C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\dto\SeatDefinitionResponse.java
C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\dto\SeatLayoutCreateRequest.java
C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\dto\SeatLayoutUpdateRequest.java
C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\dto\SeatLayoutResponse.java
C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\dto\BusCreateRequest.java
C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\dto\BusUpdateRequest.java
C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\dto\BusResponse.java
```

Archivos modificados:

```text
C:\VENTA-DE-PASAJES\services\dispatch-service\src\test\java\com\ventapasajes\dispatch\persistence\DispatchMigrationContractTest.java
C:\VENTA-DE-PASAJES\services\dispatch-service\src\test\java\com\ventapasajes\dispatch\api\DispatchHealthResourceTest.java
C:\VENTA-DE-PASAJES\docs\openapi\dispatch-service.openapi.yaml
C:\VENTA-DE-PASAJES\services\dispatch-service\README.md
C:\VENTA-DE-PASAJES\vitacora.md
```

Comandos de inspeccion ejecutados:

```powershell
Get-ChildItem .\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\dto | Select-Object Name,Length,LastWriteTime | Sort-Object Name | Format-Table -AutoSize
Get-ChildItem .\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api | Select-Object Name,Length,LastWriteTime | Sort-Object Name | Format-Table -AutoSize
Get-ChildItem .\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\service | Select-Object Name,Length,LastWriteTime | Sort-Object Name | Format-Table -AutoSize
git status --short
Get-Content .\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\BusResource.java
Get-Content .\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\BusTypeResource.java
Get-Content .\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\SeatLayoutResource.java
Get-Content .\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\service\TerminalRouteService.java
Get-Content .\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\dto\BusTypeCreateRequest.java
Get-Content .\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\dto\SeatLayoutCreateRequest.java
Get-Content .\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\dto\BusCreateRequest.java
Get-Content .\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\persistence\entity\Bus.java
Get-Content .\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\persistence\entity\SeatLayoutSeat.java
Get-Content .\services\dispatch-service\src\main\resources\db\migration\V1__dispatch_schema.sql
Get-Content .\services\dispatch-service\pom.xml
Get-Content .\scripts\verify-dispatch-terminals-routes.ps1
Get-Content .\docs\estandar-documentacion-dias.md
Select-String -Path .\tareas.md -Pattern "Dia 23|Dia 24|Tipos de bus" -Context 0,20
Get-Content .\vitacora.md -Tail 40
```

Resultado de inspeccion:

```text
No hay repositorio Git inicializado en C:\VENTA-DE-PASAJES.
Los DTOs y resources creados para Dia 23 existian, pero faltaba BusFleetService.
La migracion V1 ya contenia tablas bus_types, seat_layouts, seat_layout_seats y buses.
Se identifico el formulario legacy C:\VENTA-DE-PASAJES\legacy\AsientosForm.frm como fuente del layout fijo de 25 asientos.
```

Comandos de compilacion y pruebas ejecutados:

```powershell
mvn -f .\services\dispatch-service\pom.xml test
mvn -f .\services\dispatch-service\pom.xml package -DskipTests "-Dquarkus.package.output-directory=quarkus-app-day23"
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-dispatch-buses-layouts.ps1 -DatabasePort 55438 -HttpPort 18086
```

Resultado de pruebas unitarias:

```text
Tests run: 19, Failures: 0, Errors: 0, Skipped: 0
BUILD SUCCESS
```

Resultado del empaquetado JVM:

```text
BUILD SUCCESS
Artefacto generado:
C:\VENTA-DE-PASAJES\services\dispatch-service\target\quarkus-app-day23\quarkus-run.jar
```

Resultado de validacion automatica:

```json
{"service":"dispatch-service","validation":"buses-layouts-crud","quarkus_profile":"onprem","secrets_provider":"env","database":"dispatch_db","database_port":55438,"http_port":18086,"jar":"C:\\VENTA-DE-PASAJES\\services\\dispatch-service\\target\\quarkus-app-day23\\quarkus-run.jar","seed_layout":"Legacy 25 asientos","seed_seats":25,"created_bus_type":"<uuid-generado>","created_bus":"<uuid-generado>","inactive_buses":1,"audit_events":11,"invalid_layout_status":400,"duplicate_bus_type_status":409,"duplicate_bus_status":409,"layout_in_use_status":409,"ready":true}
```

Comandos importantes ejecutados dentro de `verify-dispatch-buses-layouts.ps1`:

```powershell
docker run --rm --name $ContainerName `
  -e POSTGRES_DB=dispatch_db `
  -e POSTGRES_USER=postgres `
  -e "POSTGRES_PASSWORD=<temporary-local-password>" `
  -p "$DatabasePort`:5432" `
  -d postgres:16-alpine

docker exec $ContainerName pg_isready -U postgres -d dispatch_db

$env:QUARKUS_PROFILE = "onprem"
$env:QUARKUS_HTTP_PORT = [string]$HttpPort
$env:APP_ENV = "local"
$env:APP_RUNTIME_TARGET = "onprem"
$env:APP_SECRETS_PROVIDER = "env"
$env:APP_DB_NAME = "dispatch_db"
$env:APP_DB_JDBC_URL = "jdbc:postgresql://localhost:$DatabasePort/dispatch_db"
$env:APP_DB_USERNAME = "postgres"
$env:APP_DB_PASSWORD = "<temporary-local-password>"
$env:QUARKUS_FLYWAY_MIGRATE_AT_START = "true"
$env:APP_LOG_CONSOLE_JSON = "false"

Start-Process `
  -FilePath "java" `
  -ArgumentList @("-jar", $ResolvedJarPath) `
  -RedirectStandardOutput $StdOutPath `
  -RedirectStandardError $StdErrPath `
  -WindowStyle Hidden `
  -PassThru

Invoke-RestMethod -Uri "http://localhost:$HttpPort/q/health/ready" -TimeoutSec 3
Invoke-RestMethod -Uri "http://localhost:$HttpPort/api/v1/dispatch/seat-layouts?q=Legacy%2025%20asientos&active=true&page=1&page_size=10" -Method Get
Invoke-RestMethod -Uri "http://localhost:$HttpPort/api/v1/dispatch/seat-layouts" -Method Post
Invoke-RestMethod -Uri "http://localhost:$HttpPort/api/v1/dispatch/bus-types" -Method Post
Invoke-RestMethod -Uri "http://localhost:$HttpPort/api/v1/dispatch/terminals" -Method Post
Invoke-RestMethod -Uri "http://localhost:$HttpPort/api/v1/dispatch/buses" -Method Post
Invoke-RestMethod -Uri "http://localhost:$HttpPort/api/v1/dispatch/buses/<bus-id>" -Method Patch
Invoke-RestMethod -Uri "http://localhost:$HttpPort/api/v1/dispatch/buses/<bus-id>" -Method Delete

docker exec -e "PGPASSWORD=<temporary-local-password>" $ContainerName `
  psql -U postgres -d dispatch_db -tAc "select count(*) from outbox_events where event_type in ('BUS_TYPE_CREATED','BUS_TYPE_UPDATED','BUS_TYPE_DEACTIVATED','SEAT_LAYOUT_CREATED','SEAT_LAYOUT_UPDATED','SEAT_LAYOUT_DEACTIVATED','BUS_CREATED','BUS_UPDATED','BUS_DEACTIVATED','TERMINAL_CREATED','TERMINAL_DEACTIVATED');"

Stop-Process -Id $AppProcess.Id -Force
docker stop $ContainerName
```

Peticiones HTTP/HTTPS agregadas a la documentacion:

```powershell
curl.exe -sS -X GET "$baseUrl/seat-layouts?q=Legacy%2025%20asientos&active=true&page=1&page_size=10"
curl.exe -sS -X GET "$baseUrl/seat-layouts/$seedLayoutId"
curl.exe -i -S -X POST "$baseUrl/seat-layouts" -H "Content-Type: application/json" --data-binary "@$invalidLayoutBodyPath"
curl.exe -sS -X POST "$baseUrl/seat-layouts" -H "Content-Type: application/json" --data-binary "@$layoutBodyPath"
curl.exe -sS -X PATCH "$baseUrl/seat-layouts/$($customLayout.id)" -H "Content-Type: application/json" --data-binary "@$updateLayoutBodyPath"
curl.exe -i -S -X DELETE "$baseUrl/seat-layouts/$($customLayout.id)"
curl.exe -sS -X POST "$baseUrl/bus-types" -H "Content-Type: application/json" --data-binary "@$busTypeBodyPath"
curl.exe -i -S -X POST "$baseUrl/bus-types" -H "Content-Type: application/json" --data-binary "@$duplicateBusTypeBodyPath"
curl.exe -sS -X PATCH "$baseUrl/bus-types/$($busType.id)" -H "Content-Type: application/json" --data-binary "@$updateBusTypeBodyPath"
curl.exe -sS -X POST "$baseUrl/terminals" -H "Content-Type: application/json" --data-binary "@$terminalBodyPath"
curl.exe -sS -X POST "$baseUrl/buses" -H "Content-Type: application/json" --data-binary "@$busBodyPath"
curl.exe -sS -X GET "$baseUrl/buses?page=1&page_size=10"
curl.exe -sS -X GET "$baseUrl/buses?q=PBD-2301&active=true&page=1&page_size=10"
curl.exe -sS -X GET "$baseUrl/buses/$($bus.id)"
curl.exe -i -S -X POST "$baseUrl/buses" -H "Content-Type: application/json" --data-binary "@$duplicateBusBodyPath"
curl.exe -sS -X PATCH "$baseUrl/buses/$($bus.id)" -H "Content-Type: application/json" --data-binary "@$updateBusBodyPath"
curl.exe -i -S -X PATCH "$baseUrl/seat-layouts/$seedLayoutId" -H "Content-Type: application/json" --data-binary "@$layoutInUseBodyPath"
curl.exe -i -S -X DELETE "$baseUrl/seat-layouts/$seedLayoutId"
curl.exe -i -S -X DELETE "$baseUrl/buses/$($bus.id)"
curl.exe -i -S -X DELETE "$baseUrl/bus-types/$($busType.id)"
curl.exe -i -S -X DELETE "$baseUrl/terminals/$($terminal.id)"
curl.exe -sS "http://localhost:$httpPort/q/openapi"
```

Comandos SQL agregados a la documentacion:

```powershell
docker exec -e PGPASSWORD=$pgPassword $container psql -U postgres -d dispatch_db -c "\dt"
docker exec -e PGPASSWORD=$pgPassword $container psql -U postgres -d dispatch_db -c "select id, name, seat_count, active from seat_layouts order by name;"
docker exec -e PGPASSWORD=$pgPassword $container psql -U postgres -d dispatch_db -c "select seat_number, label, row_number, column_number, position from seat_layout_seats where seat_layout_id = '00000000-0000-0000-0000-000000000025' order by seat_number;"
docker exec -e PGPASSWORD=$pgPassword $container psql -U postgres -d dispatch_db -tAc "select count(*) from buses;"
docker exec -e PGPASSWORD=$pgPassword $container psql -U postgres -d dispatch_db -c "select event_type, resource_type, status, occurred_at from outbox_events order by occurred_at;"
```

Problemas encontrados y decisiones:

```text
Se uso el puerto HTTP 18086 y PostgreSQL 55438 para no interferir con pruebas manuales previas.
Se empaqueto en target\quarkus-app-day23 para evitar bloqueos de Windows sobre target\quarkus-app.
Se documento el patron robusto de curl.exe con archivo temporal y --data-binary.
El layout Legacy 25 asientos se dejo como seed Flyway idempotente con ON CONFLICT.
```

Estado:

```text
Dia 23 completado.
El sistema puede modelar buses sin botones fijos.
Siguiente paso: Dia 24 - Salidas programadas.
```

## Verificacion final Dia 23

Comandos ejecutados despues de actualizar documentacion:

```powershell
mvn -f .\services\dispatch-service\pom.xml test
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-dispatch-buses-layouts.ps1 -DatabasePort 55438 -HttpPort 18086
Get-NetTCPConnection -LocalPort 18086,55438 -ErrorAction SilentlyContinue | Select-Object LocalAddress,LocalPort,State,OwningProcess | Format-Table -AutoSize
docker ps -a --filter "name=venta-pasajes-dispatch-buses-layouts" --format "{{.Names}}"
Test-Path .\services\dispatch-service\target\quarkus-app-day23\quarkus-run.jar
```

Resultado:

```text
Maven test: Tests run: 19, Failures: 0, Errors: 0, Skipped: 0, BUILD SUCCESS.
Validacion automatica: ready=true, seed_seats=25, audit_events=11.
No quedaron listeners en 18086 ni 55438.
No quedaron contenedores temporales venta-pasajes-dispatch-buses-layouts.
Existe target\quarkus-app-day23\quarkus-run.jar: True.
```

## Cierre cronologico final Dia 24 - Salidas programadas

Fecha: 2026-09-10

Resumen:

```text
Se completo el Dia 24 con CRUD de salidas programadas en dispatch-service.
Las salidas quedan asociadas a ruta y bus.
El servicio valida fecha futura y evita que el mismo bus tenga salidas duplicadas en el mismo horario.
Al crear una salida se registra el evento DepartureScheduled en outbox_events.
```

Comandos finales ejecutados:

```powershell
mvn -f .\services\dispatch-service\pom.xml test
mvn -f .\services\dispatch-service\pom.xml package -DskipTests "-Dquarkus.package.output-directory=quarkus-app-day24"
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-dispatch-departures.ps1 -DatabasePort 55439 -HttpPort 18087
Get-NetTCPConnection -LocalPort 18087,55439 -ErrorAction SilentlyContinue | Select-Object LocalAddress,LocalPort,State,OwningProcess | Format-Table -AutoSize
docker ps -a --filter "name=venta-pasajes-dispatch-departures" --format "{{.Names}}"
Test-Path .\services\dispatch-service\target\quarkus-app-day24\quarkus-run.jar
```

Resultado final:

```text
Pruebas Maven: Tests run: 24, Failures: 0, Errors: 0, Skipped: 0, BUILD SUCCESS.
Empaquetado: BUILD SUCCESS.
Validacion Docker/PostgreSQL: ready=true, created_departures=2, cancelled_departures=2, departure_scheduled_events=2, departure_events=5, duplicate_schedule_status=409, past_departure_status=400, delete_cancels=true.
No quedaron listeners en 18087 ni 55439.
No quedaron contenedores temporales venta-pasajes-dispatch-departures.
Existe target\quarkus-app-day24\quarkus-run.jar: True.
Guia manual completa: C:\VENTA-DE-PASAJES\docs\dia-24-salidas-programadas.md.
```

## Cierre cronologico Dia 25 - mfe-dispatch

Fecha: 2026-09-10

Resumen final del avance:

```text
Se completo el Dia 25.
Se creo `mfe-dispatch` como microfrontend Next.js independiente.
El shell ahora puede navegar entre `mfe-identity` y `mfe-dispatch`.
El MFE de despacho administra terminales, rutas, tipos de bus, buses, layouts y salidas.
El MFE se comunica con `dispatch-service` mediante proxy local `/api/dispatch/*`.
```

Archivos principales creados:

```text
C:\VENTA-DE-PASAJES\apps\mfe-dispatch\package.json
C:\VENTA-DE-PASAJES\apps\mfe-dispatch\tsconfig.json
C:\VENTA-DE-PASAJES\apps\mfe-dispatch\next-env.d.ts
C:\VENTA-DE-PASAJES\apps\mfe-dispatch\next.config.ts
C:\VENTA-DE-PASAJES\apps\mfe-dispatch\.env.example
C:\VENTA-DE-PASAJES\apps\mfe-dispatch\app\layout.tsx
C:\VENTA-DE-PASAJES\apps\mfe-dispatch\app\page.tsx
C:\VENTA-DE-PASAJES\apps\mfe-dispatch\app\globals.css
C:\VENTA-DE-PASAJES\apps\mfe-dispatch\app\api\health\route.ts
C:\VENTA-DE-PASAJES\apps\mfe-dispatch\app\api\dispatch\[...path]\route.ts
C:\VENTA-DE-PASAJES\apps\mfe-dispatch\app\dispatch\embedded\page.tsx
C:\VENTA-DE-PASAJES\apps\mfe-dispatch\app\mfe\manifest\route.ts
C:\VENTA-DE-PASAJES\scripts\verify-mfe-dispatch.ps1
C:\VENTA-DE-PASAJES\scripts\verify-mfe-dispatch-stack.ps1
C:\VENTA-DE-PASAJES\docs\dia-25-mfe-dispatch.md
```

Archivos principales modificados:

```text
C:\VENTA-DE-PASAJES\package.json
C:\VENTA-DE-PASAJES\package-lock.json
C:\VENTA-DE-PASAJES\scripts\start-frontend-dev.ps1
C:\VENTA-DE-PASAJES\scripts\stop-frontend-dev.ps1
C:\VENTA-DE-PASAJES\apps\frontend-shell\.env.example
C:\VENTA-DE-PASAJES\apps\frontend-shell\app\page.tsx
C:\VENTA-DE-PASAJES\apps\frontend-shell\app\components\RemoteMfeFrame.tsx
C:\VENTA-DE-PASAJES\apps\frontend-shell\app\globals.css
C:\VENTA-DE-PASAJES\apps\README.md
C:\VENTA-DE-PASAJES\vitacora.md
```

Comandos de revision ejecutados:

```powershell
Select-String -Path .\tareas.md -Pattern "Dia 25|mfe-dispatch" -Context 0,28
Get-ChildItem -Recurse -Depth 3 .\apps
Get-ChildItem -Recurse -Depth 3 .\packages
Get-Content .\package.json
Get-Content .\scripts\start-frontend-dev.ps1
Get-Content .\scripts\stop-frontend-dev.ps1
Get-Content .\apps\frontend-shell\package.json
Get-Content .\apps\frontend-shell\app\page.tsx
Get-Content .\apps\frontend-shell\app\components\RemoteMfeFrame.tsx
Get-Content .\apps\mfe-identity\package.json
Get-Content .\apps\mfe-identity\app\mfe\manifest\route.ts
Get-Content -LiteralPath '.\apps\mfe-identity\app\api\identity\[...path]\route.ts'
Get-Content .\services\dispatch-service\src\main\resources\application.properties
Get-Content .\docs\openapi\dispatch-service.openapi.yaml
Get-Content .\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\dto\TerminalResponse.java
Get-Content .\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\dto\RouteResponse.java
Get-Content .\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\dto\BusResponse.java
Get-Content .\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\dto\DepartureResponse.java
```

Comandos de implementacion ejecutados:

```powershell
New-Item -ItemType Directory -Force -Path .\apps\mfe-dispatch\app\api\dispatch\[...path], .\apps\mfe-dispatch\app\api\health, .\apps\mfe-dispatch\app\dispatch\embedded, .\apps\mfe-dispatch\app\mfe\manifest
npm install
```

Comandos de validacion ejecutados:

```powershell
$Errors = $null; [System.Management.Automation.Language.Parser]::ParseFile((Resolve-Path .\scripts\verify-mfe-dispatch.ps1), [ref]$null, [ref]$Errors) | Out-Null; if ($Errors.Count -gt 0) { $Errors | Format-List; exit 1 } else { 'verify-mfe-dispatch.ps1 -> OK' }
$Errors = $null; [System.Management.Automation.Language.Parser]::ParseFile((Resolve-Path .\scripts\verify-mfe-dispatch-stack.ps1), [ref]$null, [ref]$Errors) | Out-Null; if ($Errors.Count -gt 0) { $Errors | Format-List; exit 1 } else { 'verify-mfe-dispatch-stack.ps1 -> OK' }
Select-String -Path .\docs\dia-25-mfe-dispatch.md -Pattern "# Dia 25|## Reversa primero|## Guia manual desde cero|## Peticiones HTTP/HTTPS listas con curl.exe|## Estado final"
npm run typecheck:frontend
npm run build:frontend
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-mfe-dispatch.ps1 -ShellPort 3010 -MfeDispatchPort 3012
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-mfe-dispatch-stack.ps1 -DatabasePort 55440 -DispatchHttpPort 18088 -ShellPort 3010 -MfeDispatchPort 3012
Get-NetTCPConnection -LocalPort 3010,3012,18088,55440,3000,3001,3002 -ErrorAction SilentlyContinue | Select-Object LocalAddress,LocalPort,State,OwningProcess | Format-Table -AutoSize
docker ps -a --filter "name=venta-pasajes-mfe-dispatch" --format "{{.Names}}"
Test-Path .\apps\mfe-dispatch\.next\standalone
Test-Path .\apps\frontend-shell\.next\standalone
```

Comandos internos relevantes ejecutados por los scripts:

```powershell
Start-Process -FilePath "npm.cmd" -ArgumentList @("run", "dev", "--", "--hostname", "127.0.0.1", "-p", "3012") -WorkingDirectory "C:\VENTA-DE-PASAJES\apps\mfe-dispatch" -WindowStyle Hidden -PassThru
Start-Process -FilePath "npm.cmd" -ArgumentList @("run", "dev", "--", "--hostname", "127.0.0.1", "-p", "3010") -WorkingDirectory "C:\VENTA-DE-PASAJES\apps\frontend-shell" -WindowStyle Hidden -PassThru
Invoke-RestMethod -Uri "http://localhost:3012/api/health" -TimeoutSec 10
Invoke-RestMethod -Uri "http://localhost:3012/mfe/manifest" -TimeoutSec 10
Invoke-WebRequest -Uri "http://localhost:3012/dispatch/embedded" -UseBasicParsing -TimeoutSec 5
Invoke-WebRequest -Uri "http://localhost:3010/" -UseBasicParsing -TimeoutSec 5
Invoke-WebRequest -Uri "http://localhost:3012/api/dispatch/health" -UseBasicParsing -TimeoutSec 5
docker run --rm --name venta-pasajes-mfe-dispatch-pg-<pid> -e POSTGRES_DB=dispatch_db -e POSTGRES_USER=postgres -e "POSTGRES_PASSWORD=<temporary-local-password>" -p "55440:5432" -d postgres:16-alpine
docker exec venta-pasajes-mfe-dispatch-pg-<pid> pg_isready -U postgres -d dispatch_db
Start-Process -FilePath "java" -ArgumentList @("-jar", "C:\VENTA-DE-PASAJES\services\dispatch-service\target\quarkus-app-day24\quarkus-run.jar") -WindowStyle Hidden -PassThru
Stop-Process -Id <process-id> -Force
docker stop venta-pasajes-mfe-dispatch-pg-<pid>
```

Resultado de validacion:

```text
PowerShell parse: verify-mfe-dispatch.ps1 -> OK.
PowerShell parse: verify-mfe-dispatch-stack.ps1 -> OK.
Typecheck frontend: OK.
Build frontend: OK.
Validacion aislada: shell_status=200, embedded_status=200, backend_proxy_status=502, ready=true.
Validacion integrada: shell_status=200, embedded_status=200, backend_proxy_status=200, ready=true.
No quedaron listeners en 3010, 3012, 18088, 55440, 3000, 3001 ni 3002.
No quedaron contenedores temporales venta-pasajes-mfe-dispatch.
Existe apps\mfe-dispatch\.next\standalone: True.
Existe apps\frontend-shell\.next\standalone: True.
```

Documentacion generada:

```text
C:\VENTA-DE-PASAJES\docs\dia-25-mfe-dispatch.md contiene reversa primero, guia manual desde cero, peticiones curl.exe, validacion aislada e integrada, problemas encontrados y estado final.
```

## Cierre cronologico Dia 24 - Salidas programadas

Fecha: 2026-09-10

Resumen final del avance:

```text
Se completo el Dia 24.
Se implemento el CRUD de salidas programadas en dispatch-service.
Cada salida queda asociada a ruta y bus.
Se valida fecha futura y conflicto de bus en el mismo horario.
Al programar una salida se registra el evento DepartureScheduled en outbox_events.
```

Archivos principales creados:

```text
C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\DepartureResource.java
C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\service\DepartureScheduleService.java
C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\dto\DepartureCreateRequest.java
C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\dto\DepartureUpdateRequest.java
C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\dto\DepartureCancelRequest.java
C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\dto\DepartureResponse.java
C:\VENTA-DE-PASAJES\services\dispatch-service\src\test\java\com\ventapasajes\dispatch\service\DepartureScheduleServiceTest.java
C:\VENTA-DE-PASAJES\scripts\verify-dispatch-departures.ps1
C:\VENTA-DE-PASAJES\docs\dia-24-salidas-programadas.md
```

Archivos principales modificados:

```text
C:\VENTA-DE-PASAJES\services\dispatch-service\src\test\java\com\ventapasajes\dispatch\api\DispatchHealthResourceTest.java
C:\VENTA-DE-PASAJES\docs\openapi\dispatch-service.openapi.yaml
C:\VENTA-DE-PASAJES\services\dispatch-service\README.md
C:\VENTA-DE-PASAJES\vitacora.md
```

Comandos de revision ejecutados:

```powershell
Select-String -Path .\tareas.md -Pattern "Dia 24|Salidas programadas" -Context 0,22
Get-Content .\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\model\Departure.java
Get-Content .\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\model\DepartureStatus.java
Get-Content .\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\model\DispatchRoute.java
Get-ChildItem .\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\dto
Select-String -Path .\docs\openapi\dispatch-service.openapi.yaml -Pattern "/departures|UpdateDepartureRequest|CancelDepartureRequest|DepartureScheduled"
```

Comandos de prueba y empaquetado ejecutados:

```powershell
mvn -f .\services\dispatch-service\pom.xml test
mvn -f .\services\dispatch-service\pom.xml package -DskipTests "-Dquarkus.package.output-directory=quarkus-app-day24"
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-dispatch-departures.ps1 -DatabasePort 55439 -HttpPort 18087
Get-NetTCPConnection -LocalPort 18087,55439 -ErrorAction SilentlyContinue | Select-Object LocalAddress,LocalPort,State,OwningProcess | Format-Table -AutoSize
docker ps -a --filter "name=venta-pasajes-dispatch-departures" --format "{{.Names}}"
Test-Path .\services\dispatch-service\target\quarkus-app-day24\quarkus-run.jar
```

Comandos internos relevantes ejecutados por el script de validacion:

```powershell
docker run --rm --name venta-pasajes-dispatch-departures-pg-<pid> -e POSTGRES_DB=dispatch_db -e POSTGRES_USER=postgres -e "POSTGRES_PASSWORD=<temporary-local-password>" -p "55439:5432" -d postgres:16-alpine
docker exec venta-pasajes-dispatch-departures-pg-<pid> pg_isready -U postgres -d dispatch_db
Start-Process -FilePath "java" -ArgumentList @("-jar", "C:\VENTA-DE-PASAJES\services\dispatch-service\target\quarkus-app-day24\quarkus-run.jar") -WindowStyle Hidden -PassThru
curl.exe -sS -X GET "http://localhost:18087/q/health/ready"
Invoke-RestMethod -Method Get -Uri "http://localhost:18087/api/v1/dispatch/seat-layouts?q=Legacy%2025%20asientos&active=true&page=1&page_size=10"
Invoke-RestMethod -Method Post -Uri "http://localhost:18087/api/v1/dispatch/terminals" -Body <json-terminal-origen>
Invoke-RestMethod -Method Post -Uri "http://localhost:18087/api/v1/dispatch/terminals" -Body <json-terminal-destino>
Invoke-RestMethod -Method Post -Uri "http://localhost:18087/api/v1/dispatch/routes" -Body <json-ruta>
Invoke-RestMethod -Method Post -Uri "http://localhost:18087/api/v1/dispatch/bus-types" -Body <json-tipo-bus>
Invoke-RestMethod -Method Post -Uri "http://localhost:18087/api/v1/dispatch/buses" -Body <json-bus>
Invoke-RestMethod -Method Post -Uri "http://localhost:18087/api/v1/dispatch/departures" -Body <json-salida>
Invoke-WebRequest -Method Post -Uri "http://localhost:18087/api/v1/dispatch/departures" -Body <json-salida-duplicada>
Invoke-WebRequest -Method Post -Uri "http://localhost:18087/api/v1/dispatch/departures" -Body <json-salida-en-pasado>
Invoke-RestMethod -Method Patch -Uri "http://localhost:18087/api/v1/dispatch/departures/<departure-id>" -Body <json-actualizacion>
Invoke-RestMethod -Method Post -Uri "http://localhost:18087/api/v1/dispatch/departures/<departure-id>/cancel" -Body <json-cancelacion>
Invoke-WebRequest -Method Delete -Uri "http://localhost:18087/api/v1/dispatch/departures/<departure-id>"
docker exec -e "PGPASSWORD=<temporary-local-password>" venta-pasajes-dispatch-departures-pg-<pid> psql -U postgres -d dispatch_db -tAc "select count(*) from departures;"
docker exec -e "PGPASSWORD=<temporary-local-password>" venta-pasajes-dispatch-departures-pg-<pid> psql -U postgres -d dispatch_db -tAc "select count(*) from outbox_events where event_type = 'DepartureScheduled';"
Stop-Process -Id <java-process-id> -Force
docker stop venta-pasajes-dispatch-departures-pg-<pid>
```

Resultado de pruebas Maven:

```text
Tests run: 24, Failures: 0, Errors: 0, Skipped: 0
BUILD SUCCESS
```

Resultado de empaquetado:

```text
BUILD SUCCESS
Artefacto generado: C:\VENTA-DE-PASAJES\services\dispatch-service\target\quarkus-app-day24\quarkus-run.jar
```

Resultado de validacion Docker/PostgreSQL:

```json
{
  "service": "dispatch-service",
  "validation": "departures-crud",
  "quarkus_profile": "onprem",
  "secrets_provider": "env",
  "database": "dispatch_db",
  "database_port": 55439,
  "http_port": 18087,
  "created_departures": 2,
  "cancelled_departures": 2,
  "departure_scheduled_events": 2,
  "departure_events": 5,
  "duplicate_schedule_status": 409,
  "past_departure_status": 400,
  "delete_cancels": true,
  "ready": true
}
```

Estado final:

```text
No quedaron listeners en 18087 ni 55439.
No quedaron contenedores temporales venta-pasajes-dispatch-departures.
Existe target\quarkus-app-day24\quarkus-run.jar: True.
La guia manual completa quedo en docs\dia-24-salidas-programadas.md.
```

## Diagnostico Dia 22 - HTTP 500 al crear terminal con curl.exe

Motivo:

```text
El usuario ejecuto el patron robusto con archivo JSON y `curl.exe --data-binary`.
La respuesta cambio a `HTTP/1.1 500 Internal Server Error`.
Esto confirma que el JSON ya se esta enviando al servicio, pero el backend falla internamente.
```

Comandos ejecutados:

```powershell
Get-Content .\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\service\TerminalRouteService.java
Get-Content .\services\dispatch-service\src\main\resources\db\migration\V1__dispatch_schema.sql
Get-Content .\services\dispatch-service\target\dispatch-service-terminals-routes.err.log -Tail 120 -ErrorAction SilentlyContinue
docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Ports}}"
curl.exe -i -S "http://localhost:18085/q/health/ready"
Get-NetTCPConnection -LocalPort 18085 -ErrorAction SilentlyContinue | Select-Object LocalAddress,LocalPort,State,OwningProcess | Format-Table -AutoSize
Get-CimInstance Win32_Process -Filter "name = 'java.exe'" | Select-Object ProcessId,CommandLine | Format-List
docker exec venta-pasajes-dispatch-crud-manual printenv POSTGRES_PASSWORD
docker exec -e PGPASSWORD=<redacted> venta-pasajes-dispatch-crud-manual psql -U postgres -d dispatch_db -c "select table_schema, table_name from information_schema.tables where table_schema='public' order by table_name;"
Get-ChildItem Env:APP_DB_USERNAME,Env:APP_DB_PASSWORD,Env:APP_DB_JDBC_URL,Env:QUARKUS_PROFILE,Env:QUARKUS_HTTP_PORT,Env:QUARKUS_FLYWAY_MIGRATE_AT_START -ErrorAction SilentlyContinue | Select-Object Name,Value | Format-Table -AutoSize
```

Resultado:

```text
El servicio en `http://localhost:18085` esta vivo, pero `/q/health/ready` devolvio 503.
El detalle fue `Database connections health check DOWN`.
La causa reportada por Quarkus fue `password authentication failed for user "postgres"`.
En la consola actual no existen variables `APP_DB_*` ni `QUARKUS_PROFILE` definidas.
La base `dispatch_db` del contenedor manual no tiene tablas publicas todavia.
```

Correccion documentada:

```text
Se agrego en `C:\VENTA-DE-PASAJES\docs\dia-22-terminales-rutas.md` una seccion para diagnosticar HTTP 500.
La guia ahora indica revisar `/q/health/ready`, detener el proceso de `18085` si quedo con variables viejas, configurar `APP_DB_JDBC_URL`, `APP_DB_USERNAME`, `APP_DB_PASSWORD` y `QUARKUS_FLYWAY_MIGRATE_AT_START=true`, y levantar nuevamente el servicio.
```

```text
Database: jdbc:postgresql://localhost:55432/identity_db (PostgreSQL 16.15)
Migrating schema "public" to version "1 - identity schema"
Successfully applied 1 migration to schema "public", now at version v1
```

Validacion:

- `identity-service` generado: OK.
- Configuracion de `identity_db`: OK.
- Migracion inicial de identidad: OK.
- Entidades Panache base: OK.
- Endpoints base: OK.
- Tests: OK, 7 pruebas pasadas.
- Package JVM: OK.
- Verificacion local con PostgreSQL temporal: OK, `ready=true`.
- Docker temporal detenido: OK.
- Cloud SQL `identity_db`: existe.
- Usuario IAM de Cloud SQL para `identity-service`: existe.
- Secreto `identity-service__db-connection`: existe.

Nota:

- La migracion fue aplicada y validada en PostgreSQL local temporal.
- No se aplico el DDL sobre Cloud SQL dev en este dia porque aun no existe un runner/rol de migracion con privilegios de esquema definido.

Estado:

- Criterio del Dia 17 cumplido: el servicio de identidad existe, compila, corre en modo JVM local, aplica migraciones sobre `identity_db` local temporal y expone health ready `UP`.
- Siguiente paso natural: Dia 18, implementar autenticacion y autorizacion.

## Ajuste transversal - soporte on-premise/offline

Fecha: 2026-09-02

Motivo:

- Se definio que el aplicativo final tambien debe poder correr en ambiente on-premise/offline.
- Google Secret Manager no debe ser dependencia universal del aplicativo.
- Secret Manager queda como proveedor de secretos para runtime GCP; on-premise debe poder usar variables de entorno, archivo local protegido, Docker/Kubernetes secrets o Vault equivalente.

Realizado:

- Se actualizo `C:\VENTA-DE-PASAJES\tareas.md` con una nota transversal on-premise/offline.
- Se agregaron perfiles `gcp` y `onprem` a:
  - `C:\VENTA-DE-PASAJES\services\quarkus-service-template\src\main\resources\application.properties`
  - `C:\VENTA-DE-PASAJES\services\identity-service\src\main\resources\application.properties`
- Se cambio la configuracion base para usar variables neutrales:
  - `APP_RUNTIME_TARGET`
  - `APP_SECRETS_PROVIDER`
  - `APP_SECRETS_LOCAL_FILE`
  - `APP_DB_NAME`
  - `APP_DB_JDBC_URL`
  - `APP_DB_USERNAME`
  - `APP_DB_PASSWORD`
- Se mantuvo perfil `gcp` con defaults para Cloud SQL IAM y Secret Manager.
- Se agrego perfil `onprem` con defaults para PostgreSQL local/red privada y proveedor `env`.
- Se actualizo `new-quarkus-service.ps1` para generar tambien `local_database_user`, por ejemplo `identity_user`.
- Se ajusto `new-quarkus-service.ps1 -DryRun` para poder inspeccionar servicios existentes sin fallar por contenido previo.
- Se actualizo `verify-identity-service-local-db.ps1` para probar el perfil `onprem` usando `APP_DB_*` y una contrasena temporal generada al vuelo.
- Se creo script de arranque on-premise:
  `C:\VENTA-DE-PASAJES\scripts\start-identity-service-onprem.ps1`.
- Se agregaron plantillas de entorno:
  - `C:\VENTA-DE-PASAJES\infra\env\identity-service.onprem.env.example`
  - `C:\VENTA-DE-PASAJES\infra\env\identity-service.gcp.env.example`
  - `C:\VENTA-DE-PASAJES\infra\env\frontend-app.onprem.env.example`
- Se actualizo `C:\VENTA-DE-PASAJES\infra\env\backend-service.env.example` para usar variables neutrales por entorno.
- Se actualizo `.gitignore` para ignorar `*.env` reales y seguir permitiendo `*.env.example`.
- Se creo guia:
  `C:\VENTA-DE-PASAJES\docs\onpremise-offline-runbook.md`.
- Se actualizaron README y convenciones para hablar de proveedor de secretos segun entorno.
- Se agregaron pruebas de configuracion de perfiles runtime en:
  - `C:\VENTA-DE-PASAJES\services\identity-service\src\test\java\com\ventapasajes\identity\RuntimeProfileConfigurationTest.java`
  - `C:\VENTA-DE-PASAJES\services\quarkus-service-template\src\test\java\com\ventapasajes\template\RuntimeProfileConfigurationTest.java`

Comandos ejecutados:

```powershell
rg -n "Secret Manager|secret|QUARKUS_DATASOURCE|jdbc:postgresql|APP_LOG_CONSOLE_JSON|GOOGLE_CLOUD_PROJECT|cloudSqlInstance|APP_ENV" . -g "!**/target/**"

rg -n "Secret Manager|secret|QUARKUS_DATASOURCE|APP_DB|APP_SECRETS|jdbc:postgresql|cloudSqlInstance|APP_ENV|GOOGLE_CLOUD_PROJECT" services infra docs scripts -g "!**/target/**"

Get-Content -Path services\identity-service\src\main\resources\application.properties
Get-Content -Path services\quarkus-service-template\src\main\resources\application.properties
Get-Content -Path infra\env\backend-service.env.example
Get-Content -Path scripts\verify-identity-service-local-db.ps1
Get-Content -Path services\identity-service\README.md
Get-Content -Path infra\README.md
Get-ChildItem -LiteralPath infra\env -Force
Get-Content -Path infra\env\frontend-app.env.example
Get-Content -Path infra\env\google-cloud.env.example
Get-Content -Path README.md
```

Validaciones ejecutadas:

```powershell
$Errors = $null
[System.Management.Automation.Language.Parser]::ParseFile((Resolve-Path .\scripts\new-quarkus-service.ps1), [ref]$null, [ref]$Errors)
[System.Management.Automation.Language.Parser]::ParseFile((Resolve-Path .\scripts\verify-identity-service-local-db.ps1), [ref]$null, [ref]$Errors)
[System.Management.Automation.Language.Parser]::ParseFile((Resolve-Path .\scripts\start-identity-service-onprem.ps1), [ref]$null, [ref]$Errors)

mvn -f .\services\identity-service\pom.xml test
mvn -f .\services\quarkus-service-template\pom.xml test
mvn -f .\services\identity-service\pom.xml package -DskipTests

powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-identity-service-local-db.ps1

powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\new-quarkus-service.ps1 -DryRun -ServiceName identity-service -PackageSegment identity -DatabaseName identity_db -HttpPort 8081

rg -n "%gcp|%onprem|APP_DB_|APP_SECRETS_PROVIDER|APP_RUNTIME_TARGET|APP_SECRETS_LOCAL_FILE" services/identity-service/src/main/resources/application.properties services/quarkus-service-template/src/main/resources/application.properties infra/env docs/onpremise-offline-runbook.md tareas.md -g "!**/target/**"

rg -n "deprecated|Migrating schema|Successfully applied|Profile onprem|identity-service .* started|Database:" services/identity-service/target/identity-service-local-db.out.log services/identity-service/target/identity-service-local-db.err.log

docker ps --filter "name=venta-pasajes-identity-pg" --format "{{.Names}} {{.Status}}"
```

Comandos internos relevantes ejecutados por `verify-identity-service-local-db.ps1`:

```powershell
docker run --rm --name venta-pasajes-identity-pg-<pid> -e POSTGRES_DB=identity_db -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=<temporary-local-password> -p 55432:5432 -d postgres:16-alpine
docker exec venta-pasajes-identity-pg-<pid> pg_isready -U postgres -d identity_db
java -jar C:\VENTA-DE-PASAJES\services\identity-service\target\quarkus-app\quarkus-run.jar
Invoke-RestMethod -Uri http://localhost:18081/q/health/ready
docker stop venta-pasajes-identity-pg-<pid>
```

Resultados:

```text
PowerShell parser OK
```

```text
identity-service: Tests run: 8, Failures: 0, Errors: 0, Skipped: 0
quarkus-service-template: Tests run: 4, Failures: 0, Errors: 0, Skipped: 0
```

```json
{"service":"identity-service","quarkus_profile":"onprem","secrets_provider":"env","database":"identity_db","migration_tool":"flyway","database_port":55432,"http_port":18081,"health_ready":"UP","container":"venta-pasajes-identity-pg-<pid>","ready":true}
```

```text
Profile onprem activated.
Successfully applied 1 migration to schema "public", now at version v1.
```

Validacion:

- Configuracion `gcp`: presente.
- Configuracion `onprem`: presente.
- `identity-service` corre con `QUARKUS_PROFILE=onprem`: OK.
- Proveedor de secretos `env` para on-premise: OK.
- Verificacion local sin Google Cloud: OK.
- Docker temporal detenido: OK.
- No se agregaron secretos reales al repositorio.

Estado:

- Requisito on-premise/offline incorporado desde ahora.
- Siguiente codigo que necesite secretos debe depender de la configuracion/proveedor del entorno, no directamente de Google Secret Manager.

## Dia 18 - Autenticacion y autorizacion

Fecha: 2026-09-03

Realizado:

- Se reemplazaron los stubs `501 NOT_IMPLEMENTED` de `identity-service` por endpoints funcionales.
- Se implemento login local con usuario/contrasena.
- Se implemento hash de contrasena con `PBKDF2WithHmacSHA256`, salt aleatorio y pepper configurable.
- Se implemento emision y validacion de JWT interno `HS256`.
- Se implemento filtro/middleware de permisos con `@RequiresPermission`.
- Se implemento validacion de ID token Google con issuer, audience, expiracion, correo verificado y firma `RS256` contra JWKS.
- Se agrego modo de token Google de desarrollo, deshabilitado por defecto.
- Se implemento autorizacion Google por correo, dominio o subject registrado.
- Se implementaron roles y permisos basicos.
- Se agrego bootstrap opcional de admin inicial para ambientes locales/on-premise.
- Se implemento bloqueo temporal por intentos fallidos.
- Se implemento recuperacion/reset de contrasena con token de un solo uso.
- Se agrego verificador end-to-end:
  `C:\VENTA-DE-PASAJES\scripts\verify-identity-auth-local.ps1`.
- Se actualizaron:
  - `C:\VENTA-DE-PASAJES\docs\dia-18-autenticacion-autorizacion.md`
  - `C:\VENTA-DE-PASAJES\docs\openapi\identity-service.openapi.yaml`
  - `C:\VENTA-DE-PASAJES\docs\database\identity-db.sql`
  - `C:\VENTA-DE-PASAJES\docs\onpremise-offline-runbook.md`
  - `C:\VENTA-DE-PASAJES\infra\env\identity-service.onprem.env.example`
  - `C:\VENTA-DE-PASAJES\infra\env\identity-service.gcp.env.example`
  - `C:\VENTA-DE-PASAJES\services\identity-service\README.md`

Comandos ejecutados:

```powershell
$lines = Get-Content -Path tareas.md; $lines[832..858]

rg --files services/identity-service/src/main services/identity-service/src/test infra/env docs/openapi docs/database | sort

Get-Content -Path services/identity-service/pom.xml
Get-Content -Path services/identity-service/src/main/resources/application.properties
Get-Content -Path docs/openapi/identity-service.openapi.yaml
Get-Content -Path services/identity-service/src/main/java/com/ventapasajes/identity/api/IdentityBaseResource.java
Get-Content -Path services/identity-service/src/main/resources/db/migration/V1__identity_schema.sql
Get-Content -Path services/identity-service/src/main/java/com/ventapasajes/identity/persistence/entity/UserAccount.java
Get-Content -Path services/identity-service/src/main/java/com/ventapasajes/identity/persistence/entity/LocalCredential.java
Get-Content -Path services/identity-service/src/main/java/com/ventapasajes/identity/persistence/entity/Role.java
Get-Content -Path services/identity-service/src/main/java/com/ventapasajes/identity/persistence/entity/PermissionCatalogItem.java

New-Item -ItemType Directory -Force -Path services/identity-service/src/main/java/com/ventapasajes/identity/api/dto, services/identity-service/src/main/java/com/ventapasajes/identity/auth, services/identity-service/src/main/java/com/ventapasajes/identity/service

mvn -f .\services\identity-service\pom.xml test

$Errors=$null
[System.Management.Automation.Language.Parser]::ParseFile((Resolve-Path .\scripts\verify-identity-auth-local.ps1), [ref]$null, [ref]$Errors)

mvn -f .\services\identity-service\pom.xml package -DskipTests

powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-identity-auth-local.ps1

powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-identity-service-local-db.ps1

docker ps --filter "name=venta-pasajes-identity" --format "table {{.Names}}\t{{.Status}}"
```

Comandos internos relevantes ejecutados por `verify-identity-auth-local.ps1`:

```powershell
docker run --rm --name venta-pasajes-identity-auth-pg-<pid> -e POSTGRES_DB=identity_db -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=<temporary-local-password> -p 55433:5432 -d postgres:16-alpine
docker exec venta-pasajes-identity-auth-pg-<pid> pg_isready -U postgres -d identity_db
java -jar C:\VENTA-DE-PASAJES\services\identity-service\target\quarkus-app\quarkus-run.jar
Invoke-RestMethod -Uri http://localhost:18082/q/health/ready
Invoke-RestMethod -Uri http://localhost:18082/api/v1/identity/auth/local/login -Method Post -Body <redacted-json>
Invoke-RestMethod -Uri http://localhost:18082/api/v1/identity/me -Headers @{Authorization="Bearer <redacted-token>"}
Invoke-RestMethod -Uri http://localhost:18082/api/v1/identity/permissions -Headers @{Authorization="Bearer <redacted-token>"}
Invoke-RestMethod -Uri http://localhost:18082/api/v1/identity/roles -Headers @{Authorization="Bearer <redacted-token>"}
Invoke-RestMethod -Uri http://localhost:18082/api/v1/identity/users -Headers @{Authorization="Bearer <redacted-token>"}
Invoke-RestMethod -Uri http://localhost:18082/api/v1/identity/password/forgot -Method Post -Body <redacted-json>
Invoke-RestMethod -Uri http://localhost:18082/api/v1/identity/password/reset -Method Post -Body <redacted-json>
docker stop venta-pasajes-identity-auth-pg-<pid>
```

Resultados:

```text
Primera validacion detecto `POST /auth/logout` con respuesta 415 sin Content-Type.
Correccion aplicada: `@Consumes(MediaType.WILDCARD)`.
```

```text
Primera verificacion end-to-end detecto `APP_GOOGLE_CLIENT_IDS` vacio en arranque.
Correccion aplicada: placeholder local configurable.
```

```text
Verificacion end-to-end detecto `ORDER BY` incompatible con `SELECT DISTINCT` sobre `citext`.
Correccion aplicada: ordenar por alias `code`.
```

```text
Tests run: 14, Failures: 0, Errors: 0, Skipped: 0
BUILD SUCCESS
```

```json
{"service":"identity-service","quarkus_profile":"onprem","secrets_provider":"env","database":"identity_db","migration_tool":"flyway","database_port":55433,"http_port":18082,"bootstrap_admin_login":"admin","token_returned":true,"roles_count":2,"permissions_count":8,"users_count":1,"password_recovery_verified":true,"container":"venta-pasajes-identity-auth-pg-<pid>","ready":true}
```

```json
{"service":"identity-service","quarkus_profile":"onprem","secrets_provider":"env","database":"identity_db","migration_tool":"flyway","database_port":55432,"http_port":18081,"health_ready":"UP","container":"venta-pasajes-identity-pg-<pid>","ready":true}
```

Validacion:

- Autenticacion local: OK.
- JWT interno: OK.
- Middleware de permisos: OK.
- Roles/permisos basicos: OK.
- Recuperacion de contrasena con token de un solo uso: OK.
- Perfil on-premise sin Google Cloud: OK.
- Flyway contra PostgreSQL temporal: OK.
- Docker temporal detenido: OK.
- No se registraron secretos reales, contrasenas, access tokens ni peppers.

Estado:

- Dia 18 completado.
- Pendiente futuro: si se requiere invalidar JWT inmediatamente al hacer logout, agregar tabla de sesiones/revocacion o refresh tokens persistentes.

## Ajuste documentacion Postman Dia 18

Fecha: 2026-09-03

Realizado:

- Se aclaro en `C:\VENTA-DE-PASAJES\docs\dia-18-autenticacion-autorizacion.md` como levantar `identity-service` localmente para probar con Postman.
- Se ajusto `C:\VENTA-DE-PASAJES\infra\env\identity-service.onprem.env.example` para usar `APP_GOOGLE_CLIENT_IDS=local-google-client-placeholder` y evitar arranque fallido cuando Google OIDC no esta configurado.

Comandos documentados para prueba manual:

```powershell
docker run --rm --name venta-pasajes-postgres-dev -e POSTGRES_DB=identity_db -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=<local-dev-password> -p 5432:5432 -d postgres:16-alpine
mvn -f .\services\identity-service\pom.xml package -DskipTests
java -jar .\services\identity-service\target\quarkus-app\quarkus-run.jar
```

Estado:

- Documentacion de Postman actualizada.

## Ajuste curl Dia 18

Fecha: 2026-09-03

Realizado:

- Se actualizo `C:\VENTA-DE-PASAJES\docs\dia-18-autenticacion-autorizacion.md` para incluir peticiones listas para copiar y ejecutar con `curl.exe` en PowerShell.
- Se agregaron ejemplos `curl.exe` para:
  - Health ready.
  - Login local.
  - Uso del `access_token`.
  - `/me`.
  - `/permissions`.
  - `/roles`.
  - `/users`.
  - `/password/forgot`.
  - `/password/reset`.
- Se agrego `APP_AUTH_RECOVERY_RETURN_TOKEN_ENABLED=true` solo en el ejemplo local para poder probar recuperacion de contrasena manualmente.

Comandos ejecutados:

```powershell
rg -n "Ejemplos Postman|Login local|Usar token|password/forgot|password/reset" docs/dia-18-autenticacion-autorizacion.md

Get-Content -Path docs/dia-18-autenticacion-autorizacion.md | Select-Object -Index 80..125

$lines = Get-Content -Path docs/dia-18-autenticacion-autorizacion.md; $lines[80..155]

rg -n "curl\.exe|Ejemplos Postman y curl|APP_AUTH_RECOVERY_RETURN_TOKEN_ENABLED" docs/dia-18-autenticacion-autorizacion.md

$lines = Get-Content -Path docs/dia-18-autenticacion-autorizacion.md; $lines[84..185]
```

Resultado:

```text
El comando `Select-Object -Index 80..125` fallo por formato de PowerShell.
Se repitio la inspeccion con arreglo de lineas: `$lines[80..155]`.
```

```text
Se encontraron bloques `curl.exe` para las peticiones HTTP del Dia 18.
```

Estado:

- Documentacion Dia 18 ahora incluye peticiones HTTP listas para `curl.exe`.

## Dia 19 - mfe-identity

Fecha: 2026-09-03

Realizado:

- Se convirtio `mfe-identity` de demo estatica a microfrontend operativo.
- Se implemento login local contra `identity-service`.
- Se agrego boton `Sign in with Google` usando Google Identity Services cuando existe `NEXT_PUBLIC_GOOGLE_CLIENT_ID`.
- Se agrego intercambio manual de ID token Google.
- Se guarda el JWT interno en `sessionStorage`.
- Se agregaron pantallas para:
  - Usuarios.
  - Identidades autorizadas.
  - Roles.
  - Permisos.
  - Recuperacion de contrasena.
- Se agrego creacion de usuario local/Google/hibrido con asignacion de roles.
- Se agregaron acciones para activar/suspender usuarios.
- Se agrego flujo de correo Google operativo con rol inicial `TICKET_SELLER`.
- Se agrego proxy Next.js `/api/identity/*` hacia `identity-service`.
- Se actualizo el manifest de `mfe-identity` con capacidades reales.
- Se actualizo `start-frontend-dev.ps1` para inyectar `IDENTITY_API_URL`.
- Se ajusto `start-frontend-dev.ps1` para no guardar PIDs de procesos Next que salen inmediatamente.
- Se creo verificador:
  `C:\VENTA-DE-PASAJES\scripts\verify-mfe-identity-local.ps1`.
- Se actualizo documentacion:
  - `C:\VENTA-DE-PASAJES\docs\dia-19-mfe-identity.md`
  - `C:\VENTA-DE-PASAJES\apps\README.md`
  - `C:\VENTA-DE-PASAJES\infra\env\frontend-app.env.example`
  - `C:\VENTA-DE-PASAJES\infra\env\frontend-app.onprem.env.example`

Comandos ejecutados:

```powershell
$lines = Get-Content -Path tareas.md; $lines[858..910]

rg --files services frontend apps docs infra scripts | sort

Get-Content -Path apps/mfe-identity/package.json
Get-Content -Path apps/mfe-identity/app/page.tsx
Get-Content -Path apps/mfe-identity/app/identity/embedded/page.tsx
Get-Content -Path apps/mfe-identity/app/globals.css
Get-Content -Path apps/frontend-shell/app/page.tsx
Get-Content -Path apps/frontend-shell/app/components/RemoteMfeFrame.tsx
Get-Content -Path apps/mfe-identity/app/mfe/manifest/route.ts
Get-Content -Path apps/mfe-identity/app/layout.tsx
Get-Content -Path apps/mfe-identity/app/api/health/route.ts
Get-Content -Path apps/frontend-shell/package.json
Get-Content -Path packages/shared-types/package.json
Get-Content -Path packages/shared-types/src/index.ts
Get-Content -Path apps/mfe-identity/next.config.ts
Get-Content -Path apps/frontend-shell/next.config.ts
Get-Content -Path apps/README.md

New-Item -ItemType Directory -Force -Path apps/mfe-identity/app/api/identity/[...path]

npm run typecheck -w @venta-pasajes/mfe-identity
npm run build -w @venta-pasajes/mfe-identity
npm run typecheck -w @venta-pasajes/frontend-shell
npm run build -w @venta-pasajes/frontend-shell

Get-NetTCPConnection -LocalPort 3000,3001 -ErrorAction SilentlyContinue
Get-NetTCPConnection -LocalPort 3010,3011 -ErrorAction SilentlyContinue

powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-frontend-dev.ps1 -ShellPort 3010 -MfeIdentityPort 3011 -IdentityApiUrl http://localhost:8081/api/v1/identity

curl.exe -s "http://localhost:3001/mfe/manifest"
curl.exe -s -o NUL -w "%{http_code}" "http://localhost:3001/identity/embedded"
curl.exe -s -o NUL -w "%{http_code}" "http://localhost:3000/"
curl.exe -s -o NUL -w "%{http_code}" "http://localhost:3001/api/health"

$Errors=$null
[System.Management.Automation.Language.Parser]::ParseFile((Resolve-Path .\scripts\start-frontend-dev.ps1), [ref]$null, [ref]$Errors)
[System.Management.Automation.Language.Parser]::ParseFile((Resolve-Path .\scripts\verify-mfe-identity-local.ps1), [ref]$null, [ref]$Errors)

powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-mfe-identity-local.ps1 -MfeIdentityUrl http://localhost:3001 -IdentityHttpPort 8081 -DatabasePort 55434

npm run typecheck:frontend
npm run build:frontend

docker ps --filter "name=venta-pasajes-mfe-identity" --format "table {{.Names}}\t{{.Status}}"
```

Comandos curl documentados para el Dia 19:

```powershell
curl.exe -s "http://localhost:3001/api/health"
curl.exe -s "http://localhost:3001/mfe/manifest"
curl.exe -s -o NUL -w "%{http_code}" "http://localhost:3001/identity/embedded"
curl.exe -s -o NUL -w "%{http_code}" "http://localhost:3000/"

$loginResponse = curl.exe -s -X POST "http://localhost:3001/api/identity/auth/local/login" `
  -H "Content-Type: application/json" `
  -d '{"login":"admin","password":"<redacted>"}' | ConvertFrom-Json

$accessToken = $loginResponse.access_token

curl.exe -X GET "http://localhost:3001/api/identity/me" `
  -H "Authorization: Bearer $accessToken"

curl.exe -X GET "http://localhost:3001/api/identity/users" `
  -H "Authorization: Bearer $accessToken"

curl.exe -X GET "http://localhost:3001/api/identity/roles" `
  -H "Authorization: Bearer $accessToken"

curl.exe -X GET "http://localhost:3001/api/identity/permissions" `
  -H "Authorization: Bearer $accessToken"

curl.exe -X GET "http://localhost:3001/api/identity/authorized-identities" `
  -H "Authorization: Bearer $accessToken"
```

Comandos internos relevantes ejecutados por `verify-mfe-identity-local.ps1`:

```powershell
curl.exe -s -o NUL -w "%{http_code}" http://localhost:3001/api/health
curl.exe -s -o NUL -w "%{http_code}" http://localhost:3001/identity/embedded
docker run --rm --name venta-pasajes-mfe-identity-pg-<pid> -e POSTGRES_DB=identity_db -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=<temporary-local-password> -p 55434:5432 -d postgres:16-alpine
docker exec venta-pasajes-mfe-identity-pg-<pid> pg_isready -U postgres -d identity_db
java -jar C:\VENTA-DE-PASAJES\services\identity-service\target\quarkus-app\quarkus-run.jar
Invoke-RestMethod -Uri http://localhost:8081/q/health/ready
Invoke-RestMethod -Uri http://localhost:3001/api/identity/auth/local/login -Method POST -Body <redacted-json>
Invoke-RestMethod -Uri http://localhost:3001/api/identity/me -Headers @{Authorization="Bearer <redacted-token>"}
Invoke-RestMethod -Uri http://localhost:3001/api/identity/users -Headers @{Authorization="Bearer <redacted-token>"}
Invoke-RestMethod -Uri http://localhost:3001/api/identity/roles -Headers @{Authorization="Bearer <redacted-token>"}
Invoke-RestMethod -Uri http://localhost:3001/api/identity/permissions -Headers @{Authorization="Bearer <redacted-token>"}
Invoke-RestMethod -Uri http://localhost:3001/api/identity/authorized-identities -Headers @{Authorization="Bearer <redacted-token>"}
docker stop venta-pasajes-mfe-identity-pg-<pid>
```

Resultados:

```text
@venta-pasajes/mfe-identity typecheck OK
@venta-pasajes/mfe-identity build OK
@venta-pasajes/frontend-shell typecheck OK
@venta-pasajes/frontend-shell build OK
typecheck:frontend OK
build:frontend OK
```

```text
http://localhost:3001/identity/embedded -> 200
http://localhost:3000/ -> 200
http://localhost:3001/api/health -> 200
```

```json
{"name":"mfe-identity","title":"Identidad y accesos","version":"0.1.0","status":"online","mount_path":"/identity","entry_url":"http://localhost:3001/identity/embedded","health_url":"http://localhost:3001/api/health","capabilities":["login-local","google-oidc","usuarios-locales","identidades-autorizadas","roles","permisos","recuperacion-contrasena"]}
```

```json
{"service":"mfe-identity","mfe_url":"http://localhost:3001","manifest":"ok","embedded_page_status":200,"identity_proxy":"ok","identity_backend_port":8081,"bootstrap_admin_login":"admin","token_returned":true,"users_count":1,"roles_count":2,"permissions_count":8,"authorized_identities_count":0,"ready":true}
```

Observaciones:

- Los puertos `3000` y `3001` ya estaban ocupados por dev servers existentes de `frontend-shell` y `mfe-identity`; se usaron para validar carga.
- Un intento de iniciar dev servers en `3010/3011` detecto dev servers Next ya activos para esas mismas apps.
- Docker temporal de `verify-mfe-identity-local.ps1` fue detenido.
- No se registraron contrasenas reales, JWT ni peppers.

Estado:

- Dia 19 completado.
- Shell y MFE disponibles en los dev servers existentes:
  - `http://localhost:3000/`
  - `http://localhost:3001/identity/embedded`
- Siguiente paso natural: Dia 20, compilacion nativa de `identity-service`.

## Ajuste documentacion Dia 19 - detener shell y MFE

Fecha: 2026-09-03

Realizado:

- Se actualizo `C:\VENTA-DE-PASAJES\docs\dia-19-mfe-identity.md` con comandos para detener `frontend-shell` y `mfe-identity`.
- Se documento el uso de `npm run stop:frontend`.
- Se documento el uso directo de `C:\VENTA-DE-PASAJES\scripts\stop-frontend-dev.ps1`.
- Se agrego una alternativa manual para identificar y detener procesos que ocupen los puertos `3000` y `3001` cuando no existan archivos `.pid`.

Comandos ejecutados:

```powershell
Get-Content -Path docs/dia-19-mfe-identity.md
Get-Content -Path scripts/stop-frontend-dev.ps1
Get-Content -Path package.json
```

Comandos documentados para detener frontend:

```powershell
npm run stop:frontend
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\stop-frontend-dev.ps1
Get-NetTCPConnection -LocalPort 3000,3001 -ErrorAction SilentlyContinue

$frontendPorts = @(3000, 3001)
$frontendProcessIds = Get-NetTCPConnection -LocalPort $frontendPorts -ErrorAction SilentlyContinue |
  Select-Object -ExpandProperty OwningProcess -Unique

$frontendProcessIds |
  ForEach-Object {
    Get-Process -Id $_ -ErrorAction SilentlyContinue |
      Select-Object Id, ProcessName, Path
  }

$frontendProcessIds |
  ForEach-Object {
    Stop-Process -Id $_ -Force
  }

Get-NetTCPConnection -LocalPort 3000,3001 -ErrorAction SilentlyContinue
```

Estado:

- Documentacion operativa agregada.

## Correccion stop frontend

Fecha: 2026-09-03

Realizado:

- Se corrigio `C:\VENTA-DE-PASAJES\scripts\stop-frontend-dev.ps1` porque PowerShell interpretaba mal los argumentos de `Join-Path` dentro del arreglo de archivos `.pid`.
- Se agrego fallback por puertos para detener procesos que escuchen en `3000` y `3001` aunque no existan archivos `.pid`.
- Se actualizo `C:\VENTA-DE-PASAJES\docs\dia-19-mfe-identity.md` para indicar que `npm run stop:frontend` libera los puertos locales del shell y del MFE.

Comandos ejecutados:

```powershell
Get-Content -Path scripts/stop-frontend-dev.ps1
Get-NetTCPConnection -LocalPort 3000,3001 -ErrorAction SilentlyContinue | Select-Object LocalAddress,LocalPort,State,OwningProcess | Format-Table -AutoSize
rg -n "stop:frontend|stop-frontend-dev|Detener shell y MFE|Port 3000" package.json docs/dia-19-mfe-identity.md vitacora.md scripts/start-frontend-dev.ps1
```

Comandos documentados/corregidos:

```powershell
npm run stop:frontend
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\stop-frontend-dev.ps1
Get-NetTCPConnection -LocalPort 3000,3001 -ErrorAction SilentlyContinue
```

Estado:

- Script corregido.

Validacion ejecutada:

```powershell
$Errors=$null
[System.Management.Automation.Language.Parser]::ParseFile((Resolve-Path .\scripts\stop-frontend-dev.ps1), [ref]$null, [ref]$Errors)

npm run stop:frontend
Get-NetTCPConnection -LocalPort 3000,3001 -ErrorAction SilentlyContinue | Select-Object LocalAddress,LocalPort,State,OwningProcess | Format-Table -AutoSize

npm run dev:frontend

curl.exe -s -o NUL -w "%{http_code}" "http://localhost:3000/"
curl.exe -s -o NUL -w "%{http_code}" "http://localhost:3001/api/health"
curl.exe -s "http://localhost:3001/mfe/manifest"
Get-NetTCPConnection -LocalPort 3000,3001 -ErrorAction SilentlyContinue | Where-Object { $_.State -eq 'Listen' } | Select-Object LocalAddress,LocalPort,State,OwningProcess | Format-Table -AutoSize
```

Resultado:

```text
PowerShell parser OK
npm run stop:frontend OK
Procesos detenidos por puerto:
- node.exe en 3000
- node.exe en 3001
Puertos 3000/3001 libres despues del stop
npm run dev:frontend OK
http://localhost:3000/ -> 200
http://localhost:3001/api/health -> 200
http://localhost:3001/mfe/manifest -> OK
```

Observacion:

- En Windows/Next.js el PID guardado por el script de arranque puede no coincidir con el proceso hijo `node.exe` que queda escuchando el puerto. Por eso `stop-frontend-dev.ps1` ahora tambien revisa listeners en los puertos `3000` y `3001`.

## Dia 20 - Compilacion nativa de identity-service

Fecha: 2026-09-03

Realizado:

- Se configuro el perfil nativo de `identity-service` para build por contenedor con Mandrel.
- Se agrego inclusion explicita de migraciones Flyway en native.
- Se agrego `NativeReflectionConfiguration` para registrar DTOs y respuestas serializadas por Jackson en imagen nativa.
- Se creo `Dockerfile.native` para ejecutar el binario nativo en UBI minimal.
- Se creo `.dockerignore` para contexto Docker minimo.
- Se creo `C:\VENTA-DE-PASAJES\scripts\build-identity-service-native.ps1`.
- Se creo `C:\VENTA-DE-PASAJES\scripts\verify-identity-service-native-local.ps1`.
- Se compilo el binario nativo de `identity-service`.
- Se construyo la imagen Docker local `identity-service:0.1.0-native`.
- Se valido la imagen local con PostgreSQL temporal, Flyway, bootstrap admin, login local y `/me`.
- Se creo el repositorio Artifact Registry `venta-pasajes-dev` en `us-central1`.
- Se publico la imagen en Artifact Registry dev.
- Se creo el entregable `C:\VENTA-DE-PASAJES\docs\dia-20-compilacion-nativa-identity-service.md`.
- Se actualizo `C:\VENTA-DE-PASAJES\services\identity-service\README.md`.

Archivos modificados o creados:

```text
C:\VENTA-DE-PASAJES\services\identity-service\pom.xml
C:\VENTA-DE-PASAJES\services\identity-service\src\main\resources\application.properties
C:\VENTA-DE-PASAJES\services\identity-service\src\main\java\com\ventapasajes\identity\api\NativeReflectionConfiguration.java
C:\VENTA-DE-PASAJES\services\identity-service\src\main\docker\Dockerfile.native
C:\VENTA-DE-PASAJES\services\identity-service\.dockerignore
C:\VENTA-DE-PASAJES\scripts\build-identity-service-native.ps1
C:\VENTA-DE-PASAJES\scripts\verify-identity-service-native-local.ps1
C:\VENTA-DE-PASAJES\docs\dia-20-compilacion-nativa-identity-service.md
C:\VENTA-DE-PASAJES\services\identity-service\README.md
```

Comandos ejecutados:

```powershell
$lines = Get-Content -Path tareas.md; $lines[880..920]

Get-Content -Path services/identity-service/pom.xml
Get-Content -Path services/identity-service/src/main/resources/application.properties
rg --files services/identity-service infra scripts docs | sort
Get-Content -Path infra/gcloud/README.md
Get-Content -Path docs/dia-12-infraestructura-google-cloud-base.md
Get-Content -Path docs/dia-10-toolchain-backend-quarkus.md

docker version --format '{{json .}}'
mvn -version
gcloud config list --format=json
gcloud auth list --format=json

$env:CLOUDSDK_PYTHON='C:\Python312\python.exe'
& 'C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd' config list --format=json
& 'C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd' auth list --format=json
& 'C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd' artifacts repositories list --project=project-fbb34cd7-0b82-43e1-867 --location=us-central1 --format=json

rg -n "Secret|secrets|google-secret-manager|SocketFactory|cloudSqlInstance|Cloud SQL|APP_SECRETS_PROVIDER" services/identity-service/src/main/java services/identity-service/src/main/resources infra/env docs/dia-17-identity-service-base.md docs/dia-18-autenticacion-autorizacion.md
Get-Content -Path infra/env/identity-service.gcp.env.example
Get-Content -Path infra/env/identity-service.onprem.env.example
rg --files services/toolchain-demo-service | sort

New-Item -ItemType Directory -Force -Path services/identity-service/src/main/docker | Out-Null

$Errors=$null
[System.Management.Automation.Language.Parser]::ParseFile((Resolve-Path .\scripts\build-identity-service-native.ps1), [ref]$null, [ref]$Errors)
[System.Management.Automation.Language.Parser]::ParseFile((Resolve-Path .\scripts\verify-identity-service-native-local.ps1), [ref]$null, [ref]$Errors)

mvn -f .\services\identity-service\pom.xml test

powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-identity-service-native.ps1 -ProjectId project-fbb34cd7-0b82-43e1-867 -Region us-central1 -Repository venta-pasajes-dev -ImageTag 0.1.0-native

mvn -f .\services\identity-service\pom.xml package "-Dnative" "-DskipTests" "-Dquarkus.native.container-build=true" "-Dquarkus.native.builder-image=quay.io/quarkus/ubi9-quarkus-mandrel-builder-image:jdk-21"

Get-CimInstance Win32_Process -Filter "name = 'java.exe'" | Select-Object ProcessId,CommandLine | Format-List
Get-NetTCPConnection -LocalPort 8081,18081,18082,18083 -ErrorAction SilentlyContinue | Select-Object LocalAddress,LocalPort,State,OwningProcess | Format-Table -AutoSize
docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"
curl.exe -s -o NUL -w "%{http_code}" "http://localhost:8081/api/v1/identity/health"
Stop-Process -Id 56652 -Force
taskkill /PID 56652 /T /F

powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-identity-service-native.ps1 -ProjectId project-fbb34cd7-0b82-43e1-867 -Region us-central1 -Repository venta-pasajes-dev -ImageTag 0.1.0-native -UseCleanWorkspace

Get-ChildItem -LiteralPath "C:\Users\diego.martinezc\AppData\Local\Temp\venta-pasajes-identity-native-26720\identity-service\target" -Force | Select-Object Name,Mode,Length,LastWriteTime | Format-Table -AutoSize
Get-Content -Path "C:\Users\diego.martinezc\AppData\Local\Temp\venta-pasajes-identity-native-26720\identity-service\target\quarkus-artifact.properties" -ErrorAction SilentlyContinue
Copy-Item -LiteralPath "C:\Users\diego.martinezc\AppData\Local\Temp\venta-pasajes-identity-native-26720\identity-service\target\identity-service-0.1.0-SNAPSHOT-runner" -Destination "C:\VENTA-DE-PASAJES\services\identity-service\target\identity-service-0.1.0-SNAPSHOT-runner" -Force

powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-identity-service-native.ps1 -ProjectId project-fbb34cd7-0b82-43e1-867 -Region us-central1 -Repository venta-pasajes-dev -ImageTag 0.1.0-native -SkipNativeBuild

powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-identity-service-native-local.ps1 -ImageTag identity-service:0.1.0-native -HttpPort 18083 -DatabasePort 55435

docker ps -a --filter "name=venta-pasajes-identity-native" --format "table {{.Names}}\t{{.Status}}"
docker network ls --filter "name=venta-pasajes-identity-native" --format "table {{.Name}}"

mvn -f .\services\identity-service\pom.xml test

powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-identity-service-native.ps1 -ProjectId project-fbb34cd7-0b82-43e1-867 -Region us-central1 -Repository venta-pasajes-dev -ImageTag 0.1.0-native -UseCleanWorkspace

Copy-Item -LiteralPath "C:\Users\diego.martinezc\AppData\Local\Temp\venta-pasajes-identity-native-5004\identity-service\target\identity-service-0.1.0-SNAPSHOT-runner" -Destination "C:\VENTA-DE-PASAJES\services\identity-service\target\identity-service-0.1.0-SNAPSHOT-runner" -Force

powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-identity-service-native-local.ps1 -ImageTag identity-service:0.1.0-native -HttpPort 18083 -DatabasePort 55435

docker image inspect identity-service:0.1.0-native --format '{{.Id}} {{.Size}}'
docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}" | Select-String "identity-service|us-central1-docker"

powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-identity-service-native.ps1 -ProjectId project-fbb34cd7-0b82-43e1-867 -Region us-central1 -Repository venta-pasajes-dev -ImageTag 0.1.0-native -SkipNativeBuild -SkipDockerBuild -Push -CreateRepository

Get-ChildItem -LiteralPath "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin" -Filter "docker-credential-gcloud*" | Select-Object FullName,Length | Format-Table -AutoSize
& 'C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd' artifacts repositories get-iam-policy venta-pasajes-dev --project=project-fbb34cd7-0b82-43e1-867 --location=us-central1 --format=json

& 'C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd' artifacts repositories describe venta-pasajes-dev --project=project-fbb34cd7-0b82-43e1-867 --location=us-central1 --format=json

& 'C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd' artifacts docker tags list us-central1-docker.pkg.dev/project-fbb34cd7-0b82-43e1-867/venta-pasajes-dev/identity-service --project=project-fbb34cd7-0b82-43e1-867 --format=json
& 'C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd' artifacts docker images list us-central1-docker.pkg.dev/project-fbb34cd7-0b82-43e1-867/venta-pasajes-dev/identity-service --project=project-fbb34cd7-0b82-43e1-867 --format=json
```

Comandos internos relevantes ejecutados por `verify-identity-service-native-local.ps1`:

```powershell
docker network create venta-pasajes-identity-native-<pid>
docker run --name venta-pasajes-identity-native-pg-<pid> --network venta-pasajes-identity-native-<pid> -e POSTGRES_DB=identity_db -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=<temporary-local-password> -p 55435:5432 -d postgres:16-alpine
docker run --rm --network venta-pasajes-identity-native-<pid> postgres:16-alpine pg_isready -h venta-pasajes-identity-native-pg-<pid> -p 5432 -U postgres -d identity_db
docker run --name venta-pasajes-identity-native-app-<pid> --network venta-pasajes-identity-native-<pid> -p 18083:8081 -e APP_ENV=onprem -e APP_RUNTIME_TARGET=onprem -e APP_SECRETS_PROVIDER=env -e QUARKUS_PROFILE=onprem -e QUARKUS_HTTP_PORT=8081 -e QUARKUS_FLYWAY_MIGRATE_AT_START=true -e APP_DB_NAME=identity_db -e APP_DB_JDBC_URL=jdbc:postgresql://venta-pasajes-identity-native-pg-<pid>:5432/identity_db -e APP_DB_USERNAME=postgres -e APP_DB_PASSWORD=<temporary-local-password> -e APP_JWT_SIGNING_SECRET=<temporary-local-secret> -e APP_PASSWORD_PEPPER=<temporary-local-secret> -e APP_RECOVERY_TOKEN_PEPPER=<temporary-local-secret> -e APP_GOOGLE_CLIENT_IDS=local-google-client-placeholder -e APP_BOOTSTRAP_ADMIN_ENABLED=true -e APP_BOOTSTRAP_ADMIN_LOGIN=admin -e APP_BOOTSTRAP_ADMIN_EMAIL=admin@example.local -e APP_BOOTSTRAP_ADMIN_DISPLAY_NAME=Administrador -e APP_BOOTSTRAP_ADMIN_PASSWORD=<temporary-local-password> -d identity-service:0.1.0-native
Invoke-RestMethod -Uri http://localhost:18083/q/health/ready
Invoke-RestMethod -Uri http://localhost:18083/api/v1/identity/auth/local/login -Method Post -Body <redacted-json>
Invoke-RestMethod -Uri http://localhost:18083/api/v1/identity/me -Headers @{Authorization="Bearer <redacted-token>"}
docker rm -f venta-pasajes-identity-native-app-<pid>
docker rm -f venta-pasajes-identity-native-pg-<pid>
docker network rm venta-pasajes-identity-native-<pid>
```

Comandos `curl.exe` documentados:

```powershell
curl.exe -s "http://localhost:18083/q/health/ready"
curl.exe -s "http://localhost:18083/api/v1/identity/health"

$loginBody = @{
  login = "admin"
  password = "<temporary-local-password>"
} | ConvertTo-Json -Compress

$loginResponse = curl.exe -s -X POST "http://localhost:18083/api/v1/identity/auth/local/login" `
  -H "Content-Type: application/json" `
  -d $loginBody | ConvertFrom-Json

$accessToken = $loginResponse.access_token

curl.exe -s -X GET "http://localhost:18083/api/v1/identity/me" `
  -H "Authorization: Bearer $accessToken"
```

Resultados:

```text
Pruebas JVM: Tests run: 14, Failures: 0, Errors: 0, Skipped: 0
Build nativo: BUILD SUCCESS, Total time: 01:24 min
Runner nativo: 107,356,400 bytes
Imagen local: identity-service:0.1.0-native
Imagen local inspect: sha256:7d1bde055269a8b70fa9eebee788b1cf5b63e33ee92dfcce13f0b3a93ade0ae8 111314071
Verificacion nativa final: ready=true, startup_ms=1417
Artifact Registry repository: venta-pasajes-dev creado/verificado
Artifact Registry tag: 0.1.0-native
Artifact Registry digest: sha256:7d1bde055269a8b70fa9eebee788b1cf5b63e33ee92dfcce13f0b3a93ade0ae8
```

Problemas detectados y solucionados:

```text
Primer build nativo fallo por archivo bloqueado en target\quarkus-app, usado por un java.exe escuchando en 8081.
No se pudo detener el PID 56652 por acceso denegado, asi que se agrego build con -UseCleanWorkspace.
Primer filtro de runner nativo fallo porque PowerShell interpreta extension en nombres con puntos; se corrigio el filtro.
Primera prueba nativa detecto falta de reflection para AuthTokenResponse; se agrego NativeReflectionConfiguration.
Primera espera PostgreSQL validaba readiness local dentro del contenedor; se cambio para validar desde la red Docker compartida.
Primer push fallo porque docker-credential-gcloud no estaba en PATH; se agrego la carpeta bin de gcloud al PATH durante publicacion.
Artifact Registry no tenia repositorio venta-pasajes-dev; se creo con repository-format=docker.
```

Validacion:

- Parser PowerShell OK para scripts creados.
- Tests JVM OK.
- Build nativo OK.
- Imagen Docker local OK.
- Verificacion local nativa OK.
- Publicacion Artifact Registry OK.
- Verificacion remota de tag OK.
- No quedaron contenedores temporales ni redes temporales `venta-pasajes-identity-native`.
- No se registraron contrasenas, JWT, peppers ni secretos reales.

Estado:

- Dia 20 completado.
- Primer microservicio nativo listo para Cloud Run.
- Siguiente paso natural: Dia 21, `dispatch-service` base.

Validacion final adicional:

Comandos ejecutados:

```powershell
$files = @('.\scripts\build-identity-service-native.ps1', '.\scripts\verify-identity-service-native-local.ps1'); foreach ($file in $files) { $errors = $null; [System.Management.Automation.Language.Parser]::ParseFile((Resolve-Path $file), [ref]$null, [ref]$errors) | Out-Null; if ($errors.Count -gt 0) { Write-Output "$file -> ERRORS"; $errors | ForEach-Object { Write-Output $_.Message } } else { Write-Output "$file -> OK" } }
mvn -f .\services\identity-service\pom.xml test
docker image inspect identity-service:0.1.0-native --format '{{.Id}} {{.Size}}'
docker ps -a --filter "name=venta-pasajes-identity-native" --format "{{.Names}}"
docker network ls --filter "name=venta-pasajes-identity-native" --format "{{.Name}}"
```

Resultados:

```text
.\scripts\build-identity-service-native.ps1 -> OK
.\scripts\verify-identity-service-native-local.ps1 -> OK
Tests run: 14, Failures: 0, Errors: 0, Skipped: 0
Imagen local: sha256:7d1bde055269a8b70fa9eebee788b1cf5b63e33ee92dfcce13f0b3a93ade0ae8 111314071
Contenedores temporales venta-pasajes-identity-native: ninguno
Redes temporales venta-pasajes-identity-native: ninguna
```

Consulta explicativa Artifact Registry - tag `0.1.0-native` con tamano virtual vacio:

Comandos ejecutados:

```powershell
$gcloud='C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd'; $env:CLOUDSDK_PYTHON='C:\Python312\python.exe'; & $gcloud artifacts docker images list us-central1-docker.pkg.dev/project-fbb34cd7-0b82-43e1-867/venta-pasajes-dev/identity-service --project=project-fbb34cd7-0b82-43e1-867 --include-tags --format=json
$gcloud='C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd'; $env:CLOUDSDK_PYTHON='C:\Python312\python.exe'; & $gcloud artifacts docker tags list us-central1-docker.pkg.dev/project-fbb34cd7-0b82-43e1-867/venta-pasajes-dev/identity-service --project=project-fbb34cd7-0b82-43e1-867 --format=json
docker image inspect identity-service:0.1.0-native --format '{{json .RepoTags}} {{json .RepoDigests}} {{.Id}} {{.Size}}'
docker buildx imagetools inspect us-central1-docker.pkg.dev/project-fbb34cd7-0b82-43e1-867/venta-pasajes-dev/identity-service:0.1.0-native
```

Resultados:

```text
El tag 0.1.0-native apunta al digest sha256:7d1bde055269a8b70fa9eebee788b1cf5b63e33ee92dfcce13f0b3a93ade0ae8.
Ese digest remoto tiene mediaType application/vnd.oci.image.index.v1+json, por eso Artifact Registry puede mostrar el tamano virtual vacio.
La imagen local con el mismo tag/digest pesa 111314071 bytes.
La consulta docker buildx imagetools inspect no se completo en esta terminal porque docker-credential-gcloud requirio refrescar credenciales y encontro un problema SSL/Python local.
```

Consulta explicativa - generacion y validacion local manual de imagen nativa `identity-service`:

Comandos ejecutados para revisar la receta documentada:

```powershell
Get-Content .\scripts\build-identity-service-native.ps1
Get-Content .\scripts\verify-identity-service-native-local.ps1
Get-Content .\docs\dia-20-compilacion-nativa-identity-service.md
Get-Content .\services\identity-service\README.md
```

Resultado:

```text
Se explico el flujo usado para generar el runner nativo Quarkus, construir la imagen Docker, probarla con PostgreSQL temporal, validar health/login/me y publicar opcionalmente en Artifact Registry.
No se ejecutaron builds nuevos en esta consulta.
```

Consulta explicativa - error al ejecutar manualmente build nativo desde PowerShell:

```text
El usuario intento ejecutar manualmente mvn package -Dnative -DskipTests -Dquarkus.native.container-build=true -Dquarkus.native.builder-image=...
Maven reporto: No plugin found for prefix '.native.builder-image=...'
Se identifico como un problema de interpretacion del argumento `-Dquarkus.native.builder-image=...` al copiar/partir el comando en PowerShell.
Se recomendo ejecutar el comando en una sola linea con parametros `-D...` entre comillas o usar el script `build-identity-service-native.ps1`.
No se ejecutaron builds nuevos en esta consulta.
```

Consulta explicativa - segundo intento manual build nativo con archivo bloqueado:

Comandos ejecutados:

```powershell
Get-NetTCPConnection -LocalPort 8081,18081,18082,18083 -ErrorAction SilentlyContinue | Select-Object LocalAddress,LocalPort,State,OwningProcess | Format-Table -AutoSize
Get-CimInstance Win32_Process -Filter "name = 'java.exe'" | Select-Object ProcessId,CommandLine | Format-List
Get-ChildItem .\services\identity-service\target -ErrorAction SilentlyContinue | Select-Object Name,Length,LastWriteTime | Format-Table -AutoSize
```

Resultado:

```text
Se confirmo que existe un java.exe con PID 56652 escuchando en el puerto 8081.
Ese proceso mantiene bloqueado target\quarkus-app\app\identity-service-0.1.0-SNAPSHOT.jar.
Por eso Maven falla con java.nio.file.FileSystemException: El proceso no tiene acceso al archivo porque esta siendo utilizado por otro proceso.
Se recomendo detener el proceso o usar el script con -UseCleanWorkspace.
```

Actualizacion documental solicitada - Dia 20 guia manual completa:

Archivo modificado:

```text
C:\VENTA-DE-PASAJES\docs\dia-20-compilacion-nativa-identity-service.md
```

Comandos ejecutados para revisar el contexto antes de editar:

```powershell
Get-Content .\docs\dia-20-compilacion-nativa-identity-service.md
Get-Content .\scripts\build-identity-service-native.ps1
Get-Content .\scripts\verify-identity-service-native-local.ps1
Get-Content .\services\identity-service\src\main\docker\Dockerfile.native
Get-Content .\services\identity-service\.dockerignore
```

Comandos ejecutados para validar que la documentacion incluya las secciones solicitadas:

```powershell
rg -n "Paso 3 - Ejecutar pruebas|Paso 4 - Compilar|Paso 6 - Construir|Paso 10 - Probar health|Paso 14 - Publicar|Paso 17 - Quitar|Paso 18 - Subir nuevamente|curl\.exe|docker images delete|docker push|Referencias oficiales" .\docs\dia-20-compilacion-nativa-identity-service.md
Get-Content .\docs\dia-20-compilacion-nativa-identity-service.md | Measure-Object -Line -Word -Character
Get-Content .\docs\dia-20-compilacion-nativa-identity-service.md -Tail 40
```

Resultado:

```text
Se reemplazo la version corta del documento por una guia manual completa.
Se agregaron pasos minuciosos para prerequisitos, pruebas JVM, compilacion del binario nativo, construccion de imagen Docker, prueba local con PostgreSQL temporal, pruebas HTTP con curl.exe, publicacion en Artifact Registry, verificacion en consola/comandos, eliminacion de imagen/tag remoto y republicacion.
Se agregaron referencias oficiales de Google Artifact Registry para push/pull y gestion/eliminacion de imagenes.
No se ejecutaron builds nuevos, pushes, deletes ni cambios reales en Artifact Registry durante esta actualizacion documental.
```

Actualizacion documental solicitada - recrear repositorio Artifact Registry eliminado:

Archivo modificado:

```text
C:\VENTA-DE-PASAJES\docs\dia-20-compilacion-nativa-identity-service.md
```

Motivo:

```text
El usuario elimino desde la consola web el repositorio `venta-pasajes-dev` y al intentar `docker push` obtuvo: Repository "venta-pasajes-dev" not found.
Se agregaron al Paso 18 instrucciones para recrear el repositorio antes de subir nuevamente la imagen.
```

Comandos ejecutados para revisar y validar el documento:

```powershell
rg -n "Paso 14 - Publicar|Paso 18 - Subir nuevamente|docker push|repositories create|Repository" .\docs\dia-20-compilacion-nativa-identity-service.md
Get-Content .\docs\dia-20-compilacion-nativa-identity-service.md | Select-Object -Skip 730 -First 110
Get-Content .\docs\dia-20-compilacion-nativa-identity-service.md | Select-Object -Skip 750 -First 150
rg -n -F 'artifacts repositories create' .\docs\dia-20-compilacion-nativa-identity-service.md
rg -n -F 'docker tag $LocalImage $ArtifactImage' .\docs\dia-20-compilacion-nativa-identity-service.md
rg -n -F 'docker push $ArtifactImage' .\docs\dia-20-compilacion-nativa-identity-service.md
Get-Content .\docs\dia-20-compilacion-nativa-identity-service.md | Measure-Object -Line -Word -Character
```

Comandos agregados al documento para recrear el repositorio:

```powershell
$ProjectId = "project-fbb34cd7-0b82-43e1-867"
$Region = "us-central1"
$Repository = "venta-pasajes-dev"
$ImageName = "identity-service"
$ImageTag = "0.1.0-native"
$LocalImage = "${ImageName}:${ImageTag}"
$ArtifactImage = "$Region-docker.pkg.dev/$ProjectId/$Repository/${ImageName}:${ImageTag}"
$Gcloud = "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd"
$env:CLOUDSDK_PYTHON = "C:\Python312\python.exe"
$env:PATH = "$(Split-Path -Parent $Gcloud);$env:PATH"

& $Gcloud config set project $ProjectId
& $Gcloud services enable artifactregistry.googleapis.com --project=$ProjectId
& $Gcloud artifacts repositories describe $Repository --project=$ProjectId --location=$Region
& $Gcloud artifacts repositories create $Repository --project=$ProjectId --location=$Region --repository-format=docker --description="Venta de Pasajes development Docker images"
& $Gcloud artifacts repositories list --project=$ProjectId --location=$Region --format="table(name,format,location,description)"
& $Gcloud auth configure-docker us-central1-docker.pkg.dev --quiet
docker tag $LocalImage $ArtifactImage
docker push $ArtifactImage
```

Resultado:

```text
El Paso 18 ahora explica que `docker push` no crea repositorios de Artifact Registry.
Se agrego la recreacion del repositorio `venta-pasajes-dev` por CLI y por consola web.
Se actualizaron los comandos de republicacion para usar `$LocalImage` y `$ArtifactImage`.
No se ejecuto `gcloud artifacts repositories create`, `docker push` ni ningun cambio real contra Artifact Registry durante esta actualizacion.
```

Adopcion de nuevo estandar documental para proximos dias:

Archivo creado:

```text
C:\VENTA-DE-PASAJES\docs\estandar-documentacion-dias.md
```

Solicitud del usuario:

```text
De aqui en adelante, cada documento diario debe incluir una guia manual completa para repetir el proceso desde cero.
Como Codex realiza primero la practica tecnica, el documento debe mostrar primero la reversa/limpieza/despublicacion y despues los pasos manuales para llegar al objetivo alcanzado.
```

Comandos ejecutados:

```powershell
Get-ChildItem .\docs | Select-Object Name,Length,LastWriteTime | Format-Table -AutoSize
Get-Content .\vitacora.md -Tail 80
Get-Content .\docs\estandar-documentacion-dias.md | Measure-Object -Line -Word -Character
rg -n "Reversa primero|Guia manual desde cero|curl\.exe|Practica primero|Bitacora" .\docs\estandar-documentacion-dias.md
```

Resultado:

```text
Se creo un estandar para documentos `dia-XX-*.md`.
Desde el Dia 21 en adelante, la documentacion debe incluir reversa primero, guia manual desde cero, pruebas, comandos curl.exe para HTTP/HTTPS, publicacion/despliegue si aplica, verificacion por consola/comandos, problemas y estado final.
La bitacora debe seguir registrando comandos ejecutados y resultados sin exponer secretos reales.
```

## Dia 21 - dispatch-service base

Fecha: 2026-09-07

Objetivo:

```text
Crear proyecto Quarkus dispatch-service, migraciones iniciales del dominio despacho/programacion, endpoints base, OpenAPI y pruebas unitarias/base.
```

Archivos principales creados o modificados:

```text
C:\VENTA-DE-PASAJES\services\dispatch-service\pom.xml
C:\VENTA-DE-PASAJES\services\dispatch-service\README.md
C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\resources\application.properties
C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\resources\db\migration\V1__dispatch_schema.sql
C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\DispatchBaseResource.java
C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\DispatchHealthResource.java
C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\DispatchOpenApiConfiguration.java
C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\dto\DispatchOverviewResponse.java
C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\dto\DispatchResourceResponse.java
C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\domain\DepartureStatus.java
C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\domain\SeatPosition.java
C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\persistence\entity\Terminal.java
C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\persistence\entity\DispatchRoute.java
C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\persistence\entity\BusType.java
C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\persistence\entity\SeatLayout.java
C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\persistence\entity\SeatLayoutSeat.java
C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\persistence\entity\Bus.java
C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\persistence\entity\Departure.java
C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\service\DispatchCatalogService.java
C:\VENTA-DE-PASAJES\services\dispatch-service\src\test\java\com\ventapasajes\dispatch\api\DispatchBaseResourceTest.java
C:\VENTA-DE-PASAJES\services\dispatch-service\src\test\java\com\ventapasajes\dispatch\api\DispatchHealthResourceTest.java
C:\VENTA-DE-PASAJES\services\dispatch-service\src\test\java\com\ventapasajes\dispatch\persistence\DispatchMigrationContractTest.java
C:\VENTA-DE-PASAJES\scripts\verify-dispatch-service-local-db.ps1
C:\VENTA-DE-PASAJES\docs\dia-21-dispatch-service-base.md
```

Comandos ejecutados - lectura de alcance y contexto:

```powershell
Get-Content .\tareas.md | Select-Object -Skip 880 -First 90
Get-Content .\docs\estandar-documentacion-dias.md
Get-ChildItem .\services -Recurse -Depth 2 | Select-Object FullName,Mode,Length,LastWriteTime | Format-Table -AutoSize
Get-Content .\vitacora.md -Tail 100
Get-Content .\scripts\new-quarkus-service.ps1
Get-Content .\docs\database\dispatch-db.sql
Get-Content .\docs\dia-08-diseno-modelo-postgresql.md | Select-Object -Skip 70 -First 50
Get-Content .\docs\dia-05-definicion-dominios-microservicios.md | Select-Object -Skip 64 -First 40
Get-Content .\services\identity-service\src\main\java\com\ventapasajes\identity\persistence\entity\UserAccount.java
Get-Content .\services\quarkus-service-template\src\main\resources\application.properties
Get-Content .\services\dispatch-service\README.md
```

Comandos ejecutados - generacion del servicio:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\new-quarkus-service.ps1 -DryRun -ServiceName dispatch-service -PackageSegment dispatch -DatabaseName dispatch_db -HttpPort 8082
Get-ChildItem .\services\dispatch-service -Force | Select-Object Name,Mode,Length,LastWriteTime | Format-Table -AutoSize
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\new-quarkus-service.ps1 -ServiceName dispatch-service -PackageSegment dispatch -DatabaseName dispatch_db -HttpPort 8082
rg --files .\services\dispatch-service
```

Resultado generacion:

```json
{"service_name":"dispatch-service","package":"com.ventapasajes.dispatch","database_name":"dispatch_db","http_port":8082,"target_root":"C:\\VENTA-DE-PASAJES\\services\\dispatch-service","cloud_sql_iam_user":"dispatch-service-run@project-fbb34cd7-0b82-43e1-867.iam","local_database_user":"dispatch_user","secret_name":"dispatch-service__db-connection","api_base_path":"/api/v1/dispatch","dry_run":false}
```

Comandos ejecutados - creacion de paquetes:

```powershell
New-Item -ItemType Directory -Force -Path .\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\domain, .\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\persistence\entity, .\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\dto, .\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\service, .\services\dispatch-service\src\test\java\com\ventapasajes\dispatch\persistence | Out-Null
```

Comandos ejecutados - pruebas y build:

```powershell
mvn -f .\services\dispatch-service\pom.xml test
mvn -f .\services\dispatch-service\pom.xml package -DskipTests
```

Resultados de pruebas:

```text
Primer mvn test: fallo 1 prueba porque OpenAPI generaba `dispatch-service API` y la prueba esperaba `Dispatch Service API`.
Se agrego `quarkus.smallrye-openapi.info-title=Dispatch Service API`, `info-version=0.1.0` e `info-description=...` en application.properties.
Segundo mvn test: Tests run: 8, Failures: 0, Errors: 0, Skipped: 0, BUILD SUCCESS.
Validacion final mvn test: Tests run: 8, Failures: 0, Errors: 0, Skipped: 0, BUILD SUCCESS.
Package JVM: BUILD SUCCESS.
```

Comandos ejecutados - validacion local con PostgreSQL temporal:

```powershell
$Errors = $null; [System.Management.Automation.Language.Parser]::ParseFile((Resolve-Path .\scripts\verify-dispatch-service-local-db.ps1), [ref]$null, [ref]$Errors)
docker version
Get-Process -Name "Docker Desktop","com.docker.backend","com.docker.service" -ErrorAction SilentlyContinue | Select-Object ProcessName,Id,StartTime | Format-Table -AutoSize
Get-Service -Name "com.docker.service" -ErrorAction SilentlyContinue | Select-Object Name,Status,StartType | Format-Table -AutoSize
Test-Path "C:\Program Files\Docker\Docker\Docker Desktop.exe"
Start-Service -Name com.docker.service -ErrorAction SilentlyContinue; Start-Process -FilePath "C:\Program Files\Docker\Docker\Docker Desktop.exe" -WindowStyle Hidden; for ($i = 1; $i -le 60; $i++) { docker version *> $null; if ($LASTEXITCODE -eq 0) { Write-Output "Docker ready after $i checks"; exit 0 }; Start-Sleep -Seconds 2 }; Write-Output "Docker did not become ready"; exit 1
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-dispatch-service-local-db.ps1 -DatabasePort 55436 -HttpPort 18084
docker ps -a --filter "name=venta-pasajes-dispatch" --format "{{.Names}}"
Get-NetTCPConnection -LocalPort 18084,55436,8082 -ErrorAction SilentlyContinue | Select-Object LocalAddress,LocalPort,State,OwningProcess | Format-Table -AutoSize
Get-ChildItem .\services\dispatch-service\target | Select-Object Name,Length,LastWriteTime | Format-Table -AutoSize
```

Resultado validacion local:

```text
Primer intento de validacion local fallo porque Docker Desktop no estaba levantado: dockerDesktopLinuxEngine no encontrado.
Se inicio Docker Desktop; Docker quedo listo after 3 checks.
Segundo intento fallo por una verificacion fragil del YAML OpenAPI en el script.
Se cambio `Invoke-WebRequest` por `Invoke-RestMethod` en `verify-dispatch-service-local-db.ps1`.
Validacion final OK.
```

Salida final:

```json
{"service":"dispatch-service","quarkus_profile":"onprem","secrets_provider":"env","database":"dispatch_db","migration_tool":"flyway","database_port":55436,"http_port":18084,"health_ready":"UP","dispatch_tables":8,"resources_count":6,"departure_statuses_count":4,"seat_positions_count":5,"openapi_title":"Dispatch Service API","container":"venta-pasajes-dispatch-pg-<pid>","ready":true}
```

Comandos HTTP/HTTPS documentados para copiar con `curl.exe`:

```powershell
curl.exe -s "http://localhost:18084/q/health/ready"
curl.exe -s "http://localhost:18084/api/v1/dispatch/health"
curl.exe -s "http://localhost:18084/api/v1/dispatch"
curl.exe -s "http://localhost:18084/api/v1/dispatch/resources"
curl.exe -s "http://localhost:18084/api/v1/dispatch/departure-statuses"
curl.exe -s "http://localhost:18084/api/v1/dispatch/seat-positions"
curl.exe -s "http://localhost:18084/q/openapi"
```

Comandos ejecutados - validacion de documentacion:

```powershell
rg -n "^# Dia 21|Reversa primero|Guia manual desde cero|Peticiones HTTP/HTTPS|mvn -f|curl\.exe|Verificacion local final|Criterio de avance" .\docs\dia-21-dispatch-service-base.md
rg -n "quarkus.smallrye-openapi.info-title|CREATE TABLE terminals|CREATE TABLE routes|CREATE TABLE bus_types|CREATE TABLE seat_layouts|CREATE TABLE buses|CREATE TABLE departures|DispatchBaseResource|DispatchMigrationContractTest" .\services\dispatch-service\src .\services\dispatch-service\README.md .\docs\dia-21-dispatch-service-base.md
Get-Content .\docs\dia-21-dispatch-service-base.md | Measure-Object -Line -Word -Character
```

Comandos internos relevantes ejecutados por `verify-dispatch-service-local-db.ps1`:

```powershell
docker run --rm --name venta-pasajes-dispatch-pg-<pid> -e POSTGRES_DB=dispatch_db -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=<temporary-local-password> -p 55436:5432 -d postgres:16-alpine
docker exec venta-pasajes-dispatch-pg-<pid> pg_isready -U postgres -d dispatch_db
Start-Process -FilePath "java" -ArgumentList @("-jar", "C:\VENTA-DE-PASAJES\services\dispatch-service\target\quarkus-app\quarkus-run.jar") -WindowStyle Hidden
Invoke-RestMethod -Uri http://localhost:18084/q/health/ready
Invoke-RestMethod -Uri http://localhost:18084/api/v1/dispatch/health
Invoke-RestMethod -Uri http://localhost:18084/api/v1/dispatch
Invoke-RestMethod -Uri http://localhost:18084/api/v1/dispatch/resources
Invoke-RestMethod -Uri http://localhost:18084/api/v1/dispatch/departure-statuses
Invoke-RestMethod -Uri http://localhost:18084/api/v1/dispatch/seat-positions
Invoke-RestMethod -Uri http://localhost:18084/q/openapi
docker exec -e PGPASSWORD=<temporary-local-password> venta-pasajes-dispatch-pg-<pid> psql -U postgres -d dispatch_db -tAc "select count(*) from information_schema.tables where table_schema = 'public' and table_name in ('terminals','routes','bus_types','seat_layouts','seat_layout_seats','buses','departures','outbox_events');"
docker stop venta-pasajes-dispatch-pg-<pid>
```

Validacion:

```text
dispatch-service generado desde plantilla: OK.
Migracion inicial del dominio despacho: OK.
Entidades base del dominio: OK.
Endpoints base: OK.
OpenAPI configurado: OK.
Pruebas Maven: OK.
Package JVM: OK.
Verificacion local con PostgreSQL temporal: OK.
Contenedores temporales: ninguno al cierre.
Puertos 18084, 55436 y 8082: libres al cierre.
No se registraron secretos reales.
```

Referencias tecnicas:

```text
Quarkus OpenAPI and Swagger UI: https://quarkus.io/guides/openapi-swaggerui/
```

Estado:

```text
Dia 21 completado.
El dominio de despacho/programacion esta creado.
Siguiente paso natural: Dia 22, terminales y rutas.
```

Validacion adicional de cierre:

```powershell
mvn -f .\services\dispatch-service\pom.xml test
docker ps -a --filter "name=venta-pasajes-dispatch" --format "{{.Names}}"
Get-NetTCPConnection -LocalPort 18084,55436,8082 -ErrorAction SilentlyContinue | Select-Object LocalAddress,LocalPort,State,OwningProcess | Format-Table -AutoSize
```

Resultado:

```text
Tests run: 8, Failures: 0, Errors: 0, Skipped: 0.
BUILD SUCCESS.
No quedaron contenedores temporales con nombre venta-pasajes-dispatch.
No quedaron listeners activos en los puertos 18084, 55436 ni 8082.
```

## Ajuste Dia 21 - correccion de conteo de pruebas dispatch-service

Motivo:

```text
El usuario indico que, siguiendo el documento del Dia 21, `mvn test` esperaba 8 pruebas pero en su ejecucion aparecian solo 4.
Se reviso el workspace y se encontro que `dispatch-service` estaba en estado parcial: solo existian 2 clases de prueba y faltaban varios archivos del dominio base creados originalmente en el Dia 21.
```

Comandos de diagnostico ejecutados:

```powershell
rg -n "Paso 8|Ejecutar pruebas Maven|DispatchBaseResourceTest|DispatchHealthResourceTest|DispatchMigrationContractTest|RuntimeProfileConfigurationTest|Tests run" .\docs\dia-21-dispatch-service-base.md
Get-ChildItem .\services\dispatch-service\src\test\java -Recurse -File | Select-Object FullName
mvn -f .\services\dispatch-service\pom.xml test
Get-ChildItem .\services\dispatch-service\src\test\java -Recurse -File | ForEach-Object { $_.FullName }
Get-ChildItem .\services\dispatch-service\src\main\java -Recurse -File | ForEach-Object { $_.FullName }
Test-Path .\services\dispatch-service\src\test\java\com\ventapasajes\dispatch\api\DispatchBaseResourceTest.java
Test-Path .\services\dispatch-service\src\test\java\com\ventapasajes\dispatch\persistence\DispatchMigrationContractTest.java
Test-Path .\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\DispatchBaseResource.java
```

Resultado del diagnostico:

```text
La ejecucion inicial reporto:
Tests run: 4, Failures: 0, Errors: 0, Skipped: 0.

Clases de prueba presentes antes del ajuste:
- RuntimeProfileConfigurationTest.java
- DispatchHealthResourceTest.java

Clases faltantes que explicaban la diferencia:
- DispatchBaseResourceTest.java, aporta 3 pruebas.
- DispatchMigrationContractTest.java, aporta 1 prueba.

Tambien faltaban:
- V1__dispatch_schema.sql
- DispatchBaseResource.java
- Enums de dominio.
- Entidades del dominio dispatch.
- DTOs.
- DispatchCatalogService.java.
```

Correccion aplicada:

```text
Se restauraron los archivos faltantes de `dispatch-service`.
Se actualizo OpenAPI para volver a mostrar `Dispatch Service API`.
Se agregaron las propiedades de OpenAPI, Flyway baseline y recursos nativos en `application.properties`.
Se repusieron las pruebas faltantes del endpoint base y del contrato de migracion.
```

Archivos restaurados o actualizados:

```text
C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\resources\db\migration\V1__dispatch_schema.sql
C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\domain\DepartureStatus.java
C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\domain\SeatPosition.java
C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\persistence\entity\Terminal.java
C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\persistence\entity\DispatchRoute.java
C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\persistence\entity\BusType.java
C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\persistence\entity\SeatLayout.java
C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\persistence\entity\SeatLayoutSeat.java
C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\persistence\entity\Bus.java
C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\persistence\entity\Departure.java
C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\dto\DispatchResourceResponse.java
C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\dto\DispatchOverviewResponse.java
C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\service\DispatchCatalogService.java
C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\DispatchBaseResource.java
C:\VENTA-DE-PASAJES\services\dispatch-service\src\test\java\com\ventapasajes\dispatch\api\DispatchBaseResourceTest.java
C:\VENTA-DE-PASAJES\services\dispatch-service\src\test\java\com\ventapasajes\dispatch\persistence\DispatchMigrationContractTest.java
C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\DispatchOpenApiConfiguration.java
C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\resources\application.properties
C:\VENTA-DE-PASAJES\services\dispatch-service\src\test\java\com\ventapasajes\dispatch\api\DispatchHealthResourceTest.java
C:\VENTA-DE-PASAJES\services\dispatch-service\src\test\java\com\ventapasajes\dispatch\RuntimeProfileConfigurationTest.java
```

Comandos de verificacion ejecutados despues del ajuste:

```powershell
mvn -f .\services\dispatch-service\pom.xml test
Get-ChildItem .\services\dispatch-service\src\test\java -Recurse -File | ForEach-Object { $_.FullName }
Get-ChildItem .\services\dispatch-service\src\main\java\com\ventapasajes\dispatch -Recurse -File | Measure-Object
```

Resultado:

```text
Maven compilo 19 archivos fuente.
Maven compilo 4 archivos de prueba.

DispatchBaseResourceTest: Tests run: 3, Failures: 0, Errors: 0, Skipped: 0.
DispatchHealthResourceTest: Tests run: 3, Failures: 0, Errors: 0, Skipped: 0.
RuntimeProfileConfigurationTest: Tests run: 1, Failures: 0, Errors: 0, Skipped: 0.
DispatchMigrationContractTest: Tests run: 1, Failures: 0, Errors: 0, Skipped: 0.

Total final:
Tests run: 8, Failures: 0, Errors: 0, Skipped: 0.
BUILD SUCCESS.
```

Explicacion corta para el usuario:

```text
El documento no estaba equivocado para el estado final del Dia 21.
El problema era que el servicio local estaba incompleto.
Con solo dos clases de prueba Maven sumaba 4.
Al restaurar las dos clases faltantes y los archivos base del dominio, Maven vuelve a reportar 8 pruebas.
```

Actualizacion del documento Dia 21:

```text
Se agrego una nota en el Paso 8 explicando por que puede aparecer `Tests run: 4` y como verificar que existan las 4 clases de prueba esperadas.
```

Comando documentado:

```powershell
Get-ChildItem .\services\dispatch-service\src\test\java -Recurse -File | Select-Object FullName
```

## Dia 22 - Terminales y rutas

Objetivo:

```text
Implementar CRUD de terminales y rutas en dispatch-service.
Validar duplicados.
Agregar busquedas y filtros.
Agregar auditoria de cambios importantes.
```

Comandos de exploracion ejecutados:

```powershell
rg -n "Dia 22|Dia 22|terminales|rutas|routes|terminals" .\tareas.md .\docs .\services\dispatch-service
Get-ChildItem .\services\dispatch-service -Recurse -File | Select-Object FullName
Get-Content .\vitacora.md -Tail 160
Get-Content .\tareas.md | Select-Object -Skip 900 -First 70
Get-ChildItem .\services\identity-service\src\main\java -Recurse -File | Select-Object FullName
Get-Content .\docs\openapi\dispatch-service.openapi.yaml
Get-Content .\docs\estandar-documentacion-dias.md
Get-Content .\services\identity-service\src\main\java\com\ventapasajes\identity\api\ApiException.java
Get-Content .\services\identity-service\src\main\java\com\ventapasajes\identity\api\ApiExceptionMapper.java
Get-Content .\services\identity-service\src\main\java\com\ventapasajes\identity\api\ApiErrorResponse.java
Get-Content .\services\identity-service\src\main\java\com\ventapasajes\identity\service\IdentityApplicationService.java
Get-Content .\scripts\verify-dispatch-service-local-db.ps1
Get-Content .\services\dispatch-service\README.md
Get-ChildItem .\services\dispatch-service\src\main\java\com\ventapasajes\dispatch -Directory | Select-Object FullName
```

Archivos creados o modificados:

```text
C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\ApiErrorResponse.java
C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\ApiException.java
C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\ApiExceptionMapper.java
C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\TerminalResource.java
C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\RouteResource.java
C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\dto\PageMeta.java
C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\dto\PageResponse.java
C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\dto\TerminalCreateRequest.java
C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\dto\TerminalUpdateRequest.java
C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\dto\TerminalResponse.java
C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\dto\RouteCreateRequest.java
C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\dto\RouteUpdateRequest.java
C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\dto\RouteResponse.java
C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\service\AuditContext.java
C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\service\DispatchAuditService.java
C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\service\TerminalRouteService.java
C:\VENTA-DE-PASAJES\services\dispatch-service\src\test\java\com\ventapasajes\dispatch\service\TerminalRouteServiceTest.java
C:\VENTA-DE-PASAJES\services\dispatch-service\src\test\java\com\ventapasajes\dispatch\api\DispatchHealthResourceTest.java
C:\VENTA-DE-PASAJES\scripts\verify-dispatch-terminals-routes.ps1
C:\VENTA-DE-PASAJES\services\dispatch-service\README.md
C:\VENTA-DE-PASAJES\docs\openapi\dispatch-service.openapi.yaml
C:\VENTA-DE-PASAJES\docs\dia-22-terminales-rutas.md
```

Funcionalidad implementada:

```text
Terminales:
- GET /api/v1/dispatch/terminals
- POST /api/v1/dispatch/terminals
- GET /api/v1/dispatch/terminals/{terminalId}
- PATCH /api/v1/dispatch/terminals/{terminalId}
- DELETE /api/v1/dispatch/terminals/{terminalId}

Rutas:
- GET /api/v1/dispatch/routes
- POST /api/v1/dispatch/routes
- GET /api/v1/dispatch/routes/{routeId}
- PATCH /api/v1/dispatch/routes/{routeId}
- DELETE /api/v1/dispatch/routes/{routeId}
```

Validaciones implementadas:

```text
- Terminal con `name` obligatorio.
- Terminal no duplicada por `name`.
- Terminal no duplicada por `local_code`.
- Terminal no duplicada por `legacy_id`.
- Ruta con `origin_terminal_id` obligatorio.
- Ruta con `destination_terminal_id` obligatorio.
- Ruta con origen y destino diferentes.
- Ruta no duplicada por pareja origen/destino.
- Paginacion con page >= 1.
- page_size entre 1 y 100.
```

Auditoria:

```text
Se registran cambios importantes en `dispatch_db.outbox_events`.

Eventos:
- TERMINAL_CREATED
- TERMINAL_UPDATED
- TERMINAL_DEACTIVATED
- ROUTE_CREATED
- ROUTE_UPDATED
- ROUTE_DEACTIVATED

Headers opcionales:
- X-Actor-User-Id
- X-Correlation-Id
```

Comando de pruebas unitarias ejecutado:

```powershell
mvn -f .\services\dispatch-service\pom.xml test
```

Resultado:

```text
Maven compilo 35 archivos fuente.
Maven compilo 5 archivos de prueba.

DispatchBaseResourceTest: Tests run: 3, Failures: 0, Errors: 0, Skipped: 0.
DispatchHealthResourceTest: Tests run: 3, Failures: 0, Errors: 0, Skipped: 0.
RuntimeProfileConfigurationTest: Tests run: 1, Failures: 0, Errors: 0, Skipped: 0.
DispatchMigrationContractTest: Tests run: 1, Failures: 0, Errors: 0, Skipped: 0.
TerminalRouteServiceTest: Tests run: 4, Failures: 0, Errors: 0, Skipped: 0.

Total final:
Tests run: 12, Failures: 0, Errors: 0, Skipped: 0.
BUILD SUCCESS.
```

Comando de empaquetado normal ejecutado:

```powershell
mvn -f .\services\dispatch-service\pom.xml package -DskipTests
```

Resultado:

```text
BUILD FAILURE.
Windows mantuvo bloqueado:
C:\VENTA-DE-PASAJES\services\dispatch-service\target\quarkus-app\quarkus\generated-bytecode.jar

Error:
El proceso no tiene acceso al archivo porque esta siendo utilizado por otro proceso.
```

Comandos de diagnostico del bloqueo:

```powershell
Get-CimInstance Win32_Process -Filter "name = 'java.exe'" | Select-Object ProcessId,CommandLine | Format-List
Get-Process -Name java -ErrorAction SilentlyContinue | Select-Object Id,StartTime,Path | Format-Table -AutoSize
Test-Path .\services\dispatch-service\target\quarkus-app\quarkus\generated-bytecode.jar
Get-CimInstance Win32_Process -Filter "ProcessId = 36388" | Select-Object ProcessId,ParentProcessId,ExecutablePath,CommandLine,CreationDate | Format-List
Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $_.OwningProcess -eq 36388 } | Select-Object LocalAddress,LocalPort,State,OwningProcess | Format-Table -AutoSize
Get-CimInstance Win32_Process -Filter "ProcessId = 25448 or ProcessId = 67356 or ProcessId = 36388" | ForEach-Object { $parent = Get-CimInstance Win32_Process -Filter "ProcessId = $($_.ParentProcessId)" -ErrorAction SilentlyContinue; [pscustomobject]@{ ProcessId = $_.ProcessId; ParentProcessId = $_.ParentProcessId; ParentName = $parent.Name; CommandLine = $_.CommandLine } } | Format-List
Stop-Process -Id 36388 -Force
```

Resultado del diagnostico:

```text
Se detecto un proceso Java escuchando en 18084.
Ese puerto fue usado por una validacion temporal anterior de dispatch-service.
No se pudo detener desde esta terminal: Acceso denegado.
No se elimino manualmente el archivo bloqueado.
```

Comando de empaquetado alternativo ejecutado:

```powershell
mvn -f .\services\dispatch-service\pom.xml package -DskipTests "-Dquarkus.package.output-directory=quarkus-app-day22"
```

Resultado:

```text
BUILD SUCCESS.
Quarkus augmentation completed.
Artefacto generado:
C:\VENTA-DE-PASAJES\services\dispatch-service\target\quarkus-app-day22\quarkus-run.jar
```

Comando para ubicar artefactos:

```powershell
Get-ChildItem .\services\dispatch-service -Recurse -Filter quarkus-run.jar | Select-Object FullName,Length,LastWriteTime | Format-Table -AutoSize
```

Resultado:

```text
C:\VENTA-DE-PASAJES\services\dispatch-service\target\quarkus-app\quarkus-run.jar
C:\VENTA-DE-PASAJES\services\dispatch-service\target\quarkus-app-day22\quarkus-run.jar
```

Comando de validacion de sintaxis del script:

```powershell
$Errors = $null; [System.Management.Automation.Language.Parser]::ParseFile((Resolve-Path .\scripts\verify-dispatch-terminals-routes.ps1), [ref]$null, [ref]$Errors) | Out-Null; if ($Errors.Count -gt 0) { $Errors | Format-List; exit 1 } else { Write-Output 'verify-dispatch-terminals-routes.ps1 -> OK' }
```

Resultado:

```text
verify-dispatch-terminals-routes.ps1 -> OK
```

Comando de validacion practica ejecutado:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-dispatch-terminals-routes.ps1 -DatabasePort 55437 -HttpPort 18085
```

Resultado:

```json
{"service":"dispatch-service","validation":"terminals-routes-crud","quarkus_profile":"onprem","secrets_provider":"env","database":"dispatch_db","database_port":55437,"http_port":18085,"jar":"C:\\VENTA-DE-PASAJES\\services\\dispatch-service\\target\\quarkus-app-day22\\quarkus-run.jar","created_terminals":2,"created_routes":1,"inactive_terminals":2,"inactive_routes":1,"audit_events":8,"duplicate_terminal_status":409,"duplicate_route_status":409,"invalid_route_status":400,"ready":true}
```

Comandos internos relevantes ejecutados por `verify-dispatch-terminals-routes.ps1`:

```powershell
docker run --rm --name venta-pasajes-dispatch-crud-pg-<pid> -e POSTGRES_DB=dispatch_db -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=<temporary-local-password> -p 55437:5432 -d postgres:16-alpine
docker exec venta-pasajes-dispatch-crud-pg-<pid> pg_isready -U postgres -d dispatch_db
Start-Process -FilePath "java" -ArgumentList @("-jar", "C:\VENTA-DE-PASAJES\services\dispatch-service\target\quarkus-app-day22\quarkus-run.jar") -WindowStyle Hidden
Invoke-RestMethod -Uri http://localhost:18085/q/health/ready
Invoke-RestMethod -Method POST -Uri http://localhost:18085/api/v1/dispatch/terminals
Invoke-RestMethod -Method GET -Uri http://localhost:18085/api/v1/dispatch/terminals?q=quitumbe&active=true&page=1&page_size=10
Invoke-RestMethod -Method PATCH -Uri http://localhost:18085/api/v1/dispatch/terminals/<terminal-id>
Invoke-RestMethod -Method POST -Uri http://localhost:18085/api/v1/dispatch/routes
Invoke-RestMethod -Method GET -Uri http://localhost:18085/api/v1/dispatch/routes?origin_terminal_id=<terminal-id>&active=true&page=1&page_size=10
Invoke-RestMethod -Method PATCH -Uri http://localhost:18085/api/v1/dispatch/routes/<route-id>
Invoke-RestMethod -Method DELETE -Uri http://localhost:18085/api/v1/dispatch/routes/<route-id>
Invoke-RestMethod -Method DELETE -Uri http://localhost:18085/api/v1/dispatch/terminals/<terminal-id>
docker exec -e PGPASSWORD=<temporary-local-password> venta-pasajes-dispatch-crud-pg-<pid> psql -U postgres -d dispatch_db -tAc "select count(*) from outbox_events where event_type in ('TERMINAL_CREATED','TERMINAL_UPDATED','TERMINAL_DEACTIVATED','ROUTE_CREATED','ROUTE_UPDATED','ROUTE_DEACTIVATED');"
docker stop venta-pasajes-dispatch-crud-pg-<pid>
```

Comandos HTTP/HTTPS documentados para copiar con `curl.exe`:

```powershell
curl.exe -s -X POST "$baseUrl/terminals" -H "Content-Type: application/json" -H "X-Actor-User-Id: $actorId" -H "X-Correlation-Id: $correlationId" -d "{\"legacy_id\":2201,\"local_code\":\"UIO\",\"name\":\"Terminal Quitumbe\",\"manager_name\":\"Operador Norte\",\"address\":\"Av. Quitumbe\",\"phone\":\"022000001\",\"email\":\"quitumbe@example.local\"}"
curl.exe -s -X POST "$baseUrl/terminals" -H "Content-Type: application/json" -H "X-Actor-User-Id: $actorId" -H "X-Correlation-Id: $correlationId" -d "{\"legacy_id\":2202,\"local_code\":\"GYE\",\"name\":\"Terminal Guayaquil\",\"manager_name\":\"Operador Costa\",\"address\":\"Av. Terminal\",\"phone\":\"042000001\",\"email\":\"guayaquil@example.local\"}"
curl.exe -s -X GET "$baseUrl/terminals?page=1&page_size=10"
curl.exe -s -X GET "$baseUrl/terminals?q=quitumbe&active=true&page=1&page_size=10"
curl.exe -s -X GET "$baseUrl/terminals/$($origin.id)"
curl.exe -s -X PATCH "$baseUrl/terminals/$($origin.id)" -H "Content-Type: application/json" -H "X-Actor-User-Id: $actorId" -H "X-Correlation-Id: $correlationId" -d "{\"manager_name\":\"Operador Sierra\",\"phone\":\"022000099\"}"
curl.exe -i -X POST "$baseUrl/terminals" -H "Content-Type: application/json" -H "X-Actor-User-Id: $actorId" -H "X-Correlation-Id: $correlationId" -d "{\"local_code\":\"UIO-2\",\"name\":\"terminal quitumbe\"}"
curl.exe -s -X POST "$baseUrl/routes" -H "Content-Type: application/json" -H "X-Actor-User-Id: $actorId" -H "X-Correlation-Id: $correlationId" -d "{\"origin_terminal_id\":\"$($origin.id)\",\"destination_terminal_id\":\"$($destination.id)\"}"
curl.exe -s -X GET "$baseUrl/routes?page=1&page_size=10"
curl.exe -s -X GET "$baseUrl/routes?origin_terminal_id=$($origin.id)&active=true&page=1&page_size=10"
curl.exe -s -X GET "$baseUrl/routes/$($route.id)"
curl.exe -s -X PATCH "$baseUrl/routes/$($route.id)" -H "Content-Type: application/json" -H "X-Actor-User-Id: $actorId" -H "X-Correlation-Id: $correlationId" -d "{\"name\":\"Quito - Guayaquil Express\"}"
curl.exe -i -X POST "$baseUrl/routes" -H "Content-Type: application/json" -H "X-Actor-User-Id: $actorId" -H "X-Correlation-Id: $correlationId" -d "{\"origin_terminal_id\":\"$($origin.id)\",\"destination_terminal_id\":\"$($origin.id)\"}"
curl.exe -i -X POST "$baseUrl/routes" -H "Content-Type: application/json" -H "X-Actor-User-Id: $actorId" -H "X-Correlation-Id: $correlationId" -d "{\"origin_terminal_id\":\"$($origin.id)\",\"destination_terminal_id\":\"$($destination.id)\",\"name\":\"Duplicada\"}"
curl.exe -i -X DELETE "$baseUrl/routes/$($route.id)" -H "X-Actor-User-Id: $actorId" -H "X-Correlation-Id: $correlationId"
curl.exe -s -X GET "$baseUrl/routes?active=false&page=1&page_size=10"
curl.exe -i -X DELETE "$baseUrl/terminals/$($origin.id)" -H "X-Actor-User-Id: $actorId" -H "X-Correlation-Id: $correlationId"
curl.exe -i -X DELETE "$baseUrl/terminals/$($destination.id)" -H "X-Actor-User-Id: $actorId" -H "X-Correlation-Id: $correlationId"
curl.exe -s "http://localhost:18085/q/openapi"
```

Comandos de verificacion de limpieza ejecutados:

```powershell
docker ps -a --filter "name=venta-pasajes-dispatch-crud" --format "{{.Names}}"
Get-NetTCPConnection -LocalPort 18085,55437 -ErrorAction SilentlyContinue | Select-Object LocalAddress,LocalPort,State,OwningProcess | Format-Table -AutoSize
Get-Content .\services\dispatch-service\target\dispatch-service-terminals-routes.err.log -Tail 60
```

Resultado:

```text
No quedaron contenedores temporales `venta-pasajes-dispatch-crud`.
No quedaron listeners activos en 18085 ni 55437.
No hubo errores en stderr del servicio durante la validacion.
```

Estado:

```text
Dia 22 completado.
Las APIs de terminales y rutas estan implementadas y validadas.
El sistema puede administrar origenes y destinos.
Siguiente paso natural: Dia 23 - Tipos de bus, buses y layouts.
```

Validacion final adicional del Dia 22:

```powershell
mvn -f .\services\dispatch-service\pom.xml test
rg -n "^# Dia 22|Reversa primero|Guia manual desde cero|Peticiones HTTP/HTTPS|Estado final|Dia 22 completado" .\docs\dia-22-terminales-rutas.md .\vitacora.md
rg -n "class TerminalResource|class RouteResource|class TerminalRouteService|class DispatchAuditService|TerminalRouteServiceTest|/api/v1/dispatch/terminals|/api/v1/dispatch/routes" .\services\dispatch-service\src .\services\dispatch-service\README.md .\docs\openapi\dispatch-service.openapi.yaml
docker ps -a --filter "name=venta-pasajes-dispatch-crud" --format "{{.Names}}"
Get-NetTCPConnection -LocalPort 18085,55437 -ErrorAction SilentlyContinue | Select-Object LocalAddress,LocalPort,State,OwningProcess | Format-Table -AutoSize
```

Resultado:

```text
Tests run: 12, Failures: 0, Errors: 0, Skipped: 0.
BUILD SUCCESS.
Documento Dia 22 contiene reversa, guia manual, curl.exe y estado final.
README y OpenAPI estatico contienen rutas de terminales y rutas.
No quedaron contenedores temporales `venta-pasajes-dispatch-crud`.
No quedaron listeners activos en los puertos 18085 ni 55437.
```

## Ajuste documentacion Dia 22 - infraestructura comun de errores

Motivo:

```text
El usuario indico que el Paso 3 decia "Crear infraestructura comun de errores", pero no mostraba comandos que crearan archivos o carpetas.
```

Correccion:

```text
Se aclaro que "infraestructura" significa codigo comun dentro del microservicio, no infraestructura cloud.
Se agregaron comandos PowerShell para crear o confirmar la carpeta, crear los archivos Java y verificar su existencia.
```

Comandos agregados al documento:

```powershell
New-Item -ItemType Directory -Force -Path .\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api
New-Item -ItemType File -Force -Path .\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\ApiErrorResponse.java
New-Item -ItemType File -Force -Path .\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\ApiException.java
New-Item -ItemType File -Force -Path .\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\ApiExceptionMapper.java
Test-Path .\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\ApiErrorResponse.java
Test-Path .\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\ApiException.java
Test-Path .\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\ApiExceptionMapper.java
```

## Ajuste documentacion Dia 22 - ruta del artefacto Quarkus

Motivo:

```text
El usuario detecto una inconsistencia en el Paso 10: ejecuto el empaquetado normal con `mvn -f .\services\dispatch-service\pom.xml package -DskipTests`, obtuvo BUILD SUCCESS, pero el documento le pedia verificar `target\quarkus-app-day22\quarkus-run.jar`.
```

Diagnostico ejecutado:

```powershell
Test-Path .\services\dispatch-service\target\quarkus-app\quarkus-run.jar
Test-Path .\services\dispatch-service\target\quarkus-app-day22\quarkus-run.jar
rg -n "quarkus-app-day22|Paso 10 - Empaquetar|jarPath|verify-dispatch-terminals-routes" .\docs\dia-22-terminales-rutas.md .\services\dispatch-service\README.md .\scripts\verify-dispatch-terminals-routes.ps1
```

Resultado:

```text
target\quarkus-app\quarkus-run.jar: True
target\quarkus-app-day22\quarkus-run.jar: False
```

Correccion aplicada:

```text
Se actualizo `dia-22-terminales-rutas.md` para indicar que:
- Si el empaquetado normal termina en BUILD SUCCESS, se debe usar `target\quarkus-app\quarkus-run.jar`.
- Si el empaquetado normal falla por bloqueo de Windows, se puede usar la salida alterna `target\quarkus-app-day22\quarkus-run.jar`.
- No deben existir necesariamente las dos carpetas.

Se actualizo `README.md` con la misma aclaracion.
Se actualizo `verify-dispatch-terminals-routes.ps1` para detectar automaticamente el JAR mas reciente entre salida normal y alterna.
```

Validacion ejecutada:

```powershell
$Errors = $null; [System.Management.Automation.Language.Parser]::ParseFile((Resolve-Path .\scripts\verify-dispatch-terminals-routes.ps1), [ref]$null, [ref]$Errors) | Out-Null; if ($Errors.Count -gt 0) { $Errors | Format-List; exit 1 } else { Write-Output 'verify-dispatch-terminals-routes.ps1 -> OK' }
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-dispatch-terminals-routes.ps1 -DatabasePort 55437 -HttpPort 18085
docker ps -a --filter "name=venta-pasajes-dispatch-crud" --format "{{.Names}}"
Get-NetTCPConnection -LocalPort 18085,55437 -ErrorAction SilentlyContinue | Select-Object LocalAddress,LocalPort,State,OwningProcess | Format-Table -AutoSize
```

Resultado:

```json
{"service":"dispatch-service","validation":"terminals-routes-crud","quarkus_profile":"onprem","secrets_provider":"env","database":"dispatch_db","database_port":55437,"http_port":18085,"jar":"C:\\VENTA-DE-PASAJES\\services\\dispatch-service\\target\\quarkus-app\\quarkus-run.jar","created_terminals":2,"created_routes":1,"inactive_terminals":2,"inactive_routes":1,"audit_events":8,"duplicate_terminal_status":409,"duplicate_route_status":409,"invalid_route_status":400,"ready":true}
```

Estado:

```text
La inconsistencia quedo corregida.
La validacion practica ahora usa correctamente la salida normal `target\quarkus-app\quarkus-run.jar`.
No quedaron contenedores temporales ni puertos 18085/55437 activos.
```

## Ajuste documentacion Dia 22 - curl.exe en PowerShell

Motivo:

```text
El usuario ejecuto el ejemplo de crear terminal origen y PowerShell quedo en prompt `>>`, sin retornar nada.
La causa fue el uso de JSON con comillas escapadas como `\"`, estilo comun en Bash, pero problematico en PowerShell.
```

Correccion:

```text
Se actualizaron los ejemplos `curl.exe` del Dia 22 y del README de dispatch-service.
Ahora los cuerpos JSON se construyen con hashtables PowerShell y `ConvertTo-Json -Compress`.
Luego se envian a `curl.exe` con `--data-raw`.
Tambien se agrego una nota indicando que si aparece `>>`, se debe cancelar con Ctrl+C.
```

Comandos de diagnostico y verificacion ejecutados:

```powershell
Get-Content .\docs\dia-22-terminales-rutas.md | Select-Object -Skip 590 -First 230
Get-Content .\services\dispatch-service\README.md | Select-Object -Skip 100 -First 70
rg -n --fixed-strings -- '-d "{\"' .\docs\dia-22-terminales-rutas.md .\services\dispatch-service\README.md
rg -n "originBody|destinationBody|updateTerminalBody|routeBody|duplicateRouteBody|--data-raw" .\docs\dia-22-terminales-rutas.md .\services\dispatch-service\README.md
$Errors = $null; [System.Management.Automation.Language.Parser]::ParseFile((Resolve-Path .\scripts\verify-dispatch-terminals-routes.ps1), [ref]$null, [ref]$Errors) | Out-Null; if ($Errors.Count -gt 0) { $Errors | Format-List; exit 1 } else { Write-Output 'verify-dispatch-terminals-routes.ps1 -> OK' }
```

Resultado:

```text
No quedan ejemplos principales con `-d "{\"...`.
Los ejemplos ahora usan `--data-raw $originBody`, `--data-raw $destinationBody`, `--data-raw $routeBody` y variables similares.
El script `verify-dispatch-terminals-routes.ps1` sigue con sintaxis OK.
```

## Ajuste documentacion Dia 22 - diagnostico de curl sin respuesta

Motivo:

```text
El usuario ejecuto el bloque corregido para crear terminal origen.
PowerShell ya no quedo atrapado en `>>`, pero `$origin` no mostro ningun contenido.
La causa mas probable es que `curl.exe -s` oculto el error real porque `$baseUrl` estaba vacio o el servicio no estaba levantado en 18085.
```

Correccion:

```text
Se agrego una comprobacion previa de variables y salud del servicio antes de crear registros.
Se aclaro que el script `verify-dispatch-terminals-routes.ps1` levanta el servicio solo temporalmente y lo detiene al final.
Se agrego un comando de diagnostico sin modo silencioso para ver HTTP status o error de conexion.
Se cambio el ejemplo principal de creacion a `curl.exe -sS` para mantener salida compacta pero mostrar errores.
```

Comandos agregados al documento:

```powershell
$baseUrl
$actorId
$correlationId
curl.exe -i -S "$baseUrl/health"
curl.exe -i -S -X POST "$baseUrl/terminals" -H "Content-Type: application/json" -H "X-Actor-User-Id: $actorId" -H "X-Correlation-Id: $correlationId" --data-raw $originBody
$LASTEXITCODE
```

## Ajuste Dia 22 - curl.exe con archivo JSON y error 400 legible

Motivo:

```text
El usuario ejecuto nuevamente la creacion de terminal origen con `curl.exe -sS ... --data-raw $originBody | ConvertFrom-Json`.
PowerShell no mostro contenido en `$origin`.
Al ejecutar el diagnostico con encabezados se observo `HTTP/1.1 400 Bad Request` y `content-length: 0`.
Tambien se aclaro que la variable correcta es `$LASTEXITCODE`, no `$LASTEXISTCODE`.
```

Diagnostico ejecutado:

```powershell
Test-Path .\scripts\tmp-curl-probe.ps1
Get-Content .\scripts\tmp-curl-probe.ps1 -Tail 120
$Errors = $null; [System.Management.Automation.Language.Parser]::ParseFile((Resolve-Path .\scripts\tmp-curl-probe.ps1), [ref]$null, [ref]$Errors) | Out-Null; if ($Errors.Count -gt 0) { $Errors | Format-List; exit 1 } else { Write-Output 'tmp-curl-probe.ps1 -> OK' }
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\tmp-curl-probe.ps1
curl.exe -sS "http://localhost:18085/api/v1/dispatch/terminals?page=1&page_size=100"
docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Ports}}"
rg -n "@Path|RouteResource|ApiExceptionMapper|ApiErrorResponse" .\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api
```

Resultado del diagnostico:

```text
Invoke-RestMethod creo correctamente una terminal.
curl.exe con `--data-raw $body` devolvio HTTP 400.
curl.exe con `--data-binary "@archivo.json"` creo correctamente una terminal.
Conclusion: en Windows PowerShell es mas estable guardar el JSON en un archivo temporal y enviarlo con `--data-binary`.
```

Cambios aplicados:

```text
Se actualizo `C:\VENTA-DE-PASAJES\docs\dia-22-terminales-rutas.md`.
Se actualizo `C:\VENTA-DE-PASAJES\services\dispatch-service\README.md`.
Se agrego `C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\BadRequestExceptionMapper.java`.
Se agrego `C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\EmptyBadRequestResponseFilter.java`.
Se agrego `C:\VENTA-DE-PASAJES\services\dispatch-service\src\test\java\com\ventapasajes\dispatch\api\ApiBadRequestMapperTest.java`.
Se elimino el script temporal `C:\VENTA-DE-PASAJES\scripts\tmp-curl-probe.ps1`.
```

Comando HTTP robusto documentado:

```powershell
$originBody = @{
  legacy_id = 2201
  local_code = "UIO"
  name = "Terminal Quitumbe"
  manager_name = "Operador Norte"
  address = "Av. Quitumbe"
  phone = "022000001"
  email = "quitumbe@example.local"
} | ConvertTo-Json -Compress

$originBodyPath = Join-Path $env:TEMP "dispatch-origin-terminal.json"
$originBody | Set-Content -LiteralPath $originBodyPath -Encoding ascii

$origin = curl.exe -sS -X POST "$baseUrl/terminals" `
  -H "Content-Type: application/json" `
  -H "X-Actor-User-Id: $actorId" `
  -H "X-Correlation-Id: $correlationId" `
  --data-binary "@$originBodyPath" |
  ConvertFrom-Json

$origin
```

Validacion ejecutada:

```powershell
rg -n "data-binary|LASTEXITCODE|content-length|EmptyBadRequest|BadRequestExceptionMapper|ApiBadRequestMapperTest|--data-raw" .\docs\dia-22-terminales-rutas.md .\services\dispatch-service\README.md .\services\dispatch-service\src\main\java .\services\dispatch-service\src\test\java
Test-Path .\scripts\tmp-curl-probe.ps1
mvn -f .\services\dispatch-service\pom.xml test
```

Resultado:

```text
El script temporal ya no existe.
Las pruebas Maven pasaron correctamente.
Tests run: 13, Failures: 0, Errors: 0, Skipped: 0
BUILD SUCCESS
```

## Cierre cronologico Dia 23 - Tipos de bus, buses y layouts

Fecha: 2026-09-09

Resumen final del avance:

```text
Se completo el Dia 23.
Se implemento el dominio de flota base en dispatch-service.
El sistema ahora puede modelar tipos de bus, buses y layouts de asientos sin depender de botones fijos del formulario VB6.
```

Archivos principales:

```text
C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\service\BusFleetService.java
C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\resources\db\migration\V2__dispatch_seed_legacy_25_seat_layout.sql
C:\VENTA-DE-PASAJES\services\dispatch-service\src\test\java\com\ventapasajes\dispatch\service\BusFleetServiceTest.java
C:\VENTA-DE-PASAJES\scripts\verify-dispatch-buses-layouts.ps1
C:\VENTA-DE-PASAJES\docs\dia-23-buses-layouts.md
C:\VENTA-DE-PASAJES\docs\openapi\dispatch-service.openapi.yaml
C:\VENTA-DE-PASAJES\services\dispatch-service\README.md
```

Comandos finales ejecutados:

```powershell
mvn -f .\services\dispatch-service\pom.xml test
mvn -f .\services\dispatch-service\pom.xml package -DskipTests "-Dquarkus.package.output-directory=quarkus-app-day23"
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-dispatch-buses-layouts.ps1 -DatabasePort 55438 -HttpPort 18086
Get-NetTCPConnection -LocalPort 18086,55438 -ErrorAction SilentlyContinue | Select-Object LocalAddress,LocalPort,State,OwningProcess | Format-Table -AutoSize
docker ps -a --filter "name=venta-pasajes-dispatch-buses-layouts" --format "{{.Names}}"
Test-Path .\services\dispatch-service\target\quarkus-app-day23\quarkus-run.jar
```

Resultado final:

```text
Pruebas Maven: Tests run: 19, Failures: 0, Errors: 0, Skipped: 0, BUILD SUCCESS.
Validacion Docker/PostgreSQL: ready=true, seed_layout=Legacy 25 asientos, seed_seats=25, audit_events=11.
No quedaron listeners en 18086 ni 55438.
No quedaron contenedores temporales venta-pasajes-dispatch-buses-layouts.
Existe target\quarkus-app-day23\quarkus-run.jar: True.
```

## Cierre cronologico final Dia 24 - Salidas programadas

Fecha: 2026-09-10

Resumen:

```text
Se completo el Dia 24 con CRUD de salidas programadas en dispatch-service.
Las salidas quedan asociadas a ruta y bus.
El servicio valida fecha futura y evita que el mismo bus tenga salidas duplicadas en el mismo horario.
Al crear una salida se registra el evento DepartureScheduled en outbox_events.
```

Comandos finales ejecutados:

```powershell
mvn -f .\services\dispatch-service\pom.xml test
mvn -f .\services\dispatch-service\pom.xml package -DskipTests "-Dquarkus.package.output-directory=quarkus-app-day24"
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-dispatch-departures.ps1 -DatabasePort 55439 -HttpPort 18087
Get-NetTCPConnection -LocalPort 18087,55439 -ErrorAction SilentlyContinue | Select-Object LocalAddress,LocalPort,State,OwningProcess | Format-Table -AutoSize
docker ps -a --filter "name=venta-pasajes-dispatch-departures" --format "{{.Names}}"
Test-Path .\services\dispatch-service\target\quarkus-app-day24\quarkus-run.jar
```

Resultado final:

```text
Pruebas Maven: Tests run: 24, Failures: 0, Errors: 0, Skipped: 0, BUILD SUCCESS.
Empaquetado: BUILD SUCCESS.
Validacion Docker/PostgreSQL: ready=true, created_departures=2, cancelled_departures=2, departure_scheduled_events=2, departure_events=5, duplicate_schedule_status=409, past_departure_status=400, delete_cancels=true.
No quedaron listeners en 18087 ni 55439.
No quedaron contenedores temporales venta-pasajes-dispatch-departures.
Existe target\quarkus-app-day24\quarkus-run.jar: True.
Guia manual completa: C:\VENTA-DE-PASAJES\docs\dia-24-salidas-programadas.md.
```

## Cierre cronologico final Dia 25 - mfe-dispatch

Fecha: 2026-09-10

Resumen:

```text
Se completo el Dia 25 con `mfe-dispatch` integrado al shell.
El frontend ahora tiene 2 MFEs funcionales: identity y dispatch.
La validacion integrada comprobo shell=200, mfe-dispatch=200 y proxy hacia dispatch-service=200.
La guia manual completa quedo en docs\dia-25-mfe-dispatch.md.
```

Comandos finales ejecutados:

```powershell
npm run typecheck:frontend
npm run build:frontend
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-mfe-dispatch-stack.ps1 -DatabasePort 55440 -DispatchHttpPort 18088 -ShellPort 3010 -MfeDispatchPort 3012
Get-NetTCPConnection -LocalPort 3010,3012,18088,55440,3000,3001,3002 -ErrorAction SilentlyContinue | Select-Object LocalAddress,LocalPort,State,OwningProcess | Format-Table -AutoSize
docker ps -a --filter "name=venta-pasajes-mfe-dispatch" --format "{{.Names}}"
```

Resultado final:

```text
Typecheck frontend: OK.
Build frontend: OK.
Validacion integrada: ready=true, shell_status=200, embedded_status=200, backend_proxy_status=200.
No quedaron listeners en 3010, 3012, 18088, 55440, 3000, 3001 ni 3002.
No quedaron contenedores temporales venta-pasajes-mfe-dispatch.
Existe apps\mfe-dispatch\.next\standalone: True.
Existe apps\frontend-shell\.next\standalone: True.
```

## Arranque manual final Dia 25 - Frontend local

Fecha: 2026-09-10

Comandos ejecutados:

```powershell
npm run dev:frontend
curl.exe -sS -o NUL -w "%{http_code}" "http://localhost:3000/"
curl.exe -sS "http://localhost:3002/mfe/manifest"
curl.exe -sS -o NUL -w "%{http_code}" "http://localhost:3002/dispatch/embedded"
Get-NetTCPConnection -LocalPort 3000,3001,3002 -ErrorAction SilentlyContinue | Where-Object { $_.State -eq 'Listen' } | Select-Object LocalAddress,LocalPort,State,OwningProcess | Format-Table -AutoSize
```

Resultado:

```text
frontend-shell: http://localhost:3000, pid registrado por script.
mfe-identity: http://localhost:3001, pid registrado por script.
mfe-dispatch: http://localhost:3002, pid registrado por script.
Shell HTTP: 200.
mfe-dispatch /dispatch/embedded HTTP: 200.
mfe-dispatch manifest: name=mfe-dispatch, entry_url=http://localhost:3002/dispatch/embedded.
Puertos escuchando al cierre: 3000, 3001 y 3002.
```

Comando para detenerlos:

```powershell
npm run stop:frontend
```

## Aclaracion Dia 25 - Validacion del manifiesto en paso 4

Fecha: 2026-09-10

Motivo:

```text
Al seguir la guia manual desde cero, el usuario ejecuto `curl.exe -sS "http://localhost:3002/mfe/manifest"` en el paso 4.
La consola respondio: Failed to connect to localhost port 3002.
Esto ocurre porque el archivo del manifiesto ya puede existir, pero el servidor Next de `mfe-dispatch` todavia no esta levantado.
```

Comando probado por el usuario:

```powershell
curl.exe -sS "http://localhost:3002/mfe/manifest"
```

Correccion aplicada:

```text
Se actualizo `C:\VENTA-DE-PASAJES\docs\dia-25-mfe-dispatch.md`.
El paso 4 ahora aclara que el curl solo funciona cuando `mfe-dispatch` esta corriendo.
Se agrego el comando opcional `npm run dev:mfe-dispatch` para probar el manifiesto en ese punto.
```

Comandos documentados:

```powershell
cd C:\VENTA-DE-PASAJES
npm run dev:mfe-dispatch
curl.exe -sS "http://localhost:3002/mfe/manifest"
```

## Diagnostico Dia 25 - dispatch-service sin conexion a PostgreSQL

Fecha: 2026-09-10

Motivo:

```text
El usuario ejecuto una peticion POST desde el proxy de `mfe-dispatch` hacia `/terminals`.
La respuesta mostro un error JDBC: Connection to localhost:5432 refused.
```

Comandos ejecutados:

```powershell
Get-NetTCPConnection -LocalPort 3002,8082,5432 -ErrorAction SilentlyContinue | Select-Object LocalAddress,LocalPort,State,OwningProcess | Format-Table -AutoSize
docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Ports}}"
curl.exe -i -S "http://localhost:3002/api/health"
curl.exe -i -S "http://localhost:8082/q/health/ready"
Get-CimInstance Win32_Process -Filter "ProcessId = 11672" | Select-Object ProcessId,CommandLine | Format-List
docker inspect venta-pasajes-dispatch-crud-manual --format "{{json .NetworkSettings.Ports}}"
docker exec venta-pasajes-dispatch-crud-manual pg_isready -U postgres -d dispatch_db
```

Resultado:

```text
`mfe-dispatch` estaba escuchando en 3002.
`dispatch-service` estaba escuchando en 8082.
No habia PostgreSQL escuchando en 5432.
El contenedor `venta-pasajes-dispatch-crud-manual` estaba publicando PostgreSQL en 55437.
`dispatch-service` estaba corriendo en modo dev y usando la URL default `jdbc:postgresql://localhost:5432/dispatch_db`.
Por eso el MFE llegaba al backend, pero el backend fallaba al adquirir conexion JDBC.
```

Correccion documentada:

```text
Se actualizo `C:\VENTA-DE-PASAJES\docs\dia-25-mfe-dispatch.md`.
Se agrego una seccion antes de las peticiones curl.exe para validar puertos, health del MFE, health del backend y reiniciar `dispatch-service` apuntando a `localhost:55437`.
No se imprimio ni registro la contrasena real del contenedor.
```

## Acompanamiento Dia 25 - Paso 8 listo para npm install

Fecha: 2026-09-10

Motivo:

```text
El usuario solicito ayuda con el paso "Registrar workspace npm" y dejar el proyecto listo para ejecutar `npm install`.
```

Comandos ejecutados:

```powershell
Get-Content .\package.json
Get-Content .\apps\mfe-dispatch\package.json
Test-Path .\apps\mfe-dispatch\package.json
Test-Path .\apps\mfe-dispatch\app\mfe\manifest\route.ts
Get-NetTCPConnection -LocalPort 3000,3001,3002 -ErrorAction SilentlyContinue | Where-Object { $_.State -eq 'Listen' } | Select-Object LocalAddress,LocalPort,State,OwningProcess | Format-Table -AutoSize
node -e "const fs=require('fs'); JSON.parse(fs.readFileSync('package.json','utf8')); JSON.parse(fs.readFileSync('apps/mfe-dispatch/package.json','utf8')); console.log('package.json OK'); console.log('apps/mfe-dispatch/package.json OK');"
npm pkg get workspaces scripts.dev:mfe-dispatch scripts.build:frontend scripts.typecheck:frontend
```

Resultado:

```text
`apps/mfe-dispatch` ya esta registrado en workspaces.
`dev:mfe-dispatch` ya esta registrado.
`build:frontend` incluye `mfe-dispatch`.
`typecheck:frontend` incluye `mfe-dispatch`.
`package.json` y `apps\mfe-dispatch\package.json` son JSON validos.
No hay listeners activos en 3000, 3001 ni 3002.
El proyecto esta listo para que el usuario ejecute `npm install`.
```

## Dia 26 - Compilacion nativa de dispatch-service

Fecha: 2026-09-10

Objetivo:

```text
Compilar `dispatch-service` como binario nativo Quarkus, construir imagen Docker, validarla localmente con PostgreSQL temporal, publicarla en Artifact Registry dev y medir arranque/consumo.
```

Archivos creados/modificados:

```text
C:\VENTA-DE-PASAJES\services\dispatch-service\src\main\docker\Dockerfile.native
C:\VENTA-DE-PASAJES\scripts\build-dispatch-service-native.ps1
C:\VENTA-DE-PASAJES\scripts\verify-dispatch-service-native-local.ps1
C:\VENTA-DE-PASAJES\docs\dia-26-compilacion-nativa-dispatch-service.md
C:\VENTA-DE-PASAJES\services\dispatch-service\README.md
C:\VENTA-DE-PASAJES\vitacora.md
```

Comandos ejecutados:

```powershell
Select-String -Path .\tareas.md -Pattern "### Dia 26|### Dia 26" -Context 0,28
Select-String -Path .\services\dispatch-service\pom.xml -Pattern "quarkus-maven-plugin|native|container-image|postgresql|jdbc|flyway|hibernate|profile" -Context 2,3
Get-Content .\services\dispatch-service\src\main\resources\application.properties
Get-ChildItem .\services\dispatch-service\src\main\docker -ErrorAction SilentlyContinue | Select-Object Name,Length,LastWriteTime | Format-Table -AutoSize
Get-Content .\services\identity-service\src\main\docker\Dockerfile.native
Get-NetTCPConnection -LocalPort 8082,18089,55441 -ErrorAction SilentlyContinue | Select-Object LocalAddress,LocalPort,State,OwningProcess | Format-Table -AutoSize
Get-Process -Id 50660 -ErrorAction SilentlyContinue | Select-Object Id,ProcessName,Path,StartTime | Format-List
Stop-Process -Id 50660 -Force
mvn -f .\services\dispatch-service\pom.xml test
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-dispatch-service-native.ps1 -UseCleanWorkspace
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-dispatch-service-native-local.ps1
docker image inspect dispatch-service:0.1.0-native --format '{{.Id}} {{.Size}}'
docker image inspect us-central1-docker.pkg.dev/project-fbb34cd7-0b82-43e1-867/venta-pasajes-dev/dispatch-service:0.1.0-native --format '{{.Id}} {{.Size}}'
$env:CLOUDSDK_PYTHON = "C:\Python312\python.exe"; & "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd" auth configure-docker us-central1-docker.pkg.dev --quiet
docker push us-central1-docker.pkg.dev/project-fbb34cd7-0b82-43e1-867/venta-pasajes-dev/dispatch-service:0.1.0-native
$env:CLOUDSDK_PYTHON = "C:\Python312\python.exe"; & "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd" artifacts docker images list us-central1-docker.pkg.dev/project-fbb34cd7-0b82-43e1-867/venta-pasajes-dev/dispatch-service --project=project-fbb34cd7-0b82-43e1-867 --include-tags --format="table(package,version,tags,createTime,updateTime,imageSizeBytes)"
docker manifest inspect us-central1-docker.pkg.dev/project-fbb34cd7-0b82-43e1-867/venta-pasajes-dev/dispatch-service:0.1.0-native
docker image inspect dispatch-service:0.1.0-native --format '{{json .RepoDigests}}'
```

Resultado:

```text
`dispatch-service` no tenia Dockerfile nativo propio; se agrego `Dockerfile.native`.
Se detecto un `java.exe` escuchando en 8082 con PID 50660.
No se pudo detener por permisos: Acceso denegado.
Para evitar bloqueo de archivos de `target`, el build nativo se ejecuto con `-UseCleanWorkspace`.
Pruebas JVM: Tests run: 24, Failures: 0, Errors: 0, Skipped: 0.
Build nativo: BUILD SUCCESS.
Tiempo Maven native: 02:47 min.
Runner nativo: 105,070,832 bytes.
Imagen local: dispatch-service:0.1.0-native.
Image ID local: sha256:b7d59817c20e7cf477ff661ae28c7c97eb94d37512e3c6a5eb7a3cb751ec4d7a.
docker image inspect size: 109,532,221 bytes.
Validacion local: OK.
Arranque medido: 1469 ms.
Memoria medida: 75.96MiB / 15.47GiB.
CPU medida: 0.00%.
Health dominio: ok.
Resources count: 6.
Seed layout count: 1.
Artifact Registry dev: OK.
Imagen remota: us-central1-docker.pkg.dev/project-fbb34cd7-0b82-43e1-867/venta-pasajes-dev/dispatch-service:0.1.0-native.
Digest remoto final: sha256:b7d59817c20e7cf477ff661ae28c7c97eb94d37512e3c6a5eb7a3cb751ec4d7a.
```

Comandos principales embebidos en scripts agregados:

```powershell
mvn -f <dispatch-service-pom> package -Dnative -DskipTests -Dquarkus.native.container-build=true -Dquarkus.native.builder-image=quay.io/quarkus/ubi9-quarkus-mandrel-builder-image:jdk-21
docker build --pull -f <Dockerfile.native> -t dispatch-service:0.1.0-native <dispatch-service-root>
docker tag dispatch-service:0.1.0-native us-central1-docker.pkg.dev/project-fbb34cd7-0b82-43e1-867/venta-pasajes-dev/dispatch-service:0.1.0-native
docker push us-central1-docker.pkg.dev/project-fbb34cd7-0b82-43e1-867/venta-pasajes-dev/dispatch-service:0.1.0-native
docker network create <temporary-network>
docker run --name <temporary-postgres> --network <temporary-network> -e POSTGRES_DB=dispatch_db -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=<temporary-local-password> -p 55441:5432 -d postgres:16-alpine
docker run --name <temporary-dispatch-service> --network <temporary-network> -p 18089:8082 -e QUARKUS_PROFILE=onprem -e APP_SECRETS_PROVIDER=env -e APP_DB_JDBC_URL=jdbc:postgresql://<temporary-postgres>:5432/dispatch_db -d dispatch-service:0.1.0-native
curl.exe -i -S "http://localhost:18089/q/health/ready"
curl.exe -i -S "http://localhost:18089/api/v1/dispatch/health"
curl.exe -sS "http://localhost:18089/api/v1/dispatch/resources"
curl.exe -sS "http://localhost:18089/api/v1/dispatch/seat-layouts?q=Legacy%2025%20asientos&active=true&page=1&page_size=10"
docker stats <temporary-dispatch-service> --no-stream --format "{{json .}}"
```

Notas:

```text
No se registro ningun secreto real. La contrasena de PostgreSQL temporal fue generada en memoria por el script y no se guardo en documentacion.
Artifact Registry mostro filas adicionales sin tag porque Docker publico un indice OCI con manifiesto linux/amd64 y attestation.
La guia manual completa quedo en `docs\dia-26-compilacion-nativa-dispatch-service.md`.
```

## Acompanamiento Dia 26 - NOT_FOUND al borrar imagen de Artifact Registry

Fecha: 2026-09-10

Motivo:

```text
El usuario siguio la reversa del Dia 26 y al ejecutar `gcloud artifacts docker images delete $RemoteImage --delete-tags --quiet` recibio `NOT_FOUND: Requested entity was not found`.
```

Comandos ejecutados:

```powershell
$env:CLOUDSDK_PYTHON = "C:\Python312\python.exe"
$Gcloud = "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd"
$ProjectId = "project-fbb34cd7-0b82-43e1-867"
$Region = "us-central1"
$Repository = "venta-pasajes-dev"
& $Gcloud artifacts docker images list "$Region-docker.pkg.dev/$ProjectId/$Repository" --project=$ProjectId --include-tags --format="table(package,digest,tags,createTime,updateTime,imageSizeBytes)"
$ImageName = "dispatch-service"
& $Gcloud artifacts docker images list "$Region-docker.pkg.dev/$ProjectId/$Repository/$ImageName" --project=$ProjectId --include-tags --format="table(package,version,tags,createTime,updateTime,imageSizeBytes)"
```

Resultado:

```text
El tag `dispatch-service:0.1.0-native` ya no aparece en Artifact Registry.
Quedaron dos digests de `dispatch-service` sin tag:
sha256:7155dc5c85a5b2987383fe15e296e7d6d75c22eae03b1abf46caea355ca9223c
sha256:fcf7e32af8636dd47588da19f22a36f19354e7d9aa4a5f9da28c971463d9e443
Esto explica el `NOT_FOUND`: `$RemoteImage` apunta a un tag que ya fue eliminado.
No se borro ningun digest adicional en GCP.
Se actualizo `docs\dia-26-compilacion-nativa-dispatch-service.md` para explicar este escenario y mostrar como borrar por digest exacto si se desea limpiar todo.
```

## Acompanamiento Dia 26 - Revalidacion NOT_FOUND Artifact Registry

Fecha: 2026-09-14

Motivo:

```text
El usuario volvio a ejecutar `gcloud artifacts docker images delete $RemoteImage --delete-tags --quiet` y recibio `NOT_FOUND`.
```

Comando ejecutado:

```powershell
$env:CLOUDSDK_PYTHON = "C:\Python312\python.exe"
$Gcloud = "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd"
$ProjectId = "project-fbb34cd7-0b82-43e1-867"
$Region = "us-central1"
$Repository = "venta-pasajes-dev"
$ImageName = "dispatch-service"
& $Gcloud artifacts docker images list "$Region-docker.pkg.dev/$ProjectId/$Repository/$ImageName" --project=$ProjectId --include-tags --format="table(package,version,tags,createTime,updateTime,imageSizeBytes)"
```

Resultado:

```text
El tag `0.1.0-native` no existe para `dispatch-service`.
Quedan dos digests sin tag:
sha256:7155dc5c85a5b2987383fe15e296e7d6d75c22eae03b1abf46caea355ca9223c
sha256:fcf7e32af8636dd47588da19f22a36f19354e7d9aa4a5f9da28c971463d9e443
El `NOT_FOUND` es esperado porque `$RemoteImage` apunta a una etiqueta que ya fue borrada.
```

## Dia 27 - ticketing-service base

Fecha: 2026-09-14

Objetivo:

```text
Crear `ticketing-service` como microservicio Quarkus local y dejar la base tecnica del dominio de boleteria: pasajeros, asientos por salida, reservas y boletos.
```

Archivos creados/modificados:

```text
C:\VENTA-DE-PASAJES\services\ticketing-service\pom.xml
C:\VENTA-DE-PASAJES\services\ticketing-service\README.md
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\resources\application.properties
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\resources\db\migration\V1__ticketing_schema.sql
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\api\TicketingBaseResource.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\api\TicketingOpenApiConfiguration.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\api\dto\TicketingOverviewResponse.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\api\dto\TicketingResourceResponse.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\domain\DepartureSeatStatus.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\domain\DocumentType.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\domain\PassengerStatus.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\domain\ReservationStatus.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\domain\TicketStatus.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\persistence\entity\DepartureSeat.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\persistence\entity\OutboxEvent.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\persistence\entity\Passenger.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\persistence\entity\Reservation.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\persistence\entity\Ticket.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\service\TicketingCatalogService.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\service\TicketingSaleService.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\test\java\com\ventapasajes\ticketing\api\TicketingBaseResourceTest.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\test\java\com\ventapasajes\ticketing\api\TicketingHealthResourceTest.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\test\java\com\ventapasajes\ticketing\persistence\TicketingMigrationContractTest.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\test\java\com\ventapasajes\ticketing\service\TicketingTransactionConfigurationTest.java
C:\VENTA-DE-PASAJES\scripts\verify-ticketing-service-local-db.ps1
C:\VENTA-DE-PASAJES\docs\dia-27-ticketing-service-base.md
C:\VENTA-DE-PASAJES\vitacora.md
```

Comandos ejecutados:

```powershell
Select-String -Path .\tareas.md -Pattern "### Dia 27|### Dia 27" -Context 0,32
Get-ChildItem .\services -Force | Select-Object Mode,Name,LastWriteTime | Format-Table -AutoSize
Get-Content .\scripts\new-quarkus-service.ps1
Get-ChildItem .\services\ticketing-service -Force -Recurse | Select-Object FullName,Length,LastWriteTime | Format-Table -AutoSize
Get-ChildItem .\services\quarkus-service-template -Force -Recurse | Select-Object FullName,Length,LastWriteTime | Format-Table -AutoSize
Get-Content .\services\quarkus-service-template\pom.xml
Get-Content .\services\quarkus-service-template\src\main\resources\application.properties
Get-Content .\services\dispatch-service\src\main\resources\db\migration\V1__dispatch_schema.sql
Get-Content .\services\identity-service\src\main\resources\db\migration\V1__identity_schema.sql
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\new-quarkus-service.ps1 -ServiceName ticketing-service -PackageSegment ticketing -DatabaseName ticketing_db -HttpPort 8083
mvn -f .\services\ticketing-service\pom.xml test
mvn -f .\services\ticketing-service\pom.xml test
Get-NetTCPConnection -LocalPort 8083,18090,55442 -ErrorAction SilentlyContinue | Select-Object LocalAddress,LocalPort,State,OwningProcess | Format-Table -AutoSize
docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Ports}}" | Select-String -Pattern "ticketing|55442|18090"
mvn -f .\services\ticketing-service\pom.xml package -DskipTests
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-ticketing-service-local-db.ps1
```

Resultado:

```text
La carpeta `ticketing-service` tenia solo `.gitkeep`; se genero desde la plantilla.
Proyecto generado: ticketing-service.
Paquete Java: com.ventapasajes.ticketing.
Base configurada: ticketing_db.
Puerto default configurado: 8083.
API base configurada: /api/v1/ticketing.
Migracion creada: V1__ticketing_schema.sql.
Tablas del modelo inicial: passengers, reservations, departure_seats, tickets, outbox_events.
OpenAPI configurado en /q/openapi y Swagger UI en /q/swagger-ui.
Se agrego `TicketingSaleService` con metodos `@Transactional`.
Primer `mvn test`: fallo por expectativa de titulo OpenAPI heredada de plantilla.
Correccion aplicada: `TicketingHealthResourceTest` ahora espera `Ticketing Service API`.
Segundo `mvn test`: Tests run: 11, Failures: 0, Errors: 0, Skipped: 0.
Package JVM: BUILD SUCCESS.
Artefacto generado: services\ticketing-service\target\quarkus-app\quarkus-run.jar.
Validacion con PostgreSQL temporal: OK.
Flyway version aplicada: 1.
Tablas publicas detectadas incluyendo `flyway_schema_history`: 6.
Restricciones/indices unicos detectados: 15.
Health dominio: ok.
Resources count: 5.
Seat statuses: 5.
Reservation statuses: 5.
Ticket statuses: 4.
```

Comandos principales embebidos en `scripts\verify-ticketing-service-local-db.ps1`.
Nota: no usar `< >` en PowerShell para nombres o passwords; PowerShell interpreta `<` como redireccion. Para repetir manualmente, usar variables como `$TemporaryPostgresName` y `$DbPassword`.

```powershell
$TemporaryPostgresName = "venta-pasajes-ticketing-base-pg-manual"
$DbPassword = [Guid]::NewGuid().ToString("N")
docker run --rm --name $TemporaryPostgresName -e POSTGRES_DB=ticketing_db -e POSTGRES_USER=postgres -e "POSTGRES_PASSWORD=$DbPassword" -p 55443:5432 -d postgres:16-alpine
docker exec $TemporaryPostgresName pg_isready -U postgres -d ticketing_db
java -jar C:\VENTA-DE-PASAJES\services\ticketing-service\target\quarkus-app\quarkus-run.jar
curl.exe -i -S "http://localhost:18090/api/v1/ticketing/health"
curl.exe -sS "http://localhost:18090/api/v1/ticketing"
curl.exe -sS "http://localhost:18090/api/v1/ticketing/resources"
curl.exe -sS "http://localhost:18090/api/v1/ticketing/seat-statuses"
curl.exe -sS "http://localhost:18090/api/v1/ticketing/reservation-statuses"
curl.exe -sS "http://localhost:18090/api/v1/ticketing/ticket-statuses"
docker exec -e "PGPASSWORD=$DbPassword" $TemporaryPostgresName psql -U postgres -d ticketing_db -tAc "select count(*) from information_schema.tables where table_schema='public' and table_name in ('passengers','departure_seats','reservations','tickets','outbox_events','flyway_schema_history');"
docker exec -e "PGPASSWORD=$DbPassword" $TemporaryPostgresName psql -U postgres -d ticketing_db -tAc "select count(*) from pg_indexes where schemaname='public' and (indexname in ('uq_passengers_email_not_null','uq_tickets_active_departure_seat') or indexdef like '%UNIQUE%');"
docker exec -e "PGPASSWORD=$DbPassword" $TemporaryPostgresName psql -U postgres -d ticketing_db -tAc "select version from flyway_schema_history where success = true order by installed_rank desc limit 1;"
docker stop $TemporaryPostgresName
```

Notas:

```text
No se registro ningun secreto real. La contrasena de PostgreSQL temporal fue generada en memoria por el script.
Los nombres tecnicos quedaron en ingles para mantener consistencia con los servicios anteriores:
pasajeros -> passengers
asientos_salida -> departure_seats
reservas -> reservations
boletos -> tickets
La guia manual completa quedo en `docs\dia-27-ticketing-service-base.md`.
```

Correccion posterior del mismo dia:

```text
Despues de la primera validacion se detecto que el puerto 55442 quedo tomado por GoogleDriveFS.
Para evitar conflictos al repetir la guia, se actualizo `scripts\verify-ticketing-service-local-db.ps1`, `services\ticketing-service\README.md` y `docs\dia-27-ticketing-service-base.md` para usar 55443 como puerto temporal recomendado de PostgreSQL.
Se reejecuto `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-ticketing-service-local-db.ps1`.
Resultado revalidado: database_port=55443, http_port=18090, health_status=ok, public_tables=6, unique_constraints_or_indexes=15, flyway_version=1, ready=true.
```

Correccion posterior por practica manual:

```text
Al repetir manualmente el empaquetado de `ticketing-service`, Windows reporto `FileSystemException` sobre `target\quarkus-app\lib\boot\io.smallrye.common.smallrye-common-os-2.13.8.jar`.
Diagnostico: existe un proceso escuchando en el puerto 8083 con PID 7980, por lo que el servicio anterior sigue vivo y mantiene bloqueados archivos `.jar` del artefacto generado.
Se actualizo `docs\dia-27-ticketing-service-base.md` para incluir una solucion copy-ready sin placeholders `< >`: detectar PID por puerto, detenerlo, ejecutar `mvn clean` y repetir el empaquetado.
```

Comandos de diagnostico/solucion documentados:

```powershell
Get-NetTCPConnection -LocalPort 8083,18090 -ErrorAction SilentlyContinue |
  Select-Object LocalAddress,LocalPort,State,OwningProcess |
  Format-Table -AutoSize

$TicketingPids = Get-NetTCPConnection -LocalPort 8083,18090 -ErrorAction SilentlyContinue |
  Where-Object { $_.State -eq "Listen" } |
  Select-Object -ExpandProperty OwningProcess -Unique

$TicketingPids

$TicketingPids | ForEach-Object {
  Stop-Process -Id $_ -Force
}

mvn -f .\services\ticketing-service\pom.xml clean
mvn -f .\services\ticketing-service\pom.xml package -DskipTests
```

Correccion posterior por explicacion de extensiones PostgreSQL:

```text
El Paso 6 de `docs\dia-27-ticketing-service-base.md` mostraba las extensiones `pgcrypto` y `citext`, pero no explicaba como ejecutarlas manualmente.
Se agrego que normalmente las ejecuta Flyway desde `V1__ticketing_schema.sql` cuando `QUARKUS_FLYWAY_MIGRATE_AT_START=true`.
Tambien se agregaron comandos copy-ready para ejecutarlas y verificarlas manualmente con `docker exec ... psql` sobre el PostgreSQL temporal.
```

Comandos agregados a la guia:

```powershell
docker exec -e "PGPASSWORD=$DbPassword" $TemporaryPostgresName `
  psql -U postgres -d ticketing_db -c "CREATE EXTENSION IF NOT EXISTS pgcrypto;"

docker exec -e "PGPASSWORD=$DbPassword" $TemporaryPostgresName `
  psql -U postgres -d ticketing_db -c "CREATE EXTENSION IF NOT EXISTS citext;"

docker exec -e "PGPASSWORD=$DbPassword" $TemporaryPostgresName `
  psql -U postgres -d ticketing_db -c "SELECT extname, extversion FROM pg_extension WHERE extname IN ('pgcrypto','citext') ORDER BY extname;"
```

Correccion posterior por archivo de migracion faltante:

```text
Durante la practica manual del Paso 6, PostgreSQL confirmo que `pgcrypto` y `citext` estaban instaladas en la base temporal.
Luego `Test-Path .\services\ticketing-service\src\main\resources\db\migration\V1__ticketing_schema.sql` devolvio `False`.
Diagnostico: las extensiones fueron ejecutadas en la base, pero el archivo de migracion no existia fisicamente en el proyecto.
Se recreo `services\ticketing-service\src\main\resources\db\migration\V1__ticketing_schema.sql`.
Se actualizo `docs\dia-27-ticketing-service-base.md` para incluir un bloque copy-ready que crea el archivo completo desde PowerShell cuando `Test-Path` devuelve `False`.
Se ajusto el texto del Paso 6 para aclarar que la ruta mostrada es el archivo destino y que el bloque `Set-Content` es el comando que realmente crea el archivo.
```

Comandos de validacion relacionados:

```powershell
Test-Path .\services\ticketing-service\src\main\resources\db\migration\V1__ticketing_schema.sql
Select-String -Path .\services\ticketing-service\src\main\resources\db\migration\V1__ticketing_schema.sql `
  -Pattern "CREATE TABLE passengers|CREATE TABLE reservations|CREATE TABLE departure_seats|CREATE TABLE tickets|CREATE TABLE outbox_events|CREATE UNIQUE INDEX"
```

Correccion posterior por archivo transaccional faltante:

```text
Durante la practica manual del Paso 11, el comando `Select-String` sobre `TicketingSaleService.java` fallo porque el archivo no existia.
Diagnostico: el servicio `ticketing-service` habia quedado en estado parcial de plantilla; faltaban clases del dominio, entidades, API base, servicios y pruebas del Dia 27.
Se restauraron los archivos Java faltantes del modelo inicial de boleteria y se actualizo el Paso 11 para aclarar que la ruta no crea nada por si sola.
Se agrego al documento el bloque PowerShell que crea fisicamente `TicketingSaleService.java` cuando no existe.
Tambien se ajusto el resultado esperado de pruebas del Dia 27 a `Tests run: 10`.
```

Archivos restaurados o ajustados:

```text
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\resources\application.properties
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\api\TicketingOpenApiConfiguration.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\api\TicketingBaseResource.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\api\dto\TicketingOverviewResponse.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\api\dto\TicketingResourceResponse.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\domain\DepartureSeatStatus.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\domain\DocumentType.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\domain\PassengerStatus.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\domain\ReservationStatus.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\domain\TicketStatus.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\persistence\entity\Passenger.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\persistence\entity\DepartureSeat.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\persistence\entity\Reservation.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\persistence\entity\Ticket.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\persistence\entity\OutboxEvent.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\service\TicketingCatalogService.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\service\TicketingSaleService.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\test\java\com\ventapasajes\ticketing\api\TicketingHealthResourceTest.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\test\java\com\ventapasajes\ticketing\api\TicketingBaseResourceTest.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\test\java\com\ventapasajes\ticketing\persistence\TicketingMigrationContractTest.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\test\java\com\ventapasajes\ticketing\service\TicketingTransactionConfigurationTest.java
C:\VENTA-DE-PASAJES\docs\dia-27-ticketing-service-base.md
C:\VENTA-DE-PASAJES\vitacora.md
```

Comandos ejecutados:

```powershell
Get-ChildItem .\services\ticketing-service\src\main\java\com\ventapasajes\ticketing -Force -Recurse | Select-Object FullName,Length,LastWriteTime | Format-Table -AutoSize
Select-String -Path .\docs\dia-27-ticketing-service-base.md -Pattern "Paso 10|TicketingSaleService|Transactional|service" -Context 2,8
Test-Path .\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\service\TicketingSaleService.java
Select-String -Path .\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\service\TicketingSaleService.java -Pattern "@Transactional|persistReservationDraft|persistTicketIssue"
mvn -f .\services\ticketing-service\pom.xml test
mvn -f .\services\ticketing-service\pom.xml package -DskipTests
Test-Path .\services\ticketing-service\target\quarkus-app\quarkus-run.jar
Get-ChildItem .\services\ticketing-service\target\quarkus-app\quarkus-run.jar | Select-Object FullName,Length,LastWriteTime | Format-Table -AutoSize
Get-NetTCPConnection -LocalPort 8083,18090 -ErrorAction SilentlyContinue | Select-Object LocalAddress,LocalPort,State,OwningProcess | Format-Table -AutoSize
```

Resultado de validacion:

```text
Tests run: 10, Failures: 0, Errors: 0, Skipped: 0
BUILD SUCCESS
Package JVM: BUILD SUCCESS
Artefacto confirmado: C:\VENTA-DE-PASAJES\services\ticketing-service\target\quarkus-app\quarkus-run.jar
Puertos 8083 y 18090 libres al finalizar.
```

Correccion posterior por entidades faltantes:

```text
Al ejecutar Maven despues de crear `TicketingSaleService.java`, la compilacion fallo con `package com.ventapasajes.ticketing.persistence.entity does not exist`.
Causa: `TicketingSaleService` depende de `Passenger`, `DepartureSeat`, `Reservation` y `Ticket`, pero esas entidades no existian fisicamente bajo `persistence\entity`.
Se creo la carpeta `services\ticketing-service\src\main\java\com\ventapasajes\ticketing\persistence\entity`.
Se agregaron las entidades `Passenger.java`, `DepartureSeat.java`, `Reservation.java`, `Ticket.java` y `OutboxEvent.java`.
Se agrego al documento `docs\dia-27-ticketing-service-base.md` el nuevo `Paso 8A - Crear entidades JPA/Panache` con comandos PowerShell copy-ready.
Se ejecuto nuevamente Maven y el error quedo resuelto.
```

Comandos ejecutados:

```powershell
Get-ChildItem .\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\persistence -Force -Recurse | Select-Object FullName,Length,LastWriteTime | Format-Table -AutoSize
mvn -f .\services\ticketing-service\pom.xml test
New-Item -ItemType Directory -Force -Path .\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\persistence\entity, .\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\api\dto, .\services\ticketing-service\src\test\java\com\ventapasajes\ticketing\persistence, .\services\ticketing-service\src\test\java\com\ventapasajes\ticketing\service | Out-Null
Get-ChildItem .\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\persistence\entity -Force | Select-Object Name,Length,LastWriteTime | Format-Table -AutoSize
Test-Path .\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\persistence\entity\Passenger.java
Test-Path .\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\persistence\entity\DepartureSeat.java
Test-Path .\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\persistence\entity\Reservation.java
Test-Path .\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\persistence\entity\Ticket.java
mvn -f .\services\ticketing-service\pom.xml test
mvn -f .\services\ticketing-service\pom.xml package -DskipTests
Test-Path .\services\ticketing-service\target\quarkus-app\quarkus-run.jar
```

Resultado:

```text
Fuentes Java principales detectadas: 21.
Entidades creadas: DepartureSeat.java, OutboxEvent.java, Passenger.java, Reservation.java, Ticket.java.
Tests run: 10, Failures: 0, Errors: 0, Skipped: 0.
Package JVM: BUILD SUCCESS.
Artefacto confirmado: C:\VENTA-DE-PASAJES\services\ticketing-service\target\quarkus-app\quarkus-run.jar.
```

Correccion posterior por puerto PostgreSQL temporal ocupado:

```text
Al ejecutar `scripts\verify-ticketing-service-local-db.ps1 -DatabasePort 55443 -HttpPort 18090`, Docker fallo con `Bind for 0.0.0.0:55443 failed: port is already allocated`.
Diagnostico: el puerto 55443 estaba ocupado por el contenedor `venta-pasajes-ticketing-base-pg-script`, creado en una practica manual anterior y aun en ejecucion.
Se actualizo `scripts\verify-ticketing-service-local-db.ps1` para validar los puertos antes de llamar a `docker run` y mostrar una solucion clara.
Se actualizo `docs\dia-27-ticketing-service-base.md` para indicar como revisar el puerto, detener el contenedor temporal anterior o ejecutar la validacion con un puerto alterno.
No se detuvo el contenedor anterior para no interrumpir una posible revision manual del usuario.
Se valido correctamente el servicio usando el puerto alterno 55444.
```

Comandos ejecutados:

```powershell
Get-NetTCPConnection -LocalPort 55443 -ErrorAction SilentlyContinue | Select-Object LocalAddress,LocalPort,State,OwningProcess | Format-Table -AutoSize
docker ps -a --format "table {{.ID}}\t{{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}" | Select-String -Pattern "venta-pasajes-ticketing|55443|ticketing"
Get-CimInstance Win32_Process | Where-Object { $_.ProcessId -in 41124,52468 } | Select-Object ProcessId,Name,CommandLine | Format-List
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-ticketing-service-local-db.ps1 -DatabasePort 55443 -HttpPort 18090
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-ticketing-service-local-db.ps1 -DatabasePort 55444 -HttpPort 18090
```

Resultado:

```json
{"service":"ticketing-service","validation":"local-postgresql-flyway","quarkus_profile":"onprem","secrets_provider":"env","database":"ticketing_db","database_port":55444,"http_port":18090,"jar":"C:\\VENTA-DE-PASAJES\\services\\ticketing-service\\target\\quarkus-app\\quarkus-run.jar","health_status":"ok","overview_service":"ticketing-service","resources_count":5,"seat_statuses":5,"reservation_statuses":5,"ticket_statuses":4,"public_tables":6,"unique_constraints_or_indexes":15,"flyway_version":"1","ready":true}
```

Correccion posterior por autenticacion fallida contra PostgreSQL:

```text
Al arrancar manualmente `java -jar .\services\ticketing-service\target\quarkus-app\quarkus-run.jar`, Quarkus fallo con `FATAL: password authentication failed for user "postgres"`.
Causa probable: el servicio Java se inicio con una contrasena diferente a la usada para crear el contenedor PostgreSQL, o las variables de entorno fueron configuradas despues de ejecutar `java -jar`.
Se actualizo `docs\dia-27-ticketing-service-base.md` para reordenar la guia: primero levantar PostgreSQL, luego configurar variables en la misma consola, verificar que `APP_DB_PASSWORD` no este vacia, y recien despues arrancar Java.
Tambien se agrego el caso a la tabla de problemas y soluciones.
```

Comandos recomendados documentados:

```powershell
$DbPassword = [Guid]::NewGuid().ToString("N")

docker run --rm --name venta-pasajes-ticketing-base-pg-manual `
  -e POSTGRES_DB=ticketing_db `
  -e POSTGRES_USER=postgres `
  -e "POSTGRES_PASSWORD=$DbPassword" `
  -p "55443:5432" `
  -d postgres:16-alpine

$env:APP_DB_JDBC_URL = "jdbc:postgresql://localhost:55443/ticketing_db"
$env:APP_DB_USERNAME = "postgres"
$env:APP_DB_PASSWORD = $DbPassword
[bool]$env:APP_DB_PASSWORD
java -jar .\services\ticketing-service\target\quarkus-app\quarkus-run.jar
```

Seguimiento posterior por puerto 55443 ocupado en practica manual:

```text
El usuario intento levantar `venta-pasajes-ticketing-base-pg-manual` en el puerto 55443 y Docker volvio a reportar `port is already allocated`.
Se verifico que el puerto 55443 estaba ocupado por el contenedor temporal anterior `venta-pasajes-ticketing-base-pg-script`.
Se detuvo ese contenedor para liberar el puerto y permitir continuar con la guia manual.
Despues de detenerlo, ya no quedo ningun estado `Listen` en 55443; solo conexiones `FinWait2`, que corresponden al cierre normal de conexiones.
Se actualizo `docs\dia-27-ticketing-service-base.md` para explicar que `Listen` es el estado que bloquea el puerto y que `TimeWait`/`FinWait2` suelen desaparecer solos.
```

Comandos ejecutados:

```powershell
docker ps -a --format "table {{.ID}}\t{{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}" | Select-String -Pattern "ticketing|55443|postgres"
Get-NetTCPConnection -LocalPort 55443 -ErrorAction SilentlyContinue | Select-Object LocalAddress,LocalPort,State,OwningProcess | Format-Table -AutoSize
docker stop venta-pasajes-ticketing-base-pg-script
Get-NetTCPConnection -LocalPort 55443 -ErrorAction SilentlyContinue | Select-Object LocalAddress,LocalPort,State,OwningProcess | Format-Table -AutoSize
docker ps -a --format "table {{.ID}}\t{{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}" | Select-String -Pattern "ticketing|55443|postgres"
```

Correccion posterior por confusion entre Paso 14 y Paso 15:

```text
El usuario abrio una segunda consola para el Paso 15 e intento ejecutar `docker run` nuevamente.
Diagnostico: si el Paso 14 dejo Quarkus corriendo, PostgreSQL temporal ya esta levantado en 55443; por eso un segundo `docker run` falla con `port is already allocated`.
Se verifico que `venta-pasajes-ticketing-base-pg-script` esta ejecutandose en 55443 y que `ticketing-service` esta escuchando en 18090.
Se probaron endpoints con `curl.exe` y respondieron correctamente.
Se actualizo `docs\dia-27-ticketing-service-base.md` separando el Paso 15 en `Paso 15A - Probar endpoints desde otra consola` y `Paso 15B - Validacion manual completa desde cero`.
```

Comandos ejecutados:

```powershell
docker ps -a --format "table {{.ID}}\t{{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}" | Select-String -Pattern "ticketing|55443|55444|postgres"
Get-NetTCPConnection -LocalPort 55443,55444,18090 -ErrorAction SilentlyContinue | Select-Object LocalAddress,LocalPort,State,OwningProcess | Format-Table -AutoSize
curl.exe -sS "http://localhost:18090/api/v1/ticketing/health"
curl.exe -sS "http://localhost:18090/api/v1/ticketing"
curl.exe -sS "http://localhost:18090/api/v1/ticketing/resources"
curl.exe -sS "http://localhost:18090/api/v1/ticketing/ticket-statuses"
```

Resultado:

```text
PostgreSQL temporal activo: venta-pasajes-ticketing-base-pg-script en 55443.
ticketing-service activo: puerto 18090.
Health HTTP: status=ok, service=ticketing-service.
Overview HTTP: domain=ticketing, resources=5.
Ticket statuses: ISSUED, VOIDED, REFUNDED, CHECKED_IN.
```

Mejora documental posterior del Dia 27:

```text
El usuario indico que `docs\dia-27-ticketing-service-base.md` estaba demasiado lleno de codigo Java y pidio dejarlo con el mismo enfoque del Dia 26, donde el codigo ya existe antes de empezar la practica.
Se reemplazo el documento del Dia 27 por una guia mas limpia: reversa primero, revision del codigo ya creado, validaciones, Maven test/package, ejecucion local con PostgreSQL temporal, curls listos para copiar y problemas frecuentes.
Se quitaron los bloques largos de creacion de clases Java desde el `.md`.
El codigo Java se mantiene en `services\ticketing-service` como entregable del dia; la documentacion ahora explica como verificarlo y operarlo.
```

Comandos ejecutados:

```powershell
Get-ChildItem -Path .\docs -Filter 'dia-2*.md' | Select-Object Name,Length,LastWriteTime | Format-Table -AutoSize
Select-String -Path .\docs\dia-26*.md -Pattern '^#|Guia manual|Guía manual|Paso |Codigo|Código|Crear archivo|Reversa|Validar|Comandos ejecutados' -Context 0,2
Select-String -Path .\docs\dia-27*.md -Pattern '^#|Paso |```java|```sql|```powershell|Crear entidades|Crear DTO|Crear recurso|Crear servicio|Guia manual|Guía manual|Reversa|Comandos ejecutados' -Context 0,1
Get-Content -Path .\scripts\new-quarkus-service.ps1
Get-ChildItem -Path .\services\ticketing-service -Recurse -File | Select-Object FullName | Sort-Object FullName | Format-Table -AutoSize
Get-Content -Path .\vitacora.md -Tail 120
Select-String -Path .\docs\dia-27-ticketing-service-base.md -Pattern '```java|Set-Content|@'''
Get-Item .\docs\dia-27-ticketing-service-base.md | Select-Object FullName,Length,LastWriteTime | Format-List
Select-String -Path .\docs\dia-27-ticketing-service-base.md -Pattern '^### Paso |^## '
```

Resultado:

```text
Documento actualizado: C:\VENTA-DE-PASAJES\docs\dia-27-ticketing-service-base.md
Tamano anterior aproximado: 46393 bytes.
Tamano nuevo: 19543 bytes.
Validacion: no se encontraron bloques ```java ni comandos `Set-Content` para generar clases dentro del documento.
```

## Dia 28 - Disponibilidad de asientos

Fecha de ejecucion: 2026-09-14

Objetivo:

```text
Crear API de disponibilidad en ticketing-service.
Consultar salidas disponibles.
Consultar mapa de asientos por salida.
Sincronizar datos necesarios desde dispatch-service mediante modelo de lectura local.
Probar estados AVAILABLE, RESERVED, SOLD y CANCELLED.
```

Cambios realizados:

```text
Se agrego la migracion V2__availability_read_model.sql.
Se creo la tabla local synced_departures para guardar una copia minima de las salidas de dispatch-service.
Se agrego la entidad SyncedDeparture.
Se agrego el enum SyncedDepartureStatus con SCHEDULED, CANCELLED, CLOSED y DEPARTED.
Se agregaron DTOs para sincronizacion, salidas disponibles y mapa de asientos.
Se agrego TicketingAvailabilityService.
Se agrego TicketingAvailabilityResource.
Se agregaron endpoints bajo /api/v1/ticketing/availability.
Se actualizo TicketingCatalogService para incluir synced_departures en los recursos administrados.
Se actualizaron pruebas existentes que esperaban 5 recursos y ahora esperan 6.
Se agrego TicketingAvailabilityResourceContractTest.
Se amplio TicketingMigrationContractTest para validar la migracion V2.
Se amplio scripts\verify-ticketing-service-local-db.ps1 para sincronizar una salida de ejemplo y validar disponibilidad real.
Se creo docs\dia-28-disponibilidad-asientos.md con reversa, guia manual desde cero, curls y troubleshooting.
```

Archivos creados o modificados:

```text
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\resources\db\migration\V2__availability_read_model.sql
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\domain\SyncedDepartureStatus.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\persistence\entity\SyncedDeparture.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\api\TicketingAvailabilityResource.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\service\TicketingAvailabilityService.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\api\dto\DepartureAvailabilitySyncRequest.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\api\dto\DepartureSeatSyncRequest.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\api\dto\AvailableDepartureResponse.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\api\dto\SeatAvailabilityResponse.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\api\dto\SeatMapResponse.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\service\TicketingCatalogService.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\test\java\com\ventapasajes\ticketing\api\TicketingBaseResourceTest.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\test\java\com\ventapasajes\ticketing\api\TicketingAvailabilityResourceContractTest.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\test\java\com\ventapasajes\ticketing\persistence\TicketingMigrationContractTest.java
C:\VENTA-DE-PASAJES\scripts\verify-ticketing-service-local-db.ps1
C:\VENTA-DE-PASAJES\docs\dia-28-disponibilidad-asientos.md
C:\VENTA-DE-PASAJES\vitacora.md
```

Comandos ejecutados:

```powershell
Select-String -Path .\tareas.md -Pattern "### Dia 28|### Dia 28|Dia 28|Dia 28" -Context 0,40
Get-ChildItem .\services\ticketing-service\src\main\java\com\ventapasajes\ticketing -Recurse -File | Select-Object FullName | Sort-Object FullName | Format-Table -AutoSize
Get-ChildItem .\services\ticketing-service\src\test\java\com\ventapasajes\ticketing -Recurse -File | Select-Object FullName | Sort-Object FullName | Format-Table -AutoSize
Get-Content .\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\persistence\entity\DepartureSeat.java
Get-Content .\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\persistence\entity\Reservation.java
Get-Content .\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\persistence\entity\Ticket.java
Get-Content .\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\api\TicketingBaseResource.java
Get-Content .\services\ticketing-service\src\main\resources\db\migration\V1__ticketing_schema.sql
Get-Content .\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\service\TicketingCatalogService.java
Get-Content .\services\ticketing-service\src\test\java\com\ventapasajes\ticketing\api\TicketingBaseResourceTest.java
Get-Content .\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\api\dto\DepartureResponse.java
Get-Content .\services\dispatch-service\src\main\java\com\ventapasajes\dispatch\domain\DepartureStatus.java
Get-Content .\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\domain\DepartureSeatStatus.java
Get-Content .\scripts\verify-ticketing-service-local-db.ps1
mvn -f .\services\ticketing-service\pom.xml test
Get-NetTCPConnection -LocalPort 18090,55443,55444,55445 -ErrorAction SilentlyContinue | Select-Object LocalAddress,LocalPort,State,OwningProcess | Format-Table -AutoSize
docker ps -a --format "table {{.ID}}\t{{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}" | Select-String -Pattern "ticketing|55443|55444|55445|postgres"
mvn -f .\services\ticketing-service\pom.xml package -DskipTests
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-ticketing-service-local-db.ps1 -DatabasePort 55444 -HttpPort 18090
Select-String -Path .\docs\dia-28-disponibilidad-asientos.md -Pattern '^#|^## |^### Paso|```java|Set-Content'
Get-ChildItem .\services\ticketing-service\src\main\java\com\ventapasajes\ticketing -Recurse -File | Select-String -Pattern "availability|SyncedDeparture|DepartureAvailability" -List | Select-Object Path | Sort-Object Path | Format-Table -AutoSize
```

Comandos ejecutados internamente por el script de validacion:

```powershell
docker run --rm --name $ContainerName -e POSTGRES_DB=ticketing_db -e POSTGRES_USER=postgres -e "POSTGRES_PASSWORD=$PostgresPassword" -p "$DatabasePort`:5432" -d postgres:16-alpine
docker exec $ContainerName pg_isready -U postgres -d ticketing_db
Start-Process -FilePath "java" -ArgumentList @("-jar", $ResolvedJarPath) -RedirectStandardOutput $StdOutPath -RedirectStandardError $StdErrPath -WindowStyle Hidden -PassThru
Invoke-RestMethod -Uri "http://localhost:$HttpPort/api/v1/ticketing/health" -TimeoutSec 5
Invoke-RestMethod -Uri "http://localhost:$HttpPort/api/v1/ticketing" -TimeoutSec 5
Invoke-RestMethod -Uri "http://localhost:$HttpPort/api/v1/ticketing/resources" -TimeoutSec 5
Invoke-RestMethod -Uri "http://localhost:$HttpPort/api/v1/ticketing/seat-statuses" -TimeoutSec 5
Invoke-RestMethod -Uri "http://localhost:$HttpPort/api/v1/ticketing/reservation-statuses" -TimeoutSec 5
Invoke-RestMethod -Uri "http://localhost:$HttpPort/api/v1/ticketing/ticket-statuses" -TimeoutSec 5
Invoke-RestMethod -Uri "http://localhost:$HttpPort/api/v1/ticketing/availability/sync/departures" -Method Post -ContentType "application/json" -Body $SyncPayload -TimeoutSec 5
Invoke-RestMethod -Uri "http://localhost:$HttpPort/api/v1/ticketing/availability/departures" -TimeoutSec 5
Invoke-RestMethod -Uri "http://localhost:$HttpPort/api/v1/ticketing/availability/departures/$DispatchDepartureId/seats" -TimeoutSec 5
docker exec -e "PGPASSWORD=$PostgresPassword" $ContainerName psql -U postgres -d ticketing_db -tAc "select count(*) from information_schema.tables where table_schema='public' and table_name in ('passengers','departure_seats','reservations','tickets','outbox_events','synced_departures','flyway_schema_history');"
docker exec -e "PGPASSWORD=$PostgresPassword" $ContainerName psql -U postgres -d ticketing_db -tAc "select count(*) from pg_indexes where schemaname='public' and (indexname in ('uq_passengers_email_not_null','uq_tickets_active_departure_seat','uq_synced_departures_legacy_id_not_null') or indexdef like '%UNIQUE%');"
docker exec -e "PGPASSWORD=$PostgresPassword" $ContainerName psql -U postgres -d ticketing_db -tAc "select version from flyway_schema_history where success = true order by installed_rank desc limit 1;"
docker stop $ContainerName
```

Resultado de pruebas:

```text
mvn test:
Tests run: 13, Failures: 0, Errors: 0, Skipped: 0
BUILD SUCCESS

mvn package -DskipTests:
BUILD SUCCESS
Artefacto: C:\VENTA-DE-PASAJES\services\ticketing-service\target\quarkus-app\quarkus-run.jar
```

Resultado de validacion local:

```json
{"service":"ticketing-service","validation":"local-postgresql-flyway","quarkus_profile":"onprem","secrets_provider":"env","database":"ticketing_db","database_port":55444,"http_port":18090,"jar":"C:\\VENTA-DE-PASAJES\\services\\ticketing-service\\target\\quarkus-app\\quarkus-run.jar","health_status":"ok","overview_service":"ticketing-service","resources_count":6,"seat_statuses":5,"reservation_statuses":5,"ticket_statuses":4,"availability_departures":1,"availability_total_seats":4,"availability_available_seats":1,"availability_reserved_seats":1,"availability_sold_seats":1,"availability_cancelled_seats":1,"public_tables":7,"unique_constraints_or_indexes":18,"flyway_version":"2","ready":true}
```

Endpoints disponibles del Dia 28:

```text
POST /api/v1/ticketing/availability/sync/departures
GET  /api/v1/ticketing/availability/departures
GET  /api/v1/ticketing/availability/departures/{dispatchDepartureId}/seats
```

## Dia 29 - Reserva temporal de asiento

Fecha de ejecucion: 2026-09-15

Objetivo:

```text
Implementar reserva temporal de asiento.
Definir tiempo de expiracion.
Implementar liberacion automatica con Cloud Tasks o job interno.
Publicar eventos SeatReserved y SeatReservationExpired.
Probar concurrencia/doble reserva.
```

Cambios realizados:

```text
Se agrego la migracion V3__reservation_expiration_indexes.sql.
Se agregaron indices para reservas pendientes por expiracion y busqueda de asientos por reserva.
Se agregaron DTOs CreateReservationRequest, ReservationPassengerRequest, ReservationResponse, ExpireReservationsRequest y ExpiredReservationsResponse.
Se agrego TicketingReservationService con transacciones, bloqueo pesimista de asiento y expiracion de reservas.
Se agrego TicketingReservationResource bajo /api/v1/ticketing/reservations.
Se agrego ReservationExpirationJob con scheduler configurable.
Se agregaron eventos de outbox SeatReserved y SeatReservationExpired.
Se actualizo OutboxEvent para persistir payload JSONB como Map.
Se actualizo TicketingAvailabilityService para que la sincronizacion desde dispatch no sobrescriba asientos RESERVED ni SOLD.
Se actualizo application.properties con configuracion de reserva y job interno.
Se agregaron pruebas contractuales para endpoints, migracion V3, transacciones y scheduler.
Se amplio scripts\verify-ticketing-service-local-db.ps1 para probar reserva, doble reserva HTTP 409, expiracion y outbox.
Se creo docs\dia-29-reserva-temporal-asiento.md con reversa, guia manual, curls y troubleshooting.
```

Archivos creados o modificados:

```text
C:\VENTA-DE-PASAJES\services\ticketing-service\pom.xml
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\resources\application.properties
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\resources\db\migration\V3__reservation_expiration_indexes.sql
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\persistence\entity\OutboxEvent.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\api\TicketingReservationResource.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\service\TicketingReservationService.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\service\ReservationExpirationJob.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\service\TicketingAvailabilityService.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\api\dto\CreateReservationRequest.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\api\dto\ReservationPassengerRequest.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\api\dto\ReservationResponse.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\api\dto\ExpireReservationsRequest.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\api\dto\ExpiredReservationsResponse.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\test\java\com\ventapasajes\ticketing\api\TicketingReservationResourceContractTest.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\test\java\com\ventapasajes\ticketing\persistence\TicketingMigrationContractTest.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\test\java\com\ventapasajes\ticketing\service\TicketingTransactionConfigurationTest.java
C:\VENTA-DE-PASAJES\scripts\verify-ticketing-service-local-db.ps1
C:\VENTA-DE-PASAJES\docs\dia-29-reserva-temporal-asiento.md
C:\VENTA-DE-PASAJES\vitacora.md
```

Comandos ejecutados:

```powershell
Select-String -Path .\tareas.md -Pattern "### Dia 29|### Dia 29|Dia 29|Dia 29" -Context 0,70
Get-ChildItem .\docs -Filter 'dia-*.md' | Sort-Object Name | Select-Object Name,Length,LastWriteTime | Format-Table -AutoSize
Get-ChildItem .\services\ticketing-service\src\main\java\com\ventapasajes\ticketing -Recurse -File | Select-Object FullName | Sort-Object FullName | Format-Table -AutoSize
Get-ChildItem .\services\ticketing-service\src\test\java\com\ventapasajes\ticketing -Recurse -File | Select-Object FullName | Sort-Object FullName | Format-Table -AutoSize
Get-Content .\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\persistence\entity\DepartureSeat.java
Get-Content .\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\persistence\entity\Reservation.java
Get-Content .\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\persistence\entity\OutboxEvent.java
Get-Content .\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\service\TicketingAvailabilityService.java
Get-Content .\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\service\TicketingSaleService.java
Get-Content .\services\ticketing-service\src\main\resources\db\migration\V1__ticketing_schema.sql
mvn -f .\services\ticketing-service\pom.xml test
mvn -f .\services\ticketing-service\pom.xml package -DskipTests
Get-NetTCPConnection -LocalPort 18090,55443,55444,55445 -ErrorAction SilentlyContinue | Select-Object LocalAddress,LocalPort,State,OwningProcess | Format-Table -AutoSize
docker ps -a --format "table {{.ID}}\t{{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}" | Select-String -Pattern "ticketing|55443|55444|55445|postgres"
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-ticketing-service-local-db.ps1 -DatabasePort 55444 -HttpPort 18090
```

Comandos ejecutados internamente por el script de validacion:

```powershell
docker run --rm --name $ContainerName -e POSTGRES_DB=ticketing_db -e POSTGRES_USER=postgres -e "POSTGRES_PASSWORD=$PostgresPassword" -p "$DatabasePort`:5432" -d postgres:16-alpine
docker exec $ContainerName pg_isready -U postgres -d ticketing_db
Start-Process -FilePath "java" -ArgumentList @("-jar", $ResolvedJarPath) -RedirectStandardOutput $StdOutPath -RedirectStandardError $StdErrPath -WindowStyle Hidden -PassThru
Invoke-RestMethod -Uri "http://localhost:$HttpPort/api/v1/ticketing/health" -TimeoutSec 5
Invoke-RestMethod -Uri "http://localhost:$HttpPort/api/v1/ticketing" -TimeoutSec 5
Invoke-RestMethod -Uri "http://localhost:$HttpPort/api/v1/ticketing/resources" -TimeoutSec 5
Invoke-RestMethod -Uri "http://localhost:$HttpPort/api/v1/ticketing/seat-statuses" -TimeoutSec 5
Invoke-RestMethod -Uri "http://localhost:$HttpPort/api/v1/ticketing/reservation-statuses" -TimeoutSec 5
Invoke-RestMethod -Uri "http://localhost:$HttpPort/api/v1/ticketing/ticket-statuses" -TimeoutSec 5
Invoke-RestMethod -Uri "http://localhost:$HttpPort/api/v1/ticketing/availability/sync/departures" -Method Post -ContentType "application/json" -Body $SyncPayload -TimeoutSec 5
Invoke-RestMethod -Uri "http://localhost:$HttpPort/api/v1/ticketing/availability/departures" -TimeoutSec 5
Invoke-RestMethod -Uri "http://localhost:$HttpPort/api/v1/ticketing/availability/departures/$DispatchDepartureId/seats" -TimeoutSec 5
Invoke-RestMethod -Uri "http://localhost:$HttpPort/api/v1/ticketing/reservations" -Method Post -ContentType "application/json" -Body $ReservationPayload -TimeoutSec 5
Invoke-RestMethod -Uri "http://localhost:$HttpPort/api/v1/ticketing/reservations" -Method Post -ContentType "application/json" -Body $ReservationPayload -TimeoutSec 5
Invoke-RestMethod -Uri "http://localhost:$HttpPort/api/v1/ticketing/reservations/expire" -Method Post -ContentType "application/json" -Body $ExpirePayload -TimeoutSec 5
docker exec -e "PGPASSWORD=$PostgresPassword" $ContainerName psql -U postgres -d ticketing_db -tAc "select count(*) from information_schema.tables where table_schema='public' and table_name in ('passengers','departure_seats','reservations','tickets','outbox_events','synced_departures','flyway_schema_history');"
docker exec -e "PGPASSWORD=$PostgresPassword" $ContainerName psql -U postgres -d ticketing_db -tAc "select count(*) from pg_indexes where schemaname='public' and (indexname in ('uq_passengers_email_not_null','uq_tickets_active_departure_seat','uq_synced_departures_legacy_id_not_null') or indexdef like '%UNIQUE%');"
docker exec -e "PGPASSWORD=$PostgresPassword" $ContainerName psql -U postgres -d ticketing_db -tAc "select version from flyway_schema_history where success = true order by installed_rank desc limit 1;"
docker exec -e "PGPASSWORD=$PostgresPassword" $ContainerName psql -U postgres -d ticketing_db -tAc "select count(*) from outbox_events where event_type in ('SeatReserved','SeatReservationExpired');"
docker stop $ContainerName
```

Resultado de pruebas:

```text
mvn test:
Tests run: 18, Failures: 0, Errors: 0, Skipped: 0
BUILD SUCCESS

mvn package -DskipTests:
BUILD SUCCESS
Artefacto: C:\VENTA-DE-PASAJES\services\ticketing-service\target\quarkus-app\quarkus-run.jar
```

Resultado de validacion local:

```json
{"service":"ticketing-service","validation":"local-postgresql-flyway","quarkus_profile":"onprem","secrets_provider":"env","database":"ticketing_db","database_port":55444,"http_port":18090,"jar":"C:\\VENTA-DE-PASAJES\\services\\ticketing-service\\target\\quarkus-app\\quarkus-run.jar","health_status":"ok","overview_service":"ticketing-service","resources_count":6,"seat_statuses":5,"reservation_statuses":5,"ticket_statuses":4,"availability_departures":1,"availability_total_seats":4,"availability_available_seats":1,"availability_reserved_seats":1,"availability_sold_seats":1,"availability_cancelled_seats":1,"reservation_status":"PENDING","reservation_seat_status":"RESERVED","duplicate_reservation_http_status":409,"seats_available_after_reservation":0,"seats_reserved_after_reservation":2,"expired_reservations":1,"seats_available_after_expiration":1,"seats_reserved_after_expiration":1,"reservation_outbox_events":2,"public_tables":7,"unique_constraints_or_indexes":18,"flyway_version":"3","ready":true}
```

Endpoints disponibles del Dia 29:

```text
POST /api/v1/ticketing/reservations
GET  /api/v1/ticketing/reservations/{reservationId}
POST /api/v1/ticketing/reservations/expire
```

Observaciones:

```text
El puerto 55443 estaba ocupado por el contenedor manual venta-pasajes-ticketing-base-pg-manual, por eso la validacion del Dia 29 se ejecuto en 55444.
El contenedor temporal creado por el script en 55444 fue detenido automaticamente al finalizar.
```

## Dia 30 - Venta de boleto

Fecha de ejecucion: 2026-09-15

Objetivo:

```text
Implementar endpoint de venta.
Validar pasajero.
Validar salida.
Validar asiento.
Confirmar boleto en transaccion.
Publicar evento TicketSold.
Probar contra doble venta.
```

Cambios realizados:

```text
Se agrego TicketingTicketResource bajo /api/v1/ticketing/tickets.
Se agregaron DTOs CreateTicketRequest y TicketResponse.
Se amplio TicketingSaleService con emision transaccional de boletos.
Se soporta venta directa desde un asiento AVAILABLE.
Se soporta conversion de reserva PENDING vigente a boleto.
Se usa bloqueo pesimista sobre departure_seats y reservations.
Se marca el asiento como SOLD en la misma transaccion.
Se limpia hold_expires_at al emitir boleto.
Se convierte la reserva a CONVERTED_TO_TICKET cuando aplica.
Se publica evento TicketSold en outbox_events.
Se agrego TicketingTicketResourceContractTest.
Se amplio TicketingTransactionConfigurationTest para verificar issueTicket transaccional.
Se amplio scripts\verify-ticketing-service-local-db.ps1 para validar venta, doble venta HTTP 409, TicketSold e ISSUED.
Se creo docs\dia-30-venta-boleto.md.
```

Archivos creados o modificados:

```text
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\api\TicketingTicketResource.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\service\TicketingSaleService.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\api\dto\CreateTicketRequest.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\api\dto\TicketResponse.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\test\java\com\ventapasajes\ticketing\api\TicketingTicketResourceContractTest.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\test\java\com\ventapasajes\ticketing\service\TicketingTransactionConfigurationTest.java
C:\VENTA-DE-PASAJES\scripts\verify-ticketing-service-local-db.ps1
C:\VENTA-DE-PASAJES\docs\dia-30-venta-boleto.md
C:\VENTA-DE-PASAJES\vitacora.md
```

Comandos ejecutados:

```powershell
Select-String -Path .\tareas.md -Pattern "### Dia 30|Dia 30" -Context 0,45
Get-Content .\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\service\TicketingReservationService.java
Get-Content .\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\service\TicketingSaleService.java
Get-Content .\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\persistence\entity\Ticket.java
Get-Content .\services\ticketing-service\src\main\resources\db\migration\V1__ticketing_schema.sql
Get-Content .\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\domain\TicketStatus.java
Get-Content .\services\ticketing-service\src\test\java\com\ventapasajes\ticketing\service\TicketingTransactionConfigurationTest.java
mvn -f .\services\ticketing-service\pom.xml test
mvn -f .\services\ticketing-service\pom.xml package -DskipTests
Get-CimInstance Win32_Process -Filter "ProcessId = 26968" | Select-Object ProcessId,Name,CommandLine | Format-List
Get-NetTCPConnection -LocalPort 18090 -State Listen -ErrorAction SilentlyContinue | Select-Object LocalAddress,LocalPort,State,OwningProcess | Format-Table -AutoSize
Stop-Process -Id 26968 -Force
taskkill /PID 26968 /F
mvn -f .\services\ticketing-service\pom.xml package -DskipTests "-Dquarkus.package.output-directory=quarkus-app-day30"
Get-ChildItem .\services\ticketing-service\target\quarkus-app-day30 -Force | Select-Object Name,Length,LastWriteTime | Format-Table -AutoSize
Test-Path .\services\ticketing-service\target\quarkus-app-day30\quarkus-run.jar
Get-NetTCPConnection -LocalPort 18091,55445 -ErrorAction SilentlyContinue | Select-Object LocalAddress,LocalPort,State,OwningProcess | Format-Table -AutoSize
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-ticketing-service-local-db.ps1 -DatabasePort 55445 -HttpPort 18091 -JarPath .\services\ticketing-service\target\quarkus-app-day30\quarkus-run.jar
docker ps -a --format "table {{.ID}}\t{{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}" | Select-String -Pattern "ticketing|55445|55443|55444|postgres"
```

Comandos ejecutados internamente por el script de validacion:

```powershell
docker run --rm --name $ContainerName -e POSTGRES_DB=ticketing_db -e POSTGRES_USER=postgres -e "POSTGRES_PASSWORD=$PostgresPassword" -p "$DatabasePort`:5432" -d postgres:16-alpine
docker exec $ContainerName pg_isready -U postgres -d ticketing_db
Start-Process -FilePath "java" -ArgumentList @("-jar", $ResolvedJarPath) -RedirectStandardOutput $StdOutPath -RedirectStandardError $StdErrPath -WindowStyle Hidden -PassThru
Invoke-RestMethod -Uri "http://localhost:$HttpPort/api/v1/ticketing/health" -TimeoutSec 5
Invoke-RestMethod -Uri "http://localhost:$HttpPort/api/v1/ticketing/availability/sync/departures" -Method Post -ContentType "application/json" -Body $SyncPayload -TimeoutSec 5
Invoke-RestMethod -Uri "http://localhost:$HttpPort/api/v1/ticketing/reservations" -Method Post -ContentType "application/json" -Body $ReservationPayload -TimeoutSec 5
Invoke-RestMethod -Uri "http://localhost:$HttpPort/api/v1/ticketing/reservations/expire" -Method Post -ContentType "application/json" -Body $ExpirePayload -TimeoutSec 5
Invoke-RestMethod -Uri "http://localhost:$HttpPort/api/v1/ticketing/tickets" -Method Post -ContentType "application/json" -Body $TicketPayload -TimeoutSec 5
Invoke-RestMethod -Uri "http://localhost:$HttpPort/api/v1/ticketing/tickets" -Method Post -ContentType "application/json" -Body $TicketPayload -TimeoutSec 5
Invoke-RestMethod -Uri "http://localhost:$HttpPort/api/v1/ticketing/availability/departures/$DispatchDepartureId/seats" -TimeoutSec 5
docker exec -e "PGPASSWORD=$PostgresPassword" $ContainerName psql -U postgres -d ticketing_db -tAc "select count(*) from outbox_events where event_type = 'TicketSold';"
docker exec -e "PGPASSWORD=$PostgresPassword" $ContainerName psql -U postgres -d ticketing_db -tAc "select count(*) from tickets where status = 'ISSUED';"
docker stop $ContainerName
```

Resultado de pruebas:

```text
mvn test:
Tests run: 21, Failures: 0, Errors: 0, Skipped: 0
BUILD SUCCESS
```

Resultado de empaquetado:

```text
El primer `mvn package -DskipTests` fallo porque Windows mantenia bloqueado:
C:\VENTA-DE-PASAJES\services\ticketing-service\target\quarkus-app\quarkus\generated-bytecode.jar

El proceso que escuchaba en 18090 era java.exe PID 26968.
No se pudo detener desde esta sesion por `Acceso denegado`.
Se genero artefacto alterno con:
mvn -f .\services\ticketing-service\pom.xml package -DskipTests "-Dquarkus.package.output-directory=quarkus-app-day30"

Resultado: BUILD SUCCESS.
Artefacto: C:\VENTA-DE-PASAJES\services\ticketing-service\target\quarkus-app-day30\quarkus-run.jar
```

Resultado de validacion local:

```json
{"service":"ticketing-service","validation":"local-postgresql-flyway","quarkus_profile":"onprem","secrets_provider":"env","database":"ticketing_db","database_port":55445,"http_port":18091,"jar":"C:\\VENTA-DE-PASAJES\\services\\ticketing-service\\target\\quarkus-app-day30\\quarkus-run.jar","health_status":"ok","overview_service":"ticketing-service","resources_count":6,"seat_statuses":5,"reservation_statuses":5,"ticket_statuses":4,"availability_departures":1,"availability_total_seats":4,"availability_available_seats":1,"availability_reserved_seats":1,"availability_sold_seats":1,"availability_cancelled_seats":1,"reservation_status":"PENDING","reservation_seat_status":"RESERVED","duplicate_reservation_http_status":409,"seats_available_after_reservation":0,"seats_reserved_after_reservation":2,"expired_reservations":1,"seats_available_after_expiration":1,"seats_reserved_after_expiration":1,"ticket_status":"ISSUED","ticket_number":"TKT-306BF833362D","duplicate_ticket_http_status":409,"seats_available_after_ticket":0,"seats_sold_after_ticket":2,"reservation_outbox_events":2,"ticket_outbox_events":1,"issued_tickets":1,"public_tables":7,"unique_constraints_or_indexes":18,"flyway_version":"3","ready":true}
```

Endpoints disponibles del Dia 30:

```text
POST /api/v1/ticketing/tickets
GET  /api/v1/ticketing/tickets/{ticketId}
```

Observaciones:

```text
El proceso manual en 18090 quedo activo porque fue iniciado con permisos que esta sesion no pudo cerrar.
El contenedor manual venta-pasajes-ticketing-reservation-pg-manual seguia activo en 55444 y no se toco.
El contenedor temporal del script en 55445 fue detenido automaticamente al finalizar.
```

## Dia 31 - Anulacion y liberacion

Fecha de ejecucion: 2026-09-15

Objetivo:

```text
Implementar anulacion de boleto.
Definir permisos de anulacion.
Registrar motivo.
Liberar asiento si corresponde.
Publicar evento TicketCancelled.
```

Cambios realizados:

```text
Se agrego la migracion V4__ticket_cancellation_trace.sql.
Se agregaron columnas cancellation_reason y cancelled_by a tickets.
Se agrego indice idx_tickets_cancelled_at.
Se agrego CancelTicketRequest.
Se amplio TicketResponse con cancelled_at, cancellation_reason y cancelled_by.
Se agrego POST /api/v1/ticketing/tickets/{ticketId}/cancel.
Se amplio TicketingSaleService con cancelacion transaccional.
Se definio el permiso funcional objetivo ticketing.tickets.cancel para integrarlo con JWT/roles mas adelante.
Mientras no exista autorizacion integrada, se exige cancelled_by para trazabilidad operativa.
Se marca el boleto como VOIDED.
Se registra motivo, operador y fecha de anulacion.
Se libera el asiento a AVAILABLE cuando release_seat=true.
Se publica TicketCancelled en outbox_events.
Se bloquea doble anulacion con HTTP 409.
Se ampliaron pruebas Maven de 21 a 24.
Se amplio scripts\verify-ticketing-service-local-db.ps1 para validar anulacion, liberacion, TicketCancelled y trazabilidad persistida.
Se creo docs\dia-31-anulacion-liberacion.md.
```

Archivos creados o modificados:

```text
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\resources\db\migration\V4__ticket_cancellation_trace.sql
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\api\TicketingTicketResource.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\service\TicketingSaleService.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\persistence\entity\Ticket.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\api\dto\CancelTicketRequest.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\api\dto\TicketResponse.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\test\java\com\ventapasajes\ticketing\api\TicketingTicketResourceContractTest.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\test\java\com\ventapasajes\ticketing\persistence\TicketingMigrationContractTest.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\test\java\com\ventapasajes\ticketing\service\TicketingTransactionConfigurationTest.java
C:\VENTA-DE-PASAJES\scripts\verify-ticketing-service-local-db.ps1
C:\VENTA-DE-PASAJES\docs\dia-31-anulacion-liberacion.md
C:\VENTA-DE-PASAJES\vitacora.md
```

Comandos ejecutados:

```powershell
Select-String -Path .\tareas.md -Pattern "### Dia 31|Dia 31" -Context 0,45
Get-Content .\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\service\TicketingSaleService.java
Get-Content .\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\api\TicketingTicketResource.java
Get-Content .\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\persistence\entity\Ticket.java
Get-Content .\services\ticketing-service\src\main\resources\db\migration\V1__ticketing_schema.sql
Get-Content .\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\api\dto\TicketResponse.java
Get-Content .\services\ticketing-service\src\test\java\com\ventapasajes\ticketing\api\TicketingTicketResourceContractTest.java
Get-Content .\services\ticketing-service\src\test\java\com\ventapasajes\ticketing\persistence\TicketingMigrationContractTest.java
Get-Content .\scripts\verify-ticketing-service-local-db.ps1
mvn -f .\services\ticketing-service\pom.xml test
mvn -f .\services\ticketing-service\pom.xml package -DskipTests "-Dquarkus.package.output-directory=quarkus-app-day31"
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-ticketing-service-local-db.ps1 -DatabasePort 55446 -HttpPort 18092 -JarPath .\services\ticketing-service\target\quarkus-app-day31\quarkus-run.jar
Get-NetTCPConnection -LocalPort 18092,55446 -ErrorAction SilentlyContinue | Select-Object LocalAddress,LocalPort,State,OwningProcess | Format-Table -AutoSize
docker ps -a --format "table {{.ID}}\t{{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}" | Select-String -Pattern "ticketing|55446|55444|postgres"
Test-Path .\services\ticketing-service\target\quarkus-app-day31\quarkus-run.jar
```

Comandos ejecutados internamente por el script de validacion:

```powershell
docker run --rm --name $ContainerName -e POSTGRES_DB=ticketing_db -e POSTGRES_USER=postgres -e "POSTGRES_PASSWORD=$PostgresPassword" -p "$DatabasePort`:5432" -d postgres:16-alpine
docker exec $ContainerName pg_isready -U postgres -d ticketing_db
Start-Process -FilePath "java" -ArgumentList @("-jar", $ResolvedJarPath) -RedirectStandardOutput $StdOutPath -RedirectStandardError $StdErrPath -WindowStyle Hidden -PassThru
Invoke-RestMethod -Uri "http://localhost:$HttpPort/api/v1/ticketing/health" -TimeoutSec 5
Invoke-RestMethod -Uri "http://localhost:$HttpPort/api/v1/ticketing/availability/sync/departures" -Method Post -ContentType "application/json" -Body $SyncPayload -TimeoutSec 5
Invoke-RestMethod -Uri "http://localhost:$HttpPort/api/v1/ticketing/reservations" -Method Post -ContentType "application/json" -Body $ReservationPayload -TimeoutSec 5
Invoke-RestMethod -Uri "http://localhost:$HttpPort/api/v1/ticketing/reservations/expire" -Method Post -ContentType "application/json" -Body $ExpirePayload -TimeoutSec 5
Invoke-RestMethod -Uri "http://localhost:$HttpPort/api/v1/ticketing/tickets" -Method Post -ContentType "application/json" -Body $TicketPayload -TimeoutSec 5
Invoke-RestMethod -Uri "http://localhost:$HttpPort/api/v1/ticketing/tickets" -Method Post -ContentType "application/json" -Body $TicketPayload -TimeoutSec 5
Invoke-RestMethod -Uri "http://localhost:$HttpPort/api/v1/ticketing/tickets/$($Ticket.ticket_id)/cancel" -Method Post -ContentType "application/json" -Body $CancelTicketPayload -TimeoutSec 5
Invoke-RestMethod -Uri "http://localhost:$HttpPort/api/v1/ticketing/tickets/$($Ticket.ticket_id)/cancel" -Method Post -ContentType "application/json" -Body $CancelTicketPayload -TimeoutSec 5
Invoke-RestMethod -Uri "http://localhost:$HttpPort/api/v1/ticketing/availability/departures/$DispatchDepartureId/seats" -TimeoutSec 5
docker exec -e "PGPASSWORD=$PostgresPassword" $ContainerName psql -U postgres -d ticketing_db -tAc "select count(*) from outbox_events where event_type = 'TicketCancelled';"
docker exec -e "PGPASSWORD=$PostgresPassword" $ContainerName psql -U postgres -d ticketing_db -tAc "select count(*) from tickets where status = 'VOIDED' and cancellation_reason is not null and cancelled_by is not null and cancelled_at is not null;"
docker stop $ContainerName
```

Resultado de pruebas:

```text
mvn test:
Tests run: 24, Failures: 0, Errors: 0, Skipped: 0
BUILD SUCCESS
```

Resultado de empaquetado:

```text
mvn package -DskipTests "-Dquarkus.package.output-directory=quarkus-app-day31":
BUILD SUCCESS
Artefacto: C:\VENTA-DE-PASAJES\services\ticketing-service\target\quarkus-app-day31\quarkus-run.jar
```

Resultado de validacion local:

```json
{"service":"ticketing-service","validation":"local-postgresql-flyway","quarkus_profile":"onprem","secrets_provider":"env","database":"ticketing_db","database_port":55446,"http_port":18092,"jar":"C:\\VENTA-DE-PASAJES\\services\\ticketing-service\\target\\quarkus-app-day31\\quarkus-run.jar","health_status":"ok","overview_service":"ticketing-service","resources_count":6,"seat_statuses":5,"reservation_statuses":5,"ticket_statuses":4,"availability_departures":1,"availability_total_seats":4,"availability_available_seats":1,"availability_reserved_seats":1,"availability_sold_seats":1,"availability_cancelled_seats":1,"reservation_status":"PENDING","reservation_seat_status":"RESERVED","duplicate_reservation_http_status":409,"seats_available_after_reservation":0,"seats_reserved_after_reservation":2,"expired_reservations":1,"seats_available_after_expiration":1,"seats_reserved_after_expiration":1,"ticket_status":"ISSUED","ticket_number":"TKT-C6120E17936A","duplicate_ticket_http_status":409,"seats_available_after_ticket":0,"seats_sold_after_ticket":2,"cancelled_ticket_status":"VOIDED","cancellation_reason":"Solicitud del pasajero en validacion local","cancelled_by":"admin-local","duplicate_cancellation_http_status":409,"seats_available_after_cancellation":1,"seats_sold_after_cancellation":1,"reservation_outbox_events":2,"ticket_outbox_events":1,"ticket_cancellation_outbox_events":1,"voided_tickets":1,"public_tables":7,"unique_constraints_or_indexes":18,"flyway_version":"4","ready":true}
```

Endpoints disponibles del Dia 31:

```text
POST /api/v1/ticketing/tickets/{ticketId}/cancel
```

Observaciones:

```text
Los puertos temporales 18092 y 55446 quedaron libres al finalizar la validacion.
El contenedor manual venta-pasajes-ticketing-reservation-pg-manual seguia activo en 55444 y no se toco.
El proceso manual en 18090 seguia fuera del alcance de esta sesion por permisos; se evito tocarlo usando artefacto y puertos alternos.
```

## Dia 34 - Mapa visual de asientos avanzado

Fecha de ejecucion: 2026-09-15

Objetivo:

```text
Mostrar estados por color.
Mostrar chofer, entrada y pasillo.
Soportar layout de 25 asientos.
Preparar soporte para otros layouts.
Probar escritorio y tablet.
```

Cambios realizados:

```text
Se reemplazo el mapa de asientos fijo por un motor de layout visual.
Se agrego LEGACY_25_SEAT_COORDINATES en apps\mfe-ticketing\app\ticketing\embedded\page.tsx.
Se agrego buildLegacy25SeatLayout para el bus legacy de 25 asientos.
Se agrego buildGeneratedSeatLayout como fallback para otros conteos.
Se agregaron celdas de Chofer, Entrada y Pasillo dentro del grid.
Se separo el estado CANCELLED con color y leyenda propia.
Se actualizo la salida demo para sincronizar 25 asientos.
Se reemplazaron estilos seat-col-* por gridColumn/gridRow y clases layout-*.
Se agregaron breakpoints responsive para escritorio/tablet.
Se creo scripts\verify-mfe-ticketing-seat-map.ps1.
Se reforzo el verificador para exigir coordenadas grid por asiento y sizing responsive.
Se creo docs\dia-34-mapa-visual-asientos-avanzado.md.
```

Archivos creados o modificados:

```text
C:\VENTA-DE-PASAJES\apps\mfe-ticketing\app\ticketing\embedded\page.tsx
C:\VENTA-DE-PASAJES\apps\mfe-ticketing\app\globals.css
C:\VENTA-DE-PASAJES\scripts\verify-mfe-ticketing-seat-map.ps1
C:\VENTA-DE-PASAJES\docs\dia-34-mapa-visual-asientos-avanzado.md
C:\VENTA-DE-PASAJES\vitacora.md
```

Comandos ejecutados:

```powershell
rg -n "seat-grid|driver-zone|seat-|nextDemoDeparturePayload|SeatMap|type Seat" apps\mfe-ticketing\app\ticketing\embedded\page.tsx apps\mfe-ticketing\app\globals.css
Get-Content -Path apps\mfe-ticketing\app\ticketing\embedded\page.tsx -TotalCount 260
Get-Content -Path apps\mfe-ticketing\app\globals.css -TotalCount 360
Get-Content -Path apps\mfe-ticketing\app\ticketing\embedded\page.tsx | Select-Object -Skip 260 -First 420
Get-Content -Path apps\mfe-ticketing\app\globals.css | Select-Object -Skip 420 -First 320
rg -n "DoorOpen|SteeringWheel|Aisle|LayoutGrid|BusFront" node_modules\lucide-react\dist node_modules\lucide-react -g "*.d.ts"
rg -n "SteeringWheel" node_modules\lucide-react\dist\lucide-react.suffixed.d.ts node_modules\lucide-react\dynamic.d.ts
npm run typecheck -w @venta-pasajes/mfe-ticketing
npm run build -w @venta-pasajes/mfe-ticketing
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-mfe-ticketing-seat-map.ps1
Invoke-WebRequest -Uri http://localhost:3000/ -UseBasicParsing -TimeoutSec 10 | Select-Object StatusCode
Invoke-RestMethod -Uri http://localhost:3003/api/health -TimeoutSec 10 | ConvertTo-Json -Compress
Invoke-RestMethod -Uri http://localhost:3003/mfe/manifest -TimeoutSec 10 | Select-Object name,title,entry_url,status | ConvertTo-Json -Compress
Select-String -Path tareas.md -Pattern "### Dia 34" -Context 0,16
Get-Content -Path docs\estandar-documentacion-dias.md -TotalCount 220
```

Resultado de typecheck:

```text
> @venta-pasajes/mfe-ticketing@0.1.0 typecheck
> tsc --noEmit -p tsconfig.json

OK
```

Resultado de build:

```text
> @venta-pasajes/mfe-ticketing@0.1.0 build
> next build

Compiled successfully.
TypeScript OK.
Rutas generadas:
/
/_not-found
/api/health
/api/ticketing/[...path]
/mfe/manifest
/ticketing/embedded
```

Resultado de validacion del mapa:

```json
{"service":"mfe-ticketing","validation":"seat-map-day34","legacy_25_layout":true,"generated_layout_fallback":true,"status_colors":["available","reserved","sold","blocked","cancelled"],"cabin_markers":["Chofer","Entrada","Pasillo"],"desktop_breakpoint":"1220px","tablet_breakpoint":"820px","embedded_status":200,"ready":true}
```

Resultado de health/manifiesto local:

```text
http://localhost:3000/ -> 200
http://localhost:3003/api/health -> {"status":"ok","service":"mfe-ticketing"}
http://localhost:3003/mfe/manifest -> {"name":"mfe-ticketing","title":"Boleteria","entry_url":"http://localhost:3003/ticketing/embedded","status":"online"}
```

Observaciones:

```text
El MFE local en http://localhost:3003 respondio con HTTP 200 para /ticketing/embedded durante la validacion.
No se instalo Playwright porque el workspace no lo tenia disponible; se dejo verificacion responsive por contrato CSS/JS y respuesta HTTP.
El frontend local que venia del Dia 33 sigue disponible en http://localhost:3000 si no se detuvo manualmente.
Para detenerlo: npm run stop:frontend.
```

### Ajuste posterior - alto dinamico del MFE embebido

Fecha de ejecucion: 2026-09-15

Problema observado:

```text
Al probar una salida de 42 asientos, el shell recortaba el iframe de Boleteria.
La lista/mapa no se veia completo y quedaba una zona inferior vacia en el shell.
```

Cambios realizados:

```text
El MFE de ticketing envia su altura real al shell con postMessage.
El shell valida el origen del mensaje contra el origen del manifiesto remoto.
El shell ajusta dinamicamente la altura del iframe entre 720px y 1800px.
El panel remoto permite overflow visible para que el navegador principal pueda desplazarse.
```

Archivos modificados:

```text
C:\VENTA-DE-PASAJES\apps\frontend-shell\app\components\RemoteMfeFrame.tsx
C:\VENTA-DE-PASAJES\apps\frontend-shell\app\globals.css
C:\VENTA-DE-PASAJES\apps\mfe-ticketing\app\ticketing\embedded\page.tsx
C:\VENTA-DE-PASAJES\vitacora.md
```

Comandos ejecutados:

```powershell
npm run typecheck -w @venta-pasajes/frontend-shell
npm run typecheck -w @venta-pasajes/mfe-ticketing
npm run build -w @venta-pasajes/frontend-shell
npm run build -w @venta-pasajes/mfe-ticketing
curl.exe -s -o NUL -w "%{http_code}" "http://localhost:3000/"
curl.exe -s -o NUL -w "%{http_code}" "http://localhost:3003/ticketing/embedded"
```

Resultado:

```text
frontend-shell typecheck OK
mfe-ticketing typecheck OK
frontend-shell build OK
mfe-ticketing build OK
http://localhost:3000/ -> 200
http://localhost:3003/ticketing/embedded -> 200
```

### Ajuste posterior - mapa escalable al ancho disponible

Fecha de ejecucion: 2026-09-15

Estado: revertido en el ajuste posterior de alto util del panel. Se mantiene como antecedente de prueba visual, pero no como estado final.

Problema observado:

```text
Aunque el iframe ya no recortaba el contenido, el bus seguia dibujandose pequeno y centrado.
El panel de Asientos quedaba con mucho espacio lateral sin uso.
```

Cambios realizados:

```text
Se aumento el tamano base del asiento y se hizo escalable con clamp/vw.
El grid del bus ahora calcula un max-width por cantidad de columnas desde React.
El mapa conserva scroll horizontal si el ancho disponible no alcanza.
Las etiquetas internas escalan con el mapa.
```

Archivos modificados:

```text
C:\VENTA-DE-PASAJES\apps\mfe-ticketing\app\ticketing\embedded\page.tsx
C:\VENTA-DE-PASAJES\apps\mfe-ticketing\app\globals.css
C:\VENTA-DE-PASAJES\vitacora.md
```

Comandos ejecutados:

```powershell
npm run typecheck -w @venta-pasajes/mfe-ticketing
npm run build -w @venta-pasajes/mfe-ticketing
curl.exe -s -o NUL -w "%{http_code}" "http://localhost:3003/ticketing/embedded"
```

Resultado:

```text
mfe-ticketing typecheck OK
mfe-ticketing build OK
http://localhost:3003/ticketing/embedded -> 200
```

### Documentacion consolidada de ajustes Dia 34

Fecha de ejecucion: 2026-09-15

Solicitud:

```text
Dejar todos los cambios documentados.
```

Cambios realizados:

```text
Se actualizo docs\dia-34-mapa-visual-asientos-avanzado.md con una seccion de Ajustes posteriores de UX.
Se documentaron alto dinamico del MFE, uso del alto util del shell, sidebar ocultable, reloj operativo y banderas de pasajero.
Se agrego validacion posterior consolidada con typecheck, build y HTTP 200.
Se actualizo el estado final y el siguiente paso natural hacia layout dinamico por backend.
Se normalizo texto del documento a ASCII para lectura estable desde PowerShell.
```

Archivos modificados:

```text
C:\VENTA-DE-PASAJES\docs\dia-34-mapa-visual-asientos-avanzado.md
C:\VENTA-DE-PASAJES\vitacora.md
```

Comandos ejecutados:

```powershell
rg -n "Ajustes posteriores de UX|Alto dinamico|Uso del alto|Barra lateral|Reloj operativo|Banderas de pasajero|Validacion posterior|Estado final|Siguiente paso" docs\dia-34-mapa-visual-asientos-avanzado.md
Get-Content -Path docs\dia-34-mapa-visual-asientos-avanzado.md -Tail 220
rg -n "Ã|ñ|Niño|niño|peque" docs\dia-34-mapa-visual-asientos-avanzado.md
```

### Ajuste posterior - reloj en shell

Fecha de ejecucion: 2026-09-15

Solicitud:

```text
Agregar en el shell un reloj con la hora y fecha actual.
```

Cambios realizados:

```text
Se agregaron formateadores Intl.DateTimeFormat para hora y fecha en es-EC.
Se agrego estado now actualizado cada segundo.
Se agrego tarjeta clock-card en el topbar del shell.
La tarjeta muestra hora con segundos y fecha completa.
Se agregaron estilos visuales responsive para el reloj.
```

Archivos modificados:

```text
C:\VENTA-DE-PASAJES\apps\frontend-shell\app\page.tsx
C:\VENTA-DE-PASAJES\apps\frontend-shell\app\globals.css
C:\VENTA-DE-PASAJES\vitacora.md
```

Comandos ejecutados:

```powershell
npm run typecheck -w @venta-pasajes/frontend-shell
npm run build -w @venta-pasajes/frontend-shell
curl.exe -s -o NUL -w "%{http_code}" "http://localhost:3000/"
Get-Date -Format "yyyy-MM-dd HH:mm:ss"
```

Resultado:

```text
frontend-shell typecheck OK
frontend-shell build OK
http://localhost:3000/ -> 200
Hora local de validacion: 2026-09-15 16:18:24
```

### Ajuste posterior - reversa de escala y uso del alto util

Fecha de ejecucion: 2026-09-15

Problema observado:

```text
La solicitud de usar el 100% se referia al espacio inferior vacio del shell, no a agrandar los asientos.
El agrandado del bus hacia que los asientos ocuparan demasiado y no resolvia la zona marcada por el usuario.
```

Cambios realizados:

```text
Se revirtio el escalado visual del bus y se restauro el tamano operativo de 48px.
Se eliminaron las variables layout-columns/layout-max-width del grid del bus.
El shell ahora hace que module-surface ocupe el alto restante del viewport.
remote-panel usa flex: 1 y min-height: 100%.
El iframe usa min-height calculado contra el viewport, manteniendo el auto-height por postMessage cuando el MFE crece.
```

Archivos modificados:

```text
C:\VENTA-DE-PASAJES\apps\mfe-ticketing\app\ticketing\embedded\page.tsx
C:\VENTA-DE-PASAJES\apps\mfe-ticketing\app\globals.css
C:\VENTA-DE-PASAJES\apps\frontend-shell\app\globals.css
C:\VENTA-DE-PASAJES\vitacora.md
```

Comandos ejecutados:

```powershell
npm run typecheck -w @venta-pasajes/mfe-ticketing
npm run typecheck -w @venta-pasajes/frontend-shell
npm run build -w @venta-pasajes/mfe-ticketing
npm run build -w @venta-pasajes/frontend-shell
curl.exe -s -o NUL -w "%{http_code}" "http://localhost:3000/"
curl.exe -s -o NUL -w "%{http_code}" "http://localhost:3003/ticketing/embedded"
```

Resultado:

```text
mfe-ticketing typecheck OK
frontend-shell typecheck OK
mfe-ticketing build OK
frontend-shell build OK
http://localhost:3000/ -> 200
http://localhost:3003/ticketing/embedded -> 200
```

### Ajuste posterior - sidebar ocultable

Fecha de ejecucion: 2026-09-15

Solicitud:

```text
Agregar opcion para ocultar la barra lateral izquierda del shell.
```

Cambios realizados:

```text
Se agrego estado sidebarCollapsed en frontend-shell.
Se agrego boton en el topbar para ocultar/mostrar la barra lateral.
Se usan iconos PanelLeftClose y PanelLeftOpen.
La preferencia queda guardada en localStorage con la clave venta-pasajes:sidebar-collapsed.
Cuando la barra esta oculta, shell-layout pasa a una sola columna para ocupar todo el ancho.
```

Archivos modificados:

```text
C:\VENTA-DE-PASAJES\apps\frontend-shell\app\page.tsx
C:\VENTA-DE-PASAJES\apps\frontend-shell\app\globals.css
C:\VENTA-DE-PASAJES\vitacora.md
```

Comandos ejecutados:

```powershell
npm run typecheck -w @venta-pasajes/frontend-shell
npm run build -w @venta-pasajes/frontend-shell
curl.exe -s -o NUL -w "%{http_code}" "http://localhost:3000/"
```

Resultado:

```text
frontend-shell typecheck OK
frontend-shell build OK
http://localhost:3000/ -> 200
```

### Ajuste posterior - banderas de pasajero en asientos vendidos

Fecha de ejecucion: 2026-09-15

Solicitud:

```text
Agregar banderas para identificar asiento vendido a persona con discapacidad, niño y adulto mayor.
```

Cambios realizados:

```text
Se agrego el tipo PassengerSeatFlag en mfe-ticketing.
SeatAvailability ahora acepta campos opcionales passenger_flags, passenger_category y passenger_type para compatibilidad futura con backend.
Se agrego normalizacion de banderas DISABILITY, CHILD y OLDER_ADULT.
Se agregaron banderas visuales en asientos SOLD.
Se agregaron entradas de leyenda: Discapacidad, Niño y Adulto mayor.
Se dejaron banderas demo para asientos vendidos 6, 22 y 39 mientras backend no envie esos campos.
```

Archivos modificados:

```text
C:\VENTA-DE-PASAJES\apps\mfe-ticketing\app\ticketing\embedded\page.tsx
C:\VENTA-DE-PASAJES\apps\mfe-ticketing\app\globals.css
C:\VENTA-DE-PASAJES\vitacora.md
```

Comandos ejecutados:

```powershell
npm run typecheck -w @venta-pasajes/mfe-ticketing
npm run build -w @venta-pasajes/mfe-ticketing
curl.exe -s -o NUL -w "%{http_code}" "http://localhost:3003/ticketing/embedded"
```

Resultado:

```text
mfe-ticketing typecheck OK
mfe-ticketing build OK
http://localhost:3003/ticketing/embedded -> 200
```

## Dia 33 - mfe-ticketing base

Fecha de ejecucion: 2026-09-15

Objetivo:

```text
Crear MFE de boleteria.
Crear buscador de salidas.
Crear mapa visual de asientos.
Crear formulario de pasajero.
Crear confirmacion de venta.
Integrar con shell.
```

Cambios realizados:

```text
Se creo apps\mfe-ticketing como aplicacion Next.js independiente.
Se agrego manifiesto remoto en /mfe/manifest.
Se agrego health endpoint en /api/health.
Se agrego proxy local /api/ticketing/* hacia ticketing-service.
Se agrego pantalla embebible en /ticketing/embedded.
Se implemento buscador/listado de salidas por fecha y texto.
Se implemento mapa visual inicial de asientos con estados AVAILABLE, RESERVED, SOLD y BLOCKED/CANCELLED.
Se implemento formulario de pasajero y tarifa.
Se implemento emision de boleto con POST /api/ticketing/tickets.
Se implemento confirmacion con numero de boleto, asiento y monto.
Se agrego accion Salida demo para sincronizar disponibilidad inicial desde el MFE.
Se integro Boleteria en frontend-shell y quedo como modulo activo inicial.
Se agrego workspace apps/mfe-ticketing a package.json y package-lock.json.
Se actualizaron scripts build/typecheck/dev/stop de frontend para incluir mfe-ticketing.
Se actualizo apps\README.md con el nuevo MFE y puerto 3003.
Se agregaron scripts verify-mfe-ticketing.ps1 y verify-mfe-ticketing-stack.ps1.
Se creo docs\dia-33-mfe-ticketing-base.md.
```

Archivos creados o modificados:

```text
C:\VENTA-DE-PASAJES\apps\mfe-ticketing\package.json
C:\VENTA-DE-PASAJES\apps\mfe-ticketing\tsconfig.json
C:\VENTA-DE-PASAJES\apps\mfe-ticketing\next-env.d.ts
C:\VENTA-DE-PASAJES\apps\mfe-ticketing\next.config.ts
C:\VENTA-DE-PASAJES\apps\mfe-ticketing\.env.example
C:\VENTA-DE-PASAJES\apps\mfe-ticketing\app\layout.tsx
C:\VENTA-DE-PASAJES\apps\mfe-ticketing\app\page.tsx
C:\VENTA-DE-PASAJES\apps\mfe-ticketing\app\globals.css
C:\VENTA-DE-PASAJES\apps\mfe-ticketing\app\api\health\route.ts
C:\VENTA-DE-PASAJES\apps\mfe-ticketing\app\api\ticketing\[...path]\route.ts
C:\VENTA-DE-PASAJES\apps\mfe-ticketing\app\ticketing\embedded\page.tsx
C:\VENTA-DE-PASAJES\apps\mfe-ticketing\app\mfe\manifest\route.ts
C:\VENTA-DE-PASAJES\scripts\verify-mfe-ticketing.ps1
C:\VENTA-DE-PASAJES\scripts\verify-mfe-ticketing-stack.ps1
C:\VENTA-DE-PASAJES\package.json
C:\VENTA-DE-PASAJES\package-lock.json
C:\VENTA-DE-PASAJES\apps\frontend-shell\.env.example
C:\VENTA-DE-PASAJES\apps\frontend-shell\app\page.tsx
C:\VENTA-DE-PASAJES\apps\README.md
C:\VENTA-DE-PASAJES\scripts\start-frontend-dev.ps1
C:\VENTA-DE-PASAJES\scripts\stop-frontend-dev.ps1
C:\VENTA-DE-PASAJES\docs\dia-33-mfe-ticketing-base.md
C:\VENTA-DE-PASAJES\vitacora.md
```

Comandos ejecutados:

```powershell
Select-String -Path .\tareas.md -Pattern "### Dia 33|Dia 33" -Context 0,45
Get-Content .\apps\mfe-dispatch\package.json
Get-Content .\apps\mfe-dispatch\app\dispatch\embedded\page.tsx
Get-Content .\apps\mfe-dispatch\app\mfe\manifest\route.ts
Get-Content -LiteralPath .\apps\mfe-dispatch\app\api\dispatch\[...path]\route.ts
Get-Content .\apps\frontend-shell\app\page.tsx
Get-Content .\apps\frontend-shell\app\components\RemoteMfeFrame.tsx
Get-Content .\scripts\start-frontend-dev.ps1
Get-Content .\scripts\stop-frontend-dev.ps1
Get-Content .\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\api\TicketingAvailabilityResource.java
Get-Content .\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\api\TicketingTicketResource.java
New-Item -ItemType Directory -Force -Path .\apps\mfe-ticketing\app\api\ticketing\[...path], .\apps\mfe-ticketing\app\api\health, .\apps\mfe-ticketing\app\ticketing\embedded, .\apps\mfe-ticketing\app\mfe\manifest
npm install --package-lock-only --ignore-scripts
npm run typecheck:frontend
npm run build:frontend
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-mfe-ticketing.ps1 -ShellPort 3010 -MfeTicketingPort 3013
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-mfe-ticketing-stack.ps1 -DatabasePort 55448 -TicketingHttpPort 18094 -ShellPort 3010 -MfeTicketingPort 3013 -JarPath .\services\ticketing-service\target\quarkus-app-day32\quarkus-run.jar
Get-NetTCPConnection -LocalPort 55448,55449,18094,3010,3013 -ErrorAction SilentlyContinue | Select-Object LocalAddress,LocalPort,State,OwningProcess
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-mfe-ticketing-stack.ps1 -DatabasePort 55449 -TicketingHttpPort 18094 -ShellPort 3010 -MfeTicketingPort 3013 -JarPath .\services\ticketing-service\target\quarkus-app-day32\quarkus-run.jar
Get-NetTCPConnection -LocalPort 55449,18094,3010,3013 -State Listen -ErrorAction SilentlyContinue | Select-Object LocalAddress,LocalPort,OwningProcess
docker ps -a --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}" | Select-String -Pattern "mfe-ticketing|55449|18094|3010|3013"
Get-NetTCPConnection -LocalPort 3000,3001,3002,3003 -State Listen -ErrorAction SilentlyContinue | Select-Object LocalAddress,LocalPort,OwningProcess
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-frontend-dev.ps1
Invoke-RestMethod -Uri http://localhost:3003/api/health -TimeoutSec 10
Invoke-RestMethod -Uri http://localhost:3003/mfe/manifest -TimeoutSec 10
Invoke-WebRequest -Uri http://localhost:3000/ -UseBasicParsing -TimeoutSec 10
npm run typecheck -w @venta-pasajes/mfe-ticketing
npm run build -w @venta-pasajes/mfe-ticketing
```

Resultado de typecheck:

```text
npm run typecheck:frontend:
shared-types OK
mfe-identity OK
mfe-dispatch OK
mfe-ticketing OK
frontend-shell OK
npm run typecheck -w @venta-pasajes/mfe-ticketing: OK
```

Resultado de build:

```text
npm run build:frontend:
mfe-identity build OK
mfe-dispatch build OK
mfe-ticketing build OK
frontend-shell build OK
npm run build -w @venta-pasajes/mfe-ticketing: OK
```

Rutas generadas por mfe-ticketing:

```text
/
/api/health
/api/ticketing/[...path]
/mfe/manifest
/ticketing/embedded
```

Resultado de validacion aislada:

```json
{"service":"mfe-ticketing","validation":"manifest-shell-embedded","shell_url":"http://localhost:3010","shell_status":200,"mfe_ticketing_url":"http://localhost:3013","mfe_ticketing_health":"ok","manifest_name":"mfe-ticketing","manifest_entry_url":"http://localhost:3013/ticketing/embedded","embedded_status":200,"backend_proxy_status":502,"ticket_status":null,"ticket_number":null,"seats_available_after_ticket":null,"ready":true}
```

Resultado de validacion integrada:

```json
{"service":"mfe-ticketing","validation":"frontend-backend-stack","database":"ticketing_db","database_port":55449,"ticketing_http_port":18094,"shell_url":"http://localhost:3010","shell_status":200,"mfe_ticketing_url":"http://localhost:3013","mfe_ticketing_health":"ok","manifest_name":"mfe-ticketing","embedded_status":200,"backend_proxy_status":200,"ticket_status":"ISSUED","ticket_number":"TKT-0E8F6AE6D83C","seats_available_after_ticket":1,"ready":true}
```

Resultado de arranque frontend local:

```json
{"shell_url":"http://localhost:3000","shell_pid":25300,"mfe_identity_url":"http://localhost:3001","mfe_identity_pid":68004,"mfe_dispatch_url":"http://localhost:3002","mfe_dispatch_pid":63388,"mfe_ticketing_url":"http://localhost:3003","mfe_ticketing_pid":58140}
```

Health y manifiesto de mfe-ticketing:

```json
{"status":"ok","service":"mfe-ticketing"}
{"name":"mfe-ticketing","title":"Boleteria","version":"0.1.0","status":"online","mount_path":"/ticketing","entry_url":"http://localhost:3003/ticketing/embedded","health_url":"http://localhost:3003/api/health","capabilities":["busqueda-salidas","mapa-asientos","datos-pasajero","venta-boletos","confirmacion-venta"]}
```

Observaciones:

```text
El primer intento de validacion integrada fallo porque el puerto 55448 estaba en estado Bound por otro proceso de Windows/Docker.
Se reintento con 55449 y la validacion integrada quedo OK.
Se ajusto verify-mfe-ticketing-stack.ps1 para detectar cualquier uso del puerto, no solo estado Listen.
Los puertos temporales 55449, 18094, 3010 y 3013 quedaron libres al finalizar la validacion.
El frontend local quedo corriendo en 3000, 3001, 3002 y 3003 para prueba manual.
Para detenerlo: npm run stop:frontend.
```

## Dia 32 - Pasajeros/clientes

Fecha de ejecucion: 2026-09-15

Objetivo:

```text
Implementar CRUD de pasajeros.
Buscar por documento, nombre o apellido.
Evitar duplicados razonables.
Relacionar historial de boletos.
Agregar validaciones.
```

Cambios realizados:

```text
Se agrego la migracion V5__passenger_search_indexes.sql.
Se agregaron indices idx_passengers_document_number, idx_passengers_name_search y idx_passengers_status_name.
Se agregaron PassengerRequest y PassengerResponse.
Se agrego TicketingPassengerResource con CRUD, busqueda y endpoint de historial.
Se agrego TicketingPassengerService con validaciones, deduplicacion y mapeo de historial.
Se evita duplicidad por document_type + document_number con HTTP 409.
Se evita duplicidad por email con HTTP 409 para respetar uq_passengers_email_not_null.
Se refactorizaron TicketingReservationService y TicketingSaleService para reutilizar findOrCreateFromRequest.
Se agrego TicketingPassengerResourceContractTest.
Se amplio TicketingMigrationContractTest para validar V5.
Se ampliaron pruebas Maven de 24 a 27.
Se amplio scripts\verify-ticketing-service-local-db.ps1 para validar CRUD, busqueda, duplicados, baja logica e historial de pasajeros.
Se creo docs\dia-32-pasajeros-clientes.md.
```

Archivos creados o modificados:

```text
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\resources\db\migration\V5__passenger_search_indexes.sql
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\api\TicketingPassengerResource.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\service\TicketingPassengerService.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\service\TicketingReservationService.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\service\TicketingSaleService.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\api\dto\PassengerRequest.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\api\dto\PassengerResponse.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\test\java\com\ventapasajes\ticketing\api\TicketingPassengerResourceContractTest.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\test\java\com\ventapasajes\ticketing\persistence\TicketingMigrationContractTest.java
C:\VENTA-DE-PASAJES\scripts\verify-ticketing-service-local-db.ps1
C:\VENTA-DE-PASAJES\docs\dia-32-pasajeros-clientes.md
C:\VENTA-DE-PASAJES\vitacora.md
```

Comandos ejecutados:

```powershell
Select-String -Path .\tareas.md -Pattern "### Dia 32|Dia 32" -Context 0,45
Get-Content .\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\service\TicketingPassengerService.java
Get-Content .\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\api\TicketingPassengerResource.java
Get-Content .\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\service\TicketingReservationService.java
Get-Content .\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\service\TicketingSaleService.java
Get-Content .\services\ticketing-service\src\main\resources\db\migration\V1__ticketing_schema.sql
Get-Content .\services\ticketing-service\src\test\java\com\ventapasajes\ticketing\api\TicketingPassengerResourceContractTest.java
Get-Content .\services\ticketing-service\src\test\java\com\ventapasajes\ticketing\persistence\TicketingMigrationContractTest.java
Get-Content .\scripts\verify-ticketing-service-local-db.ps1
mvn -f .\services\ticketing-service\pom.xml test
mvn -f .\services\ticketing-service\pom.xml package -DskipTests "-Dquarkus.package.output-directory=quarkus-app-day32"
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-ticketing-service-local-db.ps1 -DatabasePort 55447 -HttpPort 18093 -JarPath .\services\ticketing-service\target\quarkus-app-day32\quarkus-run.jar
Get-NetTCPConnection -LocalPort 18093,55447 -State Listen -ErrorAction SilentlyContinue | Select-Object LocalAddress,LocalPort,OwningProcess
docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}" | Select-String -Pattern "55447|18093|venta-pasajes-ticketing-base-pg"
Test-Path .\services\ticketing-service\target\quarkus-app-day32\quarkus-run.jar
```

Comandos ejecutados internamente por el script de validacion:

```powershell
docker run --rm --name $ContainerName -e POSTGRES_DB=ticketing_db -e POSTGRES_USER=postgres -e "POSTGRES_PASSWORD=$PostgresPassword" -p "$DatabasePort`:5432" -d postgres:16-alpine
docker exec $ContainerName pg_isready -U postgres -d ticketing_db
Start-Process -FilePath "java" -ArgumentList @("-jar", $ResolvedJarPath) -RedirectStandardOutput $StdOutPath -RedirectStandardError $StdErrPath -WindowStyle Hidden -PassThru
Invoke-RestMethod -Uri "http://localhost:$HttpPort/api/v1/ticketing/passengers" -Method Post -ContentType "application/json" -Body $PassengerPayload -TimeoutSec 5
Invoke-RestMethod -Uri "http://localhost:$HttpPort/api/v1/ticketing/passengers" -Method Post -ContentType "application/json" -Body $PassengerPayload -TimeoutSec 5
Invoke-RestMethod -Uri "http://localhost:$HttpPort/api/v1/ticketing/passengers?document_number=1919191919" -TimeoutSec 5
Invoke-RestMethod -Uri "http://localhost:$HttpPort/api/v1/ticketing/passengers?q=Marta" -TimeoutSec 5
Invoke-RestMethod -Uri "http://localhost:$HttpPort/api/v1/ticketing/passengers/$($Passenger.passenger_id)" -Method Put -ContentType "application/json" -Body $PassengerUpdatePayload -TimeoutSec 5
Invoke-RestMethod -Uri "http://localhost:$HttpPort/api/v1/ticketing/passengers" -Method Post -ContentType "application/json" -Body $DuplicatePassengerEmailPayload -TimeoutSec 5
Invoke-RestMethod -Uri "http://localhost:$HttpPort/api/v1/ticketing/passengers/$($Passenger.passenger_id)" -Method Delete -TimeoutSec 5
Invoke-RestMethod -Uri "http://localhost:$HttpPort/api/v1/ticketing/availability/sync/departures" -Method Post -ContentType "application/json" -Body $SyncPayload -TimeoutSec 5
Invoke-RestMethod -Uri "http://localhost:$HttpPort/api/v1/ticketing/reservations" -Method Post -ContentType "application/json" -Body $ReservationPayload -TimeoutSec 5
Invoke-RestMethod -Uri "http://localhost:$HttpPort/api/v1/ticketing/tickets" -Method Post -ContentType "application/json" -Body $TicketPayload -TimeoutSec 5
Invoke-RestMethod -Uri "http://localhost:$HttpPort/api/v1/ticketing/tickets/$($Ticket.ticket_id)/cancel" -Method Post -ContentType "application/json" -Body $CancelTicketPayload -TimeoutSec 5
Invoke-RestMethod -Uri "http://localhost:$HttpPort/api/v1/ticketing/passengers/$($Ticket.passenger_id)/tickets" -TimeoutSec 5
docker exec -e "PGPASSWORD=$PostgresPassword" $ContainerName psql -U postgres -d ticketing_db -tAc "select count(*) from passengers;"
docker exec -e "PGPASSWORD=$PostgresPassword" $ContainerName psql -U postgres -d ticketing_db -tAc "select version from flyway_schema_history where success = true order by installed_rank desc limit 1;"
docker stop $ContainerName
```

Resultado de pruebas:

```text
mvn test:
Tests run: 27, Failures: 0, Errors: 0, Skipped: 0
BUILD SUCCESS
```

Resultado de empaquetado:

```text
mvn package -DskipTests "-Dquarkus.package.output-directory=quarkus-app-day32":
BUILD SUCCESS
Artefacto: C:\VENTA-DE-PASAJES\services\ticketing-service\target\quarkus-app-day32\quarkus-run.jar
```

Resultado de validacion local:

```json
{"service":"ticketing-service","validation":"local-postgresql-flyway","quarkus_profile":"onprem","secrets_provider":"env","database":"ticketing_db","database_port":55447,"http_port":18093,"jar":"C:\\VENTA-DE-PASAJES\\services\\ticketing-service\\target\\quarkus-app-day32\\quarkus-run.jar","health_status":"ok","overview_service":"ticketing-service","resources_count":6,"seat_statuses":5,"reservation_statuses":5,"ticket_statuses":4,"passenger_status":"ACTIVE","passenger_document_number":"1919191919","duplicate_passenger_http_status":409,"duplicate_passenger_email_http_status":409,"passenger_search_by_document":1,"passenger_search_by_name":1,"updated_passenger_last_name":"Cliente Actualizada","deactivated_passenger_status":"INACTIVE","availability_departures":1,"availability_total_seats":4,"availability_available_seats":1,"availability_reserved_seats":1,"availability_sold_seats":1,"availability_cancelled_seats":1,"reservation_status":"PENDING","reservation_seat_status":"RESERVED","duplicate_reservation_http_status":409,"seats_available_after_reservation":0,"seats_reserved_after_reservation":2,"expired_reservations":1,"seats_available_after_expiration":1,"seats_reserved_after_expiration":1,"ticket_status":"ISSUED","ticket_number":"TKT-F628B464C17E","duplicate_ticket_http_status":409,"seats_available_after_ticket":0,"seats_sold_after_ticket":2,"cancelled_ticket_status":"VOIDED","cancellation_reason":"Solicitud del pasajero en validacion local","cancelled_by":"admin-local","duplicate_cancellation_http_status":409,"seats_available_after_cancellation":1,"seats_sold_after_cancellation":1,"ticket_history_count":1,"reservation_outbox_events":2,"ticket_outbox_events":1,"ticket_cancellation_outbox_events":1,"voided_tickets":1,"passengers_count":3,"public_tables":7,"unique_constraints_or_indexes":18,"flyway_version":"5","ready":true}
```

Endpoints disponibles del Dia 32:

```text
GET    /api/v1/ticketing/passengers
POST   /api/v1/ticketing/passengers
GET    /api/v1/ticketing/passengers/{passengerId}
PUT    /api/v1/ticketing/passengers/{passengerId}
DELETE /api/v1/ticketing/passengers/{passengerId}
GET    /api/v1/ticketing/passengers/{passengerId}/tickets
```

Observaciones:

```text
Los puertos temporales 18093 y 55447 quedaron libres al finalizar la validacion.
El contenedor manual venta-pasajes-ticketing-reservation-pg-manual seguia activo en 55444 y no se toco.
El proceso manual en 18090 seguia fuera del alcance de esta sesion por permisos; se evito tocarlo usando artefacto y puertos alternos.
```

## Dia 35 - Flujo completo de venta en frontend

Fecha de ejecucion: 2026-09-15

Resumen:

```text
Se cerro el flujo completo de venta desde mfe-ticketing.
El panel de venta ahora muestra salida, asiento y estado del asiento seleccionado.
Se agrego progreso visual: Salida, Asiento, Pasajero y Confirmacion.
El boton Emitir boleto queda deshabilitado hasta tener salida, asiento libre, pasajero completo y tarifa valida.
El POST de venta envia pasajero saneado con trim y moneda en mayusculas.
Despues de venta exitosa se refresca la salida seleccionada y el mapa de asientos.
En conflicto de asiento se refresca disponibilidad y se muestra mensaje accionable para escoger otro asiento libre.
El verificador integrado ahora valida asiento SOLD, disponibilidad refrescada y duplicado HTTP 409.
```

Archivos creados o modificados:

```text
C:\VENTA-DE-PASAJES\apps\mfe-ticketing\app\ticketing\embedded\page.tsx
C:\VENTA-DE-PASAJES\apps\mfe-ticketing\app\globals.css
C:\VENTA-DE-PASAJES\scripts\verify-mfe-ticketing.ps1
C:\VENTA-DE-PASAJES\scripts\verify-mfe-ticketing-stack.ps1
C:\VENTA-DE-PASAJES\docs\dia-35-flujo-completo-venta-frontend.md
C:\VENTA-DE-PASAJES\vitacora.md
```

Comandos ejecutados:

```powershell
npm run typecheck -w @venta-pasajes/mfe-ticketing
npm run build -w @venta-pasajes/mfe-ticketing
npm run typecheck:frontend
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-mfe-ticketing-stack.ps1 -DatabasePort 55451 -TicketingHttpPort 18095 -ShellPort 3010 -MfeTicketingPort 3013 -JarPath .\services\ticketing-service\target\quarkus-app-day32\quarkus-run.jar
```

Resultado:

```text
npm run typecheck -w @venta-pasajes/mfe-ticketing: OK
npm run build -w @venta-pasajes/mfe-ticketing: OK
npm run typecheck:frontend: OK
```

Validacion integrada:

```json
{"service":"mfe-ticketing","validation":"frontend-backend-stack","database":"ticketing_db","database_port":55451,"ticketing_http_port":18095,"shell_url":"http://localhost:3010","shell_status":200,"mfe_ticketing_url":"http://localhost:3013","mfe_ticketing_health":"ok","manifest_name":"mfe-ticketing","embedded_status":200,"backend_proxy_status":200,"ticket_status":"ISSUED","ticket_number":"TKT-1554635BFCCC","seats_available_after_ticket":1,"seats_sold_after_ticket":2,"sold_seat_status":"SOLD","duplicate_ticket_http_status":409,"availability_refreshed_after_ticket":true,"ready":true}
```

Observaciones:

```text
El verificador usa next start despues de build para evitar el lock de next dev si el shell local ya esta abierto.
Los puertos temporales 55451, 18095, 3010 y 3013 quedaron libres.
No quedaron contenedores temporales venta-pasajes-mfe-ticketing-pg activos.
```

## Dia 36 - Compilacion nativa de ticketing-service

Fecha de ejecucion: 2026-09-15

Resumen:

```text
Se preparo ticketing-service para ejecucion nativa con Quarkus/Mandrel.
Se agrego Dockerfile.native para runtime UBI minimal en puerto 8083.
Se incluyeron migraciones Flyway en el binario nativo.
Se agregaron scripts de build/push y validacion nativa local.
Se ejecuto build nativo, se creo imagen local y se publico en Artifact Registry dev.
Se valido el flujo funcional nativo con PostgreSQL temporal: pasajero, disponibilidad, reserva, expiracion, venta, duplicado 409 y anulacion.
```

Archivos creados o modificados:

```text
C:\VENTA-DE-PASAJES\services\ticketing-service\pom.xml
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\resources\application.properties
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\docker\Dockerfile.native
C:\VENTA-DE-PASAJES\services\ticketing-service\README.md
C:\VENTA-DE-PASAJES\scripts\build-ticketing-service-native.ps1
C:\VENTA-DE-PASAJES\scripts\verify-ticketing-service-native-local.ps1
C:\VENTA-DE-PASAJES\docs\dia-36-compilacion-nativa-ticketing-service.md
C:\VENTA-DE-PASAJES\vitacora.md
```

Comandos ejecutados:

```powershell
mvn -f .\services\ticketing-service\pom.xml test
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-ticketing-service-native.ps1 -UseCleanWorkspace
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-ticketing-service-native-local.ps1 -ImageTag ticketing-service:0.1.0-native -HttpPort 18096 -DatabasePort 55452
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-ticketing-service-native.ps1 -SkipNativeBuild -SkipDockerBuild -Push
gcloud artifacts docker images list us-central1-docker.pkg.dev/project-fbb34cd7-0b82-43e1-867/venta-pasajes-dev/ticketing-service --include-tags --format="table[box](IMAGE,DIGEST,TAGS,UPDATE_TIME)" --limit=5
```

Resultados:

```text
mvn test: Tests run: 27, Failures: 0, Errors: 0, Skipped: 0.
Native runner: 105079024 bytes.
Docker image: 109751256 bytes.
maven-native-build: 80970 ms.
docker-build: 7288 ms.
docker-push: 81487 ms.
Startup native container: 1450 ms.
Memoria reportada por docker stats: 44.27MiB / 15.47GiB.
CPU reportado por docker stats: 0.02%.
```

Build nativo:

```json
{"service":"ticketing-service","native_runner":"C:\\Users\\diego.martinezc\\AppData\\Local\\Temp\\venta-pasajes-ticketing-native-67412\\ticketing-service\\target\\ticketing-service-0.1.0-SNAPSHOT-runner","native_runner_bytes":105079024,"build_workspace":"C:\\Users\\diego.martinezc\\AppData\\Local\\Temp\\venta-pasajes-ticketing-native-67412","local_image":"ticketing-service:0.1.0-native","artifact_image":"us-central1-docker.pkg.dev/project-fbb34cd7-0b82-43e1-867/venta-pasajes-dev/ticketing-service:0.1.0-native","pushed":false,"timings":[{"name":"maven-native-build","elapsed_ms":80970},{"name":"docker-build","elapsed_ms":7288}],"image_id":"sha256:6613d98994de7bec869b950ae5e9e0241954a3b71ee690c2b0a5fef17d06ca13","image_size_bytes":109751256,"ready":true}
```

Validacion nativa local:

```json
{"service":"ticketing-service","runtime":"native-container","image":"ticketing-service:0.1.0-native","quarkus_profile":"onprem","database":"ticketing_db","migration_tool":"flyway","http_port":18096,"database_port":55452,"startup_ms":1450,"health_status":"ok","overview_service":"ticketing-service","resources_count":6,"seat_statuses":5,"reservation_statuses":5,"ticket_statuses":4,"passenger_status":"ACTIVE","synced_total_seats":4,"reservation_status":"PENDING","expired_reservations":1,"ticket_status":"ISSUED","ticket_number":"TKT-05BBC9EF19F3","sold_seat_status":"SOLD","duplicate_ticket_http_status":409,"cancelled_ticket_status":"VOIDED","memory_usage":"44.27MiB / 15.47GiB","cpu_percent":"0.02%","network":"venta-pasajes-ticketing-native-880","ready":true}
```

Publicacion:

```json
{"service":"ticketing-service","native_runner":null,"native_runner_bytes":0,"build_workspace":null,"local_image":"ticketing-service:0.1.0-native","artifact_image":"us-central1-docker.pkg.dev/project-fbb34cd7-0b82-43e1-867/venta-pasajes-dev/ticketing-service:0.1.0-native","pushed":true,"timings":[{"name":"docker-push","elapsed_ms":81487}],"image_id":null,"image_size_bytes":null,"ready":true}
```

Artifact Registry:

```text
us-central1-docker.pkg.dev/project-fbb34cd7-0b82-43e1-867/venta-pasajes-dev/ticketing-service
tag: 0.1.0-native
digest: sha256:6613d98994de7bec869b950ae5e9e0241954a3b71ee690c2b0a5fef17d06ca13
update_time: 2026-09-15T17:02:20
```

Limpieza:

```text
Los puertos temporales 18096 y 55452 quedaron libres.
No quedaron contenedores temporales venta-pasajes-ticketing-native activos.
No quedaron redes Docker temporales venta-pasajes-ticketing-native activas.
```

### Ajuste documental Dia 36 - Reversa y ejecucion desde cero

Fecha de ajuste: 2026-09-16

```text
Se amplio docs\dia-36-compilacion-nativa-ticketing-service.md con el mismo formato usado en practicas anteriores.
Se agrego una seccion "Valores usados".
Se agrego "Reversa primero" con limpieza de contenedores, redes, puertos, imagenes locales y Artifact Registry.
Se agrego "Guia manual desde cero" con pasos para validar herramientas, pruebas JVM, build nativo, verificacion local, push y consulta remota.
Se incluyo una alternativa manual sin script para compilar, construir y etiquetar la imagen.
```

### Ajuste documental Dia 35 - Reversa y ejecucion desde cero

Fecha de ajuste: 2026-09-16

```text
Se amplio docs\dia-35-flujo-completo-venta-frontend.md con el formato usado en practicas anteriores.
Se agrego una seccion "Valores usados" con puertos, URLs y jar de backend.
Se agrego "Reversa primero" para detener frontend, backend, PostgreSQL temporal, liberar puertos y limpiar builds opcionales.
Se agrego "Guia manual desde cero" para preparar ticketing-service, validar frontend, ejecutar la validacion integrada y levantar la UI manualmente.
Se incluyeron pasos para operar la venta desde la pantalla y detener la ejecucion manual.
```

### Estandarizacion retroactiva documentos Dia 1 al Dia 20

Fecha de ajuste: 2026-09-16

```text
Se auditaron todos los documentos docs\dia-*.md.
Los documentos Dia 21 al Dia 36 ya tenian "Reversa primero" y "Guia manual desde cero".
Los documentos Dia 1 al Dia 20 eran previos al estandar y no tenian esas secciones.
Se agrego una reversa segura y una guia manual desde cero a los documentos Dia 1 al Dia 20.
Se verifico que los 36 documentos diarios tengan ahora ambas secciones.
```

### Dia 37 - document-service

Fecha de ejecucion: 2026-09-16

```text
Se genero document-service desde la plantilla Quarkus del monorepo.
Se agregaron dependencias para PDFBox y Google Cloud Storage.
Se creo la plantilla HTML de boleto en resources/templates/ticket.html.
Se implemento generacion de PDF de boleto con endpoint POST /api/v1/document/documents/tickets/{ticketId}.
Se implemento descarga con GET /api/v1/document/documents/{documentId}/download.
Se implemento storage configurable local/gcs mediante APP_DOCUMENT_STORAGE_PROVIDER.
Se reemplazo la migracion placeholder por tablas document_templates, documents y outbox_events.
Se persistio el evento DocumentGenerated en outbox_events.
Se agrego script scripts\verify-document-service-local.ps1 para validacion con PostgreSQL temporal.
Se actualizo docs\openapi\document-service.openapi.yaml con respuesta 201 y endpoint de descarga.
Se actualizo services\document-service\README.md.
Se creo docs\dia-37-document-service.md con Reversa primero y Guia manual desde cero.
```

Validaciones:

```text
mvn -f .\services\document-service\pom.xml test
Resultado: 5 pruebas OK.

powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-document-service-local.ps1 -SkipPackage
Resultado: PDF generado y descargado, checksum SHA-256 presente, DocumentGenerated en outbox_events, ready=true.
```

Resultado de validacion funcional:

```json
{"service":"document-service","runtime":"jvm","quarkus_profile":"onprem","database":"documents_db","migration_tool":"flyway","http_port":18097,"database_port":55453,"health_status":"ok","overview_service":"document-service","resources_count":3,"ticket_id":"8d5c0006-6d84-4549-8dfc-104ff4aa6051","ticket_number":"D37-20260916152415745","document_id":"1a00f33c-e209-41f5-91c1-151a85b7232b","document_status":"GENERATED","storage_provider":"local","storage_uri":"local://tickets/8d5c0006-6d84-4549-8dfc-104ff4aa6051/D37-20260916152415745.pdf","downloaded_pdf":"C:\\VENTA-DE-PASAJES\\services\\document-service\\target\\document-service-verify-15624.pdf","downloaded_pdf_bytes":1329,"checksum_sha256":"efd1ea0fdebc12c016899e261e66d9b9aec111fe2d3b4c1056c536d8f6c281fc","outbox_document_generated_events":1,"storage_dir":"C:\\VENTA-DE-PASAJES\\services\\document-service\\target\\document-storage-verify-15624","ready":true}
```

### Ajuste documental Dia 37 - Ruta absoluta para validar PDF

Fecha de ajuste: 2026-09-16

```text
Se corrigio el Paso 9 de docs\dia-37-document-service.md.
La descarga y validacion del PDF ahora usan $PdfPath con ruta absoluta.
Se agrego creacion del directorio destino y Test-Path antes de ReadAllBytes.
El ajuste evita que .NET busque el PDF bajo C:\Windows\system32 cuando PowerShell se abre como administrador.
```

### Ajuste Dia 37 - Puertos ocupados en verificacion automatica

Fecha de ajuste: 2026-09-16

```text
Se mejoro scripts\verify-document-service-local.ps1 para reportar el proceso dueno cuando un puerto esta ocupado.
Se amplio el Paso 11 de docs\dia-37-document-service.md con limpieza previa de document-service manual y PostgreSQL manual.
Se agrego una alternativa para ejecutar la validacion automatica con -HttpPort 18197 y -DatabasePort 15453.
Se agrego deteccion de rangos de puertos excluidos de Windows en scripts\verify-document-service-local.ps1.
Se valido correctamente la alternativa con puertos 18197 y 15453.
Se agrego validacion temprana de Docker Desktop activo para reportar claramente cuando dockerDesktopLinuxEngine no esta disponible.
Se agrego docker info al Paso 1 de docs\dia-37-document-service.md.
Se agregaron comandos concretos de Windows para iniciar Docker Desktop desde PowerShell y esperar a que docker info responda.
Se reforzo el Paso 11 indicando que el error dockerDesktopLinuxEngine significa Docker Desktop apagado, no puerto ocupado.
Se cambio scripts\verify-document-service-local.ps1 para ejecutar mvn clean package y evitar errores por target\quarkus-app incompleto.
Se actualizo el Paso 3 de docs\dia-37-document-service.md con mvn -DskipTests clean package.
```

### Correccion operativa Dia 37 - Verificador ejecutado con puertos por defecto

Fecha de ajuste: 2026-09-16

```text
Se confirmo que el error inicial del verificador era Docker Desktop apagado.
Luego se encontro un contenedor temporal venta-pasajes-document-pg-manual conservando el mapeo 55453->5432.
Se elimino el contenedor temporal con docker rm -f venta-pasajes-document-pg-manual.
Se ejecuto powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-document-service-local.ps1 con puertos por defecto.
La validacion termino correctamente con ready=true.
```

Resultado:

```json
{"service":"document-service","runtime":"jvm","quarkus_profile":"onprem","database":"documents_db","migration_tool":"flyway","http_port":18097,"database_port":55453,"health_status":"ok","overview_service":"document-service","resources_count":3,"ticket_id":"1d326e95-2718-48ef-8e27-3684a6446715","ticket_number":"D37-20260916155634641","document_id":"d0471160-b64e-4ae5-92cc-2b9b4276bde1","document_status":"GENERATED","storage_provider":"local","storage_uri":"local://tickets/1d326e95-2718-48ef-8e27-3684a6446715/D37-20260916155634641.pdf","downloaded_pdf":"C:\\VENTA-DE-PASAJES\\services\\document-service\\target\\document-service-verify-51888.pdf","downloaded_pdf_bytes":1328,"checksum_sha256":"dc00a6191ea9b430a22c04c646d72417fdd6cbdf6816b5f5efcb066fdf9bf541","outbox_document_generated_events":1,"storage_dir":"C:\\VENTA-DE-PASAJES\\services\\document-service\\target\\document-storage-verify-51888","ready":true}
```

## Dia 38 - Integracion ticketing-documentos

Fecha de ejecucion: 2026-09-16

Resumen:

```text
Se integro ticketing-service con document-service para generar PDF automaticamente despues de TicketSold.
Se agrego la tabla ticket_document_refs mediante migracion V6.
Se agrego TicketDocumentIntegrationService para leer eventos TicketSold, llamar a document-service y registrar document_id, download_url, storage_uri, checksum, estado y reintentos.
Se agrego TicketDocumentGenerationJob configurable por APP_DOCUMENT_WORKER_ENABLED.
Se agregaron endpoints para consultar documento, reimprimir y procesar pendientes.
Se agrego verificador scripts\verify-ticketing-document-integration.ps1 con dos PostgreSQL temporales y ambos servicios JVM.
Se actualizo OpenAPI, README, SQL documental y verificadores previos para no depender de document-service cuando validan solo ticketing.
Se creo docs\dia-38-integracion-ticketing-documentos.md con Reversa primero y Guia manual desde cero.
```

Archivos principales creados o modificados:

```text
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\resources\db\migration\V6__ticket_document_refs.sql
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\domain\TicketDocumentStatus.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\persistence\entity\TicketDocumentRef.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\api\dto\TicketDocumentResponse.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\api\dto\ProcessTicketDocumentsResponse.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\service\TicketDocumentIntegrationService.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\service\TicketDocumentGenerationJob.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\api\TicketingTicketResource.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\java\com\ventapasajes\ticketing\api\TicketingTicketDocumentResource.java
C:\VENTA-DE-PASAJES\services\ticketing-service\src\main\resources\application.properties
C:\VENTA-DE-PASAJES\scripts\verify-ticketing-document-integration.ps1
C:\VENTA-DE-PASAJES\docs\dia-38-integracion-ticketing-documentos.md
C:\VENTA-DE-PASAJES\docs\openapi\ticketing-service.openapi.yaml
C:\VENTA-DE-PASAJES\docs\database\ticketing-db.sql
C:\VENTA-DE-PASAJES\services\ticketing-service\README.md
```

Comandos ejecutados:

```powershell
mvn -f .\services\ticketing-service\pom.xml test
mvn -f .\services\ticketing-service\pom.xml -DskipTests clean package
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-ticketing-document-integration.ps1 -SkipPackage
```

Validaciones:

```text
mvn test ticketing-service: 29 pruebas OK.
Build ticketing-service: BUILD SUCCESS.
Validacion Dia 38: boleto ISSUED, ticket_document_refs GENERATED, DocumentGenerated en document-service, reimpresion por download_url y PDF descargado con bytes > 0.
Sintaxis PowerShell OK para verify-ticketing-service-local-db.ps1, verify-ticketing-service-native-local.ps1, verify-mfe-ticketing-stack.ps1 y verify-ticketing-document-integration.ps1.
```

Resultado final:

```json
{"service":"ticketing-document-integration","runtime":"jvm","ticketing_http_port":18138,"document_http_port":18139,"ticketing_database_port":15438,"document_database_port":15439,"ticket_id":"56d3b907-255f-4eb4-98c1-a4fbd3dc1ed7","ticket_number":"TKT-9C912B753DAA","ticket_status":"ISSUED","document_id":"4aa34bdf-ee69-450a-8f78-a0bd6a6d12a8","document_status":"GENERATED","document_storage_uri":"local://tickets/56d3b907-255f-4eb4-98c1-a4fbd3dc1ed7/TKT-9C912B753DAA.pdf","reprint_url":"http://localhost:18139/api/v1/document/documents/4aa34bdf-ee69-450a-8f78-a0bd6a6d12a8/download","downloaded_pdf":"C:\\VENTA-DE-PASAJES\\services\\document-service\\target\\dia38-reprint-8848.pdf","downloaded_pdf_bytes":1328,"generated_document_refs":1,"document_generated_events":1,"ready":true}
```

Correccion posterior:

```text
Se corrigio el Paso 13 de docs\dia-38-integracion-ticketing-documentos.md.
La tabla documents de document-service no tiene una columna fisica document_id; su clave primaria es id.
La consulta documentada quedo como: select id, owner_type, owner_id, status, storage_uri from documents.
Se reejecuto mvn -f .\services\ticketing-service\pom.xml test: 29 pruebas OK.
Se reejecuto mvn -f .\services\ticketing-service\pom.xml -DskipTests clean package: BUILD SUCCESS.
Se reejecuto powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-ticketing-document-integration.ps1 -SkipPackage: ready=true.
```

Problema encontrado y solucion:

```text
El primer verificador genero la fila en ticket_document_refs pero GET /api/v1/ticketing/tickets/{ticketId}/document respondia 404.
Se diagnostico que la tabla tenia status GENERATED y document_id, por lo que la generacion estaba correcta.
Se movieron GET /tickets/{ticketId}/document y POST /tickets/{ticketId}/document/reprint a TicketingTicketResource, dejando TicketingTicketDocumentResource solo para /api/v1/ticketing/documents/process-pending.
Se reconstruyo el JAR y la validacion integrada finalizo con ready=true.
```

## Dia 39 - reporting-service base

Fecha de ejecucion: 2026-09-16

Resumen:

```text
Se genero reporting-service desde la plantilla Quarkus del monorepo.
Se reemplazo la migracion placeholder por V1__reporting_read_model.sql.
Se agrego el read model inicial: dimensiones, fact_ticket_sales, fact_documents, report_export_jobs, processed_events y outbox_events.
Se agrego ingestión idempotente para TicketSold y TicketCancelled.
Se agregaron endpoints de reportes por fecha, pasajeros, usuario y bus/ruta/terminal.
Se agrego scripts\verify-reporting-service-local.ps1 con PostgreSQL temporal.
Se actualizo docs\database\reporting-db.sql y docs\openapi\reporting-service.openapi.yaml.
Se actualizo services\reporting-service\README.md.
Se creo docs\dia-39-reporting-service-base.md con Reversa primero y Guia manual desde cero.
```

Archivos principales:

```text
C:\VENTA-DE-PASAJES\services\reporting-service\pom.xml
C:\VENTA-DE-PASAJES\services\reporting-service\src\main\resources\application.properties
C:\VENTA-DE-PASAJES\services\reporting-service\src\main\resources\db\migration\V1__reporting_read_model.sql
C:\VENTA-DE-PASAJES\services\reporting-service\src\main\java\com\ventapasajes\reporting\api\ReportingBaseResource.java
C:\VENTA-DE-PASAJES\services\reporting-service\src\main\java\com\ventapasajes\reporting\api\ReportingEventResource.java
C:\VENTA-DE-PASAJES\services\reporting-service\src\main\java\com\ventapasajes\reporting\api\ReportingReportResource.java
C:\VENTA-DE-PASAJES\services\reporting-service\src\main\java\com\ventapasajes\reporting\persistence\entity\FactTicketSale.java
C:\VENTA-DE-PASAJES\services\reporting-service\src\main\java\com\ventapasajes\reporting\persistence\entity\ProcessedEvent.java
C:\VENTA-DE-PASAJES\services\reporting-service\src\main\java\com\ventapasajes\reporting\service\ReportingEventIngestionService.java
C:\VENTA-DE-PASAJES\services\reporting-service\src\main\java\com\ventapasajes\reporting\service\ReportingQueryService.java
C:\VENTA-DE-PASAJES\scripts\verify-reporting-service-local.ps1
C:\VENTA-DE-PASAJES\docs\dia-39-reporting-service-base.md
```

Comandos ejecutados:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\new-quarkus-service.ps1 -ServiceName reporting-service -PackageSegment reporting -DatabaseName reporting_db -HttpPort 8085
mvn -f .\services\reporting-service\pom.xml test
mvn -f .\services\reporting-service\pom.xml -DskipTests clean package
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-reporting-service-local.ps1 -SkipPackage
```

Validaciones:

```text
mvn test reporting-service: 7 pruebas OK.
Build reporting-service: BUILD SUCCESS.
Validacion local: PostgreSQL temporal, Flyway V1 aplicado, 2 TicketSold ingeridos, 1 TicketCancelled ingerido, duplicado idempotente, fact_ticket_sales=2, processed_events=3, reportes listos.
```

Resultado final:

```json
{"service":"reporting-service","runtime":"jvm","quarkus_profile":"onprem","database":"reporting_db","migration_tool":"flyway","http_port":18098,"database_port":55454,"health_status":"ok","report_date":"2026-09-16","ticket_sold_events_processed":2,"ticket_cancelled_events_processed":1,"duplicate_event_processed":false,"fact_ticket_sales":2,"processed_events":3,"tickets_sold":1,"tickets_cancelled":1,"gross_amount":35.50,"net_amount":25.50,"passenger_rows":1,"sales_by_user_rows":2,"sales_by_bus_rows":1,"ready":true}
```

Problema encontrado:

```text
Invoke-RestMethod en Windows PowerShell envolvio arreglos JSON como un arreglo anidado.
El verificador contaba Count=1 para sales/by-user aunque habia varias filas internas.
Se agrego ConvertTo-Array en scripts\verify-reporting-service-local.ps1 para normalizar respuestas antes de contar.
```

Correccion posterior:

```text
Se aclaro el Paso 2 de docs\dia-39-reporting-service-base.md.
Si reporting-service ya existe, new-quarkus-service.ps1 falla correctamente con "Target service is not empty" para evitar sobrescritura.
El flujo correcto en un proyecto donde Dia 39 ya fue aplicado es saltar el generador y continuar en el Paso 3.
Se agrego una validacion con Test-Path y DryRun antes del comando de creacion.
Se reemplazo el Paso 2 por un bloque PowerShell condicional copy-pasteable que no ejecuta el generador cuando services\reporting-service\pom.xml ya existe.
```

## Dia 40 - TanStack Query en frontends

Fecha de ejecucion: 2026-09-16

Resumen:

```text
Se agrego @tanstack/react-query a frontend-shell, mfe-identity, mfe-dispatch y mfe-ticketing.
Se creo un QueryClientProvider por aplicacion frontend.
Se migro la carga de manifests del shell a useQuery.
Se corrigio el reloj del shell para iniciar con valor estable y evitar hydration mismatch.
Se migro mfe-ticketing a queries para salidas/mapa de asientos y mutations para sincronizacion demo/emision de boleto.
Se migro mfe-dispatch a una query de recursos operativos con invalidacion por mutations.
Se migro mfe-identity a una query de sesion protegida por token y limpieza de cache en logout.
Se documento docs\dia-40-tanstack-query-frontends.md con Reversa primero y Guia manual desde cero.
```

Archivos principales:

```text
C:\VENTA-DE-PASAJES\apps\frontend-shell\app\providers.tsx
C:\VENTA-DE-PASAJES\apps\mfe-identity\app\providers.tsx
C:\VENTA-DE-PASAJES\apps\mfe-dispatch\app\providers.tsx
C:\VENTA-DE-PASAJES\apps\mfe-ticketing\app\providers.tsx
C:\VENTA-DE-PASAJES\apps\frontend-shell\app\page.tsx
C:\VENTA-DE-PASAJES\apps\frontend-shell\app\components\RemoteMfeFrame.tsx
C:\VENTA-DE-PASAJES\apps\mfe-identity\app\identity\embedded\page.tsx
C:\VENTA-DE-PASAJES\apps\mfe-dispatch\app\dispatch\embedded\page.tsx
C:\VENTA-DE-PASAJES\apps\mfe-ticketing\app\ticketing\embedded\page.tsx
C:\VENTA-DE-PASAJES\docs\dia-40-tanstack-query-frontends.md
```

Comandos ejecutados:

```powershell
npm install @tanstack/react-query -w @venta-pasajes/frontend-shell -w @venta-pasajes/mfe-identity -w @venta-pasajes/mfe-dispatch -w @venta-pasajes/mfe-ticketing
npm run typecheck:frontend
npm run build:frontend
npm run build -w @venta-pasajes/frontend-shell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-frontend-dev.ps1
curl.exe -s -o NUL -w "%{http_code}" http://localhost:3000
curl.exe -s http://localhost:3001/api/health
curl.exe -s http://localhost:3002/api/health
curl.exe -s http://localhost:3003/api/health
curl.exe -s http://localhost:3003/mfe/manifest
```

Validaciones:

```text
typecheck:frontend OK.
build:frontend OK.
frontend-shell build posterior al ajuste del reloj OK.
frontend-shell respondio HTTP 200.
mfe-identity health OK.
mfe-dispatch health OK.
mfe-ticketing health OK.
mfe-ticketing manifest online.
```

Resultado de arranque local:

```json
{"shell_url":"http://localhost:3000","shell_pid":60172,"mfe_identity_url":"http://localhost:3001","mfe_identity_pid":56008,"mfe_dispatch_url":"http://localhost:3002","mfe_dispatch_pid":21300,"mfe_ticketing_url":"http://localhost:3003","mfe_ticketing_pid":67872}
```

Decision tecnica:

```text
No se agrego TanStack Router porque Next App Router ya cubre el enrutamiento.
TanStack Table queda para mfe-reporting y pantallas con grillas grandes.
TanStack Form queda para una migracion posterior de formularios, para no mezclar demasiados cambios en el mismo dia.
```

Correccion posterior:

```text
Se corrigio docs\dia-40-tanstack-query-frontends.md.
El bloque de Providers era codigo TSX para archivo y podia confundirse como comando PowerShell.
Se agrego una verificacion Test-Path y un bloque PowerShell copy-pasteable que crea app\providers.tsx solo si falta.
Se aclaro que los fragmentos de layout.tsx tambien son codigo de archivo, no comandos de consola.
Se amplio el Paso 4 para explicar que layout.tsx envuelve children con Providers y asi habilita useQuery/useMutation en toda la app.
```

## Dia 41 - mfe-reporting

Fecha de ejecucion: 2026-09-16

Resumen:

```text
Se creo @venta-pasajes/mfe-reporting como app Next.js App Router.
Se agrego TanStack Query para consumir reporting-service.
Se agrego TanStack Table para las grillas de ventas, pasajeros, usuarios y agrupados.
Se agrego proxy frontend /api/reporting/*.
Se agrego manifest /mfe/manifest y health /api/health.
Se integro Reportes en frontend-shell y se actualizo el contador MFEs a 4/6.
Se actualizaron start-frontend-dev.ps1 y stop-frontend-dev.ps1 para incluir el puerto 3004.
Se agrego exportacion CSV del tab activo.
Se creo docs\dia-41-mfe-reporting.md con Reversa primero y Guia manual desde cero.
```

Archivos principales:

```text
C:\VENTA-DE-PASAJES\apps\mfe-reporting\package.json
C:\VENTA-DE-PASAJES\apps\mfe-reporting\app\reporting\embedded\page.tsx
C:\VENTA-DE-PASAJES\apps\mfe-reporting\app\api\reporting\[...path]\route.ts
C:\VENTA-DE-PASAJES\apps\mfe-reporting\app\mfe\manifest\route.ts
C:\VENTA-DE-PASAJES\apps\mfe-reporting\app\globals.css
C:\VENTA-DE-PASAJES\apps\frontend-shell\app\page.tsx
C:\VENTA-DE-PASAJES\scripts\start-frontend-dev.ps1
C:\VENTA-DE-PASAJES\scripts\stop-frontend-dev.ps1
C:\VENTA-DE-PASAJES\docs\dia-41-mfe-reporting.md
```

Comandos ejecutados:

```powershell
npm install
npm run typecheck:frontend
npm run build:frontend
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\stop-frontend-dev.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-frontend-dev.ps1
curl.exe -s -o NUL -w "%{http_code}" http://localhost:3000
curl.exe -s http://localhost:3004/api/health
curl.exe -s http://localhost:3004/mfe/manifest
curl.exe -s -o NUL -w "%{http_code}" http://localhost:3004/reporting/embedded
curl.exe -s -o NUL -w "%{http_code}" http://localhost:3004/api/reporting/health
```

Validaciones:

```text
typecheck:frontend OK.
build:frontend OK.
frontend-shell respondio HTTP 200.
mfe-reporting health OK.
mfe-reporting manifest online.
mfe-reporting embedded respondio HTTP 200.
Proxy /api/reporting/health respondio 502 porque reporting-service no estaba levantado en 8085 al momento de la prueba.
```

Resultado de arranque local:

```json
{"shell_url":"http://localhost:3000","shell_pid":52992,"mfe_identity_url":"http://localhost:3001","mfe_identity_pid":67532,"mfe_dispatch_url":"http://localhost:3002","mfe_dispatch_pid":46928,"mfe_ticketing_url":"http://localhost:3003","mfe_ticketing_pid":27880,"mfe_reporting_url":"http://localhost:3004","mfe_reporting_pid":4348}
```

Correccion posterior:

```text
Se detecto que apps\mfe-reporting tenia solo carpetas y faltaban los archivos reales del MFE.
Esto provocaba error en start-frontend-dev.ps1 porque npm intentaba iniciar una app incompleta.
Se recrearon package.json, next.config.ts, tsconfig.json, next-env.d.ts, .env.example, providers, layout, pagina embebida, estilos, health, manifest y proxy /api/reporting.
Se agrego una validacion de directorio en scripts\start-frontend-dev.ps1 para mostrar un error mas claro si falta una app.
Se corrigio docs\dia-41-mfe-reporting.md: el Paso 4 ahora aclara que no es comando PowerShell, incluye validacion True/False por archivo y documenta el troubleshooting de WorkingDirectory invalido.
```

Validacion posterior:

```text
npm install OK.
npm run typecheck -w @venta-pasajes/mfe-reporting OK.
npm run build -w @venta-pasajes/mfe-reporting OK.
start-frontend-dev.ps1 OK con mfe-reporting en http://localhost:3004.
mfe-reporting /api/health OK.
mfe-reporting /mfe/manifest OK.
mfe-reporting /reporting/embedded HTTP 200.
frontend-shell HTTP 200.
```

Correccion adicional:

```text
Se reprodujo el error npm "No workspaces found: --workspace=@venta-pasajes/mfe-reporting".
La causa fue que apps\mfe-reporting existia con subcarpetas, pero faltaba package.json.
Se restauraron los archivos del MFE, se ejecuto npm install y se valido npm run typecheck:frontend OK.
Se agrego el troubleshooting especifico en docs\dia-41-mfe-reporting.md.
```

## Dia 42 - audit-service

Fecha de ejecucion: 2026-09-16

Resumen:

```text
Se genero audit-service desde la plantilla Quarkus.
Se creo el modelo audit_db con audit_events, processed_events y outbox_events.
Se implemento auditoria append-only con deduplicacion por source_service + event_id.
Se agregaron endpoints de overview, resources, health, registro, busqueda y consulta por eventId.
Se agrego evento de salida AuditEventCreated en outbox_events.
Se agrego verificador local con PostgreSQL temporal.
Se documento Dia 42 con Reversa primero, Guia manual desde cero y troubleshooting.
```

Archivos principales:

```text
C:\VENTA-DE-PASAJES\services\audit-service\src\main\resources\db\migration\V1__audit_schema.sql
C:\VENTA-DE-PASAJES\services\audit-service\src\main\java\com\ventapasajes\audit\api\AuditEventResource.java
C:\VENTA-DE-PASAJES\services\audit-service\src\main\java\com\ventapasajes\audit\service\AuditEventService.java
C:\VENTA-DE-PASAJES\services\audit-service\src\main\java\com\ventapasajes\audit\persistence\entity\AuditEvent.java
C:\VENTA-DE-PASAJES\scripts\verify-audit-service-local.ps1
C:\VENTA-DE-PASAJES\docs\dia-42-audit-service.md
C:\VENTA-DE-PASAJES\docs\openapi\audit-service.openapi.yaml
```

Comandos ejecutados:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\new-quarkus-service.ps1 -ServiceName audit-service -PackageSegment audit -DatabaseName audit_db -HttpPort 8086
mvn -f .\services\audit-service\pom.xml test
mvn -f .\services\audit-service\pom.xml -DskipTests clean package
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-audit-service-local.ps1
```

Validaciones:

```text
mvn test: Tests run: 7, Failures: 0, Errors: 0, Skipped: 0.
verify-audit-service-local.ps1: ready=true.
audit-service health_status=ok.
audit_events=1.
processed_events=1.
outbox_audit_event_created=1.
first_event_processed=true.
duplicate_event_processed=false.
search_total_items=1.
```

Resultado de verificacion local:

```json
{"service":"audit-service","runtime":"jvm","quarkus_profile":"onprem","database":"audit_db","migration_tool":"flyway","http_port":18099,"database_port":55455,"health_status":"ok","overview_service":"audit-service","resources_count":3,"action":"ticket.cancelled","first_event_processed":true,"duplicate_event_processed":false,"audit_events":1,"processed_events":1,"outbox_audit_event_created":1,"search_total_items":1,"ready":true}
```

Siguiente paso:

```text
Continuar con mfe-admin para exponer la auditoria en una pantalla administrativa.
```

## Dia 43 - mfe-admin

Fecha de ejecucion: 2026-09-16

Resumen:

```text
Se creo @venta-pasajes/mfe-admin como app Next.js App Router.
Se agrego TanStack Query para consultas y mutaciones contra audit-service.
Se agrego TanStack Table para la grilla de eventos auditables.
Se agrego proxy frontend /api/audit/* hacia audit-service.
Se agrego manifest /mfe/manifest y health /api/health.
Se integro Admin en frontend-shell y se actualizo el contador MFEs a 5/6.
Se actualizaron start-frontend-dev.ps1 y stop-frontend-dev.ps1 para incluir el puerto 3005.
Se corrigio el contrato de datos para consumir respuestas snake_case de Quarkus.
Se creo docs\dia-43-mfe-admin.md con Reversa primero y Guia manual desde cero.
```

Archivos principales:

```text
C:\VENTA-DE-PASAJES\apps\mfe-admin\package.json
C:\VENTA-DE-PASAJES\apps\mfe-admin\app\admin\embedded\page.tsx
C:\VENTA-DE-PASAJES\apps\mfe-admin\app\api\audit\[...path]\route.ts
C:\VENTA-DE-PASAJES\apps\mfe-admin\app\mfe\manifest\route.ts
C:\VENTA-DE-PASAJES\apps\mfe-admin\app\globals.css
C:\VENTA-DE-PASAJES\apps\frontend-shell\app\page.tsx
C:\VENTA-DE-PASAJES\scripts\start-frontend-dev.ps1
C:\VENTA-DE-PASAJES\scripts\stop-frontend-dev.ps1
C:\VENTA-DE-PASAJES\docs\dia-43-mfe-admin.md
```

Comandos ejecutados:

```powershell
npm install
npm run typecheck -w @venta-pasajes/mfe-admin
npm run build -w @venta-pasajes/mfe-admin
npm run typecheck:frontend
npm run build:frontend
npm run dev:mfe-admin
curl.exe -s http://localhost:3005/api/health
curl.exe -s http://localhost:3005/mfe/manifest
curl.exe -s -o NUL -w "%{http_code}" http://localhost:3005/admin/embedded
```

Validaciones:

```text
npm install OK.
mfe-admin typecheck OK.
mfe-admin build OK.
typecheck:frontend OK.
build:frontend OK.
mfe-admin health OK.
mfe-admin manifest online.
mfe-admin embedded HTTP 200.
```

Nota operativa:

```text
El arranque completo del shell no se dejo corriendo porque habia dev servers antiguos ocupando 3000-3004 desde otra consola elevada.
stop-frontend-dev.ps1 no pudo detenerlos desde esta sesion por Acceso denegado.
Se valido mfe-admin de forma aislada en 3005 y se documento la limpieza para volver a levantar todo el shell.
```

Correccion posterior:

```text
Se corrigio docs\dia-43-mfe-admin.md.
El Paso 3 usaba New-Item -LiteralPath, pero Windows PowerShell no reconoce ese parametro para New-Item.
Se reemplazo por [System.IO.Directory]::CreateDirectory($_), compatible con rutas que contienen [...path].
Se ejecuto el bloque corregido y las carpetas esperadas quedaron en True.
```

Correccion posterior 2:

```text
Se amplio el Paso 8 de docs\dia-43-mfe-admin.md.
Se aclaro que npm run dev:mfe-admin debe quedar abierto en una Terminal 1 y los curl deben ejecutarse en una Terminal 2.
Se documento que npm error code 4294967295 puede aparecer al interrumpir next dev con Ctrl+C en Windows.
Se agrego troubleshooting para curl HTTP 000 cuando no hay servidor escuchando en localhost:3005.
```

Siguiente paso:

```text
Continuar con administracion avanzada o visor consolidado de salud/parametros.
```

## Dia 44 - visor de salud consolidado en mfe-admin

Fecha de ejecucion: 2026-09-16

Resumen:

```text
Se agrego GET /api/health al frontend-shell.
Se agrego GET /api/admin/health al mfe-admin.
Se agrego una vista Salud dentro de mfe-admin y se mantuvo Auditoria como segunda pestana.
El visor consulta shell, MFEs y backends de identidad, despacho, ticketing, documentos, reporting y auditoria.
Se agregaron tarjetas de estado general, frontends activos, backends activos y ultima consulta.
Se agrego tabla de componentes con estado, HTTP, latencia, URL y respuesta resumida.
Se agrego la capacidad salud-consolidada al manifest de mfe-admin.
Se actualizaron .env.example, apps README y start-frontend-dev.ps1.
Se creo docs\dia-44-visor-salud-admin.md con Reversa primero y Guia manual desde cero.
```

Archivos principales:

```text
C:\VENTA-DE-PASAJES\apps\frontend-shell\app\api\health\route.ts
C:\VENTA-DE-PASAJES\apps\mfe-admin\app\api\admin\health\route.ts
C:\VENTA-DE-PASAJES\apps\mfe-admin\app\admin\embedded\page.tsx
C:\VENTA-DE-PASAJES\apps\mfe-admin\app\globals.css
C:\VENTA-DE-PASAJES\scripts\start-frontend-dev.ps1
C:\VENTA-DE-PASAJES\docs\dia-44-visor-salud-admin.md
```

Comandos ejecutados:

```powershell
npm run typecheck -w @venta-pasajes/mfe-admin
npm run typecheck -w @venta-pasajes/frontend-shell
npm run build -w @venta-pasajes/mfe-admin
npm run build -w @venta-pasajes/frontend-shell
npm run typecheck:frontend
npm run build:frontend
curl.exe -s http://localhost:3005/api/health
curl.exe -s -o NUL -w "%{http_code}" http://localhost:3005/admin/embedded
curl.exe -s http://localhost:3005/api/admin/health
```

Validaciones:

```text
mfe-admin typecheck OK.
frontend-shell typecheck OK.
typecheck:frontend OK.
mfe-admin build OK, incluyendo /api/admin/health.
frontend-shell build OK, incluyendo /api/health.
build:frontend OK.
mfe-admin /api/health OK.
mfe-admin /admin/embedded HTTP 200.
mfe-admin /api/admin/health OK.
```

Resultado observado en health consolidado:

```text
status=degraded.
frontends activos=6/6.
backends activos=0/6.
Esto es esperado porque los servicios Java 8081-8086 no estaban levantados al momento de la prueba.
```

Nota operativa:

```text
Los puertos 3000-3005 ya estaban ocupados por dev servers activos.
No se detuvieron procesos del usuario.
Se uso el servidor existente para validar /api/admin/health y la pantalla embebida.
```

Correccion posterior:

```text
Se corrigio un fallo de typecheck reportado por .next/types/validator.ts.
La causa fue que faltaban fisicamente apps\frontend-shell\app\api\health\route.ts y apps\mfe-admin\app\api\admin\health\route.ts, aunque Next ya habia generado tipos para esas rutas.
Se restauraron ambos route.ts.
Se revalido npm run typecheck -w @venta-pasajes/mfe-admin OK.
Se revalido npm run typecheck -w @venta-pasajes/frontend-shell OK.
Se revalido npm run typecheck:frontend OK.
Se agrego troubleshooting en docs\dia-44-visor-salud-admin.md.
```

Siguiente paso:

```text
Agregar acciones administrativas: reintentos operativos, catalogos de parametros o arranque/verificacion guiada de backends.
```

## Dia 45 - runbook operativo en mfe-admin

Fecha de ejecucion: 2026-09-17

Resumen:

```text
Se agrego GET /api/admin/runbook al mfe-admin.
Se agrego la pestana Runbook entre Salud y Auditoria.
Se agregaron 12 guias operativas: 6 frontends y 6 backends.
Cada guia contiene health URL, puertos, documentos relacionados, comandos de verificacion y comandos de arranque/diagnostico.
Se agrego boton Copiar para comandos desde la UI.
Se agrego la capacidad runbook-operativo al manifest de mfe-admin.
Se actualizo apps\README.md con el endpoint y curl de runbook.
Se creo docs\dia-45-runbook-operativo-admin.md con Reversa primero y Guia manual desde cero.
```

Archivos principales:

```text
C:\VENTA-DE-PASAJES\apps\mfe-admin\app\api\admin\runbook\route.ts
C:\VENTA-DE-PASAJES\apps\mfe-admin\app\admin\embedded\page.tsx
C:\VENTA-DE-PASAJES\apps\mfe-admin\app\globals.css
C:\VENTA-DE-PASAJES\apps\mfe-admin\app\mfe\manifest\route.ts
C:\VENTA-DE-PASAJES\apps\README.md
C:\VENTA-DE-PASAJES\docs\dia-45-runbook-operativo-admin.md
```

Comandos ejecutados:

```powershell
npm run typecheck -w @venta-pasajes/mfe-admin
npm run build -w @venta-pasajes/mfe-admin
npm run typecheck:frontend
npm run build:frontend
curl.exe -s http://localhost:3005/api/admin/runbook
curl.exe -s -o NUL -w "%{http_code}" http://localhost:3005/admin/embedded
curl.exe -s http://localhost:3005/mfe/manifest
```

Validaciones:

```text
mfe-admin typecheck OK.
mfe-admin build OK, incluyendo /api/admin/runbook.
typecheck:frontend OK.
build:frontend OK.
/api/admin/runbook respondio OK.
/admin/embedded respondio HTTP 200.
/mfe/manifest contiene runbook-operativo.
```

Resultado observado:

```text
total_items=12.
frontends=6.
backends=6.
HasAudit=True.
HasAdmin=True.
Todos los documentos referenciados por el runbook existen.
```

Nota operativa:

```text
El runbook no ejecuta comandos desde el navegador.
Entrega comandos listos para copiar y ejecutar en PowerShell.
Los scripts verify-* levantan ambientes temporales de validacion; para servicios persistentes se debe seguir el documento del dia correspondiente.
```

Siguiente paso:

```text
Agregar una vista de parametros administrativos o un checklist guiado para levantar backends con estado paso a paso.
```

Correccion posterior:

```text
Se aclaro docs\dia-45-runbook-operativo-admin.md.
El Paso 4 de la guia manual no es una instruccion para recrear el archivo en el workspace actual.
Ahora indica que route.ts se crea solo en una maquina limpia, si se aplico reversa o si el archivo no existe.
Se agrego una verificacion rapida con Test-Path y curl para confirmar que /api/admin/runbook ya esta disponible.
```

Correccion posterior por archivo faltante:

```text
El usuario valido Test-Path .\apps\mfe-admin\app\api\admin\runbook\route.ts y devolvio False.
Se confirmo que la UI, manifest y documentacion referenciaban /api/admin/runbook, pero el route.ts no estaba fisicamente en disco.
Se restauro C:\VENTA-DE-PASAJES\apps\mfe-admin\app\api\admin\runbook\route.ts.
Se ejecuto npm run typecheck -w @venta-pasajes/mfe-admin OK.
Se levanto mfe-admin en 127.0.0.1:3005 para validar el endpoint.
Se valido /api/admin/runbook con total_items=12, frontends=6, backends=6 y has_admin=True.
Se valido /admin/embedded con HTTP 200.
Se ejecuto npm run build -w @venta-pasajes/mfe-admin OK y Next listo /api/admin/runbook como ruta dinamica.
```

## Dia 46 - arranque guiado en mfe-admin

Fecha de ejecucion: 2026-09-17

Resumen:

```text
Se agrego GET /api/admin/startup-checklist al mfe-admin.
Se agrego la pestana Arranque entre Salud y Runbook.
Se agregaron 14 pasos operativos: 2 preflight, 6 backends y 6 frontends.
Cada paso incluye comandos para ejecutar, comandos para validar y documentos relacionados.
Los pasos con target_id se cruzan con /api/admin/health para mostrar estado Listo, Pendiente o Sin datos.
Se agrego la capacidad arranque-guiado al manifest de mfe-admin.
Se actualizo apps\README.md con el endpoint y curl de startup-checklist.
Se creo docs\dia-46-arranque-guiado-admin.md con Reversa primero y Guia manual desde cero.
```

Archivos principales:

```text
C:\VENTA-DE-PASAJES\apps\mfe-admin\app\api\admin\startup-checklist\route.ts
C:\VENTA-DE-PASAJES\apps\mfe-admin\app\admin\embedded\page.tsx
C:\VENTA-DE-PASAJES\apps\mfe-admin\app\globals.css
C:\VENTA-DE-PASAJES\apps\mfe-admin\app\mfe\manifest\route.ts
C:\VENTA-DE-PASAJES\apps\README.md
C:\VENTA-DE-PASAJES\docs\dia-46-arranque-guiado-admin.md
```

Comandos ejecutados:

```powershell
Test-Path -LiteralPath .\apps\mfe-admin\app\api\admin\startup-checklist\route.ts
Select-String -Path .\apps\mfe-admin\app\mfe\manifest\route.ts -Pattern "arranque-guiado"
npm run typecheck -w @venta-pasajes/mfe-admin
npm run build -w @venta-pasajes/mfe-admin
npm run typecheck:frontend
npm run build:frontend
curl.exe -s -o NUL -w "%{http_code}" http://localhost:3005/api/admin/startup-checklist
curl.exe -s http://localhost:3005/api/admin/startup-checklist
curl.exe -s -o NUL -w "%{http_code}" http://localhost:3005/admin/embedded
curl.exe -s http://localhost:3005/mfe/manifest
```

Validaciones:

```text
startup-checklist route.ts existe.
manifest contiene arranque-guiado.
mfe-admin typecheck OK.
mfe-admin build OK, incluyendo /api/admin/startup-checklist.
typecheck:frontend OK.
build:frontend OK.
/api/admin/startup-checklist respondio HTTP 200.
/admin/embedded respondio HTTP 200.
/mfe/manifest contiene arranque-guiado y runbook-operativo.
```

Resultado observado:

```text
total_steps=14.
preflight=2.
backends=6.
frontends=6.
has_admin=True.
Todos los documentos referenciados por startup-checklist existen.
```

Nota operativa:

```text
Arranque guiado no ejecuta comandos desde el navegador.
Entrega una secuencia recomendada y comandos copiables.
El estado automatico depende de /api/admin/health y de que cada servicio responda en su puerto.
```

Siguiente paso:

```text
Agregar parametros administrativos editables para URLs, timeouts y puertos operativos sin recompilar el frontend.
```

Correccion posterior por ruta relativa:

```text
El usuario ejecuto el Paso 12 desde C:\Windows\system32 y PowerShell busco .\apps dentro de system32.
Se corrigio docs\dia-46-arranque-guiado-admin.md para usar $ProjectRoot = "C:\VENTA-DE-PASAJES" y rutas absolutas.
Tambien se corrigio la extraccion de docs referenciados para leer strings TypeScript con docs\\dia-*.md.
Se valido el bloque corregido desde C:\Windows\system32.
Resultado: 20 documentos referenciados, todos Exists=True.
```

## Dia 47 - parametros operativos en mfe-admin

Fecha de ejecucion: 2026-09-17

Resumen:

```text
Se agrego GET /api/admin/runtime-config al mfe-admin.
Se agrego la pestana Parametros entre Runbook y Auditoria.
Se exponen 16 parametros efectivos: URL publica admin, proxy audit, health URLs frontend/backend y timeout.
Cada parametro indica env_key, value, default_value, source, docs, restart_required y comandos copiables.
ADMIN_HEALTH_TIMEOUT_MS ahora controla el timeout real de /api/admin/health con fallback 2500.
Se agrego ADMIN_HEALTH_TIMEOUT_MS=2500 en apps\mfe-admin\.env.example.
Se agrego la capacidad parametros-operativos al manifest de mfe-admin.
Se actualizo apps\README.md con el endpoint y curl de runtime-config.
Se creo docs\dia-47-parametros-operativos-admin.md con Reversa primero y Guia manual desde cero.
```

Archivos principales:

```text
C:\VENTA-DE-PASAJES\apps\mfe-admin\app\api\admin\runtime-config\route.ts
C:\VENTA-DE-PASAJES\apps\mfe-admin\app\api\admin\health\route.ts
C:\VENTA-DE-PASAJES\apps\mfe-admin\app\admin\embedded\page.tsx
C:\VENTA-DE-PASAJES\apps\mfe-admin\app\globals.css
C:\VENTA-DE-PASAJES\apps\mfe-admin\app\mfe\manifest\route.ts
C:\VENTA-DE-PASAJES\apps\mfe-admin\.env.example
C:\VENTA-DE-PASAJES\apps\README.md
C:\VENTA-DE-PASAJES\docs\dia-47-parametros-operativos-admin.md
```

Comandos ejecutados:

```powershell
Test-Path -LiteralPath .\apps\mfe-admin\app\api\admin\runtime-config\route.ts
Select-String -Path .\apps\mfe-admin\app\mfe\manifest\route.ts -Pattern "parametros-operativos"
npm run typecheck -w @venta-pasajes/mfe-admin
npm run build -w @venta-pasajes/mfe-admin
npm run typecheck:frontend
npm run build:frontend
curl.exe -s -o NUL -w "%{http_code}" http://localhost:3005/api/admin/runtime-config
curl.exe -s http://localhost:3005/api/admin/runtime-config
curl.exe -s http://localhost:3005/api/admin/health
curl.exe -s -o NUL -w "%{http_code}" http://localhost:3005/admin/embedded
curl.exe -s http://localhost:3005/mfe/manifest
```

Validaciones:

```text
runtime-config route.ts existe.
manifest contiene parametros-operativos.
mfe-admin typecheck OK.
mfe-admin build OK, incluyendo /api/admin/runtime-config.
typecheck:frontend OK.
build:frontend OK.
/api/admin/runtime-config respondio HTTP 200.
/api/admin/health respondio timeout_ms=2500.
/admin/embedded respondio HTTP 200.
/mfe/manifest contiene parametros-operativos y arranque-guiado.
```

Resultado observado:

```text
total_items=16.
from_env=0.
defaults=16.
has_timeout=True.
health_timeout_ms=2500.
Todos los documentos referenciados por runtime-config existen.
La validacion de documentos se ejecuto desde C:\Windows\system32 usando $ProjectRoot.
```

Nota operativa:

```text
Parametros no escribe archivos desde el navegador.
Entrega visibilidad, origen del valor y comandos copiables.
Para cambios persistentes editar apps\mfe-admin\.env.local y reiniciar mfe-admin.
```

Siguiente paso:

```text
Agregar exportacion de diagnostico administrativo en JSON para adjuntar estado, parametros, runbook y health en un solo archivo.
```

Correccion posterior por route.ts faltante de runbook:

```text
El usuario valido Test-Path .\apps\mfe-admin\app\api\admin\runbook\route.ts y devolvio False.
Se confirmo en filesystem que faltaba C:\VENTA-DE-PASAJES\apps\mfe-admin\app\api\admin\runbook\route.ts.
Se restauro el endpoint GET /api/admin/runbook.
Se ejecuto npm run typecheck -w @venta-pasajes/mfe-admin OK.
Se ejecuto npm run build -w @venta-pasajes/mfe-admin OK y Next listo /api/admin/runbook.
Se levanto mfe-admin en puerto 3005 porque curl devolvia 000 cuando no habia servidor escuchando.
Se valido /api/admin/runbook HTTP 200.
Se valido total_items=12, frontends=6, backends=6 y has_admin=True.
Se validaron rutas route.ts referenciadas en docs dia 45-47: health, runbook, startup-checklist y runtime-config, todas Exists=True.
Se validaron endpoints /api/admin/runbook, /api/admin/startup-checklist y /api/admin/runtime-config con HTTP 200.
```

## Dia 48 - diagnostico exportable en mfe-admin

Fecha de ejecucion: 2026-09-17

Resumen:

```text
Se agrego GET /api/admin/diagnostic-export al mfe-admin.
El endpoint consolida manifest, health, runbook, startup-checklist y runtime-config.
Cada seccion queda marcada con ok, status, error y payload.
Se agrego la pestana Diagnostico en mfe-admin.
La vista muestra resumen de secciones, estados y comandos copiables para ver o guardar el JSON.
Se agrego la capacidad diagnostico-exportable al manifest de mfe-admin.
Se actualizo apps\README.md con el endpoint y curl de diagnostic-export.
Se creo docs\dia-48-diagnostico-exportable-admin.md con Reversa primero y Guia manual desde cero.
```

Archivos principales:

```text
C:\VENTA-DE-PASAJES\apps\mfe-admin\app\api\admin\diagnostic-export\route.ts
C:\VENTA-DE-PASAJES\apps\mfe-admin\app\admin\embedded\page.tsx
C:\VENTA-DE-PASAJES\apps\mfe-admin\app\globals.css
C:\VENTA-DE-PASAJES\apps\mfe-admin\app\mfe\manifest\route.ts
C:\VENTA-DE-PASAJES\apps\README.md
C:\VENTA-DE-PASAJES\docs\dia-48-diagnostico-exportable-admin.md
```

Comandos ejecutados:

```powershell
Test-Path -LiteralPath .\apps\mfe-admin\app\api\admin\diagnostic-export\route.ts
Select-String -Path .\apps\mfe-admin\app\mfe\manifest\route.ts -Pattern "diagnostico-exportable"
npm run typecheck -w @venta-pasajes/mfe-admin
npm run build -w @venta-pasajes/mfe-admin
npm run typecheck:frontend
npm run build:frontend
curl.exe -s -o NUL -w "%{http_code}" http://localhost:3005/api/admin/diagnostic-export
curl.exe -s http://localhost:3005/api/admin/diagnostic-export
curl.exe -s -o NUL -w "%{http_code}" http://localhost:3005/admin/embedded
curl.exe -s http://localhost:3005/mfe/manifest
curl.exe -s http://localhost:3005/api/admin/diagnostic-export -o C:\VENTA-DE-PASAJES\logs\admin-diagnostic.json
```

Validaciones:

```text
diagnostic-export route.ts existe.
manifest contiene diagnostico-exportable.
mfe-admin typecheck OK.
mfe-admin build OK, incluyendo /api/admin/diagnostic-export.
typecheck:frontend OK.
build:frontend OK.
/api/admin/diagnostic-export respondio HTTP 200.
/admin/embedded respondio HTTP 200.
/mfe/manifest contiene diagnostico-exportable y parametros-operativos.
```

Resultado observado:

```text
total_sections=5.
ok_sections=5.
failed_sections=0.
runbook_items=12.
startup_steps=14.
runtime_config_items=16.
logs\admin-diagnostic.json fue creado.
Se validaron desde C:\Windows\system32 las rutas health, runbook, startup-checklist, runtime-config y diagnostic-export, todas Exists=True.
```

Nota operativa:

```text
Diagnostico no persiste historico automaticamente.
Entrega snapshot JSON descargable para soporte o comparacion manual.
Si curl devuelve 000, primero levantar mfe-admin en el puerto 3005.
```

Siguiente paso:

```text
Agregar historico de snapshots o comparacion entre diagnosticos guardados.
```

## Dia 49 - Historico local de diagnosticos en mfe-admin

Resumen:

```text
Se agrego GET /api/admin/diagnostic-history al mfe-admin.
Se agrego POST /api/admin/diagnostic-history para guardar snapshots generados desde diagnostic-export.
Los snapshots se guardan en logs\admin-diagnostics por defecto.
La pestana Diagnostico ahora muestra historial local, ultimo snapshot, snapshot anterior y delta de errores.
Se agrego boton Guardar snapshot en la pantalla administrativa.
Se agrego la capacidad diagnostico-historico al manifest de mfe-admin.
Se actualizo apps\README.md con el endpoint y curl de diagnostic-history.
Se creo docs\dia-49-historico-diagnosticos-admin.md con Reversa primero y Guia manual desde cero.
```

Archivos principales:

```text
C:\VENTA-DE-PASAJES\apps\mfe-admin\app\api\admin\diagnostic-history\route.ts
C:\VENTA-DE-PASAJES\apps\mfe-admin\app\admin\embedded\page.tsx
C:\VENTA-DE-PASAJES\apps\mfe-admin\app\globals.css
C:\VENTA-DE-PASAJES\apps\mfe-admin\app\mfe\manifest\route.ts
C:\VENTA-DE-PASAJES\apps\README.md
C:\VENTA-DE-PASAJES\docs\dia-49-historico-diagnosticos-admin.md
```

Comandos ejecutados:

```powershell
npm run typecheck -w @venta-pasajes/mfe-admin
npm run build -w @venta-pasajes/mfe-admin
curl.exe -s -o NUL -w "%{http_code}" http://localhost:3005/api/admin/diagnostic-history
curl.exe -s -X POST http://localhost:3005/api/admin/diagnostic-history
curl.exe -s http://localhost:3005/api/admin/diagnostic-history
Get-ChildItem -LiteralPath .\logs\admin-diagnostics -Filter "admin-diagnostic-*.json"
Select-String -Path .\apps\mfe-admin\app\mfe\manifest\route.ts -Pattern "diagnostico-historico"
curl.exe -s http://localhost:3005/mfe/manifest
npm run typecheck:frontend
npm run build:frontend
```

Validaciones:

```text
mfe-admin typecheck OK.
mfe-admin build OK.
build de mfe-admin incluye /api/admin/diagnostic-history.
typecheck:frontend OK.
build:frontend OK.
/api/admin/diagnostic-history respondio HTTP 200.
POST /api/admin/diagnostic-history creo snapshots JSON.
Historial respondio total_snapshots=2.
comparison.deltas.failed_sections=0.
comparison.deltas.ok_sections=0.
manifest contiene diagnostico-exportable y diagnostico-historico.
Se validaron rutas absolutas desde C:\Windows\system32 con Exists=True.
```

Resultado observado:

```text
latest=admin-diagnostic-2026-09-17T21-44-00-246Z.json.
previous=admin-diagnostic-2026-09-17T21-43-52-231Z.json.
directory=C:\VENTA-DE-PASAJES\logs\admin-diagnostics.
```

## Dia 50 - Retencion segura de diagnosticos en mfe-admin

Resumen:

```text
Se extendio /api/admin/diagnostic-history con metodo DELETE.
DELETE permite simular limpieza con dry_run=true.
DELETE permite aplicar limpieza con dry_run=false.
La limpieza conserva por defecto los ultimos 20 snapshots.
La pestana Diagnostico ahora tiene botones Simular limpieza y Limpiar antiguos.
La limpieza real desde UI pide confirmacion antes de eliminar archivos.
Se agrego la capacidad diagnostico-retencion al manifest de mfe-admin.
Se actualizo apps\README.md con el endpoint DELETE de retencion.
Se creo docs\dia-50-retencion-diagnosticos-admin.md con Reversa primero y Guia manual desde cero.
```

Archivos principales:

```text
C:\VENTA-DE-PASAJES\apps\mfe-admin\app\api\admin\diagnostic-history\route.ts
C:\VENTA-DE-PASAJES\apps\mfe-admin\app\admin\embedded\page.tsx
C:\VENTA-DE-PASAJES\apps\mfe-admin\app\mfe\manifest\route.ts
C:\VENTA-DE-PASAJES\apps\README.md
C:\VENTA-DE-PASAJES\docs\dia-50-retencion-diagnosticos-admin.md
```

Comandos ejecutados:

```powershell
npm run typecheck -w @venta-pasajes/mfe-admin
npm run build -w @venta-pasajes/mfe-admin
curl.exe -s -X DELETE "http://localhost:3005/api/admin/diagnostic-history?keep=20&dry_run=true"
curl.exe -s -X DELETE "http://localhost:3005/api/admin/diagnostic-history?keep=20&dry_run=false"
curl.exe -s http://localhost:3005/api/admin/diagnostic-history
curl.exe -s http://localhost:3005/mfe/manifest
npm run typecheck:frontend
npm run build:frontend
```

Validaciones:

```text
mfe-admin typecheck OK.
mfe-admin build OK.
build de mfe-admin incluye /api/admin/diagnostic-history.
Simulacion DELETE respondio dry_run=True, keep=20, candidate_count=0, deleted_count=0, remaining_count=5.
Limpieza real segura respondio dry_run=False, keep=20, candidate_count=0, deleted_count=0, remaining_count=5.
No se eliminaron snapshots porque total_snapshots=5 y keep=20.
manifest contiene diagnostico-exportable, diagnostico-historico y diagnostico-retencion.
typecheck:frontend OK.
build:frontend OK.
Se validaron rutas absolutas desde C:\Windows\system32 con Exists=True.
```

## Dia 51 - Matriz de preparacion para produccion en mfe-admin

Resumen:

```text
Se agrego GET /api/admin/production-readiness al mfe-admin.
El endpoint evalua frontends, backends, migraciones, pruebas, scripts, observabilidad, despliegue, CI/CD, seguridad, secretos, backups e imagenes.
Se agrego la pestana Produccion en mfe-admin.
La vista muestra score global, categorias, evidencias, faltantes y recomendaciones.
diagnostic-export ahora incluye la seccion production_readiness.
Se agrego la capacidad preparacion-produccion al manifest de mfe-admin.
Se actualizo apps\README.md con el endpoint production-readiness.
Se creo docs\dia-51-matriz-produccion-admin.md con Reversa primero y Guia manual desde cero.
```

Archivos principales:

```text
C:\VENTA-DE-PASAJES\apps\mfe-admin\app\api\admin\production-readiness\route.ts
C:\VENTA-DE-PASAJES\apps\mfe-admin\app\admin\embedded\page.tsx
C:\VENTA-DE-PASAJES\apps\mfe-admin\app\api\admin\diagnostic-export\route.ts
C:\VENTA-DE-PASAJES\apps\mfe-admin\app\mfe\manifest\route.ts
C:\VENTA-DE-PASAJES\apps\README.md
C:\VENTA-DE-PASAJES\docs\dia-51-matriz-produccion-admin.md
```

Comandos ejecutados:

```powershell
npm run typecheck -w @venta-pasajes/mfe-admin
npm run build -w @venta-pasajes/mfe-admin
curl.exe -s -o NUL -w "%{http_code}" http://localhost:3005/api/admin/production-readiness
curl.exe -s http://localhost:3005/api/admin/production-readiness
curl.exe -s http://localhost:3005/api/admin/diagnostic-export
curl.exe -s http://localhost:3005/mfe/manifest
npm run typecheck:frontend
npm run build:frontend
```

Validaciones:

```text
mfe-admin typecheck OK.
mfe-admin build OK.
build de mfe-admin incluye /api/admin/production-readiness.
/api/admin/production-readiness respondio HTTP 200.
score_percent=58.
status=missing.
ready=6.
warning=3.
missing=4.
total=13.
diagnostic-export ahora total_sections=6.
diagnostic-export ok_sections=6.
diagnostic-export failed_sections=0.
diagnostic-export production_readiness_score=58.
manifest HTTP contiene preparacion-produccion.
typecheck:frontend OK.
build:frontend OK.
```

Lectura ejecutiva:

```text
El aplicativo tiene base funcional amplia, pero todavia no esta al 100% para produccion.
Faltan principalmente pruebas frontend/E2E, despliegue reproducible, CI/CD y backups de base de datos.
Seguridad, secretos e imagenes existen parcialmente y requieren hardening antes de produccion.
```

## Dia 52 - CI base de calidad

Resumen:

```text
Se creo .github/workflows/ci.yml.
El workflow tiene jobs frontend-quality, backend-tests y workspace-guardrails.
frontend-quality ejecuta npm ci, npm run typecheck:frontend y npm run build:frontend.
backend-tests ejecuta mvn -B test -DskipITs por servicio backend principal.
workspace-guardrails valida rutas criticas del monorepo.
README.md fue actualizado a Dias 1 a 52 y registra el CI base.
production-readiness detecta Pipeline CI/CD.
El score de preparacion para produccion subio de 58% a 62%.
El estado global paso de missing a warning.
Se creo docs\dia-52-ci-base-calidad.md con Reversa primero y Guia manual desde cero.
```

Archivos principales:

```text
C:\VENTA-DE-PASAJES\.github\workflows\ci.yml
C:\VENTA-DE-PASAJES\README.md
C:\VENTA-DE-PASAJES\docs\dia-52-ci-base-calidad.md
```

Comandos ejecutados:

```powershell
Test-Path -Path .\.github\workflows\ci.yml
Select-String -Path .\.github\workflows\ci.yml -Pattern "frontend-quality|backend-tests|workspace-guardrails|npm run typecheck:frontend|mvn -B test"
npm run typecheck:frontend
mvn -B test -DskipITs
npm run build:frontend
curl.exe -s http://localhost:3005/api/admin/production-readiness
curl.exe -s http://localhost:3005/api/admin/diagnostic-export
```

Validaciones:

```text
ci.yml existe.
workflow contiene frontend-quality, backend-tests y workspace-guardrails.
typecheck:frontend OK.
identity-service mvn test OK: 14 tests, 0 failures, 0 errors.
build:frontend OK.
production-readiness respondio score_percent=62.
production-readiness status=warning.
ready=6.
warning=4.
missing=3.
total=13.
CI/CD paso a status=warning con evidencia Pipeline CI/CD detectado.
diagnostic-export total_sections=6.
diagnostic-export ok_sections=6.
diagnostic-export failed_sections=0.
diagnostic-export production_readiness_score=62.
diagnostic-export production_readiness_missing=3.
```

Lectura ejecutiva:

```text
El proyecto ya tiene una puerta automatica de calidad base.
Todavia no es despliegue continuo: valida, pero no publica imagenes ni despliega a Cloud Run.
La siguiente brecha productiva fuerte sigue siendo despliegue reproducible, backups de base de datos y pruebas frontend/E2E.
```

## Dia 53 - CI/CD frontend y artefactos versionados

Resumen:

```text
Se creo scripts\build-frontend-artifacts.ps1 para empaquetar salidas Next.js standalone por frontend.
Se creo .github\workflows\frontend-artifacts.yml con matrix por frontend.
El workflow usa npm ci, build del frontend seleccionado y actions/upload-artifact.
Se agrego npm run build:frontend-artifacts.
production-readiness ahora registra evidencia del pipeline de artefactos frontend y del script local.
README.md fue actualizado a Dias 1 a 53.
Se creo docs\dia-53-ci-cd-frontend.md con Reversa primero y Guia manual desde cero.
```

Archivos principales:

```text
C:\VENTA-DE-PASAJES\scripts\build-frontend-artifacts.ps1
C:\VENTA-DE-PASAJES\.github\workflows\frontend-artifacts.yml
C:\VENTA-DE-PASAJES\apps\mfe-admin\app\api\admin\production-readiness\route.ts
C:\VENTA-DE-PASAJES\package.json
C:\VENTA-DE-PASAJES\.gitignore
C:\VENTA-DE-PASAJES\README.md
C:\VENTA-DE-PASAJES\docs\dia-53-ci-cd-frontend.md
```

Comandos ejecutados:

```powershell
Test-Path -LiteralPath .\scripts\build-frontend-artifacts.ps1
Test-Path -LiteralPath .\.github\workflows\frontend-artifacts.yml
Select-String -Path .\.github\workflows\frontend-artifacts.yml -Pattern "frontend-shell|mfe-admin|upload-artifact"
npm run typecheck:frontend
npm run build:frontend-artifacts -- -Apps mfe-admin -Version dia53-local-test
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-frontend-artifacts.ps1 -Apps mfe-admin -Version dia53-local-test -SkipBuild -SkipSharedTypesBuild
npm run build:frontend
```

Validaciones:

```text
build-frontend-artifacts.ps1 existe.
frontend-artifacts.yml existe.
frontend-artifacts.yml contiene frontend-shell, mfe-admin y actions/upload-artifact.
typecheck:frontend OK.
build:frontend-artifacts para mfe-admin OK.
Se genero artifacts\frontend\dia53-local-test\mfe-admin-dia53-local-test.zip.
El zip local pesa aproximadamente 8 MB.
frontend-artifacts-summary.json queda limpio con version, generated_at, total y artifacts.
build:frontend OK para shared-types, mfe-identity, mfe-dispatch, mfe-ticketing, mfe-reporting, mfe-admin y frontend-shell.
artifacts/ quedo ignorado en .gitignore para no versionar paquetes locales.
```

Lectura ejecutiva:

```text
El frontend ya tiene una forma reproducible de generar artefactos versionados por shell y MFE.
Esto prepara el camino para despliegues controlados, aunque todavia falta conectar estos artefactos con Cloud Run o el hosting definitivo.
```

## Dia 54 - Plan de despliegue Cloud Run dev

Resumen:

```text
Se creo infra\cloudrun\dev-services.json con 12 servicios Cloud Run dev.
Se creo scripts\deploy-cloudrun-dev.ps1 para generar comandos gcloud run deploy.
El script opera en modo plan por defecto y solo despliega si se usa -Execute.
Los 6 backends quedan planificados como privados con Cloud SQL.
Los 6 frontends quedan planificados como publicos para acceso web dev.
Se actualizo infra\README.md con comandos de uso.
README.md fue actualizado a Dias 1 a 54.
Se creo docs\dia-54-cloud-run-dev.md con Reversa primero y Guia manual desde cero.
```

Archivos principales:

```text
C:\VENTA-DE-PASAJES\infra\cloudrun\dev-services.json
C:\VENTA-DE-PASAJES\scripts\deploy-cloudrun-dev.ps1
C:\VENTA-DE-PASAJES\docs\dia-54-cloud-run-dev.md
C:\VENTA-DE-PASAJES\infra\README.md
C:\VENTA-DE-PASAJES\README.md
```

Comandos ejecutados:

```powershell
Test-Path -LiteralPath .\infra\cloudrun\dev-services.json
Test-Path -LiteralPath .\scripts\deploy-cloudrun-dev.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\deploy-cloudrun-dev.ps1 -ImageTag dia54-local-test
Get-Content -LiteralPath .\logs\cloudrun-dev\deploy-cloudrun-dev.commands.plan.json -Raw | ConvertFrom-Json
Select-String -Path .\logs\cloudrun-dev\deploy-cloudrun-dev.commands.ps1 -Pattern "gcloud|run|deploy|frontend-shell|identity-service"
```

Validaciones:

```text
dev-services.json existe.
deploy-cloudrun-dev.ps1 existe.
El descriptor Cloud Run dev contiene 12 servicios.
El plan generado contiene 6 backends y 6 frontends.
Los 6 backends estan marcados como privados.
Los 6 backends tienen cloud_sql=true.
Se genero logs\cloudrun-dev\deploy-cloudrun-dev.commands.ps1.
Se genero logs\cloudrun-dev\deploy-cloudrun-dev.commands.plan.json.
logs/ esta ignorado por Git, por lo que el plan local no se versiona accidentalmente.
```

Ajuste posterior:

```text
Se corrigio scripts\deploy-cloudrun-dev.ps1 para ejecutar gcloud con splatting real.
El error corregido era: Invalid choice 'run deploy identity-service ...'.
Se agrego troubleshooting en docs\dia-54-cloud-run-dev.md para gcloud/Python.
Se agrego validacion previa de imagenes en Artifact Registry antes de ejecutar Cloud Run deploy.
Se documento limpieza del servicio identity-service si un deploy fallido dejo el servicio creado sin revision util.
Se agrego soporte -CloudSdkPython y autodeteccion de C:\Python312\python.exe para evitar el alias python3.exe de Microsoft Store.
Se cambio la resolucion de gcloud para preferir gcloud.cmd y evitar NativeCommandError de gcloud.ps1.
Se encapsularon llamadas nativas a gcloud para devolver mensajes controlados cuando una imagen no existe.
Se agrego -CheckImagesOnly para probar existencia de imagenes antes de desplegar.
Se agrego -ServiceIds para validar o desplegar subconjuntos concretos de servicios.
Preflight probado: tag dev no tiene imagenes backend publicadas.
Preflight probado: tag 0.1.0-native existe para identity-service, dispatch-service y ticketing-service.
```

Lectura ejecutiva:

```text
El proyecto ya tiene plan reproducible para Cloud Run dev.
No se ejecuto despliegue real porque requiere imagenes existentes en Artifact Registry y credenciales gcloud activas.
El siguiente paso natural es publicar imagenes backend/frontend o ejecutar el primer despliegue dev cuando los tags existan.
```

## Dia 55 - Promocion de tags en Artifact Registry

Resumen:

```text
Se creo scripts\promote-artifact-image-tags.ps1.
El script promueve tags existentes en Artifact Registry sin reconstruir imagenes.
El modo por defecto genera plan y comandos, sin modificar Google Cloud.
La ejecucion real requiere -Execute.
Se documento docs\dia-55-promocion-tags-artifact-registry.md con Reversa primero y Guia manual desde cero.
Se actualizo infra\README.md para no recomendar -ImageTag dev antes de crear ese tag.
README.md fue actualizado a Dias 1 a 55.
```

Archivos principales:

```text
C:\VENTA-DE-PASAJES\scripts\promote-artifact-image-tags.ps1
C:\VENTA-DE-PASAJES\docs\dia-55-promocion-tags-artifact-registry.md
C:\VENTA-DE-PASAJES\infra\README.md
C:\VENTA-DE-PASAJES\README.md
```

Comandos ejecutados:

```powershell
$env:CLOUDSDK_PYTHON = "C:\Python312\python.exe"
& "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd" artifacts docker tags add --help
& "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd" artifacts docker tags delete --help
& "C:\ProgramData\chocolatey\lib\gcloudsdk\tools\google-cloud-sdk\bin\gcloud.cmd" artifacts docker images describe "us-central1-docker.pkg.dev/project-fbb34cd7-0b82-43e1-867/venta-pasajes-dev/identity-service:0.1.0-native" --project "project-fbb34cd7-0b82-43e1-867" --format=json
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\promote-artifact-image-tags.ps1
```

Validaciones:

```text
gcloud artifacts docker tags add existe.
gcloud artifacts docker tags delete existe.
identity-service:0.1.0-native existe.
dispatch-service:0.1.0-native existe.
ticketing-service:0.1.0-native existe.
identity-service:dev no existe aun.
dispatch-service:dev no existe aun.
ticketing-service:dev no existe aun.
El plan local se genero correctamente en logs\artifact-registry.
No se ejecuto -Execute; no se modifico Artifact Registry.
```

Lectura ejecutiva:

```text
El bloqueo del tag dev queda tratado con una promocion controlada y reversible.
Cuando se ejecute -Execute, Cloud Run podra encontrar dev para los tres backends ya publicados.
El despliegue completo de 12 servicios sigue pendiente hasta construir imagenes para document-service, reporting-service, audit-service y frontends.
```

Ajuste posterior:

```text
Se corrigio nuevamente el Paso 8 del Dia 55 para respetar el desacoplamiento de microservicios.
ticketing-service no debe depender de document-service para desplegar.
Se retiro APP_DOCUMENT_SERVICE_BASE_URL del descriptor Cloud Run dev de ticketing-service.
En perfil gcp, la integracion documental de ticketing-service queda apagada por defecto con APP_DOCUMENT_INTEGRATION_ENABLED=false y APP_DOCUMENT_WORKER_ENABLED=false.
El despliegue real parcial vuelve a incluir identity-service, dispatch-service y ticketing-service.
```
