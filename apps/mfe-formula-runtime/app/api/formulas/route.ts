import { upstreamHeaders } from "../_lib/forward-auth";

export const dynamic = "force-dynamic";

const serviceBaseUrl = (process.env.AVIATORSCRIPT_SERVICE_URL || "http://localhost:8087").replace(/\/$/, "");

export async function GET(request: Request) {
  try {
    const response = await fetch(`${serviceBaseUrl}/api/v1/calculos/formulas`, {
      cache: "no-store",
      headers: upstreamHeaders(request),
      signal: AbortSignal.timeout(7000)
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) return Response.json(payload ?? { error: "No se pudo cargar el catálogo." }, { status: response.status });
    if (!Array.isArray(payload)) return Response.json({ error: "El catálogo recibido no es válido." }, { status: 502 });
    return Response.json(payload, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "El servicio de fórmulas no está disponible." }, { status: 503 });
  }
}
