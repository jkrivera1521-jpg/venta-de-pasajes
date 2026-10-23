import type { MicrofrontendManifest } from "@venta-pasajes/shared-types";

export const dynamic = "force-dynamic";

export function GET() {
  const publicUrl = process.env.NEXT_PUBLIC_MFE_PUBLIC_URL || "http://localhost:3008";
  const manifest: MicrofrontendManifest = {
    name: "mfe-report-runtime",
    title: "Pruebas de report-service",
    version: "0.1.0",
    status: "online",
    mount_path: "/report-runtime",
    entry_url: `${publicUrl}/report-runtime/embedded`,
    health_url: `${publicUrl}/api/health`,
    exposed_at: new Date().toISOString(),
    capabilities: [
      "catalogo-de-plantillas",
      "carga-multipart",
      "versiones-y-parametros",
      "activacion-de-versiones",
      "generacion-xlsx-docx-pdf",
      "lotes-asincronos-y-descarga-zip",
      "proxy-server-side-autenticado",
      "accesibilidad-responsive",
    ],
  };
  return Response.json(manifest, {
    headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store" },
  });
}
