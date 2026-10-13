# Dia 34 - Mapa visual de asientos avanzado

Fecha de ejecucion: 2026-09-15

## Objetivo

Reemplazar el mapa visual fijo del MFE de boleteria por un layout operativo de bus que soporte el esquema legacy de 25 asientos y deje preparada la pantalla para otros layouts.

Alcance del dia:

```text
Mostrar estados por color.
Mostrar chofer, entrada y pasillo.
Soportar layout de 25 asientos.
Preparar soporte para otros layouts.
Probar escritorio y tablet.
```

## Resultado logrado

```text
El mapa de asientos ya no usa una distribucion fija por indice.
Se agrego un motor de layout en frontend para construir celdas visuales.
Se implemento el perfil Legacy 25 asientos usando coordenadas de fila/columna.
Se agrego fallback generico para otros conteos de asientos.
Se muestran Chofer, Entrada y Pasillo dentro del mismo grid visual.
Se separo el color de CANCELLED del estado BLOCKED.
La salida demo ahora sincroniza 25 asientos para probar el layout completo.
Se agregaron breakpoints para escritorio, tablet y ancho compacto.
Se agrego verificador de contrato responsive y layout.
```

## Archivos creados

```text
C:\VENTA-DE-PASAJES\scripts\verify-mfe-ticketing-seat-map.ps1
C:\VENTA-DE-PASAJES\docs\dia-34-mapa-visual-asientos-avanzado.md
```

## Archivos modificados

```text
C:\VENTA-DE-PASAJES\apps\mfe-ticketing\app\ticketing\embedded\page.tsx
C:\VENTA-DE-PASAJES\apps\mfe-ticketing\app\globals.css
C:\VENTA-DE-PASAJES\apps\frontend-shell\app\components\RemoteMfeFrame.tsx
C:\VENTA-DE-PASAJES\apps\frontend-shell\app\page.tsx
C:\VENTA-DE-PASAJES\apps\frontend-shell\app\globals.css
C:\VENTA-DE-PASAJES\vitacora.md
```

## Diseno implementado

### Perfil Legacy 25

```text
Columnas visuales: 1, 2, 3, 4, 5
Pasillo/medio: columna 3
Cabina: fila 1, columna 1
Entrada: fila 1, columna 2
Asiento medio trasero: asiento 25 en fila 7, columna 3
```

El perfil coincide con la semilla de layout de dispatch para 25 asientos:

```text
1  y 2  en fila 2, columnas 1 y 2
3  y 4  en fila 1, columnas 5 y 4
5  y 6  en fila 2, columnas 5 y 4
7  y 8  en fila 3, columnas 1 y 2
9  y 10 en fila 4, columnas 5 y 4
11 y 12 en fila 4, columnas 1 y 2
13 y 14 en fila 5, columnas 5 y 4
15 y 16 en fila 5, columnas 1 y 2
17 y 18 en fila 6, columnas 5 y 4
19 y 20 en fila 6, columnas 1 y 2
21 y 22 en fila 7, columnas 5 y 4
23 y 24 en fila 7, columnas 1 y 2
25 en fila 7, columna 3
```

### Fallback generico

Cuando el mapa recibido no tiene exactamente los asientos `1` a `25`, la pantalla usa un layout generado:

```text
Cabina y entrada en la primera fila.
Asientos ordenados numericamente.
Distribucion 2 + pasillo + 2.
Columna central reservada para pasillo.
```

Esto evita volver a depender de una logica fija estilo VB6.

## Reversa primero

### Paso 1 - Detener frontend local

```powershell
cd C:\VENTA-DE-PASAJES
npm run stop:frontend
```

### Paso 2 - Confirmar puertos libres

```powershell
Get-NetTCPConnection -LocalPort 3000,3001,3002,3003 -ErrorAction SilentlyContinue |
  Select-Object LocalAddress,LocalPort,State,OwningProcess |
  Format-Table -AutoSize
```

### Paso 3 - Limpiar caches de build si se requiere

No es obligatorio. Solo ejecutar si se necesita una compilacion limpia:

```powershell
Remove-Item -LiteralPath .\apps\mfe-ticketing\.next -Recurse -Force -ErrorAction SilentlyContinue
```

## Guia manual desde cero

### Paso 1 - Revisar la tarea

```powershell
cd C:\VENTA-DE-PASAJES
Select-String -Path .\tareas.md -Pattern "### Dia 34|Dia 34" -Context 0,16
```

### Paso 2 - Ajustar el render del mapa

Editar:

```text
C:\VENTA-DE-PASAJES\apps\mfe-ticketing\app\ticketing\embedded\page.tsx
```

Cambios esperados:

