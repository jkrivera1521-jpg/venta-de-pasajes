import type { MicrofrontendManifest } from "@venta-pasajes/shared-types";

const corsHeaders = {
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Origin": "*"
};

export const dynamic = "force-dynamic";

export function GET() {
  const publicUrl = process.env.NEXT_PUBLIC_MFE_PUBLIC_URL || "http://localhost:3005";

  const manifest: MicrofrontendManifest = {
    name: "mfe-admin",
    title: "Administracion",
    version: "0.1.0",
    status: "online",
    mount_path: "/admin",
    entry_url: `${publicUrl}/admin/embedded`,
    health_url: `${publicUrl}/api/health`,
    exposed_at: new Date().toISOString(),
    capabilities: [
      "arranque-guiado",
      "auditoria-operativa",
      "consulta-eventos",
      "diagnostico-exportable",
      "diagnostico-historico",
      "diagnostico-retencion",
      "filtros-administrativos",
      "parametros-operativos",
      "preparacion-produccion",
      "runbook-operativo",
      "salud-consolidada",
      "salud-servicios"
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
