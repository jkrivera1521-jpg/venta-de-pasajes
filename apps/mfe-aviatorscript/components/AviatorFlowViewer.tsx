"use client";

import { Background, Controls, Handle, MarkerType, MiniMap, Panel, Position, ReactFlow, ReactFlowProvider, useReactFlow, type NodeProps } from "@xyflow/react";
import { graphlib, layout } from "@dagrejs/dagre";
import { useCallback, useEffect, useMemo, useState } from "react";
import { collapseAviatorFlowGraph, type AviatorFlowEdge, type AviatorFlowGraph, type AviatorFlowNode, type AviatorFlowNodeData } from "../lib/visualization";

type AviatorFlowViewerProps = {
  centerRequest?: { nodeId: string; requestId: number; behavior?: "center" | "preserve" };
  graph: AviatorFlowGraph;
  hoveredRoute?: { sourceId: string; targetId: string; nodeId: string };
  onFocusNode: (nodeId: string) => void;
  selectedNodeId?: string;
  onSelectNode: (node: AviatorFlowNode) => void;
};

const nodeTypes = { "aviator-flow-node": AviatorFlowNodeView };

function dimensions(kind: AviatorFlowNodeData["kind"]) {
  if (kind === "start" || kind === "end") return { width: 150, height: 56 };
  if (kind === "decision" || kind === "iteration") return { width: 280, height: 88 };
  return { width: 300, height: 76 };
}

function layoutGraph(graph: AviatorFlowGraph, direction: "TB" | "LR" = "TB") {
  const dagreGraph = new graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ rankdir: direction, ranksep: 72, nodesep: 38, marginx: 30, marginy: 30 });
  graph.nodes.forEach((node) => {
    const size = dimensions(node.data.kind);
    dagreGraph.setNode(node.id, size);
  });
  graph.edges.forEach((edge) => dagreGraph.setEdge(edge.source, edge.target));
  layout(dagreGraph);
  return graph.nodes.map((node) => {
    const size = dimensions(node.data.kind);
    const position = dagreGraph.node(node.id);
    return {
      ...node,
      position: { x: position.x - size.width / 2, y: position.y - size.height / 2 },
      sourcePosition: direction === "TB" ? Position.Bottom : Position.Right,
      targetPosition: direction === "TB" ? Position.Top : Position.Left,
      width: size.width,
      height: size.height,
      style: { width: size.width, height: size.height }
    };
  });
}

function nodeClass(kind: AviatorFlowNodeData["kind"]) {
  return `aviator-flow-node aviator-flow-node-${kind}`;
}

function AviatorFlowNodeView({ data, id, selected }: NodeProps<AviatorFlowNode>) {
  const handlePosition = data.kind === "start" ? Position.Bottom : data.kind === "end" ? Position.Top : Position.Bottom;
  return (
    <div className={`${nodeClass(data.kind)} ${selected ? "is-selected" : ""} ${data.marked ? "is-start-marked" : ""} ${data.synthetic ? "is-synthetic" : ""}`} data-aviator-flow-node-id={id}>
      {data.kind !== "start" && <Handle className="aviator-flow-handle" position={Position.Top} type="target" />}
      <div className="aviator-flow-node-heading">
        <span className="aviator-flow-node-kind">{data.instruction}</span>
        <span className="aviator-flow-node-range">L{data.source.startLine}</span>
      </div>
      <strong>{data.label}</strong>
      {data.kind !== "start" && data.kind !== "end" && data.sourceCode && (
        <code>{data.sourceCode.split("\n")[0].trim()}</code>
      )}
      {data.kind !== "end" && <Handle className="aviator-flow-handle" position={handlePosition} type="source" />}
    </div>
  );
}

function downloadFile(filename: string, content: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  window.setTimeout(() => {
    link.remove();
    URL.revokeObjectURL(url);
  }, 1000);
}

function escapeXml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&apos;"
  })[character] ?? character);
}

function svgLines(value: string, maxLength = 48, maxLines = 2) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return [];
  const words = normalized.split(" ");
  const lines: string[] = [];
  let current = "";
  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word;
    if (current && next.length > maxLength && lines.length < maxLines - 1) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  });
  if (current) lines.push(current);
  if (lines.length > maxLines) lines.length = maxLines;
  const last = lines.length - 1;
  if (lines[last].length > maxLength) lines[last] = `${lines[last].slice(0, maxLength - 3)}...`;
  return lines;
}

