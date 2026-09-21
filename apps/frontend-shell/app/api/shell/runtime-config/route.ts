type ManifestKey = "admin" | "dispatch" | "identity" | "reporting" | "ticketing";

const manifestDefaults: Record<ManifestKey, string> = {
  admin: "http://localhost:3005/mfe/manifest",
  dispatch: "http://localhost:3002/mfe/manifest",
  identity: "http://localhost:3001/mfe/manifest",
  reporting: "http://localhost:3004/mfe/manifest",
  ticketing: "http://localhost:3003/mfe/manifest"
};

const manifestEnvKeys: Record<ManifestKey, string> = {
  admin: "NEXT_PUBLIC_MFE_ADMIN_MANIFEST_URL",
  dispatch: "NEXT_PUBLIC_MFE_DISPATCH_MANIFEST_URL",
  identity: "NEXT_PUBLIC_MFE_IDENTITY_MANIFEST_URL",
  reporting: "NEXT_PUBLIC_MFE_REPORTING_MANIFEST_URL",
  ticketing: "NEXT_PUBLIC_MFE_TICKETING_MANIFEST_URL"
};

export const dynamic = "force-dynamic";

function manifestUrlFor(key: ManifestKey) {
  const envKey = manifestEnvKeys[key];
  return process.env[envKey] || manifestDefaults[key];
}

export function GET() {
  const manifests = {
    admin: manifestUrlFor("admin"),
    dispatch: manifestUrlFor("dispatch"),
    identity: manifestUrlFor("identity"),
    reporting: manifestUrlFor("reporting"),
    ticketing: manifestUrlFor("ticketing")
  };

  return Response.json({
    generated_at: new Date().toISOString(),
    manifests,
    service: "frontend-shell"
  });
}
