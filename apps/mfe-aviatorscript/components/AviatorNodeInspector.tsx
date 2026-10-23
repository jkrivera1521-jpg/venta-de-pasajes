"use client";

import { X } from "lucide-react";
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { AviatorFlowNode } from "../lib/visualization";
import { highlightAviatorLine } from "./AviatorCodeEditor";

type AviatorNodeInspectorProps = {
  flowNodes: AviatorFlowNode[];
  node?: AviatorFlowNode;
  onClose: () => void;
  onFocusNode: (nodeId: string) => void;
  onHoverRelated: (route?: { sourceId: string; targetId: string; nodeId: string }) => void;
  onHoverNode: (nodeId?: string) => void;
  onSelectRelated: (nodeId: string) => void;
};

export function AviatorNodeInspector({ flowNodes, node, onClose, onFocusNode, onHoverRelated, onHoverNode, onSelectRelated }: AviatorNodeInspectorProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const dragRef = useRef<{ startX: number; startY: number; startOffsetX: number; startOffsetY: number; baseLeft: number; baseTop: number; width: number; height: number } | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  onCloseRef.current = onClose;

  useEffect(() => {
    if (!node) return;
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusFrame = window.requestAnimationFrame(() => dialogRef.current?.focus());
    return () => {
      window.cancelAnimationFrame(focusFrame);
      const previousFocus = previousFocusRef.current;
      previousFocusRef.current = null;
      if (previousFocus && document.contains(previousFocus)) previousFocus.focus();
    };
  }, [Boolean(node)]);

  useEffect(() => {
    if (!node) return;
    const dialogElement = dialogRef.current as HTMLElement | null;
    if (!dialogElement) return;
    const activeDialog = dialogElement as HTMLElement;

    function getFocusableElements() {
      return Array.from(activeDialog.querySelectorAll<HTMLElement>(
        "button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex=\"-1\"]), [contenteditable=\"true\"]"
      )).filter((element) => element.getClientRects().length > 0 && !element.hidden);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;

      const focusableElements = getFocusableElements();
      if (!focusableElements.length) {
        event.preventDefault();
        activeDialog.focus();
        return;
      }

      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement;
      if (event.shiftKey && (activeElement === first || activeElement === activeDialog || !activeDialog.contains(activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (activeElement === last || activeElement === activeDialog || !activeDialog.contains(activeElement))) {
        event.preventDefault();
        first.focus();
      }
    }

    activeDialog.addEventListener("keydown", handleKeyDown);
    return () => activeDialog.removeEventListener("keydown", handleKeyDown);
  }, [Boolean(node)]);

  useEffect(() => {
    if (!node) setDragOffset({ x: 0, y: 0 });
  }, [node]);

  useEffect(() => {
    function handlePointerMove(event: PointerEvent) {
      const drag = dragRef.current;
      if (!drag) return;
      const nextX = drag.startOffsetX + event.clientX - drag.startX;
      const nextY = drag.startOffsetY + event.clientY - drag.startY;
      const minX = 12 - drag.baseLeft;
      const maxX = window.innerWidth - drag.width - 12 - drag.baseLeft;
      const minY = 12 - drag.baseTop;
      const maxY = window.innerHeight - drag.height - 12 - drag.baseTop;
      setDragOffset({
        x: Math.min(Math.max(nextX, minX), Math.max(minX, maxX)),
        y: Math.min(Math.max(nextY, minY), Math.max(minY, maxY))
      });
    }

    function handlePointerUp() {
      dragRef.current = null;
      document.body.style.userSelect = "";
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, []);

  function startDragging(event: ReactPointerEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest("button")) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const bounds = dialog.getBoundingClientRect();
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      startOffsetX: dragOffset.x,
      startOffsetY: dragOffset.y,
      baseLeft: bounds.left - dragOffset.x,
      baseTop: bounds.top - dragOffset.y,
      width: bounds.width,
      height: bounds.height
    };
    document.body.style.userSelect = "none";
    event.preventDefault();
  }

  if (!node) return null;
  const sourceLines = (node.data.sourceCode || "Sin código asociado").split("\n");
  const relatedKind = (nodeId: string) => flowNodes.find((item) => item.id === nodeId)?.data.kind ?? "process";

  return (
    <div
      aria-label="Cerrar inspector"
      className="aviator-inspector-backdrop"
      role="presentation"
    >
      <aside
        aria-labelledby="aviator-inspector-title"
        aria-modal="true"
        className="aviator-node-inspector"
        ref={dialogRef}
        role="dialog"
        style={{ transform: `translate3d(${dragOffset.x}px, ${dragOffset.y}px, 0)` }}
        tabIndex={-1}
      >
        <div className="aviator-inspector-header aviator-inspector-drag-handle" onPointerDown={startDragging}>
          <div>
            <span className="formula-eyebrow">INSPECTOR DEL FLUJO</span>
            <h2 id="aviator-inspector-title">{node.data.instruction}</h2>
          </div>
          <button aria-label="Cerrar inspector" onClick={onClose} title="Cerrar el inspector del componente" type="button"><X size={17} /></button>
        </div>
        <strong className="aviator-inspector-label">{node.data.label}</strong>
        <div className="aviator-inspector-meta">
          <button
            aria-label="Resaltar componente en la presentación interactiva"
            className={`aviator-inspector-kind-${node.data.kind}`}
            onBlur={() => onHoverNode()}
            onClick={() => onFocusNode(node.id)}
            onFocus={() => onHoverNode(node.id)}
            onMouseEnter={() => onHoverNode(node.id)}
            onMouseLeave={() => onHoverNode()}
            title="Resaltar en la presentación interactiva"
            type="button"
          >{node.data.kind}</button>
        </div>
        <section className="aviator-inspector-code-section">
          <h3>Código fuente</h3>
          <div className="aviator-inspector-source" role="region" aria-label="Código fuente numerado">
            {sourceLines.map((line, index) => (
              <div className="aviator-inspector-source-line" key={`${node.id}-source-${index}`}>
                <span aria-hidden="true">{node.data.source.startLine + index}</span>
                <code dangerouslySetInnerHTML={{ __html: highlightAviatorLine(line || " ") }} />
              </div>
            ))}
          </div>
        </section>
        <section className="aviator-inspector-columns">
          <div><h3>Referencias</h3><p>{node.data.referencedVariables.length ? node.data.referencedVariables.join(", ") : "Ninguna"}</p></div>
          <div><h3>Asigna</h3><p>{node.data.assignedVariables.length ? node.data.assignedVariables.join(", ") : "Ninguna"}</p></div>
        </section>
        <section>
          <h3>Rutas</h3>
          <div className="aviator-inspector-links">
            {!!node.data.previousIds.length && <div className="aviator-inspector-route-group">
              {node.data.previousIds.map((id) => <button className={`aviator-inspector-route-${relatedKind(id)}`} key={`previous-${id}`} onBlur={() => onHoverRelated()} onClick={() => onSelectRelated(id)} onFocus={() => onHoverRelated({ sourceId: id, targetId: node.id, nodeId: id })} onMouseEnter={() => onHoverRelated({ sourceId: id, targetId: node.id, nodeId: id })} onMouseLeave={() => onHoverRelated()} title={`Ir al componente anterior ${id}`} type="button">Anterior: {id}</button>)}
            </div>}
            {!!node.data.previousIds.length && !!node.data.nextIds.length && <span aria-hidden="true" className="aviator-inspector-route-divider" />}
            {!!node.data.nextIds.length && <div className="aviator-inspector-route-group">
              {node.data.nextIds.map((id) => <button className={`aviator-inspector-route-${relatedKind(id)}`} key={`next-${id}`} onBlur={() => onHoverRelated()} onClick={() => onSelectRelated(id)} onFocus={() => onHoverRelated({ sourceId: node.id, targetId: id, nodeId: id })} onMouseEnter={() => onHoverRelated({ sourceId: node.id, targetId: id, nodeId: id })} onMouseLeave={() => onHoverRelated()} title={`Ir al componente siguiente ${id}`} type="button">Siguiente: {id}</button>)}
            </div>}
            {!node.data.previousIds.length && !node.data.nextIds.length && <p>Sin conexiones adicionales.</p>}
          </div>
        </section>
      </aside>
    </div>
  );
}
