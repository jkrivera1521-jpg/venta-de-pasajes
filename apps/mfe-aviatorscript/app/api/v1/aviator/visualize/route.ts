import { NextResponse } from "next/server";

const MAX_SOURCE_LENGTH = 10000;
const DEFAULT_SERVICE_URL = "http://localhost:8087";

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
    return NextResponse.json({ error: `El codigo supera el limite de ${MAX_SOURCE_LENGTH} caracteres.` }, { status: 413 });
  }

  const baseUrl = (process.env.AVIATORSCRIPT_SERVICE_URL || DEFAULT_SERVICE_URL).replace(/\/$/, "");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const upstream = await fetch(`${baseUrl}/api/v1/aviator/visualize`, {
      body: JSON.stringify({
        includeSourceMapping: (body as { includeSourceMapping?: boolean }).includeSourceMapping !== false,
        source
      }),
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      method: "POST",
      signal: controller.signal
    });
    const upstreamBody = await upstream.json().catch(() => ({ error: "El servicio devolvio una respuesta invalida." }));
    return NextResponse.json(upstreamBody, { status: upstream.status });
  } catch {
    return NextResponse.json({ error: "El analizador remoto no esta disponible; se conserva el analisis local." }, { status: 503 });
  } finally {
    clearTimeout(timeout);
  }
}
