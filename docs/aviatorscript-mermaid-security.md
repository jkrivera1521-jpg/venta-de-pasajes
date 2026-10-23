# Seguridad del visualizador Mermaid

## Cambios realizados

- Mermaid conserva `securityLevel: "strict"` y `htmlLabels: false`, por lo que las etiquetas se representan como SVG y no como HTML embebido.
- `lib/mermaid-sanitizer.ts` centraliza la sanitizacion con DOMPurify y una allowlist explicita de elementos y atributos SVG.
- Se eliminan `script`, `foreignObject`, `iframe`, `object`, `embed`, atributos `on*` y protocolos `javascript:`, `vbscript:` y `data:` en enlaces.
- Se conservan los elementos que Mermaid usa para dibujar: `path`, `rect`, `text`, `tspan`, `g`, `defs`, marcadores, gradientes, filtros y estilos.
- Se conservan `id`, `href`/`xlink:href` internos con referencias `#id`, clases, geometria, estilos y textos necesarios para conexiones y etiquetas.
- Los bloques `<style>` de Mermaid se mantienen cuando son seguros. Si contienen expresiones CSS o protocolos peligrosos se elimina el bloque completo.
- El resultado sanitizado se guarda en el estado del visualizador. La insercion en el DOM, la descarga SVG y la conversion PNG usan ese resultado; ninguna de esas rutas vuelve a usar `rendered.svg` directamente.
- La preparacion de dimensiones para exportacion se ejecuta sobre el SVG ya sanitizado y se vuelve a sanitizar antes de descargarlo.

## Revisión de `dangerouslySetInnerHTML`

- `MermaidDiagramViewer.tsx`: recibe exclusivamente el SVG producido por `sanitizeMermaidSvg`.
- `AviatorCodeEditor.tsx`, `JsonCodeEditor.tsx` y `CurlCodeViewer.tsx`: insertan resaltado generado localmente. Sus funciones de resaltado escapan `&`, `<`, `>` y comillas antes de crear las etiquetas `span`.
- `AviatorNodeInspector.tsx`: reutiliza el resaltado escapado de AviatorScript; no inserta código fuente sin escapar.
- No se encontró otra inserción de HTML arbitrario en `apps/mfe-aviatorscript`.
- `AviatorFlowViewer.tsx` no usa `dangerouslySetInnerHTML`. Sus exportaciones SVG se construyen internamente y los valores de etiquetas se pasan por `escapeXml` antes de formar el archivo.

## CSP evaluada

El MFE se ejecuta también embebido en el shell y Next.js necesita aplicar un nonce por solicitud para sus scripts de hidratacion. Por eso no se añadió una cabecera estática que pudiera romper el flujo ni se habilitó `script-src 'unsafe-inline'`.

La política recomendada para el shell o el proxy de producción es una política con nonce por respuesta, ajustando los orígenes del shell y del servicio de cálculo:

```text
default-src 'self';
base-uri 'none';
object-src 'none';
frame-ancestors 'self' https://shell.example.com;
script-src 'self' 'nonce-{nonce}';
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob:;
font-src 'self' data:;
connect-src 'self' https://aviatorscript.example.com;
```

`blob:` en `img-src` permite cargar temporalmente el SVG sanitizado para generar PNG. `style-src 'unsafe-inline'` queda limitado a estilos existentes del MFE y del SVG; no habilita scripts inline. En desarrollo se deben agregar únicamente los orígenes locales necesarios, como `http://localhost:3000` para el shell y `http://localhost:8087` para la API. La política final debe ser emitida por el shell o el proxy que conoce el origen real y puede generar el nonce.

## Pruebas de seguridad

`tests/mermaid-security.test.mjs` verifica:

- eliminación de `onload`, `onerror`, `onclick` y otros atributos de evento;
- eliminación de `script` y `foreignObject`;
- eliminación de enlaces `javascript:` y `data:` peligrosos;
- eliminación de protocolos peligrosos dentro de estilos;
- conservación de etiquetas, geometria, estilos, IDs, marcadores, gradientes y referencias internas `url(#...)`.

Resultado actual: `34` pruebas pasan con `npm test -w @venta-pasajes/mfe-aviatorscript`.
