# Venta de Pasajes: Agent Guide

Este archivo conserva el contexto estable del proyecto para futuras sesiones de desarrollo.
No incluir contraseñas, tokens, llaves privadas, secretos OAuth, cadenas de conexión ni datos personales reales.
Los prompts de una conversación no se sincronizan por Git; este archivo documenta las decisiones del producto y del código que deben mantenerse.

## Objetivo del proyecto

Venta de Pasajes es una plataforma para modernizar el sistema legado de venta y operación de pasajes mediante una consola shell y microfrontends (MFEs). El shell centraliza autenticación, menú, sesión, apariencia y carga de MFEs remotos. Los módulos de negocio se despliegan de forma independiente.

## Reglas de trabajo

- Leer primero la implementación existente y seguir sus patrones antes de agregar abstracciones.
- Mantener los cambios enfocados; no revertir cambios previos del usuario ni hacer refactors no relacionados.
- Para localizar código usar `rg` o `rg --files`.
- Para ediciones manuales usar `apply_patch`; no escribir archivos con redirecciones o comandos de shell.
- Preferir APIs estructuradas, validación en el servidor y tipos compartidos sobre manipulación frágil de texto.
- Agregar pruebas proporcionales al riesgo, especialmente en autenticación, sesión, menú recursivo y navegación.
- Usar ASCII por defecto en código y documentación, salvo que el archivo ya requiera otro juego de caracteres.
- No introducir secretos en código, commits, documentación, capturas ni archivos `.env`.
- Postman CLI está instalado y puede utilizarse para validar contratos o flujos de API.
- Antes de finalizar, revisar `git diff`, `git diff --check` y el estado del repositorio.

## Arquitectura

### Frontend

El monorepo usa npm workspaces y contiene:

- `apps/frontend-shell`: shell principal, login, consola, sesión, menú, breadcrumbs y carga de MFEs.
- `apps/mfe-identity`: identidad, usuarios, roles, permisos, sesiones y administración del menú.
- `apps/mfe-dispatch`: despachos.
- `apps/mfe-ticketing`: boletería y venta de pasajes.
- `apps/mfe-reporting`: reportes.
- `apps/mfe-admin`: administración.
- `packages/shared-types`: tipos compartidos entre frontend y contratos comunes.

Puertos de desarrollo frontend previstos:

| Aplicación | Puerto |
| --- | ---: |
| frontend-shell | 3000 |
| mfe-identity | 3001 |
| mfe-dispatch | 3002 |
| mfe-ticketing | 3003 |
| mfe-reporting | 3004 |
| mfe-admin | 3005 |

### Backend

Los servicios backend están organizados por dominio, incluyendo identidad, despachos, boletería, documentos, reportes y auditoría. El servicio de identidad administra autenticación, usuarios, roles, permisos, menú, sesiones e información de perfil. La base de datos usa PostgreSQL y migraciones Flyway; los servicios Java usan Quarkus y Maven.

El shell espera normalmente el servicio de identidad en `http://localhost:8081/api/v1/identity`, salvo que las variables de entorno indiquen otra URL.

## Decisiones funcionales vigentes

### Apariencia y temas

- El landing page y el login conservan el estilo corporativo vino/rojo.
- La consola operativa usa el tema visual de los MFEs, con una apariencia clara y un modo oscuro opcional.
- El modo oscuro se guarda por usuario; no debe convertirse en una preferencia global compartida por todos.
- El reloj se muestra en la parte inferior izquierda de la barra lateral.
- Los controles de anclar sesión, modo oscuro y perfil deben permanecer en la zona superior.
- No reintroducir la cabecera eliminada con “FRONTEND SHELL”, “Consola operativa”, MFEs, contrato y sesión.
- No convertir la barra superior en una capa transparente sobre el contenido. El breadcrumb y los controles deben conservar una superficie legible y estable.
- El botón Home conserva la funcionalidad que antes tenía el botón de actualizar: vuelve a cargar el módulo/ruta actual según el comportamiento existente.

### Sesión

- La sesión inicia siempre desanclada al entrar al sistema.
- El control de anclar sesión vive en memoria y no se persiste.
- Desanclada: cerrar automáticamente después de un máximo de 3 minutos sin actividad.
- Anclada: no cerrar automáticamente por inactividad.
- El cierre manual siempre debe seguir disponible.
- No confundir “anclar sesión” con recordar credenciales ni con guardar tokens en almacenamiento inseguro.

### Menú, rutas y breadcrumbs

