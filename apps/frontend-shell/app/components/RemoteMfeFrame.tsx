"use client";

import { useQuery } from "@tanstack/react-query";
import type { MicrofrontendManifest } from "@venta-pasajes/shared-types";
import { CircleAlert, CircleCheck, RefreshCw, TriangleAlert, WifiOff, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type LoadStatus = "loading" | "ready" | "error" | "unconfigured";
type GrowlSeverity = "info" | "warn" | "error";

type ShellGrowl = {
  detail?: string;
  id: number;
  severity: GrowlSeverity;
  summary: string;
};

type RemoteMfeFrameProps = {
  accessToken?: string | null;
  fallbackName: string;
  fallbackTitle: string;
  manifestUrl: string;
  shellName?: string;
};

const growlLifetimeMs = 5200;

async function fetchManifest(manifestUrl: string) {
  const response = await fetch(manifestUrl, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json() as Promise<MicrofrontendManifest>;
}

function parseGrowlSeverity(value: unknown): GrowlSeverity {
  if (value === "warn" || value === "error") {
    return value;
  }

  return "info";
}

export function RemoteMfeFrame({ accessToken = null, fallbackName, fallbackTitle, manifestUrl, shellName = "frontend-shell" }: Readonly<RemoteMfeFrameProps>) {
  const [frameHeight, setFrameHeight] = useState(720);
  const [reloadToken, setReloadToken] = useState(0);
  const [growls, setGrowls] = useState<ShellGrowl[]>([]);
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const growlId = useRef(0);
  const growlTimers = useRef<Map<number, number>>(new Map());
  const manifestQuery = useQuery({
    enabled: Boolean(manifestUrl),
    queryKey: ["frontend-shell", "mfe-manifest", manifestUrl, reloadToken],
    queryFn: () => fetchManifest(manifestUrl)
  });
  const manifest = manifestQuery.data ?? null;
  const status: LoadStatus = !manifestUrl ? "unconfigured" : manifestQuery.isPending ? "loading" : manifestQuery.isError ? "error" : "ready";
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

  const dismissGrowl = useCallback((id: number) => {
    const timer = growlTimers.current.get(id);
    if (timer) {
      window.clearTimeout(timer);
      growlTimers.current.delete(id);
    }
    setGrowls((current) => current.filter((growl) => growl.id !== id));
  }, []);

  const showGrowl = useCallback((severity: GrowlSeverity, summary: string, detail?: string) => {
    const id = growlId.current + 1;
    growlId.current = id;

    setGrowls((current) => [
      { detail, id, severity, summary },
      ...current
    ].slice(0, 5));

    const timer = window.setTimeout(() => dismissGrowl(id), growlLifetimeMs);
    growlTimers.current.set(id, timer);
  }, [dismissGrowl]);

  const postShellAuthToFrame = useCallback(() => {
    if (!manifestOrigin || !frameRef.current?.contentWindow) {
      return;
    }

    frameRef.current.contentWindow.postMessage({
      accessToken,
      shellName,
      type: accessToken ? "venta-pasajes:shell-auth-token" : "venta-pasajes:shell-auth-clear"
    }, manifestOrigin);
  }, [accessToken, manifestOrigin, shellName]);

  useEffect(() => {
    setFrameHeight(720);
  }, [frameSrc]);

  useEffect(() => {
    postShellAuthToFrame();
  }, [postShellAuthToFrame]);

  useEffect(() => () => {
    growlTimers.current.forEach((timer) => window.clearTimeout(timer));
    growlTimers.current.clear();
  }, []);

  useEffect(() => {
    function handleMfeMessage(event: MessageEvent) {
      if (!manifestOrigin || event.origin !== manifestOrigin) {
        return;
      }

      if (!event.data || typeof event.data !== "object") {
        return;
      }

      const data = event.data as { detail?: unknown; height?: unknown; severity?: unknown; summary?: unknown; type?: unknown };
      if (data.type === "venta-pasajes:mfe-auth-ready") {
        postShellAuthToFrame();
        return;
      }

      if (data.type === "venta-pasajes:growl") {
        const summary = typeof data.summary === "string" && data.summary.trim() ? data.summary : "Notificacion";
        const detail = typeof data.detail === "string" && data.detail.trim() ? data.detail : undefined;
        showGrowl(parseGrowlSeverity(data.severity), summary, detail);
        return;
      }

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
  }, [manifestOrigin, postShellAuthToFrame, showGrowl]);

  return (
    <>
      {growls.length > 0 ? (
        <section aria-label="Notificaciones" aria-live="polite" className="growl-stack">
          {growls.map((growl) => {
            const GrowlIcon = growl.severity === "info" ? CircleCheck : growl.severity === "warn" ? TriangleAlert : CircleAlert;
            return (
              <article className={`growl-message growl-${growl.severity}`} key={growl.id} role={growl.severity === "error" ? "alert" : "status"}>
                <GrowlIcon aria-hidden="true" size={21} />
                <div>
                  <strong>{growl.summary}</strong>
                  {growl.detail ? <span>{growl.detail}</span> : null}
                </div>
                <button aria-label="Cerrar notificacion" className="growl-close" onClick={() => dismissGrowl(growl.id)} type="button">
                  <X aria-hidden="true" size={15} />
                </button>
              </article>
            );
          })}
        </section>
      ) : null}

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

        {status === "unconfigured" ? (
          <div className="remote-empty" role="status">
            <CircleAlert aria-hidden="true" size={28} />
            <strong>MFE pendiente de creacion</strong>
            <span>El modulo {fallbackTitle} todavia no tiene una URL de manifest configurada.</span>
            <span>Cuando exista, configura NEXT_PUBLIC_MFE_ONLINE_SALES_MANIFEST_URL en el shell.</span>
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
            onLoad={postShellAuthToFrame}
            ref={frameRef}
            src={frameSrc}
            style={{ height: `${frameHeight}px` }}
            title={manifest?.title ?? fallbackTitle}
          />
        ) : null}
      </div>
    </>
  );
}
