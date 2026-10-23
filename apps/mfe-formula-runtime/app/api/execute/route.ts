import { upstreamHeaders } from "../_lib/forward-auth";

export const dynamic = "force-dynamic";

const serviceBaseUrl = (process.env.AVIATORSCRIPT_SERVICE_URL || "http://localhost:8087").replace(/\/$/, "");
const maxRequestSize = 200_000;

export async function POST(request: Request) {
  const rawBody = await request.text();
  if (rawBody.length > maxRequestSize) return Response.json({ error: "Los datos superan el límite permitido." }, { status: 413 });

  try {
    const body = JSON.parse(rawBody) as { idSolicitud?: unknown; codigoFormula?: unknown; parametros?: unknown };
    if (typeof body.codigoFormula !== "string" || !body.codigoFormula.trim()) {
      return Response.json({ error: "El código de fórmula es obligatorio." }, { status: 400 });
    }
    if (!body.parametros || typeof body.parametros !== "object" || Array.isArray(body.parametros)) {
      return Response.json({ error: "Los parámetros deben ser un objeto JSON." }, { status: 400 });
    }

    const response = await fetch(`${serviceBaseUrl}/api/v1/calculos/ejecutar`, {
      body: JSON.stringify({
        codigoFormula: body.codigoFormula,
        idSolicitud: typeof body.idSolicitud === "string" ? body.idSolicitud : `RUNTIME-${Date.now()}`,
        parametros: body.parametros
      }),
      cache: "no-store",
      headers: upstreamHeaders(request),
      method: "POST",
      signal: AbortSignal.timeout(20_000)
    });
    const payload = await response.json().catch(() => ({ error: "El motor no devolvió una respuesta JSON." }));
    return Response.json(payload, { status: response.status, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof SyntaxError) return Response.json({ error: "Los datos enviados no son JSON válido." }, { status: 400 });
    return Response.json({ error: "No se pudo conectar con el motor AviatorScript." }, { status: 503 });
  }
}
