import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { test } from "node:test";
import { JSDOM } from "jsdom";

const libUrl = new URL("../lib/", import.meta.url).href;
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (context.parentURL?.startsWith(libUrl) && /^\.\/[\w-]+$/.test(specifier)) return nextResolve(`${specifier}.ts`, context);
    return nextResolve(specifier, context);
  }
});

const { sanitizeMermaidSvg } = await import("../lib/mermaid-sanitizer.ts");

function sanitize(markup) {
  const dom = new JSDOM("");
  return sanitizeMermaidSvg(markup, dom.window);
}

test("elimina scripts, HTML embebido, manejadores y enlaces peligrosos", () => {
  const sanitized = sanitize(`<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)">
    <script>alert(2)</script>
    <foreignObject onerror="alert(3)"><div>contenido inseguro</div></foreignObject>
    <a href="javascript:alert(4)" onclick="alert(5)"><text>Enlace</text></a>
    <path d="M0 0" onmouseover="alert(6)" />
  </svg>`);

  assert.doesNotMatch(sanitized, /script|foreignObject|onload|onerror|onclick|onmouseover|javascript:/i);
  assert.match(sanitized, /<svg[\s>]/i);
});

test("conserva la geometria y las referencias internas legitimas de Mermaid", () => {
  const sanitized = sanitize(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 120" id="mermaid-root">
    <defs>
      <marker id="arrow-end" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
        <path d="M0,0 L0,6 L9,3 z" fill="#526f8a" />
      </marker>
      <linearGradient id="node-gradient"><stop offset="0%" stop-color="#fff" /><stop offset="100%" stop-color="#eee" /></linearGradient>
    </defs>
    <g id="flowchart-node-a" class="node" style="filter:url(#node-shadow)">
      <rect x="10" y="10" width="120" height="40" rx="8" fill="url(#node-gradient)" />
      <text x="20" y="35" class="node-label">Inicio</text>
      <path d="M130 30 L210 30" marker-end="url(#arrow-end)" />
    </g>
  </svg>`);

  assert.match(sanitized, /id="flowchart-node-a"/);
  assert.match(sanitized, /id="arrow-end"/);
  assert.match(sanitized, /marker-end="url\(#arrow-end\)"/);
  assert.match(sanitized, /fill="url\(#node-gradient\)"/);
  assert.match(sanitized, />Inicio<\/text>/);
  assert.match(sanitized, /viewBox="0 0 240 120"/);
});

test("descarta protocolos peligrosos tambien dentro de estilos", () => {
  const sanitized = sanitize(`<svg xmlns="http://www.w3.org/2000/svg">
    <style>.safe { fill: #fff; } .bad { background: url(javascript:alert(1)); }</style>
    <g id="safe" class="safe" style="fill:#fff;stroke:url(#safe-stroke)"><text>Seguro</text></g>
    <a href="data:text/html,&lt;script&gt;alert(1)&lt;/script&gt;"><text>Datos</text></a>
  </svg>`);

  assert.doesNotMatch(sanitized, /javascript:|data:text\/html|alert\(/i);
  assert.match(sanitized, /class="safe"/);
  assert.match(sanitized, />Seguro<\/text>/);
});
