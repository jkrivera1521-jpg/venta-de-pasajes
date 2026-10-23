"use client";

import { useEffect, useState } from "react";
import ReportServiceRuntime from "../../../components/ReportServiceRuntime";

export default function ReportRuntimeEmbeddedPage() {
  const [accessToken, setAccessToken] = useState<string | null>(null);

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

  return <ReportServiceRuntime accessToken={accessToken} />;
}
