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
- `apps/mfe-aviatorscript`: constructor visual de reglas de negocio.
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
| mfe-aviatorscript | 3006 |

### Backend

Los servicios backend están organizados por dominio, incluyendo identidad, despachos, boletería, documentos, reportes y auditoría. El servicio de identidad administra autenticación, usuarios, roles, permisos, menú, sesiones e información de perfil. La base de datos usa PostgreSQL y migraciones Flyway; los servicios Java usan Quarkus y Maven.

El shell espera normalmente el servicio de identidad en `http://localhost:8081/api/v1/identity`, salvo que las variables de entorno indiquen otra URL.

El servicio `services/aviatorscript-service` usa Quarkus, Java 21, Maven, AviatorScript y PostgreSQL. Su API local escucha normalmente en `http://localhost:8087`.

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

## MFE de reglas y servicio AviatorScript

### Propósito y experiencia del MFE

- `apps/mfe-aviatorscript` es un constructor visual de fórmulas inspirado en la interacción de Visualino: toolbox de categorías, lienzo de bloques que se arrastran y encajan, y representación AviatorScript generada en vivo. Está dirigido a analistas de negocio y no debe exigir que escriban código.
- Construir expresiones y programas completos con bloques de variables JVM, variables locales, valores, matemáticas, comparaciones, lógica, texto, funciones permitidas, listas, objetos y control de flujo. El bloque raíz `programa AviatorScript` contiene las instrucciones; una expresión simple heredada puede seguir usando el bloque `resultado`. La paleta y el AST soportan `+ - * / % **`, `== != =~ > >= < <=`, `&& ||`, `& | ^ << >> >>>` y los unarios `! - ~`.
- La paleta general debe exponer los componentes que el usuario necesita para programar visualmente AviatorScript: secciones, `let`, asignación, `SI` compacto, `SI` con alternativas, `ELSIF`, `ELSE`, `PARA CADA`, `MIENTRAS`, `CONTINUAR`, salida del ciclo, `LANZAR ERROR`, `DEVOLVER`, acceso a propiedades, listas, objetos y entradas de objetos. Las variables JVM no deben limitarse a una lista fija: el bloque `dato JVM` permite crear bajo demanda el nombre y tipo de cada variable; las variables del esquema se ofrecen solo como sugerencias opcionales. Las variables locales se pueden escribir en bloques sin convertirse en variables externas del contexto. Al cargar un AST, un `SI` sin `elsif` ni `else` debe usar el bloque compacto para evitar conectores vacios.
- Mantener sincronizados el workspace serializable de Blockly, el AST JSON tipado y el AviatorScript generado. Los cambios al guardar/abrir deben preservar el workspace y la expresión; el editor de bloques sigue siendo el flujo principal, pero el panel AviatorScript también permite editar código. El flujo código -> parser seguro -> AST -> bloques debe conservar el workspace anterior si la sintaxis no es representable; nunca ejecutar texto arbitrario con `eval` o `Function`.
- La plantilla de nomina avanzada y `generatePayrollAviatorScript` deben compartir la misma configuracion, pero la plantilla debe materializarse como un programa generico completo, no como un bloque-resumen. El script debe reflejar sus umbrales y tasas en comentarios validos `##` y organizar la logica en secciones correspondientes a los grupos del ejercicio. El flujo debe mostrar en el lienzo las condiciones, ramas, operaciones, iteraciones, errores y datos devueltos de la formula real, no solo titulos o resúmenes. Mantener cada etiqueta del grafico lo bastante breve para que se lea sin desbordar el lienzo, dividir expresiones largas en pasos consecutivos y sincronizar el dibujo al editar parametros. El flujo del ejemplo se conecta mediante bloques explicitos `SI/SI NO`, `PARA CADA`, `CONTINUAR`, `LANZAR ERROR` y `DEVOLVER`; al abrir formulas antiguas de nomina, reconstruir estos bloques desde el AST. En el bloque rojo, las cuatro validaciones de entrada (`salarioMensual`, `diasMes`, `diasTrabajados` y `calificacionDesempeno`) permiten editar comparadores, limites y mensajes. Los rangos permiten elegir O / Y; el limite superior de dias trabajados puede referenciar `diasMes` o usar un numero. Compartir la configuracion tipada `inputValidations` entre Blockly, AST, generador y evaluador local; no convertir estas reglas de nuevo en etiquetas de solo lectura. Conservar los borradores antiguos que solo tenian `salaryValidationOperator/Limit/Message`. Al importar AviatorScript, rechazar validaciones no representables en lugar de reemplazarlas silenciosamente por los valores iniciales. Las tasas y limites del calculo siguen editandose en el bloque principal.
- La visualizacion debe conservar la jerarquia del programa: los contenedores `SI`, `ELSIF`, `ELSE`, `PARA CADA` y `MIENTRAS` deben cubrir todo el ancho ocupado por sus hijos y cadenas anidadas. El ajuste se calcula desde la posicion y el ancho real de los bloques renderizados, se aplica tras el renderizado y se agrupa por frame para no bloquear la carga de formulas grandes. No resolver este requisito con bloques resumen ni con desbordamiento horizontal de los hijos.
- El MFE ofrece una vista adicional `Visualizar flujo` que analiza el codigo AviatorScript como un grafo de control estatico, sin ejecutarlo. El editor de codigo, el diagrama `@xyflow/react`, el inspector de nodos y los rangos de lineas deben permanecer sincronizados; el usuario puede seleccionar decisiones, ciclos, `throw`, `continue`, `break`, funciones, asignaciones y `return`, consultar sus dependencias, contraer ramas/ciclos y expandir todo, y exportar SVG, PNG o Mermaid. El analisis local es el respaldo inmediato y se intenta enriquecer con `POST /api/v1/aviator/visualize` mediante el proxy server-side; un fallo de red no debe borrar el grafo local.
- El analizador remoto vive en `AviatorVisualizationService`, usa lexer/parser recursivo y una representacion intermedia CFG independiente del motor `AviatorCalculationService`. No usar regex como parser principal, `eval`, `Function` ni compilar/ejecutar la formula para dibujarla. Aplicar limites de entrada y profundidad, diagnosticos recuperables y preservar el codigo anterior ante sintaxis invalida.
- Validar conexiones, variables disponibles y compatibilidad de tipos; mostrar errores accionables. No depender únicamente del color para indicar errores o éxito.
- La nomina avanzada es un ejemplo de programa completo, no una funcionalidad exclusiva del MFE. Debe poder construirse desde la paleta general y cargar desde el catalogo como AST de programa. Las formulas heredadas que aun usen un bloque compacto pueden pasar por `Descomponer` para obtener piezas visuales movibles; la vista debe conservar la conexion del resultado, permitir editar parametros y validaciones y sincronizar etiquetas, AST, AviatorScript y evaluador sin duplicar la formula ni degradarla a texto libre.
- `Nueva` debe crear un programa AviatorScript generico desde cero con un `DEVOLVER` inicial conectado a una lista `seq.list()`, para que el editor no sugiera que toda formula devuelve solo un numero, texto o booleano. La nomina avanzada debe poder construirse con la paleta general o cargarse como plantilla de solo lectura; no agregar botones o flujos exclusivos para crear nominas.
- El sandbox recibe un contexto JSON y evalúa localmente solo los nodos y funciones admitidos. El ejemplo de prueba se construye a partir de las variables usadas por la fórmula, conserva los valores editados para variables que sigan presentes y elimina del ejemplo las variables que ya no se usan. La plantilla de nómina avanzada usa el mismo AST de programa generico, conserva su contexto de listas y tiene un evaluador local acotado. El panel derecho ofrece las pestañas `AviatorScript` y `Probar regla`; el botón superior `Probar` abre directamente la segunda. El código puede editarse y aplicarse al lienzo mediante un parser seguro; después de cargarlo, el resultado de la prueba se calcula desde el AST reconstruido. Debajo del código se muestran controles tipados para las variables que usa la fórmula; al editarlos se regenera el JSON del sandbox y se conserva la edición bidireccional en la pestaña `Probar regla`. Las variables estructuradas, como horas extra y descuentos, se editan como JSON y deben validarse antes de incorporarse al contexto.
- El diseño debe ser responsive para móvil, tableta y escritorio. En móvil, las categorías del toolbox se ubican arriba, las entradas de los bloques se apilan y se alterna entre lienzo y panel de AviatorScript/pruebas; evitar desbordamiento horizontal y controles que tapen contenido.
- Los paneles principales del constructor (lienzo Blockly y panel AviatorScript/sandbox) ofrecen maximización en una ventana modal centrada de aproximadamente 90% del viewport. La vista ampliada conserva la misma instancia y sus datos, permite restaurar/cerrar con `Escape`, contiene el foco y bloquea el scroll del fondo; no duplicar el workspace ni el estado del sandbox.
- Seguir el estilo visual de los MFEs y las convenciones locales de componentes. El tema vino/rojo queda reservado al landing y al login; no trasladarlo a este constructor sin solicitud expresa.
- El MFE se integra actualmente con el shell mediante su manifest y la entrada embebida cargada como remoto. La exportación tipada del componente es un punto de integración adicional, no significa que Module Federation o Single-SPA estén configurados.

