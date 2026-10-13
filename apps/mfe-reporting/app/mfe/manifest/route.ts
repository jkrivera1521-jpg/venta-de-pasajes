import type { MicrofrontendManifest } from "@venta-pasajes/shared-types";

const corsHeaders = {
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Origin": "*"
};

export const dynamic = "force-dynamic";

export function GET() {
  const publicUrl = process.env.NEXT_PUBLIC_MFE_PUBLIC_URL || "http://localhost:3004";

  const manifest: MicrofrontendManifest = {
    name: "mfe-reporting",
    title: "Reportes",
    version: "0.1.0",
    status: "online",
    mount_path: "/reporting",
    entry_url: `${publicUrl}/reporting/embedded`,
    health_url: `${publicUrl}/api/health`,
    exposed_at: new Date().toISOString(),
    capabilities: [
      "ventas-por-fecha",
      "pasajeros-por-salida",
      "ventas-por-usuario",
      "ventas-por-bus-ruta-terminal",
      "exportacion-csv"
    ]
  };

  return Response.json(manifest, { headers: corsHeaders });
}

export function OPTIONS() {
  return new Response(null, {
    headers: corsHeaders,
    status: 204
  });
}
