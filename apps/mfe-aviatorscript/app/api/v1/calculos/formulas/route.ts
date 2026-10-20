export const dynamic = "force-dynamic";

const serviceBaseUrl = (process.env.AVIATORSCRIPT_SERVICE_URL || "http://localhost:8087").replace(/\/$/, "");

export async function GET() {
  try {
    const response = await fetch(`${serviceBaseUrl}/api/v1/calculos/formulas`, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000)
    });
    const payload = await response.json().catch(() => null) as unknown;
    if (!response.ok) {
      return Response.json({ error: "El servicio no pudo cargar el catalogo de formulas." }, { status: response.status });
    }
    if (!Array.isArray(payload) || !payload.every((item) => (
      item !== null
      && typeof item === "object"
      && typeof item.codigo === "string"
      && typeof item.nombre === "string"
      && (item.descripcion == null || typeof item.descripcion === "string")
      && typeof item.version === "number"
      && typeof item.expresion === "string"
      && typeof item.activa === "boolean"
    ))) {
      return Response.json({ error: "El servicio devolvio un catalogo de formulas invalido." }, { status: 502 });
    }
    return Response.json(payload, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "No se pudo conectar con el catalogo de formulas. Verifica que aviatorscript-service este activo." }, { status: 503 });
  }
}
