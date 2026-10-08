# Cambiar estilos del frontend-shell

Este documento explica como cambiar la imagen de fondo y los colores principales del `frontend-shell`.

## Archivos que debes modificar

| Uso | Archivo |
| --- | --- |
| Imagen del hero publico | `C:\VENTA-DE-PASAJES\apps\frontend-shell\app\page.tsx` |
| Estilos globales de landing, login y consola | `C:\VENTA-DE-PASAJES\apps\frontend-shell\app\globals.css` |
| Login global | `C:\VENTA-DE-PASAJES\apps\frontend-shell\app\components\ShellLogin.tsx` |
| Consola operativa | `C:\VENTA-DE-PASAJES\apps\frontend-shell\app\components\ShellConsole.tsx` |

## Cambiar la imagen de fondo

La imagen principal de la landing se define en:

```tsx
// C:\VENTA-DE-PASAJES\apps\frontend-shell\app\page.tsx
const heroImageUrl = "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=2200&q=80";
```

Para cambiarla:

1. Busca una imagen horizontal de bus, terminal, carretera o marca oficial.
2. Copia la URL publica de la imagen.
3. Reemplaza el valor de `heroImageUrl`.
4. Guarda el archivo.
5. Refresca `http://localhost:3000/`.

Ejemplo:

```tsx
const heroImageUrl = "https://mi-dominio.com/imagenes/bus-panamericana.jpg";
```

Si la imagen es local, colócala en `public`, por ejemplo:

```text
C:\VENTA-DE-PASAJES\apps\frontend-shell\public\images\hero-bus.jpg
```

Y usa:

```tsx
const heroImageUrl = "/images/hero-bus.jpg";
```

## Cambiar el oscurecimiento del hero

El hero usa una capa encima de la imagen para que el texto se lea bien:

```tsx
backgroundImage: `linear-gradient(90deg, rgba(33, 5, 12, 0.86), rgba(82, 11, 28, 0.56), rgba(82, 11, 28, 0.18)), url("${heroImageUrl}")`
```

Como leer esos valores:

| Valor | Significado |
| --- | --- |
| `rgba(33, 5, 12, 0.86)` | Color vino oscuro al lado izquierdo, donde esta el texto. |
| `rgba(82, 11, 28, 0.56)` | Transicion vino medio al centro. |
| `rgba(82, 11, 28, 0.18)` | Capa mas transparente hacia la derecha. |

Si el texto no se lee, sube la opacidad. Por ejemplo cambia `0.86` a `0.92`.

Si la imagen se ve demasiado oscura, baja la opacidad. Por ejemplo cambia `0.86` a `0.72`.

## Paleta actual rojo/vino

La paleta principal esta en `globals.css`, dentro de `:root`.

```css
:root {
  --background: #f8f5f6;
  --surface: #ffffff;
  --surface-muted: #f5e9ed;
  --text: #24151a;
  --muted: #6f5f65;
  --line: #ead6db;
  --brand-950: #21050c;
  --brand-900: #3a0713;
  --brand-800: #520b1c;
  --brand-700: #7f1027;
  --brand-600: #991b2f;
  --brand-500: #b91c35;
  --brand-100: #fde7eb;
  --brand-50: #fff4f6;
  --wine-gold: #d8a45d;
}
```

## Que color cambia cada variable

| Variable | Donde impacta | Recomendacion |
| --- | --- | --- |
| `--brand-950` | Fondos muy oscuros, sidebar y footer. | Concho de vino casi negro. |
| `--brand-900` | Bandas principales, titulos, botones oscuros. | Rojo vino profundo. |
| `--brand-800` | Estado activo del menu lateral. | Vino medio oscuro. |
| `--brand-700` | Bordes o detalles activos. | Vino visible pero serio. |
| `--brand-600` | Iconos de marca y acentos fuertes. | Rojo institucional. |
| `--brand-500` | Botones principales y llamadas a la accion. | Rojo accion. |
| `--brand-50` | Fondos suaves de items destacados. | Rosa casi blanco. |
| `--surface-muted` | Botones secundarios y fondos suaves. | Gris rosado claro. |
| `--wine-gold` | Eyebrows y acentos premium. | Dorado sobrio para contraste. |

