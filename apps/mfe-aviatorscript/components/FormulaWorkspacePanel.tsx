"use client";

import { Blocks, Code2, GitBranch, Maximize2, Minimize2 } from "lucide-react";
import type { RefObject } from "react";
import type { AviatorFlowGraph, AviatorFlowNode } from "../lib/visualization";
import { AviatorVisualizationWorkspace } from "./AviatorVisualizationWorkspace";

export type FormulaWorkspaceView = "builder" | "visualizer" | "mermaid";

export type FormulaWorkspacePanelProps = {
  hostRef: RefObject<HTMLDivElement | null>;
  viewMode: FormulaWorkspaceView;
  onViewModeChange: (mode: FormulaWorkspaceView) => void;
  mobileVisible: boolean;
  maximized: boolean;
  onToggleMaximize: () => void;
  visualError: string;
  flowFocusRequest?: { nodeId: string; requestId: number };
  visualGraph: AviatorFlowGraph | null;
  visualLoading: boolean;
  selectedFlowNodeId?: string;
  onSelectNode: (node: AviatorFlowNode | undefined) => void;
  onSelectRelated: (nodeId: string) => void;
};

export function FormulaWorkspacePanel({
  hostRef,
  viewMode,
  onViewModeChange,
  mobileVisible,
  maximized,
  onToggleMaximize,
  visualError,
  flowFocusRequest,
  visualGraph,
  visualLoading,
  selectedFlowNodeId,
  onSelectNode,
  onSelectRelated
}: FormulaWorkspacePanelProps) {
  return <div className={`formula-workspace-column ${mobileVisible ? "mobile-visible" : "mobile-hidden"}`}>
    <nav aria-label="Vista del espacio de trabajo" className="formula-workspace-tabs" role="tablist">
      <button aria-selected={viewMode === "builder"} className={viewMode === "builder" ? "is-active" : ""} onClick={() => onViewModeChange("builder")} role="tab" title="Editar la fórmula con bloques visuales" type="button"><Blocks size={15} /> Constructor</button>
      <button aria-selected={viewMode === "visualizer"} className={viewMode === "visualizer" ? "is-active" : ""} onClick={() => onViewModeChange("visualizer")} role="tab" title="Ver la presentación interactiva del flujo" type="button"><GitBranch size={15} /> Presentación interactiva</button>
      <button aria-selected={viewMode === "mermaid"} className={viewMode === "mermaid" ? "is-active" : ""} onClick={() => onViewModeChange("mermaid")} role="tab" title="Validar y visualizar el código Mermaid generado" type="button"><Code2 size={15} /> Vista Mermaid</button>
    </nav>
    <div
      aria-label={maximized ? (viewMode === "builder" ? "Lienzo de bloques ampliado" : viewMode === "mermaid" ? "Vista Mermaid ampliada" : "Presentación interactiva ampliada") : undefined}
      aria-modal={maximized ? true : undefined}
      className={`workspace-panel ${maximized ? "panel-maximized" : ""} ${viewMode !== "builder" ? "workspace-panel-flow" : ""}`}
      data-maximized-panel={maximized ? "workspace" : undefined}
      role={maximized ? "dialog" : undefined}
      tabIndex={maximized ? -1 : undefined}
    >
      <div aria-hidden={viewMode !== "builder"} aria-label="Lienzo de bloques" className={`block-workspace ${viewMode === "builder" ? "" : "workspace-view-hidden"}`} ref={hostRef} />
      <div className={`workspace-flow-content ${viewMode !== "builder" ? "" : "workspace-view-hidden"}`}>
        <AviatorVisualizationWorkspace
          error={visualError}
          focusRequest={flowFocusRequest}
          graph={visualGraph}
          loading={visualLoading}
          mode={viewMode === "mermaid" ? "mermaid" : "interactive"}
          onSelectNode={onSelectNode}
          onSelectRelated={onSelectRelated}
          selectedNodeId={selectedFlowNodeId}
        />
      </div>
      <button aria-label={maximized ? "Restaurar lienzo" : "Maximizar lienzo"} className="formula-icon-button panel-maximize-button" onClick={onToggleMaximize} title={maximized ? "Restaurar lienzo" : "Maximizar lienzo"} type="button">{maximized ? <Minimize2 size={17} /> : <Maximize2 size={17} />}</button>
    </div>
  </div>;
}
