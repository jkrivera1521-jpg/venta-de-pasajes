"use client";

import { Background, Controls, Handle, MarkerType, MiniMap, Panel, Position, ReactFlow, ReactFlowProvider, useReactFlow, type NodeProps } from "@xyflow/react";
import { graphlib, layout } from "@dagrejs/dagre";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { AviatorFlowEdge, AviatorFlowGraph, AviatorFlowNode, AviatorFlowNodeData } from "../lib/visualization";

type AviatorFlowViewerProps = {
  centerRequest?: { nodeId: string; requestId: number; behavior?: "center" | "preserve" };
  graph: AviatorFlowGraph;
  hoveredRoute?: { sourceId: string; targetId: string; nodeId: string };
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
      style: { width: size.width }
    };
  });
}

function collapsedGraph(graph: AviatorFlowGraph, collapsedIds: Set<string>): AviatorFlowGraph {
  if (!collapsedIds.size) return graph;
  const outgoing = new Map<string, string[]>();
  graph.edges.forEach((edge) => outgoing.set(edge.source, [...(outgoing.get(edge.source) ?? []), edge.target]));
  const hidden = new Set<string>();
  const boundaries = new Map<string, Set<string>>();

  collapsedIds.forEach((rootId) => {
    const root = graph.nodes.find((node) => node.id === rootId);
    if (!root) return;
    const seen = new Set<string>([rootId]);
    const queue = [...(outgoing.get(rootId) ?? [])];
    const rootBoundaries = new Set<string>();
    while (queue.length) {
      const currentId = queue.shift()!;
      if (seen.has(currentId)) continue;
      seen.add(currentId);
      const current = graph.nodes.find((node) => node.id === currentId);
      if (!current || current.data.synthetic || current.data.kind === "end") {
        if (current) rootBoundaries.add(currentId);
        continue;
      }
      hidden.add(currentId);
      queue.push(...(outgoing.get(currentId) ?? []));
    }
    hidden.delete(rootId);
    boundaries.set(rootId, rootBoundaries);
  });

  const visibleNodes = graph.nodes.filter((node) => !hidden.has(node.id));
  const visibleNodeIds = new Set(visibleNodes.map((node) => node.id));
  const visibleEdges = graph.edges.filter((edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target));
  boundaries.forEach((targets, rootId) => targets.forEach((targetId) => {
    if (!visibleNodeIds.has(rootId) || !visibleNodeIds.has(targetId)) return;
    if (visibleEdges.some((edge) => edge.source === rootId && edge.target === targetId)) return;
    visibleEdges.push({
      id: `collapsed-${rootId}-${targetId}`,
      source: rootId,
      target: targetId,
      type: "aviator-flow-edge",
      label: "contenido oculto"
    });
  }));
  return { ...graph, nodes: visibleNodes, edges: visibleEdges };
}

function nodeClass(kind: AviatorFlowNodeData["kind"]) {
  return `aviator-flow-node aviator-flow-node-${kind}`;
}