### Contratos del constructor

- `GET /api/v1/rules/schema` entrega el esquema de contexto (con mock local si no hay API configurada). El editor visual actual valida tipos y prueba expresiones localmente; no asumir que los endpoints mock anteriores `POST /api/v1/rules/validate` y `/test` participan en este flujo.
- `Guardar` conserva un borrador en el navegador y descarga un archivo `.aviatorscript.json`; `Abrir` restaura ese formato. El callback tipado `onSave` es un punto de integración opcional. Esto no implica persistencia en base de datos.
- El selector de plantillas consume `GET /api/v1/calculos/formulas` del servicio. Incluye todas las versiones guardadas, activas e inactivas, en modo solo lectura y muestra la descripcion cuando existe. Elegir una formula compatible debe copiarla al workspace como borrador nuevo; nunca agregar edicion o borrado de las formulas persistidas ni cambiar la fila original al guardar un borrador.
- Las expresiones simples se convierten al AST de expresiones y los programas completos al AST de programa tipado, con declaraciones, asignaciones, control, colecciones, errores y retorno. Generar el AviatorScript completo en el orden de los bloques; no truncar programas ni mostrarlos como si fueran una expresion simple. Si un formato no se puede representar, mostrar un error recuperable y conservar el workspace anterior sin carga parcial.
- `NEXT_PUBLIC_RULES_API_BASE_URL` configura la base del esquema cuando se usa un backend compatible. Manejar errores de red o respuestas inválidas sin perder el workspace.
- `AVIATORSCRIPT_SERVICE_URL` configura la URL server-side del servicio para el proxy local del catalogo. Mantener el proxy sin cache y no exponer credenciales en el navegador.
- La validación local mejora la interacción, pero no sustituye validación/compilación del lado Java. No usar `eval`, `Function` ni ejecutar texto arbitrario en el navegador; el evaluador local solo interpreta de forma acotada el AST soportado.
- No afirmar que una fórmula está guardada o compilada por el backend salvo que exista y se haya verificado esa integración. Mostrar errores de tipos o estructura con mensajes accionables.

