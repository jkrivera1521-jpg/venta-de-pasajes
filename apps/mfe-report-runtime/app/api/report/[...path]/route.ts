import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { applyCloudRunAuthorization } from "../../_lib/cloudRunAuth";

export const dynamic = "force-dynamic";

const serviceBaseUrl = (process.env.REPORT_SERVICE_URL || "http://localhost:8088").replace(/\/$/, "");
const allowedMethods = new Set(["GET", "POST", "DELETE"]);

function upstreamHeaders(request: Request) {
  const headers = new Headers();
  for (const name of ["authorization", "content-type", "accept"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set("x-correlation-id", request.headers.get("x-correlation-id") || randomUUID());
  return headers;
}

async function forward(request: NextRequest, path: string[]) {
  if (!allowedMethods.has(request.method)) {
    return Response.json({ code: "METHOD_NOT_ALLOWED", detail: "Metodo no permitido." }, { status: 405 });
  }

  const target = new URL(`${serviceBaseUrl}/api/v1/${path.map((part) => encodeURIComponent(part)).join("/")}`);
  target.search = new URL(request.url).search;
  const body = request.method === "GET" ? undefined : await request.arrayBuffer();

  const headers = upstreamHeaders(request);

  try {
    await applyCloudRunAuthorization(headers, target);
    const response = await fetch(target, {
      body: body && body.byteLength > 0 ? body : undefined,
      cache: "no-store",
      headers,
      method: request.method,
      signal: AbortSignal.timeout(request.method === "GET" ? 10000 : 30000),
    });
    const responseHeaders = new Headers();
    for (const name of ["content-type", "content-disposition", "cache-control", "location"]) {
      const value = response.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }
    return new Response(response.body, { headers: responseHeaders, status: response.status, statusText: response.statusText });
  } catch {
    return Response.json(
      { code: "REPORT_SERVICE_UNAVAILABLE", detail: "No se pudo conectar con report-service." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}

export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return forward(request, (await context.params).path);
}

export async function POST(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return forward(request, (await context.params).path);
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return forward(request, (await context.params).path);
}