```text
Agregar tipos SeatPosition, SeatLayoutCell, SeatLayoutModel.
Agregar LEGACY_25_SEAT_COORDINATES.
Agregar buildLegacy25SeatLayout.
Agregar buildGeneratedSeatLayout.
Agregar buildSeatLayout.
Agregar celdas Chofer, Entrada y Pasillo.
Renderizar cada asiento con gridColumn/gridRow.
Usar clase de estado seat-${seatTone(seat.status)}.
Separar CANCELLED como cancelled.
Cambiar salida demo de 16 a 25 asientos.
```

### Paso 3 - Ajustar estilos visuales

Editar:

```text
C:\VENTA-DE-PASAJES\apps\mfe-ticketing\app\globals.css
```

Cambios esperados:

```text
Agregar .seat-layout-grid.
Agregar .layout-driver, .layout-entry y .layout-aisle.
Agregar .seat-cancelled y .legend-cancelled.
Definir --seat-cell-size para escritorio.
Definir tamanos responsive para max-width 1220px y 820px.
Eliminar dependencia de seat-col-1/2/4/5.
```

### Paso 4 - Agregar verificador

Crear:

```text
C:\VENTA-DE-PASAJES\scripts\verify-mfe-ticketing-seat-map.ps1
```

El script debe validar:

```text
Mapa Legacy 25 presente.
Asiento 25 al centro de la ultima fila.
Fallback generico presente.
Asientos posicionados con gridColumn/gridRow.
Chofer, Entrada y Pasillo presentes.
Estados con colores, incluyendo CANCELLED.
Breakpoints de escritorio/tablet presentes.
Tamanos responsive basados en --seat-cell-size.
Pantalla embebida responde si el MFE local esta levantado.
```

## Pruebas y validaciones

### Typecheck

```powershell
npm run typecheck -w @venta-pasajes/mfe-ticketing
```

Resultado real:

```text
> @venta-pasajes/mfe-ticketing@0.1.0 typecheck
> tsc --noEmit -p tsconfig.json

OK
```

### Build

```powershell
npm run build -w @venta-pasajes/mfe-ticketing
```

Resultado real:

```text
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

### Validacion del mapa avanzado

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-mfe-ticketing-seat-map.ps1
```

Resultado real:

```json
{"service":"mfe-ticketing","validation":"seat-map-day34","legacy_25_layout":true,"generated_layout_fallback":true,"status_colors":["available","reserved","sold","blocked","cancelled"],"cabin_markers":["Chofer","Entrada","Pasillo"],"desktop_breakpoint":"1220px","tablet_breakpoint":"820px","embedded_status":200,"ready":true}
```

## Peticiones utiles

Health del MFE:

```powershell
curl.exe -s "http://localhost:3003/api/health"
```

Manifiesto remoto:

```powershell
curl.exe -s "http://localhost:3003/mfe/manifest"
```

Pantalla embebida:

```powershell
curl.exe -s -o NUL -w "%{http_code}" "http://localhost:3003/ticketing/embedded"
```

Proxy hacia backend:

```powershell
curl.exe -i -S "http://localhost:3003/api/ticketing/health"
```

## Verificacion manual sugerida

### Escritorio

```powershell
npm run dev:frontend
```

Abrir:

```text
http://localhost:3000
```

Revisar:

```text
La pestana Boleteria carga el MFE.
La accion Salida demo crea un bus de 25 asientos.
Se ven Chofer, Entrada y Pasillo.
El asiento 25 queda al centro de la ultima fila.
Los estados se distinguen por color.
```

### Tablet

Reducir el ancho del navegador o usar herramientas de desarrollador con un viewport cercano a tablet.

Revisar:

```text
El grid mantiene proporcion de asientos.
No se superponen textos, botones ni leyenda.
El panel permite scroll horizontal si el ancho compacto lo requiere.
```

## Problemas encontrados y soluciones

| Problema | Causa | Solucion |
| --- | --- | --- |
| El mapa anterior solo distribuia por `index % 4`. | La pantalla del Dia 33 era un mapa inicial. | Se agrego un modelo de celdas con coordenadas por asiento. |
| `CANCELLED` se veia como bloqueado. | `seatTone` agrupaba todo estado no disponible en `blocked`. | Se agrego tono `cancelled` y leyenda propia. |
| No habia prueba automatica de escritorio/tablet. | El repo no tiene Playwright instalado. | Se agrego verificacion por contrato CSS/JS y HTTP sin introducir dependencias nuevas. |

## Ajustes posteriores de UX

Despues de probar el mapa desde el shell se hicieron ajustes adicionales para que la operacion sea mas comoda en pantalla grande y para preparar informacion de boleteria que depende del tiempo y del tipo de pasajero.

### Alto dinamico del MFE embebido

Problema:

```text
El shell recortaba el iframe cuando el mapa de asientos crecia, por ejemplo con una salida demo de 42 asientos.
```