function exportNodeColor(kind: AviatorFlowNodeData["kind"]) {
  if (kind === "decision") return { fill: "#7352b8", stroke: "#53338f" };
  if (kind === "iteration") return { fill: "#c98713", stroke: "#9a6208" };
  if (kind === "exception") return { fill: "#d24738", stroke: "#a92f25" };
  if (kind === "return") return { fill: "#087f78", stroke: "#055f5a" };
  if (kind === "function") return { fill: "#277f98", stroke: "#146176" };
  if (kind === "start" || kind === "end") return { fill: "#3774b7", stroke: "#245486" };
  return { fill: "#287f69", stroke: "#17604e" };
}

type ExportViewport = { x: number; y: number; width: number; height: number };
type ExportSvgOptions = { outputWidth?: number; scale?: number; viewport?: ExportViewport };
type ExportSvgResult = { markup: string; width: number; height: number; fullWidth: number; fullHeight: number; viewport: ExportViewport };

function buildExportSvg(
  graph: AviatorFlowGraph,
  nodes: AviatorFlowNode[],
  direction: "TB" | "LR",
  selectedNodeId?: string,
  options: ExportSvgOptions = {}
): ExportSvgResult {
  const padding = 56;
  const sizes = new Map(nodes.map((node) => [node.id, dimensions(node.data.kind)]));
  const bounds = nodes.reduce((current, node) => {
    const size = sizes.get(node.id) ?? dimensions(node.data.kind);
    return {
      minX: Math.min(current.minX, node.position.x),
      minY: Math.min(current.minY, node.position.y),
      maxX: Math.max(current.maxX, node.position.x + size.width),
      maxY: Math.max(current.maxY, node.position.y + size.height)
    };
  }, { minX: 0, minY: 0, maxX: 800, maxY: 600 });
   const fullWidth = Math.ceil(bounds.maxX - bounds.minX + padding * 2);
   const fullHeight = Math.ceil(bounds.maxY - bounds.minY + padding * 2);
  const offsetX = padding - bounds.minX;
  const offsetY = padding - bounds.minY;
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const point = (node: AviatorFlowNode, side: "source" | "target") => {
    const size = sizes.get(node.id) ?? dimensions(node.data.kind);
    const x = node.position.x + offsetX;
    const y = node.position.y + offsetY;
    if (direction === "TB") return { x: x + size.width / 2, y: side === "source" ? y + size.height : y };
    return { x: side === "source" ? x + size.width : x, y: y + size.height / 2 };
  };
  const edgeMarkup = graph.edges.flatMap((edge) => {
    const source = nodeById.get(edge.source);
    const target = nodeById.get(edge.target);
    if (!source || !target) return [];
    const from = point(source, "source");
    const to = point(target, "target");
    const curve = direction === "TB"
      ? `M ${from.x} ${from.y} C ${from.x} ${from.y + 34}, ${to.x} ${to.y - 34}, ${to.x} ${to.y}`
      : `M ${from.x} ${from.y} C ${from.x + 34} ${from.y}, ${to.x - 34} ${to.y}, ${to.x} ${to.y}`;
    const color = edge.label === "false" ? "#b44a4a" : "#52718f";
    const middleX = (from.x + to.x) / 2;
    const middleY = (from.y + to.y) / 2;
    return [
      `<path d="${curve}" fill="none" stroke="${color}" stroke-width="2" marker-end="url(#${edge.label === "false" ? "arrow-false" : "arrow-default"})"/>`,
      edge.label ? `<text x="${middleX}" y="${middleY - 6}" text-anchor="middle" class="edge-label">${escapeXml(String(edge.label))}</text>` : ""
    ];
  }).join("");
  const nodeMarkup = nodes.map((node) => {
    const size = sizes.get(node.id) ?? dimensions(node.data.kind);
    const x = node.position.x + offsetX;
    const y = node.position.y + offsetY;
    const colors = exportNodeColor(node.data.kind);
    const selected = node.id === selectedNodeId;
    const labelLines = svgLines(node.data.label);
    const sourceLine = node.data.sourceCode.split("\n")[0].trim();
    const sourceLines = node.data.kind === "start" || node.data.kind === "end" ? [] : svgLines(sourceLine, 46, 1);
    const labelMarkup = labelLines.map((line, index) => `<text x="${x + 16}" y="${y + 43 + index * 17}" class="node-label">${escapeXml(line)}</text>`).join("");
    const sourceMarkup = sourceLines.map((line, index) => `<text x="${x + 16}" y="${y + size.height - 12 + index * 14}" class="node-source">${escapeXml(line)}</text>`).join("");
    return `<g><rect x="${x}" y="${y}" width="${size.width}" height="${size.height}" rx="10" fill="${colors.fill}" stroke="${selected ? "#f0bd3c" : colors.stroke}" stroke-width="${selected ? 4 : 2}"${node.data.synthetic ? " stroke-dasharray=\"6 4\"" : ""}/><text x="${x + 16}" y="${y + 20}" class="node-kind">${escapeXml(node.data.instruction)}</text><text x="${x + size.width - 14}" y="${y + 20}" text-anchor="end" class="node-range">L${node.data.source.startLine}</text>${labelMarkup}${sourceMarkup}</g>`;
  }).join("");
  const viewport = options.viewport ?? { x: 0, y: 0, width: fullWidth, height: fullHeight };
  const baseWidth = Math.max(1, options.outputWidth ?? fullWidth);
  const scale = Math.max(1, options.scale ?? 1);
  const visibleWidth = Math.max(1, Math.ceil(baseWidth * scale));
  const visibleHeight = Math.max(1, Math.ceil(viewport.height * (baseWidth / viewport.width) * scale));
  const markup = `<svg xmlns="http://www.w3.org/2000/svg" width="${visibleWidth}" height="${visibleHeight}" viewBox="${viewport.x} ${viewport.y} ${viewport.width} ${viewport.height}" preserveAspectRatio="xMinYMin meet"><defs><marker id="arrow-default" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L0,6 L9,3 z" fill="#52718f"/></marker><marker id="arrow-false" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L0,6 L9,3 z" fill="#b44a4a"/></marker><style>.node-kind{font:600 11px Arial,sans-serif;fill:#dbeaf8}.node-range{font:600 11px Arial,sans-serif;fill:#dbeaf8}.node-label{font:700 14px Arial,sans-serif;fill:#fff}.node-source{font:12px Consolas,monospace;fill:#e7f2fb}.edge-label{font:600 11px Arial,sans-serif;fill:#38556d}</style></defs><rect x="${viewport.x}" y="${viewport.y}" width="${viewport.width}" height="${viewport.height}" fill="#f8fbfe"/>${edgeMarkup}${nodeMarkup}</svg>`;
  return { markup, width: visibleWidth, height: visibleHeight, fullWidth, fullHeight, viewport };
}