- El menú se modela como un árbol recursivo de profundidad abierta; no asumir únicamente nivel 1.
- Los padres con hijos se expanden y permiten acceder a sus descendientes.
- Al seleccionar un elemento final navegable en móvil, se oculta la barra lateral para mostrar el MFE.
- En escritorio, conservar el funcionamiento actual de la barra lateral y no cambiar su interacción por ajustes exclusivos de móvil.
- En móvil, la barra lateral inicia colapsada. El botón de despliegue queda dentro de la zona superior, en la esquina superior izquierda, con la flecha hacia abajo cuando está cerrada y hacia arriba cuando está abierta.
- En móvil, al abrir un elemento padre debe ser posible recorrer y seleccionar los hijos; no cerrar el menú antes de que los hijos sean accesibles.
- Los breadcrumbs deben mostrar la ruta activa y mantener los estilos vigentes.
- Un breadcrumb solo puede navegar si el nodo tiene ruta navegable. Los nodos informativos no deben producir navegación.
- Los clics en los elementos navegables deben mostrar cursor de mano.
- La barra lateral no debe quedar afectada por cambios hechos exclusivamente al breadcrumb o a la barra superior.

### Elementos informativos del menú

El formulario de crear/editar hijos incluye un check de “solo informativo”:

- Activado: el nodo no requiere URL de pantalla ni URL de manifest MFE y no navega al hacer clic.
- Desactivado: el nodo puede tener URL de pantalla y URL de manifest MFE y navega según la configuración.
- La interfaz debe evitar mostrar acciones de navegación para nodos informativos.
- La validación de esta regla debe existir también en backend; el frontend no es la única barrera.

### Autenticación y perfil

- El login soporta usuarios locales y usuarios autenticados con Google.
- La experiencia de ingreso con Google debe conservar el flujo simple anterior, sin agregar pantallas o consentimientos innecesarios al usuario.
- Para Google se pueden leer los claims permitidos por el flujo, como `openid`, `profile` y `email`; la foto de Google es solo una fuente opcional de imagen inicial.
- La foto de perfil administrada por esta aplicación se guarda en sus propias bases de datos y no modifica el perfil de Google.
- Tanto usuarios locales como usuarios Google pueden elegir un avatar, cargar una foto desde el dispositivo o tomar una foto con la cámara.
- La edición de foto debe permitir recortar, centrar, ajustar zoom y rotar antes de confirmar.
- Al guardar una foto, conservar solo el resultado recortado necesario para el avatar y liberar recursos temporales del navegador.
- Si la foto remota de Google falla, mostrar el avatar local seleccionado o un fallback estable; no dejar una imagen rota ni depender únicamente de la URL remota.

### Login móvil y ALTCHA

- En móvil ocultar solo el bloque de marca/marketing del login; conservar el formulario y los controles necesarios para autenticarse.
- ALTCHA debe iniciar automáticamente al cargar la página mediante su configuración soportada por el componente.
- El botón de ingreso debe permanecer bloqueado hasta que la verificación automática tenga un payload válido.
- Mantener la validación del payload en el servidor; “automático” no significa eliminar la protección ni confiar en el cliente.
- Si la verificación automática falla, mostrar un estado recuperable y permitir reintentar sin romper el formulario.

## Desarrollo local

Requisitos habituales:

- Git.
- Node.js 24 o superior.
- npm 11 o superior.
- Java y Maven para los servicios backend.
- Docker si se necesita levantar PostgreSQL u otros servicios locales.

Configuración inicial:

```powershell
Set-Location C:\VENTA-DE-PASAJES
npm install
```

Crear variables locales a partir de `.env.example` cuando sea necesario. Nunca subir el archivo resultante si contiene valores privados.

Arrancar el entorno frontend completo:

```powershell
npm run dev:frontend
```

La consola queda normalmente en `http://localhost:3000`; el login en `http://localhost:3000/login`. El script `scripts/start-frontend-dev.ps1` arranca el shell y los MFEs, y configura las URLs de manifest de desarrollo.

Detener los procesos frontend:

```powershell
npm run stop:frontend
```

Comandos útiles de módulos:

```powershell
npm run dev:shell
npm run dev:mfe-identity
npm run dev:mfe-dispatch
npm run dev:mfe-ticketing
npm run dev:mfe-reporting
npm run dev:mfe-admin
```

Arrancar el motor de calculos desde la raiz:

```powershell
.\scripts\start-aviatorscript-service.ps1
```

El script levanta la base PostgreSQL local y luego Quarkus. Su API usa el puerto `8087`, la ruta `POST /api/v1/calculos/ejecutar` y la base `aviatorscript_db` con esquema `calculos`. Para detener la base usa `.scriptsstop-aviatorscript-service.ps1`.

## Variables de entorno y seguridad

