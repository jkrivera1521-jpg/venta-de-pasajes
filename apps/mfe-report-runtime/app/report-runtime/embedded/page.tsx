"use client";

import { useEffect, useState } from "react";
import ReportServiceRuntime from "../../../components/ReportServiceRuntime";

export default function ReportRuntimeEmbeddedPage() {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);

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
        setAuthReady(true);
      }
      if (data.type === "venta-pasajes:shell-auth-clear") {
        setAccessToken(null);
        setAuthReady(true);
      }
    }

    window.addEventListener("message", receiveShellAuth);
    if (window.parent === window) setAuthReady(true);
    else window.parent.postMessage({ type: "venta-pasajes:mfe-auth-ready" }, "*");
    return () => window.removeEventListener("message", receiveShellAuth);
  }, []);

  if (!authReady) {
    return <main className="report-shell"><div className="report-loading">Validando la sesión del shell...</div></main>;
  }

  if (!accessToken) {
    return <main className="report-shell"><div className="report-empty"><strong>Sesión requerida</strong><p>Abre este módulo desde la consola autenticada.</p></div></main>;
  }

  return <ReportServiceRuntime accessToken={accessToken} />;
}
