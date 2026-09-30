import { randomUUID } from "node:crypto";
import { applyCloudRunAuthorization } from "../../_lib/cloudRunAuth";

const defaultApiUrl = "__BACKEND_DEFAULT_URL__";

type RouteContext = {
  params: Promise<{
    path?: string[];
  }>;
};

function resolveApiBase() {
  const configuredBase =
    process.env.__API_ENV_PREFIX___API_URL ||
    process.env.NEXT_PUBLIC___API_ENV_PREFIX___API_URL ||
    defaultApiUrl;

  const trimmed = configuredBase.replace(/\/+$/, "");
  return trimmed.endsWith("/__PACKAGE_SEGMENT__") ? trimmed : `${trimmed}/__PACKAGE_SEGMENT__`;
}

async function proxyRequest(request: Request, context: RouteContext) {
  const params = await context.params;
  const path = params.path?.join("/") ?? "";
  const sourceUrl = new URL(request.url);
  const targetUrl = new URL(`${resolveApiBase()}/${path}`);
  targetUrl.search = sourceUrl.search;

  const headers = new Headers();
  const authorization = request.headers.get("authorization");
  const contentType = request.headers.get("content-type");
  const correlationId = request.headers.get("x-correlation-id") || randomUUID();

  if (authorization) {
    headers.set("authorization", authorization);
  }

  if (contentType) {
    headers.set("content-type", contentType);
  }

  headers.set("x-correlation-id", correlationId);

  await applyCloudRunAuthorization(headers, targetUrl);

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
          code: "__API_ENV_PREFIX___API_UNAVAILABLE",
          message: error instanceof Error ? error.message : "__PACKAGE_SEGMENT__ backend is unavailable."
        }
      },
      { status: 502 }
    );
  }
}

export function GET(request: Request, context: RouteContext) {
  return proxyRequest(request, context);
}

export function POST(request: Request, context: RouteContext) {
  return proxyRequest(request, context);
}

export function PUT(request: Request, context: RouteContext) {
  return proxyRequest(request, context);
}

export function PATCH(request: Request, context: RouteContext) {
  return proxyRequest(request, context);
}

export function DELETE(request: Request, context: RouteContext) {
  return proxyRequest(request, context);
}

export function OPTIONS() {
  return new Response(null, { status: 204 });
}