type ExportFormat = "svg" | "png";
type ExportScope = "complete" | "pages" | "selection";
type ExportScale = 1 | 2 | 3;

const EXPORT_MAX_WIDTH = 6000;
const EXPORT_MAX_PAGE_HEIGHT = 4000;
const EXPORT_MAX_CANVAS_PIXELS = 80_000_000;

function boundedDimension(value: string, fallback: number, maximum: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.min(Math.round(parsed), maximum);
}

function exportPageViewports(fullWidth: number, fullHeight: number, outputWidth: number, pageHeight: number) {
  const pixelsPerViewBoxUnit = outputWidth / fullWidth;
  const pageHeightInViewBox = Math.max(1, pageHeight / pixelsPerViewBoxUnit);
  const pages: ExportViewport[] = [];
  for (let y = 0; y < fullHeight; y += pageHeightInViewBox) {
    pages.push({ x: 0, y, width: fullWidth, height: Math.min(pageHeightInViewBox, fullHeight - y) });
  }
  return pages.length ? pages : [{ x: 0, y: 0, width: fullWidth, height: fullHeight }];
}

function exportGraphSelection(graph: AviatorFlowGraph, nodes: AviatorFlowNode[], selectedNodeId?: string) {
  if (!selectedNodeId) return { graph, nodes };
  const selectedNodes = nodes.filter((node) => node.id === selectedNodeId);
  if (!selectedNodes.length) return { graph, nodes };
  const selectedIds = new Set(selectedNodes.map((node) => node.id));
  return {
    graph: { ...graph, nodes: graph.nodes.filter((node) => selectedIds.has(node.id)), edges: graph.edges.filter((edge) => selectedIds.has(edge.source) && selectedIds.has(edge.target)) },
    nodes: selectedNodes
  };
}