## Cambiar solo los botones principales

Busca en `globals.css`:

```css
.landing-button-primary {
  background: var(--brand-500);
}

.login-primary {
  background: var(--brand-500);
}
```

Para un rojo mas intenso:

```css
background: #dc2626;
```

Para un vino mas sobrio:

```css
background: #7f1027;
```

## Cambiar sidebar y footer

Busca:

```css
.sidebar {
  background: var(--brand-950);
}

.landing-footer {
  background: var(--brand-950);
}
```

Opciones recomendadas:

| Estilo | Color |
| --- | --- |
| Concho de vino | `#21050c` |
| Vino oscuro | `#3a0713` |
| Rojo profundo | `#520b1c` |

## Cambiar tarjetas, bordes y fondos claros

Busca estas variables:

```css
--background: #f8f5f6;
--surface-muted: #f5e9ed;
--line: #ead6db;
```

Usa esta regla:

| Si quieres | Cambia |
| --- | --- |
| Fondo mas blanco | `--background: #fbf9fa;` |
| Fondo mas rosado | `--background: #fff4f6;` |
| Bordes mas marcados | `--line: #ddb3bd;` |

## Cambiar los acentos dorados

Busca:

```css
--wine-gold: #d8a45d;
```

Este color aparece en textos pequenos tipo etiqueta, por ejemplo "Servicios" o "Panamericana Internacional".

Alternativas:

```css
--wine-gold: #c9974c;
--wine-gold: #e0b66f;
--wine-gold: #b8893f;
```

## Cambiar colores por seccion

| Seccion | Clase CSS |
| --- | --- |
| Navegacion publica | `.landing-nav`, `.landing-brand`, `.landing-links` |
| Hero publico | `.landing-hero`, `.hero-content`, `.landing-button-*` |
| Indicadores de confianza | `.trust-band` |
| Servicios y oficinas | `.service-item`, `.office-item` |
| Destinos | `.destination-grid a` |
| Bloque app/canales digitales | `.digital-section` |
| Footer publico | `.landing-footer` |
| Login global | `.login-page`, `.login-panel`, `.login-primary`, `.login-google` |
| Consola operativa | `.sidebar`, `.brand-mark`, `.nav-item-active`, `.clock-card` |

## Ejercicio aplicado en este proyecto

Antes la landing usaba una paleta de transporte basada en azul profundo, naranja de accion, blanco y grises claros.

Ahora se cambio a una paleta profesional rojo/vino:

| Antes | Ahora |
| --- | --- |
| Azul profundo `#11264a` | Vino profundo `#3a0713` |
| Naranja accion `#f97316` | Rojo accion `#b91c35` |
| Azul sidebar `#172033` | Concho de vino `#21050c` |
| Azul activo `#243047` | Vino medio `#520b1c` |
| Amarillo naranja `#ffb45f` | Dorado vino `#f0c783` |
| Grises frios | Grises calidos rosados |

## Como validar despues de cambiar estilos

Ejecuta:

```powershell
cd C:\VENTA-DE-PASAJES
npm run typecheck -w @venta-pasajes/frontend-shell
npm run build -w @venta-pasajes/frontend-shell
```

Luego abre:

```text
http://localhost:3000/
http://localhost:3000/login
http://localhost:3000/app
```

Revisa especialmente:

1. Que el texto del hero se lea sobre la imagen.
2. Que los botones principales contrasten bien.
3. Que el login no pierda legibilidad.
4. Que el sidebar de la consola mantenga buen contraste.
5. Que en movil no se mezclen textos con fondos oscuros.

## Recomendacion practica

Si quieres hacer otro cambio de marca, modifica primero las variables en `:root` y despues ajusta solo los casos especiales.

Orden sugerido:

1. Cambiar `--brand-950`, `--brand-900`, `--brand-500`.
2. Cambiar `--background`, `--surface-muted`, `--line`.
3. Cambiar `--wine-gold`.
4. Revisar `/`, `/login` y `/app`.
5. Ejecutar typecheck y build.