### Responsabilidades del servicio

- `services/aviatorscript-service` es un servicio Quarkus independiente con Java 21, Maven, PostgreSQL, Flyway y AviatorScript. Respetar sus capas existentes: recursos REST, DTO, servicios, entidades y repositorios.
- El servicio implementa `POST /api/v1/calculos/ejecutar` y el catalogo de solo lectura `GET /api/v1/calculos/formulas`. La base local es `aviatorscript_db`, el esquema es `calculos` y el puerto API por defecto es `8087`.
- Los `throw` explicitos de validacion en una formula se devuelven como `SOLICITUD_INVALIDA` con HTTP 400 y su mensaje controlado; los errores tecnicos de evaluacion permanecen genericos y no deben filtrar detalles internos.
- No asumir que el servicio ya implementa los endpoints de reglas del MFE (`/api/v1/rules/schema`, `/validate`, `/test`). Antes de conectar o ampliar el contrato, revisar OpenAPI, recursos, pruebas y migraciones existentes; documentar y probar cualquier nuevo endpoint.
- Las fórmulas publicadas son inmutables por versión; publicar una modificación como una versión nueva y conservar la trazabilidad de cada ejecución.
- Las migraciones seed agregan ejercicios demostrativos con `ON CONFLICT DO NOTHING`; nunca actualizan o sustituyen una formula ya registrada. La descripcion puede ser nula en formulas antiguas y se debe conservar esa compatibilidad en el API y el MFE.
- Tratar reglas y fórmulas como entrada no confiable. Validar estructura, tamaño, profundidad y tipos; limitar funciones AviatorScript permitidas, tiempo y recursos de ejecución; no exponer el evaluador sin autenticación/autorización y controles apropiados.
- Persistir cambios de esquema con migraciones Flyway nuevas y compatibles. No modificar silenciosamente migraciones ya aplicadas ni incluir secretos en configuración, README, logs o pruebas.
- Mantener contratos OpenAPI y pruebas REST alineados con las respuestas de éxito y error. Las pruebas que dependen de PostgreSQL deben indicar y usar una base local disponible; no ocultar fallas de conexión como si fueran fallas de lógica.

