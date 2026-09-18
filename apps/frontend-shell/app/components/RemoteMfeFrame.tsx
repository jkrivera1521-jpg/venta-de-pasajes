"use client";

import { useQuery } from "@tanstack/react-query";
import type { MicrofrontendManifest } from "@venta-pasajes/shared-types";
import { RefreshCw, WifiOff } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type LoadStatus = "loading" | "ready" | "error";

type RemoteMfeFrameProps = {
  fallbackName: string;
  fallbackTitle: string;
  manifestUrl: string;
  shellName?: string;
};

async function fetchManifest(manifestUrl: string) {
  const response = await fetch(manifestUrl, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json() as Promise<MicrofrontendManifest>;
}

export function RemoteMfeFrame({ fallbackName, fallbackTitle, manifestUrl, shellName = "frontend-shell" }: Readonly<RemoteMfeFrameProps>) {
  const [frameHeight, setFrameHeight] = useState(720);
  const [reloadToken, setReloadToken] = useState(0);
  const manifestQuery = useQuery({
    queryKey: ["frontend-shell", "mfe-manifest", manifestUrl, reloadToken],
    queryFn: () => fetchManifest(manifestUrl)
  });
  const manifest = manifestQuery.data ?? null;
  const status: LoadStatus = manifestQuery.isPending ? "loading" : manifestQuery.isError ? "error" : "ready";
  const error = manifestQuery.error instanceof Error ? manifestQuery.error.message : "No se pudo cargar el MFE";

  const frameSrc = useMemo(() => {
    if (!manifest?.entry_url) {
      return null;
    }

    const separator = manifest.entry_url.includes("?") ? "&" : "?";
    return `${manifest.entry_url}${separator}shell=${shellName}&reload=${reloadToken}`;
  }, [manifest, reloadToken, shellName]);
  const manifestOrigin = useMemo(() => {
    if (!manifest?.entry_url) {
      return null;
    }

    try {
      return new URL(manifest.entry_url).origin;
    } catch {
      return null;
    }
  }, [manifest]);

  useEffect(() => {
    setFrameHeight(720);
  }, [frameSrc]);

  useEffect(() => {
    function handleMfeMessage(event: MessageEvent) {
      if (!manifestOrigin || event.origin !== manifestOrigin) {
        return;
      }

      if (!event.data || typeof event.data !== "object") {
        return;
      }

      const data = event.data as { height?: unknown; type?: unknown };
      if (data.type !== "venta-pasajes:mfe-height" || typeof data.height !== "number") {
        return;
      }

      const nextHeight = Math.ceil(data.height) + 8;
      if (!Number.isFinite(nextHeight)) {
        return;
      }

      setFrameHeight(Math.min(Math.max(nextHeight, 720), 1800));
    }

    window.addEventListener("message", handleMfeMessage);
    return () => window.removeEventListener("message", handleMfeMessage);
  }, [manifestOrigin]);

  return (
    <div className="remote-panel">
      <header className="remote-header">
        <div>
          <p className="eyebrow">Modulo activo</p>
          <h2>{manifest?.title ?? fallbackTitle}</h2>
        </div>
        <button
          className="icon-button"
          onClick={() => {
            setReloadToken((value) => value + 1);
          }}
          title="Recargar modulo"
          type="button"
        >
          <RefreshCw aria-hidden="true" size={18} />
        </button>
      </header>

      <div className="manifest-bar">
        <span>{manifest?.name ?? fallbackName}</span>
        <span>{manifest?.version ?? "pendiente"}</span>
        <span>{status}</span>
      </div>

      {status === "error" ? (
        <div className="remote-empty" role="status">
          <WifiOff aria-hidden="true" size={28} />
          <strong>MFE no disponible</strong>
          <span>{error}</span>
          <span>{manifestUrl}</span>
        </div>
      ) : null}

      {status === "loading" ? (
        <div className="remote-loading" role="status">
          <span />
          <strong>Cargando modulo...</strong>
        </div>
      ) : null}

      {status === "ready" && frameSrc ? (
        <iframe
          className="mfe-frame"
          src={frameSrc}
          style={{ height: `${frameHeight}px` }}
          title={manifest?.title ?? fallbackTitle}
        />
      ) : null}
    </div>
  );
}
