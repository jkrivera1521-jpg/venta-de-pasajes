"use client";

import { CheckCircle2, Code2, GitBranch, LoaderCircle, Play, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { AviatorFlowGraph, AviatorFlowNode } from "../lib/visualization";
import { AviatorCodeEditor } from "./AviatorCodeEditor";
import { AviatorFlowViewer } from "./AviatorFlowViewer";
import { AviatorNodeInspector } from "./AviatorNodeInspector";

type AviatorVisualizationWorkspaceProps = {
  source: string;
  graph: AviatorFlowGraph | null;
  loading: boolean;
  error: string;
  selectedNodeId?: string;
  onSourceChange: (source: string) => void;
  onSelectNode: (node: AviatorFlowNode | undefined) => void;
  onSelectRelated: (nodeId: string) => void;
  onApplyToBuilder: () => void;
  onRetry: () => void;
  onBackToBuilder: () => void;
};

export function AviatorVisualizationWorkspace({
  source,
  graph,
  loading,
  error,
  selectedNodeId,
  onSourceChange,
  onSelectNode,
  onSelectRelated,
  onApplyToBuilder,
  onRetry,
  onBackToBuilder
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
    <section aria-label="Visualizador de codigo AviatorScript" className="aviator-visualization-workspace">
      <div className="aviator-visualization-toolbar">
        <div>
          <span className="formula-eyebrow">ANALISIS ESTATICO</span>
          <h2><GitBranch size={18} /> Visualizador de flujo AviatorScript</h2>
          <p>El diagrama representa el codigo, sus decisiones y sus ciclos sin ejecutar la formula.</p>
        </div>
        <div className="aviator-visualization-actions">
          <span className={`aviator-analysis-status ${loading ? "is-loading" : graph?.valid ? "is-valid" : "is-invalid"}`}>
            {loading ? <LoaderCircle size={14} className="aviator-spin" /> : graph?.valid ? <CheckCircle2 size={14} /> : <Code2 size={14} />}
            {loading ? "Analizando" : graph?.valid ? "Analisis valido" : "Revisa el codigo"}
          </span>
          <button className="formula-button" onClick={onRetry} type="button"><RefreshCw size={15} /> Reanalizar</button>
          <button className="formula-button" onClick={onBackToBuilder} type="button">Constructor</button>
          <button className="formula-button formula-button-primary" disabled={!source.trim()} onClick={onApplyToBuilder} type="button"><Play size={15} /> Aplicar al grafico</button>
        </div>
      </div>

      {error && <div className="aviator-visualization-alert" role="status"><Code2 size={16} /><span>{error}</span></div>}

      <div className="aviator-visualization-grid">
        <section className="aviator-code-panel" aria-label="Codigo fuente AviatorScript">
          <div className="aviator-panel-heading">
            <div><span className="formula-eyebrow">FUENTE EDITABLE</span><h3>Codigo AviatorScript</h3></div>
            <span className="aviator-readonly-note">Analisis sin ejecucion</span>
          </div>
          <AviatorCodeEditor value={source} onChange={onSourceChange} activeRange={selectedNode?.data.source} error={graph?.diagnostics.find((item) => item.severity === "error")?.message} />
          {!!graph?.diagnostics.length && (
            <div className="aviator-diagnostics" aria-live="polite">
              {graph.diagnostics.map((diagnostic, index) => (
                <div className={`aviator-diagnostic is-${diagnostic.severity}`} key={`${diagnostic.message}-${index}`}>
                  <Code2 size={14} />
                  <span>{diagnostic.line ? `L${diagnostic.line}: ` : ""}{diagnostic.message}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="aviator-flow-panel" aria-label="Diagrama de flujo">
          <div className="aviator-panel-heading">
            <div><span className="formula-eyebrow">REPRESENTACION INTERACTIVA</span><h3>Flujo del programa</h3></div>
            <span className="aviator-readonly-note">Selecciona un nodo para inspeccionarlo</span>
          </div>
          {graph ? <AviatorFlowViewer centerRequest={centerRequest} graph={graph} hoveredRoute={hoveredRoute} selectedNodeId={selectedNodeId} onSelectNode={onSelectNode} /> : <div className="aviator-flow-empty"><GitBranch size={30} /><strong>Escribe una formula para construir el flujo</strong><span>Las ramas, ciclos, errores y retornos apareceran aqui.</span></div>}
        </section>
      </div>

      <AviatorNodeInspector flowNodes={graph?.nodes ?? []} node={selectedNode} onClose={() => onSelectNode(undefined)} onFocusNode={focusNode} onHoverNode={hoverNode} onHoverRelated={hoverRelatedRoute} onSelectRelated={selectRelatedNode} />
    </section>
  );
}
