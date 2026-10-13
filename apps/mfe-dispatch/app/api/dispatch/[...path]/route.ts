import { randomUUID } from "node:crypto";
import { applyCloudRunAuthorization } from "../../_lib/cloudRunAuth";

const defaultDispatchApiUrl = "http://localhost:8082/api/v1/dispatch";
const defaultActorUserId = "00000000-0000-0000-0000-000000000025";

type RouteContext = {
  params: Promise<{
    path?: string[];
  }>;
};

function resolveDispatchApiBase() {
  const configuredBase =
    process.env.DISPATCH_API_URL ||
    process.env.NEXT_PUBLIC_DISPATCH_API_URL ||
    defaultDispatchApiUrl;

  const trimmed = configuredBase.replace(/\/+$/, "");
  return trimmed.endsWith("/dispatch") ? trimmed : `${trimmed}/dispatch`;
}

async function proxyDispatchRequest(request: Request, context: RouteContext) {
  const params = await context.params;
  const path = params.path?.join("/") ?? "";
  const sourceUrl = new URL(request.url);
  const targetUrl = new URL(`${resolveDispatchApiBase()}/${path}`);
  targetUrl.search = sourceUrl.search;

  const headers = new Headers();
  const authorization = request.headers.get("authorization");
  const contentType = request.headers.get("content-type");
  const actorUserId = request.headers.get("x-actor-user-id") || defaultActorUserId;
  const correlationId = request.headers.get("x-correlation-id") || randomUUID();

  if (authorization) {
    headers.set("authorization", authorization);
  }

  if (contentType) {
    headers.set("content-type", contentType);
  }

  headers.set("x-actor-user-id", actorUserId);
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
          code: "DISPATCH_API_UNAVAILABLE",
          message: error instanceof Error ? error.message : "dispatch-service is unavailable."
        }
      },
      { status: 502 }
    );
  }
}

export function GET(request: Request, context: RouteContext) {
  return proxyDispatchRequest(request, context);
}

export function POST(request: Request, context: RouteContext) {
  return proxyDispatchRequest(request, context);
}

export function PATCH(request: Request, context: RouteContext) {
  return proxyDispatchRequest(request, context);
}

export function PUT(request: Request, context: RouteContext) {
  return proxyDispatchRequest(request, context);
}

export function DELETE(request: Request, context: RouteContext) {
  return proxyDispatchRequest(request, context);
}

export function OPTIONS() {
  return new Response(null, { status: 204 });
}
