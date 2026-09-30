import type { MicrofrontendManifest } from "@venta-pasajes/shared-types";

const corsHeaders = {
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Origin": "*"
};

export const dynamic = "force-dynamic";

export function GET() {
  const publicUrl = process.env.NEXT_PUBLIC_MFE_PUBLIC_URL || "http://localhost:__LOCAL_PORT__";

  const manifest: MicrofrontendManifest = {
    name: "__MFE_NAME__",
    title: "__TITLE__",
    version: "0.1.0",
    status: "online",
    mount_path: "/__PACKAGE_SEGMENT__",
    entry_url: `${publicUrl}/__PACKAGE_SEGMENT__/embedded`,
    health_url: `${publicUrl}/api/health`,
    exposed_at: new Date().toISOString(),
    capabilities: ["__PACKAGE_SEGMENT__-base"]
  };

  return Response.json(manifest, { headers: corsHeaders });
}

export function OPTIONS() {
  return new Response(null, {
    headers: corsHeaders,
    status: 204
  });
}
