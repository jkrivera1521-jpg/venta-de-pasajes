import { randomUUID } from "node:crypto";

const defaultReportingApiUrl = "http://localhost:8085/api/v1/reporting";

type RouteContext = {
  params: Promise<{
    path?: string[];
  }>;
};

function resolveReportingApiBase() {
  const configuredBase =
    process.env.REPORTING_API_URL ||
    process.env.NEXT_PUBLIC_REPORTING_API_URL ||
    defaultReportingApiUrl;

  const trimmed = configuredBase.replace(/\/+$/, "");
  return trimmed.endsWith("/reporting") ? trimmed : `${trimmed}/reporting`;
}

async function proxyReportingRequest(request: Request, context: RouteContext) {
  const params = await context.params;
  const path = params.path?.join("/") ?? "";
  const sourceUrl = new URL(request.url);
  const targetUrl = new URL(`${resolveReportingApiBase()}/${path}`);
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
          code: "REPORTING_API_UNAVAILABLE",
          message: error instanceof Error ? error.message : "reporting-service is unavailable."
        }
      },
      { status: 502 }
    );
  }
}

export function GET(request: Request, context: RouteContext) {
  return proxyReportingRequest(request, context);
}

export function POST(request: Request, context: RouteContext) {
  return proxyReportingRequest(request, context);
}

export function OPTIONS() {
  return new Response(null, { status: 204 });
}