Solucion:

```text
El MFE de boleteria envia su altura real al shell mediante postMessage.
El shell valida el origen contra el origen del manifiesto remoto.
El iframe ajusta su altura dinamicamente, con limites de 720px a 1800px.
```

Archivos:

```text
C:\VENTA-DE-PASAJES\apps\mfe-ticketing\app\ticketing\embedded\page.tsx
C:\VENTA-DE-PASAJES\apps\frontend-shell\app\components\RemoteMfeFrame.tsx
C:\VENTA-DE-PASAJES\apps\frontend-shell\app\globals.css
```

### Uso del alto util del shell

Problema:

```text
El area inferior del shell quedaba visualmente vacia.
```

Solucion:

```text
module-surface usa flex: 1.
remote-panel usa flex: 1 y min-height: 100%.
El iframe mantiene un min-height calculado contra el viewport.
```

Nota:

```text
Se revirtio el experimento de agrandar los asientos a escala del ancho disponible.
El mapa volvio al tamano operativo de 48px por asiento.
```

### Barra lateral ocultable

Solicitud:

```text
Permitir ocultar la barra izquierda para ganar espacio operativo.
```

Solucion:

```text
Se agrego un boton en el topbar, a la izquierda de Consola operativa.
El boton alterna entre mostrar y ocultar la barra lateral.
La preferencia se guarda en localStorage con la clave venta-pasajes:sidebar-collapsed.
Cuando la barra esta oculta, el shell usa una sola columna.
```

Archivos:

```text
C:\VENTA-DE-PASAJES\apps\frontend-shell\app\page.tsx
C:\VENTA-DE-PASAJES\apps\frontend-shell\app\globals.css
```

### Reloj operativo

Solicitud:

```text
Agregar en el shell un reloj con fecha y hora actual.
```

Solucion:

```text
Se agrego una tarjeta clock-card en el topbar.
Muestra hora local con segundos.
Muestra fecha completa en formato es-EC.
Se actualiza cada segundo.
Es responsive para pantallas pequenas.
```

Archivos:

```text
C:\VENTA-DE-PASAJES\apps\frontend-shell\app\page.tsx
C:\VENTA-DE-PASAJES\apps\frontend-shell\app\globals.css
```

### Banderas de pasajero en asientos vendidos

Solicitud:

```text
Marcar asiento vendido a persona con discapacidad, nino o adulto mayor.
```

Solucion:

```text
Se agregaron banderas visuales solo para asientos SOLD.
D  = Persona con discapacidad.
N  = Nino.
AM = Adulto mayor.
```

Contrato preparado para backend:

```text
passenger_flags
passenger_category
passenger_type
```

Mientras backend no envie esos campos, el MFE muestra ejemplos demo en asientos vendidos:

```text
Asiento 6  -> Discapacidad.
Asiento 22 -> Nino.
Asiento 39 -> Adulto mayor.
```

Archivos:

```text
C:\VENTA-DE-PASAJES\apps\mfe-ticketing\app\ticketing\embedded\page.tsx
C:\VENTA-DE-PASAJES\apps\mfe-ticketing\app\globals.css
```

## Validacion posterior consolidada

Comandos ejecutados tras los ajustes:

```powershell
npm run typecheck -w @venta-pasajes/frontend-shell
npm run build -w @venta-pasajes/frontend-shell
npm run typecheck -w @venta-pasajes/mfe-ticketing
npm run build -w @venta-pasajes/mfe-ticketing
curl.exe -s -o NUL -w "%{http_code}" "http://localhost:3000/"
curl.exe -s -o NUL -w "%{http_code}" "http://localhost:3003/ticketing/embedded"
```

Resultado:

```text
frontend-shell typecheck OK
frontend-shell build OK
mfe-ticketing typecheck OK
mfe-ticketing build OK
http://localhost:3000/ -> 200
http://localhost:3003/ticketing/embedded -> 200
```

## Estado final

```text
Dia 34 completado.
El MFE de boleteria tiene mapa avanzado de asientos.
El layout Legacy 25 esta soportado.
La pantalla muestra chofer, entrada y pasillo.
Los estados tienen colores diferenciados.
Existe fallback para otros layouts.
El shell permite ocultar la barra lateral.
El shell muestra reloj operativo con fecha y hora.
El iframe del MFE ajusta su altura dinamicamente.
La leyenda muestra banderas de pasajero para asientos vendidos.
Typecheck, build y verificacion seat-map-day34 pasaron OK.
El frontend local sigue disponible en http://localhost:3000 si no se detuvo manualmente.
```

Siguiente paso natural: extender backend para enviar layout dinamico por bus, pisos, coordenadas, zona tarifaria y banderas reales de pasajero por asiento vendido.