- Usar `.env.example` como referencia de nombres y valores seguros de desarrollo.
- Los archivos `.env`, `.env.*`, credenciales, llaves y certificados están excluidos por `.gitignore`; respetar esa protección.
- No copiar secretos al `AGENTS.md`, README, logs, capturas o respuestas del asistente.
- Las credenciales OAuth de Google, secretos JWT, credenciales de base de datos, URLs privadas y credenciales cloud deben configurarse por máquina o mediante un gestor de secretos.
- Al trabajar desde casa, transferir secretos por el mecanismo seguro de la organización, no por commits ni por el historial de la conversación.
- Verificar que los orígenes autorizados de Google OAuth incluyan el host local que se usa en desarrollo, sin ampliar permisos innecesariamente.
- Cualquier subida de imagen debe validar tipo, tamaño y contenido en servidor; no confiar solo en la extensión o en el MIME enviado por el navegador.

## Validación antes de entregar cambios

Para cambios frontend, ejecutar como mínimo:

```powershell
npm run typecheck:frontend
npm run build:frontend
git diff --check
```

Para una validación enfocada del shell:

```powershell
npm run typecheck -w @venta-pasajes/frontend-shell
npm run build -w @venta-pasajes/frontend-shell
```

Para cambios backend, ejecutar las pruebas y el empaquetado Maven del servicio afectado, además de verificar migraciones y contratos de API. Para cambios de autenticación, menú, sesión, subida de imágenes o responsive, probar explícitamente escritorio y móvil en los flujos afectados.

Revisar en navegador:

- Login local y Google.
- ALTCHA automático y recuperación ante fallo.
- Avatar de Google, avatar local, carga desde dispositivo y cámara.
- Recorte, centrado, zoom y rotación de imágenes.
- Anclar/desanclar sesión y vencimiento por inactividad.
- Modo claro/oscuro por usuario.
- Barra lateral desktop y móvil.
- Menú con varios niveles, padres, hijos y nodos informativos.
- Breadcrumbs navegables y no navegables.
- Home recargando el módulo actual.

## Entrega y trabajo desde otra máquina

El remoto principal es el repositorio Git configurado como `origin`. Para conservar cambios entre el trabajo y la casa:

1. En la máquina actual, revisar los cambios, hacer commit y subirlos al remoto.
2. En la otra máquina, clonar el repositorio o ejecutar `git pull` en la rama correspondiente.
3. Reinstalar dependencias con `npm install` y recrear las variables locales desde `.env.example` usando el canal seguro de la organización.
4. No se espera que Git transfiera sesiones del navegador, credenciales, secretos, bases de datos locales ni el historial completo de prompts.

Ejemplo de flujo de entrega:

```powershell
git status
git add -A
git commit -m "Describe el cambio"
git push origin main
```

Para trabajo paralelo, usar una rama con prefijo `codex/`, por ejemplo `codex/ajuste-menu-movil`, y fusionarla después de validar. No hacer `git reset --hard` ni eliminar cambios de otra persona sin autorización explícita.

## Archivos de referencia importantes

- `README.md`: propósito, arquitectura, despliegue y contexto general.
- `package.json`: workspaces y scripts principales.
- `.env.example`: variables de entorno no secretas para desarrollo.
- `scripts/start-frontend-dev.ps1`: arranque local del shell y MFEs.
- `scripts/stop-frontend-dev.ps1`: detención del entorno frontend.
- `apps/frontend-shell/app/components/ShellConsole.tsx`: layout, menú, sesión, controles responsive y carga de MFEs.
- `apps/frontend-shell/app/components/ShellLogin.tsx`: login local/Google y ALTCHA.
- `apps/frontend-shell/app/components/RemoteMfeFrame.tsx`: integración de MFEs remotos.
- `apps/frontend-shell/app/globals.css`: estilos globales, temas y responsive.
- `apps/mfe-identity`: pantallas de identidad, usuarios y configuración de menú.
- `services/identity-service`: APIs y persistencia de identidad.
- `services/aviatorscript-service`: motor de calculo dinamico con AviatorScript, formulas versionadas y registro de ejecuciones.
- `services/aviatorscript-service/README.md`: desarrollo local y contrato inicial del motor de calculos.
- `docs/openapi/aviatorscript-service.openapi.yaml`: contrato REST inicial del servicio.
- `docs/`: decisiones, contratos y material operativo del proyecto.

## Checklist para cambios de UI

- Confirmar primero si el cambio aplica a desktop, móvil o ambos.
- Preservar el tema vino/rojo únicamente en landing y login, salvo solicitud expresa.
- Mantener el tema de los MFEs en la consola operativa.
- No introducir transparencias que oculten o dificulten leer el MFE al hacer scroll.
- No ocultar accidentalmente hijos del menú al colapsar la barra en móvil.
- Mantener separadas las responsabilidades de navegación, presentación y carga del MFE.
- Verificar que texto, botones, iconos y controles no se superpongan en los tamaños objetivo.
- Mantener tooltips o etiquetas accesibles para iconos no obvios.
- Validar teclado, foco, cursor y estados disabled/loading/error en acciones interactivas.
- Comprobar que un nodo informativo nunca navegue, aunque tenga un clic o breadcrumb visible.