function AviatorFlowNodeView({ data, id, selected }: NodeProps<AviatorFlowNode>) {
  const handlePosition = data.kind === "start" ? Position.Bottom : data.kind === "end" ? Position.Top : Position.Bottom;
  return (
    <div className={`${nodeClass(data.kind)} ${selected ? "is-selected" : ""} ${data.synthetic ? "is-synthetic" : ""}`} data-aviator-flow-node-id={id}>
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

type ExportSvgResult = { markup: string; width: number; height: number };

function buildExportSvg(
  graph: AviatorFlowGraph,
  nodes: AviatorFlowNode[],
  direction: "TB" | "LR",
  selectedNodeId?: string
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
  const width = Math.ceil(bounds.maxX - bounds.minX + padding * 2);
  const height = Math.ceil(bounds.maxY - bounds.minY + padding * 2);
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
  const markup = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs><marker id="arrow-default" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L0,6 L9,3 z" fill="#52718f"/></marker><marker id="arrow-false" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L0,6 L9,3 z" fill="#b44a4a"/></marker><style>.node-kind{font:600 11px Arial,sans-serif;fill:#dbeaf8}.node-range{font:600 11px Arial,sans-serif;fill:#dbeaf8}.node-label{font:700 14px Arial,sans-serif;fill:#fff}.node-source{font:12px Consolas,monospace;fill:#e7f2fb}.edge-label{font:600 11px Arial,sans-serif;fill:#38556d}</style></defs><rect width="100%" height="100%" fill="#f8fbfe"/>${edgeMarkup}${nodeMarkup}</svg>`;
  return { markup, width, height };
}

function graphMermaid(graph: AviatorFlowGraph) {
  const lines = ["flowchart TD"];
  graph.nodes.forEach((node) => {
    const label = node.data.label.replace(/[\[\]{}()]/g, "");
    const shape = node.data.kind === "decision" ? `{"${label}"}`
      : node.data.kind === "start" || node.data.kind === "end" ? `(["${label}"])`
        : node.data.kind === "iteration" ? `{{"${label}"}}` : `["${label}"]`;
    lines.push(`  ${node.id.replace(/[^A-Za-z0-9_]/g, "_")}${shape}`);
  });
  graph.edges.forEach((edge) => {
    const label = edge.label ? `|${String(edge.label).replace(/[|]/g, " ")}|` : "";
    lines.push(`  ${edge.source.replace(/[^A-Za-z0-9_]/g, "_")} -->${label} ${edge.target.replace(/[^A-Za-z0-9_]/g, "_")}`);
  });
  return lines.join("\n");
}

function FlowCanvas({ centerRequest, graph, hoveredRoute, selectedNodeId, onSelectNode }: AviatorFlowViewerProps) {
  const [direction, setDirection] = useState<"TB" | "LR">("TB");
  const [instanceReady, setInstanceReady] = useState(false);
  const [collapsedNodeIds, setCollapsedNodeIds] = useState<Set<string>>(new Set());
  const { fitView, getZoom, setCenter } = useReactFlow();
  const renderGraph = useMemo(() => collapsedGraph(graph, collapsedNodeIds), [collapsedNodeIds, graph]);
  const nodes = useMemo(
    () => layoutGraph(renderGraph, direction).map((node) => ({
      ...node,
      selected: node.id === selectedNodeId
    })),
    [direction, renderGraph, selectedNodeId]
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

  const exportSvg = useCallback(() => {
    const svg = buildExportSvg(renderGraph, nodes, direction, selectedNodeId);
    downloadFile("aviatorscript-flow.svg", svg.markup, "image/svg+xml;charset=utf-8");
  }, [direction, nodes, renderGraph, selectedNodeId]);

  const exportPng = useCallback(() => {
    const svg = buildExportSvg(renderGraph, nodes, direction, selectedNodeId);
    const image = new Image();
    const svgUrl = URL.createObjectURL(new Blob([svg.markup], { type: "image/svg+xml;charset=utf-8" }));
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = svg.width;
      canvas.height = svg.height;
      const context = canvas.getContext("2d");
      if (!context) {
        URL.revokeObjectURL(svgUrl);
        return;
      }
      context.fillStyle = "#f8fbfe";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0);
      canvas.toBlob((blob) => blob && downloadFile("aviatorscript-flow.png", blob, "image/png"));
      URL.revokeObjectURL(svgUrl);
    };
    image.onerror = () => URL.revokeObjectURL(svgUrl);
    image.src = svgUrl;
  }, [direction, nodes, renderGraph, selectedNodeId]);

  return (
    <div className="aviator-flow-canvas">
      <ReactFlow
        edges={edges}
        fitView
        fitViewOptions={{ padding: 0.18 }}
        nodes={nodes}
        nodeTypes={nodeTypes}
        onInit={() => setInstanceReady(true)}
        onNodeClick={(_, node) => onSelectNode(node as AviatorFlowNode)}
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
          <button onClick={() => fitView({ padding: 0.18, duration: 240 })} type="button">Ajustar</button>
          <button onClick={() => setDirection((current) => current === "TB" ? "LR" : "TB")} type="button">{direction === "TB" ? "Horizontal" : "Vertical"}</button>
          <button disabled={!selectedNodeId || !graph.nodes.some((node) => node.id === selectedNodeId && (node.data.kind === "decision" || node.data.kind === "iteration"))} onClick={() => selectedNodeId && setCollapsedNodeIds((current) => new Set(current).add(selectedNodeId))} type="button">Contraer</button>
          <button disabled={!collapsedNodeIds.size} onClick={() => setCollapsedNodeIds(new Set())} type="button">Expandir todo</button>
          <button onClick={exportSvg} type="button">SVG</button>
          <button onClick={exportPng} type="button">PNG</button>
          <button onClick={() => downloadFile("aviatorscript-flow.mmd", graphMermaid(renderGraph), "text/plain") } type="button">Mermaid</button>
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
