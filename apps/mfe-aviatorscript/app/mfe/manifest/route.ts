import type { MicrofrontendManifest } from "@venta-pasajes/shared-types";

const corsHeaders = {
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Origin": "*"
};

export const dynamic = "force-dynamic";

export function GET() {
  const publicUrl = process.env.NEXT_PUBLIC_MFE_PUBLIC_URL || "http://localhost:3006";
  const manifest: MicrofrontendManifest = {
    name: "mfe-aviatorscript",
    title: "Constructor de reglas",
    version: "0.1.0",
    status: "online",
    mount_path: "/rules",
    entry_url: `${publicUrl}/rules/embedded`,
    health_url: `${publicUrl}/api/health`,
    exposed_at: new Date().toISOString(),
    capabilities: [
      "visual-rule-builder",
      "schema-driven-conditions",
      "nested-and-or-groups",
      "aviatorscript-validation",
      "sandbox-testing"
    ]
  };

  return Response.json(manifest, { headers: corsHeaders });
}

export function OPTIONS() {
  return new Response(null, { headers: corsHeaders, status: 204 });
}
