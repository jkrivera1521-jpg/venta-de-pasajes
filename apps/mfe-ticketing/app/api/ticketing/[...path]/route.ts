import { randomUUID } from "node:crypto";
import { applyCloudRunAuthorization } from "../../_lib/cloudRunAuth";

const defaultTicketingApiUrl = "http://localhost:8083/api/v1/ticketing";

type RouteContext = {
  params: Promise<{
    path?: string[];
  }>;
};

function resolveTicketingApiBase() {
  const configuredBase =
    process.env.TICKETING_API_URL ||
    process.env.NEXT_PUBLIC_TICKETING_API_URL ||
    defaultTicketingApiUrl;

  const trimmed = configuredBase.replace(/\/+$/, "");
  return trimmed.endsWith("/ticketing") ? trimmed : `${trimmed}/ticketing`;
}

async function proxyTicketingRequest(request: Request, context: RouteContext) {
  const params = await context.params;
  const path = params.path?.join("/") ?? "";
  const sourceUrl = new URL(request.url);
  const targetUrl = new URL(`${resolveTicketingApiBase()}/${path}`);
  targetUrl.search = sourceUrl.search;

  const headers = new Headers();
  const authorization = request.headers.get("authorization");
  const contentType = request.headers.get("content-type");
  const actorUserId = request.headers.get("x-actor-user-id");
  const correlationId = request.headers.get("x-correlation-id") || randomUUID();

  if (authorization) {
    headers.set("authorization", authorization);
  }

  if (contentType) {
    headers.set("content-type", contentType);
  }

  if (actorUserId) {
    headers.set("x-actor-user-id", actorUserId);
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
          code: "TICKETING_API_UNAVAILABLE",
          message: error instanceof Error ? error.message : "ticketing-service is unavailable."
        }
      },
      { status: 502 }
    );
  }
}

export function GET(request: Request, context: RouteContext) {
  return proxyTicketingRequest(request, context);
}

export function POST(request: Request, context: RouteContext) {
  return proxyTicketingRequest(request, context);
}

export function PUT(request: Request, context: RouteContext) {
  return proxyTicketingRequest(request, context);
}

export function DELETE(request: Request, context: RouteContext) {
  return proxyTicketingRequest(request, context);
}

export function OPTIONS() {
  return new Response(null, { status: 204 });
}
