import { randomUUID } from "node:crypto";

const defaultAuditApiUrl = "http://localhost:8086/api/v1/audit";

type RouteContext = {
  params: Promise<{
    path?: string[];
  }>;
};

function resolveAuditApiBase() {
  const configuredBase =
    process.env.AUDIT_API_URL ||
    process.env.NEXT_PUBLIC_AUDIT_API_URL ||
    defaultAuditApiUrl;

  const trimmed = configuredBase.replace(/\/+$/, "");
  return trimmed.endsWith("/audit") ? trimmed : `${trimmed}/audit`;
}

async function proxyAuditRequest(request: Request, context: RouteContext) {
  const params = await context.params;
  const path = params.path?.join("/") ?? "";
  const sourceUrl = new URL(request.url);
  const targetUrl = new URL(`${resolveAuditApiBase()}/${path}`);
  targetUrl.search = sourceUrl.search;

  const headers = new Headers();
  const authorization = request.headers.get("authorization");
  const contentType = request.headers.get("content-type");
  const idempotencyKey = request.headers.get("idempotency-key");
  const correlationId = request.headers.get("x-correlation-id") || randomUUID();

  if (authorization) {
    headers.set("authorization", authorization);
  }

  if (contentType) {
    headers.set("content-type", contentType);
  }

  if (idempotencyKey) {
    headers.set("idempotency-key", idempotencyKey);
  }

  headers.set("x-correlation-id", correlationId);

  let body: BodyInit | undefined;
  if (!["GET", "HEAD"].includes(request.method)) {
    body = await request.text();
  }

  try {
    const response = await fetch(targetUrl, {
      body,
      cache: "no-store",
      headers,
      method: request.method
    });

    return new Response(response.body, {
      headers: {
        "content-type": response.headers.get("content-type") ?? "application/json"
      },
      status: response.status,
      statusText: response.statusText
    });
  } catch (error) {
    return Response.json(
      {
        error: {
          code: "AUDIT_API_UNAVAILABLE",
          message: error instanceof Error ? error.message : "audit-service is unavailable."
        }
      },
      { status: 502 }
    );
  }
}

export function GET(request: Request, context: RouteContext) {
  return proxyAuditRequest(request, context);
}

export function POST(request: Request, context: RouteContext) {
  return proxyAuditRequest(request, context);
}

export function OPTIONS() {
  return new Response(null, { status: 204 });
}