function downloadPng(svg: ExportSvgResult, filename: string) {
  return new Promise<void>((resolve, reject) => {
    if (svg.width * svg.height > EXPORT_MAX_CANVAS_PIXELS) {
      reject(new Error("La exportacion PNG supera el limite de memoria del navegador. Usa Por paginas o reduce el ancho/resolucion."));
      return;
    }
    const image = new Image();
    const svgUrl = URL.createObjectURL(new Blob([svg.markup], { type: "image/svg+xml;charset=utf-8" }));
    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = svg.width;
        canvas.height = svg.height;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("El navegador no pudo preparar el lienzo PNG.");
        context.fillStyle = "#f8fbfe";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0);
        canvas.toBlob((blob) => {
          URL.revokeObjectURL(svgUrl);
          if (!blob) {
            reject(new Error("El navegador no pudo generar el archivo PNG."));
            return;
          }
          downloadFile(filename, blob, "image/png");
          resolve();
        }, "image/png");
      } catch (error) {
        URL.revokeObjectURL(svgUrl);
        reject(error instanceof Error ? error : new Error("No se pudo generar el archivo PNG."));
      }
    };
    image.onerror = () => {
      URL.revokeObjectURL(svgUrl);
      reject(new Error("No se pudo rasterizar el SVG para exportarlo como PNG."));
    };
    image.src = svgUrl;
  });
}

