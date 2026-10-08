export const dynamic = "force-dynamic";

const defaultIdentityApiUrl = "http://localhost:8081/api/v1/identity";
const healthTimeoutMs = 2500;

function resolveIdentityReadyUrlFromApiBase(apiBase: string) {
  const url = new URL(apiBase);
  const basePath = url.pathname
    .replace(/\/+$/, "")
    .replace(/\/api\/v1\/identity$/, "")
    .replace(/\/api\/v1$/, "")
    .replace(/\/identity$/, "");

  url.pathname = `${basePath}/q/health/ready`;
  url.search = "";
  url.hash = "";

  return url.toString();
}

function resolveIdentityReadyUrl() {
  const configuredHealthUrl =
    process.env.IDENTITY_READY_URL ||
    process.env.IDENTITY_HEALTH_READY_URL ||
    process.env.NEXT_PUBLIC_IDENTITY_READY_URL ||
    process.env.NEXT_PUBLIC_IDENTITY_HEALTH_READY_URL;

  if (configuredHealthUrl) {
    return configuredHealthUrl;
  }

  const configuredApiUrl =
    process.env.IDENTITY_API_URL ||
    process.env.NEXT_PUBLIC_IDENTITY_API_URL ||
    defaultIdentityApiUrl;

  return resolveIdentityReadyUrlFromApiBase(configuredApiUrl);
}

export async function GET() {
  const target = resolveIdentityReadyUrl();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), healthTimeoutMs);

  try {
    const response = await fetch(target, {
      cache: "no-store",
      signal: controller.signal
    });
    const responseText = await response.text();
    let payload: unknown = null;

    if (responseText) {
      try {
        payload = JSON.parse(responseText) as unknown;
      } catch {
        payload = responseText;
      }
    }

    return Response.json(
      {
        payload,
        ready: response.ok,
        status: response.status,
        target
      },
      { status: response.ok ? 200 : 503 }
    );
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "identity-service health ready is unavailable.",
        ready: false,
        target
      },
      { status: 503 }
    );
  } finally {
    clearTimeout(timeout);
  }
}
