import type { MicrofrontendManifest } from "@venta-pasajes/shared-types";

export const dynamic = "force-dynamic";

export function GET() {
  const publicUrl = process.env.NEXT_PUBLIC_MFE_PUBLIC_URL || "http://localhost:3007";
  const manifest: MicrofrontendManifest = {
    name: "mfe-formula-runtime",
    title: "Aplicaciones de cálculo",
    version: "0.1.0",
    status: "online",
    mount_path: "/formula-runtime",
    entry_url: `${publicUrl}/formula-runtime/embedded`,
    health_url: `${publicUrl}/api/health`,
    exposed_at: new Date().toISOString(),
    capabilities: [
      "catalogo-de-formulas-activas",
      "formularios-dinamicos",
      "ejecucion-aviatorscript-real",
      "resultados-object-list-null",
      "modo-desconectado",
      "accesibilidad-responsive"
    ]
  };
  return Response.json(manifest, { headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store" } });
}
