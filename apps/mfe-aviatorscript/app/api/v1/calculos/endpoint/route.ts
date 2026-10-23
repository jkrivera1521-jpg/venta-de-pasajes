export const dynamic = "force-dynamic";

const serviceBaseUrl = (process.env.AVIATORSCRIPT_SERVICE_URL || "http://localhost:8087").replace(/\/$/, "");

export function GET() {
  return Response.json(
    { executionUrl: `${serviceBaseUrl}/api/v1/calculos/ejecutar` },
    { headers: { "Cache-Control": "no-store" } }
  );
}
