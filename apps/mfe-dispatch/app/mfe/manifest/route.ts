import type { MicrofrontendManifest } from "@venta-pasajes/shared-types";

const corsHeaders = {
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Origin": "*"
};

export const dynamic = "force-dynamic";

export function GET() {
  const publicUrl = process.env.NEXT_PUBLIC_MFE_PUBLIC_URL || "http://localhost:3002";

  const manifest: MicrofrontendManifest = {
    name: "mfe-dispatch",
    title: "Despacho operativo",
    version: "0.1.0",
    status: "online",
    mount_path: "/dispatch",
    entry_url: `${publicUrl}/dispatch/embedded`,
    health_url: `${publicUrl}/api/health`,
    exposed_at: new Date().toISOString(),
    capabilities: [
      "terminales",
      "rutas",
      "tipos-bus",
      "buses",
      "layouts-asientos",
      "salidas-programadas"
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
