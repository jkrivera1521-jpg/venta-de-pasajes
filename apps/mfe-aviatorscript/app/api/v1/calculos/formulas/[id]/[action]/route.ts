import { upstreamJsonHeaders } from "../../../../../_lib/forward-auth";

export const dynamic = "force-dynamic";

const serviceBaseUrl = (process.env.AVIATORSCRIPT_SERVICE_URL || "http://localhost:8087").replace(/\/$/, "");

export async function POST(request: Request, context: { params: Promise<{ id: string; action: string }> }) {
  const { id, action } = await context.params;
  if (!/^\d+$/.test(id) || !["publicar", "activar"].includes(action)) {
    return Response.json({ error: "La operacion de ciclo de vida no es valida." }, { status: 400 });
  }

  try {
    const rawBody = await request.text();
    if (rawBody.length > 4_000) {
      return Response.json({ error: "La identidad del actor supera el limite permitido." }, { status: 413 });
    }

    let body: unknown = {};
    if (rawBody.trim()) {
      try {
        body = JSON.parse(rawBody);
      } catch {
        return Response.json({ error: "La solicitud de ciclo de vida debe ser un JSON valido." }, { status: 400 });
      }
    }
    if (body === null || typeof body !== "object" || Array.isArray(body)) {
      return Response.json({ error: "La solicitud de ciclo de vida no es valida." }, { status: 400 });
    }

    const response = await fetch(`${serviceBaseUrl}/api/v1/calculos/formulas/${id}/${action}`, {
      body: JSON.stringify(body),
      cache: "no-store",
      headers: upstreamJsonHeaders(request),
      method: "POST",
      signal: AbortSignal.timeout(10_000)
    });
    const responseBody = await response.json().catch(() => ({ error: "El servicio no devolvio una respuesta JSON." }));
    return Response.json(responseBody, {
      headers: { "Cache-Control": "no-store" },
      status: response.status
    });
  } catch {
    return Response.json({ error: "No se pudo actualizar el ciclo de vida de la formula." }, { status: 503 });
  }
}
