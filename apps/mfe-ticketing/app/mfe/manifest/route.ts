import type { MicrofrontendManifest } from "@venta-pasajes/shared-types";

const corsHeaders = {
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Origin": "*"
};

export const dynamic = "force-dynamic";

export function GET() {
  const publicUrl = process.env.NEXT_PUBLIC_MFE_PUBLIC_URL || "http://localhost:3003";

  const manifest: MicrofrontendManifest = {
    name: "mfe-ticketing",
    title: "Boleteria",
    version: "0.1.0",
    status: "online",
    mount_path: "/ticketing",
    entry_url: `${publicUrl}/ticketing/embedded`,
    health_url: `${publicUrl}/api/health`,
    exposed_at: new Date().toISOString(),
    capabilities: [
      "busqueda-salidas",
      "mapa-asientos",
      "datos-pasajero",
      "venta-boletos",
      "confirmacion-venta"
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
