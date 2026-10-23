"use client";

import { Check, CheckCircle2, Clipboard, Code2, Download, Maximize2, Minus, Plus, RefreshCw, XCircle } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from "react";
import { sanitizeMermaidSvg } from "../lib/mermaid-sanitizer";
import { collapseAviatorFlowGraph, type AviatorFlowGraph } from "../lib/visualization";
import { buildMermaidFlowchart, collapseMermaidFlowchart, mermaidNodeId } from "../lib/mermaid";
import { CodeMirrorEditor, formatCodeWhitespace } from "./CodeMirrorEditor";

type MermaidDiagramViewerProps = {
  graph: AviatorFlowGraph | null;
};

type MermaidStatus = "idle" | "validating" | "valid" | "invalid";
type MermaidTheme = "default" | "dark" | "neutral" | "forest";

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2.5;
const ZOOM_STEP = 0.25;

function errorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  return "No se pudo validar el código Mermaid.";
}

function downloadFile(filename: string, content: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function decodeMermaidLabelEntities(value: string) {
  const replacements: Record<string, string> = {
    "#amp;": "&",
    "#quot;": "\"",
    "#lt;": "<",
    "#gt;": ">",
    "#124;": "|",
    "#91;": "[",
    "#93;": "]",
    "#123;": "{",
    "#125;": "}",
    "#40;": "(",
    "#41;": ")",
    "#59;": ";",
    "&#38;": "&",
    "&#34;": "\"",
    "&#60;": "<",
    "&#62;": ">",
    "&#124;": "|",
    "&#91;": "[",
    "&#93;": "]",
    "&#123;": "{",
    "&#125;": "}",
    "&#40;": "(",
    "&#41;": ")",
    "&#59;": ";",
    "&quot;": "\"",
    "&lt;": "<",
    "&gt;": ">"
  };
  return value.replace(/(?:#(?:amp|quot|lt|gt|124|91|93|123|125|40|41|59);|&#(?:38|34|60|62|124|91|93|123|125|40|41|59);|&(?:quot|lt|gt);)/g, (entity) => replacements[entity] ?? entity);
}

function normalizeMermaidSvgLabels(markup: string) {
  const document = new DOMParser().parseFromString(markup, "image/svg+xml");
  const walker = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_TEXT);
  let current = walker.nextNode();
  while (current) {
    current.nodeValue = decodeMermaidLabelEntities(current.nodeValue ?? "");
    current = walker.nextNode();
  }
  return new XMLSerializer().serializeToString(document.documentElement);
}

function numericSvgLength(value: string | null) {
  if (!value || value.trim().endsWith("%")) return undefined;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function getSvgDimensions(markup: string) {
  const document = new DOMParser().parseFromString(markup, "image/svg+xml");
  const root = document.documentElement;
  const viewBox = root.getAttribute("viewBox")?.trim().split(/\s+/).map(Number) ?? [];
  return {
    root,
    document,
    width: viewBox[2] || numericSvgLength(root.getAttribute("width")) || 1200,
    height: viewBox[3] || numericSvgLength(root.getAttribute("height")) || 800
  };
}

function prepareSvgForDownload(markup: string) {
  const { document, root, width, height } = getSvgDimensions(markup);
  root.setAttribute("width", String(Math.ceil(width)));
  root.setAttribute("height", String(Math.ceil(height)));
  root.setAttribute("preserveAspectRatio", "xMinYMin meet");
  const style = root.getAttribute("style")?.replace(/max-width\s*:[^;]+;?/gi, "").trim();
  if (style) root.setAttribute("style", style);
  else root.removeAttribute("style");
  return new XMLSerializer().serializeToString(root);
}

function getSafeExportSvg(markup: string) {
  return sanitizeMermaidSvg(prepareSvgForDownload(markup));
}

function findMermaidNodeElement(target: Element | null) {
  let current = target;
  while (current) {
    const tagName = current.tagName.toLowerCase();
    const id = current.getAttribute("id") ?? "";
    const className = current.getAttribute("class") ?? "";
    if (tagName === "g" && (className.split(/\s+/).includes("node") || id.startsWith("flowchart-"))) return current;
    current = current.parentElement;
  }
  return null;
}

function isRenderedMermaidNode(element: Element, nodeId: string) {
  const safeId = mermaidNodeId(nodeId);
  const candidates = [element.getAttribute("id"), element.getAttribute("data-id"), element.getAttribute("data-node")]
    .filter((value): value is string => Boolean(value));
  return candidates.some((value) => value === nodeId || value === safeId || value === `flowchart-${safeId}-0` || value.startsWith(`flowchart-${safeId}-`) || value.includes(`flowchart-${safeId}-`));
}

function addMermaidCollapseIndicators(markup: string, visibleGraph: AviatorFlowGraph, collapsedNodeIds: Set<string>) {
  const document = new DOMParser().parseFromString(markup, "image/svg+xml");
  const renderedNodes = Array.from(document.querySelectorAll("g.node, g[id^='flowchart-']"));
  const svgNamespace = "http://www.w3.org/2000/svg";

  visibleGraph.nodes
    .filter((node) => node.data.kind === "decision" || node.data.kind === "iteration")
    .forEach((node) => {
      const renderedNode = renderedNodes.find((element) => isRenderedMermaidNode(element, node.id));
      const labelText = renderedNode?.querySelector(".label text");
      if (!labelText) return;

      const indicator = document.createElementNS(svgNamespace, "tspan");
      indicator.setAttribute("class", "aviator-collapse-indicator");
      indicator.setAttribute("font-weight", "700");
      indicator.textContent = collapsedNodeIds.has(node.id) ? "+ " : "- ";
      const firstLine = labelText.querySelector("tspan");
      if (firstLine) firstLine.insertBefore(indicator, firstLine.firstChild);
      else labelText.insertBefore(indicator, labelText.firstChild);
    });

  return new XMLSerializer().serializeToString(document.documentElement);
}

export function MermaidDiagramViewer({ graph }: MermaidDiagramViewerProps) {
  const generatedSource = useMemo(() => graph ? buildMermaidFlowchart(graph) : "", [graph]);
  const [source, setSource] = useState(generatedSource);
  const [status, setStatus] = useState<MermaidStatus>(generatedSource ? "validating" : "idle");
  const [error, setError] = useState("");
  const [exportError, setExportError] = useState("");
  const [svg, setSvg] = useState("");
  const [zoom, setZoom] = useState(1);
  const [copied, setCopied] = useState(false);
  const [sourcePanelWidth, setSourcePanelWidth] = useState<number | null>(null);
  const [validationRequest, setValidationRequest] = useState(0);
  const [theme, setTheme] = useState<MermaidTheme>("default");
  const [selectedNodeId, setSelectedNodeId] = useState<string | undefined>();
  const [collapsedNodeIds, setCollapsedNodeIds] = useState<Set<string>>(new Set());
  const renderIdRef = useRef(0);
  const copiedTimerRef = useRef<number | null>(null);
  const mermaidGridRef = useRef<HTMLDivElement | null>(null);
  const sourcePanelRef = useRef<HTMLElement | null>(null);
  const sourceResizeRef = useRef<{ startX: number; startWidth: number; minWidth: number; maxWidth: number } | null>(null);
  const diagramCanvasRef = useRef<HTMLDivElement>(null);
  const direction = useMemo(() => source.match(/^\s*(?:flowchart|graph)\s+(TB|TD|BT|RL|LR)\b/m)?.[1] ?? "TD", [source]);
  const collapsedGraph = useMemo(
    () => graph ? collapseAviatorFlowGraph(graph, collapsedNodeIds) : null,
    [collapsedNodeIds, graph]
  );
  const diagramSource = useMemo(
    () => graph && collapsedGraph ? collapseMermaidFlowchart(source, graph, collapsedGraph) : source,
    [collapsedGraph, graph, source]
  );
  const selectedNode = graph?.nodes.find((node) => node.id === selectedNodeId);
  const selectedNodeIsVisible = Boolean(selectedNodeId && collapsedGraph?.nodes.some((node) => node.id === selectedNodeId));
  const selectedNodeIsCollapsed = Boolean(selectedNodeId && collapsedNodeIds.has(selectedNodeId));
  const canToggleSelectedNode = Boolean(
    status === "valid" && selectedNodeIsVisible && selectedNode && (selectedNode.data.kind === "decision" || selectedNode.data.kind === "iteration")
  );

  useEffect(() => () => {
    if (copiedTimerRef.current !== null) window.clearTimeout(copiedTimerRef.current);
  }, []);

  useEffect(() => {
    setSource(generatedSource);
  }, [generatedSource]);

  useEffect(() => {
    setSelectedNodeId(undefined);
    setCollapsedNodeIds(new Set());
  }, [graph]);

  useEffect(() => {
    function handlePointerMove(event: PointerEvent) {
      const resize = sourceResizeRef.current;
      if (!resize) return;
      const nextWidth = resize.startWidth + (event.clientX - resize.startX);
      setSourcePanelWidth(Math.min(Math.max(nextWidth, resize.minWidth), resize.maxWidth));
    }

    function handlePointerUp() {
      sourceResizeRef.current = null;
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
    return () => {
      handlePointerUp();
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!diagramSource) {
      setStatus("idle");
      setError("");
      setSvg("");
      return () => { cancelled = true; };
    }

    async function validateAndRender() {
      setStatus("validating");
      setError("");
      setExportError("");
      setSvg("");
      try {
        const mermaidModule = await import("mermaid");
        const mermaid = mermaidModule.default;
        mermaid.initialize({
          htmlLabels: false,
          flowchart: { htmlLabels: false, useMaxWidth: true },
          securityLevel: "strict",
          startOnLoad: false,
          theme
        });
        await mermaid.parse(diagramSource);
        const rendered = await mermaid.render(`aviator-mermaid-${renderIdRef.current++}`, diagramSource);
        if (cancelled) return;
        const sanitizedSvg = sanitizeMermaidSvg(rendered.svg);
        const normalizedSvg = normalizeMermaidSvgLabels(sanitizedSvg);
        const markedSvg = collapsedGraph ? addMermaidCollapseIndicators(normalizedSvg, collapsedGraph, collapsedNodeIds) : normalizedSvg;
        setSvg(sanitizeMermaidSvg(markedSvg));
        setStatus("valid");
      } catch (renderError) {
        if (cancelled) return;
        setStatus("invalid");
        setError(errorMessage(renderError));
      }
    }

    void validateAndRender();
    return () => { cancelled = true; };
  }, [diagramSource, theme, validationRequest]);

  useEffect(() => {
    setZoom(1);
  }, [diagramSource]);

  async function copySource() {
    if (!source) return;
    await navigator.clipboard.writeText(source);
    setCopied(true);
    if (copiedTimerRef.current !== null) window.clearTimeout(copiedTimerRef.current);
    copiedTimerRef.current = window.setTimeout(() => setCopied(false), 1400);
  }

  function downloadSource() {
    if (status !== "valid" || !source) return;
    const url = URL.createObjectURL(new Blob([source], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "aviatorscript-flow.mmd";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function scrollDiagramToStart() {
    diagramCanvasRef.current?.scrollTo({ top: 0, left: 0, behavior: "smooth" });
  }

  function fitDiagram() {
    setZoom(1);
    window.requestAnimationFrame(scrollDiagramToStart);
  }

  function toggleDirection() {
    if (!source) return;
    const nextDirection = direction === "LR" ? "TD" : "LR";
    setSource((current) => current.replace(/^(\s*(?:flowchart|graph)\s+)(?:TB|TD|BT|RL|LR)\b/m, `$1${nextDirection}`));
    setSelectedNodeId(undefined);
    setCollapsedNodeIds(new Set());
    setCopied(false);
  }

  function selectMermaidNode(event: ReactMouseEvent<HTMLDivElement>) {
    const target = event.target as Element | null;
    const nodeElement = findMermaidNodeElement(target);
    if (!nodeElement || !graph) {
      setSelectedNodeId(undefined);
      return;
    }
    const candidates = [nodeElement.getAttribute("id"), nodeElement.getAttribute("data-id"), nodeElement.getAttribute("data-node")].filter((value): value is string => Boolean(value));
    const node = graph.nodes.find((candidate) => {
      const safeId = mermaidNodeId(candidate.id);
      return candidates.some((value) => value === candidate.id || value === safeId || value === `flowchart-${safeId}-0` || value.startsWith(`flowchart-${safeId}-`) || value.includes(`flowchart-${safeId}-`));
    });
    setSelectedNodeId(node?.id);
  }

  function toggleSelectedNodeCollapse() {
    if (!canToggleSelectedNode || !selectedNodeId) return;
    setCollapsedNodeIds((current) => {
      const next = new Set(current);
      if (next.has(selectedNodeId)) next.delete(selectedNodeId);
      else next.add(selectedNodeId);
      return next;
    });
  }

  function expandAllNodes() {
    setCollapsedNodeIds(new Set());
  }

  function downloadRenderedSvg() {
    if (status !== "valid" || !svg) return;
    setExportError("");
    downloadFile("aviatorscript-mermaid.svg", getSafeExportSvg(svg), "image/svg+xml;charset=utf-8");
  }

  function downloadRenderedPng() {
    if (status !== "valid" || !svg) return;
    setExportError("");
    const safeSvg = getSafeExportSvg(svg);
    const svgUrl = URL.createObjectURL(new Blob([safeSvg], { type: "image/svg+xml;charset=utf-8" }));
    const image = new Image();
    image.onload = () => {
      const { width: svgWidth, height: svgHeight } = getSvgDimensions(safeSvg);
      const width = svgWidth || image.naturalWidth || 1200;
      const height = svgHeight || image.naturalHeight || 800;
      const scale = Math.min(2, 12000 / Math.max(width, height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(width * scale));
      canvas.height = Math.max(1, Math.round(height * scale));
      const context = canvas.getContext("2d");
      if (!context) {
        URL.revokeObjectURL(svgUrl);
        setExportError("No se pudo preparar la imagen PNG.");
        return;
      }
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      try {
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          if (blob) downloadFile("aviatorscript-mermaid.png", blob, "image/png");
          else setExportError("El navegador no pudo generar la imagen PNG.");
          URL.revokeObjectURL(svgUrl);
        }, "image/png");
      } catch {
        URL.revokeObjectURL(svgUrl);
        setExportError("El navegador bloqueo la exportacion PNG del diagrama.");
      }
    };
    image.onerror = () => {
      URL.revokeObjectURL(svgUrl);
      setExportError("No se pudo preparar el diagrama para exportarlo como PNG.");
    };
    image.crossOrigin = "anonymous";
    image.src = svgUrl;
  }

  function getSourcePanelResizeBounds() {
    const grid = mermaidGridRef.current;
    if (!grid) return undefined;
    const minWidth = 260;
    const maxWidth = Math.max(minWidth, grid.getBoundingClientRect().width - 360);
    return { minWidth, maxWidth };
  }

  function startSourcePanelResize(event: ReactPointerEvent<HTMLDivElement>) {
    if (window.matchMedia("(max-width: 760px)").matches) return;
    const panel = sourcePanelRef.current;
    const bounds = getSourcePanelResizeBounds();
    if (!panel || !bounds) return;
    sourceResizeRef.current = {
      startX: event.clientX,
      startWidth: panel.getBoundingClientRect().width,
      minWidth: bounds.minWidth,
      maxWidth: bounds.maxWidth
    };
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  function resizeSourcePanelWithKeyboard(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    const panel = sourcePanelRef.current;
    const bounds = getSourcePanelResizeBounds();
    if (!panel || !bounds) return;
    const currentWidth = sourcePanelWidth ?? panel.getBoundingClientRect().width;
    const step = event.key === "ArrowRight" ? 24 : -24;
    setSourcePanelWidth(Math.min(Math.max(currentWidth + step, bounds.minWidth), bounds.maxWidth));
    event.preventDefault();
  }

  return (
    <section aria-label="Vista Mermaid" className="aviator-mermaid-view">
      <div className="aviator-mermaid-header">
        <div>
          <span className="formula-eyebrow">ANÁLISIS ESTÁTICO</span>
          <h3><Code2 size={18} /> Vista Mermaid</h3>
          <p>Valida y visualiza el código Mermaid generado antes de descargarlo.</p>
        </div>
        <div className="aviator-mermaid-actions">
          <span className={`aviator-mermaid-status is-${status}`}>
            {status === "validating" && <RefreshCw size={14} className="aviator-spin" />}
            {status === "valid" && <CheckCircle2 size={14} />}
            {status === "invalid" && <XCircle size={14} />}
            {status === "idle" ? "Sin diagrama" : status === "validating" ? "Validando" : status === "valid" ? "Código válido" : "Código inválido"}
          </span>
          <label className="aviator-mermaid-theme-control">
            <span>Tema</span>
            <select aria-label="Tema del diagrama Mermaid" onChange={(event) => setTheme(event.target.value as MermaidTheme)} value={theme}>
              <option value="default">Claro</option>
              <option value="dark">Oscuro</option>
              <option value="neutral">Neutral</option>
              <option value="forest">Forest</option>
            </select>
          </label>
          <button aria-label="Validar código Mermaid" className="formula-icon-button" disabled={status === "validating" || !source} onClick={() => setValidationRequest((current) => current + 1)} title="Validar código Mermaid" type="button"><RefreshCw size={16} /></button>
          <button aria-label={copied ? "Código Mermaid copiado" : "Copiar código Mermaid"} className={`formula-icon-button ${copied ? "is-copied" : ""}`} disabled={!source} onClick={() => void copySource()} title={copied ? "Copiado" : "Copiar código Mermaid"} type="button">{copied ? <Check size={16} /> : <Clipboard size={16} />}</button>
          <button aria-label="Descargar código Mermaid" className="formula-icon-button" disabled={status !== "valid"} onClick={downloadSource} title={status === "valid" ? "Descargar código Mermaid" : "Descarga disponible cuando el código sea válido"} type="button"><Download size={16} /></button>
        </div>
      </div>

      {(error || exportError) && <div className="aviator-mermaid-error" role="alert"><XCircle size={16} /><span>{error || exportError}</span></div>}

      <div
        className="aviator-mermaid-grid"
        ref={mermaidGridRef}
        style={sourcePanelWidth === null ? undefined : { "--aviator-mermaid-source-width": `${sourcePanelWidth}px` } as CSSProperties}
      >
        <section aria-label="Código Mermaid generado" className="aviator-mermaid-source" ref={sourcePanelRef}>
          <div className="aviator-mermaid-section-heading">
            <strong>Código Mermaid</strong>
            <div className="aviator-mermaid-source-heading-actions">
              <span>{source ? `${source.split("\n").length} líneas` : "-"}</span>
              <button aria-label={copied ? "Código Mermaid copiado" : "Copiar código Mermaid"} className={`formula-icon-button ${copied ? "is-copied" : ""}`} disabled={!source} onClick={() => void copySource()} title={copied ? "Copiado" : "Copiar código Mermaid"} type="button">{copied ? <Check size={15} /> : <Clipboard size={15} />}</button>
            </div>
          </div>
          <div className="aviator-mermaid-source-editor-body">
            <CodeMirrorEditor
              ariaLabel="Editar código Mermaid"
              className="aviator-mermaid-source-code"
              error={error}
              format={formatCodeWhitespace}
              language="mermaid"
              onChange={(nextValue) => { setSource(nextValue); setSelectedNodeId(undefined); setCollapsedNodeIds(new Set()); setCopied(false); }}
              placeholderText="No hay un flujo disponible para generar Mermaid."
              readOnly={!generatedSource}
              value={source}
            />
          </div>
        </section>
        <div
          aria-label="Ajustar ancho de Código Mermaid y Diagrama"
          aria-orientation="vertical"
          className="aviator-mermaid-resizer"
          onKeyDown={resizeSourcePanelWithKeyboard}
          onPointerDown={startSourcePanelResize}
          role="separator"
          tabIndex={0}
          title="Arrastra para ajustar el ancho de los paneles"
        />
        <section aria-label="Diagrama Mermaid renderizado" className="aviator-mermaid-render">
          <div className="aviator-mermaid-section-heading"><strong>Diagrama</strong><span>{status === "valid" ? "Renderizado" : "Vista previa"}</span></div>
          <div className="aviator-mermaid-diagram-shell">
            <div className="aviator-mermaid-diagram-toolbar" role="toolbar" aria-label="Controles del diagrama Mermaid">
              <button aria-label="Ir al inicio del diagrama" disabled={status !== "valid"} onClick={scrollDiagramToStart} title="Ir al inicio" type="button">Inicio</button>
              <button aria-label="Ajustar diagrama" disabled={status !== "valid"} onClick={fitDiagram} title="Ajustar" type="button">Ajustar</button>
              <button aria-label={direction === "LR" ? "Cambiar a orientacion vertical" : "Cambiar a orientacion horizontal"} disabled={!source} onClick={toggleDirection} title={direction === "LR" ? "Vertical" : "Horizontal"} type="button">{direction === "LR" ? "Vertical" : "Horizontal"}</button>
              <button aria-label={selectedNodeIsCollapsed ? "Expandir nodo seleccionado" : "Contraer nodo seleccionado"} disabled={!canToggleSelectedNode} onClick={toggleSelectedNodeCollapse} title={canToggleSelectedNode ? (selectedNodeIsCollapsed ? "Mostrar el contenido de la decision o ciclo seleccionado" : "Ocultar el contenido de la decision o ciclo seleccionado") : "Haz clic en una decision o ciclo del diagrama para contraerlo"} type="button">
                {selectedNodeIsCollapsed ? <Plus size={13} /> : <Minus size={13} />}
                {selectedNodeIsCollapsed ? "Expandir" : "Contraer"}
              </button>
              <button aria-label="Expandir todo" disabled={status !== "valid" || collapsedNodeIds.size === 0} onClick={expandAllNodes} title={collapsedNodeIds.size ? "Mostrar todas las ramas y ciclos contraidos" : "No hay ramas contraidas"} type="button">Expandir todo</button>
              <span aria-live="polite" className="aviator-mermaid-selection" title={selectedNode?.data.label}>{selectedNode && selectedNodeIsVisible ? `Seleccionado: ${selectedNode.data.label}` : "Selecciona una decision o ciclo"}</span>
              <button aria-label="Descargar diagrama SVG" disabled={status !== "valid"} onClick={downloadRenderedSvg} title="Descargar SVG" type="button">SVG</button>
              <button aria-label="Descargar diagrama PNG" disabled={status !== "valid"} onClick={downloadRenderedPng} title="Descargar PNG" type="button">PNG</button>
            </div>
            <div className="aviator-mermaid-canvas-shell">
              {status === "valid" && svg && <div className="aviator-mermaid-zoom-controls" aria-label="Controles de zoom del diagrama">
                <button aria-label="Acercar diagrama" className="formula-icon-button" disabled={zoom >= MAX_ZOOM} onClick={() => setZoom((current) => Math.min(MAX_ZOOM, current + ZOOM_STEP))} title="Acercar" type="button"><Plus size={16} /></button>
                <button aria-label="Alejar diagrama" className="formula-icon-button" disabled={zoom <= MIN_ZOOM} onClick={() => setZoom((current) => Math.max(MIN_ZOOM, current - ZOOM_STEP))} title="Alejar" type="button"><Minus size={16} /></button>
                <button aria-label="Ajustar diagrama" className="formula-icon-button" disabled={zoom === 1} onClick={() => setZoom(1)} title="Ajustar" type="button"><Maximize2 size={15} /></button>
              </div>}
              <div className="aviator-mermaid-canvas" ref={diagramCanvasRef}>
                {status === "valid" && svg ? <>
                  <div className="aviator-mermaid-diagram" onClick={selectMermaidNode} style={{ width: `${zoom * 100}%` }}><div dangerouslySetInnerHTML={{ __html: svg }} /></div>
                </> : status === "invalid" ? <div className="aviator-mermaid-empty"><XCircle size={28} /><strong>No se puede renderizar</strong><span>Corrige el código Mermaid para ver el diagrama.</span></div> : <div className="aviator-mermaid-empty"><RefreshCw size={28} className={status === "validating" ? "aviator-spin" : ""} /><span>{status === "validating" ? "Validando y renderizando..." : "Genera una fórmula para ver el diagrama."}</span></div>}
              </div>
            </div>
          </div>
        </section>
      </div>
    </section>
  );
}
