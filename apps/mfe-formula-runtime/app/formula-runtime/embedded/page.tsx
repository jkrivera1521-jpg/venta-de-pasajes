"use client";

import { useEffect, useState } from "react";
import FormulaRuntime from "../../../components/FormulaRuntime";

export default function FormulaRuntimeEmbeddedPage() {
  const [accessToken, setAccessToken] = useState<string | null>(null);

  useEffect(() => {
    if (window.parent === window) return;
    const notifyShellInteraction = () => window.parent.postMessage({ type: "venta-pasajes:mfe-interaction" }, "*");
    const activityEvents = ["pointerdown", "keydown", "touchstart", "wheel", "scroll"] as const;
    activityEvents.forEach((eventName) => document.addEventListener(eventName, notifyShellInteraction, { passive: true }));
    return () => activityEvents.forEach((eventName) => document.removeEventListener(eventName, notifyShellInteraction));
  }, []);

  useEffect(() => {
    function receiveShellAuth(event: MessageEvent) {
      if (event.source !== window.parent || !event.data || typeof event.data !== "object") return;
      const data = event.data as { accessToken?: unknown; type?: unknown };
      if (data.type === "venta-pasajes:shell-auth-token" && typeof data.accessToken === "string" && data.accessToken.trim()) {
        setAccessToken(data.accessToken);
      }
      if (data.type === "venta-pasajes:shell-auth-clear") setAccessToken(null);
    }

    window.addEventListener("message", receiveShellAuth);
    window.parent.postMessage({ type: "venta-pasajes:mfe-auth-ready" }, "*");
    return () => window.removeEventListener("message", receiveShellAuth);
  }, []);

  return <FormulaRuntime accessToken={accessToken} />;
}
