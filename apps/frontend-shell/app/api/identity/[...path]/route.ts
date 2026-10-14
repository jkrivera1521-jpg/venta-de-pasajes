import { applyCloudRunAuthorization } from "../../_lib/cloudRunAuth";
import { verifyAltchaPayload } from "../../_lib/altcha";

const defaultIdentityApiUrl = "http://localhost:8081/api/v1/identity";
const altchaProtectedPaths = new Set(["auth/local/login", "auth/local/register", "auth/google/exchange"]);

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

function shouldVerifyAltcha(method: string, path: string) {
  return method === "POST" && altchaProtectedPaths.has(path);
}

function isJsonContent(contentType: string) {
  return contentType.includes("application/json") || contentType.includes("+json");
}

function jsonError(code: string, message: string, status: number) {
  return Response.json(
    {
      error: {
        code,
        message
      }
    },
    { status }
  );
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
  const userAgent = request.headers.get("user-agent");
  const forwardedFor = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");

  if (authorization) {
    headers.set("authorization", authorization);
  }

  if (contentType) {
    headers.set("content-type", contentType);
  }
  if (userAgent) {
    headers.set("user-agent", userAgent);
  }

  if (forwardedFor) {
    headers.set("x-forwarded-for", forwardedFor);
  }
  if (realIp) {
    headers.set("x-real-ip", realIp);
  }

  await applyCloudRunAuthorization(headers, targetUrl);

  let body: BodyInit | undefined;
  if (!["GET", "HEAD"].includes(request.method)) {
    body = await request.text();
  }

  const forceLogin = body && typeof body === "string" && body.includes('"force":true');
  if (shouldVerifyAltcha(request.method, path) && !forceLogin) {
    if (!contentType?.includes("application/json")) {
      return jsonError(
        "ALTCHA_JSON_REQUIRED",
        "La verificacion anti-robots requiere una solicitud JSON.",
        400
      );
    }

    let payload: Record<string, unknown>;

    try {
      payload = body ? (JSON.parse(String(body)) as Record<string, unknown>) : {};
    } catch {
      return jsonError("INVALID_JSON", "El cuerpo de la solicitud no es JSON valido.", 400);
    }

    const altchaResult = await verifyAltchaPayload(payload.altcha);

    if (!altchaResult.ok) {
      return jsonError(altchaResult.code, altchaResult.message, altchaResult.status);
    }

    delete payload.altcha;
    body = JSON.stringify(payload);
    headers.set("content-type", "application/json");
  }

  try {
    const response = await fetch(targetUrl, {
      body,
      cache: "no-store",
      headers,
      method: request.method
    });
    const responseContentType = response.headers.get("content-type") ?? "";

    if (!isJsonContent(responseContentType) && response.status !== 204) {
      await response.text();
      return jsonError(
        "IDENTITY_API_BAD_RESPONSE",
        "identity-service devolvio una respuesta no JSON. Revisa que IDENTITY_API_URL apunte a /api/v1/identity y que el servicio este levantado.",
        response.ok ? 502 : response.status
      );
    }

    return new Response(response.body, {
      headers: {
        "content-type": responseContentType || "application/json"
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

export function DELETE(request: Request, context: RouteContext) {
  return proxyIdentityRequest(request, context);
}

export function OPTIONS() {
  return new Response(null, { status: 204 });
}
