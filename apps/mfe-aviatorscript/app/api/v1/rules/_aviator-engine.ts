import { upstreamJsonHeaders } from "../../_lib/forward-auth";

const serviceBaseUrl = (process.env.AVIATORSCRIPT_SERVICE_URL || "http://localhost:8087").replace(/\/$/, "");

export async function callAviatorEngine(request: Request, path: string, body: unknown) {
  const response = await fetch(`${serviceBaseUrl}${path}`, {
    body: JSON.stringify(body),
    cache: "no-store",
    headers: upstreamJsonHeaders(request),
    method: "POST",
    signal: AbortSignal.timeout(15_000)
  });
  const payload = await response.json().catch(() => ({ error: "El servicio no devolvio una respuesta JSON." }));
  return { payload, status: response.status };
}