### Desarrollo y validación del MFE

Desde la raíz del monorepo:

```powershell
npm run dev:mfe-aviatorscript
```

Abrir `http://localhost:3006/rules/embedded`. Para ejecutar el servicio Java junto con su PostgreSQL local:

```powershell
.\scripts\start-aviatorscript-service.ps1
```

La base dedicada del servicio usa el puerto host `55437` para no interferir con PostgreSQL de otros servicios. Usar `.\scripts\stop-aviatorscript-service.ps1` para detenerla cuando corresponda.

Al cambiar el MFE, ejecutar `npm test -w @venta-pasajes/mfe-aviatorscript`, `npm run typecheck -w @venta-pasajes/mfe-aviatorscript` y `npm run build -w @venta-pasajes/mfe-aviatorscript`, además de probar reglas vacías, condiciones por tipo, anidación AND/OR, búsqueda e inserción de variables, validación, pruebas JSON, selección de formulas existentes como copia de solo lectura, los bloques de flujo del ejemplo de nómina y vista móvil. En nomina, comprobar que editar `diasMes <= 1` y su mensaje modifica el codigo y rechaza el valor 1 en el sandbox, manteniendo la compatibilidad de borradores y plantillas.

Al cambiar el servicio, ejecutar `mvn -f .\services\aviatorscript-service\pom.xml test`; cuando haya PostgreSQL disponible, verificar también las pruebas de recurso y el empaquetado Maven. Probar solicitudes válidas e inválidas, versionado de fórmulas y persistencia del registro de ejecución.

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
- Editor AviatorScript: arrastre/conexión de bloques, actualización de expresión, validación, apertura/guardado JSON, sandbox y vista móvil.
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
- `apps/mfe-aviatorscript`: constructor Blockly, esquema de contexto, AST de fórmulas, generación AviatorScript, validación y sandbox local.
- `apps/mfe-aviatorscript/components/VisualFormulaBuilder.tsx`: experiencia principal del editor de fórmulas.
- `apps/mfe-aviatorscript/components/AviatorVisualizationWorkspace.tsx`, `AviatorCodeEditor.tsx`, `AviatorFlowViewer.tsx` y `AviatorNodeInspector.tsx`: vista estática de código, CFG interactivo, exportaciones e inspección.
- `apps/mfe-aviatorscript/lib/blockly-editor.ts` y `apps/mfe-aviatorscript/lib/formula.ts`: definición de bloques, adaptación workspace/AST, generación de código, tipos, validación y evaluación local.
- `apps/mfe-aviatorscript/lib/visualization.ts`: tipos y construcción local del grafo de flujo.
- `services/identity-service`: APIs y persistencia de identidad.
- `services/aviatorscript-service`: motor de calculo dinamico con AviatorScript, formulas versionadas y registro de ejecuciones.
- `services/aviatorscript-service/src/main/java/ec/gob/iess/calculos/service/AviatorVisualizationService.java`: parser y analizador CFG estático del código AviatorScript.
- `apps/mfe-aviatorscript/README.md`: ejecución, mocks e integración del constructor.
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
