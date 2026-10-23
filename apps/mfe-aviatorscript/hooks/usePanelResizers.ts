import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react";

type WorkbenchResize = { startX: number; startWidth: number; minWidth: number; maxWidth: number };
type TestPanelResize = { startY: number; startHeight: number; minHeight: number; maxHeight: number };

export function usePanelResizers() {
  const workbenchRef = useRef<HTMLElement | null>(null);
  const scriptPanelRef = useRef<HTMLElement | null>(null);
  const workbenchResizeRef = useRef<WorkbenchResize | null>(null);
  const testPanelResizeRef = useRef<TestPanelResize | null>(null);
  const [scriptPanelWidth, setScriptPanelWidth] = useState<number | null>(null);
  const [testPayloadHeight, setTestPayloadHeight] = useState<number | null>(null);

  useEffect(() => {
    function handlePointerMove(event: PointerEvent) {
      const testResize = testPanelResizeRef.current;
      if (testResize) {
        const nextHeight = testResize.startHeight + (event.clientY - testResize.startY);
        setTestPayloadHeight(Math.min(Math.max(nextHeight, testResize.minHeight), testResize.maxHeight));
        return;
      }

      const resize = workbenchResizeRef.current;
      if (!resize) return;
      const nextWidth = resize.startWidth - (event.clientX - resize.startX);
      setScriptPanelWidth(Math.min(Math.max(nextWidth, resize.minWidth), resize.maxWidth));
    }

    function handlePointerUp() {
      workbenchResizeRef.current = null;
      testPanelResizeRef.current = null;
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

  function getWorkbenchResizeBounds() {
    const workbench = workbenchRef.current;
    if (!workbench) return undefined;
    const minWidth = window.matchMedia("(max-width: 1100px)").matches ? 280 : 320;
    const maxWidth = Math.max(minWidth, workbench.getBoundingClientRect().width - 360);
    return { minWidth, maxWidth };
  }

  function getTestPanelResizeBounds() {
    const panel = scriptPanelRef.current;
    if (!panel) return undefined;
    const minHeight = window.matchMedia("(max-width: 760px)").matches ? 140 : 220;
    const maxHeight = Math.max(minHeight, panel.getBoundingClientRect().height - 320);
    return { minHeight, maxHeight };
  }

  function startWorkbenchResize(event: ReactPointerEvent<HTMLDivElement>) {
    const panel = scriptPanelRef.current;
    const bounds = getWorkbenchResizeBounds();
    if (!panel || !bounds || window.matchMedia("(max-width: 760px)").matches) return;
    workbenchResizeRef.current = {
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

  function resizeWorkbenchWithKeyboard(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    const panel = scriptPanelRef.current;
    const bounds = getWorkbenchResizeBounds();
    if (!panel || !bounds) return;
    const currentWidth = scriptPanelWidth ?? panel.getBoundingClientRect().width;
    const step = event.key === "ArrowLeft" ? 24 : -24;
    setScriptPanelWidth(Math.min(Math.max(currentWidth + step, bounds.minWidth), bounds.maxWidth));
    event.preventDefault();
  }

  function startTestPanelResize(event: ReactPointerEvent<HTMLDivElement>) {
    const bounds = getTestPanelResizeBounds();
    const editor = event.currentTarget.previousElementSibling as HTMLElement | null;
    if (!bounds || !editor) return;
    testPanelResizeRef.current = {
      startY: event.clientY,
      startHeight: editor.getBoundingClientRect().height,
      minHeight: bounds.minHeight,
      maxHeight: bounds.maxHeight
    };
    document.body.style.userSelect = "none";
    document.body.style.cursor = "row-resize";
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  function resizeTestPanelWithKeyboard(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    const panel = scriptPanelRef.current;
    const bounds = getTestPanelResizeBounds();
    if (!panel || !bounds) return;
    const currentHeight = testPayloadHeight ?? panel.querySelector<HTMLElement>(".test-payload")?.getBoundingClientRect().height ?? bounds.minHeight;
    const step = event.key === "ArrowUp" ? -24 : 24;
    setTestPayloadHeight(Math.min(Math.max(currentHeight + step, bounds.minHeight), bounds.maxHeight));
    event.preventDefault();
  }

  return {
    workbenchRef,
    scriptPanelRef,
    scriptPanelWidth,
    testPayloadHeight,
    startWorkbenchResize,
    resizeWorkbenchWithKeyboard,
    startTestPanelResize,
    resizeTestPanelWithKeyboard
  };
}
