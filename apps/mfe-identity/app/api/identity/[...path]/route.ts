import { applyCloudRunAuthorization } from "../../_lib/cloudRunAuth";

const defaultIdentityApiUrl = "http://localhost:8081/api/v1/identity";

type RouteContext = {
  params: Promise<{
    path?: string[];
  }>;
};

function resolveIdentityApiBase() {
  const configuredBase =
    process.env.IDENTITY_API_URL ||
    process.env.NEXT_PUBLIC_IDENTITY_API_URL ||
    defaultIdentityApiUrl;

  const trimmed = configuredBase.replace(/\/+$/, "");
  return trimmed.endsWith("/identity") ? trimmed : `${trimmed}/identity`;
}

async function proxyIdentityRequest(request: Request, context: RouteContext) {
  const params = await context.params;
  const path = params.path?.join("/") ?? "";
  const sourceUrl = new URL(request.url);
  const targetUrl = new URL(`${resolveIdentityApiBase()}/${path}`);
  targetUrl.search = sourceUrl.search;

  const headers = new Headers();
  const authorization = request.headers.get("authorization");
  const contentType = request.headers.get("content-type");

  if (authorization) {
    headers.set("authorization", authorization);
  }

  if (contentType) {
    headers.set("content-type", contentType);
  }

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
          code: "IDENTITY_API_UNAVAILABLE",
          message: error instanceof Error ? error.message : "identity-service is unavailable."
        }
      },
      { status: 502 }
    );
  }
}

export function GET(request: Request, context: RouteContext) {
  return proxyIdentityRequest(request, context);
}

export function POST(request: Request, context: RouteContext) {
  return proxyIdentityRequest(request, context);
}

export function PATCH(request: Request, context: RouteContext) {
  return proxyIdentityRequest(request, context);
}

export function PUT(request: Request, context: RouteContext) {
  return proxyIdentityRequest(request, context);
}

export function OPTIONS() {
  return new Response(null, { status: 204 });
}