function FlowCanvas({ centerRequest, graph, hoveredRoute, onFocusNode, selectedNodeId, onSelectNode }: AviatorFlowViewerProps) {
  const [direction, setDirection] = useState<"TB" | "LR">("TB");
  const [instanceReady, setInstanceReady] = useState(false);
  const [collapsedNodeIds, setCollapsedNodeIds] = useState<Set<string>>(new Set());
  const [markedNodeId, setMarkedNodeId] = useState<string>();
  const [exportPanelOpen, setExportPanelOpen] = useState(false);
  const [exportScope, setExportScope] = useState<ExportScope>("complete");
  const [exportWidth, setExportWidth] = useState("1600");
  const [exportPageHeight, setExportPageHeight] = useState("1600");
  const [exportScale, setExportScale] = useState<ExportScale>(1);
  const [exportBusy, setExportBusy] = useState(false);
  const [exportMessage, setExportMessage] = useState("");
  const { fitView, getZoom, setCenter } = useReactFlow();
  const renderGraph = useMemo(() => collapseAviatorFlowGraph(graph, collapsedNodeIds), [collapsedNodeIds, graph]);
  const nodes = useMemo(
    () => layoutGraph(renderGraph, direction).map((node) => ({
      ...node,
      data: { ...node.data, marked: node.id === markedNodeId },
      selected: node.id === selectedNodeId
    })),
    [direction, markedNodeId, renderGraph, selectedNodeId]
  );
  const edges = useMemo(() => renderGraph.edges.map((edge) => ({
    ...edge,
    markerEnd: { type: MarkerType.ArrowClosed, color: edge.label === "false" ? "#b44a4a" : "#52718f" },
    className: [
      selectedNodeId && (edge.source === selectedNodeId || edge.target === selectedNodeId) ? "is-highlighted" : "",
      hoveredRoute && edge.source === hoveredRoute.sourceId && edge.target === hoveredRoute.targetId ? "is-route-highlighted" : ""
    ].filter(Boolean).join(" ")
  })), [hoveredRoute, renderGraph.edges, selectedNodeId]);

  useEffect(() => {
    if (instanceReady) window.requestAnimationFrame(() => fitView({ padding: 0.18, duration: 240 }));
  }, [direction, fitView, renderGraph.nodes.length, instanceReady]);

  useEffect(() => {
    if (!instanceReady || !centerRequest) return;
    const target = nodes.find((node) => node.id === centerRequest.nodeId);
    if (!target) return;
    const size = dimensions(target.data.kind);
    if (centerRequest.behavior === "preserve") return;
    let scrollTimer: number | undefined;
    const frame = window.requestAnimationFrame(() => {
      setCenter(target.position.x + size.width / 2, target.position.y + size.height / 2, { duration: 360, zoom: getZoom() });
      scrollTimer = window.setTimeout(() => {
        const targetElement = Array.from(document.querySelectorAll<HTMLElement>("[data-aviator-flow-node-id]")).find(
          (element) => element.dataset.aviatorFlowNodeId === centerRequest.nodeId
        );
        if (!targetElement) return;
        const bounds = targetElement.getBoundingClientRect();
        const isVisible = bounds.top >= 0 && bounds.bottom <= window.innerHeight;
        if (!isVisible) {
          targetElement.scrollIntoView({ behavior: "auto", block: "center", inline: "nearest" });
        }
      }, 380);
    });
    return () => {
      window.cancelAnimationFrame(frame);
      if (scrollTimer !== undefined) window.clearTimeout(scrollTimer);
    };
  }, [centerRequest, getZoom, instanceReady, nodes, setCenter]);

  useEffect(() => {
    if (!exportPanelOpen) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setExportPanelOpen(false);
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [exportPanelOpen]);

  const exportDiagram = useCallback(async (format: ExportFormat) => {
    if (exportBusy || !nodes.length) return;
    setExportBusy(true);
    setExportMessage("");
    try {
      const source = exportScope === "selection"
        ? exportGraphSelection(renderGraph, nodes, selectedNodeId)
        : { graph: renderGraph, nodes };
      const base = buildExportSvg(source.graph, source.nodes, direction, selectedNodeId, { outputWidth: 1 });
      const requestedWidth = boundedDimension(exportWidth, 1600, EXPORT_MAX_WIDTH);
      const outputWidth = requestedWidth || base.fullWidth;
      const pageHeight = boundedDimension(exportPageHeight, 1600, EXPORT_MAX_PAGE_HEIGHT) || 1600;
      const viewports = exportScope === "pages"
        ? exportPageViewports(base.fullWidth, base.fullHeight, outputWidth, pageHeight)
        : [base.viewport];
      const exports = viewports.map((viewport) => buildExportSvg(
        source.graph,
        source.nodes,
        direction,
        exportScope === "selection" ? selectedNodeId : undefined,
        { outputWidth, scale: exportScale, viewport }
      ));
      const suffix = exportScope === "pages" ? `-${exports.length} paginas` : exportScope === "selection" ? "-seleccion" : "-completo";
      for (const [index, item] of exports.entries()) {
        const pageSuffix = exportScope === "pages" ? `-pagina-${String(index + 1).padStart(2, "0")}` : "";
        const filename = `aviatorscript-flow${suffix}${pageSuffix}`;
        if (format === "svg") {
          downloadFile(`${filename}.svg`, item.markup, "image/svg+xml;charset=utf-8");
        } else {
          await downloadPng(item, `${filename}.png`);
        }
        if (exports.length > 1) await new Promise<void>((resolve) => window.setTimeout(resolve, 80));
      }
      setExportMessage(`${format.toUpperCase()} generado${exports.length > 1 ? ` en ${exports.length} archivos` : ""}.`);
    } catch (error) {
      setExportMessage(error instanceof Error ? error.message : "No se pudo exportar el diagrama.");
    } finally {
      setExportBusy(false);
    }
  }, [direction, exportBusy, exportPageHeight, exportScale, exportScope, exportWidth, nodes, renderGraph, selectedNodeId]);

  return (
    <div className="aviator-flow-canvas">
      <ReactFlow
        edges={edges}
        fitView
        fitViewOptions={{ padding: 0.18 }}
        nodes={nodes}
        nodeTypes={nodeTypes}
        onInit={() => setInstanceReady(true)}
        onNodeClick={(_, node) => {
          setMarkedNodeId(undefined);
          onSelectNode(node as AviatorFlowNode);
        }}
        nodesConnectable={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#d8e6f2" gap={20} size={1} />
        <Controls showInteractive={false} />
        <MiniMap
          nodeColor={(node) => {
            const kind = (node.data as AviatorFlowNodeData).kind;
            return kind === "decision" ? "#7352b8" : kind === "iteration" ? "#c98713" : kind === "exception" ? "#d24738" : kind === "return" ? "#087f78" : "#3774b7";
          }}
        />
        <Panel className="aviator-flow-toolbar" position="top-left">
          <button
            aria-label="Ir al inicio del flujo"
            disabled={!nodes.some((node) => node.data.kind === "start")}
            onClick={() => {
              const startNode = nodes.find((node) => node.data.kind === "start");
              if (!startNode) return;
              setMarkedNodeId(startNode.id);
              onFocusNode(startNode.id);
            }}
            title="Ir al primer bloque del flujo"
            type="button"
          >Inicio</button>
          <button onClick={() => fitView({ padding: 0.18, duration: 240 })} title="Ajustar todo el flujo al area visible" type="button">Ajustar</button>
          <button onClick={() => setDirection((current) => current === "TB" ? "LR" : "TB")} title="Cambiar la orientacion entre horizontal y vertical" type="button">{direction === "TB" ? "Horizontal" : "Vertical"}</button>
          <button disabled={!selectedNodeId || !graph.nodes.some((node) => node.id === selectedNodeId && (node.data.kind === "decision" || node.data.kind === "iteration"))} onClick={() => selectedNodeId && setCollapsedNodeIds((current) => new Set(current).add(selectedNodeId))} title="Contraer la rama del nodo seleccionado" type="button">Contraer</button>
          <button disabled={!collapsedNodeIds.size} onClick={() => setCollapsedNodeIds(new Set())} title="Expandir todas las ramas contraidas" type="button">Expandir todo</button>
          <div className="aviator-flow-export">
            <button aria-expanded={exportPanelOpen} onClick={() => { setExportPanelOpen((current) => !current); setExportMessage(""); }} title="Configurar la exportacion completa, por paginas, en alta resolucion o solo de la seleccion" type="button">Exportar</button>
            {exportPanelOpen && <div aria-label="Opciones de exportacion" className="aviator-flow-export-menu" role="dialog">
              <strong>Exportar diagrama</strong>
              <label>Contenido
                <select onChange={(event) => setExportScope(event.target.value as ExportScope)} value={exportScope}>
                  <option value="complete">Flujo completo</option>
                  <option disabled={!selectedNodeId} value="selection">Solo nodo seleccionado</option>
                  <option value="pages">Por paginas</option>
                </select>
              </label>
              <label>Ancho de salida (px)
                <input aria-label="Ancho de salida en pixeles" max={EXPORT_MAX_WIDTH} min="0" onChange={(event) => setExportWidth(event.target.value)} step="100" type="number" value={exportWidth} />
                <small>0 usa el ancho natural del flujo.</small>
              </label>
              {exportScope === "pages" && <label>Alto de pagina (px)
                <input aria-label="Alto de pagina en pixeles" max={EXPORT_MAX_PAGE_HEIGHT} min="400" onChange={(event) => setExportPageHeight(event.target.value)} step="100" type="number" value={exportPageHeight} />
                <small>Genera un archivo por pagina para evitar diagramas interminables.</small>
              </label>}
              <label>Resolucion
                <select onChange={(event) => setExportScale(Number(event.target.value) as ExportScale)} value={exportScale}>
                  <option value="1">Estandar (1x)</option>
                  <option value="2">Alta (2x)</option>
                  <option value="3">Maxima (3x)</option>
                </select>
              </label>
              <div className="aviator-flow-export-actions">
                <button disabled={exportBusy || (exportScope === "selection" && !selectedNodeId)} onClick={() => void exportDiagram("svg")} title="Descargar el diagrama como SVG vectorial" type="button">{exportBusy ? "Generando..." : "SVG"}</button>
                <button disabled={exportBusy || (exportScope === "selection" && !selectedNodeId)} onClick={() => void exportDiagram("png")} title="Descargar el diagrama como PNG rasterizado" type="button">{exportBusy ? "Generando..." : "PNG"}</button>
              </div>
              {exportMessage && <p className="aviator-flow-export-message" role="status">{exportMessage}</p>}
            </div>}
          </div>
        </Panel>
      </ReactFlow>
    </div>
  );
}

export function AviatorFlowViewer(props: AviatorFlowViewerProps) {
  return (
    <ReactFlowProvider>
      <FlowCanvas {...props} />
    </ReactFlowProvider>
  );
}
