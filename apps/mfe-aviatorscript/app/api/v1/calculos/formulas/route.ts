import { upstreamJsonHeaders } from "../../../_lib/forward-auth";

export const dynamic = "force-dynamic";

const serviceBaseUrl = (process.env.AVIATORSCRIPT_SERVICE_URL || "http://localhost:8087").replace(/\/$/, "");
const MAX_FORMULA_REQUEST_SIZE = 200_000;

function isFormulaSavePayload(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const payload = value as Record<string, unknown>;
  return typeof payload.codigo === "string"
    && typeof payload.nombre === "string"
    && typeof payload.expresion === "string"
    && payload.ejemplo !== null
    && typeof payload.ejemplo === "object"
    && !Array.isArray(payload.ejemplo)
    && (payload.contratoEntrada == null || (typeof payload.contratoEntrada === "object" && !Array.isArray(payload.contratoEntrada)))
    && (payload.contratoSalida == null || (typeof payload.contratoSalida === "object" && !Array.isArray(payload.contratoSalida)))
    && (payload.configuracionInterfaz == null || (typeof payload.configuracionInterfaz === "object" && !Array.isArray(payload.configuracionInterfaz)));
}

export async function GET(request: Request) {
  try {
    const response = await fetch(`${serviceBaseUrl}/api/v1/calculos/formulas`, {
      cache: "no-store",
      headers: upstreamJsonHeaders(request),
      signal: AbortSignal.timeout(5000)
    });
    const payload = await response.json().catch(() => null) as unknown;
    if (!response.ok) {
      return Response.json(payload ?? { error: "El servicio no pudo cargar el catalogo de formulas." }, { status: response.status });
    }
    if (!Array.isArray(payload) || !payload.every((item) => (
      item !== null
      && typeof item === "object"
      && typeof item.id === "number"
      && typeof item.codigo === "string"
      && typeof item.nombre === "string"
      && (item.descripcion == null || typeof item.descripcion === "string")
      && typeof item.version === "number"
      && typeof item.expresion === "string"
      && (item.ejemplo == null || (typeof item.ejemplo === "object" && !Array.isArray(item.ejemplo)))
      && (item.contratoEntrada == null || (typeof item.contratoEntrada === "object" && !Array.isArray(item.contratoEntrada)))
      && (item.contratoSalida == null || (typeof item.contratoSalida === "object" && !Array.isArray(item.contratoSalida)))
      && (item.configuracionInterfaz == null || (typeof item.configuracionInterfaz === "object" && !Array.isArray(item.configuracionInterfaz)))
      && typeof item.activa === "boolean"
      && (item.estado == null || item.estado === "BORRADOR" || item.estado === "PUBLICADA")
      && (item.creadoPor == null || typeof item.creadoPor === "string")
    ))) {
      return Response.json({ error: "El servicio devolvio un catalogo de formulas invalido." }, { status: 502 });
    }
    return Response.json(payload, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "No se pudo conectar con el catalogo de formulas. Verifica que aviatorscript-service este activo." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    if (rawBody.length > MAX_FORMULA_REQUEST_SIZE) {
      return Response.json({ error: "La formula supera el limite permitido." }, { status: 413 });
    }

    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return Response.json({ error: "El cuerpo de la formula debe ser un JSON valido." }, { status: 400 });
    }
    if (!isFormulaSavePayload(payload)) {
      return Response.json({ error: "La formula requiere codigo, nombre, expresion y un ejemplo JSON." }, { status: 400 });
    }

    const response = await fetch(`${serviceBaseUrl}/api/v1/calculos/formulas`, {
      body: JSON.stringify(payload),
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
    return Response.json({ error: "No se pudo guardar la formula. Verifica que aviatorscript-service este activo." }, { status: 503 });
  }
}
