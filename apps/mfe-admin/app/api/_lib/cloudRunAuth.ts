const metadataIdentityUrl = "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity";
const metadataTimeoutMs = 1500;

function isLocalTarget(targetUrl: URL) {
  return ["localhost", "127.0.0.1", "::1"].includes(targetUrl.hostname);
}

function shouldUseCloudRunIdentity(targetUrl: URL) {
  return Boolean(process.env.K_SERVICE) && targetUrl.protocol === "https:" && targetUrl.hostname.endsWith(".run.app") && !isLocalTarget(targetUrl);
}

async function fetchCloudRunIdentityToken(audience: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), metadataTimeoutMs);
  const url = `${metadataIdentityUrl}?audience=${encodeURIComponent(audience)}&format=full`;

  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: {
        "Metadata-Flavor": "Google"
      },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Metadata identity token request failed with HTTP ${response.status}`);
    }

    return response.text();
  } finally {
    clearTimeout(timeout);
  }
}

export async function applyCloudRunAuthorization(headers: Headers, targetUrl: URL) {
  if (!shouldUseCloudRunIdentity(targetUrl)) {
    return;
  }

  const originalAuthorization = headers.get("authorization");
  if (originalAuthorization) {
    headers.set("x-forwarded-authorization", originalAuthorization);
  }

  const token = await fetchCloudRunIdentityToken(targetUrl.origin);
  headers.set("authorization", `Bearer ${token}`);
}
