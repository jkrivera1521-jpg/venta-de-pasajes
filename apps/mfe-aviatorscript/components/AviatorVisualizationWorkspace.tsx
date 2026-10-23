"use client";

import { CheckCircle2, Code2, GitBranch, LoaderCircle } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { AviatorFlowGraph, AviatorFlowNode } from "../lib/visualization";
import { AviatorFlowViewer } from "./AviatorFlowViewer";
import { AviatorNodeInspector } from "./AviatorNodeInspector";
import { MermaidDiagramViewer } from "./MermaidDiagramViewer";

type AviatorVisualizationWorkspaceProps = {
  focusRequest?: { nodeId: string; requestId: number };
  graph: AviatorFlowGraph | null;
  loading: boolean;
  error: string;
  mode?: "interactive" | "mermaid";
  selectedNodeId?: string;
  onSelectNode: (node: AviatorFlowNode | undefined) => void;
  onSelectRelated: (nodeId: string) => void;
};

export function AviatorVisualizationWorkspace({
  focusRequest,
  graph,
  loading,
  error,
  mode = "interactive",
  selectedNodeId,
  onSelectNode,
  onSelectRelated
}: AviatorVisualizationWorkspaceProps) {
  const hoveredNodeRef = useRef<HTMLElement | null>(null);
  const centerRequestId = useRef(0);
  const [hoveredRoute, setHoveredRoute] = useState<{ sourceId: string; targetId: string; nodeId: string }>();
  const [centerRequest, setCenterRequest] = useState<{ nodeId: string; requestId: number; behavior?: "center" | "preserve" }>();
  const selectedNode = useMemo(
    () => graph?.nodes.find((node) => node.id === selectedNodeId),
    [graph, selectedNodeId]
  );

  useEffect(() => () => {
    hoveredNodeRef.current?.classList.remove("is-route-hovered");
  }, []);

  useEffect(() => {
    setHoveredRoute(undefined);
    hoveredNodeRef.current?.classList.remove("is-route-hovered");
    hoveredNodeRef.current = null;
  }, [selectedNodeId]);

  function highlightNode(nodeId?: string) {
    hoveredNodeRef.current?.classList.remove("is-route-hovered");
    hoveredNodeRef.current = null;
    if (!nodeId) return;
    const target = Array.from(document.querySelectorAll<HTMLElement>("[data-aviator-flow-node-id]")).find(
      (element) => element.dataset.aviatorFlowNodeId === nodeId
    );
    target?.classList.add("is-route-hovered");
    hoveredNodeRef.current = target ?? null;
  }

  function hoverRelatedRoute(route?: { sourceId: string; targetId: string; nodeId: string }) {
    setHoveredRoute(route);
    highlightNode(route?.nodeId);
  }

  function hoverNode(nodeId?: string) {
    setHoveredRoute(undefined);
    highlightNode(nodeId);
  }

  function focusNode(nodeId: string, behavior: "center" | "preserve" = "center") {
    centerRequestId.current += 1;
    setCenterRequest({ nodeId, requestId: centerRequestId.current, behavior });
  }

  useEffect(() => {
    if (focusRequest) focusNode(focusRequest.nodeId);
  }, [focusRequest]);

  function selectRelatedNode(nodeId: string) {
    const target = Array.from(document.querySelectorAll<HTMLElement>("[data-aviator-flow-node-id]")).find(
      (element) => element.dataset.aviatorFlowNodeId === nodeId
    );
    const bounds = target?.getBoundingClientRect();
    const isVisible = bounds
      && bounds.top >= 0
      && bounds.bottom <= window.innerHeight
      && bounds.left >= 0
      && bounds.right <= window.innerWidth;
    focusNode(nodeId, isVisible ? "preserve" : "center");
    onSelectRelated(nodeId);
  }

  return (
    <section aria-label="Presentacion interactiva de AviatorScript" className="aviator-visualization-workspace aviator-visualization-tab">
      {mode === "interactive" && <div className="aviator-visualization-toolbar">
        <div>
          <span className="formula-eyebrow">ANÁLISIS ESTÁTICO</span>
          <h2><GitBranch size={18} /> Presentacion interactiva</h2>
          <p>El diagrama representa el código, sus decisiones y sus ciclos sin ejecutar la fórmula.</p>
        </div>
        <div className="aviator-visualization-actions">
          <span className={`aviator-analysis-status ${loading ? "is-loading" : graph?.valid ? "is-valid" : "is-invalid"}`}>
            {loading ? <LoaderCircle size={14} className="aviator-spin" /> : graph?.valid ? <CheckCircle2 size={14} /> : <Code2 size={14} />}
            {loading ? "Analizando" : graph?.valid ? "Análisis válido" : "Revisa el código"}
          </span>
        </div>
      </div>}

      {mode === "mermaid" ? <>
        {error && <div className="aviator-visualization-alert" role="status"><Code2 size={16} /><span>{error}</span></div>}
        <MermaidDiagramViewer graph={graph} />
      </> : <>
        {error && <div className="aviator-visualization-alert" role="status"><Code2 size={16} /><span>{error}</span></div>}
        <section className="aviator-flow-panel" aria-label="Diagrama de flujo">
          {graph ? <AviatorFlowViewer centerRequest={centerRequest} graph={graph} hoveredRoute={hoveredRoute} onFocusNode={focusNode} selectedNodeId={selectedNodeId} onSelectNode={onSelectNode} /> : <div className="aviator-flow-empty"><GitBranch size={30} /><strong>Escribe una fórmula para construir el flujo</strong><span>Las ramas, ciclos, errores y retornos aparecerán aquí.</span></div>}
        </section>
        <AviatorNodeInspector flowNodes={graph?.nodes ?? []} node={selectedNode} onClose={() => onSelectNode(undefined)} onFocusNode={focusNode} onHoverNode={hoverNode} onHoverRelated={hoverRelatedRoute} onSelectRelated={selectRelatedNode} />
      </>}
    </section>
  );
}
