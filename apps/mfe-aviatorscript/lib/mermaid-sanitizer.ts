import createDOMPurify, { type Config, type WindowLike } from "dompurify";

const MERMAID_ALLOWED_TAGS = [
  "a",
  "circle",
  "clipPath",
  "defs",
  "desc",
  "ellipse",
  "feBlend",
  "feColorMatrix",
  "feComposite",
  "feFlood",
  "feGaussianBlur",
  "feMerge",
  "feMergeNode",
  "filter",
  "g",
  "line",
  "linearGradient",
  "marker",
  "mask",
  "path",
  "pattern",
  "polygon",
  "polyline",
  "radialGradient",
  "rect",
  "stop",
  "style",
  "svg",
  "symbol",
  "text",
  "title",
  "tspan",
  "use"
] as const;

const MERMAID_ALLOWED_ATTR = [
  "aria-describedby",
  "aria-hidden",
  "aria-label",
  "aria-labelledby",
  "aria-roledescription",
  "attributeName",
  "baseline-shift",
  "class",
  "clip-path",
  "clip-rule",
  "color",
  "color-interpolation",
  "color-interpolation-filters",
  "color-rendering",
  "data-id",
  "data-node",
  "data-section",
  "d",
  "dominant-baseline",
  "dx",
  "dy",
  "fill",
  "fill-opacity",
  "fill-rule",
  "filter",
  "flood-color",
  "flood-opacity",
  "font-family",
  "font-size",
  "font-style",
  "font-weight",
  "gradientTransform",
  "gradientUnits",
  "height",
  "id",
  "in",
  "in2",
  "k1",
  "k2",
  "k3",
  "k4",
  "kernelMatrix",
  "letter-spacing",
  "marker-end",
  "marker-height",
  "marker-mid",
  "marker-start",
  "marker-units",
  "marker-width",
  "mask",
  "offset",
  "opacity",
  "orient",
  "overflow",
  "paint-order",
  "patternContentUnits",
  "patternTransform",
  "patternUnits",
  "points",
  "preserveAspectRatio",
  "r",
  "refX",
  "refY",
  "result",
  "stdDeviation",
  "role",
  "rx",
  "ry",
  "shape-rendering",
  "spreadMethod",
  "stop-color",
  "stop-opacity",
  "stroke",
  "stroke-dasharray",
  "stroke-dashoffset",
  "stroke-linecap",
  "stroke-linejoin",
  "stroke-miterlimit",
  "stroke-opacity",
  "stroke-width",
  "style",
  "text-anchor",
  "tableValues",
  "type",
  "mode",
  "operator",
  "radius",
  "transform",
  "values",
  "vector-effect",
  "version",
  "viewBox",
  "width",
  "x",
  "x1",
  "x2",
  "xmlns",
  "xmlns:xlink",
  "xml:space",
  "y",
  "y1",
  "y2",
  "href",
  "xlink:href"
] as const;

const SAFE_URI_PATTERN = /^(?:#[A-Za-z0-9_.:-]+|https?:\/\/|mailto:|tel:)/i;
const UNSAFE_URI_PATTERN = /^(?:javascript|vbscript|data):/i;
const UNSAFE_STYLE_PATTERN = /(?:expression\s*\(|@import|behavior\s*:)/i;
const UNSAFE_STYLE_URL_PATTERN = /url\s*\(\s*["']?\s*(?!#)[^)]+\)/i;

function containsUnsafeStyle(value: string) {
  return UNSAFE_STYLE_PATTERN.test(value) || UNSAFE_STYLE_URL_PATTERN.test(value);
}

export const MERMAID_SANITIZER_CONFIG: Config = {
  ALLOWED_TAGS: [...MERMAID_ALLOWED_TAGS],
  ALLOWED_ATTR: [...MERMAID_ALLOWED_ATTR],
  ALLOWED_NAMESPACES: ["http://www.w3.org/2000/svg", "http://www.w3.org/1999/xlink", "http://www.w3.org/XML/1998/namespace"],
  ALLOW_ARIA_ATTR: false,
  ALLOW_DATA_ATTR: false,
  ALLOW_UNKNOWN_PROTOCOLS: false,
  FORBID_CONTENTS: ["foreignObject", "script"],
  FORBID_TAGS: ["embed", "foreignObject", "iframe", "object", "script"],
  KEEP_CONTENT: true,
  RETURN_TRUSTED_TYPE: false,
  SANITIZE_DOM: true,
  SANITIZE_NAMED_PROPS: false
};

function configureMermaidPurifier(windowLike: WindowLike) {
  const purifier = createDOMPurify(windowLike);
  purifier.addHook("uponSanitizeElement", (node, hookEvent) => {
    if (hookEvent.tagName === "style" && containsUnsafeStyle(node.textContent ?? "")) {
      node.parentNode?.removeChild(node);
    }
  });
  purifier.addHook("uponSanitizeAttribute", (_node, hookEvent) => {
    const attrName = hookEvent.attrName.toLowerCase();
    const attrValue = hookEvent.attrValue.trim();

    if (attrName.startsWith("on")) {
      hookEvent.keepAttr = false;
      return;
    }

    if (attrName === "style" && containsUnsafeStyle(attrValue)) {
      hookEvent.keepAttr = false;
      return;
    }

    if ((attrName === "href" || attrName === "xlink:href") && (UNSAFE_URI_PATTERN.test(attrValue) || !SAFE_URI_PATTERN.test(attrValue))) {
      hookEvent.keepAttr = false;
    }
  });
  return purifier;
}

export function sanitizeMermaidSvg(markup: string, windowLike?: WindowLike) {
  if (!markup.trim()) return "";
  const rootWindow = windowLike ?? (typeof window === "undefined" ? undefined : window);
  if (!rootWindow) return "";
  return configureMermaidPurifier(rootWindow).sanitize(markup, MERMAID_SANITIZER_CONFIG);
}
