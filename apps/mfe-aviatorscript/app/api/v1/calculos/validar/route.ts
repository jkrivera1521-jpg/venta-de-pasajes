import { NextResponse } from "next/server";
import { upstreamJsonHeaders } from "../../../_lib/forward-auth";

export const dynamic = "force-dynamic";

const serviceBaseUrl = (process.env.AVIATORSCRIPT_SERVICE_URL || "http://localhost:8087").replace(/\/$/, "");
const MAX_SOURCE_LENGTH = 100_000;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "El cuerpo debe ser JSON valido." }, { status: 400 });
  }

  if (!body || typeof body !== "object" || Array.isArray(body) || typeof (body as { source?: unknown }).source !== "string") {
    return NextResponse.json({ error: "El campo source es obligatorio." }, { status: 400 });
  }
  const source = (body as { source: string }).source;
  if (source.length > MAX_SOURCE_LENGTH) {
    return NextResponse.json({ error: "El codigo AviatorScript supera el limite permitido." }, { status: 413 });
  }

  try {
    const response = await fetch(`${serviceBaseUrl}/api/v1/calculos/validar`, {
      body: JSON.stringify({ source }),
      cache: "no-store",
      headers: upstreamJsonHeaders(request),
      method: "POST",
      signal: AbortSignal.timeout(10_000)
    });
    const payload = await response.json().catch(() => ({ error: "El servicio no devolvio una respuesta JSON." }));
    return NextResponse.json(payload, { status: response.status, headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "No se pudo conectar con el motor AviatorScript." }, { status: 503 });
  }
}
